# FlagPhoneControl — Funktionsübersicht

**Kurzbeschreibung:** PCF-Field-Control für Dataverse-Telefonnummern-Spalten
(`SingleLine.Phone`). Ersetzt das Standard-Eingabefeld durch eine
Länder-Auswahl mit Flagge + Vorwahl plus separates Eingabefeld für die
Rufnummer. Gespeichert wird der Wert kanonisch im E.164-Stil
(`+491761234567`).

## Funktionen

### Eingabe & Speicherung
- Länder-Picker mit echtem SVG-Flaggen-Icon, Landeskürzel und internationaler Vorwahl
- Suchbares Dropdown — filtert über Ländername (DE/EN/FR), ISO-Code und Vorwahl
- Eingabefeld für die Rufnummer, akzeptiert Ziffern und übliche Trennzeichen
  (Leerzeichen, `-`, `( )`, `.`)
- Speichert immer kanonisch als `+<Vorwahl><Ziffern>` ohne Trennzeichen —
  Plug-Ins/Flows können den Wert ohne Parsing weiterverarbeiten
- Round-Trip mit Bestandsdaten: Werte wie `+49…`, `0049…` oder lokale
  Ziffernfolgen werden beim Laden automatisch geparst (Longest-Prefix-Matching
  auf der Vorwahl)

### Validierung
- Live-Validierung über `libphonenumber-js` (gleiche Engine wie intl-tel-input)
- Fehler werden erst beim Verlassen des Feldes (Blur) sichtbar — nicht
  während des Tippens
- Drei Fehlerstufen lokalisiert: ungültige Nummer, zu kurz, zu lang
- Visuelles Feedback: rote Border + Fehlertext bei Ungültigkeit, grünes
  Häkchen bei Gültigkeit
- Speicherung wird **nicht** blockiert — Phone-Felder erlauben in Power Apps
  generell jedes Format; serverseitige Validierung muss bei Bedarf separat
  erfolgen

### Click-to-Dial
- Kleiner Telefon-Icon-Button rechts neben dem Eingabefeld
- Bei Klick wird die kanonische `tel:+<Vorwahl><Ziffern>`-URL via
  `context.navigation.openUrl` aufgerufen
- Auf Mobile öffnet sich der native Dialer; am Desktop springt der
  registrierte tel-Handler an (Microsoft Teams, Skype, Softphone-Client …)
- Bleibt **auch im read-only-Modus aktiv**, damit auf gesperrten Formularen
  weiterhin angerufen werden kann
- Lokalisierter Tooltip und `aria-label` (Anrufen / Call / Appeler), inklusive
  der Nummer, die angerufen wird
- Bei fehlendem Eingabe-Wert deaktiviert; Fallback auf `window.open(tel:…)`
  falls der Host die `openUrl`-API ablehnt

### Mehrsprachigkeit (DE / EN / FR)
- Wird automatisch aus der User-Sprache (`userSettings.languageId`) abgeleitet
- Übersetzt sind: Ländername im Dropdown, Platzhaltertexte, Suchhinweis,
  Fehlermeldungen, Tooltips, Call-Button-Label
- Suche funktioniert sprach-übergreifend: „Deutschland", „Germany" und
  „Allemagne" finden alle den gleichen Eintrag

### Vor-Auswahl des Landes
Reihenfolge, erste Treffer gewinnt (in der user-default-country-Erweiterung):

1. Form-Property `defaultCountry` (Maker-Override)
2. Persönliche User-Einstellung `usersettings.defaultcountrycode`
   (Personal Options → „Country/Region Code Prefix")
3. Aus der User-Sprache abgeleitet (z. B. de-CH → CH, en-US → US)
4. Hardcoded Fallback `DE`

Beide Konfigurationswerte (Form-Property und Personal Option) akzeptieren
ISO-Codes (`DE`) oder Vorwahlen (`+49`).

## Konfigurations-Properties

| Property         | Pflicht | Beschreibung |
|------------------|---------|--------------|
| `phoneNumber`    | ja      | Gebundene Phone-Spalte |
| `defaultCountry` | nein    | ISO-Code oder Vorwahl als Override (leer lassen, damit User-Setting greift) |
| `placeholder`    | nein    | Eigener Platzhaltertext (überschreibt die lokalisierte Vorgabe) |

## Technisches

- **Stack:** React 17 + TypeScript, Build über `pcf-scripts`
- **Bundle:** ~138 KB minified inkl. ~250 inline SVG-Flaggen
  (`country-flag-icons`) und `libphonenumber-js/min`
- **Keine externen CDN/Internet-Abhängigkeiten** — funktioniert in
  air-gapped Tenants
- **Solution-Version:** `1.0.6.0`, **Control-Version:** `1.0.6`,
  Publisher `HerbertWaldmann`, Prefix `wal`
- **Unique Name:** `wal_FlagPhone.FlagPhoneControl`

## Bekannte Einschränkungen

- iOS Safari: Drag-and-Drop von Mobile aus eingeschränkt (HTML5 DnD-Limitierung;
  UI-Bedienung funktioniert)
- Click-to-Dial benötigt einen am System registrierten `tel:`-Handler.
  Ohne Teams/Skype/Softphone und ohne Mobile-Dialer passiert nach dem Klick
  nichts Sichtbares — das ist Browser-Verhalten, nicht des Controls
- Choice-Vorwahlen mit Mehrfach-Mapping (z. B. `+1` für US/CA/etc.) werden
  über die User-LCID disambiguiert; bei fehlender LCID wird der erste Treffer
  aus der internen Liste verwendet
