# WorkTimeSplitGrid — Funktionsübersicht

**Kurzbeschreibung:** PCF-**Dataset**-Control für die Tabelle **Rounded Time
Entries** (`sst_roundedtimeentries`, Schulz Systemtechnik). Ersetzt eine Canvas
Custom Page durch einen Master/Detail-Workflow direkt im Model-Driven-App-Grid:
Eintrag wählen, die Gesamtdauer auf die Zuschlags-Subtypes
(**Normal / Überstunden / Nacht-Sonntag / Feiertag**) aufteilen und speichern.
Beim Speichern werden die Split-Datensätze erzeugt, das Original samt
zugehöriger Pausen als „aufgeteilt" markiert und das Original gelöscht.

## Funktionen

### Master-Liste (links)
- Zeigt die Rounded Time Entries aus der gebundenen View (Projekt/Name, Typ,
  Datum, Gesamtdauer) als Karten.
- **Zusammengesetzter Titel** (Liste + Detail): `<sst_type> am <sst_date> auf
  Projekt <sst_projectnumber>` (z. B. „Arbeit am 07.08.2024 auf Projekt
  P10002233"). `sst_date` und die Projektnummer des verknüpften Projekts
  (`sst_project_id.sst_projectnumber` auf `msdyn_project`) werden je Seite über
  EINEN WebAPI-`$expand`-Aufruf nachgeladen — der Titel funktioniert also auch,
  wenn diese Spalten nicht in der View liegen. Fehlende Teile werden weggelassen.
- **Freitext-Suche** über Name, Typ, Datum und sichtbare View-Spalten.
- **Zwei Modi** (Toolbar-Umschalter):
  - **Aufteilen** — Einträge, die noch nicht aufgeteilt sind
    (`sst_worksubtypecompleted = Nein`; Pausen ausgeblendet) → Split-Editor rechts.
  - **Zuordnen** — bereits aufgeteilte Einträge, die noch keinem Lieferschein
    zugeordnet sind (`sst_worksubtypecompleted = Ja` **und** `sst_timereport`
    leer) → Mehrfachauswahl-Liste mit Aktion **„Lieferscheine erstellen"**.
- **Lieferscheine erstellen** (Zuordnen-Modus) — ein oder mehrere Einträge per
  Checkbox markieren; unten erscheint eine Aktionsleiste mit Anzahl + Button.
  Erstellt **je Arbeitsauftrag** einen Lieferschein (`sst_timereports`,
  `sst_name` = „Report <WO> On <Datum>", `sst_Arbeitsauftrag` → msdyn_workorder)
  und verknüpft jeden ausgewählten Eintrag via `sst_TimeReport` mit dem
  Lieferschein seines Arbeitsauftrags. Bereits zugeordnete Einträge werden
  abgewiesen; entsteht genau ein Lieferschein, wird er geöffnet. (Portiert aus
  dem Schulz-Ribbon-Command `createTimeReport`.)
- **Freitext-Suche** über Titel, Typ, Datum, **Projektnummer** und
  **Ressourcenname** (`sst_resource_ref.name`). Das Control lädt **alle Seiten**
  des gebundenen Views automatisch nach (nicht nur die erste) — Liste und Suche
  erfassen damit **alle** Datensätze. Das Enrichment läuft in gebündelten
  WebAPI-Calls, sobald alle Seiten geladen sind.
- **Chip „Meine Stunden"** (vorausgewählt) — filtert auf Einträge, deren Ressource
  dem aktuellen Benutzer gehört (`sst_resource_ref.userid = aktueller User`). Der
  Chip ist **gesperrt + aktiv** für alle Benutzer; nur Inhaber der Rolle
  **System Administrator** oder **SST | Dispo Teamleitung Addon** können ihn
  abschalten (alle Stunden sehen). Rollenprüfung über
  `systemuserroles_association` (direkt zugewiesene Rollen).
- Statuspunkt je Karte (offen = rot, aufgeteilt = grün).

### Detail-Aufteilung (rechts)
- Auswahl eines Eintrags lädt die zugehörigen Work-Subtype-Zeilen
  (`sst_roundedtimeentryworksubtypes`, gefiltert über
  `_sst_roundedtimeentry_value`) und sortiert sie in der kanonischen Reihenfolge
  Normal → Überstunden → Nacht/Sonntag → Feiertag.
- Pro Subtype ein **editierbares Stundenfeld** (`sst_timevalue`). Eingaben
  akzeptieren Komma und Punkt als Dezimaltrenner.
- Live-Zusammenfassung **Gesamt / Verteilt / Rest**; „Rest = 0" wird grün
  hervorgehoben.
- **„Rest übernehmen"-Icon** — solange noch Restzeit unverteilt ist (Rest > 0),
  erscheint neben **jedem** Subtype-Feld ein kleines Pfeil-Icon; ein Klick addiert
  den Rest zum aktuellen Wert des Feldes (Aufteilung mit einem Klick abschließen).

### Speichern (Aufteilung)
- Der Button **„Aufteilung speichern"** ist nur aktiv, wenn die Summe der
  verteilten Stunden der Gesamtdauer (`sst_duration`) entspricht und der Eintrag
  noch nicht aufgeteilt ist.
- **Bestätigungsdialog** vor der destruktiven Aktion (nennt Anzahl der
  Split-Datensätze und den Eintragsnamen).
- Ablauf über `context.webAPI` (entspricht der ursprünglichen Custom Page):
  1. Persistiert je Subtype den `sst_timevalue`.
  2. Legt pro Subtype mit Wert > 0 eine neue Rounded Time Entry an:
     `sst_workordersubtype` = Subtype-Name, `sst_duration` = Subtype-Stunden,
     `sst_type` = `<Original-Typ> (<Subtype>)`, `sst_worksubtypecompleted` = Ja,
     plus übernommene Felder (`sst_name`, `sst_date`, `sst_freitextfeld`) und
     Lookups (`sst_workorder`, `sst_bookableresourcebooking`, `sst_project_id`)
     vom Original.
  2b. Setzt die **Zeiterfassungsart** (`sst_worktype_ref` + `sst_worktype_title_str`)
     je Split über den zusammengesetzten Key **(paytype, timetype)**: paytype aus
     dem Subtype (`sst_paytype_opt`, sonst Subtype-Name gegen das OptionSet-Label),
     timetype aus dem Original-Eintrag (`sst_timetype_opt`, sonst `sst_type`-Text
     gegen das Label). Das passende `sst_worktype`-Record wird beim Speichern
     ermittelt (einmalige Abfrage aller `sst_worktypes`, Label→Wert aus deren
     Formatted Values). Findet sich kein Treffer, bleibt die Zeiterfassungsart leer.
  3. Markiert das Original **und zugehörige Pausen** (gleicher Arbeitsauftrag,
     `sst_type = Pause`) als `sst_worksubtypecompleted = Ja`.
  4. Löscht das Original — die Kind-Subtype-Zeilen werden über die
     Cascade-Delete-Beziehung automatisch mitentfernt.
- Erfolgs-/Fehler-Toast; danach `dataset.refresh()`.

### @odata.bind robust
- Beim Anlegen der Split-Records werden die Lookup-Ziele
  (`@odata.bind`-Navigation-Properties + Ziel-EntitySets) zur Laufzeit aus den
  Lookup-Annotationen des Originals und `Utility.getEntityMetadata` aufgelöst —
  die Verknüpfungen zu Arbeitsauftrag/Buchung/Projekt überleben die Aufteilung
  unabhängig von der Ziel-Tabelle.

### Adaptiv (Desktop + Mobil)
- **Ein Control, zwei Layouts** — zur Laufzeit über
  `context.client.getFormFactor()` (mit Breiten-Fallback) gewählt:
  - **Desktop / Tablet** → zweispaltiges Master/Detail-Layout (unverändert).
  - **Handy** → einspaltiger, touch-first Flow: Liste in voller Breite → Eintrag
    antippen → Vollbild-Split-Editor mit **‹ Zurück**-Header → nach dem Speichern
    zurück zur Liste. Größere Tap-Targets, große Zahlenfelder, am unteren Rand
    fixierter Speichern-Button.
- Beim Hinzufügen zur View dasselbe Control **Web + Tablet + Phone** zuweisen —
  kein separater Mobil-Build zu pflegen.

### Mehrsprachigkeit
- **Dreisprachige Oberfläche** (Deutsch / Englisch / Französisch), automatisch
  nach `context.userSettings.languageId`.

## Konfiguration (Manifest-Properties)
Alle Felder haben verifizierte SST-Defaults und sind pro Platzierung
überschreibbar: `totalField` (`sst_duration`), `dateField` (`sst_date`),
`typeField` (`sst_type`), `pauseValue` (`Pause`), `completedField`
(`sst_worksubtypecompleted`), `subtypeField` (`sst_workordersubtype`).

## Annahmen / Hinweise
- Die Work-Subtype-Zeilen je Eintrag werden als bereits vorhanden angenommen
  (Anlage erfolgt vorgelagert, z. B. per Flow); das Control bearbeitet deren
  Werte und schreibt die Split-Records.
- Als Gesamtzeit wird `sst_duration` gelesen (die Custom Page nannte sie
  „Stunden"); abweichende Schemas über `totalField` anpassen.
- Schema verifiziert gegen den SSTCore-Solution-Export. Vor Produktiv-Einsatz
  des destruktiven Speicherns die Logical Names gegen das Ziel-Environment
  (INT-11) gegenprüfen.
