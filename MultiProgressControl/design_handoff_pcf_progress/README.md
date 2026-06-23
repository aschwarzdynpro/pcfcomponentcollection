# Handoff: PCF Progress-Indicator (6 Felder, eine Zeile)

## Überblick
Ein **PCF-Control (PowerApps Component Framework) für Dataverse** mit **Field Binding**. Es zeigt **6 konfigurierbare Whole-Number-Felder** (Wert 0–100) als kompakte **Ring-Progress-Indikatoren nebeneinander in einer Zeile** — als schlanker Ersatz für die aktuell vertikal gestapelte, platzraubende Variante.

Gewählte Design-Variante: **Variante C – mit Status-Farbe** (0 % neutral, in Arbeit blau, 100 % grün).

## Zu den Design-Dateien
Die Datei in diesem Paket (`PCF Progress Indicator.dc.html`) ist eine **Design-Referenz in HTML** — sie zeigt das gewünschte Aussehen und Verhalten, ist aber **kein produktiver Code zum 1:1-Kopieren**. Aufgabe ist es, dieses Design als **PCF-Control in React/TypeScript** im PCF-Standardumfeld (`pac pcf init`, `npm`, `pcf-scripts`) nachzubauen.

## Fidelity
**Hi-Fi** — finale Farben, Typografie, Maße und Geometrie sind verbindlich. Die UI soll pixelgenau nachgebaut werden; Farben idealerweise aus dem Fluent-/Theme-Token statt hartkodiert.

---

## Das Control

### Layout
- **Container:** eine Zeile, `display:flex; justify-content:space-between; gap:8px`. Bei geringer Breite `flex-wrap:wrap` erlauben.
- **Zelle pro Feld:** `flex:none; width:88px`, `display:flex; flex-direction:column; align-items:center; gap:9px`.
  - **Ring** (52×52 px) oben.
  - **Label** darunter: `font-size:11px; line-height:1.3; text-align:center; color:#616161; min-height:29px` (reserviert Platz für 2-zeilige Labels, damit die Ringe auf einer Linie bleiben).
- Schrift: `'Segoe UI'`-Stack (Standard im Dataverse-Formular).

### Ring (SVG)
Zwei konzentrische Kreise in einem 52×52-Viewport:
```
cx=26  cy=26  r=23.5  stroke-width=5
Umfang U = 2·π·23.5 = 147.65
```
- **Track-Kreis:** `stroke=#edebe9`, voll.
- **Progress-Kreis:** `stroke=<statusFarbe>`, `stroke-linecap=round`,
  `stroke-dasharray=147.65`,
  `stroke-dashoffset = U · (1 − pct/100)`,
  `transform=rotate(-90 26 26)` (Start oben, im Uhrzeigersinn).
- **% im Zentrum:** absolut zentriert, `font-size:14px; font-weight:600`, Farbe = Status-Farbe.

### Status-Farb-Logik
| Wert | Farbe | Bedeutung |
|------|-------|-----------|
| `0`        | `#c8c6c4` | offen |
| `1–99`     | `#0f6cbd` (Brand) | in Arbeit |
| `100`      | `#0e700e` | abgeschlossen |

Brand-Blau idealerweise aus `context.fluentDesignLanguage` / Theme-Brand-Token beziehen, Fallback `#0F6CBD`.

### Werte-Handling
- Wert auf **0–100 clampen**; `null`/leer → `0`.
- Bei `updateView` Ringe neu berechnen.
- **Tooltip** pro Zelle: `"<Label>: <pct> %"`.

### Barrierefreiheit
- Pro Ring `role="progressbar"` mit `aria-valuenow` / `aria-valuemin=0` / `aria-valuemax=100` und `aria-label=<Label>`.

---

## Design-Tokens
- **Brand/in Arbeit:** `#0F6CBD`
- **Erfolg/100 %:** `#0E700E`
- **Neutral/0 %:** `#C8C6C4`
- **Track:** `#EDEBE9`
- **Text %:** = Status-Farbe · **Label:** `#616161` · **Sekundär-Caption:** `#919191`
- **Ring:** 52 px, stroke 5, r 23.5 · **Zelle:** 88 px · **Gap:** 8 px

---

## PCF-Manifest (Vorschlag)
6 gebundene Properties vom Typ Whole Number. Beispiel:
```xml
<control namespace="YourNs" constructor="MultiProgressIndicator" version="1.0.0"
         display-name-key="MultiProgressIndicator" control-type="standard">
  <property name="field1" display-name-key="Feld 1" of-type="Whole.None" usage="bound" required="false" />
  <property name="field2" display-name-key="Feld 2" of-type="Whole.None" usage="bound" required="false" />
  <property name="field3" display-name-key="Feld 3" of-type="Whole.None" usage="bound" required="false" />
  <property name="field4" display-name-key="Feld 4" of-type="Whole.None" usage="bound" required="false" />
  <property name="field5" display-name-key="Feld 5" of-type="Whole.None" usage="bound" required="false" />
  <property name="field6" display-name-key="Feld 6" of-type="Whole.None" usage="bound" required="false" />
  <resources>
    <code path="index.ts" order="1" />
    <platform-library name="React" version="16.8.6" />
    <platform-library name="Fluent" version="9.46.2" />
  </resources>
</control>
```
- **Label je Ring** = `context.parameters.fieldN.attributes.DisplayName` (Fallback: display-name-key aus dem Manifest).
- `control-type="standard"` + Platform-Libraries für React/Fluent nutzen; `index.ts` rendert die React-Komponente in `updateView` und gibt sie über die Virtual-Control-API zurück (bzw. `ReactDOM.render` bei klassischem Ansatz).

## Hinweise zum Setup
```
pac pcf init --namespace YourNs --name MultiProgressIndicator --template field
npm install
npm run build && npm start watch   # Test-Harness
```
Im Test-Harness lassen sich die 6 Felder mit Beispielwerten (z. B. 66, 0, 40, 100, 25, 80) belegen.

## Dateien
- `PCF Progress Indicator.dc.html` — die Hi-Fi-Design-Referenz (Variante C + Zustands-Referenz 0/20/40/60/80/100 % + diese Spezifikation visuell).
