import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { BarcodeScanButton } from "./components/BarcodeScanControl";
import { lcidToLang, STRINGS } from "./components/i18n";

/** Appearance defaults when the maker leaves the inputs empty. */
const DEFAULTS = {
    fillColor: "#0F6CBD",
    textColor: "#FFFFFF",
    fontSize: 16,
};

/**
 * The host's Device API. Typed loosely on purpose: `getBarcodeValue` is only
 * present in Power Apps Mobile, and we want a clean "not available" instead of
 * a TypeError in Studio or the browser player.
 */
interface DeviceApi {
    getBarcodeValue?: () => Promise<string>;
}

/**
 * Turn whatever the scanner rejected with into a short text. The native
 * scanner rejects on a user cancel too; we don't want to shout "error" for
 * that, so callers check `isCancel()` first.
 */
function describe(e: unknown): string {
    if (!e) return "";
    if (typeof e === "string") return e;
    const o = e as { message?: unknown; errorCode?: unknown; code?: unknown };
    if (typeof o.message === "string" && o.message) return o.message;
    if (o.errorCode !== undefined) return String(o.errorCode);
    if (o.code !== undefined) return String(o.code);
    try {
        return JSON.stringify(e);
    } catch {
        return String(e);
    }
}

function isCancel(e: unknown): boolean {
    const t = describe(e).toLowerCase();
    return t.indexOf("cancel") >= 0 || t.indexOf("abgebrochen") >= 0;
}

export class BarcodeScanControl
    implements ComponentFramework.StandardControl<IInputs, IOutputs>
{
    private _container: HTMLDivElement;
    private _context: ComponentFramework.Context<IInputs>;
    private _notifyOutputChanged: () => void;

    // Output state. Kept on the instance (not in React) so getOutputs() can
    // answer synchronously whenever the host asks.
    private _value = "";
    private _scanCount = 0;
    private _errorMessage = "";
    private _busy = false;

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        _state: ComponentFramework.Dictionary,
        container: HTMLDivElement,
    ): void {
        this._context = context;
        this._notifyOutputChanged = notifyOutputChanged;
        this._container = container;
        container.classList.add("bsc-host");
        this.render();
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this._context = context;
        this.render();
    }

    public getOutputs(): IOutputs {
        return {
            value: this._value,
            scanCount: this._scanCount,
            errorMessage: this._errorMessage,
        };
    }

    public destroy(): void {
        ReactDOM.unmountComponentAtNode(this._container);
    }

    /** Opens the native scanner and publishes the result through the outputs. */
    private scan = (): void => {
        if (this._busy) return;

        const lang = lcidToLang(this._context.userSettings?.languageId);
        const s = STRINGS[lang];
        const device = (this._context as unknown as { device?: DeviceApi }).device;

        if (!device || typeof device.getBarcodeValue !== "function") {
            this._errorMessage = s.notAvailable;
            this._notifyOutputChanged();
            this.render();
            return;
        }

        this._busy = true;
        this.render();

        let promise: Promise<string>;
        try {
            promise = device.getBarcodeValue();
        } catch (e) {
            promise = Promise.reject(e);
        }

        promise.then(
            (raw) => {
                const text = (raw ?? "").toString().trim();
                if (text) {
                    this._value = text;
                    this._scanCount += 1;
                    this._errorMessage = "";
                } else {
                    // Scanner closed without a code — treat like a cancel.
                    this._errorMessage = "";
                }
            },
            (e) => {
                this._errorMessage = isCancel(e) ? "" : s.failed(describe(e));
            },
        ).then(() => {
            this._busy = false;
            this._notifyOutputChanged();
            this.render();
        });
    };

    private render(): void {
        const context = this._context;
        const lang = lcidToLang(context.userSettings?.languageId);
        const s = STRINGS[lang];
        const p = context.parameters;

        // Fill the space the host allocates (canvas sets Width/Height on the
        // control; allocatedHeight is -1 when it doesn't).
        const h = context.mode?.allocatedHeight;
        if (typeof h === "number" && h > 0) {
            this._container.style.height = `${h}px`;
        }

        const caption = (p.buttonText?.raw ?? "").trim() || s.scan;
        const fillColor = (p.fillColor?.raw ?? "").trim() || DEFAULTS.fillColor;
        const textColor = (p.textColor?.raw ?? "").trim() || DEFAULTS.textColor;
        const fontSizeRaw = p.fontSize?.raw;
        const fontSize =
            typeof fontSizeRaw === "number" && fontSizeRaw > 0
                ? fontSizeRaw
                : DEFAULTS.fontSize;

        ReactDOM.render(
            React.createElement(BarcodeScanButton, {
                caption,
                busyCaption: s.busy,
                fillColor,
                textColor,
                fontSize,
                busy: this._busy,
                disabled: !!context.mode?.isControlDisabled,
                onScan: this.scan,
            }),
            this._container,
        );
    }
}
