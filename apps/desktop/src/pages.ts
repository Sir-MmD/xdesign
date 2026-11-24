// The window's own small pages (docs/plan/18 section 9.2): "Starting xDesign..." while the server
// starts, and why it did not or why it stopped, with the log's place. They are data: URLs made here,
// in the site's colors (light or dark as the system is), without scripts: their Content Security
// Policy allows only their style. Their one button, "Start again", is a link to startAgainUrl, which
// the window catches (window.ts).
export const startAgainUrl = 'xdesign-desktop:start-again'

// xDesign's logo above each page's words: build/icon.svg (the owner's choice E), inline, as the
// Content Security Policy allows no image.
const logo =
  '<svg class="logo" viewBox="0 0 512 512" aria-hidden="true"><defs><linearGradient id="xd-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1C2642"/><stop offset="1" stop-color="#0F1424"/></linearGradient><linearGradient id="xd-ink" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5CD6FF"/><stop offset="1" stop-color="#3B6FF6"/></linearGradient></defs><path d="M128 24H384A104 104 0 0 1 488 128V384A104 104 0 0 1 384 488H128A104 104 0 0 1 24 384V128A104 104 0 0 1 128 24Z" fill="url(#xd-bg)"/><path d="M106 212L190 300M190 212L106 300" stroke="#FFFFFF" stroke-width="30" stroke-linecap="round"/><path d="M236 150H312A106 106 0 0 1 312 362H286L232 404L236 362Z" fill="url(#xd-ink)"/><circle cx="282" cy="256" r="15" fill="#0F1424"/><circle cx="324" cy="256" r="15" fill="#0F1424"/><circle cx="366" cy="256" r="15" fill="#0F1424"/></svg>'

const style = `
:root { color-scheme: light dark; --bg: #fafafa; --text: #0a0a0a; --quiet: #6c6c6c; --brand: #2374cc; --on-brand: #ffffff; }
@media (prefers-color-scheme: dark) {
  :root { --bg: #0a0a0a; --text: #fafafa; --quiet: #a1a1a1; --brand: #5a9fef; --on-brand: #0a0a0a; }
}
html, body { height: 100%; margin: 0; }
body {
  display: grid; place-items: center; background: var(--bg); color: var(--text);
  font: 15px/1.5 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; user-select: none;
}
main { max-width: 36rem; padding: 2rem; text-align: center; }
.logo { display: block; width: 72px; height: 72px; margin: 0 auto 1.25rem; }
p { margin: 0 0 0.75rem; }
.quiet { color: var(--quiet); }
.path { font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; overflow-wrap: anywhere; user-select: text; }
a {
  display: inline-block; margin-top: 0.75rem; padding: 0.5rem 1rem; border-radius: 0.5rem;
  background: var(--brand); color: var(--on-brand); font-weight: 600; text-decoration: none;
}
`

function escape(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

function page(body: string): string {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>xDesign</title>
<style>${style}</style>
</head>
<body><main>${logo}${body}</main></body>
</html>
`
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

export function startingPage(): string {
  return page('<p class="quiet">Starting xDesign...</p>')
}

export interface Problem {
  // What happened, in one sentence.
  sentence: string
  // The log file's place.
  log: string
  // Whether the page offers "Start again".
  startAgain: boolean
}

export function problemPage(problem: Problem): string {
  const button = problem.startAgain ? `<a href="${startAgainUrl}">Start again</a>` : ''
  return page(
    `<p>${escape(problem.sentence)}</p>` +
      `<p class="quiet">Log: <span class="path">${escape(problem.log)}</span></p>` +
      button,
  )
}
