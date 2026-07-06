# WorkTimeSplitGrid Solution

Dataverse solution that packages the [WorkTimeSplitGrid](../WorkTimeSplitGrid/) PCF
control for import.

## Solution metadata

| Field                | Value                              |
|----------------------|------------------------------------|
| Solution name        | `WorkTimeSplitGrid`                |
| Version              | `1.21.0.0`                         |
| Publisher            | `Schulz Systemtechnik GmbH`        |
| Customization prefix | `sst`                              |
| Control unique name  | `sst_WorkTime.WorkTimeSplitGrid`   |

## Layout

```
WorkTimeSplitGrid.Solution/
├── build.ps1                                  # build script
├── bin/
│   ├── WorkTimeSplitGrid.zip                  # unmanaged — canonical "latest"
│   ├── WorkTimeSplitGrid_managed.zip          # managed — canonical "latest"
│   ├── WorkTimeSplitGrid_<version>.zip         # unmanaged — versioned archive
│   └── WorkTimeSplitGrid_managed_<version>.zip # managed — versioned archive
└── src/
    ├── Other/
    │   ├── Customizations.xml
    │   ├── Relationships.xml
    │   └── Solution.xml
    └── Controls/
        └── sst_WorkTime.WorkTimeSplitGrid/
            ├── ControlManifest.xml
            ├── ControlManifest.xml.data.xml
            ├── bundle.js
            ├── css/WorkTimeSplitGrid.css
            └── strings/WorkTimeSplitGrid.1033.resx
```

## Build

```powershell
./build.ps1
```

The script:
1. Runs `npm install` (if needed) and `npm run build -- --buildMode production`
   in `../WorkTimeSplitGrid/`.
2. Stages the built artifacts into `src/Controls/sst_WorkTime.WorkTimeSplitGrid/`.
3. Packs unmanaged + managed solution zips with `pac solution pack` (the
   canonical `…​.zip` / `…​_managed.zip`), then writes **versioned archive
   copies** `…​_<version>.zip` / `…​_managed_<version>.zip` (version read from
   `src/Other/Solution.xml`). The versioned copies are never overwritten, so any
   earlier build stays available for roll-back without git. The `bin/` folder is
   git-ignored (local archive).

## Import & configure

1. Open the Power Platform maker portal of your target environment.
2. **Solutions → Import solution**.
3. Pick `bin/WorkTimeSplitGrid_managed.zip` (production) or
   `bin/WorkTimeSplitGrid.zip` (development).
4. Open a model-driven app → edit the **Rounded Time Entries** view → switch the
   view layout to **Custom control** → add **Work Time Split Grid**.
5. Make sure the view exposes the columns the control reads (`sst_duration`,
   `sst_date`, `sst_type`, `sst_worksubtypecompleted`); the defaults already
   target the SST schema. Override the field bindings only if your schema differs.
