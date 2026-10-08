import * as React from 'react'
import type { AuditEvent, AuditSettings, TableMeta } from '../model'
import { AuditApi, isPrivilegeError } from '../api'
import { createFormatter, isTechnicalField, lookupKey, lookupRef } from '../format'
import type { Strings } from '../i18n'
import { EventList } from './EventList'
import { FieldHistory } from './FieldHistory'

export interface AuditHistoryProps {
  api: AuditApi
  /** Null when the form shows an unsaved record. */
  recordId: string | null
  table: string | null
  t: Strings
  locale: string
  /** Max height in px; 0 lets the control grow with its content. */
  maxHeight: number
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string; privilege: boolean }
  | {
      status: 'ready'
      events: AuditEvent[]
      truncated: boolean
      settings: AuditSettings
      meta: TableMeta | null
      createdOn: string | null
    }

/** Shadow / system types that never carry a user-visible value. */
const NON_VALUE_TYPES = new Set(['Virtual', 'EntityName', 'Uniqueidentifier', 'ManagedProperty', 'CalendarRules'])

export function AuditHistory({ api, recordId, table, t, locale, maxHeight }: AuditHistoryProps) {
  const [state, setState] = React.useState<LoadState>({ status: 'loading' })
  const [names, setNames] = React.useState<Record<string, string>>({})
  const [column, setColumn] = React.useState('')
  const [reload, setReload] = React.useState(0)

  React.useEffect(() => {
    if (!recordId || !table) return
    let cancelled = false
    setState({ status: 'loading' })
    const load = async () => {
      try {
        const [audit, settings, meta, createdOn] = await Promise.all([
          api.loadRecordAudit(recordId),
          api.getAuditSettings(),
          api.getTableMeta(table),
          api.getRecordCreatedOn(table, recordId),
        ])
        if (!cancelled) setState({ status: 'ready', ...audit, settings, meta, createdOn })
      } catch (err) {
        if (cancelled) return
        console.warn('[RecordAuditHistory] load failed', err)
        const message = (err as { message?: unknown })?.message
        setState({
          status: 'error',
          message: typeof message === 'string' ? message : String(err),
          privilege: isPrivilegeError(err),
        })
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [api, recordId, table, reload])

  // Lookup names the payload did not label — resolved after the rows render.
  React.useEffect(() => {
    if (state.status !== 'ready') return
    const keys = new Set<string>()
    for (const event of state.events) {
      for (const change of event.changes) {
        const col = state.meta?.columns[change.attribute]
        if (!change.oldLabel) {
          const ref = lookupRef(change.oldRaw, col)
          if (ref) keys.add(lookupKey(ref.entity, ref.id))
        }
        if (!change.newLabel) {
          const ref = lookupRef(change.newRaw, col)
          if (ref) keys.add(lookupKey(ref.entity, ref.id))
        }
      }
    }
    if (keys.size === 0) return
    let cancelled = false
    const resolve = async () => {
      const resolved = await api.resolveLookups([...keys])
      if (!cancelled && Object.keys(resolved).length) setNames((prev) => ({ ...prev, ...resolved }))
    }
    void resolve()
    return () => {
      cancelled = true
    }
  }, [api, state])

  const meta = state.status === 'ready' ? state.meta : null
  const fmt = React.useMemo(() => createFormatter(locale, t, meta, names), [locale, t, meta, names])

  const style: React.CSSProperties = maxHeight > 0 ? { maxHeight, overflowY: 'auto' } : {}

  if (!table) return <div className="rah rah-empty">{t.noContext}</div>
  if (!recordId) return <div className="rah rah-empty">{t.unsaved}</div>

  if (state.status === 'loading') {
    return (
      <div className="rah" style={style}>
        <div className="rah-loading" role="status">
          <span className="rah-spinner" aria-hidden="true" />
          {t.loading}
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="rah" style={style}>
        <div className="rah-banner rah-banner--error" role="alert">
          <strong>{t.loadError}</strong>
          <div>{state.privilege ? t.noPrivilege : state.message}</div>
        </div>
        <button type="button" className="rah-btn" onClick={() => setReload((n) => n + 1)}>
          {t.refresh}
        </button>
      </div>
    )
  }

  const { events, truncated, settings, createdOn } = state
  const tableName = meta?.displayName ?? table

  // Retention: past the horizon the rows are gone, which must not read as
  // "never changed". Only relevant when the record predates the horizon.
  const retentionDays = settings.retentionDays
  const cutoff =
    retentionDays !== null && retentionDays > 0
      ? new Date(Date.now() - retentionDays * 86_400_000)
      : null
  const beyondRetention = Boolean(cutoff && createdOn && new Date(createdOn) < cutoff)

  // Column filter options: every column that appears in the history.
  const counts = new Map<string, number>()
  for (const event of events) {
    for (const change of event.changes) {
      counts.set(change.attribute, (counts.get(change.attribute) ?? 0) + 1)
    }
  }
  const columnOptions = [...counts.entries()]
    .map(([attribute, count]) => ({
      attribute,
      count,
      label: fmt.columnName(attribute),
      technical: isTechnicalField(attribute),
    }))
    .sort((a, b) => Number(a.technical) - Number(b.technical) || a.label.localeCompare(b.label, locale))
  const activeColumn = column && counts.has(column) ? column : ''

  // Columns that can never show up, however often they are edited.
  const unaudited = meta
    ? Object.values(meta.columns)
        .filter(
          (c) =>
            !c.auditEnabled &&
            c.updatable &&
            !c.attributeOf &&
            !NON_VALUE_TYPES.has(c.type) &&
            !isTechnicalField(c.logicalName) &&
            c.logicalName !== meta.primaryIdAttribute,
        )
        .sort((a, b) => a.displayName.localeCompare(b.displayName, locale))
    : []

  const emptyText = (() => {
    if (meta && !meta.auditEnabled) return t.emptyOff(tableName)
    if (beyondRetention) return t.emptyRetention
    if (meta?.auditEnabled) return t.emptyClean(tableName)
    return t.emptyUnknown
  })()

  const newest = events[0]
  const oldest = events[events.length - 1]

  return (
    <div className="rah" style={style}>
      <div className="rah-toolbar">
        <div className="rah-summary">
          <span className="rah-count">{t.entries(events.length)}</span>
          {oldest && newest && (
            <span className="rah-range">
              {fmt.date(oldest.createdOn)} – {fmt.date(newest.createdOn)}
            </span>
          )}
        </div>
        <div className="rah-actions">
          {columnOptions.length > 0 && (
            <label className="rah-select-wrap">
              <span className="rah-visually-hidden">{t.columnFilter}</span>
              <select
                className="rah-select"
                value={activeColumn}
                onChange={(e) => setColumn(e.target.value)}
                aria-label={t.columnFilter}
              >
                <option value="">{t.allColumns}</option>
                {columnOptions.map((o) => (
                  <option key={o.attribute} value={o.attribute}>
                    {o.label} ({o.count})
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            className="rah-btn rah-btn--icon"
            onClick={() => setReload((n) => n + 1)}
            title={t.refresh}
            aria-label={t.refresh}
          >
            ⟳
          </button>
        </div>
      </div>

      {!settings.orgAuditEnabled && <div className="rah-banner rah-banner--warn">{t.orgAuditOff}</div>}
      {settings.orgAuditEnabled && meta && !meta.auditEnabled && events.length > 0 && (
        <div className="rah-banner rah-banner--warn">{t.tableAuditOff(tableName)}</div>
      )}
      {beyondRetention && cutoff && events.length > 0 && retentionDays !== null && (
        <div className="rah-banner rah-banner--info">
          {t.retention(t.days(retentionDays), fmt.date(cutoff.toISOString()))}
        </div>
      )}
      {truncated && <div className="rah-banner rah-banner--info">{t.truncated(events.length)}</div>}

      {events.length === 0 ? (
        <div className={`rah-empty ${meta?.auditEnabled && !beyondRetention ? 'rah-empty--clean' : 'rah-empty--warn'}`}>
          {emptyText}
        </div>
      ) : activeColumn ? (
        <FieldHistory events={events} attribute={activeColumn} fmt={fmt} t={t} />
      ) : (
        <EventList events={events} api={api} fmt={fmt} t={t} />
      )}

      {unaudited.length > 0 && (
        <details className="rah-unaudited">
          <summary>{t.unaudited(unaudited.length)}</summary>
          <p>{t.unauditedHint}</p>
          <ul>
            {unaudited.map((c) => (
              <li key={c.logicalName} title={c.logicalName}>
                {c.displayName}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
