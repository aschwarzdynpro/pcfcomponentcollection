import * as React from "react";
import { Button, MessageBar, MessageBarActions, MessageBarBody } from "@fluentui/react-components";
import { BoxRecord, CountState } from "./types";
import { CounterChip } from "./CounterChip";
import { Strings } from "./i18n";
import { useRowGesture } from "../hooks/useRowGesture";

export interface BoxRowProps {
    box: BoxRecord;
    count: CountState;
    /** Whether the box counts as taken (dataset value or local optimistic). */
    taken: boolean;
    /** Whether a save error is currently shown for this box. */
    error: boolean;
    /** Touch gestures (long-press / swipe) instead of fallback buttons. */
    gesturesEnabled: boolean;
    strings: Strings;
    onShowMaterials: (boxId: string) => void;
    onTake: (boxId: string) => void;
    onRetry: (boxId: string) => void;
}

/**
 * A single box row: primary name + view columns + counter chip.
 *
 * On touch (mobile) the row is gesture-driven — long-press opens the overlay,
 * left-swipe past 40 % takes the box out (§5.4), with an action surface
 * revealed behind the row. On web the fallback buttons (§5.8) provide the same
 * actions; gestures are disabled there.
 */
export const BoxRow: React.FC<BoxRowProps> = ({
    box,
    count,
    taken,
    error,
    gesturesEnabled,
    strings,
    onShowMaterials,
    onTake,
    onRetry,
}) => {
    const gesture = useRowGesture({
        enabled: gesturesEnabled,
        canSwipe: !taken,
        onLongPress: () => onShowMaterials(box.id),
        onCommit: () => onTake(box.id),
    });

    const className = `mbl-row${taken ? " mbl-row--taken" : ""}${
        gesture.pressed ? " mbl-row--pressed" : ""
    }`;

    return (
        <div
            className={className}
            data-box-id={box.id}
            ref={gesture.rowRef}
            {...(gesturesEnabled ? gesture.bind : {})}
        >
            {gesturesEnabled && !taken && (
                <div
                    className={`mbl-row__surface${
                        gesture.committed ? " mbl-row__surface--armed" : ""
                    }`}
                    aria-hidden="true"
                >
                    <span className="mbl-row__surface-label">
                        ⟵ {strings.take}
                    </span>
                </div>
            )}

            <div
                className={`mbl-row__fg${
                    gesture.swiping ? " mbl-row__fg--swiping" : ""
                }`}
                style={
                    gesturesEnabled
                        ? { transform: `translateX(${gesture.dx}px)` }
                        : undefined
                }
            >
                <div className="mbl-row__main">
                    <div className="mbl-row__text">
                        <span className="mbl-row__name">{box.name}</span>
                        {box.cells.length > 0 && (
                            <span className="mbl-row__cells">
                                {box.cells.map((c) => (
                                    <span key={c.key} className="mbl-row__cell">
                                        {c.value}
                                    </span>
                                ))}
                            </span>
                        )}
                    </div>
                    <div className="mbl-row__meta">
                        <CounterChip state={count} strings={strings} />
                        {taken && (
                            <span className="mbl-row__taken">
                                ✓ {strings.taken}
                            </span>
                        )}
                    </div>
                </div>

                {!gesturesEnabled && (
                    <div className="mbl-row__actions">
                        <Button
                            appearance="secondary"
                            size="small"
                            onClick={() => onShowMaterials(box.id)}
                        >
                            {strings.showMaterials}
                        </Button>
                        {!taken && (
                            <Button
                                appearance="primary"
                                size="small"
                                onClick={() => onTake(box.id)}
                            >
                                {strings.take}
                            </Button>
                        )}
                    </div>
                )}

                {error && (
                    <MessageBar intent="error" className="mbl-row__error">
                        <MessageBarBody>{strings.saveError}</MessageBarBody>
                        <MessageBarActions>
                            <Button size="small" onClick={() => onRetry(box.id)}>
                                {strings.retry}
                            </Button>
                        </MessageBarActions>
                    </MessageBar>
                )}
            </div>
        </div>
    );
};
