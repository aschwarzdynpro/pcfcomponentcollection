export type Lang = "de" | "en" | "fr";

/** A Rounded Time Entry flattened for the master list. */
export interface EntryRow {
    id: string;
    /** Primary name (project / label). */
    name: string;
    /** Formatted date for display. */
    date: string;
    /** Type text (Arbeit / Fahrzeit / …). */
    type: string;
    /** Total duration as a number (for the split guard). */
    total: number;
    /** Formatted total for display. */
    totalFormatted: string;
    /** Whether the entry is already split. */
    completed: boolean;
    /** Extra view columns surfaced as small chips. */
    extras: { key: string; label: string; value: string }[];
}

/** A work-subtype split row (editable). */
export interface SubtypeRow {
    id: string;
    /** Subtype name (Normal / Überstunden / …). */
    name: string;
    /** Current edited value as text (raw input). */
    value: string;
    /** Original persisted value (to detect changes). */
    originalValue: number;
}
