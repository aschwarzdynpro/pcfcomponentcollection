import * as React from "react";

/**
 * Unified pointer-event gesture layer for a box row (concept §5.4).
 *
 * The concept lists `useLongPress` and `useSwipe` as separate hooks, but both
 * gestures must share ONE pointer-event pipeline per row — two independent
 * handlers on the same element would fight over `pointerdown` / pointer capture
 * and the vertical-scroll hand-off. This hook is that single state machine:
 *
 *   IDLE
 *    └─ pointerdown → PRESSED (start long-press timer, remember origin)
 *        ├─ move > threshold vertical   → SCROLLING (cancel timer, hand to list)
 *        ├─ move > threshold horizontal → SWIPING  (cancel timer, capture pointer)
 *        ├─ timer fires                 → long-press fires, back to IDLE
 *        └─ pointerup before move/timer → TAP (no-op)
 *   SWIPING
 *    ├─ pointerup with |dx| ≥ commit fraction of width → COMMIT
 *    └─ otherwise → spring back to 0
 *
 * `touch-action: pan-y` on the row lets the browser keep vertical scrolling;
 * horizontal movement stays with the control. The far-left edge is a dead zone
 * so an OS/app back-swipe isn't hijacked.
 */
export interface RowGestureOptions {
    /** Gestures only run on touch/mobile; web uses the fallback buttons. */
    enabled: boolean;
    /** Whether a left-swipe take-out is allowed for this box (e.g. not taken). */
    canSwipe: boolean;
    /** Opens the overlay. */
    onLongPress: () => void;
    /** Commits the take-out action. */
    onCommit: () => void;
    longPressMs?: number;
    /** Movement (px) that decides scroll vs. swipe. */
    moveThreshold?: number;
    /** Fraction of the row width that commits the swipe. */
    commitFraction?: number;
    /** Left screen-edge dead zone (px) to avoid the OS back-gesture. */
    edgeDeadZone?: number;
}

export interface RowGesture {
    /** Current horizontal offset (≤ 0, left-swipe). */
    dx: number;
    /** True while actively swiping (disables the spring transition). */
    swiping: boolean;
    /** True during the initial press (drives the scale feedback). */
    pressed: boolean;
    /** True once the swipe passed the commit threshold (surface turns green). */
    committed: boolean;
    /** Spread onto the row element. */
    bind: {
        onPointerDown: (e: React.PointerEvent) => void;
        onPointerMove: (e: React.PointerEvent) => void;
        onPointerUp: (e: React.PointerEvent) => void;
        onPointerCancel: (e: React.PointerEvent) => void;
        onContextMenu: (e: React.MouseEvent) => void;
    };
    /** Ref for width measurement + pointer capture. */
    rowRef: React.RefObject<HTMLDivElement>;
}

type Phase = "idle" | "pressed" | "swiping" | "scrolling";

export function useRowGesture(options: RowGestureOptions): RowGesture {
    const {
        enabled,
        canSwipe,
        onLongPress,
        onCommit,
        longPressMs = 500,
        moveThreshold = 10,
        commitFraction = 0.4,
        edgeDeadZone = 24,
    } = options;

    const rowRef = React.useRef<HTMLDivElement>(null);
    const phase = React.useRef<Phase>("idle");
    const startX = React.useRef(0);
    const startY = React.useRef(0);
    const width = React.useRef(0);
    const pointerId = React.useRef<number | null>(null);
    const timer = React.useRef<number | null>(null);

    const [dx, setDx] = React.useState(0);
    const [swiping, setSwiping] = React.useState(false);
    const [pressed, setPressed] = React.useState(false);
    const [committed, setCommitted] = React.useState(false);

    // Keep the latest callbacks/flags without re-binding handlers each render.
    const cb = React.useRef({ onLongPress, onCommit, canSwipe });
    cb.current = { onLongPress, onCommit, canSwipe };

    const clearTimer = React.useCallback(() => {
        if (timer.current !== null) {
            window.clearTimeout(timer.current);
            timer.current = null;
        }
    }, []);

    const reset = React.useCallback(() => {
        clearTimer();
        phase.current = "idle";
        pointerId.current = null;
        setDx(0);
        setSwiping(false);
        setPressed(false);
        setCommitted(false);
    }, [clearTimer]);

    React.useEffect(() => reset, [reset]);

    const onPointerDown = React.useCallback(
        (e: React.PointerEvent) => {
            if (!enabled) return;
            // Ignore presses that start on the far-left edge (OS back-gesture).
            if (e.clientX < edgeDeadZone) return;
            phase.current = "pressed";
            startX.current = e.clientX;
            startY.current = e.clientY;
            width.current = rowRef.current?.offsetWidth ?? 0;
            pointerId.current = e.pointerId;
            setPressed(true);
            setCommitted(false);
            clearTimer();
            timer.current = window.setTimeout(() => {
                if (phase.current === "pressed") {
                    phase.current = "idle";
                    setPressed(false);
                    cb.current.onLongPress();
                }
            }, longPressMs);
        },
        [enabled, edgeDeadZone, longPressMs, clearTimer],
    );

    const onPointerMove = React.useCallback(
        (e: React.PointerEvent) => {
            if (!enabled) return;
            const adx = e.clientX - startX.current;
            const ady = e.clientY - startY.current;

            if (phase.current === "pressed") {
                if (Math.abs(ady) > moveThreshold && Math.abs(ady) >= Math.abs(adx)) {
                    // Vertical intent → let the list scroll.
                    phase.current = "scrolling";
                    clearTimer();
                    setPressed(false);
                    return;
                }
                if (Math.abs(adx) > moveThreshold) {
                    phase.current = "swiping";
                    clearTimer();
                    setPressed(false);
                    setSwiping(true);
                    try {
                        rowRef.current?.setPointerCapture(e.pointerId);
                    } catch {
                        /* capture unsupported — swipe still tracks */
                    }
                }
            }

            if (phase.current === "swiping") {
                // Only left-swipe reveals the take-out action.
                const next = cb.current.canSwipe ? Math.min(0, adx) : 0;
                setDx(next);
                const w = width.current || 1;
                setCommitted(-next >= w * commitFraction);
            }
        },
        [enabled, moveThreshold, commitFraction, clearTimer],
    );

    const onPointerUp = React.useCallback(() => {
        if (!enabled) return;
        if (phase.current === "swiping") {
            if (committed && cb.current.canSwipe) {
                cb.current.onCommit();
            }
            // Spring back either way; on commit the row state changes anyway.
            phase.current = "idle";
            setSwiping(false);
            setDx(0);
            setCommitted(false);
            pointerId.current = null;
            return;
        }
        // PRESSED with no movement → tap (no-op) / SCROLLING → done.
        reset();
    }, [enabled, committed, reset]);

    const onPointerCancel = React.useCallback(() => {
        if (!enabled) return;
        reset();
    }, [enabled, reset]);

    const onContextMenu = React.useCallback(
        (e: React.MouseEvent) => {
            // Suppress the native long-press context menu in the WebView.
            if (enabled) e.preventDefault();
        },
        [enabled],
    );

    return {
        dx,
        swiping,
        pressed,
        committed,
        bind: {
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel,
            onContextMenu,
        },
        rowRef,
    };
}
