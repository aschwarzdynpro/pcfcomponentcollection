# MultiProgressControl — Funktionsübersicht

**Kurzbeschreibung:** Schreibgeschütztes PCF-Field-Control für Dataverse, das
bis zu **6 konfigurierbare Whole-Number-Spalten** (Wert 0–100) als kompakte
**Ring-Fortschrittsanzeigen in einer Reihe** darstellt. Schlanker Ersatz für eine
hohe, vertikal gestapelte „Status"-Karte (Design-Handoff „Variante C").

Alle sechs Ringe stehen in **einer Zeile**, solange Platz ist; wird das Feld zu
schmal, bricht die Reihe auf **genau 3 pro Zeile** um (6 → 3 + 3) — nie das
unschöne 5 + 1 / 4 + 2 eines normalen Umbruchs.

## Funktionen

### Darstellung
- **Ring-Reihe, 6-oder-3-Layout:** ein CSS-Grid zeigt alle sechs 52-px-Ringe in
  einer Zeile und schaltet per Container-Query auf **genau 3 pro Zeile** um,
  sobald das Feld schmaler als ~568 px ist.
- **Zelle je Feld** 88 px, zentriert: Ring (52×52) oben, Beschriftung (11 px,
  `#616161`, `min-height:29px` für 2-zeilige Labels) darunter.
- **Ring (SVG):** Track `#EDEBE9`; Progress-Kreis `r 23.5`, `stroke-width 5`,
  Umfang `147.65`, `stroke-dashoffset = 147.65·(1−pct/100)`, runde Enden,
  Start oben via `rotate(-90)`. Prozentwert zentriert (14 px, `600`) in der
  Status-Farbe.
- Das Control rendert **transparent** — die weiße Karte/Border im Design ist die
  Formular-Section selbst (keine Karte-in-Karte).

### Status-Farb-Logik
| Wert | Farbe | Bedeutung |
|------|-------|-----------|
| `0`    | `#C8C6C4` | offen |
| `1–99` | `#0F6CBD` (Brand) | in Arbeit |
| `100`  | `#0E700E` | abgeschlossen |

Das Brand-Blau wird, sofern verfügbar, aus dem Fluent-Theme des Hosts
(`context.fluentDesignLanguage`) bezogen — Fallback `#0F6CBD`. Neutral, Erfolg
und Track sind fix.

### Werte-Handling
- Jeder Wert wird über `maxValue` (Standard `100`) auf einen Prozentwert
  normalisiert und auf **0–100 geklemmt**; `null`/leer → `0 %`.
- Ringe werden bei jedem `updateView` neu berechnet.

### Beschriftung
- `labelN` überschreibt die Beschriftung des jeweiligen Rings.
- Ist `labelN` leer, wird der **Anzeigename der gebundenen Spalte** verwendet.
- Optionale **Überschrift** (`headerLabel`) über der Reihe (11 px, fett,
  Großbuchstaben, `#919191`); leer ⇒ keine Überschrift.

### Barrierefreiheit
- Jeder Ring ist `role="progressbar"` mit `aria-valuenow` / `aria-valuemin=0` /
  `aria-valuemax=100` und `aria-label=<Label>`.
- Tooltip je Zelle: „<Label>: <pct>%".

### Mehrsprachigkeit (DE / EN)
- Leerzustand und ARIA-Texte werden aus der User-Sprache
  (`userSettings.languageId`) abgeleitet.

## Konfigurations-Properties

| Property        | Typ           | Pflicht | Beschreibung |
|-----------------|---------------|---------|--------------|
| `field1`        | `Whole.None`, bound | **ja** | Spalte, auf die das Control gelegt wird — Indikator 1 |
| `field2`–`field6` | `Whole.None`, bound | nein | Weitere Spalten, im Eigenschaften-Bereich gebunden — Indikatoren 2–6 |
| `label1`–`label6` | Text, input | nein | Beschriftung; leer ⇒ Anzeigename der gebundenen Spalte (für schmale Felder kurz halten) |
| `maxValue`      | `Whole.None`, input | nein | Spaltenwert, der 100 % entspricht (Standard `100`) |
| `headerLabel`   | Text, input   | nein    | Optionale Überschrift; leer ⇒ keine |

> **6 Felder an einem Field-Control:** Control auf die erste Spalte (`field1`)
> legen, dann `field2`–`field6` im Eigenschaften-Bereich an weitere Spalten
> binden. Nicht gemappte Slots werden automatisch übersprungen.

## Technisches

- **Stack:** React 17 + TypeScript, Build über `pcf-scripts`
- **Read-only:** kein Writeback in den Datensatz
- **Keine externen CDN/Internet-Abhängigkeiten**
- **Solution-Version:** `1.0.3.0`, **Control-Version:** `1.0.3`,
  Publisher `HerbertWaldmann`, Prefix `wal`
- **Unique Name:** `wal_Progress.MultiProgressControl`

## Bekannte Einschränkungen

- Reine Anzeige — Werte müssen über Rollups, Flows, Berechnungsspalten o. Ä.
  gesetzt werden.
- Sehr lange Beschriftungen ragen wie im Original-Design über die 88-px-Zelle
  hinaus — bei Bedarf kurze `labelN`-Werte vergeben.
