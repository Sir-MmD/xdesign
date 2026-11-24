// The modules the preview imports through Vite (vite/client declares them in the web app):
// stylesheets as text (`?inline`) or for the page, the looks' art as URLs, the @fontsource
// packages, and the emoji index of apps/web/scripts/emoji-plugin.ts.
declare module '*.css?inline' {
  const css: string
  export default css
}

declare module '*?url&no-inline' {
  const url: string
  export default url
}

declare module '*.css' {}

declare module '@fontsource-variable/*' {}

/** The emoji index of apps/web/scripts/emoji-plugin.ts: an emoji without U+FE0F to its image. */
declare module 'virtual:emoji-index' {
  export const folder: string
  const index: Readonly<Record<string, string>>
  export default index
}
