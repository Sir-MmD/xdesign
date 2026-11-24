# Status

Where xDesign stands: every milestone, the next step and the open items. The lead reads this
at the start of every session.

- **2026-11-24: v1.0.0 is released.** `README.md` (the logo banner, feature icons, screenshots of
  the Coffee shop fixture, download, install and build info; its files in `docs/assets/`) at
  108dacc, tagged `v1.0.0`. `./build.sh --version 1.0.0 --servers linux,windows --desktops
  windows,linux,macos --windows-desktop both --arches amd64,arm64` built all 16 files and
  `SHA256SUMS` (not signed) with the proof passing; the owner's notes are filled in
  `dist/release-notes-1.0.0.md` and are the GitHub release's text. `main` and the tag are pushed
  to `origin`; the release `v1.0.0` on GitHub holds every file.
- **2026-11-24: M18 (a setup file for the Windows desktop app) is built and documented; it waits
  for the owner's hand tests.** Plan `docs/plan/20-desktop-setup-2026-11-24.md` (D-969 to D-976,
  R-448 to R-453). `./build.sh` asks "Windows desktop file: 1) Portable 2) Installer 3) Both"
  (`--windows-desktop`, `WINDOWS_DESKTOP`; portable by default); the setup file
  `xdesign-desktop-<version>-windows-<cpu>-setup.exe` installs for the current user without
  Administrator, is "xDesign desktop app" in Installed apps, and its uninstaller asks "Also remove
  your designs?" (No by default). Building it needs Wine (`.dev/cache/wine/`). Hand tests: 20
  section 6.
- **2026-11-24: M17 (uninstall from the panel) is built and documented; it waits for the owner's
  hand tests.** Plan `docs/plan/19-uninstall-2026-11-24.md` (Q-82 to Q-85, D-951 to D-968, R-441 to
  R-447). Maintenance > "Uninstall xDesign" (Keep the data or Remove everything, a backup offered,
  "uninstall" typed, "Confirm it's you"; never through Claude) asks the helper, which starts the
  uninstaller apart from xDesign (a transient unit on Linux, a copy in C:\Windows\Temp on Windows);
  on Windows xDesign is in Settings > Apps > Installed apps with its icon and version, and its
  Uninstall asks for Administrator. Nothing of it has run on a server yet (O-01, O-03). Hand tests:
  19 section 7.
- **2026-11-24: M15 (the Windows server) is built and documented; the owner's third list (M14,
  M15, M16) is done and waits for the hand tests.** Lead notes `.dev/m14/lead-notes.md`. The same
  single file for Windows (`xdesign-<version>-windows-<cpu>.exe` and its .zip): `--install` in a
  terminal opened as Administrator (or a double-click), the services `xdesign` (as
  `NT SERVICE\xdesign`) and `xdesign-maintenance` (updates, going back, the address and domain
  moves, restores), Windows Firewall, HTTPS in all its ways, backups, `xdesign logs`, `status`,
  the admin commands and `--uninstall`; the update check has a "System" row on both systems and
  refuses a file for the other system. `./build.sh` asks what to build (server or desktop app, the
  systems, the CPUs). None of the Windows code has run on Windows (O-03): the hand tests are its
  first run. The lead's test builds of 0.3.0 (both servers, both CPUs, from the final code; the
  desktop apps) passed their proof step; the files for the hand tests are in `.dev/m14/handtest/`.
  Hand tests: 18 section 13, 7 (Windows Server 2022 and Windows 11).
- **2026-11-23: M16 (the desktop app) is built and documented; it waits for the owner's hand
  tests.** Lead notes
  `.dev/m14/lead-notes.md`. `apps/desktop` is the Electron app: the server runs inside it on
  127.0.0.1 (port 47823 or a free one) with no sign-in, one person, offline, with backups, version
  history, comments and Claude Code; `./build.sh` makes the portable Windows exe, the Linux
  AppImage and the macOS zip (signed ad hoc) for both CPUs. The lead's test build made all 14
  files of 0.3.0 (both servers, the three desktop apps, both CPUs) with the proof step passing, and
  ran the Linux AppImage: it opened signed in, made a design and stopped its server on close. The
  Windows and macOS files have not run (O-03, O-04). The icon in `apps/desktop/build/` was drawn
  by an agent: the owner may want another. User guide chapter 13. Hand tests: 18 section 13, 8
  and 9.
- **2026-11-23: M14 (the owner's third list, the website's items) is built and documented; it
  waits for the owner's hand tests.** Lead notes `.dev/m14/lead-notes.md`. Usernames instead of emails with "Add member",
  "Set password" and "Change username" (no invite or reset links; existing accounts got usernames
  made from their Names); the big design opens in about a second (was 19 to 37 seconds of a frozen
  page here, minutes on the owner's computer); the map's lines bold with names on a selected
  step, short tags and the "Lines" switch; Activity in pages; the HTTPS card in xmtp-panel's look.
  `make sanity` has a ninth step, `start-check` (the built server starts). The next release must be 0.3.0 or
  newer (`tools/release/compat.env` SCHEMA_FLOOR, the email column is gone). Hand tests: 18
  section 13, 1 to 6 (build Server, Linux, version 0.3.0, then Maintenance > Update).
- **2026-11-23: M14, M15 and M16 (the owner's third list) are planned.** Plan `docs/plan/18-third-owner-list-2026-11-23.md` (Q-54 to Q-81, D-729 to D-757,
  R-338 to R-350, O-03, O-04); its measuring script and the copy of the big design are in
  `.dev/m14/perf/`. M14: usernames instead of emails, "Add member" and "Set password" (no invite or
  reset links), the big design's slow open (measured: the map re-renders every box on each box's
  measurement), the map's lines (highlight with names, short tags, a switch), Activity in pages,
  the HTTPS card in xmtp-panel's look. M15: the Windows server and `build.sh`'s platform menu. M16:
  the desktop app (Electron, offline, one person; Windows portable exe, Linux AppImage, macOS zip).
  23 Opus coding runs and 3 Sonnet runs in 5 waves (18 section 12).
- **2026-11-23: M13 (the owner's second list) is built and documented; it waits for the owner's
  hand tests.** Plan `docs/plan/17-second-owner-list-2026-11-23.md` (Q-36 to Q-53, D-642 to
  D-728, R-298 to R-337), lead notes `.dev/m13/lead-notes.md`. Settings > HTTPS works on a
  server again (SSL-01) and gains "Renew now"; the installer asks and gets the certificate;
  Settings' "Site address" moves the port and path; two-factor sign-in with recovery codes and
  `xdesign admin reset-2fa`; the top bar's light and dark switch; a confirm before deleting a
  design; Telegram's blue for the Blue swatch; button labels right to left; Android's Persian
  bold; Claude with full access (every panel action, design edits, Try it, pictures, import,
  "Ask first", the Claude app and claude.ai through OAuth). Hand tests: 17 section 16 (1 to 5
  on the desktop with `make dev`; 6 to 9 on the owner's server after a new build and an update;
  10 on a VM with a domain, O-01).
- **2026-11-23: M12 (the owner's list: flags, an installer like xWriter's) is built and
  documented; it waits for the owner's hand tests.** Plan `docs/plan/16-owner-list-2026-11-23.md`
  (Q-30 to Q-35, D-606 to D-641, R-279 to R-297), lead notes `.dev/m12/lead-notes.md`. Every
  language shows its flag; the site lives under a random secret path on a random port with an
  empty page elsewhere; modes A and B are gone; `xdesign admin set-port` and `set-path` move it;
  BAK-LOCK fixed the root-owned backups lock. Hand tests: 16 section 10 (1 and 2 on the
  desktop with `make dev` and `make dev BASE_PATH=/k3v9x2m1q8wz7r4t/`; 3 and 4 need O-01).
- **2026-11-23: stages 1 and 2 (M1 to M11) are built and documented; releases 1.0 and 2.0
  wait for the owner's hand tests.** Every task is merged on main and `make sanity` passes; the
  plan's "As built" sections, decisions D-37 to D-605 and risks R-20 to R-278 record what was
  built; the user guide `docs/user-guide.md` covers both stages. Nothing has been tried in a
  browser yet: the hand tests below are the first real use, so expect bugs. REL-01 and REL-02
  (`./build.sh`, release notes, the VM and update tests) are the only open tasks. Lead notes:
  `.dev/s1/lead-notes.md` and `.dev/s2/lead-notes.md`.
- **Hand tests for the owner** (each milestone's full list is under its "Hand test" in
  `docs/plan/14-milestones.md`):
  1. M1: run `make dev`; the terminal prints "Dev owner: owner@xdesign.local / <password>". Open
     http://localhost:5173 and sign in with it. Run `make sanity` (one line when all passes) and
     `make spec-check`, then read `packages/spec/fixtures/out/coffee-shop.md`, the example
     design as a builder reads it.
  2. M2: invite a second person in a private window and accept; create a design, share it as
     Editor and see it in the other window; change the role to Viewer; disable the person.
  3. M3: open one design in two browsers; add steps, draw arrows, auto-arrange, see the other
     browser follow with the cursor and name; switch the phone through the five looks, light
     and dark, and compare with xWriter's preview and a real Telegram app.
  4. M4: build your own example: a main menu with a blue "Shop" button that edits the menu into
     a product list, a "Back" row made a part and used on three steps, a phone number question
     with a "Share phone" button, an If on a test switch, a Persian translation.
  5. M5: Try it on that example (press "Shop", answer wrong then right, flip the switch); open
     Checks and fix one; Export, open the zip and read `design.md`; give the zip to Claude and
     ask how it would build the bot; Import the zip as a new design; Print.
  6. M6 (needs O-01, test VMs and a domain): `sudo ./xdesign --install` on Ubuntu, Debian and
     Fedora in the three HTTPS ways; backup, update (Maintenance and command line), a failing
     update going back by itself, restore. Build the file with `./build.sh` (for example
     version 1.0.0, both CPUs).
  7. M7: design a Stars shop: a product with a photo, an invoice for 50 Stars, a monthly
     subscription, a thank-you message; in Try it press "Pay (test)" and "Cancel"; add a poll,
     a quiz that saves the answer, dice and a rich message; export and read `design.md`.
  8. M8: a reminder ("Still want your latte?" after an hour unless the user paid), a broadcast
     to users with the switch "Wants news", the bot reacting to an answer; try each through Try
     it's "Events" menu.
  9. M9: two people comment on a button and mention each other, then resolve it; name a
     version, change three steps, compare and restore; send a view-only link to a phone, try
     the bot there without an account, then revoke it.
  10. M10: create an API key on the Account page, add xDesign to Claude Code with the shown
     command, ask Claude to list the designs and summarize one; give a Claude link from the
     Share dialog to a fresh Claude session and ask it to plan the bot's code.
  11. M11: start a design from the "Shop with Stars" template, change the products, try it,
     export; "Save as template" on your own design.
- **Open:** Q-26 and Q-27 kept their defaults (checklists and "User reacts" dropped, D-36);
  O-01 (test VMs and a domain) for M6's hand tests and release 1.0; O-02 (screenshots)
  to calibrate the private chat parts marked `calibrate: O-02`; the helper's update check sends
  no release notes yet (small Go follow-up).

## Progress log

- 2026-11-23: request, seven rounds of questions (Q-01 to Q-25), plan written (D-01 to D-28,
  R-01 to R-15).
- 2026-11-23: the owner's follow-up (01 section 2.1): xWriter's exact Telegram look (Q-28) and
  the Go helper copied from xWriter and xmtp-panel (Q-29); M6 rewritten (GO-01 to GO-08,
  WEB-03), D-29 to D-34, R-16 to R-19; the repository `Sir-MmD/xdesign` added as `origin`
  (nothing pushed).
- 2026-11-23: build started; M1 merged (FND-01, TG-00, TG-01, SPEC-01 to SPEC-06) and folded
  by DOC-M1 (8364f3f).
- 2026-11-23: stage 1 merged: M2 to M6 code (SRV, AUTH, MEDIA, LIVE, WEB-01 to WEB-03, PRV,
  EDIT, MAP, TXT, BTN, MSG, LOGIC, START, LANG, PARTS, TRY, CHK, EXP, GO-01 to GO-09), the
  documentation of M2 to M6, the user guide (c9255c9) and the trial build; main at 32c4716.
- 2026-11-23: stage 2 merged (MSG-02, MSG-03, RICH-01, RICH-02, PAY-01, PAY-02, EVT-01,
  EVT-02, CMT-01, CMT-02, HIST-01, HIST-02, VIEW-01, CL-01 to CL-03, TPL-01, TG-REFRESH) and
  documented (DOC-M9, DOC-M10, DOC-S2 for M7, M8 and M11, GUIDE-02).
- 2026-11-23: the owner's list (country flags; random port and path in the installer): two
  rounds of questions (Q-30 to Q-35), planned as M12 in `docs/plan/16-owner-list-2026-11-23.md`.
- 2026-11-23: M12 built (FLAG-01, PATH-01, PATH-02, GO-10a, GO-10b, GO-11, BAK-LOCK) and documented
  (DOC-M12); main at the M12 status commit.
- 2026-11-23: the owner's second list (HTTPS, two-factor sign-in, the site address, a theme switch,
  a delete confirm, three display bugs, Claude with full access): five rounds of questions (Q-36
  to Q-53) and the server's log, planned as M13 in `docs/plan/17-second-owner-list-2026-11-23.md`.
- 2026-11-23: M13 built (SSL-01, SSL-02, ADDR-01, ADDR-02, FIX-01, FIX-02, TFA-01, TFA-02, GO-12,
  THEME-01, MCP-01a, MCP-01b, MCP-02a, MCP-02b, MCP-03a, MCP-03b) and documented (DOC-M13a,
  DOC-M13b); GO-12 gave `tsc -b` a 4 GB heap (the cold-cache crash is gone).
- 2026-11-23: the owner's third list (usernames, accounts by the owner, a slow big design, the map's
  lines, Activity in pages, the HTTPS card, a Windows server, a desktop app, `build.sh`'s platform):
  seven rounds of questions (Q-54 to Q-81) and a measurement of the big design on a production build,
  planned as M14, M15 and M16 in `docs/plan/18-third-owner-list-2026-11-23.md`.
- 2026-11-23: M14 built (USER-01a, USER-01b, USER-02, USER-03, PERF-01, MAP-10, MAP-11, ACT-01,
  SSL-03 with SSL-04) and documented (DOC-M14a, DOC-M14b); the lead's fix of the server bundle
  (fflate's createRequire) and the sanity step `start-check`; SCHEMA_FLOOR 0.3.0.
- 2026-11-23: M16 built (DESK-01 to DESK-05) and documented (DOC-M16a, DOC-M16b); the lead's test
  build of every file (the macOS signature check fixed) and a run of the Linux AppImage.
- 2026-11-24: M15 built (BUILD-01, WIN-01, WIN-02, WIN-03, WIN-04a, WIN-04b, WIN-05a, WIN-05b,
  WIN-06, WIN-07) and documented (DOC-M15a, DOC-M15b); the lead's Windows examples in the HTTPS
  dialog and a test build of both servers from the final code.
- 2026-11-24: the owner chose logo E of five (xD, the D a speech bubble with typing dots): the
  desktop app's icons, the browser's, the Windows server file's, the top bar, the sign-in pages and
  the desktop app's pages (D-950; `make icons` remakes them all from `apps/desktop/build/icon.svg`).
- 2026-11-24: the owner's request (an uninstall in the panel, Windows' uninstaller): four questions
  (Q-82 to Q-85), planned as M17 in `docs/plan/19-uninstall-2026-11-24.md`, built (UNINST-01,
  UNINST-02) and documented (DOC-M17).
- 2026-11-24: the owner's request (a setup file beside the portable Windows desktop file): planned
  as M18 in `docs/plan/20-desktop-setup-2026-11-24.md` with the lead's defaults, built (SETUP-01)
  and documented (DOC-M18).
