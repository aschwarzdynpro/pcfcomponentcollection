import { ControlConfig, lookupValueColumn } from "../components/schema";
import { DisplayCell, MaterialRecord, MaterialsByBox } from "../components/types";

/**
 * Loads the child (material) records for a page of boxes. Implemented against
 * `context.webAPI` in the real host and against an in-memory mock in the PCF
 * test harness (where `webAPI` is unavailable).
 *
 * Concept §5.3: ONE batched request per dataset page (OR-filter over the parent
 * ids), grouped client-side. No aggregate/`$apply` (offline-incompatible); the
 * count is simply the length of each box's material array, and the same rows are
 * reused by the overlay (stale-while-revalidate) so a long-press opens without a
 * second round-trip.
 */
export interface IChildRecordService {
    /**
     * Fetch materials for the given box ids in a single query, grouped by box.
     * Boxes with no materials are present with an empty array.
     */
    fetchByBoxIds(boxIds: string[]): Promise<MaterialsByBox>;
}

const stripBraces = (id: string): string => id.replace(/[{}]/g, "");

/** Build the display cells for a material row from the configured columns. */
function toCells(record: Record<string, unknown>, columns: string[]): DisplayCell[] {
    return columns.map((col) => {
        const formatted = record[`${col}@OData.Community.Display.V1.FormattedValue`];
        const raw = record[col];
        const value =
            formatted != null
                ? String(formatted)
                : raw != null
                  ? String(raw)
                  : "";
        return { key: col, label: col, value };
    });
}

/** Real implementation backed by the Dataverse Web API. */
export class WebApiChildRecordService implements IChildRecordService {
    constructor(
        private readonly webApi: ComponentFramework.WebApi,
        private readonly config: ControlConfig,
    ) {}

    public async fetchByBoxIds(boxIds: string[]): Promise<MaterialsByBox> {
        const result: MaterialsByBox = new Map();
        const ids = boxIds.map(stripBraces).filter((id) => id.length > 0);
        for (const id of ids) result.set(id, []);
        if (ids.length === 0) return result;

        const valueCol = lookupValueColumn(this.config.childLookupField);
        const select = [valueCol, ...this.config.childDisplayColumns].join(",");
        const orFilter = ids.map((id) => `${valueCol} eq ${id}`).join(" or ");
        const filter = this.config.childFilter
            ? `(${orFilter}) and (${this.config.childFilter})`
            : `(${orFilter})`;
        const query = `?$select=${select}&$filter=${filter}`;

        const response = await this.webApi.retrieveMultipleRecords(
            this.config.childEntityName,
            query,
        );

        for (const entity of response.entities as Record<string, unknown>[]) {
            const boxId = stripBraces(String(entity[valueCol] ?? ""));
            if (!boxId) continue;
            const list = result.get(boxId) ?? [];
            list.push({
                id: String(
                    entity[`${this.config.childEntityName}id`] ??
                        entity["activityid"] ??
                        `${boxId}-${list.length}`,
                ),
                cells: toCells(entity, this.config.childDisplayColumns),
            });
            result.set(boxId, list);
        }
        return result;
    }
}

/**
 * Deterministic in-memory mock for the test harness (no webAPI). The material
 * count is derived from the box id so the UI is stable across renders.
 */
export class MockChildRecordService implements IChildRecordService {
    constructor(private readonly config: ControlConfig) {}

    public async fetchByBoxIds(boxIds: string[]): Promise<MaterialsByBox> {
        // Simulate a short round-trip so loading states are visible.
        await new Promise((resolve) => setTimeout(resolve, 250));
        const result: MaterialsByBox = new Map();
        for (const boxId of boxIds) {
            const count = this.deterministicCount(boxId);
            const materials: MaterialRecord[] = [];
            for (let i = 0; i < count; i++) {
                materials.push({
                    id: `${boxId}-mat-${i}`,
                    cells: this.config.childDisplayColumns.map((col, ci) => ({
                        key: col,
                        label: col,
                        value:
                            ci === 0
                                ? `Material ${i + 1}`
                                : ci === 1
                                  ? String((i + 1) * 2)
                                  : "Stk",
                    })),
                });
            }
            result.set(stripBraces(boxId), materials);
        }
        return result;
    }

    private deterministicCount(boxId: string): number {
        let hash = 0;
        for (let i = 0; i < boxId.length; i++) {
            hash = (hash * 31 + boxId.charCodeAt(i)) & 0x7fffffff;
        }
        return hash % 6; // 0..5 materials, includes empty boxes
    }
}
