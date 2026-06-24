import * as React from "react";

/**
 * Option C — "compact summary" collapsible action bar (mobile only).
 *
 * On a narrow/phone layout the full filter bar (search + mode + period + sort)
 * eats a lot of vertical space. This wraps it in an animated container that
 * collapses to a single summary line ("🔍 Zuordnen · Alle · Datum (neueste)  8 ⌄"),
 * maximizing the visible list while keeping the active filters in view. Tapping
 * the summary expands the full bar again.
 *
 * On desktop/wide hosts the mechanism is disabled — the bar renders unchanged
 * with no trigger row.
 */
interface Props {
    /** false ⇒ mechanism off (desktop): always expanded, no trigger row. */
    enabled: boolean;
    /** Short form of the active filters, e.g. "Zuordnen · Alle · Datum (neueste)". */
    summary: string;
    /** Currently displayed record count (shown right of the summary). */
    recordCount: number;
    /** A search term is active → show the search-dot indicator in the summary. */
    hasSearch: boolean;
    /** Label for the "hide filters" trigger row (expanded state). */
    collapseLabel: string;
    /** aria-label for the collapsed summary row ("show filters"). */
    expandLabel: string;
    /** The full action bar (toolbar + sub-toolbar) as children. */
    children: React.ReactNode;
}

const Chevron: React.FC<{ dir: "up" | "down"; color: string }> = ({
    dir,
    color,
}) => (
    <svg
        className="wtsg-ab-chevron"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d={dir === "up" ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
    </svg>
);

const SearchIcon: React.FC = () => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#0f6cbd"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16l4.5 4.5" />
    </svg>
);

export const CollapsibleActionBar: React.FC<Props> = ({
    enabled,
    summary,
    recordCount,
    hasSearch,
    collapseLabel,
    expandLabel,
    children,
}) => {
    const [expanded, setExpanded] = React.useState(true);
    const innerRef = React.useRef<HTMLDivElement>(null);
    const [maxH, setMaxH] = React.useState<number | undefined>(undefined);

    // Measure the real content height so the collapse animates to the exact size
    // (the bar wraps differently per width, so a fixed value would clip or gap).
    React.useLayoutEffect(() => {
        const h = innerRef.current?.scrollHeight;
        if (h != null) setMaxH((prev) => (prev === h ? prev : h));
    });

    // Keep the collapsed bar out of the tab order / a11y tree (it stays mounted
    // so the search value + measured height survive). `inert` is ignored on hosts
    // that don't support it — the visual collapse still applies.
    React.useEffect(() => {
        const el = innerRef.current;
        if (!el) return;
        if (expanded) el.removeAttribute("inert");
        else el.setAttribute("inert", "");
    }, [expanded]);

    // Desktop / wide host: mechanism off — render the bar as-is, no trigger.
    if (!enabled) return <>{children}</>;

    return (
        <>
            <div
                className="wtsg-ab-collapse"
                aria-hidden={!expanded}
                style={{
                    maxHeight: expanded ? maxH ?? 600 : 0,
                    opacity: expanded ? 1 : 0,
                }}
            >
                <div ref={innerRef} id="wtsg-actionbar-full">
                    {children}
                </div>
            </div>

            {expanded ? (
                <button
                    type="button"
                    className="wtsg-ab-trigger"
                    aria-expanded={true}
                    aria-controls="wtsg-actionbar-full"
                    onClick={() => setExpanded(false)}
                >
                    {collapseLabel}
                    <Chevron dir="up" color="#605e5c" />
                </button>
            ) : (
                <button
                    type="button"
                    className="wtsg-ab-summary"
                    aria-expanded={false}
                    aria-controls="wtsg-actionbar-full"
                    aria-label={expandLabel}
                    onClick={() => setExpanded(true)}
                >
                    <span
                        className={`wtsg-ab-search ${hasSearch ? "active" : ""}`}
                        aria-hidden="true"
                    >
                        <SearchIcon />
                    </span>
                    <span className="wtsg-ab-summary-text">{summary}</span>
                    <span className="wtsg-ab-summary-count">{recordCount}</span>
                    <Chevron dir="down" color="#0f6cbd" />
                </button>
            )}
        </>
    );
};
