// Dataverse Search ("searchquery") wrapper with an OData fallback.
//
// Primary path:    POST {clientUrl}/api/data/v9.2/searchquery
//                  using Lucene query type with trailing `~` for fuzzy matching
//                  (edit distance up to 2). One round-trip returns every
//                  configured column (including @OData.Community.Display.V1.FormattedValue
//                  for lookup / option-set / date attributes) plus highlights.
//
// Fallback path:   context.webAPI.retrieveMultipleRecords with an OData
//                  $filter that ORs `contains(<col>, '<term>')` across every
//                  configured column. Triggered when Dataverse Search is not
//                  enabled in the environment or the target table is not
//                  search-indexed (HTTP 4xx / 5xx response from searchquery).

import type { LookupRecord } from "./types";
import { clientHighlight, crmhitToHtml } from "./highlight";

export interface SearchOptions {
    term: string;
    targetEntity: string;
    columns: string[];      // ordered, includes primaryName as first element
    primaryName: string;
    pageSize: number;
    /** Pre-resolved OData filter (tokens already substituted by the caller).
     * Applied via `entities[].filter` on searchquery and AND-joined with the
     * `contains()` filter on the OData fallback path. */
    additionalFilter?: string;
    signal?: AbortSignal;
}

export interface SearchOutcome {
    records: LookupRecord[];
    source: "search" | "odata";
    // Set when the search path failed and we degraded to OData. The UI can
    // surface this to the maker as a configuration hint.
    fallbackReason?: string;
}

interface SearchQueryResponse {
    response: string; // escaped JSON
}

interface SearchValueItem {
    Id: string;
    EntityName: string;
    Attributes: Record<string, unknown>;
    Highlights?: Record<string, string[]>;
    Score?: number;
}

interface SearchValueEnvelope {
    Error?: { code?: string; message?: string } | null;
    Value?: SearchValueItem[];
}

function getClientUrl(): string {
    const xrm = (window as unknown as {
        Xrm?: {
            Utility?: { getGlobalContext?: () => { getClientUrl: () => string } };
        };
    }).Xrm;
    const fromXrm = xrm?.Utility?.getGlobalContext?.().getClientUrl();
    if (fromXrm) return fromXrm.replace(/\/$/, "");
    // Test-harness or non-UCI host — fall back to the page origin.
    return window.location.origin;
}

// Lucene reserves these characters; we escape them in the user's search term
// so it is treated as literal text. The trailing `~` we append ourselves is
// preserved by inserting it *after* escaping.
const LUCENE_SPECIAL = /[+\-&|!(){}[\]^"~*?:\\/]/g;
function escapeLucene(term: string): string {
    return term.replace(LUCENE_SPECIAL, "\\$&");
}

// Java/Lucene regex meta characters. Inside a Lucene regex (`/.../`) the
// parser delegates to Java's regex grammar — so we escape *its* meta chars,
// not Lucene query meta chars. Without this, a literal "(" in a search term
// would be parsed as a regex group opener inside the `/.../` block.
//
// Every meta is individually backslash-escaped inside the character class
// because TypeScript's lexer can misinterpret an unescaped `${` inside a
// regex literal as a template-interpolation opener.
const REGEX_SPECIAL = /[\\\^\$\.\*\+\?\(\)\[\]\{\}\|]/g;
function escapeRegex(s: string): string {
    return s.replace(REGEX_SPECIAL, "\\$&");
}

/**
 * Build the Lucene query string. Each token gets up to three matching
 * strategies OR-joined inside its own group, and the groups are
 * AND-joined at the top level by `searchmode: "all"` (set in the
 * caller's options blob).
 *
 *   1. PREFIX WILDCARD `token*` -- typeahead UX
 *      (`nym*` matches `Nymphenburg`).
 *   2. FUZZY `token~` (edit distance up to 2) for tokens of 4+ chars --
 *      typo tolerance (`mitcrosoft~` matches `microsoft`). Skipped for
 *      short tokens because fuzzy on 2-3 chars matches almost anything.
 *   3. INFIX REGEX `/.<*>token.<*>/` -- substring match anywhere in an
 *      indexed token. This is the one that catches cases like searching
 *      `810` and expecting it to find the product number `15012810`,
 *      where prefix alone would fail (the token `15012810` doesn't
 *      *start* with `810`). Without this, multi-token queries that
 *      mix a prefix-friendly name token with a substring-of-id token
 *      (e.g. `ny 810`) returned 0 results via Search while OData's
 *      `contains()` found them -- confusing UX where the OData fallback
 *      kicked in and the user saw a "Search unavailable" banner.
 *
 * Performance note: leading wildcards / regex are flagged by Lucene
 * docs as slow on huge indexes. In practice, with our typical typeahead
 * payload (single entity, additionalFilter narrowing first, top 25-50),
 * Azure AI Search returns in well under a second.
 */
function buildLuceneQuery(term: string): string {
    const tokens = term.trim().split(/\s+/).filter((t) => t.length > 0);
    return tokens
        .map((t) => {
            const lit = escapeLucene(t);
            const re = escapeRegex(t);
            const clauses: string[] = [`${lit}*`];
            if (t.length >= 4) clauses.push(`${lit}~`);
            clauses.push(`/.*${re}.*/`);
            return `(${clauses.join(" OR ")})`;
        })
        .join(" ");
}

function flattenAttributes(
    attrs: Record<string, unknown>,
    columns: string[],
): Record<string, string> {
    const out: Record<string, string> = {};
    for (const col of columns) {
        const formattedKey = `${col}@OData.Community.Display.V1.FormattedValue`;
        const formatted = attrs[formattedKey];
        if (typeof formatted === "string") {
            out[col] = formatted;
            continue;
        }
        const raw = attrs[col];
        if (raw === null || raw === undefined) {
            out[col] = "";
        } else if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
            out[col] = String(raw);
        } else {
            out[col] = "";
        }
    }
    return out;
}

/**
 * Translate a maker-authored OData $filter expression into the dialect the
 * Dataverse `searchquery` action actually expects. The official docs imply
 * the two are identical; empirically (verified against a real Dual-Write
 * env, see project memory) they differ in two ways for lookup FKs:
 *
 *   1. **Column name**: must be the lookup's plain logical name, NOT the
 *      OData `_<col>_value` annotation. `_msdyn_companyid_value eq …`
 *      returns 200 OK with the filter silently ignored.
 *   2. **GUID literal**: must be wrapped in single quotes. Bare GUIDs cause
 *      HTTP 400 `0x80048d0b "invalid expression in the search query"`.
 *
 * Also worth noting (we don't rewrite for this, but document it):
 *   - The `not` operator is rejected; use `ne` instead.
 *   - Not every searchable column is filterable; if your filter silently
 *     returns 0 the column may not be marked filterable in the search index.
 */
function odataFilterToSearchFilter(filter: string): string {
    return filter
        // Step 1: `_xxx_value` → `xxx`. Word-boundary anchored so we don't
        // mangle unrelated identifiers that happen to contain "_value".
        .replace(/\b_([a-zA-Z][a-zA-Z0-9_]*?)_value\b/g, "$1")
        // Step 2: wrap bare GUIDs in single quotes. Skip GUIDs that are
        // already quoted (the maker quoted them manually, or a previous
        // pass through this function already did).
        .replace(
            /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
            (guid, offset: number, full: string) => {
                const before = full[offset - 1];
                const after = full[offset + guid.length];
                if (before === "'" && after === "'") return guid;
                return `'${guid}'`;
            },
        );
}

async function runSearchQuery(
    opts: SearchOptions,
): Promise<LookupRecord[]> {
    const lucene = buildLuceneQuery(opts.term);
    if (!lucene) return [];

    const searchFilter = opts.additionalFilter
        ? odataFilterToSearchFilter(opts.additionalFilter)
        : undefined;

    const entities = [
        {
            Name: opts.targetEntity,
            SelectColumns: opts.columns,
            SearchColumns: opts.columns,
            ...(searchFilter ? { Filter: searchFilter } : {}),
        },
    ];

    const body = {
        search: lucene,
        entities: JSON.stringify(entities),
        top: opts.pageSize,
        options: JSON.stringify({
            querytype: "lucene",
            besteffortsearchenabled: "true",
            // Force every Lucene token to match (across all searched
            // columns, but each token must be present *somewhere*). Default
            // is `any` which OR-joins terms, so "NYM 2211" would surface
            // every record containing either token. `all` is the user's
            // expectation: "NYM 2211" returns rows where both fragments
            // appear, regardless of which column each fragment is in.
            searchmode: "all",
        }),
    };

    const url = `${getClientUrl()}/api/data/v9.2/searchquery`;
    // eslint-disable-next-line no-console
    console.log("FuzzyLookupControl searchquery →", {
        url,
        target: opts.targetEntity,
        term: opts.term,
        lucene,
        columns: opts.columns,
        filterOData: opts.additionalFilter ?? "(none)",
        filterApplied: searchFilter ?? "(none)",
    });
    const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        signal: opts.signal,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Accept": "application/json",
            "OData-MaxVersion": "4.0",
            "OData-Version": "4.0",
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
            `searchquery returned ${res.status}: ${text.slice(0, 200)}`,
        );
    }

    const envelope = (await res.json()) as SearchQueryResponse;
    if (!envelope?.response) return [];
    const inner = JSON.parse(envelope.response) as SearchValueEnvelope;
    if (inner.Error) {
        throw new Error(
            `searchquery error: ${inner.Error.code ?? ""} ${inner.Error.message ?? ""}`.trim(),
        );
    }

    const items = inner.Value ?? [];
    // eslint-disable-next-line no-console
    console.log(
        `FuzzyLookupControl searchquery ← ${items.length} result(s)`,
        items.slice(0, 3).map((i) => ({ id: i.Id, name: i.EntityName, score: i.Score, attrs: i.Attributes })),
    );
    return items.map((it) => {
        const columns = flattenAttributes(it.Attributes ?? {}, opts.columns);
        const highlightsRaw = it.Highlights ?? {};
        const highlights: Record<string, string> = {};
        for (const col of opts.columns) {
            const hit = highlightsRaw[col]?.[0];
            // Convert `{crmhit}…{/crmhit}` annotations to HTML-safe `<mark>`
            // before storing, so the renderer can drop the string into
            // `dangerouslySetInnerHTML` without re-processing.
            if (hit) highlights[col] = crmhitToHtml(hit);
        }
        return {
            id: it.Id,
            entityName: it.EntityName ?? opts.targetEntity,
            primaryName: columns[opts.primaryName] ?? "",
            columns,
            highlights,
            score: it.Score,
        } satisfies LookupRecord;
    });
}

/**
 * Single-quote OData literals must double-up apostrophes. (`O'Reilly` → `O''Reilly`.)
 */
function escapeOData(term: string): string {
    return term.replace(/'/g, "''");
}

interface PcfWebApi {
    retrieveMultipleRecords: (
        entityType: string,
        options: string,
        maxPageSize?: number,
    ) => Promise<{ entities: Record<string, unknown>[] }>;
}

async function runODataFallback(
    webApi: PcfWebApi,
    opts: SearchOptions,
): Promise<LookupRecord[]> {
    const term = opts.term.trim();
    if (!term) return [];

    // Split the search term on whitespace into tokens and require every
    // token to be present in at least one configured column. Within a
    // token we OR across columns ("NYM" matches in either name or
    // productnumber); across tokens we AND, so "NYM 2211" requires both
    // "NYM" and "2211" to land somewhere — even if they live in different
    // columns of the same row. That makes the cross-column UX behave the
    // way users naturally expect: typing the lookup name from one column
    // and the productnumber from another column still narrows down to the
    // expected record.
    const tokens = term.split(/\s+/).filter((t) => t.length > 0);
    const tokenClauses = tokens.map((token) => {
        const safe = escapeOData(token);
        const perColumn = opts.columns
            .map((c) => `contains(${c},'${safe}')`)
            .join(" or ");
        return `(${perColumn})`;
    });
    const containsFilter = tokenClauses.join(" and ");
    // AND-join the user-defined filter (already token-resolved) with the
    // contains() filter so both constraints must match.
    const filter = opts.additionalFilter
        ? `(${containsFilter}) and (${opts.additionalFilter})`
        : containsFilter;
    const select = opts.columns.join(",");
    const query =
        `?$select=${encodeURIComponent(select)}` +
        `&$filter=${encodeURIComponent(filter)}` +
        `&$top=${opts.pageSize}`;

    // eslint-disable-next-line no-console
    console.log("FuzzyLookupControl OData fallback →", {
        target: opts.targetEntity,
        filter,
    });
    const result = await webApi.retrieveMultipleRecords(
        opts.targetEntity,
        query,
        opts.pageSize,
    );

    return (result.entities ?? []).map((row) => {
        const idKey = `${opts.targetEntity}id`;
        const idValue = row[idKey];
        const id = typeof idValue === "string" ? idValue : "";
        const columns: Record<string, string> = {};
        const highlights: Record<string, string> = {};
        for (const col of opts.columns) {
            const formatted = row[`${col}@OData.Community.Display.V1.FormattedValue`];
            const raw = row[col];
            const display =
                typeof formatted === "string"
                    ? formatted
                    : raw === null || raw === undefined
                        ? ""
                        : String(raw);
            columns[col] = display;
            highlights[col] = clientHighlight(display, term);
        }
        return {
            id,
            entityName: opts.targetEntity,
            primaryName: columns[opts.primaryName] ?? "",
            columns,
            highlights,
        } satisfies LookupRecord;
    });
}

export async function searchRecords(
    webApi: PcfWebApi,
    opts: SearchOptions,
): Promise<SearchOutcome> {
    if (!opts.term.trim()) {
        return { records: [], source: "search" };
    }
    if (!opts.targetEntity) {
        // No target table — would only produce an "Entity name is null" UCI
        // error in the OData fallback. Caller already logs why; just return
        // empty so the dropdown shows "No matches" instead of throwing.
        return { records: [], source: "search" };
    }
    try {
        const records = await runSearchQuery(opts);
        if (records.length > 0) {
            return { records, source: "search" };
        }
        // Search returned 0 cleanly (HTTP 200, no Error in envelope). We
        // trust that answer: don't probe OData as a "rescue", because doing
        // so surfaces the misleading "Dataverse Search unavailable" banner
        // when in fact Search was reachable and said "nothing matches your
        // query". The OData fallback still fires below when searchquery
        // THROWS (HTTP error, network blip, malformed envelope) — that's
        // the legitimate "search degraded" case where the banner is
        // honest.
        return { records: [], source: "search" };
    } catch (e) {
        if ((e as { name?: string }).name === "AbortError") throw e;
        const reason = e instanceof Error ? e.message : String(e);
        // eslint-disable-next-line no-console
        console.warn(
            "FuzzyLookupControl: Dataverse Search failed, falling back to OData contains(). " +
                "Reason: " +
                reason,
        );
        const records = await runODataFallback(webApi, opts);
        return { records, source: "odata", fallbackReason: reason };
    }
}
