import { ChoiceOption, KanbanColumnDef } from "./types";

/** Default palette used when option-set metadata doesn't provide a color. */
const FALLBACK_PALETTE = [
    "#0f6cbd", // blue
    "#107c10", // green
    "#ca5010", // orange
    "#7719aa", // purple
    "#c50f1f", // red
    "#038387", // teal
    "#8764b8", // violet
    "#605e5c", // neutral
];

/**
 * Picks a readable foreground (black or white) for a given background hex.
 * Uses YIQ contrast — works well for the saturated colors choice metadata
 * tends to return.
 */
export function readableForeground(hex: string): string {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return "#ffffff";
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 0xff;
    const g = (n >> 8) & 0xff;
    const b = n & 0xff;
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 160 ? "#1f1f1f" : "#ffffff";
}

/**
 * Best-effort retrieval of choice options for a status column.
 *
 * 1. Try `context.utils.getEntityMetadata(entity, [column])` — the supported
 *    PCF API. Returns localized labels and (where set) colors.
 * 2. If that throws or returns nothing useful, the caller should fall back
 *    to deriving columns from the actual record values.
 */
export async function fetchChoiceOptions(
    utils: ComponentFramework.Utility,
    entityName: string,
    columnName: string,
): Promise<ChoiceOption[]> {
    // PCF's typings for getEntityMetadata are loose; the actual return is a
    // runtime object with Attributes accessible via getByName(...).
    const md: any = await utils.getEntityMetadata(entityName, [columnName]);
    const attr =
        md?.Attributes?.getByName?.(columnName) ??
        md?.Attributes?.get?.(columnName) ??
        md?.Attributes?.[columnName];
    if (!attr) return [];

    // Status columns expose OptionSet on the StatusAttributeMetadata; choice
    // columns expose it directly.
    const optionSet = attr.OptionSet ?? attr.optionSet;
    const options =
        optionSet?.Options ?? optionSet?.options ?? attr.Options ?? [];
    if (!Array.isArray(options)) return [];

    return options.map((o: any) => {
        const label =
            o.Label?.UserLocalizedLabel?.Label ??
            o.Label?.UserLocalizedLabel?.label ??
            o.label ??
            (typeof o.Label === "string" ? o.Label : null) ??
            String(o.Value ?? o.value);
        const value = Number(o.Value ?? o.value);
        const color: string | undefined = o.Color ?? o.color ?? undefined;
        return { value, label, color };
    });
}

/** Convert raw choice options into Kanban columns with a guaranteed color. */
export function optionsToColumns(options: ChoiceOption[]): KanbanColumnDef[] {
    return options.map((o, i) => ({
        value: o.value,
        label: o.label,
        color: o.color || FALLBACK_PALETTE[i % FALLBACK_PALETTE.length],
    }));
}

/**
 * Fallback: derive columns from the actual record values on the dataset.
 * Used when getEntityMetadata isn't available (e.g. unsupported context) or
 * doesn't surface OptionSet data.
 */
export function deriveColumnsFromRecords(
    dataset: ComponentFramework.PropertyTypes.DataSet,
    statusColumn: string,
): KanbanColumnDef[] {
    const seen = new Map<number, string>();
    for (const id of dataset.sortedRecordIds) {
        const record = dataset.records[id];
        const value = record.getValue(statusColumn);
        if (value == null) continue;
        const num = Number(value);
        if (Number.isNaN(num)) continue;
        if (!seen.has(num)) {
            const formatted = record.getFormattedValue(statusColumn);
            seen.set(num, formatted || String(num));
        }
    }
    return [...seen.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([value, label], i) => ({
            value,
            label,
            color: FALLBACK_PALETTE[i % FALLBACK_PALETTE.length],
        }));
}
