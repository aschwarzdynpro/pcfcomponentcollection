# KanbanBoard

A modern, React-based Power Apps Component Framework (PCF) **dataset** control
that renders Dataverse records as Kanban cards grouped by a choice/status
column. Cards can be dragged between columns to update the status, with
optimistic UI and rollback on failure.

## ✨ Features

### 🎯 Core Functionality
- **Drag & drop** between columns → in-place `webAPI.updateRecord` with
  optimistic UI; visible rollback if the server rejects the change
- **Live search** across title, subtitle, description, and any visible
  view column
- **Click a card** → opens the record in its main form via
  `navigation.openForm`
- **`+` button per column** → opens the **quick-create form** with the
  status column pre-populated to that column's value
- **Empty columns** still render — no records are needed for a status to be
  shown, because columns come from option-set metadata
- **Honours form state**: respects disabled / read-only mode

### 🌐 Internationalization
- **Trilingual UI**: toolbar, error states, and column actions in **German**,
  **English**, **French**, picked automatically from the user's Dataverse
  language (`context.userSettings.languageId`)

### 🎨 Visual Features
- **Choice-color-aware columns**: column headers use the color set in the
  option-set metadata; falls back to a curated palette when no color is set
- **Readable foreground**: black/white text auto-picked via YIQ contrast
- **Smooth drag affordances**: drop-zone glow, optimistic dashed outline on
  the moved card, dashed "Drop here" indicator
- **Card hover lift** + extra-info chips for any additional view columns
- **Modern Fluent-UI-style** look (Segoe UI, soft shadows, 4 px accent
  stripe per card matching its current column)

### 🔧 Technical Features
- **React 17** + TypeScript
- **Native HTML5 Drag-and-Drop** — no extra runtime libraries
- **Optimistic state**: the moved card immediately appears in the new column
  with a subtle dashed outline; on `updateRecord` failure, snaps back and
  shows a transient error toast
- **Metadata-aware**: uses `context.utils.getEntityMetadata` to fetch
  option-set values (with localized labels and colors); falls back to
  record-derived columns if metadata is unavailable
- **`React.memo` cards** — only re-render when the card's data changes

## 🚀 Component Structure

```
KanbanBoard/
├── components/
│   ├── KanbanBoard.tsx            # Top-level board (state, fetches metadata)
│   ├── KanbanColumn.tsx           # One column (header, drop zone, cards)
│   ├── KanbanCard.tsx             # Single card (drag, click)
│   ├── metadata.ts                # Option-set fetching, color helpers
│   ├── i18n.ts                    # DE/EN/FR strings + LCID mapping
│   └── types.ts                   # Type definitions
├── css/
│   └── KanbanBoard.css            # Styling
├── strings/
│   └── KanbanBoard.1033.resx      # Manifest-key resources
├── ControlManifest.Input.xml      # PCF manifest
├── index.ts                       # PCF entry point
├── package.json
└── tsconfig.json
```

## 📋 Configuration Properties

| Property            | Type               | Required | Default | Description |
|---------------------|--------------------|----------|---------|-------------|
| `cards`             | `DataSet`          | yes      | —       | The dataset to render. Configure the columns via the host view. |
| `statusColumn`      | `SingleLine.Text`  | yes      | —       | Logical name of the choice/status column to group cards by (e.g. `statuscode`, `prioritycode`, `wal_stage`). |
| `titleColumn`       | `SingleLine.Text`  | no       | primary name | Logical name of the column to use as card title. Defaults to the entity's primary name attribute. |
| `subtitleColumn`    | `SingleLine.Text`  | no       | —       | Logical name of the column shown below the title. |
| `descriptionColumn` | `SingleLine.Text`  | no       | —       | Logical name of a longer text column shown as card body. |
| `allowDragDrop`     | `TwoOptions`       | no       | `true`  | If true, users can drag cards between columns. |
| `allowCreate`       | `TwoOptions`       | no       | `true`  | If true, each column header has a `+` button opening the quick-create form. |

Any **other columns** added to the configured view (besides the four mapped
above) are surfaced as small key/value chips at the bottom of the card.

## 🌐 Language Detection

The display language is derived from the user's Dataverse profile language via
`context.userSettings.languageId` (an LCID). The lower 10 bits identify the
primary language:

| Primary ID | Language | Mapped to |
|------------|----------|-----------|
| `0x07`     | German (any region) | `de` |
| `0x0C`     | French (any region) | `fr` |
| anything else | — | `en` (fallback) |

**Note**: choice option **labels** are returned by Dataverse already
localized to the user's language by `getEntityMetadata`. Only the static UI
chrome (search placeholder, "Add", "Drop here", etc.) is translated by this
control.

## 🛠️ Development

### Prerequisites
- Node.js 14+
- npm
- Power Platform CLI (`pac`) for solution packing

### Build commands

```bash
cd KanbanBoard

# Install dependencies
npm install

# Production build
npm run build -- --buildMode production

# Local test harness
npm start

# Clean / rebuild
npm run clean
npm run rebuild
```

The Dataverse-importable solution is built from the sibling project — see
[`../KanbanBoard.Solution/README.md`](../KanbanBoard.Solution/README.md) and
run `./build.ps1` there.

## 🔧 Integration

### Add to a view
1. Build and pack the control into a solution
   (`KanbanBoard.Solution/build.ps1`).
2. Import the solution zip into your environment.
3. Open the model-driven app → edit a view of the target table.
4. Switch the view's **layout** to **Custom control** → add **Kanban Board**.
5. Configure the required `Status Column` (and optionally the title /
   subtitle / description columns).
6. Save & publish the app.

### Add to a form's subgrid
The same control works on a subgrid: open the form designer, select the
subgrid, and apply the **Kanban Board** custom control to it.

## 🌐 Browser Support

- Microsoft Edge (latest)
- Google Chrome (latest)
- Mozilla Firefox (latest)
- Safari (latest)

Drag-and-drop uses the HTML5 DnD API. It works on desktop browsers and
modern Android. iOS Safari has limited HTML5 DnD support — taps to open a
card still work, but drag may need a long-press fallback (out of scope for
v1).

## 📊 Performance Notes

- **Memoized cards** — only the cards whose data changed re-render
- **One metadata fetch** per board lifetime, cached in component state
- **Choice-options sort once** — option order respects the metadata order
  (which usually mirrors the maker's intended pipeline)
- **Bundle size**: ~22 KB minified excluding React (the React runtime is
  shared with other PCFs on the same form)

## 🐛 Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| "The 'Status Column' property is required." | The `statusColumn` input wasn't configured — open the view's custom-control settings and enter a logical name. |
| Empty board, no columns                     | The configured `statusColumn` either isn't a choice/status column on the entity, or the user lacks read permissions on the metadata. Check the column's logical name (e.g. `statuscode` not `Status`). |
| Card moves visually but snaps back          | The server rejected the update — check for required fields, business rules, or status-transition rules on the entity. The toast shows the underlying error. |
| Column headers are all grey                 | The choice options have no color set in metadata. Either set colors in the maker (per-option), or accept the default fallback palette. |
| `+` button does nothing                     | The entity has no quick-create form, or the user lacks create permission. Disable `allowCreate` or define a quick-create form. |

## 📝 License

This component is licensed under the MIT License.

## 👥 Contributing

Contributions welcome — please open a Pull Request with a clear description
of the change.

---

*Part of the Power Platform PCF Component Collection.*
