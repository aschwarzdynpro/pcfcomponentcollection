/**
 * Domain model of the record audit history.
 *
 * Mirrors `apps/audit-explorer/src/types/audit.ts`, narrowed to one record and
 * with one important difference: values are kept **raw** plus whatever label
 * the server delivered. Formatting happens at render time, because the inputs
 * it needs (column metadata, option labels, resolved lookup names) arrive in
 * separate requests after the rows themselves.
 */

/** `audit.operation`: what kind of event this is. */
export type OperationCode = 1 | 2 | 3 | 4

export interface AttributeChange {
  /** Logical name of the changed column (`_x_value` already stripped). */
  attribute: string
  /** Unformatted value as delivered — lookups as `entity,guid`. */
  oldRaw?: string
  newRaw?: string
  /**
   * Label the server already resolved (lookup name, formatted value). When
   * present it wins over anything we can derive from metadata.
   */
  oldLabel?: string
  newLabel?: string
}

export interface AuditEvent {
  /** auditid */
  id: string
  /** createdon, ISO */
  createdOn: string
  operation: OperationCode
  /** Server-localized label of `operation` (Create / Erstellen …). */
  operationLabel: string
  /** `audit.action` — finer than operation: Assign, Activate, Share … */
  action?: number
  actionLabel?: string
  userId?: string
  userName: string
  /** Column-level changes. Empty for Delete/Access and when not loaded yet. */
  changes: AttributeChange[]
  /** True when `changes` came inline with the row (`changedata`). */
  inline: boolean
}

/** Org-level audit settings. */
export interface AuditSettings {
  orgAuditEnabled: boolean
  /** Days; -1 = forever; null = unknown. */
  retentionDays: number | null
}

export interface ColumnMeta {
  logicalName: string
  displayName: string
  auditEnabled: boolean
  /** AttributeType from metadata: Picklist, Lookup, Money, DateTime … */
  type: string
  /** Set on shadow columns (`xyzname`) — those are not real columns. */
  attributeOf?: string
  /** `IsValidForUpdate` — false for system-maintained columns. */
  updatable: boolean
  /** Option value → label, for picklist / state / status / boolean / multi. */
  options?: Record<string, string>
  /** Lookup targets, used to resolve bare GUIDs. */
  targets?: string[]
}

export interface TableMeta {
  logicalName: string
  displayName: string
  auditEnabled: boolean
  primaryIdAttribute?: string
  columns: Record<string, ColumnMeta>
}

export interface RecordAuditResult {
  events: AuditEvent[]
  /** Paging stopped at the row cap — oldest events are missing. */
  truncated: boolean
}
