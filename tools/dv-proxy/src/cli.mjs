#!/usr/bin/env node
// dv-proxy — test PCF controls and Code Apps against a real Dataverse
// environment without uploading them. See ../README.md.

import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { Authenticator } from './auth.mjs'
import { createDataverseProxy } from './proxy.mjs'

const TOOL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const USAGE = `dv-proxy — Dataverse dev proxy

Usage
  dv-proxy pcf [dir]      Run a built PCF control in a local harness with a real context
  dv-proxy codeapp [dir]  Start a Code App's Vite dev server wired to Dataverse
  dv-proxy serve          Plain proxy: /api/data → Dataverse with a bearer token
  dv-proxy login          Sign in once (device code) and cache the token
  dv-proxy logout         Remove cached accounts for --env
  dv-proxy profiles       List configured profiles

Environment and credentials
  --env <url|profile>     Org URL (https://org.crm4.dynamics.com) or profile name
  --auth <kind>           devicecode (default) | secret | az
  --tenant <id|domain>    Tenant; required for "secret", optional otherwise
  --client-id <id>        App id (secret) or public client override (devicecode)
  --user <upn>            Pick a cached account when several exist
  Client secrets come from DV_PROXY_CLIENT_SECRET or the profile's "clientSecretEnv".

Options
  --port <n>              Port (pcf 8181, codeapp 3000, serve 8787)
  --allow-writes          Forward POST/PATCH/DELETE (default: read-only, writes are refused)
  --record <table:id>     pcf: record the form context points at
  --watch                 pcf: rebuild on source changes and reload the harness
  --config <file>         Profiles file (default: ./dv-proxy.profiles.json, then ~/.dv-proxy/profiles.json)
  --quiet                 Do not log every proxied call
`

function fail(message) {
  console.error(`dv-proxy: ${message}`)
  process.exit(1)
}

function loadProfiles(explicit) {
  const candidates = explicit
    ? [resolve(explicit)]
    : [
        resolve('dv-proxy.profiles.json'),
        join(TOOL_DIR, 'dv-proxy.profiles.json'),
        join(homedir(), '.dv-proxy', 'profiles.json'),
      ]
  for (const file of candidates) {
    if (existsSync(file)) {
      try {
        const parsed = JSON.parse(readFileSync(file, 'utf8'))
        return { file, profiles: parsed.profiles ?? {} }
      } catch (err) {
        fail(`cannot read ${file}: ${err.message}`)
      }
    }
  }
  if (explicit) fail(`profiles file not found: ${explicit}`)
  return { file: null, profiles: {} }
}

function resolveEnvironment(values) {
  const { profiles } = loadProfiles(values.config)
  const env = values.env ?? process.env.DV_PROXY_ENV
  if (!env) fail('missing --env (org URL or profile name)')
  let profile = {}
  let url
  if (/^https?:\/\//i.test(env)) {
    url = env
  } else if (profiles[env]) {
    profile = profiles[env]
    url = profile.url
    if (!url) fail(`profile "${env}" has no "url"`)
  } else {
    const known = Object.keys(profiles)
    fail(`unknown profile "${env}"${known.length ? ` (known: ${known.join(', ')})` : ''} — or pass an org URL`)
  }
  const auth = values.auth ?? profile.auth ?? 'devicecode'
  if (!['devicecode', 'secret', 'az'].includes(auth)) fail(`unknown --auth "${auth}"`)
  const secretEnv = profile.clientSecretEnv ?? 'DV_PROXY_CLIENT_SECRET'
  return {
    name: /^https?:/i.test(env) ? new URL(url).host : env,
    orgUrl: new URL(url).origin,
    auth,
    tenant: values.tenant ?? profile.tenant,
    clientId: values['client-id'] ?? profile.clientId,
    clientSecret: process.env[secretEnv],
    username: values.user ?? profile.user,
    allowWrites: Boolean(values['allow-writes'] ?? profile.allowWrites ?? false),
  }
}

async function connect(values) {
  const env = resolveEnvironment(values)
  const auth = new Authenticator({
    ...env,
    onDeviceCode: (message) => {
      console.log('\n────────────────────────────────────────────────────────────')
      console.log(`  Sign-in for ${env.orgUrl}`)
      console.log(`  ${message}`)
      console.log('────────────────────────────────────────────────────────────\n')
    },
  })
  await auth.init()
  const proxy = createDataverseProxy({
    orgUrl: env.orgUrl,
    auth,
    allowWrites: env.allowWrites,
    verbose: !values.quiet,
  })
  // Sign in up front so a broken login fails fast, not on the first request.
  const info = await proxy.info()
  console.log(`dv-proxy: ${info.organizationName ?? env.orgUrl} (${env.orgUrl})`)
  console.log(`          signed in as ${info.fullName ?? '?'} <${info.userName ?? auth.username ?? '?'}>, UI language ${info.languageId}`)
  console.log(`          ${env.allowWrites ? 'WRITES ALLOWED — POST/PATCH/DELETE reach Dataverse' : 'read-only — writes are refused (--allow-writes to change)'}`)
  return { env, auth, proxy }
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      env: { type: 'string' },
      auth: { type: 'string' },
      tenant: { type: 'string' },
      'client-id': { type: 'string' },
      user: { type: 'string' },
      port: { type: 'string' },
      'allow-writes': { type: 'boolean' },
      record: { type: 'string' },
      watch: { type: 'boolean' },
      config: { type: 'string' },
      quiet: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  })
  const [command, target] = positionals
  if (!command || values.help) {
    console.log(USAGE)
    return
  }

  switch (command) {
    case 'profiles': {
      const { file, profiles } = loadProfiles(values.config)
      if (!file) {
        console.log('No profiles file. Copy dv-proxy.profiles.example.json to dv-proxy.profiles.json.')
        return
      }
      console.log(`Profiles from ${file}:`)
      for (const [name, p] of Object.entries(profiles)) {
        console.log(`  ${name.padEnd(18)} ${p.url}  (${p.auth ?? 'devicecode'}${p.tenant ? `, ${p.tenant}` : ''})`)
      }
      return
    }
    case 'login': {
      await connect(values)
      return
    }
    case 'logout': {
      const env = resolveEnvironment(values)
      const auth = new Authenticator(env)
      await auth.init()
      console.log(`dv-proxy: removed ${await auth.logout()} cached account(s)`)
      return
    }
    case 'serve': {
      const { proxy } = await connect(values)
      const port = Number(values.port ?? 8787)
      createServer((req, res) => proxy.middleware(req, res)).listen(port, '127.0.0.1', () => {
        console.log(`\n  Proxy:  http://localhost:${port}/api/data/v9.2/   (Bearer token added)\n`)
      })
      return
    }
    case 'pcf': {
      const { startPcfHarness } = await import('./pcf.mjs')
      const { env, proxy } = await connect(values)
      await startPcfHarness({
        dir: resolve(target ?? '.'),
        port: Number(values.port ?? 8181),
        proxy,
        env,
        record: values.record,
        watch: Boolean(values.watch),
      })
      return
    }
    case 'codeapp': {
      const { startCodeApp } = await import('./codeapp.mjs')
      const { env, proxy } = await connect(values)
      await startCodeApp({ dir: resolve(target ?? '.'), port: values.port ? Number(values.port) : undefined, proxy, env })
      return
    }
    default:
      fail(`unknown command "${command}"\n\n${USAGE}`)
  }
}

main().catch((err) => {
  console.error(`dv-proxy: ${err?.message ?? err}`)
  process.exit(1)
})
