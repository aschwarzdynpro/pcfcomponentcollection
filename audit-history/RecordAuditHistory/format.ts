import type { AttributeChange, ColumnMeta, TableMeta } from './model'
import type { Strings } from './i18n'

/*
 * Parsing and display formatting. The parsing half is a port of
 * `apps/audit-explorer/src/services/dataverseAuditService.ts`; the formatting
 * half is new — the code app has no option-set metadata, the PCF does.
 */

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ENTITY_REF_RE =
  /^([a-z_][a-z_0-9]*),([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
const MIDNIGHT_RE = /T00:00:00(\.0+)?Z?$/

export function shortGuid(guid: string): string {
  return `${guid.slice(0, 8)}…${guid.slice(-4)}`
}

/** `_bookingstatus_value` becomes `bookingstatus`; other keys pass through. */
export function attributeKey(key: string): string {
  const lookup = /^_(.+)_value$/.exec(key)
  return lookup ? lookup[1] : key
}

function rawString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** One entry of the `changedata` JSON payload. */
interface ChangedAttribute {
  logicalName?: string
  oldValue?: unknown
  newValue?: unknown
  oldName?: string | null
  newName?: string | null
}

/**
 * Parse the inline `changedata` payload. `oldName`/`newName` carry resolved
 * labels for lookups where the platform had them.
 */
export function parseChangeData(raw: unknown): AttributeChange[] {
  if (typeof raw !== 'string' || raw === '') return []
  try {
    const parsed = JSON.parse(raw) as { changedAttributes?: ChangedAttribute[] }
    if (!Array.isArray(parsed.changedAttributes)) return []
    return parsed.changedAttributes
      .filter(
        (a): a is ChangedAttribute & { logicalName: string } =>
          typeof a.logicalName === 'string' && a.logicalName !== '',
      )
      .map((a) => ({
        attribute: attributeKey(a.logicalName),
        oldRaw: rawString(a.oldValue),
        newRaw: rawString(a.newValue),
        oldLabel: nonEmpty(a.oldName),
        newLabel: nonEmpty(a.newName),
      }))
  } catch (err) {
    console.warn('[RecordAuditHistory] could not parse changedata:', err)
    return []
  }
}

/**
 * Columns Dataverse rewrites on virtually every update. Deliberately narrow:
 * `statecode`, `statuscode` and `ownerid` are business events and stay visible.
 */
const TECHNICAL_FIELDS = new Set([
  'createdby',
  'createdon',
  'createdonbehalfby',
  'importsequencenumber',
  'modifiedby',
  'modifiedon',
  'modifiedonbehalfby',
  'overriddencreatedon',
  'owningbusinessunit',
  'owningteam',
  'owninguser',
  'timezoneruleversionnumber',
  'utcconversiontimezonecode',
  'versionnumber',
])

export function isTechnicalField(attribute: string): boolean {
  return TECHNICAL_FIELDS.has(attribute.toLowerCase())
}

export function partitionChanges(changes: AttributeChange[]): {
  business: AttributeChange[]
  technical: AttributeChange[]
} {
  const business: AttributeChange[] = []
  const technical: AttributeChange[] = []
  for (const change of changes) {
    ;(isTechnicalField(change.attribute) ? technical : business).push(change)
  }
  return { business, technical }
}

/** Key for a resolved lookup name: `entity,guid` in lower case. */
export function lookupKey(entity: string, id: string): string {
  return `${entity.toLowerCase()},${id.toLowerCase()}`
}

/**
 * The lookup a raw value points to, or null. Bare GUIDs are attributed to the
 * column's lookup target when it has exactly one.
 */
export function lookupRef(
  raw: string | undefined,
  column: ColumnMeta | undefined,
): { entity: string; id: string } | null {
  if (!raw) return null
  const value = raw.trim()
  const ref = ENTITY_REF_RE.exec(value)
  if (ref) return { entity: ref[1].toLowerCase(), id: ref[2].toLowerCase() }
  if (GUID_RE.test(value) && column?.targets?.length === 1) {
    return { entity: column.targets[0], id: value.toLowerCase() }
  }
  return null
}

export interface Formatter {
  dateTime(iso: string): string
  date(iso: string): string
  time(iso: string): string
  /** Display text of one side of a change. Empty string = no value. */
  value(change: AttributeChange, side: 'old' | 'new'): string
  columnName(attribute: string): string
}

export function createFormatter(
  locale: string,
  t: Strings,
  meta: TableMeta | null,
  names: Record<string, string>,
): Formatter {
  const dateTimeFmt = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' })
  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  // Date-only values are stored as midnight; render them without a clock and
  // without shifting them into the browser's time zone.
  const dateOnlyFmt = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const moneyFmt = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const numberFmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 4 })

  const dateTime = (iso: string) => {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? iso : dateTimeFmt.format(d)
  }
  const date = (iso: string) => {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d)
  }

  const formatRaw = (raw: string, column: ColumnMeta | undefined): string => {
    const type = column?.type
    if (column?.options) {
      if (type === 'Boolean') {
        const key = /^(true|1)$/i.test(raw) ? '1' : /^(false|0)$/i.test(raw) ? '0' : raw
        if (column.options[key]) return column.options[key]
      }
      if (type === 'Virtual' || raw.includes(',')) {
        // Multi-select choices arrive as "1,2,3".
        const parts = raw.split(',').map((p) => p.trim())
        if (parts.every((p) => column.options?.[p])) {
          return parts.map((p) => column.options?.[p]).join(', ')
        }
      }
      if (column.options[raw]) return column.options[raw]
    }
    if (type === 'Boolean' || /^(true|false)$/i.test(raw)) {
      if (/^(true|1)$/i.test(raw)) return t.yes
      if (/^(false|0)$/i.test(raw)) return t.no
    }
    const ref = lookupRef(raw, column)
    if (ref) {
      const name = names[lookupKey(ref.entity, ref.id)]
      if (name) return name
      return ENTITY_REF_RE.test(raw) ? `${ref.entity} ${shortGuid(ref.id)}` : shortGuid(ref.id)
    }
    if (GUID_RE.test(raw)) return shortGuid(raw)
    if (ISO_DATETIME_RE.test(raw)) {
      const d = new Date(raw)
      if (!Number.isNaN(d.getTime())) {
        return MIDNIGHT_RE.test(raw) ? dateOnlyFmt.format(d) : dateTimeFmt.format(d)
      }
    }
    if ((type === 'Money' || type === 'Decimal' || type === 'Double' || type === 'Integer' || type === 'BigInt') && raw.trim() !== '') {
      const n = Number(raw)
      if (Number.isFinite(n)) return (type === 'Money' ? moneyFmt : numberFmt).format(n)
    }
    return raw
  }

  return {
    dateTime,
    date,
    time: (iso) => {
      const d = new Date(iso)
      return Number.isNaN(d.getTime()) ? iso : timeFmt.format(d)
    },
    columnName: (attribute) => meta?.columns[attribute]?.displayName ?? attribute,
    value: (change, side) => {
      const label = side === 'old' ? change.oldLabel : change.newLabel
      const raw = side === 'old' ? change.oldRaw : change.newRaw
      const column = meta?.columns[change.attribute]
      // The payload's own label wins; metadata and resolved names fill the gaps.
      if (label) return label
      if (raw === undefined || raw === '') return ''
      return formatRaw(raw, column)
    },
  }
}

/** Initials for the avatar bubble. */
export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/)
  const letters = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')
  return letters.toUpperCase() || '??'
}

/** ISO date (yyyy-mm-dd) in local time, for day grouping. */
export function dayKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
