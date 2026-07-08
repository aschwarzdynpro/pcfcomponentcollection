# MaterialBoxList Solution

Dataverse solution that packages the [MaterialBoxList](../MaterialBoxList/) PCF
control for import.

## Solution metadata

| Field                | Value                                |
|----------------------|--------------------------------------|
| Solution name        | `MaterialBoxList`                    |
| Version              | `1.1.0.0`                            |
| Publisher            | `Schulz Systemtechnik GmbH`          |
| Customization prefix | `sst`                                |
| Control unique name  | `sst_MaterialBox.MaterialBoxList`    |

## Layout

```
MaterialBoxList.Solution/
├── build.ps1                                    # build script
├── bin/                                         # git-ignored (local archive)
│   ├── MaterialBoxList.zip                       # unmanaged — canonical "latest"
│   ├── MaterialBoxList_managed.zip               # managed — canonical "latest"
│   ├── MaterialBoxList_<version>.zip             # unmanaged — versioned archive
│   └── MaterialBoxList_managed_<version>.zip     # managed — versioned archive
└── src/
    ├── Other/
    │   ├── Customizations.xml
    │   ├── Relationships.xml
    │   └── Solution.xml
    └── Controls/
        └── sst_MaterialBox.MaterialBoxList/
            ├── ControlManifest.xml
            ├── ControlManifest.xml.data.xml
            ├── bundle.js
            ├── css/MaterialBoxList.css
            └── strings/MaterialBoxList.1033.resx
```

## Build

```powershell
./build.ps1
```

The script:
1. Runs `npm install` (if needed) and `npm run build -- --buildMode production`
   in `../MaterialBoxList/`.
2. Stages the built artifacts into `src/Controls/sst_MaterialBox.MaterialBoxList/`.
3. Packs unmanaged + managed solution zips with `pac solution pack` (the
   canonical `…​.zip` / `…​_managed.zip`), then writes **versioned archive
   copies** `…​_<version>.zip` / `…​_managed_<version>.zip` (version read from
   `src/Other/Solution.xml`). The versioned copies are never overwritten, so any
   earlier build stays available for roll-back without git. The `bin/` folder is
   git-ignored (local archive).

## Import & configure

1. Open the Power Platform maker portal of your target environment.
2. **Solutions → Import solution**.
3. Pick `bin/MaterialBoxList_managed.zip` (production) or
   `bin/MaterialBoxList.zip` (development).
4. Open a model-driven app → edit the **material box** view (subgrid or
   home-grid) → switch the view layout to **Custom control** → add
   **Material Box List**.
5. Set the control properties to your schema — see the
   [control README](../MaterialBoxList/README.md#properties) for every property
   and the required offline-profile setup.
