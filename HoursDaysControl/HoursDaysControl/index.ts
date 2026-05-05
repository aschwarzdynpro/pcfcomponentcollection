import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { HoursDaysInput } from "./components/HoursDaysInput";
import { lcidToLang } from "./components/strings";

const DEFAULT_HOURS_PER_DAY = 8;
const MINUTES_PER_HOUR = 60;

type StorageUnit = "hours" | "minutes";

// PCF doesn't expose the bound attribute's underlying type as a typed API, so
// we sniff the runtime metadata. For Whole.Duration columns Dataverse sets
// Format = "Duration" and stores the value in MINUTES — this lets us flip the
// conversion automatically without forcing the maker to configure a unit.
const detectStorageUnit = (
    parameter: ComponentFramework.PropertyTypes.NumberProperty,
    override: string | null | undefined,
): StorageUnit => {
    if (override === "minutes") return "minutes";
    if (override === "hours") return "hours";

    const attrs = (parameter as unknown as {
        attributes?: { Format?: string };
    }).attributes;
    if (attrs?.Format && attrs.Format.toLowerCase() === "duration") {
        return "minutes";
    }
    return "hours";
};

export class HoursDaysControl
    implements ComponentFramework.StandardControl<IInputs, IOutputs>
{
    private _container: HTMLDivElement;
    private _context: ComponentFramework.Context<IInputs>;
    private _notifyOutputChanged: () => void;

    // Internal value is always tracked in HOURS — matches what the user sees.
    // We only convert when reading from / writing to the bound parameter.
    private _hours: number | null = null;
    private _storageUnit: StorageUnit = "hours";

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        _state: ComponentFramework.Dictionary,
        container: HTMLDivElement,
    ): void {
        this._context = context;
        this._container = container;
        this._notifyOutputChanged = notifyOutputChanged;

        this._storageUnit = detectStorageUnit(
            context.parameters.totalHours,
            context.parameters.storageUnit?.raw,
        );
        this._hours = this.fromStored(context.parameters.totalHours.raw);

        container.classList.add("hdc-host");
        this.render();
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this._context = context;
        this._storageUnit = detectStorageUnit(
            context.parameters.totalHours,
            context.parameters.storageUnit?.raw,
        );
        const incoming = this.fromStored(context.parameters.totalHours.raw);
        if (incoming !== this._hours) {
            this._hours = incoming;
        }
        this.render();
    }

    public getOutputs(): IOutputs {
        const stored = this.toStored(this._hours);
        return {
            totalHours: stored === null ? undefined : stored,
        };
    }

    public destroy(): void {
        ReactDOM.unmountComponentAtNode(this._container);
    }

    private fromStored(value: number | null): number | null {
        if (value === null || value === undefined) return null;
        return this._storageUnit === "minutes"
            ? value / MINUTES_PER_HOUR
            : value;
    }

    private toStored(hours: number | null): number | null {
        if (hours === null) return null;
        if (this._storageUnit === "minutes") {
            // Round to whole minutes — Whole.Duration is an integer column.
            return Math.round(hours * MINUTES_PER_HOUR);
        }
        return Math.round(hours * 10000) / 10000;
    }

    private render(): void {
        const isDisabled = this._context.mode.isControlDisabled;
        const lang = lcidToLang(this._context.userSettings?.languageId);

        const rawHoursPerDay = this._context.parameters.hoursPerDay?.raw;
        const hoursPerDay =
            typeof rawHoursPerDay === "number" && rawHoursPerDay > 0
                ? rawHoursPerDay
                : DEFAULT_HOURS_PER_DAY;

        const props = {
            value: this._hours,
            hoursPerDay,
            disabled: isDisabled,
            lang,
            onChange: (next: number | null) => {
                if (next === this._hours) return;
                this._hours = next;
                this._notifyOutputChanged();
            },
        };

        ReactDOM.render(
            React.createElement(HoursDaysInput, props),
            this._container,
        );
    }
}
