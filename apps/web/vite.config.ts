// Build and development server of the SPA (docs/plan/02-architecture.md sections 3 and 10).
// The route generator's options (route folder, generated file) live in tsr.config.json,
// shared with `tsr generate` (make gen), so both always write the same route tree.
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

import { emojiAssets } from './scripts/emoji-plugin.ts'

// The server of `make dev` (apps/server, XD_PORT).
const backend = 'http://127.0.0.1:5174'
// The web base path of `make dev` (docs/plan/16 section 4): `/`, or the path of `make dev
// BASE_PATH=/k3v9x2m1q8wz7r4t/`, which the server gets as XD_BASE_PATH.
const devBase = process.env.BASE_PATH || '/'

/**
 * The site under a web base path (PATH-02). The build's addresses are relative (`./`), so one
 * build serves any path: the server writes the install's path into index.html's `<base href>`.
 * The dev server serves the page under `devBase` and writes it there itself. Either way the
 * marker must stay in index.html exactly as written, or the base path would never reach the page.
 */
function webBasePath(): Plugin {
  const marker = '<base href="/" />'
  let serve = false
  return {
    name: 'xd:web-base-path',
    config(_, { command }) {
      serve = command === 'serve'
      if (!serve) return { base: './' }
      // The rule of the server's check of XD_BASE_PATH (xWriter's CheckBasePath).
      if (!/^\/(?:[\w-]{4,64}\/){0,3}$/.test(devBase)) {
        throw new Error(
          `BASE_PATH ${devBase}: use / or 1 to 3 parts of 4 to 64 letters, digits, _ or -, each ending in /`,
        )
      }
      return { base: devBase }
    },
    transformIndexHtml(html) {
      if (!html.includes(marker)) {
        throw new Error(`index.html has no ${marker} for the web base path (see vite.config.ts)`)
      }
      return serve ? html.replace(marker, `<base href="${devBase}" />`) : html
    },
  }
}

/**
 * sonner 2 injects its stylesheet as a <style> element when its module loads, which the
 * server's Content Security Policy (`style-src 'self'`) blocks. The stylesheet is imported in
 * styles/app.css instead, and this plugin (xWriter's) turns the injection into a no-op. The
 * build fails when sonner's code no longer has the expected shape, so an upgrade cannot bring
 * the injection back unnoticed. (The Vite dev server serves no CSP, so only the build needs it.)
 */
function sonnerWithoutStyleInjection(): Plugin {
  const marker = 'function __insertCSS(code) {'
  const sonnerModule =
    /[\\/]node_modules[\\/](?:\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?sonner[\\/]dist[\\/]index\.mjs$/
  let patched = false
  return {
    name: 'xd:sonner-without-style-injection',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (!sonnerModule.test(id)) return null
      if (!code.includes(marker)) {
        this.error('sonner no longer defines __insertCSS; check how it injects its styles (see vite.config.ts)')
      }
      patched = true
      return { code: code.replace(marker, `${marker}\n  return\n`), map: null }
    },
    buildEnd() {
      const usesSonner = [...this.getModuleIds()].some((id) => /[\\/]node_modules[\\/].*[\\/]sonner[\\/]/.test(id))
      if (usesSonner && !patched) {
        this.error(
          'sonner is bundled from an unexpected file; its style injection was not disabled (see vite.config.ts)',
        )
      }
    },
  }
}

export default defineConfig({
  // The web build's version for the editor's reload banner (src/app/version.ts): the release's
  // (build.sh passes XD_RELEASE_VERSION, as to the server's bundles), else the development one.
  define: { __XD_VERSION__: JSON.stringify(process.env.XD_RELEASE_VERSION ?? '0.0.0-dev') },
  plugins: [
    // Must come before the React plugin.
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    // The Telegram preview's Apple-style emoji images (packages/preview).
    emojiAssets(),
    sonnerWithoutStyleInjection(),
    webBasePath(),
  ],
  resolve: {
    // `@/components/ui/button` as in xWriter's panel, so its components copy as they are.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2023',
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // Under the base path, passed on unchanged: the server serves its routes under the same one.
    proxy: {
      [`^${devBase}api/`]: { target: backend },
      // A view-only link's page (VIEW-01) opens `<base>live?view=<token>`.
      [`^${devBase}live(?:[/?]|$)`]: { target: backend, ws: true },
      // The MCP connector (CL-02), at the address the Account page shows.
      [`^${devBase}mcp(?:[/?]|$)`]: { target: backend },
      // Its OAuth endpoints and metadata (MCP-03a), the metadata also outside the base path.
      [`^${devBase}oauth/`]: { target: backend },
      '^/\\.well-known/oauth-': { target: backend },
    },
  },
})
