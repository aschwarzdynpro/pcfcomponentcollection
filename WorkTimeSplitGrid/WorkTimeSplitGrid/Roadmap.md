# WorkTimeSplitGrid — Roadmap

Ideensammlung für Erweiterungen/Verbesserungen, nach Wirkung sortiert. Status:
🔜 geplant · 🚧 in Arbeit · ✅ erledigt.

## 1. Datenintegrität & Zuverlässigkeit (höchstes Risiko)
Der destruktive Save (Subtypes updaten → Splits anlegen → Original + Pausen
„completed" → Original löschen) ist die einzige Stelle, die echten Datenschaden
anrichten kann.

- ✅ **Atomare Aufteilung** über einen `$batch`-Changeset (alles-oder-nichts),
  mit Kompensations-Fallback über `context.webAPI`, falls der `$batch`-Endpunkt
  im Host nicht erreichbar ist. — *v1.11.0; Rollback live gegen UAT verifiziert.*
- 🔜 **Optimistic Concurrency (ETag)** — verhindert das Überschreiben bei
  parallelem Bearbeiten desselben Eintrags.
- 🔜 **Retry bei transienten Fehlern** (429/Timeout) statt sofortigem Toast.

## 2. Performance & gefühlte Geschwindigkeit
- ✅ **Optimistisches Listen-Update** statt Full-Reload nach jedem Save: die
  bearbeitete Zeile lokal entfernen (sie verlässt den Filter ohnehin) → kein
  Flackern. — *v1.8.2.*
- 🔜 **`$batch` für die vielen `updateRecord`-Calls** (Subtypes, Pausen) →
  weniger Round-Trips.
- 🔜 **Worktype-Cache**: `resolveWorktypes` lädt aktuell bei jedem Save alle
  `sst_worktypes` — einmal pro Session cachen.
- 🔜 **Serverseitige Suche** (debounced), falls gefilterte Sets über den
  Paging-Cap wachsen.

## 3. Produktivität im Alltag
- ✅ **Zeitraum-Filter** (Alle / Heute / Woche / Monat) + **Sortierung** (Datum,
  Projekt, Ressource, Dauer). — *v1.8.0; clientseitig über die geladene Menge.*
- 🚧 **Intelligente Vorbelegung der Aufteilung** (Datum + Dauer): Sonntag →
  Nacht/Sonntag, Arbeitstag ≤8h → Normal, >8h → 8h Normal + Rest Überstunde. —
  *v1.17.0 (Phase 1).* **Phase 2:** Feiertagsregel (`isHoliday`-Stub wartet auf
  die Regel) → alles auf Feiertag.
- 🔜 **Projekt-/Arbeitsauftrags-Filter** (zusätzliche Chips).
- 🔜 **„Alle auswählen" / „Alle eines Arbeitsauftrags"** im Zuordnen-Modus +
  **Summenanzeige** (Σ ausgewählte Stunden).
- 🔜 **Mehrfach-Aufteilung / Vorlagen**: gleiche Verteilung auf mehrere Einträge,
  Auto-Split-Presets.
- 🔜 **Vorschau vor Lieferschein-Erstellung** (was je AA entsteht) inkl.
  detaillierter Teilfehler.

## 4. UX-Feinschliff & Accessibility
- 🔜 **Tastatur-Navigation** in der Liste (Pfeile, Enter), **Fokus-Trap + Esc**
  in den Modals.
- 🔜 **Manueller Refresh-Button** (serverseitige Änderungen sieht man sonst erst
  bei Moduswechsel).
- ✅ Suchtreffer hervorheben; Pull-to-Refresh auf Mobil. — *v1.9.0.*
- ✅ **Touch-Stepper (+/− 0,25 h)** für die Zeiteingabe im Aufteilen-Editor
  (mobil), in eigener Zeile voller Breite. — *v1.13.0.*

## 4b. Offline
- ✅ **Offline-Hinweis statt Fehler** (`context.client.isOffline()`) — *v1.14.0
  (Option A); Manifest `required="false"` v1.14.2.*
- ✅ **Read-only Offline** — *v1.16.0 auf Branch `feature/worktime-split-grid-offline`*:
  Liste aus dem (offline-gecachten) Dataset; **schreibende Aktionen offline
  deaktiviert** (Aufteilen-Save + Lieferschein-Erstellung). Damit kein
  Sync-Konflikt-Risiko. Siehe [`OfflinePlan.md`](OfflinePlan.md).
- 🔜 **Voll schreibfähiges Offline (Option C)** — *zurückgestellt*: destruktiver,
  transaktionaler Save offline = Sync-Konflikt-Minenfeld; bräuchte Schema-
  Erweiterung + serverseitiges Aufräum-Plugin + Konfliktstrategie. Nur bei
  zwingendem Bedarf.

## 5. Qualität & Wartbarkeit
- 🔜 **Unit-Tests** für die reinen Funktionen (`parseNumber`, Filteraufbau,
  Worktype-Key, Summen-Guard) — sichert gegen Regressionen ab.
- 🔜 **Mehr Manifest-Properties** (Ressourcen-/Projektfeld) → Wiederverwendung in
  anderen Orgs.
- ✅ **Telemetrie/Logging** für die destruktiven Operationen. — *v1.10.0;
  `telemetry.ts` → `context.tracing` + Konsole; Stage-Marker bei `splitSave`.*

---

### Empfohlene Reihenfolge (Top 3)
1. ~~Optimistisches Listen-Update (2)~~ — ✅ erledigt (v1.8.2).
2. ~~Atomare/abgesicherte Aufteilung (1)~~ — ✅ erledigt (v1.11.0).
3. ~~Zeitraum-/Filter-Chips + Sortierung (3)~~ — ✅ erledigt (v1.8.0).
