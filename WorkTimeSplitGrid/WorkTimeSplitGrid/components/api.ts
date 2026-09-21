import {
    PARENT,
    CHILD,
    PARENT_LOOKUPS,
    COPIED_FIELDS,
    WORKORDER_VALUE,
    PROJECT_VALUE,
    WORKTYPE,
    ENTRY_TIMETYPE,
    TIMEREPORT,
    WORKORDER_SET,
    PROJECT_SET,
    PROJECT_TYPE,
    HOLIDAY,
    normalizeLabel,
    FieldConfig,
    SUBTYPE_ORDER,
} from "./schema";
import { SubtypeRow } from "./types";
import { Logger, NOOP_LOGGER, Op } from "./telemetry";

const ANNOT_LOGICALNAME = "@Microsoft.Dynamics.CRM.lookuplogicalname";

/** Cache of logical name → entity set name (for @odata.bind targets). */
const entitySetCache = new Map<string, string>();

async function entitySetFor(
    utils: ComponentFramework.Utility,
    logicalName: string,
): Promise<string | null> {
    if (entitySetCache.has(logicalName)) {
        return entitySetCache.get(logicalName) ?? null;
    }
    try {
        const md: any = await utils.getEntityMetadata(logicalName, []);
        const set: string | undefined =
            md?.EntitySetName ?? md?.entitySetName ?? undefined;
        if (set) {
            entitySetCache.set(logicalName, set);
            return set;
        }
    } catch {
        // ignore — caller falls back to skipping the lookup bind
    }
    return null;
}

/** Sort subtype rows into the canonical surcharge order. */
export function sortSubtypes<T extends { name: string }>(rows: T[]): T[] {
    const rank = (n: string) => {
        // Keyword match (not equality) — see SUBTYPE_ORDER: the naming differs
        // per environment ("Überstunde" / "Überstunden").
        const norm = normalizeLabel(n);
        const i = SUBTYPE_ORDER.findIndex((kw) => norm.indexOf(kw) !== -1);
        return i === -1 ? SUBTYPE_ORDER.length : i;
    };
    return [...rows].sort((a, b) => {
        const r = rank(a.name) - rank(b.name);
        return r !== 0 ? r : a.name.localeCompare(b.name);
    });
}

/**
 * Whether the OPTIONAL `sst_paytype_opt` column exists on the child table in this
 * environment: `null` = not probed yet, then cached for the session.
 *
 * It is not deployed everywhere — PROD lacked it while INT/UAT had it (verified
 * 2026-07-30). Dataverse rejects the ENTIRE query when a `$select` names an
 * unknown property, so a single missing optional column took the whole split
 * editor down ("Die Work Subtypes konnten nicht geladen werden"). We therefore
 * probe once and fall back to a query without it; the pay type then comes from
 * the name-match against the worktype option labels (see prepareSplit).
 */
let childPayTypeAvailable: boolean | null = null;

/**
 * Load the work-subtype rows belonging to a Rounded Time Entry.
 *
 * Loaded via the parent → children relationship (`$expand`) rather than a
 * `$filter` on the child's parent-lookup column: the relationship is scoped to
 * exactly one parent, whereas the filtered query was observed to return children
 * of MANY entries for some non-admin roles (a record-level-access quirk) — which
 * showed up as a long list of "Normal" rows in the split editor.
 */
export async function loadSubtypes(
    webApi: ComponentFramework.WebApi,
    parentId: string,
    logger: Logger = NOOP_LOGGER,
): Promise<SubtypeRow[]> {
    const id = parentId.replace(/[{}]/g, "");
    const nav = CHILD.parentCollectionNav;
    const query = (withPayType: boolean): string =>
        `?$select=${PARENT.primaryId}` +
        `&$expand=${nav}($select=${CHILD.primaryId},${CHILD.name},${CHILD.timeValue}` +
        `${withPayType ? `,${CHILD.payType}` : ""})`;

    let rec: any;
    if (childPayTypeAvailable === false) {
        rec = await webApi.retrieveRecord(PARENT.logicalName, id, query(false));
    } else {
        try {
            rec = await webApi.retrieveRecord(
                PARENT.logicalName,
                id,
                query(true),
            );
            childPayTypeAvailable = true;
        } catch (e) {
            // Retry WITHOUT the optional column. If that succeeds, the column is
            // the cause (not permissions/network) — remember it so the rest of the
            // session issues a single request. If it fails too, the error is real
            // and propagates to the caller unchanged.
            rec = await webApi.retrieveRecord(
                PARENT.logicalName,
                id,
                query(false),
            );
            if (childPayTypeAvailable === null) {
                logger.warn("subtypes.payTypeColumnMissing", {
                    column: CHILD.payType,
                    detail: serverErrorMessage(e),
                });
            }
            childPayTypeAvailable = false;
        }
    }
    const kids: any[] = Array.isArray(rec?.[nav]) ? rec[nav] : [];
    const rows: SubtypeRow[] = kids.map((e: any) => {
        const value =
            e[CHILD.timeValue] == null ? 0 : Number(e[CHILD.timeValue]);
        const pay = e[CHILD.payType];
        return {
            id: e[CHILD.primaryId] as string,
            name: (e[CHILD.name] as string) ?? "",
            value: formatNumber(value),
            originalValue: value,
            paytype: pay == null ? null : Number(pay),
        };
    });
    return sortSubtypes(rows);
}

/** Parse a (possibly German-formatted) numeric input. Returns 0 on blank/NaN. */
export function parseNumber(raw: string): number {
    const s = (raw ?? "").trim();
    if (!s) return 0;
    // Accept both "1,5" and "1.5"; strip thousands separators conservatively.
    const normalized = s.replace(/\s/g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : NaN;
}

/** Format a number for display in the input (no trailing noise). */
export function formatNumber(n: number): string {
    if (!Number.isFinite(n) || n === 0) return "";
    return String(Math.round(n * 1000) / 1000);
}

/** Hours that count as a normal workday before overtime kicks in. */
export const NORMAL_DAY_HOURS = 8;

/** Local calendar date (YYYY-MM-DD) of an ISO timestamp — matches the display. */
function localDateOnly(iso: string): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Whether the entry's date is a public holiday, resolved via the chain
 * entry → bookableresource → sst_site → sst_country, then sst_publicholiday rows
 * for that country whose [start, end] range covers the date. Best-effort: any
 * failure (missing link, no read access) returns false → treated as a workday.
 */
export async function isHolidayForEntry(
    webApi: ComponentFramework.WebApi,
    entryId: string,
    dateIso: string,
): Promise<boolean> {
    const day = localDateOnly(dateIso);
    if (!day) return false;
    try {
        const id = entryId.replace(/[{}]/g, "");
        const entry: any = await webApi.retrieveRecord(
            PARENT.logicalName,
            id,
            `?$select=${HOLIDAY.entryResourceValue}`,
        );
        const resourceId = entry?.[HOLIDAY.entryResourceValue];
        if (!resourceId) return false;
        const res: any = await webApi.retrieveRecord(
            HOLIDAY.resourceTable,
            String(resourceId),
            `?$select=${HOLIDAY.resourceSiteValue}`,
        );
        const siteId = res?.[HOLIDAY.resourceSiteValue];
        if (!siteId) return false;
        const site: any = await webApi.retrieveRecord(
            HOLIDAY.siteTable,
            String(siteId),
            `?$select=${HOLIDAY.siteCountryValue}`,
        );
        const countryId = site?.[HOLIDAY.siteCountryValue];
        if (!countryId) return false;
        const filter =
            `${HOLIDAY.countryValue} eq ${countryId}` +
            ` and ${HOLIDAY.startDate} le ${day}` +
            ` and ${HOLIDAY.endDate} ge ${day}`;
        const found = await webApi.retrieveMultipleRecords(
            HOLIDAY.table,
            `?$select=${HOLIDAY.table}id&$filter=${filter}`,
            1,
        );
        return (found.entities?.length ?? 0) > 0;
    } catch {
        return false;
    }
}

/**
 * Suggest an initial split distribution from the entry's date + total duration:
 * - Holiday  → all on Feiertag (caller passes `holiday` from isHolidayForEntry).
 * - Sunday   → all on Nacht/Sonntag.
 * - Workday ≤ 8h → all on Normal; > 8h → 8h Normal + the rest on Überstunde.
 *
 * Subtype rows are matched by keyword (robust to Überstunde/Überstunden and the
 * "Nacht / Sonntag" spelling). Returns a NEW array with the values set; rows
 * without a target (and any target whose row is missing) stay at 0, so the user
 * can still adjust and the save guard stays honest.
 */
export function suggestSplit(
    dateIso: string,
    total: number,
    rows: SubtypeRow[],
    holiday = false,
): SubtypeRow[] {
    if (!(total > 0)) return rows;
    const lc = (s: string): string => (s ?? "").toLowerCase();
    const normalRow = rows.find((r) => lc(r.name).includes("normal"));
    const overtimeRow = rows.find((r) => lc(r.name).includes("überstund"));
    const sundayRow = rows.find((r) => lc(r.name).includes("sonntag"));
    const holidayRow = rows.find((r) => lc(r.name).includes("feiertag"));

    const d = dateIso ? new Date(dateIso) : null;
    const isSunday = !!d && !isNaN(d.getTime()) && d.getDay() === 0;

    const target = new Map<string, number>(); // row.id → hours
    if (holiday) {
        if (holidayRow) target.set(holidayRow.id, total);
    } else if (isSunday) {
        if (sundayRow) target.set(sundayRow.id, total);
    } else if (total <= NORMAL_DAY_HOURS) {
        if (normalRow) target.set(normalRow.id, total);
    } else {
        if (normalRow) target.set(normalRow.id, NORMAL_DAY_HOURS);
        if (overtimeRow) {
            target.set(
                overtimeRow.id,
                Math.round((total - NORMAL_DAY_HOURS) * 1000) / 1000,
            );
        }
    }

    return rows.map((r) => ({
        ...r,
        value: formatNumber(target.get(r.id) ?? 0),
    }));
}

/**
 * True if the current user holds any of the given (directly-assigned) security
 * roles. Best-effort — returns false on error, which keeps the "My hours"
 * filter locked (the safe default). Team-assigned roles are not evaluated.
 */
export async function userHasAnyRole(
    webApi: ComponentFramework.WebApi,
    userId: string,
    roleNames: readonly string[],
): Promise<boolean> {
    const id = userId.replace(/[{}]/g, "");
    if (!id) return false;
    try {
        const u: any = await webApi.retrieveRecord(
            "systemuser",
            id,
            "?$select=systemuserid&$expand=systemuserroles_association($select=name)",
        );
        const roles: string[] = (u?.systemuserroles_association ?? []).map(
            (r: any) => String(r?.name ?? ""),
        );
        const wanted = new Set(roleNames.map((n) => n.toLowerCase()));
        return roles.some((rn) => wanted.has(rn.toLowerCase()));
    } catch {
        return false;
    }
}

/**
 * Real connectivity check, independent of the entries list. `context.webAPI` has
 * no WhoAmI, so we read the current user's own security roles: **online** returns
 * ≥1 role; **offline** the call fails (or the roles association isn't in the local
 * cache, so it comes back empty). Used to disambiguate an *empty* entries result —
 * offline mode returns "no rows" as a SUCCESS, which must not be read as "online,
 * no entries". Returns `true` (assume online, don't over-block) if there's no user
 * id to check against.
 */
export async function probeOnline(
    webApi: ComponentFramework.WebApi,
    userId: string,
): Promise<boolean> {
    const id = userId.replace(/[{}]/g, "");
    if (!id) return true;
    try {
        const u: any = await webApi.retrieveRecord(
            "systemuser",
            id,
            "?$select=systemuserid&$expand=systemuserroles_association($select=roleid)",
        );
        return (u?.systemuserroles_association?.length ?? 0) > 0;
    } catch {
        return false;
    }
}

/** A Rounded Time Entry as loaded by the server-side mode query. */
export interface LoadedEntry {
    id: string;
    name: string;
    type: string;
    /** Formatted date (day only) for display. */
    date: string;
    /** Raw sst_date (ISO) for client-side period filtering + date sorting. */
    dateValue: string;
    total: number;
    totalFormatted: string;
    completed: boolean;
    project: string;
    projectId: string;
    /** Project name (msdyn_project.msdyn_subject) — third chip line on the tile. */
    projectName: string;
    resourceName: string;
    timereport: string;
    /** Booking number (bookableresourcebooking display value, e.g. S-120044). */
    bookingNumber: string;
    /** Entry belongs to a fixed-price ("Festpreis") project → flagged in the list. */
    fixedPrice: boolean;
}

export interface LoadEntriesOptions {
    /** "split" → not-yet-split; "assign" → split + no delivery note. */
    mode: "split" | "assign";
    /** When set, restrict to entries whose resource belongs to this user. */
    resourceUserId: string | null;
    /** Type value that marks a break — excluded from both modes when set. */
    pauseValue?: string | null;
    /**
     * When true, KEEP entries on fixed-price ("Festpreis") projects, which are
     * otherwise excluded from both modes. Driven by the team-lead-only
     * "show fixed-price hours" switch; defaults to false (exclude).
     */
    includeFixedPrice?: boolean;
}

const ENTRY_FMT = "@OData.Community.Display.V1.FormattedValue";

function mapLoadedEntry(e: Record<string, any>): LoadedEntry {
    const total = e.sst_duration == null ? 0 : Number(e.sst_duration);
    const dateFmt = e[`sst_date${ENTRY_FMT}`];
    return {
        id: String(e.sst_roundedtimeentriesid ?? "").replace(/[{}]/g, ""),
        name: String(e.sst_name ?? ""),
        type: String(e.sst_type ?? ""),
        date: dateFmt ? String(dateFmt).split(" ")[0] : "",
        dateValue: String(e.sst_date ?? ""),
        total: Number.isFinite(total) ? total : 0,
        totalFormatted:
            e[`sst_duration${ENTRY_FMT}`] ??
            (Number.isFinite(total) ? String(total) : ""),
        completed: e.sst_worksubtypecompleted === true,
        project: e.sst_Project_id
            ? String(e.sst_Project_id.sst_projectnumber ?? "")
            : "",
        projectId: String(e._sst_project_id_value ?? ""),
        projectName:
            (e.sst_Project_id
                ? String(e.sst_Project_id.msdyn_subject ?? "")
                : "") ||
            String(e[`_sst_project_id_value${ENTRY_FMT}`] ?? ""),
        resourceName:
            (e.sst_resource_ref ? String(e.sst_resource_ref.name ?? "") : "") ||
            String(e[`_sst_resource_ref_value${ENTRY_FMT}`] ?? "") ||
            String(e.sst_resource ?? ""),
        timereport: String(e._sst_timereport_value ?? ""),
        bookingNumber: String(
            e[`_sst_bookableresourcebooking_value${ENTRY_FMT}`] ?? "",
        ),
        fixedPrice:
            e.sst_Project_id != null &&
            Number(e.sst_Project_id[PROJECT_TYPE.field]) ===
                PROJECT_TYPE.fixedPriceValue,
    };
}

/**
 * Load the entries for a mode directly from the server with the filter already
 * applied — replacing the previous "pull every dataset page + enrich" approach,
 * which does not scale past Dataverse's 5000-record page cap. Both modes require
 * a project; split → not completed; assign → completed and no delivery note.
 * When `resourceUserId` is set ("My hours"), restrict to that user's resource(s).
 */
export async function loadEntries(
    webApi: ComponentFramework.WebApi,
    opts: LoadEntriesOptions,
): Promise<LoadedEntry[]> {
    // "My hours": resolve the user's bookableresource(s), then filter on the
    // resource lookup value. No resource → the user has no hours to show.
    let resourceClause = "";
    if (opts.resourceUserId) {
        const uid = opts.resourceUserId.replace(/[{}]/g, "");
        let resourceIds: string[] = [];
        try {
            const rr = await webApi.retrieveMultipleRecords(
                "bookableresource",
                `?$select=bookableresourceid&$filter=_userid_value eq ${uid}`,
            );
            resourceIds = (rr.entities ?? []).map((e: any) =>
                String(e.bookableresourceid).replace(/[{}]/g, ""),
            );
        } catch {
            resourceIds = [];
        }
        if (resourceIds.length === 0) return [];
        resourceClause =
            " and (" +
            resourceIds
                .map((rid) => `_sst_resource_ref_value eq ${rid}`)
                .join(" or ") +
            ")";
    }

    const modeClause =
        opts.mode === "split"
            ? " and sst_worksubtypecompleted eq false"
            : " and sst_worksubtypecompleted eq true and _sst_timereport_value eq null";
    // Exclude breaks (sst_type = pauseValue). `ne` still keeps null-type rows.
    const pause = (opts.pauseValue ?? "").trim();
    const pauseClause = pause
        ? ` and sst_type ne '${pause.replace(/'/g, "''")}'`
        : "";
    // Exclude entries on fixed-price ("Festpreis") projects — both modes. Filter
    // on the project's hso_projecttype via the lookup navigation property; `ne`
    // keeps projects with no type set. Team leads can opt back in via
    // `includeFixedPrice`, which drops the clause entirely.
    const projectTypeClause = opts.includeFixedPrice
        ? ""
        : ` and ${PROJECT_TYPE.nav}/${PROJECT_TYPE.field}` +
          ` ne ${PROJECT_TYPE.fixedPriceValue}`;
    const filter =
        "_sst_project_id_value ne null" +
        projectTypeClause +
        modeClause +
        pauseClause +
        resourceClause;

    const query =
        `?$select=sst_roundedtimeentriesid,sst_name,sst_type,sst_date,sst_duration,sst_resource,` +
        `sst_worksubtypecompleted,_sst_project_id_value,_sst_timereport_value,_sst_resource_ref_value,` +
        `_sst_bookableresourcebooking_value` +
        `&$expand=sst_Project_id($select=sst_projectnumber,msdyn_subject,${PROJECT_TYPE.field}),` +
        `sst_resource_ref($select=name)` +
        `&$filter=${filter}&$orderby=sst_date desc`;

    const out: LoadedEntry[] = [];
    let options: string | undefined = query;
    let guard = 0;
    while (options && guard++ < 20) {
        const res: any = await webApi.retrieveMultipleRecords(
            PARENT.logicalName,
            options,
            5000,
        );
        for (const e of (res.entities ?? []) as Record<string, any>[]) {
            out.push(mapLoadedEntry(e));
        }
        // Follow server paging (rarely needed: filtered sets are small).
        const next: string | undefined = res.nextLink;
        const qi = next ? next.indexOf("?") : -1;
        options = qi >= 0 ? next!.substring(qi) : undefined;
    }
    return out;
}

export interface SplitInput {
    id: string;
    name: string;
    value: number;
    /** Pay-type option value from the subtype row (sst_paytype_opt), if set. */
    paytype: number | null;
}

/** Resolved work-type lookup tables, derived from the sst_worktype records. */
interface WorktypeMaps {
    /** "<paytype>|<timetype>" → { id, title }. */
    byKey: Map<string, { id: string; title: string }>;
    /** normalized paytype label → paytype value (name-match fallback). */
    payLabel: Map<string, number>;
    /** normalized timetype label → timetype value (name-match fallback). */
    timeLabel: Map<string, number>;
}

/**
 * Load the sst_worktype ("Zeiterfassungsart") records once and index them by the
 * composite (paytype, timetype) key, plus label→value maps for the name-match
 * fallback. Best-effort: returns empty maps on failure (no worktype is set).
 */
async function resolveWorktypes(
    webApi: ComponentFramework.WebApi,
): Promise<WorktypeMaps> {
    const maps: WorktypeMaps = {
        byKey: new Map(),
        payLabel: new Map(),
        timeLabel: new Map(),
    };
    try {
        const res = await webApi.retrieveMultipleRecords(
            WORKTYPE.logicalName,
            `?$select=${WORKTYPE.id},${WORKTYPE.title},${WORKTYPE.payType},${WORKTYPE.timeType}`,
        );
        const fmt = "@OData.Community.Display.V1.FormattedValue";
        for (const e of (res.entities ?? []) as Record<string, any>[]) {
            const pay = e[WORKTYPE.payType];
            const time = e[WORKTYPE.timeType];
            const wid = e[WORKTYPE.id];
            const title = String(e[WORKTYPE.title] ?? "");
            if (pay != null && time != null && wid) {
                maps.byKey.set(`${pay}|${time}`, { id: String(wid), title });
            }
            const payLbl = e[WORKTYPE.payType + fmt];
            if (pay != null && payLbl) {
                maps.payLabel.set(normalizeLabel(payLbl), Number(pay));
            }
            const timeLbl = e[WORKTYPE.timeType + fmt];
            if (time != null && timeLbl) {
                maps.timeLabel.set(normalizeLabel(timeLbl), Number(time));
            }
        }
    } catch {
        /* best-effort — splits are created without a worktype */
    }
    return maps;
}

export interface SaveResult {
    created: number;
}

/** Everything needed to perform the split, gathered before any mutation. */
interface SplitPrep {
    /** Create body for each split RTE (one per subtype with value > 0). */
    splitPayloads: Record<string, unknown>[];
    /** Child subtype value updates (faithful to the Custom Page). */
    subtypeUpdates: { id: string; value: number }[];
    /** Ids of related pause entries to mark completed (best-effort). */
    pauseIds: string[];
    /** Number of splits to be created. */
    activeCount: number;
}

/**
 * Read the original + resolve everything (worktypes, lookup binds, split
 * payloads, related pauses) WITHOUT mutating anything — so the mutation phase
 * can run as a single transactional batch (or a compensating sequence).
 */
async function prepareSplit(
    webApi: ComponentFramework.WebApi,
    utils: ComponentFramework.Utility,
    fields: FieldConfig,
    id: string,
    subtypes: SplitInput[],
    logger: Logger,
    /** Pre-resolved worktype maps (day split: resolve once for N entries). */
    worktypesIn?: WorktypeMaps,
): Promise<SplitPrep> {
    const lookupSelects = PARENT_LOOKUPS.map((l) => l.value).join(",");
    const selects = [
        PARENT.primaryName,
        fields.date,
        fields.type,
        fields.notes,
        ENTRY_TIMETYPE,
        WORKORDER_VALUE,
        lookupSelects,
        COPIED_FIELDS.join(","),
    ]
        .filter(Boolean)
        .join(",");
    const original: any = await webApi.retrieveRecord(
        PARENT.logicalName,
        id,
        `?$select=${selects}`,
    );

    const originalType = (original[fields.type] as string) ?? "";
    const originalName = (original[PARENT.primaryName] as string) ?? "";
    const originalDate = original[fields.date] ?? null;
    const originalNotes = original[fields.notes] ?? null;

    // Work type ("Zeiterfassungsart") per split via the composite (paytype,
    // timetype) key. timetype comes from the original's sst_timetype_opt, else
    // its sst_type text matched to the option label.
    const worktypes = worktypesIn ?? (await resolveWorktypes(webApi));
    const originalTimetypeRaw = original[ENTRY_TIMETYPE];
    const timetypeValue: number | null =
        originalTimetypeRaw != null
            ? Number(originalTimetypeRaw)
            : worktypes.timeLabel.get(normalizeLabel(originalType)) ?? null;

    // Resolve @odata.bind targets for the lookups present on the original.
    const lookupBinds: Record<string, string> = {};
    for (const lk of PARENT_LOOKUPS) {
        const targetId = original[lk.value];
        if (!targetId) continue;
        const targetLogical = original[lk.value + ANNOT_LOGICALNAME] as
            | string
            | undefined;
        if (!targetLogical) continue;
        const set = await entitySetFor(utils, targetLogical);
        if (!set) continue;
        lookupBinds[`${lk.bind}@odata.bind`] = `/${set}(${targetId})`;
    }

    // Plain columns carried over from the original — only when actually filled,
    // so a split never writes an empty string over a column the original left null.
    const copiedFields: Record<string, unknown> = {};
    for (const f of COPIED_FIELDS) {
        const v = original[f];
        if (v != null && v !== "") copiedFields[f] = v;
    }

    const active = subtypes.filter((s) => s.value > 0);
    const splitPayloads = active.map((s) => {
        const payload: Record<string, unknown> = {
            [fields.subtype]: s.name,
            [fields.total]: s.value,
            [fields.type]: originalType
                ? `${originalType} (${s.name})`
                : s.name,
            [fields.completed]: true,
            ...lookupBinds,
            ...copiedFields,
        };
        if (originalName) payload[PARENT.primaryName] = originalName;
        if (originalDate != null) payload[fields.date] = originalDate;
        if (originalNotes != null) payload[fields.notes] = originalNotes;

        // paytype: subtype's sst_paytype_opt, else its name matched to the label.
        const paytypeValue: number | null =
            s.paytype != null
                ? s.paytype
                : worktypes.payLabel.get(normalizeLabel(s.name)) ?? null;
        const wt =
            paytypeValue != null && timetypeValue != null
                ? worktypes.byKey.get(`${paytypeValue}|${timetypeValue}`)
                : undefined;
        if (wt) {
            // Set the work-type lookup + its denormalized title
            // (sst_worktype_title_str ← the worktype's sst_title_str).
            payload[`${WORKTYPE.navProp}@odata.bind`] =
                `/${WORKTYPE.entitySet}(${wt.id})`;
            payload[WORKTYPE.titleStr] = wt.title;
        } else {
            // Telemetry: the split is created WITHOUT a work type. Surface which
            // (paytype, timetype) couldn't be resolved so gaps in the sst_worktype
            // table / option data are visible in the trace instead of silent.
            logger.warn("split.worktypeUnresolved", {
                entryId: id,
                subtype: s.name,
                paytype: paytypeValue,
                timetype: timetypeValue,
                reason:
                    worktypes.byKey.size === 0
                        ? "worktypeTableEmpty"
                        : paytypeValue == null
                          ? "paytypeUnresolved"
                          : timetypeValue == null
                            ? "timetypeUnresolved"
                            : "noMatchingWorktype",
            });
        }
        return payload;
    });

    const subtypeUpdates = subtypes.map((s) => ({
        id: s.id.replace(/[{}]/g, ""),
        value: s.value,
    }));

    // Related pause entries (same work order) — best-effort.
    let pauseIds: string[] = [];
    const woId = original[WORKORDER_VALUE];
    if (woId) {
        try {
            const pauseFilter =
                `?$select=${PARENT.primaryId}` +
                `&$filter=${WORKORDER_VALUE} eq ${woId}` +
                ` and ${fields.type} eq '${fields.pauseValue}'` +
                ` and ${PARENT.primaryId} ne ${id}`;
            const pauses = await webApi.retrieveMultipleRecords(
                PARENT.logicalName,
                pauseFilter,
            );
            pauseIds = (pauses.entities ?? []).map((p: any) =>
                String(p[PARENT.primaryId]).replace(/[{}]/g, ""),
            );
        } catch {
            pauseIds = [];
        }
    }

    return { splitPayloads, subtypeUpdates, pauseIds, activeCount: active.length };
}

/** Web API root for raw $batch (same origin as the model-driven app). */
function apiRoot(): string | null {
    try {
        if (typeof window === "undefined" || !window.location?.origin) {
            return null;
        }
        return `${window.location.origin}/api/data/v9.2`;
    } catch {
        return null;
    }
}

/** Pull the first `"message":"…"` out of a JSON string (OData error body). */
function extractJsonMessage(text: string): string {
    const m = /"message"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(text);
    if (!m) return "";
    try {
        return JSON.parse(`"${m[1]}"`) as string;
    } catch {
        return m[1];
    }
}

/** Extract the first OData error message from a $batch response body. */
function parseBatchErrorMessage(text: string): string {
    return extractJsonMessage(text);
}

/**
 * Best-effort **display** message for a server/Web API error. Handles the shapes
 * these come back as: a plain `Error` (`.message`), a Web API reject (`{ message }`),
 * the raw OData body (`{ error: { message } }`), or a JSON string that has the
 * message nested inside. Falls back to the stringified error.
 */
export function serverErrorMessage(e: unknown): string {
    if (e == null) return "";
    if (typeof e === "string") return extractJsonMessage(e) || e;
    const o = e as { message?: unknown; error?: { message?: unknown } };
    if (o.error && typeof o.error.message === "string" && o.error.message) {
        return o.error.message;
    }
    if (typeof o.message === "string" && o.message) {
        // Some hosts stuff the whole JSON body into `.message`.
        return extractJsonMessage(o.message) || o.message;
    }
    try {
        return extractJsonMessage(JSON.stringify(e)) || String(e);
    } catch {
        return String(e);
    }
}

/** Build the $batch body with ONE transactional changeset for the split. */
/** One prepared entry of a (day) split batch. */
interface PreparedEntry {
    id: string;
    prep: SplitPrep;
}

/**
 * Build ONE $batch with ONE changeset covering every prepared entry, so a day
 * split is all-or-nothing just like a single split. Pause updates are
 * de-duplicated across entries (several entries of a day usually share a work
 * order -> the same pause must not be patched twice in one changeset).
 */
function buildSplitBatch(
    root: string,
    fields: FieldConfig,
    items: PreparedEntry[],
    batch: string,
    cs: string,
): string {
    const CRLF = "\r\n";
    const lines: string[] = [
        `--${batch}`,
        `Content-Type: multipart/mixed;boundary=${cs}`,
        "",
    ];
    let cid = 1;
    const pushOp = (method: string, url: string, body?: unknown): void => {
        lines.push(
            `--${cs}`,
            "Content-Type: application/http",
            "Content-Transfer-Encoding:binary",
            `Content-ID: ${cid++}`,
            "",
            `${method} ${url} HTTP/1.1`,
        );
        if (body !== undefined) {
            lines.push(
                "Content-Type: application/json;type=entry",
                "",
                JSON.stringify(body),
            );
        } else {
            lines.push("");
        }
    };

    const parentSet = `${root}/${PARENT.entitySet}`;
    const childSet = `${root}/${CHILD.entitySet}`;
    const originals = new Set(items.map((it) => it.id));
    const pausesDone = new Set<string>();

    for (const { id, prep } of items) {
        // 1) child subtype value updates (cascade-deleted with the parent below)
        for (const u of prep.subtypeUpdates) {
            pushOp("PATCH", `${childSet}(${u.id})`, {
                [CHILD.timeValue]: u.value,
            });
        }
        // 2) create one split per subtype
        for (const payload of prep.splitPayloads) {
            pushOp("POST", parentSet, payload);
        }
        // 3) mark the original completed
        pushOp("PATCH", `${parentSet}(${id})`, { [fields.completed]: true });
        // 4) mark related pauses completed (once per pause; never an original
        //    of this same batch - that one is deleted below anyway)
        for (const pid of prep.pauseIds) {
            if (pausesDone.has(pid) || originals.has(pid)) continue;
            pausesDone.add(pid);
            pushOp("PATCH", `${parentSet}(${pid})`, {
                [fields.completed]: true,
            });
        }
        // 5) delete the original (children cascade)
        pushOp("DELETE", `${parentSet}(${id})`);
    }

    lines.push(`--${cs}--`, `--${batch}--`, "");
    return lines.join(CRLF);
}

/**
 * Try the atomic $batch changeset. Returns "done" on success, "unavailable"
 * when the endpoint can't be reached/authorized (caller falls back), or throws
 * on a genuine data error (the changeset rolled back — data stays consistent).
 */
async function runSplitBatch(
    fields: FieldConfig,
    items: PreparedEntry[],
): Promise<"done" | "unavailable"> {
    const root = apiRoot();
    if (!root || typeof fetch === "undefined") return "unavailable";
    const stamp = Date.now();
    const batch = `batch_wtsg_${stamp}`;
    const cs = `changeset_wtsg_${stamp}`;
    const body = buildSplitBatch(root, fields, items, batch, cs);

    let resp: Response;
    try {
        resp = await fetch(`${root}/$batch`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": `multipart/mixed;boundary=${batch}`,
                Accept: "application/json",
                "OData-Version": "4.0",
                "OData-MaxVersion": "4.0",
            },
            body,
        });
    } catch {
        return "unavailable"; // network / CSP → fall back to webAPI
    }
    // Endpoint / auth not usable here → fall back to the supported webAPI path.
    if ([401, 403, 404, 405].indexOf(resp.status) !== -1) return "unavailable";
    if (resp.ok) return "done";
    // Changeset failed and rolled back → surface the data error (no fallback).
    let text = "";
    try {
        text = await resp.text();
    } catch {
        /* ignore */
    }
    throw new Error(
        parseBatchErrorMessage(text) || `Batch failed (${resp.status})`,
    );
}

/** Best-effort delete of records created during a failed split (rollback). */
async function rollbackCreated(
    webApi: ComponentFramework.WebApi,
    createdIds: string[],
    logger: Logger,
): Promise<void> {
    for (const cid of createdIds) {
        try {
            await webApi.deleteRecord(PARENT.logicalName, cid);
        } catch (e) {
            logger.error("splitSave.rollbackFailed", e, { recordId: cid });
        }
    }
}

/**
 * Fallback when $batch is unavailable: run the mutations via the supported
 * context.webAPI with compensation — if a create or the final delete fails, the
 * created splits are removed (and the original un-marked) so no duplicates or
 * orphans remain. Not a DB transaction, but all-or-nothing for the dangerous
 * create+delete window.
 */
async function saveSplitCompensating(
    webApi: ComponentFramework.WebApi,
    fields: FieldConfig,
    id: string,
    prep: SplitPrep,
    op: Op,
    logger: Logger,
): Promise<void> {
    // Child subtype updates (best-effort — they cascade-delete with the parent).
    for (const u of prep.subtypeUpdates) {
        try {
            await webApi.updateRecord(CHILD.logicalName, u.id, {
                [CHILD.timeValue]: u.value,
            });
        } catch {
            /* non-fatal */
        }
    }

    const created: string[] = [];
    try {
        for (const payload of prep.splitPayloads) {
            const r = await webApi.createRecord(PARENT.logicalName, payload);
            created.push(r.id);
        }
    } catch (e) {
        await rollbackCreated(webApi, created, logger);
        throw e;
    }
    op.step("splitsCreated", { count: created.length });

    let originalMarked = false;
    try {
        await webApi.updateRecord(PARENT.logicalName, id, {
            [fields.completed]: true,
        });
        originalMarked = true;
    } catch (e) {
        await rollbackCreated(webApi, created, logger);
        throw e;
    }

    // Pauses (best-effort, non-fatal).
    let pausesCompleted = 0;
    for (const pid of prep.pauseIds) {
        try {
            await webApi.updateRecord(PARENT.logicalName, pid, {
                [fields.completed]: true,
            });
            pausesCompleted += 1;
        } catch {
            /* non-fatal */
        }
    }
    op.step("pausesCompleted", { count: pausesCompleted });

    try {
        await webApi.deleteRecord(PARENT.logicalName, id);
    } catch (e) {
        // Roll back: remove the created splits + un-mark the original.
        await rollbackCreated(webApi, created, logger);
        if (originalMarked) {
            try {
                await webApi.updateRecord(PARENT.logicalName, id, {
                    [fields.completed]: false,
                });
            } catch {
                /* best-effort */
            }
        }
        throw e;
    }
}

/**
 * Persist a split: create one Rounded Time Entry per subtype with value > 0
 * (copying the original's lookups/fields), mark the original + its related
 * pauses as completed, then delete the original (its child subtypes cascade).
 *
 * The mutation runs atomically as a single $batch changeset (all-or-nothing).
 * If the $batch endpoint isn't reachable/authorized in this host, it falls back
 * to a compensating sequence over the supported context.webAPI that rolls the
 * created splits back if the delete fails — so a split never leaves duplicates
 * or an orphaned original.
 */
export async function saveSplit(
    webApi: ComponentFramework.WebApi,
    utils: ComponentFramework.Utility,
    fields: FieldConfig,
    parentId: string,
    subtypes: SplitInput[],
    logger: Logger = NOOP_LOGGER,
): Promise<SaveResult> {
    const id = parentId.replace(/[{}]/g, "");
    const op = logger.op("splitSave", {
        entryId: id,
        subtypes: subtypes.length,
    });
    let stage = "prepare";
    try {
        const prep = await prepareSplit(
            webApi,
            utils,
            fields,
            id,
            subtypes,
            logger,
        );
        op.step("prepared", {
            active: prep.activeCount,
            pauses: prep.pauseIds.length,
        });

        // Primary: atomic $batch changeset.
        stage = "atomicBatch";
        const result = await runSplitBatch(fields, [{ id, prep }]);
        if (result === "done") {
            op.ok({ created: prep.activeCount, mode: "batch" });
            return { created: prep.activeCount };
        }

        // Fallback: compensating sequence over the supported webAPI (when the
        // $batch endpoint isn't reachable/authorized in this host).
        op.step("batchUnavailable");
        stage = "compensate";
        await saveSplitCompensating(webApi, fields, id, prep, op, logger);
        op.ok({ created: prep.activeCount, mode: "compensate" });
        return { created: prep.activeCount };
    } catch (e) {
        op.fail(e, { stage });
        throw e;
    }
}

/** One entry of a day split: the entry id + its per-subtype distribution. */
export interface DaySplitItem {
    id: string;
    subtypes: SplitInput[];
}

export interface DaySaveResult {
    /** Entries that were split (deleted + replaced by their splits). */
    savedIds: string[];
    /** Splits created in total. */
    created: number;
    /**
     * Fallback path only: the entry that failed after `savedIds` had already
     * been committed one by one. Undefined when everything went through.
     */
    failedId?: string;
}

/**
 * Persist a DAY split: the same mutation as `saveSplit` for every entry of the
 * day, committed as ONE atomic $batch changeset (all entries or none). If the
 * $batch endpoint isn't usable in this host, the entries fall back to the
 * per-entry compensating sequence in order - then a failure mid-way leaves the
 * earlier entries split and the rest untouched, which the result reports
 * (`savedIds` / `failedId`) so the caller can refresh + tell the user.
 */
export async function saveDaySplit(
    webApi: ComponentFramework.WebApi,
    utils: ComponentFramework.Utility,
    fields: FieldConfig,
    items: DaySplitItem[],
    logger: Logger = NOOP_LOGGER,
): Promise<DaySaveResult> {
    const clean = items
        .map((it) => ({ ...it, id: it.id.replace(/[{}]/g, "") }))
        .filter((it) => it.subtypes.some((s) => s.value > 0));
    const op = logger.op("daySplitSave", { entries: clean.length });
    let stage = "prepare";
    try {
        const worktypes = await resolveWorktypes(webApi);
        const prepared: PreparedEntry[] = [];
        for (const it of clean) {
            const prep = await prepareSplit(
                webApi,
                utils,
                fields,
                it.id,
                it.subtypes,
                logger,
                worktypes,
            );
            prepared.push({ id: it.id, prep });
        }
        const created = prepared.reduce((a, p) => a + p.prep.activeCount, 0);
        op.step("prepared", { entries: prepared.length, created });

        stage = "atomicBatch";
        const result = await runSplitBatch(fields, prepared);
        if (result === "done") {
            op.ok({ entries: prepared.length, created, mode: "batch" });
            return { savedIds: prepared.map((p) => p.id), created };
        }

        op.step("batchUnavailable");
        stage = "compensate";
        const savedIds: string[] = [];
        let createdSoFar = 0;
        for (const p of prepared) {
            try {
                await saveSplitCompensating(
                    webApi,
                    fields,
                    p.id,
                    p.prep,
                    op,
                    logger,
                );
                savedIds.push(p.id);
                createdSoFar += p.prep.activeCount;
            } catch (e) {
                op.fail(e, {
                    stage,
                    savedIds: savedIds.length,
                    failedId: p.id,
                });
                return { savedIds, created: createdSoFar, failedId: p.id };
            }
        }
        op.ok({
            entries: savedIds.length,
            created: createdSoFar,
            mode: "compensate",
        });
        return { savedIds, created: createdSoFar };
    } catch (e) {
        op.fail(e, { stage });
        throw e;
    }
}

/** A delivery note created by createTimeReports (for the "open" picker). */
export interface CreatedReport {
    id: string;
    name: string;
    /** Project the note groups (formatted lookup value) — picker sub-label. */
    projectName: string;
    /** Delivery-note number (autonumber) — preferred display label. */
    number: string;
}

export interface CreateReportsResult {
    /** At least one selected entry already had a delivery note → nothing done. */
    blocked: boolean;
    reportsCreated: number;
    assigned: number;
    failed: number;
    /** Ids of the entries that were actually linked (for optimistic removal). */
    assignedIds: string[];
    /** Every created delivery note (one per project), with id + name. */
    reports: CreatedReport[];
    /** First server error message (when something failed) — for display. */
    errorMessage?: string;
}

/**
 * "Assign" mode action: create one delivery note (sst_timereports) **per project**
 * across the selected entries and link each entry to its project's note
 * (sst_TimeReport). 5 entries on 2 projects → 2 notes.
 *
 * The work order is no longer the grouping key (it was until v1.23.x). It is
 * still written to the note's `sst_Arbeitsauftrag`, but only when every entry of
 * the project group shares the same work order — a note spanning several work
 * orders leaves it empty rather than picking one arbitrarily, which would push a
 * misleading `WORKORDER` to AX via dual-write.
 *
 * Guard: if any selected entry already has a delivery note, nothing is created
 * (returns blocked=true). Entries without a project can't be assigned and are
 * counted as failures — in practice the "assign" filter already excludes them
 * (`_sst_project_id_value ne null`). The unused booking/resource retrieval from
 * the original script (its resource binding was commented out) is intentionally
 * omitted.
 */
export async function createTimeReports(
    webApi: ComponentFramework.WebApi,
    selectedIds: string[],
    logger: Logger = NOOP_LOGGER,
): Promise<CreateReportsResult> {
    const ids = selectedIds.map((s) => s.replace(/[{}]/g, ""));
    const fmt = "@OData.Community.Display.V1.FormattedValue";
    const op = logger.op("createReports", { selected: ids.length });

    // Retrieve project + work order + current delivery note + resource (for the
    // name) for each selected entry.
    const entries = await Promise.all(
        ids.map((id) =>
            webApi
                .retrieveRecord(
                    PARENT.logicalName,
                    id,
                    `?$select=${PROJECT_VALUE},${WORKORDER_VALUE},${TIMEREPORT.value}` +
                        `&$expand=sst_resource_ref($select=name)`,
                )
                .then(
                    (rec: any) => ({ id, rec }),
                    () => ({ id, rec: null as any }),
                ),
        ),
    );

    // Guard: only entries without a delivery note may be processed.
    if (entries.some((e) => e.rec && e.rec[TIMEREPORT.value])) {
        op.step("blocked");
        return {
            blocked: true,
            reportsCreated: 0,
            assigned: 0,
            failed: 0,
            assignedIds: [],
            reports: [],
        };
    }

    // Group selected entries by project. `woIds` collects the distinct work
    // orders seen in the group so the note's work-order lookup can be set when
    // — and only when — the group is unambiguous (entries without a work order
    // contribute "" and therefore also make the group ambiguous).
    const byProject = new Map<
        string,
        {
            projectId: string;
            projectName: string;
            entryIds: string[];
            woIds: Set<string>;
        }
    >();
    let failed = 0;
    let firstError = "";
    for (const e of entries) {
        const projRaw = e.rec ? e.rec[PROJECT_VALUE] : null;
        if (!projRaw) {
            failed += 1; // no project → cannot create a delivery note
            continue;
        }
        const key = String(projRaw).replace(/[{}]/g, "");
        const projectName = (e.rec[PROJECT_VALUE + fmt] as string) ?? "";
        if (!byProject.has(key)) {
            byProject.set(key, {
                projectId: key,
                projectName,
                entryIds: [],
                woIds: new Set<string>(),
            });
        }
        const grp = byProject.get(key)!;
        grp.entryIds.push(e.id);
        const woRaw = e.rec[WORKORDER_VALUE];
        grp.woIds.add(woRaw ? String(woRaw).replace(/[{}]/g, "") : "");
    }

    let assigned = 0;
    const assignedIds: string[] = [];
    const reports: CreatedReport[] = [];
    // Name to match the parallel cloud flow:
    //   concat('Timereport ', <date>, ' / ', <resource name>)
    // date = today (local, yyyy-MM-dd); resource = the name of the resource on the
    // FIRST selected booking entry (sst_resource_ref.name), like the flow's
    // Get_Resource step.
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
        now.getDate(),
    )}`;
    let resourceName = "";
    for (const e of entries) {
        const rn = e.rec?.sst_resource_ref?.name;
        if (rn) {
            resourceName = String(rn);
            break;
        }
    }
    const reportName = `Timereport ${dateStr} / ${resourceName}`.trim();

    for (const grp of byProject.values()) {
        // Unambiguous work order (exactly one, and it is set) → carry it onto the
        // note; mixed or missing → leave the lookup empty.
        const woList = Array.from(grp.woIds);
        const woId = woList.length === 1 && woList[0] ? woList[0] : null;
        let reportId: string;
        try {
            const payload: ComponentFramework.WebApi.Entity = {
                [TIMEREPORT.name]: reportName,
                [`${TIMEREPORT.projectNav}@odata.bind`]: `/${PROJECT_SET}(${grp.projectId})`,
            };
            if (woId) {
                payload[
                    `${TIMEREPORT.workorderNav}@odata.bind`
                ] = `/${WORKORDER_SET}(${woId})`;
            }
            const created = await webApi.createRecord(
                TIMEREPORT.logicalName,
                payload,
            );
            reportId = created.id;
            // The delivery-note number is an autonumber (set synchronously on
            // create); fetch it for the picker label. Best-effort.
            let number = "";
            try {
                const back: any = await webApi.retrieveRecord(
                    TIMEREPORT.logicalName,
                    reportId,
                    `?$select=${TIMEREPORT.number}`,
                );
                number = String(back?.[TIMEREPORT.number] ?? "");
            } catch {
                /* number stays empty → picker falls back to the project name */
            }
            reports.push({
                id: reportId,
                name: reportName,
                projectName: grp.projectName,
                number,
            });
            op.step("reportCreated", {
                projectId: grp.projectId,
                woId: woId ?? "(mixed)",
                number,
                entries: grp.entryIds.length,
            });
        } catch (e) {
            failed += grp.entryIds.length; // report creation failed → its entries fail
            if (!firstError) firstError = serverErrorMessage(e);
            logger.error("createReports.reportFailed", e, {
                projectId: grp.projectId,
                entries: grp.entryIds.length,
            });
            continue;
        }
        for (const eid of grp.entryIds) {
            try {
                await webApi.updateRecord(PARENT.logicalName, eid, {
                    [`${TIMEREPORT.entryNav}@odata.bind`]: `/${TIMEREPORT.entitySet}(${reportId})`,
                });
                assigned += 1;
                assignedIds.push(eid);
            } catch (e) {
                failed += 1;
                if (!firstError) firstError = serverErrorMessage(e);
                logger.error("createReports.linkFailed", e, { entryId: eid });
            }
        }
    }

    op.ok({ reportsCreated: reports.length, assigned, failed });
    return {
        blocked: false,
        reportsCreated: reports.length,
        assigned,
        failed,
        assignedIds,
        reports,
        errorMessage: firstError || undefined,
    };
}
