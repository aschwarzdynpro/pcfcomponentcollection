import * as React from "react";
import type { LookupRecord } from "../services/types";

// Touch-gesture constants.
//
// SWIPE_THRESHOLD: pixels of horizontal travel required before a release
// triggers the favorite toggle. Higher than the visual reveal width to make
// accidental flicks not commit.
//
// MAX_SWIPE: how far the card can be dragged before it stops moving. Chosen
// so the "favorite" reveal behind the card stays comfortably visible without
// the card sliding off the dropdown entirely.
//
// LONG_PRESS_MS: matches the iOS/Android system long-press threshold so the
// gesture feels native. Cancelled the moment the user moves more than a
// fingertip's worth.
//
// MOVE_TOLERANCE: jitter allowance before we count a pointer-move as a real
// motion (and cancel the long-press timer). Below this we treat the press
// as stationary.
//
// HORIZONTAL_LOCK: once the user moves more than this in either axis, we
// decide whether they're swiping (predominantly horizontal) or scrolling
// (predominantly vertical) and lock the gesture so the choice stays stable
// for the rest of the press.
const SWIPE_THRESHOLD = 72;
const MAX_SWIPE = 96;
const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE = 8;
const HORIZONTAL_LOCK = 12;

type GestureMode = "idle" | "pressing" | "swipe" | "scrolling" | "consumed";

export interface ResultRowProps {
    record: LookupRecord;
    /** Logical column names in display order. `columns[0]` becomes the card
     * title (primary line); `columns[1..]` are stacked as subtitle lines
     * underneath. Empty values are skipped entirely so a missing column2
     * doesn't leave a blank line. */
    columns: string[];
    /** Logical name of the target table's primary-name attribute. Used as a
     * tooltip on the title so the user can hover-confirm what they're
     * about to select even if the rendered text is truncated. */
    primaryName: string;
    /** Optional table icon shown to the left of the card body. Sourced
     * from the entity metadata (IconVectorName web resource). */
    iconUrl?: string;
    isActive: boolean;
    showFavoriteToggle: boolean;
    isFavorite: boolean;
    onSelect: (rec: LookupRecord) => void;
    onToggleFavorite: (rec: LookupRecord) => void;
    /** Fired when the user holds the card down for ~500 ms without moving.
     * Parent renders a preview modal with the record's details. */
    onLongPress: (rec: LookupRecord) => void;
    pinTooltip: string;
    unpinTooltip: string;
    onMouseEnter: () => void;
}

export const ResultRow: React.FC<ResultRowProps> = (props) => {
    const {
        record,
        columns,
        primaryName,
        iconUrl,
        isActive,
        showFavoriteToggle,
        isFavorite,
        onSelect,
        onToggleFavorite,
        onLongPress,
        pinTooltip,
        unpinTooltip,
        onMouseEnter,
    } = props;

    // Visual swipe offset (px). 0 = card is in place. Positive = dragged right.
    // We never let it go negative — the maker only asked for right-swipe-to-
    // favorite for now; a left swipe just won't move the card.
    const [swipeOffset, setSwipeOffset] = React.useState(0);
    // Disables the CSS snap-back transition while the user is actively
    // dragging, so the card follows the finger 1:1 instead of lagging.
    const [isSwiping, setIsSwiping] = React.useState(false);

    // Tracks whether the upcoming click event should be ignored because a
    // gesture (swipe or long-press) already handled the interaction. Without
    // this guard, a swipe-release would also fire a click and select the
    // record on top of toggling the favorite.
    const consumeNextClickRef = React.useRef(false);

    // Per-gesture mutable state lives in refs so updates don't trigger
    // re-renders during the pointer-move stream.
    const modeRef = React.useRef<GestureMode>("idle");
    const startXRef = React.useRef(0);
    const startYRef = React.useRef(0);
    const longPressTimerRef = React.useRef<number | null>(null);

    const clearLongPressTimer = () => {
        if (longPressTimerRef.current !== null) {
            window.clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    const resetGesture = () => {
        clearLongPressTimer();
        modeRef.current = "idle";
        setIsSwiping(false);
        setSwipeOffset(0);
    };

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        // Ignore presses that started on the favorite-toggle button — that
        // button has its own click handler and should not also trigger
        // swipe / long-press logic on the parent card.
        if ((e.target as HTMLElement).closest("[data-fav-toggle]")) return;
        // Right-click / multi-touch: don't intercept. Lets the native
        // context menu work and avoids confusing multi-finger gestures.
        if (e.button !== 0 && e.pointerType === "mouse") return;

        startXRef.current = e.clientX;
        startYRef.current = e.clientY;
        modeRef.current = "pressing";
        consumeNextClickRef.current = false;

        clearLongPressTimer();
        longPressTimerRef.current = window.setTimeout(() => {
            // Only fire if the user is still in the "pressing" state — if
            // they've already started swiping or scrolling, the timer should
            // do nothing. Belt-and-braces: pointermove also cancels the
            // timer the moment movement exceeds tolerance.
            if (modeRef.current === "pressing") {
                modeRef.current = "consumed";
                consumeNextClickRef.current = true;
                onLongPress(record);
            }
        }, LONG_PRESS_MS);
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (modeRef.current === "idle" || modeRef.current === "consumed") return;

        const dx = e.clientX - startXRef.current;
        const dy = e.clientY - startYRef.current;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (modeRef.current === "pressing") {
            if (absDx < MOVE_TOLERANCE && absDy < MOVE_TOLERANCE) return;
            // Real motion — cancel long-press immediately.
            clearLongPressTimer();
            // Decide swipe vs scroll based on which axis dominates once
            // either crosses HORIZONTAL_LOCK.
            if (absDx > HORIZONTAL_LOCK || absDy > HORIZONTAL_LOCK) {
                if (absDx > absDy && showFavoriteToggle) {
                    modeRef.current = "swipe";
                    setIsSwiping(true);
                    e.currentTarget.setPointerCapture(e.pointerId);
                } else {
                    // Vertical motion wins — let the dropdown scroll
                    // through this gesture untouched. Marking the mode
                    // as scrolling means subsequent moves are no-ops.
                    modeRef.current = "scrolling";
                }
            }
            return;
        }

        if (modeRef.current === "swipe") {
            // We only support right-swipe-to-favorite. A leftward drag
            // just keeps the card in place — no negative offset, no
            // "left action" to trigger.
            const next = Math.max(0, Math.min(dx, MAX_SWIPE));
            setSwipeOffset(next);
        }
    };

    const onPointerUp = (_e: React.PointerEvent<HTMLDivElement>) => {
        clearLongPressTimer();

        if (modeRef.current === "swipe") {
            const past = swipeOffset >= SWIPE_THRESHOLD;
            // Animate snap-back regardless of outcome. The favorite toggle
            // fires after the snap so the user sees motion → result.
            setIsSwiping(false);
            setSwipeOffset(0);
            if (past) {
                consumeNextClickRef.current = true;
                onToggleFavorite(record);
            } else {
                // Even a sub-threshold swipe should not trigger a click —
                // the user clearly meant to interact, not to select.
                consumeNextClickRef.current = true;
            }
            modeRef.current = "idle";
            return;
        }

        if (modeRef.current === "consumed") {
            // Long-press already handled — leave the consume-click guard
            // armed so the about-to-fire synthetic click is suppressed.
            modeRef.current = "idle";
            return;
        }

        // Plain press release with no gesture: let the click handler do
        // its job (select).
        modeRef.current = "idle";
    };

    const onPointerCancel = () => {
        clearLongPressTimer();
        modeRef.current = "idle";
        setIsSwiping(false);
        setSwipeOffset(0);
    };

    const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
        // Ignore clicks that originated on the favorite-toggle button.
        const target = e.target as HTMLElement;
        if (target.closest("[data-fav-toggle]")) return;
        // Suppress the synthetic click that fires after a swipe / long-press.
        if (consumeNextClickRef.current) {
            consumeNextClickRef.current = false;
            return;
        }
        onSelect(record);
    };

    // Keep the active (keyboard-highlighted) card visible inside the
    // scrollable dropdown. `block: "nearest"` means: only scroll when the
    // element is not already fully visible — so mouse hover (active card
    // already in viewport) is a no-op, but arrow-down past the visible
    // bottom edge scrolls just enough to bring the next card into view.
    const wrapperRef = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        if (isActive && wrapperRef.current) {
            wrapperRef.current.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
    }, [isActive]);

    // Cleanup on unmount — if a gesture is still in flight (timer pending),
    // clear it so we don't fire onLongPress on a disposed component.
    React.useEffect(() => {
        return () => {
            clearLongPressTimer();
        };
    }, []);

    const titleCol = columns[0];
    const subtitleCols = columns.slice(1);

    const titleRaw = record.columns[titleCol] ?? "";
    const titleHtml = record.highlights[titleCol] || escapeHtml(titleRaw);

    // While the swipe reveal is visible we paint the "favorite" coloured
    // strip behind the card. The reveal goes away as soon as the offset
    // returns to zero so non-favourited rows look normal.
    const revealVisible = showFavoriteToggle && swipeOffset > 0;

    return (
        <div ref={wrapperRef} className={`flc-card-wrapper ${revealVisible ? "is-revealing" : ""}`}>
            {showFavoriteToggle && (
                <div
                    className={`flc-card-swipe-bg ${isFavorite ? "is-unpin" : "is-pin"}`}
                    aria-hidden="true"
                >
                    {isFavorite ? "☆" : "★"}
                </div>
            )}
            <div
                role="option"
                aria-selected={isActive}
                className={`flc-card-row ${isActive ? "is-active" : ""} ${isSwiping ? "is-swiping" : ""}`}
                onClick={onClick}
                onMouseEnter={onMouseEnter}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
                style={swipeOffset > 0 ? { transform: `translateX(${swipeOffset}px)` } : undefined}
            >
                {iconUrl && (
                    <img
                        className="flc-card-icon"
                        src={iconUrl}
                        alt=""
                        aria-hidden="true"
                    />
                )}
                <div className="flc-card-body">
                    <div
                        className="flc-card-title"
                        title={titleRaw || primaryName}
                        dangerouslySetInnerHTML={{ __html: titleHtml }}
                    />
                    {subtitleCols.map((c) => {
                        const raw = record.columns[c] ?? "";
                        // Skip empty subtitles so a missing column doesn't leave
                        // a blank line in the card.
                        if (!raw) return null;
                        const html = record.highlights[c] || escapeHtml(raw);
                        return (
                            <div
                                key={c}
                                className="flc-card-subtitle"
                                title={raw}
                                dangerouslySetInnerHTML={{ __html: html }}
                            />
                        );
                    })}
                </div>
                {showFavoriteToggle && (
                    <button
                        type="button"
                        data-fav-toggle
                        aria-pressed={isFavorite}
                        aria-label={isFavorite ? unpinTooltip : pinTooltip}
                        title={isFavorite ? unpinTooltip : pinTooltip}
                        className={`flc-card-fav ${isFavorite ? "is-on" : ""}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(record);
                        }}
                    >
                        {isFavorite ? "★" : "☆"}
                    </button>
                )}
            </div>
        </div>
    );
};

// ResultRow uses `dangerouslySetInnerHTML` only with strings produced by the
// highlight service (which HTML-escapes its inputs). For the no-highlight
// branch we escape here.
function escapeHtml(input: string): string {
    return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
