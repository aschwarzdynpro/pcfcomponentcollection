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

export interface Strings {
    searchPlaceholder: string;
    entries: (n: number) => string;
    toggleOpen: string;
    toggleSplit: string;
    myHours: string;
    myHoursLocked: string;
    selectHint: string;
    loading: string;
    loadingSubtypes: string;
    errorPrefix: string;
    errEntityUnknown: string;
    errLoadSubtypes: string;
    noSubtypes: string;
    total: string;
    distributed: string;
    remaining: string;
    save: string;
    saving: string;
    saveDisabledSum: string;
    saveSucceeded: string;
    saveFailed: string;
    confirmTitle: string;
    confirmBody: (name: string, count: number) => string;
    confirmOk: string;
    confirmCancel: string;
    colType: string;
    colDate: string;
    back: string;
    /** Composed list/detail title: "<type> am <date> auf Projekt <project>". */
    title: (type: string, date: string, project: string) => string;
}

export const STRINGS: Record<Lang, Strings> = {
    en: {
        searchPlaceholder: "Search entries…",
        entries: (n) => (n === 1 ? "1 entry" : `${n} entries`),
        toggleOpen: "Not split",
        toggleSplit: "Split",
        myHours: "My hours",
        myHoursLocked: "Locked — you only see your own hours.",
        selectHint: "Select an entry to distribute its hours.",
        loading: "Loading entries…",
        loadingSubtypes: "Loading subtypes…",
        errorPrefix: "Could not load the grid",
        errEntityUnknown: "Could not determine the dataset table.",
        errLoadSubtypes: "Could not load the work subtypes.",
        noSubtypes: "No work subtypes found for this entry.",
        total: "Total",
        distributed: "Distributed",
        remaining: "Remaining",
        save: "Save split",
        saving: "Saving…",
        saveDisabledSum: "The distributed hours must equal the total.",
        saveSucceeded: "Split saved.",
        saveFailed: "Could not save the split",
        confirmTitle: "Save split?",
        confirmBody: (name, count) =>
            `This creates ${count} split record(s), marks "${name}" (and its pauses) as completed, and deletes the original. Continue?`,
        confirmOk: "Save & split",
        confirmCancel: "Cancel",
        colType: "Type",
        colDate: "Date",
        back: "Back",
        title: (type, date, project) => {
            let s = type || "—";
            if (date) s += ` on ${date}`;
            if (project) s += ` on project ${project}`;
            return s;
        },
    },
    de: {
        searchPlaceholder: "Einträge suchen…",
        entries: (n) => (n === 1 ? "1 Eintrag" : `${n} Einträge`),
        toggleOpen: "Nicht aufgeteilt",
        toggleSplit: "Aufgeteilt",
        myHours: "Meine Stunden",
        myHoursLocked: "Gesperrt — du siehst nur deine eigenen Stunden.",
        selectHint: "Eintrag wählen, um die Stunden aufzuteilen.",
        loading: "Einträge werden geladen…",
        loadingSubtypes: "Subtypes werden geladen…",
        errorPrefix: "Grid konnte nicht geladen werden",
        errEntityUnknown: "Tabelle des Datasets konnte nicht ermittelt werden.",
        errLoadSubtypes: "Die Work Subtypes konnten nicht geladen werden.",
        noSubtypes: "Für diesen Eintrag wurden keine Work Subtypes gefunden.",
        total: "Gesamt",
        distributed: "Verteilt",
        remaining: "Rest",
        save: "Aufteilung speichern",
        saving: "Wird gespeichert…",
        saveDisabledSum: "Die verteilten Stunden müssen der Gesamtzeit entsprechen.",
        saveSucceeded: "Aufteilung gespeichert.",
        saveFailed: "Aufteilung konnte nicht gespeichert werden",
        confirmTitle: "Aufteilung speichern?",
        confirmBody: (name, count) =>
            `Es werden ${count} Split-Datensätze erstellt, „${name}" (und zugehörige Pausen) als erledigt markiert und das Original gelöscht. Fortfahren?`,
        confirmOk: "Speichern & aufteilen",
        confirmCancel: "Abbrechen",
        colType: "Typ",
        colDate: "Datum",
        back: "Zurück",
        title: (type, date, project) => {
            let s = type || "—";
            if (date) s += ` am ${date}`;
            if (project) s += ` auf Projekt ${project}`;
            return s;
        },
    },
    fr: {
        searchPlaceholder: "Rechercher des entrées…",
        entries: (n) => (n === 1 ? "1 entrée" : `${n} entrées`),
        toggleOpen: "Non réparti",
        toggleSplit: "Réparti",
        myHours: "Mes heures",
        myHoursLocked: "Verrouillé — vous ne voyez que vos propres heures.",
        selectHint: "Sélectionnez une entrée pour répartir ses heures.",
        loading: "Chargement des entrées…",
        loadingSubtypes: "Chargement des sous-types…",
        errorPrefix: "Impossible de charger la grille",
        errEntityUnknown: "Impossible de déterminer la table du jeu de données.",
        errLoadSubtypes: "Impossible de charger les sous-types de travail.",
        noSubtypes: "Aucun sous-type de travail pour cette entrée.",
        total: "Total",
        distributed: "Réparti",
        remaining: "Restant",
        save: "Enregistrer la répartition",
        saving: "Enregistrement…",
        saveDisabledSum: "Les heures réparties doivent égaler le total.",
        saveSucceeded: "Répartition enregistrée.",
        saveFailed: "Impossible d'enregistrer la répartition",
        confirmTitle: "Enregistrer la répartition ?",
        confirmBody: (name, count) =>
            `Cela crée ${count} enregistrement(s), marque « ${name} » (et ses pauses) comme terminé et supprime l'original. Continuer ?`,
        confirmOk: "Enregistrer & répartir",
        confirmCancel: "Annuler",
        colType: "Type",
        colDate: "Date",
        back: "Retour",
        title: (type, date, project) => {
            let s = type || "—";
            if (date) s += ` le ${date}`;
            if (project) s += ` sur le projet ${project}`;
            return s;
        },
    },
};
