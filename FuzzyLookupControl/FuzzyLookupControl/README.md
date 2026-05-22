# FuzzyLookupControl (PCF)

A drop-in replacement for the standard model-driven Lookup control. It uses
**Dataverse Search** (Azure Cognitive Search under the hood) for typo-tolerant
typeahead, shows up to **four configurable columns** per suggestion, and
supports in-place **Quick-Create** of new records. Architecture hooks for
**Favorites** and **Recently used** records are wired in v1 (off by default;
enable per form).

## How it works

1. User starts typing in the lookup input.
2. After 2 characters and a 200 ms debounce, the control calls
   `POST {clientUrl}/api/data/v9.2/searchquery` with Lucene query syntax and a
   trailing `~` per token — Dataverse Search interprets `~` as fuzzy with edit
   distance up to 2, so `Mitcrosoft` matches `Microsoft`.
3. The response includes the configured columns directly (via
   `entities[].selectColumns`) plus highlight fragments wrapped in
   `{crmhit}…{/crmhit}` markers that the UI converts to `<mark>` tags.
4. Selecting a row commits the new value via the standard PCF
   `notifyOutputChanged()` round-trip — the form's dirty flag and save pipeline
   behave exactly as with the OOB lookup.

If Dataverse Search is unavailable in the environment, the control degrades
to a plain OData `contains()` query and surfaces a small banner so the maker
knows to enable search.

## Properties

| Name                  | Type                          | Description                                                                                                              |
| --------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `selectedItem`        | bound — `Lookup.Simple`       | The Lookup column the control replaces. Target table is read automatically from the column definition.                   |
| `column1`             | input — `SingleLine.Text`     | Logical name of the first column shown in suggestions. Empty → target table's primary-name attribute.                    |
| `column2`             | input — `SingleLine.Text`     | Logical name of the second column. Empty → hidden.                                                                       |
| `column3`             | input — `SingleLine.Text`     | Logical name of the third column. Empty → hidden.                                                                        |
| `column4`             | input — `SingleLine.Text`     | Logical name of the fourth column. Empty → hidden.                                                                       |
| `pageSize`            | input — `Whole.None`          | Maximum suggestions returned per search. Clamped to `1..50`; default `25`.                                               |
| `placeholder`         | input — `SingleLine.Text`     | Placeholder shown when no record is selected. Empty → localized default ("Search…" / "Suchen…" / "Rechercher…").          |
| `enableQuickCreate`   | input — `TwoOptions`          | Shows a `+ New` button that opens the target table's Quick-Create form. Default **on**.                                  |
| `enableFavorites`     | input — `TwoOptions`          | Shows a per-user "Favorites" section. Each row gets a pin button. Stored in `localStorage`. Default **off**.             |
| `enableRecentlyUsed`  | input — `TwoOptions`          | Shows a per-user "Recently used" section above the search results. Stored in `localStorage`. Default **off**.            |

## Environment prerequisites

Dataverse Search must be enabled for the best experience:

1. **Power Platform admin center → environment → Settings → Product → Features
   → Dataverse Search** must be **on**.
2. For every target table: open it in the maker portal,
   **Properties → Advanced options → Can be found in search** must be **on**.
   The columns you configure should be search-indexed (the primary-name
   attribute always is by default).
3. After enabling search, expect a few minutes of indexing lag before new or
   updated records surface.

When Dataverse Search is **off**, the control still works — it falls back to
`retrieveMultipleRecords` with `contains()` filters across the configured
columns and shows a yellow banner in the dropdown so the maker can tell.

## Field-type compatibility

The control binds to `Lookup.Simple` columns only. Polymorphic lookups
(`Customer`, `Owner`, `Regarding`, custom `MultiTable` lookups) are **not
supported** in v1 — those expose `Lookup.Customer` / `Lookup.Owner` /
`Lookup.Regarding` types that the manifest cannot cover with a single bound
property.

## Keyboard

| Key            | Action                                |
| -------------- | ------------------------------------- |
| `↓` / `↑`      | Move between suggestions.             |
| `Enter`        | Select the highlighted suggestion.    |
| `Esc`          | Close the dropdown.                   |
| Click on chip  | Open the selected record in the form. |

## Localization

UI strings are available in **English** (`en`), **German** (`de-*` LCIDs) and
**French** (`fr-*` LCIDs). Add a new RESX in `strings/` plus an entry in
`components/lang.ts` to add another locale.

## Build

```powershell
cd FuzzyLookupControl
npm install
npm run build
```

To produce a Dataverse-importable solution zip, run
[`FuzzyLookupControl.Solution/build.ps1`](../FuzzyLookupControl.Solution/build.ps1).

## Roadmap (v2)

- **Favorites & Recently used UI sections** — architecture and storage are
  already in place (`services/storage.ts`, `SuggestionsProvider` interface);
  v2 will polish the section ordering, cross-device sync via a Dataverse
  table, and bulk-management.
- **System View binding** — let the maker pick a Quick-Find / saved view as
  the source of columns, filter, and sort order, eliminating the need to
  configure column inputs individually.
- **Polymorphic lookups** — `Customer`, `Owner`, `Regarding`, MultiTable.
