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
        const sorted = [...countries].sort((a, b) => b.dial.length - a.dial.length);
        for (const c of sorted) {
            const code = c.dial.slice(1);
            if (digits.startsWith(code)) {
                return { iso: c.iso, national: digits.slice(code.length) };
            }
        }
        return { iso: fallback.iso, national: digits };
    }

    return { iso: fallback.iso, national: normalized.replace(/\D/g, "") };
}
