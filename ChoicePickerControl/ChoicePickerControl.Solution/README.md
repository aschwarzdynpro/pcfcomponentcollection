# ChoicePickerControl Solution

Dataverse solution that packages the
[ChoicePickerControl](../ChoicePickerControl/) PCF control for import.

## Solution metadata

| Field                | Value                                  |
|----------------------|----------------------------------------|
| Solution name        | `ChoicePickerControl`                  |
| Version              | `1.0.6.0`                              |
| Publisher            | `HerbertWaldmann`                      |
| Customization prefix | `wal`                                  |
| Option-value prefix  | `15282`                                |
| Control unique name  | `wal_ChoicePicker.ChoicePickerControl` |

## Layout

```
ChoicePickerControl.Solution/
├── build.ps1                              # build script
├── bin/
│   ├── ChoicePickerControl.zip            # unmanaged solution
│   └── ChoicePickerControl_managed.zip    # managed solution
└── src/
    ├── Other/
    │   ├── Customizations.xml
    │   ├── Relationships.xml
    │   └── Solution.xml
    └── Controls/
        └── wal_ChoicePicker.ChoicePickerControl/
            ├── ControlManifest.xml
            ├── ControlManifest.xml.data.xml
            ├── bundle.js
            ├── css/ChoicePickerControl.css
            └── strings/ChoicePickerControl.1033.resx
```

## Build

```powershell
./build.ps1
```

The script:
1. Runs `npm install` (if needed) and `npm run build` in `../ChoicePickerControl/`.
2. Stages the built artifacts into `src/Controls/wal_ChoicePicker.ChoicePickerControl/`.
3. Packs unmanaged + managed solution zips with `pac solution pack`.

## Import

1. Open the Power Platform maker portal of your target environment.
2. **Solutions → Import solution**.
3. Pick `bin/ChoicePickerControl_managed.zip` (production) or
   `bin/ChoicePickerControl.zip` (development).
4. After import, on a model-driven form, select a **Choice** or **Choices**
   column and choose **+ Component → Choice Picker**.
