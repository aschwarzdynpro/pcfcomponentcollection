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
  shows the composed title, a label-less chip row (**resource → project**), and
  the total duration. The resource is `sst_resource_ref.name` (falling back to
  the `sst_resource` text field); the project chip is the project number
  (`sst_project_id.sst_projectnumber`).
- **Composed entry title** (list + detail): `<type> am <date>` (e.g. *Arbeit am
  07.08.2024*). The date and the related project number
  (`sst_project_id.sst_projectnumber`) are fetched per page via one WebAPI
  `$expand` call, so the title and the project chip work even when those columns
  aren't in the bound view. Missing parts are omitted gracefully.
- **Two modes** (toolbar toggle). Both require the entry to have a **project**
  (`sst_project_id` set):
  - **Aufteilen / Split** — `sst_worksubtypecompleted = No`; opens the split
    editor on the right.
  - **Zuordnen / Assign** — `sst_worksubtypecompleted = Yes` **and**
    `sst_timereport` empty; a multi-select list with a **Create delivery notes**
    action.
  Breaks (`sst_type` = `pauseValue`, default `Pause`) are excluded from both
  modes, as are entries on **fixed-price ("Festpreis") projects** (the project's
  `hso_projecttype = 100000001`, filtered via the `sst_Project_id` navigation
  property). The list is loaded **directly from the server with the mode filter
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
- **Search-match highlight** — matching substrings are highlighted in the card
  title and chips as you type.
- **Pull-to-refresh (mobile)** — on a phone, pull the list down past the
  threshold to reload from the server (a damped pull indicator + spinner).
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
  subtype, with a live **Total / Distributed / Remaining** summary. The detail
  header is shortened to **project number / booking number** (e.g.
  `P10006786 / S-120044`) — the type and date are already on the sub-line. The
  booking number is the `bookableresourcebooking` display value.
- **Smart pre-fill (★ button)** — a small star/AI button in the panel head fills
  the distribution from the entry's **date + total duration** (on demand; the
  user can still adjust). **Hidden by default** — enable it with the
  `showSuggestButton` manifest property (set it to `show`). Rules:
  - **Holiday** → all on *Feiertag*.
  - **Sunday** → all on *Nacht / Sonntag*.
  - **Workday ≤ 8 h** → all on *Normal*; **> 8 h** → 8 h on *Normal*, the rest on
    *Überstunde*.
  Holidays are resolved live via the chain **entry → `sst_resource_ref`
  (bookableresource) → `sst_site_ref` (sst_site) → `sst_country_ref`
  (sst_country)**, then `sst_publicholiday` rows for that country whose
  `[sst_startdate_dat, sst_enddate_dat]` range covers the date. Best-effort: if a
  link is missing or unreadable, the day is treated as a normal workday. Subtype
  rows are matched by keyword (robust to Überstunde/Überstunden).
- **"Use remaining" icon** — while time is still unallocated (remaining > 0), a
  small arrow icon appears next to **every** subtype field; clicking it adds the
  remaining amount to that field's current value (one tap to finish the split).
- **Guarded save** — the *Save split* button only enables when the distributed
  hours equal the entry's total duration.
- **Atomic split workflow** (faithful to the original Custom Page). It first
  *prepares* everything read-only (reads the original, resolves the work type
  from the composite **(paytype, timetype)** key, resolves the lookup
  `@odata.bind` targets, builds the per-subtype create payloads and finds the
  related pauses), then performs all mutations **transactionally**:
  - creates one Rounded Time Entry per subtype with hours > 0 (copying the
    booking / work order / project lookups, date, name, notes; subtype name into
    `sst_workordersubtype`; type `<Type> (<Subtype>)`; `sst_worksubtypecompleted
    = Yes`; the resolved `sst_worktype_ref` / `sst_worktype_title_str`),
  - marks the original **and its related pauses** completed,
  - deletes the original (child subtype rows cascade).
  These run as a **single `$batch` changeset** (all-or-nothing) posted to the
  Web API `$batch` endpoint. If that endpoint isn't reachable/authorized in the
  host, it falls back to a **compensating sequence** over `context.webAPI` that
  rolls the created splits back (and un-marks the original) if the delete fails —
  so a split never leaves duplicates or an orphaned original.
- **Confirmation dialog** before the destructive save/delete.

### 📱 Adaptive (desktop + mobile)
- **One control, three layouts**, chosen at runtime from
  `context.client.getFormFactor()` (with an allocated-width fallback) and the
  live container size:
  - **Desktop / Tablet** → the two-pane master/detail layout (unchanged).
  - **Phone (portrait)** → a single-pane, touch-first flow: full-width list →
    tap an entry → full-screen split editor with a **‹ Back** header → save
    returns to the list. Larger tap targets, big numeric inputs, and a
    bottom-pinned save button. Each subtype row is a single compact line —
    **label + a +/− stepper + a narrow number field** (±0.25 h, floored at 0) —
    so all subtypes are visible at a glance; tap the steppers or type directly.
  - **Phone (landscape)** → the two-pane **cockpit**: list + split editor side
    by side under a compact, single-row command bar — the wide-but-short
    viewport is no longer wasted by stacked toolbars over a hidden list. Keeps
    the phone touch ergonomics (pull-to-refresh, big steppers); no **‹ Back**
    needed since both panes are visible. Rotating the device switches between
    portrait single-pane and landscape cockpit live (driven by the allocated
    width/height; needs ≥ 640px width, so small phones stay single-pane).
- **Collapsible filter bar (phone)** — the search + mode + period + sort bar
  collapses (animated) to a **one-line summary** (`🔍 Zuordnen · Alle · Datum
  (newest) · 8 ⌄`) via a *"Hide filters"* trigger, maximizing the visible list;
  tap the summary to expand it again. The summary reflects the active filters
  live and shows the current count + a search-active dot. Desktop is unaffected
  (bar always full). Respects `prefers-reduced-motion`.
- Assign the same control to **Web + Tablet + Phone** when adding it to the
  view; no separate mobile build to maintain.

### 🌐 Internationalization
- **Trilingual UI** (German / English / French), chosen automatically from the
  user's Dataverse language (`context.userSettings.languageId`).

### 📴 Offline (read-only)
- **Online** → the live server-side queries + `$batch` save (as above).
- **Offline** → the control switches to a **read-only** dataset-based path. It
  does **not** blindly trust `isOffline()` (which can falsely report offline on a
  cold start): it **probes the live Web API** and only falls back to read-only if
  that call actually fails (bounded by a ~7 s timeout). On success it
  auto-upgrades to the online path — no manual offline→online toggle needed.
  While the probe runs, a neutral **"Connecting…"** banner shows; the read-only
  offline banner appears only once the probe has actually failed.
  - **Read:** the list is built from the bound **(offline-cached) dataset** and
    filtered client-side (pauses excluded; split→not completed; assign→completed
    & no delivery note; project required when the project column is in the view).
    The **Festpreis** and **My hours** filters are skipped offline (the project
    type and resource→user mapping aren't reliably in the local cache).
  - **Write disabled:** the split save and delivery-note creation are **turned
    off offline** — the split panel shows the entry read-only with a notice, and
    the assign list isn't selectable. This avoids the destructive, transactional
    save running against the local cache (a **sync-conflict** minefield). Subtypes
    aren't loaded offline (no `$expand` needed).
  - A slim **offline banner** signals the read-only mode.
  - **While the cache is still syncing** (`dataset.loading`) the empty list
    shows a *"Syncing offline data…"* spinner instead of the "nothing here"
    empty state, and **pull-to-refresh** calls `dataset.refresh()` to re-pull
    the cache (the online server-reload path doesn't run offline).
- **Offline-first cold start:** on some devices the app reports
  `isOffline() === true` for a while after launch (until a full offline→online
  cycle) even when connected. Because the control probes the live Web API rather
  than trusting that flag, it shows the cached list instantly and then
  **auto-recovers to online** as soon as the server answers — users no longer
  have to toggle airplane mode. If the Web API genuinely can't be reached (true
  offline, or `context.webAPI` unavailable), it stays read-only; to force full
  online on a connected device the maker can enable the **Online-mode** toggle
  (*"Allow users to work in online mode"*).
- `WebAPI`/`Utility` are declared **`required="false"`** so the host renders the
  control offline at all (a *required* unavailable feature otherwise blocks it
  with a generic "control can't load" error).
- ⚠️ Offline needs an **offline profile** (admin) that includes
  `sst_roundedtimeentries` **and** the columns/related tables the view + control
  read, or the cached dataset stays empty (an empty list after sync = the table
  isn't in the profile). Full **write-enabled** offline (Option C) is deferred —
  see [`OfflinePlan.md`](OfflinePlan.md).

### 🔧 Technical
- **React 17** + TypeScript, no extra runtime libraries.
- **Telemetry / logging**: a small structured logger (`telemetry.ts`) writes to
  the PCF diagnostic trace (`context.tracing`) and the console, both guarded so
  logging can never break the control. The destructive operations are
  instrumented as timed operations with progress steps and a **stage marker** —
  e.g. the split save logs `splitSave.start` → `splitSave.splitsCreated` →
  `splitSave.pausesCompleted` → `splitSave.ok` (or `splitSave.fail` with the
  stage it reached, so a failure between *splitsCreated* and *deleteOriginal* is
  diagnosable). Delivery-note creation logs `createReports.*` (per-note + result)
  and load failures log `loadEntries`.
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
│   ├── EntryList.tsx              # Left master list (highlight + pull-to-refresh)
│   ├── SplitPanel.tsx            # Right split editor + save + confirm dialog
│   ├── Dropdown.tsx              # Custom, dependency-free sort dropdown
│   ├── api.ts                    # WebAPI: load entries/subtypes + split-save + reports
│   ├── schema.ts                 # Single source of truth for logical names
│   ├── telemetry.ts             # Structured logger (tracing + console)
│   ├── i18n.ts                   # DE/EN/FR strings + LCID mapping
│   └── types.ts                  # Type definitions
├── css/WorkTimeSplitGrid.css
├── strings/WorkTimeSplitGrid.1033.resx
├── ControlManifest.Input.xml
└── index.ts                      # ReactDOM root
```

## ⚙️ Properties

The control binds a dataset (`entries`) to a Rounded Time Entries view. Only
two properties are exposed in the maker:

| Property            | Default                      | Purpose |
|---------------------|------------------------------|---------|
| `entries` (dataset) | —                            | The Rounded Time Entries shown as the master list |
| `showSuggestButton` | *(empty = hidden)*           | Set to `show` (or true/yes/ja/1) to display the AI suggestion (★) button in the split detail |

The field-mapping overrides (`totalField` `sst_duration`, `dateField`
`sst_date`, `typeField` `sst_type`, `pauseValue` `Pause`, `completedField`
`sst_worksubtypecompleted`, `subtypeField` `sst_workordersubtype`) are
**disabled** — the SST defaults in `schema.ts` apply, so they no longer clutter
the maker UI. To re-expose any one, uncomment the matching `<property>` in
`ControlManifest.Input.xml` and its read in `index.ts`.

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
  different total column, re-enable the `totalField` override (see Properties).
- Verified against the SSTCore solution export; sanity-check field names against
  the target environment before enabling the destructive save in production.
