// Fetches the target entity's primary-name attribute and the display names
// for the configured columns. We use the Utility API for the entity-level
// metadata (cheap, single round-trip) and the OData EntityDefinitions endpoint
// for per-attribute display names when needed.

export interface TargetMetadata {
    primaryName: string;          // e.g. "name" for account, "fullname" for contact
    columnDisplayNames: Record<string, string>;
}

interface PcfUtility {
    getEntityMetadata: (
        entityName: string,
        attributes?: string[],
    ) => Promise<{
        PrimaryNameAttribute: string;
        Attributes?: {
            get: (logicalName: string) => { DisplayName?: string } | undefined;
            getAll?: () => { LogicalName: string; DisplayName: string }[];
        };
    }>;
}

/**
 * Returns the target entity's primary name attribute plus display-name
 * lookups for every column the maker configured.
 *
 * Falls back to title-casing the logical name when getEntityMetadata is not
 * available (offline / test harness).
 */
export async function fetchTargetMetadata(
    utility: PcfUtility | undefined,
    entityName: string,
    requestedColumns: string[],
): Promise<TargetMetadata> {
    const fallback = (): TargetMetadata => ({
        primaryName: "name",
        columnDisplayNames: Object.fromEntries(
            requestedColumns.map((c) => [c, titleCase(c)]),
        ),
    });

    if (!utility?.getEntityMetadata) return fallback();

    try {
        const meta = await utility.getEntityMetadata(entityName, requestedColumns);
        const primaryName = meta.PrimaryNameAttribute || "name";
        const columnDisplayNames: Record<string, string> = {};
        for (const c of requestedColumns) {
            const a = meta.Attributes?.get(c);
            columnDisplayNames[c] = a?.DisplayName || titleCase(c);
        }
        return { primaryName, columnDisplayNames };
    } catch {
        return fallback();
    }
}

function titleCase(logical: string): string {
    // "wal_displayname" → "Displayname"; "name" → "Name".
    const stripped = logical.replace(/^[a-z]+_/, "");
    return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}
