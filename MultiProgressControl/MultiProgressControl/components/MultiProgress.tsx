import * as React from "react";
import { Lang, STRINGS } from "./strings";

export interface ProgressItem {
    key: string;
    /** Caption shown for the indicator (override or column display name). */
    label: string;
    /** Value normalised to an integer 0-100. */
    percent: number;
}

export interface MultiProgressProps {
    items: ProgressItem[];
    /** Optional header caption; empty => no header. */
    header: string;
    /** Brand colour used for the "in progress" state (1-99%). */
    brandColor: string;
    lang: Lang;
}

// Ring geometry — must match the design handoff exactly.
const RING_PX = 52;
const RADIUS = 23.5;
const STROKE = 5;
const CIRCUMFERENCE = 147.65; // 2 * PI * 23.5
const TRACK_COLOR = "#edebe9";
const NEUTRAL_COLOR = "#c8c6c4"; // 0%
const SUCCESS_COLOR = "#0e700e"; // 100%

const statusColor = (percent: number, brand: string): string => {
    if (percent <= 0) return NEUTRAL_COLOR;
    if (percent >= 100) return SUCCESS_COLOR;
    return brand;
};

const Ring: React.FC<{ percent: number; color: string }> = ({
    percent,
    color,
}) => {
    const offset = (CIRCUMFERENCE * (1 - percent / 100)).toFixed(2);
    return (
        <div className="mpc-ring">
            <svg
                width={RING_PX}
                height={RING_PX}
                viewBox={`0 0 ${RING_PX} ${RING_PX}`}
            >
                <circle
                    cx="26"
                    cy="26"
                    r={RADIUS}
                    fill="none"
                    stroke={TRACK_COLOR}
                    strokeWidth={STROKE}
                />
                <circle
                    cx="26"
                    cy="26"
                    r={RADIUS}
                    fill="none"
                    stroke={color}
                    strokeWidth={STROKE}
                    strokeLinecap="round"
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={offset}
                    transform="rotate(-90 26 26)"
                />
            </svg>
            <div className="mpc-value" style={{ color }}>
                {percent}%
            </div>
        </div>
    );
};

/**
 * Design handoff "Variant C" — a row of ring indicators. The row is a grid that
 * shows all six rings on one line when there is room and snaps to exactly three
 * per row when it has to wrap (never the ragged 5+1 / 4+2 that flex-wrap gives).
 */
export const MultiProgress: React.FC<MultiProgressProps> = (props) => {
    const { items, header, brandColor, lang } = props;
    const t = STRINGS[lang];

    if (items.length === 0) {
        return <div className="mpc-empty">{t.noFields}</div>;
    }

    return (
        <div className="mpc-root">
            {header && <div className="mpc-header">{header}</div>}
            <div className="mpc-row">
                {items.map((item) => {
                    const color = statusColor(item.percent, brandColor);
                    return (
                        <div
                            key={item.key}
                            className="mpc-item"
                            title={`${item.label ? `${item.label}: ` : ""}${item.percent}%`}
                        >
                            <div
                                role="progressbar"
                                aria-valuenow={item.percent}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label={item.label || undefined}
                            >
                                <Ring percent={item.percent} color={color} />
                            </div>
                            {item.label && (
                                <div className="mpc-label">{item.label}</div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
