# Record Audit History – Funktionsübersicht

Das PCF-Control zeigt im Hauptformular den **Überwachungsverlauf des geöffneten
Datensatzes**. Es entspricht dem Datensatz-Modus der Code App „Audit Explorer“
und steht direkt am Datensatz, ohne Wechsel in eine andere App.

## Was es zeigt

- **Ereignisliste nach Tag:** Uhrzeit, Aktion (Erstellen, Aktualisieren,
  Zuweisen, Aktivieren …), Benutzer und eine Vorschau der geänderten Spalten.
  Einträge lassen sich aufklappen, auch mehrere gleichzeitig zum Vergleich.
- **Änderungen je Eintrag:** alter und neuer Wert mit Spaltenanzeigename, Labels
  von Auswahl-, Status- und Ja/Nein-Feldern, Namen verknüpfter Datensätze
  sowie Datum und Zahlen im Format der Benutzersprache. Technische Spalten
  (z. B. „Geändert am“, Versionsnummer) sind eingeklappt.
- **Spaltenfilter:** Wählt man eine Spalte, zeigt das Control ihren
  Werteverlauf als Tabelle: Wann, Von, Nach, Wer.
- **Leeres Ergebnis mit Begründung:** Das Control sagt, *warum* nichts da ist:
  Überwachung für die Tabelle aus, Datensatz älter als die Aufbewahrungsfrist,
  oder Überwachung an und tatsächlich keine Änderung.
- **Hinweise:** Überwachung der Organisation oder Tabelle ausgeschaltet,
  Aufbewahrungsfrist und Zeilenlimit, dazu eine aufklappbare Liste der Spalten,
  die **nicht überwacht** werden.
- **Sprache:** Deutsch oder Englisch, je nach Benutzersprache.

## Einrichtung

1. Solution `RecordAuditHistory_managed.zip` importieren.
2. Im Formular-Designer einen Reiter oder Abschnitt „Änderungsverlauf“ anlegen
   und eine beliebige Spalte hinzufügen, z. B. den Namen.
3. Unter **Komponenten → Record Audit History** die Spalte binden und die
   Beschriftung ausblenden.
4. Optional „Maximale Höhe (px)“ setzen, damit das Formular nicht beliebig lang
   wird.

## Voraussetzungen

- Die Überwachung ist für Organisation und Tabelle eingeschaltet.
- Die Rolle des Benutzers hat die Rechte „Überwachungsverlauf anzeigen“ und
  „Überwachungszusammenfassung anzeigen“. Fehlen sie, meldet das Control das
  ausdrücklich.

## Grenzen

- Beziehungsänderungen (Verknüpfen/Trennen) und Lesezugriffe zeigen keine
  Spaltenänderungen.
- Zeiten erscheinen in der Zeitzone des Browsers.
- Offline (mobile App) ist kein Verlauf verfügbar.
