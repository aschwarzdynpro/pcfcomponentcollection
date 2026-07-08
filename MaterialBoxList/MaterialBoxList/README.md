# MaterialBoxList

A mobile-first PCF **virtual dataset control** for field-service monteurs who
work with a list of **material boxes** on storage locations. Each box has
material records as children (1:n). The control shows the boxes, a per-box
material counter, an overlay of the contained materials, and a take-out action
that marks a box as taken.

> **React (Virtual) + Fluent UI v9.** Unlike the other controls in this
> collection (which bundle React 17), this one uses `control-type="virtual"` with
> the platform-provided React 16.14 and Fluent 9 libraries — Microsoft's current
> recommendation for new controls, which keeps the bundle tiny (~18 KB) and is a
> better fit for mobile.

## Status — Milestones 1 & 2 (scaffold + gestures)

What works now:

- ✅ Bound-dataset rendering of the boxes with paging / infinite scroll.
- ✅ Per-box **counter chip** — one batched child fetch per page (no aggregate
  queries → offline-compatible), cached and reused by the overlay.
- ✅ **Materials overlay** (Fluent bottom-sheet Drawer) with the configured child
  columns, an empty state, and a loading state.
- ✅ **Take-out action** with optimistic UI, a 5-second **undo** snackbar, and a
  retryable error path.
- ✅ **Touch gestures (M2)**: **long-press** (≥ 500 ms, < 10 px) opens the
  overlay; **left-swipe** past 40 % of the row width takes the box out, with an
  action surface that flips grey → green at the commit threshold. One unified
  Pointer-Event state machine per row handles the scroll/swipe/long-press
  hand-off, with a left-edge dead zone (OS back-gesture) and spring-back
  animation. Native long-press context menu suppressed.
- ✅ **Fallback buttons** ("Show materials" / "Take out") on web (non-touch), so
  every function is reachable without gestures — fully testable in the browser
  and the PCF harness (which has no `webAPI`; a deterministic mock stands in).
  The control switches automatically on `getFormFactor()` / `getClient()`.
- ✅ Configurable child entity/columns, take-out field/value, and taken-box
  behavior via manifest properties.
- ✅ Trilingual UI (DE / EN / FR).

**Not yet implemented (later milestones):**

- ⏳ M3 — metadata-typed take-out value resolution via `getEntityMetadata`.
- ⏳ M4 — offline hardening, optional `swipeUserFieldName` / `groupByColumn`,
  grouping with sticky headers, search/filter chips, barcode scan.

## Properties

All input properties are `required="false"` with placeholder defaults (repo
convention, CLAUDE.md §3.6 / §7) so the control always loads — including in the
test harness and maker canvas. **You must set them to your real schema.**

| Property | Type | Default (placeholder) | Purpose |
|----------|------|-----------------------|---------|
| `boxDataset` | Dataset | — | The bound material-box view (columns/sort/filter come from the view). |
| `childEntityName` | Text | `sst_material` | Logical name of the child (material) table. |
| `childLookupField` | Text | `sst_materialbox` | Lookup column on the child pointing back to the box (queried as `_<name>_value`). |
| `childDisplayColumns` | Text (CSV) | `sst_name,sst_quantity,sst_unit` | Child columns shown in the overlay; the first is the material name. |
| `childFilter` | Text | *(none)* | Optional OData `$filter`, e.g. `statecode eq 0`. Keep it simple — no aggregates. |
| `swipeFieldName` | Text | `sst_takenon` | Box column set when a box is taken. A **DateTime** field is recommended (audit timestamp). |
| `swipeFieldValue` | Text | `@now` | Value written: `@now` → timestamp, `true`/`false` → Boolean, digits → OptionSet, else text. |
| `takenBehavior` | Enum | `gray` | `hide` (drop from list), `gray` (dimmed, action off) or `allow-undo` (dimmed, revertable). |

> There is **no verified material-box schema** behind these defaults yet — they
> are placeholders. Confirm the logical names and the child entity **set** name
> against the environment before any write (CLAUDE.md §7).

## Data strategy (why it is offline-safe)

- The list comes from the bound dataset (offline reads the cached records).
- The counter fetches child rows in **one batched request per page**
  (`_<lookup>_value eq id1 or … or idN`), grouped client-side. **No
  `$apply`/aggregate, no `$expand`** in the critical path — those are not
  available offline.
- The same fetched rows feed the overlay (stale-while-revalidate) so a
  long-press opens without a second round-trip.
- The take-out uses a single `updateRecord`, which works offline and syncs later.

## Admin configuration (offline)

For offline (Field Service typical) the **box table and the material table**
(plus every column the control reads) must be in the app's **offline profile**.
An empty list *after* sync usually means the tables/columns aren't in the
offline profile — an admin task, not a control bug (CLAUDE.md §7).

## Mobile-only behavior

The control is designed for Power Apps Mobile / Field Service Mobile. It still
renders everywhere: it branches on `context.client.getFormFactor()` /
`getClient()` — phone/mobile gets the touch gestures, everything else (desktop /
tablet / web / maker) keeps the fallback buttons, so the control stays fully
usable and testable in the browser.

> **On-device testing (M2 acceptance):** the Pointer-Event behavior in the
> Power Apps Mobile WebView differs between iOS and Android and must be verified
> on real devices (concept §7, milestone 2). The build here validates
> compilation only.

## Build

```powershell
# build only (regenerates generated/ManifestTypes.d.ts first):
cd MaterialBoxList; npm run build -- --buildMode production

# full package (build + stage + pack unmanaged/managed + versioned archive):
cd MaterialBoxList.Solution; ./build.ps1
```

Test artifact: `MaterialBoxList.Solution/bin/MaterialBoxList_managed_<ver>.zip`.

## Layout

```
index.ts                     # PCF virtual-control lifecycle (init/updateView/…)
components/
  App.tsx                    # root: FluentProvider, take/undo reducer, overlay
  BoxList.tsx                # list + infinite scroll
  BoxRow.tsx                 # row: name + cells + counter + fallback buttons
  CounterChip.tsx            # badge / loading / error
  MaterialOverlay.tsx        # Fluent bottom-sheet Drawer with the materials
  UndoSnackbar.tsx           # 5 s undo countdown
  schema.ts                  # config resolution + value conversion (defaults)
  types.ts                   # shared types
  i18n.ts                    # DE/EN/FR strings, lcidToLang
hooks/
  useChildCounts.ts          # batch fetch + cache of the per-box materials
  useRowGesture.ts           # unified pointer-event state machine (long-press + swipe)
services/
  childRecordService.ts      # WebAPI + Mock implementations (interface)
  updateService.ts           # WebAPI + Mock implementations (interface)
css/MaterialBoxList.css      # mobile-first styles, `.mbl-` namespaced
strings/MaterialBoxList.1033.resx   # manifest property labels
```
