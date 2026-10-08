// Token acquisition for Dataverse. Three ways in:
//
//   devicecode  — interactive device code flow (default). Tokens are cached
//                 encrypted (DPAPI / Keychain / libsecret) under ~/.dv-proxy,
//                 so the code is only asked for once per account and tenant.
//   secret      — service principal (client id + secret), e.g. an application
//                 user that is already set up in the environment.
//   az          — reuse an existing Azure CLI login (`az account get-access-token`).
//
// One Authenticator serves any number of orgs in the same tenant: the refresh
// token of a device code login is valid for every Dataverse org the account
// can reach, so `WithOrganization` calls to a second org need no new login.

import { execFile } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { ConfidentialClientApplication, PublicClientApplication } from '@azure/msal-node'

/**
 * Public client registered by Microsoft for Dataverse development tools and
 * samples. Can be overridden with --client-id if a tenant blocks it.
 */
export const DEFAULT_PUBLIC_CLIENT_ID = '51f81489-12ee-4a9e-aaae-a2591f45987d'

const CACHE_DIR = join(homedir(), '.dv-proxy')

/** Refresh a token this long before it actually expires. */
const EXPIRY_SKEW_MS = 5 * 60 * 1000

async function persistentCachePlugin(name) {
  try {
    const { PersistenceCreator, PersistenceCachePlugin, DataProtectionScope } = await import(
      '@azure/msal-node-extensions'
    )
    mkdirSync(CACHE_DIR, { recursive: true })
    const persistence = await PersistenceCreator.createPersistence({
      cachePath: join(CACHE_DIR, `${name}.cache`),
      dataProtectionScope: DataProtectionScope.CurrentUser,
      serviceName: 'dv-proxy',
      accountName: name,
      usePlaintextFileOnLinux: false,
    })
    return new PersistenceCachePlugin(persistence)
  } catch (err) {
    console.warn(
      `[auth] encrypted token cache unavailable (${err?.message ?? err}) — tokens live only as long as this process`,
    )
    return undefined
  }
}

function originOf(url) {
  return new URL(url).origin
}

export class Authenticator {
  /**
   * @param {{ auth: 'devicecode'|'secret'|'az', tenant?: string, clientId?: string,
   *           clientSecret?: string, username?: string, onDeviceCode?: (msg: string) => void }} options
   */
  constructor(options) {
    this.options = options
    this.tokens = new Map() // origin -> { token, expiresOn }
    this.pending = new Map() // origin -> Promise<string>
    this.app = null
    this.account = null
  }

  async init() {
    const { auth, tenant, clientId, clientSecret } = this.options
    if (auth === 'az') return
    if (auth === 'secret') {
      if (!tenant || !clientId || !clientSecret) {
        throw new Error('auth "secret" needs --tenant, --client-id and a client secret (DV_PROXY_CLIENT_SECRET)')
      }
      this.app = new ConfidentialClientApplication({
        auth: { clientId, clientSecret, authority: `https://login.microsoftonline.com/${tenant}` },
      })
      return
    }
    const id = clientId ?? DEFAULT_PUBLIC_CLIENT_ID
    const cachePlugin = await persistentCachePlugin(`${tenant ?? 'organizations'}-${id}`)
    this.app = new PublicClientApplication({
      auth: { clientId: id, authority: `https://login.microsoftonline.com/${tenant ?? 'organizations'}` },
      cache: cachePlugin ? { cachePlugin } : undefined,
    })
  }

  /** Bearer token for one Dataverse org (any URL on it). */
  async getToken(orgUrl) {
    const origin = originOf(orgUrl)
    const cached = this.tokens.get(origin)
    if (cached && cached.expiresOn - EXPIRY_SKEW_MS > Date.now()) return cached.token
    // Concurrent requests for the same org share one acquisition.
    let pending = this.pending.get(origin)
    if (!pending) {
      pending = this.acquire(origin).finally(() => this.pending.delete(origin))
      this.pending.set(origin, pending)
    }
    return pending
  }

  async acquire(resource) {
    const { auth } = this.options
    let result
    if (auth === 'az') {
      result = await azToken(resource, this.options.tenant)
    } else if (auth === 'secret') {
      const r = await this.app.acquireTokenByClientCredential({ scopes: [`${resource}/.default`] })
      result = { token: r.accessToken, expiresOn: r.expiresOn?.getTime() ?? Date.now() + 30 * 60_000 }
    } else {
      result = await this.acquireDelegated(resource)
    }
    this.tokens.set(resource, result)
    return result.token
  }

  async acquireDelegated(resource) {
    const scopes = [`${resource}/.default`]
    const account = await this.pickAccount()
    if (account) {
      try {
        const r = await this.app.acquireTokenSilent({ account, scopes })
        this.account = r.account ?? account
        return { token: r.accessToken, expiresOn: r.expiresOn?.getTime() ?? Date.now() + 30 * 60_000 }
      } catch (err) {
        console.warn(`[auth] silent token for ${resource} failed (${err?.errorCode ?? err?.message}) — device code needed`)
      }
    }
    const r = await this.app.acquireTokenByDeviceCode({
      scopes,
      deviceCodeCallback: (info) => (this.options.onDeviceCode ?? console.log)(info.message),
    })
    this.account = r.account
    return { token: r.accessToken, expiresOn: r.expiresOn?.getTime() ?? Date.now() + 30 * 60_000 }
  }

  async pickAccount() {
    if (this.account) return this.account
    const accounts = await this.app.getTokenCache().getAllAccounts()
    if (accounts.length === 0) return null
    const wanted = this.options.username?.toLowerCase()
    if (wanted) return accounts.find((a) => a.username?.toLowerCase() === wanted) ?? null
    if (accounts.length > 1) {
      console.warn(
        `[auth] ${accounts.length} cached accounts (${accounts.map((a) => a.username).join(', ')}) — using the first; pass --user to choose`,
      )
    }
    return accounts[0]
  }

  /** Who is signed in, for the startup banner. Null for app-only auth. */
  get username() {
    if (this.options.auth === 'secret') return `app ${this.options.clientId}`
    if (this.options.auth === 'az') return 'Azure CLI account'
    return this.account?.username ?? null
  }

  /** Remove cached accounts (dv-proxy logout). */
  async logout() {
    if (!this.app || this.options.auth !== 'devicecode') return 0
    const cache = this.app.getTokenCache()
    const accounts = await cache.getAllAccounts()
    for (const account of accounts) await cache.removeAccount(account)
    return accounts.length
  }
}

function azToken(resource, tenant) {
  const args = ['account', 'get-access-token', '--resource', resource, '--output', 'json']
  if (tenant) args.push('--tenant', tenant)
  return new Promise((resolve, reject) => {
    execFile('az', args, { shell: process.platform === 'win32', windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`az account get-access-token failed: ${stderr?.trim() || err.message}`))
        return
      }
      try {
        const parsed = JSON.parse(stdout)
        const expiresOn = parsed.expires_on ? parsed.expires_on * 1000 : Date.parse(parsed.expiresOn)
        resolve({ token: parsed.accessToken, expiresOn })
      } catch (parseErr) {
        reject(parseErr)
      }
    })
  })
}
