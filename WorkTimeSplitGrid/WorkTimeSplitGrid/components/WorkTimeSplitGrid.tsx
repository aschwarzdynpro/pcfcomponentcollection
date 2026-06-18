import * as React from "react";
import { EntryList } from "./EntryList";
import { SplitPanel } from "./SplitPanel";
import { EntryRow, Lang, SubtypeRow } from "./types";
import { STRINGS } from "./i18n";
import { FieldConfig, ADMIN_ROLES, TIMEREPORT } from "./schema";
import {
    loadSubtypes,
    userHasAnyRole,
    createTimeReports,
    loadEntries,
    LoadedEntry,
} from "./api";

type Mode = "split" | "assign";

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

/** Map a server-loaded entry to a master-list row with the composed title. */
function toEntryRow(
    e: LoadedEntry,
    title: (type: string, date: string, project: string) => string,
): EntryRow {
    return {
        id: e.id,
        name: title(e.type, e.date, e.project),
        date: e.date,
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
    const [entries, setEntries] = React.useState<EntryRow[] | null>(null);
    const [loadingEntries, setLoadingEntries] = React.useState(true);
    const [entriesError, setEntriesError] = React.useState<string | null>(null);
    // Bumped to force a reload of the entry list (after save / assign).
    const [reloadKey, setReloadKey] = React.useState(0);
    const [myHoursOnly, setMyHoursOnly] = React.useState(true);
    const [isAdmin, setIsAdmin] = React.useState(false);

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

    // Non-admins are locked to their own hours; admins may toggle it off.
    const myHoursActive = !isAdmin || myHoursOnly;

    // Load the entries for the current mode straight from the server with the
    // filter already applied (project set; split→not completed; assign→completed
    // & no delivery note; "My hours"→the user's resource). This replaces pulling
    // every dataset page + enriching, which breaks past the 5000-record cap.
    React.useEffect(() => {
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
            },
            () => {
                if (cancelled) return;
                setEntries([]);
                setEntriesError(t.errorPrefix);
                setLoadingEntries(false);
            },
        );
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, myHoursActive, currentUserId, props.webApi, reloadKey, t]);

    const reloadEntries = React.useCallback(() => {
        setReloadKey((k) => k + 1);
    }, []);

    // Free-text search over the already-filtered entries (title, type, date,
    // project number, resource name).
    const displayRows = React.useMemo(() => {
        const all = entries ?? [];
        const q = search.trim().toLowerCase();
        if (!q) return all;
        return all.filter(
            (r) =>
                r.name.toLowerCase().includes(q) ||
                r.type.toLowerCase().includes(q) ||
                r.date.toLowerCase().includes(q) ||
                (r.project ?? "").toLowerCase().includes(q) ||
                (r.resourceName ?? "").toLowerCase().includes(q),
        );
    }, [entries, search]);

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
        reloadEntries();
    }, [reloadEntries, flashToast, t.saveSucceeded]);

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
                reloadEntries();
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
            reloadEntries,
            flashToast,
            t,
        ],
    );

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
