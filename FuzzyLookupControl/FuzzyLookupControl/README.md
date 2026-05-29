# FuzzyLookupControl (PCF)

A drop-in replacement for the standard model-driven Lookup control. It uses
**Dataverse Search** (Azure Cognitive Search under the hood) for typo-tolerant
typeahead, renders each suggestion as a **card** (primary column as title,
up to three configured columns stacked as subtitles), and supports in-place
**Quick-Create** of new records. Architecture hooks for **Favorites** and
**Recently used** records are wired in v1 (off by default; enable per form).

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
| `column1`             | input — `SingleLine.Text`     | Logical name of the column used as the **card title** (bold primary line). Empty → target table's primary-name attribute. |
| `column2`             | input — `SingleLine.Text`     | Logical name of the first **subtitle** line under the title. Empty → hidden.                                              |
| `column3`             | input — `SingleLine.Text`     | Logical name of the second subtitle line. Empty → hidden.                                                                |
| `column4`             | input — `SingleLine.Text`     | Logical name of the third subtitle line. Empty → hidden.                                                                 |
| `pageSize`            | input — `Whole.None`          | Maximum suggestions returned per search. Clamped to `1..50`; default `25`.                                               |
| `placeholder`         | input — `SingleLine.Text`     | Placeholder shown when no record is selected. Empty → localized default ("Search…" / "Suchen…" / "Rechercher…").          |
| `enableQuickCreate`   | input — `TwoOptions`          | Shows a `+ New` button that opens the target table's Quick-Create form. Default **on**.                                  |
| `enableFavorites`     | input — `TwoOptions`          | Shows a per-user "Favorites" section. Each row gets a pin button. Stored in `localStorage`. Default **off**.             |
| `enableRecentlyUsed`  | input — `TwoOptions`          | Shows a per-user "Recently used" section above the search results. Stored in `localStorage`. Default **off**.            |
| `previewFormId`       | input — `SingleLine.Text`     | Optional GUID of a **Quick View Form** for the target table. When set, the long-press preview modal renders that form's fields (sections, labels, full values). Empty → default preview (configured columns only). |

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

## Card layout

Each suggestion is rendered as a single-column card (not a multi-column
grid). The first configured column becomes the **title** at the top of the
card (bold, 13 px), and each further column is stacked underneath as a
**subtitle line** (12 px, muted colour). Long values wrap to a second line
rather than being truncated mid-token — important when the subtitles
contain structured strings like article numbers or composite keys.

If the target table has an icon (`IconVectorName` web resource), it's shown
to the left of each card. The favorite-toggle, when enabled, sits at the
right edge of the card vertically centred. Subtitle lines whose underlying
column value is empty for a given record are silently skipped so a missing
value doesn't leave a blank line in the card.

## Touch gestures (mobile / tablet)

The card layout pulls double duty for finger-driven interaction in field-
service scenarios. Two gestures are wired on every card and work via the
Pointer Events API, so they cover mouse, pen and touch from a single code
path:

| Gesture | Effect |
|---------|--------|
| **Swipe right** on a card | Toggle favourite (pin / unpin). The card slides with the finger; release past ~72 px triggers the toggle and the card snaps back. The reveal strip is orange when adding a favourite, grey when removing one. Only active when `enableFavorites` is on. |
| **Long-press** (≈ 500 ms) on a card | Opens a preview modal. Default: shows every configured column **untruncated**. When `previewFormId` is set, the modal instead renders the Quick View Form's fields with section headers + labels + freshly-fetched live values (see below). Footer "Select" button commits the record. Tap the backdrop, the × button, or press Escape to dismiss. |

Vertical scrolling through the suggestion list is never hijacked — the
gesture only commits to "swipe" once horizontal movement clearly
dominates vertical. The long-press timer cancels the moment the finger
moves more than a fingertip's worth, so accidental hold-while-scrolling
won't pop the preview.

## Quick View Form preview (optional)

Set the `previewFormId` property to the GUID of a **Quick View Form**
(QVF) designed for the target table. On long-press the modal then
renders the QVF's fields — respecting its sections, labels, and field
order — with freshly fetched live values instead of just the four
columns configured for the inline suggestion card.

How to find the GUID:
- Open the QVF in Power Apps maker portal; the URL contains `formId=…`.
- Or list QVFs in your solution: each shows its id in the detail pane.

Behavior details:
- The form metadata is fetched **once per session** (cached per `formId`)
  so opening many previews only does the small record-fetch round-trip.
- If the GUID is invalid, the form belongs to a different entity, or the
  fetch fails for any reason, the modal **silently falls back** to the
  default-columns preview and logs a warning to the console.
- The fields render in the order they appear in the QVF. Sections with
  multiple cells get a header; single-section forms get no header at all.
- Formatted values are used where the server provides them
  (`@OData.Community.Display.V1.FormattedValue`), so lookups show their
  primary-name, choices show their label, dates show user-locale format.
- We do **not** iframe Microsoft's Quick View renderer — the QVF is used
  as a *metadata source* only and rendered in our own card-themed modal
  to keep styling consistent and avoid auth-context issues inside
  dialogs / side panels.

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
