// Runtime token substitution for the maker-defined `additionalFilter`
// property. Supported scopes:
//
//   {record.<column>}  — value of `<column>` on the current form
//                        (Lookups → guid, text → string, choice → number)
//   {user.id}          — the current user's id
//   {user.bu}          — the current user's business unit id
//   {user.businessunit} — alias of `user.bu`
//
// Resolution rules:
//   - Lookups return only the GUID, without surrounding braces.
//   - If any token in the template cannot be resolved (source field empty,
//     attribute not on the form, BU lookup fails …) the caller is told
//     `complete: false` and is expected to drop the entire filter for that
//     search so we never emit syntactically broken OData like `eq `.

interface PcfWebApi {
    retrieveMultipleRecords?: (
        entityType: string,
        options: string,
        maxPageSize?: number,
    ) => Promise<{ entities: Record<string, unknown>[] }>;
}

export interface TokenContext {
    userId: string;
    webApi: PcfWebApi | undefined;
}

export interface TokenResolution {
    /** Filter string with every recognised token replaced by its value. */
    resolved: string;
    /** True if every encountered token was resolved to a non-empty value. */
    complete: boolean;
}

const TOKEN_PATTERN = /\{(record|user)\.([a-zA-Z0-9_]+)\}/g;

// Cache the business-unit id once per session: BU rarely changes mid-session
// and an extra WebAPI round-trip per keystroke is not worth it.
const BU_CACHE = new Map<string, string | null>();

function cleanGuid(g: string | null | undefined): string {
    if (!g || typeof g !== "string") return "";
    return g.replace(/[{}]/g, "");
}

interface XrmAttribute {
    getValue: () => unknown;
}

function resolveRecordAttribute(logicalName: string): string {
    const xrm = (window as unknown as {
        Xrm?: { Page?: { getAttribute?: (n: string) => XrmAttribute | null | undefined } };
    }).Xrm;
    const attr = xrm?.Page?.getAttribute?.(logicalName);
    if (!attr || typeof attr.getValue !== "function") return "";

    const value = attr.getValue();
    if (value === null || value === undefined) return "";

    // Lookup: array of EntityReference-like objects.
    if (Array.isArray(value)) {
        const first = value[0] as { id?: string } | undefined;
        return cleanGuid(first?.id);
    }

    // Scalar values.
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);

    return "";
}

async function resolveUserBu(
    userId: string,
    webApi: PcfWebApi | undefined,
): Promise<string> {
    const cleaned = cleanGuid(userId);
    if (!cleaned) return "";
    if (BU_CACHE.has(cleaned)) {
        return BU_CACHE.get(cleaned) ?? "";
    }
    if (!webApi?.retrieveMultipleRecords) {
        BU_CACHE.set(cleaned, null);
        return "";
    }
    try {
        const result = await webApi.retrieveMultipleRecords(
            "systemuser",
            `?$select=_businessunitid_value&$filter=systemuserid eq ${cleaned}`,
            1,
        );
        const row = result.entities?.[0] as
            | { _businessunitid_value?: string }
            | undefined;
        const buGuid = cleanGuid(row?._businessunitid_value);
        BU_CACHE.set(cleaned, buGuid || null);
        return buGuid;
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(
            "FuzzyLookupControl: could not resolve {user.bu} via systemuser lookup.",
            e,
        );
        BU_CACHE.set(cleaned, null);
        return "";
    }
}

async function resolveOne(
    scope: string,
    name: string,
    ctx: TokenContext,
): Promise<string> {
    if (scope === "record") {
        return resolveRecordAttribute(name);
    }
    if (scope === "user") {
        if (name === "id") return cleanGuid(ctx.userId);
        if (name === "bu" || name === "businessunit") {
            return await resolveUserBu(ctx.userId, ctx.webApi);
        }
    }
    return "";
}

export async function resolveFilterTokens(
    template: string,
    ctx: TokenContext,
): Promise<TokenResolution> {
    if (!template || !template.includes("{")) {
        return { resolved: template ?? "", complete: true };
    }

    // Pre-collect every token so we can resolve sequentially (the BU lookup
    // might do a single async fetch on first call).
    TOKEN_PATTERN.lastIndex = 0;
    const tokens = [...template.matchAll(TOKEN_PATTERN)];
    let complete = true;
    let resolved = template;

    for (const match of tokens) {
        const whole = match[0];
        const scope = match[1];
        const name = match[2];
        const value = await resolveOne(scope, name, ctx);
        if (!value) {
            complete = false;
            continue;
        }
        resolved = resolved.split(whole).join(value);
    }

    return { resolved, complete };
}
