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
import { clientHighlight } from "./highlight";

export interface SearchOptions {
    term: string;
    targetEntity: string;
    columns: string[];      // ordered, includes primaryName as first element
    primaryName: string;
    pageSize: number;
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

/**
 * Build the Lucene query string. Two transforms per token:
 *
 *   - prefix wildcard `token*` — gives the typeahead UX users expect
 *     (`nym` matches `Nymphenburg`). Without this, Lucene only matches
 *     exact whole-word tokens in the index.
 *   - fuzzy `token~` (edit distance up to 2) for tokens ≥ 4 chars — gives
 *     typo tolerance (`mitcrosoft~` matches `microsoft`). Skipped for short
 *     tokens because fuzzy on 2–3 chars matches almost anything.
 *
 * Both forms are combined with Lucene's default OR so a record matches via
 * either path. Tokens are space-joined which Lucene interprets as OR as well.
 */
function buildLuceneQuery(term: string): string {
    const tokens = term.trim().split(/\s+/).filter((t) => t.length > 0);
    return tokens
        .map((t) => {
            const escaped = escapeLucene(t);
            return t.length >= 4
                ? `(${escaped}* OR ${escaped}~)`
                : `${escaped}*`;
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

async function runSearchQuery(
    opts: SearchOptions,
): Promise<LookupRecord[]> {
    const lucene = buildLuceneQuery(opts.term);
    if (!lucene) return [];

    const entities = [
        {
            Name: opts.targetEntity,
            SelectColumns: opts.columns,
            SearchColumns: opts.columns,
        },
    ];

    const body = {
        search: lucene,
        entities: JSON.stringify(entities),
        top: opts.pageSize,
        options: JSON.stringify({
            querytype: "lucene",
            besteffortsearchenabled: "true",
        }),
    };

    const url = `${getClientUrl()}/api/data/v9.2/searchquery`;
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
    return items.map((it) => {
        const columns = flattenAttributes(it.Attributes ?? {}, opts.columns);
        const highlightsRaw = it.Highlights ?? {};
        const highlights: Record<string, string> = {};
        for (const col of opts.columns) {
            const hit = highlightsRaw[col]?.[0];
            if (hit) highlights[col] = hit;
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

    const safe = escapeOData(term);
    const filter = opts.columns
        .map((c) => `contains(${c},'${safe}')`)
        .join(" or ");
    const select = opts.columns.join(",");
    const query =
        `?$select=${encodeURIComponent(select)}` +
        `&$filter=${encodeURIComponent(filter)}` +
        `&$top=${opts.pageSize}`;

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
        return { records, source: "search" };
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
