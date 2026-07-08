import { Lang } from "./types";

export function lcidToLang(lcid: number | null | undefined): Lang {
    if (!lcid) return "en";
    // Lower 10 bits = primary language identifier.
    // 0x07 → German, 0x0C → French, anything else → English fallback.
    const primary = lcid & 0x3ff;
    if (primary === 0x07) return "de";
    if (primary === 0x0c) return "fr";
    return "en";
}

export interface Strings {
    /** Master-list empty state. */
    noBoxes: string;
    /** Shown while the (offline) dataset is still syncing from the cache. */
    syncing: string;
    /** Infinite-scroll footer while the next page loads. */
    loadingMore: string;
    /** Counter-chip aria-label, e.g. "3 materials". */
    countAria: (n: number) => string;
    /** Fallback (web) button + overlay trigger. */
    showMaterials: string;
    /** Take-out action label. */
    take: string;
    /** State label on a taken box. */
    taken: string;
    /** Undo action. */
    undo: string;
    /** Undo snackbar text with the remaining seconds. */
    undoCountdown: (sec: number) => string;
    /** Retry after a failed save. */
    retry: string;
    /** Error shown when the save failed. */
    saveError: string;
    /** Overlay title (materials of a box). */
    materials: string;
    /** Overlay empty state. */
    emptyBox: string;
    /** Generic loading label. */
    loading: string;
    /** Close (overlay / snackbar) aria-label. */
    close: string;
    /** Overlay button to mark the inspected box as taken. */
    markTaken: string;
}

const de: Strings = {
    noBoxes: "Keine Materialboxen",
    syncing: "Boxen werden synchronisiert …",
    loadingMore: "Weitere Boxen werden geladen …",
    countAria: (n) => `${n} Materialien`,
    showMaterials: "Materialien anzeigen",
    take: "Entnehmen",
    taken: "Entnommen",
    undo: "Rückgängig",
    undoCountdown: (s) => `Entnommen · Rückgängig (${s} s)`,
    retry: "Erneut versuchen",
    saveError: "Speichern fehlgeschlagen.",
    materials: "Materialien",
    emptyBox: "Diese Box ist leer.",
    loading: "Wird geladen …",
    close: "Schließen",
    markTaken: "Als entnommen markieren",
};

const en: Strings = {
    noBoxes: "No material boxes",
    syncing: "Syncing boxes …",
    loadingMore: "Loading more boxes …",
    countAria: (n) => `${n} materials`,
    showMaterials: "Show materials",
    take: "Take out",
    taken: "Taken",
    undo: "Undo",
    undoCountdown: (s) => `Taken · Undo (${s} s)`,
    retry: "Retry",
    saveError: "Saving failed.",
    materials: "Materials",
    emptyBox: "This box is empty.",
    loading: "Loading …",
    close: "Close",
    markTaken: "Mark as taken",
};

const fr: Strings = {
    noBoxes: "Aucune boîte de matériel",
    syncing: "Synchronisation des boîtes …",
    loadingMore: "Chargement d’autres boîtes …",
    countAria: (n) => `${n} matériaux`,
    showMaterials: "Afficher les matériaux",
    take: "Retirer",
    taken: "Retiré",
    undo: "Annuler",
    undoCountdown: (s) => `Retiré · Annuler (${s} s)`,
    retry: "Réessayer",
    saveError: "Échec de l’enregistrement.",
    materials: "Matériaux",
    emptyBox: "Cette boîte est vide.",
    loading: "Chargement …",
    close: "Fermer",
    markTaken: "Marquer comme retiré",
};

const TABLE: Record<Lang, Strings> = { de, en, fr };

export function getStrings(lang: Lang): Strings {
    return TABLE[lang] ?? en;
}
