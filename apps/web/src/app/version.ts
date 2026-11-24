// The version of this web build (vite.config.ts stamps it): the release's, or 0.0.0-dev while
// developing. The editor compares it with the server's version from the live connection
// (docs/plan/07 section 6, item 4) and asks for a reload when they differ.
declare const __XD_VERSION__: string

export const webVersion: string = __XD_VERSION__
