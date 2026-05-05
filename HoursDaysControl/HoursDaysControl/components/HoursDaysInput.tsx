import * as React from "react";
import { Lang, STRINGS } from "./strings";

export interface HoursDaysInputProps {
    value: number | null;
    hoursPerDay: number;
    disabled?: boolean;
    lang?: Lang;
    onChange: (value: number | null) => void;
}

interface Decomposed {
    days: number;
    hours: number;
}

// Splits a total-hours value into (whole) workdays and remaining hours.
// Fractional input is preserved on the hours side so users can store e.g. 0.5h.
const decompose = (totalHours: number, hoursPerDay: number): Decomposed => {
    if (!Number.isFinite(totalHours) || totalHours === 0) {
        return { days: 0, hours: 0 };
    }
    const sign = totalHours < 0 ? -1 : 1;
    const abs = Math.abs(totalHours);
    const days = Math.floor(abs / hoursPerDay);
    // Round to 4 decimals to avoid float dust like 0.30000000000000004.
    const hours = Math.round((abs - days * hoursPerDay) * 10000) / 10000;
    return { days: sign * days, hours: sign * hours };
};

const compose = (
    days: number,
    hours: number,
    hoursPerDay: number,
): number => {
    const total = days * hoursPerDay + hours;
    return Math.round(total * 10000) / 10000;
};

// Parses a string from a number-like input. Accepts both "." and "," as the
// decimal separator so users in de-DE can type "1,5" without it disappearing.
const parseInput = (raw: string): number | null => {
    if (raw == null) return null;
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed === "-") return null;
    const normalized = trimmed.replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
};

export const HoursDaysInput: React.FC<HoursDaysInputProps> = (props) => {
    const { value, hoursPerDay, disabled, onChange } = props;
    const lang: Lang = props.lang ?? "en";
    const t = STRINGS[lang];

    // We mirror the bound numeric value into two text-state inputs so the user
    // can clear a field while typing without us "snapping" it back to 0.
    const initial = React.useMemo(
        () => decompose(value ?? 0, hoursPerDay),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    const [daysText, setDaysText] = React.useState<string>(
        value === null ? "" : initial.days.toString(),
    );
    const [hoursText, setHoursText] = React.useState<string>(
        value === null ? "" : initial.hours.toString(),
    );

    // The most recent value we emitted upstream — when the host echoes the
    // same number back through props.value we skip the resync to avoid
    // overwriting the text the user is currently editing.
    const lastEmittedRef = React.useRef<number | null>(value);

    React.useEffect(() => {
        if (value === lastEmittedRef.current) return;
        lastEmittedRef.current = value;
        if (value === null) {
            setDaysText("");
            setHoursText("");
            return;
        }
        const parts = decompose(value, hoursPerDay);
        setDaysText(parts.days.toString());
        setHoursText(parts.hours.toString());
    }, [value, hoursPerDay]);

    const emit = (nextDaysText: string, nextHoursText: string) => {
        const d = parseInput(nextDaysText);
        const h = parseInput(nextHoursText);
        // Both fields empty → clear the bound value.
        if (d === null && h === null) {
            lastEmittedRef.current = null;
            onChange(null);
            return;
        }
        const total = compose(d ?? 0, h ?? 0, hoursPerDay);
        lastEmittedRef.current = total;
        onChange(total);
    };

    const handleDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDaysText(e.target.value);
        emit(e.target.value, hoursText);
    };

    const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setHoursText(e.target.value);
        emit(daysText, e.target.value);
    };

    // On blur, normalise the textual form to match what the underlying
    // numeric value actually represents. This collapses "1.0" → "1",
    // overflow like "10" hours with hoursPerDay=8 → "1 day, 2 hours", and
    // mixed-sign input → a consistent sign.
    const handleBlur = () => {
        const current = lastEmittedRef.current;
        if (current === null) {
            setDaysText("");
            setHoursText("");
            return;
        }
        const parts = decompose(current, hoursPerDay);
        setDaysText(parts.days.toString());
        setHoursText(parts.hours.toString());
    };

    const totalHours =
        parseInput(daysText) === null && parseInput(hoursText) === null
            ? null
            : compose(
                  parseInput(daysText) ?? 0,
                  parseInput(hoursText) ?? 0,
                  hoursPerDay,
              );

    return (
        <div className={`hdc-root ${disabled ? "hdc-disabled" : ""}`}>
            <div className="hdc-fields">
                <label className="hdc-field">
                    <span className="hdc-label">{t.daysLabel}</span>
                    <input
                        type="number"
                        inputMode="decimal"
                        className="hdc-input"
                        value={daysText}
                        onChange={handleDaysChange}
                        onBlur={handleBlur}
                        disabled={disabled}
                        step="1"
                        aria-label={t.daysAria}
                    />
                </label>
                <label className="hdc-field">
                    <span className="hdc-label">{t.hoursLabel}</span>
                    <input
                        type="number"
                        inputMode="decimal"
                        className="hdc-input"
                        value={hoursText}
                        onChange={handleHoursChange}
                        onBlur={handleBlur}
                        disabled={disabled}
                        step="0.25"
                        aria-label={t.hoursAria}
                    />
                </label>
            </div>
            {totalHours !== null && (
                <div className="hdc-summary" aria-live="polite">
                    {t.totalLabel(totalHours)}
                </div>
            )}
        </div>
    );
};
