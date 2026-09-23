import * as React from "react";

export interface InfoPopoverProps {
    /** Accessible name + native tooltip of the trigger. */
    label: string;
    title: string;
    /** Bullet points of the explanation. */
    points: string[];
}

/**
 * Small "i" button that opens an explanation popover (click / Enter; closes on
 * click-outside, Escape or a second click). The trigger also carries a native
 * tooltip so a hover alone already hints at what it explains.
 */
export const InfoPopover: React.FC<InfoPopoverProps> = ({
    label,
    title,
    points,
}) => {
    const [open, setOpen] = React.useState(false);
    const rootRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!open) return;
        const onDocDown = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDocDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDocDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <div className="wtsg-info-pop" ref={rootRef}>
            <button
                type="button"
                className={`wtsg-infobtn wtsg-infobtn-sm ${open ? "open" : ""}`}
                aria-label={label}
                aria-expanded={open}
                title={label}
                onClick={() => setOpen((v) => !v)}
            >
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 11v5" />
                    <path d="M12 8h.01" />
                </svg>
            </button>
            {open && (
                <div className="wtsg-info-pop-card" role="dialog" aria-label={title}>
                    <h4>{title}</h4>
                    <ul>
                        {points.map((p, i) => (
                            <li key={i}>{p}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};
