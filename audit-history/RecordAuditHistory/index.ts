import { IInputs, IOutputs } from './generated/ManifestTypes'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { AuditHistory } from './components/AuditHistory'
import { AuditApi } from './api'
import { lcidToLang, lcidToLocale, stringsFor } from './i18n'

/**
 * Record Audit History — the Audit Explorer's record mode as a form control.
 *
 * Bound to any column only because a field control needs one; the value is
 * never read or written. What it shows is the audit history of the record the
 * form is open on.
 */
export class RecordAuditHistory implements ComponentFramework.StandardControl<IInputs, IOutputs> {
  private container!: HTMLDivElement
  private api!: AuditApi

  public init(
    context: ComponentFramework.Context<IInputs>,
    _notifyOutputChanged: () => void,
    _state: ComponentFramework.Dictionary,
    container: HTMLDivElement,
  ): void {
    this.container = container
    this.api = new AuditApi(context.webAPI, clientUrl(context))
    this.render(context)
  }

  public updateView(context: ComponentFramework.Context<IInputs>): void {
    this.render(context)
  }

  public getOutputs(): IOutputs {
    return {}
  }

  public destroy(): void {
    ReactDOM.unmountComponentAtNode(this.container)
  }

  private render(context: ComponentFramework.Context<IInputs>): void {
    const lcid = context.userSettings.languageId
    const lang = lcidToLang(lcid)
    const { recordId, table } = recordContext(context)
    const maxHeight = context.parameters.maxHeight?.raw ?? 0
    ReactDOM.render(
      React.createElement(AuditHistory, {
        api: this.api,
        recordId,
        table,
        t: stringsFor(lang),
        locale: lcidToLocale(lcid, lang),
        maxHeight: maxHeight > 0 ? maxHeight : 0,
      }),
      this.container,
    )
  }
}

/** Not in the typings, but present on model-driven forms. */
interface FormContextHost {
  mode?: { contextInfo?: { entityId?: string; entityTypeName?: string } }
  page?: { entityId?: string; entityTypeName?: string; getClientUrl?: () => string }
}

function recordContext(context: ComponentFramework.Context<IInputs>): {
  recordId: string | null
  table: string | null
} {
  const host = context as unknown as FormContextHost
  const info = host.mode?.contextInfo
  const id = info?.entityId || host.page?.entityId || ''
  const table = info?.entityTypeName || host.page?.entityTypeName || ''
  const clean = id.replace(/[{}]/g, '').toLowerCase()
  return {
    recordId: /^[0-9a-f-]{36}$/.test(clean) && clean !== '00000000-0000-0000-0000-000000000000' ? clean : null,
    table: table || null,
  }
}

function clientUrl(context: ComponentFramework.Context<IInputs>): string {
  const host = context as unknown as FormContextHost
  try {
    const url = host.page?.getClientUrl?.()
    if (url) return url.replace(/\/$/, '')
  } catch {
    // fall through to the page origin
  }
  return window.location.origin
}
