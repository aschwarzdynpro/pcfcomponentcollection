import {
    PARENT,
    CHILD,
    PARENT_LOOKUPS,
    WORKORDER_VALUE,
    FieldConfig,
    SUBTYPE_ORDER,
} from "./schema";
import { SubtypeRow } from "./types";

const ANNOT_LOGICALNAME = "@Microsoft.Dynamics.CRM.lookuplogicalname";

/** Cache of logical name → entity set name (for @odata.bind targets). */
const entitySetCache = new Map<string, string>();

async function entitySetFor(
    utils: ComponentFramework.Utility,
    logicalName: string,
): Promise<string | null> {
    if (entitySetCache.has(logicalName)) {
        return entitySetCache.get(logicalName) ?? null;
    }
    try {
        const md: any = await utils.getEntityMetadata(logicalName, []);
        const set: string | undefined =
            md?.EntitySetName ?? md?.entitySetName ?? undefined;
        if (set) {
            entitySetCache.set(logicalName, set);
            return set;
        }
    } catch {
        // ignore — caller falls back to skipping the lookup bind
    }
    return null;
}

/** Sort subtype rows into the canonical surcharge order. */
function sortSubtypes<T extends { name: string }>(rows: T[]): T[] {
    const rank = (n: string) => {
        const i = SUBTYPE_ORDER.indexOf(n);
        return i === -1 ? SUBTYPE_ORDER.length : i;
    };
    return [...rows].sort((a, b) => {
        const r = rank(a.name) - rank(b.name);
        return r !== 0 ? r : a.name.localeCompare(b.name);
    });
}

/** Load the work-subtype rows belonging to a Rounded Time Entry. */
export async function loadSubtypes(
    webApi: ComponentFramework.WebApi,
    parentId: string,
): Promise<SubtypeRow[]> {
    const id = parentId.replace(/[{}]/g, "");
    const query =
        `?$select=${CHILD.primaryId},${CHILD.name},${CHILD.timeValue}` +
        `&$filter=${CHILD.parentLookupValue} eq ${id}`;
    const res = await webApi.retrieveMultipleRecords(CHILD.logicalName, query);
    const rows: SubtypeRow[] = (res.entities ?? []).map((e: any) => {
        const value =
            e[CHILD.timeValue] == null ? 0 : Number(e[CHILD.timeValue]);
        return {
            id: e[CHILD.primaryId] as string,
            name: (e[CHILD.name] as string) ?? "",
            value: formatNumber(value),
            originalValue: value,
        };
    });
    return sortSubtypes(rows);
}

/** Parse a (possibly German-formatted) numeric input. Returns 0 on blank/NaN. */
export function parseNumber(raw: string): number {
    const s = (raw ?? "").trim();
    if (!s) return 0;
    // Accept both "1,5" and "1.5"; strip thousands separators conservatively.
    const normalized = s.replace(/\s/g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : NaN;
}

/** Format a number for display in the input (no trailing noise). */
export function formatNumber(n: number): string {
    if (!Number.isFinite(n) || n === 0) return "";
    return String(Math.round(n * 1000) / 1000);
}

export interface SplitInput {
    id: string;
    name: string;
    value: number;
}

export interface SaveResult {
    created: number;
}

/**
 * Persist a split: create one Rounded Time Entry per subtype with value > 0
 * (copying the original's lookups/fields), mark the original + its related
 * pauses as completed, then delete the original (its child subtypes are removed
 * by the cascade-delete relationship).
 */
export async function saveSplit(
    webApi: ComponentFramework.WebApi,
    utils: ComponentFramework.Utility,
    fields: FieldConfig,
    parentId: string,
    subtypes: SplitInput[],
): Promise<SaveResult> {
    const id = parentId.replace(/[{}]/g, "");

    // 1) Read the original record (fields + lookup values/annotations).
    const lookupSelects = PARENT_LOOKUPS.map((l) => l.value).join(",");
    const selects = [
        PARENT.primaryName,
        fields.date,
        fields.type,
        fields.notes,
        WORKORDER_VALUE,
        lookupSelects,
    ]
        .filter(Boolean)
        .join(",");
    const original: any = await webApi.retrieveRecord(
        PARENT.logicalName,
        id,
        `?$select=${selects}`,
    );

    const originalType = (original[fields.type] as string) ?? "";
    const originalName = (original[PARENT.primaryName] as string) ?? "";
    const originalDate = original[fields.date] ?? null;
    const originalNotes = original[fields.notes] ?? null;

    // Resolve @odata.bind targets for the lookups present on the original.
    const lookupBinds: Record<string, string> = {};
    for (const lk of PARENT_LOOKUPS) {
        const targetId = original[lk.value];
        if (!targetId) continue;
        const targetLogical = original[lk.value + ANNOT_LOGICALNAME] as
            | string
            | undefined;
        if (!targetLogical) continue;
        const set = await entitySetFor(utils, targetLogical);
        if (!set) continue;
        lookupBinds[`${lk.bind}@odata.bind`] = `/${set}(${targetId})`;
    }

    const active = subtypes.filter((s) => s.value > 0);

    // 2) Persist the edited subtype values (faithful to the Custom Page;
    //    the rows are removed by cascade-delete afterwards).
    for (const s of subtypes) {
        try {
            await webApi.updateRecord(CHILD.logicalName, s.id, {
                [CHILD.timeValue]: s.value,
            });
        } catch {
            // non-fatal — the row will be cascade-deleted with the parent
        }
    }

    // 3) Create one split Rounded Time Entry per subtype with value > 0.
    for (const s of active) {
        const payload: Record<string, unknown> = {
            [fields.subtype]: s.name,
            [fields.total]: s.value,
            [fields.type]: originalType
                ? `${originalType} (${s.name})`
                : s.name,
            [fields.completed]: true,
            ...lookupBinds,
        };
        if (originalName) payload[PARENT.primaryName] = originalName;
        if (originalDate != null) payload[fields.date] = originalDate;
        if (originalNotes != null) payload[fields.notes] = originalNotes;
        await webApi.createRecord(PARENT.logicalName, payload);
    }

    // 4) Mark the original as completed.
    await webApi.updateRecord(PARENT.logicalName, id, {
        [fields.completed]: true,
    });

    // 5) Mark related pause entries (same work order) as completed.
    const woId = original[WORKORDER_VALUE];
    if (woId) {
        try {
            const pauseFilter =
                `?$select=${PARENT.primaryId}` +
                `&$filter=${WORKORDER_VALUE} eq ${woId}` +
                ` and ${fields.type} eq '${fields.pauseValue}'` +
                ` and ${PARENT.primaryId} ne ${id}`;
            const pauses = await webApi.retrieveMultipleRecords(
                PARENT.logicalName,
                pauseFilter,
            );
            for (const p of pauses.entities ?? []) {
                await webApi.updateRecord(
                    PARENT.logicalName,
                    p[PARENT.primaryId] as string,
                    { [fields.completed]: true },
                );
            }
        } catch {
            // non-fatal — pauses simply stay open if this lookup fails
        }
    }

    // 6) Delete the original — child subtypes go with it (cascade-delete).
    await webApi.deleteRecord(PARENT.logicalName, id);

    return { created: active.length };
}
