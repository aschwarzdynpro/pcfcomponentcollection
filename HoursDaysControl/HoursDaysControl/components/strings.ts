export type Lang = "en" | "de";

export interface Strings {
    daysLabel: string;
    hoursLabel: string;
    daysAria: string;
    hoursAria: string;
    totalLabel: (totalHours: number) => string;
    daySingular: string;
    dayPlural: string;
    hourSingular: string;
    hourPlural: string;
}

const formatNumber = (n: number): string => {
    if (Number.isInteger(n)) return n.toString();
    return Number.parseFloat(n.toFixed(2)).toString();
};

export const STRINGS: Record<Lang, Strings> = {
    en: {
        daysLabel: "Days",
        hoursLabel: "Hours",
        daysAria: "Number of workdays",
        hoursAria: "Additional hours",
        daySingular: "day",
        dayPlural: "days",
        hourSingular: "hour",
        hourPlural: "hours",
        totalLabel: (h) => `Total: ${formatNumber(h)} h`,
    },
    de: {
        daysLabel: "Tage",
        hoursLabel: "Stunden",
        daysAria: "Anzahl Arbeitstage",
        hoursAria: "Zusätzliche Stunden",
        daySingular: "Tag",
        dayPlural: "Tage",
        hourSingular: "Stunde",
        hourPlural: "Stunden",
        totalLabel: (h) => `Gesamt: ${formatNumber(h)} h`,
    },
};

// Map a Dataverse user LCID to one of our supported UI languages.
export const lcidToLang = (lcid?: number): Lang => {
    if (!lcid) return "en";
    // 1031 = de-DE, 2055 = de-CH, 3079 = de-AT, etc.
    if (lcid === 1031 || lcid === 2055 || lcid === 3079 || lcid === 4103 || lcid === 5127) {
        return "de";
    }
    return "en";
};
