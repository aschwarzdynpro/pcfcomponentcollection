# dv-proxy

Test PCF controls (and Code Apps) locally against a **real Dataverse
environment**, without uploading them. You name the environment and sign in
once. A local proxy adds a bearer token to every Web API call, and the control
runs unchanged in the browser.

```
Browser (localhost)               dv-proxy (Node)                  Dataverse
 ├─ PCF harness / Code App  ──►  /api/data/…  + bearer token  ──►  https://org.crm4.dynamics.com
 └─ fetch('/api/data/…')         /__dv/<host>/api/data/…     ──►  another org in the same tenant
```

| | without dv-proxy | with dv-proxy |
| --- | --- | --- |
| **PCF** | `npm start` (pcf-start): no `context.webAPI`, no real data, no record context | real `webAPI`, metadata, user and language, record context, datasets from a view or FetchXML; `--watch` rebuilds and reloads |
| **Code App** | `npm run dev` without a host ⇒ mock data; real data only through "Local Play" with the app registered in the target environment | Vite dev server **with real data**, no player, no registered app |

## Install

```powershell
cd tools/dv-proxy
npm install
```

Requires Node ≥ 22. The only dependencies are MSAL and MSAL extensions, used
for the encrypted token cache: DPAPI on Windows, Keychain on macOS, libsecret
on Linux.

## Environments and sign-in

Pass either an org URL, `--env https://org.crm4.dynamics.com`, or a
**profile name**. Profiles are read from `dv-proxy.profiles.json`. The search
order is the current folder, then `tools/dv-proxy/`, then
`~/.dv-proxy/profiles.json`. The file is git-ignored because it names customer
environments; start from `dv-proxy.profiles.example.json`.

```json
{ "profiles": {
    "customer-uat": { "url": "https://…crm4.dynamics.com", "auth": "devicecode", "user": "name@customer.com" },
    "customer-dev-sp": { "url": "https://…", "auth": "secret", "tenant": "<tenant-id>",
                         "clientId": "<app-id>", "clientSecretEnv": "CUSTOMER_DEV_SECRET" } } }
```

| `auth` | How | When |
| --- | --- | --- |
| `devicecode` (default) | Device code flow. The token is cached encrypted under `~/.dv-proxy`, so the code is asked for once per account and tenant and later starts sign in silently. | normal case |
| `secret` | Service principal (client credentials). The secret is never stored in the file; it comes from the environment variable named in `clientSecretEnv` (default `DV_PROXY_CLIENT_SECRET`). | tenants that block device code (e.g. Waldmann), or an existing application user |
| `az` | `az account get-access-token --resource <org>` | an Azure CLI login already exists in the tenant |

Device code uses Microsoft's public client for Dataverse developer tools
(`51f81489-…`). If a tenant blocks it with Conditional Access, pass
`--client-id` with your own app registration: a public client with the
delegated permission *Dynamics CRM user_impersonation*.

```powershell
node tools/dv-proxy/src/cli.mjs login  --env customer-uat   # once — shows the device code
node tools/dv-proxy/src/cli.mjs logout --env customer-uat   # clear the cache
node tools/dv-proxy/src/cli.mjs profiles                     # list profiles
```

**Read-only by default.** POST, PUT, PATCH and DELETE are not forwarded. The
caller gets 403 `DvProxyReadOnly`, and the harness marks the call. Allow writes
with `--allow-writes` or `"allowWrites": true` in a profile, and only in
environments where writing is explicitly fine.

## PCF controls

```powershell
# from the repo root — a feature folder or the npm project folder both work
node tools/dv-proxy/src/cli.mjs pcf WorkTimeSplitGrid --env customer-uat --watch
node tools/dv-proxy/src/cli.mjs pcf FlagPhoneControl  --env customer-uat --record contact:<guid>
# → http://localhost:8181/?table=contact&id=<guid>
```

- The **built** output is loaded from `out/controls`. If it is missing,
  dv-proxy builds once. With `--watch` it rebuilds on every source change and
  reloads the harness; build errors show at the top of the harness.
- **Record context:** enter a table and an ID on the left.
  `context.mode.contextInfo` and `context.page` (`entityId`,
  `entityTypeName`, `getClientUrl()`) point at that record. Without an ID it
  behaves like a new record.
- **Properties:** link a bound property to a column of the record. It then
  gets `raw`, `formatted` and `attributes` (options, targets) as on a form.
  Input properties (text, number, two options, enum) are set directly.
  `notifyOutputChanged` → `getOutputs()` is logged and fed back through
  `updateView`, the same way a form does it. With `--allow-writes` the value
  can be saved to the record.
- **Datasets:** pick a table and a view; the columns come from the view
  layout. The FetchXML is editable, e.g. to filter on the form record (a
  subgrid). Supported: paging (`page`/`count`, `totalResultCount`), sorting,
  simple filters (`filtering.setFilter`), selection, `refresh`,
  `openDatasetItem`, `addColumn`.
- **Host:** language (resx + `userSettings.languageId`), form factor,
  `isControlDisabled`, width. `trackContainerResize` provides
  `allocatedWidth`/`allocatedHeight`.
- **Log:** at the bottom, every Web API call (status, duration, blocked
  writes) and the control events (init, outputs, navigation, errors).
- **Virtual controls** (React/Fluent as platform libraries) run with the
  libraries from the project's own `pcf-start` (React 16.14/18.3, Fluent 8/9).

Context coverage: `webAPI` (CRUD, OData and `?fetchXml=`), `utils`
(`getEntityMetadata`, `lookupObjects` as a search dialog, `hasEntityPrivilege`
= true), `navigation` (dialogs inside the harness; `openForm` opens D365 in a
new tab), `formatting`, `resources`, `userSettings` (from the D365 user
settings), `client`, `mode`, `page`, `device.pickFile`, `factory`.

Same-origin `fetch('/api/data/v9.2/…')` from a control works too, because
`getClientUrl()` points at the proxy.

**Not covered:** offline mode (`client.isOffline()` is always false; the
mobile offline cache cannot be simulated), form events, business rules,
`Xrm.*`. Whether the control really fits the form still has to be checked
after an upload.

## Code Apps

```powershell
node tools/dv-proxy/src/cli.mjs codeapp C:\path\to\CodeApps\apps\audit-explorer --env customer-uat
# → http://localhost:3000/  (real data)
```

dv-proxy starts the app's **own Vite dev server with its own `vite.config`**
and adds a plugin. The app itself is not modified:

1. `/api/data` and `/__dv/<host>` are routed to the proxy.
2. `@microsoft/power-apps/app` is replaced: `getContext()` answers at once
   (user, `environmentId`, `dataverseOrgUrl`), so the app's `PowerProvider`
   detects "power-platform" instead of mock.
3. A runtime installs its own data executor through the SDK hook
   `setDataOperationExecutor` (`@microsoft/power-apps/internal/data`). The
   generated services keep running unchanged, just through the proxy instead
   of the Power Apps host.

| Data source | Status |
| --- | --- |
| Dataverse tables (CRUD, paging/`skipToken`, file and image columns) | ✔ |
| `getMetadata()` / `getEntityMetadata` | ✔ |
| Custom APIs, functions, actions (`add-dataverse-api`) | ✔ |
| **Microsoft Dataverse connector** (`commondataserviceforapps`) incl. `…WithOrganization` (other orgs via `/__dv/<host>`), `PerformUnboundAction`, `GetOrganizations` (Global Discovery) | ✔ |
| other connectors (Office 365, Azure DevOps, Flow management, custom flows) | ✘ — fails with a clear "not supported" error |

The app needs `npm install` and `.power/schemas/appschemas/dataSourcesInfo.ts`
(for custom APIs and the connector). `power.config.json` is **not** needed.
The executor depends on the internal SDK hook `setDataOperationExecutor`
(tested with `@microsoft/power-apps` 1.1.9), so re-check it after SDK
updates.

## Plain proxy

```powershell
node tools/dv-proxy/src/cli.mjs serve --env customer-uat --port 8787
# http://localhost:8787/api/data/v9.2/WhoAmI — for curl/Postman or the stock pcf-start harness
```

CORS is open for `localhost` origins.

## Limits

- One tenant per run: a token covers every org the account can reach in that
  tenant. Use a second profile for another tenant.
- Times are formatted in the browser's time zone. `getTimeZoneOffsetMinutes`
  uses the standard offset from the D365 user settings, without daylight
  saving time.
- Connectors other than Dataverse are not emulated; supporting them would
  need an API Hub token per connection.
