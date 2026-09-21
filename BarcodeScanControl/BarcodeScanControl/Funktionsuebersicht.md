# BarcodeScanControl — Funktionsübersicht

PCF-Control für **Canvas-Apps**: eine formatfüllende Schaltfläche, die den
nativen Barcode-/QR-Scanner des Geräts über `Device.getBarcodeValue()` öffnet
und den gelesenen Code als **einfachen, fest typisierten Text** bereitstellt.

## Warum nicht der eingebaute Barcodeleser?

Der Standard-`BarcodeReader` liefert sein Ergebnis über ein **dynamisches
Schema**: `Barcodes` ist als `Object` deklariert und wird erst dann zur Tabelle
`{ Value, Type }`, wenn Power Apps Studio das Control interaktiv einfügt. Diese
Auflösung geht verloren,

- sobald die App aus dem YAML geladen wird (`pac canvas pack`, code-first),
- sobald eine Komponente aus einer Komponentenbibliothek importiert wird.

`Barcodes` ist dann ein Datensatz ohne Felder, `First(…).Value` kompiliert
nicht mehr, und zur Laufzeit bricht der Player mit *„JSON-Analysefehler: Objekt
erwartet, Array erhalten"* ab. Belegt am 10.09.2026 an `BarcodeReader@1.0.25`,
Studio 3.26084.

Dieses Control hat kein dynamisches Schema. Die Ausgaben sind
`SingleLine.Text` und `Whole.None` — jeder Round-Trip lässt sie unangetastet.

## Eigenschaften

| Name | Richtung | Typ | Bedeutung |
|---|---|---|---|
| `value` | Ausgabe | Text | Text des letzten erfolgreichen Scans. Leer bis dahin. |
| `scanCount` | Ausgabe | Ganze Zahl | Zählt **jeden** erfolgreichen Scan hoch — auch beim zweiten Scan desselben Codes —, damit `OnChange` verlässlich feuert. |
| `errorMessage` | Ausgabe | Text | Lokalisierter Fehlertext, wenn der Scanner nicht verfügbar ist (Studio, Browser) oder abgelehnt hat. Leer bei Erfolg **und** bei einem schlichten Abbruch durch den Benutzer. |
| `buttonText` | Eingabe | Text | Beschriftung. Leer → lokalisierter Standard (*Code scannen* / *Scan code* / *Scanner le code*). |
| `fillColor` | Eingabe | Text | CSS-Farbe des Hintergrunds. Standard `#0F6CBD`. |
| `textColor` | Eingabe | Text | CSS-Farbe für Beschriftung und Symbol. Standard `#FFFFFF`. |
| `fontSize` | Eingabe | Ganze Zahl | Schriftgröße in px. Standard `16`. |

## Verwendung in einer Canvas-App

```
// pcfQR.OnChange
If( pcfQR.scanCount > varLastScan,
    Set( varLastScan, pcfQR.scanCount );
    Set( varCode, pcfQR.value );
    // … mit varCode weiterarbeiten …
);
If( !IsBlank( pcfQR.errorMessage ),
    Notify( pcfQR.errorMessage, NotificationType.Error ) )
```

Auf `scanCount` prüfen, nicht auf `value`: `OnChange` feuert beim Laden einmal
mit leeren Ausgaben, und ein Zweitscan desselben Codes bliebe sonst stumm.

## Plattform

- `Device.getBarcodeValue` gibt es in **Power Apps Mobile** (Android, iOS,
  Windows). Im Studio und im Browser-Player wird die Schaltfläche gezeichnet,
  meldet aber über `errorMessage` *„Scannen ist nur in Power Apps Mobile …
  verfügbar"*.
- `feature-usage` steht bewusst auf `required="false"`, damit das Control
  überall lädt und über `errorMessage` degradiert statt mit einem generischen
  „kann nicht geladen werden".
- In der Umgebung muss **Power Apps component framework für Canvas-Apps**
  eingeschaltet sein (Umgebungseinstellungen → Features).
- Dreisprachige Oberfläche (DE / EN / FR) aus `context.userSettings.languageId`.

## Build

```powershell
cd BarcodeScanControl\BarcodeScanControl.Solution
./build.ps1
```

Ergebnis: `bin\BarcodeScanControl.zip` (unmanaged) und
`bin\BarcodeScanControl_managed.zip` (managed) sowie versionierte Kopien.
