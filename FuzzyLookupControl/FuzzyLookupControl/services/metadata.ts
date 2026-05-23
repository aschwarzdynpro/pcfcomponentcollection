// Fetches the target entity's primary-name attribute and the display names
// for the configured columns. We try three sources in order, because PCF
// hosts differ in which APIs they expose and which return the data we want:
//
//   1. `Xrm.Utility.getEntityMetadata` — fastest, returns both PrimaryName and
//      Attributes metadata in one round-trip when available.
//   2. Web API `EntityDefinitions(LogicalName='<entity>')` — guaranteed to
//      work as long as the user has read access to the table; this is the
//      fallback that actually fires for most custom tables.
//   3. Hardcoded `"name"` — last resort. The control still works for OOB
//      tables but will silently search the wrong column for custom tables
//      with non-default primaries (`wal_name`, `cr123_displayname`, …).

export interface TargetMetadata {
    primaryName: string;
    columnDisplayNames: Record<string, string>;
}

interface PcfUtility {
    getEntityMetadata?: (
        entityName: string,
        attributes?: string[],
    ) => Promise<{
        PrimaryNameAttribute?: string;
        Attributes?: {
            get?: (logicalName: string) => { DisplayName?: string } | undefined;
            getAll?: () => { LogicalName: string; DisplayName: string }[];
        };
    }>;
}

interface PcfWebApi {
    retrieveMultipleRecords?: (
        entityType: string,
        options: string,
        maxPageSize?: number,
    ) => Promise<{ entities: Record<string, unknown>[] }>;
}

export interface FetchMetadataInput {
    utility: PcfUtility | undefined;
    webApi: PcfWebApi | undefined;
    entityName: string;
    requestedColumns: string[];
}

export async function fetchTargetMetadata(
    input: FetchMetadataInput,
): Promise<TargetMetadata> {
    const { utility, webApi, entityName, requestedColumns } = input;

    const lastResort = (primary = "name"): TargetMetadata => ({
        primaryName: primary,
        columnDisplayNames: Object.fromEntries(
            requestedColumns.map((c) => [c, titleCase(c)]),
        ),
    });

    if (!entityName) return lastResort();

    // 1. Xrm.Utility.getEntityMetadata
    if (utility?.getEntityMetadata) {
        try {
            const meta = await utility.getEntityMetadata(entityName, requestedColumns);
            if (meta?.PrimaryNameAttribute) {
                const columnDisplayNames: Record<string, string> = {};
                for (const c of requestedColumns) {
                    const a = meta.Attributes?.get?.(c);
                    columnDisplayNames[c] = a?.DisplayName || titleCase(c);
                }
                return {
                    primaryName: meta.PrimaryNameAttribute,
                    columnDisplayNames,
                };
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.debug(
                "FuzzyLookupControl: Utility.getEntityMetadata failed for " +
                    entityName + ", falling back to EntityDefinitions Web API.",
                e,
            );
        }
    }

    // 2. Direct fetch against the Web API metadata endpoint. We bypass
    //    PCF's webAPI wrapper here because:
    //      - retrieveRecord refuses the non-GUID alternate-key form
    //        (`LogicalName='product'`).
    //      - retrieveMultipleRecords refuses "EntityDefinition" as the
    //        entity-type name — UCI complains it doesn't exist.
    //    The HTTP endpoint itself works fine; the wrappers are just picky.
    try {
        const clientUrl = getClientUrl();
        const safe = entityName.replace(/'/g, "''");
        const url =
            `${clientUrl}/api/data/v9.2/EntityDefinitions(LogicalName='${safe}')` +
            `?$select=PrimaryNameAttribute`;
        const res = await fetch(url, {
            method: "GET",
            credentials: "include",
            headers: {
                "Accept": "application/json",
                "OData-MaxVersion": "4.0",
                "OData-Version": "4.0",
            },
        });
        if (res.ok) {
            const data = (await res.json()) as { PrimaryNameAttribute?: string };
            if (data.PrimaryNameAttribute) {
                return {
                    primaryName: data.PrimaryNameAttribute,
                    columnDisplayNames: Object.fromEntries(
                        requestedColumns.map((c) => [c, titleCase(c)]),
                    ),
                };
            }
        } else {
            // eslint-disable-next-line no-console
            console.warn(
                "FuzzyLookupControl: EntityDefinitions fetch returned " +
                    res.status + " for " + entityName + ".",
            );
        }
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(
            "FuzzyLookupControl: EntityDefinitions fetch failed for " +
                entityName + ", falling back to hardcoded 'name'.",
            e,
        );
    }

    return lastResort();
}

function getClientUrl(): string {
    const xrm = (window as unknown as {
        Xrm?: {
            Utility?: { getGlobalContext?: () => { getClientUrl: () => string } };
        };
    }).Xrm;
    const fromXrm = xrm?.Utility?.getGlobalContext?.().getClientUrl();
    if (fromXrm) return fromXrm.replace(/\/$/, "");
    return window.location.origin;
}

function titleCase(logical: string): string {
    // "wal_displayname" → "Displayname"; "name" → "Name".
    const stripped = logical.replace(/^[a-z]+_/, "");
    return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}
