// UI strings, keyed by the language we infer from the user's LCID.
// Matches the pattern used by sibling controls (FlagPhone, KanbanBoard).

export type Lang = "en" | "de" | "fr";

export function lcidToLang(lcid: number | null | undefined): Lang {
    // Microsoft LCID list: 1031 = de-DE, 1036 = fr-FR; everything else → en.
    if (lcid === 1031 || lcid === 2055 || lcid === 3079 || lcid === 4103 || lcid === 5127) {
        return "de";
    }
    if (lcid === 1036 || lcid === 2060 || lcid === 3084 || lcid === 4108 || lcid === 5132) {
        return "fr";
    }
    return "en";
}

export interface UiStrings {
    placeholderDefault: string;
    searching: string;
    noResults: string;
    minChars: string;            // "type at least 2 characters"
    typeToSearch: string;        // empty-state hint when dropdown is open but term is blank
    quickCreate: string;         // "+ New"
    clearSelection: string;      // tooltip on the x button
    openRecord: string;          // tooltip on the open-record button
    openLookupDialog: string;    // tooltip on the magnifier button
    favoritesHeader: string;
    recentHeader: string;
    resultsHeader: string;
    pinTooltip: string;
    unpinTooltip: string;
    searchUnavailableHint: string; // banner shown when search degrades
    previewTitle: string;        // aria-label on the long-press preview dialog
    previewClose: string;        // tooltip / aria-label on the modal close button
    previewSelect: string;       // label on the modal "select this record" button
    previewLoading: string;      // status shown in the modal while the QVF / record is being fetched
}

export const STRINGS: Record<Lang, UiStrings> = {
    en: {
        placeholderDefault: "Search…",
        searching: "Searching…",
        noResults: "No matches found.",
        minChars: "Type at least 2 characters to search.",
        typeToSearch: "Start typing to search…",
        quickCreate: "+ New",
        clearSelection: "Clear selection",
        openRecord: "Open record",
        openLookupDialog: "Open advanced lookup",
        favoritesHeader: "Favorites",
        recentHeader: "Recently used",
        resultsHeader: "Results",
        pinTooltip: "Pin as favorite",
        unpinTooltip: "Remove from favorites",
        searchUnavailableHint:
            "Dataverse Search is not available — using basic text contains. Enable Dataverse Search for better results.",
        previewTitle: "Record preview",
        previewClose: "Close preview",
        previewSelect: "Select this record",
        previewLoading: "Loading details…",
    },
    de: {
        placeholderDefault: "Suchen…",
        searching: "Suche läuft…",
        noResults: "Keine Treffer gefunden.",
        minChars: "Mindestens 2 Zeichen eingeben.",
        typeToSearch: "Tippen, um zu suchen…",
        quickCreate: "+ Neu",
        clearSelection: "Auswahl zurücksetzen",
        openRecord: "Datensatz öffnen",
        openLookupDialog: "Erweiterte Suche öffnen",
        favoritesHeader: "Favoriten",
        recentHeader: "Zuletzt verwendet",
        resultsHeader: "Treffer",
        pinTooltip: "Als Favorit merken",
        unpinTooltip: "Aus Favoriten entfernen",
        searchUnavailableHint:
            "Dataverse Search nicht verfügbar — es wird die einfache Textsuche genutzt. Aktivieren Sie Dataverse Search für bessere Treffer.",
        previewTitle: "Datensatz-Vorschau",
        previewClose: "Vorschau schließen",
        previewSelect: "Diesen Datensatz wählen",
        previewLoading: "Details werden geladen…",
    },
    fr: {
        placeholderDefault: "Rechercher…",
        searching: "Recherche…",
        noResults: "Aucun résultat trouvé.",
        minChars: "Saisissez au moins 2 caractères.",
        typeToSearch: "Tapez pour rechercher…",
        quickCreate: "+ Nouveau",
        clearSelection: "Effacer la sélection",
        openRecord: "Ouvrir l'enregistrement",
        openLookupDialog: "Ouvrir la recherche avancée",
        favoritesHeader: "Favoris",
        recentHeader: "Récemment utilisés",
        resultsHeader: "Résultats",
        pinTooltip: "Épingler aux favoris",
        unpinTooltip: "Retirer des favoris",
        searchUnavailableHint:
            "Dataverse Search indisponible — recherche textuelle simple utilisée. Activez Dataverse Search pour de meilleurs résultats.",
        previewTitle: "Aperçu de l'enregistrement",
        previewClose: "Fermer l'aperçu",
        previewSelect: "Sélectionner cet enregistrement",
        previewLoading: "Chargement des détails…",
    },
};
