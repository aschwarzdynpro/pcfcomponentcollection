import * as React from "react";
import type { LookupRecord } from "../services/types";

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
        pinTooltip,
        unpinTooltip,
        onMouseEnter,
    } = props;

    const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
        // Ignore clicks that originated on the favorite-toggle button.
        const target = e.target as HTMLElement;
        if (target.closest("[data-fav-toggle]")) return;
        onSelect(record);
    };

    const titleCol = columns[0];
    const subtitleCols = columns.slice(1);

    const titleRaw = record.columns[titleCol] ?? "";
    const titleHtml = record.highlights[titleCol] || escapeHtml(titleRaw);

    return (
        <div
            role="option"
            aria-selected={isActive}
            className={`flc-card-row ${isActive ? "is-active" : ""}`}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
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
