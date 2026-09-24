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
    /** Scope switch ON label (admins): show everyone's hours, not just mine. */
    allHours: string;
    /** aria-label for the my-hours / all-hours scope switch. */
    scopeToggle: string;
    /**
     * Label of the team-lead-only switch that includes entries on fixed-price
     * ("Festpreis") projects, which are excluded by default. Desktop only.
     */
    fixedPrice: string;
    /** Tooltip/aria description for the fixed-price switch. */
    fixedPriceHint: string;
    /** Chip on a list card marking an entry on a fixed-price project. */
    fixedPriceChip: string;
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
    /** Collapsible action bar (mobile): "hide filters" trigger + "show" aria. */
    filterCollapse: string;
    filterExpand: string;
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
    /** Debug/info panel. */
    infoTitle: string;
    infoVersion: string;
    infoStatus: string;
    infoSession: string;
    infoUser: string;
    infoEnvironment: string;
    infoTelemetry: string;
    infoCopy: string;
    infoCopied: string;
    offlineBanner: string;
    /** Read-only notice shown in the detail/action area while offline. */
    offlineReadOnly: string;
    /** Empty-list line while the offline dataset is still syncing from the cache. */
    offlineSyncing: string;
    /** Neutral banner while probing the live Web API before deciding offline. */
    offlineConnecting: string;
    /** Offline block: title of the "connection required" full-panel state. */
    offlineRequiredTitle: string;
    /** Offline block: body text explaining a connection is needed. */
    offlineRequiredBody: string;
    /** Retry button in the offline block. */
    retry: string;
    loading: string;
    loadingSubtypes: string;
    errorPrefix: string;
    errEntityUnknown: string;
    errLoadSubtypes: string;
    noSubtypes: string;
    total: string;
    /** Per-day summary labels in the master list ("Work 6.5 h · Travel 1 h"). */
    dayWork: string;
    dayTravel: string;
    /** Duration unit suffix for the day sums ("h"). */
    hoursUnit: string;
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
    /** Mobile bottom sheet (period / grouping / sort / scope). */
    sheetTitle: string;
    sheetDone: string;
    /** Abbreviations for the compact mobile day header ("A 8 · F 1 · Σ 9 h"). */
    dayWorkShort: string;
    dayTravelShort: string;
    /** List grouping (desktop: 2 dropdowns; mobile: Day | Project). */
    groupLabel: string;
    groupThen: string;
    groupNone: string;
    /** Summary text when grouping is switched off ("no grouping"). */
    groupOff: string;
    groupDay: string;
    groupNoProject: string;
    groupNoResource: string;
    groupSelectAll: string;
    groupCollapse: string;
    groupExpand: string;
    /** Info popover next to the grouping controls: how the day split works. */
    daySplitInfoTitle: string;
    daySplitInfoPoints: string[];
    /** Day split opened below a project that isn't the whole person-day. */
    daySplitAlso: (projects: string) => string;
    /** Day-level split (list header button + editor). */
    daySplitButton: string;
    daySplitTitle: string;
    daySplitEntries: (n: number) => string;
    /** Entries of the day whose type is neither work nor travel. */
    daySplitOther: (n: number) => string;
    daySplitNoEntries: string;
    daySplitPreview: string;
    /** An entry lacks the subtype row the user assigned hours to. */
    daySplitMissingSubtype: (entry: string, subtype: string) => string;
    daySplitConfirmBody: (entries: number, splits: number) => string;
    daySplitSaved: (n: number) => string;
    daySplitPartial: (saved: number, total: number) => string;
    /** Hint in the empty detail pane (split mode). */
    selectHintDay: string;
    /** Composed list/detail title: "<type> am <date>". */
    title: (type: string, date: string) => string;
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
        allHours: "All hours",
        scopeToggle: "Hours scope — off: my hours, on: all hours",
        fixedPrice: "Show fixed-price hours",
        fixedPriceHint:
            "Also list entries on fixed-price („Festpreis“) projects, which are hidden by default.",
        fixedPriceChip: "Fixed price",
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
        filterCollapse: "Hide filters",
        filterExpand: "Show filters",
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
        infoTitle: "Info & diagnostics",
        infoVersion: "Version",
        infoStatus: "Status",
        infoSession: "Session ID",
        infoUser: "User",
        infoEnvironment: "Environment",
        infoTelemetry: "Telemetry (current session)",
        infoCopy: "Copy",
        infoCopied: "Copied ✓",
        offlineBanner:
            "Offline — read-only view from the local cache. Editing is available online.",
        offlineReadOnly: "Offline — editing is only available online.",
        offlineSyncing: "Syncing offline data…",
        offlineConnecting: "Connecting…",
        offlineRequiredTitle: "Connection required",
        offlineRequiredBody:
            "Splitting work times needs an online connection. Please go online and try again.",
        retry: "Retry",
        loading: "Loading entries…",
        loadingSubtypes: "Loading subtypes…",
        errorPrefix: "Could not load the grid",
        errEntityUnknown: "Could not determine the dataset table.",
        errLoadSubtypes: "Could not load the work subtypes.",
        noSubtypes: "No work subtypes found for this entry.",
        total: "Total",
        dayWork: "Work",
        dayTravel: "Travel",
        hoursUnit: "h",
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
        sheetTitle: "Filters & view",
        sheetDone: "Done",
        dayWorkShort: "W",
        dayTravelShort: "T",
        groupLabel: "Group by",
        groupThen: "then",
        groupNone: "None",
        groupOff: "No grouping",
        groupDay: "Day",
        groupNoProject: "(no project)",
        groupNoResource: "(no resource)",
        groupSelectAll: "Select all in this group",
        groupCollapse: "Collapse",
        groupExpand: "Expand",
        daySplitInfoTitle: 'How "Split day" works',
        daySplitInfoPoints: [
            '"Split day" appears on headers that show exactly one day of one person — e.g. grouped by Day, Resource › Day or Day › Resource.',
            "The whole day of that person is always split — across all projects and regardless of the search.",
            "Work and travel time are distributed separately. ★ suggests a distribution from the 8-hour rule, Sunday and public holidays.",
            "The hours are poured into the entries in chronological order: Normal first, overtime lands on the last entries of the day. Every entry keeps its own total.",
            "A preview shows the result per entry before saving. The day is saved in one step — all entries or none.",
        ],
        daySplitAlso: (projects) =>
            `The whole day is split — also contains entries from: ${projects}`,
        daySplitButton: "Split day",
        daySplitTitle: "Day split",
        daySplitEntries: (n) => (n === 1 ? "1 entry" : `${n} entries`),
        daySplitOther: (n) =>
            n === 1
                ? "1 entry of another type is not distributed."
                : `${n} entries of another type are not distributed.`,
        daySplitNoEntries: "No open work / travel entries on this day.",
        daySplitPreview: "Preview per entry",
        daySplitMissingSubtype: (entry, subtype) =>
            `"${entry}" has no subtype "${subtype}".`,
        daySplitConfirmBody: (entries, splits) =>
            `${entries} entries will be replaced by ${splits} split records and deleted. Continue?`,
        daySplitSaved: (n) =>
            n === 1 ? "1 entry split." : `${n} entries split.`,
        daySplitPartial: (saved, total) =>
            `Only ${saved} of ${total} entries were split — the list has been refreshed.`,
        selectHintDay: "Select an entry or a day to distribute its hours.",
        title: (type, date) => {
            let s = type || "—";
            if (date) s += ` on ${date}`;
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
        allHours: "Alle Stunden",
        scopeToggle: "Stundenbereich — Aus: meine Stunden, An: alle Stunden",
        fixedPrice: "Festpreiszeiten anzeigen",
        fixedPriceHint:
            "Zeigt zusätzlich Einträge zu Festpreis-Projekten, die standardmäßig ausgeblendet sind.",
        fixedPriceChip: "Festpreis",
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
        filterCollapse: "Filter ausblenden",
        filterExpand: "Filter einblenden",
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
        infoTitle: "Info & Diagnose",
        infoVersion: "Version",
        infoStatus: "Status",
        infoSession: "Session-ID",
        infoUser: "Benutzer",
        infoEnvironment: "Umgebung",
        infoTelemetry: "Telemetrie (aktuelle Sitzung)",
        infoCopy: "Kopieren",
        infoCopied: "Kopiert ✓",
        offlineBanner:
            "Offline — schreibgeschützte Ansicht aus dem lokalen Cache. Bearbeiten ist nur online möglich.",
        offlineReadOnly: "Offline — Bearbeiten ist nur online möglich.",
        offlineSyncing: "Offline-Daten werden synchronisiert…",
        offlineConnecting: "Verbinde…",
        offlineRequiredTitle: "Verbindung erforderlich",
        offlineRequiredBody:
            "Das Aufteilen der Arbeitszeiten benötigt eine Online-Verbindung. Bitte online gehen und erneut versuchen.",
        retry: "Erneut versuchen",
        loading: "Einträge werden geladen…",
        loadingSubtypes: "Subtypes werden geladen…",
        errorPrefix: "Grid konnte nicht geladen werden",
        errEntityUnknown: "Tabelle des Datasets konnte nicht ermittelt werden.",
        errLoadSubtypes: "Die Work Subtypes konnten nicht geladen werden.",
        noSubtypes: "Für diesen Eintrag wurden keine Work Subtypes gefunden.",
        total: "Gesamt",
        dayWork: "Arbeit",
        dayTravel: "Fahrzeit",
        hoursUnit: "h",
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
        sheetTitle: "Filter & Ansicht",
        sheetDone: "Fertig",
        dayWorkShort: "A",
        dayTravelShort: "F",
        groupLabel: "Gruppieren",
        groupThen: "dann",
        groupNone: "Keine",
        groupOff: "Ohne Gruppierung",
        groupDay: "Tag",
        groupNoProject: "(ohne Projekt)",
        groupNoResource: "(ohne Ressource)",
        groupSelectAll: "Alle in dieser Gruppe auswählen",
        groupCollapse: "Einklappen",
        groupExpand: "Aufklappen",
        daySplitInfoTitle: 'So funktioniert „Tag aufteilen"',
        daySplitInfoPoints: [
            '„Tag aufteilen" erscheint an Kopfzeilen, die genau einen Tag einer Person zeigen — z. B. bei Gruppierung Tag, Ressource › Tag oder Tag › Ressource.',
            "Aufgeteilt wird immer der ganze Tag der Person — über alle Projekte und unabhängig von der Suche.",
            "Arbeit und Fahrzeit werden getrennt verteilt. ★ schlägt eine Verteilung nach 8-Stunden-Regel, Sonntag und Feiertag vor.",
            "Die Stunden werden chronologisch auf die Einträge verteilt: Normal zuerst, Überstunden landen auf den letzten Einträgen des Tages. Jeder Eintrag behält seine Gesamtzeit.",
            "Eine Vorschau zeigt das Ergebnis je Eintrag vor dem Speichern. Gespeichert wird der Tag in einem Schritt — alle Einträge oder keiner.",
        ],
        daySplitAlso: (projects) =>
            `Es wird der ganze Tag aufgeteilt — enthält auch Einträge aus: ${projects}`,
        daySplitButton: "Tag aufteilen",
        daySplitTitle: "Tagesaufteilung",
        daySplitEntries: (n) => (n === 1 ? "1 Eintrag" : `${n} Einträge`),
        daySplitOther: (n) =>
            n === 1
                ? "1 Eintrag mit anderem Typ wird nicht verteilt."
                : `${n} Einträge mit anderem Typ werden nicht verteilt.`,
        daySplitNoEntries:
            "Keine offenen Arbeits-/Fahrzeit-Einträge an diesem Tag.",
        daySplitPreview: "Vorschau je Eintrag",
        daySplitMissingSubtype: (entry, subtype) =>
            `„${entry}" hat keinen Subtyp „${subtype}".`,
        daySplitConfirmBody: (entries, splits) =>
            `${entries} Einträge werden durch ${splits} Split-Datensätze ersetzt und gelöscht. Fortfahren?`,
        daySplitSaved: (n) =>
            n === 1 ? "1 Eintrag aufgeteilt." : `${n} Einträge aufgeteilt.`,
        daySplitPartial: (saved, total) =>
            `Nur ${saved} von ${total} Einträgen aufgeteilt — die Liste wurde aktualisiert.`,
        selectHintDay:
            "Eintrag oder Tag wählen, um die Stunden aufzuteilen.",
        title: (type, date) => {
            let s = type || "—";
            if (date) s += ` am ${date}`;
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
        allHours: "Toutes les heures",
        scopeToggle: "Portée des heures — désactivé : mes heures, activé : toutes les heures",
        fixedPrice: "Afficher les heures au forfait",
        fixedPriceChip: "Forfait",
        fixedPriceHint:
            "Affiche également les entrées des projets au forfait (« Festpreis »), masquées par défaut.",
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
        filterCollapse: "Masquer les filtres",
        filterExpand: "Afficher les filtres",
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
        infoTitle: "Info et diagnostic",
        infoVersion: "Version",
        infoStatus: "État",
        infoSession: "ID de session",
        infoUser: "Utilisateur",
        infoEnvironment: "Environnement",
        infoTelemetry: "Télémétrie (session actuelle)",
        infoCopy: "Copier",
        infoCopied: "Copié ✓",
        offlineBanner:
            "Hors connexion — vue en lecture seule du cache local. La modification est possible en ligne.",
        offlineReadOnly: "Hors connexion — la modification n'est possible qu'en ligne.",
        offlineSyncing: "Synchronisation des données hors connexion…",
        offlineConnecting: "Connexion…",
        offlineRequiredTitle: "Connexion requise",
        offlineRequiredBody:
            "La répartition des temps de travail nécessite une connexion en ligne. Veuillez vous reconnecter et réessayer.",
        retry: "Réessayer",
        loading: "Chargement des entrées…",
        loadingSubtypes: "Chargement des sous-types…",
        errorPrefix: "Impossible de charger la grille",
        errEntityUnknown: "Impossible de déterminer la table du jeu de données.",
        errLoadSubtypes: "Impossible de charger les sous-types de travail.",
        noSubtypes: "Aucun sous-type de travail pour cette entrée.",
        total: "Total",
        dayWork: "Travail",
        dayTravel: "Trajet",
        hoursUnit: "h",
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
        sheetTitle: "Filtres et affichage",
        sheetDone: "Terminé",
        dayWorkShort: "T",
        dayTravelShort: "Tj",
        groupLabel: "Grouper par",
        groupThen: "puis",
        groupNone: "Aucun",
        groupOff: "Sans groupement",
        groupDay: "Jour",
        groupNoProject: "(sans projet)",
        groupNoResource: "(sans ressource)",
        groupSelectAll: "Tout sélectionner dans ce groupe",
        groupCollapse: "Réduire",
        groupExpand: "Développer",
        daySplitInfoTitle: "Fonctionnement de « Répartir la journée »",
        daySplitInfoPoints: [
            "« Répartir la journée » apparaît sur les en-têtes qui montrent exactement une journée d'une personne — p. ex. groupé par Jour, Ressource › Jour ou Jour › Ressource.",
            "C'est toujours toute la journée de la personne qui est répartie — tous projets confondus et indépendamment de la recherche.",
            "Le travail et le trajet sont répartis séparément. ★ propose une répartition selon la règle des 8 heures, le dimanche et les jours fériés.",
            "Les heures sont versées dans les entrées par ordre chronologique : Normal d'abord, les heures supplémentaires sur les dernières entrées. Chaque entrée conserve son total.",
            "Un aperçu montre le résultat par entrée avant l'enregistrement. La journée est enregistrée en une seule étape — toutes les entrées ou aucune.",
        ],
        daySplitAlso: (projects) =>
            `Toute la journée est répartie — contient aussi des entrées de : ${projects}`,
        daySplitButton: "Répartir la journée",
        daySplitTitle: "Répartition journalière",
        daySplitEntries: (n) => (n === 1 ? "1 entrée" : `${n} entrées`),
        daySplitOther: (n) =>
            n === 1
                ? "1 entrée d'un autre type n'est pas répartie."
                : `${n} entrées d'un autre type ne sont pas réparties.`,
        daySplitNoEntries:
            "Aucune entrée travail / trajet ouverte pour cette journée.",
        daySplitPreview: "Aperçu par entrée",
        daySplitMissingSubtype: (entry, subtype) =>
            `« ${entry} » n'a pas de sous-type « ${subtype} ».`,
        daySplitConfirmBody: (entries, splits) =>
            `${entries} entrées seront remplacées par ${splits} enregistrements répartis puis supprimées. Continuer ?`,
        daySplitSaved: (n) =>
            n === 1 ? "1 entrée répartie." : `${n} entrées réparties.`,
        daySplitPartial: (saved, total) =>
            `Seules ${saved} entrées sur ${total} ont été réparties — la liste a été actualisée.`,
        selectHintDay:
            "Sélectionnez une entrée ou une journée pour répartir ses heures.",
        title: (type, date) => {
            let s = type || "—";
            if (date) s += ` le ${date}`;
            return s;
        },
    },
};
