import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import * as ReactDOM from "react-dom";
import {
    KanbanBoard as KanbanBoardView,
    KanbanBoardProps,
} from "./components/KanbanBoard";
import { lcidToLang } from "./components/i18n";

export class KanbanBoard
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
        container.classList.add("kbn-host");
        // Tell the host we want a generously sized canvas — the dataset
        // PCFs default to a small height which doesn't fit a board.
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
        const props: KanbanBoardProps = {
            dataset: params.cards,
            webApi: this._context.webAPI,
            navigation: this._context.navigation,
            utils: this._context.utils,
            statusColumn: params.statusColumn?.raw ?? "",
            titleColumn: params.titleColumn?.raw ?? null,
            subtitleColumn: params.subtitleColumn?.raw ?? null,
            descriptionColumn: params.descriptionColumn?.raw ?? null,
            allowDragDrop: params.allowDragDrop?.raw !== false,
            allowCreate: params.allowCreate?.raw !== false,
            disabled: this._context.mode.isControlDisabled,
            lang: lcidToLang(this._context.userSettings?.languageId),
        };

        ReactDOM.render(
            React.createElement(KanbanBoardView, props),
            this._container,
        );
    }
}
