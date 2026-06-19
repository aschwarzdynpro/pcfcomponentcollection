import * as React from "react";
import { EntryList } from "./EntryList";
import { SplitPanel } from "./SplitPanel";
import { Dropdown } from "./Dropdown";
import { EntryRow, Lang, SubtypeRow } from "./types";
import { STRINGS } from "./i18n";
import { FieldConfig, ADMIN_ROLES, TIMEREPORT } from "./schema";
import {
    loadSubtypes,
    userHasAnyRole,
    createTimeReports,
    loadEntries,
    LoadedEntry,
    CreatedReport,
} from "./api";
import { Logger } from "./telemetry";

type Mode = "split" | "assign";
type Period = "all" | "today" | "week" | "month";
type SortKey =
    | "dateDesc"
    | "dateAsc"
    | "project"
    | "resource"
    | "durationDesc";

/** Local start-of-period boundary for the period filter (null = no limit). */
function periodStart(period: Period): Date | null {
    if (period === "all") return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === "today") return today;
    if (period === "week") {
        // Week starts Monday (Mon=0 … Sun=6).
        const dow = (today.getDay() + 6) % 7;
        const monday = new Date(today);
        monday.setDate(today.getDate() - dow);
        return monday;
    }
    return new Date(now.getFullYear(), now.getMonth(), 1); // month
}

/** Sort rows by the chosen key (ISO date strings sort chronologically). */
function sortRows(rows: EntryRow[], key: SortKey): EntryRow[] {
    const dv = (r: EntryRow) => r.dateValue ?? r.date ?? "";
    const byDateDesc = (a: EntryRow, b: EntryRow) =>
        dv(b).localeCompare(dv(a));
    const arr = [...rows];
    switch (key) {
        case "dateAsc":
            arr.sort((a, b) => dv(a).localeCompare(dv(b)));
            break;
        case "project":
            arr.sort(
                (a, b) =>
                    (a.project ?? "").localeCompare(b.project ?? "") ||
                    byDateDesc(a, b),
            );
            break;
        case "resource":
            arr.sort(
                (a, b) =>
                    (a.resourceName ?? "").localeCompare(b.resourceName ?? "") ||
                    byDateDesc(a, b),
            );
            break;
        case "durationDesc":
            arr.sort((a, b) => b.total - a.total || byDateDesc(a, b));
            break;
        default: // dateDesc
            arr.sort(byDateDesc);
    }
    return arr;
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
    /** App is offline → the control's live queries can't run; show a notice. */
    isOffline: boolean;
    disabled: boolean;
    lang: Lang;
    logger: Logger;
}

/** Map a server-loaded entry to a master-list row with the composed title. */
function toEntryRow(
    e: LoadedEntry,
    title: (type: string, date: string, project: string) => string,
): EntryRow {
    return {
        id: e.id,
        name: title(e.type, e.date, e.project),
        date: e.date,
        dateValue: e.dateValue,
        type: e.type,
        total: e.total,
        totalFormatted: e.totalFormatted,
        completed: e.completed,
        project: e.project,
        resourceName: e.resourceName,
        timereport: e.timereport,
        projectPresent: !!e.projectId,
        extras: [],
    };
}

export const WorkTimeSplitGrid: React.FC<WorkTimeSplitGridProps> = (props) => {
    const t = STRINGS[props.lang];
    const { fields } = props;

    const [search, setSearch] = React.useState("");
    const [mode, setMode] = React.useState<Mode>("split");
    const [period, setPeriod] = React.useState<Period>("all");
    const [sortBy, setSortBy] = React.useState<SortKey>("dateDesc");
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    // Assign mode multi-selection + in-flight "create delivery notes" state.
    const [checkedIds, setCheckedIds] = React.useState<Set<string>>(
        () => new Set(),
    );
    const [creating, setCreating] = React.useState(false);
    // When "create & open" produced several delivery notes, offer a picker.
    const [reportPicker, setReportPicker] = React.useState<
        CreatedReport[] | null
    >(null);
    const [subtypes, setSubtypes] = React.useState<SubtypeRow[] | null>(null);
    const [loadingSubtypes, setLoadingSubtypes] = React.useState(false);
    const [subtypeError, setSubtypeError] = React.useState<string | null>(null);
    // The entry id the currently held `subtypes` belong to — lets us tell stale
    // data (during a switch) from freshly loaded data, avoiding a summary flicker.
    const [subtypesEntryId, setSubtypesEntryId] = React.useState<string | null>(
        null,
    );
    const [toast, setToast] = React.useState<string | null>(null);
    const [entries, setEntries] = React.useState<EntryRow[] | null>(null);
    const [loadingEntries, setLoadingEntries] = React.useState(true);
    const [entriesError, setEntriesError] = React.useState<string | null>(null);
    // Manual/pull refresh: bumping the key re-runs the server load.
    const [refreshKey, setRefreshKey] = React.useState(0);
    const [refreshing, setRefreshing] = React.useState(false);
    const [myHoursOnly, setMyHoursOnly] = React.useState(true);
    const [isAdmin, setIsAdmin] = React.useState(false);

    const currentUserId = React.useMemo(
        () => (props.userId || "").replace(/[{}]/g, "").toLowerCase(),
        [props.userId],
    );

    // Admins (System Administrator / SST Dispo Teamleitung Addon) may toggle the
    // "My hours" filter off; everyone else stays locked to their own hours.
    React.useEffect(() => {
        if (!currentUserId || props.isOffline) return;
        let cancelled = false;
        userHasAnyRole(props.webApi, currentUserId, ADMIN_ROLES).then((admin) => {
            if (!cancelled) setIsAdmin(admin);
        });
        return () => {
            cancelled = true;
        };
    }, [currentUserId, props.webApi, props.isOffline]);

    // Non-admins are locked to their own hours; admins may toggle it off.
    const myHoursActive = !isAdmin || myHoursOnly;

    // Load the entries for the current mode straight from the server with the
    // filter already applied (project set; split→not completed; assign→completed
    // & no delivery note; "My hours"→the user's resource). This replaces pulling
    // every dataset page + enriching, which breaks past the 5000-record cap.
    React.useEffect(() => {
        if (props.isOffline) {
            setLoadingEntries(false);
            return;
        }
        let cancelled = false;
        setLoadingEntries(true);
        setEntriesError(null);
        loadEntries(props.webApi, {
            mode,
            resourceUserId: myHoursActive ? currentUserId || null : null,
            pauseValue: fields.pauseValue,
        }).then(
            (loaded) => {
                if (cancelled) return;
                setEntries(loaded.map((e) => toEntryRow(e, t.title)));
                setLoadingEntries(false);
                setRefreshing(false);
            },
            (err) => {
                if (cancelled) return;
                props.logger.error("loadEntries", err, { mode });
                setEntries([]);
                setEntriesError(t.errorPrefix);
                setLoadingEntries(false);
                setRefreshing(false);
            },
        );
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        mode,
        myHoursActive,
        currentUserId,
        props.webApi,
        props.isOffline,
        refreshKey,
        t,
    ]);

    const refresh = React.useCallback(() => {
        setRefreshing(true);
        setRefreshKey((k) => k + 1);
    }, []);

    // Optimistic update: drop rows that left the current filter (split-saved or
    // assigned to a delivery note) without a full server reload — instant, no
    // flicker. A mode switch / "My hours" toggle reloads fresh from the server.
    const removeEntries = React.useCallback((ids: string[]) => {
        if (ids.length === 0) return;
        const rm = new Set(ids.map((i) => i.replace(/[{}]/g, "")));
        setEntries((prev) =>
            prev ? prev.filter((e) => !rm.has(e.id)) : prev,
        );
    }, []);

    // Period filter + free-text search (title, type, date, project number,
    // resource name) + sorting — all client-side over the loaded entries.
    const displayRows = React.useMemo(() => {
        const all = entries ?? [];
        const q = search.trim().toLowerCase();
        const start = periodStart(period);
        const filtered = all.filter((r) => {
            if (start) {
                const d = r.dateValue ? new Date(r.dateValue) : null;
                if (!d || isNaN(d.getTime()) || d < start) return false;
            }
            if (!q) return true;
            return (
                r.name.toLowerCase().includes(q) ||
                r.type.toLowerCase().includes(q) ||
                r.date.toLowerCase().includes(q) ||
                (r.project ?? "").toLowerCase().includes(q) ||
                (r.resourceName ?? "").toLowerCase().includes(q)
            );
        });
        return sortRows(filtered, sortBy);
    }, [entries, search, period, sortBy]);

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
        // The split original is deleted (and its splits are completed), so it
        // leaves the "split" list — drop it locally instead of reloading.
        if (selectedId) removeEntries([selectedId]);
        setSelectedId(null);
        setSubtypes(null);
    }, [selectedId, removeEntries, flashToast, t.saveSucceeded]);

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

    const openReport = React.useCallback(
        (reportId: string) => {
            try {
                props.navigation.openForm({
                    entityName: TIMEREPORT.logicalName,
                    entityId: reportId,
                });
            } catch {
                /* ignore navigation errors */
            }
        },
        [props.navigation],
    );

    const handleCreateReports = React.useCallback(
        async (openAfter: boolean) => {
            const ids = [...checkedIds];
            if (ids.length === 0 || creating) return;
            setCreating(true);
            try {
                const res = await createTimeReports(
                    props.webApi,
                    ids,
                    props.logger,
                );
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
                // Assigned entries now have a delivery note → they leave the
                // "assign" list. Drop exactly those locally (no full reload).
                removeEntries(res.assignedIds);
                // Plain "create" opens only when exactly one note resulted.
                // "Create & open": one note → open it; several → show a picker.
                if (openAfter && res.reports.length > 1) {
                    setReportPicker(res.reports);
                } else {
                    const id = openAfter
                        ? res.reports[0]?.id ?? null
                        : res.singleReportId;
                    if (id) openReport(id);
                }
            } catch (e) {
                props.logger.error("createReports", e);
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
            props.logger,
            openReport,
            removeEntries,
            flashToast,
            t,
        ],
    );

    // Offline → the live queries / $batch save can't run; show a clear notice
    // instead of letting them fail with a generic platform error.
    if (props.isOffline) {
        return (
            <div className="wtsg-root">
                <div className="wtsg-offline" role="status">
                    <svg
                        width="56"
                        height="56"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M17.5 19H7a4 4 0 0 1-.8-7.9 5 5 0 0 1 8-3" />
                        <path d="M19.5 15.5A3.5 3.5 0 0 0 18 9" />
                        <path d="M3 3l18 18" />
                    </svg>
                    <h3>{t.offlineTitle}</h3>
                    <p>{t.offlineHint}</p>
                </div>
            </div>
        );
    }

    // First load (entries still null) → full-panel spinner.
    if (entries === null && loadingEntries) {
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
                    {loadingEntries ? ` · ${t.loadingMore}` : ""}
                </span>
            </div>
            )}

            {!detailOpen && (
                <div className="wtsg-subbar">
                    <div
                        className="wtsg-toggle wtsg-period"
                        role="tablist"
                        aria-label={t.periodLabel}
                    >
                        {(
                            [
                                ["all", t.periodAll],
                                ["today", t.periodToday],
                                ["week", t.periodWeek],
                                ["month", t.periodMonth],
                            ] as [Period, string][]
                        ).map(([p, label]) => (
                            <button
                                key={p}
                                type="button"
                                role="tab"
                                aria-selected={period === p}
                                className={period === p ? "active" : ""}
                                onClick={() => {
                                    setPeriod(p);
                                    setSelectedId(null);
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <div className="wtsg-sort">
                        <span>{t.sortLabel}</span>
                        <Dropdown
                            value={sortBy}
                            ariaLabel={t.sortLabel}
                            onChange={(v) => setSortBy(v as SortKey)}
                            options={[
                                { value: "dateDesc", label: t.sortDateDesc },
                                { value: "dateAsc", label: t.sortDateAsc },
                                { value: "project", label: t.sortProject },
                                { value: "resource", label: t.sortResource },
                                {
                                    value: "durationDesc",
                                    label: t.sortDuration,
                                },
                            ]}
                        />
                    </div>
                </div>
            )}

            {toast && (
                <div className="wtsg-toast" role="status">
                    {toast}
                </div>
            )}

            {entriesError && (
                <div className="wtsg-toast wtsg-toast-error" role="alert">
                    {entriesError}
                </div>
            )}

            <div
                className={`wtsg-body ${
                    loadingEntries && entries !== null ? "wtsg-loading" : ""
                }`}
            >
                {mode === "split" ? (
                    <>
                        {(!props.isMobile || !selected) && (
                            <EntryList
                                rows={displayRows}
                                selectedId={selectedId}
                                onSelect={setSelectedId}
                                emptyMessage={
                                    search.trim()
                                        ? t.noResultsSearch
                                        : t.noResults
                                }
                                highlight={search.trim()}
                                enablePull={props.isMobile}
                                refreshing={refreshing}
                                onRefresh={refresh}
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
                                logger={props.logger}
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
                        emptyMessage={
                            search.trim() ? t.noResultsSearch : t.noResults
                        }
                        highlight={search.trim()}
                        enablePull={props.isMobile}
                        refreshing={refreshing}
                        onRefresh={refresh}
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

            {reportPicker && (
                <div
                    className="wtsg-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-label={t.pickReportTitle(reportPicker.length)}
                >
                    <div className="wtsg-modal-card">
                        <h4>{t.pickReportTitle(reportPicker.length)}</h4>
                        <p>{t.pickReportPrompt}</p>
                        <div className="wtsg-report-list">
                            {reportPicker.map((rep) => (
                                <button
                                    key={rep.id}
                                    type="button"
                                    className="wtsg-report-item"
                                    title={rep.number || rep.woName || rep.name}
                                    onClick={() => {
                                        openReport(rep.id);
                                        setReportPicker(null);
                                    }}
                                >
                                    <span className="wtsg-report-text">
                                        <span className="wtsg-report-number">
                                            {rep.number || rep.woName || rep.name}
                                        </span>
                                        {rep.number && rep.woName && (
                                            <span className="wtsg-report-sub">
                                                {rep.woName}
                                            </span>
                                        )}
                                    </span>
                                    <span
                                        className="wtsg-report-open"
                                        aria-hidden="true"
                                    >
                                        ↗
                                    </span>
                                </button>
                            ))}
                        </div>
                        <div className="wtsg-modal-actions">
                            <button
                                type="button"
                                className="wtsg-btn-secondary"
                                onClick={() => setReportPicker(null)}
                            >
                                {t.closeLabel}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
