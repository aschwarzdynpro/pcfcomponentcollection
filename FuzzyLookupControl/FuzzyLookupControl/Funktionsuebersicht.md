# FuzzyLookupControl — Funktionsübersicht

**Kurzbeschreibung:** PCF-Field-Control für Dataverse-Lookup-Spalten
(`Lookup.Simple`). Drop-in-Ersatz für das Standard-Lookup-Control im
Model-Driven-App-Formular. Nutzt **Dataverse Search** (Azure Cognitive Search)
für tippfehler-tolerante Vorschläge, rendert jeden Treffer als **Karte**
(konfigurierte Primärspalte als Titel, bis zu drei weitere Spalten als
Untertitel-Zeilen darunter) und unterstützt direkte Datensatzanlage über
**Quick-Create**. Architektur-Hooks für **Favoriten** und **Zuletzt
verwendet** sind enthalten (in v1 abschaltbar; finale UI-Politur folgt in v2).

## Funktionen

### Fuzzy-Suche via Dataverse Search

- Aufruf von `POST {clientUrl}/api/data/v9.2/searchquery` mit Lucene-Syntax
- Jeder Suchbegriff bekommt ein angehängtes `~` (Edit-Distanz bis 2). Damit
  matchen `Mitcrosoft`, `Mircosoft` und `Microsoft` alle den gleichen
  Datensatz.
- Begriffe mit weniger als 4 Zeichen bleiben exakt — Fuzzy auf kurzen Tokens
  produziert zu viel Rauschen.
- `besteffortsearchenabled = true` aktiviert die automatische Spell-Correction
  der Search-Engine (z. B. wenn der ganze Begriff offensichtlich falsch
  geschrieben ist).
- Debounce 200 ms; Mindestlänge 2 Zeichen; vorherige Suchen werden
  per `AbortController` abgebrochen, wenn der Benutzer weitertippt.
- Eine einzige API-Anfrage liefert sämtliche konfigurierten Spalten zurück —
  kein Sekundär-Roundtrip nötig (über `entities[].selectColumns`).
- **Highlights:** Dataverse Search markiert die gefundenen Fragmente mit
  `{crmhit}…{/crmhit}`-Tags; das Control rendert diese HTML-sicher in
  `<mark>`-Tags um.

### Karten-Layout für Treffer

- Jeder Treffer wird als eigenständige Karte gerendert — nicht als
  Tabellenzeile mit mehreren Spalten.
- Properties `column1` … `column4` nehmen logische Spaltennamen entgegen:
  - `column1` ist die **Titel-Zeile** der Karte (fett, primärfarben).
    Leer → das Primärnamen-Attribut der Ziel-Tabelle wird automatisch
    vorgezogen (per `Utility.getEntityMetadata`).
  - `column2` … `column4` werden als **Untertitel-Zeilen** untereinander
    unter dem Titel angezeigt (12 px, gedämpfte Farbe). Leere Properties
    werden komplett ausgeblendet, ebenso Zeilen für die der konkrete
    Datensatz keinen Wert enthält — eine fehlende `productnumber`
    erzeugt also keine leere Zeile.
- Links neben jeder Karte erscheint — falls in der Entity-Metadata
  hinterlegt — das Tabellen-Icon (`IconVectorName`-Webresource).
- Lange Werte (z. B. zusammengesetzte Artikelnummern) brechen in eine
  zweite Zeile um, statt mitten im Token abgeschnitten zu werden.
- Werte werden — wenn vorhanden — über das Feld
  `<col>@OData.Community.Display.V1.FormattedValue` gerendert
  (Lookup-Anzeigenamen, Choice-Labels, Datumswerte sehen damit identisch
  zu OOB aus).
- Die Dropdown-Breite ist für das schmale Karten-Layout optimiert:
  Min 360 px, Max 480 px (Desktop), Mobile edge-to-edge.

### Quick-Create („+ Neu")

- Footer-Button im Dropdown öffnet die Quick-Create-Maske der Ziel-Tabelle
  via `context.navigation.openForm({ useQuickCreateForm: true })`.
- Nach Speichern wird der neue Datensatz als ausgewählter Wert ins Formular
  übernommen und der Lookup verbindet sich automatisch.
- Standardmäßig **aktiv**; abschaltbar per Property `enableQuickCreate`.

### Favoriten (v1 Hook, v2 final)

- Property `enableFavorites` blendet eine Pin-Spalte in jeder Treffer-Zeile
  ein.
- Pinned-Records erscheinen als eigene Section über den Suchtreffern (sobald
  das Feld leer ist).
- Persistenz pro Benutzer im Browser-`localStorage` unter
  `wal_fuzzylookup_fav_{userId}_{entity}` — kein Schema-Footprint.
- Maximal 20 Favoriten pro Tabelle und Benutzer.

### Zuletzt verwendet (v1 Hook, v2 final)

- Property `enableRecentlyUsed` aktiviert eine Section mit den letzten
  8 ausgewählten Datensätzen.
- Persistenz pro Benutzer im Browser-`localStorage` unter
  `wal_fuzzylookup_mru_{userId}_{entity}`.
- Erscheint nur, wenn das Suchfeld leer ist.

### Fallback ohne Dataverse Search

- Wenn `searchquery` einen Fehler liefert (404/403, Tabelle nicht
  indexiert, Search im Environment deaktiviert), wechselt das Control
  automatisch auf einen `retrieveMultipleRecords`-Aufruf mit
  `contains()`-Filter über alle konfigurierten Spalten.
- Im Dropdown erscheint ein gelber Hinweis-Banner, der den Maker auf die
  fehlende Search-Aktivierung hinweist (lokalisiert).
- OData-Apostrophe (`O'Reilly`) werden korrekt escapiert.

### Quick-View-Formular als Vorschau-Quelle (optional)

- Über die neue Property `previewFormId` kann der Maker die GUID eines
  vorhandenen **Quick-View-Formulars (QVF)** der Ziel-Tabelle angeben.
- Beim Long-Press auf eine Karte rendert das Vorschau-Modal dann die im
  QVF definierten Felder — inklusive Abschnitten, Feld-Labels und
  Anzeigereihenfolge — mit frisch abgerufenen Live-Werten, statt nur der
  4 Such-Spalten der Karte.
- Bedienung für den Maker: QVF im Maker-Portal entwerfen, `formid` aus
  der URL kopieren, in `previewFormId` einfügen. Leere Property →
  Standard-Vorschau (konfigurierte Spalten) wie bisher.
- Die QVF-Metadaten werden **einmal pro Browser-Session** geholt
  (Cache nach `formId`), nur der eigentliche Datensatz-Fetch passiert
  bei jedem Öffnen — also schnell und sparsam.
- Robustheit: ungültige GUID, falsche Ziel-Entity oder Fehler beim
  Fetch → das Modal fällt **stillschweigend** auf die Spalten-Vorschau
  zurück und schreibt eine Warnung in die Browser-Console.
- Formatierte Werte werden bevorzugt
  (`@OData.Community.Display.V1.FormattedValue`): Lookups erscheinen mit
  Primärnamen, Auswahlfelder mit Label, Datumswerte im User-Format.
- Bewusste Designentscheidung: wir **iframen** das Microsoft-eigene
  Quick-View-Rendering NICHT. Das QVF dient nur als Metadaten-Quelle —
  gerendert wird im eigenen Modal mit konsistentem Card-Theme. Vorteile:
  funktioniert in Dialogen / Side-Panels (keine Auth-Kontext-Brüche),
  spart ~200–500 kB JS pro Öffnen, kein CSS-Konflikt mit dem
  UCI-Renderer.

### Touch-Gesten (Mobile / Tablet, Außendienst)

Auf Touch-Geräten greifen zwei native Mobile-Gesten, die per Pointer-Events-API
implementiert sind (funktioniert gleichermaßen mit Finger, Pen und Maus):

| Geste                                  | Effekt                                                                                                                                                                                                                                                                                                                                                                                |
|----------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Wischen nach rechts** auf einer Karte | Favorit umschalten (anpinnen / entfernen). Die Karte folgt dem Finger; jenseits ~72 px Wischweite löst die Aktion beim Loslassen aus, dann schnappt die Karte zurück. Der enthüllte Hintergrundstreifen ist orange beim Anpinnen, grau beim Entfernen. Nur aktiv, wenn `enableFavorites` an ist.                                                                                       |
| **Lange drücken** (~500 ms) auf einer Karte | Öffnet eine **Vorschau-Modal** mit allen konfigurierten Spalten **ungekürzt** und mit voll lesbaren Zeilenumbrüchen, plus „Diesen Datensatz wählen"-Button im Footer. Praktisch bei zusammengesetzten Artikelnummern, die in der Kartenansicht umbrechen — der Monteur kann den vollen String in Ruhe lesen, bevor er übernimmt. Backdrop-Tap, × oder Escape schließen die Vorschau. |

Vertikales Scrollen wird **nie** unterbrochen: die Wisch-Geste committet sich
erst, wenn die horizontale Bewegung die vertikale deutlich dominiert. Der
Long-Press-Timer wird abgebrochen, sobald der Finger sich mehr als eine
Fingerspitze bewegt — versehentliches Halten beim Scrollen löst also keine
Vorschau aus.

### Tastatur & Bedienung

| Taste            | Aktion                                |
|------------------|---------------------------------------|
| `↓` / `↑`        | Treffer wählen                        |
| `Enter`          | Markierten Treffer übernehmen         |
| `Esc`            | Dropdown schließen                    |
| Klick auf Chip   | Ausgewählten Datensatz öffnen          |
| `×` auf Chip     | Auswahl zurücksetzen                  |

### Mehrsprachigkeit (DE / EN / FR)

- Wird automatisch aus der User-Sprache (`userSettings.languageId`) abgeleitet
- Übersetzt sind: Placeholder, Status-Texte („Suche läuft", „Keine Treffer"),
  Section-Headers (Favoriten / Zuletzt verwendet / Treffer), Tooltips,
  Quick-Create-Label, Fallback-Banner.

## Konfigurations-Properties

| Property              | Pflicht | Beschreibung                                                                                                                                  |
|-----------------------|---------|-----------------------------------------------------------------------------------------------------------------------------------------------|
| `selectedItem`        | ja      | Gebundene Lookup-Spalte (`Lookup.Simple`). Ziel-Tabelle wird automatisch übernommen.                                                            |
| `column1`             | nein    | Logischer Name der ersten Vorschlagsspalte. Leer → Primärnamen-Attribut der Ziel-Tabelle.                                                       |
| `column2` … `column4` | nein    | Weitere Vorschlagsspalten. Leer → ausgeblendet.                                                                                                |
| `pageSize`            | nein    | Maximale Trefferanzahl je Suche. 1 bis 50; Default 25.                                                                                          |
| `placeholder`         | nein    | Platzhaltertext im Eingabefeld (überschreibt die lokalisierte Vorgabe).                                                                         |
| `enableQuickCreate`   | nein    | Boolean. `+ Neu`-Button anzeigen. Default `true`.                                                                                              |
| `enableFavorites`     | nein    | Boolean. Favoriten-Section + Pin-Button anzeigen. Default `false`.                                                                             |
| `enableRecentlyUsed`  | nein    | Boolean. „Zuletzt verwendet"-Section anzeigen. Default `false`.                                                                                |

## Voraussetzungen im Ziel-Environment

Damit der primäre Suchpfad aktiv ist:

1. **Power Platform Admin Center → Environment → Settings → Product →
   Features → Dataverse Search** muss **eingeschaltet** sein.
2. Für jede Ziel-Tabelle: Maker-Portal öffnen,
   **Properties → Advanced options → Can be found in search** aktivieren.
3. Nach Aktivierung dauert die Indexierung neuer Datensätze ein paar Minuten.

Ohne aktive Dataverse Search funktioniert das Control trotzdem, fällt aber
auf `retrieveMultipleRecords` mit `contains()` zurück (kein Fuzzy).

## Technisches

- **Stack:** React 17 + TypeScript, Build über `pcf-scripts`
- **Such-Engine:** Dataverse Search (`searchquery`), Lucene-Querytype,
  Trailing-`~` für Fuzzy, `besteffortsearchenabled` für Spell-Correction
- **Fallback:** `context.webAPI.retrieveMultipleRecords` mit
  OR-ver`contains()`-Filter
- **Storage:** `window.localStorage` für Favoriten + MRU; kein Schema-Footprint
- **Sicherheit:** `dangerouslySetInnerHTML` wird ausschließlich mit
  HTML-escapten Strings befüllt — `{crmhit}…{/crmhit}` bzw.
  Term-Hervorhebung werden in einem dedizierten Highlighter-Modul HTML-sicher
  transformiert
- **Solution-Version:** `1.0.0.0`, **Control-Version:** `1.0.0`,
  Publisher `HerbertWaldmann`, Prefix `wal`
- **Unique Name:** `wal_Lookup.FuzzyLookupControl`

## Bekannte Einschränkungen

- **Nur Simple-Lookups:** Polymorphe Lookups (`Customer`, `Owner`,
  `Regarding`, MultiTable) werden in v1 nicht unterstützt — die exponieren
  Property-Typen, die das Manifest mit einer einzelnen `Lookup.Simple`-Bindung
  nicht abdecken kann.
- **Indexierungslatenz:** Nach Anlage eines Datensatzes per Quick-Create
  dauert es typischerweise einige Minuten, bis dieser per Dataverse Search
  auffindbar ist. Der ausgewählte Datensatz wird trotzdem sofort im
  Formular gesetzt — die Verzögerung betrifft nur die Auffindbarkeit für
  künftige Suchen.
- **Favoriten/MRU sind browser-lokal:** Pro-Gerät-Persistenz; Cross-Device-Sync
  ist v2-Thema (geplante Anbindung an eine Dataverse-Tabelle).

## Roadmap (v2)

- Finale Favoriten/MRU-UI mit Bulk-Management und Cross-Device-Sync
- **System-View-Anbindung:** Quick-Find- oder Saved-View als Quelle für
  Spalten, Filter und Sortierung — eliminiert die manuelle
  Spalten-Konfiguration
- Polymorphe Lookups (`Customer`, `Owner`, `Regarding`, MultiTable)
