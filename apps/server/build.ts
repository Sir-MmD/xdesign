// Bundles the server into dist/server.mjs and the app's commands into dist/cli.mjs with esbuild
// (`make build`): every dependency and the workspace packages (TypeScript source) go into each
// file, except the native modules, which the release ships prebuilt for the CPU in
// app/node_modules (docs/plan/07 section 2). The migrations are copied beside them, as
// app/migrations in a release.
import { cpSync, rmSync } from 'node:fs'

import { build, type Plugin } from 'esbuild'

const nativeModules = ['better-sqlite3', '@node-rs/argon2']

// The release build (build.sh) passes its version in XD_RELEASE_VERSION: it replaces the
// development version of src/version.ts in both bundles, so /api/health names the release.
const releaseVersion = process.env.XD_RELEASE_VERSION
const stampVersion = (version: string): Plugin => ({
  name: 'release-version',
  setup(b) {
    b.onLoad({ filter: /[\\/]src[\\/]version\.ts$/ }, () => ({
      contents: `export const version = ${JSON.stringify(version)}\n`,
      loader: 'ts',
    }))
  },
})

await build({
  entryPoints: { server: 'src/main.ts', cli: 'src/cli.ts' },
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node26',
  external: nativeModules,
  plugins: releaseVersion ? [stampVersion(releaseVersion)] : [],
  sourcemap: 'linked',
  // CommonJS dependencies call require(), which an ES module bundle does not have. The import
  // has a name of its own: a bundled ES module may import createRequire too (fflate does).
  banner: {
    js: "import { createRequire as xdesignCreateRequire } from 'node:module'; const require = xdesignCreateRequire(import.meta.url);",
  },
  logLevel: 'warning',
})

rmSync('dist/migrations', { recursive: true, force: true })
cpSync('migrations', 'dist/migrations', { recursive: true })
