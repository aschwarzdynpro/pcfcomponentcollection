// The proxy core: a connect-style middleware that forwards Web API calls to
// Dataverse with a bearer token, plus a few helper endpoints for the harness.
//
//   /api/data/...                 → the configured org
//   /__dv/<host>/api/data/...     → another org in the same tenant (WithOrganization)
//   /__dvproxy/info               → org, user, language
//   /__dvproxy/organizations      → reachable orgs (Global Discovery)
//   /__dvproxy/events             → server-sent events: one per proxied call
//
// Writes (anything but GET/HEAD) are refused unless the proxy was started with
// --allow-writes: these are customer systems, and a harness click should not
// be able to change data by accident.

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** Request headers never forwarded upstream. */
const DROP_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'cookie',
  'origin',
  'referer',
  'authorization',
  'content-length',
  'accept-encoding',
  'sec-fetch-site',
  'sec-fetch-mode',
  'sec-fetch-dest',
  'upgrade-insecure-requests',
])

/** Response headers never passed back (fetch already decoded the body). */
const DROP_RESPONSE_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'set-cookie',
  'strict-transport-security',
])

const ALLOWED_HOST_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.(dynamics\.com|crm\.microsoftdynamics\.de|dynamics\.cn|microsoftdynamics\.us|appsplatform\.us)$/i

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(chunks.length ? Buffer.concat(chunks) : undefined))
    req.on('error', reject)
  })
}

function sendJson(res, status, body, extraHeaders = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...extraHeaders })
  res.end(JSON.stringify(body))
}

function isLocalOrigin(origin) {
  return typeof origin === 'string' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
}

/**
 * @param {{ orgUrl: string, auth: import('./auth.mjs').Authenticator, allowWrites: boolean,
 *           verbose?: boolean }} options
 */
export function createDataverseProxy({ orgUrl, auth, allowWrites, verbose = true }) {
  const org = new URL(orgUrl).origin
  const listeners = new Set()
  let infoCache = null

  const emit = (event) => {
    const line = `data: ${JSON.stringify(event)}\n\n`
    for (const res of listeners) res.write(line)
  }

  /** Server-side Web API call, used for the helper endpoints. */
  async function api(path, target = org) {
    const token = await auth.getToken(target)
    const response = await fetch(`${target}/api/data/v9.2/${path}`, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/json',
        'odata-version': '4.0',
        'odata-maxversion': '4.0',
        prefer: 'odata.include-annotations="*"',
      },
    })
    if (!response.ok) throw new Error(`${response.status} ${await response.text()}`)
    return response.json()
  }

  async function info() {
    if (infoCache) return infoCache
    const who = await api('WhoAmI')
    const [user, settings, orgRow, current] = await Promise.all([
      api(`systemusers(${who.UserId})?$select=fullname,domainname,internalemailaddress,azureactivedirectoryobjectid`).catch(() => ({})),
      api(
        `usersettingscollection?$select=uilanguageid,localeid,timezonebias,dateformatstring,timeformatstring,decimalsymbol,numberseparator&$filter=systemuserid eq ${who.UserId}`,
      )
        .then((r) => r.value?.[0] ?? {})
        .catch(() => ({})),
      api(`organizations(${who.OrganizationId})?$select=name,languagecode`).catch(() => ({})),
      api(`RetrieveCurrentOrganization(AccessType=@p)?@p=Microsoft.Dynamics.CRM.EndpointAccessType'Default'`)
        .then((r) => r.Detail ?? {})
        .catch(() => ({})),
    ])
    infoCache = {
      orgUrl: org,
      organizationId: who.OrganizationId,
      environmentId: current.EnvironmentId ?? null,
      tenantId: current.TenantId ?? null,
      azureObjectId: user.azureactivedirectoryobjectid ?? null,
      organizationName: orgRow.name ?? null,
      baseLanguage: orgRow.languagecode ?? null,
      userId: who.UserId,
      businessUnitId: who.BusinessUnitId,
      fullName: user.fullname ?? auth.username ?? null,
      userName: user.domainname ?? user.internalemailaddress ?? auth.username ?? null,
      languageId: settings.uilanguageid || orgRow.languagecode || 1033,
      localeId: settings.localeid ?? null,
      timeZoneBias: settings.timezonebias ?? null,
      dateFormat: settings.dateformatstring ?? null,
      timeFormat: settings.timeformatstring ?? null,
      decimalSymbol: settings.decimalsymbol ?? null,
      numberSeparator: settings.numberseparator ?? null,
      allowWrites,
    }
    return infoCache
  }

  async function organizations() {
    const current = await info()
    const list = [{ Url: org, FriendlyName: current.organizationName ?? org }]
    try {
      const disco = 'https://globaldisco.crm.dynamics.com'
      const token = await auth.getToken(disco)
      const response = await fetch(`${disco}/api/discovery/v2.0/Instances`, {
        headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
      })
      if (response.ok) {
        const body = await response.json()
        for (const inst of body.value ?? []) {
          const url = String(inst.Url ?? '').replace(/\/$/, '')
          if (url && url !== org) list.push({ Url: url, FriendlyName: inst.FriendlyName ?? url })
        }
      }
    } catch (err) {
      console.warn(`[proxy] Global Discovery unavailable (${err?.message ?? err}) — listing the configured org only`)
    }
    return list
  }

  async function forward(req, res, target, path) {
    const started = Date.now()
    const method = req.method ?? 'GET'
    if (!READ_METHODS.has(method) && !allowWrites) {
      emit({ method, path, status: 403, ms: 0, blocked: true, target })
      if (verbose) console.log(`  ✋ ${method} ${path}  (blocked — read-only)`)
      sendJson(res, 403, {
        error: {
          code: 'DvProxyReadOnly',
          message: `dv-proxy is read-only: ${method} was not sent to Dataverse. Restart with --allow-writes to permit writes.`,
        },
      })
      return
    }

    const headers = {}
    for (const [key, value] of Object.entries(req.headers)) {
      if (!DROP_REQUEST_HEADERS.has(key.toLowerCase()) && value !== undefined) headers[key] = value
    }
    headers.authorization = `Bearer ${await auth.getToken(target)}`
    headers['odata-version'] ??= '4.0'
    headers['odata-maxversion'] ??= '4.0'

    const body = READ_METHODS.has(method) ? undefined : await readBody(req)
    let upstream
    try {
      upstream = await fetch(`${target}${path}`, { method, headers, body, redirect: 'manual' })
    } catch (err) {
      emit({ method, path, status: 502, ms: Date.now() - started, target })
      sendJson(res, 502, { error: { code: 'DvProxyUpstream', message: String(err?.message ?? err) } })
      return
    }

    const outHeaders = {}
    upstream.headers.forEach((value, key) => {
      if (!DROP_RESPONSE_HEADERS.has(key.toLowerCase())) outHeaders[key] = value
    })
    // OData-EntityId and Location point at the org; rewrite them to the proxy
    // so callers that parse the id out of them keep working.
    for (const key of ['odata-entityid', 'location']) {
      if (outHeaders[key]) outHeaders[key] = outHeaders[key].replace(target, '')
    }
    const buffer = Buffer.from(await upstream.arrayBuffer())
    res.writeHead(upstream.status, outHeaders)
    res.end(buffer)

    const ms = Date.now() - started
    emit({ method, path, status: upstream.status, ms, target: target === org ? undefined : target })
    if (verbose) {
      const mark = upstream.status >= 400 ? '✗' : '→'
      const where = target === org ? '' : ` @${new URL(target).host}`
      console.log(`  ${mark} ${method} ${upstream.status} ${String(ms).padStart(5)}ms ${decodeURIComponent(path).slice(0, 160)}${where}`)
    }
  }

  /** connect-style middleware: (req, res, next) */
  async function middleware(req, res, next) {
    const url = req.url ?? '/'
    try {
      if (req.method === 'OPTIONS' && (url.startsWith('/api/data') || url.startsWith('/__dv'))) {
        const origin = req.headers.origin
        res.writeHead(204, {
          'access-control-allow-origin': isLocalOrigin(origin) ? origin : 'null',
          'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
          'access-control-allow-headers': req.headers['access-control-request-headers'] ?? '*',
          'access-control-expose-headers': 'OData-EntityId, Location, Preference-Applied',
          'access-control-max-age': '600',
        })
        res.end()
        return
      }
      if (isLocalOrigin(req.headers.origin)) {
        res.setHeader('access-control-allow-origin', req.headers.origin)
        res.setHeader('access-control-expose-headers', 'OData-EntityId, Location, Preference-Applied')
      }

      if (url.startsWith('/api/data/')) {
        await forward(req, res, org, url)
        return
      }
      const other = /^\/__dv\/([^/]+)(\/api\/data\/.*)$/.exec(url)
      if (other) {
        const host = decodeURIComponent(other[1])
        if (!ALLOWED_HOST_RE.test(host)) {
          sendJson(res, 400, { error: { code: 'DvProxyHost', message: `Not a Dataverse host: ${host}` } })
          return
        }
        await forward(req, res, `https://${host}`, other[2])
        return
      }
      if (url === '/__dvproxy/info') {
        sendJson(res, 200, await info())
        return
      }
      if (url === '/__dvproxy/organizations') {
        sendJson(res, 200, { value: await organizations() })
        return
      }
      if (url === '/__dvproxy/events') {
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        })
        res.write(': connected\n\n')
        listeners.add(res)
        req.on('close', () => listeners.delete(res))
        return
      }
    } catch (err) {
      console.error('[proxy]', err)
      if (!res.headersSent) {
        sendJson(res, 500, { error: { code: 'DvProxyError', message: String(err?.message ?? err) } })
      }
      return
    }
    if (next) next()
    else sendJson(res, 404, { error: { code: 'NotFound', message: url } })
  }

  return { middleware, info, emit, orgUrl: org }
}
