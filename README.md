# PCF Component Collection

A collection of Power Apps Component Framework (PCF) components for Dataverse
and model-driven apps.

## Components

| Component | Type | Purpose |
|-----------|------|---------|
| [ChoicePickerControl](./ChoicePickerControl/ChoicePickerControl/) | field | Modern React replacement for the standard Dataverse Choice dropdown. One control binds to both single `Choice` (OptionSet) and multi-select `Choices` (MultiSelectOptionSet): colored options, searchable list, removable chips, full keyboard navigation. Trilingual UI (DE / EN / FR). |
| [DataverseCrudComponent](./DataverseCrudComponent/) | dataset | React-based CRUD UI for Dataverse datasets — list, search, create, edit, and delete records inside a model-driven form, view, or dashboard. |
| [FlagPhoneControl](./FlagPhoneControl/FlagPhoneControl/) | field | International phone-number input for `SingleLine.Phone` columns with country flag selector, dial-code parsing, libphonenumber-validation, and trilingual UI (DE / EN / FR). |
| [FuzzyLookupControl](./FuzzyLookupControl/FuzzyLookupControl/) | field | Drop-in replacement for the standard `Lookup.Simple` control. Dataverse Search (Lucene-fuzzy) typeahead, up to four configurable result columns with highlight, in-place Quick-Create, plus architecture hooks for favorites and recently used. Trilingual UI (DE / EN / FR). |
| [HoursDaysControl](./HoursDaysControl/HoursDaysControl/) | field | Duration input for numeric columns. User picks workdays + hours (default 1 day = 8 h); the underlying field stores the total in hours. Bilingual UI (DE / EN). |
| [KanbanBoard](./KanbanBoard/KanbanBoard/) | dataset | Drag-and-drop Kanban view that groups records by a choice/status column and lets users update the status by dragging cards. Trilingual UI (DE / EN / FR). |
| [MaterialBoxList](./MaterialBoxList/MaterialBoxList/) | dataset (virtual) | Mobile-first list of material boxes for field-service monteurs: per-box material counter, long-press/button overlay of the contained materials, and a swipe/button take-out action with optimistic UI + 5 s undo. React (Virtual) + Fluent v9. Trilingual UI (DE / EN / FR). |
| [MultiProgressControl](./MultiProgressControl/MultiProgressControl/) | field | Read-only status control. Shows up to 6 configurable Whole-Number columns as ring progress indicators (0–100 %) in a row that snaps from 6-in-a-line to exactly 3-per-row when narrow, with status colours (0 % neutral / 1–99 % brand / 100 % green). Bilingual UI (DE / EN). |
| [WorkTimeSplitGrid](./WorkTimeSplitGrid/WorkTimeSplitGrid/) | dataset | Master/detail grid for the SST *Rounded Time Entries* table: distribute an entry's total duration across work subtypes (Normal / Overtime / Night-Sunday / Holiday), then save to create the split records, mark the original + its pauses completed, and delete the original. Trilingual UI (DE / EN / FR). |

Each component has its own `README.md` with detailed features, properties,
build commands, and integration notes.

## Solutions

Importable Dataverse solutions live alongside their source components:

| Solution | Source | Notes |
|----------|--------|-------|
| [ChoicePickerControl.Solution](./ChoicePickerControl/ChoicePickerControl.Solution/) | `ChoicePickerControl/ChoicePickerControl/` | Publisher `HerbertWaldmann`, prefix `wal`. Run [`build.ps1`](./ChoicePickerControl/ChoicePickerControl.Solution/build.ps1) to produce unmanaged + managed zips. |
| [FlagPhoneControl.Solution](./FlagPhoneControl/FlagPhoneControl.Solution/) | `FlagPhoneControl/FlagPhoneControl/` | Publisher `HerbertWaldmann`, prefix `wal`. Run [`build.ps1`](./FlagPhoneControl/FlagPhoneControl.Solution/build.ps1) to produce unmanaged + managed zips. |
| [FuzzyLookupControl.Solution](./FuzzyLookupControl/FuzzyLookupControl.Solution/) | `FuzzyLookupControl/FuzzyLookupControl/` | Publisher `HerbertWaldmann`, prefix `wal`. Run [`build.ps1`](./FuzzyLookupControl/FuzzyLookupControl.Solution/build.ps1) to produce unmanaged + managed zips. |
| [HoursDaysControl.Solution](./HoursDaysControl/HoursDaysControl.Solution/) | `HoursDaysControl/HoursDaysControl/` | Publisher `HerbertWaldmann`, prefix `wal`. Run [`build.ps1`](./HoursDaysControl/HoursDaysControl.Solution/build.ps1) to produce unmanaged + managed zips. |
| [KanbanBoard.Solution](./KanbanBoard/KanbanBoard.Solution/) | `KanbanBoard/KanbanBoard/` | Publisher `HerbertWaldmann`, prefix `wal`. Run [`build.ps1`](./KanbanBoard/KanbanBoard.Solution/build.ps1) to produce unmanaged + managed zips. |
| [MaterialBoxList.Solution](./MaterialBoxList/MaterialBoxList.Solution/) | `MaterialBoxList/MaterialBoxList/` | Publisher `Schulz Systemtechnik GmbH`, prefix `sst`. Run [`build.ps1`](./MaterialBoxList/MaterialBoxList.Solution/build.ps1) to produce unmanaged + managed zips. |
| [MultiProgressControl.Solution](./MultiProgressControl/MultiProgressControl.Solution/) | `MultiProgressControl/MultiProgressControl/` | Publisher `HerbertWaldmann`, prefix `wal`. Run [`build.ps1`](./MultiProgressControl/MultiProgressControl.Solution/build.ps1) to produce unmanaged + managed zips. |
| [WorkTimeSplitGrid.Solution](./WorkTimeSplitGrid/WorkTimeSplitGrid.Solution/) | `WorkTimeSplitGrid/WorkTimeSplitGrid/` | Publisher `Schulz Systemtechnik GmbH`, prefix `sst`. Run [`build.ps1`](./WorkTimeSplitGrid/WorkTimeSplitGrid.Solution/build.ps1) to produce unmanaged + managed zips. |

## General installation guide

See [`INSTALLATION.md`](./INSTALLATION.md) for the cross-component installation
walkthrough (build → solution package → import → form configuration).

## Repository layout

```
pcfcomponentcollection/
├── ChoicePickerControl/            # feature folder grouping source + solution
│   ├── ChoicePickerControl/        # PCF source
│   └── ChoicePickerControl.Solution/ # Importable Dataverse solution
├── DataverseCrudComponent/         # PCF source — see folder README
├── FlagPhoneControl/               # feature folder grouping source + solution
│   ├── FlagPhoneControl/           # PCF source
│   └── FlagPhoneControl.Solution/  # Importable Dataverse solution
├── FuzzyLookupControl/             # feature folder grouping source + solution
│   ├── FuzzyLookupControl/         # PCF source
│   └── FuzzyLookupControl.Solution/ # Importable Dataverse solution
├── HoursDaysControl/               # feature folder grouping source + solution
│   ├── HoursDaysControl/           # PCF source
│   └── HoursDaysControl.Solution/  # Importable Dataverse solution
├── KanbanBoard/                    # feature folder grouping source + solution
│   ├── KanbanBoard/                # PCF source
│   └── KanbanBoard.Solution/       # Importable Dataverse solution
├── MaterialBoxList/                # feature folder grouping source + solution
│   ├── MaterialBoxList/            # PCF source
│   └── MaterialBoxList.Solution/   # Importable Dataverse solution
├── MultiProgressControl/           # feature folder grouping source + solution
│   ├── MultiProgressControl/       # PCF source
│   └── MultiProgressControl.Solution/ # Importable Dataverse solution
├── WorkTimeSplitGrid/              # feature folder grouping source + solution
│   ├── WorkTimeSplitGrid/          # PCF source
│   └── WorkTimeSplitGrid.Solution/ # Importable Dataverse solution
├── INSTALLATION.md                 # General install walkthrough
└── README.md                       # This file
```

## License

MIT. Contributions welcome — open a PR with a clear description of the change.
