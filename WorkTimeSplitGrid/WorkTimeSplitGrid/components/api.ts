import {
    PARENT,
    CHILD,
    PARENT_LOOKUPS,
    WORKORDER_VALUE,
    WORKTYPE,
    ENTRY_TIMETYPE,
    TIMEREPORT,
    WORKORDER_SET,
    normalizeLabel,
    FieldConfig,
    SUBTYPE_ORDER,
} from "./schema";
import { SubtypeRow } from "./types";

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
function sortSubtypes<T extends { name: string }>(rows: T[]): T[] {
    const rank = (n: string) => {
        const i = SUBTYPE_ORDER.indexOf(n);
        return i === -1 ? SUBTYPE_ORDER.length : i;
    };
    return [...rows].sort((a, b) => {
        const r = rank(a.name) - rank(b.name);
        return r !== 0 ? r : a.name.localeCompare(b.name);
    });
}

/** Load the work-subtype rows belonging to a Rounded Time Entry. */
export async function loadSubtypes(
    webApi: ComponentFramework.WebApi,
    parentId: string,
): Promise<SubtypeRow[]> {
    const id = parentId.replace(/[{}]/g, "");
    const query =
        `?$select=${CHILD.primaryId},${CHILD.name},${CHILD.timeValue},${CHILD.payType}` +
        `&$filter=${CHILD.parentLookupValue} eq ${id}`;
    const res = await webApi.retrieveMultipleRecords(CHILD.logicalName, query);
    const rows: SubtypeRow[] = (res.entities ?? []).map((e: any) => {
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
    resourceName: string;
    timereport: string;
}

export interface LoadEntriesOptions {
    /** "split" → not-yet-split; "assign" → split + no delivery note. */
    mode: "split" | "assign";
    /** When set, restrict to entries whose resource belongs to this user. */
    resourceUserId: string | null;
    /** Type value that marks a break — excluded from both modes when set. */
    pauseValue?: string | null;
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
        resourceName:
            (e.sst_resource_ref ? String(e.sst_resource_ref.name ?? "") : "") ||
            String(e[`_sst_resource_ref_value${ENTRY_FMT}`] ?? "") ||
            String(e.sst_resource ?? ""),
        timereport: String(e._sst_timereport_value ?? ""),
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
    const filter =
        "_sst_project_id_value ne null" +
        modeClause +
        pauseClause +
        resourceClause;

    const query =
        `?$select=sst_roundedtimeentriesid,sst_name,sst_type,sst_date,sst_duration,sst_resource,` +
        `sst_worksubtypecompleted,_sst_project_id_value,_sst_timereport_value,_sst_resource_ref_value` +
        `&$expand=sst_Project_id($select=sst_projectnumber),sst_resource_ref($select=name)` +
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

/**
 * Persist a split: create one Rounded Time Entry per subtype with value > 0
 * (copying the original's lookups/fields), mark the original + its related
 * pauses as completed, then delete the original (its child subtypes are removed
 * by the cascade-delete relationship).
 */
export async function saveSplit(
    webApi: ComponentFramework.WebApi,
    utils: ComponentFramework.Utility,
    fields: FieldConfig,
    parentId: string,
    subtypes: SplitInput[],
): Promise<SaveResult> {
    const id = parentId.replace(/[{}]/g, "");

    // 1) Read the original record (fields + lookup values/annotations).
    const lookupSelects = PARENT_LOOKUPS.map((l) => l.value).join(",");
    const selects = [
        PARENT.primaryName,
        fields.date,
        fields.type,
        fields.notes,
        ENTRY_TIMETYPE,
        WORKORDER_VALUE,
        lookupSelects,
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

    // Resolve the work type ("Zeiterfassungsart") per split via the composite
    // (paytype, timetype) key. timetype comes from the original entry's
    // sst_timetype_opt, else its sst_type text matched to the option label.
    const worktypes = await resolveWorktypes(webApi);
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

    const active = subtypes.filter((s) => s.value > 0);

    // 2) Persist the edited subtype values (faithful to the Custom Page;
    //    the rows are removed by cascade-delete afterwards).
    for (const s of subtypes) {
        try {
            await webApi.updateRecord(CHILD.logicalName, s.id, {
                [CHILD.timeValue]: s.value,
            });
        } catch {
            // non-fatal — the row will be cascade-deleted with the parent
        }
    }

    // 3) Create one split Rounded Time Entry per subtype with value > 0.
    for (const s of active) {
        const payload: Record<string, unknown> = {
            [fields.subtype]: s.name,
            [fields.total]: s.value,
            [fields.type]: originalType
                ? `${originalType} (${s.name})`
                : s.name,
            [fields.completed]: true,
            ...lookupBinds,
        };
        if (originalName) payload[PARENT.primaryName] = originalName;
        if (originalDate != null) payload[fields.date] = originalDate;
        if (originalNotes != null) payload[fields.notes] = originalNotes;

        // Work type = sst_worktype keyed by (paytype, timetype). paytype comes
        // from the subtype's sst_paytype_opt, else its name matched to the label.
        const paytypeValue: number | null =
            s.paytype != null
                ? s.paytype
                : worktypes.payLabel.get(normalizeLabel(s.name)) ?? null;
        if (paytypeValue != null && timetypeValue != null) {
            const wt = worktypes.byKey.get(`${paytypeValue}|${timetypeValue}`);
            if (wt) {
                payload[`${WORKTYPE.navProp}@odata.bind`] =
                    `/${WORKTYPE.entitySet}(${wt.id})`;
                payload[WORKTYPE.titleStr] = wt.title;
            }
        }

        await webApi.createRecord(PARENT.logicalName, payload);
    }

    // 4) Mark the original as completed.
    await webApi.updateRecord(PARENT.logicalName, id, {
        [fields.completed]: true,
    });

    // 5) Mark related pause entries (same work order) as completed.
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
            for (const p of pauses.entities ?? []) {
                await webApi.updateRecord(
                    PARENT.logicalName,
                    p[PARENT.primaryId] as string,
                    { [fields.completed]: true },
                );
            }
        } catch {
            // non-fatal — pauses simply stay open if this lookup fails
        }
    }

    // 6) Delete the original — child subtypes go with it (cascade-delete).
    await webApi.deleteRecord(PARENT.logicalName, id);

    return { created: active.length };
}

/** A delivery note created by createTimeReports (for the "open" picker). */
export interface CreatedReport {
    id: string;
    name: string;
    woName: string;
    /** Delivery-note number (autonumber) — preferred display label. */
    number: string;
}

export interface CreateReportsResult {
    /** At least one selected entry already had a delivery note → nothing done. */
    blocked: boolean;
    reportsCreated: number;
    assigned: number;
    failed: number;
    /** Every created delivery note (one per work order), with id + name. */
    reports: CreatedReport[];
    /** The single created report id (when exactly one) — for opening the form. */
    singleReportId: string | null;
}

/**
 * "Assign" mode action: create one delivery note (sst_timereports) per work order
 * across the selected entries and link each entry to its work order's note
 * (sst_TimeReport). Mirrors the Schulz ribbon `createTimeReport` logic.
 *
 * Guard: if any selected entry already has a delivery note, nothing is created
 * (returns blocked=true). Entries without a work order can't be assigned and are
 * counted as failures. The unused booking/resource retrieval from the original
 * script (its resource binding was commented out) is intentionally omitted.
 */
export async function createTimeReports(
    webApi: ComponentFramework.WebApi,
    selectedIds: string[],
): Promise<CreateReportsResult> {
    const ids = selectedIds.map((s) => s.replace(/[{}]/g, ""));
    const fmt = "@OData.Community.Display.V1.FormattedValue";

    // Retrieve work order + current delivery note for each selected entry.
    const entries = await Promise.all(
        ids.map((id) =>
            webApi
                .retrieveRecord(
                    PARENT.logicalName,
                    id,
                    `?$select=${WORKORDER_VALUE},${TIMEREPORT.value}`,
                )
                .then(
                    (rec: any) => ({ id, rec }),
                    () => ({ id, rec: null as any }),
                ),
        ),
    );

    // Guard: only entries without a delivery note may be processed.
    if (entries.some((e) => e.rec && e.rec[TIMEREPORT.value])) {
        return {
            blocked: true,
            reportsCreated: 0,
            assigned: 0,
            failed: 0,
            reports: [],
            singleReportId: null,
        };
    }

    // Group selected entries by work order.
    const byWo = new Map<
        string,
        { woId: string; woName: string; entryIds: string[] }
    >();
    let failed = 0;
    for (const e of entries) {
        const woRaw = e.rec ? e.rec[WORKORDER_VALUE] : null;
        if (!woRaw) {
            failed += 1; // no work order → cannot create a delivery note
            continue;
        }
        const key = String(woRaw).replace(/[{}]/g, "");
        const woName = (e.rec[WORKORDER_VALUE + fmt] as string) ?? "";
        if (!byWo.has(key)) byWo.set(key, { woId: key, woName, entryIds: [] });
        byWo.get(key)!.entryIds.push(e.id);
    }

    let assigned = 0;
    const reports: CreatedReport[] = [];
    const dateStr = new Date().toDateString();

    for (const wo of byWo.values()) {
        let reportId: string;
        const reportName = `Report ${wo.woName} On ${dateStr}`;
        try {
            const created = await webApi.createRecord(TIMEREPORT.logicalName, {
                [TIMEREPORT.name]: reportName,
                [`${TIMEREPORT.workorderNav}@odata.bind`]: `/${WORKORDER_SET}(${wo.woId})`,
            });
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
                /* number stays empty → picker falls back to the WO name */
            }
            reports.push({
                id: reportId,
                name: reportName,
                woName: wo.woName,
                number,
            });
        } catch {
            failed += wo.entryIds.length; // report creation failed → its entries fail
            continue;
        }
        for (const eid of wo.entryIds) {
            try {
                await webApi.updateRecord(PARENT.logicalName, eid, {
                    [`${TIMEREPORT.entryNav}@odata.bind`]: `/${TIMEREPORT.entitySet}(${reportId})`,
                });
                assigned += 1;
            } catch {
                failed += 1;
            }
        }
    }

    return {
        blocked: false,
        reportsCreated: reports.length,
        assigned,
        failed,
        reports,
        singleReportId: reports.length === 1 ? reports[0].id : null,
    };
}
