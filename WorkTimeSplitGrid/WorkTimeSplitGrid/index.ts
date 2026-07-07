import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import * as ReactDOM from "react-dom";
import {
    WorkTimeSplitGrid as WorkTimeSplitGridView,
    WorkTimeSplitGridProps,
} from "./components/WorkTimeSplitGrid";
import { lcidToLang } from "./components/i18n";
import { resolveFieldConfig } from "./components/schema";
import { createLogger, Logger, TracingService } from "./components/telemetry";

/** Control version — keep in sync with ControlManifest / package.json / Solution. */
const CONTROL_VERSION = "1.21.1";

export class WorkTimeSplitGrid
    implements ComponentFramework.StandardControl<IInputs, IOutputs>
{
    private _container: HTMLDivElement;
    private _context: ComponentFramework.Context<IInputs>;
    private _logger: Logger;

    public init(
        context: ComponentFramework.Context<IInputs>,
        _notifyOutputChanged: () => void,
        _state: ComponentFramework.Dictionary,
        container: HTMLDivElement,
    ): void {
        this._context = context;
        this._container = container;
        // PCF diagnostic trace + console; instruments the destructive ops.
        this._logger = createLogger(
            (context as unknown as { tracing?: TracingService }).tracing,
        );
        this._logger.event("init");
        container.classList.add("wtsg-host");
        // Master/detail needs vertical room — dataset PCFs default to a small
        // height. Ask the host to track the real container size.
        try {
            context.mode.trackContainerResize(true);
        } catch {
            // older runtimes don't support trackContainerResize; ignore
        }
        // Offline reads the list from the bound (cached) dataset — ask for a
        // bigger page so more cached records are available without paging.
        if (this.isOffline()) {
            try {
                context.parameters.entries.paging.setPageSize(500);
            } catch {
                // not ready / unsupported — first page still renders
            }
        }
        this.render();
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this._context = context;
        this.render();
    }

    public getOutputs(): IOutputs {
        return {};
    }

    public destroy(): void {
        ReactDOM.unmountComponentAtNode(this._container);
    }

    /**
     * Phone form factor (3) → mobile-optimized single-pane layout. Desktop (1)
     * and Tablet (2) keep the two-pane layout unchanged. When the host can't
     * report a form factor (0), fall back to the allocated width.
     */
    private isMobile(): boolean {
        let formFactor = 0;
        try {
            formFactor = this._context.client.getFormFactor() ?? 0;
        } catch {
            formFactor = 0;
        }
        if (formFactor === 3) return true;
        if (formFactor === 1 || formFactor === 2) return false;
        const width = this._context.mode.allocatedWidth ?? 0;
        return width > 0 && width < 560;
    }

    /**
     * Single-pane (list OR detail) vs two-pane (list + detail side by side).
     * Phones stay single-pane in portrait, but in landscape the width is ample
     * and stacking the toolbars over a hidden list wastes it — so we switch to
     * the two-pane "cockpit" (the same layout desktop/tablet already use). The
     * touch styling (`isMobile`) is kept; only the column count changes. Needs a
     * minimum width so a small phone in landscape doesn't get two cramped panes.
     */
    private isSinglePane(mobile: boolean): boolean {
        if (!mobile) return false;
        const w = this._context.mode.allocatedWidth ?? 0;
        const h = this._context.mode.allocatedHeight ?? 0;
        const landscape = w > 0 && h > 0 && w > h;
        return !(landscape && w >= 640);
    }

    /**
     * Offline → read-only. The list is read from the bound (offline-cached)
     * dataset, but the write actions (split save, delivery-note creation) are
     * disabled because they need live server queries + a transactional $batch.
     * We detect it so the UI can switch to the read-only path instead of letting
     * the live queries fail with a generic platform error.
     */
    private isOffline(): boolean {
        try {
            return this._context.client.isOffline();
        } catch {
            return false;
        }
    }

    /**
     * Whether the device network is available (model-driven). Used as an extra
     * gate: no network → definitely offline, so the control blocks immediately
     * instead of waiting on the live probe. Best-effort: if the host doesn't
     * expose it (older runtimes / canvas), assume available so we don't over-block.
     */
    private isNetworkAvailable(): boolean {
        try {
            const c = this._context.client as unknown as {
                isNetworkAvailable?: () => boolean;
            };
            if (typeof c.isNetworkAvailable === "function") {
                return c.isNetworkAvailable() !== false;
            }
        } catch {
            /* unavailable — fall through */
        }
        return true;
    }

    /** Best-effort environment/org identifier for the debug panel (id, else host). */
    private environmentId(): string {
        const c = this._context as unknown as {
            orgSettings?: { organizationId?: string; uniqueName?: string };
        };
        const org =
            c.orgSettings?.organizationId ?? c.orgSettings?.uniqueName ?? "";
        if (org) return org;
        try {
            return window.location.hostname || "";
        } catch {
            return "";
        }
    }

    /** Suggestion (★) button off by default; shown only when explicitly enabled. */
    private showSuggest(): boolean {
        const raw = (this._context.parameters.showSuggestButton?.raw ?? "")
            .trim()
            .toLowerCase();
        return ["show", "true", "yes", "ja", "1", "on", "ein"].indexOf(raw) !== -1;
    }

    private render(): void {
        const params = this._context.parameters;
        const mobile = this.isMobile();
        const props: WorkTimeSplitGridProps = {
            dataset: params.entries,
            webApi: this._context.webAPI,
            utils: this._context.utils,
            navigation: this._context.navigation,
            isMobile: mobile,
            singlePane: this.isSinglePane(mobile),
            isOffline: this.isOffline(),
            networkAvailable: this.isNetworkAvailable(),
            showSuggest: this.showSuggest(),
            // Field-override manifest properties are disabled — the SST defaults
            // in schema.ts apply. Re-add the matching <property> entries in
            // ControlManifest.Input.xml and uncomment these to expose overrides.
            fields: resolveFieldConfig({
                // totalField: params.totalField?.raw,
                // dateField: params.dateField?.raw,
                // typeField: params.typeField?.raw,
                // pauseValue: params.pauseValue?.raw,
                // completedField: params.completedField?.raw,
                // subtypeField: params.subtypeField?.raw,
            }),
            userId: this._context.userSettings?.userId ?? "",
            userName: this._context.userSettings?.userName ?? "",
            version: CONTROL_VERSION,
            environmentId: this.environmentId(),
            disabled: this._context.mode.isControlDisabled,
            lang: lcidToLang(this._context.userSettings?.languageId),
            logger: this._logger,
        };

        ReactDOM.render(
            React.createElement(WorkTimeSplitGridView, props),
            this._container,
        );
    }
}
