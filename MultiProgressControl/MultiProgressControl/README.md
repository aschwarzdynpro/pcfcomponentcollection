# MultiProgressControl

A read-only Power Apps Component Framework (PCF) field control for Dataverse
that renders up to **6 configurable Whole-Number columns** as compact **ring
progress indicators (0–100 %)** in a row. It is a slim replacement for a tall,
vertically stacked "status card" (design handoff "Variant C").

All six rings sit on **one line** when there is room; when the field is too
narrow the row snaps to **exactly three per row** (6 → 3 + 3), never the ragged
5 + 1 / 4 + 2 that normal wrapping produces.

The ring colour signals the state at a glance: **0 % neutral**, **1–99 %
brand-blue**, **100 % green**.

## ✨ Features

- **Ring row, 6-or-3 layout** — a CSS grid shows all six 52 px rings on one line
  and switches to exactly three per row (via a container query) when the field
  is narrower than ~568 px.
- **Status colour logic** — `0 → #C8C6C4` (open), `1–99 → #0F6CBD` (in progress,
  taken from the host Fluent brand token when available), `100 → #0E700E` (done).
  The ring and the centred percentage share the status colour.
- **Per-ring caption** — `labelN` override, or the bound column's display name
  when left empty.
- **Value handling** — each value is normalised to a percentage via `maxValue`
  (default `100`), clamped to `0–100`; `null`/empty renders as `0 %`.
- **Optional header** — `headerLabel` renders a small uppercase caption (e.g.
  "Status") above the row; empty means no header.
- **Read-only** — nothing is ever written back to the record.
- **Accessible** — each ring is a `role="progressbar"` with
  `aria-valuenow/min/max` and an `aria-label`; each cell carries a
  `"<label>: <pct>%"` tooltip.
- **Bilingual** — empty-state / aria text in **German** and **English**, picked
  from `context.userSettings.languageId`.

## 🚀 Component structure

```
MultiProgressControl/
├── components/
│   ├── MultiProgress.tsx          # React view — row of SVG rings (6 -> 3 grid)
│   └── strings.ts                 # DE/EN strings + LCID → language
├── css/
│   └── MultiProgressControl.css   # Styling (design tokens + container query)
├── strings/
│   ├── MultiProgressControl.1033.resx  # EN manifest strings
│   └── MultiProgressControl.1031.resx  # DE manifest strings
├── generated/
│   └── ManifestTypes.d.ts         # Auto-generated property types
├── ControlManifest.Input.xml      # PCF manifest
├── index.ts                       # PCF entry point (data → percentages)
├── package.json
└── tsconfig.json
```

## 📋 Configuration properties

| Property        | Type          | Usage | Required | Description |
|-----------------|---------------|-------|----------|-------------|
| `field1`        | `Whole.None`  | bound | **yes**  | The column the control is dropped on — indicator 1. |
| `field2`–`field6` | `Whole.None`| bound | no       | Optional additional columns mapped in the control's configuration pane — indicators 2–6. |
| `label1`–`label6` | `SingleLine.Text` | input | no | Caption for the matching indicator. Leave empty to use the bound column's display name; keep it short for very narrow fields. |
| `maxValue`      | `Whole.None`  | input | no       | The column value that represents 100 %. Default `100` (columns already store a percentage). |
| `headerLabel`   | `SingleLine.Text` | input | no   | Optional caption shown above the row. Empty = no header. |

> **Binding 6 fields on a field control:** drop the control on the first column
> (`field1`), then bind `field2`–`field6` to additional columns in the control's
> property pane. Unmapped slots are skipped automatically.

## 🎨 Design tokens

| Token | Value |
|-------|-------|
| In progress / brand | `#0F6CBD` (or host Fluent brand token) |
| Done / 100 %        | `#0E700E` |
| Open / 0 %          | `#C8C6C4` |
| Ring track          | `#EDEBE9` |
| Label text          | `#616161` |
| Header caption      | `#919191` |
| Ring / stroke / radius | 52 px / 5 / 23.5 · cell 88 px · gap 16×8 px |
| Wrap breakpoint     | 6 per row ≥ 568 px container, otherwise 3 per row |

The control renders transparently — the white card and border in the design mock
are the form section itself, so the control does not draw a card-in-a-card.

## 🛠️ Development

### Prerequisites
- Node.js + npm
- Power Platform CLI (`pac`) for solution packing

### Build commands

```bash
cd MultiProgressControl

npm install            # install dependencies
npm run build          # production build (out/controls/)
npm start              # local test harness
npm run clean          # clean build artifacts
```

In the test harness, set the 6 fields to sample values (e.g. `66, 0, 40, 100,
25, 80`) to preview the row.

The Dataverse-importable solution is built from the sibling project; see
[`../MultiProgressControl.Solution/README.md`](../MultiProgressControl.Solution/README.md)
and run `./build.ps1` there.

## 🔧 Integration

1. Build and pack the control (`MultiProgressControl.Solution/build.ps1`).
2. Import the solution zip into the target environment.
3. On the target table's form, select the first Whole-Number column and choose
   **+ Component → MultiProgressControl**.
4. Bind `field2`–`field6` to the remaining columns, optionally set `label1`–
   `label6`, `headerLabel`, and `maxValue`.
5. Save and publish the form.

## 📝 License

MIT — part of the Power Platform PCF Component Collection.
