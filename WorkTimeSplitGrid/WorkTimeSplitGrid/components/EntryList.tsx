import * as React from "react";
import { EntryRow } from "./types";
import { Strings } from "./i18n";

export interface EntryListProps {
    rows: EntryRow[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    strings: Strings;
}

export const EntryList: React.FC<EntryListProps> = ({
    rows,
    selectedId,
    onSelect,
    strings,
}) => {
    return (
        <div className="wtsg-list" role="listbox" aria-label="entries">
            {rows.map((r) => {
                const isSel = r.id === selectedId;
                return (
                    <div
                        key={r.id}
                        role="option"
                        aria-selected={isSel}
                        tabIndex={0}
                        className={`wtsg-card ${isSel ? "selected" : ""}`}
                        onClick={() => onSelect(r.id)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onSelect(r.id);
                            }
                        }}
                    >
                        <div className="wtsg-card-head">
                            <span className="wtsg-card-title" title={r.name}>
                                {r.name}
                            </span>
                            <span
                                className={`wtsg-badge ${r.completed ? "done" : "open"}`}
                                aria-hidden="true"
                            />
                        </div>
                        <div className="wtsg-card-meta">
                            <span>
                                {strings.colType}: {r.type || "—"}
                            </span>
                            <span>
                                {strings.colDate}: {r.date || "—"}
                            </span>
                        </div>
                        <div className="wtsg-card-total">
                            {strings.total}: <strong>{r.totalFormatted || "—"}</strong>
                        </div>
                        {r.extras.length > 0 && (
                            <div className="wtsg-card-extras">
                                {r.extras.map((x) => (
                                    <span key={x.key} className="wtsg-chip" title={x.label}>
                                        {x.value}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
