import * as React from "react";

export interface DropdownOption {
    value: string;
    label: string;
}

export interface DropdownProps {
    value: string;
    options: DropdownOption[];
    onChange: (value: string) => void;
    ariaLabel?: string;
    /** Extra class on the root (for layout). */
    className?: string;
    /** When set, the trigger renders just this icon (compact, no value/chevron). */
    icon?: React.ReactNode;
}

/**
 * Lightweight, dependency-free dropdown (custom-styled listbox) replacing the
 * native <select>. Click-outside + Escape close it; arrow keys move the
 * selection while open; the trigger shows the current label + a chevron.
 */
export const Dropdown: React.FC<DropdownProps> = ({
    value,
    options,
    onChange,
    ariaLabel,
    className,
    icon,
}) => {
    const [open, setOpen] = React.useState(false);
    const rootRef = React.useRef<HTMLDivElement>(null);
    const selected = options.find((o) => o.value === value);

    React.useEffect(() => {
        if (!open) return;
        const onDocDown = (e: MouseEvent) => {
            if (
                rootRef.current &&
                !rootRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onDocDown);
        return () => document.removeEventListener("mousedown", onDocDown);
    }, [open]);

    const choose = (v: string) => {
        onChange(v);
        setOpen(false);
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            if (open) {
                e.stopPropagation();
                setOpen(false);
            }
            return;
        }
        if (!open) {
            if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpen(true);
            }
            return;
        }
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const i = options.findIndex((o) => o.value === value);
            const next =
                e.key === "ArrowDown"
                    ? Math.min(options.length - 1, i + 1)
                    : Math.max(0, i - 1);
            if (options[next]) onChange(options[next].value);
        }
    };

    return (
        <div
            className={`wtsg-dd ${className ?? ""}`}
            ref={rootRef}
            onKeyDown={onKeyDown}
        >
            <button
                type="button"
                className={`wtsg-dd-trigger ${
                    icon ? "wtsg-dd-iconbtn" : ""
                } ${open ? "open" : ""}`}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={ariaLabel}
                title={icon ? ariaLabel : undefined}
                onClick={() => setOpen((v) => !v)}
            >
                {icon ?? (
                    <>
                        <span className="wtsg-dd-value">
                            {selected?.label ?? ""}
                        </span>
                        <svg
                            className="wtsg-dd-chevron"
                            width="12"
                            height="12"
                            viewBox="0 0 16 16"
                            aria-hidden="true"
                        >
                            <path
                                d="M4 6l4 4 4-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </>
                )}
            </button>
            {open && (
                <div
                    className="wtsg-dd-menu"
                    role="listbox"
                    aria-label={ariaLabel}
                >
                    {options.map((o) => (
                        <button
                            key={o.value}
                            type="button"
                            role="option"
                            aria-selected={o.value === value}
                            className={`wtsg-dd-item ${
                                o.value === value ? "selected" : ""
                            }`}
                            onClick={() => choose(o.value)}
                        >
                            <span className="wtsg-dd-check" aria-hidden="true">
                                {o.value === value && (
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
                            {o.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
