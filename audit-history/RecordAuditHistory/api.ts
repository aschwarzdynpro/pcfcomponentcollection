import type {
  AttributeChange,
  AuditEvent,
  AuditSettings,
  ColumnMeta,
  OperationCode,
  RecordAuditResult,
  TableMeta,
} from './model'
import { attributeKey, lookupKey, parseChangeData } from './format'

/**
 * Dataverse access for the control.
 *
 * Rows go through `context.webAPI` (it returns formatted-value annotations
 * out of the box). Metadata and the `RetrieveAuditDetails` function have no
 * `webAPI` equivalent, so those are plain same-origin `fetch` calls against
 * the Web API — the control runs inside the model-driven app, so the
 * session cookie authenticates them.
 */

const FV = '@OData.Community.Display.V1.FormattedValue'
const API = '/api/data/v9.2'

/** Rows per page, and the overall cap for one record. */
const PAGE_SIZE = 500
const ROW_CAP = 5000

/** References per lookup-name request; the filter is an `or` chain. */
const LOOKUP_BATCH = 40

const BASE_SELECT = [
  'auditid',
  'createdon',
  'operation',
  'action',
  '_userid_value',
]

type Entity = Record<string, unknown>

function formatted(row: Entity, column: string): string | undefined {
  const value = row[`${column}${FV}`]
  return typeof value === 'string' && value !== '' ? value : undefined
}

function label(value: unknown, fallback: string): string {
  const local = (value as { UserLocalizedLabel?: { Label?: unknown } } | null)
    ?.UserLocalizedLabel
  return typeof local?.Label === 'string' && local.Label !== '' ? local.Label : fallback
}

function managedBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (value && typeof value === 'object' && 'Value' in value) {
    return Boolean((value as { Value?: unknown }).Value)
  }
  return false
}

interface OptionMeta {
  Value: number
  Label?: unknown
}

interface AttrRow {
  LogicalName: string
  DisplayName?: unknown
  IsAuditEnabled?: unknown
  AttributeType?: string
  AttributeOf?: string | null
  IsValidForUpdate?: boolean
}

interface OptionRow {
  LogicalName: string
  OptionSet?: { Options?: OptionMeta[]; TrueOption?: OptionMeta; FalseOption?: OptionMeta }
}

interface LookupRow {
  LogicalName: string
  Targets?: string[]
}

/** Error carrying the Dataverse error code, so the UI can name the cause. */
export class DataverseError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message)
  }
}

/** Audit read privileges missing (prvReadAuditSummary / prvReadRecordAuditHistory). */
export function isPrivilegeError(err: unknown): boolean {
  const e = err as { code?: unknown; errorCode?: unknown; message?: unknown }
  const code = String(e?.code ?? e?.errorCode ?? '')
  const message = String(e?.message ?? '')
  return (
    code === '-2147220960' ||
    code === '2147746336' ||
    /0x80040220/i.test(code) ||
    /prvReadAudit|prvReadRecordAuditHistory|privilege/i.test(message)
  )
}

export class AuditApi {
  private readonly metaCache = new Map<string, Promise<TableMeta | null>>()
  private readonly primaryCache = new Map<
    string,
    Promise<{ id: string; name: string } | null>
  >()
  private readonly nameCache = new Map<string, string>()
  private changeDataUsable: boolean | null = null

  constructor(
    private readonly webAPI: ComponentFramework.WebApi,
    private readonly baseUrl: string,
  ) {}

  private async get<T>(path: string, annotations = false): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
    }
    if (annotations) headers.Prefer = 'odata.include-annotations="*"'
    const response = await fetch(`${this.baseUrl}${API}${path}`, {
      headers,
      credentials: 'same-origin',
    })
    if (!response.ok) {
      let message = `${response.status} ${response.statusText}`
      let code: string | undefined
      try {
        const body = (await response.json()) as {
          error?: { message?: string; code?: string }
        }
        message = body.error?.message ?? message
        code = body.error?.code
      } catch {
        // body was not JSON — keep the status line
      }
      throw new DataverseError(message, code)
    }
    return (await response.json()) as T
  }

  /** All audit rows of one record, newest first. */
  async loadRecordAudit(recordId: string): Promise<RecordAuditResult> {
    const id = recordId.replace(/[{}]/g, '').toLowerCase()
    const events: AuditEvent[] = []
    let withChangeData = this.changeDataUsable !== false
    let options: string | undefined
    let truncated = false

    for (;;) {
      const select = withChangeData ? [...BASE_SELECT, 'changedata'] : BASE_SELECT
      const query =
        options ??
        `?$select=${select.join(',')}&$filter=_objectid_value eq ${id}&$orderby=createdon desc`
      let page: ComponentFramework.WebApi.RetrieveMultipleResponse
      try {
        page = await this.webAPI.retrieveMultipleRecords('audit', query, PAGE_SIZE)
      } catch (err) {
        // First page with changedata unproven: it is the likeliest culprit.
        if (events.length === 0 && withChangeData && this.changeDataUsable === null && !isPrivilegeError(err)) {
          console.warn('[RecordAuditHistory] changedata refused — retrying without it', err)
          this.changeDataUsable = false
          withChangeData = false
          options = undefined
          continue
        }
        throw err
      }
      if (withChangeData) this.changeDataUsable = true
      for (const row of page.entities) events.push(this.toEvent(row, withChangeData))

      if (!page.nextLink) break
      if (events.length >= ROW_CAP) {
        truncated = true
        break
      }
      const q = page.nextLink.indexOf('?')
      options = q >= 0 ? page.nextLink.slice(q) : undefined
      if (!options) break
    }
    return { events, truncated }
  }

  private toEvent(row: Entity, inline: boolean): AuditEvent {
    const op = Number(row.operation)
    const operation = (op >= 1 && op <= 4 ? op : 2) as OperationCode
    const action = typeof row.action === 'number' ? row.action : undefined
    return {
      id: String(row.auditid),
      createdOn: String(row.createdon),
      operation,
      operationLabel: formatted(row, 'operation') ?? String(op),
      action,
      actionLabel: formatted(row, 'action'),
      userId: typeof row._userid_value === 'string' ? row._userid_value : undefined,
      userName: formatted(row, '_userid_value') ?? '',
      changes: inline ? parseChangeData(row.changedata) : [],
      inline,
    }
  }

  /**
   * Column diff via `RetrieveAuditDetails`, for rows whose inline payload was
   * empty or unavailable.
   */
  async getAuditDetails(auditId: string): Promise<AttributeChange[]> {
    const response = await this.get<{
      AuditDetail?: { OldValue?: Entity; NewValue?: Entity }
    }>(`/audits(${auditId})/Microsoft.Dynamics.CRM.RetrieveAuditDetails()`, true)
    const detail = response.AuditDetail
    if (!detail) return []
    const split = (entity: Entity | undefined) => {
      const values: Record<string, unknown> = {}
      const labels: Record<string, string> = {}
      for (const [key, val] of Object.entries(entity ?? {})) {
        if (key.endsWith(FV)) labels[key.slice(0, -FV.length)] = String(val ?? '')
        else if (!key.includes('@')) values[key] = val
      }
      return { values, labels }
    }
    const oldSide = split(detail.OldValue)
    const newSide = split(detail.NewValue)
    const keys = new Set([...Object.keys(oldSide.values), ...Object.keys(newSide.values)])
    const str = (v: unknown) =>
      v === null || v === undefined ? undefined : typeof v === 'object' ? JSON.stringify(v) : String(v)
    return [...keys].map((key) => ({
      attribute: attributeKey(key),
      oldRaw: str(oldSide.values[key]),
      newRaw: str(newSide.values[key]),
      oldLabel: oldSide.labels[key] || undefined,
      newLabel: newSide.labels[key] || undefined,
    }))
  }

  async getAuditSettings(): Promise<AuditSettings> {
    try {
      const result = await this.webAPI.retrieveMultipleRecords(
        'organization',
        '?$select=isauditenabled,auditretentionperiodv2',
      )
      const org = result.entities[0]
      if (!org) return { orgAuditEnabled: true, retentionDays: null }
      const retention = org.auditretentionperiodv2
      return {
        orgAuditEnabled: org.isauditenabled !== false,
        retentionDays: typeof retention === 'number' ? retention : null,
      }
    } catch (err) {
      // Unknown settings must not produce false reassurance either way.
      console.warn('[RecordAuditHistory] audit settings unavailable', err)
      return { orgAuditEnabled: true, retentionDays: null }
    }
  }

  /** `createdon` of the record itself, to judge it against retention. */
  async getRecordCreatedOn(table: string, recordId: string): Promise<string | null> {
    try {
      const row = await this.webAPI.retrieveRecord(table, recordId, '?$select=createdon')
      return typeof row.createdon === 'string' ? row.createdon : null
    } catch {
      return null
    }
  }

  /** Table and column metadata incl. audit flags and option labels. Cached. */
  getTableMeta(table: string): Promise<TableMeta | null> {
    let cached = this.metaCache.get(table)
    if (!cached) {
      cached = this.loadTableMeta(table).catch((err) => {
        console.warn('[RecordAuditHistory] metadata unavailable for', table, err)
        return null
      })
      this.metaCache.set(table, cached)
    }
    return cached
  }

  private async loadTableMeta(table: string): Promise<TableMeta> {
    const base = `/EntityDefinitions(LogicalName='${table}')`
    const optionQuery = (cast: string) =>
      this.get<{ value: OptionRow[] }>(
        `${base}/Attributes/Microsoft.Dynamics.CRM.${cast}?$select=LogicalName&$expand=OptionSet`,
      ).catch(() => ({ value: [] as OptionRow[] }))

    const [entity, picklists, states, statuses, booleans, multis, lookups] = await Promise.all([
      this.get<{
        LogicalName: string
        DisplayName?: unknown
        IsAuditEnabled?: unknown
        PrimaryIdAttribute?: string
        Attributes?: AttrRow[]
      }>(
        `${base}?$select=LogicalName,DisplayName,IsAuditEnabled,PrimaryIdAttribute` +
          `&$expand=Attributes($select=LogicalName,DisplayName,IsAuditEnabled,AttributeType,AttributeOf,IsValidForUpdate)`,
      ),
      optionQuery('PicklistAttributeMetadata'),
      optionQuery('StateAttributeMetadata'),
      optionQuery('StatusAttributeMetadata'),
      optionQuery('BooleanAttributeMetadata'),
      optionQuery('MultiSelectPicklistAttributeMetadata'),
      this.get<{ value: LookupRow[] }>(
        `${base}/Attributes/Microsoft.Dynamics.CRM.LookupAttributeMetadata?$select=LogicalName,Targets`,
      ).catch(() => ({ value: [] as LookupRow[] })),
    ])

    const columns: Record<string, ColumnMeta> = {}
    for (const attr of entity.Attributes ?? []) {
      columns[attr.LogicalName] = {
        logicalName: attr.LogicalName,
        displayName: label(attr.DisplayName, attr.LogicalName),
        auditEnabled: managedBool(attr.IsAuditEnabled),
        type: attr.AttributeType ?? '',
        attributeOf: attr.AttributeOf ?? undefined,
        updatable: attr.IsValidForUpdate !== false,
      }
    }
    for (const row of [...picklists.value, ...states.value, ...statuses.value, ...multis.value]) {
      const column = columns[row.LogicalName]
      if (!column) continue
      const options: Record<string, string> = {}
      for (const option of row.OptionSet?.Options ?? []) {
        options[String(option.Value)] = label(option.Label, String(option.Value))
      }
      column.options = options
    }
    for (const row of booleans.value) {
      const column = columns[row.LogicalName]
      const set = row.OptionSet
      if (!column || !set) continue
      column.options = {
        '1': label(set.TrueOption?.Label, '1'),
        '0': label(set.FalseOption?.Label, '0'),
      }
    }
    for (const row of lookups.value) {
      const column = columns[row.LogicalName]
      if (column && row.Targets?.length) column.targets = row.Targets
    }

    return {
      logicalName: entity.LogicalName ?? table,
      displayName: label(entity.DisplayName, table),
      auditEnabled: managedBool(entity.IsAuditEnabled),
      primaryIdAttribute: entity.PrimaryIdAttribute,
      columns,
    }
  }

  private getPrimary(entity: string): Promise<{ id: string; name: string } | null> {
    let cached = this.primaryCache.get(entity)
    if (!cached) {
      cached = this.get<{ PrimaryIdAttribute?: string; PrimaryNameAttribute?: string }>(
        `/EntityDefinitions(LogicalName='${entity}')?$select=PrimaryIdAttribute,PrimaryNameAttribute`,
      )
        .then((m) =>
          m.PrimaryIdAttribute && m.PrimaryNameAttribute
            ? { id: m.PrimaryIdAttribute, name: m.PrimaryNameAttribute }
            : null,
        )
        .catch(() => null)
      this.primaryCache.set(entity, cached)
    }
    return cached
  }

  /**
   * Display names for lookup references (`entity,guid` keys). Anything that
   * cannot be read — deleted record, missing privilege — is simply absent.
   */
  async resolveLookups(keys: string[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {}
    const byEntity = new Map<string, string[]>()
    for (const key of keys) {
      const cached = this.nameCache.get(key)
      if (cached !== undefined) {
        if (cached) result[key] = cached
        continue
      }
      const [entity, id] = key.split(',')
      if (!entity || !id) continue
      const list = byEntity.get(entity) ?? []
      list.push(id)
      byEntity.set(entity, list)
    }

    await Promise.all(
      [...byEntity.entries()].map(async ([entity, ids]) => {
        const primary = await this.getPrimary(entity)
        for (let i = 0; i < ids.length; i += LOOKUP_BATCH) {
          const slice = ids.slice(i, i + LOOKUP_BATCH)
          // Mark as attempted so a failure is not retried on every render.
          for (const id of slice) this.nameCache.set(lookupKey(entity, id), '')
          if (!primary) continue
          try {
            const page = await this.webAPI.retrieveMultipleRecords(
              entity,
              `?$select=${primary.id},${primary.name}&$filter=${slice
                .map((id) => `${primary.id} eq ${id}`)
                .join(' or ')}`,
            )
            for (const row of page.entities) {
              const id = row[primary.id]
              const name = row[primary.name]
              if (typeof id !== 'string' || typeof name !== 'string' || !name) continue
              const key = lookupKey(entity, id)
              this.nameCache.set(key, name)
              result[key] = name
            }
          } catch (err) {
            console.warn('[RecordAuditHistory] lookup names unavailable for', entity, err)
          }
        }
      }),
    )
    return result
  }
}
