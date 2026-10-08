# Record Audit History

PCF **field control** for the main form: shows the Dataverse **audit history
of the record the form is open on**. It is the record mode of the Audit
Explorer Code App, embedded where people actually look at a record.

Why a PCF and not a Generative Page: a Gen Page cannot read metadata (column
display names, choice labels, `IsAuditEnabled`) and cannot resolve lookups
into arbitrary tables, so it would be worse than the built-in "Audit history"
tab. A PCF has `context.webAPI`, runs on the same origin as the app (so the
metadata endpoints and `RetrieveAuditDetails` are reachable), and ships as a
normal solution component that can be imported managed.

## Features

- **Event list** grouped by day: time, action (localized by the server —
  Create, Update, Assign, Activate …), user, and a preview of the changed
  columns. Rows expand in place, several at once, so changes can be compared
  side by side.
- **Column diff** per entry with display names; choice, status and yes/no
  labels; lookup names (any target table); dates and numbers formatted in the
  user's language. Technical columns (`modifiedon`, `versionnumber`, …) are
  collapsed behind a toggle.
- **Column filter:** selecting a column turns the list into a value history
  (When | From | To | Who).
- **Empty results explain themselves:** auditing off for the table, record
  older than the retention window, or auditing on and genuinely no change.
- **Banners** for auditing switched off (organization or table), retention,
  and the row cap, plus a collapsible list of **columns that are not audited**.
- UI in German or English, following the user's language (LCID 1031 / 2055 /
  3079 ⇒ German).

## Properties

| Property | Usage | Type | Description |
|----------|-------|------|-------------|
| `boundColumn` | bound | any text / number / date / choice / yes-no column | Required by the platform for field controls. The value is **never read or written**; bind any column of the form and hide the label. |
| `maxHeight` | input | Whole.None, default `0` | Maximum height in px. `0` grows with the content; a larger value adds a scroll bar. |

## Data access

| What | How |
|------|-----|
| Audit rows | `context.webAPI.retrieveMultipleRecords('audit', … _objectid_value eq <id> …)` incl. `changedata` (inline diff); paging up to 5,000 rows |
| Fallback diff | `GET audits(<id>)/Microsoft.Dynamics.CRM.RetrieveAuditDetails()` — only when `changedata` is empty or not selectable |
| Metadata | `GET EntityDefinitions(LogicalName='…')` + casts to Picklist / State / Status / Boolean / MultiSelect / Lookup attributes |
| Org settings | `organization.isauditenabled`, `auditretentionperiodv2` |
| Lookup names | per target table `PrimaryIdAttribute` / `PrimaryNameAttribute`, then `retrieveMultipleRecords` with an `or` filter (batches of 40) |

Metadata and `RetrieveAuditDetails` are plain same-origin `fetch` calls to
`/api/data/v9.2` (session cookie), because `context.webAPI` offers neither.

**Privileges:** the security role needs *View Audit History* and *View Audit
Summary*; otherwise the control says so explicitly.

## Build

```powershell
cd audit-history\RecordAuditHistory; npm install; npm run build -- --buildMode production
# full package (build + stage + pack + versioned archive):
cd audit-history\RecordAuditHistory.Solution; ./build.ps1
```

## Test without uploading

```powershell
node tools/dv-proxy/src/cli.mjs pcf audit-history --env <url|profile> --record account:<guid> --watch
```

See [`tools/dv-proxy`](../../tools/dv-proxy/).

## Add to a form

1. Import `RecordAuditHistory.Solution/bin/RecordAuditHistory_managed.zip`.
2. In the form designer, add a tab or section (e.g. "Change history") and add
   any column to it, e.g. the primary name. The column may already be on the
   form elsewhere; this copy only hosts the control.
3. **Components → + Component → Record Audit History**, bind **Bound column**
   to that column, enable Web / Phone / Tablet, and **hide the label**.
4. Optionally set **Maximum height (px)**.

## Limits

- Relationship audits (associate/disassociate) and access events have no
  column diff.
- Times are shown in the browser's time zone, not the D365 user setting.
- The column filter only knows columns with an inline diff; it is hidden when
  `changedata` is not available.
- No `webAPI` offline (mobile): the control then shows a load error.
