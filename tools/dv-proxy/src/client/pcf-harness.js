// dv-proxy PCF harness: loads the built control and runs it with a
// ComponentFramework.Context whose data comes from the real environment.

import {
  attributeOptions,
  dvFetch,
  dvGet,
  entityMeta,
  localLink,
  lookupTargets,
  pcfFormatted,
  pcfType,
  pcfValue,
} from './dataverse.js'
import { HarnessDataset } from './dataset.js'

const $ = (id) => document.getElementById(id)
const params = new URLSearchParams(location.search)

const storage = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key)
      return v === null ? fallback : JSON.parse(v)
    } catch {
      return fallback
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // storage unavailable — settings just don't persist
    }
  },
}

/** Harness state. */
const S = {
  config: null,
  info: null,
  manifest: null,
  strings: {},
  lcid: 1033,
  formFactor: 1,
  disabled: false,
  record: { table: '', id: '', name: '', row: null, meta: null },
  props: {}, // name -> { column?, value?, dirty? }
  attrInfo: {}, // prop name -> { attr, options, targets }
  datasets: new Map(),
  Ctor: null,
  instance: null,
  container: null,
  reactRoot: null,
  trackResize: false,
  controlState: {},
  idCounter: 0,
}

let storeKey = 'dv-proxy:pcf'

// ───────────────────────────── log ─────────────────────────────

const counts = { calls: 0, events: 0 }

function logLine(list, html, cls) {
  const li = document.createElement('li')
  if (cls) li.className = cls
  const time = new Date().toLocaleTimeString()
  li.innerHTML = `<time>${time}</time>${html}`
  list.prepend(li)
  while (list.children.length > 500) list.lastChild.remove()
}

function esc(s) {
  return String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c])
}

function logCall(e) {
  counts.calls += 1
  $('h-calls-count').textContent = `(${counts.calls})`
  const cls = e.blocked ? 'h-s-blocked' : e.status >= 400 ? 'h-s-err' : ''
  const target = e.target ? ` <span class="h-muted">@${esc(new URL(e.target).host)}</span>` : ''
  let path = e.path
  try {
    path = decodeURIComponent(e.path)
  } catch {
    // keep encoded
  }
  logLine($('h-log-calls'), `${esc(e.method)} ${e.blocked ? 'BLOCKIERT (read-only)' : e.status} ${e.ms}ms ${esc(path)}${target}`, cls)
}

function logEvent({ kind = 'event', text }) {
  counts.events += 1
  $('h-events-count').textContent = `(${counts.events})`
  const cls = kind === 'error' ? 'h-s-err' : kind === 'warn' ? 'h-s-blocked' : kind === 'ok' ? 'h-s-ok' : ''
  logLine($('h-log-events'), esc(text), cls)
  if (kind === 'error') console.error('[harness]', text)
}

function showError(text) {
  const box = $('h-error')
  box.hidden = !text
  box.textContent = text ?? ''
}

// ───────────────────────────── modal ─────────────────────────────

function modal({ title, body, actions }) {
  return new Promise((resolve) => {
    $('h-modal-title').textContent = title ?? ''
    const bodyEl = $('h-modal-body')
    bodyEl.innerHTML = ''
    if (typeof body === 'string') bodyEl.textContent = body
    else if (body) bodyEl.appendChild(body)
    const actionsEl = $('h-modal-actions')
    actionsEl.innerHTML = ''
    const close = (value) => {
      $('h-modal').hidden = true
      resolve(value)
    }
    for (const a of actions ?? [{ label: 'OK', value: true, primary: true }]) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = a.label
      if (a.primary) b.className = 'h-primary'
      b.onclick = () => close(a.value)
      actionsEl.appendChild(b)
    }
    $('h-modal').hidden = false
    modal.close = close
  })
}

// ───────────────────────────── manifest ─────────────────────────────

function parseManifest(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const control = doc.querySelector('control')
  const groups = {}
  for (const g of doc.querySelectorAll('type-group')) {
    groups[g.getAttribute('name')] = [...g.querySelectorAll('type')].map((t) => t.textContent.trim())
  }
  const properties = [...control.querySelectorAll(':scope > property')].map((p) => ({
    name: p.getAttribute('name'),
    displayKey: p.getAttribute('display-name-key'),
    ofType: p.getAttribute('of-type'),
    group: p.getAttribute('of-type-group'),
    types: p.getAttribute('of-type') ? [p.getAttribute('of-type')] : (groups[p.getAttribute('of-type-group')] ?? []),
    usage: p.getAttribute('usage') ?? 'input',
    required: p.getAttribute('required') === 'true',
    defaultValue: p.getAttribute('default-value'),
    enumValues: [...p.querySelectorAll('value')].map((v) => ({
      name: v.getAttribute('name'),
      displayKey: v.getAttribute('display-name-key'),
      value: v.textContent.trim(),
    })),
  }))
  const dataSets = [...control.querySelectorAll(':scope > data-set')].map((d) => ({
    name: d.getAttribute('name'),
    displayKey: d.getAttribute('display-name-key'),
    propertySets: [...d.querySelectorAll('property-set')].map((ps) => ({
      name: ps.getAttribute('name'),
      ofType: ps.getAttribute('of-type'),
      usage: ps.getAttribute('usage'),
    })),
  }))
  const res = control.querySelector('resources')
  return {
    namespace: control.getAttribute('namespace'),
    constructor: control.getAttribute('constructor'),
    version: control.getAttribute('version'),
    displayKey: control.getAttribute('display-name-key'),
    controlType: control.getAttribute('control-type') ?? 'standard',
    properties,
    dataSets,
    css: [...(res?.querySelectorAll('css') ?? [])].map((c) => c.getAttribute('path')),
    resx: [...(res?.querySelectorAll('resx') ?? [])].map((r) => r.getAttribute('path')),
    platformLibs: [...(res?.querySelectorAll('platform-library') ?? [])].map((l) => ({
      name: l.getAttribute('name'),
      version: l.getAttribute('version'),
    })),
  }
}

async function loadStrings(manifest, lcid) {
  const pick = (code) => manifest.resx.find((p) => p.includes(`.${code}.`))
  const path = pick(lcid) ?? pick(1033) ?? manifest.resx[0]
  const strings = {}
  if (!path) return strings
  // Fallback first, then the user language on top.
  const files = [...new Set([pick(1033) ?? path, path])]
  for (const file of files) {
    const res = await fetch(`/__control/${file}`)
    if (!res.ok) continue
    const doc = new DOMParser().parseFromString(await res.text(), 'application/xml')
    for (const d of doc.querySelectorAll('data')) {
      strings[d.getAttribute('name')] = d.querySelector('value')?.textContent ?? ''
    }
  }
  return strings
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.onload = resolve
    s.onerror = () => reject(new Error(`Skript nicht ladbar: ${src}`))
    document.head.appendChild(s)
  })
}

async function loadPlatformLibs(manifest) {
  const available = S.config.platformLibs
  const need = (file) => {
    if (!available.includes(file)) throw new Error(`Plattform-Bibliothek ${file} fehlt (npm install im PCF-Projekt?)`)
    return loadScript(`/__platform/${file}`)
  }
  const react = manifest.platformLibs.find((l) => /^react$/i.test(l.name))
  const fluent = manifest.platformLibs.find((l) => /^fluent$/i.test(l.name))
  if (!react && manifest.controlType !== 'virtual') return
  const major = Number((react?.version ?? '16').split('.')[0])
  if (major >= 18) {
    await need('react_18_3_1.js')
    window.Reactv18 = window.React
    window.ReactDOMv18 = window.ReactDOM
  } else {
    await need('react_16_14_0.js')
    window.Reactv16 = window.React
    window.ReactDOMv16 = window.ReactDOM
  }
  if (fluent) {
    const [fMajor, fMinor] = fluent.version.split('.').map(Number)
    if (fMajor >= 9) await need('fluent_9_4_0.js')
    else await need(fMinor >= 121 ? 'fluent_8_121_1.js' : 'fluent_8_29_0.js')
  }
}

async function loadControl(manifest) {
  const registered = {}
  window.ComponentFramework = {
    registerControl: (name, ctor) => {
      registered[name] = ctor
    },
  }
  for (const css of manifest.css) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `/__control/${css}?t=${Date.now()}`
    document.head.appendChild(link)
  }
  // pcf-scripts always emits the code resource as bundle.js.
  await loadScript(`/__control/bundle.js?t=${Date.now()}`)
  const fullName = `${manifest.namespace}.${manifest.constructor}`
  const Ctor = registered[fullName] ?? window[manifest.namespace]?.[manifest.constructor]
  if (typeof Ctor !== 'function') throw new Error(`Control ${fullName} hat sich nicht registriert`)
  return Ctor
}

// ───────────────────────────── locale helpers ─────────────────────────────

const LOCALES = { 1031: 'de-DE', 1033: 'en-US', 1036: 'fr-FR', 1040: 'it-IT', 3082: 'es-ES', 2057: 'en-GB', 2055: 'de-CH', 3079: 'de-AT' }
const locale = () => LOCALES[S.lcid] ?? 'en-US'

function dateFormattingInfo() {
  const loc = locale()
  const names = (opt) =>
    [...Array(7)].map((_, i) => new Intl.DateTimeFormat(loc, { weekday: opt }).format(new Date(2023, 0, 1 + i)))
  const months = (opt) =>
    [...Array(12)].map((_, i) => new Intl.DateTimeFormat(loc, { month: opt }).format(new Date(2023, i, 1)))
  const sample = new Intl.DateTimeFormat(loc).formatToParts(new Date(2023, 11, 31))
  const sep = sample.find((p) => p.type === 'literal')?.value ?? '/'
  const pattern = sample.map((p) => (p.type === 'day' ? 'dd' : p.type === 'month' ? 'MM' : p.type === 'year' ? 'yyyy' : p.value)).join('')
  return {
    abbreviatedDayNames: names('short'),
    dayNames: names('long'),
    shortestDayNames: names('narrow'),
    abbreviatedMonthNames: [...months('short'), ''],
    monthNames: [...months('long'), ''],
    abbreviatedMonthGenitiveNames: [...months('short'), ''],
    monthGenitiveNames: [...months('long'), ''],
    amDesignator: loc.startsWith('en') ? 'AM' : '',
    pmDesignator: loc.startsWith('en') ? 'PM' : '',
    dateSeparator: sep,
    timeSeparator: ':',
    firstDayOfWeek: loc === 'en-US' ? 0 : 1,
    calendarWeekRule: 2,
    shortDatePattern: S.info?.dateFormat ?? pattern,
    longDatePattern: 'dddd, d. MMMM yyyy',
    shortTimePattern: S.info?.timeFormat ?? 'HH:mm',
    longTimePattern: 'HH:mm:ss',
    fullDateTimePattern: `dddd, d. MMMM yyyy HH:mm:ss`,
    monthDayPattern: 'd. MMMM',
    yearMonthPattern: 'MMMM yyyy',
    sortableDateTimePattern: "yyyy'-'MM'-'dd'T'HH':'mm':'ss",
    universalSortableDateTimePattern: "yyyy'-'MM'-'dd HH':'mm':'ss'Z'",
    rfc1123Pattern: "ddd, dd MMM yyyy HH':'mm':'ss 'GMT'",
  }
}

function numberFormattingInfo() {
  const parts = new Intl.NumberFormat(locale()).formatToParts(12345.6)
  const dec = S.info?.decimalSymbol ?? parts.find((p) => p.type === 'decimal')?.value ?? '.'
  const group = S.info?.numberSeparator ?? parts.find((p) => p.type === 'group')?.value ?? ','
  return {
    numberDecimalDigits: 2,
    numberDecimalSeparator: dec,
    numberGroupSeparator: group,
    numberGroupSizes: [3],
    numberNegativePattern: 1,
    currencyDecimalDigits: 2,
    currencyDecimalSeparator: dec,
    currencyGroupSeparator: group,
    currencyGroupSizes: [3],
    currencyNegativePattern: 8,
    currencyPositivePattern: 3,
    currencySymbol: '€',
    percentDecimalDigits: 2,
    percentDecimalSeparator: dec,
    percentGroupSeparator: group,
    percentGroupSizes: [3],
    percentNegativePattern: 0,
    percentPositivePattern: 0,
    percentSymbol: '%',
    perMilleSymbol: '‰',
    negativeSign: '-',
    positiveSign: '+',
    negativeInfinitySymbol: '-∞',
    positiveInfinitySymbol: '∞',
    nanSymbol: 'NaN',
  }
}

// ───────────────────────────── context ─────────────────────────────

function toDate(v) {
  return v instanceof Date ? v : new Date(v)
}

function errorFrom(err) {
  // Xrm.WebApi rejects with { errorCode, message, code }.
  const e = new Error(err?.message ?? String(err))
  e.errorCode = err?.errorCode
  e.code = err?.code
  e.status = err?.status
  return e
}

const webAPI = {
  async retrieveMultipleRecords(entityType, options = '', maxPageSize) {
    const meta = await entityMeta(entityType)
    let query = options ?? ''
    if (query && !query.startsWith('?')) query = `?${query}`
    try {
      const body = await dvGet(`${meta.entitySetName}${query}`, { maxPageSize })
      return {
        entities: body.value ?? [],
        nextLink: localLink(body['@odata.nextLink']),
        fetchXmlPagingCookie: body['@Microsoft.Dynamics.CRM.fetchxmlpagingcookie'],
      }
    } catch (err) {
      throw errorFrom(err)
    }
  },
  async retrieveRecord(entityType, id, options = '') {
    const meta = await entityMeta(entityType)
    let query = options ?? ''
    if (query && !query.startsWith('?')) query = `?${query}`
    try {
      return await dvGet(`${meta.entitySetName}(${String(id).replace(/[{}]/g, '')})${query}`)
    } catch (err) {
      throw errorFrom(err)
    }
  },
  async createRecord(entityType, data) {
    const meta = await entityMeta(entityType)
    try {
      const { body, headers } = await dvFetch(meta.entitySetName, { method: 'POST', body: data })
      const id = body?.[meta.primaryId] ?? /\(([0-9a-f-]{36})\)/i.exec(headers.get('odata-entityid') ?? '')?.[1]
      logEvent({ kind: 'ok', text: `webAPI.createRecord(${entityType}) → ${id}` })
      return { entityType, id }
    } catch (err) {
      throw errorFrom(err)
    }
  },
  async updateRecord(entityType, id, data) {
    const meta = await entityMeta(entityType)
    try {
      await dvFetch(`${meta.entitySetName}(${String(id).replace(/[{}]/g, '')})`, { method: 'PATCH', body: data })
      logEvent({ kind: 'ok', text: `webAPI.updateRecord(${entityType}, ${id})` })
      return { entityType, id }
    } catch (err) {
      throw errorFrom(err)
    }
  },
  async deleteRecord(entityType, id) {
    const meta = await entityMeta(entityType)
    try {
      await dvFetch(`${meta.entitySetName}(${String(id).replace(/[{}]/g, '')})`, { method: 'DELETE' })
      logEvent({ kind: 'ok', text: `webAPI.deleteRecord(${entityType}, ${id})` })
      return { entityType, id }
    } catch (err) {
      throw errorFrom(err)
    }
  },
}

async function lookupDialog(options) {
  const entity = options?.entityTypes?.[0] ?? options?.defaultEntityType
  if (!entity) return []
  const meta = await entityMeta(entity)
  const wrap = document.createElement('div')
  const input = document.createElement('input')
  input.placeholder = `${meta.displayName} suchen …`
  input.style.cssText = 'width:100%;padding:6px 8px'
  const list = document.createElement('ul')
  list.className = 'h-lookup-list'
  wrap.append(input, list)
  const picked = []
  const search = async () => {
    const term = input.value.trim().replace(/'/g, "''")
    const filter = term ? `&$filter=contains(${meta.primaryName},'${term}')` : ''
    const body = await dvGet(`${meta.entitySetName}?$select=${meta.primaryId},${meta.primaryName}&$top=25${filter}`)
    list.innerHTML = ''
    for (const row of body.value ?? []) {
      const li = document.createElement('li')
      li.textContent = row[meta.primaryName] ?? row[meta.primaryId]
      li.onclick = () => {
        picked.push({ id: row[meta.primaryId], name: row[meta.primaryName] ?? '', entityType: entity })
        modal.close(true)
      }
      list.appendChild(li)
    }
  }
  let t
  input.oninput = () => {
    clearTimeout(t)
    t = setTimeout(() => void search(), 250)
  }
  void search()
  setTimeout(() => input.focus(), 0)
  const ok = await modal({ title: `Lookup: ${meta.displayName}`, body: wrap, actions: [{ label: 'Abbrechen', value: false }] })
  return ok ? picked : []
}

async function entityMetadataForControl(entityName, attributes) {
  const meta = await entityMeta(entityName)
  const attrs = {}
  for (const name of attributes ?? []) {
    const a = meta.attributes.get(name)
    if (!a) continue
    const entry = {
      LogicalName: a.logicalName,
      DisplayName: a.displayName,
      AttributeType: a.type,
      AttributeTypeName: a.typeName,
      RequiredLevel: a.requiredLevel,
      IsSecured: a.secured,
    }
    if (['Picklist', 'State', 'Status', 'Boolean'].includes(a.type) || a.typeName === 'MultiSelectPicklistType') {
      const opts = await attributeOptions(entityName, name, a.type, a.typeName)
      entry.OptionSet = opts.map((o) => ({ value: o.Value, text: o.Label, color: o.Color, Value: o.Value, Label: o.Label }))
    }
    if (['Lookup', 'Customer', 'Owner'].includes(a.type)) entry.Targets = await lookupTargets(entityName, name)
    attrs[name] = entry
  }
  return {
    LogicalName: meta.logicalName,
    EntitySetName: meta.entitySetName,
    PrimaryIdAttribute: meta.primaryId,
    PrimaryNameAttribute: meta.primaryName,
    DisplayName: meta.displayName,
    DisplayCollectionName: meta.displayCollectionName,
    ObjectTypeCode: meta.objectTypeCode,
    IsActivity: meta.isActivity,
    Attributes: {
      get: (name) => attrs[name] ?? null,
      getAll: () => Object.values(attrs),
      getByName: (name) => attrs[name] ?? null,
      getByIndex: (i) => Object.values(attrs)[i] ?? null,
      getLength: () => Object.keys(attrs).length,
      _collection: attrs,
    },
  }
}

function popupService() {
  const popups = new Map()
  let popupsId = ''
  return {
    createPopup: (p) => {
      const el = document.createElement('div')
      el.style.cssText = 'position:fixed;inset:0;display:none;z-index:9000;background:rgba(0,0,0,.2)'
      if (p.content) el.appendChild(p.content)
      document.body.appendChild(el)
      popups.set(p.name, { el, p })
    },
    openPopup: (name) => {
      const x = popups.get(name)
      if (x) x.el.style.display = 'block'
    },
    closePopup: (name) => {
      const x = popups.get(name)
      if (x) x.el.style.display = 'none'
    },
    updatePopup: (name, p) => {
      const x = popups.get(name)
      if (x && p.content) {
        x.el.innerHTML = ''
        x.el.appendChild(p.content)
      }
    },
    deletePopup: (name) => {
      popups.get(name)?.el.remove()
      popups.delete(name)
    },
    setPopupsId: (id) => {
      popupsId = id
    },
    getPopupsId: () => popupsId,
  }
}

function buildParameters() {
  const parameters = {}
  for (const p of S.manifest.properties) {
    const state = S.props[p.name] ?? {}
    const info = S.attrInfo[p.name]
    const row = S.record.row
    let raw = null
    let formatted = ''
    let type = p.types[0] ?? 'SingleLine.Text'
    if (p.usage === 'bound' && state.column && info?.attr) {
      type = pcfType(info.attr)
      if (state.dirty) {
        raw = state.value
        formatted = raw === null || raw === undefined ? '' : String(raw)
      } else if (row) {
        raw = pcfValue(row, state.column, info.attr)
        formatted = pcfFormatted(row, state.column)
      }
      if (type === 'Lookup.Simple' && raw) raw = [{ id: raw.id.guid, name: raw.name, entityType: raw.etn }]
    } else if (state.dirty || p.usage !== 'bound') {
      raw = state.dirty ? state.value : coerceInput(p, state.value ?? p.defaultValue ?? null)
      formatted = raw === null || raw === undefined ? '' : String(raw)
    }
    const attributes = info?.attr
      ? {
          DisplayName: info.attr.displayName,
          LogicalName: info.attr.logicalName,
          RequiredLevel: { None: 0, SystemRequired: 1, ApplicationRequired: 2, Recommended: 3 }[info.attr.requiredLevel] ?? 0,
          IsSecured: info.attr.secured,
          Type: info.attr.type?.toLowerCase(),
          Options: info.options?.map((o) => ({ Value: o.Value, Label: o.Label, Color: o.Color })),
          Targets: info.targets,
          DefaultValue: info.options ? -1 : undefined,
        }
      : { DisplayName: p.name, LogicalName: p.name, RequiredLevel: 0, IsSecured: false, Type: type }
    if (info?.attr?.type === 'Boolean' && info.options) {
      attributes.Options = info.options.map((o) => ({ Value: o.Value, Label: o.Label, Color: o.Color }))
    }
    parameters[p.name] = {
      raw,
      formatted,
      type,
      attributes,
      error: false,
      errorMessage: '',
      security: { editable: !S.disabled, readable: true, secured: false },
    }
  }
  for (const d of S.manifest.dataSets) {
    const ds = S.datasets.get(d.name)
    if (ds) parameters[d.name] = ds.asParameter()
  }
  return parameters
}

function coerceInput(p, value) {
  if (value === null || value === undefined || value === '') return p.types[0] === 'TwoOptions' ? false : null
  switch (p.types[0]) {
    case 'Whole.None':
    case 'Decimal':
    case 'FP':
    case 'Currency':
      return Number(value)
    case 'TwoOptions':
      return value === true || value === 'true' || value === '1'
    default:
      return String(value)
  }
}

function createContext(updatedProperties = []) {
  const info = S.info
  const stage = $('h-stage')
  const fmtNum = (v, digits) =>
    new Intl.NumberFormat(locale(), { minimumFractionDigits: digits ?? 2, maximumFractionDigits: digits ?? 2 }).format(v)
  return {
    parameters: buildParameters(),
    updatedProperties,
    mode: {
      get allocatedHeight() {
        return S.trackResize ? stage.clientHeight : -1
      },
      get allocatedWidth() {
        return S.trackResize ? stage.clientWidth : -1
      },
      isControlDisabled: S.disabled,
      isVisible: true,
      label: S.strings[S.manifest.displayKey] ?? S.manifest.constructor,
      setControlState: (state) => {
        Object.assign(S.controlState, state)
        return true
      },
      setFullScreen: (value) => logEvent({ text: `mode.setFullScreen(${value})` }),
      trackContainerResize: (value) => {
        S.trackResize = Boolean(value)
      },
      contextInfo: {
        entityId: S.record.id || undefined,
        entityTypeName: S.record.table || undefined,
        entityRecordName: S.record.name || undefined,
      },
    },
    page: {
      entityId: S.record.id || undefined,
      entityTypeName: S.record.table || undefined,
      appId: '00000000-0000-0000-0000-000000000000',
      isPageReadOnly: S.disabled,
      getClientUrl: () => location.origin,
    },
    client: {
      disableScroll: false,
      getClient: () => 'Web',
      getFormFactor: () => S.formFactor,
      isOffline: () => false,
      isNetworkAvailable: () => true,
    },
    userSettings: {
      userId: `{${String(info.userId).toUpperCase()}}`,
      userName: info.fullName ?? '',
      languageId: S.lcid,
      isRTL: false,
      locale: locale(),
      securityRoles: [],
      dateFormattingInfo: dateFormattingInfo(),
      numberFormattingInfo: numberFormattingInfo(),
      getTimeZoneOffsetMinutes: (date) =>
        typeof info.timeZoneBias === 'number' ? -info.timeZoneBias : -(date ?? new Date()).getTimezoneOffset(),
    },
    webAPI,
    utils: {
      getEntityMetadata: (entityName, attributes) => entityMetadataForControl(entityName, attributes),
      hasEntityPrivilege: () => true,
      lookupObjects: (options) => lookupDialog(options),
    },
    navigation: {
      openAlertDialog: async (s) => {
        await modal({ title: s?.title ?? 'Hinweis', body: s?.text ?? '', actions: [{ label: s?.confirmButtonLabel ?? 'OK', value: true, primary: true }] })
      },
      openConfirmDialog: async (s) => ({
        confirmed: await modal({
          title: s?.title ?? 'Bestätigen',
          body: s?.text ?? '',
          actions: [
            { label: s?.cancelButtonLabel ?? 'Abbrechen', value: false },
            { label: s?.confirmButtonLabel ?? 'OK', value: true, primary: true },
          ],
        }),
      }),
      openErrorDialog: async (s) => {
        await modal({ title: 'Fehler', body: `${s?.message ?? ''}\n\n${s?.details ?? ''}`.trim() })
      },
      openForm: async (options) => {
        logEvent({ text: `navigation.openForm(${JSON.stringify(options)})` })
        const id = options?.entityId ? `&id=${options.entityId}` : ''
        window.open(`${info.orgUrl}/main.aspx?etn=${options?.entityName}${id}&pagetype=entityrecord`, '_blank', 'noopener')
        return { savedEntityReference: [] }
      },
      openUrl: (url) => {
        logEvent({ text: `navigation.openUrl(${url})` })
        window.open(url, '_blank', 'noopener')
      },
      openWebResource: (name) => {
        logEvent({ text: `navigation.openWebResource(${name})` })
        window.open(`${info.orgUrl}/WebResources/${name}`, '_blank', 'noopener')
      },
    },
    formatting: {
      formatCurrency: (v, precision, symbol) => `${fmtNum(v, precision)} ${symbol ?? '€'}`.trim(),
      formatDecimal: (v, precision) => fmtNum(v, precision),
      formatInteger: (v) => new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(v),
      formatLanguage: (lcid) => new Intl.DisplayNames([locale()], { type: 'language' }).of(LOCALES[lcid] ?? 'en') ?? String(lcid),
      formatDateShort: (d, includeTime) =>
        new Intl.DateTimeFormat(locale(), {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
        }).format(toDate(d)),
      formatDateLong: (d) => new Intl.DateTimeFormat(locale(), { dateStyle: 'full' }).format(toDate(d)),
      formatDateLongAbbreviated: (d) => new Intl.DateTimeFormat(locale(), { dateStyle: 'medium' }).format(toDate(d)),
      formatDateYearMonth: (d) => new Intl.DateTimeFormat(locale(), { year: 'numeric', month: 'long' }).format(toDate(d)),
      formatTime: (d) => new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(toDate(d)),
      formatUserDateTimeToUTC: (d) => toDate(d).toISOString(),
      formatUTCDateTimeToUserDate: (d) => toDate(d),
      formatDateAsFilterStringInUTC: (d) => toDate(d).toISOString(),
      parseDateFromInput: (s) => new Date(s),
      getWeekOfYear: (d) => {
        const date = toDate(d)
        const t = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
        const day = t.getUTCDay() || 7
        t.setUTCDate(t.getUTCDate() + 4 - day)
        const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
        return Math.ceil(((t - yearStart) / 86400000 + 1) / 7)
      },
    },
    resources: {
      getString: (id) => S.strings[id] ?? id,
      getResource: (id, success, failure) => {
        fetch(`/__control/${id}`)
          .then(async (r) => {
            if (!r.ok) throw new Error(`${r.status}`)
            const bytes = new Uint8Array(await r.arrayBuffer())
            let bin = ''
            for (const b of bytes) bin += String.fromCharCode(b)
            success(btoa(bin))
          })
          .catch(() => failure?.())
      },
    },
    device: {
      captureAudio: () => Promise.reject(new Error('device.captureAudio ist in der Harness nicht verfügbar')),
      captureImage: () => Promise.reject(new Error('device.captureImage ist in der Harness nicht verfügbar')),
      captureVideo: () => Promise.reject(new Error('device.captureVideo ist in der Harness nicht verfügbar')),
      getBarcodeValue: async () => (await modalPrompt('Barcode-Wert eingeben')) ?? '',
      getCurrentPosition: () =>
        new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject)),
      pickFile: (options) => pickFiles(options),
    },
    factory: {
      requestRender: () => scheduleRender(),
      getPopupService: () => popupService(),
    },
    accessibility: {
      assignId: (name) => `${name ?? 'ctl'}-${++S.idCounter}`,
      focusElementById: (id) => document.getElementById(id)?.focus(),
    },
  }
}

async function modalPrompt(title) {
  const input = document.createElement('input')
  input.style.cssText = 'width:100%;padding:6px 8px'
  const ok = await modal({ title, body: input, actions: [{ label: 'Abbrechen', value: false }, { label: 'OK', value: true, primary: true }] })
  return ok ? input.value : null
}

function pickFiles(options) {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = Boolean(options?.allowMultipleFiles)
    if (options?.accept) input.accept = options.accept
    input.onchange = async () => {
      const out = []
      for (const f of input.files ?? []) {
        const bytes = new Uint8Array(await f.arrayBuffer())
        let bin = ''
        for (const b of bytes) bin += String.fromCharCode(b)
        out.push({ fileName: f.name, fileContent: btoa(bin), fileSize: f.size, mimeType: f.type })
      }
      resolve(out)
    }
    input.click()
  })
}

// ───────────────────────────── lifecycle ─────────────────────────────

function notifyOutputChanged() {
  queueMicrotask(() => {
    if (!S.instance?.getOutputs) return
    let outputs
    try {
      outputs = S.instance.getOutputs() ?? {}
    } catch (err) {
      logEvent({ kind: 'error', text: `getOutputs() warf: ${err?.message ?? err}` })
      return
    }
    const changed = []
    for (const [name, value] of Object.entries(outputs)) {
      if (value === undefined) continue
      S.props[name] = { ...(S.props[name] ?? {}), value, dirty: true }
      changed.push(name)
    }
    logEvent({ kind: 'ok', text: `notifyOutputChanged → getOutputs() = ${JSON.stringify(outputs)}` })
    renderPropsPanel()
    if (changed.length) render(changed)
  })
}

let renderPending = false
function scheduleRender() {
  if (renderPending) return
  renderPending = true
  requestAnimationFrame(() => {
    renderPending = false
    render([])
  })
}

function renderVirtual(element) {
  const ReactDOM = window.ReactDOMv18 ?? window.ReactDOMv16
  if (!ReactDOM) throw new Error('Virtuelles Control ohne React-Plattformbibliothek')
  if (ReactDOM.createRoot) {
    S.reactRoot ??= ReactDOM.createRoot(S.container)
    S.reactRoot.render(element)
  } else {
    ReactDOM.render(element, S.container)
  }
}

function render(updated) {
  if (!S.instance) return
  try {
    const result = S.instance.updateView(createContext(updated))
    if (S.manifest.controlType === 'virtual' && result) renderVirtual(result)
    showError(null)
  } catch (err) {
    showError(`updateView() warf:\n${err?.stack ?? err}`)
  }
}

function destroy() {
  try {
    S.instance?.destroy?.()
  } catch (err) {
    logEvent({ kind: 'error', text: `destroy() warf: ${err?.message ?? err}` })
  }
  if (S.reactRoot) {
    S.reactRoot.unmount()
    S.reactRoot = null
  } else if (S.container && (window.ReactDOMv16 ?? window.ReactDOMv18)?.unmountComponentAtNode) {
    ;(window.ReactDOMv16 ?? window.ReactDOMv18).unmountComponentAtNode(S.container)
  }
  S.instance = null
}

function mount() {
  destroy()
  const stage = $('h-stage')
  stage.innerHTML = ''
  S.container = document.createElement('div')
  stage.appendChild(S.container)
  S.trackResize = false
  try {
    S.instance = new S.Ctor()
    const ctx = createContext([])
    if (S.manifest.controlType === 'virtual') {
      S.instance.init(ctx, notifyOutputChanged, S.controlState)
    } else {
      S.instance.init(ctx, notifyOutputChanged, S.controlState, S.container)
    }
    logEvent({ kind: 'ok', text: `init() — ${S.manifest.namespace}.${S.manifest.constructor} ${S.manifest.version}` })
    render([])
  } catch (err) {
    showError(`init() warf:\n${err?.stack ?? err}`)
  }
}

// ───────────────────────────── record & panels ─────────────────────────────

async function loadRecord() {
  const table = $('h-table').value.trim().toLowerCase()
  const id = $('h-id').value.trim().replace(/[{}]/g, '').toLowerCase()
  S.record = { table, id, name: '', row: null, meta: null }
  $('h-record').textContent = ''
  $('h-open').hidden = true
  storage.set(`${storeKey}:record`, { table, id })
  const url = new URL(location.href)
  url.searchParams.set('table', table)
  if (id) url.searchParams.set('id', id)
  else url.searchParams.delete('id')
  history.replaceState(null, '', url)
  if (!table) return
  try {
    const meta = await entityMeta(table)
    S.record.meta = meta
    if (id) {
      const row = await dvGet(`${meta.entitySetName}(${id})`)
      S.record.row = row
      S.record.name = row[meta.primaryName] ?? ''
      $('h-record').textContent = `${meta.displayName}: ${S.record.name || '(ohne Namen)'}`
      const open = $('h-open')
      open.href = `${S.info.orgUrl}/main.aspx?etn=${table}&id=${id}&pagetype=entityrecord`
      open.hidden = false
    } else {
      $('h-record').textContent = `${meta.displayName}: neuer Datensatz (keine ID)`
    }
    fillColumnList(meta)
    // Re-resolve bound properties against the new table.
    for (const p of S.manifest.properties) {
      if (p.usage === 'bound' && S.props[p.name]?.column) await bindColumn(p, S.props[p.name].column, false)
    }
  } catch (err) {
    $('h-record').textContent = `Fehler: ${err?.message ?? err}`
  }
}

function fillColumnList(meta) {
  let list = $('h-columns')
  if (!list) {
    list = document.createElement('datalist')
    list.id = 'h-columns'
    document.body.appendChild(list)
  }
  list.innerHTML = ''
  for (const a of [...meta.attributes.values()].filter((x) => !x.attributeOf).sort((x, y) => x.logicalName.localeCompare(y.logicalName))) {
    const o = document.createElement('option')
    o.value = a.logicalName
    o.label = `${a.displayName} (${a.type})`
    list.appendChild(o)
  }
}

async function bindColumn(p, column, rerender = true) {
  S.props[p.name] = { ...(S.props[p.name] ?? {}), column, dirty: false, value: undefined }
  delete S.attrInfo[p.name]
  if (column && S.record.meta) {
    const attr = S.record.meta.attributes.get(column)
    if (attr) {
      const info = { attr }
      if (['Picklist', 'State', 'Status', 'Boolean'].includes(attr.type) || attr.typeName === 'MultiSelectPicklistType') {
        info.options = await attributeOptions(S.record.table, column, attr.type, attr.typeName)
      }
      if (['Lookup', 'Customer', 'Owner'].includes(attr.type)) info.targets = await lookupTargets(S.record.table, column)
      S.attrInfo[p.name] = info
    }
  }
  saveProps()
  renderPropsPanel()
  if (rerender) render([p.name])
}

function saveProps() {
  const out = {}
  for (const [k, v] of Object.entries(S.props)) out[k] = { column: v.column, value: v.dirty ? undefined : v.value }
  storage.set(`${storeKey}:props`, out)
}

function renderPropsPanel() {
  const host = $('h-props')
  host.innerHTML = ''
  for (const p of S.manifest.properties) {
    const state = S.props[p.name] ?? {}
    const div = document.createElement('div')
    div.className = 'h-prop'
    const title = S.strings[p.displayKey] ?? p.name
    div.innerHTML = `<div><span class="h-prop-name">${esc(p.name)}</span> <span class="h-prop-type">${esc(p.usage)} · ${esc(p.group ? `${p.group}` : p.ofType)}${p.required ? ' · required' : ''}</span></div><div class="h-muted">${esc(title)}</div>`
    if (p.usage === 'bound') {
      const input = document.createElement('input')
      input.placeholder = 'Spalte (logischer Name)'
      input.setAttribute('list', 'h-columns')
      input.value = state.column ?? ''
      input.onchange = () => void bindColumn(p, input.value.trim().toLowerCase())
      div.appendChild(input)
    } else if (p.enumValues.length) {
      const select = document.createElement('select')
      for (const v of p.enumValues) {
        const o = document.createElement('option')
        o.value = v.value
        o.textContent = `${S.strings[v.displayKey] ?? v.name} (${v.value})`
        select.appendChild(o)
      }
      select.value = state.value ?? p.defaultValue ?? p.enumValues[0]?.value ?? ''
      select.onchange = () => setInput(p, select.value)
      div.appendChild(select)
    } else if (p.types[0] === 'TwoOptions') {
      const label = document.createElement('label')
      label.className = 'h-check'
      const cb = document.createElement('input')
      cb.type = 'checkbox'
      cb.checked = coerceInput(p, state.value ?? p.defaultValue) === true
      cb.onchange = () => setInput(p, cb.checked)
      label.append(cb, document.createTextNode(' an'))
      div.appendChild(label)
    } else {
      const input = document.createElement('input')
      input.value = state.value ?? p.defaultValue ?? ''
      input.placeholder = p.defaultValue ? `Standard: ${p.defaultValue}` : ''
      input.onchange = () => setInput(p, input.value)
      div.appendChild(input)
    }
    if (state.dirty) {
      const v = document.createElement('div')
      v.className = 'h-prop-value'
      v.textContent = `Ausgabe des Controls: ${JSON.stringify(state.value)}`
      div.appendChild(v)
      if (p.usage === 'bound' && state.column && S.config.allowWrites && S.record.id) {
        const save = document.createElement('button')
        save.type = 'button'
        save.textContent = 'In Datensatz speichern'
        save.onclick = () => void saveBound(p)
        div.appendChild(save)
      }
    }
    host.appendChild(div)
  }
}

async function saveBound(p) {
  const state = S.props[p.name]
  const attr = S.attrInfo[p.name]?.attr
  if (!attr || ['Lookup', 'Customer', 'Owner'].includes(attr.type)) {
    logEvent({ kind: 'warn', text: 'Lookup-Spalten speichert die Harness nicht' })
    return
  }
  let value = state.value
  if (value instanceof Date) value = value.toISOString()
  if (Array.isArray(value)) value = value.join(',')
  await webAPI.updateRecord(S.record.table, S.record.id, { [state.column]: value })
  await loadRecord()
  S.props[p.name].dirty = false
  renderPropsPanel()
  render([p.name])
}

function setInput(p, value) {
  S.props[p.name] = { ...(S.props[p.name] ?? {}), value, dirty: false }
  saveProps()
  render([p.name])
}

function renderDatasetsPanel() {
  if (!S.manifest.dataSets.length) return
  $('h-datasets-section').hidden = false
  const host = $('h-datasets')
  host.innerHTML = ''
  for (const d of S.manifest.dataSets) {
    const ds = S.datasets.get(d.name)
    const saved = storage.get(`${storeKey}:ds:${d.name}`, {})
    const div = document.createElement('div')
    div.className = 'h-prop'
    div.innerHTML = `<div><span class="h-prop-name">${esc(d.name)}</span> <span class="h-prop-type">data-set</span></div>`
    const entity = document.createElement('input')
    entity.placeholder = 'Tabelle (logischer Name)'
    entity.setAttribute('list', 'h-tables')
    entity.value = saved.entity ?? S.record.table ?? ''
    const view = document.createElement('select')
    const fetchXml = document.createElement('textarea')
    fetchXml.value = saved.fetchXml ?? ''
    fetchXml.placeholder = '<fetch>…</fetch> — wird aus der Ansicht übernommen, darf angepasst werden (z. B. Filter auf den Formular-Datensatz)'
    const pageSize = document.createElement('input')
    pageSize.type = 'number'
    pageSize.min = '1'
    pageSize.value = String(saved.pageSize ?? 25)
    const apply = document.createElement('button')
    apply.type = 'button'
    apply.className = 'h-primary'
    apply.textContent = 'Laden'
    const views = new Map()

    const loadViews = async () => {
      view.innerHTML = '<option value="">— Ansicht wählen —</option>'
      views.clear()
      const e = entity.value.trim().toLowerCase()
      if (!e) return
      try {
        const body = await dvGet(
          `savedqueries?$select=name,savedqueryid,fetchxml,layoutxml,isdefault&$filter=returnedtypecode eq '${e}' and querytype eq 0 and statecode eq 0&$orderby=name`,
          { annotations: false },
        )
        for (const v of body.value ?? []) {
          views.set(v.savedqueryid, v)
          const o = document.createElement('option')
          o.value = v.savedqueryid
          o.textContent = `${v.name}${v.isdefault ? ' (Standard)' : ''}`
          view.appendChild(o)
        }
        if (saved.viewId && views.has(saved.viewId)) view.value = saved.viewId
      } catch (err) {
        logEvent({ kind: 'error', text: `Ansichten für ${e}: ${err?.message ?? err}` })
      }
    }
    entity.onchange = () => void loadViews()
    view.onchange = () => {
      const v = views.get(view.value)
      if (v) fetchXml.value = v.fetchxml
    }
    apply.onclick = async () => {
      const v = views.get(view.value)
      const cfg = {
        entity: entity.value.trim().toLowerCase(),
        fetchXml: fetchXml.value.trim(),
        viewId: view.value || undefined,
        pageSize: Number(pageSize.value) || 25,
      }
      storage.set(`${storeKey}:ds:${d.name}`, cfg)
      ds.pageSize = cfg.pageSize
      try {
        await ds.configure({
          entity: cfg.entity,
          fetchXml: cfg.fetchXml,
          layoutXml: v && v.fetchxml === cfg.fetchXml ? v.layoutxml : undefined,
          viewId: cfg.viewId,
          title: v?.name,
        })
      } catch (err) {
        logEvent({ kind: 'error', text: String(err?.message ?? err) })
      }
    }
    const l1 = document.createElement('label')
    l1.textContent = 'Tabelle'
    l1.appendChild(entity)
    const l2 = document.createElement('label')
    l2.textContent = 'Ansicht'
    l2.appendChild(view)
    const l3 = document.createElement('label')
    l3.textContent = 'FetchXML'
    l3.appendChild(fetchXml)
    const l4 = document.createElement('label')
    l4.textContent = 'Seitengröße'
    l4.appendChild(pageSize)
    const row = document.createElement('div')
    row.className = 'h-row'
    row.appendChild(apply)
    div.append(l1, l2, l3, l4, row)
    host.appendChild(div)
    void loadViews().then(() => {
      if (saved.fetchXml && saved.entity) apply.click()
    })
  }
}

async function loadTableList() {
  try {
    const body = await dvGet('EntityDefinitions?$select=LogicalName', { annotations: false })
    const list = $('h-tables')
    for (const e of (body.value ?? []).map((x) => x.LogicalName).sort()) {
      const o = document.createElement('option')
      o.value = e
      list.appendChild(o)
    }
  } catch {
    // datalist is a convenience
  }
}

// ───────────────────────────── boot ─────────────────────────────

function connectEvents() {
  const source = new EventSource('/__dvproxy/events')
  source.onmessage = (msg) => {
    let e
    try {
      e = JSON.parse(msg.data)
    } catch {
      return
    }
    if (e.type === 'reload') {
      location.reload()
      return
    }
    if (e.type === 'build') {
      const pill = $('h-build')
      pill.hidden = false
      if (e.state === 'start') {
        pill.className = 'h-pill'
        pill.textContent = 'Build läuft …'
      } else if (e.state === 'error') {
        pill.className = 'h-pill h-pill--err'
        pill.textContent = 'Build fehlgeschlagen'
        showError(`Build fehlgeschlagen:\n${e.output}`)
      }
      return
    }
    if (e.method) logCall(e)
  }
}

function wireUi() {
  for (const tab of document.querySelectorAll('[data-tab]')) {
    tab.onclick = () => {
      for (const t of document.querySelectorAll('[data-tab]')) t.classList.toggle('h-tab--active', t === tab)
      $('h-log-calls').hidden = tab.dataset.tab !== 'calls'
      $('h-log-events').hidden = tab.dataset.tab !== 'events'
    }
  }
  $('h-clear').onclick = () => {
    $('h-log-calls').innerHTML = ''
    $('h-log-events').innerHTML = ''
    counts.calls = counts.events = 0
    $('h-calls-count').textContent = ''
    $('h-events-count').textContent = ''
  }
  $('h-load').onclick = async () => {
    await loadRecord()
    mount()
  }
  $('h-render').onclick = () => render([])
  $('h-reinit').onclick = () => mount()

  const lang = $('h-lang')
  if (![...lang.options].some((o) => Number(o.value) === S.lcid)) {
    const o = document.createElement('option')
    o.value = String(S.lcid)
    o.textContent = `LCID ${S.lcid}`
    lang.appendChild(o)
  }
  lang.value = String(S.lcid)
  lang.onchange = async () => {
    S.lcid = Number(lang.value)
    storage.set(`${storeKey}:lcid`, S.lcid)
    S.strings = await loadStrings(S.manifest, S.lcid)
    renderPropsPanel()
    mount()
  }
  const ff = $('h-formfactor')
  ff.value = String(S.formFactor)
  ff.onchange = () => {
    S.formFactor = Number(ff.value)
    storage.set(`${storeKey}:ff`, S.formFactor)
    mount()
  }
  const dis = $('h-disabled')
  dis.checked = S.disabled
  dis.onchange = () => {
    S.disabled = dis.checked
    render([])
  }
  const width = $('h-width')
  const stage = $('h-stage')
  const applyWidth = (w) => {
    stage.style.width = `${w}px`
    $('h-width-val').textContent = `${w}px`
  }
  const initialWidth = storage.get(`${storeKey}:width`, Math.min(1100, $('h-stage').parentElement.clientWidth - 32))
  width.value = String(initialWidth)
  applyWidth(initialWidth)
  width.oninput = () => {
    applyWidth(Number(width.value))
    storage.set(`${storeKey}:width`, Number(width.value))
  }
  let resizeTimer
  new ResizeObserver(() => {
    if (!S.trackResize) return
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => render([]), 100)
  }).observe(stage)

  window.addEventListener('error', (e) => logEvent({ kind: 'error', text: `Fehler: ${e.message}` }))
  window.addEventListener('unhandledrejection', (e) =>
    logEvent({ kind: 'error', text: `Unbehandelte Promise-Ablehnung: ${e.reason?.message ?? e.reason}` }),
  )
}

async function boot() {
  S.config = await (await fetch('/__harness/config.json')).json()
  S.info = await (await fetch('/__dvproxy/info')).json()
  if (S.info?.error) throw new Error(S.info.error.message)

  const env = $('h-env')
  env.textContent = `${S.info.organizationName ?? S.config.envName} · ${S.info.fullName ?? S.info.userName ?? ''}`
  env.title = S.info.orgUrl
  const writes = $('h-writes')
  writes.textContent = S.config.allowWrites ? 'Schreiben erlaubt' : 'nur lesen'
  writes.className = `h-pill ${S.config.allowWrites ? 'h-pill--warn' : 'h-pill--ok'}`
  if (S.config.buildError) showError(`Letzter Build fehlgeschlagen:\n${S.config.buildError}`)

  const manifestRes = await fetch('/__control/ControlManifest.xml')
  if (!manifestRes.ok) throw new Error('ControlManifest.xml nicht gefunden — ist das Control gebaut?')
  S.manifest = parseManifest(await manifestRes.text())
  storeKey = `dv-proxy:pcf:${S.manifest.namespace}.${S.manifest.constructor}`
  $('h-control').textContent = `${S.manifest.namespace}.${S.manifest.constructor} ${S.manifest.version} · ${S.manifest.controlType}`
  document.title = `${S.manifest.constructor} · dv-proxy`

  S.lcid = Number(params.get('lcid')) || storage.get(`${storeKey}:lcid`, S.info.languageId ?? 1033)
  S.formFactor = storage.get(`${storeKey}:ff`, 1)
  S.props = storage.get(`${storeKey}:props`, {})
  for (const v of Object.values(S.props)) v.dirty = false

  wireUi()
  connectEvents()
  void loadTableList()

  const savedRecord = storage.get(`${storeKey}:record`, {})
  $('h-table').value = params.get('table') ?? S.config.record?.table ?? savedRecord.table ?? ''
  $('h-id').value = params.get('id') ?? S.config.record?.id ?? savedRecord.id ?? ''

  await loadPlatformLibs(S.manifest)
  S.strings = await loadStrings(S.manifest, S.lcid)
  S.Ctor = await loadControl(S.manifest)

  for (const d of S.manifest.dataSets) {
    S.datasets.set(
      d.name,
      new HarnessDataset({
        name: d.name,
        orgUrl: S.info.orgUrl,
        log: logEvent,
        onChange: () => render([d.name, 'dataset']),
      }),
    )
  }

  await loadRecord()
  renderPropsPanel()
  renderDatasetsPanel()
  mount()
}

boot().catch((err) => showError(`Harness konnte nicht starten:\n${err?.stack ?? err}`))

// Expose for console debugging.
window.__harness = S
