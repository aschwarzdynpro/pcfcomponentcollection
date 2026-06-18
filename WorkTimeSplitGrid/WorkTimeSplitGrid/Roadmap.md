# WorkTimeSplitGrid — Roadmap

Ideensammlung für Erweiterungen/Verbesserungen, nach Wirkung sortiert. Status:
🔜 geplant · 🚧 in Arbeit · ✅ erledigt.

## 1. Datenintegrität & Zuverlässigkeit (höchstes Risiko)
Der destruktive Save (Subtypes updaten → Splits anlegen → Original + Pausen
„completed" → Original löschen) ist die einzige Stelle, die echten Datenschaden
anrichten kann.

- 🔜 **Atomare Aufteilung** über einen `$batch`-Changeset (alles-oder-nichts).
  Caveat: PCF-`webApi` kann kein Batch → direkter Aufruf des `$batch`-Endpunkts
  oder Zwischenlösung (sichere Reihenfolge + Cleanup bei Fehler).
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
2. Atomare/abgesicherte Aufteilung (1) — schützt die einzige gefährliche Stelle.
3. ~~Zeitraum-/Filter-Chips + Sortierung (3)~~ — ✅ erledigt (v1.8.0).
