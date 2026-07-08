import { TakenBehavior } from "./types";

/**
 * Configurable per-control settings, resolved from the manifest input
 * properties onto defaults.
 *
 * IMPORTANT: unlike WorkTimeSplitGrid (whose defaults are a *verified* SST
 * schema export), there is no verified material-box schema yet — these defaults
 * are PLACEHOLDERS chosen to keep the control loadable and demoable. A maker
 * MUST override `childEntityName`, `childLookupField`, `childDisplayColumns`,
 * `swipeFieldName` and `swipeFieldValue` to match the real Dataverse schema.
 * (CLAUDE.md §7: verified schema beats assumptions — confirm logical names +
 * the child entity SET name against the environment before any write.)
 */
export interface ControlConfig {
    /** Logical name of the child (material) table. */
    childEntityName: string;
    /**
     * Logical name of the lookup column on the child that points back to the
     * box. The batch query filters/groups on its value column
     * `_<childLookupField>_value`.
     */
    childLookupField: string;
    /** Child columns to show in the overlay (and select in the batch query). */
    childDisplayColumns: string[];
    /** Optional extra OData `$filter` clause, e.g. `statecode eq 0`. */
    childFilter?: string;
    /** Logical name of the box column set by the take-out action. */
    swipeFieldName: string;
    /** Raw value written by the take-out action (see `convertSwipeValue`). */
    swipeFieldValue: string;
    /** How already-taken boxes are presented. */
    takenBehavior: TakenBehavior;
}

/** Placeholder defaults — override in the maker's control configuration. */
const DEFAULTS: ControlConfig = {
    childEntityName: "sst_material",
    childLookupField: "sst_materialbox",
    childDisplayColumns: ["sst_name", "sst_quantity", "sst_unit"],
    childFilter: undefined,
    swipeFieldName: "sst_takenon",
    swipeFieldValue: "@now",
    takenBehavior: "gray",
};

const clean = (v: string | null | undefined): string | undefined => {
    const s = (v ?? "").trim();
    return s.length > 0 ? s : undefined;
};

/** Parse a CSV of column logical names into a trimmed, de-duplicated list. */
export function parseColumns(csv: string | null | undefined): string[] {
    const raw = clean(csv);
    if (!raw) return [];
    const seen = new Set<string>();
    const cols: string[] = [];
    for (const part of raw.split(",")) {
        const c = part.trim();
        if (c.length > 0 && !seen.has(c)) {
            seen.add(c);
            cols.push(c);
        }
    }
    return cols;
}

const VALID_BEHAVIORS: TakenBehavior[] = ["hide", "gray", "allow-undo"];

function toBehavior(v: string | null | undefined): TakenBehavior {
    const s = (v ?? "").trim() as TakenBehavior;
    return VALID_BEHAVIORS.indexOf(s) !== -1 ? s : DEFAULTS.takenBehavior;
}

/** Merge maker overrides onto the placeholder defaults. */
export function resolveConfig(overrides: {
    childEntityName?: string | null;
    childLookupField?: string | null;
    childDisplayColumns?: string | null;
    childFilter?: string | null;
    swipeFieldName?: string | null;
    swipeFieldValue?: string | null;
    takenBehavior?: string | null;
}): ControlConfig {
    const cols = parseColumns(overrides.childDisplayColumns);
    return {
        childEntityName:
            clean(overrides.childEntityName) ?? DEFAULTS.childEntityName,
        childLookupField:
            clean(overrides.childLookupField) ?? DEFAULTS.childLookupField,
        childDisplayColumns: cols.length > 0 ? cols : DEFAULTS.childDisplayColumns,
        childFilter: clean(overrides.childFilter),
        swipeFieldName: clean(overrides.swipeFieldName) ?? DEFAULTS.swipeFieldName,
        swipeFieldValue:
            clean(overrides.swipeFieldValue) ?? DEFAULTS.swipeFieldValue,
        takenBehavior: toBehavior(overrides.takenBehavior),
    };
}

/** The lookup value column exposed by the Web API for a lookup logical name. */
export function lookupValueColumn(lookupField: string): string {
    return `_${lookupField}_value`;
}

/**
 * Convert the raw `swipeFieldValue` string to the value written by
 * `updateRecord`. Type is inferred from the string here; a later milestone can
 * refine this against `getEntityMetadata` for exact attribute typing (§5.5).
 *   "@now"          → current ISO timestamp (DateTime)
 *   "true"/"false"  → Boolean
 *   digits          → number (OptionSet / whole number)
 *   otherwise       → text
 */
export function convertSwipeValue(raw: string): string | number | boolean {
    const v = (raw ?? "").trim();
    if (v === "@now") return new Date().toISOString();
    const low = v.toLowerCase();
    if (low === "true") return true;
    if (low === "false") return false;
    if (/^-?\d+$/.test(v)) return Number(v);
    return v;
}
