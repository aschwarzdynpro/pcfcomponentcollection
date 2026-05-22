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

// The TS type generated for `Lookup.Simple` doesn't expose getTargetEntityType
// directly — it's on the runtime property bag. We reach for it loosely.
interface LookupPropertyMeta {
    getTargetEntityType?: () => string;
    Target?: string;
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

    public async init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        _state: ComponentFramework.Dictionary,
        container: HTMLDivElement,
    ): Promise<void> {
        this._context = context;
        this._container = container;
        this._notifyOutputChanged = notifyOutputChanged;
        container.classList.add("flc-host-root");

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

        // Resolve metadata (primary name + column display names). Render once
        // we know the primaryName so column 0 is correctly identified even when
        // the maker left every column input blank.
        const utility = (context as unknown as { utils?: unknown; utility?: unknown }).utility as
            | Parameters<typeof fetchTargetMetadata>[0]
            | undefined;

        const meta = this._targetEntity
            ? await fetchTargetMetadata(utility, this._targetEntity, rawCols)
            : {
                  primaryName: "name",
                  columnDisplayNames: Object.fromEntries(rawCols.map((c) => [c, c])),
              };

        this._primaryName = meta.primaryName;

        // Ensure primaryName is always column 0; deduplicate.
        const orderedCols = Array.from(new Set([meta.primaryName, ...rawCols]));
        this._columns = orderedCols.slice(0, 4);
        this._columnHeaders = this._columns.map((c) => meta.columnDisplayNames[c] ?? c);
        this._metadataLoaded = true;

        this.render();
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
        return {
            selectedItem: [
                {
                    id: this._selected.id,
                    name: this._selected.primaryName,
                    entityType: this._selected.entityName,
                },
            ],
        };
    }

    public destroy(): void {
        ReactDOM.unmountComponentAtNode(this._container);
    }

    private readSelected(
        context: ComponentFramework.Context<IInputs>,
    ): LookupRecord | null {
        const raw = context.parameters.selectedItem?.raw as unknown as
            | LookupPropertyRaw[]
            | undefined;
        const first = raw?.[0];
        if (!first?.id) return null;
        return {
            id: first.id,
            entityName: first.entityType,
            primaryName: first.name ?? "",
            columns: { [this._primaryName]: first.name ?? "" },
            highlights: {},
        };
    }

    private readTargetEntity(
        context: ComponentFramework.Context<IInputs>,
    ): string {
        // Lookup.Simple exposes the target on the parameter's attribute bag.
        // We dig in loosely because the generated TS types don't cover this.
        const attrs = (context.parameters.selectedItem as unknown as {
            attributes?: LookupPropertyMeta;
            getTargetEntityType?: () => string;
            Target?: string;
        });
        const fromMethod = attrs.attributes?.getTargetEntityType?.();
        if (fromMethod) return fromMethod;
        const fromAttr = attrs.attributes?.Target;
        if (typeof fromAttr === "string" && fromAttr) return fromAttr;
        // Some hosts surface the target on `.raw[0].entityType` even when
        // unselected (with a sentinel empty id). Use that as a final fallback.
        const raw = (context.parameters.selectedItem?.raw as unknown as LookupPropertyRaw[] | undefined);
        return raw?.[0]?.entityType ?? "";
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
