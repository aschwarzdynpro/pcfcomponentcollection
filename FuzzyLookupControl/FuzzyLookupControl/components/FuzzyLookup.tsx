import * as React from "react";
import * as ReactDOM from "react-dom";
import { ResultRow } from "./ResultRow";
import type { UiStrings } from "./lang";
import type { LookupRecord, SuggestionSection } from "../services/types";
import {
    getFavorites,
    getRecentlyUsed,
    isFavorite as isFavoriteFn,
    pushRecentlyUsed,
    toggleFavorite as toggleFavoriteFn,
    type StorageScope,
} from "../services/storage";
import { searchRecords, type SearchOutcome } from "../services/dataverseSearch";

interface PcfWebApi {
    retrieveMultipleRecords: (
        entityType: string,
        options: string,
        maxPageSize?: number,
    ) => Promise<{ entities: Record<string, unknown>[] }>;
}

export interface FuzzyLookupProps {
    selected: LookupRecord | null;
    targetEntity: string;
    primaryName: string;
    columns: string[];          // ordered, 1..4 elements; column 0 = primary
    columnHeaders: string[];    // parallel
    placeholder: string;
    pageSize: number;
    disabled: boolean;
    enableQuickCreate: boolean;
    enableFavorites: boolean;
    enableRecentlyUsed: boolean;
    webApi: PcfWebApi;
    userId: string;
    strings: UiStrings;
    onChange: (rec: LookupRecord | null) => void;
    onOpenRecord: (rec: LookupRecord) => void;
    onQuickCreate: () => void;
}

const DEBOUNCE_MS = 200;
const MIN_CHARS = 2;

export const FuzzyLookup: React.FC<FuzzyLookupProps> = (props) => {
    const {
        selected,
        targetEntity,
        primaryName,
        columns,
        columnHeaders,
        placeholder,
        pageSize,
        disabled,
        enableQuickCreate,
        enableFavorites,
        enableRecentlyUsed,
        webApi,
        userId,
        strings,
        onChange,
        onOpenRecord,
        onQuickCreate,
    } = props;

    const [term, setTerm] = React.useState("");
    const [open, setOpen] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [searchOutcome, setSearchOutcome] = React.useState<SearchOutcome | null>(null);
    const [activeIdx, setActiveIdx] = React.useState(0);
    const [favoritesTick, setFavoritesTick] = React.useState(0);

    const inputRef = React.useRef<HTMLInputElement>(null);
    const hostRef = React.useRef<HTMLDivElement>(null);
    const abortRef = React.useRef<AbortController | null>(null);
    const debounceRef = React.useRef<number | null>(null);

    // Dropdown is portalled into document.body so containers with
    // overflow:hidden (Quick-Create side-panels, Business-Process flyouts,
    // dialogs, …) cannot clip it. The position is computed from the host
    // div's bounding rect and re-computed on resize / ancestor scroll so
    // the dropdown follows the input.
    const [anchorRect, setAnchorRect] = React.useState<{
        top: number;
        left: number;
        width: number;
    } | null>(null);
    const recomputeAnchor = React.useCallback(() => {
        const el = hostRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        setAnchorRect({ top: r.bottom, left: r.left, width: r.width });
    }, []);

    const scope: StorageScope = React.useMemo(
        () => ({ userId, entity: targetEntity, primaryName }),
        [userId, targetEntity, primaryName],
    );

    // Compose the suggestion sections from favorites + MRU + search results.
    const sections = React.useMemo<SuggestionSection[]>(() => {
        const out: SuggestionSection[] = [];
        const trimmed = term.trim();
        const isSearching = trimmed.length >= MIN_CHARS;

        if (!isSearching) {
            if (enableFavorites) {
                const favs = getFavorites(scope);
                if (favs.length > 0) out.push({ kind: "favorites", items: favs });
            }
            if (enableRecentlyUsed) {
                const mru = getRecentlyUsed(scope);
                if (mru.length > 0) out.push({ kind: "recent", items: mru });
            }
        } else if (searchOutcome) {
            out.push({ kind: "results", items: searchOutcome.records });
        }
        return out;
        // favoritesTick forces re-read when the user pins/unpins.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [term, enableFavorites, enableRecentlyUsed, searchOutcome, scope, favoritesTick]);

    const flatRecords = React.useMemo<LookupRecord[]>(
        () => sections.flatMap((s) => s.items),
        [sections],
    );

    // Keep the latest webApi accessible without putting it in the effect's
    // dep array — PCF hands us a *new* `context.webAPI` reference on every
    // internal render, so including it there would cancel the debounce
    // timer before it ever fires and the search would never actually run.
    const webApiRef = React.useRef(webApi);
    React.useEffect(() => {
        webApiRef.current = webApi;
    }, [webApi]);

    // Debounced search. Re-runs only when the inputs that change *what* gets
    // searched change — never just because the host swapped the webAPI ref.
    React.useEffect(() => {
        const trimmed = term.trim();
        // eslint-disable-next-line no-console
        console.log("FuzzyLookupControl effect", {
            term: trimmed,
            targetEntity,
            columns,
            primaryName,
            pageSize,
        });
        if (debounceRef.current !== null) {
            window.clearTimeout(debounceRef.current);
            debounceRef.current = null;
        }
        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
        }
        if (trimmed.length < MIN_CHARS) {
            setSearchOutcome(null);
            setBusy(false);
            return;
        }
        setBusy(true);
        debounceRef.current = window.setTimeout(() => {
            const ctrl = new AbortController();
            abortRef.current = ctrl;
            searchRecords(webApiRef.current, {
                term: trimmed,
                targetEntity,
                columns,
                primaryName,
                pageSize,
                signal: ctrl.signal,
            })
                .then((outcome) => {
                    if (ctrl.signal.aborted) return;
                    setSearchOutcome(outcome);
                    setActiveIdx(0);
                })
                .catch((e: unknown) => {
                    if ((e as { name?: string })?.name === "AbortError") return;
                    // eslint-disable-next-line no-console
                    console.error("FuzzyLookupControl: search failed", e);
                    setSearchOutcome({ records: [], source: "search" });
                })
                .finally(() => {
                    if (!ctrl.signal.aborted) setBusy(false);
                });
        }, DEBOUNCE_MS);

        return () => {
            if (debounceRef.current !== null) {
                window.clearTimeout(debounceRef.current);
                debounceRef.current = null;
            }
        };
    }, [term, targetEntity, columns, primaryName, pageSize]);

    // Close the dropdown when the user clicks outside the control. Because
    // the dropdown lives in a portal under document.body, we have to check
    // both the host div *and* a tagged "dropdown" element when deciding
    // whether the click was inside the control.
    React.useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            const target = e.target as Node | null;
            if (!target) return;
            if (hostRef.current?.contains(target)) return;
            if ((target as HTMLElement).closest?.("[data-flc-dropdown]")) return;
            setOpen(false);
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, [open]);

    // While the dropdown is open, keep its position in sync with the host
    // div — re-measure on every resize and on any ancestor scroll. Using
    // `capture: true` so scrolls inside arbitrary scroll containers (e.g.
    // a Quick-Create panel's main scroll area) are picked up too.
    React.useEffect(() => {
        if (!open) return;
        recomputeAnchor();
        const onResize = () => recomputeAnchor();
        const onScroll = () => recomputeAnchor();
        window.addEventListener("resize", onResize);
        window.addEventListener("scroll", onScroll, true);
        return () => {
            window.removeEventListener("resize", onResize);
            window.removeEventListener("scroll", onScroll, true);
        };
    }, [open, recomputeAnchor]);

    const commitSelection = (rec: LookupRecord) => {
        if (enableRecentlyUsed) pushRecentlyUsed(scope, rec);
        onChange(rec);
        setOpen(false);
        setTerm("");
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActiveIdx((i) => Math.min(i + 1, Math.max(flatRecords.length - 1, 0)));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            const rec = flatRecords[activeIdx];
            if (rec) {
                e.preventDefault();
                commitSelection(rec);
            }
        } else if (e.key === "Escape") {
            setOpen(false);
        }
    };

    const renderSelected = () => {
        if (!selected) return null;
        return (
            <span className="flc-chip">
                <span
                    className="flc-chip-label"
                    onClick={() => onOpenRecord(selected)}
                    title={strings.openRecord + ": " + selected.primaryName}
                >
                    {selected.primaryName}
                </span>
                {!disabled && (
                    <button
                        type="button"
                        className="flc-chip-clear"
                        aria-label={strings.clearSelection}
                        title={strings.clearSelection}
                        onClick={() => onChange(null)}
                    >
                        ×
                    </button>
                )}
            </span>
        );
    };

    const sectionHeaderText = (kind: SuggestionSection["kind"]): string => {
        if (kind === "favorites") return strings.favoritesHeader;
        if (kind === "recent") return strings.recentHeader;
        return strings.resultsHeader;
    };

    // Compute the absolute index of each item across all sections so keyboard
    // navigation can address them via a single integer.
    let runningIdx = 0;

    return (
        <div className="flc-host" ref={hostRef}>
            <div
                className={`flc-input-wrap ${disabled ? "is-disabled" : ""} ${selected ? "has-selection" : ""}`}
                onClick={() => {
                    if (disabled) return;
                    inputRef.current?.focus();
                    setOpen(true);
                }}
            >
                {selected && term === "" ? (
                    renderSelected()
                ) : (
                    <input
                        ref={inputRef}
                        type="text"
                        className="flc-input"
                        value={term}
                        placeholder={selected ? selected.primaryName : placeholder}
                        disabled={disabled}
                        onChange={(e) => {
                            setTerm(e.target.value);
                            setOpen(true);
                        }}
                        onFocus={() => setOpen(true)}
                        onKeyDown={onKeyDown}
                        aria-autocomplete="list"
                        aria-expanded={open}
                    />
                )}
                {!disabled && selected && (
                    <button
                        type="button"
                        className="flc-input-clear"
                        aria-label={strings.clearSelection}
                        title={strings.clearSelection}
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange(null);
                            setTerm("");
                            inputRef.current?.focus();
                        }}
                    >
                        ×
                    </button>
                )}
            </div>

            {open && !disabled && anchorRect && ReactDOM.createPortal(
                <div
                    className="flc-dropdown"
                    role="listbox"
                    data-flc-dropdown
                    style={{
                        position: "fixed",
                        top: anchorRect.top + 2,
                        left: anchorRect.left,
                        width: anchorRect.width,
                        right: "auto",
                        zIndex: 2147483600,
                        // Drive the grid template via CSS variable so the row
                        // layout adapts to the configured column count + the
                        // optional favorite-toggle column.
                        ["--flc-col-count" as unknown as string]:
                            columns.length + (enableFavorites ? 1 : 0),
                    }}
                >
                    {term.trim().length > 0 && term.trim().length < MIN_CHARS && (
                        <div className="flc-status">{strings.minChars}</div>
                    )}
                    {busy && <div className="flc-status">{strings.searching}</div>}
                    {!busy && term.trim().length >= MIN_CHARS && flatRecords.length === 0 && (
                        <div className="flc-status">{strings.noResults}</div>
                    )}
                    {searchOutcome?.source === "odata" && (
                        <div className="flc-banner" role="status">
                            {strings.searchUnavailableHint}
                        </div>
                    )}
                    {sections.map((section) => {
                        const startIdx = runningIdx;
                        runningIdx += section.items.length;
                        return (
                            <div key={section.kind} className={`flc-section flc-section--${section.kind}`}>
                                <div className="flc-section-header">{sectionHeaderText(section.kind)}</div>
                                {section.items.map((rec, i) => {
                                    const absoluteIdx = startIdx + i;
                                    return (
                                        <ResultRow
                                            key={`${section.kind}-${rec.id}`}
                                            record={rec}
                                            columns={columns}
                                            columnHeaders={columnHeaders}
                                            primaryName={primaryName}
                                            isActive={absoluteIdx === activeIdx}
                                            showHeaderRow={i === 0}
                                            showFavoriteToggle={enableFavorites}
                                            isFavorite={enableFavorites && isFavoriteFn(scope, rec.id)}
                                            onSelect={commitSelection}
                                            onToggleFavorite={(r) => {
                                                toggleFavoriteFn(scope, r);
                                                setFavoritesTick((t) => t + 1);
                                            }}
                                            pinTooltip={strings.pinTooltip}
                                            unpinTooltip={strings.unpinTooltip}
                                            onMouseEnter={() => setActiveIdx(absoluteIdx)}
                                        />
                                    );
                                })}
                            </div>
                        );
                    })}
                    {enableQuickCreate && (
                        <div className="flc-footer">
                            <button
                                type="button"
                                className="flc-quick-create"
                                onClick={onQuickCreate}
                            >
                                {strings.quickCreate}
                            </button>
                        </div>
                    )}
                </div>,
                document.body,
            )}
        </div>
    );
};
