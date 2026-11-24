// The Apple-style emoji images of the Telegram preview (packages/preview, PRV-01), copied from
// xWriter's web/scripts/emoji-plugin.ts (its Apple set only): the 64 px PNGs of
// emoji-datasource-apple (a dev dependency of packages/preview) go into assets/emoji-<version>/
// under their own names, so the preview finds an image from the emoji itself and only the emoji
// on screen are downloaded. A small index (emoji without U+FE0F to the image's name) is the
// virtual module virtual:emoji-index, which the preview loads with its own chunk. The images
// are written only into a build that has the preview in it.
import { existsSync, readFileSync } from 'node:fs'
import type { ServerResponse } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

import type { Plugin } from 'vite'

const virtualId = 'virtual:emoji-index'
const resolvedId = `\0${virtualId}`

interface EmojiEntry {
  unified: string
  non_qualified?: string | null
  image: string
  has_img_apple?: boolean
  skin_variations?: Record<string, { unified: string; image: string; has_img_apple?: boolean }>
}

/** The lookup key of an emoji sequence: its code points in lower-case hex without U+FE0F. */
function emojiKey(unified: string): string {
  return unified
    .toLowerCase()
    .split('-')
    .filter((c) => c !== 'fe0f')
    .join('-')
}

export function emojiAssets(): Plugin {
  // emoji-datasource-apple as packages/preview resolves it.
  const require = createRequire(createRequire(import.meta.url).resolve('@xdesign/preview'))
  const pkgDir = dirname(require.resolve('emoji-datasource-apple/package.json'))
  const { version } = require('emoji-datasource-apple/package.json') as { version: string }
  const images = join(pkgDir, 'img/apple/64')
  const folder = `assets/emoji-${version}`
  // The address the preview loads the images from, under the app's base: relative in the build
  // (`./`, under the page's <base href>), the web base path in development ('/' by default).
  let base = '/'
  let index: Record<string, string> | undefined
  const build = (): Record<string, string> => {
    const out: Record<string, string> = {}
    const add = (unified: string | null | undefined, image: string) => {
      if (!unified || !existsSync(join(images, image))) return
      out[emojiKey(unified)] ??= image.replace(/\.png$/, '')
    }
    for (const e of require('emoji-datasource-apple/emoji.json') as EmojiEntry[]) {
      if (e.has_img_apple === false) continue
      add(e.unified, e.image)
      add(e.non_qualified, e.image)
      for (const v of Object.values(e.skin_variations ?? {})) {
        if (v.has_img_apple !== false) add(v.unified, v.image)
      }
    }
    return out
  }
  // The images from node_modules, in development.
  const serve = (req: { url?: string }, res: ServerResponse, next: () => void) => {
    const name = (req.url ?? '').replace(/^\//, '').split('?')[0] ?? ''
    if (!/^[0-9a-f-]+\.png$/.test(name) || !existsSync(join(images, name))) {
      next()
      return
    }
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'no-cache')
    res.end(readFileSync(join(images, name)))
  }
  return {
    name: 'xd:emoji-assets',
    configResolved(config) {
      base = config.base
    },
    resolveId(id) {
      return id === virtualId ? resolvedId : undefined
    },
    load(id) {
      if (id !== resolvedId) return undefined
      index ??= build()
      return `export const folder = ${JSON.stringify(base + folder)}\nexport default ${JSON.stringify(index)}\n`
    },
    configureServer(server) {
      // This middleware comes before Vite strips the base from the address.
      server.middlewares.use(`${base}${folder}/`, serve)
    },
    generateBundle() {
      // Only a build whose code loads the index (the preview is in it) needs the images.
      if (index === undefined) return
      for (const name of new Set(Object.values(index))) {
        this.emitFile({
          type: 'asset',
          fileName: `${folder}/${name}.png`,
          source: readFileSync(join(images, `${name}.png`)),
        })
      }
    },
  }
}
