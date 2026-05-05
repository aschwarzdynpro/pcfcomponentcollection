# HoursDaysControl Solution

Dataverse solution that packages the [HoursDaysControl](../HoursDaysControl/) PCF
control for import.

## Solution metadata

| Field                | Value                                |
|----------------------|--------------------------------------|
| Solution name        | `HoursDaysControl`                   |
| Version              | `1.0.0.0`                            |
| Publisher            | `HerbertWaldmann`                    |
| Customization prefix | `wal`                                |
| Option-value prefix  | `15282`                              |
| Control unique name  | `wal_WorkTime.HoursDaysControl`      |

## Layout

```
HoursDaysControl.Solution/
├── build.ps1                            # build script
├── bin/
│   ├── HoursDaysControl.zip             # unmanaged solution
│   └── HoursDaysControl_managed.zip     # managed solution
└── src/
    ├── Other/
    │   ├── Customizations.xml
    │   ├── Relationships.xml
    │   └── Solution.xml
    └── Controls/
        └── wal_WorkTime.HoursDaysControl/
            ├── ControlManifest.xml
            ├── ControlManifest.xml.data.xml
            ├── bundle.js
            ├── css/HoursDaysControl.css
            └── strings/HoursDaysControl.1033.resx
```

## Build

```powershell
./build.ps1
```

The script:
1. Runs `npm install` (if needed) and `npm run build` in `../HoursDaysControl/`.
2. Stages the built artifacts into `src/Controls/wal_WorkTime.HoursDaysControl/`.
3. Packs unmanaged + managed solution zips with `pac solution pack`.

## Import

1. Open the Power Platform maker portal of your target environment.
2. **Solutions → Import solution**.
3. Pick `bin/HoursDaysControl_managed.zip` (production) or
   `bin/HoursDaysControl.zip` (development).
4. After import, on a model-driven form, select a numeric column and choose
   **+ Component → HoursDaysControl**.
