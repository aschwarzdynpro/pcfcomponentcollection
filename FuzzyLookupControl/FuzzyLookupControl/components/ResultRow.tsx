import * as React from "react";
import type { LookupRecord } from "../services/types";

export interface ResultRowProps {
    record: LookupRecord;
    columns: string[];          // ordered, length 1..4
    columnHeaders: string[];    // parallel to columns
    primaryName: string;
    isActive: boolean;
    showHeaderRow: boolean;     // first row of a section shows header
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
        columnHeaders,
        isActive,
        showHeaderRow,
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

    return (
        <>
            {showHeaderRow && (
                <div className="flc-row flc-row--header" aria-hidden="true">
                    {columns.map((c, i) => (
                        <div key={c} className={`flc-cell flc-cell-${i}`}>
                            {columnHeaders[i] ?? c}
                        </div>
                    ))}
                    {showFavoriteToggle && <div className="flc-cell flc-cell-fav" />}
                </div>
            )}
            <div
                role="option"
                aria-selected={isActive}
                className={`flc-row flc-row--data ${isActive ? "is-active" : ""}`}
                onClick={onClick}
                onMouseEnter={onMouseEnter}
            >
                {columns.map((c, i) => {
                    const html = record.highlights[c] || escapeHtml(record.columns[c] ?? "");
                    return (
                        <div
                            key={c}
                            className={`flc-cell flc-cell-${i}`}
                            title={record.columns[c] ?? ""}
                            dangerouslySetInnerHTML={{ __html: html }}
                        />
                    );
                })}
                {showFavoriteToggle && (
                    <div className="flc-cell flc-cell-fav">
                        <button
                            type="button"
                            data-fav-toggle
                            aria-pressed={isFavorite}
                            aria-label={isFavorite ? unpinTooltip : pinTooltip}
                            title={isFavorite ? unpinTooltip : pinTooltip}
                            className={`flc-fav-btn ${isFavorite ? "is-on" : ""}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleFavorite(record);
                            }}
                        >
                            {isFavorite ? "★" : "☆"}
                        </button>
                    </div>
                )}
            </div>
        </>
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
