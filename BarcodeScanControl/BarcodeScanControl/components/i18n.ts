// Runtime UI localization for the BarcodeScan control. The maker-facing
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
    /** Default button caption when the maker sets no `buttonText`. */
    scan: string;
    /** Caption while the native scanner is open / the promise is pending. */
    busy: string;
    /** Error surfaced through `errorMessage` when the device API is missing. */
    notAvailable: string;
    /** Error surfaced through `errorMessage` when the scanner rejects. */
    failed: (detail: string) => string;
}

export const STRINGS: Record<Lang, Strings> = {
    de: {
        scan: "Code scannen",
        busy: "Scanner geöffnet …",
        notAvailable:
            "Scannen ist nur in Power Apps Mobile (Android/iOS/Windows) verfügbar.",
        failed: (detail) =>
            detail ? `Scan fehlgeschlagen: ${detail}` : "Scan fehlgeschlagen.",
    },
    en: {
        scan: "Scan code",
        busy: "Scanner open …",
        notAvailable:
            "Scanning is only available in Power Apps Mobile (Android/iOS/Windows).",
        failed: (detail) => (detail ? `Scan failed: ${detail}` : "Scan failed."),
    },
    fr: {
        scan: "Scanner le code",
        busy: "Scanner ouvert …",
        notAvailable:
            "La numérisation n'est disponible que dans Power Apps Mobile (Android/iOS/Windows).",
        failed: (detail) =>
            detail ? `Échec du scan : ${detail}` : "Échec du scan.",
    },
};
