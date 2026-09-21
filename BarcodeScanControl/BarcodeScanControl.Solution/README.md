# BarcodeScanControl Solution

Dataverse solution that packages the
[BarcodeScanControl](../BarcodeScanControl/) PCF control for import.

## Solution metadata

| Field                | Value                                  |
|----------------------|----------------------------------------|
| Solution name        | `BarcodeScanControl`                  |
| Version              | `1.0.0.0`                              |
| Publisher            | `HerbertWaldmann`                      |
| Customization prefix | `wal`                                  |
| Option-value prefix  | `15282`                                |
| Control unique name  | `wal_BarcodeScan.BarcodeScanControl` |

## Layout

```
BarcodeScanControl.Solution/
├── build.ps1                              # build script
├── bin/
│   ├── BarcodeScanControl.zip            # unmanaged solution
│   └── BarcodeScanControl_managed.zip    # managed solution
└── src/
    ├── Other/
    │   ├── Customizations.xml
    │   ├── Relationships.xml
    │   └── Solution.xml
    └── Controls/
        └── wal_BarcodeScan.BarcodeScanControl/
            ├── ControlManifest.xml
            ├── ControlManifest.xml.data.xml
            ├── bundle.js
            ├── css/BarcodeScanControl.css
            └── strings/BarcodeScanControl.1033.resx
```

## Build

```powershell
./build.ps1
```

The script:
1. Runs `npm install` (if needed) and `npm run build` in `../BarcodeScanControl/`.
2. Stages the built artifacts into `src/Controls/wal_BarcodeScan.BarcodeScanControl/`.
3. Packs unmanaged + managed solution zips with `pac solution pack`.

## Import

1. Open the Power Platform maker portal of your target environment.
2. **Solutions → Import solution**.
3. Pick `bin/BarcodeScanControl_managed.zip` (production) or
   `bin/BarcodeScanControl.zip` (development).
4. After import, open the canvas app in Power Apps Studio, choose
   **Insert → Get more components → Code**, import **Barcode Scan**, and drop
   it on a screen. Read `.value` (text) in `OnChange`; `.scanCount` increments
   on every successful scan, `.errorMessage` is non-empty when scanning is
   unavailable or failed.
