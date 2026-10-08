import * as React from 'react'
import type { AttributeChange, OperationCode } from '../model'
import type { Formatter } from '../format'
import { partitionChanges } from '../format'
import type { Strings } from '../i18n'

interface ChangeTableProps {
  changes: AttributeChange[]
  operation: OperationCode
  fmt: Formatter
  t: Strings
}

/**
 * The column diff of one audit entry (port of the code app's ChangeTable).
 *
 * - A Create renders as a column/value list: every "old" cell of a create is
 *   empty by definition.
 * - Technical columns (modifiedon, versionnumber, owning*) sit behind a
 *   disclosure — left inline they bury the line somebody came to read.
 */
export function ChangeTable({ changes, operation, fmt, t }: ChangeTableProps) {
  const [showTechnical, setShowTechnical] = React.useState(false)
  const { business, technical } = partitionChanges(changes)
  const onlyTechnical = business.length === 0 && technical.length > 0
  const rows = onlyTechnical ? technical : showTechnical ? [...business, ...technical] : business
  const isCreate = operation === 1

  return (
    <>
      <div className={`rah-changes ${isCreate ? 'rah-changes--create' : ''}`} role="table">
        <div className="rah-changes-head" role="row">
          <span role="columnheader">{t.field}</span>
          {!isCreate && <span role="columnheader">{t.oldValue}</span>}
          <span role="columnheader">{isCreate ? t.value : t.newValue}</span>
        </div>
        {rows.map((c) => (
          <div className="rah-change-row" role="row" key={c.attribute}>
            <span className="rah-change-attr" role="cell" title={c.attribute}>
              {fmt.columnName(c.attribute)}
            </span>
            {!isCreate && (
              <span className="rah-change-old" role="cell">
                {fmt.value(c, 'old') || '—'}
              </span>
            )}
            <span className="rah-change-new" role="cell">
              {fmt.value(c, 'new') || '—'}
            </span>
          </div>
        ))}
      </div>
      {technical.length > 0 &&
        (onlyTechnical ? (
          <p className="rah-tech-note">{t.onlyTechnical}</p>
        ) : (
          <button
            type="button"
            className="rah-link-btn rah-tech-toggle"
            onClick={() => setShowTechnical((v) => !v)}
          >
            {showTechnical ? t.hideTechnical : t.showTechnical(technical.length)}
          </button>
        ))}
    </>
  )
}
