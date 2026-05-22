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

    // 2. Web API EntityDefinitions — use retrieveMultipleRecords with a
    //    LogicalName filter. (retrieveRecord refuses non-GUID identifiers
    //    even when EntityDefinition supports alternate keys.)
    if (webApi?.retrieveMultipleRecords) {
        try {
            const safe = entityName.replace(/'/g, "''");
            const result = await webApi.retrieveMultipleRecords(
                "EntityDefinition",
                `?$select=PrimaryNameAttribute&$filter=LogicalName eq '${safe}'`,
                1,
            );
            const primary = (result.entities?.[0] as { PrimaryNameAttribute?: string } | undefined)
                ?.PrimaryNameAttribute;
            if (primary) {
                return {
                    primaryName: primary,
                    columnDisplayNames: Object.fromEntries(
                        requestedColumns.map((c) => [c, titleCase(c)]),
                    ),
                };
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn(
                "FuzzyLookupControl: EntityDefinitions Web API failed for " +
                    entityName + ", falling back to hardcoded 'name'.",
                e,
            );
        }
    }

    return lastResort();
}

function titleCase(logical: string): string {
    // "wal_displayname" → "Displayname"; "name" → "Name".
    const stripped = logical.replace(/^[a-z]+_/, "");
    return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}
