import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { MultiProgress, ProgressItem } from "./components/MultiProgress";
import { lcidToLang } from "./components/strings";

const DEFAULT_MAX = 100;
const MAX_SLOTS = 6;

type WholeNumber = ComponentFramework.PropertyTypes.WholeNumberProperty;
type StringProp = ComponentFramework.PropertyTypes.StringProperty;

// PCF doesn't expose a bound column's metadata through the typed API, so we
// sniff the runtime `attributes` bag. When a column is actually bound it carries
// a DisplayName; an optional bound slot the maker never mapped has no attributes.
const columnMeta = (
    p: WholeNumber | undefined,
): { DisplayName?: string } | undefined =>
    (p as unknown as { attributes?: { DisplayName?: string } } | undefined)
        ?.attributes;

// A slot counts as "present" when it is bound to a column (has attributes) or
// already carries a value. Unmapped optional slots are skipped entirely.
const isPresent = (p: WholeNumber | undefined): boolean => {
    if (!p) return false;
    if (columnMeta(p) !== undefined) return true;
    return p.raw !== null && p.raw !== undefined;
};

const toPercent = (raw: number | null, max: number): number => {
    if (raw === null || raw === undefined || !Number.isFinite(raw)) return 0;
    if (max <= 0) return 0;
    const pct = Math.round((raw / max) * 100);
    return Math.max(0, Math.min(100, pct));
};

const cleanLabel = (s: string | null | undefined): string =>
    typeof s === "string" ? s.trim() : "";

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const DEFAULT_BRAND = "#0F6CBD";

// Prefer the environment's Fluent brand token so the "in progress" ring matches
// the host theme; fall back to the design's #0F6CBD. The token bag isn't in the
// typed API, so we sniff it defensively and only accept a valid hex string.
const resolveBrandColor = (
    context: ComponentFramework.Context<IInputs>,
): string => {
    const fdl = (
        context as unknown as {
            fluentDesignLanguage?: { tokenTheme?: Record<string, unknown> };
        }
    ).fluentDesignLanguage;
    const theme = fdl?.tokenTheme;
    if (theme) {
        const candidate =
            theme.colorBrandBackground ?? theme.colorBrandForeground1;
        if (typeof candidate === "string" && HEX_RE.test(candidate.trim())) {
            return candidate.trim();
        }
    }
    return DEFAULT_BRAND;
};

export class MultiProgressControl
    implements ComponentFramework.StandardControl<IInputs, IOutputs>
{
    private _container: HTMLDivElement;
    private _context: ComponentFramework.Context<IInputs>;

    public init(
        context: ComponentFramework.Context<IInputs>,
        _notifyOutputChanged: () => void,
        _state: ComponentFramework.Dictionary,
        container: HTMLDivElement,
    ): void {
        this._context = context;
        this._container = container;
        container.classList.add("mpc-host");
        this.render();
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this._context = context;
        this.render();
    }

    // Read-only control — nothing is written back to the record.
    public getOutputs(): IOutputs {
        return {};
    }

    public destroy(): void {
        ReactDOM.unmountComponentAtNode(this._container);
    }

    private buildItems(): ProgressItem[] {
        const p = this._context.parameters;

        const rawMax = p.maxValue?.raw;
        const max =
            typeof rawMax === "number" && rawMax > 0 ? rawMax : DEFAULT_MAX;

        const fields: (WholeNumber | undefined)[] = [
            p.field1,
            p.field2,
            p.field3,
            p.field4,
            p.field5,
            p.field6,
        ];
        const labels: (StringProp | undefined)[] = [
            p.label1,
            p.label2,
            p.label3,
            p.label4,
            p.label5,
            p.label6,
        ];

        const items: ProgressItem[] = [];
        for (let i = 0; i < MAX_SLOTS; i++) {
            const field = fields[i];
            if (!isPresent(field)) continue;

            const override = cleanLabel(labels[i]?.raw);
            const label = override || columnMeta(field)?.DisplayName || "";

            items.push({
                key: `slot${i + 1}`,
                label,
                percent: toPercent(field?.raw ?? null, max),
            });
        }
        return items;
    }

    private render(): void {
        const lang = lcidToLang(this._context.userSettings?.languageId);
        const header = cleanLabel(this._context.parameters.headerLabel?.raw);

        ReactDOM.render(
            React.createElement(MultiProgress, {
                items: this.buildItems(),
                header,
                brandColor: resolveBrandColor(this._context),
                lang,
            }),
            this._container,
        );
    }
}
