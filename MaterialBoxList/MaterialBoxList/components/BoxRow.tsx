import * as React from "react";
import { Button, MessageBar, MessageBarActions, MessageBarBody } from "@fluentui/react-components";
import { BoxRecord, CountState } from "./types";
import { CounterChip } from "./CounterChip";
import { Strings } from "./i18n";

export interface BoxRowProps {
    box: BoxRecord;
    count: CountState;
    /** Whether the box counts as taken (dataset value or local optimistic). */
    taken: boolean;
    /** Whether a save error is currently shown for this box. */
    error: boolean;
    strings: Strings;
    onShowMaterials: (boxId: string) => void;
    onTake: (boxId: string) => void;
    onRetry: (boxId: string) => void;
}

/**
 * A single box row: primary name + view columns + counter chip, plus the
 * milestone-1 fallback buttons (§5.8). Gestures (long-press / swipe) replace the
 * buttons on mobile in milestone 2; the row is structured so the gesture layer
 * can wrap it without changing this markup.
 */
export const BoxRow: React.FC<BoxRowProps> = ({
    box,
    count,
    taken,
    error,
    strings,
    onShowMaterials,
    onTake,
    onRetry,
}) => {
    const className = `mbl-row${taken ? " mbl-row--taken" : ""}`;
    return (
        <div className={className} data-box-id={box.id}>
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
                </div>
            </div>

            <div className="mbl-row__actions">
                <Button
                    appearance="secondary"
                    size="small"
                    onClick={() => onShowMaterials(box.id)}
                >
                    {strings.showMaterials}
                </Button>
                {taken ? (
                    <span className="mbl-row__taken">✓ {strings.taken}</span>
                ) : (
                    <Button
                        appearance="primary"
                        size="small"
                        onClick={() => onTake(box.id)}
                    >
                        {strings.take}
                    </Button>
                )}
            </div>

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
    );
};
