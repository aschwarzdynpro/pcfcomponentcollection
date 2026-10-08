# RecordAuditHistory Solution

Dataverse solution that packages the [Record Audit History](../RecordAuditHistory/)
PCF control for import.

## Solution metadata

| Field                | Value                                    |
|----------------------|------------------------------------------|
| Solution name        | `DynamicsProRecordAuditHistory`          |
| Version              | `0.1.0.0`                                |
| Publisher            | `DynamicsPro`                            |
| Customization prefix | `pro`                                    |
| Control unique name  | `pro_AuditExplorer.RecordAuditHistory`   |

## Layout

```
RecordAuditHistory.Solution/
├── build.ps1                                     # build script
├── bin/                                          # zips (git-ignored)
│   ├── RecordAuditHistory.zip / RecordAuditHistory_managed.zip
│   └── RecordAuditHistory_<version>.zip / RecordAuditHistory_managed_<version>.zip
└── src/
    ├── Other/ (Customizations.xml, Relationships.xml, Solution.xml)
    └── Controls/pro_AuditExplorer.RecordAuditHistory/
        ├── ControlManifest.xml, ControlManifest.xml.data.xml, bundle.js
        ├── css/RecordAuditHistory.css
        └── strings/RecordAuditHistory.1033.resx, RecordAuditHistory.1031.resx
```

## Build

```powershell
./build.ps1
```

Builds `../RecordAuditHistory` in production mode, stages the output into
`src/Controls/…`, packs unmanaged and managed zips with `pac solution pack`, and
keeps versioned archive copies (version read from `src/Other/Solution.xml`).
The script stops if the build output is missing instead of packing an empty
control.

## Import & configure

1. Maker portal → **Solutions → Import solution** →
   `bin/RecordAuditHistory_managed.zip`.
2. Form designer → add a column to a tab or section → **Components → Record
   Audit History** → bind **Bound column**, hide the label. Details are in the
   [control README](../RecordAuditHistory/README.md#add-to-a-form).
