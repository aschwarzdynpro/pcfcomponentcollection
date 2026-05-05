import * as React from "react";
import { KanbanCard } from "./KanbanCard";
import { KanbanCardData, KanbanColumnDef } from "./types";
import { readableForeground } from "./metadata";
import { KanbanStrings } from "./i18n";

export interface KanbanColumnProps {
    column: KanbanColumnDef;
    cards: KanbanCardData[];
    optimisticIds: Set<string>;
    allowDrag: boolean;
    allowCreate: boolean;
    isDropHover: boolean;
    onCardOpen: (id: string) => void;
    onCardDragStart: (id: string) => void;
    onCardDragEnd: () => void;
    onColumnDragOver: (value: number) => void;
    onColumnDragLeave: (value: number) => void;
    onCardDrop: (cardId: string, columnValue: number) => void;
    onAdd: (columnValue: number) => void;
    strings: KanbanStrings;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
    column,
    cards,
    optimisticIds,
    allowDrag,
    allowCreate,
    isDropHover,
    onCardOpen,
    onCardDragStart,
    onCardDragEnd,
    onColumnDragOver,
    onColumnDragLeave,
    onCardDrop,
    onAdd,
    strings,
}) => {
    const headerFg = readableForeground(column.color);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        if (!allowDrag) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onColumnDragOver(column.value);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        // Only fire leave if we're actually exiting the column wrapper, not
        // moving between child elements.
        const next = e.relatedTarget as Node | null;
        if (next && e.currentTarget.contains(next)) return;
        onColumnDragLeave(column.value);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        if (!allowDrag) return;
        e.preventDefault();
        const cardId = e.dataTransfer.getData("text/plain");
        if (cardId) onCardDrop(cardId, column.value);
    };

    return (
        <section
            className={`kbn-column ${isDropHover ? "kbn-column-hover" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            aria-label={column.label}
        >
            <header
                className="kbn-column-header"
                style={{
                    backgroundColor: column.color,
                    color: headerFg,
                    borderColor: column.color,
                }}
            >
                <span className="kbn-column-title" title={column.label}>
                    {column.label}
                </span>
                <span
                    className="kbn-column-count"
                    style={{ color: headerFg, opacity: 0.85 }}
                >
                    {cards.length}
                </span>
                {allowCreate && (
                    <button
                        type="button"
                        className="kbn-column-add"
                        style={{ color: headerFg }}
                        title={strings.addCardTitle}
                        aria-label={`${strings.addCard} – ${column.label}`}
                        onClick={() => onAdd(column.value)}
                    >
                        +
                    </button>
                )}
            </header>

            <div className="kbn-column-body">
                {cards.length === 0 ? (
                    <div className="kbn-column-empty">{strings.emptyColumn}</div>
                ) : (
                    cards.map((c) => (
                        <KanbanCard
                            key={c.id}
                            card={c}
                            accentColor={column.color}
                            draggable={allowDrag}
                            optimistic={optimisticIds.has(c.id)}
                            onClick={onCardOpen}
                            onDragStart={onCardDragStart}
                            onDragEnd={onCardDragEnd}
                        />
                    ))
                )}
                {isDropHover && allowDrag && (
                    <div className="kbn-column-drop-indicator" aria-hidden="true">
                        {strings.drop}
                    </div>
                )}
            </div>
        </section>
    );
};
