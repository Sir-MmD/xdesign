// The desktop app's name, id and built main script in one place (docs/plan/18 section 9):
// electron-builder's configuration (DESK-05) takes them from here. package.json repeats the name
// (productName) and the main script (main), which Electron itself reads.
export const appName = 'xDesign'
export const appId = 'io.github.sir-mmd.xdesign'
// The main process as build.ts bundles it, relative to apps/desktop.
export const mainScript = 'dist/main.mjs'
