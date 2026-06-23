# MultiProgressControl Solution

Dataverse solution that packages the
[MultiProgressControl](../MultiProgressControl/) PCF control for import.

## Solution metadata

| Field                | Value                                  |
|----------------------|----------------------------------------|
| Solution name        | `MultiProgressControl`                 |
| Version              | `1.0.3.0`                              |
| Publisher            | `HerbertWaldmann`                      |
| Customization prefix | `wal`                                  |
| Option-value prefix  | `15282`                                |
| Control unique name  | `wal_Progress.MultiProgressControl`    |

## Layout

```
MultiProgressControl.Solution/
├── build.ps1                                  # build script
├── bin/
│   ├── MultiProgressControl.zip               # unmanaged solution
│   └── MultiProgressControl_managed.zip       # managed solution
└── src/
    ├── Other/
    │   ├── Customizations.xml
    │   ├── Relationships.xml
    │   └── Solution.xml
    └── Controls/
        └── wal_Progress.MultiProgressControl/
            ├── ControlManifest.xml
            ├── ControlManifest.xml.data.xml
            ├── bundle.js
            ├── css/MultiProgressControl.css
            └── strings/MultiProgressControl.1033.resx
```

## Build

```powershell
./build.ps1
```

The script:
1. Runs `npm install` (if needed) and `npm run build` in `../MultiProgressControl/`.
2. Stages the built artifacts into `src/Controls/wal_Progress.MultiProgressControl/`.
3. Packs unmanaged + managed solution zips with `pac solution pack`.

## Import

1. Open the Power Platform maker portal of your target environment.
2. **Solutions → Import solution**.
3. Pick `bin/MultiProgressControl_managed.zip` (production) or
   `bin/MultiProgressControl.zip` (development).
4. After import, on a model-driven form, select a Whole-Number column and choose
   **+ Component → MultiProgressControl**, then bind `field2`–`field6` to the
   remaining columns.
