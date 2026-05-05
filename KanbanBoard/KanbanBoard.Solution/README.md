# KanbanBoard Solution

Dataverse solution that packages the [KanbanBoard](../KanbanBoard/) PCF
control for import.

## Solution metadata

| Field                | Value                          |
|----------------------|--------------------------------|
| Solution name        | `KanbanBoard`                  |
| Version              | `1.0.0.0`                      |
| Publisher            | `HerbertWaldmann`              |
| Customization prefix | `wal`                          |
| Control unique name  | `wal_Kanban.KanbanBoard`       |

## Layout

```
KanbanBoard.Solution/
├── build.ps1                           # build script
├── bin/
│   ├── KanbanBoard.zip                 # unmanaged solution
│   └── KanbanBoard_managed.zip         # managed solution
└── src/
    ├── Other/
    │   ├── Customizations.xml
    │   ├── Relationships.xml
    │   └── Solution.xml
    └── Controls/
        └── wal_Kanban.KanbanBoard/
            ├── ControlManifest.xml
            ├── ControlManifest.xml.data.xml
            ├── bundle.js
            ├── css/KanbanBoard.css
            └── strings/KanbanBoard.1033.resx
```

## Build

```powershell
./build.ps1
```

The script:
1. Runs `npm install` (if needed) and `npm run build -- --buildMode production`
   in `../KanbanBoard/`.
2. Stages the built artifacts into `src/Controls/wal_Kanban.KanbanBoard/`.
3. Packs unmanaged + managed solution zips with `pac solution pack`.

## Import & configure

1. Open the Power Platform maker portal of your target environment.
2. **Solutions → Import solution**.
3. Pick `bin/KanbanBoard_managed.zip` (production) or
   `bin/KanbanBoard.zip` (development).
4. Open a model-driven app → edit a view → switch to **Custom control** view
   layout → add **Kanban Board**.
5. Set the required `Status Column` property (e.g. `statuscode`,
   `prioritycode`, or any custom choice column).
6. Optionally configure `Title Column`, `Subtitle Column`, etc.
