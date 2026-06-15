// Runtime UI localization for the ChoicePicker control. The maker-facing
// manifest strings live in the .resx; everything the END USER sees is resolved
// here from the user's LCID (`context.userSettings.languageId`).

export type Lang = "de" | "en" | "fr";

/**
 * Maps a Dataverse LCID to one of the three supported UI languages. German and
 * French regional variants all collapse to "de" / "fr"; everything else
 * (including 1033 en-US) falls back to English.
 */
export function lcidToLang(lcid?: number | null): Lang {
    switch (lcid) {
        case 1031: // de-DE
        case 2055: // de-CH
        case 3079: // de-AT
        case 4103: // de-LU
        case 5127: // de-LI
            return "de";
        case 1036: // fr-FR
        case 2060: // fr-BE
        case 3084: // fr-CA
        case 4108: // fr-CH
        case 5132: // fr-LU
            return "fr";
        default:
            return "en";
    }
}

export interface Strings {
    /** Trigger placeholder when nothing is selected (single + multi). */
    placeholder: string;
    /** Search box placeholder inside the dropdown. */
    search: string;
    /** Shown in the list when the filter matches nothing. */
    noResults: string;
    /** aria-label / tooltip for the inline clear (×) button. */
    clear: string;
    /** aria-label for a single chip's remove (×) button — receives the label. */
    remove: (label: string) => string;
    /** Footer action: select every option (multi only). */
    selectAll: string;
    /** Footer action: clear the whole selection (multi only). */
    clearAll: string;
    /** Compact multi summary used for the trigger tooltip — receives the count. */
    selectedCount: (n: number) => string;
    /** aria-label for the trigger button itself. */
    open: string;
}

export const STRINGS: Record<Lang, Strings> = {
    de: {
        placeholder: "Auswählen…",
        search: "Suchen…",
        noResults: "Keine Treffer",
        clear: "Auswahl löschen",
        remove: (label) => `${label} entfernen`,
        selectAll: "Alle auswählen",
        clearAll: "Leeren",
        selectedCount: (n) => (n === 1 ? "1 ausgewählt" : `${n} ausgewählt`),
        open: "Auswahl öffnen",
    },
    en: {
        placeholder: "Select…",
        search: "Search…",
        noResults: "No matches",
        clear: "Clear selection",
        remove: (label) => `Remove ${label}`,
        selectAll: "Select all",
        clearAll: "Clear",
        selectedCount: (n) => (n === 1 ? "1 selected" : `${n} selected`),
        open: "Open picker",
    },
    fr: {
        placeholder: "Sélectionner…",
        search: "Rechercher…",
        noResults: "Aucun résultat",
        clear: "Effacer la sélection",
        remove: (label) => `Supprimer ${label}`,
        selectAll: "Tout sélectionner",
        clearAll: "Vider",
        selectedCount: (n) => (n === 1 ? "1 sélectionné" : `${n} sélectionnés`),
        open: "Ouvrir le sélecteur",
    },
};
