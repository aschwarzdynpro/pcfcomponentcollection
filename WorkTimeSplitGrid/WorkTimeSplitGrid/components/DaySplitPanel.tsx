import * as React from "react";
import { MODAL_LAYER } from "./layers";
import { EntryRow, Lang, SubtypeRow } from "./types";
import { STRINGS } from "./i18n";
import { FieldConfig, EPSILON, TimeKind, normalizeLabel } from "./schema";
import {
    parseNumber,
    formatNumber,
    loadSubtypes,
    saveDaySplit,
    suggestSplit,
    isHolidayForEntry,
    serverErrorMessage,
    DaySplitItem,
    SplitInput,
} from "./api";
import { Logger } from "./telemetry";
import { DayScope, LOCALE, formatHours } from "./grouping";
import {
    DayBucket,
    EntryDistribution,
    fillChronologically,
    sortChronologically,
    unionBuckets,
} from "./daySplit";
import { SubtypeRowEditor } from "./SubtypeRowEditor";

export interface DaySplitPanelProps {
    /** All open entries of one person on one day (see DayScope). */
    group: DayScope;
    fields: FieldConfig;
    webApi: ComponentFramework.WebApi;
    utils: ComponentFramework.Utility;
    disabled: boolean;
    isMobile: boolean;
    singlePane: boolean;
    isOffline: boolean;
    showSuggest: boolean;
    lang: Lang;
    logger: Logger;
    onBack: () => void;
    /** Entries that were split (removed from the list); `failedId` set when
     *  the fallback path stopped part-way. */
    onSaved: (savedIds: string[], failedId?: string) => void;
    onError: (msg: string) => void;
}

/** Categories edited as separate blocks (work / travel have different rules). */
const BLOCKS: TimeKind[] = ["work", "travel"];

/** Input text per block per subtype key. */
type BlockValues = Record<string, Record<string, string>>;

interface BlockModel {
    kind: TimeKind;
    label: string;
    rows: EntryRow[];
    buckets: { key: string; name: string }[];
    total: number;
    distributed: number;
    remaining: number;
    hasInvalid: boolean;
    distribution: EntryDistribution[];
}

/** Preview time: "06:25–15:27" (booking start – end of capture) when the
 *  start is known, else just the capture end. */
function timeRange(r: EntryRow, lang: Lang): string {
    const end = timeOf(r.dateValue, lang);
    const start = timeOf(r.startValue, lang);
    return start && end ? `${start}–${end}` : start || end;
}

/** "08:31" from an ISO timestamp (empty when undated). */
function timeOf(iso: string | undefined, lang: Lang): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    try {
        return new Intl.DateTimeFormat(LOCALE[lang], {
            hour: "2-digit",
            minute: "2-digit",
        }).format(d);
    } catch {
        return "";
    }
}

/**
 * Day-level split editor: one block per category (work / travel) with the
 * day's total, edited once; the result is poured chronologically into the
 * real entries (see daySplit.ts) and saved as ONE batch (see saveDaySplit).
 */
export const DaySplitPanel: React.FC<DaySplitPanelProps> = (props) => {
    const t = STRINGS[props.lang];
    const { group, fields, lang } = props;

    const [subtypesById, setSubtypesById] = React.useState<Map<
        string,
        SubtypeRow[]
    > | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [loadError, setLoadError] = React.useState<string | null>(null);
    const [values, setValues] = React.useState<BlockValues>({});
    const [saving, setSaving] = React.useState(false);
    const [confirming, setConfirming] = React.useState(false);
    const [suggesting, setSuggesting] = React.useState(false);

    // Open work / travel entries of the day (split mode only lists open ones,
    // but guard on `completed` anyway) + the ones we deliberately leave alone.
    const rowsByKind = React.useMemo(() => {
        const work: EntryRow[] = [];
        const travel: EntryRow[] = [];
        let other = 0;
        for (const r of group.rows) {
            if (r.completed) continue;
            if (r.kind === "work") work.push(r);
            else if (r.kind === "travel") travel.push(r);
            else other += 1;
        }
        return { work, travel, other };
    }, [group.rows]);

    const editableRows = React.useMemo(
        () => [...rowsByKind.work, ...rowsByKind.travel],
        [rowsByKind],
    );

    // Load every entry's own subtype rows (their ids/paytypes are needed for
    // the save) — in parallel, once per selected day.
    React.useEffect(() => {
        setValues({});
        setConfirming(false);
        setSaving(false);
        if (props.isOffline || editableRows.length === 0) {
            setSubtypesById(null);
            setLoadError(null);
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setLoadError(null);
        Promise.all(
            editableRows.map((r) =>
                loadSubtypes(props.webApi, r.id, props.logger).then(
                    (rows) => [r.id, rows] as const,
                ),
            ),
        ).then(
            (pairs) => {
                if (cancelled) return;
                setSubtypesById(new Map(pairs));
                setLoading(false);
            },
            () => {
                if (cancelled) return;
                setSubtypesById(null);
                setLoadError(t.errLoadSubtypes);
                setLoading(false);
            },
        );
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [group.key, props.isOffline, props.webApi, props.logger]);

    const blocks: BlockModel[] = React.useMemo(() => {
        if (!subtypesById) return [];
        const out: BlockModel[] = [];
        for (const kind of BLOCKS) {
            const rows = kind === "work" ? rowsByKind.work : rowsByKind.travel;
            if (rows.length === 0) continue;
            const buckets = unionBuckets(
                rows.map((r) => subtypesById.get(r.id) ?? []),
            );
            const vals = values[kind] ?? {};
            const parsed = buckets.map((b) => parseNumber(vals[b.key] ?? ""));
            const hasInvalid = parsed.some((n) => Number.isNaN(n));
            const distributed = parsed.reduce(
                (a, n) => a + (Number.isNaN(n) ? 0 : n),
                0,
            );
            const total = rows.reduce(
                (a, r) => a + (Number.isFinite(r.total) ? r.total : 0),
                0,
            );
            const dayBuckets: DayBucket[] = buckets.map((b, i) => ({
                ...b,
                hours: Number.isNaN(parsed[i]) ? 0 : parsed[i],
            }));
            out.push({
                kind,
                label: kind === "work" ? t.dayWork : t.dayTravel,
                rows,
                buckets,
                total,
                distributed,
                remaining: total - distributed,
                hasInvalid,
                distribution: fillChronologically(rows, dayBuckets),
            });
        }
        return out;
    }, [subtypesById, rowsByKind, values, t.dayWork, t.dayTravel]);

    // Entries that lack a subtype row the user assigned hours to — the split
    // can't be written for them, so block the save and say which.
    const missing = React.useMemo(() => {
        if (!subtypesById) return [];
        const out: string[] = [];
        for (const b of blocks) {
            for (const d of b.distribution) {
                const own = subtypesById.get(d.entryId) ?? [];
                const row = b.rows.find((r) => r.id === d.entryId);
                for (const p of d.parts) {
                    if (p.hours <= EPSILON) continue;
                    if (!own.some((s) => normalizeLabel(s.name) === p.key)) {
                        const name = b.buckets.find((x) => x.key === p.key)?.name ?? p.key;
                        out.push(t.daySplitMissingSubtype(row?.name ?? d.entryId, name));
                    }
                }
            }
        }
        return out;
    }, [blocks, subtypesById, t]);

    const allSumsMatch =
        blocks.length > 0 &&
        blocks.every(
            (b) => Math.abs(b.remaining) < EPSILON && b.distributed > 0,
        );
    const anyInvalid = blocks.some((b) => b.hasInvalid);
    const editable = !props.disabled && !saving && !props.isOffline;
    const canSave =
        editable && allSumsMatch && !anyInvalid && missing.length === 0;

    const splitCount = blocks.reduce(
        (a, b) => a + b.distribution.reduce((x, d) => x + d.parts.length, 0),
        0,
    );

    const setValue = (kind: TimeKind, key: string, value: string) =>
        setValues((v) => ({ ...v, [kind]: { ...(v[kind] ?? {}), [key]: value } }));

    /** ★: day-level suggestion (holiday / Sunday / 8h rule) per block. */
    const handleSuggest = async () => {
        if (suggesting || blocks.length === 0) return;
        setSuggesting(true);
        try {
            const first = editableRows[0];
            const holiday = first
                ? await isHolidayForEntry(props.webApi, first.id, group.dateIso)
                : false;
            const next: BlockValues = {};
            for (const b of blocks) {
                const pseudo: SubtypeRow[] = b.buckets.map((x) => ({
                    id: x.key,
                    name: x.name,
                    value: "",
                    originalValue: 0,
                    paytype: null,
                }));
                const filled = suggestSplit(group.dateIso, b.total, pseudo, holiday);
                next[b.kind] = {};
                for (const s of filled) next[b.kind][s.id] = s.value;
            }
            setValues(next);
        } finally {
            setSuggesting(false);
        }
    };

    const canSuggest =
        props.showSuggest && editable && !loading && blocks.length > 0;

    const doSave = async () => {
        if (!subtypesById || !canSave) return;
        setConfirming(false);
        setSaving(true);
        const items: DaySplitItem[] = [];
        for (const b of blocks) {
            for (const d of b.distribution) {
                const own = subtypesById.get(d.entryId) ?? [];
                const subtypes: SplitInput[] = own.map((s) => {
                    const part = d.parts.find(
                        (p) => p.key === normalizeLabel(s.name),
                    );
                    return {
                        id: s.id,
                        name: s.name,
                        value: part ? part.hours : 0,
                        paytype: s.paytype ?? null,
                    };
                });
                items.push({ id: d.entryId, subtypes });
            }
        }
        try {
            const res = await saveDaySplit(
                props.webApi,
                props.utils,
                fields,
                items,
                props.logger,
            );
            if (res.failedId) {
                props.onError(t.daySplitPartial(res.savedIds.length, items.length));
            }
            props.onSaved(res.savedIds, res.failedId);
        } catch (e) {
            props.onError(`${t.saveFailed}: ${serverErrorMessage(e)}`);
        } finally {
            setSaving(false);
        }
    };

    const projects = Array.from(
        new Set(group.rows.map((r) => r.project).filter(Boolean)),
    ).join(", ");

    const head = (
        <>
            {props.singlePane && (
                <div className="wtsg-mobile-head">
                    <button
                        type="button"
                        className="wtsg-back"
                        onClick={props.onBack}
                        aria-label={t.back}
                    >
                        <span aria-hidden="true">‹</span> {t.back}
                    </button>
                </div>
            )}
            <div className="wtsg-panel-head">
                <div className="wtsg-panel-head-text">
                    <h3 title={group.label}>{group.label}</h3>
                    <div className="wtsg-panel-sub">
                        {t.daySplitTitle} · {t.daySplitEntries(editableRows.length)}
                        {projects ? ` · ${projects}` : ""}
                    </div>
                    {group.note && (
                        <div className="wtsg-panel-sub wtsg-panel-scope-note">
                            {group.note}
                        </div>
                    )}
                </div>
                {canSuggest && (
                    <button
                        type="button"
                        className="wtsg-magic"
                        onClick={handleSuggest}
                        disabled={suggesting}
                        title={t.suggest}
                        aria-label={t.suggest}
                    >
                        {suggesting ? (
                            <span className="wtsg-spinner" aria-hidden="true" />
                        ) : (
                            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                    d="M9.5 2C9.5 6 6 9.5 2 9.5C6 9.5 9.5 13 9.5 17C9.5 13 13 9.5 17 9.5C13 9.5 9.5 6 9.5 2Z"
                                    fill="#2d8cf0"
                                />
                                <path
                                    d="M18 13.5C18 15.5 15.5 18 13.5 18C15.5 18 18 20.5 18 22.5C18 20.5 20.5 18 22.5 18C20.5 18 18 15.5 18 13.5Z"
                                    fill="#7c4dff"
                                />
                            </svg>
                        )}
                    </button>
                )}
            </div>
        </>
    );

    if (props.isOffline) {
        return (
            <div className="wtsg-panel wtsg-panel-day">
                {head}
                <div className="wtsg-panel-note" role="status">
                    {t.offlineReadOnly}
                </div>
            </div>
        );
    }

    if (editableRows.length === 0) {
        return (
            <div className="wtsg-panel wtsg-panel-day">
                {head}
                <div className="wtsg-panel-error">{t.daySplitNoEntries}</div>
            </div>
        );
    }

    const hours = (n: number) => formatHours(n, lang, t.hoursUnit);

    return (
        <div className="wtsg-panel wtsg-panel-day">
            {head}

            {loading ? (
                <div className="wtsg-panel-loading">
                    <span className="wtsg-spinner" aria-hidden="true" />
                    {t.loadingSubtypes}
                </div>
            ) : loadError ? (
                <div className="wtsg-panel-error">{loadError}</div>
            ) : blocks.length === 0 ? (
                <div className="wtsg-panel-error">{t.noSubtypes}</div>
            ) : (
                <>
                    {blocks.map((b) => (
                        <section
                            key={b.kind}
                            className={`wtsg-block wtsg-block-${b.kind}`}
                            aria-label={b.label}
                        >
                            <div className="wtsg-block-head">
                                <span className="wtsg-block-title">{b.label}</span>
                                <span className="wtsg-block-meta">
                                    {t.daySplitEntries(b.rows.length)} · {t.total}{" "}
                                    <strong>{hours(b.total)}</strong>
                                </span>
                            </div>
                            {b.buckets.length === 0 ? (
                                <div className="wtsg-panel-error">{t.noSubtypes}</div>
                            ) : (
                                <div className="wtsg-rows">
                                    {b.buckets.map((x) => (
                                        <SubtypeRowEditor
                                            key={x.key}
                                            id={x.key}
                                            name={x.name}
                                            value={values[b.kind]?.[x.key] ?? ""}
                                            editable={editable}
                                            isMobile={props.isMobile}
                                            remaining={b.remaining}
                                            takeRemainingLabel={t.takeRemaining}
                                            onChange={(key, v) => setValue(b.kind, key, v)}
                                        />
                                    ))}
                                </div>
                            )}
                            <div className="wtsg-summary wtsg-summary-block">
                                <div>
                                    <span>{t.total}</span>
                                    <strong>{formatNumber(b.total) || "0"}</strong>
                                </div>
                                <div>
                                    <span>{t.distributed}</span>
                                    <strong>{formatNumber(b.distributed) || "0"}</strong>
                                </div>
                                <div className={Math.abs(b.remaining) < EPSILON ? "ok" : "warn"}>
                                    <span>{t.remaining}</span>
                                    <strong>{formatNumber(b.remaining) || "0"}</strong>
                                </div>
                            </div>
                        </section>
                    ))}

                    {rowsByKind.other > 0 && (
                        <div className="wtsg-panel-note" role="status">
                            {t.daySplitOther(rowsByKind.other)}
                        </div>
                    )}

                    {missing.length > 0 && (
                        <div className="wtsg-panel-error" role="alert">
                            {missing.map((m, i) => (
                                <div key={i}>{m}</div>
                            ))}
                        </div>
                    )}

                    <details className="wtsg-preview" open={!props.isMobile}>
                        <summary>{t.daySplitPreview}</summary>
                        <ul className="wtsg-preview-list">
                            {blocks.map((b) =>
                                sortChronologically(b.rows).map((r) => {
                                    const d = b.distribution.find((x) => x.entryId === r.id);
                                    const parts = (d?.parts ?? []).filter((p) => p.hours > EPSILON);
                                    return (
                                        <li key={r.id} className="wtsg-preview-item">
                                            <span className="wtsg-preview-entry">
                                                {timeRange(r, lang) && (
                                                    <span className="wtsg-preview-time">
                                                        {timeRange(r, lang)}
                                                    </span>
                                                )}
                                                <span className="wtsg-preview-type" title={r.type}>
                                                    {r.type || "—"}
                                                </span>
                                                <span className="wtsg-preview-total">
                                                    {hours(r.total)}
                                                </span>
                                            </span>
                                            <span className="wtsg-preview-arrow" aria-hidden="true">
                                                →
                                            </span>
                                            <span className="wtsg-preview-parts">
                                                {parts.length === 0 ? (
                                                    <span className="wtsg-preview-empty">—</span>
                                                ) : (
                                                    parts.map((p) => (
                                                        <span key={p.key} className="wtsg-chip wtsg-preview-part">
                                                            {b.buckets.find((x) => x.key === p.key)?.name ?? p.key}{" "}
                                                            <strong>{hours(p.hours)}</strong>
                                                        </span>
                                                    ))
                                                )}
                                            </span>
                                        </li>
                                    );
                                }),
                            )}
                        </ul>
                    </details>

                    <div className="wtsg-actions">
                        <button
                            type="button"
                            className="wtsg-save"
                            disabled={!canSave}
                            title={!allSumsMatch ? t.saveDisabledSum : t.save}
                            onClick={() => setConfirming(true)}
                        >
                            {saving
                                ? t.saving
                                : `${t.save} (${t.daySplitEntries(editableRows.length)})`}
                        </button>
                    </div>
                </>
            )}

            {confirming && (
                <div
                    className="wtsg-modal"
                    style={MODAL_LAYER}
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="wtsg-modal-card">
                        <h4>{t.confirmTitle}</h4>
                        <p>{t.daySplitConfirmBody(editableRows.length, splitCount)}</p>
                        <div className="wtsg-modal-actions">
                            <button
                                type="button"
                                className="wtsg-btn-secondary"
                                onClick={() => setConfirming(false)}
                            >
                                {t.confirmCancel}
                            </button>
                            <button
                                type="button"
                                className="wtsg-btn-primary"
                                onClick={doSave}
                            >
                                {t.confirmOk}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
