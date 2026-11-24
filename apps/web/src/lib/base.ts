// The site's web base path (docs/plan/16 section 4): an install serves the whole site under a
// secret path such as `/k3v9x2m1q8wz7r4t/`. The server writes it into index.html's `<base href>`
// (Vite does in development, `/` unless `make dev BASE_PATH=...`), so one build serves any path,
// and every address the app makes starts from it: the router, the API, the live socket, media.

/** The web base path: `/k3v9x2m1q8wz7r4t/`, or `/` at the root; it starts and ends with `/`. */
export const basePath = new URL('.', document.baseURI).pathname

/** The address of a path of the site under its base: `/api/me` is `/k3v9x2m1q8wz7r4t/api/me`. */
export function appUrl(path: string): string {
  return `${basePath}${path.replace(/^\//, '')}`
}

/** The full address of a path of the site, with its origin (the MCP address the Account page shows). */
export function siteUrl(path: string): string {
  return `${window.location.origin}${appUrl(path)}`
}

/** The WebSocket address of a path of the site (the live connection; Vite's dev server passes it on). */
export function socketUrl(path: string): string {
  return `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}${appUrl(path)}`
}
