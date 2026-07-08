export type Lang = "de" | "en" | "fr";

/** How already-taken boxes are presented (manifest `takenBehavior`). */
export type TakenBehavior = "hide" | "gray" | "allow-undo";

/** A single column value flattened for display (list row or overlay). */
export interface DisplayCell {
    /** Column logical name / key. */
    key: string;
    /** Localized column label (from the dataset view, or the raw key). */
    label: string;
    /** Formatted display value. */
    value: string;
}

/** A material box flattened from the bound dataset for the master list. */
export interface BoxRecord {
    id: string;
    /** Primary display name of the box. */
    name: string;
    /** The view columns to render on the row (excluding the primary name). */
    cells: DisplayCell[];
    /**
     * Whether the box is already taken according to the bound record's
     * `swipeFieldName` value (empty ⇒ not taken). May be unknown when the column
     * is not part of the bound view — then the local optimistic state governs.
     */
    taken: boolean;
}

/** A child material record shown in the long-press overlay. */
export interface MaterialRecord {
    id: string;
    /** The configured child columns, formatted for display. */
    cells: DisplayCell[];
}

/**
 * Result of one batched child fetch: box id → its materials. The count chip
 * uses the array length; the overlay reuses the same rows (no second round-trip
 * — stale-while-revalidate, see concept §5.3).
 */
export type MaterialsByBox = Map<string, MaterialRecord[]>;

/** Load state for the per-box counter chip. */
export type CountState =
    | { status: "loading" }
    | { status: "ready"; count: number }
    | { status: "error" };
