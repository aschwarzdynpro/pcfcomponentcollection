# FuzzyLookupControl — Funktionsübersicht

**Kurzbeschreibung:** PCF-Field-Control für Dataverse-Lookup-Spalten
(`Lookup.Simple`). Drop-in-Ersatz für das Standard-Lookup-Control im
Model-Driven-App-Formular. Nutzt **Dataverse Search** (Azure Cognitive Search)
für tippfehler-tolerante Vorschläge, rendert jeden Treffer als **Karte**
(konfigurierte Primärspalte als Titel, bis zu drei weitere Spalten als
Untertitel-Zeilen darunter) und unterstützt direkte Datensatzanlage über
**Quick-Create**. Ein optionaler **Zusatzfilter** mit Laufzeit-Tokens
ersetzt die Vorsuche-Filterung, die das Standard-Lookup unter einem Custom
Control verliert. Auf Touch-Geräten pinnt **Wischen nach rechts** einen
Favoriten, **langes Drücken** öffnet eine Vorschau — auf Wunsch gespeist aus
einem **Quick-View-Formular**. Architektur-Hooks für **Favoriten** und
**Zuletzt verwendet** sind enthalten (in v1 abschaltbar; finale UI-Politur
folgt in v2).

## Funktionen

### Fuzzy-Suche via Dataverse Search

- Aufruf von `POST {clientUrl}/api/data/v9.2/searchquery` mit Lucene-Syntax
- Jeder durch Leerzeichen getrennte Suchbegriff bekommt bis zu drei
  Match-Strategien, die innerhalb des Begriffs mit OR verknüpft werden:

  | Strategie | Form | Fängt ab |
  |-----------|------|----------|
  | Präfix-Wildcard | `token*` | Typeahead — `nym*` findet `Nymphenburg`. |
  | Fuzzy | `token~` (nur ab 4 Zeichen) | Tippfehler — `mitcrosoft~` findet `Microsoft`. Kurze Tokens bleiben exakt, dort matcht Edit-Distanz 2 praktisch alles. |
  | Infix-Regex | `/.*token.*/` | Teilstrings **innerhalb** eines indexierten Tokens — die Suche nach `810` findet die Artikelnummer `15012810`, was reines Präfix-Matching verfehlt. |

- Die Begriffs-Gruppen werden über `searchmode: "all"` mit AND verknüpft:
  jeder Begriff muss **irgendwo** im Datensatz vorkommen, aber nicht in
  derselben Spalte. `NYM 2211` findet also die Zeile, in der `NYM` im Namen
  und `2211` in der Artikelnummer steht.
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

### Dropdown-Platzierung & Such-Feedback

- Die Trefferliste wird in einem React-Portal unter `document.body` mit
  `position: fixed` gerendert. Grund: Quick-Create-Panels, BPF-Flyouts und
  Dialoge arbeiten mit `overflow: hidden`-Containern, die ein normal
  positioniertes Dropdown abschneiden würden. Der Anker wird bei Resize und
  bei jedem Scroll eines übergeordneten Containers neu berechnet.
- **Höhe:** begrenzt durch den tatsächlich verfügbaren Platz unterhalb des
  Feldes, nicht durch einen festen Wert. Ein Lookup am unteren Formularrand
  bekommt also eine kurze scrollbare Liste statt einer, die aus dem Bild
  läuft.
- **Flip nach oben:** ist unterhalb zu wenig nutzbarer Platz **und** oberhalb
  deutlich mehr, klappt das Dropdown nach oben auf. Default bleibt „unten"
  — wie beim OOB-Lookup.
- **Breite:** folgt dem Feld, auf dem Desktop begrenzt auf 360–480 px und bei
  Bedarf zurück in den Viewport geschoben; unterhalb des Mobile-Breakpoints
  edge-to-edge mit kleinem Rand.
- **Such-Spinner:** solange eine Suche läuft, dreht sich neben „Suche läuft…"
  ein CSS-Ring. Eine langsame `searchquery` sieht damit nach *Arbeit* aus und
  nicht nach eingefrorenem Dropdown. Bei `prefers-reduced-motion` steht der
  Ring still.

### Zusatzfilter (`additionalFilter`)

Die Property `additionalFilter` schränkt **jede** Suche auf eine Teilmenge
der Ziel-Tabelle ein — sie ersetzt den Vorsuche-Filter des Standard-Lookups,
der unter einem Custom Control nicht mehr greift. Geschrieben wird sie in
**OData-`$filter`-Syntax**; das Control verknüpft sie per AND mit der
Benutzereingabe, auf beiden Suchpfaden.

```
statecode eq 0
statecode eq 0 and _ownerid_value eq {user.id}
_msdyn_companyid_value eq {record.sst_company_ref}
```

**Laufzeit-Tokens** werden bei jeder Suche neu aufgelöst, der Filter folgt
also dem Formular, während der Benutzer es bearbeitet:

| Token | Wird aufgelöst zu |
|-------|-------------------|
| `{record.<spalte>}` | Wert von `<spalte>` im **aktuellen Formular** (via `Xrm.Page.getAttribute`). Lookups liefern die reine GUID (ohne Klammern, kleingeschrieben), Text den String, Choices den numerischen Wert. |
| `{user.id}` | `systemuserid` des angemeldeten Benutzers. |
| `{user.bu}` (Alias `{user.businessunit}`) | Business-Unit-ID des Benutzers. Wird einmal pro Session per `systemuser`-Abfrage ermittelt und gecacht. |

Lässt sich **ein einziger** Token nicht auflösen (Quellfeld leer, Attribut
nicht auf dem Formular, BU-Abfrage fehlgeschlagen), verwirft das Control den
**kompletten Filter** für diese Suche und schreibt eine `console.warn`. Das
ist Absicht: ein halb ersetzter Ausdruck wie `_ownerid_value eq ` erzeugt
kaputtes OData, und stilles Nichts-Liefern sähe nach einem Datenproblem statt
nach einem Konfigurationsfehler aus.

**Dialekt-Unterschied der beiden Suchpfade:** der Maker schreibt immer OData.
Der **OData-Fallback** nutzt den String unverändert. Der **Dataverse-Search-Pfad**
braucht eine andere Schreibweise und wird vorher umgeschrieben
(`odataFilterToSearchFilter()`):

- `_<spalte>_value` → `<spalte>`. Search will den reinen logischen Namen des
  Lookups; die OData-Annotation liefert HTTP 200 und **ignoriert den Filter
  stillschweigend** — der übelste Fehlerfall, weil die Ergebnisse plausibel
  aussehen, aber ungefiltert sind.
- Nackte GUIDs werden in einfache Anführungszeichen gesetzt, sonst antwortet
  Search mit HTTP 400 `0x80048d0b "invalid expression in the search query"`.

Zwei Punkte, die das Control nicht automatisch reparieren kann:

- Dataverse Search **akzeptiert den `not`-Operator nicht** — stattdessen `ne`
  verwenden.
- Nicht jede durchsuchbare Spalte ist auch *filterbar*. Liefert ein Filter
  ohne erkennbaren Grund null Treffer, das Filterable-Flag der Spalte im
  Suchindex prüfen.

**Der erweiterte Dialog wird nicht gefiltert:** die Lupe öffnet den nativen
`lookupObjects()`-Dialog der UCI, der **FetchXML** erwartet und kein OData —
`additionalFilter` lässt sich dorthin nicht durchreichen. Ist ein Filter
konfiguriert, schreibt das Control beim Öffnen eine `console.warn`, damit das
auffällt. Wenn der Filter fachlich wichtig ist: Benutzer auf die Inline-Suche
verweisen. Ein OData→FetchXML-Konverter ist v2-Thema.

### Quick-Create („+ Neu")

- Footer-Button im Dropdown öffnet die Quick-Create-Maske der Ziel-Tabelle
  via `context.navigation.openForm({ useQuickCreateForm: true })`.
- Nach Speichern wird der neue Datensatz als ausgewählter Wert ins Formular
  übernommen und der Lookup verbindet sich automatisch.
- Standardmäßig **aktiv**; abschaltbar per Property `enableQuickCreate`.

### Favoriten (v1 Hook, v2 final)

- Property `enableFavorites` blendet am rechten Rand jeder Treffer-Karte
  einen Pin-Button ein (auf Touch zusätzlich per Wisch-Geste erreichbar).
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

- Wenn `searchquery` einen Fehler **wirft** (404/403, Tabelle nicht
  indexiert, Search im Environment deaktiviert, kaputter Envelope), wechselt
  das Control automatisch auf einen `retrieveMultipleRecords`-Aufruf mit
  `contains()`-Filter über alle konfigurierten Spalten.
- Im Dropdown erscheint ein gelber Hinweis-Banner, der den Maker auf die
  fehlende Search-Aktivierung hinweist (lokalisiert).
- **Antwortet Search sauber mit null Treffern** (HTTP 200, kein Fehler im
  Envelope), wird diese Antwort akzeptiert: das Dropdown zeigt „Keine
  Treffer", es läuft **kein** OData-Nachschlag. Der frühere Nachschlag hat
  das „Search nicht verfügbar"-Banner auch dann gezeigt, wenn Search
  einwandfrei lief und schlicht nichts zu liefern hatte.
- Der Fallback verknüpft die Begriffe genauso wie der Search-Pfad: innerhalb
  eines Begriffs OR über alle konfigurierten Spalten, zwischen den Begriffen
  AND. Ein konfigurierter `additionalFilter` wird zusätzlich per AND
  angehängt.
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
| **Lange drücken** (~500 ms) auf einer Karte | Öffnet eine **Vorschau-Modal** mit allen konfigurierten Spalten **ungekürzt** und mit voll lesbaren Zeilenumbrüchen, plus „Diesen Datensatz wählen"-Button im Footer. Praktisch bei zusammengesetzten Artikelnummern, die in der Kartenansicht umbrechen — der Monteur kann den vollen String in Ruhe lesen, bevor er übernimmt. Ist `previewFormId` gesetzt, rendert das Modal stattdessen die Felder des Quick-View-Formulars (siehe oben). Backdrop-Tap, × oder Escape schließen die Vorschau. |

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

Beim Durchsteppen mit den Pfeiltasten bleibt die aktive Karte sichtbar: jede
Zeile ruft beim Aktivwerden `scrollIntoView({ block: "nearest" })` auf — ist
die Karte bereits vollständig sichtbar, passiert nichts, sonst wird genau so
weit gescrollt wie nötig.

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
| `additionalFilter`    | nein    | OData-`$filter`-Ausdruck, der per AND auf **jede** Suche gelegt wird; `{record.…}`- und `{user.…}`-Tokens werden zur Laufzeit aufgelöst. Details siehe [Zusatzfilter](#zusatzfilter-additionalfilter). |
| `enableQuickCreate`   | nein    | Boolean. `+ Neu`-Button anzeigen. Default `true`.                                                                                              |
| `enableFavorites`     | nein    | Boolean. Favoriten-Section + Pin-Button anzeigen. Default `false`.                                                                             |
| `enableRecentlyUsed`  | nein    | Boolean. „Zuletzt verwendet"-Section anzeigen. Default `false`.                                                                                |
| `previewFormId`       | nein    | GUID eines Quick-View-Formulars der Ziel-Tabelle. Gesetzt → Long-Press-Vorschau rendert dessen Felder; leer → Standard-Vorschau mit den konfigurierten Spalten. |

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
  Präfix-Wildcard + Trailing-`~` für Fuzzy + Infix-Regex je Begriff,
  `searchmode: "all"` für die AND-Verknüpfung über alle Begriffe,
  `besteffortsearchenabled` für Spell-Correction
- **Fallback:** `context.webAPI.retrieveMultipleRecords` mit
  `contains()`-Filter — innerhalb eines Begriffs OR über die Spalten,
  zwischen den Begriffen AND
- **Filter-Dialekt:** `additionalFilter` wird für den Search-Pfad
  umgeschrieben (`_x_value` → `x`, GUIDs in Hochkommata); der OData-Pfad
  bekommt den Maker-Ausdruck unverändert
- **Storage:** `window.localStorage` für Favoriten + MRU; kein Schema-Footprint
- **Sicherheit:** `dangerouslySetInnerHTML` wird ausschließlich mit
  HTML-escapten Strings befüllt — `{crmhit}…{/crmhit}` bzw.
  Term-Hervorhebung werden in einem dedizierten Highlighter-Modul HTML-sicher
  transformiert
- **Solution-Version:** `1.0.35.0`, **Control-Version:** `1.0.35`,
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
- **`additionalFilter` greift nicht im erweiterten Dialog:** die Lupe öffnet
  den UCI-`lookupObjects()`-Dialog, der FetchXML statt OData erwartet. Der
  Filter wirkt nur auf die Inline-Suche; beim Öffnen des Dialogs erscheint
  eine Warnung in der Browser-Console.

## Roadmap (v2)

- Finale Favoriten/MRU-UI mit Bulk-Management und Cross-Device-Sync
- **System-View-Anbindung:** Quick-Find- oder Saved-View als Quelle für
  Spalten, Filter und Sortierung — eliminiert die manuelle
  Spalten-Konfiguration
- Polymorphe Lookups (`Customer`, `Owner`, `Regarding`, MultiTable)
- **OData→FetchXML-Konverter**, damit `additionalFilter` auch im erweiterten
  `lookupObjects()`-Dialog greift
