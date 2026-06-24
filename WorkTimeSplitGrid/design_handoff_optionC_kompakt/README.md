# Handoff: Auf-/abklappbare Aktionsleiste — Option C „Kompakt-Zusammenfassung" (PCF)

> Anleitung für **Claude Code**, um den Collapse/Expand-Mechanismus (Variante C) in ein bestehendes
> **PowerApps Component Framework (PCF)**-Control zu integrieren. Diese Datei ist so geschrieben, dass sie
> ohne Kontext aus dem ursprünglichen Designgespräch ausreicht.

---

## 1. Überblick

Das PCF-Control zeigt eine Liste von Arbeitszeit-Einträgen („Aufteilung / Zuordnung Arbeitszeiten"). Über der
Liste sitzt eine **Aktionsleiste** mit vier Steuergruppen:

1. **Suche** – Freitext-Eingabe („Einträge suchen…")
2. **Modus-Umschalter** – `Aufteilen` / `Zuordnen` (Segmented) + `Meine Stunden` (Pill)
3. **Datumsfilter** – `Alle` / `Heute` / `Diese Woche` / `Dieser Monat` (Segmented)
4. **Sortieren** – Dropdown (z. B. „Datum (neueste)")

**Ziel:** Auf **mobilen / schmalen Ansichten** nimmt diese Leiste sehr viel vertikalen Platz weg. Variante C
klappt die komplette Leiste auf eine **einzeilige Zusammenfassung** zusammen, die die aktiven Filter weiter
anzeigt und das Suchsymbol behält. Dadurch werden die Listeneinträge maximal sichtbar, ohne dass der Kontext
verloren geht. Ein erneutes Antippen klappt die volle Leiste wieder aus.

**Nur relevant in der mobilen / schmalen Darstellung.** In der Desktop-/Breit-Ansicht bleibt die Leiste immer
voll ausgeklappt und der Collapse-Mechanismus ist deaktiviert (kein Trigger sichtbar).

---

## 2. Über die Designdateien

Die Dateien im Ordner `referenz/` sind **Design-Referenzen, erstellt in HTML** — interaktive Prototypen, die
Aussehen und Verhalten zeigen, **kein** produktiv zu kopierender Code.

- `referenz/Aktionsleiste Collapse.dc.html` — Leinwand mit allen drei Vorschlägen nebeneinander (A, B, C).
- `referenz/MechanismPhone.dc.html` — der nachgebaute Bildschirm samt Logik für alle drei Varianten
  (`mode = "summary"` entspricht **Option C**). Hier stehen die exakten Stile und die Collapse-Logik.
- `referenz/ios-frame.jsx`, `referenz/support.js` — nur Laufzeit-/Rahmen-Hilfsdateien des Prototyps,
  **für die Integration irrelevant**.

**Aufgabe:** Variante C in der bestehenden PCF-Umgebung **nachbauen** (TypeScript, je nach Control React-basiert
oder „Standard"/DOM), mit den dort etablierten Patterns, Fluent-UI-Komponenten und Build-Pipeline — nicht das
HTML direkt einbinden.

---

## 3. Fidelity

**High-fidelity.** Farben, Maße, Typografie, Abstände und Übergänge sind final und sollen pixelgenau
übernommen werden (siehe Abschnitt 7 Design-Tokens und Abschnitt 6 Stil-Spezifikation). Wenn das Control bereits
Fluent UI / Microsoft-Design-Tokens nutzt, dürfen die dortigen Äquivalente verwendet werden — die hier
genannten Hex-Werte sind die Zielwerte.

---

## 4. Verhalten — Zustände & Übergänge

Es gibt genau **zwei Zustände**:

### Zustand „expanded" (Standard)
- Die volle Aktionsleiste (Suche + Modus + Datum + Sortieren) ist sichtbar.
- Direkt unter der Leiste, über der Liste, sitzt eine **schmale Einklapp-Zeile**:
  Text „**Filter ausblenden**" + Chevron nach oben. Tippen ⇒ Wechsel zu „collapsed".

### Zustand „collapsed"
- Die volle Leiste ist auf Höhe `0` zusammengefahren (animiert) und ausgeblendet.
- An ihrer Stelle erscheint die **Zusammenfassungs-Zeile** (einzeilig):
  `🔍  Zuordnen · Alle · Datum (neueste)        8   ⌄`
  - Links ein **Such-Icon** (Lupe, Akzentblau) — dient als Affordance „hier ist die Suche".
  - Mitte: **aktive Filter** als „·"-getrennte Kurzfassung (siehe Abschnitt 5 zur Zusammensetzung).
  - Rechts: **Trefferanzahl** + **Chevron nach unten**.
- Tippen irgendwo auf die Zeile ⇒ Wechsel zu „expanded".

### Übergänge / Animation (exakt)
Die volle Leiste ist ein Container, dessen Höhe + Deckkraft + Innenabstand animiert werden:

```
max-height : 320px  ⟷  0px      transition: max-height .40s cubic-bezier(.4,0,.2,1)
opacity    : 1      ⟷  0        transition: opacity .26s ease
padding-top: 14px   ⟷  0px      transition: padding .40s cubic-bezier(.4,0,.2,1)
padding-bottom: 6px ⟷  0px
overflow   : hidden  (immer)
```

> **Wichtig (robuste Höhe):** `320px` ist der Designwert für den Prototyp-Inhalt. Im echten Control kann der
> Inhalt höher sein. Statt eines festen Werts den tatsächlichen `scrollHeight` des Inhalts per Ref messen und
> als `max-height` setzen (beim Einklappen auf `0`). Fallback: ein großzügiger Festwert (z. B. `420px`), der nie
> kleiner als der reale Inhalt ist — sonst wird abgeschnitten.

Die **Zusammenfassungs-Zeile** wird beim Erscheinen sanft eingeblendet (Fade), passend zum vom Auftraggeber
gewünschten „fade-in/fade-out":

```
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
/* auf der Summary-Zeile: */ animation: fadeIn .3s ease;
```

Der Chevron in der Einklapp-/Ausklapp-Zeile rotiert beim Zustandswechsel:
`transform: rotate(0deg) ⟷ rotate(180deg); transition: transform .3s ease;`

---

## 5. Zusammensetzung der Zusammenfassungs-Zeile (dynamisch!)

Die Kurzfassung muss die **tatsächlich aktiven Filter** widerspiegeln, nicht den statischen Beispieltext.
Aufbau: `<Modus> · <Datumsfilter> · <Sortierung>`, jeweils mit „ · " (Leerzeichen-Mittelpunkt-Leerzeichen)
verbunden. Leere/Standard-Teile dürfen entfallen, aber mindestens der Modus + Datumsfilter sollten erscheinen.

| Segment | Quelle im Control | Anzeigetext (Beispiele) |
|---|---|---|
| Modus | aktueller Modus-Toggle | `Aufteilen` · `Zuordnen` · `Meine Stunden` |
| Datum | aktiver Datumsfilter | `Alle` · `Heute` · `Diese Woche` · `Dieser Monat` |
| Sortierung | aktuelle Sortier-Option | `Datum (neueste)` · `Datum (älteste)` · … |
| Suchtext (optional) | falls Suchfeld befüllt | z. B. `„Müller"` voranstellen |

Wenn eine aktive **Suche** existiert, sollte das durch das Such-Icon im aktiven/gefüllten Zustand (z. B. kleiner
Punkt-Indikator) signalisiert werden. Die **Trefferanzahl rechts** ist die Anzahl der aktuell geladenen
Datensätze (`dataset.sortedRecordIds.length` o. ä.).

---

## 6. Stil-Spezifikation (pixelgenau)

Alle Werte stammen aus `referenz/MechanismPhone.dc.html` (`mode === "summary"`).

### 6a. Einklapp-Zeile (im Zustand „expanded", über der Liste)
- Container: `display:flex; align-items:center; justify-content:center; gap:7px; padding:8px;`
- Hintergrund `#ffffff`, `border-bottom:1px solid #ededed`, `cursor:pointer`
- Text „Filter ausblenden": `font-size:12px; font-weight:600; color:#605e5c`
- Chevron nach oben: 13×13, Strich `#605e5c`, `stroke-width:1.8`, `round`

### 6b. Zusammenfassungs-Zeile (im Zustand „collapsed")
- Container: `display:flex; align-items:center; gap:10px; padding:11px 16px;`
- Hintergrund `#f3f6fb` (heller Blauton), `border-top:1px solid #e4e8ee; border-bottom:1px solid #e4e8ee`
- `cursor:pointer; user-select:none; animation:fadeIn .3s ease`
- **Such-Icon** (Lupe): 16×16, Strich `#1f6fce`, `stroke-width:1.8` — Kreis r≈6.5 + Griff diagonal
- **Filtertext**: `flex:1; font-size:13.5px; font-weight:600; color:#1b1b1b` (z. B. „Zuordnen · Alle · Datum (neueste)")
- **Trefferzahl**: `font-size:12px; color:#605e5c; white-space:nowrap`
- **Chevron nach unten**: 13×13, Strich `#1f6fce`, `stroke-width:1.8`, `round`

### 6c. Volle Leiste — Innenelemente (unverändert übernehmen, nur als Collapse-Inhalt)
Container-Padding ausgeklappt: `14px 16px 6px`.
- **Suchfeld:** `border:1px solid #d7d7d7; border-radius:4px; padding:11px 13px; background:#fafafa;`
  Lupe (16, `#8a8886`) + Placeholder „Einträge suchen…" (`font-size:15px; color:#8a8886`). Abstand unten `12px`.
- **Modus-Zeile:** `display:flex; align-items:center; gap:8px;`
  - Segmented (Aufteilen|Zuordnen): `border:1px solid #b9b9b9; border-radius:5px; overflow:hidden`.
    Items `padding:7px 11px; font-size:13.5px`. Inaktiv `background:#fff; color:#1b1b1b`.
    Aktiv `background:#1f6fce; color:#fff; font-weight:600`.
  - Pill „Meine Stunden": `padding:7px 13px; font-size:13.5px; border-radius:18px;` aktiv blau wie oben.
  - „N Einträge": `margin-left:auto; font-size:12px; color:#605e5c`.
- **Datumsfilter:** `display:flex; border:1px solid #c8c6c4; border-radius:5px; overflow:hidden`.
  Items `padding:9px; font-size:13.5px`. Aktiv (`Alle`) `background:#1f6fce; color:#fff; font-weight:600`,
  inaktiv `color:#1b1b1b`. Abstand unten `12px`.
- **Sortieren:** Label „Sortieren" (`font-size:14px`) + Dropdown
  (`flex:1; border:1px solid #c8c6c4; border-radius:5px; padding:9px 13px`) mit Text + Chevron `#605e5c`.

---

## 7. Design-Tokens

| Token | Wert | Verwendung |
|---|---|---|
| `--navy` | `#0b1f44` | Kopfzeile / dunkle Akzente |
| `--accent` | `#1f6fce` | aktive Toggles, Icons, Links, Summary-Akzente |
| `--accent-tint` | `#f3f6fb` | Hintergrund der Summary-/Trigger-Zeile |
| `--accent-tint-border` | `#e4e8ee` | Rahmen der Summary-/Trigger-Zeile |
| `--green` | `#107c41` | „Neu erstellen"-Icon (falls Aktionsleiste unten vorhanden) |
| `--text` | `#1b1b1b` | Primärtext |
| `--text-2` | `#605e5c` | Sekundärtext / Labels |
| `--text-3` | `#797775` | Tertiärtext (Untertitel Einträge) |
| `--placeholder` | `#8a8886` | Such-Placeholder |
| `--border-strong` | `#b9b9b9` | Segmented-Rahmen |
| `--border` | `#c8c6c4` | Filter-/Dropdown-Rahmen |
| `--border-soft` | `#d7d7d7` | Suchfeld-Rahmen |
| `--divider` | `#ededed` / `#efefef` | Trennlinien Listenzeilen / Trigger |
| `--bar-bg` | `#f3f2f1` | untere Aktionsleiste |
| Schrift | `'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif` | gesamtes Control |
| Easing | `cubic-bezier(.4,0,.2,1)` | Höhen-/Padding-Transition |
| Dauer | `.40s` (Höhe/Padding), `.26s` (Opacity), `.30s` (Fade/Chevron) | Übergänge |
| Radius | `4–5px` Controls, `18px` Pills | — |

---

## 8. State Management

| State | Typ | Beschreibung |
|---|---|---|
| `isExpanded` | `boolean` | `true` = volle Leiste, `false` = Zusammenfassung. **Default `true`.** |
| `isCompactViewport` | `boolean` (abgeleitet) | Mobile/schmal? Steuert, ob der Mechanismus überhaupt aktiv ist. |
| `summaryText` | `string` (abgeleitet) | aus aktivem Modus/Datum/Sortierung berechnet (Abschnitt 5). |
| `recordCount` | `number` | aktuelle Trefferzahl. |

**Quelle für `isCompactViewport`:**
- Primär: **CSS-Media-Query / Breite des Control-Containers**. In PCF zuverlässig über
  `context.mode.allocatedWidth` (Pixelbreite des Containers) — z. B. `allocatedWidth > 0 && allocatedWidth < 720`.
- Optional zusätzlich: `context.client.getFormFactor()` (Phone/Tablet/Web) zum Eingrenzen auf das Telefon.
- Wenn `isCompactViewport === false` (Desktop/breit): Mechanismus **deaktivieren** — Leiste immer voll, kein
  Trigger, keine Zusammenfassungs-Zeile.

**Persistenz (optional, empfohlen):** `isExpanded` pro Sitzung im Control-Instanzfeld halten. Soll der Zustand
einen Reload überdauern, in `localStorage` unter einem control-spezifischen Schlüssel ablegen
(z. B. `pcf:<controlName>:actionbarExpanded`). **Nicht** in Dataverse speichern. Keine fremden Storage-Keys
überschreiben.

---

## 9. PCF-Integration

### 9a. React-/„virtual"-Control (empfohlen, falls vorhanden)
`updateView` gibt ein React-Element zurück; lokaler `useState` für `isExpanded` bleibt über `updateView`-Aufrufe
erhalten, solange der Komponentenbaum gemountet bleibt.

```tsx
// CollapsibleActionBar.tsx
import * as React from "react";

interface Props {
  /** false ⇒ Mechanismus aus (Desktop): immer ausgeklappt, kein Trigger */
  enabled: boolean;
  /** dynamische Kurzfassung der aktiven Filter, z. B. "Zuordnen · Alle · Datum (neueste)" */
  summary: string;
  recordCount: number;
  /** die volle Leiste (Suche + Modus + Datum + Sortieren) als Kinder */
  children: React.ReactNode;
}

const EASE = "cubic-bezier(.4,0,.2,1)";

export const CollapsibleActionBar: React.FC<Props> = ({ enabled, summary, recordCount, children }) => {
  const [expanded, setExpanded] = React.useState(true);
  const innerRef = React.useRef<HTMLDivElement>(null);
  const [maxH, setMaxH] = React.useState<number | undefined>(undefined);

  // realen Inhalt messen ⇒ saubere Höhen-Animation statt Festwert
  React.useLayoutEffect(() => {
    if (innerRef.current) setMaxH(innerRef.current.scrollHeight);
  });

  // Desktop/breit: Mechanismus aus, Leiste immer voll
  if (!enabled) return <div style={{ padding: "14px 16px 6px" }}>{children}</div>;

  const open = expanded;
  return (
    <div>
      {/* volle Leiste — animierter Collapse-Container */}
      <div
        aria-hidden={!open}
        style={{
          overflow: "hidden",
          maxHeight: open ? (maxH ?? 420) : 0,
          opacity: open ? 1 : 0,
          paddingLeft: 16,
          paddingRight: 16,
          paddingTop: open ? 14 : 0,
          paddingBottom: open ? 6 : 0,
          transition: `max-height .40s ${EASE}, opacity .26s ease, padding .40s ${EASE}`,
        }}
      >
        <div ref={innerRef}>{children}</div>
      </div>

      {open ? (
        // Einklapp-Zeile
        <button
          type="button"
          onClick={() => setExpanded(false)}
          aria-expanded={true}
          aria-controls="actionbar-full"
          style={{
            all: "unset", boxSizing: "border-box", width: "100%", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            padding: 8, background: "#fff", borderBottom: "1px solid #ededed",
            font: "600 12px 'Segoe UI', sans-serif", color: "#605e5c",
          }}
        >
          Filter ausblenden
          <Chevron dir="up" color="#605e5c" />
        </button>
      ) : (
        // Zusammenfassungs-Zeile
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          aria-controls="actionbar-full"
          style={{
            all: "unset", boxSizing: "border-box", width: "100%", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 10, padding: "11px 16px",
            background: "#f3f6fb", borderTop: "1px solid #e4e8ee", borderBottom: "1px solid #e4e8ee",
            animation: "abFadeIn .3s ease",
          }}
        >
          <SearchIcon color="#1f6fce" />
          <span style={{ flex: 1, font: "600 13.5px 'Segoe UI', sans-serif", color: "#1b1b1b",
                         whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {summary}
          </span>
          <span style={{ font: "12px 'Segoe UI', sans-serif", color: "#605e5c", whiteSpace: "nowrap" }}>
            {recordCount}
          </span>
          <Chevron dir="down" color="#1f6fce" />
        </button>
      )}
    </div>
  );
};
```

```css
/* in der CSS-Ressource des Controls (manifest: <css path="...">) */
@keyframes abFadeIn { from { opacity: 0 } to { opacity: 1 } }
```

`Chevron` und `SearchIcon` sind kleine inline-SVG-Komponenten (Maße/Farben siehe Abschnitt 6). Falls das Control
**Fluent UI** nutzt, stattdessen `Search20Regular` / `ChevronUp20Regular` / `ChevronDown20Regular`
(`@fluentui/react-icons`) verwenden.

Einbindung in `index.ts` (virtual control):
```ts
public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
  const enabled = context.mode.allocatedWidth > 0 && context.mode.allocatedWidth < 720;
  const summary = buildSummary(/* aktiver Modus, Datumsfilter, Sortierung */);
  const count = this.dataset.sortedRecordIds.length;
  return React.createElement(CollapsibleActionBar, { enabled, summary, recordCount: count },
    React.createElement(FullActionBar, { /* bestehende Filter-Props */ })
  );
}
```

### 9b. „Standard"-Control (Vanilla DOM, kein React)
- In `init` einmal das DOM aufbauen: Container `fullBar` (volle Leiste), `triggerRow` (Ein-/Ausklappen),
  `summaryRow` (Zusammenfassung). `_expanded = true` als Instanzfeld.
- CSS-Klassen `.ab-full`, `.ab-full--collapsed` mit den Transition-Werten aus Abschnitt 4 in der CSS-Ressource.
- Toggle-Handler:
  ```ts
  private toggle = () => {
    this._expanded = !this._expanded;
    this.fullBar.classList.toggle("ab-full--collapsed", !this._expanded);
    this.triggerRow.style.display = this._expanded ? "flex" : "none";
    this.summaryRow.style.display = this._expanded ? "none" : "flex";
    // optional: localStorage.setItem(key, String(this._expanded));
  };
  ```
- In `updateView`: `summaryRow` Text + Trefferzahl neu setzen; Mechanismus per
  `context.mode.allocatedWidth` ein-/ausblenden (bei Desktop `fullBar` immer offen, Trigger/Summary `display:none`).

---

## 10. Barrierefreiheit & Touch

- Trigger-/Summary-Zeile als **`<button>`** (oder `role="button"` + `tabindex="0"`) umsetzen.
- `aria-expanded` (`true`/`false`) + `aria-controls` auf den Container der vollen Leiste setzen
  (`id="actionbar-full"`).
- Tastatur: **Enter** und **Leertaste** lösen den Toggle aus (bei `<button>` automatisch).
- Beim Ausklappen optional den Fokus auf das **Suchfeld** setzen (schneller Workflow).
- Touch-Trefferfläche der Zeilen **≥ 44px** Höhe (mit Padding gegeben).
- `prefers-reduced-motion: reduce` respektieren: Transition-/Animationsdauer auf `0` setzen, Zustandswechsel
  sofort.

---

## 11. Akzeptanzkriterien

- [ ] Nur bei schmaler Ansicht (`allocatedWidth < 720`) erscheint die Einklapp-/Summary-Mechanik; auf Desktop
      bleibt die Leiste unverändert voll.
- [ ] „expanded" → Tippen auf „Filter ausblenden" fährt die volle Leiste mit Höhen-+Fade-Übergang auf `0` und
      zeigt die Zusammenfassungs-Zeile (Fade-in).
- [ ] „collapsed" → Tippen auf die Zusammenfassungs-Zeile fährt die volle Leiste wieder aus.
- [ ] Die Zusammenfassung spiegelt **aktiv** Modus + Datumsfilter + Sortierung wider und aktualisiert sich, wenn
      sich ein Filter ändert.
- [ ] Trefferzahl rechts entspricht den geladenen Datensätzen.
- [ ] Farben, Abstände, Radien, Easing und Dauer entsprechen Abschnitt 6/7.
- [ ] Tastatur-/Screenreader-Bedienung gem. Abschnitt 10.
- [ ] `prefers-reduced-motion` wird respektiert.

---

## 12. Dateien in diesem Paket

- `README.md` — diese Anleitung.
- `referenz/MechanismPhone.dc.html` — maßgebliche Stil-/Logikreferenz (`mode === "summary"` = Option C).
- `referenz/Aktionsleiste Collapse.dc.html` — Vergleichs-Leinwand aller drei Varianten.
- `referenz/ios-frame.jsx`, `referenz/support.js` — nur Prototyp-Laufzeit, für die Integration ignorieren.

> Zum Ansehen der Prototypen die `.dc.html`-Dateien in der Design-Umgebung öffnen (sie benötigen `support.js`
> im selben Ordner). Für die PCF-Implementierung ist die textliche Spezifikation oben maßgeblich.
