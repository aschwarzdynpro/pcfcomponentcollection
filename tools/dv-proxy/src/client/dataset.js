// A ComponentFramework.PropertyTypes.DataSet backed by FetchXML against the
// real environment. Covers what controls use in practice: columns, records,
// paging, sorting, simple filters, selection, refresh, openDatasetItem.

import { FV, dvFetch, entityMeta, pcfFormatted, pcfType, pcfValue } from './dataverse.js'

/** PCF ConditionOperator → FetchXML operator. */
const CONDITION_OPS = {
  0: 'eq',
  1: 'ne',
  2: 'gt',
  3: 'lt',
  4: 'ge',
  5: 'le',
  6: 'like',
  7: 'not-like',
  8: 'in',
  9: 'not-in',
  12: 'null',
  13: 'not-null',
  32: 'eq-userid',
  34: 'ne-userid',
}

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c])
}

function parseXml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  const err = doc.querySelector('parsererror')
  if (err) throw new Error(`FetchXML ist kein gültiges XML: ${err.textContent.slice(0, 200)}`)
  return doc
}

export class HarnessDataset {
  /**
   * @param {{ name: string, onChange: () => void, log: (e: object) => void, orgUrl: string }} options
   */
  constructor({ name, onChange, log, orgUrl }) {
    this.name = name
    this.onChange = onChange
    this.log = log
    this.orgUrl = orgUrl
    this.fetchXml = ''
    this.layoutColumns = null // [{ name, width }]
    this.viewId = ''
    this.title = ''
    this.entity = ''

    this.columns = []
    this.records = {}
    this.sortedRecordIds = []
    this.loading = false
    this.error = false
    this.errorMessage = ''
    this.sorting = []
    this.selected = []
    this.filterExpression = null
    this.pageSize = 25
    this.page = 1
    this.total = -1
    this.more = false

    const self = this
    this.paging = {
      get totalResultCount() {
        return self.total
      },
      get firstPageNumber() {
        return self.page
      },
      get lastPageNumber() {
        return self.page
      },
      get pageSize() {
        return self.pageSize
      },
      get hasNextPage() {
        return self.more
      },
      get hasPreviousPage() {
        return self.page > 1
      },
      loadNextPage: () => this.load(this.page + 1),
      loadPreviousPage: () => this.load(Math.max(1, this.page - 1)),
      loadExactPage: (n) => this.load(Math.max(1, Number(n) || 1)),
      reset: () => this.load(1),
      setPageSize: (n) => {
        this.pageSize = Math.max(1, Number(n) || 25)
      },
    }
    this.filtering = {
      getFilter: () => this.filterExpression,
      setFilter: (expression) => {
        this.filterExpression = expression
      },
      clearFilter: () => {
        this.filterExpression = null
      },
    }
    this.linking = {
      getLinkedEntities: () => [],
      addLinkedEntity: (expr) => this.log({ kind: 'warn', text: `linking.addLinkedEntity wird in der Harness nicht ausgewertet: ${JSON.stringify(expr)}` }),
    }
  }

  /** Configure from a saved view (or raw FetchXML) and load page 1. */
  async configure({ entity, fetchXml, layoutXml, viewId, title }) {
    this.entity = entity
    this.fetchXml = fetchXml
    this.viewId = viewId ?? ''
    this.title = title ?? ''
    this.layoutColumns = layoutXml ? this.parseLayout(layoutXml) : null
    const doc = parseXml(fetchXml)
    const root = doc.querySelector('fetch > entity')
    this.sorting = [...(root?.querySelectorAll(':scope > order') ?? [])].map((o) => ({
      name: o.getAttribute('attribute'),
      sortDirection: o.getAttribute('descending') === 'true' ? 1 : 0,
    }))
    await this.load(1)
  }

  parseLayout(layoutXml) {
    const doc = parseXml(layoutXml)
    return [...doc.querySelectorAll('cell')].map((c) => ({
      name: c.getAttribute('name'),
      width: Number(c.getAttribute('width')) || 100,
    }))
  }

  /** The configured FetchXML with sorting, filter and paging applied. */
  buildFetch(page) {
    const doc = parseXml(this.fetchXml)
    const fetchEl = doc.querySelector('fetch')
    const root = fetchEl.querySelector(':scope > entity')
    fetchEl.setAttribute('page', String(page))
    fetchEl.setAttribute('count', String(this.pageSize))
    fetchEl.setAttribute('returntotalrecordcount', 'true')
    fetchEl.removeAttribute('top')
    for (const o of [...root.querySelectorAll(':scope > order')]) o.remove()
    for (const s of this.sorting) {
      const order = doc.createElement('order')
      order.setAttribute('attribute', s.name)
      order.setAttribute('descending', s.sortDirection === 1 ? 'true' : 'false')
      root.appendChild(order)
    }
    const filter = this.filterExpression
    if (filter?.conditions?.length) {
      const f = doc.createElement('filter')
      f.setAttribute('type', filter.filterOperator === 1 ? 'or' : 'and')
      for (const c of filter.conditions) {
        const op = CONDITION_OPS[c.conditionOperator]
        if (!op) {
          this.log({ kind: 'warn', text: `Filter-Operator ${c.conditionOperator} wird in der Harness ignoriert` })
          continue
        }
        const cond = doc.createElement('condition')
        cond.setAttribute('attribute', c.attributeName)
        cond.setAttribute('operator', op)
        if (Array.isArray(c.value)) {
          for (const v of c.value) {
            const val = doc.createElement('value')
            val.textContent = String(v)
            cond.appendChild(val)
          }
        } else if (c.value !== undefined && c.value !== null && op !== 'null' && op !== 'not-null') {
          cond.setAttribute('value', String(c.value))
        }
        f.appendChild(cond)
      }
      root.appendChild(f)
    }
    return new XMLSerializer().serializeToString(doc)
  }

  async load(page) {
    if (!this.entity || !this.fetchXml) return
    this.loading = true
    this.onChange()
    try {
      const meta = await entityMeta(this.entity)
      const fetchXml = this.buildFetch(page)
      const { body } = await dvFetch(`${meta.entitySetName}?fetchXml=${encodeURIComponent(fetchXml)}`)
      const rows = body.value ?? []

      const doc = parseXml(this.fetchXml)
      const root = doc.querySelector('fetch > entity')
      const attrNames = this.layoutColumns
        ? this.layoutColumns.map((c) => c.name)
        : [...root.querySelectorAll(':scope > attribute')].map((a) => a.getAttribute('name'))
      this.columns = attrNames.map((name, order) => {
        const attr = meta.attributes.get(name)
        const width = this.layoutColumns?.[order]?.width ?? 150
        return {
          name,
          displayName: attr?.displayName ?? name,
          dataType: pcfType(attr),
          alias: name,
          order,
          visualSizeFactor: width,
          isHidden: false,
          isPrimary: name === meta.primaryName,
          disableSorting: false,
        }
      })

      this.records = {}
      this.sortedRecordIds = []
      for (const row of rows) {
        const id = row[meta.primaryId]
        if (!id) continue
        this.sortedRecordIds.push(id)
        this.records[id] = this.makeRecord(row, id, meta)
      }
      this.page = page
      this.total = body['@Microsoft.Dynamics.CRM.totalrecordcount'] ?? -1
      this.more = Boolean(body['@Microsoft.Dynamics.CRM.morerecords'])
      this.error = false
      this.errorMessage = ''
    } catch (err) {
      this.error = true
      this.errorMessage = String(err?.message ?? err)
      this.log({ kind: 'error', text: `Dataset ${this.name}: ${this.errorMessage}` })
    } finally {
      this.loading = false
      this.onChange()
    }
  }

  makeRecord(row, id, meta) {
    return {
      getRecordId: () => id,
      getValue: (column) => pcfValue(row, column, meta.attributes.get(column)),
      getFormattedValue: (column) => pcfFormatted(row, column),
      getNamedReference: () => ({
        id: { guid: id },
        name: row[meta.primaryName] ?? row[`${meta.primaryName}${FV}`] ?? '',
        etn: meta.logicalName,
        entityType: meta.logicalName,
      }),
      isDirty: () => false,
      isValid: () => true,
      save: () => Promise.reject(new Error('record.save() ist in der Harness nicht verfügbar')),
      setValue: () => this.log({ kind: 'warn', text: 'record.setValue() wird in der Harness nur protokolliert' }),
    }
  }

  /** The object handed to the control as context.parameters[name]. */
  asParameter() {
    return {
      loading: this.loading,
      error: this.error,
      errorMessage: this.errorMessage,
      innerError: null,
      columns: this.columns,
      records: this.records,
      sortedRecordIds: this.sortedRecordIds,
      sorting: this.sorting,
      paging: this.paging,
      filtering: this.filtering,
      linking: this.linking,
      security: { editable: true, readable: true, secured: false },
      addColumn: (name) => {
        const doc = parseXml(this.fetchXml)
        const root = doc.querySelector('fetch > entity')
        if (![...root.querySelectorAll(':scope > attribute')].some((a) => a.getAttribute('name') === name)) {
          const a = doc.createElement('attribute')
          a.setAttribute('name', name)
          root.insertBefore(a, root.firstChild)
          this.fetchXml = new XMLSerializer().serializeToString(doc)
          if (this.layoutColumns) this.layoutColumns.push({ name, width: 100 })
        }
      },
      refresh: () => void this.load(this.page),
      getTargetEntityType: () => this.entity,
      getTitle: () => this.title,
      getViewId: () => this.viewId,
      getSelectedRecordIds: () => [...this.selected],
      setSelectedRecordIds: (ids) => {
        this.selected = [...(ids ?? [])]
        this.log({ kind: 'event', text: `${this.name}.setSelectedRecordIds(${this.selected.length})` })
        this.onChange()
      },
      clearSelectedRecordIds: () => {
        this.selected = []
        this.onChange()
      },
      openDatasetItem: (ref) => {
        const id = ref?.id?.guid ?? ref?.id ?? ref
        const etn = ref?.etn ?? ref?.entityType ?? this.entity
        this.log({ kind: 'event', text: `${this.name}.openDatasetItem(${etn}, ${id})` })
        window.open(`${this.orgUrl}/main.aspx?etn=${etn}&id=${id}&pagetype=entityrecord`, '_blank', 'noopener')
      },
      delete: () => Promise.reject(new Error('dataset.delete() ist in der Harness nicht verfügbar')),
      getRelationshipInfo: () => null,
    }
  }

  static escape = escapeXml
}
