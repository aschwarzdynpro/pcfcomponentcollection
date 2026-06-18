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
    strings: Strings;
}

export const EntryList: React.FC<EntryListProps> = ({
    rows,
    selectedId,
    onSelect,
    selectable,
    checkedIds,
    onToggleCheck,
    strings,
}) => {
    const activate = (id: string) => {
        if (selectable) onToggleCheck?.(id);
        else onSelect(id);
    };

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
