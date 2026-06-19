# WorkTimeSplitGrid — Offline-Fähigkeit (Option C) — Plan & Status

> **Status (v1.15.0, Branch `feature/worktime-split-grid-offline`):**
> **Iteration 1 umgesetzt** — Phase 1 (Lesen aus dem Dataset) + Phase 3
> (Kompensations-Save ohne `$batch`) sind im Code; Manifest-Features auf
> `required="false"`. **NOCH OFFEN & blockierend: Phase 0** (Validierung auf
> echtem Gerät) sowie die Phasen 2/4-Härtung. Heißt: Der Code ist da, aber das
> tatsächliche Offline-Verhalten (greift `context.webAPI` offline? hat der View/
> das Offline-Profil die nötigen Spalten?) ist noch **nicht gerätegetestet**.
> Vorgeschichte: bis v1.14.x fiel das Control offline auf einen generischen
> Fehler; Option A (Offline-Hinweis) war der erste Schritt.

## 1. Warum es heute offline nicht geht
Das Control ist ein **Live-Daten-Editor**:
- **Liste:** `loadEntries` → `webApi.retrieveMultipleRecords` mit **`$expand`**
  (Projektnummer, Ressource) und einem **tabellenübergreifenden Navigations-
  `$filter`** (`sst_Project_id/hso_projecttype ne 100000001`) + `$orderby`.
- **Rollenprüfung:** `retrieveRecord` auf `systemuser` mit
  `$expand=systemuserroles_association`.
- **„Meine Stunden":** `bookableresource` über `_userid_value`.
- **Subtypes / Worktype:** weitere Live-`retrieveMultipleRecords`.
- **Speichern:** roher `fetch` auf `/api/data/v9.2/$batch` (atomar) + Kompensations-
  Fallback über `webApi` (create/update/delete).

Offline-Killer: Die **Offline-Query-Engine** unterstützt kein `$expand`, keine
tabellenübergreifenden Navigations-Filter und nur eine Teilmenge an Operatoren/
Funktionen; der `$batch`-`fetch` braucht zwingend den Server.

## 2. Grundsätzliche Hürden
1. **Query-Engine:** kein `$expand`/Nav-Filter offline → Lese-Logik muss umgebaut
   werden (Dataset statt Live-Query, clientseitige Filter).
2. **`context.webAPI` offline (PCF):** unklar, ob Reads/Writes offline in den
   lokalen Cache / die Sync-Queue geroutet werden. Das **gebundene Dataset** IST
   offline-aware; `context.webAPI` evtl. NICHT. → **muss empirisch geprüft werden.**
3. **Verknüpfte Daten:** Projekt-Typ `hso_projecttype` liegt am **Projekt**,
   nicht an der RTE → offline kein Join. Ebenso Ressource→User (My-Hours),
   Worktype-Mapping.
4. **Destruktives, transaktionales Speichern:** offline kein `$batch` (keine echte
   Transaktion); Original-**Löschen** + Splits-Anlegen werden in die Sync-Queue
   gestellt → **Sync-Konflikt-Risiko** (Original serverseitig zwischenzeitlich
   geändert/gelöscht).
5. **Offline-Profil (Admin):** alle benötigten Tabellen + Spalten + Beziehungen
   müssen im Offline-Profil der App liegen (Datenmenge/Sicherheit beachten).

## 3. Lösungsskizze (Phasen)

### Phase 0 — Empirische Verifikation (Voraussetzung, blockierend)
In einer **echten Offline-App** auf dem Gerät testen:
- Funktioniert `context.webAPI.retrieveMultipleRecords/createRecord/updateRecord/
  deleteRecord` offline? Oder braucht es das Dataset (Lesen) bzw. einen anderen
  Schreibweg?
- Welche `$filter`-Operatoren/Funktionen erlaubt die Offline-Engine? (kein
  `$expand`/Nav-Filter — bestätigen.)
- Gehen `create/delete` offline in die Sync-Queue und werden sauber gemerged?

> Ohne diese Fakten kein belastbarer Bau. Achtung: Die `dataverse-*-tester`-
> Subagenten testen **online** — Offline-Mobile lässt sich damit nicht prüfen;
> es braucht ein echtes Gerät/Emulator mit konfiguriertem Offline-Profil.

### Phase 1 — Lesepfad auf die Offline-Quelle umstellen
- Liste **nicht** mehr via `loadEntries` (live), sondern aus dem **gebundenen
  Dataset** (offline-aware) bauen → zurück zu einem `buildRows(dataset)`-Ansatz.
- Filter (Modus, Pause, Festpreis, My-Hours) **clientseitig** über Dataset-Spalten
  statt im Server-`$filter`.
  - **Projekt-Typ:** `hso_projecttype` ist am Projekt → offline nur lesbar, wenn
    die View eine **verknüpfte Spalte** führt UND diese offline gecached ist.
    Robuster: **denormalisierte Spalte auf der RTE** (z. B. `sst_projecttype_opt`)
    per Flow/Formelspalte pflegen → offline lokal filterbar. *(Schema-Erweiterung)*
  - **My-Hours:** Ressource→User offline → denormalisiertes Feld am Eintrag oder
    My-Hours offline ausblenden.
- Titel/Ressource/Datum: aus Dataset-Spalten (View muss sie führen).
- Suche/Sortierung/Zeitraum: bleiben clientseitig (laufen heute schon so).
- **Hybrid:** online weiter den heutigen Live-Pfad nutzen (volle Datenmenge,
  keine View-Abhängigkeit); offline auf den Dataset-Pfad umschalten
  (`context.client.isOffline()`).

### Phase 2 — Subtypes & Worktype offline
- **Subtypes:** Kind-Tabelle (`sst_roundedtimeentryworksubtypes`) ins Offline-
  Profil; laden über die Dataset-Beziehung oder offline-fähige Query.
- **Worktype:** entweder `sst_worktypes` offline cachen und Mapping clientseitig,
  **oder** Worktype gar nicht im Client setzen, sondern serverseitig beim Sync per
  Plugin/Flow (robuster, weniger Offline-Datenbedarf).

### Phase 3 — Speichern offline-fähig
- Offline **kein `$batch`** → immer den **Kompensations-/`webApi`-Pfad** nehmen
  (greift heute schon, wenn `$batch` „unavailable"). Verifizieren, dass
  `create/update/delete` offline in die Sync-Queue gehen.
- **Atomicity:** offline keine echte Transaktion. Reihenfolge beibehalten (Delete
  zuletzt) + **serverseitiges Aufräum-Plugin beim Sync** (Duplikat-/Waisen-
  Erkennung), da die clientseitige Kompensation bei App-Schließen nicht greift.
- **Sync-Konflikte:** Original könnte serverseitig schon geändert/gelöscht sein →
  Konfliktstrategie definieren (last-writer-wins vs. Block + Hinweis).

### Phase 4 — UX & Offline-Profil
- Offline-Indikator („Änderungen werden bei Verbindung synchronisiert").
- **Offline-Profil-Doku** (Admin): RTE + Subtypes + Projekt (inkl. Typ-Spalte) +
  BookableResource + Worktype + `msdyn_workorder`, jeweils mit nötigen Spalten/
  Beziehungen.

## 4. Empfohlene Alternative (statt vollem C)
Der destruktive, transaktionale Save ist offline ein **Sync-Konflikt-Minenfeld**.
Pragmatischer:
- **Offline read-only:** Übersicht aus dem Dataset anzeigen, aber Aufteilen/
  Zuordnen offline sperren (Hinweis „nur online"). Deutlich kleiner, vermeidet das
  Schreib-/Konfliktrisiko. **Empfohlen**, falls Offline überhaupt nötig.
- **Option B (Config):** Ansicht/Control im Offline-Profil ausklammern — heute via
  Option A schon sauber abgefangen (kein Crash, klarer Hinweis).

## 5. Offene Entscheidungen
- Muss offline **geschrieben** werden, oder genügt **read-only**?
- Bereitschaft zur **Schema-Erweiterung** (denormalisierte Spalten Projekt-Typ /
  Ressource-User auf der RTE)?
- Welche Tabellen dürfen ins **Offline-Profil** (Datenmenge/Sicherheit)?
- Worktype clientseitig (offline cachen) oder serverseitig beim Sync setzen?

## 6. Aufwand (grobe Schätzung)
| Umfang | Aufwand |
|---|---|
| Phase 0 (Verifikation, echtes Gerät) | 0,5–1 Tag |
| Read-only-Offline (Dataset-Lesepfad + Sperre) | 1–2 Tage |
| Phase 1–2 (Lesen + Subtypes/Worktype offline) | 3–5 Tage |
| Phase 3 (Schreiben + Sync + Aufräum-Plugin + Tests) | 3–6 Tage |
| + Schema-Erweiterungen / Offline-Profil-Setup | separat, Admin/Dev |

**Fazit:** Voll-Offline mit destruktivem Save ist machbar, aber teuer und mit
Sync-Konfliktrisiko. Realistische Stufen: **A** (erledigt) → bei Bedarf
**read-only Offline** → nur falls zwingend, voll schreibfähiges Offline.
