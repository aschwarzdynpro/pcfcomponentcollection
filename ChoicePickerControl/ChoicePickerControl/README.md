# ChoicePickerControl

A modern React replacement for the standard Dataverse **Choice** dropdown. The
same control binds to a single **Choice** (`OptionSet`) *and* a multi-select
**Choices** (`MultiSelectOptionSet`) column — it detects which one at runtime.
Colored options, a searchable list, removable chips for multi-select, and full
keyboard navigation. Trilingual UI (DE / EN / FR).

## ✨ Features

- **One control, both choice types** — binds to `OptionSet` and
  `MultiSelectOptionSet` via a manifest `type-group`. Auto-detects single vs.
  multiple; the maker can override with `selectionMode`.
- **Dataverse choice colors** — renders the color configured on each choice as a
  dot (single) or a tinted chip (multi). Choices without a configured color get a
  stable fallback palette color so the picker always looks alive.
- **Searchable** — a filter box appears automatically once there are 8+ options
  (configurable: always / auto / never). Filters by label, case-insensitive.
- **Multi-select chips** — each selection is a removable chip; **Select all** /
  **Clear** actions in the dropdown footer. Selection order always follows the
  Dataverse-defined option order, not click order.
- **Full keyboard support** — open with `Enter` / `Space` / `↓`, navigate with
  `↑ ↓ Home End`, commit with `Enter`, dismiss with `Esc`. The active option is
  scrolled into view.
- **Portaled dropdown** — rendered into `document.body` with `position: fixed`,
  so it is never clipped by Quick-Create panels, BPF flyouts, dialogs, or any
  `overflow: hidden` form container. Stays anchored through ancestor scroll and
  resize.
- **Polished motion** — caret rotation, pop-in dropdown, chip entrance. All
  animation respects `prefers-reduced-motion`; high-contrast / forced-colors are
  honored.
- **Trilingual** — placeholder, search, empty state, chip-remove, and footer
  labels localize from `userSettings.languageId` (DE / EN / FR).

## 📋 Configuration Properties

| Property         | Required | Type                                | Description |
|------------------|----------|-------------------------------------|-------------|
| `selectedValue`  | yes      | `OptionSet` / `MultiSelectOptionSet` | The bound Choice column. The type-group accepts both single and multi-select choice columns. |
| `selectionMode`  | no       | Enum `auto` / `single` / `multiple` | `auto` (default) detects the column type. Set explicitly only if auto-detection ever guesses wrong. |
| `placeholder`    | no       | Text                                | Placeholder when nothing is selected. Overrides the localized default (`Select…`). |
| `searchBox`      | no       | Enum `auto` / `always` / `never`    | When to show the filter box. `auto` (default) = show at 8+ options. |
| `colorMode`      | no       | Enum `on` / `off`                   | Show choice colors as dots / chip tints. Default `on`. |
| `clearButton`    | no       | Enum `on` / `off`                   | Show the inline clear (×) button. Default `on`. |

## 🎯 Single vs. multi-select detection

The bound property uses a manifest `type-group`, so one control offers itself
for both single and multi-select choice columns. At runtime the control decides:

1. `selectionMode = single` / `multiple` → forced.
2. `selectionMode = auto` (default):
   - a populated array value is unambiguously **multi**;
   - otherwise the bound parameter's runtime `type` string
     (`MultiSelectOptionSet` / `Multiple`) is the tie-breaker for the empty case;
   - falls back to **single** (the conservative default).

If your column is exotic and `auto` guesses wrong on an empty field, pin it with
`selectionMode`.

## 🛠️ Development

```bash
npm install
npm run build          # production build into out/controls
npm start              # test harness (pcf-start)
```

The control is shipped as a Dataverse solution — see
[`../ChoicePickerControl.Solution/`](../ChoicePickerControl.Solution/) and run
its [`build.ps1`](../ChoicePickerControl.Solution/build.ps1) to produce
importable unmanaged + managed zips.

## 🧩 How it binds

`getOutputs()` returns a single `number` for single-select and a `number[]` for
multi-select. The bound column type drives everything; there is no extra
plumbing. Because the property is a `type-group`, `pcf-scripts` generates the
base `Property` type with `raw: any` / output `any` — the control reads `raw`,
`attributes.Options` (label / value / **color**) and the runtime `type` through a
typed view in `index.ts`.

## 🐛 Troubleshooting

| Symptom | Cause / Fix |
|---------|-------------|
| Control not offered on the column | Only **Choice** and **Choices** columns are supported. `Two Options` (boolean) and `Lookup` are out of scope. |
| Empty multi field shows as single | Auto-detection couldn't read the runtime type. Set `selectionMode = multiple`. |
| Colors look generic | The choices have no color set in Dataverse, so the fallback palette is used. Set colors on the choice in the maker portal, or turn `colorMode = off`. |
| Dropdown appears clipped | Should not happen — it is portaled to `<body>`. If you customized the host CSS, ensure nothing sets `display:none` on `.cpc-dropdown` globally. |

## 🌐 Browser support

Evergreen Chromium (Edge, Chrome), Firefox, and Safari. No CDN / internet
dependency — works in air-gapped tenants. Bundle ≈ 137 KB minified (React 17 +
the control).
