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
    loadingMore: string;
    modeSplit: string;
    modeAssign: string;
    myHours: string;
    myHoursLocked: string;
    /** Period filter (segmented). */
    periodLabel: string;
    periodAll: string;
    periodToday: string;
    periodWeek: string;
    periodMonth: string;
    /** Sort dropdown. */
    sortLabel: string;
    sortDateDesc: string;
    sortDateAsc: string;
    sortProject: string;
    sortResource: string;
    sortDuration: string;
    selectHint: string;
    /** Empty-state line when the (unfiltered) list has no entries. */
    noResults: string;
    /** Empty-state line when a search yields no matches. */
    noResultsSearch: string;
    /** Assign mode: hint shown when nothing is selected yet. */
    assignHint: string;
    selectedCount: (n: number) => string;
    createReports: string;
    /** Second assign-mode action: create the delivery notes and open them. */
    createReportsOpen: string;
    creatingReports: string;
    reportsDone: (reports: number, assigned: number) => string;
    reportsPartial: (assigned: number, total: number) => string;
    reportsBlocked: string;
    /** Picker shown when "create & open" produced several delivery notes. */
    pickReportTitle: (n: number) => string;
    pickReportPrompt: string;
    closeLabel: string;
    offlineBanner: string;
    /** Read-only notice shown in the detail/action area while offline. */
    offlineReadOnly: string;
    /** Empty-list line while the offline dataset is still syncing from the cache. */
    offlineSyncing: string;
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
    takeRemaining: string;
    /** Tooltip/aria for the star/AI pre-fill button. */
    suggest: string;
    /** Composed list/detail title: "<type> am <date> auf Projekt <project>". */
    title: (type: string, date: string, project: string) => string;
}

export const STRINGS: Record<Lang, Strings> = {
    en: {
        searchPlaceholder: "Search entries…",
        entries: (n) => (n === 1 ? "1 entry" : `${n} entries`),
        loadingMore: "loading more…",
        modeSplit: "Split",
        modeAssign: "Assign",
        myHours: "My hours",
        myHoursLocked: "Locked — you only see your own hours.",
        periodLabel: "Period",
        periodAll: "All",
        periodToday: "Today",
        periodWeek: "This week",
        periodMonth: "This month",
        sortLabel: "Sort",
        sortDateDesc: "Date (newest)",
        sortDateAsc: "Date (oldest)",
        sortProject: "Project",
        sortResource: "Resource",
        sortDuration: "Duration",
        selectHint: "Select an entry to distribute its hours.",
        noResults: "No entries here — nothing to show.",
        noResultsSearch: "No entries match your search.",
        assignHint: "Select entries to create delivery notes.",
        selectedCount: (n) => (n === 1 ? "1 selected" : `${n} selected`),
        createReports: "Create delivery notes",
        createReportsOpen: "Create & open",
        creatingReports: "Creating delivery notes…",
        reportsDone: (reports, assigned) =>
            `${reports} delivery note(s) created, ${assigned} entr${assigned === 1 ? "y" : "ies"} assigned.`,
        reportsPartial: (assigned, total) =>
            `${assigned} of ${total} entries assigned; some could not be assigned.`,
        reportsBlocked:
            "Only entries that are not yet assigned to a delivery note can be processed.",
        pickReportTitle: (n) => `${n} delivery notes created`,
        pickReportPrompt: "Which delivery note would you like to open?",
        closeLabel: "Close",
        offlineBanner:
            "Offline — read-only view from the local cache. Editing is available online.",
        offlineReadOnly: "Offline — editing is only available online.",
        offlineSyncing: "Syncing offline data…",
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
        takeRemaining: "Use remaining",
        suggest: "Suggest distribution (date + duration)",
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
        loadingMore: "lädt weitere…",
        modeSplit: "Aufteilen",
        modeAssign: "Zuordnen",
        myHours: "Meine Stunden",
        myHoursLocked: "Gesperrt — du siehst nur deine eigenen Stunden.",
        periodLabel: "Zeitraum",
        periodAll: "Alle",
        periodToday: "Heute",
        periodWeek: "Diese Woche",
        periodMonth: "Dieser Monat",
        sortLabel: "Sortieren",
        sortDateDesc: "Datum (neueste)",
        sortDateAsc: "Datum (älteste)",
        sortProject: "Projekt",
        sortResource: "Ressource",
        sortDuration: "Dauer",
        selectHint: "Eintrag wählen, um die Stunden aufzuteilen.",
        noResults: "Keine Einträge vorhanden — hier gibt es nichts zu sehen.",
        noResultsSearch: "Keine Einträge passen zu deiner Suche.",
        assignHint: "Einträge auswählen, um Lieferscheine zu erstellen.",
        selectedCount: (n) => (n === 1 ? "1 ausgewählt" : `${n} ausgewählt`),
        createReports: "Lieferscheine erstellen",
        createReportsOpen: "Erstellen & öffnen",
        creatingReports: "Lieferscheine werden erstellt…",
        reportsDone: (reports, assigned) =>
            `${reports} Lieferschein(e) erstellt, ${assigned} Eintrag/Einträge zugeordnet.`,
        reportsPartial: (assigned, total) =>
            `${assigned} von ${total} Einträgen zugeordnet; einige konnten nicht zugeordnet werden.`,
        reportsBlocked:
            "Es können nur Zeiteinträge verarbeitet werden, die noch keinem Lieferschein zugeordnet wurden.",
        pickReportTitle: (n) => `${n} Lieferscheine erstellt`,
        pickReportPrompt: "Welchen Lieferschein möchtest du öffnen?",
        closeLabel: "Schließen",
        offlineBanner:
            "Offline — schreibgeschützte Ansicht aus dem lokalen Cache. Bearbeiten ist nur online möglich.",
        offlineReadOnly: "Offline — Bearbeiten ist nur online möglich.",
        offlineSyncing: "Offline-Daten werden synchronisiert…",
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
        takeRemaining: "Rest übernehmen",
        suggest: "Verteilung vorschlagen (Datum + Dauer)",
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
        loadingMore: "chargement…",
        modeSplit: "Répartir",
        modeAssign: "Affecter",
        myHours: "Mes heures",
        myHoursLocked: "Verrouillé — vous ne voyez que vos propres heures.",
        periodLabel: "Période",
        periodAll: "Toutes",
        periodToday: "Aujourd'hui",
        periodWeek: "Cette semaine",
        periodMonth: "Ce mois",
        sortLabel: "Trier",
        sortDateDesc: "Date (récentes)",
        sortDateAsc: "Date (anciennes)",
        sortProject: "Projet",
        sortResource: "Ressource",
        sortDuration: "Durée",
        selectHint: "Sélectionnez une entrée pour répartir ses heures.",
        noResults: "Aucune entrée ici — rien à afficher.",
        noResultsSearch: "Aucune entrée ne correspond à votre recherche.",
        assignHint: "Sélectionnez des entrées pour créer des bons de livraison.",
        selectedCount: (n) => (n === 1 ? "1 sélectionné" : `${n} sélectionnés`),
        createReports: "Créer les bons de livraison",
        createReportsOpen: "Créer et ouvrir",
        creatingReports: "Création des bons de livraison…",
        reportsDone: (reports, assigned) =>
            `${reports} bon(s) de livraison créé(s), ${assigned} entrée(s) affectée(s).`,
        reportsPartial: (assigned, total) =>
            `${assigned} sur ${total} entrées affectées ; certaines n'ont pas pu l'être.`,
        reportsBlocked:
            "Seules les entrées non encore affectées à un bon de livraison peuvent être traitées.",
        pickReportTitle: (n) => `${n} bons de livraison créés`,
        pickReportPrompt: "Quel bon de livraison souhaitez-vous ouvrir ?",
        closeLabel: "Fermer",
        offlineBanner:
            "Hors connexion — vue en lecture seule du cache local. La modification est possible en ligne.",
        offlineReadOnly: "Hors connexion — la modification n'est possible qu'en ligne.",
        offlineSyncing: "Synchronisation des données hors connexion…",
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
        takeRemaining: "Reporter le reste",
        suggest: "Proposer la répartition (date + durée)",
        title: (type, date, project) => {
            let s = type || "—";
            if (date) s += ` le ${date}`;
            if (project) s += ` sur le projet ${project}`;
            return s;
        },
    },
};
