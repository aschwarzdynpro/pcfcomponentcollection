import { EntryRow, Lang } from "./types";

/** BCP-47 locale per UI language — drives weekday + number formatting. */
export const LOCALE: Record<Lang, string> = {
    de: "de-DE",
    en: "en-US",
    fr: "fr-FR",
};

/** A grouping dimension of the master list. */
export type GroupDim = "project" | "resource" | "day";

/** Labels for rows with no value in a dimension. */
export interface GroupLabels {
    noProject: string;
    noResource: string;
}

/**
 * A node of the (at most two-level) group tree: its rows plus the work /
 * travel / total sums (hours) for the header. `children` is set on level-1
 * nodes when a second dimension is active.
 */
export interface GroupNode {
    /** Path key, unique across the tree ("project:p1|day:2025-01-31"). */
    key: string;
    dim: GroupDim;
    /** 0 = outer level, 1 = inner level. */
    depth: number;
    label: string;
    rows: EntryRow[];
    children: GroupNode[] | null;
    /** Values fixed by this node's path (day key / lower-cased resource). */
    day?: string;
    resource?: string;
    project?: string;
    /** Raw ISO date of the node's first row (day-level suggestion). */
    dateIso: string;
    work: number;
    travel: number;
    total: number;
}

/**
 * The entries a day split operates on: ALL open entries of one person on one
 * day — across projects and regardless of the search term — because the
 * surcharge rules (8 h/day → overtime, Sunday, holiday) are per person per day.
 */
export interface DayScope {
    /** "<day>|<resource lower-case>" */
    key: string;
    label: string;
    dateIso: string;
    rows: EntryRow[];
    /** Hint shown in the editor (e.g. "also contains entries from …"). */
    note?: string;
}

/** Local calendar-day key ("2025-01-31") from the row's ISO date; falls back
 *  to the formatted display date so undated rows still group consistently. */
export function dayKey(r: EntryRow): string {
    if (r.dateValue) {
        const d = new Date(r.dateValue);
        if (!isNaN(d.getTime())) {
            const p = (n: number) => String(n).padStart(2, "0");
            return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
        }
    }
    return r.date || "";
}

/** "Fr, 31.01.2025" (weekday in the UI language), else the formatted date as
 *  delivered by the platform. */
export function dayLabel(r: EntryRow, lang: Lang): string {
    if (r.dateValue) {
        const d = new Date(r.dateValue);
        if (!isNaN(d.getTime())) {
            try {
                const wd = new Intl.DateTimeFormat(LOCALE[lang], {
                    weekday: "short",
                }).format(d);
                return r.date ? `${wd}, ${r.date}` : wd;
            } catch {
                /* fall through */
            }
        }
    }
    return r.date || "—";
}

const resourceKey = (r: EntryRow): string =>
    (r.resourceName ?? "").trim().toLowerCase();

const projectKey = (r: EntryRow): string =>
    (r.project || r.projectName || "").trim();

/** Scope key of the day split an entry belongs to ("<day>|<resource>"). */
export function rowScopeKey(r: EntryRow): string {
    return `${dayKey(r)}|${resourceKey(r)}`;
}

function valueOf(dim: GroupDim, r: EntryRow): string {
    if (dim === "day") return dayKey(r);
    if (dim === "resource") return resourceKey(r);
    return projectKey(r);
}

function labelOf(
    dim: GroupDim,
    r: EntryRow,
    lang: Lang,
    labels: GroupLabels,
): string {
    if (dim === "day") return dayLabel(r, lang);
    if (dim === "resource") return r.resourceName?.trim() || labels.noResource;
    const nr = (r.project ?? "").trim();
    const nm = (r.projectName ?? "").trim();
    if (nr && nm && nm !== nr) return `${nr} · ${nm}`;
    return nr || nm || labels.noProject;
}

/** Group order per dimension; empty values always go last. */
function compareGroups(
    dim: GroupDim,
    a: string,
    b: string,
    dayAscending: boolean,
): number {
    if (!a !== !b) return a ? -1 : 1;
    if (dim === "day") return dayAscending ? a.localeCompare(b) : b.localeCompare(a);
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function sums(rows: EntryRow[]): { work: number; travel: number; total: number } {
    let work = 0;
    let travel = 0;
    let total = 0;
    for (const r of rows) {
        const h = Number.isFinite(r.total) ? r.total : 0;
        total += h;
        if (r.kind === "work") work += h;
        else if (r.kind === "travel") travel += h;
    }
    return { work, travel, total };
}

function buildLevel(
    rows: EntryRow[],
    dims: GroupDim[],
    depth: number,
    parent: Pick<GroupNode, "key" | "day" | "resource" | "project"> | null,
    lang: Lang,
    labels: GroupLabels,
    dayAscending: boolean,
): GroupNode[] {
    const dim = dims[depth];
    const byValue = new Map<string, EntryRow[]>();
    for (const r of rows) {
        const v = valueOf(dim, r);
        const list = byValue.get(v);
        if (list) list.push(r);
        else byValue.set(v, [r]);
    }
    const values = Array.from(byValue.keys()).sort((a, b) =>
        compareGroups(dim, a, b, dayAscending),
    );
    return values.map((v) => {
        const groupRows = byValue.get(v)!;
        const first = groupRows[0];
        const key = `${parent ? parent.key + "|" : ""}${dim}:${v}`;
        const node: GroupNode = {
            key,
            dim,
            depth,
            label: labelOf(dim, first, lang, labels),
            rows: groupRows,
            children: null,
            day: dim === "day" ? v : parent?.day,
            resource: dim === "resource" ? v : parent?.resource,
            project: dim === "project" ? v : parent?.project,
            dateIso: first.dateValue ?? "",
            ...sums(groupRows),
        };
        if (depth + 1 < dims.length) {
            node.children = buildLevel(
                groupRows,
                dims,
                depth + 1,
                node,
                lang,
                labels,
                dayAscending,
            );
        }
        return node;
    });
}

/**
 * Build the group tree for 1–2 dimensions, keeping the incoming (sorted) row
 * order inside each group. Returns null when no dimension is active.
 */
export function buildGroups(
    rows: EntryRow[],
    dims: GroupDim[],
    lang: Lang,
    labels: GroupLabels,
    dayAscending: boolean,
): GroupNode[] | null {
    const active = dims.slice(0, 2);
    if (active.length === 0) return null;
    return buildLevel(rows, active, 0, null, lang, labels, dayAscending);
}

/**
 * The day-split scope key a node can open, or null when it can't: the node's
 * path must fix the day, and the person must be unambiguous — fixed by the
 * path, or all rows of the node belong to one resource.
 */
export function nodeScopeKey(node: GroupNode): string | null {
    if (node.day === undefined) return null;
    if (node.resource !== undefined) return `${node.day}|${node.resource}`;
    const res = new Set(node.rows.map(resourceKey));
    if (res.size !== 1) return null;
    return `${node.day}|${Array.from(res)[0]}`;
}

/** "6,5 h" — locale number with at most 2 decimals plus the unit. */
export function formatHours(n: number, lang: Lang, unit: string): string {
    let s: string;
    try {
        s = new Intl.NumberFormat(LOCALE[lang], {
            maximumFractionDigits: 2,
        }).format(n);
    } catch {
        s = String(Math.round(n * 100) / 100);
    }
    return unit ? `${s} ${unit}` : s;
}
