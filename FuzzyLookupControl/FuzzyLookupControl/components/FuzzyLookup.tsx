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
import { resolveFilterTokens } from "../services/tokens";
import {
    fetchQuickViewForm,
    fetchRecordValues,
    type QuickViewForm,
    type QvfRecordValues,
} from "../services/quickViewForm";

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
    /** Plural URL segment for the target entity. Required for the
     * Quick-View-Form preview record fetch; ignored when previewFormId
     * is unset. Sourced from EntityDefinitions.EntitySetName. */
    entitySetName?: string;
    primaryName: string;
    columns: string[];          // ordered, 1..4 elements; column 0 = card title, 1..n stacked subtitles
    iconUrl?: string;           // table icon (SVG web resource URL), shown next to the chip and on each card
    additionalFilter?: string;  // maker-defined OData filter with {record.…}/{user.…} tokens
    /** Optional Quick-View-Form GUID. When set, the long-press preview
     * modal renders the form's fields (sections + labels + live values)
     * instead of just the configured columns. Falls back silently to
     * the configured-columns view if the form can't be loaded. */
    previewFormId?: string;
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
    onOpenLookupDialog: () => void;
}

const DEBOUNCE_MS = 200;
const MIN_CHARS = 2;

export const FuzzyLookup: React.FC<FuzzyLookupProps> = (props) => {
    const {
        selected,
        targetEntity,
        entitySetName,
        primaryName,
        columns,
        iconUrl,
        additionalFilter,
        previewFormId,
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
        onOpenLookupDialog,
    } = props;

    const [term, setTerm] = React.useState("");
    const [open, setOpen] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [searchOutcome, setSearchOutcome] = React.useState<SearchOutcome | null>(null);
    const [activeIdx, setActiveIdx] = React.useState(0);
    const [favoritesTick, setFavoritesTick] = React.useState(0);
    // Preview modal — opened by a long-press on a card (ResultRow). Holds
    // the record being previewed; null means no modal is showing. The modal
    // shares the dropdown's portal so it lives above any UCI overflow:hidden
    // container, same as the suggestion list itself.
    const [previewRecord, setPreviewRecord] = React.useState<LookupRecord | null>(null);
    // When the maker configured a `previewFormId`, the modal renders the
    // Quick-View-Form's fields instead of the default columns. We hold the
    // parsed form definition + the freshly-fetched record values here.
    // Both null means either no QVF configured, or the fetch hasn't
    // resolved yet (covered by `previewLoading`).
    const [previewForm, setPreviewForm] = React.useState<QuickViewForm | null>(null);
    const [previewValues, setPreviewValues] = React.useState<QvfRecordValues | null>(null);
    const [previewLoading, setPreviewLoading] = React.useState(false);

    const inputRef = React.useRef<HTMLInputElement>(null);
    const hostRef = React.useRef<HTMLDivElement>(null);
    const abortRef = React.useRef<AbortController | null>(null);
    const debounceRef = React.useRef<number | null>(null);

    // Dropdown is portalled into document.body so containers with
    // overflow:hidden (Quick-Create side-panels, Business-Process flyouts,
    // dialogs, …) cannot clip it. The position is computed from the host
    // div's bounding rect and re-computed on resize / ancestor scroll so
    // the dropdown follows the input.
    //
    // Sizing rules (card layout — single column, title + stacked subtitles):
    //   - Desktop: floor at MIN_DROPDOWN_WIDTH so a couple of subtitles
    //     fit in one line, ceiling at MAX_DROPDOWN_WIDTH so the cards
    //     don't grow obnoxiously wide on big displays. Aligned with the
    //     visual weight of the OOB UCI Lookup (~360-440 px).
    //   - Mobile (viewport < MOBILE_BREAKPOINT): fill the viewport edge
    //     to edge (minus a small gutter) and anchor at the viewport's
    //     left edge so the dropdown lines up with the surrounding form
    //     padding.
    const MIN_DROPDOWN_WIDTH = 360;
    const MAX_DROPDOWN_WIDTH = 480;
    const VIEWPORT_GUTTER = 8;
    const MOBILE_BREAKPOINT = 640;
    const [anchorRect, setAnchorRect] = React.useState<{
        top: number;
        left: number;
        width: number;
    } | null>(null);
    const recomputeAnchor = React.useCallback(() => {
        const el = hostRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const isMobile = viewportWidth < MOBILE_BREAKPOINT;

        let width: number;
        let left: number;
        if (isMobile) {
            width = viewportWidth - 2 * VIEWPORT_GUTTER;
            left = VIEWPORT_GUTTER;
        } else {
            width = Math.max(r.width, MIN_DROPDOWN_WIDTH);
            width = Math.min(width, MAX_DROPDOWN_WIDTH);
            width = Math.min(width, viewportWidth - 2 * VIEWPORT_GUTTER);
            left = r.left;
            if (left + width + VIEWPORT_GUTTER > viewportWidth) {
                left = Math.max(VIEWPORT_GUTTER, viewportWidth - width - VIEWPORT_GUTTER);
            }
        }
        setAnchorRect({ top: r.bottom, left, width });
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
        debounceRef.current = window.setTimeout(async () => {
            const ctrl = new AbortController();
            abortRef.current = ctrl;

            // Resolve {record.…} / {user.…} tokens against the live form +
            // user. If any token can't be resolved (source field empty) we
            // skip the filter entirely for this search rather than emit
            // broken OData.
            let effectiveFilter: string | undefined;
            if (additionalFilter) {
                const { resolved, complete } = await resolveFilterTokens(
                    additionalFilter,
                    { userId, webApi: webApiRef.current },
                );
                if (ctrl.signal.aborted) return;
                if (complete) {
                    effectiveFilter = resolved;
                } else {
                    // eslint-disable-next-line no-console
                    console.warn(
                        "FuzzyLookupControl: additionalFilter has unresolved tokens, skipping the filter for this search.",
                        { template: additionalFilter, partial: resolved },
                    );
                }
            }

            searchRecords(webApiRef.current, {
                term: trimmed,
                targetEntity,
                columns,
                primaryName,
                pageSize,
                additionalFilter: effectiveFilter,
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
    }, [term, targetEntity, columns, primaryName, pageSize, additionalFilter, userId]);

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
            // The long-press preview modal lives in its own portal and is
            // not a descendant of the dropdown. A click inside it (× button,
            // backdrop, "Select" button) must NOT collapse the suggestion
            // list — the user expects to return to it after dismissing the
            // preview.
            if ((target as HTMLElement).closest?.("[data-flc-preview]")) return;
            setOpen(false);
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, [open]);

    // Escape closes the long-press preview modal. We don't bind unless the
    // modal is actually open so we're not eating Esc presses meant for the
    // dropdown or the surrounding form.
    React.useEffect(() => {
        if (!previewRecord) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                setPreviewRecord(null);
            }
        };
        document.addEventListener("keydown", onKey, true);
        return () => document.removeEventListener("keydown", onKey, true);
    }, [previewRecord]);

    // Quick-View-Form preview loader. Fires whenever the user long-presses
    // a card AND the maker configured `previewFormId`. Two round-trips:
    // one for the form metadata (cached after the first hit) and one for
    // the live record values. On any failure we silently fall back to the
    // default-columns preview by leaving `previewForm` null.
    React.useEffect(() => {
        if (!previewRecord) {
            // Closing the modal — clean up any half-loaded state so the
            // next open starts fresh.
            setPreviewForm(null);
            setPreviewValues(null);
            setPreviewLoading(false);
            return;
        }
        if (!previewFormId) {
            // No QVF configured — default-columns rendering will use
            // `previewRecord.columns` directly.
            return;
        }
        if (!entitySetName) {
            // EntityDefinitions didn't resolve the plural URL segment —
            // can't fetch the record. Log and stay in default mode.
            // eslint-disable-next-line no-console
            console.warn(
                "FuzzyLookupControl: previewFormId is set but entitySetName is unknown for " +
                    targetEntity + " — falling back to default preview.",
            );
            return;
        }

        const ctrl = new AbortController();
        setPreviewLoading(true);
        setPreviewForm(null);
        setPreviewValues(null);

        (async () => {
            try {
                const form = await fetchQuickViewForm(previewFormId);
                if (ctrl.signal.aborted) return;
                if (!form || form.fields.length === 0) {
                    // Either the form fetch failed or the form contains no
                    // field-bearing cells. Either way: stay in default mode.
                    setPreviewLoading(false);
                    return;
                }
                if (form.objectTypeCode !== targetEntity) {
                    // eslint-disable-next-line no-console
                    console.warn(
                        "FuzzyLookupControl: previewFormId belongs to entity \"" +
                            form.objectTypeCode + "\" but lookup target is \"" +
                            targetEntity + "\". Falling back to default preview.",
                    );
                    setPreviewLoading(false);
                    return;
                }
                const values = await fetchRecordValues({
                    entitySetName,
                    recordId: previewRecord.id,
                    fields: form.fields.map((f) => f.logicalName),
                    signal: ctrl.signal,
                });
                if (ctrl.signal.aborted) return;
                setPreviewForm(form);
                setPreviewValues(values ?? {});
            } catch (e) {
                if ((e as { name?: string })?.name === "AbortError") return;
                // eslint-disable-next-line no-console
                console.warn("FuzzyLookupControl: QVF preview load failed.", e);
            } finally {
                if (!ctrl.signal.aborted) setPreviewLoading(false);
            }
        })();

        return () => ctrl.abort();
    }, [previewRecord, previewFormId, entitySetName, targetEntity]);

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
                {iconUrl && (
                    <img
                        className="flc-chip-icon"
                        src={iconUrl}
                        alt=""
                        aria-hidden="true"
                    />
                )}
                <span
                    className="flc-chip-label"
                    onClick={(e) => {
                        // Prevent the click from bubbling to the input wrap,
                        // which would otherwise open the suggestion dropdown
                        // just as we're navigating away to the linked record.
                        e.stopPropagation();
                        setOpen(false);
                        onOpenRecord(selected);
                    }}
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
                {!disabled && (
                    <button
                        type="button"
                        className="flc-input-search"
                        aria-label={strings.openLookupDialog}
                        title={strings.openLookupDialog}
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpen(false);
                            onOpenLookupDialog();
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                            <path
                                fill="currentColor"
                                d="M10.5 11.3a5.6 5.6 0 1 1 .8-.8l3.1 3.1-.8.8-3.1-3.1zm.3-3.8a4.3 4.3 0 1 0-8.6 0 4.3 4.3 0 0 0 8.6 0z"
                            />
                        </svg>
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
                    }}
                >
                    {term.trim().length > 0 && term.trim().length < MIN_CHARS && (
                        <div className="flc-status">{strings.minChars}</div>
                    )}
                    {/* Empty-state hint — without this the dropdown collapses
                        to just a 1 px blue border + footer when the user clicks
                        in but hasn't typed anything yet, which looks like a
                        stray horizontal line outside the input. */}
                    {term.trim().length === 0 && !busy && sections.length === 0 && (
                        <div className="flc-status">{strings.typeToSearch}</div>
                    )}
                    {busy && (
                        <div className="flc-status" role="status">
                            <span className="flc-spinner" aria-hidden="true" />
                            <span>{strings.searching}</span>
                        </div>
                    )}
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
                                            primaryName={primaryName}
                                            iconUrl={iconUrl}
                                            isActive={absoluteIdx === activeIdx}
                                            showFavoriteToggle={enableFavorites}
                                            isFavorite={enableFavorites && isFavoriteFn(scope, rec.id)}
                                            onSelect={commitSelection}
                                            onToggleFavorite={(r) => {
                                                toggleFavoriteFn(scope, r);
                                                setFavoritesTick((t) => t + 1);
                                            }}
                                            onLongPress={(r) => setPreviewRecord(r)}
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

            {/* Long-press preview modal. Lives in its own portal under
                document.body so it overlays the dropdown (and any UCI
                overflow:hidden container). Backdrop click and the close
                button both dismiss; the footer button selects and closes
                in one motion. Escape-key handling is wired in the effect
                below.*/}
            {previewRecord && ReactDOM.createPortal(
                <div
                    className="flc-preview-backdrop"
                    data-flc-preview
                    onClick={() => setPreviewRecord(null)}
                >
                    <div
                        className="flc-preview-card"
                        role="dialog"
                        aria-modal="true"
                        aria-label={strings.previewTitle}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flc-preview-header">
                            {iconUrl && (
                                <img
                                    className="flc-preview-icon"
                                    src={iconUrl}
                                    alt=""
                                    aria-hidden="true"
                                />
                            )}
                            <div className="flc-preview-title">
                                {previewRecord.columns[primaryName] || previewRecord.primaryName}
                            </div>
                            <button
                                type="button"
                                className="flc-preview-close"
                                aria-label={strings.previewClose}
                                title={strings.previewClose}
                                onClick={() => setPreviewRecord(null)}
                            >
                                ×
                            </button>
                        </div>
                        <div className="flc-preview-body">
                            {/* QVF mode: render the form's fields with section
                                headers + per-field labels. Falls back to the
                                default-columns view below if the form data
                                isn't (yet) available. */}
                            {previewLoading && (
                                <div className="flc-preview-status">
                                    {strings.previewLoading}
                                </div>
                            )}
                            {!previewLoading && previewForm && previewValues && (
                                <>
                                    {(() => {
                                        // Group consecutive fields by section
                                        // for clean section headers; null
                                        // sectionLabel means "no header".
                                        let lastSection: string | null | undefined = undefined;
                                        return previewForm.fields.map((f, i) => {
                                            const value = previewValues[f.logicalName];
                                            if (value === undefined || value === "") return null;
                                            const showSectionHeader =
                                                f.sectionLabel !== null
                                                && f.sectionLabel !== undefined
                                                && f.sectionLabel !== lastSection;
                                            lastSection = f.sectionLabel;
                                            return (
                                                <React.Fragment key={`${f.logicalName}-${i}`}>
                                                    {showSectionHeader && (
                                                        <div className="flc-preview-section-header">
                                                            {f.sectionLabel}
                                                        </div>
                                                    )}
                                                    <div className="flc-preview-field">
                                                        <div className="flc-preview-label">{f.label}</div>
                                                        <div className="flc-preview-value">{value}</div>
                                                    </div>
                                                </React.Fragment>
                                            );
                                        });
                                    })()}
                                </>
                            )}
                            {/* Default mode: configured columns straight from
                                the search response. Used when there's no QVF,
                                while a QVF is loading don't render to avoid
                                a visible flicker between the two modes, and
                                when QVF load fails (form/values stay null). */}
                            {!previewLoading && !previewForm && columns.map((c) => {
                                const raw = previewRecord.columns[c] ?? "";
                                if (!raw) return null;
                                return (
                                    <div key={c} className="flc-preview-row">
                                        {raw}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flc-preview-footer">
                            <button
                                type="button"
                                className="flc-preview-select"
                                onClick={() => {
                                    const rec = previewRecord;
                                    setPreviewRecord(null);
                                    commitSelection(rec);
                                }}
                            >
                                {strings.previewSelect}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </div>
    );
};
