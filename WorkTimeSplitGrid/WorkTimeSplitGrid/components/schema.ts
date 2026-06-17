/**
 * Single source of truth for the SST (Schulz Systemtechnik) Rounded Time Entry
 * schema this control operates on. Verified against the SSTCore solution export.
 *
 * Logical names are lower-cased schema names; @odata.bind navigation properties
 * keep their PascalCase schema name as exported by Dataverse.
 */

/** Parent table: Rounded Time Entries (the grid binds to this). */
export const PARENT = {
    /** Logical name used by webApi create/update/delete/retrieve. */
    logicalName: "sst_roundedtimeentries",
    /** OData entity set (plural) for @odata.bind targets. */
    entitySet: "sst_roundedtimeentrieses",
    primaryId: "sst_roundedtimeentriesid",
    primaryName: "sst_name",
} as const;

/** Child table: Rounded Time Entry Work Subtypes (one row per surcharge type). */
export const CHILD = {
    logicalName: "sst_roundedtimeentryworksubtypes",
    entitySet: "sst_roundedtimeentryworksubtypeses",
    primaryId: "sst_roundedtimeentryworksubtypesid",
    name: "sst_name",
    timeValue: "sst_timevalue",
    /** Lookup back to the parent; filter via `_sst_roundedtimeentry_value`. */
    parentLookup: "sst_roundedtimeentry",
    parentLookupValue: "_sst_roundedtimeentry_value",
} as const;

/**
 * Parent lookups copied onto each split record. `logical` is the `_x_value`
 * source on the original; `bind` is the @odata.bind navigation property name.
 */
export const PARENT_LOOKUPS = [
    { logical: "sst_workorder", value: "_sst_workorder_value", bind: "sst_WorkOrder" },
    {
        logical: "sst_bookableresourcebooking",
        value: "_sst_bookableresourcebooking_value",
        bind: "sst_BookableResourceBooking",
    },
    { logical: "sst_project_id", value: "_sst_project_id_value", bind: "sst_Project_id" },
] as const;

/** Work-order lookup value column — used to find the related Pause entries. */
export const WORKORDER_VALUE = "_sst_workorder_value";

/** Configurable per-control field bindings (with verified defaults). */
export interface FieldConfig {
    /** Decimal total-duration column on the parent. */
    total: string;
    /** DateTime column on the parent. */
    date: string;
    /** Text type column on the parent (Arbeit/Fahrzeit/Pause). */
    type: string;
    /** Type value that marks a break/pause (hidden from the list). */
    pauseValue: string;
    /** Boolean "already split" flag on the parent. */
    completed: string;
    /** Text column on the split record that stores the subtype name. */
    subtype: string;
    /** Free-text/notes column copied to the split records. */
    notes: string;
}

const DEFAULTS: FieldConfig = {
    total: "sst_duration",
    date: "sst_date",
    type: "sst_type",
    pauseValue: "Pause",
    completed: "sst_worksubtypecompleted",
    subtype: "sst_workordersubtype",
    notes: "sst_freitextfeld",
};

const clean = (v: string | null | undefined): string | undefined => {
    const s = (v ?? "").trim();
    return s.length > 0 ? s : undefined;
};

/** Merge maker overrides onto the verified defaults. */
export function resolveFieldConfig(overrides: {
    totalField?: string | null;
    dateField?: string | null;
    typeField?: string | null;
    pauseValue?: string | null;
    completedField?: string | null;
    subtypeField?: string | null;
}): FieldConfig {
    return {
        total: clean(overrides.totalField) ?? DEFAULTS.total,
        date: clean(overrides.dateField) ?? DEFAULTS.date,
        type: clean(overrides.typeField) ?? DEFAULTS.type,
        pauseValue: clean(overrides.pauseValue) ?? DEFAULTS.pauseValue,
        completed: clean(overrides.completedField) ?? DEFAULTS.completed,
        subtype: clean(overrides.subtypeField) ?? DEFAULTS.subtype,
        notes: DEFAULTS.notes,
    };
}

/**
 * Canonical ordering of the work subtypes (matches the Custom Page). Subtype
 * rows are sorted to this order; unknown names are appended alphabetically.
 */
export const SUBTYPE_ORDER = [
    "Normal",
    "Überstunden",
    "Nacht / Sonntag",
    "Feiertag",
];

/** Float-safe comparison for the "sum equals total" save guard. */
export const EPSILON = 0.001;
