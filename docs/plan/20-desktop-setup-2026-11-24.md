# 20. A setup file for the Windows desktop app (2026-11-24)

The owner's request after M17, planned and built as M18. Decisions D-969 to D-976, risks R-448 to
R-453.

## 1. The owner's words

```
build,sh only creates portable exe not an installer tho. which is fine by me but add an option to
create installer version as well
```

## 2. What changes, and the lead's defaults

The portable `.exe` stays as it is (Q-74, D-754) and stays the default. `build.sh` can also make a
setup file for the Windows desktop app, or both. Not asked (the lead's defaults, as most desktop
apps on Windows do it):

- The setup file is electron-builder's one-click NSIS installer for the current user: no
  Administrator, no pages to click through; it installs into
  `%LOCALAPPDATA%\Programs\xDesign`, adds "xDesign" to the Start menu and the desktop, and starts
  xDesign when it ends.
- It adds the entry "xDesign desktop app" to Windows' list of installed apps (Settings > Apps >
  Installed apps), with the logo and the version; its Uninstall button runs the uninstaller. The
  name differs from the Windows server's entry "xDesign" (19 section 3), so both can be told apart
  on one computer.
- The data folder is the same as the portable file's, `%APPDATA%\xDesign` (18 section 9.7): the
  portable file and the installed app see the same designs.
- The uninstaller asks "Also remove your designs?" (No by default, section 4). A newer setup file
  run over an installed one updates it and never asks.

## 3. `build.sh` (SETUP-01)

- The menu asks one more question when the desktop app for Windows is chosen, right after "Desktop
  app for:":

```
:: Windows desktop file:
   1) Portable   2) Installer   3) Both
   Choose [1]:
```

- The flag for the same, without the menu: `--windows-desktop portable|installer|both`
  (`portable,installer` works too), default `portable`; `make release` passes `WINDOWS_DESKTOP`
  (default `portable`). Without the Windows desktop app it changes nothing.
- The files: `dist/xdesign-desktop-<version>-windows-<cpu>.exe` (portable, as today) and
  `dist/xdesign-desktop-<version>-windows-<cpu>-setup.exe` (the setup file), for each chosen CPU;
  both in SHA256SUMS, the release notes and the summary.
- The setup file needs Wine on the build computer: electron-builder runs NSIS's uninstaller maker
  under Wine (the portable file needs none, D-846). `check_desktop` asks for `wine` only when the
  setup file is chosen, and says how to get it (`pacman -S wine` on Arch, `apt install wine` on
  Debian and Ubuntu). Wine runs with its own folder `.dev/cache/wine/` (`WINEPREFIX`, made once
  with Mono and Gecko turned off), never the owner's `~/.wine`.
- The staged app of a CPU is packaged once per chosen file; the proof reads each file: the
  setup file's NSIS header, its app package of the CPU, the uninstaller inside it, and the same
  contents checks as the portable file (Electron's program, the runtime, the app, the version).
  Nothing runs the setup file here.

## 4. The uninstaller's question

When the uninstaller runs by hand (not silently, not as part of an update), after xDesign is
closed and before its files are removed, it asks:

```
Also remove your designs?

Yes removes the designs, backups and settings in %APPDATA%\xDesign.
No keeps them for the next time you install xDesign.
```

with the buttons Yes and No, No by default. The portable file's users have the same folder, so No
is the safe answer. The uninstaller skips the question when its command line has `/S` or
`--updated` (a newer setup file runs the old uninstaller with both). A full uninstall also removes
`%LOCALAPPDATA%\xdesign-updater\installer.exe`, the copy of the setup file that electron-builder
keeps (D-972).

## 5. Tasks

| Task | What | Who |
|---|---|---|
| SETUP-01 | Sections 2 to 4: `build.sh`, the Makefile, `apps/desktop` (electron-builder's NSIS target, the uninstaller's question), a real build of both Windows files | Opus, effort xhigh |
| DOC-M18 | The user guide (the desktop chapter and building), 18 section 9.7 and 10, decisions, risks, status | Sonnet |

## 6. Hand tests

On a Windows 11 computer:

1. Run `xdesign-desktop-<version>-windows-amd64-setup.exe` ("More info", then "Run anyway" the
   first time). It installs without asking for Administrator and starts xDesign.
2. The Start menu and the desktop have "xDesign" with the logo. Settings > Apps > Installed apps
   lists "xDesign desktop app" with the version.
3. Make a design, close xDesign, open it from the Start menu: the design is there.
4. Uninstall it from Installed apps and answer No: `%APPDATA%\xDesign` stays. Install again: the
   design is there. Uninstall again and answer Yes: the folder and
   `%LOCALAPPDATA%\xdesign-updater` are gone.

## As built (M18)

**SETUP-01** (fb9bd8a), sections 2 to 4: `--windows-desktop portable|installer|both`
(`portable,installer` too; default `portable`), the menu's "Windows desktop file" right after
"Desktop app for" when Windows is chosen (skipped when the flag is given), and `make release`'s
`WINDOWS_DESKTOP`. A wrong word stops with "the Windows desktop files are portable, installer or
both, not: <word>". The staged app of a CPU is packaged once per chosen file: the Windows desktop
app takes 1 phase plus 1 per file for each CPU ("app files", "packaging", "setup file").
electron-builder's `nsis` target is chosen by `XD_DESKTOP_WINDOWS=nsis`. A one-click setup for the
current user installs into `%LOCALAPPDATA%\Programs\<the package's name>`, so the setup file's
packaged package.json is named `xDesign` (the workspace's `@xdesign/desktop` would make the folder
`@xdesigndesktop`, D-969); the portable file, the AppImage and the macOS app keep their package as
before. Wine runs once per setup file inside electron-builder, to make the uninstaller (a few
seconds). Phase 1 asks for `wine`, `wineboot` and `wineserver` only when the setup file is chosen
("'wine' was not found on PATH; the setup file of the desktop app for Windows needs Wine (pacman -S
wine on Arch, apt install wine on Debian and Ubuntu)") and makes Wine's folder `.dev/cache/wine/`
with `wineboot -i`, Mono and Gecko off (`WINEDLLOVERRIDES="mscoree,mshtml=;winemenubuilder.exe=d"`,
about 6 seconds), and again with `wineboot -u` when `wine --version` differs from the one kept in
`.dev/cache/wine/xdesign-wine-version` (D-974). 7z lists the setup file as `$PLUGINSDIR/app-64.7z`
(for arm64 `app-arm64.7z`; the app as in the portable file, about 151 MiB for amd64),
`$R0/Uninstall xDesign.exe` (the uninstaller, 487 KiB, itself an NSIS program),
`uninstallerIcon.ico` (the logo, the entry's icon in Installed apps) and NSIS's plugins in
`$PLUGINSDIR` (`System.dll`, `StdUtils.dll`, `SpiderBanner.dll`, `nsExec.dll`, `nsis7z.dll`,
`WinShell.dll`); no `.blockmap` and no `elevate.exe` (D-973). The proof checks the setup file's NSIS
header with `file`, its one app package by the name of its CPU, the uninstaller with `file`, and
reads both NSIS scripts with Node (the first header after the stub and its deflated header block,
as 7z does not show the script): the setup file is an installer whose script names "xDesign desktop
app", the uninstaller is flagged an uninstaller and its script holds the question's whole text; then
the same contents checks as the portable file (D-975). The setup file's script installs into
`$LOCALAPPDATA\Programs\xDesign` and keeps a copy of itself in
`%LOCALAPPDATA%\xdesign-updater\installer.exe` (electron-builder does this for electron-updater).
The question is asked in electron-builder's `customUnInstall`: after "Are you sure you want to
uninstall xDesign?" and after xDesign is closed, just before its files are removed (the one-click
uninstaller ends its section with `Quit`, so nothing can run after the removal, D-970). It has no
`/SD`: the uninstaller skips it when its command line has `/S` or `--updated` (D-971). A full
uninstall also deletes the kept copy of the setup file (D-972). The summary names the setup file
"Setup" (D-976). Sizes for 0.3.0: amd64 portable 159,609,137 bytes and setup 159,727,397 bytes
(both 153 MiB); arm64 portable 151,726,172 bytes and setup 151,891,433 bytes (both 145 MiB): the
setup file is 118 KB (amd64) and 165 KB (arm64) larger. The build of both files for both CPUs with
the website took 13 minutes 54 seconds, the portable file alone for amd64 3 minutes 16 seconds.
Nothing ran the setup file or its uninstaller (Wine ran only inside electron-builder and for
`wineboot`); the hand tests of section 6 are open. Also edited: `docs/release-notes-template.md`
(the Files line and the desktop app's update sentence).
