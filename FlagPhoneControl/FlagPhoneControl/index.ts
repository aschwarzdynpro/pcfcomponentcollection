import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { FlagPhone } from "./components/FlagPhone";
import { lcidToLang } from "./components/countries";

// Module-level cache so a single round-trip serves multiple control instances
// on the same page (and survives within a session). The promise itself is the
// cache; we await it on every render so re-renders never refetch.
let userDefaultPromise: Promise<string | null> | null = null;

function pickCountryCode(rec: unknown): string | null {
    if (!rec || typeof rec !== "object") return null;
    const v = (rec as { defaultcountrycode?: unknown }).defaultcountrycode;
    return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * Pulls the current user's `usersettings.defaultcountrycode` (set in
 * Personal Options → "Country/Region Code Prefix"). Tries multiple
 * strategies because depending on the org configuration:
 *   1. `usersettingsid` may equal `systemuserid` (CRM convention) — direct
 *      retrieveRecord works.
 *   2. Or the row's PK is independent — we have to filter by the
 *      `_systemuserid_value` lookup.
 *   3. Or even that fails, in which case we fall back to RLS-restricted
 *      `retrieveMultipleRecords` and take the first row.
 *
 * Logs a single console.warn at the end if every strategy failed so a
 * maker debugging the form can see what happened.
 */
function fetchUserDefaultCountry(
    webApi: ComponentFramework.WebApi,
    userId: string | undefined,
): Promise<string | null> {
    if (userDefaultPromise) return userDefaultPromise;
    const id = (userId ?? "").replace(/[{}]/g, "");

    userDefaultPromise = (async () => {
        const errors: unknown[] = [];

        if (id) {
            try {
                const rec = await webApi.retrieveRecord(
                    "usersettings",
                    id,
                    "?$select=defaultcountrycode",
                );
                const code = pickCountryCode(rec);
                if (code) return code;
            } catch (e) {
                errors.push(e);
            }

            try {
                const result = await webApi.retrieveMultipleRecords(
                    "usersettings",
                    `?$select=defaultcountrycode&$filter=_systemuserid_value eq ${id}&$top=1`,
                );
                const rec = (result as { entities?: unknown[] }).entities?.[0];
                const code = pickCountryCode(rec);
                if (code) return code;
            } catch (e) {
                errors.push(e);
            }
        }

        try {
            const result = await webApi.retrieveMultipleRecords(
                "usersettings",
                "?$select=defaultcountrycode&$top=1",
            );
            const rec = (result as { entities?: unknown[] }).entities?.[0];
            const code = pickCountryCode(rec);
            if (code) return code;
        } catch (e) {
            errors.push(e);
        }

        if (errors.length > 0) {
            // eslint-disable-next-line no-console
            console.warn(
                "FlagPhoneControl: could not read usersettings.defaultcountrycode — " +
                    "falling back to LCID-derived default. " +
                    "Errors:",
                errors,
            );
        }
        return null;
    })();

    return userDefaultPromise;
}

export class FlagPhoneControl
    implements ComponentFramework.StandardControl<IInputs, IOutputs>
{
    private _container: HTMLDivElement;
    private _context: ComponentFramework.Context<IInputs>;
    private _notifyOutputChanged: () => void;

    private _value: string = "";
    private _userDefaultCountry: string | null = null;

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

        // Kick off the user-settings fetch. The first render uses the
        // LCID-derived fallback; once the user's `defaultcountrycode`
        // arrives we re-render with that.
        fetchUserDefaultCountry(
            context.webAPI,
            context.userSettings?.userId,
        ).then((v) => {
            if (v !== this._userDefaultCountry) {
                this._userDefaultCountry = v;
                this.render();
            }
        });

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
        const userSettings = this._context.userSettings;

        const lang = lcidToLang(userSettings?.languageId);

        const props = {
            value: this._value,
            defaultCountry: this._context.parameters.defaultCountry?.raw ?? null,
            userDefaultCountry: this._userDefaultCountry,
            languageId: userSettings?.languageId ?? null,
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
