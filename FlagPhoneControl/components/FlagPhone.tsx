import * as React from "react";
import {
    countries,
    Country,
    DEFAULT_ISO,
    findCountryByIso,
    flagEmoji,
    parsePhone,
} from "./countries";

export interface FlagPhoneProps {
    value: string | null;
    defaultCountry?: string | null;
    placeholder?: string | null;
    disabled?: boolean;
    onChange: (value: string) => void;
}

export const FlagPhone: React.FC<FlagPhoneProps> = (props) => {
    const initial = React.useMemo(
        () => parsePhone(props.value, props.defaultCountry ?? DEFAULT_ISO),
        // only reparse when the bound value identity changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [props.value],
    );

    const [iso, setIso] = React.useState<string>(initial.iso);
    const [national, setNational] = React.useState<string>(initial.national);
    const [open, setOpen] = React.useState(false);
    const [filter, setFilter] = React.useState("");

    const wrapperRef = React.useRef<HTMLDivElement>(null);
    const filterInputRef = React.useRef<HTMLInputElement>(null);

    // When the bound value changes from outside, sync local state
    React.useEffect(() => {
        const parsed = parsePhone(props.value, props.defaultCountry ?? DEFAULT_ISO);
        setIso(parsed.iso);
        setNational(parsed.national);
    }, [props.value, props.defaultCountry]);

    React.useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (
                wrapperRef.current &&
                !wrapperRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
                setFilter("");
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    React.useEffect(() => {
        if (open && filterInputRef.current) {
            filterInputRef.current.focus();
        }
    }, [open]);

    const country: Country =
        findCountryByIso(iso) ?? findCountryByIso(DEFAULT_ISO)!;

    const emit = (nextIso: string, nextNational: string) => {
        const c = findCountryByIso(nextIso);
        const digits = nextNational.replace(/\D/g, "");
        const combined = c && digits ? `${c.dial}${digits}` : "";
        props.onChange(combined);
    };

    const handleSelect = (nextIso: string) => {
        setIso(nextIso);
        setOpen(false);
        setFilter("");
        emit(nextIso, national);
    };

    const handleNationalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const cleaned = e.target.value.replace(/[^\d\s\-().]/g, "");
        setNational(cleaned);
        emit(iso, cleaned);
    };

    const filtered = React.useMemo(() => {
        const q = filter.trim().toLowerCase();
        if (!q) return countries;
        return countries.filter(
            (c) =>
                c.name.toLowerCase().includes(q) ||
                c.iso.toLowerCase().includes(q) ||
                c.dial.includes(q.replace(/^\+?/, "+")) ||
                c.dial.replace("+", "").includes(q.replace(/^\+/, "")),
        );
    }, [filter]);

    return (
        <div
            ref={wrapperRef}
            className={`fpc-root ${props.disabled ? "fpc-disabled" : ""}`}
        >
            <button
                type="button"
                className="fpc-country-button"
                disabled={props.disabled}
                onClick={() => !props.disabled && setOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
                title={`${country.name} (${country.dial})`}
            >
                <span className="fpc-flag" aria-hidden="true">
                    {flagEmoji(country.iso)}
                </span>
                <span className="fpc-iso">{country.iso}</span>
                <span className="fpc-dial">{country.dial}</span>
                <span className="fpc-caret" aria-hidden="true">▾</span>
            </button>

            <input
                type="tel"
                className="fpc-number"
                value={national}
                onChange={handleNationalChange}
                placeholder={props.placeholder ?? "Phone number"}
                disabled={props.disabled}
                aria-label="Phone number"
            />

            {open && (
                <div className="fpc-dropdown" role="listbox">
                    <input
                        ref={filterInputRef}
                        type="text"
                        className="fpc-search"
                        placeholder="Search country or code…"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                    <ul className="fpc-list">
                        {filtered.length === 0 && (
                            <li className="fpc-empty">No country found</li>
                        )}
                        {filtered.map((c) => (
                            <li
                                key={c.iso}
                                role="option"
                                aria-selected={c.iso === iso}
                                className={`fpc-option ${c.iso === iso ? "fpc-option-selected" : ""}`}
                                onClick={() => handleSelect(c.iso)}
                            >
                                <span className="fpc-flag" aria-hidden="true">
                                    {flagEmoji(c.iso)}
                                </span>
                                <span className="fpc-option-name">{c.name}</span>
                                <span className="fpc-option-dial">{c.dial}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};
