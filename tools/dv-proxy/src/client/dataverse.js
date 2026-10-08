// Browser-side Dataverse helpers for the harness. Every call goes to the
// same origin; the dv-proxy forwards it with a bearer token.

export const API = '/api/data/v9.2/'

export class DataverseError extends Error {
  constructor(message, { status, code, errorCode } = {}) {
    super(message)
    this.status = status
    this.code = code
    // Xrm-style numeric error code, e.g. -2147220960.
    this.errorCode = errorCode
  }
}

function toErrorCode(hex) {
  if (typeof hex !== 'string' || !/^0x[0-9a-f]+$/i.test(hex)) return undefined
  const n = Number.parseInt(hex, 16)
  return n > 0x7fffffff ? n - 0x100000000 : n
}

/** Raw Web API call. Returns { status, headers, body }. */
export async function dvFetch(path, { method = 'GET', body, headers = {}, annotations = true, maxPageSize } = {}) {
  const prefer = []
  if (annotations) prefer.push('odata.include-annotations="*"')
  if (maxPageSize) prefer.push(`odata.maxpagesize=${maxPageSize}`)
  if (method === 'POST' || method === 'PATCH') prefer.push('return=representation')
  const response = await fetch(path.startsWith('/') ? path : API + path, {
    method,
    headers: {
      accept: 'application/json',
      'odata-version': '4.0',
      'odata-maxversion': '4.0',
      ...(body !== undefined ? { 'content-type': 'application/json; charset=utf-8' } : {}),
      ...(prefer.length ? { prefer: prefer.join(',') } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  })
  const text = await response.text()
  let parsed = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }
  if (!response.ok) {
    const err = parsed?.error ?? {}
    throw new DataverseError(err.message ?? `${response.status} ${response.statusText}`, {
      status: response.status,
      code: err.code,
      errorCode: toErrorCode(err.code),
    })
  }
  return { status: response.status, headers: response.headers, body: parsed }
}

export async function dvGet(path, options) {
  return (await dvFetch(path, options)).body
}

/** Rewrite an org-absolute nextLink so it goes through the proxy again. */
export function localLink(link) {
  if (typeof link !== 'string') return link
  return link.replace(/^https:\/\/[^/]+\/api\/data\//i, `${location.origin}/api/data/`)
}

function label(value, fallback) {
  const l = value?.UserLocalizedLabel?.Label
  return typeof l === 'string' && l ? l : fallback
}

const metaCache = new Map()

/** Entity metadata incl. all attributes, cached per logical name. */
export function entityMeta(logicalName) {
  const key = String(logicalName).toLowerCase()
  if (!metaCache.has(key)) {
    metaCache.set(
      key,
      dvGet(
        `EntityDefinitions(LogicalName='${key}')?$select=LogicalName,EntitySetName,PrimaryIdAttribute,PrimaryNameAttribute,DisplayName,DisplayCollectionName,ObjectTypeCode,IsActivity` +
          `&$expand=Attributes($select=LogicalName,DisplayName,AttributeType,AttributeTypeName,RequiredLevel,IsValidForUpdate,IsSecured,AttributeOf)`,
        { annotations: false },
      ).then((m) => {
        const attributes = new Map()
        for (const a of m.Attributes ?? []) {
          attributes.set(a.LogicalName, {
            logicalName: a.LogicalName,
            displayName: label(a.DisplayName, a.LogicalName),
            type: a.AttributeType,
            typeName: a.AttributeTypeName?.Value ?? '',
            requiredLevel: a.RequiredLevel?.Value ?? 'None',
            updatable: a.IsValidForUpdate !== false,
            secured: Boolean(a.IsSecured),
            attributeOf: a.AttributeOf ?? null,
          })
        }
        return {
          logicalName: m.LogicalName,
          entitySetName: m.EntitySetName,
          primaryId: m.PrimaryIdAttribute,
          primaryName: m.PrimaryNameAttribute,
          displayName: label(m.DisplayName, m.LogicalName),
          displayCollectionName: label(m.DisplayCollectionName, m.LogicalName),
          objectTypeCode: m.ObjectTypeCode,
          isActivity: Boolean(m.IsActivity),
          attributes,
        }
      }),
    )
    // A failed lookup must not poison the cache.
    metaCache.get(key).catch(() => metaCache.delete(key))
  }
  return metaCache.get(key)
}

export async function entitySet(logicalName) {
  return (await entityMeta(logicalName)).entitySetName
}

const optionCache = new Map()

/** Options of a choice / status / boolean column: [{ Value, Label, Color }]. */
export function attributeOptions(entity, attribute, type, typeName) {
  const key = `${entity}.${attribute}`
  if (!optionCache.has(key)) {
    const cast =
      typeName === 'MultiSelectPicklistType'
        ? 'MultiSelectPicklistAttributeMetadata'
        : type === 'State'
          ? 'StateAttributeMetadata'
          : type === 'Status'
            ? 'StatusAttributeMetadata'
            : type === 'Boolean'
              ? 'BooleanAttributeMetadata'
              : 'PicklistAttributeMetadata'
    optionCache.set(
      key,
      dvGet(
        `EntityDefinitions(LogicalName='${entity}')/Attributes(LogicalName='${attribute}')/Microsoft.Dynamics.CRM.${cast}?$select=LogicalName&$expand=OptionSet`,
        { annotations: false },
      )
        .then((r) => {
          const set = r.OptionSet ?? {}
          if (type === 'Boolean') {
            return [
              { Value: 0, Label: label(set.FalseOption?.Label, 'No'), Color: set.FalseOption?.Color ?? null },
              { Value: 1, Label: label(set.TrueOption?.Label, 'Yes'), Color: set.TrueOption?.Color ?? null },
            ]
          }
          return (set.Options ?? []).map((o) => ({
            Value: o.Value,
            Label: label(o.Label, String(o.Value)),
            Color: o.Color ?? null,
          }))
        })
        .catch(() => []),
    )
  }
  return optionCache.get(key)
}

const targetCache = new Map()

export function lookupTargets(entity, attribute) {
  const key = `${entity}.${attribute}`
  if (!targetCache.has(key)) {
    targetCache.set(
      key,
      dvGet(
        `EntityDefinitions(LogicalName='${entity}')/Attributes(LogicalName='${attribute}')/Microsoft.Dynamics.CRM.LookupAttributeMetadata?$select=Targets`,
        { annotations: false },
      )
        .then((r) => r.Targets ?? [])
        .catch(() => []),
    )
  }
  return targetCache.get(key)
}

export const FV = '@OData.Community.Display.V1.FormattedValue'
export const LOOKUP_ETN = '@Microsoft.Dynamics.CRM.lookuplogicalname'

/** PCF data type of a Dataverse attribute. */
export function pcfType(attr) {
  if (!attr) return 'SingleLine.Text'
  if (attr.typeName === 'MultiSelectPicklistType') return 'MultiSelectPicklist'
  switch (attr.type) {
    case 'Memo':
      return 'Multiple'
    case 'Integer':
    case 'BigInt':
      return 'Whole.None'
    case 'Decimal':
      return 'Decimal'
    case 'Double':
      return 'FP'
    case 'Money':
      return 'Currency'
    case 'DateTime':
      return 'DateAndTime.DateAndTime'
    case 'Boolean':
      return 'TwoOptions'
    case 'Picklist':
    case 'State':
    case 'Status':
      return 'OptionSet'
    case 'Lookup':
      return 'Lookup.Simple'
    case 'Customer':
      return 'Lookup.Customer'
    case 'Owner':
      return 'Lookup.Owner'
    case 'PartyList':
      return 'Lookup.PartyList'
    default:
      return 'SingleLine.Text'
  }
}

/** Value of a column in a Web API row, in PCF terms. */
export function pcfValue(row, column, attr) {
  const lookupKey = `_${column}_value`
  if (lookupKey in row) {
    const id = row[lookupKey]
    if (!id) return null
    return { id: { guid: id }, name: row[`${lookupKey}${FV}`] ?? '', etn: row[`${lookupKey}${LOOKUP_ETN}`] ?? '' }
  }
  const raw = row[column]
  if (raw === undefined || raw === null) return null
  const type = attr?.type
  if (type === 'DateTime' && typeof raw === 'string') return new Date(raw)
  if (attr?.typeName === 'MultiSelectPicklistType' && typeof raw === 'string') {
    return raw.split(',').map((v) => Number(v))
  }
  return raw
}

export function pcfFormatted(row, column) {
  const lookupKey = `_${column}_value`
  if (lookupKey in row) return row[`${lookupKey}${FV}`] ?? ''
  const f = row[`${column}${FV}`]
  if (typeof f === 'string') return f
  const raw = row[column]
  return raw === null || raw === undefined ? '' : String(raw)
}
