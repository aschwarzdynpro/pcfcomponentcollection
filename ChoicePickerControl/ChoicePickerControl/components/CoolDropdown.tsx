import * as React from "react";
import * as ReactDOM from "react-dom";
import { Lang, STRINGS } from "./lang";

export interface ChoiceOption {
    value: number;
    label: string;
    /** Raw Dataverse choice color (e.g. "#0000ff") — may be empty. */
    color: string;
}

export interface CoolDropdownProps {
    options: ChoiceOption[];
    multi: boolean;
    /** Single-select: the chosen value (or null). Ignored when `multi`. */
    selectedSingle: number | null;
    /** Multi-select: the chosen values. Ignored when not `multi`. */
    selectedMulti: number[];
    placeholder: string | null;
    disabled: boolean;
    showColors: boolean;
    /** "auto" | "always" | "never" — search box visibility. */
    searchBox: string;
    clearable: boolean;
    lang: Lang;
    /** Emits the new selection. number|null for single, number[] for multi. */
    onChange: (next: number | number[] | null) => void;
}

// Stable, pleasant fallback palette for choices that have no color configured
// in Dataverse. Indexed by the option's position so a given choice always gets
// the same color across renders.
const FALLBACK_PALETTE = [
    "#0f6cbd", "#107c10", "#c50f1f", "#8764b8", "#ca5010",
    "#008272", "#e3008c", "#5c2e91", "#986f0b", "#005b70",
    "#a4262c", "#498205", "#4f6bed", "#c239b3", "#ac4f00",
];

const SEARCH_AUTO_THRESHOLD = 8;

function resolveColor(
    opt: ChoiceOption,
    index: number,
    showColors: boolean,
): string | null {
    if (!showColors) return null;
    const c = (opt.color || "").trim();
    if (c) return c;
    return FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
}

/** Converts "#rgb" / "#rrggbb" to an rgba() string; null when unparseable. */
function hexToRgba(hex: string, alpha: number): string | null {
    let h = hex.replace("#", "").trim();
    if (h.length === 3) {
        h = h.split("").map((ch) => ch + ch).join("");
    }
    if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const CoolDropdown: React.FC<CoolDropdownProps> = (props) => {
    const t = STRINGS[props.lang];
    const placeholder = props.placeholder ?? t.placeholder;

    const [open, setOpen] = React.useState(false);
    const [filter, setFilter] = React.useState("");
    const [activeIndex, setActiveIndex] = React.useState(-1);
    const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null);

    const wrapperRef = React.useRef<HTMLDivElement>(null);
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const triggerRef = React.useRef<HTMLDivElement>(null);
    const searchInputRef = React.useRef<HTMLInputElement>(null);
    const listRef = React.useRef<HTMLUListElement>(null);
    const [listboxId] = React.useState(
        () => `cpc-list-${Math.random().toString(36).slice(2, 9)}`,
    );

    // Index the options by value for O(1) label/color lookup when rendering the
    // current selection (single value or multi chips).
    const byValue = React.useMemo(() => {
        const m = new Map<number, { opt: ChoiceOption; index: number }>();
        props.options.forEach((opt, index) => m.set(opt.value, { opt, index }));
        return m;
    }, [props.options]);

    const filtered = React.useMemo(() => {
        const q = filter.trim().toLowerCase();
        if (!q) return props.options;
        return props.options.filter((o) => o.label.toLowerCase().includes(q));
    }, [filter, props.options]);

    const showSearch =
        props.searchBox === "always" ||
        (props.searchBox !== "never" &&
            props.options.length >= SEARCH_AUTO_THRESHOLD);

    const selectedSet = React.useMemo(
        () => new Set(props.multi ? props.selectedMulti : []),
        [props.multi, props.selectedMulti],
    );

    const hasSelection = props.multi
        ? props.selectedMulti.length > 0
        : props.selectedSingle !== null && props.selectedSingle !== undefined;

    // ---- positioning: portal the dropdown under the trigger and keep it
    //      glued there through ancestor scroll / resize (forms, BPF flyouts and
    //      dialogs all clip with overflow:hidden, hence the body portal). ----
    React.useLayoutEffect(() => {
        if (!open) {
            setAnchorRect(null);
            return;
        }
        const recalc = () => {
            if (wrapperRef.current) {
                setAnchorRect(wrapperRef.current.getBoundingClientRect());
            }
        };
        recalc();
        window.addEventListener("resize", recalc);
        window.addEventListener("scroll", recalc, true);
        return () => {
            window.removeEventListener("resize", recalc);
            window.removeEventListener("scroll", recalc, true);
        };
    }, [open]);

    // Outside-click closer — spares both the trigger and the portaled dropdown.
    React.useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                !wrapperRef.current?.contains(target) &&
                !dropdownRef.current?.contains(target)
            ) {
                close();
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Focus the search box (or the list) when the dropdown opens, and seed the
    // keyboard highlight on the first selected/first option.
    React.useEffect(() => {
        if (!open) return;
        if (showSearch && searchInputRef.current) {
            searchInputRef.current.focus();
        }
        const firstSelected = filtered.findIndex((o) =>
            props.multi
                ? selectedSet.has(o.value)
                : o.value === props.selectedSingle,
        );
        setActiveIndex(firstSelected >= 0 ? firstSelected : filtered.length ? 0 : -1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Keep the keyboard-highlighted option scrolled into view.
    React.useEffect(() => {
        if (!open || activeIndex < 0 || !listRef.current) return;
        const el = listRef.current.querySelector<HTMLElement>(
            `[data-cpc-index="${activeIndex}"]`,
        );
        el?.scrollIntoView({ block: "nearest" });
    }, [activeIndex, open]);

    const close = () => {
        setOpen(false);
        setFilter("");
        setActiveIndex(-1);
    };

    const toggleOpen = () => {
        if (props.disabled) return;
        setOpen((o) => !o);
    };

    const commit = (value: number) => {
        if (props.multi) {
            const set = new Set(props.selectedMulti);
            if (set.has(value)) {
                set.delete(value);
            } else {
                set.add(value);
            }
            // Preserve the option order from Dataverse, not click order.
            const next = props.options
                .map((o) => o.value)
                .filter((v) => set.has(v));
            props.onChange(next);
            // multi stays open for rapid multi-pick
        } else {
            props.onChange(value);
            close();
            triggerRef.current?.focus();
        }
    };

    const clearAll = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        props.onChange(props.multi ? [] : null);
    };

    const removeChip = (value: number, e: React.MouseEvent) => {
        e.stopPropagation();
        const next = props.selectedMulti.filter((v) => v !== value);
        props.onChange(next);
    };

    const selectAll = () => {
        props.onChange(props.options.map((o) => o.value));
    };

    const onTriggerKeyDown = (e: React.KeyboardEvent) => {
        if (props.disabled) return;
        if (!open) {
            if (
                e.key === "Enter" ||
                e.key === " " ||
                e.key === "ArrowDown" ||
                e.key === "ArrowUp"
            ) {
                e.preventDefault();
                setOpen(true);
            }
            return;
        }
        handleListKeys(e);
    };

    const handleListKeys = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            e.preventDefault();
            close();
            triggerRef.current?.focus();
            return;
        }
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
            return;
        }
        if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(0, i - 1));
            return;
        }
        if (e.key === "Home") {
            e.preventDefault();
            setActiveIndex(filtered.length ? 0 : -1);
            return;
        }
        if (e.key === "End") {
            e.preventDefault();
            setActiveIndex(filtered.length - 1);
            return;
        }
        if (e.key === "Enter") {
            e.preventDefault();
            if (activeIndex >= 0 && activeIndex < filtered.length) {
                commit(filtered[activeIndex].value);
            }
            return;
        }
    };

    // ---------- render helpers ----------

    const renderTriggerContent = () => {
        if (!hasSelection) {
            return <span className="cpc-placeholder">{placeholder}</span>;
        }
        if (props.multi) {
            return (
                <span className="cpc-chips">
                    {props.selectedMulti.map((v) => {
                        const hit = byValue.get(v);
                        if (!hit) return null;
                        const color = resolveColor(
                            hit.opt,
                            hit.index,
                            props.showColors,
                        );
                        const tint = color ? hexToRgba(color, 0.14) : null;
                        return (
                            <span
                                key={v}
                                className="cpc-chip"
                                style={
                                    tint
                                        ? {
                                              background: tint,
                                              borderColor: color ?? undefined,
                                          }
                                        : undefined
                                }
                            >
                                {color && (
                                    <span
                                        className="cpc-dot"
                                        style={{ background: color }}
                                        aria-hidden="true"
                                    />
                                )}
                                <span className="cpc-chip-label">
                                    {hit.opt.label}
                                </span>
                                {!props.disabled && (
                                    <button
                                        type="button"
                                        className="cpc-chip-remove"
                                        aria-label={t.remove(hit.opt.label)}
                                        title={t.remove(hit.opt.label)}
                                        onClick={(e) => removeChip(v, e)}
                                        // keep the dropdown trigger from toggling
                                        onMouseDown={(e) => e.stopPropagation()}
                                    >
                                        ×
                                    </button>
                                )}
                            </span>
                        );
                    })}
                </span>
            );
        }
        // single
        const hit =
            props.selectedSingle !== null
                ? byValue.get(props.selectedSingle)
                : undefined;
        if (!hit) {
            return <span className="cpc-placeholder">{placeholder}</span>;
        }
        const color = resolveColor(hit.opt, hit.index, props.showColors);
        return (
            <span className="cpc-single">
                {color && (
                    <span
                        className="cpc-dot"
                        style={{ background: color }}
                        aria-hidden="true"
                    />
                )}
                <span className="cpc-single-label">{hit.opt.label}</span>
            </span>
        );
    };

    const triggerTitle = props.multi
        ? hasSelection
            ? t.selectedCount(props.selectedMulti.length)
            : placeholder
        : undefined;

    return (
        <div
            ref={wrapperRef}
            className={`cpc-root${props.disabled ? " cpc-disabled" : ""}${open ? " cpc-open" : ""}`}
        >
            <div
                ref={triggerRef}
                className="cpc-trigger"
                role="combobox"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={listboxId}
                aria-label={t.open}
                aria-disabled={props.disabled}
                title={triggerTitle}
                tabIndex={props.disabled ? -1 : 0}
                onClick={toggleOpen}
                onKeyDown={onTriggerKeyDown}
            >
                <span className="cpc-value">{renderTriggerContent()}</span>

                {props.clearable && hasSelection && !props.disabled && (
                    <button
                        type="button"
                        className="cpc-clear"
                        aria-label={t.clear}
                        title={t.clear}
                        onClick={clearAll}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        ×
                    </button>
                )}

                <span className="cpc-caret" aria-hidden="true">
                    <svg viewBox="0 0 12 12" width="12" height="12">
                        <path
                            d="M2.5 4.5 6 8l3.5-3.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </span>
            </div>

            {open &&
                anchorRect &&
                ReactDOM.createPortal(
                    <div
                        ref={dropdownRef}
                        className="cpc-dropdown"
                        data-cpc-dropdown=""
                        style={{
                            position: "fixed",
                            top: anchorRect.bottom + 4,
                            left: anchorRect.left,
                            width: anchorRect.width,
                        }}
                        onKeyDown={handleListKeys}
                    >
                        {showSearch && (
                            <div className="cpc-search-wrap">
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    className="cpc-search"
                                    placeholder={t.search}
                                    value={filter}
                                    onChange={(e) => {
                                        setFilter(e.target.value);
                                        setActiveIndex(0);
                                    }}
                                />
                            </div>
                        )}

                        <ul
                            ref={listRef}
                            id={listboxId}
                            className="cpc-list"
                            role="listbox"
                            aria-multiselectable={props.multi}
                        >
                            {filtered.length === 0 && (
                                <li className="cpc-empty">{t.noResults}</li>
                            )}
                            {filtered.map((o, i) => {
                                const globalIndex =
                                    byValue.get(o.value)?.index ?? i;
                                const color = resolveColor(
                                    o,
                                    globalIndex,
                                    props.showColors,
                                );
                                const isSelected = props.multi
                                    ? selectedSet.has(o.value)
                                    : o.value === props.selectedSingle;
                                const isActive = i === activeIndex;
                                return (
                                    <li
                                        key={o.value}
                                        data-cpc-index={i}
                                        role="option"
                                        aria-selected={isSelected}
                                        className={`cpc-option${isSelected ? " cpc-option-selected" : ""}${isActive ? " cpc-option-active" : ""}`}
                                        onMouseEnter={() => setActiveIndex(i)}
                                        onClick={() => commit(o.value)}
                                    >
                                        {props.multi && (
                                            <span
                                                className={`cpc-check${isSelected ? " cpc-check-on" : ""}`}
                                                style={
                                                    isSelected && color
                                                        ? {
                                                              background: color,
                                                              borderColor: color,
                                                          }
                                                        : undefined
                                                }
                                                aria-hidden="true"
                                            >
                                                {isSelected && (
                                                    <svg
                                                        viewBox="0 0 12 12"
                                                        width="10"
                                                        height="10"
                                                    >
                                                        <path
                                                            d="M2.5 6.5 5 9l4.5-5"
                                                            fill="none"
                                                            stroke="#ffffff"
                                                            strokeWidth="1.8"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                        />
                                                    </svg>
                                                )}
                                            </span>
                                        )}
                                        {!props.multi && color && (
                                            <span
                                                className="cpc-dot"
                                                style={{ background: color }}
                                                aria-hidden="true"
                                            />
                                        )}
                                        {props.multi && color && (
                                            <span
                                                className="cpc-dot cpc-dot-sm"
                                                style={{ background: color }}
                                                aria-hidden="true"
                                            />
                                        )}
                                        <span className="cpc-option-label">
                                            {o.label}
                                        </span>
                                        {!props.multi && isSelected && (
                                            <span
                                                className="cpc-option-tick"
                                                aria-hidden="true"
                                            >
                                                <svg
                                                    viewBox="0 0 12 12"
                                                    width="12"
                                                    height="12"
                                                >
                                                    <path
                                                        d="M2.5 6.5 5 9l4.5-5"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="1.6"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    />
                                                </svg>
                                            </span>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>

                        {props.multi && props.options.length > 0 && (
                            <div className="cpc-footer">
                                <button
                                    type="button"
                                    className="cpc-footer-btn"
                                    onClick={selectAll}
                                >
                                    {t.selectAll}
                                </button>
                                <button
                                    type="button"
                                    className="cpc-footer-btn"
                                    onClick={() => clearAll()}
                                    disabled={!hasSelection}
                                >
                                    {t.clearAll}
                                </button>
                            </div>
                        )}
                    </div>,
                    document.body,
                )}
        </div>
    );
};
