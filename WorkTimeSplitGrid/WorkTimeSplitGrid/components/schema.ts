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
    /** Pay-type optionset on the subtype row (part of the worktype key). */
    payType: "sst_paytype_opt",
    /** Lookup back to the parent; filter via `_sst_roundedtimeentry_value`. */
    parentLookup: "sst_roundedtimeentry",
    parentLookupValue: "_sst_roundedtimeentry_value",
} as const;

/**
 * Work type ("Zeiterfassungsart") on the entry. The target sst_worktype is keyed
 * by the composite (paytype, timetype):
 *   paytype  ← the subtype row's sst_paytype_opt, else its name matched to the
 *              paytype option label
 *   timetype ← the original entry's sst_timetype_opt, else its sst_type text
 *              matched to the timetype option label
 */
export const WORKTYPE = {
    /** Logical name (webApi.retrieveMultipleRecords). */
    logicalName: "sst_worktype",
    /** Entity set (for @odata.bind). */
    entitySet: "sst_worktypes",
    id: "sst_worktypeid",
    title: "sst_title_str",
    payType: "sst_paytype_opt",
    timeType: "sst_timetype_opt",
    /** @odata.bind navigation property on the entry. */
    navProp: "sst_worktype_ref",
    /** Denormalized worktype title text on the entry. */
    titleStr: "sst_worktype_title_str",
} as const;

/** Timetype optionset on the entry (part of the worktype key). */
export const ENTRY_TIMETYPE = "sst_timetype_opt";

/**
 * Delivery note ("Lieferschein" / sst_timereports). In "assign" mode the grid
 * lists completed entries whose `sst_timereport` is empty and can create one
 * delivery note per work order, linking the selected entries to it.
 */
export const TIMEREPORT = {
    /** Lieferschein logical name (webApi create/update). */
    logicalName: "sst_timereports",
    /** Lieferschein entity set (for @odata.bind). */
    entitySet: "sst_timereportses",
    /** Primary name on the Lieferschein. */
    name: "sst_name",
    /** Delivery-note number (autonumber, e.g. AZN-015554) — for display. */
    number: "sst_deliverynotenumberassembly_str",
    /** Work-order lookup nav on the Lieferschein (→ msdyn_workorders). */
    workorderNav: "sst_Arbeitsauftrag",
    /** Lookup value of the Lieferschein on the entry (the "assign" filter). */
    value: "_sst_timereport_value",
    /** @odata.bind nav of the Lieferschein lookup on the entry. */
    entryNav: "sst_TimeReport",
} as const;

/** Work-order entity set (target of the Lieferschein's work-order lookup). */
export const WORKORDER_SET = "msdyn_workorders";

/** Normalize a label/name for option matching (case/space/slash-insensitive). */
export function normalizeLabel(s: string | null | undefined): string {
    return (s ?? "")
        .toLowerCase()
        .replace(/\s*\/\s*/g, "/")
        .replace(/\s+/g, " ")
        .trim();
}

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

/**
 * Resource lookup on the entry → BookableResource. Used for the resource name
 * (search) and the "My hours" filter (resource → userid = current user).
 * Verified: relationship sst_roundedtimeentry_resource, target BookableResource.
 */
export const RESOURCE_REF = {
    /** @odata.bind / $expand navigation property. */
    navProp: "sst_resource_ref",
    /** Primary name on bookableresource. */
    nameField: "name",
    /** Lookup value (bookableresource → systemuser) read from the expand. */
    userIdValue: "_userid_value",
} as const;

/**
 * Roles whose holders may toggle the "My hours" filter off (see all hours).
 * Everyone else is locked to their own hours. Includes the German label of the
 * built-in System Administrator role as a safety net for localized orgs.
 */
export const ADMIN_ROLES = [
    "System Administrator",
    "Systemadministrator",
    "SST | Dispo Teamleitung Addon",
];

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
