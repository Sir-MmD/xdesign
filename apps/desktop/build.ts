// Bundles the desktop app's main process into dist/main.mjs with esbuild (`make build`), as
// apps/server/build.ts bundles the server. Electron's own module stays outside: Electron has it
// built in. electron-builder (DESK-05) packages the file with this folder's package.json, beside
// the server bundle, the SPA and Node.js (docs/plan/18 section 9.7).
import { build } from 'esbuild'

import { mainScript } from './src/identity.ts'

await build({
  entryPoints: ['src/main.ts'],
  outfile: mainScript,
  bundle: true,
  platform: 'node',
  format: 'esm',
  // The Node.js inside Electron 45 is at least this one.
  target: 'node22',
  external: ['electron'],
  sourcemap: 'linked',
  logLevel: 'warning',
})
