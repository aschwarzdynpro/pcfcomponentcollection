// PCF harness server: serves the built control, the harness page and the
// platform libraries (React/Fluent from the project's own pcf-start), and
// mounts the Dataverse proxy so the control's webAPI and same-origin fetches
// hit the real environment.

import { spawn } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync, watch } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const CLIENT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'client')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.resx': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

/** Locate project root, source folder (with ControlManifest.Input.xml) and output folder. */
function locateControl(dir) {
  if (!existsSync(dir)) throw new Error(`folder not found: ${dir}`)
  // pac-generated projects carry pcfconfig.json; older or hand-made ones (e.g.
  // the PCF component collection) keep package.json next to the manifest.
  const isProject = (d) =>
    existsSync(join(d, 'package.json')) &&
    (existsSync(join(d, 'pcfconfig.json')) || existsSync(join(d, 'ControlManifest.Input.xml')))
  let root = dir
  if (!isProject(root)) {
    // Feature-folder layout (Control/Control) or pointing at the source folder.
    const child = readdirSync(dir).map((n) => join(dir, n)).find((p) => statSync(p).isDirectory() && isProject(p))
    if (child) root = child
    else if (isProject(dirname(dir))) root = dirname(dir)
    else throw new Error(`no PCF project (package.json + pcfconfig.json or ControlManifest.Input.xml) in or around ${dir}`)
  }

  const sources = readdirSync(root)
    .filter((n) => !['node_modules', 'out', 'generated', 'obj', 'bin'].includes(n))
    .map((n) => join(root, n))
    .filter((p) => statSync(p).isDirectory() && existsSync(join(p, 'ControlManifest.Input.xml')))
  if (existsSync(join(root, 'ControlManifest.Input.xml'))) sources.unshift(root)
  if (sources.length === 0) throw new Error(`no ControlManifest.Input.xml under ${root}`)
  if (sources.length > 1) {
    console.warn(`[pcf] several controls found — using ${relative(root, sources[0]) || '.'}`)
  }
  const sourceDir = sources[0]
  const controlName = sourceDir === root ? null : relative(root, sourceDir)

  let outBase = join(root, 'out', 'controls')
  try {
    const cfg = JSON.parse(readFileSync(join(root, 'pcfconfig.json'), 'utf8'))
    if (cfg.outDir) outBase = resolve(root, cfg.outDir)
  } catch {
    // default out dir
  }
  const outDir =
    controlName && existsSync(join(outBase, controlName, 'ControlManifest.xml'))
      ? join(outBase, controlName)
      : existsSync(join(outBase, 'ControlManifest.xml'))
        ? outBase
        : controlName
          ? join(outBase, controlName)
          : outBase
  return { root, sourceDir, outDir }
}

function runBuild(root, production = false) {
  return new Promise((resolveBuild) => {
    const args = ['run', 'build']
    if (production) args.push('--', '--buildMode', 'production')
    const child = spawn('npm', args, { cwd: root, shell: process.platform === 'win32', windowsHide: true })
    let output = ''
    child.stdout.on('data', (d) => (output += d))
    child.stderr.on('data', (d) => (output += d))
    child.on('close', (code) => resolveBuild({ ok: code === 0, output }))
  })
}

function serveFile(res, file) {
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('not found')
    return
  }
  res.writeHead(200, {
    'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  })
  res.end(readFileSync(file))
}

/** Join a URL path under a base folder without letting it escape. */
function safeJoin(base, urlPath) {
  const target = normalize(join(base, decodeURIComponent(urlPath)))
  return target === base || target.startsWith(base + sep) ? target : null
}

/**
 * @param {{ dir: string, port: number, proxy: ReturnType<typeof import('./proxy.mjs').createDataverseProxy>,
 *           env: { name: string, orgUrl: string, allowWrites: boolean }, record?: string, watch: boolean }} options
 */
export async function startPcfHarness({ dir, port, proxy, env, record, watch: watchMode }) {
  const { root, sourceDir, outDir } = locateControl(dir)

  if (!existsSync(join(outDir, 'ControlManifest.xml'))) {
    console.log(`[pcf] no build output in ${relative(process.cwd(), outDir)} — building …`)
    const result = await runBuild(root)
    if (!result.ok) {
      console.error(result.output)
      throw new Error('build failed')
    }
  }
  const platformDir = join(root, 'node_modules', 'pcf-start', 'lib')

  let building = false
  let again = false
  let lastBuildError = null
  const rebuild = async () => {
    if (building) {
      again = true
      return
    }
    building = true
    proxy.emit({ type: 'build', state: 'start' })
    console.log('[pcf] change detected — building …')
    const result = await runBuild(root)
    building = false
    if (result.ok) {
      lastBuildError = null
      console.log('[pcf] build ok — reloading harness')
      proxy.emit({ type: 'reload' })
    } else {
      lastBuildError = result.output.split('\n').filter((l) => /error|failed/i.test(l)).slice(-15).join('\n')
      console.error(`[pcf] build failed\n${lastBuildError}`)
      proxy.emit({ type: 'build', state: 'error', output: lastBuildError })
    }
    if (again) {
      again = false
      void rebuild()
    }
  }

  if (watchMode) {
    let timer = null
    watch(sourceDir, { recursive: true }, (_event, file) => {
      if (!file) return
      const f = String(file).replace(/\\/g, '/')
      if (/(^|\/)(generated|node_modules|out|obj|bin)\//.test(f) || f.endsWith('ManifestTypes.d.ts')) return
      clearTimeout(timer)
      timer = setTimeout(() => void rebuild(), 300)
    })
  }

  const [recordTable, recordId] = record ? record.split(':') : []
  const config = {
    envName: env.name,
    orgUrl: env.orgUrl,
    allowWrites: env.allowWrites,
    watch: watchMode,
    record: recordTable && recordId ? { table: recordTable, id: recordId } : null,
    platformLibs: existsSync(platformDir) ? readdirSync(platformDir).filter((f) => f.endsWith('.js')) : [],
  }

  const server = createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0]
    if (path === '/' || path === '/index.html') return serveFile(res, join(CLIENT_DIR, 'pcf-harness.html'))
    if (path === '/__harness/config.json') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
      res.end(JSON.stringify({ ...config, buildError: lastBuildError }))
      return
    }
    if (path.startsWith('/__harness/')) {
      const file = safeJoin(CLIENT_DIR, path.slice('/__harness/'.length))
      return file ? serveFile(res, file) : res.writeHead(400).end()
    }
    if (path.startsWith('/__control/')) {
      const file = safeJoin(outDir, path.slice('/__control/'.length))
      return file ? serveFile(res, file) : res.writeHead(400).end()
    }
    if (path.startsWith('/__platform/')) {
      const file = safeJoin(platformDir, path.slice('/__platform/'.length))
      return file ? serveFile(res, file) : res.writeHead(400).end()
    }
    void proxy.middleware(req, res)
  })

  server.listen(port, '127.0.0.1', () => {
    const query = config.record ? `?table=${config.record.table}&id=${config.record.id}` : ''
    console.log(`\n  PCF harness:  http://localhost:${port}/${query}`)
    console.log(`  Control:      ${relative(process.cwd(), outDir) || outDir}`)
    if (watchMode) console.log(`  Watching:     ${relative(process.cwd(), sourceDir) || sourceDir}`)
    console.log('')
  })
}
