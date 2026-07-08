import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import { App, AppProps } from "./components/App";
import { lcidToLang } from "./components/i18n";
import { resolveConfig, ControlConfig } from "./components/schema";
import { BoxRecord, DisplayCell } from "./components/types";
import {
    IChildRecordService,
    MockChildRecordService,
    WebApiChildRecordService,
} from "./services/childRecordService";
import {
    IUpdateService,
    MockUpdateService,
    WebApiUpdateService,
} from "./services/updateService";

/** Control version — keep in sync with ControlManifest / package.json / Solution. */
const CONTROL_VERSION = "1.0.0";

type Dataset = ComponentFramework.PropertyTypes.DataSet;

export class MaterialBoxList
    implements ComponentFramework.ReactControl<IInputs, IOutputs>
{
    private _config: ControlConfig;
    private _childService: IChildRecordService;
    private _updateService: IUpdateService | null = null;
    private _entityName = "";
    private _pageSizeSet = false;

    public init(
        context: ComponentFramework.Context<IInputs>,
        _notifyOutputChanged: () => void,
        _state: ComponentFramework.Dictionary,
    ): void {
        const p = context.parameters;
        this._config = resolveConfig({
            childEntityName: p.childEntityName?.raw,
            childLookupField: p.childLookupField?.raw,
            childDisplayColumns: p.childDisplayColumns?.raw,
            childFilter: p.childFilter?.raw,
            swipeFieldName: p.swipeFieldName?.raw,
            swipeFieldValue: p.swipeFieldValue?.raw,
            takenBehavior: p.takenBehavior?.raw,
        });

        // Master/detail needs vertical room — dataset PCFs default to a small
        // height. Ask the host to track the real container size.
        try {
            context.mode.trackContainerResize(true);
        } catch {
            // older runtimes don't support trackContainerResize; ignore
        }

        // Web API is available online (model-driven/portals) and offline with
        // simple $select/$filter. The test harness has no webAPI → mock so the
        // gerüst is fully web-testable (concept §7 / milestone 1).
        this._childService = context.webAPI
            ? new WebApiChildRecordService(context.webAPI, this._config)
            : new MockChildRecordService(this._config);
    }

    public updateView(
        context: ComponentFramework.Context<IInputs>,
    ): React.ReactElement {
        const dataset = context.parameters.boxDataset;

        // Ask for a reasonable page once the dataset is ready.
        if (!this._pageSizeSet && !dataset.loading) {
            try {
                dataset.paging.setPageSize(25);
                this._pageSizeSet = true;
            } catch {
                // not ready / unsupported — first page still renders
            }
        }

        this.ensureUpdateService(context, dataset);

        const props: AppProps = {
            boxes: this.buildBoxes(dataset),
            hasNextPage: this.hasNextPage(dataset),
            loading: dataset.loading,
            childService: this._childService,
            updateService: this._updateService ?? new MockUpdateService(),
            takenBehavior: this._config.takenBehavior,
            lang: lcidToLang(context.userSettings?.languageId),
            onLoadMore: () => this.loadNextPage(dataset),
        };

        return React.createElement(App, props);
    }

    public getOutputs(): IOutputs {
        return {};
    }

    public destroy(): void {
        // Virtual controls unmount their React tree automatically.
    }

    /** Build the update service once the bound entity type is known (stable). */
    private ensureUpdateService(
        context: ComponentFramework.Context<IInputs>,
        dataset: Dataset,
    ): void {
        if (this._updateService) return;
        let entityName = "";
        try {
            entityName = dataset.getTargetEntityType() ?? "";
        } catch {
            entityName = "";
        }
        if (!entityName) return;
        this._entityName = entityName;
        this._updateService = context.webAPI
            ? new WebApiUpdateService(context.webAPI, entityName, this._config)
            : new MockUpdateService();
    }

    /** Flatten the bound dataset records into rows for the master list. */
    private buildBoxes(dataset: Dataset): BoxRecord[] {
        const columns = [...dataset.columns].sort((a, b) => a.order - b.order);
        const nameCol = columns[0];
        const otherCols = columns.slice(1);

        return dataset.sortedRecordIds.map((id) => {
            const rec = dataset.records[id];
            const name = nameCol
                ? rec.getFormattedValue(nameCol.name) || ""
                : "";
            const cells: DisplayCell[] = otherCols
                .map((c) => ({
                    key: c.name,
                    label: c.displayName || c.name,
                    value: rec.getFormattedValue(c.name) || "",
                }))
                .filter((c) => c.value !== "");
            return {
                id: rec.getRecordId(),
                name,
                cells,
                taken: this.isRecordTaken(rec),
            };
        });
    }

    /** A box is "taken" when its configured swipe field holds a value. */
    private isRecordTaken(
        rec: ComponentFramework.PropertyHelper.DataSetApi.EntityRecord,
    ): boolean {
        try {
            const v = rec.getValue(this._config.swipeFieldName);
            return v !== null && v !== undefined && v !== "" && v !== false;
        } catch {
            // column not in the bound view — local optimistic state governs
            return false;
        }
    }

    private hasNextPage(dataset: Dataset): boolean {
        try {
            return dataset.paging.hasNextPage === true;
        } catch {
            return false;
        }
    }

    private loadNextPage(dataset: Dataset): void {
        try {
            if (!dataset.loading && dataset.paging.hasNextPage) {
                dataset.paging.loadNextPage();
            }
        } catch {
            // unsupported / not ready — ignore
        }
    }
}
