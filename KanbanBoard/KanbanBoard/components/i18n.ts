import { Lang } from "./types";

export function lcidToLang(lcid: number | null | undefined): Lang {
    if (!lcid) return "en";
    // Lower 10 bits = primary language identifier
    // 0x07 → German, 0x0C → French, anything else → English fallback
    const primary = lcid & 0x3ff;
    if (primary === 0x07) return "de";
    if (primary === 0x0c) return "fr";
    return "en";
}

export interface KanbanStrings {
    searchPlaceholder: string;
    cards: (n: number) => string;
    addCard: string;
    addCardTitle: string;
    emptyColumn: string;
    loading: string;
    errorPrefix: string;
    errStatusMissing: string;
    errEntityUnknown: string;
    errNoColumns: string;
    moveSucceeded: string;
    moveFailed: string;
    drop: string;
}

export const STRINGS: Record<Lang, KanbanStrings> = {
    en: {
        searchPlaceholder: "Search cards…",
        cards: (n) => (n === 1 ? "1 card" : `${n} cards`),
        addCard: "Add",
        addCardTitle: "Create a record with this status",
        emptyColumn: "No cards",
        loading: "Loading board…",
        errorPrefix: "Could not load the board",
        errStatusMissing: "The 'Status Column' property is required.",
        errEntityUnknown: "Could not determine the dataset entity name.",
        errNoColumns: "No status options found for this column.",
        moveSucceeded: "Status updated.",
        moveFailed: "Could not update the status",
        drop: "Drop here",
    },
    de: {
        searchPlaceholder: "Karten suchen…",
        cards: (n) => (n === 1 ? "1 Karte" : `${n} Karten`),
        addCard: "Neu",
        addCardTitle: "Datensatz mit diesem Status anlegen",
        emptyColumn: "Keine Karten",
        loading: "Board wird geladen…",
        errorPrefix: "Board konnte nicht geladen werden",
        errStatusMissing: "Die Eigenschaft 'Status Column' ist erforderlich.",
        errEntityUnknown: "Tabellenname konnte nicht ermittelt werden.",
        errNoColumns: "Für diese Spalte wurden keine Statuswerte gefunden.",
        moveSucceeded: "Status aktualisiert.",
        moveFailed: "Status konnte nicht aktualisiert werden",
        drop: "Hier ablegen",
    },
    fr: {
        searchPlaceholder: "Rechercher des cartes…",
        cards: (n) => (n === 1 ? "1 carte" : `${n} cartes`),
        addCard: "Ajouter",
        addCardTitle: "Créer un enregistrement avec ce statut",
        emptyColumn: "Aucune carte",
        loading: "Chargement du tableau…",
        errorPrefix: "Impossible de charger le tableau",
        errStatusMissing: "La propriété « Status Column » est obligatoire.",
        errEntityUnknown: "Impossible de déterminer la table.",
        errNoColumns: "Aucune valeur de statut trouvée pour cette colonne.",
        moveSucceeded: "Statut mis à jour.",
        moveFailed: "Échec de la mise à jour du statut",
        drop: "Déposer ici",
    },
};
