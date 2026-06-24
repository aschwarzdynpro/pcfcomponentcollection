import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { CoolDropdown, ChoiceOption } from "./components/CoolDropdown";
import { lcidToLang } from "./components/lang";

// The bound property is declared with a `type-group` (OptionSet +
// MultiSelectOptionSet), so the generated type is a union AND — crucially — the
// host serializes the value richly: instead of a plain number it hands us the
// internal OptionSet value object `{ _val, _label, _color, ... }` (a single one
// for a single Choice, an array of them for a multi Choice). We read everything
// through this loose view + `coerceVal()` so the numeric value is recovered
// whatever shape the host uses.
interface OptionMeta {
    Label: string;
    Value: number;
    Color: string;
}
interface ChoiceParam {
    raw: unknown;
    type?: string;
    attributes?: {
        Options?: OptionMeta[];
        DefaultValue?: number;
        LogicalName?: string;
    };
}

type Selection = number | number[] | null;

// --- recent-selection cache (module-level, survives a destroy/re-init) --------
// A form `onChange` script that toggles control visibility / required levels can
// make the host briefly RE-INITIALIZE the PCF, or fire extra `updateView`s while
// the bound column still carries the PREVIOUS value. Either way an in-instance
// flag is lost or bypassed and the fresh pick gets clobbered (symptom: the value
// is wiped and only "sticks" on the second pick). We remember the user's most
// recent pick per (record × column) at module scope.
//
// IMPORTANT — this must NOT affect a normal form load. The cache is honored only
// when it is BOTH very fresh (a few seconds) AND the incoming bound value still
// equals the exact value the user picked away from (`prev`) — i.e. the host is
// literally replaying the stale pre-pick value. On a real load the incoming
// value is the saved DB value, which won't match `prev`, so the cache is inert.
interface RecentPick {
    value: Selection;
    prev: Selection;
    ts: number;
}
const RECENT: Record<string, RecentPick> = {};
// Short on purpose: long enough to cover the synchronous onChange-script churn /
// re-init storm, far shorter than any human navigation or form reload.
const RECENT_WINDOW_MS = 2500;

function now(): number {
    try {
        return Date.now();
    } catch {
        return 0;
    }
}

/**
 * Recover the numeric option value from whatever shape the host delivers: a
 * plain number, or the rich OptionSet value object (`{ _val }` — also seen as
 * `value` / `Value` across hosts).
 */
function coerceVal(v: unknown): number | null {
    if (typeof v === "number") return v;
    if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        if (typeof o._val === "number") return o._val;
        if (typeof o.value === "number") return o.value;
        if (typeof o.Value === "number") return o.Value;
    }
    return null;
}

function resolveMulti(
    param: ChoiceParam,
    mode: "auto" | "single" | "multiple" | undefined,
): boolean {
    if (mode === "single") return false;
    if (mode === "multiple") return true;
    if (Array.isArray(param.raw)) return true;
    const t = (param.type ?? "").toLowerCase();
    return t.indexOf("multi") >= 0;
}

function readOptions(param: ChoiceParam): ChoiceOption[] {
    const opts = param.attributes?.Options ?? [];
    return opts.map((o) => ({
        value: o.Value,
        label: o.Label,
        color: o.Color ?? "",
    }));
}

/** Normalize the bound value to a single option value (number | null). */
function readSingle(param: ChoiceParam): number | null {
    const r = param.raw;
    if (Array.isArray(r)) return r.length ? coerceVal(r[0]) : null;
    return coerceVal(r);
}

/** Normalize the bound value to an array of option values. */
function readMulti(param: ChoiceParam): number[] {
    const r = param.raw;
    if (Array.isArray(r)) {
        return r.map(coerceVal).filter((v): v is number => v !== null);
    }
    const single = coerceVal(r);
    return single !== null ? [single] : [];
}

/** Set-equality for value arrays (order-independent). */
function sameSelection(a: Selection, b: Selection): boolean {
    if (Array.isArray(a) || Array.isArray(b)) {
        const aa = Array.isArray(a) ? a : a === null ? [] : [a];
        const bb = Array.isArray(b) ? b : b === null ? [] : [b];
        if (aa.length !== bb.length) return false;
        const sa = [...aa].sort((x, y) => x - y);
        const sb = [...bb].sort((x, y) => x - y);
        for (let i = 0; i < sa.length; i++) {
            if (sa[i] !== sb[i]) return false;
        }
        return true;
    }
    return a === b;
}

export class ChoicePickerControl
    implements ComponentFramework.StandardControl<IInputs, IOutputs>
{
    private _container: HTMLDivElement;
    private _context: ComponentFramework.Context<IInputs>;
    private _notifyOutputChanged: () => void;

    private _multi = false;
    // Internal selection. Single → number | null; multi → number[].
    private _single: number | null = null;
    private _multiValues: number[] = [];
    private _cacheKey: string | null = null;
    // Set true the first time the USER changes the value in this instance. Until
    // then getOutputs() must not push a value back, or it would overwrite the
    // value the host just loaded from the database (blank-on-load bug).
    private _userEdited = false;

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        _state: ComponentFramework.Dictionary,
        container: HTMLDivElement,
    ): void {
        this._context = context;
        this._notifyOutputChanged = notifyOutputChanged;
        this._container = container;

        container.classList.add("cpc-host");

        this.syncFromContext(context);
        this.render();
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this._context = context;
        this.syncFromContext(context);
        this.render();
    }

    public getOutputs(): IOutputs {
        // Do NOT push any value before the user has actually edited this control.
        // The host polls getOutputs() during form load; returning a concrete
        // value (or null) here overwrites the just-loaded DB value and blanks the
        // field. Returning an empty object leaves the bound column untouched.
        if (!this._userEdited) {
            return {} as IOutputs;
        }
        if (this._multi) {
            return { selectedValue: this._multiValues } as IOutputs;
        }
        // Return `null` (not `undefined`) so clearing a single Choice actually
        // propagates to the bound column.
        return {
            selectedValue: this._single === null ? null : this._single,
        } as unknown as IOutputs;
    }

    public destroy(): void {
        ReactDOM.unmountComponentAtNode(this._container);
    }

    /** Stable key for the bound field on the current record. */
    private buildCacheKey(
        context: ComponentFramework.Context<IInputs>,
        param: ChoiceParam,
    ): string | null {
        const logical = param.attributes?.LogicalName;
        if (!logical) return null;
        const page = (context as unknown as {
            page?: { entityTypeName?: string; entityId?: string };
        }).page;
        const entityName = page?.entityTypeName ?? "";
        const entityId = page?.entityId
            ? page.entityId.replace(/[{}]/g, "")
            : "";
        return `${entityName}:${entityId}:${logical}`;
    }

    /**
     * Pull the current selection + mode out of the (possibly re-instanced)
     * context. A recent user pick (module cache) wins over a stale incoming
     * value until the host echoes the picked value back, so a form onChange
     * script can't roll the selection back.
     */
    private syncFromContext(context: ComponentFramework.Context<IInputs>): void {
        const param = context.parameters.selectedValue as unknown as ChoiceParam;
        const mode = context.parameters.selectionMode?.raw as
            | "auto"
            | "single"
            | "multiple"
            | undefined;

        this._multi = resolveMulti(param, mode);
        this._cacheKey = this.buildCacheKey(context, param);

        const incoming: Selection = this._multi
            ? this.orderByOptions(param, readMulti(param))
            : readSingle(param);

        // Respect a fresh, not-yet-confirmed user pick — but ONLY when the host
        // is replaying the exact pre-pick value (the stale echo / re-init case).
        // This keeps the cache inert on a normal form load.
        const cached = this._cacheKey ? RECENT[this._cacheKey] : undefined;
        if (cached && now() - cached.ts < RECENT_WINDOW_MS) {
            if (sameSelection(incoming, cached.value)) {
                // Host caught up to the pick — confirmed; drop the entry so
                // genuine external changes apply from here on.
                if (this._cacheKey) delete RECENT[this._cacheKey];
            } else if (sameSelection(incoming, cached.prev)) {
                // Host is still showing the stale pre-pick value — restore the
                // optimistic pick instead of letting it roll back.
                this.applySelection(cached.value);
                return;
            }
            // Any other incoming value is a genuine change → fall through.
        }

        this.applySelection(incoming);
    }

    private applySelection(sel: Selection): void {
        if (this._multi) {
            this._multiValues = Array.isArray(sel)
                ? sel
                : sel === null
                  ? []
                  : [sel];
        } else {
            this._single = Array.isArray(sel)
                ? sel.length
                    ? sel[0]
                    : null
                : sel;
        }
    }

    /** Reorder selected values to match the Dataverse-defined option order. */
    private orderByOptions(param: ChoiceParam, values: number[]): number[] {
        const order = (param.attributes?.Options ?? []).map((o) => o.Value);
        const inOrder = order.filter((v) => values.indexOf(v) >= 0);
        const extras = values.filter((v) => order.indexOf(v) < 0);
        return inOrder.concat(extras);
    }

    private render(): void {
        const context = this._context;
        const param = context.parameters.selectedValue as unknown as ChoiceParam;
        const options = readOptions(param);

        const lang = lcidToLang(context.userSettings?.languageId);
        const isDisabled = context.mode.isControlDisabled;

        const showColors = context.parameters.colorMode?.raw !== "off";
        const clearable = context.parameters.clearButton?.raw !== "off";
        const searchBox = context.parameters.searchBox?.raw ?? "auto";
        const placeholder = context.parameters.placeholder?.raw ?? null;

        const props = {
            options,
            multi: this._multi,
            selectedSingle: this._single,
            selectedMulti: this._multiValues,
            placeholder,
            disabled: isDisabled,
            showColors,
            searchBox,
            clearable,
            lang,
            onChange: (next: number | number[] | null) => {
                const value: Selection = this._multi
                    ? Array.isArray(next)
                        ? next
                        : []
                    : typeof next === "number"
                      ? next
                      : null;
                // Capture the value we're changing FROM so the guard can tell a
                // stale pre-pick echo from a genuine external change.
                const prev: Selection = this._multi
                    ? [...this._multiValues]
                    : this._single;
                // The user is now driving the value — getOutputs() may push.
                this._userEdited = true;
                this.applySelection(value);
                // Remember this pick so a stale updateView (or a destroy/re-init
                // caused by a form onChange script) can't roll it back.
                if (this._cacheKey) {
                    RECENT[this._cacheKey] = { value, prev, ts: now() };
                }
                this._notifyOutputChanged();
                // Re-render immediately so the UI reflects the change before the
                // host echoes the new value back through updateView.
                this.render();
            },
        };

        ReactDOM.render(
            React.createElement(CoolDropdown, props),
            this._container,
        );
    }
}
