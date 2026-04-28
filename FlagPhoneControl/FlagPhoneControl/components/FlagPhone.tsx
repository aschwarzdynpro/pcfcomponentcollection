import * as React from "react";
import * as ReactDOM from "react-dom";
import {
    countries,
    countryMatches,
    Country,
    DEFAULT_ISO,
    findCountryByIso,
    Lang,
    localizedName,
    parsePhone,
    STRINGS,
} from "./countries";
import { Flag } from "./Flag";

export interface FlagPhoneProps {
    value: string | null;
    defaultCountry?: string | null;
    placeholder?: string | null;
    disabled?: boolean;
    lang?: Lang;
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
    const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null);

    const wrapperRef = React.useRef<HTMLDivElement>(null);
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const filterInputRef = React.useRef<HTMLInputElement>(null);

    // Tracks the last value we emitted upstream. When the host echoes that
    // same value back via props.value, we skip the resync below — otherwise
    // a stale echo can overwrite characters the user has typed in the
    // meantime, producing visible "rewinds" while typing fast.
    const lastEmittedRef = React.useRef<string>(props.value ?? "");

    React.useEffect(() => {
        const incoming = props.value ?? "";
        if (incoming === lastEmittedRef.current) return;

        const parsed = parsePhone(incoming, props.defaultCountry ?? DEFAULT_ISO);
        lastEmittedRef.current = incoming;
        setIso(parsed.iso);
        setNational(parsed.national);
    }, [props.value, props.defaultCountry]);

    // Reposition the portaled dropdown under the trigger; keep it in sync with
    // ancestor scroll/resize so we don't drift while open.
    React.useLayoutEffect(() => {
        if (!open) {
            setAnchorRect(null);
            return;
        }
        const recalc = () => {
            if (wrapperRef.current) {
                setAnchorRect(wrapperRef.current.getBoundingClientRect());
            }
        };
        recalc();
        window.addEventListener("resize", recalc);
        window.addEventListener("scroll", recalc, true);
        return () => {
            window.removeEventListener("resize", recalc);
            window.removeEventListener("scroll", recalc, true);
        };
    }, [open]);

    React.useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                !wrapperRef.current?.contains(target) &&
                !dropdownRef.current?.contains(target)
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
        lastEmittedRef.current = combined;
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

    const lang: Lang = props.lang ?? "en";
    const t = STRINGS[lang];

    const filtered = React.useMemo(() => {
        const q = filter.trim().toLowerCase();
        if (!q) return countries;
        return countries.filter((c) => countryMatches(c, q));
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
                title={`${localizedName(country, lang)} (${country.dial})`}
            >
                <Flag iso={country.iso} className="fpc-flag" />
                <span className="fpc-dial">{country.dial}</span>
                <span className="fpc-caret" aria-hidden="true">▾</span>
            </button>

            <input
                type="tel"
                className="fpc-number"
                value={national}
                onChange={handleNationalChange}
                placeholder={props.placeholder ?? t.placeholder}
                disabled={props.disabled}
                aria-label={t.phoneAria}
            />

            {open &&
                anchorRect &&
                ReactDOM.createPortal(
                    <div
                        ref={dropdownRef}
                        className="fpc-dropdown"
                        role="listbox"
                        style={{
                            position: "fixed",
                            top: anchorRect.bottom + 4,
                            left: anchorRect.left,
                            width: anchorRect.width,
                        }}
                    >
                        <input
                            ref={filterInputRef}
                            type="text"
                            className="fpc-search"
                            placeholder={t.search}
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                        <ul className="fpc-list">
                            {filtered.length === 0 && (
                                <li className="fpc-empty">{t.empty}</li>
                            )}
                            {filtered.map((c) => (
                                <li
                                    key={c.iso}
                                    role="option"
                                    aria-selected={c.iso === iso}
                                    className={`fpc-option ${c.iso === iso ? "fpc-option-selected" : ""}`}
                                    onClick={() => handleSelect(c.iso)}
                                >
                                    <Flag iso={c.iso} className="fpc-flag" />
                                    <span className="fpc-option-name">{localizedName(c, lang)}</span>
                                    <span className="fpc-option-iso">{c.iso}</span>
                                    <span className="fpc-option-dial">{c.dial}</span>
                                </li>
                            ))}
                        </ul>
                    </div>,
                    document.body,
                )}
        </div>
    );
};
