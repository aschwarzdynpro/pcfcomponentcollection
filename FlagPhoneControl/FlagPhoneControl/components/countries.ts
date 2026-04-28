export interface Country {
    iso: string;
    name: string;
    dial: string;
}

export const countries: Country[] = [
    { iso: "AF", name: "Afghanistan", dial: "+93" },
    { iso: "AL", name: "Albania", dial: "+355" },
    { iso: "DZ", name: "Algeria", dial: "+213" },
    { iso: "AD", name: "Andorra", dial: "+376" },
    { iso: "AO", name: "Angola", dial: "+244" },
    { iso: "AR", name: "Argentina", dial: "+54" },
    { iso: "AM", name: "Armenia", dial: "+374" },
    { iso: "AU", name: "Australia", dial: "+61" },
    { iso: "AT", name: "Austria", dial: "+43" },
    { iso: "AZ", name: "Azerbaijan", dial: "+994" },
    { iso: "BH", name: "Bahrain", dial: "+973" },
    { iso: "BD", name: "Bangladesh", dial: "+880" },
    { iso: "BY", name: "Belarus", dial: "+375" },
    { iso: "BE", name: "Belgium", dial: "+32" },
    { iso: "BZ", name: "Belize", dial: "+501" },
    { iso: "BJ", name: "Benin", dial: "+229" },
    { iso: "BT", name: "Bhutan", dial: "+975" },
    { iso: "BO", name: "Bolivia", dial: "+591" },
    { iso: "BA", name: "Bosnia and Herzegovina", dial: "+387" },
    { iso: "BW", name: "Botswana", dial: "+267" },
    { iso: "BR", name: "Brazil", dial: "+55" },
    { iso: "BN", name: "Brunei", dial: "+673" },
    { iso: "BG", name: "Bulgaria", dial: "+359" },
    { iso: "BF", name: "Burkina Faso", dial: "+226" },
    { iso: "BI", name: "Burundi", dial: "+257" },
    { iso: "KH", name: "Cambodia", dial: "+855" },
    { iso: "CM", name: "Cameroon", dial: "+237" },
    { iso: "CA", name: "Canada", dial: "+1" },
    { iso: "CV", name: "Cape Verde", dial: "+238" },
    { iso: "TD", name: "Chad", dial: "+235" },
    { iso: "CL", name: "Chile", dial: "+56" },
    { iso: "CN", name: "China", dial: "+86" },
    { iso: "CO", name: "Colombia", dial: "+57" },
    { iso: "CR", name: "Costa Rica", dial: "+506" },
    { iso: "HR", name: "Croatia", dial: "+385" },
    { iso: "CU", name: "Cuba", dial: "+53" },
    { iso: "CY", name: "Cyprus", dial: "+357" },
    { iso: "CZ", name: "Czech Republic", dial: "+420" },
    { iso: "DK", name: "Denmark", dial: "+45" },
    { iso: "DO", name: "Dominican Republic", dial: "+1" },
    { iso: "EC", name: "Ecuador", dial: "+593" },
    { iso: "EG", name: "Egypt", dial: "+20" },
    { iso: "SV", name: "El Salvador", dial: "+503" },
    { iso: "EE", name: "Estonia", dial: "+372" },
    { iso: "ET", name: "Ethiopia", dial: "+251" },
    { iso: "FI", name: "Finland", dial: "+358" },
    { iso: "FR", name: "France", dial: "+33" },
    { iso: "GE", name: "Georgia", dial: "+995" },
    { iso: "DE", name: "Germany", dial: "+49" },
    { iso: "GH", name: "Ghana", dial: "+233" },
    { iso: "GR", name: "Greece", dial: "+30" },
    { iso: "GT", name: "Guatemala", dial: "+502" },
    { iso: "HN", name: "Honduras", dial: "+504" },
    { iso: "HK", name: "Hong Kong", dial: "+852" },
    { iso: "HU", name: "Hungary", dial: "+36" },
    { iso: "IS", name: "Iceland", dial: "+354" },
    { iso: "IN", name: "India", dial: "+91" },
    { iso: "ID", name: "Indonesia", dial: "+62" },
    { iso: "IR", name: "Iran", dial: "+98" },
    { iso: "IQ", name: "Iraq", dial: "+964" },
    { iso: "IE", name: "Ireland", dial: "+353" },
    { iso: "IL", name: "Israel", dial: "+972" },
    { iso: "IT", name: "Italy", dial: "+39" },
    { iso: "JM", name: "Jamaica", dial: "+1" },
    { iso: "JP", name: "Japan", dial: "+81" },
    { iso: "JO", name: "Jordan", dial: "+962" },
    { iso: "KZ", name: "Kazakhstan", dial: "+7" },
    { iso: "KE", name: "Kenya", dial: "+254" },
    { iso: "KW", name: "Kuwait", dial: "+965" },
    { iso: "KG", name: "Kyrgyzstan", dial: "+996" },
    { iso: "LA", name: "Laos", dial: "+856" },
    { iso: "LV", name: "Latvia", dial: "+371" },
    { iso: "LB", name: "Lebanon", dial: "+961" },
    { iso: "LY", name: "Libya", dial: "+218" },
    { iso: "LI", name: "Liechtenstein", dial: "+423" },
    { iso: "LT", name: "Lithuania", dial: "+370" },
    { iso: "LU", name: "Luxembourg", dial: "+352" },
    { iso: "MO", name: "Macao", dial: "+853" },
    { iso: "MK", name: "North Macedonia", dial: "+389" },
    { iso: "MG", name: "Madagascar", dial: "+261" },
    { iso: "MY", name: "Malaysia", dial: "+60" },
    { iso: "MV", name: "Maldives", dial: "+960" },
    { iso: "ML", name: "Mali", dial: "+223" },
    { iso: "MT", name: "Malta", dial: "+356" },
    { iso: "MX", name: "Mexico", dial: "+52" },
    { iso: "MD", name: "Moldova", dial: "+373" },
    { iso: "MC", name: "Monaco", dial: "+377" },
    { iso: "MN", name: "Mongolia", dial: "+976" },
    { iso: "ME", name: "Montenegro", dial: "+382" },
    { iso: "MA", name: "Morocco", dial: "+212" },
    { iso: "MZ", name: "Mozambique", dial: "+258" },
    { iso: "MM", name: "Myanmar", dial: "+95" },
    { iso: "NA", name: "Namibia", dial: "+264" },
    { iso: "NP", name: "Nepal", dial: "+977" },
    { iso: "NL", name: "Netherlands", dial: "+31" },
    { iso: "NZ", name: "New Zealand", dial: "+64" },
    { iso: "NI", name: "Nicaragua", dial: "+505" },
    { iso: "NE", name: "Niger", dial: "+227" },
    { iso: "NG", name: "Nigeria", dial: "+234" },
    { iso: "KP", name: "North Korea", dial: "+850" },
    { iso: "NO", name: "Norway", dial: "+47" },
    { iso: "OM", name: "Oman", dial: "+968" },
    { iso: "PK", name: "Pakistan", dial: "+92" },
    { iso: "PS", name: "Palestine", dial: "+970" },
    { iso: "PA", name: "Panama", dial: "+507" },
    { iso: "PY", name: "Paraguay", dial: "+595" },
    { iso: "PE", name: "Peru", dial: "+51" },
    { iso: "PH", name: "Philippines", dial: "+63" },
    { iso: "PL", name: "Poland", dial: "+48" },
    { iso: "PT", name: "Portugal", dial: "+351" },
    { iso: "PR", name: "Puerto Rico", dial: "+1" },
    { iso: "QA", name: "Qatar", dial: "+974" },
    { iso: "RO", name: "Romania", dial: "+40" },
    { iso: "RU", name: "Russia", dial: "+7" },
    { iso: "RW", name: "Rwanda", dial: "+250" },
    { iso: "SA", name: "Saudi Arabia", dial: "+966" },
    { iso: "SN", name: "Senegal", dial: "+221" },
    { iso: "RS", name: "Serbia", dial: "+381" },
    { iso: "SG", name: "Singapore", dial: "+65" },
    { iso: "SK", name: "Slovakia", dial: "+421" },
    { iso: "SI", name: "Slovenia", dial: "+386" },
    { iso: "SO", name: "Somalia", dial: "+252" },
    { iso: "ZA", name: "South Africa", dial: "+27" },
    { iso: "KR", name: "South Korea", dial: "+82" },
    { iso: "ES", name: "Spain", dial: "+34" },
    { iso: "LK", name: "Sri Lanka", dial: "+94" },
    { iso: "SD", name: "Sudan", dial: "+249" },
    { iso: "SE", name: "Sweden", dial: "+46" },
    { iso: "CH", name: "Switzerland", dial: "+41" },
    { iso: "SY", name: "Syria", dial: "+963" },
    { iso: "TW", name: "Taiwan", dial: "+886" },
    { iso: "TJ", name: "Tajikistan", dial: "+992" },
    { iso: "TZ", name: "Tanzania", dial: "+255" },
    { iso: "TH", name: "Thailand", dial: "+66" },
    { iso: "TN", name: "Tunisia", dial: "+216" },
    { iso: "TR", name: "Turkey", dial: "+90" },
    { iso: "TM", name: "Turkmenistan", dial: "+993" },
    { iso: "UG", name: "Uganda", dial: "+256" },
    { iso: "UA", name: "Ukraine", dial: "+380" },
    { iso: "AE", name: "United Arab Emirates", dial: "+971" },
    { iso: "GB", name: "United Kingdom", dial: "+44" },
    { iso: "US", name: "United States", dial: "+1" },
    { iso: "UY", name: "Uruguay", dial: "+598" },
    { iso: "UZ", name: "Uzbekistan", dial: "+998" },
    { iso: "VE", name: "Venezuela", dial: "+58" },
    { iso: "VN", name: "Vietnam", dial: "+84" },
    { iso: "YE", name: "Yemen", dial: "+967" },
    { iso: "ZM", name: "Zambia", dial: "+260" },
    { iso: "ZW", name: "Zimbabwe", dial: "+263" },
];

export const DEFAULT_ISO = "DE";

export type Lang = "de" | "en" | "fr";

/** LCID → supported display language. Falls back to English. */
export function lcidToLang(lcid: number | null | undefined): Lang {
    if (!lcid) return "en";
    // The primary language identifier is the lower 10 bits of the LCID.
    // 0x07 = German (any region), 0x0C = French (any region), 0x09 = English.
    const primary = lcid & 0x3ff;
    if (primary === 0x07) return "de";
    if (primary === 0x0c) return "fr";
    return "en";
}

const NAME_DE: Record<string, string> = {
    AF: "Afghanistan", AL: "Albanien", DZ: "Algerien", AD: "Andorra",
    AO: "Angola", AR: "Argentinien", AM: "Armenien", AU: "Australien",
    AT: "Österreich", AZ: "Aserbaidschan", BH: "Bahrain", BD: "Bangladesch",
    BY: "Belarus", BE: "Belgien", BZ: "Belize", BJ: "Benin", BT: "Bhutan",
    BO: "Bolivien", BA: "Bosnien und Herzegowina", BW: "Botswana",
    BR: "Brasilien", BN: "Brunei", BG: "Bulgarien", BF: "Burkina Faso",
    BI: "Burundi", KH: "Kambodscha", CM: "Kamerun", CA: "Kanada",
    CV: "Kap Verde", TD: "Tschad", CL: "Chile", CN: "China", CO: "Kolumbien",
    CR: "Costa Rica", HR: "Kroatien", CU: "Kuba", CY: "Zypern",
    CZ: "Tschechien", DK: "Dänemark", DO: "Dominikanische Republik",
    EC: "Ecuador", EG: "Ägypten", SV: "El Salvador", EE: "Estland",
    ET: "Äthiopien", FI: "Finnland", FR: "Frankreich", GE: "Georgien",
    DE: "Deutschland", GH: "Ghana", GR: "Griechenland", GT: "Guatemala",
    HN: "Honduras", HK: "Hongkong", HU: "Ungarn", IS: "Island", IN: "Indien",
    ID: "Indonesien", IR: "Iran", IQ: "Irak", IE: "Irland", IL: "Israel",
    IT: "Italien", JM: "Jamaika", JP: "Japan", JO: "Jordanien",
    KZ: "Kasachstan", KE: "Kenia", KW: "Kuwait", KG: "Kirgisistan",
    LA: "Laos", LV: "Lettland", LB: "Libanon", LY: "Libyen",
    LI: "Liechtenstein", LT: "Litauen", LU: "Luxemburg", MO: "Macau",
    MK: "Nordmazedonien", MG: "Madagaskar", MY: "Malaysia", MV: "Malediven",
    ML: "Mali", MT: "Malta", MX: "Mexiko", MD: "Moldau", MC: "Monaco",
    MN: "Mongolei", ME: "Montenegro", MA: "Marokko", MZ: "Mosambik",
    MM: "Myanmar", NA: "Namibia", NP: "Nepal", NL: "Niederlande",
    NZ: "Neuseeland", NI: "Nicaragua", NE: "Niger", NG: "Nigeria",
    KP: "Nordkorea", NO: "Norwegen", OM: "Oman", PK: "Pakistan",
    PS: "Palästina", PA: "Panama", PY: "Paraguay", PE: "Peru",
    PH: "Philippinen", PL: "Polen", PT: "Portugal", PR: "Puerto Rico",
    QA: "Katar", RO: "Rumänien", RU: "Russland", RW: "Ruanda",
    SA: "Saudi-Arabien", SN: "Senegal", RS: "Serbien", SG: "Singapur",
    SK: "Slowakei", SI: "Slowenien", SO: "Somalia", ZA: "Südafrika",
    KR: "Südkorea", ES: "Spanien", LK: "Sri Lanka", SD: "Sudan",
    SE: "Schweden", CH: "Schweiz", SY: "Syrien", TW: "Taiwan",
    TJ: "Tadschikistan", TZ: "Tansania", TH: "Thailand", TN: "Tunesien",
    TR: "Türkei", TM: "Turkmenistan", UG: "Uganda", UA: "Ukraine",
    AE: "Vereinigte Arabische Emirate", GB: "Vereinigtes Königreich",
    US: "Vereinigte Staaten", UY: "Uruguay", UZ: "Usbekistan",
    VE: "Venezuela", VN: "Vietnam", YE: "Jemen", ZM: "Sambia",
    ZW: "Simbabwe",
};

const NAME_FR: Record<string, string> = {
    AF: "Afghanistan", AL: "Albanie", DZ: "Algérie", AD: "Andorre",
    AO: "Angola", AR: "Argentine", AM: "Arménie", AU: "Australie",
    AT: "Autriche", AZ: "Azerbaïdjan", BH: "Bahreïn", BD: "Bangladesh",
    BY: "Biélorussie", BE: "Belgique", BZ: "Belize", BJ: "Bénin",
    BT: "Bhoutan", BO: "Bolivie", BA: "Bosnie-Herzégovine", BW: "Botswana",
    BR: "Brésil", BN: "Brunei", BG: "Bulgarie", BF: "Burkina Faso",
    BI: "Burundi", KH: "Cambodge", CM: "Cameroun", CA: "Canada",
    CV: "Cap-Vert", TD: "Tchad", CL: "Chili", CN: "Chine", CO: "Colombie",
    CR: "Costa Rica", HR: "Croatie", CU: "Cuba", CY: "Chypre",
    CZ: "République tchèque", DK: "Danemark", DO: "République dominicaine",
    EC: "Équateur", EG: "Égypte", SV: "Salvador", EE: "Estonie",
    ET: "Éthiopie", FI: "Finlande", FR: "France", GE: "Géorgie",
    DE: "Allemagne", GH: "Ghana", GR: "Grèce", GT: "Guatemala",
    HN: "Honduras", HK: "Hong Kong", HU: "Hongrie", IS: "Islande",
    IN: "Inde", ID: "Indonésie", IR: "Iran", IQ: "Irak", IE: "Irlande",
    IL: "Israël", IT: "Italie", JM: "Jamaïque", JP: "Japon", JO: "Jordanie",
    KZ: "Kazakhstan", KE: "Kenya", KW: "Koweït", KG: "Kirghizistan",
    LA: "Laos", LV: "Lettonie", LB: "Liban", LY: "Libye",
    LI: "Liechtenstein", LT: "Lituanie", LU: "Luxembourg", MO: "Macao",
    MK: "Macédoine du Nord", MG: "Madagascar", MY: "Malaisie",
    MV: "Maldives", ML: "Mali", MT: "Malte", MX: "Mexique", MD: "Moldavie",
    MC: "Monaco", MN: "Mongolie", ME: "Monténégro", MA: "Maroc",
    MZ: "Mozambique", MM: "Birmanie", NA: "Namibie", NP: "Népal",
    NL: "Pays-Bas", NZ: "Nouvelle-Zélande", NI: "Nicaragua", NE: "Niger",
    NG: "Nigeria", KP: "Corée du Nord", NO: "Norvège", OM: "Oman",
    PK: "Pakistan", PS: "Palestine", PA: "Panama", PY: "Paraguay",
    PE: "Pérou", PH: "Philippines", PL: "Pologne", PT: "Portugal",
    PR: "Porto Rico", QA: "Qatar", RO: "Roumanie", RU: "Russie",
    RW: "Rwanda", SA: "Arabie saoudite", SN: "Sénégal", RS: "Serbie",
    SG: "Singapour", SK: "Slovaquie", SI: "Slovénie", SO: "Somalie",
    ZA: "Afrique du Sud", KR: "Corée du Sud", ES: "Espagne", LK: "Sri Lanka",
    SD: "Soudan", SE: "Suède", CH: "Suisse", SY: "Syrie", TW: "Taïwan",
    TJ: "Tadjikistan", TZ: "Tanzanie", TH: "Thaïlande", TN: "Tunisie",
    TR: "Turquie", TM: "Turkménistan", UG: "Ouganda", UA: "Ukraine",
    AE: "Émirats arabes unis", GB: "Royaume-Uni", US: "États-Unis",
    UY: "Uruguay", UZ: "Ouzbékistan", VE: "Venezuela", VN: "Viêt Nam",
    YE: "Yémen", ZM: "Zambie", ZW: "Zimbabwe",
};

/** Returns the country name in the requested language, falling back to English. */
export function localizedName(country: Country, lang: Lang): string {
    if (lang === "de") return NAME_DE[country.iso] ?? country.name;
    if (lang === "fr") return NAME_FR[country.iso] ?? country.name;
    return country.name;
}

/**
 * True if the country matches the (already-lowercased) query in the user's
 * language, in English, by ISO code, or by dial code. Searching across all
 * three names lets a user type "Allemagne" or "Deutschland" or "Germany"
 * regardless of the UI language.
 */
export function countryMatches(country: Country, q: string): boolean {
    if (!q) return true;
    if (country.name.toLowerCase().includes(q)) return true;
    if (country.iso.toLowerCase().includes(q)) return true;
    if (NAME_DE[country.iso]?.toLowerCase().includes(q)) return true;
    if (NAME_FR[country.iso]?.toLowerCase().includes(q)) return true;
    const plus = q.replace(/^\+?/, "+");
    if (country.dial.includes(plus)) return true;
    if (country.dial.replace("+", "").includes(q.replace(/^\+/, ""))) return true;
    return false;
}

/** Localized UI strings used by the FlagPhone control. */
export const STRINGS: Record<Lang, {
    placeholder: string;
    search: string;
    empty: string;
    phoneAria: string;
    invalidNumber: string;
    tooShort: string;
    tooLong: string;
}> = {
    en: {
        placeholder: "Phone number",
        search: "Search country or code…",
        empty: "No country found",
        phoneAria: "Phone number",
        invalidNumber: "Invalid phone number",
        tooShort: "Number is too short",
        tooLong: "Number is too long",
    },
    de: {
        placeholder: "Telefonnummer",
        search: "Land oder Vorwahl suchen…",
        empty: "Kein Land gefunden",
        phoneAria: "Telefonnummer",
        invalidNumber: "Ungültige Telefonnummer",
        tooShort: "Nummer ist zu kurz",
        tooLong: "Nummer ist zu lang",
    },
    fr: {
        placeholder: "Numéro de téléphone",
        search: "Rechercher pays ou indicatif…",
        empty: "Aucun pays trouvé",
        phoneAria: "Numéro de téléphone",
        invalidNumber: "Numéro de téléphone invalide",
        tooShort: "Le numéro est trop court",
        tooLong: "Le numéro est trop long",
    },
};

export function flagEmoji(iso: string): string {
    if (!iso || iso.length !== 2) {
        return "🏳"; // white flag fallback
    }
    const upper = iso.toUpperCase();
    const codePoints = [
        0x1F1E6 + (upper.charCodeAt(0) - 65),
        0x1F1E6 + (upper.charCodeAt(1) - 65),
    ];
    return String.fromCodePoint(codePoints[0], codePoints[1]);
}

export function findCountryByIso(iso: string): Country | undefined {
    if (!iso) return undefined;
    const upper = iso.toUpperCase();
    return countries.find(c => c.iso === upper);
}

// Pre-sort once at module load; parsePhone runs on every host update,
// allocating + sorting 150 entries per call shows up as input lag.
const COUNTRIES_BY_DIAL_DESC = [...countries].sort(
    (a, b) => b.dial.length - a.dial.length,
);

/**
 * Parse a stored phone value (e.g. "+491234567" or "0049 1234 567") into
 * a country and a national subscriber number. Picks the longest matching
 * dial prefix; falls back to the supplied default ISO if no match.
 */
export function parsePhone(
    value: string | null | undefined,
    fallbackIso: string,
): { iso: string; national: string } {
    const fallback = findCountryByIso(fallbackIso) ?? findCountryByIso(DEFAULT_ISO)!;
    if (!value) {
        return { iso: fallback.iso, national: "" };
    }

    let normalized = value.replace(/[\s\-().]/g, "");
    if (normalized.startsWith("00")) {
        normalized = "+" + normalized.slice(2);
    }

    if (normalized.startsWith("+")) {
        const digits = normalized.slice(1);
        for (const c of COUNTRIES_BY_DIAL_DESC) {
            const code = c.dial.slice(1);
            if (digits.startsWith(code)) {
                return { iso: c.iso, national: digits.slice(code.length) };
            }
        }
        return { iso: fallback.iso, national: digits };
    }

    return { iso: fallback.iso, national: normalized.replace(/\D/g, "") };
}
