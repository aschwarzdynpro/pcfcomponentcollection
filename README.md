# PCF Component Collection

A collection of Power Apps Component Framework (PCF) components for Dataverse
and model-driven apps.

## Components

| Component | Type | Purpose |
|-----------|------|---------|
| [DataverseCrudComponent](./DataverseCrudComponent/) | dataset | React-based CRUD UI for Dataverse datasets — list, search, create, edit, and delete records inside a model-driven form, view, or dashboard. |
| [FlagPhoneControl](./FlagPhoneControl/FlagPhoneControl/) | field | International phone-number input for `SingleLine.Phone` columns with country flag selector, dial-code parsing, libphonenumber-validation, and trilingual UI (DE / EN / FR). |
| [HoursDaysControl](./HoursDaysControl/HoursDaysControl/) | field | Duration input for numeric columns. User picks workdays + hours (default 1 day = 8 h); the underlying field stores the total in hours. Bilingual UI (DE / EN). |
| [KanbanBoard](./KanbanBoard/KanbanBoard/) | dataset | Drag-and-drop Kanban view that groups records by a choice/status column and lets users update the status by dragging cards. Trilingual UI (DE / EN / FR). |

Each component has its own `README.md` with detailed features, properties,
build commands, and integration notes.

## Solutions

Importable Dataverse solutions live alongside their source components:

| Solution | Source | Notes |
|----------|--------|-------|
| [FlagPhoneControl.Solution](./FlagPhoneControl/FlagPhoneControl.Solution/) | `FlagPhoneControl/FlagPhoneControl/` | Publisher `HerbertWaldmann`, prefix `wal`. Run [`build.ps1`](./FlagPhoneControl/FlagPhoneControl.Solution/build.ps1) to produce unmanaged + managed zips. |
| [HoursDaysControl.Solution](./HoursDaysControl/HoursDaysControl.Solution/) | `HoursDaysControl/HoursDaysControl/` | Publisher `HerbertWaldmann`, prefix `wal`. Run [`build.ps1`](./HoursDaysControl/HoursDaysControl.Solution/build.ps1) to produce unmanaged + managed zips. |
| [KanbanBoard.Solution](./KanbanBoard/KanbanBoard.Solution/) | `KanbanBoard/KanbanBoard/` | Publisher `HerbertWaldmann`, prefix `wal`. Run [`build.ps1`](./KanbanBoard/KanbanBoard.Solution/build.ps1) to produce unmanaged + managed zips. |

## General installation guide

See [`INSTALLATION.md`](./INSTALLATION.md) for the cross-component installation
walkthrough (build → solution package → import → form configuration).

## Repository layout

```
pcfcomponentcollection/
├── DataverseCrudComponent/         # PCF source — see folder README
├── FlagPhoneControl/               # feature folder grouping source + solution
│   ├── FlagPhoneControl/           # PCF source
│   └── FlagPhoneControl.Solution/  # Importable Dataverse solution
├── HoursDaysControl/               # feature folder grouping source + solution
│   ├── HoursDaysControl/           # PCF source
│   └── HoursDaysControl.Solution/  # Importable Dataverse solution
├── KanbanBoard/                    # feature folder grouping source + solution
│   ├── KanbanBoard/                # PCF source
│   └── KanbanBoard.Solution/       # Importable Dataverse solution
├── INSTALLATION.md                 # General install walkthrough
└── README.md                       # This file
```

## License

MIT. Contributions welcome — open a PR with a clear description of the change.
