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
  has three lines: the composed title, a label-less chip row (**resource →
  project number**), and a footer line with the **project name** chip on the
  left and the total duration (*Total: xx h*) right-aligned. The resource is
  `sst_resource_ref.name` (falling back to the `sst_resource` text field); the
  project chips are the project number (`sst_project_id.sst_projectnumber`) and
  the project name (`sst_project_id.msdyn_subject`). Entries on a
  **fixed-price project** get an additional amber-accented **🏷️ Fixed price**
  chip (`hso_projecttype = 100000001`, read from the same `sst_Project_id`
  `$expand`) — so once a team lead switches them into the list, they stay
  distinguishable at a glance.
- **Grouping with sums** (`grouping.ts`) — the list can be grouped by
  **project**, **resource** and **day**, independent of the sort order (the
  sort orders the cards inside the innermost group):
  - **Desktop:** up to **two levels** via two dropdowns in the sub-bar
    (*Group by … then …*); default *Day*. The second dropdown always stays
    in place and is only greyed out while the first is *None* (calm layout).
    An **ⓘ** button next to it (split mode) explains how *Split day* works. *Resource* is only offered while
    "all hours" is shown (with "my hours" it would be a single group) and
    drops out automatically when switching back.
  - **Mobile** (fitter use): one level, toggle **Day | Project**.
  - Every header shows the group's **Work**, **Travel** and **Total** hours.
    Level-1 headers are sticky with sum pills; level-2 headers are indented
    and compact (text sums, not sticky). Every group can be collapsed.
  - Group order: day follows the date sort direction (newest first
    otherwise), project by number, resource alphabetically; empty values
    last as *(no project)* / *(no resource)*.
  - Card chips that repeat a group header are hidden (no project chips while
    grouped by project, no resource chip while grouped by resource).
  - The category comes from the entry's `sst_type` text by prefix
    (`Arbeit`/`Work` → work, `Fahrzeit`/`Travel` → travel, defaults in
    `schema.ts`); other types count towards the total only. Sums are
    computed client-side over the loaded (filtered) rows.
  - **Assign mode:** each header has a checkbox (with an indeterminate
    state) that selects all entries of the group — grouped by project, one
    click selects exactly one delivery note's worth of entries.
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
  modes, as are entries on **fixed-price ("Festpreis") projects** — unless a team
  lead enables the *Show fixed-price hours* switch (desktop only, see below) (the project's
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
    with the project as a sub-line) so the user chooses which to open.
  Both create one delivery note (`sst_timereports`) **per project** across the
  selection and link each selected entry to its project's note via
  `sst_TimeReport` — 5 entries on 2 projects give 2 notes. The project is bound
  to the note's `sst_Projekt` (→ `msdyn_projects`); the work order
  (`sst_Arbeitsauftrag`) is only set when **all** entries of that project group
  share the same work order, and left empty otherwise so dual-write never gets an
  arbitrary `WORKORDER`. The note's `sst_name` is **`Timereport <yyyy-MM-dd> /
  <resource name>`** — matching the parallel cloud flow
  (`concat('Timereport ', date, ' / ', resource.name)`; date = today (local ISO),
  resource = the resource of the **first selected entry** (`sst_resource_ref.name`),
  like the flow's `Get_Resource` step). Entries already assigned to a delivery note
  are rejected.
  While the notes are being created a **progress overlay** blocks the list so
  the user can't keep clicking. (Ported from the Schulz `createTimeReport`
  ribbon command.)
- **Server errors are surfaced** — when a split save or delivery-note creation
  is rejected by the server (e.g. a plugin / Dual Write error), the actual server
  **`message`** is shown in the toast (extracted from the Web API / `$batch` /
  OData `{ error: { message } }` shapes), not just a generic failure. Error toasts
  stay longer and are **click-to-dismiss**; the full error is also in the ⓘ panel.
- **Live search** across the title, type, date, **project number**, and
  **resource name** (`sst_resource_ref.name`) — over the full server-filtered
  result set (not just one page).
- **Period filter & sorting** — a period filter (**All / Today / This week /
  This month**, by `sst_date`) sits in a sub-toolbar; sorting (**date
  newest/oldest, project, resource, duration**) is a compact **sort icon** in the
  top row next to the search box, opening a custom, dependency-free dropdown
  (click-outside / Escape close, keyboard navigation). Both apply client-side
  over the loaded set, so they're instant. The command bar shows **no record
  count** (it caused a layout shift on filter changes and isn't needed).
- **Search-match highlight** — matching substrings are highlighted in the card
  title and chips as you type. The project-name chip is searched too.
- **Info / diagnostics** — a small **ⓘ** button in the top row (next to the sort
  icon) opens a panel showing the control version, online status, session id, user
  and environment, plus the **buffered telemetry** of the current session. One
  **Copy** button copies the whole blob to the clipboard so a user can forward it
  for support. The telemetry buffer is an in-memory ring (last 200 events); note
  the control's `logger` events do **not** flow to Application Insights on their
  own — this panel is the built-in way to hand them off.
- **Pull-to-refresh (mobile)** — on a phone, pull the list down past the
  threshold to reload from the server (a damped pull indicator + spinner).
- **Empty state** — when no entries qualify (or a search has no matches) the list
  shows a binoculars icon and a short one-liner instead of a blank pane.
- **Scope switch** (*My hours ↔ All hours*, defaults to **My hours**) — a compact
  toggle: **off = my hours**, **on = all hours**. My-hours filters to entries
  whose resource's user is the current user — the user's `bookableresource`(s)
  are resolved via `_userid_value`, and the list query is restricted to those via
  `_sst_resource_ref_value` (a server-side filter). The switch is **locked off**
  (my hours) for everyone except holders of **System Administrator** or **SST |
  Dispo Teamleitung Addon**, who may turn it on to see all hours. For those
  privileged users the switch also **starts on "All hours"** (on every form
  factor). Because the role check is async, the *first* entries load is held
  until it answers — otherwise the list would fetch "my hours" and immediately
  re-fetch "all hours". The default is applied **once**, so a deliberate switch
  back to "my hours" survives a refresh or an offline→online transition.
- **Fixed-price switch** (*Show fixed-price hours*, defaults to **off**) — sits
  next to the scope switch and adds entries on fixed-price ("Festpreis") projects
  back into the list, which both modes hide by default. It is rendered **only**
  for holders of the same two roles **and only in the desktop layout** (never on
  the phone form factor). Turning it on drops the `hso_projecttype` clause from
  the server query; the state is additionally gated on the permission, so a stale
  `on` can never widen the query for a user who may not use it.
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
    booking / work order / project / resource / project-task lookups, date, name,
    notes, resource text and user email — each only when filled on the original,
    so a split keeps the "My hours" filter and its project-task attribution;
    subtype name into
    `sst_workordersubtype`; type `<Type> (<Subtype>)`; `sst_worksubtypecompleted
    = Yes`; the resolved `sst_worktype_ref` **and** `sst_worktype_title_str` ← the
    worktype's `sst_title_str`). If no matching worktype resolves, the split is
    created **without** one and a `split.worktypeUnresolved` **warn** event is
    logged (`entryId`, `subtype`, `paytype`, `timetype`, `reason`) so gaps in the
    `sst_worktype` data are visible in the trace instead of silent,
  - marks the original **and its related pauses** completed,
  - deletes the original (child subtype rows cascade).
  These run as a **single `$batch` changeset** (all-or-nothing) posted to the
  Web API `$batch` endpoint. If that endpoint isn't reachable/authorized in the
  host, it falls back to a **compensating sequence** over `context.webAPI` that
  rolls the created splits back (and un-marks the original) if the delete fails —
  so a split never leaves duplicates or an orphaned original.
- **Confirmation dialog** before the destructive save/delete.

### 📅 Day-level split
- A **Split day** button appears on every group header (split mode, online)
  that pins exactly one person-day: the path fixes the day, and the person
  is fixed by the path or unique among the group's entries (e.g. *Day*,
  *Resource › Day*, *Day › Resource* at the resource level, *Project › Day*
  at the day level).
- The editor always covers **all open entries of that person on that day** —
  across projects and regardless of the search term — because the surcharge
  rules (8 h/day → overtime, Sunday, holiday) are per person and per day.
  Opened from below a project header, the editor says which other projects
  the day also contains. All cards of the scope are highlighted in the list.
- The editor shows **one block per category** — *Work* and *Travel* — each
  with the day's total for that category and the union of the entries' work
  subtypes (matched by normalized name, so "Überstunde"/"Überstunden" merge).
  Entries of any other type are listed as "not distributed" and left alone;
  the single-entry split remains available for them and for fine-tuning.
- **Chronological fill** (`daySplit.ts`): the day's entries are walked in
  time order of their **booking start** (`sst_BookableResourceBooking.starttime`
  — verified in PROD: `sst_date` is the booking `endtime`, i.e. the end of
  the capture; it is only the fallback, e.g. offline). The preview shows
  `start–end` per entry. The same expand also supplies the booking's resource
  as fallback when the entry has no `sst_resource_ref` / `sst_resource`. The
  entries are walked in that order and the subtypes in canonical order (Normal → Überstunde →
  Nacht/Sonntag → Feiertag), pouring each subtype's hours into the entries
  from the top. Overtime therefore lands on the last entries of the day, the
  cut happens at one boundary per subtype (quarter hours stay quarter hours),
  and **every entry keeps exactly its own total** — the per-entry save guard
  still holds. A collapsible **preview per entry** shows the outcome live.
- ★ **Suggestion** works on the day total (holiday / Sunday / 8 h rule) — the
  main reason for day-level splitting: per entry, three 4 h entries would each
  be suggested as "Normal 4 h" although 4 h of the day are overtime.
- Save guard: every block must be fully distributed (remaining = 0) and every
  entry must own the subtype rows that receive hours (otherwise the missing
  ones are named and the save stays disabled).
- **Saved as ONE `$batch` changeset** for all entries of the day (same
  mutation as the single split per entry; pause updates de-duplicated across
  entries sharing a work order) — all or nothing. If `$batch` is unavailable
  in the host, the entries fall back to the per-entry compensating sequence in
  order; a failure mid-way reports "only x of y entries split" and reloads the
  list, so the earlier entries are correctly gone and the rest stay open.
- Mobile: the day editor is a full-screen pane like the single split (back
  header, sticky save button, −/+ steppers, preview collapsed by default).
- Offline: the button is hidden (the split is a server transaction).

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
  (newest) ⌄`) via a *"Hide filters"* trigger, maximizing the visible list;
  tap the summary to expand it again. The summary reflects the active filters
  live and shows a search-active dot. Desktop is unaffected (bar always full).
  Respects `prefers-reduced-motion`.
- Assign the same control to **Web + Tablet + Phone** when adding it to the
  view; no separate mobile build to maintain.

### 🌐 Internationalization
- **Trilingual UI** (German / English / French), chosen automatically from the
  user's Dataverse language (`context.userSettings.languageId`).

### 📴 Offline (blocked — connection required)
- **Online** → the live server-side queries + `$batch` save (as above).
- **Offline** → the control **blocks** with a clear *"Connection required"* state
  and a **Retry** button — it does **not** show a cached list. Rationale: this
  control needs the live Web API for **both** the mode-filtered list **and** the
  transactional split/assign save, so an offline read-only cache could only ever
  show **stale, wrong-status rows** (e.g. an already-split entry showing under
  *Split*). Blocking is honest and avoids that confusion.
- It does **not** blindly trust `isOffline()` (which can falsely report offline on
  a cold start): it **probes the live Web API** (bounded by a ~7 s timeout) and
  shows the blocking state if that call **fails**. Offline mode, though, returns an
  *empty result as a success* — so an empty list while the host hints offline is
  ambiguous (offline vs. a genuinely empty online list). To resolve it the control
  fires a **real connectivity check**: since `context.webAPI` has no WhoAmI, it
  reads the **current user's own security roles** — online returns ≥1 role, offline
  the call fails or the roles aren't cached. So an empty list only blocks when that
  check confirms offline; a genuinely-empty **online** list shows normally. While
  the probe runs it shows a neutral **"Connecting…"** state; on success it goes
  straight to the normal online list/editor — no manual offline→online toggle
  needed. **Retry** re-runs the probe, so a device that just reconnected recovers
  with one tap.
- **Network gate:** if the host reports **no device network** (`context.client.
  isNetworkAvailable()` returns false) the control blocks **immediately** —
  skipping the probe and its timeout — instead of briefly showing a stale "online".
  (Best-effort: on hosts that don't expose the method it's treated as available.
  Note this gates on *network*, not on pending offline sync — PCF has no API for
  the sync queue.)
- `WebAPI`/`Utility` are declared **`required="false"`** so the host still renders
  the control (and thus the "connection required" state) instead of failing with a
  generic "control can't load" error.
- **Recommended:** since the control can't work offline anyway, exclude this app /
  the `sst_roundedtimeentries` table from the **mobile offline profile** (or turn
  off offline for the app) so it always runs online. Full **write-enabled** offline
  (Option C) is deferred — see [`OfflinePlan.md`](OfflinePlan.md).

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
│   ├── DaySplitPanel.tsx         # Day-level editor (work/travel blocks, preview)
│   ├── SubtypeRowEditor.tsx      # Shared subtype input row (arrow + stepper)
│   ├── grouping.ts               # 1–2 level grouping tree, sums, day-split scope
│   ├── daySplit.ts               # Chronological fill of a day total into entries
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
/ `sst_project_id` / `sst_resource_ref` / `sst_projecttask_ref`, copied plain
columns `sst_resource` / `sst_useremail`, notes `sst_freitextfeld`.

> The `@odata.bind` navigation property is the attribute's **PhysicalName**, which
> is not uniformly cased in this schema — `sst_WorkOrder` is PascalCase while
> `sst_resource_ref` / `sst_projecttask_ref` are lower-case (verified against the
> SSTCoreV2 `customizations.xml`). Don't normalize them.

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
- **Environment tolerance (schema drift).** `sst_paytype_opt` on the child table
  is treated as **optional**: it was deployed in INT/UAT but missing in PROD, and
  because Dataverse rejects the *entire* query when a `$select` names an unknown
  property, that single column took the whole split editor down. `loadSubtypes`
  now probes once, retries without the column, caches the answer for the session
  and logs `subtypes.payTypeColumnMissing`; the pay type then falls back to the
  name match. Likewise, subtype ordering and option matching are **keyword- and
  separator-insensitive** ("Überstunde" vs "Überstunden", "Nacht & Sonntag" vs
  "Nacht / Sonntag"), because the environments word these differently.
- "Total duration" is read from `sst_duration`. If your environment uses a
  different total column, re-enable the `totalField` override (see Properties).
- Verified against the SSTCore solution export; sanity-check field names against
  the target environment before enabling the destructive save in production.
