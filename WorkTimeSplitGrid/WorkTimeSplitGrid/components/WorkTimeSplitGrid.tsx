import * as React from "react";
import { EntryList } from "./EntryList";
import { SplitPanel } from "./SplitPanel";
import { EntryRow, Lang, SubtypeRow } from "./types";
import { STRINGS } from "./i18n";
import { FieldConfig } from "./schema";
import { loadSubtypes } from "./api";

export interface WorkTimeSplitGridProps {
    dataset: ComponentFramework.PropertyTypes.DataSet;
    webApi: ComponentFramework.WebApi;
    utils: ComponentFramework.Utility;
    fields: FieldConfig;
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
    const [showCompleted, setShowCompleted] = React.useState(false);
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    const [subtypes, setSubtypes] = React.useState<SubtypeRow[] | null>(null);
    const [loadingSubtypes, setLoadingSubtypes] = React.useState(false);
    const [subtypeError, setSubtypeError] = React.useState<string | null>(null);
    const [toast, setToast] = React.useState<string | null>(null);

    const entityName = React.useMemo(() => getEntityName(dataset), [dataset]);

    const rows = React.useMemo(
        () => buildRows(dataset, fields),
        [dataset, fields],
    );

    // Exclude pauses; apply split/not-split toggle + free-text search.
    const visibleRows = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((r) => {
            if (r.type && r.type.toLowerCase() === fields.pauseValue.toLowerCase())
                return false;
            if (r.completed !== showCompleted) return false;
            if (!q) return true;
            return (
                r.name.toLowerCase().includes(q) ||
                r.type.toLowerCase().includes(q) ||
                r.date.toLowerCase().includes(q) ||
                r.extras.some((x) => x.value.toLowerCase().includes(q))
            );
        });
    }, [rows, search, showCompleted, fields.pauseValue]);

    const selected = React.useMemo(
        () => visibleRows.find((r) => r.id === selectedId) ?? null,
        [visibleRows, selectedId],
    );

    // Load subtypes whenever the selected entry changes.
    React.useEffect(() => {
        if (!selectedId) {
            setSubtypes(null);
            setSubtypeError(null);
            return;
        }
        let cancelled = false;
        setLoadingSubtypes(true);
        setSubtypeError(null);
        loadSubtypes(props.webApi, selectedId).then(
            (rows) => {
                if (cancelled) return;
                setSubtypes(rows);
                setLoadingSubtypes(false);
            },
            () => {
                if (cancelled) return;
                setSubtypes([]);
                setSubtypeError(t.errLoadSubtypes);
                setLoadingSubtypes(false);
            },
        );
        return () => {
            cancelled = true;
        };
    }, [selectedId, props.webApi, t.errLoadSubtypes]);

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

    if (!entityName && rows.length === 0 && !dataset.loading) {
        return (
            <div className="wtsg-empty">
                <span className="wtsg-spinner" aria-hidden="true" />
                {t.loading}
            </div>
        );
    }

    return (
        <div className="wtsg-root">
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
                    aria-label={`${t.toggleOpen} / ${t.toggleSplit}`}
                >
                    <button
                        type="button"
                        role="tab"
                        aria-selected={!showCompleted}
                        className={!showCompleted ? "active" : ""}
                        onClick={() => {
                            setShowCompleted(false);
                            setSelectedId(null);
                        }}
                    >
                        {t.toggleOpen}
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={showCompleted}
                        className={showCompleted ? "active" : ""}
                        onClick={() => {
                            setShowCompleted(true);
                            setSelectedId(null);
                        }}
                    >
                        {t.toggleSplit}
                    </button>
                </div>
                <span className="wtsg-count">{t.entries(visibleRows.length)}</span>
            </div>

            {toast && (
                <div className="wtsg-toast" role="status">
                    {toast}
                </div>
            )}

            <div className={`wtsg-body ${dataset.loading ? "wtsg-loading" : ""}`}>
                <EntryList
                    rows={visibleRows}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    strings={t}
                />
                <SplitPanel
                    entry={selected}
                    subtypes={subtypes}
                    loading={loadingSubtypes}
                    error={subtypeError}
                    fields={fields}
                    webApi={props.webApi}
                    utils={props.utils}
                    disabled={props.disabled}
                    lang={props.lang}
                    onSubtypesChange={setSubtypes}
                    onSaved={handleSaved}
                    onError={(msg) => flashToast(msg)}
                />
            </div>
        </div>
    );
};
