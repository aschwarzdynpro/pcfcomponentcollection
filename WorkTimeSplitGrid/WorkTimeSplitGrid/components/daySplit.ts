import { EntryRow } from "./types";
import { EPSILON, normalizeLabel } from "./schema";

/**
 * Day-level split: the user distributes ONE day's total (per category — work
 * and travel are edited separately) across the surcharge subtypes; this module
 * turns that into a per-entry distribution.
 *
 * Strategy = chronological fill ("Füllprinzip"): the entries of the day are
 * walked in time order and the subtypes in their canonical order (Normal →
 * Überstunde → Nacht/Sonntag → Feiertag …), pouring each subtype's hours into
 * the entries from the top. That mirrors how a person would do it by hand —
 * overtime lands on the last entries of the day, not pro rata on all of them —
 * and it only ever cuts at ONE boundary per subtype, so quarter-hour inputs
 * stay quarter hours. Every entry keeps exactly its own total (the per-entry
 * save guard "distributed = total" still holds); the last entry absorbs any
 * floating-point dust.
 */

/** One subtype "bucket" of the day editor (normalized key → display name). */
export interface DayBucket {
    /** normalizeLabel(name) — matches the entries' own subtype rows. */
    key: string;
    /** Display name (first spelling encountered across the entries). */
    name: string;
    /** Hours the user assigned to this subtype for the whole day. */
    hours: number;
}

/** Per-entry outcome: hours per subtype key (only keys with hours > 0). */
export interface EntryDistribution {
    entryId: string;
    /** subtype key → hours */
    parts: { key: string; hours: number }[];
}

const r3 = (n: number): number => Math.round(n * 1000) / 1000;

/** Chronological order: by ISO date, then by name for a stable tie-break
 *  (test data often carries identical timestamps). */
export function sortChronologically(rows: EntryRow[]): EntryRow[] {
    return [...rows].sort(
        (a, b) =>
            (a.dateValue ?? "").localeCompare(b.dateValue ?? "") ||
            a.name.localeCompare(b.name) ||
            a.id.localeCompare(b.id),
    );
}

/**
 * Fill `buckets` (in the given order) into `rows` (in chronological order).
 * Precondition: Σ bucket.hours ≈ Σ row.total (caller validates via the UI
 * guard); any remainder from rounding lands on the last row's last part.
 */
export function fillChronologically(
    rows: EntryRow[],
    buckets: DayBucket[],
): EntryDistribution[] {
    const ordered = sortChronologically(rows);
    const active = buckets.filter((b) => b.hours > EPSILON);
    const out: EntryDistribution[] = [];
    let bi = 0;
    let bucketLeft = active.length ? active[0].hours : 0;

    for (let i = 0; i < ordered.length; i++) {
        const row = ordered[i];
        let left = Number.isFinite(row.total) ? row.total : 0;
        const parts: { key: string; hours: number }[] = [];
        while (left > EPSILON && bi < active.length) {
            const take = Math.min(left, bucketLeft);
            if (take > EPSILON) {
                const last = parts[parts.length - 1];
                if (last && last.key === active[bi].key) last.hours = r3(last.hours + take);
                else parts.push({ key: active[bi].key, hours: r3(take) });
            }
            left = r3(left - take);
            bucketLeft = r3(bucketLeft - take);
            if (bucketLeft <= EPSILON) {
                bi += 1;
                bucketLeft = bi < active.length ? active[bi].hours : 0;
            }
        }
        // Float dust / a short day total: keep the entry's own total exact.
        if (left > EPSILON && parts.length) {
            parts[parts.length - 1].hours = r3(parts[parts.length - 1].hours + left);
        }
        out.push({ entryId: row.id, parts });
    }
    return out;
}

/**
 * Union of subtype names across the entries' own subtype rows, keyed by the
 * normalized label so "Überstunde" / "Überstunden" collapse into one bucket.
 * Order = the order of the first entry that carries the row (the rows are
 * already canonically sorted by loadSubtypes).
 */
export function unionBuckets(
    subtypeSets: { name: string }[][],
): { key: string; name: string }[] {
    const seen = new Map<string, string>();
    for (const rows of subtypeSets) {
        for (const s of rows) {
            const key = normalizeLabel(s.name);
            if (key && !seen.has(key)) seen.set(key, s.name);
        }
    }
    return Array.from(seen.entries()).map(([key, name]) => ({ key, name }));
}
