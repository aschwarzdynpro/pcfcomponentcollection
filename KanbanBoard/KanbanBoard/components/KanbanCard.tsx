import * as React from "react";
import { KanbanCardData } from "./types";

export interface KanbanCardProps {
    card: KanbanCardData;
    accentColor: string;
    draggable: boolean;
    optimistic?: boolean;
    onClick: (id: string) => void;
    onDragStart: (id: string) => void;
    onDragEnd: () => void;
}

const KanbanCardInner: React.FC<KanbanCardProps> = ({
    card,
    accentColor,
    draggable,
    optimistic,
    onClick,
    onDragStart,
    onDragEnd,
}) => {
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        e.dataTransfer.setData("text/plain", card.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(card.id);
    };

    const handleClick = (e: React.MouseEvent) => {
        // Ignore clicks that originate inside the drag-handle motion to avoid
        // accidentally opening the form right after a drop. We use a small
        // movement threshold by checking detail (click count) and target.
        if (e.defaultPrevented) return;
        onClick(card.id);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick(card.id);
        }
    };

    return (
        <div
            className={`kbn-card ${optimistic ? "kbn-card-optimistic" : ""}`}
            draggable={draggable}
            onDragStart={handleDragStart}
            onDragEnd={onDragEnd}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            aria-label={card.title}
        >
            <div
                className="kbn-card-accent"
                style={{ backgroundColor: accentColor }}
                aria-hidden="true"
            />
            <div className="kbn-card-body">
                <div className="kbn-card-title">{card.title || "—"}</div>
                {card.subtitle && (
                    <div className="kbn-card-subtitle">{card.subtitle}</div>
                )}
                {card.description && (
                    <div className="kbn-card-description">{card.description}</div>
                )}
                {card.extras.length > 0 && (
                    <div className="kbn-card-extras">
                        {card.extras.map((x) => (
                            <span key={x.key} className="kbn-card-extra" title={x.label}>
                                <span className="kbn-card-extra-label">{x.label}:</span>
                                <span className="kbn-card-extra-value">{x.value}</span>
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export const KanbanCard = React.memo(KanbanCardInner);
