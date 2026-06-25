# CLAUDE.md — PCF Component Collection

Agent playbook for this repo. Goal: **create a new, production-ready PCF control
on request** and ship it the way this repo already does it — without re-deriving
the conventions each time. Read this first; it overrides generic assumptions.

`README.md` (component catalog + layout) and `INSTALLATION.md` (import walkthrough)
are the human docs — don't duplicate them here. This file is the *how we work*.

---

## 0. Working with the user

- **Language:** the user (Andy Schwarz) is German-primary. **Answer in German**;
  keep code, identifiers, commit messages, and the EN docs in English.
- **Auth:** always **device-code** flow for Azure/Entra (`az login --use-device-code`,
  `Connect-AzAccount -UseDeviceAuthentication`, `pac auth create` device-code).
  Show the device-code prompt prominently. Never the interactive browser flow.
- **Shell:** Windows + PowerShell (PS 5.1 quirks below). A Bash tool exists for
  POSIX scripts. `gh` CLI is **not** installed — use `git` + return the
  `pull/new/<branch>` URL the push prints.
- **No surprises:** the user iterates fast and tests by importing the local
  managed zip from `bin/`. Build the zip every time so they can test immediately.

---

## 1. Repository shape

Each control is a **feature folder** grouping PCF source + its Dataverse solution:

```
<Control>/
├── <Control>/            # PCF source (npm project: index.ts, components/, css/, strings/, ControlManifest.Input.xml)
│   ├── README.md         # EN feature doc
│   └── Funktionsuebersicht.md  # DE feature doc (for ADO)
└── <Control>.Solution/   # Importable solution
    ├── build.ps1         # builds PCF + packs zips (per-control, copy & adapt)
    ├── README.md         # solution metadata table (name/version/publisher/prefix)
    ├── bin/              # zips (GIT-IGNORED, local archive only)
    └── src/Other/Solution.xml  # <Version> lives here
```

Controls present: ChoicePickerControl, DataverseCrudComponent, FlagPhoneControl,
FuzzyLookupControl, HoursDaysControl, KanbanBoard, MultiProgressControl,
WorkTimeSplitGrid. `node_modules/`, `out/`, `generated/ManifestTypes.d.ts`, and
`*.zip` are git-ignored.

---

## 2. Publishers / customers — pick the right one FIRST

This repo hosts controls for **two customers**. New control → confirm which:

| Publisher (unique name)     | Prefix | Option-value prefix | Used by |
|-----------------------------|--------|---------------------|---------|
| `HerbertWaldmann`           | `wal`  | `15282`             | default for the collection (most controls) |
| `schulzsystemtechnikgmbh` (Schulz Systemtechnik GmbH) | `sst` | `86752` | WorkTimeSplitGrid (SST project) |

The prefix shows up in the **control namespace/constructor**, the solution
`Solution.xml` (`<CustomizationPrefix>`, `<CustomizationOptionValuePrefix>`,
`<UniqueName>`), and the staged folder name `src/Controls/<prefix>_<Ns>.<Name>`.
Don't mix them.

---

## 3. Recipe — create a new PCF control

1. **Clarify (don't guess):** customer/publisher (§2), control type (`field` vs
   `dataset`), the exact Dataverse table/columns it binds (logical names!),
   single vs multi binding, languages (DE/EN/FR trilingual is the norm; some are
   DE/EN). For SST schema, trust the **verified local SSTCore export**, not live
   probes (§7).
2. **Scaffold** inside a new `<Control>/<Control>/` folder:
   `pac pcf init --namespace <Ns> --name <Name> --template <field|dataset>`,
   then `npm install`.
3. **tsconfig.json** — match the repo (ends the moduleResolution linter war):
   ```json
   { "extends": "./node_modules/pcf-scripts/tsconfig_base.json",
     "compilerOptions": { "jsx": "react", "types": ["powerapps-component-framework"],
       "moduleResolution": "bundler", "allowSyntheticDefaultImports": true, "esModuleInterop": true } }
   ```
4. **React 17, bundled** (not platform-library): `react`/`react-dom` `^17` in
   `dependencies`. `control-type="standard"`; `index.ts` does
   `ReactDOM.render(...)` in `init`/`updateView` and `unmountComponentAtNode` in
   `destroy`. Local React state survives `updateView` while mounted.
5. **Code layout** (this repo's pattern): keep `index.ts` thin; put UI in
   `components/*.tsx`, all logical names/entity-sets/nav-props in one
   `schema.ts`, Web API calls in `api.ts`, strings in `components/i18n.ts`
   (`lcidToLang(lcid)` → de/fr/en), styles in `css/<Control>.css` namespaced
   `.<prefix>-…` / `.<ctrl>-…`. Manifest property labels go in
   `strings/<Control>.1033.resx` (`X_Display` + `X_Desc` per property).
6. **Manifest conventions:** every binding/override property
   `usage="input" required="false"` with a sensible default baked into
   `schema.ts` (so the maker UI stays clean — see WorkTimeSplitGrid where the
   field overrides are commented out, only the behavior toggles stay). Feature
   usage **`required="false"`** (§7). Add `trackContainerResize(true)` if the
   control needs vertical room.
7. **Build + package:** copy a `build.ps1` from a sibling `*.Solution` and adapt
   the names/prefix. It: `npm run build -- --buildMode production` → stages
   `out/controls/*` into `src/Controls/<prefix>_<Ns>.<Name>/` → `pac solution
   pack` unmanaged + managed → writes **versioned archive copies**
   `<Name>_<ver>.zip` / `<Name>_managed_<ver>.zip` (version read from
   `Solution.xml`, never overwritten).
8. **Docs:** write `README.md` (EN) **and** `Funktionsuebersicht.md` (DE) for the
   control, and add a row to the root `README.md` catalog + solutions table.
9. **Commit/PR** per §6 (workflow).

---

## 4. Build & commands

```powershell
# build only (also regenerates ManifestTypes.d.ts from the manifest first):
cd <Control>\<Control>; npm run build -- --buildMode production
# full package (build + stage + pack + versioned archive):
cd <Control>\<Control>.Solution; ./build.ps1
```
- A manifest change regenerates `generated/ManifestTypes.d.ts` at build start, so
  reading a new `context.parameters.<prop>` compiles **after** the build runs.
- Test artifact = `<Control>.Solution\bin\<Control>_managed_<ver>.zip`.

---

## 5. Versioning discipline (ALWAYS when a deliverable is finished)

Bump **all four** in lockstep, then rebuild the zips:
1. `ControlManifest.Input.xml` → `version="x.y.z"`
2. `<Control>/package.json` → `"version": "x.y.z"`
3. `<Control>.Solution/src/Other/Solution.xml` → `<Version>x.y.z.0</Version>`
4. `<Control>.Solution/README.md` → the `| Version | \`x.y.z.0\` |` row

Patch for fixes, minor for features. Never overwrite an existing versioned zip.

---

## 6. Git / PR workflow

- **Branch fresh off `main`** for each change (never commit straight to `main` —
  even when iterating). Surgical staging: `git add <Control>/…` only.
- Push, then hand back the `pull/new/<branch>` URL + a title/body. The user
  merges. (`gh` is unavailable; don't try to open the PR yourself.)
- Commit/PR only when the user asks (they usually do, per change).
- End commit messages with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- `bin/` zips are git-ignored — they don't go in the commit; only source +
  staged `src/Controls/...` (ControlManifest.xml, bundle.js, css, strings) do.

---

## 7. PCF gotchas & hard-won lessons (read before debugging)

- **`context.webAPI` is online + model-driven/portals only.** It does **not**
  exist in canvas apps / **Custom Pages** (→ "could not load" on first query),
  and it does **not** work in **mobile offline**. Any control that needs server
  reads/writes belongs on a **model-driven view/subgrid**, not a Custom Page.
- **Offline-first is the default Power Apps mobile mode** and reports
  `context.client.isOffline() === true` **even when the device is online** (it
  always reads the local SQLite cache). So: offline = read from the bound
  **dataset** (not webAPI); honor **`dataset.loading`** (show a syncing state,
  not "no entries", during initial/incremental sync); use **`dataset.refresh()`**
  for an offline refresh. An empty list *after* sync ⇒ the table/columns/related
  tables aren't in the **offline profile** (admin task), not a code bug.
- **Custom Pages:** mobile is public-preview and **offline is not supported** —
  don't propose them for offline scenarios.
- **`feature-usage required="true"` blocks offline render.** If a required
  feature (e.g. WebAPI) is unavailable offline, the host won't render the control
  at all (generic "control can't load") and your React offline notice never runs.
  Declare features **`required="false"`** so the control always loads and
  degrades gracefully.
- **`moduleResolution: "bundler"`** in tsconfig — without it the pcf-scripts vs
  editor TS settings fight endlessly.
- **PowerShell 5.1 + native exes:** PS turns native stderr into terminating
  errors even on exit 0. In `build.ps1` keep `$ErrorActionPreference = 'Continue'`
  and check `$LASTEXITCODE` after each `npm`/`pac` call.
- **Entity SET names ≠ logical names** (e.g. logical `sst_publicholiday` → set
  `sst_publicholidaies`; `sst_roundedtimeentries` → `sst_roundedtimeentrieses`).
  Get sets from metadata, don't pluralize by hand.
- **Web storage** (`localStorage`/`sessionStorage`) is discouraged in PCF and
  unreliable on mobile — keep UI state in component state / instance fields.
- **`prefers-reduced-motion`**: gate any CSS transitions/animations (this repo
  does). When animating a collapsing container with `overflow:hidden`, remember
  it **clips absolutely-positioned popovers** (dropdowns) — switch overflow back
  to `visible` once expanded & settled.
- **Verified schema beats live probes (SST):** the source of truth for the SST
  `sst_RoundedTimeEntries` schema is the local **SSTCore export**; sub-agent live
  Dataverse probes have produced fabricated field names. Sanity-check against the
  environment before any destructive save.

---

## 8. Verifying against a live environment (when needed)

`az` is logged into the **Schulz** tenant. Get a token and hit the Web API:
```powershell
$tok = (az account get-access-token --resource https://operations-d365-schulz-uat-1-1.crm4.dynamics.com --query accessToken -o tsv)
Invoke-RestMethod -Headers @{ Authorization = "Bearer $tok" } `
  -Uri 'https://operations-d365-schulz-uat-1-1.crm4.dynamics.com/api/data/v9.2/<entityset>?$select=…&$top=1'
```
SST UAT org: `https://operations-d365-schulz-uat-1-1.crm4.dynamics.com`. Use the
**entity set** name in the path. Confirm field logical names from metadata before
trusting them.
