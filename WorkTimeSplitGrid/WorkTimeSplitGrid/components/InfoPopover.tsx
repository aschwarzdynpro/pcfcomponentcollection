import * as React from "react";

export interface InfoPopoverProps {
    /** Accessible name + native tooltip of the trigger. */
    label: string;
    title: string;
    /** Bullet points of the explanation. */
    points: string[];
}

/*
 * Layout-critical styles are inline on purpose: model-driven apps sometimes
 * keep serving a cached copy of the control's stylesheet after an update
 * while the new bundle already runs. Without its stylesheet an unstyled card
 * would render in the flow and push the whole toolbar apart; inline, it always
 * overlays. The stylesheet only adds polish on top.
 */
const WRAP_STYLE: React.CSSProperties = {
    position: "relative",
    display: "inline-flex",
};

const BTN_STYLE: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 14,
};

const CARD_STYLE: React.CSSProperties = {
    position: "absolute",
    top: "calc(100% + 6px)",
    right: 0,
    zIndex: 40,
    width: 340,
    maxWidth: "calc(100vw - 32px)",
    boxSizing: "border-box",
    padding: "12px 14px",
    background: "#fff",
    border: "1px solid #e1dfdd",
    borderRadius: 8,
    boxShadow: "0 6px 20px rgba(0, 0, 0, 0.16)",
    fontSize: 12,
    lineHeight: 1.45,
    color: "#424242",
    whiteSpace: "normal",
    textAlign: "left",
};

const TITLE_STYLE: React.CSSProperties = {
    margin: "0 0 8px",
    fontSize: 13,
    fontWeight: 600,
    color: "#242424",
};

const LIST_STYLE: React.CSSProperties = {
    margin: 0,
    paddingLeft: 18,
    display: "flex",
    flexDirection: "column",
    gap: 6,
};

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
        <div className="wtsg-info-pop" ref={rootRef} style={WRAP_STYLE}>
            <button
                type="button"
                className={`wtsg-infobtn wtsg-infobtn-sm ${open ? "open" : ""}`}
                aria-label={label}
                aria-expanded={open}
                title={label}
                style={BTN_STYLE}
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
                <div
                    className="wtsg-info-pop-card"
                    role="dialog"
                    aria-label={title}
                    style={CARD_STYLE}
                >
                    <h4 style={TITLE_STYLE}>{title}</h4>
                    <ul style={LIST_STYLE}>
                        {points.map((p, i) => (
                            <li key={i}>{p}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};
