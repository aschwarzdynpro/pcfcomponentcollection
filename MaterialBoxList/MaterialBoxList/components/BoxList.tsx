import * as React from "react";
import { Spinner } from "@fluentui/react-components";
import { BoxRecord, CountState } from "./types";
import { BoxRow } from "./BoxRow";
import { Strings } from "./i18n";

export interface BoxListProps {
    boxes: BoxRecord[];
    /** Counter-chip state per box id. */
    countOf: (boxId: string) => CountState;
    /** Whether a box counts as taken (dataset value or local optimistic). */
    takenOf: (boxId: string) => boolean;
    /** Box id currently showing a save error, if any. */
    errorId: string | null;
    /** Dataset is still (re)loading — show a syncing state instead of "empty". */
    loading: boolean;
    /** Whether more pages can be loaded (infinite scroll). */
    hasNextPage: boolean;
    strings: Strings;
    onShowMaterials: (boxId: string) => void;
    onTake: (boxId: string) => void;
    onRetry: (boxId: string) => void;
    onLoadMore: () => void;
}

/**
 * The master list of boxes with infinite scroll (§5.2). Paging is driven by the
 * bound dataset; this only asks for the next page when the user scrolls near the
 * bottom.
 */
export const BoxList: React.FC<BoxListProps> = ({
    boxes,
    countOf,
    takenOf,
    errorId,
    loading,
    hasNextPage,
    strings,
    onShowMaterials,
    onTake,
    onRetry,
    onLoadMore,
}) => {
    const onScroll = React.useCallback(
        (e: React.UIEvent<HTMLDivElement>) => {
            if (!hasNextPage) return;
            const el = e.currentTarget;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120) {
                onLoadMore();
            }
        },
        [hasNextPage, onLoadMore],
    );

    if (boxes.length === 0) {
        return (
            <div className="mbl-empty">
                {loading ? (
                    <Spinner size="small" label={strings.syncing} />
                ) : (
                    <span>{strings.noBoxes}</span>
                )}
            </div>
        );
    }

    return (
        <div className="mbl-list" onScroll={onScroll}>
            {boxes.map((box) => (
                <BoxRow
                    key={box.id}
                    box={box}
                    count={countOf(box.id)}
                    taken={takenOf(box.id)}
                    error={errorId === box.id}
                    strings={strings}
                    onShowMaterials={onShowMaterials}
                    onTake={onTake}
                    onRetry={onRetry}
                />
            ))}
            {hasNextPage && (
                <div className="mbl-list__more">
                    <Spinner size="tiny" label={strings.loadingMore} />
                </div>
            )}
        </div>
    );
};
