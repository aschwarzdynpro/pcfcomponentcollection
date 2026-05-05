import * as React from "react";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCardData, KanbanColumnDef, Lang } from "./types";
import {
    deriveColumnsFromRecords,
    fetchChoiceOptions,
    optionsToColumns,
} from "./metadata";
import { STRINGS } from "./i18n";

export interface KanbanBoardProps {
    dataset: ComponentFramework.PropertyTypes.DataSet;
    webApi: ComponentFramework.WebApi;
    navigation: ComponentFramework.Navigation;
    utils: ComponentFramework.Utility;
    statusColumn: string;
    titleColumn: string | null;
    subtitleColumn: string | null;
    descriptionColumn: string | null;
    allowDragDrop: boolean;
    allowCreate: boolean;
    disabled: boolean;
    lang: Lang;
}

/** Best-effort entity name extraction from the dataset. */
function getEntityName(
    dataset: ComponentFramework.PropertyTypes.DataSet,
): string | null {
    const fn = (dataset as unknown as { getTargetEntityType?: () => string })
        .getTargetEntityType;
    const fromMethod = typeof fn === "function" ? fn.call(dataset) : null;
    if (fromMethod) return fromMethod;
    // Fallback: first record's named reference
    const firstId = dataset.sortedRecordIds[0];
    if (firstId) {
        const ref = dataset.records[firstId]?.getNamedReference?.();
        if (ref && (ref as unknown as { etn?: string }).etn) {
            return (ref as unknown as { etn: string }).etn;
        }
        if (ref && (ref as unknown as { entityType?: string }).entityType) {
            return (ref as unknown as { entityType: string }).entityType;
        }
    }
    return null;
}

/** Tries to determine the primary name column from metadata, falls back to "name". */
async function getPrimaryNameColumn(
    utils: ComponentFramework.Utility,
    entityName: string,
): Promise<string> {
    try {
        const md: any = await utils.getEntityMetadata(entityName, []);
        return (
            md?.PrimaryNameAttribute ??
            md?.primaryNameAttribute ??
            md?.PrimaryIdAttribute ??
            "name"
        );
    } catch {
        return "name";
    }
}

/** Build flattened card data from the dataset. */
function buildCards(
    dataset: ComponentFramework.PropertyTypes.DataSet,
    statusColumn: string,
    titleColumn: string,
    subtitleColumn: string | null,
    descriptionColumn: string | null,
): KanbanCardData[] {
    const reservedColumns = new Set(
        [
            statusColumn,
            titleColumn,
            subtitleColumn,
            descriptionColumn,
        ].filter(Boolean) as string[],
    );

    return dataset.sortedRecordIds.map((id) => {
        const record = dataset.records[id];
        const statusValueRaw = record.getValue(statusColumn);
        const statusValue =
            statusValueRaw == null ? Number.NaN : Number(statusValueRaw);

        const title =
            record.getFormattedValue(titleColumn) ??
            String(record.getValue(titleColumn) ?? "");

        const subtitle = subtitleColumn
            ? record.getFormattedValue(subtitleColumn) ||
              String(record.getValue(subtitleColumn) ?? "")
            : undefined;

        const description = descriptionColumn
            ? record.getFormattedValue(descriptionColumn) ||
              String(record.getValue(descriptionColumn) ?? "")
            : undefined;

        // Surface any extra columns the maker added to the view (besides the
        // ones already mapped) as small chips on the card.
        const extras: KanbanCardData["extras"] = [];
        for (const col of dataset.columns ?? []) {
            if (reservedColumns.has(col.name)) continue;
            if (col.isHidden) continue;
            const formatted = record.getFormattedValue(col.name);
            if (!formatted) continue;
            extras.push({
                key: col.name,
                label: col.displayName,
                value: formatted,
            });
            if (extras.length >= 3) break;
        }

        return {
            id,
            statusValue,
            title: title || "—",
            subtitle: subtitle || undefined,
            description: description || undefined,
            extras,
        };
    });
}

export const KanbanBoard: React.FC<KanbanBoardProps> = (props) => {
    const t = STRINGS[props.lang];

    const [columns, setColumns] = React.useState<KanbanColumnDef[] | null>(null);
    const [titleColumnResolved, setTitleColumnResolved] = React.useState<
        string | null
    >(null);
    const [error, setError] = React.useState<string | null>(null);
    const [filter, setFilter] = React.useState("");
    const [hoveredColumn, setHoveredColumn] = React.useState<number | null>(null);
    const [optimistic, setOptimistic] = React.useState<Map<string, number>>(
        () => new Map(),
    );
    const [transientError, setTransientError] = React.useState<string | null>(
        null,
    );

    const dataset = props.dataset;
    const isLoading = dataset.loading;
    const entityName = React.useMemo(() => getEntityName(dataset), [dataset]);

    // Resolve the title column (use override; otherwise primary name).
    React.useEffect(() => {
        let cancelled = false;
        if (props.titleColumn) {
            setTitleColumnResolved(props.titleColumn);
            return;
        }
        if (!entityName) return;
        getPrimaryNameColumn(props.utils, entityName).then((name) => {
            if (!cancelled) setTitleColumnResolved(name);
        });
        return () => {
            cancelled = true;
        };
    }, [props.titleColumn, props.utils, entityName]);

    // Fetch column metadata once we know the entity name + status column.
    React.useEffect(() => {
        if (!props.statusColumn) {
            setError(t.errStatusMissing);
            return;
        }
        if (!entityName) {
            // Defer — we may get it once records arrive.
            return;
        }

        let cancelled = false;
        fetchChoiceOptions(props.utils, entityName, props.statusColumn).then(
            (options) => {
                if (cancelled) return;
                if (options.length > 0) {
                    setColumns(optionsToColumns(options));
                    setError(null);
                } else {
                    // Fall back to record-derived columns
                    const derived = deriveColumnsFromRecords(
                        dataset,
                        props.statusColumn,
                    );
                    setColumns(derived.length > 0 ? derived : []);
                    setError(derived.length === 0 ? t.errNoColumns : null);
                }
            },
            () => {
                if (cancelled) return;
                const derived = deriveColumnsFromRecords(
                    dataset,
                    props.statusColumn,
                );
                setColumns(derived.length > 0 ? derived : []);
                setError(derived.length === 0 ? t.errNoColumns : null);
            },
        );

        return () => {
            cancelled = true;
        };
    }, [props.utils, entityName, props.statusColumn, dataset, t]);

    const cards = React.useMemo(() => {
        if (!titleColumnResolved) return [] as KanbanCardData[];
        return buildCards(
            dataset,
            props.statusColumn,
            titleColumnResolved,
            props.subtitleColumn,
            props.descriptionColumn,
        );
    }, [
        dataset,
        props.statusColumn,
        titleColumnResolved,
        props.subtitleColumn,
        props.descriptionColumn,
        // dataset.sortedRecordIds.length and dataset.loading aren't stable deps
        // but `dataset` reference changes on each updateView, so this is fine.
    ]);

    const filteredCards = React.useMemo(() => {
        const q = filter.trim().toLowerCase();
        if (!q) return cards;
        return cards.filter((c) => {
            return (
                c.title.toLowerCase().includes(q) ||
                (c.subtitle?.toLowerCase().includes(q) ?? false) ||
                (c.description?.toLowerCase().includes(q) ?? false) ||
                c.extras.some((x) => x.value.toLowerCase().includes(q))
            );
        });
    }, [cards, filter]);

    const cardsByStatus = React.useMemo(() => {
        const map = new Map<number, KanbanCardData[]>();
        for (const c of filteredCards) {
            // Apply optimistic status override
            const effective = optimistic.get(c.id) ?? c.statusValue;
            const arr = map.get(effective) ?? [];
            arr.push({ ...c, statusValue: effective });
            map.set(effective, arr);
        }
        return map;
    }, [filteredCards, optimistic]);

    const handleCardOpen = React.useCallback(
        (id: string) => {
            if (!entityName) return;
            props.navigation.openForm({ entityName, entityId: id });
        },
        [entityName, props.navigation],
    );

    const handleAdd = React.useCallback(
        (statusValue: number) => {
            if (!entityName) return;
            // Pre-populate the status column on the new record. Form
            // parameters are URL-style strings, so we serialize numbers.
            const formParams: { [key: string]: string } = {
                [props.statusColumn]: String(statusValue),
            };
            props.navigation.openForm(
                { entityName, useQuickCreateForm: true },
                formParams,
            );
        },
        [entityName, props.statusColumn, props.navigation],
    );

    const handleDrop = React.useCallback(
        async (cardId: string, columnValue: number) => {
            if (!entityName) return;
            const card = cards.find((c) => c.id === cardId);
            if (!card || card.statusValue === columnValue) {
                setHoveredColumn(null);
                return;
            }
            setOptimistic((m) => {
                const n = new Map(m);
                n.set(cardId, columnValue);
                return n;
            });
            setHoveredColumn(null);
            try {
                await props.webApi.updateRecord(entityName, cardId, {
                    [props.statusColumn]: columnValue,
                });
                // Successful — refresh dataset and clear optimistic on next render.
                dataset.refresh();
                // Keep optimistic until refresh propagates new values; clear after a tick.
                window.setTimeout(() => {
                    setOptimistic((m) => {
                        if (!m.has(cardId)) return m;
                        const n = new Map(m);
                        n.delete(cardId);
                        return n;
                    });
                }, 200);
            } catch (e) {
                // Roll back optimistic and show transient error.
                setOptimistic((m) => {
                    const n = new Map(m);
                    n.delete(cardId);
                    return n;
                });
                const msg =
                    (e as { message?: string })?.message ??
                    String(e ?? "unknown error");
                setTransientError(`${t.moveFailed}: ${msg}`);
                window.setTimeout(() => setTransientError(null), 4000);
            }
        },
        [
            cards,
            dataset,
            entityName,
            props.statusColumn,
            props.webApi,
            t.moveFailed,
        ],
    );

    if (error) {
        return (
            <div className="kbn-error">
                <strong>{t.errorPrefix}:</strong> {error}
            </div>
        );
    }

    if (!columns || !titleColumnResolved) {
        return (
            <div className="kbn-loading">
                <span className="kbn-spinner" aria-hidden="true" />
                {t.loading}
            </div>
        );
    }

    return (
        <div className="kbn-board">
            <div className="kbn-toolbar">
                <input
                    type="search"
                    className="kbn-search"
                    placeholder={t.searchPlaceholder}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    aria-label={t.searchPlaceholder}
                />
                <span className="kbn-count">{t.cards(filteredCards.length)}</span>
            </div>

            {transientError && (
                <div className="kbn-toast" role="alert">
                    {transientError}
                </div>
            )}

            <div
                className={`kbn-columns ${isLoading ? "kbn-columns-loading" : ""}`}
            >
                {columns.map((col) => (
                    <KanbanColumn
                        key={col.value}
                        column={col}
                        cards={cardsByStatus.get(col.value) ?? []}
                        optimisticIds={
                            new Set(
                                [...optimistic.entries()]
                                    .filter(([, v]) => v === col.value)
                                    .map(([k]) => k),
                            )
                        }
                        allowDrag={props.allowDragDrop && !props.disabled}
                        allowCreate={props.allowCreate && !props.disabled}
                        isDropHover={hoveredColumn === col.value}
                        onCardOpen={handleCardOpen}
                        onCardDragStart={() => setHoveredColumn(null)}
                        onCardDragEnd={() => setHoveredColumn(null)}
                        onColumnDragOver={setHoveredColumn}
                        onColumnDragLeave={(v) =>
                            setHoveredColumn((cur) => (cur === v ? null : cur))
                        }
                        onCardDrop={handleDrop}
                        onAdd={handleAdd}
                        strings={t}
                    />
                ))}
            </div>
        </div>
    );
};
