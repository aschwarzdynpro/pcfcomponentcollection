export type Lang = "de" | "en" | "fr";

/** A choice option discovered via metadata. */
export interface ChoiceOption {
    value: number;
    label: string;
    /** Hex color from option-set metadata; undefined if none was provided. */
    color?: string;
}

/** A Kanban column derived from a status/choice option. */
export interface KanbanColumnDef {
    value: number;
    label: string;
    color: string;
}

/** A flattened card for rendering. */
export interface KanbanCardData {
    id: string;
    statusValue: number;
    title: string;
    subtitle?: string;
    description?: string;
    /** Extra columns shown as small key/value chips on the card. */
    extras: { key: string; label: string; value: string }[];
}
