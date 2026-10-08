// Start a Code App's own Vite dev server (with its own vite.config) plus the
// dv-proxy plugin. The app is not modified: the plugin
//   - mounts the Dataverse proxy on /api/data and /__dv*,
//   - replaces '@microsoft/power-apps/app' with a getContext() that resolves
//     from the proxy instead of waiting for a host,
//   - injects a runtime that installs a data executor via the SDK's
//     setDataOperationExecutor hook.

import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const CLIENT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'client')
const RUNTIME_ID = 'virtual:dv-proxy/runtime'
const APP_ID = 'virtual:dv-proxy/app'

/** dataSourcesInfo.ts is `export const dataSourcesInfo = { …JSON… };` */
function readDataSourcesInfo(root) {
  const file = join(root, '.power', 'schemas', 'appschemas', 'dataSourcesInfo.ts')
  if (!existsSync(file)) {
    console.warn('[codeapp] no .power/schemas/appschemas/dataSourcesInfo.ts — custom APIs and connectors are unavailable')
    return {}
  }
  const text = readFileSync(file, 'utf8')
  try {
    return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
  } catch (err) {
    console.warn(`[codeapp] cannot parse dataSourcesInfo.ts (${err.message})`)
    return {}
  }
}

export function dvProxyVitePlugin({ proxy, root }) {
  const sources = readDataSourcesInfo(root)
  const connectors = Object.entries(sources)
    .filter(([, v]) => v.dataSourceType && v.dataSourceType !== 'Dataverse')
    .map(([k]) => k)
  if (connectors.length) {
    const unsupported = connectors.filter((c) => c !== 'commondataserviceforapps')
    console.log(`[codeapp] connectors: ${connectors.join(', ')}`)
    if (unsupported.length) console.log(`[codeapp] not emulated (calls fail with a clear error): ${unsupported.join(', ')}`)
  }

  return {
    name: 'dv-proxy',
    enforce: 'pre',
    config() {
      return {
        optimizeDeps: {
          include: ['@microsoft/power-apps/data', '@microsoft/power-apps/internal/data'],
          exclude: ['@microsoft/power-apps/app'],
        },
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? ''
        if (url.startsWith('/api/data/') || url.startsWith('/__dv')) {
          void proxy.middleware(req, res, next)
          return
        }
        next()
      })
    },
    resolveId(id, importer) {
      if (id === RUNTIME_ID) return `\0${RUNTIME_ID}`
      if (id === '@microsoft/power-apps/app' && importer !== `\0${APP_ID}`) return `\0${APP_ID}`
      return null
    },
    load(id) {
      if (id === `\0${RUNTIME_ID}`) {
        return readFileSync(join(CLIENT_DIR, 'codeapp-runtime.js'), 'utf8').replace(
          '/*DV_PROXY_SOURCES*/ {}',
          () => JSON.stringify(sources),
        )
      }
      if (id === `\0${APP_ID}`) return readFileSync(join(CLIENT_DIR, 'codeapp-app.js'), 'utf8')
      return null
    },
    transformIndexHtml() {
      return [{ tag: 'script', attrs: { type: 'module', src: `/@id/__x00__${RUNTIME_ID}` }, injectTo: 'head-prepend' }]
    },
  }
}

async function importVite(root) {
  const require = createRequire(join(root, 'package.json'))
  let pkgPath
  try {
    pkgPath = require.resolve('vite/package.json')
  } catch {
    throw new Error(`vite not installed in ${root} — run npm install there first`)
  }
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  const entry = pkg.exports?.['.']
  const esm = typeof entry === 'string' ? entry : (entry?.import?.default ?? entry?.import ?? entry?.default)
  const file = join(dirname(pkgPath), typeof esm === 'string' ? esm : 'dist/node/index.js')
  return import(pathToFileURL(file).href)
}

export async function startCodeApp({ dir, port, proxy }) {
  if (!existsSync(join(dir, 'package.json'))) throw new Error(`no package.json in ${dir}`)
  if (!existsSync(join(dir, 'node_modules', '@microsoft', 'power-apps'))) {
    throw new Error(`@microsoft/power-apps not installed in ${dir} — run npm install there first`)
  }
  const vite = await importVite(dir)
  const configFile = ['vite.config.ts', 'vite.config.mts', 'vite.config.js', 'vite.config.mjs']
    .map((f) => join(dir, f))
    .find((f) => existsSync(f))
  const server = await vite.createServer({
    root: dir,
    configFile: configFile ?? false,
    plugins: [dvProxyVitePlugin({ proxy, root: dir })],
    server: { ...(port ? { port } : {}), host: 'localhost' },
  })
  await server.listen()
  console.log('')
  server.printUrls()
  console.log('  Code App runs against Dataverse through dv-proxy (no Power Apps host).\n')
}
