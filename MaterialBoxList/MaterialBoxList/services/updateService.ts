import { ControlConfig, convertSwipeValue } from "../components/schema";

/**
 * Writes the take-out action for a box. Backed by `context.webAPI.updateRecord`
 * in the real host and by a no-op mock in the test harness.
 *
 * Concept §5.5: called only after the undo window elapses (optimistic UI +
 * 5 s undo snackbar). A rejected promise rolls the row back and surfaces a
 * retryable error.
 */
export interface IUpdateService {
    /** Set the configured field on the box to the configured value. */
    markTaken(boxId: string): Promise<void>;
}

const stripBraces = (id: string): string => id.replace(/[{}]/g, "");

/** Real implementation backed by the Dataverse Web API. */
export class WebApiUpdateService implements IUpdateService {
    constructor(
        private readonly webApi: ComponentFramework.WebApi,
        private readonly entityName: string,
        private readonly config: ControlConfig,
    ) {}

    public async markTaken(boxId: string): Promise<void> {
        const value = convertSwipeValue(this.config.swipeFieldValue);
        const data: Record<string, unknown> = {
            [this.config.swipeFieldName]: value,
        };
        await this.webApi.updateRecord(
            this.entityName,
            stripBraces(boxId),
            data,
        );
    }
}

/** In-memory mock for the test harness (no webAPI): records nothing, succeeds. */
export class MockUpdateService implements IUpdateService {
    public async markTaken(_boxId: string): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
}
