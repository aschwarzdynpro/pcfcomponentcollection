// Shared types used across services and components.

export interface LookupRecord {
    id: string;
    entityName: string;
    primaryName: string;
    // Logical-name → display string. Values are pre-formatted (the Dataverse
    // Search response's `…@OData.Community.Display.V1.FormattedValue` is
    // preferred over the raw value when available).
    columns: Record<string, string>;
    // Logical-name → highlighted display string (contains `<mark>…</mark>`
    // around the fragment that matched the search term). Filled by the search
    // service; empty for favorites / MRU.
    highlights: Record<string, string>;
    // Higher = more relevant. Optional; populated by Dataverse Search.
    score?: number;
}

export type SuggestionSectionKind = "favorites" | "recent" | "results";

export interface SuggestionSection {
    kind: SuggestionSectionKind;
    items: LookupRecord[];
}

export interface SuggestionsProvider {
    /**
     * Returns the sections to render in the dropdown for the given term.
     * Multiple providers can be composed by the consumer (e.g. favorites +
     * recent + search). Empty `term` is valid: providers may surface
     * "browse" defaults.
     */
    getSuggestions(term: string, signal?: AbortSignal): Promise<SuggestionSection[]>;
}
