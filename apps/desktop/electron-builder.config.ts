// electron-builder's configuration of the desktop app (docs/plan/18 sections 9.7 and 10, docs/plan/20).
// build.sh runs electron-builder with it once per system, CPU and Windows file, after it staged Node.js's
// official build and the app for them, and sets:
//   XD_RELEASE_VERSION    the release's version, the app's own ("About xDesign")
//   XD_DESKTOP_RESOURCES  the staged folder: runtime/ (Node.js), app/ (the server bundles, the SPA, the
//                         migrations, the native modules of the system and CPU) and on Linux icon.png
//   XD_DESKTOP_OUTPUT     electron-builder's output folder, in dist/build/
//   XD_DESKTOP_FILE       the release file's name (the macOS target stops at xDesign.app, which build.sh
//                         signs ad hoc and zips)
//   XD_DESKTOP_WINDOWS    the Windows file: portable (the portable .exe, the default) or nsis (the setup file)
//   XD_ELECTRON_CACHE     Electron's downloads (.dev/cache/electron/), checked against the
//                         SHASUMS256.txt-<version> build.sh writes there from electron's checksums.json
// The icons in build/ are made by `make icons` (tools/icons.sh) from the logo build/icon.svg and its
// small form build/icon-small.svg: icon.png at 512 by 512, icon.ico (16 to 256), icon.icns (32 to 1024,
// ic07 to ic14, with macOS's margin). build/installer.nsh adds the setup file's uninstaller question.
import type { Configuration } from 'electron-builder'

import { appId, appName, mainScript } from './src/identity.ts'

function env(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`electron-builder.config.ts: ${name} is not set; build.sh sets it (docs/plan/18 section 10)`)
  }
  return value
}

const file = env('XD_DESKTOP_FILE')
const windows = process.env.XD_DESKTOP_WINDOWS || 'portable'
if (windows !== 'portable' && windows !== 'nsis') {
  throw new Error(`electron-builder.config.ts: XD_DESKTOP_WINDOWS is portable or nsis, not ${windows}`)
}

const config: Configuration = {
  appId,
  productName: appName,
  // The packaged package.json, whose version app.getVersion() reads. A one-click setup for the current
  // user installs into %LOCALAPPDATA%\Programs\<the package's name>, so the setup file's package is named
  // xDesign (docs/plan/20 section 2), not @xdesign/desktop.
  extraMetadata: { version: env('XD_RELEASE_VERSION'), ...(windows === 'nsis' ? { name: appName } : {}) },
  directories: { output: env('XD_DESKTOP_OUTPUT'), buildResources: 'build' },
  // The shell is its bundled main process alone (electron-builder always adds package.json).
  files: [mainScript],
  // <resources>/runtime and <resources>/app (docs/plan/18 section 9.7). The staged folder itself, not its
  // app/: electron-builder leaves out a node_modules folder at the top of a folder it copies.
  extraResources: [{ from: env('XD_DESKTOP_RESOURCES'), to: '.' }],
  // Nothing to rebuild: the shell has no dependencies and the server's native modules are prebuilt.
  npmRebuild: false,
  electronDownload: { cache: env('XD_ELECTRON_CACHE') },
  publish: null,
  // One portable .exe (Q-74): it unpacks itself to a temporary folder at each start. The icon and the
  // file details are written with resedit, which needs no Wine. Or the setup file (docs/plan/20), whose
  // uninstaller electron-builder makes by running it under Wine.
  win: { target: windows, icon: 'build/icon.ico' },
  portable: { artifactName: file },
  // The setup file (docs/plan/20 section 2): one click, for the current user (no Administrator), into
  // %LOCALAPPDATA%\Programs\xDesign; "xDesign" in the Start menu and on the desktop, started at the end;
  // "xDesign desktop app" in Windows' installed apps, apart from the Windows server's "xDesign". The data
  // folder %APPDATA%\xDesign stays unless the uninstaller's question removes it (build/installer.nsh). No
  // .blockmap and no elevate.exe: they serve electron-updater, which xDesign does not use.
  nsis: {
    artifactName: file,
    oneClick: true,
    perMachine: false,
    shortcutName: appName,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    runAfterFinish: true,
    uninstallDisplayName: `${appName} desktop app`,
    installerIcon: 'build/icon.ico',
    uninstallerIcon: 'build/icon.ico',
    include: 'build/installer.nsh',
    deleteAppDataOnUninstall: false,
    differentialPackage: false,
    packElevateHelper: false,
  },
  linux: { target: 'AppImage', icon: 'build/icon.png', executableName: 'xdesign', category: 'Development' },
  appImage: { artifactName: file },
  // Unsigned here: build.sh signs the app ad hoc with rcodesign (Q-77).
  mac: { target: 'dir', icon: 'build/icon.icns', identity: null },
}

export default config
