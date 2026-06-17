import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import * as ReactDOM from "react-dom";
import {
    WorkTimeSplitGrid as WorkTimeSplitGridView,
    WorkTimeSplitGridProps,
} from "./components/WorkTimeSplitGrid";
import { lcidToLang } from "./components/i18n";
import { resolveFieldConfig } from "./components/schema";

export class WorkTimeSplitGrid
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
        container.classList.add("wtsg-host");
        // Master/detail needs vertical room — dataset PCFs default to a small
        // height. Ask the host to track the real container size.
        try {
            context.mode.trackContainerResize(true);
        } catch {
            // older runtimes don't support trackContainerResize; ignore
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

    private render(): void {
        const params = this._context.parameters;
        const props: WorkTimeSplitGridProps = {
            dataset: params.entries,
            webApi: this._context.webAPI,
            utils: this._context.utils,
            fields: resolveFieldConfig({
                totalField: params.totalField?.raw,
                dateField: params.dateField?.raw,
                typeField: params.typeField?.raw,
                pauseValue: params.pauseValue?.raw,
                completedField: params.completedField?.raw,
                subtypeField: params.subtypeField?.raw,
            }),
            disabled: this._context.mode.isControlDisabled,
            lang: lcidToLang(this._context.userSettings?.languageId),
        };

        ReactDOM.render(
            React.createElement(WorkTimeSplitGridView, props),
            this._container,
        );
    }
}
