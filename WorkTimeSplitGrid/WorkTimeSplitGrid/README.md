# WorkTimeSplitGrid

A React-based Power Apps Component Framework (PCF) **dataset** control for the
**Rounded Time Entries** table (Schulz Systemtechnik). It replaces a Canvas
Custom Page with an in-grid master/detail workflow: pick a rounded time entry,
distribute its total duration across the work subtypes
(**Normal / Überstunden / Nacht-Sonntag / Feiertag**), and save — the control
creates the split records, marks the original and its pauses as completed, and
deletes the original.

## ✨ Features

### 🎯 Core functionality
- **Master list** of Rounded Time Entries with a live search box. Each card
  shows the composed title, a label-less chip row (**resource → type → date**),
  and the total duration. The resource is `sst_resource_ref.name` (falling back
  to the `sst_resource` text field).
- **Composed entry title** (list + detail): `<type> am <date> auf Projekt
  <project number>` (e.g. *Arbeit am 07.08.2024 auf Projekt P10002233*). The
  date and the related project number (`sst_project_id.sst_projectnumber`) are
  fetched per page via one WebAPI `$expand` call, so the title works even when
  those columns aren't in the bound view. Missing parts are omitted gracefully.
- **Two modes** (toolbar toggle). Both require the entry to have a **project**
  (`sst_project_id` set):
  - **Aufteilen / Split** — `sst_worksubtypecompleted = No`; opens the split
    editor on the right.
  - **Zuordnen / Assign** — `sst_worksubtypecompleted = Yes` **and**
    `sst_timereport` empty; a multi-select list with a **Create delivery notes**
    action.
  Breaks (`sst_type` = `pauseValue`, default `Pause`) are excluded from both
  modes. The list is loaded **directly from the server with the mode filter
  already applied** (`webApi.retrieveMultipleRecords` on
  `sst_roundedtimeentries`), rather than pulling every page of the bound view and
  filtering client-side.
  This keeps the filters correct and the control fast even when the table holds
  far more than Dataverse's 5000-record page cap (the previous approach showed an
  empty list once the table exceeded that cap).
- **Create delivery notes** (assign mode) — tick one or more entries; a bottom
  action bar shows the count and **two** buttons:
  - **Create delivery notes** — creates the notes and stays in the list (if
    exactly one note results it still opens automatically).
  - **Create & open ↗** — does the same, then opens the result: a single
    delivery note opens directly; if **several** were created, a picker overlay
    lists them by **delivery-note number** (`sst_deliverynotenumberassembly_str`,
    with the work order as a sub-line) so the user chooses which to open.
  Both create one delivery note (`sst_timereports`) per work order across the
  selection and link each selected entry to its work order's note via
  `sst_TimeReport`. Entries already assigned to a delivery note are rejected.
  While the notes are being created a **progress overlay** blocks the list so
  the user can't keep clicking. (Ported from the Schulz `createTimeReport`
  ribbon command.)
- **Live search** across the title, type, date, **project number**, and
  **resource name** (`sst_resource_ref.name`) — over the full server-filtered
  result set (not just one page).
- **Period filter & sorting** — a sub-toolbar offers a period filter
  (**All / Today / This week / This month**, by `sst_date`) and a sort dropdown
  (**date newest/oldest, project, resource, duration**) as a custom, dependency-
  free React dropdown (click-outside / Escape close, keyboard navigation). Both
  apply client-side over the loaded set, so they're instant.
- **Empty state** — when no entries qualify (or a search has no matches) the list
  shows a binoculars icon and a short one-liner instead of a blank pane.
- **"My hours" chip** (preselected) — filters to entries whose resource's user is
  the current user. The user's `bookableresource`(s) are resolved via
  `_userid_value`, and the list query is restricted to those via
  `_sst_resource_ref_value` (a server-side filter). It is **locked on** for
  everyone except holders of **System Administrator** or **SST | Dispo
  Teamleitung Addon**, who may toggle it off to see all hours.
- **Detail split panel** — selecting an entry loads its work-subtype rows
  (`sst_roundedtimeentryworksubtypes`) and lets the user edit the hours per
  subtype, with a live **Total / Distributed / Remaining** summary.
- **"Use remaining" icon** — while time is still unallocated (remaining > 0), a
  small arrow icon appears next to **every** subtype field; clicking it adds the
  remaining amount to that field's current value (one tap to finish the split).
- **Guarded save** — the *Save split* button only enables when the distributed
  hours equal the entry's total duration.
- **Atomic split workflow** (faithful to the original Custom Page), executed via
  `context.webAPI`:
  1. persists each subtype's `sst_timevalue`,
  2. creates one new Rounded Time Entry per subtype with hours > 0 — copying the
     booking / work order / project lookups, date, name and notes, writing the
     subtype name into `sst_workordersubtype`, the type as `<Type> (<Subtype>)`,
     and `sst_worksubtypecompleted = Yes`,
  2b. resolves the work type (`sst_worktype_ref` / `sst_worktype_title_str`) per
     split from the composite key **(paytype, timetype)**: paytype from the
     subtype's `sst_paytype_opt` (else its name matched to the option label),
     timetype from the original entry's `sst_timetype_opt` (else its `sst_type`
     text). The matching `sst_worktype` record is looked up at save time,
  3. marks the original **and its related pauses** (same work order) as
     completed,
  4. deletes the original — its child subtype rows are removed automatically by
     the cascade-delete relationship.
- **Confirmation dialog** before the destructive save/delete.

### 📱 Adaptive (desktop + mobile)
- **One control, two layouts**, chosen at runtime from
  `context.client.getFormFactor()` (with an allocated-width fallback):
  - **Desktop / Tablet** → the two-pane master/detail layout (unchanged).
  - **Phone** → a single-pane, touch-first flow: full-width list → tap an entry
    → full-screen split editor with a **‹ Back** header → save returns to the
    list. Larger tap targets, big numeric inputs, and a bottom-pinned save
    button.
- Assign the same control to **Web + Tablet + Phone** when adding it to the
  view; no separate mobile build to maintain.

### 🌐 Internationalization
- **Trilingual UI** (German / English / French), chosen automatically from the
  user's Dataverse language (`context.userSettings.languageId`).

### 🔧 Technical
- **React 17** + TypeScript, no extra runtime libraries.
- **Schema-aware, configurable**: all field bindings have verified SST defaults
  in `schema.ts` and can be overridden per placement via manifest properties.
- **Lookup-safe split create**: `@odata.bind` targets are resolved at runtime
  from the original record's lookup annotations + entity metadata, so the work
  order / booking / project links survive the split regardless of their target
  tables.
- **Optimistic list updates**: after a split-save or delivery-note assignment the
  affected rows leave the current filter, so they're dropped from the list locally
  (the split original and the assigned entries) instead of triggering a full
  server reload — instant, no flicker. A mode switch or "My hours" toggle reloads
  fresh from the server. `createTimeReports` returns the actually-assigned ids so
  only those are removed (partial failures keep their rows).

## 🚀 Component structure

```
WorkTimeSplitGrid/
├── components/
│   ├── WorkTimeSplitGrid.tsx      # Master/detail shell, toolbar, toggle, state
│   ├── EntryList.tsx              # Left master list of entries
│   ├── SplitPanel.tsx            # Right split editor + save + confirm dialog
│   ├── api.ts                    # WebAPI: load subtypes + split-save sequence
│   ├── schema.ts                 # Single source of truth for logical names
│   ├── i18n.ts                   # DE/EN/FR strings + LCID mapping
│   └── types.ts                  # Type definitions
├── css/WorkTimeSplitGrid.css
├── strings/WorkTimeSplitGrid.1033.resx
├── ControlManifest.Input.xml
└── index.ts                      # ReactDOM root
```

## ⚙️ Properties

The control binds a dataset (`entries`) to a Rounded Time Entries view. All
other properties are **optional overrides** — the defaults target the SST
(Schulz Systemtechnik) schema.

| Property            | Default                      | Purpose |
|---------------------|------------------------------|---------|
| `entries` (dataset) | —                            | The Rounded Time Entries shown as the master list |
| `totalField`        | `sst_duration`               | Decimal column with the entry's total duration |
| `dateField`         | `sst_date`                   | Date column shown in the list |
| `typeField`         | `sst_type`                   | Text type column (Arbeit/Fahrzeit/Pause) |
| `pauseValue`        | `Pause`                      | Type value that marks a break (hidden + completed on save) |
| `completedField`    | `sst_worksubtypecompleted`   | Boolean "already split" flag |
| `subtypeField`      | `sst_workordersubtype`       | Text column on split records storing the subtype name |

Fixed schema (in `schema.ts`): parent `sst_roundedtimeentries`, child
`sst_roundedtimeentryworksubtypes` (`sst_name`, `sst_timevalue`,
`sst_roundedtimeentry`), copied lookups `sst_workorder` / `sst_bookableresourcebooking`
/ `sst_project_id`, notes `sst_freitextfeld`.

## 🛠️ Build

```powershell
npm install
npm run build -- --buildMode production
```

To produce importable solution zips, run the solution
[`build.ps1`](../WorkTimeSplitGrid.Solution/build.ps1).

## 📝 Notes / assumptions
- The work-subtype rows are expected to exist per entry (created upstream); the
  control edits their values and writes the split records.
- "Total duration" is read from `sst_duration`. If your environment uses a
  different total column, override `totalField`.
- Verified against the SSTCore solution export; sanity-check field names against
  the target environment before enabling the destructive save in production.
