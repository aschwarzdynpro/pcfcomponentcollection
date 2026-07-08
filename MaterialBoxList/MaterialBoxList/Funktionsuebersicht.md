# MaterialBoxList – Funktionsübersicht

Ein mobil-orientiertes PCF-**Virtual-Dataset-Control** für Monteure, die mit
einer Liste von **Materialboxen** auf Lagerplätzen arbeiten. Jede Box hat
Materialien als untergeordnete Datensätze (1:n). Das Control zeigt die Boxen,
einen Materialzähler je Box, ein Overlay mit den enthaltenen Materialien und
eine Entnahme-Aktion, die eine Box als *entnommen* markiert.

> **React (Virtual) + Fluent UI v9.** Anders als die übrigen Controls dieser
> Sammlung (die React 17 bündeln) nutzt dieses Control `control-type="virtual"`
> mit den Plattform-Bibliotheken React 16.14 und Fluent 9 – Microsofts aktuelle
> Empfehlung für neue Controls. Das hält das Bundle winzig (~18 KB) und passt
> besser zu Mobilgeräten.

## Stand – Meilenstein 1 (Gerüst, im Browser testbar)

Das ist der erste Meilenstein des Konzepts. Was jetzt funktioniert:

- ✅ Darstellung der Boxen aus dem gebundenen Dataset inkl. Paging / Infinite
  Scroll.
- ✅ **Counter-Chip** je Box – ein gebatchter Child-Fetch pro Seite (keine
  Aggregat-Queries → offline-tauglich), gecacht und vom Overlay wiederverwendet.
- ✅ **Material-Overlay** (Fluent-Bottom-Sheet-Drawer) mit den konfigurierten
  Child-Spalten, Leer- und Ladezustand.
- ✅ **Entnahme-Aktion** mit optimistischem UI, 5-Sekunden-**Undo**-Snackbar und
  wiederholbarem Fehlerpfad.
- ✅ **Fallback-Buttons** („Materialien anzeigen“ / „Entnehmen“), damit jede
  Funktion ohne Gesten erreichbar ist – voll testbar im Browser und im
  PCF-Testharness (der kein `webAPI` hat; dort springt ein deterministischer
  Mock ein).
- ✅ Konfigurierbar: Child-Entität/-Spalten, Entnahme-Feld/-Wert, Verhalten für
  bereits entnommene Boxen.
- ✅ Dreisprachige Oberfläche (DE / EN / FR).

**Noch nicht umgesetzt (spätere Meilensteine):**

- ⏳ M2 – **Gesten**: Long-Press öffnet das Overlay, Links-Swipe entnimmt
  (Pointer-Event-State-Machine, Kanten-Totzone, Zurück-Feder-Animation). Aktuell
  decken die Fallback-Buttons dieselben Aktionen überall ab.
- ⏳ M3 – Typauflösung des Entnahme-Werts über `getEntityMetadata`.
- ⏳ M4 – Offline-Härtung, optionale Properties `swipeUserFieldName` /
  `groupByColumn`, Gruppierung mit Sticky-Headern, Suche/Filterchips,
  Barcode-Scan.

## Konfiguration (Properties)

Alle Eingabe-Properties sind `required="false"` mit Platzhalter-Defaults
(Repo-Konvention, CLAUDE.md §3.6 / §7), damit das Control immer lädt – auch im
Testharness und im Maker-Canvas. **Sie müssen auf das echte Schema gesetzt
werden.**

| Property | Typ | Default (Platzhalter) | Zweck |
|----------|-----|-----------------------|-------|
| `boxDataset` | Dataset | – | Die gebundene Materialbox-View (Spalten/Sortierung/Filter aus der View). |
| `childEntityName` | Text | `sst_material` | Logischer Name der Child-Tabelle (Materialien). |
| `childLookupField` | Text | `sst_materialbox` | Lookup-Spalte auf dem Child zur Box (`_<name>_value`). |
| `childDisplayColumns` | Text (CSV) | `sst_name,sst_quantity,sst_unit` | Angezeigte Child-Spalten; die erste ist der Materialname. |
| `childFilter` | Text | *(leer)* | Optionaler OData-`$filter`, z. B. `statecode eq 0`. Einfach halten – keine Aggregate. |
| `swipeFieldName` | Text | `sst_takenon` | Box-Spalte, die bei Entnahme gesetzt wird. Empfohlen: **DateTime** (Audit-Zeitstempel). |
| `swipeFieldValue` | Text | `@now` | Geschriebener Wert: `@now` → Zeitstempel, `true`/`false` → Boolean, Ziffern → OptionSet, sonst Text. |
| `takenBehavior` | Enum | `gray` | `hide` (aus Liste entfernen), `gray` (ausgegraut, Aktion aus) oder `allow-undo` (ausgegraut, rücknehmbar). |

> Hinter diesen Defaults steckt **noch kein verifiziertes Materialbox-Schema** –
> es sind Platzhalter. Logische Namen und den Entity-**Set**-Namen der
> Child-Tabelle vor jedem Schreibvorgang gegen die Umgebung prüfen (CLAUDE.md §7).

## Datenstrategie (warum offline-sicher)

- Die Liste kommt aus dem gebundenen Dataset (offline aus dem Cache).
- Der Counter lädt Child-Zeilen in **einem gebatchten Request pro Seite**
  (`_<lookup>_value eq id1 or … or idN`) und gruppiert client-seitig. **Kein
  `$apply`/Aggregat, kein `$expand`** im kritischen Pfad – offline nicht
  verfügbar.
- Dieselben Daten versorgen das Overlay (Stale-while-revalidate) → Long-Press
  öffnet ohne zweiten Roundtrip.
- Die Entnahme nutzt ein einzelnes `updateRecord`, das offline funktioniert und
  später synchronisiert.

## Admin-Konfiguration (Offline)

Für den Offline-Betrieb (bei Field Service üblich) müssen die **Box-Tabelle und
die Material-Tabelle** (samt aller gelesenen Spalten) im **Offline-Profil** der
App liegen. Eine leere Liste *nach* der Synchronisation bedeutet meist, dass die
Tabellen/Spalten nicht im Offline-Profil sind – eine Admin-Aufgabe, kein Bug.
