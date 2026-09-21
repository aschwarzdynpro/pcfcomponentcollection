import * as React from "react";

export interface BarcodeScanButtonProps {
    /** Caption on the button (already localized / maker-overridden). */
    caption: string;
    /** Caption while the scanner is open. */
    busyCaption: string;
    /** CSS color for the button background (any CSS color string). */
    fillColor: string;
    /** CSS color for caption + icon. */
    textColor: string;
    /** Font size in px. */
    fontSize: number;
    /** True while `getBarcodeValue()` is pending. */
    busy: boolean;
    /** Host `isControlDisabled` / DisplayMode.Disabled. */
    disabled: boolean;
    onScan: () => void;
}

/**
 * The whole UI: one full-size button. Everything the host needs to know about
 * the scan result travels through the output properties, not through the DOM —
 * the canvas app renders its own result card.
 */
export const BarcodeScanButton: React.FC<BarcodeScanButtonProps> = (props) => {
    const {
        caption,
        busyCaption,
        fillColor,
        textColor,
        fontSize,
        busy,
        disabled,
        onScan,
    } = props;

    const style: React.CSSProperties = {
        background: fillColor,
        color: textColor,
        fontSize: `${fontSize}px`,
    };

    return (
        <button
            type="button"
            className={"bsc-button" + (busy ? " bsc-button--busy" : "")}
            style={style}
            disabled={disabled || busy}
            aria-busy={busy}
            onClick={onScan}
        >
            <QrIcon />
            <span className="bsc-caption">{busy ? busyCaption : caption}</span>
        </button>
    );
};

/** Inline QR glyph so the control ships without an image resource. */
const QrIcon: React.FC = () => (
    <svg
        className="bsc-icon"
        viewBox="0 0 24 24"
        width="1.25em"
        height="1.25em"
        aria-hidden="true"
        focusable="false"
    >
        <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <path d="M14 14h3v3h-3zM20 14v1M20 18v3M14 20h3" />
        </g>
    </svg>
);
