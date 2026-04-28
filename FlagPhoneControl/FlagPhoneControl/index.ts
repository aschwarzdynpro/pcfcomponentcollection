import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { FlagPhone } from "./components/FlagPhone";
import { lcidToLang } from "./components/countries";

export class FlagPhoneControl
    implements ComponentFramework.StandardControl<IInputs, IOutputs>
{
    private _container: HTMLDivElement;
    private _context: ComponentFramework.Context<IInputs>;
    private _notifyOutputChanged: () => void;

    private _value: string = "";

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        _state: ComponentFramework.Dictionary,
        container: HTMLDivElement,
    ): void {
        this._context = context;
        this._container = container;
        this._notifyOutputChanged = notifyOutputChanged;

        this._value = context.parameters.phoneNumber.raw ?? "";

        container.classList.add("fpc-host");
        this.render();
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this._context = context;
        const incoming = context.parameters.phoneNumber.raw ?? "";
        if (incoming !== this._value) {
            this._value = incoming;
        }
        this.render();
    }

    public getOutputs(): IOutputs {
        return {
            phoneNumber: this._value === "" ? undefined : this._value,
        };
    }

    public destroy(): void {
        ReactDOM.unmountComponentAtNode(this._container);
    }

    private render(): void {
        const isDisabled = this._context.mode.isControlDisabled;

        const lang = lcidToLang(this._context.userSettings?.languageId);

        const props = {
            value: this._value,
            defaultCountry: this._context.parameters.defaultCountry?.raw ?? null,
            placeholder: this._context.parameters.placeholder?.raw ?? null,
            disabled: isDisabled,
            lang,
            onChange: (next: string) => {
                if (next === this._value) return;
                this._value = next;
                this._notifyOutputChanged();
            },
        };

        ReactDOM.render(
            React.createElement(FlagPhone, props),
            this._container,
        );
    }
}
