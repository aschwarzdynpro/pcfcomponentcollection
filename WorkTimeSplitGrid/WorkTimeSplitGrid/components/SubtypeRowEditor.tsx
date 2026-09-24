import * as React from "react";
import { parseNumber, formatNumber } from "./api";
import { EPSILON } from "./schema";

/** Mobile stepper increment (hours). */
export const STEP = 0.25;

export interface SubtypeRowEditorProps {
    /** Row identity (subtype id, or the normalized key in the day editor). */
    id: string;
    name: string;
    /** Raw input text (as typed). */
    value: string;
    editable: boolean;
    isMobile: boolean;
    /** Hours still unassigned — the "take remaining" arrow shows while > 0. */
    remaining: number;
    takeRemainingLabel: string;
    onChange: (id: string, value: string) => void;
}

/**
 * One editable subtype row: name · "take remaining" arrow · numeric input
 * (wrapped in a −/+ stepper on mobile). Shared by the single-entry split
 * editor and the day-level editor so both behave identically.
 */
export const SubtypeRowEditor: React.FC<SubtypeRowEditorProps> = ({
    id,
    name,
    value,
    editable,
    isMobile,
    remaining,
    takeRemainingLabel,
    onChange,
}) => {
    const parsed = parseNumber(value);
    const invalid = Number.isNaN(parsed);
    const showFill = editable && remaining > EPSILON;
    const rounded = Math.round(remaining * 1000) / 1000;

    /** Mobile +/− stepper: adjust by ±STEP, floored at 0. */
    const step = (delta: number) => {
        const base = Number.isNaN(parsed) ? 0 : parsed;
        const next = Math.max(0, Math.round((base + delta) * 1000) / 1000);
        onChange(id, formatNumber(next));
    };

    const input = (
        <input
            type="text"
            inputMode="decimal"
            className={`wtsg-rowinput ${invalid ? "invalid" : ""}`}
            value={value}
            placeholder="0"
            disabled={!editable}
            onChange={(e) => onChange(id, e.target.value)}
        />
    );

    return (
        <label className="wtsg-rowitem">
            <span className="wtsg-rowname">{name}</span>
            <span className="wtsg-rowfill">
                {showFill && (
                    <button
                        type="button"
                        className="wtsg-fillbtn"
                        title={`${takeRemainingLabel} (${rounded})`}
                        aria-label={`${takeRemainingLabel} (${rounded})`}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const base = Number.isNaN(parsed) ? 0 : parsed;
                            onChange(id, formatNumber(base + remaining));
                        }}
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            aria-hidden="true"
                        >
                            <path
                                d="M2.5 8h8M7.5 4.5 11 8l-3.5 3.5M13 3.5v9"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </button>
                )}
            </span>
            {isMobile ? (
                <div className="wtsg-stepper">
                    <button
                        type="button"
                        className="wtsg-step"
                        aria-label={`−${STEP}`}
                        disabled={!editable || invalid || parsed <= 0}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            step(-STEP);
                        }}
                    >
                        −
                    </button>
                    {input}
                    <button
                        type="button"
                        className="wtsg-step"
                        aria-label={`+${STEP}`}
                        disabled={!editable}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            step(STEP);
                        }}
                    >
                        +
                    </button>
                </div>
            ) : (
                input
            )}
        </label>
    );
};
