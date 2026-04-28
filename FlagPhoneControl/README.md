# FlagPhoneControl

A modern, React-based Power Apps Component Framework (PCF) control for Dataverse
phone-number fields (Format Type = **Phone Number**). It splits the input into a
country selector (flag + dial code) and the subscriber number, and persists a
single canonical E.164-style string to Dataverse, e.g. `+491761234567`.

## ✨ Features

### 🎯 Core Functionality
- **Country selector** with inline SVG flag and international dial code
- **Subscriber-number input** restricted to digits and common separators
- **Round-trips existing values**: parses `+49…`, `0049…`, or local digits via
  longest-prefix matching on the dial code
- **Configurable default country** via ISO 3166-1 alpha-2 code (e.g. `DE`)
- **Honours form state**: respects disabled / read-only mode
- **E.164-style storage**: writes a single canonical `+<dialcode><digits>`
  string back to Dataverse; clears to `undefined` when emptied

### 🌐 Internationalization
- **Trilingual UI**: country names and labels in **German**, **English**,
  **French**, picked automatically from the user's Dataverse language
  (`context.userSettings.languageId`)
- **Cross-language search**: typing `Germany`, `Deutschland`, or `Allemagne`
  all match the same country, regardless of the UI language
- **Localized placeholder, search hint and empty state**

### 🎨 Visual Features
- **Real SVG flags** bundled inline (~250 countries via
  [`country-flag-icons`](https://www.npmjs.com/package/country-flag-icons)) —
  no CDN dependency, works in air-gapped tenants
- **Searchable dropdown** with filter across country name, ISO code, and dial
  code
- **Portaled popover**: dropdown is rendered into `document.body` to escape
  `overflow: hidden` ancestors common on model-driven form sections
- **Modern Fluent-UI-style** look with focus ring, hover states, and tabular
  numerals for dial codes
- **Tooltip** with the localized country name and dial code

### 🔧 Technical Features
- **React 17** + TypeScript
- **Echo-suppression** via `lastEmittedRef` so fast typing isn't rewound by the
  host echoing back stale values
- **Memoized flag SVGs** (`React.memo`) — only the changing options re-render
  while the dropdown is open
- **Pre-sorted country lookup** for O(n) longest-prefix matching with no
  per-render allocations
- **Self-contained**: no external network calls, no third-party CDN

## 🚀 Component Structure

```
FlagPhoneControl/
├── components/
│   ├── FlagPhone.tsx              # Main React component
│   ├── Flag.tsx                   # ISO → SVG flag with emoji fallback
│   └── countries.ts               # Country list, parser, i18n tables
├── css/
│   └── FlagPhoneControl.css       # Styling
├── strings/
│   └── FlagPhoneControl.1033.resx # Resx for manifest-defined keys
├── generated/
│   └── ManifestTypes.d.ts         # Auto-generated property types
├── ControlManifest.Input.xml      # PCF manifest
├── index.ts                       # PCF entry point
├── package.json                   # Dependencies and scripts
└── tsconfig.json                  # TypeScript configuration
```

## 📋 Configuration Properties

| Property         | Type               | Usage  | Required | Description                                                               |
|------------------|--------------------|--------|----------|---------------------------------------------------------------------------|
| `phoneNumber`    | `SingleLine.Phone` | bound  | yes      | The Dataverse phone-number column this control is bound to.               |
| `defaultCountry` | `SingleLine.Text`  | input  | no       | ISO 3166-1 alpha-2 country code used when the value is empty (e.g. `DE`). |
| `placeholder`    | `SingleLine.Text`  | input  | no       | Placeholder text for the subscriber-number input. Overrides the localized default. |

## 🎮 User Interface Features

### Trigger button
- Inline SVG flag of the active country
- International dial code (e.g. `+49`)
- Tooltip with the localized country name
- Caret indicator showing the dropdown can be opened

### Dropdown popover
- Search box (auto-focused on open) — filters by name, ISO, or dial code
- One row per country: flag · localized name · ISO · dial code
- Selected country highlighted; hover state for the focused row
- Empty state when the search returns no matches
- Closes on outside click or after selection

### Subscriber-number input
- Accepts digits and common separators (`space`, `-`, `(`, `)`, `.`)
- Stores only digits in the bound field
- Localized placeholder (`Phone number` / `Telefonnummer` / `Numéro de téléphone`)

## 🌐 Language Detection

The display language is derived from the user's Dataverse profile language via
`context.userSettings.languageId` (an LCID). The lower 10 bits identify the
primary language:

| Primary ID | Language | Mapped to |
|------------|----------|-----------|
| `0x07`     | German (any region: DE, AT, CH, LU, LI) | `de` |
| `0x0C`     | French (any region: FR, BE, CA, CH, LU, MC) | `fr` |
| anything else | — | `en` (fallback) |

Country names that have no translation in the active language fall back to the
English name.

## 📞 Stored Format

The bound column receives a single string of the form `+<dialcode><digits>`,
without spaces or other separators:

| User input                       | Stored value      |
|----------------------------------|-------------------|
| Country `DE`, number `1761234567`| `+491761234567`   |
| Country `US`, number `(415) 555-0123` | `+14155550123` |
| Subscriber number cleared        | `undefined` (column emptied) |

When loading an existing value, the parser:
1. Strips spaces and common separators (`- ( ) .`).
2. Normalizes a leading `00` to `+` (e.g. `004917…` → `+4917…`).
3. Performs **longest-prefix matching** against the dial-code list, so
   `+1xxxxxxxxxx` resolves to the United States (and `+12509…` to Canada).
4. Falls back to `defaultCountry` if no prefix matches.

## 🛠️ Development

### Prerequisites
- Node.js 14+
- npm
- Power Platform CLI (`pac`) for solution packing

### Build commands

```bash
cd FlagPhoneControl

# Install dependencies
npm install

# Production build (minified, output in out/controls/)
npm run build -- --buildMode production

# Local test harness
npm start

# Clean build artifacts
npm run clean

# Rebuild from scratch
npm run rebuild
```

The Dataverse-importable solution is built from a sibling project; see
[`../FlagPhoneControl.Solution/README.md`](../FlagPhoneControl.Solution/README.md)
and run `./build.ps1` there.

## 🔧 Integration

### Adding to a model-driven form
1. Build and pack the control into a solution (`FlagPhoneControl.Solution/build.ps1`).
2. Import the solution zip into your target environment.
3. On the target table's form, select the phone-number column and choose
   **+ Component** → **FlagPhoneControl**.
4. *(Optional)* Set `defaultCountry` (e.g. `DE`) and a custom `placeholder`.
5. Save and publish the form.

### Reading the value programmatically
Because the column stores a plain canonical string, it is consumable as-is by
flows, plug-ins, and `Xrm.WebApi`. No special parsing on the consumer side is
required — the value is always either `undefined` or `+<digits>`.

## 🌐 Browser Support

- Microsoft Edge (latest)
- Google Chrome (latest)
- Mozilla Firefox (latest)
- Safari (latest)

The control is fully functional inside the Unified Interface on Windows, macOS,
iOS, and Android.

## 📊 Performance Notes

- **Echo-suppression**: the local input is never re-parsed when the bound value
  is just our own emit being echoed back, so fast typing never produces visible
  rewinds.
- **Memoized flag SVGs**: each row's flag re-uses its rendered SVG across
  re-renders.
- **Module-scoped sort**: the dial-code lookup is sorted exactly once, not on
  every keystroke.
- **Bundle size**: ~377 KB (production, minified) including all ~250 inline
  flag SVGs.

## 🐛 Troubleshooting

| Symptom                                                | Likely cause / fix |
|--------------------------------------------------------|--------------------|
| Country shows but no flag image                        | Country's ISO code isn't in the bundled flag set — the control falls back to a Unicode flag emoji. Add a custom mapping if needed. |
| Dropdown clipped to the field width                    | An ancestor container has `overflow: hidden`. The dropdown is portaled to `document.body`, but a focus-trap or sibling `position: fixed` container can still cover it. Re-check stacking context. |
| Country name appears in English for a French/German user | The user's `languageId` doesn't resolve to `0x07` or `0x0C`. Confirm the personal language setting in **Settings → Personalization Settings → Languages**. |
| Stored value contains old separators                   | A pre-existing value was migrated from a free-text field. Open and save the record once — the control will re-emit a clean canonical string. |

### Debug

Enable browser dev tools and check the console for warnings. The control logs
nothing in normal operation; any error there belongs to the host or to a
preceding control on the form.

## 📝 License

This component is licensed under the MIT License.

## 👥 Contributing

Contributions are welcome — please open a Pull Request with a clear description
of the change and any updates to the country list or translation tables.

---

*Part of the Power Platform PCF Component Collection.*
