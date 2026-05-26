# FuzzyLookupControl Solution

Dataverse solution that packages the [FuzzyLookupControl](../FuzzyLookupControl/) PCF
control for import.

## Solution metadata

| Field                | Value                                |
|----------------------|--------------------------------------|
| Solution name        | `FuzzyLookupControl`                 |
| Version              | `1.0.0.0`                            |
| Publisher            | `HerbertWaldmann`                    |
| Customization prefix | `wal`                                |
| Option-value prefix  | `15282`                              |
| Control unique name  | `wal_Lookup.FuzzyLookupControl`      |

## Layout

```
FuzzyLookupControl.Solution/
├── build.ps1                              # build script
├── bin/
│   ├── FuzzyLookupControl.zip             # unmanaged solution
│   └── FuzzyLookupControl_managed.zip     # managed solution
└── src/
    ├── Other/
    │   ├── Customizations.xml
    │   ├── Relationships.xml
    │   └── Solution.xml
    └── Controls/
        └── wal_Lookup.FuzzyLookupControl/
            ├── ControlManifest.xml
            ├── ControlManifest.xml.data.xml
            ├── bundle.js
            ├── css/FuzzyLookupControl.css
            └── strings/
                ├── FuzzyLookupControl.1033.resx
                ├── FuzzyLookupControl.1031.resx
                └── FuzzyLookupControl.1036.resx
```

## Build

```powershell
./build.ps1
```

The script:
1. Runs `npm install` (if needed) and `npm run build` in `../FuzzyLookupControl/`.
2. Stages the built artifacts into `src/Controls/wal_Lookup.FuzzyLookupControl/`.
3. Packs unmanaged + managed solution zips with `pac solution pack`.

## Import

1. Open the Power Platform maker portal of your target environment.
2. **Solutions → Import solution**.
3. Pick `bin/FuzzyLookupControl_managed.zip` (production) or
   `bin/FuzzyLookupControl.zip` (development).
4. After import, on a model-driven form select a Lookup column and choose
   **+ Component → Fuzzy Lookup**.

## Prerequisites in the target environment

The control's primary search path uses **Dataverse Search**. To get the best
experience:

- *Power Platform admin center → your environment → Settings → Product →
  Features → Dataverse Search* must be **on**.
- For every table you intend to use the lookup against: open the table in the
  maker portal, *Properties → Advanced options → Can be found in search* must
  be **on**, and at least the columns you configure for the control must be
  search-indexed (default for the primary name).
- After enabling search, expect a few minutes of indexing latency before new
  records appear in results.

If Dataverse Search is unavailable the control automatically falls back to a
basic OData `contains()` query and shows a discreet banner in the dropdown.
