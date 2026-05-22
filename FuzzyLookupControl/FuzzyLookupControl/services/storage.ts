// Per-user favorites and "recently used" stored in browser localStorage.
//
// Why localStorage (and not a Dataverse table) for v1:
//   - zero schema footprint — drop-in component, no solution dependency
//   - works offline / on poor connections
//   - per-browser is acceptable for v1; cross-device sync is a follow-up
//
// Keys are scoped by user id + target entity so favorites for one table on one
// user don't leak into another. We keep the data shape minimal (id + primary
// name); when surfaced in the dropdown the search service is *not* called for
// these — we render them straight from cache.

import type { LookupRecord } from "./types";

const FAVORITES_PREFIX = "wal_fuzzylookup_fav_";
const RECENTLY_USED_PREFIX = "wal_fuzzylookup_mru_";
const MRU_LIMIT = 8;
const FAVORITES_LIMIT = 20;

interface StoredRecord {
    id: string;
    name: string;
    columns?: Record<string, string>;
}

function storageKey(prefix: string, userId: string, entity: string): string {
    const safeUser = (userId || "anon").replace(/[{}]/g, "").toLowerCase();
    return `${prefix}${safeUser}_${entity.toLowerCase()}`;
}

function safeRead(key: string): StoredRecord[] {
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (x): x is StoredRecord =>
                !!x && typeof x === "object" &&
                typeof (x as StoredRecord).id === "string" &&
                typeof (x as StoredRecord).name === "string",
        );
    } catch {
        return [];
    }
}

function safeWrite(key: string, value: StoredRecord[]): void {
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Quota exceeded or storage disabled — fail silently. The control still
        // works; the user just won't see favorites / MRU persist.
    }
}

function toLookupRecord(rec: StoredRecord, entity: string, primaryName: string): LookupRecord {
    const columns = rec.columns ?? {};
    return {
        id: rec.id,
        entityName: entity,
        primaryName: rec.name,
        columns: { [primaryName]: rec.name, ...columns },
        highlights: {},
    };
}

export interface StorageScope {
    userId: string;
    entity: string;
    primaryName: string;
}

export function getFavorites(scope: StorageScope): LookupRecord[] {
    const items = safeRead(storageKey(FAVORITES_PREFIX, scope.userId, scope.entity));
    return items.map((r) => toLookupRecord(r, scope.entity, scope.primaryName));
}

export function isFavorite(scope: StorageScope, id: string): boolean {
    return safeRead(storageKey(FAVORITES_PREFIX, scope.userId, scope.entity))
        .some((r) => r.id === id);
}

export function toggleFavorite(scope: StorageScope, rec: LookupRecord): boolean {
    const key = storageKey(FAVORITES_PREFIX, scope.userId, scope.entity);
    const list = safeRead(key);
    const existing = list.findIndex((r) => r.id === rec.id);
    if (existing >= 0) {
        list.splice(existing, 1);
        safeWrite(key, list);
        return false;
    }
    list.unshift({ id: rec.id, name: rec.primaryName, columns: rec.columns });
    safeWrite(key, list.slice(0, FAVORITES_LIMIT));
    return true;
}

export function getRecentlyUsed(scope: StorageScope): LookupRecord[] {
    const items = safeRead(storageKey(RECENTLY_USED_PREFIX, scope.userId, scope.entity));
    return items.map((r) => toLookupRecord(r, scope.entity, scope.primaryName));
}

export function pushRecentlyUsed(scope: StorageScope, rec: LookupRecord): void {
    const key = storageKey(RECENTLY_USED_PREFIX, scope.userId, scope.entity);
    const list = safeRead(key).filter((r) => r.id !== rec.id);
    list.unshift({ id: rec.id, name: rec.primaryName, columns: rec.columns });
    safeWrite(key, list.slice(0, MRU_LIMIT));
}
