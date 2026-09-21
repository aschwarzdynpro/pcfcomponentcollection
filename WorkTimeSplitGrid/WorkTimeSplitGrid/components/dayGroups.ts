import { EntryRow, Lang } from "./types";

/** BCP-47 locale per UI language — drives weekday + number formatting. */
export const LOCALE: Record<Lang, string> = {
    de: "de-DE",
    en: "en-US",
    fr: "fr-FR",
};

/**
 * One calendar day of ONE resource: its rows plus the work / travel / total
 * sums (hours) for the group header and the day-split editor.
 *
 * The resource is part of the key on purpose: the surcharge rules (8h/day →
 * overtime, Sunday, holiday) are per person, so in the team-lead "all hours"
 * view two people working the same day must not be pooled.
 */
export interface DayGroup {
    key: string;
    /** "Fr, 31.01.2025" (+ " · <resource>" when the list spans several). */
    label: string;
    /** Local calendar day "YYYY-MM-DD" (empty when the row has no date). */
    day: string;
    /** Raw ISO date of the first row — for the day-level suggestion. */
    dateIso: string;
    resourceName: string;
    rows: EntryRow[];
    work: number;
    travel: number;
    total: number;
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

/**
 * Group rows by (day, resource), keeping the incoming (date-sorted) order.
 * The resource name is appended to the label only when the rows span more
 * than one resource (team-lead view) — for "my hours" the label stays a date.
 */
export function groupRows(rows: EntryRow[], lang: Lang): DayGroup[] {
    const groups: DayGroup[] = [];
    const byKey = new Map<string, DayGroup>();
    const resources = new Set<string>();
    for (const r of rows) {
        const day = dayKey(r);
        const resourceName = r.resourceName ?? "";
        resources.add(resourceName.toLowerCase());
        const key = `${day}|${resourceName.toLowerCase()}`;
        let g = byKey.get(key);
        if (!g) {
            g = {
                key,
                label: dayLabel(r, lang),
                day,
                dateIso: r.dateValue ?? "",
                resourceName,
                rows: [],
                work: 0,
                travel: 0,
                total: 0,
            };
            byKey.set(key, g);
            groups.push(g);
        }
        g.rows.push(r);
        const h = Number.isFinite(r.total) ? r.total : 0;
        g.total += h;
        if (r.kind === "work") g.work += h;
        else if (r.kind === "travel") g.travel += h;
    }
    if (resources.size > 1) {
        for (const g of groups) {
            if (g.resourceName) g.label = `${g.label} · ${g.resourceName}`;
        }
    }
    return groups;
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
