// dv-proxy runtime for Code Apps. Loaded first by the Vite plugin; replaces
// the Power Apps host as the SDK's data executor, so the app's generated
// services talk to Dataverse through the local proxy.
//
// Covered:
//   - Dataverse tables (CRUD, file/image columns)
//   - executeAsync: getEntityMetadata, customapi (Custom APIs / functions / actions)
//   - the Microsoft Dataverse connector (commondataserviceforapps), incl.
//     the …WithOrganization operations, mapped onto Web API calls
// Not covered: other connectors (Office 365, Azure DevOps, flows …) — they
// return a clear error instead of hanging.

import { setDataOperationExecutor } from '@microsoft/power-apps/internal/data'

// Replaced by the plugin with the app's .power/schemas/appschemas/dataSourcesInfo.ts.
const dataSourcesInfo = /*DV_PROXY_SOURCES*/ {}

const API = '/api/data/v9.2/'
const DATAVERSE_CONNECTOR = 'commondataserviceforapps'

let infoPromise
function info() {
  infoPromise ??= fetch('/__dvproxy/info').then((r) => r.json())
  return infoPromise
}

class ProxyHttpError extends Error {
  constructor(message, status, code) {
    super(message)
    this.name = 'PowerDataRuntimeHttpError'
    this.status = status
    this.code = code
  }
}

const ok = (data, extra = {}) => ({ success: true, data, ...extra })
const fail = (error) => ({ success: false, data: null, error })

async function call(url, { method = 'GET', body, headers = {}, binary = false } = {}) {
  const isBinary = body instanceof Blob || body instanceof ArrayBuffer || ArrayBuffer.isView(body)
  const init = {
    method,
    headers: {
      accept: binary ? 'application/octet-stream' : 'application/json',
      'odata-version': '4.0',
      'odata-maxversion': '4.0',
      ...(body !== undefined && !isBinary && typeof body !== 'string' ? { 'content-type': 'application/json; charset=utf-8' } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : isBinary || typeof body === 'string' ? body : JSON.stringify(body),
  }
  let response
  try {
    response = await fetch(url, init)
  } catch (err) {
    return fail(new ProxyHttpError(String(err?.message ?? err), 0))
  }
  if (binary && response.ok) {
    return ok(new Uint8Array(await response.arrayBuffer()), {
      fileName: response.headers.get('x-ms-file-name') ?? undefined,
    })
  }
  const text = await response.text()
  let parsed
  try {
    parsed = text ? JSON.parse(text) : undefined
  } catch {
    parsed = text
  }
  if (!response.ok) {
    const e = parsed?.error ?? {}
    return fail(new ProxyHttpError(e.message ?? `${response.status} ${response.statusText}`, response.status, e.code))
  }
  return ok(parsed)
}

/** Same encoding as the SDK's convertOptionsToQueryString. */
function queryString(options) {
  if (!options) return ''
  const enc = (s) => encodeURIComponent(s.trim()).replace(/%20/g, '+').replace(/'/g, '%27')
  const parts = []
  if (options.select?.length) parts.push(`$select=${encodeURIComponent(options.select.map((s) => s.trim()).join(','))}`)
  if (options.filter) parts.push(`$filter=${enc(options.filter)}`)
  if (options.orderBy?.length) parts.push(`$orderby=${encodeURIComponent(options.orderBy.map((s) => s.trim()).join(','))}`)
  if (options.top !== undefined && options.top !== null) parts.push(`$top=${options.top}`)
  if (options.skip !== undefined && options.skip !== null) parts.push(`$skip=${options.skip}`)
  if (options.count !== undefined && options.count !== null) parts.push(`$count=${options.count}`)
  if (options.skipToken?.trim()) parts.push(`$skiptoken=${encodeURIComponent(options.skipToken.trim())}`)
  return parts.length ? `?${parts.join('&')}` : ''
}

function skipTokenOf(nextLink) {
  if (typeof nextLink !== 'string') return undefined
  const m = /[?&]\$?skiptoken=([^&#]+)/i.exec(nextLink)
  return m ? decodeURIComponent(m[1]) : undefined
}

const logicalNameCache = new Map()
async function logicalNameOf(entitySet) {
  if (!logicalNameCache.has(entitySet)) {
    logicalNameCache.set(
      entitySet,
      call(`${API}EntityDefinitions?$select=LogicalName&$filter=EntitySetName eq '${entitySet}'`).then(
        (r) => r.data?.value?.[0]?.LogicalName ?? entitySet,
      ),
    )
  }
  return logicalNameCache.get(entitySet)
}

function toODataLiteral(value, type) {
  if (value === null || value === undefined) return 'null'
  if (type === 'string') return `'${String(value).replace(/'/g, "''")}'`
  return String(value)
}

/** API base for an organization value from a …WithOrganization call. */
async function apiBaseFor(organization) {
  if (!organization || organization === 'current') return '/api/data/'
  let host
  try {
    host = new URL(organization).host
  } catch {
    return '/api/data/'
  }
  const { orgUrl } = await info()
  return new URL(orgUrl).host.toLowerCase() === host.toLowerCase() ? '/api/data/' : `/__dv/${host}/api/data/`
}

async function dataverseConnector(operationName, parameters = {}) {
  const apiDef = dataSourcesInfo[DATAVERSE_CONNECTOR]?.apis?.[operationName]
  if (operationName === 'GetOrganizations') {
    const r = await call('/__dvproxy/organizations')
    if (!r.success) return r
    return ok({ value: [{ Url: 'current', FriendlyName: '(Current)' }, ...(r.data?.value ?? [])] })
  }
  if (!apiDef) return fail(new ProxyHttpError(`dv-proxy: Dataverse-Connector-Operation "${operationName}" unbekannt`, 501))

  let path = apiDef.path.replace(/^\/\{connectionId\}/, '')
  if (path.startsWith('/flow/')) path = path.slice('/flow'.length)
  const match = /^\/api\/data\/v[0-9.]+\/(.*)$/.exec(path)
  if (!match) {
    return fail(
      new ProxyHttpError(`dv-proxy: "${operationName}" (${apiDef.path}) wird im Proxy-Modus nicht nachgebildet`, 501),
    )
  }
  let rest = match[1]
  const query = []
  const headers = {}
  let body
  for (const p of apiDef.parameters ?? []) {
    const value = parameters[p.name]
    if (p.name === 'connectionId' || p.name === 'organization') continue
    if (p.in === 'path') {
      rest = rest.replace(`{${p.name}}`, encodeURIComponent(String(value ?? '')).replace(/%2C/gi, ','))
    } else if (value === undefined || value === null || value === '') {
      continue
    } else if (p.in === 'query') {
      query.push(`${p.name}=${encodeURIComponent(String(value))}`)
    } else if (p.in === 'header') {
      if (['prefer', 'accept', 'if-match', 'if-none-match'].includes(p.name.toLowerCase())) headers[p.name] = String(value)
    } else if (p.in === 'body') {
      body = value
    }
  }
  const base = await apiBaseFor(parameters.organization)
  const url = `${base}v9.2/${rest}${query.length ? `?${query.join('&')}` : ''}`
  if (!headers.prefer && !headers.Prefer) headers.prefer = 'odata.include-annotations="*"'
  return call(url, { method: apiDef.method.toUpperCase(), body, headers })
}

const executor = {
  async createRecordAsync(tableName, data) {
    return call(`${API}${tableName}`, { method: 'POST', body: data, headers: { prefer: 'return=representation,odata.include-annotations="*"' } })
  },
  async updateRecordAsync(tableName, id, data) {
    return call(`${API}${tableName}(${id})`, { method: 'PATCH', body: data, headers: { prefer: 'return=representation,odata.include-annotations="*"' } })
  },
  async deleteRecordAsync(tableName, id) {
    const r = await call(`${API}${tableName}(${id})`, { method: 'DELETE' })
    return r.success ? ok(undefined) : r
  },
  async retrieveRecordAsync(tableName, id, options) {
    const { maxPageSize: _ignored, ...rest } = options ?? {}
    return call(`${API}${tableName}(${id})${queryString(rest)}`, { headers: { prefer: 'odata.include-annotations=*' } })
  },
  async retrieveMultipleRecordsAsync(tableName, options) {
    const { maxPageSize = 500, ...rest } = options ?? {}
    const r = await call(`${API}${tableName}${queryString(rest)}`, {
      headers: { prefer: `odata.maxpagesize=${maxPageSize},odata.include-annotations=*` },
    })
    if (!r.success) return { ...r, data: [] }
    return ok(r.data?.value ?? [], { skipToken: skipTokenOf(r.data?.['@odata.nextLink']) })
  },
  async uploadFileToRecord(tableName, id, columnName, fileName, data) {
    const r = await call(`${API}${tableName}(${id})/${columnName}`, {
      method: 'PATCH',
      body: typeof data === 'string' ? new TextEncoder().encode(data) : data,
      headers: { 'content-type': 'application/octet-stream', 'x-ms-file-name': fileName },
    })
    return r.success ? ok(undefined) : r
  },
  async downloadFileFromRecord(tableName, id, columnName) {
    return call(`${API}${tableName}(${id})/${columnName}/$value`, { binary: true })
  },
  async downloadImageFromRecord(tableName, id, columnName, fullSize = false) {
    return call(`${API}${tableName}(${id})/${columnName}/$value${fullSize ? '?size=full' : ''}`, { binary: true })
  },
  async deleteFileOrImageFromRecord(tableName, id, columnName) {
    const r = await call(`${API}${tableName}(${id})/${columnName}`, { method: 'DELETE' })
    return r.success ? ok(undefined) : r
  },
  async executeAsync(operation) {
    const { dataverseRequest, connectorOperation } = operation ?? {}
    if (connectorOperation) {
      const { tableName, operationName, parameters } = connectorOperation
      if (tableName === DATAVERSE_CONNECTOR) return dataverseConnector(operationName, parameters)
      return fail(
        new ProxyHttpError(
          `dv-proxy: Connector "${tableName}" (${operationName}) wird im Proxy-Modus nicht unterstützt — nur Dataverse-Tabellen, Custom APIs und der Dataverse-Connector.`,
          501,
        ),
      )
    }
    if (!dataverseRequest) return fail(new ProxyHttpError('Dataverse request details are required.', 400))
    const { action, parameters = {} } = dataverseRequest
    if (action === 'getEntityMetadata') {
      const logical = await logicalNameOf(parameters.tableName)
      const { metadata, schema } = parameters.options ?? {}
      const selects = new Set(Array.isArray(metadata) ? metadata : [])
      selects.add('LogicalName')
      const expands = []
      if (schema?.manyToOne) expands.push('ManyToOneRelationships')
      if (schema?.oneToMany) expands.push('OneToManyRelationships')
      if (schema?.manyToMany) expands.push('ManyToManyRelationships')
      if (schema?.columns === 'all') expands.push('Attributes')
      else if (Array.isArray(schema?.columns) && schema.columns.length) {
        expands.push(
          `Attributes($filter=Microsoft.Dynamics.CRM.In(PropertyName='LogicalName',PropertyValues=[${schema.columns.map((c) => `'${c}'`).join(',')}]))`,
        )
      }
      const search = new URLSearchParams({ $select: [...selects].join(','), $expand: expands.join(',') })
      return call(`${API}EntityDefinitions(LogicalName='${logical}')?${search}`, { headers: { consistency: 'Strong' } })
    }
    if (action === 'customapi') {
      const { operationName, tableName, body = {} } = parameters
      const apiDef = dataSourcesInfo[tableName]?.apis?.[operationName]
      if (!apiDef) {
        return fail(new ProxyHttpError(`Operation '${operationName}' not found in data source '${tableName}'.`, 404))
      }
      let path = apiDef.path
      const requestBody = {}
      const fnParams = []
      for (const p of apiDef.parameters ?? []) {
        if (p.in === 'path') path = path.replace(`{${p.name}}`, encodeURIComponent(String(body[p.name] ?? '')))
        else if (p.in === 'body' && p.name in body) requestBody[p.name] = body[p.name]
        else if (p.in === 'query' && p.name in body) fnParams.push(`${p.name}=${toODataLiteral(body[p.name], p.type)}`)
      }
      if (fnParams.length) path += `(${fnParams.join(',')})`
      const url = path.startsWith('/') ? path : `/${path}`
      return apiDef.method.toUpperCase() === 'GET' ? call(url) : call(url, { method: 'POST', body: requestBody })
    }
    return fail(new ProxyHttpError(`Unsupported Dataverse action: "${action}"`, 400))
  },
}

setDataOperationExecutor(executor)
console.info('[dv-proxy] data executor installed — Dataverse calls go through the local proxy')
