// Quick-View-Form support for the long-press preview modal.
//
// Maker workflow:
//   1. Design a Quick View Form for the target table in Power Apps.
//   2. Copy its formid (GUID) from the URL or solution.
//   3. Paste into the FuzzyLookupControl's `previewFormId` property.
//
// Runtime:
//   - Fetch the systemform record once per session (cached by formId).
//   - Parse the FormXml into a flat field list with section breaks and
//     per-cell labels.
//   - On every long-press preview open, fetch the live record's values
//     for exactly the fields the form declares (one round-trip).
//   - Render in our existing `.flc-preview-card` modal.
//
// We deliberately do NOT iframe Microsoft's Quick View renderer
// (`/_controls/quickform/quickform.aspx`) because:
//   - it breaks under arbitrary auth contexts (Quick-Create panels,
//     dialog hosts, embedded portals);
//   - its styling clashes with our card-themed modal;
//   - it pulls an extra 200-500 kB JS bundle per open.
//
// Trade-off: we lose the form's rich client-side scripts and conditional
// formatting. For a read-only preview that's acceptable — the user can
// open the full form via the chip's hyperlink for the full experience.

/** A flat list of fields the QVF declares, in render order, with
 * section breaks woven in. Cells that don't carry a `datafieldname`
 * (e.g. spacer cells, web-resource cells) are dropped silently. */
export interface QvfField {
    /** Logical name of the field as it lives on the target entity. */
    logicalName: string;
    /** Human-readable label resolved from the form definition. Falls
     * back to a title-cased version of the logical name when the form
     * doesn't carry an explicit label for the cell. */
    label: string;
    /** Label of the section this field belongs to. The renderer can
     * group consecutive fields with the same section into a labelled
     * group; null means "no section header" (single-section forms). */
    sectionLabel: string | null;
}

export interface QuickViewForm {
    formId: string;
    /** Logical name of the entity this form is bound to. We surface it
     * so the caller can sanity-check the QVF matches the lookup's
     * target table (mismatched forms are a frequent maker error). */
    objectTypeCode: string;
    /** Fields in render order with section breaks woven in. */
    fields: QvfField[];
}

/** Live values fetched for the record being previewed. Keys are logical
 * names; values are the formatted-value string if the server provided
 * one (`@OData.Community.Display.V1.FormattedValue`), otherwise the raw
 * string representation. Missing fields are absent from the map. */
export type QvfRecordValues = Record<string, string>;

// Module-level cache for parsed QVFs. The form metadata is effectively
// static for the lifetime of a user session — the maker doesn't repackage
// the form between two long-press opens. Cached by formId so a single
// PCF host with multiple FuzzyLookupControls (different lookups, different
// QVFs) doesn't double-fetch.
const formCache = new Map<string, QuickViewForm>();

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidGuid(s: string | undefined | null): boolean {
    if (!s) return false;
    // Trim curly braces if the maker pasted the form's `{guid}` style.
    return GUID_RE.test(s.trim().replace(/[{}]/g, ""));
}

function normaliseGuid(s: string): string {
    return s.trim().replace(/[{}]/g, "").toLowerCase();
}

function getClientUrl(): string {
    const xrm = (window as unknown as {
        Xrm?: {
            Utility?: { getGlobalContext?: () => { getClientUrl: () => string } };
        };
    }).Xrm;
    const fromXrm = xrm?.Utility?.getGlobalContext?.().getClientUrl();
    if (fromXrm) return fromXrm.replace(/\/$/, "");
    return window.location.origin;
}

/**
 * Fetch a systemform record by id and parse its FormXml into a flat field
 * list. Returns null on any failure — caller falls back to default-column
 * preview behaviour. The result is cached per formId.
 *
 * We pull `type` so we can warn (but not fail) when the maker pasted
 * something other than a Quick View Form (type 6). Other form types like
 * Main (2) or Quick Create (7) would still parse their FormXml the same
 * way; we just want to flag the suspicious case for debuggability.
 */
export async function fetchQuickViewForm(
    formId: string,
): Promise<QuickViewForm | null> {
    const normalised = normaliseGuid(formId);
    const cached = formCache.get(normalised);
    if (cached) return cached;

    if (!isValidGuid(normalised)) {
        // eslint-disable-next-line no-console
        console.warn(
            "FuzzyLookupControl: previewFormId is not a valid GUID: " + formId,
        );
        return null;
    }

    try {
        const url =
            `${getClientUrl()}/api/data/v9.2/systemforms(${normalised})` +
            `?$select=formid,objecttypecode,type,formxml,name`;
        const res = await fetch(url, {
            method: "GET",
            credentials: "include",
            headers: {
                "Accept": "application/json",
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
            },
        });
        if (!res.ok) {
            // eslint-disable-next-line no-console
            console.warn(
                "FuzzyLookupControl: systemform fetch returned " +
                    res.status + " for formId " + normalised +
                    " — falling back to default preview.",
            );
            return null;
        }
        const data = (await res.json()) as {
            formid?: string;
            objecttypecode?: string;
            type?: number;
            formxml?: string;
            name?: string;
        };
        if (!data.formxml || !data.objecttypecode) {
            // eslint-disable-next-line no-console
            console.warn(
                "FuzzyLookupControl: systemform " + normalised +
                    " has no formxml/objecttypecode.",
            );
            return null;
        }
        if (data.type !== 6) {
            // eslint-disable-next-line no-console
            console.warn(
                "FuzzyLookupControl: systemform " + normalised + " (\"" +
                    (data.name ?? "?") + "\") is type " + data.type +
                    " — expected 6 (Quick View). Will try to parse anyway.",
            );
        }
        const fields = parseFormXml(data.formxml);
        const parsed: QuickViewForm = {
            formId: data.formid ?? normalised,
            objectTypeCode: data.objecttypecode,
            fields,
        };
        formCache.set(normalised, parsed);
        // eslint-disable-next-line no-console
        console.info(
            "FuzzyLookupControl: loaded Quick View Form \"" +
                (data.name ?? "?") + "\" with " + fields.length +
                " fields, bound to entity \"" + parsed.objectTypeCode + "\".",
        );
        return parsed;
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(
            "FuzzyLookupControl: failed to load Quick View Form " + normalised,
            e,
        );
        return null;
    }
}

/**
 * Parse a FormXml string into a flat ordered field list with section
 * breaks. Walk order: `form > tabs > tab > columns > column > sections >
 * section > rows > row > cell > control[@datafieldname]`. The parser is
 * defensive — any unexpected shape just yields a smaller list, never
 * throws. Empty results are valid (a form with only spacer cells).
 *
 * Label resolution prefers the `<labels><label languagecode="..."/></labels>`
 * tuple over the `description` attribute. We don't try to match the
 * user's LCID here because that would require plumbing it through; a
 * sensible default is "first label in the list" which for most environments
 * matches the form's base language.
 */
function parseFormXml(xml: string): QvfField[] {
    const out: QvfField[] = [];
    let doc: Document;
    try {
        doc = new DOMParser().parseFromString(xml, "application/xml");
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("FuzzyLookupControl: FormXml parse failed.", e);
        return out;
    }
    const parseError = doc.querySelector("parsererror");
    if (parseError) {
        // eslint-disable-next-line no-console
        console.warn(
            "FuzzyLookupControl: FormXml is malformed — " +
                (parseError.textContent ?? "").slice(0, 200),
        );
        return out;
    }

    const sections = doc.querySelectorAll("section");
    // If only one section, suppress its header — single-section forms
    // look better as a flat list without a redundant header above them.
    const suppressHeaders = sections.length <= 1;

    sections.forEach((sectionEl) => {
        const sectionLabel = suppressHeaders ? null : readLabel(sectionEl);
        const cells = sectionEl.querySelectorAll("cell");
        cells.forEach((cellEl) => {
            const control = cellEl.querySelector("control");
            const fieldName = control?.getAttribute("datafieldname");
            if (!fieldName) return; // spacer / web-resource / iframe cell
            const cellLabel = readLabel(cellEl) || titleCase(fieldName);
            out.push({
                logicalName: fieldName,
                label: cellLabel,
                sectionLabel,
            });
        });
    });

    return out;
}

function readLabel(el: Element): string {
    // Prefer the localised labels collection if present.
    const labelEl = el.querySelector(":scope > labels > label");
    const fromLabels = labelEl?.getAttribute("description");
    if (fromLabels) return fromLabels;
    // Form XML sometimes carries a top-level description attribute.
    const fromAttr = el.getAttribute("description");
    if (fromAttr) return fromAttr;
    return "";
}

function titleCase(logical: string): string {
    const stripped = logical.replace(/^[a-z]+_/, "");
    return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

/**
 * Fetch the live record values for a specific list of fields. Returns
 * `null` on failure so the caller can decide whether to fall back to
 * the search-time columns instead of showing an empty preview.
 *
 * We hit the Web API directly (not the PCF `webApi.retrieveRecord`)
 * because: (a) we want the `@OData.Community.Display.V1.FormattedValue`
 * annotations to render dates/lookups/option-sets as the user expects,
 * which the wrapper sometimes elides; (b) we want to control the
 * `Prefer` header explicitly to opt into the formatted-values feature.
 */
export async function fetchRecordValues(input: {
    entitySetName: string;
    recordId: string;
    fields: string[];
    signal?: AbortSignal;
}): Promise<QvfRecordValues | null> {
    const { entitySetName, recordId, fields, signal } = input;
    if (!entitySetName || !recordId || fields.length === 0) return null;

    const selectList = fields.map(encodeURIComponent).join(",");
    const url =
        `${getClientUrl()}/api/data/v9.2/${entitySetName}(${recordId})` +
        `?$select=${selectList}`;

    try {
        const res = await fetch(url, {
            method: "GET",
            credentials: "include",
            signal,
            headers: {
                "Accept": "application/json",
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
                // Request formatted values for lookups / option sets / dates.
                "Prefer": "odata.include-annotations=\"OData.Community.Display.V1.FormattedValue\"",
            },
        });
        if (!res.ok) {
            // eslint-disable-next-line no-console
            console.warn(
                "FuzzyLookupControl: record fetch returned " + res.status +
                    " for " + entitySetName + "(" + recordId + ").",
            );
            return null;
        }
        const data = (await res.json()) as Record<string, unknown>;
        const values: QvfRecordValues = {};
        for (const f of fields) {
            const formatted = data[`${f}@OData.Community.Display.V1.FormattedValue`];
            if (typeof formatted === "string") {
                values[f] = formatted;
                continue;
            }
            const raw = data[f];
            if (raw === null || raw === undefined) continue;
            if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
                values[f] = String(raw);
                continue;
            }
            // Complex types (rare in $select results) — JSON-stringify so
            // the preview at least shows *something* rather than dropping
            // the row. Maker can switch the QVF to a simpler field.
            try {
                values[f] = JSON.stringify(raw);
            } catch {
                /* skip */
            }
        }
        return values;
    } catch (e) {
        if ((e as { name?: string })?.name === "AbortError") throw e;
        // eslint-disable-next-line no-console
        console.warn(
            "FuzzyLookupControl: record fetch failed for " +
                entitySetName + "(" + recordId + ").",
            e,
        );
        return null;
    }
}
