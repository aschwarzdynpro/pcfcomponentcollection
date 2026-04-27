# FlagPhoneControl Solution

Dataverse solution that packages the [FlagPhoneControl](../FlagPhoneControl/) PCF
control for import.

## Solution metadata

| Field              | Value                                          |
|--------------------|------------------------------------------------|
| Solution name      | `FlagPhoneControl`                             |
| Version            | `1.0.0.0`                                      |
| Publisher          | `HerbertWaldmann`                              |
| Customization prefix | `wal`                                        |
| Option-value prefix | `15282`                                       |
| Control unique name | `wal_FlagPhone.FlagPhoneControl`              |

## Layout

```
FlagPhoneControl.Solution/
├── build.ps1                           # build script
├── bin/
│   ├── FlagPhoneControl.zip            # unmanaged solution
│   └── FlagPhoneControl_managed.zip    # managed solution
└── src/
    ├── Other/
    │   ├── Customizations.xml
    │   ├── Relationships.xml
    │   └── Solution.xml
    └── Controls/
        └── wal_FlagPhone.FlagPhoneControl/
            ├── ControlManifest.xml
            ├── ControlManifest.xml.data.xml
            ├── bundle.js
            ├── css/FlagPhoneControl.css
            └── strings/FlagPhoneControl.1033.resx
```

## Build

```powershell
./build.ps1
```

The script:
1. Runs `npm install` (if needed) and `npm run build` in `../FlagPhoneControl/`.
2. Stages the built artifacts into `src/Controls/wal_FlagPhone.FlagPhoneControl/`.
3. Packs unmanaged + managed solution zips with `pac solution pack`.

## Import

1. Open the Power Platform maker portal of your target environment.
2. **Solutions → Import solution**.
3. Pick `bin/FlagPhoneControl_managed.zip` (production) or
   `bin/FlagPhoneControl.zip` (development).
4. After import, on a model-driven form, select a phone-number column and
   choose **+ Component → FlagPhoneControl**.
