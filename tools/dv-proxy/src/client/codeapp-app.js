// Stand-in for '@microsoft/power-apps/app' in proxy mode. getContext()
// resolves at once from the proxy's /__dvproxy/info instead of waiting for a
// Power Apps host that is not there — so the apps' PowerProvider detects
// "power-platform" and uses their real Dataverse services.

let contextPromise

export function setConfig() {
  // Logger configuration only matters inside the real host.
}

export function getContext() {
  contextPromise ??= fetch('/__dvproxy/info')
    .then((r) => r.json())
    .then((info) => ({
      app: {
        appId: 'dv-proxy-local',
        appSettings: {},
        environmentId: info.environmentId ?? '',
        queryParams: Object.fromEntries(new URLSearchParams(location.search)),
        dataverseOrgUrl: info.orgUrl,
      },
      host: { sessionId: crypto.randomUUID() },
      user: {
        fullName: info.fullName ?? undefined,
        objectId: info.azureObjectId ?? undefined,
        tenantId: info.tenantId ?? undefined,
        userPrincipalName: info.userName ?? undefined,
      },
    }))
  return contextPromise
}
