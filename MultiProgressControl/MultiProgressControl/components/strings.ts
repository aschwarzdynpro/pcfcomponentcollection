export type Lang = "en" | "de";

export interface Strings {
    /** Accessible label for a single indicator, e.g. "Projektaufgaben: 66 percent". */
    indicatorAria: (label: string, percent: number) => string;
    /** Shown when no field is bound / configured yet. */
    noFields: string;
}

export const STRINGS: Record<Lang, Strings> = {
    en: {
        indicatorAria: (label, percent) =>
            label ? `${label}: ${percent} percent` : `${percent} percent`,
        noFields: "No fields configured.",
    },
    de: {
        indicatorAria: (label, percent) =>
            label ? `${label}: ${percent} Prozent` : `${percent} Prozent`,
        noFields: "Keine Felder konfiguriert.",
    },
};

// Map a Dataverse user LCID to one of our supported UI languages.
export const lcidToLang = (lcid?: number): Lang => {
    if (!lcid) return "en";
    // 1031 = de-DE, 2055 = de-CH, 3079 = de-AT, 4103 = de-LU, 5127 = de-LI
    if (lcid === 1031 || lcid === 2055 || lcid === 3079 || lcid === 4103 || lcid === 5127) {
        return "de";
    }
    return "en";
};
