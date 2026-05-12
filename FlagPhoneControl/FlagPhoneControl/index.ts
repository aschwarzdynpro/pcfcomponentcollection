import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { FlagPhone } from "./components/FlagPhone";
import { lcidToLang, STRINGS } from "./components/countries";

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

    /**
     * Best-effort lookup of the current record's primary name. PCF doesn't
     * surface it directly, so we try the legacy `Xrm.Page` helper that the
     * model-driven host injects on every form. Returns `null` when called
     * outside a form context (e.g. view, dashboard, test harness).
     */
    private getCurrentRecordName(): string | null {
        try {
            const xrm = (window as unknown as { Xrm?: { Page?: { data?: {
                entity?: { getPrimaryAttributeValue?: () => string };
            } } } }).Xrm;
            const v = xrm?.Page?.data?.entity?.getPrimaryAttributeValue?.();
            return typeof v === "string" && v ? v : null;
        } catch {
            return null;
        }
    }

    /**
     * Opens the Quick-Create form for a Phone Call activity, pre-populated
     * with:
     *   - phonenumber: the dialed E.164 string
     *   - directioncode: true (Outgoing)
     *   - subject: "{Call to} {recordName}" (localized)
     *   - regardingobjectid: the current record (when on a form)
     *   - ownerid / from: the current user
     *   - to: the current record (as activityparty)
     *
     * Falls back gracefully when called outside a form context: opens the
     * form with just the phonenumber + direction pre-filled.
     */
    private async openPhoneCallQuickCreate(
        number: string,
        lang: ReturnType<typeof lcidToLang>,
    ): Promise<void> {
        const t = STRINGS[lang];
        const page = (this._context as unknown as { page?: {
            entityTypeName?: string;
            entityId?: string;
        } }).page;
        const entityName = page?.entityTypeName ?? null;
        const entityIdRaw = page?.entityId ?? null;
        const entityId = entityIdRaw ? entityIdRaw.replace(/[{}]/g, "") : null;

        const userSettings = this._context.userSettings;
        const userIdRaw = userSettings?.userId ?? "";
        const userId = userIdRaw.replace(/[{}]/g, "");
        const userName = userSettings?.userName ?? "";

        const recordName = this.getCurrentRecordName();

        const formParameters: { [key: string]: string } = {
            phonenumber: number,
            directioncode: "1", // true = outgoing
            subject: recordName
                ? `${t.callSubjectPrefix} ${recordName}`
                : t.callSubjectFallback,
        };

        // Owner = current user (standard lookup triplet)
        if (userId) {
            formParameters.ownerid = userId;
            if (userName) formParameters.owneridname = userName;
            formParameters.owneridtype = "systemuser";

            // "From" is an activityparty (partylist). The UCI Quick-Create
            // accepts a JSON-array of party references for these.
            formParameters.from = JSON.stringify([
                {
                    id: userId,
                    name: userName,
                    entityType: "systemuser",
                },
            ]);
        }

        // Regarding + To = current record
        if (entityName && entityId) {
            formParameters.regardingobjectid = entityId;
            formParameters.regardingobjectidtype = entityName;
            if (recordName) {
                formParameters.regardingobjectidname = recordName;
            }

            formParameters.to = JSON.stringify([
                {
                    id: entityId,
                    name: recordName ?? "",
                    entityType: entityName,
                },
            ]);
        }

        try {
            await this._context.navigation.openForm(
                {
                    entityName: "phonecall",
                    useQuickCreateForm: true,
                },
                formParameters,
            );
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn(
                "FlagPhoneControl: could not open Phone Call quick-create form. " +
                    "Make sure the user has create permission on the Phone Call " +
                    "entity and that a Quick-Create form is published.",
                e,
            );
        }
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
            // Click-to-Dial: opens the `tel:` URL via the host's navigation
            // API. On mobile this opens the dialer; on desktop it triggers the
            // registered tel-handler (Teams, Skype, softphone client, …).
            // When `createPhoneCallActivity` is enabled, we *also* open the
            // Phone Call activity Quick-Create form pre-filled with the
            // current user + record.
            onCall: (number: string) => {
                if (!number) return;
                try {
                    this._context.navigation.openUrl("tel:" + number);
                } catch {
                    // Fall back to a direct navigation if the host's openUrl
                    // refuses tel: (some legacy hosts).
                    window.open("tel:" + number, "_self");
                }
                if (
                    this._context.parameters.createPhoneCallActivity?.raw ===
                    true
                ) {
                    void this.openPhoneCallQuickCreate(number, lang);
                }
            },
        };

        ReactDOM.render(
            React.createElement(FlagPhone, props),
            this._container,
        );
    }
}
