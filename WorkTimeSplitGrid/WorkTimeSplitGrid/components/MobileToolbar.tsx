import * as React from "react";
import { Strings } from "./i18n";
import { InfoPopover } from "./InfoPopover";

export interface SheetOption {
    value: string;
    label: string;
}

export interface MobileToolbarProps {
    strings: Strings;
    search: string;
    onSearch: (v: string) => void;
    mode: "split" | "assign";
    onMode: (m: "split" | "assign") => void;
    period: string;
    periodOptions: SheetOption[];
    onPeriod: (v: string) => void;
    group: string;
    groupOptions: SheetOption[];
    onGroup: (v: string) => void;
    sort: string;
    sortOptions: SheetOption[];
    onSort: (v: string) => void;
    /** Scope switch: admins may toggle "all hours"; others see it locked. */
    isAdmin: boolean;
    allHours: boolean;
    onToggleAllHours: () => void;
    /** Settings that differ from the defaults (badge on the filter button). */
    activeCount: number;
    /** One-line summary of the active view ("Alle · Tag · Datum ↓"). */
    summary: string;
    /** Opens the debug / info dialog. */
    onInfo: () => void;
}

/*
 * Layout-critical styles of the overlay are inline (see InfoPopover): after an
 * update the host may still serve the previous stylesheet, and an unstyled
 * sheet would render in the flow instead of floating above the list.
 */
const BACKDROP_STYLE: React.CSSProperties = {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 50,
    background: "rgba(0, 0, 0, 0.32)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
};

const SHEET_STYLE: React.CSSProperties = {
    background: "#fff",
    borderRadius: "14px 14px 0 0",
    boxShadow: "0 -6px 24px rgba(0, 0, 0, 0.18)",
    padding: "8px 16px 16px",
    maxHeight: "85%",
    overflowY: "auto",
    boxSizing: "border-box",
};

/** Row of selectable chips (single choice). */
const ChipGroup: React.FC<{
    label: string;
    value: string;
    options: SheetOption[];
    onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => (
    <div className="wtsg-sheet-section" role="radiogroup" aria-label={label}>
        <div className="wtsg-sheet-label">{label}</div>
        <div className="wtsg-sheet-chips">
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={o.value === value}
                    className={`wtsg-sheet-chip ${o.value === value ? "active" : ""}`}
                    onClick={() => onChange(o.value)}
                >
                    {o.label}
                </button>
            ))}
        </div>
    </div>
);

/**
 * Phone toolbar: search + filter button (with a badge of non-default
 * settings) + info, then the mode toggle and a one-line summary of the active
 * view. Period, grouping, sort and the scope switch live in a bottom sheet —
 * the list keeps most of the screen.
 */
export const MobileToolbar: React.FC<MobileToolbarProps> = (p) => {
    const t = p.strings;
    const [open, setOpen] = React.useState(false);

    React.useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open]);

    return (
        <div className="wtsg-mtoolbar">
            <div className="wtsg-searchrow">
                <input
                    type="search"
                    className="wtsg-search"
                    placeholder={t.searchPlaceholder}
                    value={p.search}
                    onChange={(e) => p.onSearch(e.target.value)}
                    aria-label={t.searchPlaceholder}
                />
                <button
                    type="button"
                    className={`wtsg-infobtn wtsg-filterbtn ${p.activeCount ? "active" : ""}`}
                    aria-label={t.sheetTitle}
                    title={t.sheetTitle}
                    aria-haspopup="dialog"
                    aria-expanded={open}
                    onClick={() => setOpen(true)}
                    style={{ position: "relative" }}
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M4 6h16M7 12h10M10 18h4" />
                    </svg>
                    {p.activeCount > 0 && (
                        <span className="wtsg-filterbadge" aria-hidden="true">
                            {p.activeCount}
                        </span>
                    )}
                </button>
                <button
                    type="button"
                    className="wtsg-infobtn"
                    aria-label={t.infoTitle}
                    title={t.infoTitle}
                    onClick={p.onInfo}
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 11v5" />
                        <path d="M12 8h.01" />
                    </svg>
                </button>
            </div>
            <div className="wtsg-mrow">
                <div
                    className="wtsg-toggle"
                    role="tablist"
                    aria-label={`${t.modeSplit} / ${t.modeAssign}`}
                >
                    {(["split", "assign"] as const).map((m) => (
                        <button
                            key={m}
                            type="button"
                            role="tab"
                            aria-selected={p.mode === m}
                            className={p.mode === m ? "active" : ""}
                            onClick={() => p.onMode(m)}
                        >
                            {m === "split" ? t.modeSplit : t.modeAssign}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    className="wtsg-msummary"
                    onClick={() => setOpen(true)}
                    title={p.summary}
                >
                    {p.summary}
                </button>
                {p.mode === "split" && (
                    <InfoPopover
                        label={t.daySplitInfoTitle}
                        title={t.daySplitInfoTitle}
                        points={t.daySplitInfoPoints}
                    />
                )}
            </div>

            {open && (
                <div
                    className="wtsg-sheet-backdrop"
                    style={BACKDROP_STYLE}
                    onClick={() => setOpen(false)}
                >
                    <div
                        className="wtsg-sheet"
                        role="dialog"
                        aria-modal="true"
                        aria-label={t.sheetTitle}
                        style={SHEET_STYLE}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="wtsg-sheet-grip" aria-hidden="true" />
                        <h4 className="wtsg-sheet-title">{t.sheetTitle}</h4>
                        <ChipGroup
                            label={t.periodLabel}
                            value={p.period}
                            options={p.periodOptions}
                            onChange={p.onPeriod}
                        />
                        <ChipGroup
                            label={t.groupLabel}
                            value={p.group}
                            options={p.groupOptions}
                            onChange={p.onGroup}
                        />
                        <ChipGroup
                            label={t.sortLabel}
                            value={p.sort}
                            options={p.sortOptions}
                            onChange={p.onSort}
                        />
                        <div className="wtsg-sheet-section wtsg-sheet-switchrow">
                            <span className="wtsg-sheet-label">
                                {!p.isAdmin && <span aria-hidden="true">🔒 </span>}
                                {t.allHours}
                            </span>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={p.allHours}
                                aria-label={t.scopeToggle}
                                disabled={!p.isAdmin}
                                title={!p.isAdmin ? t.myHoursLocked : t.scopeToggle}
                                className={`wtsg-scope ${p.allHours ? "on" : ""} ${
                                    !p.isAdmin ? "locked" : ""
                                }`}
                                onClick={p.onToggleAllHours}
                            >
                                <span className="wtsg-switch" aria-hidden="true">
                                    <span className="wtsg-switch-knob" />
                                </span>
                            </button>
                        </div>
                        <button
                            type="button"
                            className="wtsg-save wtsg-sheet-done"
                            onClick={() => setOpen(false)}
                        >
                            {t.sheetDone}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
