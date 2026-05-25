import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { FuzzyLookup } from "./components/FuzzyLookup";
import { lcidToLang, STRINGS } from "./components/lang";
import { fetchTargetMetadata } from "./services/metadata";
import type { LookupRecord } from "./services/types";

interface LookupPropertyRaw {
    id: string;
    name: string;
    entityType: string;
}

export class FuzzyLookupControl
    implements ComponentFramework.StandardControl<IInputs, IOutputs>
{
    private _container: HTMLDivElement;
    private _context: ComponentFramework.Context<IInputs>;
    private _notifyOutputChanged: () => void;

    private _selected: LookupRecord | null = null;
    private _targetEntity = "";
    private _primaryName = "name";
    private _columns: string[] = [];
    private _columnHeaders: string[] = [];
    private _metadataLoaded = false;
    private _safetyTimeout: number | null = null;

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        _state: ComponentFramework.Dictionary,
        container: HTMLDivElement,
    ): void {
        this._context = context;
        this._container = container;
        this._notifyOutputChanged = notifyOutputChanged;
        container.classList.add("flc-host-root");

        // Hide the host until metadata finishes resolving — without this we
        // get a brief flash of the fallback column headers (title-cased
        // logical names) before the real display names arrive, and the
        // unstyled input briefly bleeds through the surrounding form layout
        // before fonts/colors apply. A 1.5 s safety timeout makes sure we
        // never stay hidden forever if the metadata fetch hangs.
        container.style.visibility = "hidden";
        container.style.minHeight = "32px";
        this._safetyTimeout = window.setTimeout(() => this.reveal(), 1500);

        this._selected = this.readSelected(context);
        this._targetEntity = this.readTargetEntity(context);

        // Compute the columns the user configured (logical names). Empty entry
        // → column not shown. The first non-empty entry is used as primary if
        // metadata fetch fails.
        const rawCols = [
            context.parameters.column1?.raw,
            context.parameters.column2?.raw,
            context.parameters.column3?.raw,
            context.parameters.column4?.raw,
        ]
            .map((c) => (c ?? "").trim())
            .filter((c) => c.length > 0);

        // Render synchronously with a "name" fallback so the UCI form-load
        // lifecycle is not blocked by our async metadata fetch. The Lookup's
        // primary name is updated asynchronously below; we re-render once it
        // arrives. Keeping init synchronous avoids the
        // `Te._runPostNavigationHandler` crash some UCI versions throw when
        // a control's init promise is still pending while the form fires
        // post-navigation handlers.
        this._primaryName = "name";
        this._columns = Array.from(new Set([this._primaryName, ...rawCols])).slice(0, 4);
        this._columnHeaders = this._columns.map((c) => titleCase(c));
        this._metadataLoaded = true;
        this.render();

        if (this._targetEntity) {
            void this.loadMetadata(rawCols);
        } else {
            // Nothing to wait for — reveal immediately.
            this.reveal();
        }
    }

    private reveal(): void {
        if (this._safetyTimeout !== null) {
            window.clearTimeout(this._safetyTimeout);
            this._safetyTimeout = null;
        }
        if (this._container) {
            this._container.style.visibility = "visible";
        }
    }

    private async loadMetadata(rawCols: string[]): Promise<void> {
        try {
            const utility = (this._context as unknown as { utility?: unknown }).utility as
                | Parameters<typeof fetchTargetMetadata>[0]["utility"]
                | undefined;
            const meta = await fetchTargetMetadata({
                utility,
                webApi: this._context.webAPI as Parameters<typeof fetchTargetMetadata>[0]["webApi"],
                entityName: this._targetEntity,
                requestedColumns: rawCols,
            });

            this._primaryName = meta.primaryName;
            const orderedCols = Array.from(new Set([meta.primaryName, ...rawCols]));
            this._columns = orderedCols.slice(0, 4);
            this._columnHeaders = this._columns.map((c) => meta.columnDisplayNames[c] ?? titleCase(c));

            // eslint-disable-next-line no-console
            console.info("FuzzyLookupControl ready", {
                target: this._targetEntity,
                primaryName: this._primaryName,
                columns: this._columns,
                columnHeaders: this._columnHeaders,
                configuredColumns: rawCols,
            });

            this.render();
        } finally {
            // Reveal regardless of whether metadata fetch succeeded — the
            // user must always see *something* in the lookup column.
            this.reveal();
        }
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this._context = context;
        const incoming = this.readSelected(context);
        if (incoming?.id !== this._selected?.id) {
            this._selected = incoming;
        }
        this.render();
    }

    public getOutputs(): IOutputs {
        if (!this._selected) {
            return { selectedItem: [] };
        }
        // Set both `entityType` (PCF reference docs) and `entityTypeName`
        // (used internally by UCI's FormSignal/PostNavigation handlers).
        // Missing the latter crashed with
        // "Cannot read properties of undefined (reading 'entityTypeName')"
        // on some UCI builds.
        return {
            selectedItem: [
                {
                    id: this._selected.id,
                    name: this._selected.primaryName,
                    entityType: this._selected.entityName,
                    entityTypeName: this._selected.entityName,
                } as ComponentFramework.LookupValue,
            ],
        };
    }

    public destroy(): void {
        ReactDOM.unmountComponentAtNode(this._container);
    }

    private readSelected(
        context: ComponentFramework.Context<IInputs>,
    ): LookupRecord | null {
        // PCF hosts inconsistently surface the target entity on raw lookup
        // entries as `entityType` vs. `entityTypeName`. Read both.
        const raw = context.parameters.selectedItem?.raw as unknown as
            | (LookupPropertyRaw & { entityTypeName?: string })[]
            | undefined;
        const first = raw?.[0];
        if (!first?.id) return null;
        const entityName = first.entityType || first.entityTypeName || "";
        return {
            id: first.id,
            entityName,
            primaryName: first.name ?? "",
            columns: { [this._primaryName]: first.name ?? "" },
            highlights: {},
        };
    }

    private readTargetEntity(
        context: ComponentFramework.Context<IInputs>,
    ): string {
        // The Lookup.Simple property surfaces the target table in several
        // places depending on UCI version. Probe them in priority order:
        //   1. `selectedItem.getTargetEntityType()` — the standard PCF API
        //      shown in the official LookupSimpleControl sample.
        //   2. `selectedItem.attributes.Targets[0]` — `LookupAttributeMetadata`
        //      exposes the allowed targets as an array (plural). For
        //      Lookup.Simple it always has exactly one entry.
        //   3. `selectedItem.raw[0].entityType` — present once a value is
        //      selected; useful in unit-test harnesses where (1) and (2) are
        //      not mocked.
        const prop = context.parameters.selectedItem as unknown as {
            getTargetEntityType?: () => string;
            attributes?: { Targets?: string[]; Target?: string };
            raw?: LookupPropertyRaw[];
        };

        const fromMethod = prop.getTargetEntityType?.();
        if (fromMethod) return fromMethod;

        const targets = prop.attributes?.Targets;
        if (Array.isArray(targets) && targets.length > 0 && targets[0]) {
            return targets[0];
        }

        const singleTarget = prop.attributes?.Target;
        if (typeof singleTarget === "string" && singleTarget) {
            return singleTarget;
        }

        const fromRaw = prop.raw?.[0]?.entityType;
        if (typeof fromRaw === "string" && fromRaw) return fromRaw;

        // No path worked — emit a diagnostic so the maker can see exactly what
        // shape the PCF host returned.
        // eslint-disable-next-line no-console
        console.warn(
            "FuzzyLookupControl: could not resolve target table for the bound " +
                "Lookup column. The control will not search until this is fixed. " +
                "selectedItem keys:",
            Object.keys(prop ?? {}),
            "attributes keys:",
            Object.keys(prop?.attributes ?? {}),
        );
        return "";
    }

    private async openQuickCreate(): Promise<void> {
        if (!this._targetEntity) return;
        try {
            const result = await this._context.navigation.openForm({
                entityName: this._targetEntity,
                useQuickCreateForm: true,
            });
            // openForm returns `{ savedEntityReference: [{ id, name, entityType }] }`
            // when the user saves the Quick-Create form.
            const ref = (result as unknown as {
                savedEntityReference?: LookupPropertyRaw[];
            }).savedEntityReference?.[0];
            if (ref?.id) {
                this._selected = {
                    id: ref.id,
                    entityName: ref.entityType,
                    primaryName: ref.name,
                    columns: { [this._primaryName]: ref.name },
                    highlights: {},
                };
                this._notifyOutputChanged();
                this.render();
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn(
                "FuzzyLookupControl: could not open Quick-Create form for " +
                    `${this._targetEntity}. Make sure the user has create permission and that a ` +
                    "Quick-Create form is published.",
                e,
            );
        }
    }

    /**
     * Opens UCI's native "Look Up Records" dialog (the same one the OOB
     * Lookup control surfaces behind its magnifier button). We hand back any
     * record the user picks via the same path Quick-Create uses, so the
     * dirty-flag and notifyOutputChanged plumbing stays consistent.
     */
    private async openLookupDialog(): Promise<void> {
        if (!this._targetEntity) return;
        try {
            const utils = (this._context as unknown as {
                utils?: {
                    lookupObjects?: (options: {
                        entityTypes: string[];
                        allowMultiSelect?: boolean;
                        defaultEntityType?: string;
                    }) => Promise<{ id: string; name: string; entityType: string }[]>;
                };
            }).utils;
            const lookupObjects = utils?.lookupObjects;
            if (!lookupObjects) {
                // eslint-disable-next-line no-console
                console.warn(
                    "FuzzyLookupControl: context.utils.lookupObjects is not available on this host.",
                );
                return;
            }
            const result = await lookupObjects({
                entityTypes: [this._targetEntity],
                allowMultiSelect: false,
                defaultEntityType: this._targetEntity,
            });
            const first = result?.[0];
            if (first?.id) {
                this._selected = {
                    id: first.id,
                    entityName: first.entityType,
                    primaryName: first.name,
                    columns: { [this._primaryName]: first.name },
                    highlights: {},
                };
                this._notifyOutputChanged();
                this.render();
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn("FuzzyLookupControl: lookupObjects failed", e);
        }
    }

    private openRecord(rec: LookupRecord): void {
        try {
            void this._context.navigation.openForm({
                entityName: rec.entityName,
                entityId: rec.id,
                openInNewWindow: false,
            });
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn("FuzzyLookupControl: openForm failed for " + rec.id, e);
        }
    }

    private render(): void {
        if (!this._metadataLoaded) return;
        const ctx = this._context;
        const lang = lcidToLang(ctx.userSettings?.languageId);
        const strings = STRINGS[lang];

        const placeholder =
            ctx.parameters.placeholder?.raw?.trim() || strings.placeholderDefault;
        const pageSizeRaw = ctx.parameters.pageSize?.raw;
        const pageSize = clampPageSize(pageSizeRaw);

        const enableQuickCreate =
            ctx.parameters.enableQuickCreate?.raw !== false; // default ON
        const enableFavorites = ctx.parameters.enableFavorites?.raw === true;
        const enableRecentlyUsed = ctx.parameters.enableRecentlyUsed?.raw === true;

        const userId = (ctx.userSettings?.userId ?? "").replace(/[{}]/g, "");

        const props = {
            selected: this._selected,
            targetEntity: this._targetEntity,
            primaryName: this._primaryName,
            columns: this._columns,
            columnHeaders: this._columnHeaders,
            placeholder,
            pageSize,
            disabled: ctx.mode.isControlDisabled,
            enableQuickCreate,
            enableFavorites,
            enableRecentlyUsed,
            webApi: ctx.webAPI,
            userId,
            strings,
            onChange: (rec: LookupRecord | null) => {
                this._selected = rec;
                this._notifyOutputChanged();
                this.render();
            },
            onOpenRecord: (rec: LookupRecord) => this.openRecord(rec),
            onQuickCreate: () => void this.openQuickCreate(),
            onOpenLookupDialog: () => void this.openLookupDialog(),
        };

        ReactDOM.render(
            React.createElement(FuzzyLookup, props),
            this._container,
        );
    }
}

function clampPageSize(raw: number | null | undefined): number {
    const n = typeof raw === "number" && Number.isFinite(raw) ? Math.floor(raw) : 25;
    if (n < 1) return 1;
    if (n > 50) return 50;
    return n;
}

function titleCase(logical: string): string {
    const stripped = logical.replace(/^[a-z]+_/, "");
    return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}
