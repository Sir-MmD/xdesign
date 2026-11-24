# xDesign plan

The plan of xDesign (codename `xdesign`), a private website to design Telegram bots without code.
Written on 2026-11-23 from the owner's request and answers; how the build runs is in
`claude_optimized_xhigh.md` (project root); where the build stands is `docs/status.md`.

| Document | What it holds |
|---|---|
| [01-requirements.md](01-requirements.md) | The owner's request word for word, their answers, scope, roles, requirements, stages, glossary, the decision log (section 11). |
| [02-architecture.md](02-architecture.md) | Parts, repository layout, stack, live editing flow, database, files, API style, security, performance, development. |
| [03-design-model.md](03-design-model.md) | The design model, the Yjs document, ID names, texts and their Telegram forms, the export format `spec.json` v1, the checks. |
| [04-editor.md](04-editor.md) | Every page and the editor: map, phone editing, logic forms, Try it, checks, translations, variables, parts, stage 2 additions. |
| [05-accounts-teamwork.md](05-accounts-teamwork.md) | Accounts, invites, roles, sharing, live editing, Trash, comments, version history, view-only links, activity. |
| [06-export-and-claude-link.md](06-export-and-claude-link.md) | The export zip, `design.md`, `HOW-TO-READ.md`, printing, import, the Claude link and MCP, the picture cache. |
| [07-server-install-update.md](07-server-install-update.md) | Runtime, release build, install, HTTPS (one way, a random port and a secret path), backups, updates and going back (xWriter's scenario), the command line. |
| [08-telegram-reference.md](08-telegram-reference.md) | What every element maps to in the Bot API, the limits the checks use, what Telegram cannot do, what is excluded. |
| [14-milestones.md](14-milestones.md) | M1 to M11 with their tasks, hand tests, waves and the agent count. |
| [15-risks-and-open-questions.md](15-risks-and-open-questions.md) | Risks, the owner's questions and answers (Q-), owner inputs (O-). |
| [16-owner-list-2026-11-23.md](16-owner-list-2026-11-23.md) | The owner's list of 2026-11-23 (M12): language flags everywhere, and the installer's random port and secret path like xWriter's, with the commands to move them. |
| [17-second-owner-list-2026-11-23.md](17-second-owner-list-2026-11-23.md) | The owner's second list of 2026-11-23 (M13): the HTTPS card's error, the certificate at install and "Renew now", two-factor sign-in, the site's port and path in Settings, a light and dark switch, a confirm before deleting a design, buttons right to left, the blue swatch, Android bold, and Claude with full access (MCP, the Claude app). |
| [18-third-owner-list-2026-11-23.md](18-third-owner-list-2026-11-23.md) | The owner's third list of 2026-11-23 (M14 to M16): usernames instead of emails with "Add member" and "Set password", the big design's slow open (measured), the map's lines (highlight, short tags, a switch), Activity in pages, the HTTPS card in xmtp-panel's look, a Windows server, a desktop app (Electron, offline) and `build.sh`'s platform menu. |
| [19-uninstall-2026-11-24.md](19-uninstall-2026-11-24.md) | The owner's request of 2026-11-24 (M17): Maintenance > "Uninstall xDesign" in the panel (Keep the data or Remove everything) and xDesign in Windows' list of installed apps with its uninstaller. |
| [20-desktop-setup-2026-11-24.md](20-desktop-setup-2026-11-24.md) | The owner's request of 2026-11-24 (M18): `build.sh` makes the Windows desktop app as a portable file, a setup file (installer) or both, with the setup file's uninstaller. |

Numbers 09 to 13 are kept free for later area documents, so 14 and 15 keep the same numbers as
in the owner's other projects.
