import * as React from "react";
import { EntryRow, Lang } from "./types";
import { Strings } from "./i18n";

export interface EntryListProps {
    rows: EntryRow[];
    /** Single-select (split mode): the currently opened entry. */
    selectedId: string | null;
    onSelect: (id: string) => void;
    /** Multi-select (assign mode): checkbox per card. */
    selectable?: boolean;
    checkedIds?: Set<string>;
    onToggleCheck?: (id: string) => void;
    /** One-liner shown (with an icon) when there are no rows. */
    emptyMessage?: string;
    /** Data is still loading (e.g. offline sync) → show a spinner, not the
     *  "nothing here" empty state, while the list is empty. */
    loading?: boolean;
    /** Label shown next to the spinner while `loading` and the list is empty. */
    loadingLabel?: string;
    /** Active search term — matches are highlighted in the cards. */
    highlight?: string;
    /** Enable pull-to-refresh (mobile). */
    enablePull?: boolean;
    /** A pull-triggered refresh is in flight (shows the spinner). */
    refreshing?: boolean;
    onRefresh?: () => void;
    /** Group the cards under sticky day headers with work / travel / total
     *  sums. Only sensible while `rows` is in date order. */
    groupByDay?: boolean;
    /** UI language — drives the weekday + number formatting of day headers. */
    lang?: Lang;
    strings: Strings;
}

/** Pull distance (damped px) past which a release triggers a refresh. */
const PTR_THRESHOLD = 48;

const LOCALE: Record<Lang, string> = { de: "de-DE", en: "en-US", fr: "fr-FR" };

/** One day's worth of rows plus its sums (hours) for the group header. */
interface DayGroup {
    key: string;
    label: string;
    rows: EntryRow[];
    work: number;
    travel: number;
    total: number;
}

/** Local calendar-day key ("2025-01-31") from the row's ISO date; falls back
 *  to the formatted display date so undated rows still group consistently. */
function dayKey(r: EntryRow): string {
    if (r.dateValue) {
        const d = new Date(r.dateValue);
        if (!isNaN(d.getTime())) {
            const p = (n: number) => String(n).padStart(2, "0");
            return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
        }
    }
    return r.date || "";
}

/** Header label: "Fr, 31.01.2025" (weekday in the UI language), else the
 *  formatted date as delivered by the platform. */
function dayLabel(r: EntryRow, lang: Lang): string {
    if (r.dateValue) {
        const d = new Date(r.dateValue);
        if (!isNaN(d.getTime())) {
            try {
                const wd = new Intl.DateTimeFormat(LOCALE[lang], {
                    weekday: "short",
                }).format(d);
                return r.date ? `${wd}, ${r.date}` : wd;
            } catch {
                /* fall through */
            }
        }
    }
    return r.date || "—";
}

/** Group rows by day, keeping the incoming (date-sorted) order. */
function groupRows(rows: EntryRow[], lang: Lang): DayGroup[] {
    const groups: DayGroup[] = [];
    const byKey = new Map<string, DayGroup>();
    for (const r of rows) {
        const key = dayKey(r);
        let g = byKey.get(key);
        if (!g) {
            g = { key, label: dayLabel(r, lang), rows: [], work: 0, travel: 0, total: 0 };
            byKey.set(key, g);
            groups.push(g);
        }
        g.rows.push(r);
        const h = Number.isFinite(r.total) ? r.total : 0;
        g.total += h;
        if (r.kind === "work") g.work += h;
        else if (r.kind === "travel") g.travel += h;
    }
    return groups;
}

/** "6,5 h" — locale number with at most 2 decimals plus the unit. */
function formatHours(n: number, lang: Lang, unit: string): string {
    let s: string;
    try {
        s = new Intl.NumberFormat(LOCALE[lang], {
            maximumFractionDigits: 2,
        }).format(n);
    } catch {
        s = String(Math.round(n * 100) / 100);
    }
    return unit ? `${s} ${unit}` : s;
}

/** Wrap case-insensitive matches of `q` in `text` with a highlight <mark>. */
function renderHighlighted(text: string, q: string): React.ReactNode {
    if (!q || !text) return text;
    const lower = text.toLowerCase();
    const ql = q.toLowerCase();
    const out: React.ReactNode[] = [];
    let i = 0;
    let idx = lower.indexOf(ql);
    let k = 0;
    while (idx !== -1) {
        if (idx > i) out.push(text.slice(i, idx));
        out.push(
            <mark key={k++} className="wtsg-hl">
                {text.slice(idx, idx + ql.length)}
            </mark>,
        );
        i = idx + ql.length;
        idx = lower.indexOf(ql, i);
    }
    if (i < text.length) out.push(text.slice(i));
    return out;
}

/** Binoculars — empty-state icon. */
const Binoculars: React.FC = () => (
    <svg
        className="wtsg-empty-icon"
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M6 8V6a1.5 1.5 0 0 1 1.5-1.5h0A1.5 1.5 0 0 1 9 6v2" />
        <path d="M15 8V6a1.5 1.5 0 0 1 1.5-1.5h0A1.5 1.5 0 0 1 18 6v2" />
        <path d="M9 8.5h6" />
        <path d="M6 8 4.3 13.2M18 8l1.7 5.2" />
        <circle cx="5" cy="16" r="3.2" />
        <circle cx="19" cy="16" r="3.2" />
    </svg>
);

export const EntryList: React.FC<EntryListProps> = ({
    rows,
    selectedId,
    onSelect,
    selectable,
    checkedIds,
    onToggleCheck,
    emptyMessage,
    loading,
    loadingLabel,
    highlight,
    enablePull,
    refreshing,
    onRefresh,
    groupByDay,
    lang = "de",
    strings,
}) => {
    const activate = (id: string) => {
        if (selectable) onToggleCheck?.(id);
        else onSelect(id);
    };

    const hl = (text: string) =>
        highlight ? renderHighlighted(text, highlight) : text;

    // Pull-to-refresh (mobile): native non-passive touchmove so we can
    // preventDefault the overscroll while pulling from the top.
    const listRef = React.useRef<HTMLDivElement>(null);
    const [pull, setPull] = React.useState(0);
    const pullRef = React.useRef(0);
    const setPullVal = (v: number) => {
        pullRef.current = v;
        setPull(v);
    };

    React.useEffect(() => {
        const el = listRef.current;
        if (!el || !enablePull || !onRefresh) return;
        let startY: number | null = null;
        let active = false;
        const onStart = (e: TouchEvent) => {
            startY = el.scrollTop <= 0 ? e.touches[0].clientY : null;
            active = false;
        };
        const onMove = (e: TouchEvent) => {
            if (startY == null) return;
            const dy = e.touches[0].clientY - startY;
            if (dy > 0 && el.scrollTop <= 0) {
                active = true;
                setPullVal(Math.min(dy * 0.5, 80));
                if (e.cancelable) e.preventDefault();
            } else if (active) {
                active = false;
                setPullVal(0);
            }
        };
        const onEnd = () => {
            if (active && pullRef.current >= PTR_THRESHOLD) onRefresh();
            startY = null;
            active = false;
            setPullVal(0);
        };
        el.addEventListener("touchstart", onStart, { passive: true });
        el.addEventListener("touchmove", onMove, { passive: false });
        el.addEventListener("touchend", onEnd, { passive: true });
        el.addEventListener("touchcancel", onEnd, { passive: true });
        return () => {
            el.removeEventListener("touchstart", onStart);
            el.removeEventListener("touchmove", onMove);
            el.removeEventListener("touchend", onEnd);
            el.removeEventListener("touchcancel", onEnd);
        };
    }, [enablePull, onRefresh]);

    const renderCard = (r: EntryRow) => {
        const checked = selectable
            ? !!checkedIds?.has(r.id)
            : r.id === selectedId;
        return (
            <div
                key={r.id}
                role="option"
                aria-selected={checked}
                tabIndex={0}
                className={`wtsg-card ${checked ? "selected" : ""}`}
                onClick={() => activate(r.id)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        activate(r.id);
                    }
                }}
            >
                <div className="wtsg-card-head">
                    {selectable && (
                        <span
                            className={`wtsg-check ${checked ? "checked" : ""}`}
                            aria-hidden="true"
                        >
                            {checked && (
                                <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 16 16"
                                >
                                    <path
                                        d="M3 8.5 6.5 12 13 4.5"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            )}
                        </span>
                    )}
                    <span
                        className="wtsg-card-title"
                        title={r.name}
                    >
                        {hl(r.name)}
                    </span>
                    {!selectable && (
                        <span
                            className={`wtsg-badge ${r.completed ? "done" : "open"}`}
                            aria-hidden="true"
                        />
                    )}
                </div>
                <div className="wtsg-card-meta">
                    {r.resourceName && (
                        <span
                            className="wtsg-chip"
                            title={r.resourceName}
                        >
                            {hl(r.resourceName)}
                        </span>
                    )}
                    {r.project && (
                        <span
                            className="wtsg-chip"
                            title={r.project}
                        >
                            {hl(r.project)}
                        </span>
                    )}
                    {r.fixedPrice && (
                        <span
                            className="wtsg-chip wtsg-chip-fixed"
                            title={strings.fixedPriceChip}
                        >
                            <span aria-hidden="true">🏷️ </span>
                            {strings.fixedPriceChip}
                        </span>
                    )}
                </div>
                <div className="wtsg-card-foot">
                    {r.projectName &&
                        r.projectName !== r.project && (
                            <span
                                className="wtsg-chip wtsg-chip-project"
                                title={r.projectName}
                            >
                                {hl(r.projectName)}
                            </span>
                        )}
                    <div className="wtsg-card-total">
                        {strings.total}:{" "}
                        <strong>{r.totalFormatted || "—"}</strong>
                    </div>
                </div>
            </div>
        );
    };

    const ptr =
        enablePull && (pull > 0 || refreshing) ? (
            <div
                className="wtsg-ptr"
                style={{ height: refreshing ? 44 : pull }}
                aria-hidden="true"
            >
                {refreshing ? (
                    <span className="wtsg-spinner" />
                ) : (
                    <svg
                        className={`wtsg-ptr-arrow ${
                            pull >= PTR_THRESHOLD ? "armed" : ""
                        }`}
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M12 5v14M6 13l6 6 6-6" />
                    </svg>
                )}
            </div>
        ) : null;

    return (
        <div
            ref={listRef}
            className={`wtsg-list ${rows.length === 0 ? "wtsg-list-empty" : ""}`}
            role="listbox"
            aria-multiselectable={selectable || undefined}
            aria-label="entries"
        >
            {ptr}
            {rows.length === 0 ? (
                loading ? (
                    <div className="wtsg-empty-state" role="status">
                        <span className="wtsg-spinner" aria-hidden="true" />
                        <span>{loadingLabel ?? strings.loading}</span>
                    </div>
                ) : (
                    <div className="wtsg-empty-state" role="status">
                        <Binoculars />
                        <span>{emptyMessage ?? strings.noResults}</span>
                    </div>
                )
            ) : groupByDay ? (
                groupRows(rows, lang).map((g) => (
                    <div key={g.key} className="wtsg-day" role="group" aria-label={g.label}>
                        <div className="wtsg-day-head">
                            <span className="wtsg-day-label">{g.label}</span>
                            <span className="wtsg-day-sums">
                                <span className="wtsg-day-sum wtsg-day-sum-work">
                                    <span className="wtsg-day-sum-label">{strings.dayWork}</span>{" "}
                                    <strong>{formatHours(g.work, lang, strings.hoursUnit)}</strong>
                                </span>
                                <span className="wtsg-day-sum wtsg-day-sum-travel">
                                    <span className="wtsg-day-sum-label">{strings.dayTravel}</span>{" "}
                                    <strong>{formatHours(g.travel, lang, strings.hoursUnit)}</strong>
                                </span>
                                <span className="wtsg-day-sum wtsg-day-sum-total">
                                    <span className="wtsg-day-sum-label">{strings.total}</span>{" "}
                                    <strong>{formatHours(g.total, lang, strings.hoursUnit)}</strong>
                                </span>
                            </span>
                        </div>
                        <div className="wtsg-day-cards">
                            {g.rows.map(renderCard)}
                        </div>
                    </div>
                ))
            ) : (
                rows.map(renderCard)
            )}
        </div>
    );
};
