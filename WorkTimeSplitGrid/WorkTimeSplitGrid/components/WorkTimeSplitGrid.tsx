import * as React from "react";
import { EntryList } from "./EntryList";
import { SplitPanel } from "./SplitPanel";
import { EntryRow, Lang, SubtypeRow } from "./types";
import { STRINGS } from "./i18n";
import { FieldConfig, RESOURCE_REF, ADMIN_ROLES, TIMEREPORT } from "./schema";
import { loadSubtypes, userHasAnyRole, createTimeReports } from "./api";

type Mode = "split" | "assign";

/** Per-record data pulled from the WebAPI (not reliably in the bound view). */
interface EnrichEntry {
    type: string;
    date: string;
    project: string;
    resourceName: string;
    resourceUserId: string;
    timereport: string;
    /** sst_worksubtypecompleted. */
    completed: boolean;
    /** _sst_project_id_value — empty when no project is set. */
    projectId: string;
}

export interface WorkTimeSplitGridProps {
    dataset: ComponentFramework.PropertyTypes.DataSet;
    webApi: ComponentFramework.WebApi;
    utils: ComponentFramework.Utility;
    navigation: ComponentFramework.Navigation;
    fields: FieldConfig;
    /** Current user's systemuserid (for the "My hours" filter + role check). */
    userId: string;
    /** Phone form factor → single-pane, touch-first layout. */
    isMobile: boolean;
    disabled: boolean;
    lang: Lang;
}

/** Best-effort entity name extraction from the dataset. */
function getEntityName(
    dataset: ComponentFramework.PropertyTypes.DataSet,
): string | null {
    const fn = (dataset as unknown as { getTargetEntityType?: () => string })
        .getTargetEntityType;
    const fromMethod = typeof fn === "function" ? fn.call(dataset) : null;
    if (fromMethod) return fromMethod;
    const firstId = dataset.sortedRecordIds[0];
    if (firstId) {
        const ref = dataset.records[firstId]?.getNamedReference?.();
        const anyRef = ref as unknown as { etn?: string; entityType?: string };
        if (anyRef?.etn) return anyRef.etn;
        if (anyRef?.entityType) return anyRef.entityType;
    }
    return null;
}

const truthy = (v: unknown): boolean =>
    v === true || v === 1 || v === "1" || v === "true";

function buildRows(
    dataset: ComponentFramework.PropertyTypes.DataSet,
    fields: FieldConfig,
): EntryRow[] {
    const reserved = new Set(
        [fields.total, fields.date, fields.type, fields.completed].filter(
            Boolean,
        ),
    );
    return dataset.sortedRecordIds.map((id) => {
        const rec = dataset.records[id];
        const ref = rec.getNamedReference?.() as unknown as { name?: string };
        const totalRaw = rec.getValue(fields.total);
        const total = totalRaw == null ? NaN : Number(totalRaw);
        const type =
            rec.getFormattedValue(fields.type) ||
            String(rec.getValue(fields.type) ?? "");

        const extras: EntryRow["extras"] = [];
        for (const col of dataset.columns ?? []) {
            if (reserved.has(col.name) || col.isHidden) continue;
            const formatted = rec.getFormattedValue(col.name);
            if (!formatted) continue;
            extras.push({ key: col.name, label: col.displayName, value: formatted });
            if (extras.length >= 3) break;
        }

        return {
            id,
            name: ref?.name || rec.getFormattedValue(fields.type) || "—",
            date: rec.getFormattedValue(fields.date) || "",
            type,
            total: Number.isFinite(total) ? total : 0,
            totalFormatted:
                rec.getFormattedValue(fields.total) ||
                (Number.isFinite(total) ? String(total) : ""),
            completed: truthy(rec.getValue(fields.completed)),
            extras,
        };
    });
}

export const WorkTimeSplitGrid: React.FC<WorkTimeSplitGridProps> = (props) => {
    const t = STRINGS[props.lang];
    const { dataset, fields } = props;

    const [search, setSearch] = React.useState("");
    const [mode, setMode] = React.useState<Mode>("split");
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    // Assign mode multi-selection + in-flight "create delivery notes" state.
    const [checkedIds, setCheckedIds] = React.useState<Set<string>>(
        () => new Set(),
    );
    const [creating, setCreating] = React.useState(false);
    const [subtypes, setSubtypes] = React.useState<SubtypeRow[] | null>(null);
    const [loadingSubtypes, setLoadingSubtypes] = React.useState(false);
    const [subtypeError, setSubtypeError] = React.useState<string | null>(null);
    // The entry id the currently held `subtypes` belong to — lets us tell stale
    // data (during a switch) from freshly loaded data, avoiding a summary flicker.
    const [subtypesEntryId, setSubtypesEntryId] = React.useState<string | null>(
        null,
    );
    const [toast, setToast] = React.useState<string | null>(null);
    const [enrich, setEnrich] = React.useState<Map<string, EnrichEntry>>(
        () => new Map(),
    );
    const [enriching, setEnriching] = React.useState(false);
    const [myHoursOnly, setMyHoursOnly] = React.useState(true);
    const [isAdmin, setIsAdmin] = React.useState(false);

    const entityName = React.useMemo(() => getEntityName(dataset), [dataset]);

    const currentUserId = React.useMemo(
        () => (props.userId || "").replace(/[{}]/g, "").toLowerCase(),
        [props.userId],
    );

    // Admins (System Administrator / SST Dispo Teamleitung Addon) may toggle the
    // "My hours" filter off; everyone else stays locked to their own hours.
    React.useEffect(() => {
        if (!currentUserId) return;
        let cancelled = false;
        userHasAnyRole(props.webApi, currentUserId, ADMIN_ROLES).then((admin) => {
            if (!cancelled) setIsAdmin(admin);
        });
        return () => {
            cancelled = true;
        };
    }, [currentUserId, props.webApi]);

    const rows = React.useMemo(
        () => buildRows(dataset, fields),
        [dataset, fields],
    );

    // Apply enrichment (title fields + resource) to every row.
    const enrichedRows = React.useMemo(() => {
        return rows.map((r) => {
            const ex = enrich.get(r.id);
            const type = ex?.type || r.type;
            const date = ex?.date || r.date;
            const project = ex?.project ?? "";
            const resourceName = ex?.resourceName ?? "";
            const resourceUserId = ex?.resourceUserId ?? "";
            const timereport = ex?.timereport ?? "";
            // completed + project come from the WebAPI enrichment (the bound view
            // may not expose them); fall back to dataset only before enrichment.
            const completed = ex ? ex.completed : r.completed;
            const projectPresent = ex ? !!ex.projectId : false;
            return {
                ...r,
                type,
                date,
                project,
                resourceName,
                resourceUserId,
                timereport,
                completed,
                projectPresent,
                name: t.title(type, date, project),
            };
        });
    }, [rows, enrich, t]);

    // The bound view may be paged; index.ts pulls every page. While more pages
    // are still loading, defer enrichment so we batch over the complete set.
    const loadingMore =
        dataset.loading || !!(dataset.paging && dataset.paging.hasNextPage);

    // Enrich every loaded record with title fields that may live outside the
    // view (sst_date, project number), the resource (name + user) and the
    // delivery-note value. Runs once all pages are loaded, in chunked WebAPI
    // calls (the $filter is an id list, so it must be batched). Best-effort.
    const idsKey = React.useMemo(
        () => (dataset.sortedRecordIds ?? []).join(","),
        [dataset],
    );
    React.useEffect(() => {
        if (loadingMore) return; // wait until every page is loaded
        const ids = (dataset.sortedRecordIds ?? []).map((i) =>
            i.replace(/[{}]/g, ""),
        );
        if (ids.length === 0) {
            setEnrich(new Map());
            setEnriching(false);
            return;
        }
        let cancelled = false;
        setEnriching(true);
        const CHUNK = 100;
        const chunks: string[][] = [];
        for (let i = 0; i < ids.length; i += CHUNK) {
            chunks.push(ids.slice(i, i + CHUNK));
        }
        const select =
            `?$select=sst_roundedtimeentriesid,sst_type,sst_date,${TIMEREPORT.value},` +
            `${fields.completed},_sst_project_id_value` +
            `&$expand=sst_Project_id($select=sst_projectnumber),` +
            `${RESOURCE_REF.navProp}($select=${RESOURCE_REF.nameField},${RESOURCE_REF.userIdValue})`;
        Promise.all(
            chunks.map((chunk): Promise<any[]> => {
                const filter = chunk
                    .map((id) => `sst_roundedtimeentriesid eq ${id}`)
                    .join(" or ");
                return props.webApi
                    .retrieveMultipleRecords(
                        "sst_roundedtimeentries",
                        `${select}&$filter=${filter}`,
                    )
                    .then(
                        (res) => res.entities ?? [],
                        () => [],
                    );
            }),
        ).then((parts) => {
            if (cancelled) return;
            const m = new Map<string, EnrichEntry>();
            for (const e of parts.flat() as Record<string, any>[]) {
                const rid = String(e["sst_roundedtimeentriesid"] ?? "").replace(
                    /[{}]/g,
                    "",
                );
                const fmt =
                    e["sst_date@OData.Community.Display.V1.FormattedValue"];
                const date = fmt ? String(fmt).split(" ")[0] : "";
                const proj = e["sst_Project_id"]
                    ? e["sst_Project_id"]["sst_projectnumber"]
                    : "";
                const resObj = e[RESOURCE_REF.navProp];
                const resourceName = resObj
                    ? String(resObj[RESOURCE_REF.nameField] ?? "")
                    : "";
                const resourceUserId = resObj
                    ? String(resObj[RESOURCE_REF.userIdValue] ?? "")
                          .replace(/[{}]/g, "")
                          .toLowerCase()
                    : "";
                m.set(rid, {
                    type: String(e["sst_type"] ?? ""),
                    date,
                    project: String(proj ?? ""),
                    resourceName,
                    resourceUserId,
                    timereport: String(e[TIMEREPORT.value] ?? ""),
                    completed: truthy(e[fields.completed]),
                    projectId: String(e["_sst_project_id_value"] ?? ""),
                });
            }
            setEnrich(m);
            setEnriching(false);
        });
        return () => {
            cancelled = true;
        };
    }, [idsKey, props.webApi, loadingMore]);

    // Non-admins are locked to their own hours; admins may toggle it off.
    const myHoursActive = !isAdmin || myHoursOnly;

    // Hide pauses; apply split/not-split toggle, "My hours", and free-text search
    // (incl. project number and resource name from the enrichment).
    const displayRows = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return enrichedRows.filter((r) => {
            // Both modes require a project (sst_project_id set).
            if (!r.projectPresent) return false;
            if (mode === "split") {
                // Work Subtype Completed = No
                if (r.completed) return false;
            } else {
                // Work Subtype Completed = Yes AND delivery note empty
                if (!r.completed) return false;
                if (r.timereport) return false;
            }
            if (myHoursActive) {
                if (!currentUserId) return false;
                if ((r.resourceUserId ?? "") !== currentUserId) return false;
            }
            if (!q) return true;
            return (
                r.name.toLowerCase().includes(q) ||
                r.type.toLowerCase().includes(q) ||
                r.date.toLowerCase().includes(q) ||
                (r.project ?? "").toLowerCase().includes(q) ||
                (r.resourceName ?? "").toLowerCase().includes(q) ||
                r.extras.some((x) => x.value.toLowerCase().includes(q))
            );
        });
    }, [enrichedRows, search, mode, myHoursActive, currentUserId]);

    const selected = React.useMemo(
        () => displayRows.find((r) => r.id === selectedId) ?? null,
        [displayRows, selectedId],
    );

    // Load subtypes whenever the selected entry changes.
    React.useEffect(() => {
        if (!selectedId) {
            setSubtypes(null);
            setSubtypeError(null);
            setSubtypesEntryId(null);
            return;
        }
        const forId = selectedId;
        let cancelled = false;
        setLoadingSubtypes(true);
        setSubtypeError(null);
        loadSubtypes(props.webApi, forId).then(
            (rows) => {
                if (cancelled) return;
                setSubtypes(rows);
                setSubtypesEntryId(forId);
                setLoadingSubtypes(false);
            },
            () => {
                if (cancelled) return;
                setSubtypes([]);
                setSubtypeError(t.errLoadSubtypes);
                setSubtypesEntryId(forId);
                setLoadingSubtypes(false);
            },
        );
        return () => {
            cancelled = true;
        };
    }, [selectedId, props.webApi, t.errLoadSubtypes]);

    // The held subtypes are only valid for the SplitPanel once they belong to the
    // selected entry; until then the panel shows a progress indicator (no flicker).
    const subtypesMatched = !!selectedId && subtypesEntryId === selectedId;

    const flashToast = React.useCallback((msg: string) => {
        setToast(msg);
        window.setTimeout(() => setToast(null), 4000);
    }, []);

    const handleSaved = React.useCallback(() => {
        flashToast(t.saveSucceeded);
        setSelectedId(null);
        setSubtypes(null);
        dataset.refresh();
    }, [dataset, flashToast, t.saveSucceeded]);

    const switchMode = React.useCallback((m: Mode) => {
        setMode(m);
        setSelectedId(null);
        setCheckedIds(new Set());
    }, []);

    const toggleCheck = React.useCallback((id: string) => {
        setCheckedIds((prev) => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });
    }, []);

    const handleCreateReports = React.useCallback(
        async (openAfter: boolean) => {
            const ids = [...checkedIds];
            if (ids.length === 0 || creating) return;
            setCreating(true);
            try {
                const res = await createTimeReports(props.webApi, ids);
                if (res.blocked) {
                    flashToast(t.reportsBlocked);
                    return;
                }
                flashToast(
                    res.failed > 0
                        ? t.reportsPartial(res.assigned, ids.length)
                        : t.reportsDone(res.reportsCreated, res.assigned),
                );
                setCheckedIds(new Set());
                dataset.refresh();
                // "Create & open" opens every created delivery note; plain
                // "create" only opens when exactly one note resulted.
                const toOpen = openAfter
                    ? res.reportIds
                    : res.singleReportId
                      ? [res.singleReportId]
                      : [];
                for (const reportId of toOpen) {
                    try {
                        props.navigation.openForm({
                            entityName: TIMEREPORT.logicalName,
                            entityId: reportId,
                        });
                    } catch {
                        /* ignore navigation errors */
                    }
                }
            } catch (e) {
                const msg =
                    (e as { message?: string })?.message ?? String(e ?? "");
                flashToast(`${t.createReports}: ${msg}`);
            } finally {
                setCreating(false);
            }
        },
        [
            checkedIds,
            creating,
            props.webApi,
            props.navigation,
            dataset,
            flashToast,
            t,
        ],
    );

    if (!entityName && rows.length === 0 && !dataset.loading) {
        return (
            <div className="wtsg-empty">
                <span className="wtsg-spinner" aria-hidden="true" />
                {t.loading}
            </div>
        );
    }

    const detailOpen = props.isMobile && mode === "split" && !!selected;

    return (
        <div
            className={`wtsg-root ${props.isMobile ? "wtsg-mobile" : ""} ${
                mode === "assign" ? "wtsg-assign" : ""
            }`}
        >
            {!detailOpen && (
            <div className="wtsg-toolbar">
                <input
                    type="search"
                    className="wtsg-search"
                    placeholder={t.searchPlaceholder}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label={t.searchPlaceholder}
                />
                <div
                    className="wtsg-toggle"
                    role="tablist"
                    aria-label={`${t.modeSplit} / ${t.modeAssign}`}
                >
                    <button
                        type="button"
                        role="tab"
                        aria-selected={mode === "split"}
                        className={mode === "split" ? "active" : ""}
                        onClick={() => switchMode("split")}
                    >
                        {t.modeSplit}
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={mode === "assign"}
                        className={mode === "assign" ? "active" : ""}
                        onClick={() => switchMode("assign")}
                    >
                        {t.modeAssign}
                    </button>
                </div>
                <button
                    type="button"
                    className={`wtsg-chip-filter ${myHoursActive ? "active" : ""}`}
                    disabled={!isAdmin}
                    aria-pressed={myHoursActive}
                    title={!isAdmin ? t.myHoursLocked : t.myHours}
                    onClick={() => {
                        if (!isAdmin) return;
                        setMyHoursOnly((v) => !v);
                        setSelectedId(null);
                    }}
                >
                    {!isAdmin && <span aria-hidden="true">🔒 </span>}
                    {t.myHours}
                </button>
                <span className="wtsg-count">
                    {t.entries(displayRows.length)}
                    {loadingMore || enriching ? ` · ${t.loadingMore}` : ""}
                </span>
            </div>
            )}

            {toast && (
                <div className="wtsg-toast" role="status">
                    {toast}
                </div>
            )}

            <div className={`wtsg-body ${dataset.loading ? "wtsg-loading" : ""}`}>
                {mode === "split" ? (
                    <>
                        {(!props.isMobile || !selected) && (
                            <EntryList
                                rows={displayRows}
                                selectedId={selectedId}
                                onSelect={setSelectedId}
                                strings={t}
                            />
                        )}
                        {(!props.isMobile || !!selected) && (
                            <SplitPanel
                                entry={selected}
                                subtypes={subtypesMatched ? subtypes : null}
                                loading={
                                    !!selected &&
                                    (loadingSubtypes || !subtypesMatched)
                                }
                                error={subtypesMatched ? subtypeError : null}
                                fields={fields}
                                webApi={props.webApi}
                                utils={props.utils}
                                disabled={props.disabled}
                                isMobile={props.isMobile}
                                lang={props.lang}
                                onBack={() => setSelectedId(null)}
                                onSubtypesChange={setSubtypes}
                                onSaved={handleSaved}
                                onError={(msg) => flashToast(msg)}
                            />
                        )}
                    </>
                ) : (
                    <EntryList
                        rows={displayRows}
                        selectedId={null}
                        onSelect={() => undefined}
                        selectable
                        checkedIds={checkedIds}
                        onToggleCheck={toggleCheck}
                        strings={t}
                    />
                )}
            </div>

            {mode === "assign" && checkedIds.size > 0 && (
                <div className="wtsg-actionbar">
                    <span className="wtsg-actionbar-count">
                        {t.selectedCount(checkedIds.size)}
                    </span>
                    <div className="wtsg-actionbar-btns">
                        <button
                            type="button"
                            className="wtsg-actionbar-btn wtsg-actionbar-btn-secondary"
                            disabled={creating}
                            onClick={() => handleCreateReports(false)}
                        >
                            {t.createReports}
                        </button>
                        <button
                            type="button"
                            className="wtsg-actionbar-btn"
                            disabled={creating}
                            onClick={() => handleCreateReports(true)}
                        >
                            {t.createReportsOpen}
                            <span className="wtsg-btn-ext" aria-hidden="true">
                                {" ↗"}
                            </span>
                        </button>
                    </div>
                </div>
            )}

            {creating && (
                <div className="wtsg-overlay" role="status" aria-live="polite">
                    <div className="wtsg-overlay-box">
                        <span className="wtsg-spinner" aria-hidden="true" />
                        <span>{t.creatingReports}</span>
                    </div>
                </div>
            )}
        </div>
    );
};
