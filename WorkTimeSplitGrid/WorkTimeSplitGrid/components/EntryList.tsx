import * as React from "react";
import { EntryRow } from "./types";
import { Strings } from "./i18n";

export interface EntryListProps {
    rows: EntryRow[];
    /** Single-select (split mode): the currently opened entry. */
    selectedId: string | null;
    onSelect: (id: string) => void;
    /** Multi-select (assign mode): checkbox per card. */
    selectable?: boolean;
    checkedIds?: Set<string>;
    onToggleCheck?: (id: string) => void;
    /** One-liner shown (with an icon) when there are no rows. */
    emptyMessage?: string;
    strings: Strings;
}

/** Binoculars — empty-state icon. */
const Binoculars: React.FC = () => (
    <svg
        className="wtsg-empty-icon"
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M6 8V6a1.5 1.5 0 0 1 1.5-1.5h0A1.5 1.5 0 0 1 9 6v2" />
        <path d="M15 8V6a1.5 1.5 0 0 1 1.5-1.5h0A1.5 1.5 0 0 1 18 6v2" />
        <path d="M9 8.5h6" />
        <path d="M6 8 4.3 13.2M18 8l1.7 5.2" />
        <circle cx="5" cy="16" r="3.2" />
        <circle cx="19" cy="16" r="3.2" />
    </svg>
);

export const EntryList: React.FC<EntryListProps> = ({
    rows,
    selectedId,
    onSelect,
    selectable,
    checkedIds,
    onToggleCheck,
    emptyMessage,
    strings,
}) => {
    const activate = (id: string) => {
        if (selectable) onToggleCheck?.(id);
        else onSelect(id);
    };

    if (rows.length === 0) {
        return (
            <div className="wtsg-list wtsg-list-empty" aria-label="entries">
                <div className="wtsg-empty-state" role="status">
                    <Binoculars />
                    <span>{emptyMessage ?? strings.noResults}</span>
                </div>
            </div>
        );
    }

    return (
        <div
            className="wtsg-list"
            role="listbox"
            aria-multiselectable={selectable || undefined}
            aria-label="entries"
        >
            {rows.map((r) => {
                const checked = selectable
                    ? !!checkedIds?.has(r.id)
                    : r.id === selectedId;
                return (
                    <div
                        key={r.id}
                        role="option"
                        aria-selected={checked}
                        tabIndex={0}
                        className={`wtsg-card ${checked ? "selected" : ""}`}
                        onClick={() => activate(r.id)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                activate(r.id);
                            }
                        }}
                    >
                        <div className="wtsg-card-head">
                            {selectable && (
                                <span
                                    className={`wtsg-check ${checked ? "checked" : ""}`}
                                    aria-hidden="true"
                                >
                                    {checked && (
                                        <svg
                                            width="12"
                                            height="12"
                                            viewBox="0 0 16 16"
                                        >
                                            <path
                                                d="M3 8.5 6.5 12 13 4.5"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    )}
                                </span>
                            )}
                            <span className="wtsg-card-title" title={r.name}>
                                {r.name}
                            </span>
                            {!selectable && (
                                <span
                                    className={`wtsg-badge ${r.completed ? "done" : "open"}`}
                                    aria-hidden="true"
                                />
                            )}
                        </div>
                        <div className="wtsg-card-meta">
                            {r.resourceName && (
                                <span className="wtsg-chip" title={r.resourceName}>
                                    {r.resourceName}
                                </span>
                            )}
                            {r.type && (
                                <span className="wtsg-chip" title={r.type}>
                                    {r.type}
                                </span>
                            )}
                            {r.date && (
                                <span className="wtsg-chip" title={r.date}>
                                    {r.date}
                                </span>
                            )}
                        </div>
                        <div className="wtsg-card-total">
                            {strings.total}: <strong>{r.totalFormatted || "—"}</strong>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
