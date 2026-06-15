# ChoicePickerControl — Funktionsübersicht

**Kurzbeschreibung:** PCF-Field-Control, das das Standard-Dataverse-Dropdown für
**Auswahl-Spalten** (`Choice` / `Choices`) durch ein modernes React-Dropdown
ersetzt. Dasselbe Control bindet sowohl an eine Einfachauswahl (`OptionSet`) als
auch an eine Mehrfachauswahl (`MultiSelectOptionSet`) — der Typ wird zur Laufzeit
erkannt. Mit Choice-Farben, Suche, entfernbaren Chips und vollständiger
Tastatur-Bedienung.

## Funktionen

### Auswahl & Speicherung
- **Ein Control für beide Choice-Typen** — bindet über eine Manifest-`type-group`
  an `OptionSet` (Einfachauswahl) **und** `MultiSelectOptionSet`
  (Mehrfachauswahl)
- **Automatische Erkennung** Single vs. Multi; per Property `selectionMode`
  überschreibbar (`auto` / `single` / `multiple`)
- Speichert kanonisch über die gebundene Spalte: `getOutputs()` liefert eine
  einzelne `number` (Single) bzw. ein `number[]` (Multi) — kein zusätzliches
  Mapping nötig
- Auswahl-Reihenfolge folgt immer der in Dataverse definierten Options-Reihenfolge
  (nicht der Klick-Reihenfolge)

### Darstellung
- **Dataverse-Choice-Farben** werden als Punkt (Single) bzw. getönter Chip
  (Multi) gerendert
- Choices ohne konfigurierte Farbe erhalten eine stabile Fallback-Palettenfarbe,
  damit das Dropdown immer farbig wirkt (per `colorMode = off` abschaltbar)
- **Chips** für die Mehrfachauswahl, jeder Chip einzeln über ein „×" entfernbar
- Dropdown-Footer (nur Multi) mit **Alle auswählen** und **Leeren**
- Animierter Caret (Pfeil dreht beim Öffnen), Pop-In-Dropdown, Chip-Einblendung —
  respektiert `prefers-reduced-motion` und High-Contrast / Forced-Colors

### Suche & Bedienung
- **Suchfeld** im Dropdown — erscheint automatisch ab 8 Optionen
  (`searchBox`: `auto` / `always` / `never`), filtert case-insensitiv über das
  Label
- **Vollständige Tastatur-Navigation**: Öffnen mit `Enter` / `Leertaste` / `↓`,
  navigieren mit `↑ ↓ Pos1 Ende`, übernehmen mit `Enter`, schließen mit `Esc`;
  die aktive Option wird automatisch in den sichtbaren Bereich gescrollt
- **Inline-Clear-Button** (×) zum Zurücksetzen der gesamten Auswahl
  (`clearButton`: `on` / `off`)
- **Portaliertes Dropdown** (`document.body` + `position: fixed`) — wird nie von
  Quick-Create-Panels, BPF-Flyouts, Dialogen oder `overflow:hidden`-Containern
  abgeschnitten; bleibt bei Scroll/Resize korrekt unter dem Feld verankert

### Mehrsprachigkeit (DE / EN / FR)
- Wird automatisch aus der User-Sprache (`userSettings.languageId`) abgeleitet
- Übersetzt sind: Platzhalter, Suchhinweis, „Keine Treffer", Chip-Entfernen-Label,
  „Alle auswählen" / „Leeren", Tooltips / `aria-label`s
- Die Choice-**Labels** selbst kommen aus Dataverse und sind damit bereits in der
  Benutzersprache vorhanden

## Konfigurations-Properties

| Property        | Pflicht | Beschreibung |
|-----------------|---------|--------------|
| `selectedValue` | ja      | Gebundene Auswahl-Spalte (`Choice` oder `Choices`) |
| `selectionMode` | nein    | `auto` (Standard, erkennt den Spaltentyp) / `single` / `multiple` |
| `placeholder`   | nein    | Eigener Platzhaltertext (überschreibt die lokalisierte Vorgabe „Auswählen…") |
| `searchBox`     | nein    | `auto` (Standard, ab 8 Optionen) / `always` / `never` |
| `colorMode`     | nein    | `on` (Standard) / `off` — Choice-Farben anzeigen |
| `clearButton`   | nein    | `on` (Standard) / `off` — Inline-Clear-Button (×) anzeigen |

## Technisches

- **Stack:** React 17 + TypeScript, Build über `pcf-scripts`
- **Bundle:** ~137 KB minified (React 17 + Control), keine externen
  CDN-/Internet-Abhängigkeiten — funktioniert in air-gapped Tenants
- **type-group:** Die gebundene Property nutzt eine `type-group`
  (`OptionSet` + `MultiSelectOptionSet`). `pcf-scripts` generiert dafür den
  Basistyp `Property` (`raw: any`, Output `any`); das Control liest `raw`,
  `attributes.Options` (Label / Value / **Color**) und den Laufzeit-`type` über
  eine getypte Sicht in `index.ts`.
- **Solution-Version:** `1.0.0.0`, **Control-Version:** `1.0.0`,
  Publisher `HerbertWaldmann`, Prefix `wal`
- **Unique Name:** `wal_ChoicePicker.ChoicePickerControl`

## Bekannte Einschränkungen

- Nur **Choice** / **Choices**-Spalten. `Two Options` (Boolean) und `Lookup`
  sind nicht im Scope (für Lookups gibt es das FuzzyLookupControl).
- Erkennt `auto` bei einem **leeren** Mehrfachauswahl-Feld den Typ nicht korrekt
  (host-/build-abhängiger Laufzeit-`type`-String), kann `selectionMode = multiple`
  gesetzt werden — die Auto-Erkennung greift bei befülltem Feld immer zuverlässig.
- Das Control respektiert den Read-only-/Disabled-Zustand des Feldes
  (`mode.isControlDisabled`); im gesperrten Zustand sind Auswahl, Chip-Entfernen
  und Clear deaktiviert.
