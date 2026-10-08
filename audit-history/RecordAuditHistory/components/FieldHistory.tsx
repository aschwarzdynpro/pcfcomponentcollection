import * as React from 'react'
import type { AuditEvent } from '../model'
import type { Formatter } from '../format'
import type { Strings } from '../i18n'

interface FieldHistoryProps {
  events: AuditEvent[]
  attribute: string
  fmt: Formatter
  t: Strings
}

/**
 * Value history of one column: old → new is the row itself, not something
 * behind an expander. "Who changed the price, from what, to what" has to be
 * scannable in one glance.
 */
export function FieldHistory({ events, attribute, fmt, t }: FieldHistoryProps) {
  const rows = events.flatMap((event) => {
    const change = event.changes.find((c) => c.attribute === attribute)
    return change ? [{ event, change }] : []
  })

  if (rows.length === 0) {
    return <div className="rah-empty">{t.noColumnHistory}</div>
  }

  return (
    <div className="rah-field" role="table">
      <div className="rah-field-head" role="row">
        <span role="columnheader">{t.when}</span>
        <span role="columnheader">{t.from}</span>
        <span role="columnheader">{t.to}</span>
        <span role="columnheader">{t.who}</span>
      </div>
      {rows.map(({ event, change }) => (
        <div className="rah-field-row" role="row" key={event.id}>
          <span className="rah-field-when" role="cell">
            {fmt.dateTime(event.createdOn)}
          </span>
          <span className="rah-change-old" role="cell">
            {fmt.value(change, 'old') || '—'}
          </span>
          <span className="rah-change-new" role="cell">
            {fmt.value(change, 'new') || '—'}
          </span>
          <span className="rah-field-who" role="cell">
            {event.userName || t.unknownUser}
          </span>
        </div>
      ))}
    </div>
  )
}
