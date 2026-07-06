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
- Zeigt die Rounded Time Entries als Karten. Jede Karte zeigt den
  zusammengesetzten Titel, eine **Chip-Reihe ohne Label** (**Ressource →
  Projekt**) und die Gesamtdauer. Die Ressource ist `sst_resource_ref.name`
  (Fallback auf das Textfeld `sst_resource`); der Projekt-Chip ist die
  Projektnummer (`sst_project_id.sst_projectnumber`).
- **Zusammengesetzter Titel** (Liste + Detail): `<sst_type> am <sst_date>`
  (z. B. „Arbeit am 07.08.2024"). `sst_date` und die Projektnummer des
  verknüpften Projekts (`sst_project_id.sst_projectnumber` auf `msdyn_project`)
  werden je Seite über EINEN WebAPI-`$expand`-Aufruf nachgeladen — Titel und
  Projekt-Chip funktionieren also auch, wenn diese Spalten nicht in der View
  liegen. Fehlende Teile werden weggelassen.
- **Freitext-Suche** über Name, Typ, Datum und sichtbare View-Spalten.
- **Zwei Modi** (Toolbar-Umschalter). Beide setzen voraus, dass der Eintrag ein
  **Projekt** hat (`sst_project_id` gesetzt):
  - **Aufteilen** — `sst_worksubtypecompleted = Nein` → Split-Editor rechts.
  - **Zuordnen** — `sst_worksubtypecompleted = Ja` **und** `sst_timereport` leer
    → Mehrfachauswahl-Liste mit Aktion **„Lieferscheine erstellen"**.
  **Pausen** (`sst_type` = `pauseValue`, Default `Pause`) werden in beiden Modi
  ausgeblendet — ebenso Einträge auf **Festpreis-Projekten** (Projekt-Feld
  `hso_projecttype = 100000001`, gefiltert über die `sst_Project_id`-Navigation).
  Die Liste wird **direkt vom Server geladen, mit bereits angewandtem
  Modus-Filter** (`webApi.retrieveMultipleRecords` auf `sst_roundedtimeentries`)
  — statt alle Seiten des gebundenen Views zu laden und clientseitig zu filtern.
  Dadurch stimmen die Filter und das Control bleibt schnell, auch wenn die Tabelle
  deutlich mehr als Dataverses 5000-Datensatz-Seitenlimit enthält (der frühere
  Ansatz zeigte ab dieser Grenze eine leere Liste).
- **Lieferscheine erstellen** (Zuordnen-Modus) — ein oder mehrere Einträge per
  Checkbox markieren; unten erscheint eine Aktionsleiste mit Anzahl und **zwei**
  Buttons:
  - **Lieferscheine erstellen** — erstellt die Lieferscheine und bleibt in der
    Liste (entsteht genau ein Lieferschein, wird er trotzdem geöffnet).
  - **Erstellen & öffnen ↗** — dasselbe, öffnet danach das Ergebnis: ein einzelner
    Lieferschein wird direkt geöffnet; wurden **mehrere** erstellt, erscheint ein
    Auswahl-Overlay, das sie nach **Lieferscheinnummer**
    (`sst_deliverynotenumberassembly_str`, mit dem Arbeitsauftrag als Unterzeile)
    auflistet, sodass der Benutzer wählt, welchen er öffnet.
  Beide erstellen **je Arbeitsauftrag** einen Lieferschein (`sst_timereports`,
  `sst_name` = „Report <WO> On <Datum>", `sst_Arbeitsauftrag` → msdyn_workorder)
  und verknüpfen jeden ausgewählten Eintrag via `sst_TimeReport` mit dem
  Lieferschein seines Arbeitsauftrags. Bereits zugeordnete Einträge werden
  abgewiesen. Während der Erstellung blendet sich ein **Fortschritts-Overlay**
  über die Liste, damit der Benutzer nicht weiterklickt und sieht, dass im
  Hintergrund etwas passiert. (Portiert aus dem Schulz-Ribbon-Command
  `createTimeReport`.)
- **Freitext-Suche** über Titel, Typ, Datum, **Projektnummer** und
  **Ressourcenname** (`sst_resource_ref.name`) — über die **gesamte**
  serverseitig gefilterte Ergebnismenge (nicht nur eine Seite).
- **Zeitraum-Filter & Sortierung** — der Zeitraum-Filter (**Alle / Heute / Diese
  Woche / Dieser Monat**, nach `sst_date`) sitzt in einer Unter-Toolbar; die
  Sortierung (**Datum neueste/älteste, Projekt, Ressource, Dauer**) ist ein
  kompaktes **Sortier-Icon** in der oberen Zeile neben dem Suchfeld und öffnet ein
  eigenes, bibliotheksfreies Dropdown (schließt per Klick-außerhalb / Esc,
  Tastatur-Navigation). Beide wirken clientseitig auf die geladene Menge — also
  sofort. Die Befehlsleiste zeigt **keine Datensatz-Anzahl** (sie verursachte
  beim Filterwechsel einen Layout-Sprung und wird nicht benötigt).
- **Treffer-Hervorhebung** — passende Teilstrings werden beim Tippen im
  Karten-Titel und in den Chips hervorgehoben.
- **Pull-to-Refresh (Mobil)** — auf dem Handy die Liste über die Schwelle nach
  unten ziehen, um vom Server neu zu laden (gedämpfter Zieh-Indikator + Spinner).
- **Leerzustand** — wenn keine Einträge passen (oder eine Suche keine Treffer
  liefert), zeigt die Liste ein Fernglas-Symbol und einen kurzen 1-Zeiler statt
  einer leeren Fläche.
- **Schalter „Meine Stunden ↔ Alle Stunden"** (Default **Meine Stunden**) — ein
  kompakter Umschalter: **Aus = meine Stunden**, **An = alle Stunden**. „Meine
  Stunden" filtert auf Einträge, deren Ressource dem aktuellen Benutzer gehört —
  die `bookableresource`(s) des Benutzers werden über `_userid_value` ermittelt,
  und die Listen-Abfrage wird serverseitig über `_sst_resource_ref_value` darauf
  eingeschränkt. Der Schalter ist **gesperrt auf „Aus" (meine Stunden)** für alle
  Benutzer; nur Inhaber der Rolle **System Administrator** oder **SST | Dispo
  Teamleitung Addon** können ihn einschalten (alle Stunden sehen). Rollenprüfung
  über `systemuserroles_association` (direkt zugewiesene Rollen).
- Statuspunkt je Karte (offen = rot, aufgeteilt = grün).

### Detail-Aufteilung (rechts)
- **Detail-Titel gekürzt** auf **Projekt-ID / Booking-Nummer** (z. B.
  `P10006786 / S-120044`) — Tätigkeitsart und Datum stehen bereits in der
  Unterzeile. Die Booking-Nummer ist der Anzeigewert der `bookableresourcebooking`.
- Auswahl eines Eintrags lädt die zugehörigen Work-Subtype-Zeilen
  (`sst_roundedtimeentryworksubtypes`, gefiltert über
  `_sst_roundedtimeentry_value`) und sortiert sie in der kanonischen Reihenfolge
  Normal → Überstunden → Nacht/Sonntag → Feiertag.
- Pro Subtype ein **editierbares Stundenfeld** (`sst_timevalue`). Eingaben
  akzeptieren Komma und Punkt als Dezimaltrenner.
- **Intelligente Vorbelegung (★-Button)** — ein kleiner Stern-/KI-Button im
  Panel-Kopf füllt die Verteilung **auf Klick** aus **Datum + Gesamtdauer** (der
  Benutzer kann weiterhin anpassen). **Standardmäßig ausgeblendet** — per
  Manifest-Property `showSuggestButton` einblendbar (Wert `show`). Regeln:
  - **Feiertag** → alles auf *Feiertag*.
  - **Sonntag** → alles auf *Nacht / Sonntag*.
  - **Arbeitstag ≤ 8 h** → alles auf *Normal*; **> 8 h** → 8 h auf *Normal*, Rest
    auf *Überstunde*.
  Feiertage werden live über die Kette **Eintrag → `sst_resource_ref`
  (bookableresource) → `sst_site_ref` (sst_site) → `sst_country_ref`
  (sst_country)** ermittelt, dann `sst_publicholiday`-Datensätze des Landes, deren
  Bereich `[sst_startdate_dat, sst_enddate_dat]` das Datum abdeckt. Best-effort:
  fehlt ein Glied oder fehlt die Leseberechtigung, gilt der Tag als normaler
  Arbeitstag. Subtype-Zeilen werden per Schlüsselwort gematcht (robust gegen
  Überstunde/Überstunden).
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
- **Transaktionaler Ablauf:** Zuerst wird alles **lesend vorbereitet** (Original
  lesen, Zeiterfassungsart über den Key (paytype, timetype) auflösen, Lookup-
  `@odata.bind`-Ziele auflösen, Create-Payloads je Subtype bauen, zugehörige
  Pausen ermitteln). Dann laufen **alle Änderungen als ein einziges
  `$batch`-Changeset** (alles-oder-nichts) gegen den Web-API-`$batch`-Endpunkt.
  Ist der Endpunkt im Host nicht erreichbar/autorisiert, greift ein
  **Kompensations-Fallback** über `context.webAPI`: Schlägt das Löschen des
  Originals fehl, werden die bereits angelegten Splits wieder gelöscht (und das
  Original ent-markiert) — so bleiben nie Duplikate oder ein verwaistes Original
  zurück. Inhaltlich (entspricht der ursprünglichen Custom Page):
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
     gegen das Label). `sst_worktype_title_str` wird mit dem `sst_title_str` des
     gefundenen Worktypes gefüllt. Das passende `sst_worktype`-Record wird beim
     Speichern ermittelt (einmalige Abfrage aller `sst_worktypes`, Label→Wert aus
     deren Formatted Values). Findet sich kein Treffer, bleibt die Zeiterfassungsart
     leer — dann wird ein **`split.worktypeUnresolved`-Warn-Event** geloggt
     (`entryId`, `subtype`, `paytype`, `timetype`, `reason`), damit Lücken in der
     `sst_worktype`-Pflege im Trace sichtbar sind statt still.
  3. Markiert das Original **und zugehörige Pausen** (gleicher Arbeitsauftrag,
     `sst_type = Pause`) als `sst_worksubtypecompleted = Ja`.
  4. Löscht das Original — die Kind-Subtype-Zeilen werden über die
     Cascade-Delete-Beziehung automatisch mitentfernt.
- Erfolgs-/Fehler-Toast. **Optimistisches Listen-Update:** Nach dem Speichern
  (bzw. Zuordnen) verlassen die betroffenen Zeilen den aktuellen Filter und werden
  **lokal** aus der Liste entfernt — kein Full-Reload, kein Flackern. Ein
  Moduswechsel oder das Umschalten von „Meine Stunden" lädt frisch vom Server.
  `createTimeReports` liefert die tatsächlich zugeordneten IDs zurück, sodass bei
  Teilfehlern nur die erfolgreich verarbeiteten Zeilen entfernt werden.

### @odata.bind robust
- Beim Anlegen der Split-Records werden die Lookup-Ziele
  (`@odata.bind`-Navigation-Properties + Ziel-EntitySets) zur Laufzeit aus den
  Lookup-Annotationen des Originals und `Utility.getEntityMetadata` aufgelöst —
  die Verknüpfungen zu Arbeitsauftrag/Buchung/Projekt überleben die Aufteilung
  unabhängig von der Ziel-Tabelle.

### Adaptiv (Desktop + Mobil)
- **Ein Control, drei Layouts** — zur Laufzeit über
  `context.client.getFormFactor()` (mit Breiten-Fallback) und die aktuelle
  Container-Größe gewählt:
  - **Desktop / Tablet** → zweispaltiges Master/Detail-Layout (unverändert).
  - **Handy (Hochformat)** → einspaltiger, touch-first Flow: Liste in voller
    Breite → Eintrag antippen → Vollbild-Split-Editor mit **‹ Zurück**-Header →
    nach dem Speichern zurück zur Liste. Größere Tap-Targets, große Zahlenfelder,
    am unteren Rand fixierter Speichern-Button. Jede Subtype-Zeile ist **eine
    kompakte Zeile** — **Label + +/−-Stepper + schmales Zahlenfeld** (±0,25 h,
    nicht unter 0) —, damit alle Subtypes auf einen Blick sichtbar sind; per
    Stepper tippen oder direkt eingeben.
  - **Handy (Querformat)** → das zweispaltige **Cockpit**: Liste + Split-Editor
    nebeneinander unter einer kompakten, einzeiligen Befehlsleiste — das breite,
    aber niedrige Querformat wird nicht mehr durch gestapelte Toolbars über einer
    verborgenen Liste verschwendet. Behält die Touch-Ergonomie (Pull-to-Refresh,
    große Stepper); kein **‹ Zurück** nötig, da beide Spalten sichtbar sind. Beim
    Drehen wechselt das Control live zwischen Hochformat-Einspalter und
    Querformat-Cockpit (anhand der zugewiesenen Breite/Höhe; ab ≥ 640px Breite,
    kleine Phones bleiben einspaltig).
- **Einklappbare Filterleiste (Phone)** — die Leiste aus Suche + Modus +
  Zeitraum + Sortierung klappt (animiert) auf eine **einzeilige Zusammenfassung**
  zusammen (`🔍 Zuordnen · Alle · Datum (neueste) ⌄`), per *„Filter
  ausblenden"*-Zeile — so bleibt die Liste maximal sichtbar; Antippen der
  Zusammenfassung klappt sie wieder aus. Die Zusammenfassung spiegelt die aktiven
  Filter live wider und zeigt einen Such-Punkt. Desktop unverändert
  (Leiste immer voll). Respektiert `prefers-reduced-motion`.
- Beim Hinzufügen zur View dasselbe Control **Web + Tablet + Phone** zuweisen —
  kein separater Mobil-Build zu pflegen.

### Telemetrie / Logging
- Ein kleiner strukturierter Logger (`telemetry.ts`) schreibt in den
  PCF-Diagnose-Trace (`context.tracing`) **und** die Konsole — beides
  abgesichert, sodass Logging das Control nie bricht. Die **destruktiven
  Operationen** sind als getimte Vorgänge mit Fortschritts-Schritten und einem
  **Stage-Marker** instrumentiert: Die Aufteilung loggt `splitSave.start` →
  `splitSave.splitsCreated` → `splitSave.pausesCompleted` → `splitSave.ok` (bzw.
  `splitSave.fail` mit der erreichten Stage — ein Fehler zwischen *splitsCreated*
  und *deleteOriginal* ist damit eindeutig diagnostizierbar). Die
  Lieferschein-Erstellung loggt `createReports.*` (je Lieferschein + Ergebnis),
  Ladefehler `loadEntries`.

### Mehrsprachigkeit
- **Dreisprachige Oberfläche** (Deutsch / Englisch / Französisch), automatisch
  nach `context.userSettings.languageId`.

### Offline (gesperrt — Verbindung erforderlich)
- **Online** → Live-Server-Abfragen + `$batch`-Save (wie oben).
- **Offline** → das Control **sperrt** und zeigt eine klare
  **„Verbindung erforderlich"**-Ansicht mit **„Erneut versuchen"**-Button — **keine**
  gecachte Liste. Grund: Das Control braucht die Live-Web-API für **beides** — die
  modusgefilterte Liste **und** den transaktionalen Aufteilen-/Zuordnen-Save. Eine
  schreibgeschützte Offline-Ansicht könnte nur **veraltete, statusfalsche Zeilen**
  zeigen (z. B. einen bereits aufgeteilten Eintrag unter *Aufteilen*). Sperren ist
  ehrlich und vermeidet diese Verwirrung.
- Es vertraut `isOffline()` **nicht** blind (der Wert meldet beim Kaltstart teils
  fälschlich „offline"): es **probiert die Live-Web-API** (mit ~7 s Timeout) und zeigt
  die Sperr-Ansicht, wenn dieser Call **fehlschlägt**. Im Offline-Modus liefert die
  Web-API allerdings ein *leeres Ergebnis als Erfolg* — eine leere Liste bei Offline-
  Hinweis ist also mehrdeutig (offline vs. echt leere Online-Liste). Zur Auflösung
  feuert das Control einen **echten Online-Check**: da `context.webAPI` kein WhoAmI hat,
  liest es die **eigenen Sicherheitsrollen** des Users — online kommt ≥1 Rolle zurück,
  offline schlägt der Call fehl bzw. die Rollen sind nicht im Cache. So blockt eine leere
  Liste nur, wenn dieser Check offline bestätigt; eine echt leere **Online**-Liste wird
  normal angezeigt. Während der Probe zeigt es **„Verbinde…"**; bei Erfolg geht es direkt
  in die normale Online-Ansicht — **ohne** manuelles Offline→Online-Toggle. **„Erneut
  versuchen"** stößt die Probe neu an, sodass ein gerade wieder verbundenes Gerät mit
  einem Tipp weiterarbeitet.
- `WebAPI`/`Utility` sind **`required="false"`**, damit der Host das Control (und
  damit die „Verbindung erforderlich"-Ansicht) überhaupt rendert, statt mit einem
  generischen „Control kann nicht geladen werden" zu scheitern.
- **Empfehlung:** Da das Control offline ohnehin nicht arbeiten kann, die App bzw.
  die Tabelle `sst_roundedtimeentries` aus dem **mobilen Offline-Profil** nehmen
  (oder Offline für die App deaktivieren), damit sie immer online läuft. Voll
  **schreibfähiges** Offline (Option C) ist zurückgestellt — siehe
  [`OfflinePlan.md`](OfflinePlan.md).

## Konfiguration (Manifest-Properties)
Im Maker sind nur zwei Properties sichtbar: das gebundene Dataset `entries` und
`showSuggestButton`.
- `showSuggestButton` — steuert den **★-Vorschlag-Button** im Aufteilen-Detail.
  **Standard: ausgeblendet.** Auf `show` (bzw. `true`/`yes`/`ja`/`1`) setzen, um
  ihn einzublenden.

Die Feld-Mapping-Overrides (`totalField` = `sst_duration`, `dateField` =
`sst_date`, `typeField` = `sst_type`, `pauseValue` = `Pause`, `completedField` =
`sst_worksubtypecompleted`, `subtypeField` = `sst_workordersubtype`) sind
**deaktiviert** — die verifizierten SST-Defaults aus `schema.ts` gelten, damit
die Maker-Oberfläche aufgeräumt bleibt. Zum Reaktivieren die jeweilige
`<property>` in `ControlManifest.Input.xml` und ihren Read in `index.ts`
einkommentieren.

## Annahmen / Hinweise
- Die Work-Subtype-Zeilen je Eintrag werden als bereits vorhanden angenommen
  (Anlage erfolgt vorgelagert, z. B. per Flow); das Control bearbeitet deren
  Werte und schreibt die Split-Records.
- Als Gesamtzeit wird `sst_duration` gelesen (die Custom Page nannte sie
  „Stunden"); abweichende Schemas über `totalField` anpassen.
- Schema verifiziert gegen den SSTCore-Solution-Export. Vor Produktiv-Einsatz
  des destruktiven Speicherns die Logical Names gegen das Ziel-Environment
  (INT-11) gegenprüfen.
