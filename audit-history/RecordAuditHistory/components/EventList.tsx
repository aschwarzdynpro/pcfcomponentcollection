import * as React from 'react'
import type { AttributeChange, AuditEvent, OperationCode } from '../model'
import type { Formatter } from '../format'
import { dayKey, initialsFrom, partitionChanges } from '../format'
import type { Strings } from '../i18n'
import type { AuditApi } from '../api'
import { ChangeTable } from './ChangeTable'

interface EventListProps {
  events: AuditEvent[]
  api: AuditApi
  fmt: Formatter
  t: Strings
}

const OPERATION_CLASS: Record<OperationCode, string> = {
  1: 'create',
  2: 'update',
  3: 'delete',
  4: 'access',
}

/** How many column names the collapsed row previews. */
const PREVIEW = 3

/**
 * Events grouped by day; each row expands in place. Several rows can be open
 * at once — comparing two or three changes side by side is the normal move.
 */
export function EventList({ events, api, fmt, t }: EventListProps) {
  const [open, setOpen] = React.useState<Record<string, boolean>>({})
  const [fetched, setFetched] = React.useState<Record<string, AttributeChange[]>>({})
  const [busy, setBusy] = React.useState<Record<string, boolean>>({})

  const toggle = (event: AuditEvent) => {
    const isOpen = Boolean(open[event.id])
    setOpen((prev) => ({ ...prev, [event.id]: !isOpen }))
    if (isOpen) return
    // Rows normally carry their diff inline. Only when it is missing do we pay
    // for a RetrieveAuditDetails round trip, and only where a diff can exist.
    const needsFetch =
      event.changes.length === 0 &&
      !fetched[event.id] &&
      (event.operation === 1 || event.operation === 2)
    if (!needsFetch) return
    setBusy((prev) => ({ ...prev, [event.id]: true }))
    const fetchDetails = async () => {
      let changes: AttributeChange[] = []
      try {
        changes = await api.getAuditDetails(event.id)
      } catch (err) {
        console.warn('[RecordAuditHistory] RetrieveAuditDetails failed', err)
      }
      setFetched((prev) => ({ ...prev, [event.id]: changes }))
      setBusy((prev) => ({ ...prev, [event.id]: false }))
    }
    void fetchDetails()
  }

  const dayCounts = new Map<string, number>()
  for (const e of events) dayCounts.set(dayKey(e.createdOn), (dayCounts.get(dayKey(e.createdOn)) ?? 0) + 1)

  let lastDay: string | null = null
  return (
    <div className="rah-list">
      {events.map((event) => {
        const key = dayKey(event.createdOn)
        const showDay = key !== lastDay
        lastDay = key
        const changes = event.changes.length ? event.changes : (fetched[event.id] ?? [])
        const isOpen = Boolean(open[event.id])
        const { business } = partitionChanges(changes)
        const preview = business.slice(0, PREVIEW).map((c) => fmt.columnName(c.attribute))
        const rest = business.length - preview.length
        const userName = event.userName || t.unknownUser
        const opClass = OPERATION_CLASS[event.operation]

        return (
          <React.Fragment key={event.id}>
            {showDay && (
              <div className="rah-day">
                <span>{fmt.date(event.createdOn)}</span>
                <span className="rah-day-count">{dayCounts.get(key)}</span>
              </div>
            )}
            <div className={`rah-row ${isOpen ? 'rah-row--open' : ''}`}>
              <button
                type="button"
                className="rah-row-main"
                onClick={() => toggle(event)}
                aria-expanded={isOpen}
              >
                <span className="rah-caret" aria-hidden="true">
                  {isOpen ? '▾' : '▸'}
                </span>
                <span className="rah-time">{fmt.time(event.createdOn)}</span>
                <span className={`rah-badge rah-badge--${opClass}`}>
                  {event.actionLabel ?? event.operationLabel}
                </span>
                <span className="rah-user" title={userName}>
                  <span className="rah-avatar" aria-hidden="true">
                    {initialsFrom(userName)}
                  </span>
                  <span className="rah-user-name">{userName}</span>
                </span>
                <span className="rah-preview" title={preview.join(', ')}>
                  {preview.join(', ')}
                  {rest > 0 && <span className="rah-more"> {t.more(rest)}</span>}
                </span>
              </button>
            </div>
            {isOpen && (
              <div className="rah-panel">
                {event.operation === 3 ? (
                  <div className="rah-note">{t.deleted}</div>
                ) : event.operation === 4 ? (
                  <div className="rah-note">{t.access}</div>
                ) : busy[event.id] ? (
                  <div className="rah-note">{t.loadingChanges}</div>
                ) : changes.length === 0 ? (
                  <div className="rah-note">{t.noChanges}</div>
                ) : (
                  <ChangeTable changes={changes} operation={event.operation} fmt={fmt} t={t} />
                )}
              </div>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
