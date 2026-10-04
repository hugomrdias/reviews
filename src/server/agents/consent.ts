import type { ConsentDescription } from '@cloudflare/workers-oauth-provider'
import { READ, WRITE } from './grant'

// The page where someone lets an agent act for them. Plain server-rendered
// HTML, because the OAuth library's cookies and headers must go on this exact
// response. Everything from the client (name, domain, scopes) is escaped:
// the client chose it.

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)

const SCOPE_LABELS: Record<string, string> = {
  [READ]: 'Read comments on repositories you can read',
  [WRITE]: 'Reply to comments and mark them addressed, as you',
}

function page(title: string, body: string) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
<style>
  :root { color-scheme: light dark; --bg: #f7f5f0; --card: #fff; --fg: #1b2230; --muted: #5d6573; --border: #e3dfd6; --primary: #1b2230; --on-primary: #fff; --warn: #8a5a00; }
  @media (prefers-color-scheme: dark) { :root { --bg: #14181f; --card: #1b2230; --fg: #e8e6e1; --muted: #a2a8b3; --border: #2c3442; --primary: #e8e6e1; --on-primary: #14181f; --warn: #e0b04d; } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100dvh; display: grid; place-items: center; padding: 16px; background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, sans-serif; }
  main { width: 100%; max-width: 440px; background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 24px; }
  h1 { font-size: 1.25rem; line-height: 1.3; margin: 0 0 8px; }
  p { margin: 0 0 12px; color: var(--muted); }
  strong { color: var(--fg); }
  .warn { color: var(--warn); }
  fieldset { border: 0; padding: 0; margin: 16px 0; display: grid; gap: 8px; }
  label { display: flex; gap: 8px; align-items: flex-start; }
  input[type=checkbox] { margin-top: 4px; }
  .actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }
  button { font: inherit; border-radius: 8px; padding: 6px 14px; border: 1px solid var(--border); background: transparent; color: var(--fg); cursor: pointer; }
  button[value=approve] { background: var(--primary); color: var(--on-primary); border-color: var(--primary); }
</style>
</head>
<body><main>${body}</main></body>
</html>`
}

export function consentPage(details: ConsentDescription, handle: string) {
  const name = escape(details.clientName)
  const origin = details.clientDomain
    ? `Published by <strong>${escape(details.clientDomain)}</strong>.`
    : 'This app registered itself, so its name isn’t verified.'
  const loopback = details.redirectIsLoopback
    ? '<p class="warn">This sends access to an app on your computer. Continue only if you just started connecting from it.</p>'
    : ''
  // Reading is what the connection is for, so it can't be unticked. Refresh tokens ride along when asked for.
  const requested = new Set(details.scope)
  const scopes = [
    `<label><input type="checkbox" checked disabled> ${SCOPE_LABELS[READ]}</label><input type="hidden" name="scope" value="${READ}">`,
    `<label><input type="checkbox" name="scope" value="${WRITE}" checked> ${SCOPE_LABELS[WRITE]}</label>`,
    requested.has('offline_access') ? '<input type="hidden" name="scope" value="offline_access">' : '',
  ].join('')
  return page(
    `Connect ${name} to Reviews`,
    `<h1>Connect ${name} to Reviews?</h1>
<p>${name} will act as you, with your GitHub access. ${origin}</p>
<p>Access goes to <strong>${escape(details.redirectHost)}</strong>.</p>
${loopback}
<form method="post">
  <input type="hidden" name="handle" value="${escape(handle)}">
  <fieldset>${scopes}</fieldset>
  <p>You'll confirm with GitHub next. You can disconnect it any time from your menu in Reviews.</p>
  <div class="actions">
    <button name="decision" value="deny">Cancel</button>
    <button name="decision" value="approve">Connect</button>
  </div>
</form>`,
  )
}

export function errorPage(message: string, status = 400) {
  return new Response(
    page(
      'Couldn’t connect',
      `<h1>Couldn’t connect the agent</h1><p>${escape(message)}</p><p>Start connecting again from your agent.</p>`,
    ),
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  )
}
