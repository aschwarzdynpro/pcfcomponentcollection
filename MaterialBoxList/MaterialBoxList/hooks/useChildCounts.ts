import * as React from "react";
import { IChildRecordService } from "../services/childRecordService";
import { CountState, MaterialRecord } from "../components/types";

interface UseChildCounts {
    /** Counter-chip state for a box. */
    countOf: (boxId: string) => CountState;
    /** Cached materials for a box (empty until loaded). */
    materialsOf: (boxId: string) => MaterialRecord[];
    /** Whether the materials for a box have finished loading (for the overlay). */
    isLoaded: (boxId: string) => boolean;
    /** Drop the cache (e.g. on dataset refresh) and reload the current ids. */
    invalidate: () => void;
}

/**
 * Batch-loads and caches the child materials for the currently visible boxes
 * (concept §5.3). One request per set of not-yet-cached ids; results feed both
 * the counter chips and the long-press overlay.
 */
export function useChildCounts(
    service: IChildRecordService,
    boxIds: string[],
): UseChildCounts {
    const cache = React.useRef<Map<string, MaterialRecord[]>>(new Map());
    const loading = React.useRef<Set<string>>(new Set());
    const errored = React.useRef<Set<string>>(new Set());
    const [, bump] = React.useReducer((n: number) => n + 1, 0);

    const key = boxIds.join(",");

    const load = React.useCallback(
        async (ids: string[]) => {
            const missing = ids.filter(
                (id) =>
                    !cache.current.has(id) &&
                    !loading.current.has(id) &&
                    !errored.current.has(id),
            );
            if (missing.length === 0) return;
            missing.forEach((id) => loading.current.add(id));
            bump();
            try {
                const result = await service.fetchByBoxIds(missing);
                result.forEach((materials, id) => cache.current.set(id, materials));
            } catch {
                missing.forEach((id) => errored.current.add(id));
            } finally {
                missing.forEach((id) => loading.current.delete(id));
                bump();
            }
        },
        [service],
    );

    React.useEffect(() => {
        if (boxIds.length > 0) void load(boxIds);
        // key encodes the id set; load is stable per service.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, load]);

    const invalidate = React.useCallback(() => {
        cache.current.clear();
        loading.current.clear();
        errored.current.clear();
        bump();
        if (boxIds.length > 0) void load(boxIds);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, load]);

    const countOf = React.useCallback((boxId: string): CountState => {
        if (cache.current.has(boxId)) {
            return { status: "ready", count: cache.current.get(boxId)!.length };
        }
        if (errored.current.has(boxId)) return { status: "error" };
        return { status: "loading" };
    }, []);

    const materialsOf = React.useCallback(
        (boxId: string): MaterialRecord[] => cache.current.get(boxId) ?? [],
        [],
    );

    const isLoaded = React.useCallback(
        (boxId: string): boolean => cache.current.has(boxId),
        [],
    );

    return { countOf, materialsOf, isLoaded, invalidate };
}
