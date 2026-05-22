// Dataverse Search returns highlighted fragments wrapped in `{crmhit}…{/crmhit}`
// instead of HTML so the value is transport-safe. We translate them into
// `<mark>` tags for rendering, escaping every other character so we never
// re-introduce markup from user-controlled data.

const HIT_OPEN = "{crmhit}";
const HIT_CLOSE = "{/crmhit}";

const HTML_ESCAPES: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
};

function escapeHtml(input: string): string {
    return input.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/**
 * Convert a `{crmhit}…{/crmhit}` annotated string into HTML where each hit is
 * wrapped in `<mark>`. Returns an HTML-safe string suitable for
 * `dangerouslySetInnerHTML`.
 */
export function crmhitToHtml(input: string | null | undefined): string {
    if (!input) return "";
    let out = "";
    let i = 0;
    while (i < input.length) {
        const open = input.indexOf(HIT_OPEN, i);
        if (open < 0) {
            out += escapeHtml(input.slice(i));
            break;
        }
        out += escapeHtml(input.slice(i, open));
        const close = input.indexOf(HIT_CLOSE, open + HIT_OPEN.length);
        if (close < 0) {
            // Malformed — treat the rest as literal text.
            out += escapeHtml(input.slice(open));
            break;
        }
        const hit = input.slice(open + HIT_OPEN.length, close);
        out += "<mark>" + escapeHtml(hit) + "</mark>";
        i = close + HIT_CLOSE.length;
    }
    return out;
}

/**
 * Client-side highlighter for the OData fallback path. Wraps every
 * case-insensitive occurrence of `term` in `<mark>`. Returns HTML-safe output.
 */
export function clientHighlight(
    value: string | null | undefined,
    term: string,
): string {
    if (!value) return "";
    if (!term) return escapeHtml(value);
    const lower = value.toLowerCase();
    const needle = term.toLowerCase();
    let out = "";
    let i = 0;
    while (i < value.length) {
        const hit = lower.indexOf(needle, i);
        if (hit < 0) {
            out += escapeHtml(value.slice(i));
            break;
        }
        out += escapeHtml(value.slice(i, hit));
        out += "<mark>" + escapeHtml(value.slice(hit, hit + needle.length)) + "</mark>";
        i = hit + needle.length;
    }
    return out;
}
