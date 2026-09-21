# BarcodeScanControl

A PCF control for **canvas apps**: one full-size button that opens the native
device barcode / QR scanner through `Device.getBarcodeValue()` and exposes the
scanned code as **plain, statically typed text**.

## Why not the built-in Barcode reader?

The first-party `BarcodeReader` control publishes its result through a
**dynamic schema** (`Barcodes` is declared as `Object`, resolved to a table of
`{ Value, Type }` only when Power Apps Studio inserts the control interactively).
That resolution does not survive:

- loading the app from YAML (`pac canvas pack`, code-first development),
- importing a component from a component library.

In both cases `Barcodes` degrades to a field-less record, `First(…).Value` fails
to compile and the runtime aborts with *"JSON parse error: expected object, got
array"*. Verified 2026-09-10 on `BarcodeReader@1.0.25`, Studio 3.26084.

This control has no dynamic schema at all. Its outputs are `SingleLine.Text`
and `Whole.None`, so any round-trip keeps them intact.

## Properties

| Name | Usage | Type | Description |
|---|---|---|---|
| `value` | output | Text | Text of the most recent successful scan. Empty until then. |
| `scanCount` | output | Whole number | Increments on **every** successful scan — also when the same code is scanned twice — so `OnChange` fires reliably. |
| `errorMessage` | output | Text | Localized text when the scanner is unavailable (Studio, browser) or rejected. Empty on success **and** on a plain user cancel. |
| `buttonText` | input | Text | Caption. Empty → localized default (*Code scannen* / *Scan code* / *Scanner le code*). |
| `fillColor` | input | Text | CSS color for the background. Default `#0F6CBD`. |
| `textColor` | input | Text | CSS color for caption and icon. Default `#FFFFFF`. |
| `fontSize` | input | Whole number | Caption size in px. Default `16`. |

## Using it in a canvas app

```
// pcfQR.OnChange
If( pcfQR.scanCount > varLastScan,
    Set( varLastScan, pcfQR.scanCount );
    Set( varCode, pcfQR.value );
    // … do something with varCode …
);
If( !IsBlank( pcfQR.errorMessage ),
    Notify( pcfQR.errorMessage, NotificationType.Error ) )
```

Track `scanCount` rather than `value`: `OnChange` also fires once on load with
empty outputs, and a repeated scan of the same code would otherwise be silent.

## Platform notes

- `Device.getBarcodeValue` exists in **Power Apps Mobile** (Android, iOS,
  Windows). In Studio and the browser player the button renders but reports
  `errorMessage` = *"Scanning is only available in Power Apps Mobile …"*.
- `feature-usage` is declared `required="false"` on purpose so the control
  loads everywhere and degrades through `errorMessage` instead of a generic
  "can't load" box.
- The environment needs **Power Apps component framework for canvas apps**
  enabled (Environment settings → Features).
- Trilingual runtime UI (DE / EN / FR) from `context.userSettings.languageId`.

## Build

```powershell
cd BarcodeScanControl\BarcodeScanControl
npm install
npm run build -- --buildMode production
```

Full package (build → stage → `pac solution pack` unmanaged + managed):

```powershell
cd BarcodeScanControl\BarcodeScanControl.Solution
./build.ps1
```

## Layout

```
BarcodeScanControl/
├── index.ts                         # host glue: init/updateView/getOutputs, scan()
├── ControlManifest.Input.xml
├── components/
│   ├── BarcodeScanControl.tsx       # the button
│   └── i18n.ts                      # DE / EN / FR strings
├── css/BarcodeScanControl.css
└── strings/BarcodeScanControl.1033.resx
```
