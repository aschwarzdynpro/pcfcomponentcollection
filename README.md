# PCF Component Collection

A collection of Power Apps Component Framework (PCF) components for Dataverse
and model-driven apps.

## Components

| Component | Type | Purpose |
|-----------|------|---------|
| [DataverseCrudComponent](./DataverseCrudComponent/) | dataset | React-based CRUD UI for Dataverse datasets — list, search, create, edit, and delete records inside a model-driven form, view, or dashboard. |
| [FlagPhoneControl](./FlagPhoneControl/) | field | International phone-number input for `SingleLine.Phone` columns with country flag selector, dial-code parsing, and trilingual UI (DE / EN / FR). |

Each component has its own `README.md` with detailed features, properties,
build commands, and integration notes.

## Solutions

Importable Dataverse solutions live alongside their source components:

| Solution | Source | Notes |
|----------|--------|-------|
| [FlagPhoneControl.Solution](./FlagPhoneControl.Solution/) | `FlagPhoneControl/` | Publisher `HerbertWaldmann`, prefix `wal`. Run [`build.ps1`](./FlagPhoneControl.Solution/build.ps1) to produce unmanaged + managed zips. |

## General installation guide

See [`INSTALLATION.md`](./INSTALLATION.md) for the cross-component installation
walkthrough (build → solution package → import → form configuration).

## Repository layout

```
pcfcomponentcollection/
├── DataverseCrudComponent/     # PCF source — see folder README
├── FlagPhoneControl/           # PCF source — see folder README
├── FlagPhoneControl.Solution/  # Importable Dataverse solution
├── INSTALLATION.md             # General install walkthrough
└── README.md                   # This file
```

## License

MIT. Contributions welcome — open a PR with a clear description of the change.
