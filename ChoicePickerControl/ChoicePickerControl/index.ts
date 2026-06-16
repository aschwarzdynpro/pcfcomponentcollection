import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { CoolDropdown, ChoiceOption } from "./components/CoolDropdown";
import { lcidToLang } from "./components/lang";

// The bound property is declared with a `type-group` (OptionSet +
// MultiSelectOptionSet), so the generated type is a union and `raw` differs in
// shape (number vs number[]). We read it through this loose view so the runtime
// code is decoupled from whichever concrete type pcf-scripts emits.
interface OptionMeta {
    Label: string;
    Value: number;
    Color: string;
}
interface ChoiceParam {
    raw: number | number[] | null;
    type?: string;
    attributes?: { Options?: OptionMeta[]; DefaultValue?: number };
}

/**
 * Decides whether the bound column is a multi-select Choice. The maker's
 * `selectionMode` wins; in "auto" we sniff the runtime shape:
 *   - a populated array `raw` is unambiguously multi-select;
 *   - otherwise the parameter's `type` string ("MultiSelectOptionSet" /
 *     "Multiple") is the tie-breaker for the empty case.
 * Falls back to single — the conservative default — and the maker can always
 * override via `selectionMode`.
 */
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

/** Normalize the bound `raw` to a single value (number | null). */
function readSingle(param: ChoiceParam): number | null {
    if (typeof param.raw === "number") return param.raw;
    if (Array.isArray(param.raw) && param.raw.length) return param.raw[0];
    return null;
}

/** Normalize the bound `raw` to a value array. */
function readMulti(param: ChoiceParam): number[] {
    if (Array.isArray(param.raw)) return [...param.raw];
    if (typeof param.raw === "number") return [param.raw];
    return [];
}

/** Set-equality for value arrays (order-independent). */
function sameValues(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    const sa = [...a].sort((x, y) => x - y);
    const sb = [...b].sort((x, y) => x - y);
    for (let i = 0; i < sa.length; i++) {
        if (sa[i] !== sb[i]) return false;
    }
    return true;
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

    // --- echo / pending guard -------------------------------------------------
    // After the user picks a value we emit it optimistically and wait for the
    // host to echo it back through updateView. A form `onChange` script can fire
    // an extra updateView while the bound property still carries the PREVIOUS
    // value — without this guard that stale value clobbers the fresh selection
    // (symptom: the pick is wiped and only "sticks" on the second try). We keep
    // the optimistic value until the host confirms it, and ignore a late echo
    // that still carries the prior value.
    private _pending = false;
    private _prevSingle: number | null = null;
    private _prevMulti: number[] = [];

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

    /**
     * Pull the current selection + mode out of the (possibly re-instanced)
     * context, honoring the pending/echo guard so a stale updateView (e.g.
     * triggered by a form onChange script before the new value propagated)
     * cannot overwrite a just-made selection.
     */
    private syncFromContext(context: ComponentFramework.Context<IInputs>): void {
        const param = context.parameters.selectedValue as unknown as ChoiceParam;
        const mode = context.parameters.selectionMode?.raw as
            | "auto"
            | "single"
            | "multiple"
            | undefined;

        this._multi = resolveMulti(param, mode);

        if (this._multi) {
            const incoming = this.orderByOptions(param, readMulti(param));
            if (this._pending) {
                if (sameValues(incoming, this._multiValues)) {
                    // Host confirmed our optimistic value.
                    this._pending = false;
                    this._prevMulti = incoming;
                } else if (sameValues(incoming, this._prevMulti)) {
                    // Late echo of the prior value — ignore, keep optimistic.
                    return;
                } else {
                    // A genuine external change to a different value — adopt it.
                    this._pending = false;
                    this._multiValues = incoming;
                    this._prevMulti = incoming;
                }
            } else {
                this._multiValues = incoming;
                this._prevMulti = incoming;
            }
        } else {
            const incoming = readSingle(param);
            if (this._pending) {
                if (incoming === this._single) {
                    this._pending = false;
                    this._prevSingle = incoming;
                } else if (incoming === this._prevSingle) {
                    // Late echo of the prior value — ignore, keep optimistic.
                    return;
                } else {
                    this._pending = false;
                    this._single = incoming;
                    this._prevSingle = incoming;
                }
            } else {
                this._single = incoming;
                this._prevSingle = incoming;
            }
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
                if (this._multi) {
                    this._multiValues = Array.isArray(next) ? next : [];
                } else {
                    this._single = typeof next === "number" ? next : null;
                }
                // Mark the value as pending so the next stale updateView (from a
                // form onChange script) can't roll it back; it's cleared once the
                // host echoes the value we just emitted.
                this._pending = true;
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
