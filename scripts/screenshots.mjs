// Captures the manifest's screenshots (public/screenshots/) from the fixture viewer at /dev/preview.
// Chrome shows them in its install sheet. Start `pnpm dev` first, then run
// `node scripts/screenshots.mjs`. Needs Chrome (set CHROME to its path) and ImageMagick 7.
import { execFileSync, spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const repo = resolve(import.meta.dirname, '..')
const origin = process.env.ORIGIN ?? 'http://localhost:3000'
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const thread = '11111111-1111-4111-8111-111111111111'

// form_factor narrow is for phones, wide for desktop. The sizes must match the manifest's entries.
const shots = [
  { file: 'narrow-page.png', path: '/dev/preview', width: 360, height: 780, scale: 3, mobile: true },
  { file: 'narrow-comment.png', path: `/dev/preview?thread=${thread}`, width: 360, height: 780, scale: 3, mobile: true },
  { file: 'wide-page.png', path: '/dev/preview', width: 1280, height: 800, scale: 1.5, mobile: false },
]

// Headless Chrome won't size a window below about 500px, so the viewport is set over
// the DevTools protocol instead of with --window-size.
const profile = await mkdtemp(join(tmpdir(), 'screenshots-'))
const browser = spawn(chrome, ['--headless', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], {
  stdio: 'ignore',
})

try {
  const cdp = await connect(await pageSocket(profile))
  await cdp.send('Page.enable')
  // The light theme, whatever the OS uses, to match the manifest's colors.
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] })

  const dir = join(repo, 'public/screenshots')
  await mkdir(dir, { recursive: true })
  for (const shot of shots) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: shot.width,
      height: shot.height,
      deviceScaleFactor: shot.scale,
      mobile: shot.mobile,
    })
    const loaded = cdp.once('Page.loadEventFired')
    await cdp.send('Page.navigate', { url: origin + shot.path })
    await loaded
    await cdp.send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => true)', awaitPromise: true })
    // Hydration, the tree, and the comment drawer's open animation.
    await sleep(2000)
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
    const out = join(dir, shot.file)
    execFileSync('magick', ['png:-', '-depth', '8', '-strip', out], { input: Buffer.from(data, 'base64') })
    console.log(`Created public/screenshots/${shot.file}`)
  }
  cdp.close()
} finally {
  // Chrome writes to the profile while it shuts down, so wait for it before deleting it.
  const exited = new Promise((ok) => browser.once('exit', ok))
  browser.kill()
  await exited
  await rm(profile, { recursive: true, force: true })
}

/** The first page target's DevTools socket, once Chrome has written its port. */
async function pageSocket(profile) {
  for (let i = 0; i < 100; i++) {
    const port = await readFile(join(profile, 'DevToolsActivePort'), 'utf8').then((s) => s.split('\n')[0], () => null)
    if (port) {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json())
      const page = targets.find((t) => t.type === 'page')
      if (page) return page.webSocketDebuggerUrl
    }
    await sleep(100)
  }
  throw new Error('Chrome did not start')
}

/** A minimal DevTools protocol client: send() resolves with the result, once() with the next event. */
async function connect(url) {
  const ws = new WebSocket(url)
  await new Promise((ok, fail) => {
    ws.onopen = ok
    ws.onerror = fail
  })
  let id = 0
  const pending = new Map()
  const waiting = new Map()
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data)
    if (msg.id && pending.has(msg.id)) {
      const { ok, fail } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) fail(new Error(msg.error.message))
      else ok(msg.result)
    } else if (msg.method && waiting.has(msg.method)) {
      waiting.get(msg.method)(msg.params)
      waiting.delete(msg.method)
    }
  }
  return {
    send: (method, params = {}) =>
      new Promise((ok, fail) => {
        pending.set(++id, { ok, fail })
        ws.send(JSON.stringify({ id, method, params }))
      }),
    once: (method) => new Promise((ok) => waiting.set(method, ok)),
    close: () => ws.close(),
  }
}
