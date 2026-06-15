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
        return {
            selectedValue: this._single === null ? undefined : this._single,
        } as IOutputs;
    }

    public destroy(): void {
        ReactDOM.unmountComponentAtNode(this._container);
    }

    /** Pull the current selection + mode out of the (possibly re-instanced) context. */
    private syncFromContext(context: ComponentFramework.Context<IInputs>): void {
        const param = context.parameters.selectedValue as unknown as ChoiceParam;
        const mode = context.parameters.selectionMode?.raw as
            | "auto"
            | "single"
            | "multiple"
            | undefined;

        this._multi = resolveMulti(param, mode);

        if (this._multi) {
            this._multiValues = Array.isArray(param.raw)
                ? [...param.raw]
                : typeof param.raw === "number"
                  ? [param.raw]
                  : [];
        } else {
            this._single =
                typeof param.raw === "number"
                    ? param.raw
                    : Array.isArray(param.raw) && param.raw.length
                      ? param.raw[0]
                      : null;
        }
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
