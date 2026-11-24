# 06. Export, import and the Claude link

What builders get: the export zip (stage 1), the printable page, import, and in stage 2 the
Claude link (JSON link and MCP connector) with the picture cache. The format itself is 03
section 6.

## 1. The export dialog

"Export" in the editor (or a design's menu, or the view-only page):

- "Languages": all (default) or chosen ones.
- "Pictures": "Phone look" (Web A, Web K, Desktop, Android, iOS; default the current one) and "Light" or
  "Dark"; "One picture per step and language" (default) or "Default language only"; "No
  pictures" (faster).
- (S2) "Version": "Now" or a version from history; "Name this version" (optional text, makes a
  named version of now).
  As built: "Version" lists "Now" and the versions with their date (not on a view link's page);
  "Name this version" is offered for "Now" to Editors and makes the version when "Export" is
  pressed. A version's export carries its document version and, for a named version, its name in
  spec.json and design.md.
- (S2) "Include open comments" (on by default).
- "Export" shows progress ("Making pictures 12 of 40") and downloads
  `<design-idname>-<UTC date>.xdesign.zip`.

Without the editor (a design card's menu) the dialog reads the design's live document once. The
progress also says "Fetching media files 3 of 12" and "Making the zip"; "Cancel" and closing the
dialog stop the export.

## 2. The zip

```
coffee_shop_bot-2026-11-23.xdesign.zip
  spec.json               the exact spec (03 section 6)
  design.md               the readable doc (section 3)
  HOW-TO-READ.md          the guide for builders (section 4)
  bot-spec.schema.json    JSON Schema of spec.json, format version 1
  media/                  every uploaded file the design uses, named <idName>.<ext>
  pictures/               <step idName>.<language>.png, and bot-profile.<language>.png,
                          empty-chat.<language>.png, commands-menu.<language>.png
```

- Built in the browser (D-13) by `packages/spec` export functions plus the picture maker in the
  web app; media files are fetched from the server with the person's session.
- Pictures: the phone renderer draws each step offscreen at the chosen look's own chat width
  (from its skin tokens, as in xWriter; 2x scale), exactly as the live view shows it; message steps show the message with
  its keyboard; questions show the prompt; start points and logic steps get no picture (the map
  and text describe them). `modern-screenshot` turns each into a PNG; fonts are the embedded
  ones so Persian and emoji render as in the editor.
- Big designs: pictures are made in batches so the page stays responsive; "Cancel" stops.

`media/` names come from the uploaded file names made ID names (`menu_photo.jpg`, repeats `_2`).
Pictures: `bot-profile` is the empty chat cut below its top bar; `commands-menu` only when a command
shows in the menu; a message taller than the screen gets a taller picture; video, audio and other
files show as placeholders in pictures.

## 3. `design.md`, the readable doc

Generated from the plain model, in this order:

1. **Title and summary**: design name, export time, version, languages, counts of steps and
   buttons, "Checks: 2 errors, 5 warnings" with a link to section 9 of the doc.
2. **Bot setup**: name, about, description per language, profile photo, menu button, the
   commands menu table (command, menu text per language, goes to), with the pictures.
3. **Map**: a Mermaid `flowchart LR` of every step and arrow (labels: button texts in the
   default language, outcome names, "then"); sections as Mermaid subgraphs; big designs (more
   than 80 steps) get one Mermaid chart per section plus an overview of sections.
4. **Start points**: each with its trigger in words and where it goes.
5. **Steps**, grouped by section, in map order (left to right, top to bottom): per step
   - heading `### Main menu (main_menu)` and its kind in words;
   - the picture (`![Main menu, en](pictures/main_menu.en.png)`) per language;
   - the text per language (Telegram HTML in a code block, and the plain reading);
   - a buttons table: row, text per language, look, icon, what it does ("Goes to Coffee list
     (coffee_list), by editing this message, shows a toast: 'Opening your cart'");
   - options in words; logic in sentences ("If saved answer age is at least 18, go to Adult
     menu (adult_menu); otherwise go to Sorry (sorry)");
   - "Comes from": the steps and buttons with arrows into it;
   - the designer's note; (S2) open comments as "Open questions" (a list: where on the step,
     author, date, text, replies indented); threads on deleted steps, start points, notes,
     sections and the map at the end of section 5 under "Other open questions".
6. **Variables and test switches**: table of ID name, label, type, set by, used by,
   description.
7. **Parts**: each part, where it is used.
8. **Media**: table of files and placeholders ("placeholder: product photo").
9. **Checks**: every error, warning and good-to-know, with where; ignored ones marked.
10. **Glossary**: the words of 01 section 9 and how they map to Telegram.

`toMarkdown(design, options)` (packages/spec/src/markdown/) writes it; `pictures(name, lang)` gives
each picture's path in the zip (a step's ID name, or `bot-profile`, `empty-chat`, `commands-menu`)
or null for none. The sections are numbered 1 (Summary) to 10 under the design name; with sections,
the steps come under a `## 5.<n>` heading per section; start points are in section 4 only. The logic
sentences come from `sayCondition`, `sayRemember` and `sayIf` (packages/spec/src/markdown/say.ts),
which the editor reuses.

## 4. `HOW-TO-READ.md`, the guide for builders

A fixed document in `packages/spec/docs/HOW-TO-READ.md`, copied into every export, kept in step
with the format by its owner task (EXP-01); `make gen` writes it as the string `HOW_TO_READ`
(packages/spec/src/markdown/how-to-read.gen.ts), which the browser and the server put in the zip. It
explains, for a developer or Claude:

1. What the files are; that `spec.json` is the source of truth and `design.md` the reading aid.
2. Every concept and its Bot API mapping: start points to updates and commands, message steps
   to `send*` methods, keyboards to `InlineKeyboardMarkup`, `ReplyKeyboardMarkup`,
   `ReplyKeyboardRemove`, `ForceReply`, looks to `style`, icons to `icon_custom_emoji_id`,
   clicks to `answerCallbackQuery` plus `editMessage*`, `send*` or `deleteMessage`, questions
   to waiting for the next message of a given type, popups to `answerCallbackQuery` with
   `show_alert`, the commands menu to `setMyCommands` per `language_code`, bot setup to
   `setMyName`, `setMyDescription`, `setMyShortDescription`, the menu button to
   `setChatMenuButton`, `back` to a per-user history.
3. Texts: use `html` with `parse_mode: "HTML"` and escape variable values, or use `text` plus
   `entities` and shift offsets after replacing variables (UTF-16).
4. Per-user state the bot must keep: the current step, the variables, the back history, the
   message ID of the last menu message (for edits), pending waits.
5. Languages: pick by the user's `language_code`, falling back to the default language;
   right-to-left needs nothing special in Telegram.
6. Developer steps: what they are, that their outcomes are the only ways on.
7. Checks: errors must be resolved with the designer; warnings are open points.
8. A suggested build order and a checklist ("every step in `steps` is reachable as drawn",
   "every button's `suggestedCallbackData` is at most 64 bytes").

## 5. The printable page

`/d/<id>/print` renders `design.md` as HTML with the pictures (made on the spot at the current
look, default language and all languages as in the doc), the Mermaid map drawn by the bundled
Mermaid library, page breaks before each section, and print styles; "Print or save as PDF" uses
the browser's print dialog.

The look comes from the address (`/d/<id>/print?look=ios&theme=dark`; Web A, Light without it).
Headings have GitHub's IDs, so the summary's link to the checks jumps.

## 6. Import

- Designs page "Import": drop an `.xdesign.zip` or a `spec.json`; the import validates it
  against the schema (format version 1, or migrates from older ones), shows "Import <name>:
  34 steps, 2 languages, 12 media files" and "Import as a new design"; the importer becomes the
  design owner; ID names and texts are kept; media files are uploaded.
- Import never merges into an existing design (a new design every time).
- The round trip export then import gives an equal plain model; `make spec-check` proves it on
  the fixtures (14 section 1): `packages/spec/fixtures/coffee-shop.ts`, the example design in
  English and Persian with every stage 1 kind, and `big.ts`, 300 generated steps on which `check`
  must take under 100 ms and `toSpec` under 300 ms; it also reads each fixture back from its Yjs
  document, and writes `packages/spec/fixtures/out/coffee-shop.spec.json`.
- `fromSpec` gives the design with the zip path of each media file, or the problems in plain
  words; the JSON Schema is `packages/spec/schema/bot-spec.v1.schema.json`, written by `make gen`.
- `POST /api/designs/import` takes `{ spec }` (up to 32 MB), answers the new design and the zip path
  of each uploaded file by its new media ID; the browser uploads the files and sets their server IDs
  in the new design. Activity: "Imported the design".

## 7. The Claude link (stage 2, D-27)

### 7.1 Per-design link
- Share dialog, "Claude link" (design owner and site owner): "Create link" shows
  `https://<domain>/api/link/<token>/spec.json` once, with "Copy"; also
  `.../design.md` and `.../HOW-TO-READ.md`; `?version=<name or id>` for a version;
  `?languages=en,fa`. Revocable; last use shown.
- Text next to it: "Anyone with this link can read this design. Give it to a developer or to
  Claude: 'Build the bot described at <link>'."
- `design.md` through the link points pictures at `.../pictures/<file>` from the picture cache
  (section 7.4) when present, else leaves them out with a line "Pictures: export from xDesign to
  get them".

As built: a design may have several Claude links, listed with their creation and last use; revoked ones are not listed. `?version=` takes a version's ID or a named version's name (ignoring case); `?languages=` takes a comma-separated list, the default language always included. A wrong or revoked link answers 404.

As built (CL-03): the Share dialog's "Claude link" shows the three addresses once, each with "Copy", and "The link is shown only now. Add `?version=<name or id>` for a version, `?languages=en,fa` for some languages."; the sentence shows the new link's spec.json address in place of `<link>`. The list shows who made each link, when, and its last use, with "Revoke" (no question).

### 7.2 Personal API keys and the MCP connector
- Account page, "API keys": "Create key" (name, for example "Claude Code on my laptop"), shown
  once; "Revoke"; last use shown. A key does what its person can do in xDesign, as them (17 section 13): it reads every design they can open, edits those they may edit, and runs every action of the panel they may run.
- The MCP server is at `https://<domain>/mcp` (Streamable HTTP, bearer key), with tools:

| Tool | Does |
|---|---|
| `list_designs` | The designs the key's person can open: id, name, owner, updated, step count, languages. Optional search text. |
| `get_spec` | `spec.json` of a design (latest or a version), optionally only some languages. |
| `get_doc` | `design.md` of a design. |
| `get_how_to_read` | The builders' guide. |
| `get_step` | One step with its keyboard, texts, the steps around it (in and out). |
| `list_checks` | The checks of a design. |
| `list_open_comments` | Open comment threads with their anchors (questions for the builder). |
| `get_picture` | A step's picture from the picture cache (PNG), if present. |

- The Account page shows how to connect: "In Claude Code run:" with
  `claude mcp add --transport http xdesign https://<domain>/mcp --header "Authorization: Bearer <key>"`
  and a note for other MCP clients.
- Every MCP call and link use is in the activity list (key or link name, design).

As built: a key is sent as `Authorization: Bearer <key>`; a revoked key or a disabled person's key reads nothing; removing a person deletes their keys.

As built (CL-02): `/mcp` is the Streamable HTTP transport with sessions (MCP-01a): `POST` with an initialize request starts one, calls are answered as event streams, `GET` opens the server's stream and `DELETE` ends it; a session belongs to its key and ends after an hour without calls. A missing, wrong or revoked key answers 401; a request needs no Origin header, but one that is sent must be the site's. Tools take `design` (its id from `list_designs`); `get_spec`, `get_doc`, `get_step`, `list_checks` and `get_picture` take `version` (an ID or a named version's name), and `get_spec`, `get_doc` and `get_step` take `languages`. `get_step` answers the step's spec.json entry with `comesFrom` and `goesTo` (ID name, title and how). `get_picture` takes the step's ID name (or `bot-profile`, `empty-chat`, `commands-menu`) and a language (the default one without it). design.md through MCP has the zip's picture paths and the line "Pictures: get them with the get_picture tool (the step ID name and the language)". Every call that reads or changes the site's data is an activity row: the route's own row with "via Claude Code key "<name>"", else "Used the API key <name> for <tool>" (pictures: one per key and design in 10 minutes); connecting, listing the tools, finding and describing actions are not. Actions that cannot be undone and the routes behind "Confirm it's you" ask the person first (MCP-01b, 17 section 13.4): in the chat through MCP elicitation, else through Claude's answer with a ticket for `confirm: true`; a key whose "Ask first" the site owner turned off runs them at once. Beside the panel's actions (MCP-02b): `xdesign_try_it` runs a design as Try it does, `xdesign_upload_picture` adds a picture or file to a design (base64, within the site's upload limit), `xdesign_import_design` makes a new design from spec.json as Import does, and the resource `xdesign://guide` is the guide for AIs. `/mcp` takes a body up to the site's upload limit as base64. The Claude app and claude.ai connect with OAuth (MCP-03a, 17 section 13.5): their access token works at `/mcp` beside the keys, as the person who allowed the app, with the app's own "Ask first"; /mcp's 401 names the protected resource's metadata in `WWW-Authenticate`.

As built (CL-03): the Account page's "API keys" ("A key reads every design you can open and never changes them.") has "Name" and "Create key", the key shown once with "Copy"; the commands use the site's address as the browser has it, the key just made filling `<key>`; the note reads "Other MCP clients: add the server <address>/mcp (Streamable HTTP) with the header Authorization: Bearer <key>.".

### 7.3 Server-side export
The link and MCP run the same `packages/spec` export functions on the server on the design's
current (or versioned) plain model, built from the stored Yjs state; results are cached per
`doc_version`.

As built: the export is made from the stored document (open editors save within 10 seconds) and kept in memory per design and `doc_version` (a version per its ID), at most 16, about 64 MB together. design.md through the link lists the open comments as "Open questions" for the current design, not for a version.

### 7.4 Picture cache
- When someone exports in the browser, the pictures of the default language in the chosen look
  are also uploaded to the server (`pictures` table, 02 section 5) with the design's
  `doc_version`.
- Through the link and MCP a picture is served with a header `X-Xdesign-Picture-Version` and
  `design.md` says "Pictures are from version <n> (<time>); the design changed since" when it
  did.
- The design's menu "Refresh pictures for Claude" makes them without downloading a zip.

As built: the browser uploads to `POST /api/designs/:id/pictures` (anyone who can export); the last upload replaces the design's set. design.md through the link gives each picture's full address; with no cache, or one newer than the version asked for, it has no picture lines and its summary ends with "Pictures: export from xDesign to get them"; with an older cache it ends with "Pictures are from version <n> (<time>); the design changed since". Picture fetches through a link are merged into one activity row per link in 10 minutes.

As built (CL-03): only an export of now with pictures sends them (not a version's export, not "No pictures", not a view link's page), after the zip downloads, in the background; a failure shows as a toast. "Refresh pictures for Claude" is in the editor's "..." and on the Designs cards for everyone with access; it uses the person's phone look, runs in a toast with "Cancel" and makes the pictures of the design as it is now, also while a version is open.

## As built (M5)

**EXP-01** (951b60e, 58ca89f).

Code: `toMarkdown(design, options)` and `ToMarkdownOptions`, design.md in the order of 06 section 3:
`packages/spec/src/markdown/to-markdown.ts`; The arrows of the map with their labels, and the
Mermaid map (one chart, or an overview and one chart per section):
`packages/spec/src/markdown/map.ts`; The logic sentences `sayCondition`, `sayRemember`, `sayIf`,
`sayGoTo`, `sayTarget`, `sayStep`, `sayVariable`, `sayValue` and `CONDITION_OPS`:
`packages/spec/src/markdown/say.ts`; Markdown escapes, code spans and fences, quotes and tables:
`packages/spec/src/markdown/md.ts`; The builders' guide: `packages/spec/docs/HOW-TO-READ.md`;
`HOW_TO_READ`, generated from the guide: `packages/spec/scripts/gen-guide.ts`, the Makefile target
`gen-guide` in `GEN_STEPS`, the output `packages/spec/src/markdown/how-to-read.gen.ts` in
`GEN_OUTPUTS`; Exports: one block at the end of `packages/spec/src/index.ts` (say.ts,
to-markdown.ts, how-to-read.gen.ts).

- `toMarkdown(design, options)` returns design.md as one string. Options: `languages` (as toSpec:
  only these, with the default one always), `checks` (SPEC-05's `Issue[]`; `check(design)` when left
  out), `pictures(name, lang)` (the relative path or null, which leaves the line out; `name` is a
  message or question step's ID name, or `bot-profile`, `empty-chat`, `commands-menu`; no pictures
  without it), `exportedAt`, `version` (the document version) with `versionName`, and `mediaFile`
  (toSpec's, for the paths in `media/`; the uploaded name without it).
- Under the design name as `#` title, the sections are `## 1. Summary` to `## 10. Glossary` as 06
  section 3 lists them. The summary gives the export time and version, Bot API 10.5, the languages
  (default first), the counts of start points, steps and shown buttons, and "Checks: 2 errors, 5
  warnings, 1 good-to-know" linked to `#9-checks` (with the number marked "Ignore here").
- Bot setup: a table of name, about and description per language; the profile photo (file or
  placeholder); the menu button; the commands menu table (command, menu text per language, goes to)
  in `commandOrder`; then the bot-profile, empty-chat and commands-menu pictures.
- Start points are a table (start point, when, goes to, note) in Try it's order (/start, other
  commands, start links, anything else) and are not repeated under Steps.
- Steps are in map order (x, then y, as the checks). A design with sections groups them under `##
  5.<n> <Section title> (<id_name>)` headings, then "Not in a section"; each step is `### Title
  (id_name)` (the ID name alone without a title) with: its kind in words and its send method; the
  pictures; each text, caption and wrong answer message per exported language as Telegram HTML in an
  `html` code block and the plain text as a quote ("none in this language" when missing); media
  lines (file path or `placeholder: "..."`, spoiler, caption above, album items); the keyboard (its
  Bot API object and options) and a buttons table (row, with row parts named; text per language;
  look as "Blue (primary)"; icon fallback and ID; what it does); options; logic; "Then"; "Comes
  from" as a list of the steps with the button, case, outcome or "then" of each arrow; the
  designer's note as a quote. Sticky notes follow their section's steps as quotes.
- What a button does: "Goes to Coffee list (coffee_list), by editing this message, shows a toast:
  "Opening your cart"", with "remembers: ..."; where SPEC-03's `onClick` sends instead of editing it
  reads "by sending a new message (Telegram cannot edit this message into it)". Links, copy texts,
  log-in links, disabled buttons and every bottom keyboard action have their own words ("Shares the
  user's phone number, saves it as saved answer phone, then goes to ...").
- Logic sentences: a variable is its kind and ID name ("saved answer" for question, button and start
  link variables, "remembered value", "developer output", "built-in"), a test switch "test switch
  <id_name>", a text value in quotes, yes or no for true and false. `sayCondition` gives the
  condition without "If" ("always" for an empty all, "never" for an empty any); `sayIf` the whole If
  box ("If saved answer age is at least 18, go to Adult menu (adult_menu); otherwise go to Sorry
  (sorry)"); `sayRemember` "Set ... to 0", "Add 1 to ...", "Subtract ... from ...", "Append ... to
  ...", "Clear ...".
- The map: Mermaid `flowchart LR` in a `mermaid` code block, node IDs `s_<id_name>` (made unique), a
  shape per kind (start stadium, message box, question parallelogram, If diamond, Remember cylinder,
  wait hexagon, developer step subroutine, go-to flag, end circle; a legend line above), labels
  "Title<br/>(id_name)" in quotes with `"`, `#`, `&`, `<`, `>`, backtick, `|`, `:` and `%` written
  as entity codes (`#34;`); arrows labeled with the button text in the default language, the case,
  outcome, "Valid answer", "Wrong N times", "Cancel", "Otherwise" or "then"; arrows to `back` go to
  one node "Back to the message the user came from"; disabled buttons, links and `stay` draw no
  arrow. Sections are subgraphs, flat (a frame inside a frame is not nested). More than 80 nodes
  (start points and steps) in at least two groups: `### Overview of the sections` (a node per
  section with its step count, arrows between sections counted) and one chart per section, whose
  arrows to steps elsewhere draw those steps labeled "in <section>".
- Variables and test switches are one table (ID name, label, type, set by, used by, description):
  built-ins are set by "Telegram (built-in)", test switches by "the developer (a fact the bot
  knows)"; set by and used by list steps, from the checks' indexes. Parts list their rows of buttons
  or their text, and the steps that use them. Media is one table (file, kind, details, used in) of
  the uploaded files, then the placeholders. Checks are one table (level, code, where, what),
  ignored ones "Warning (ignored here)". The glossary is 01 section 9's words and meanings with a
  column "In Telegram".
- HOW-TO-READ.md is the source; `make gen-guide` (a step of `make gen`) writes it as the template
  string `HOW_TO_READ` in `packages/spec/src/markdown/how-to-read.gen.ts`, so gen-check keeps the
  two equal. The guide has 11 sections: the files, reading spec.json, every concept and its Bot API
  mapping (a table), texts (HTML with escaped values, or entities with the UTF-16 shift rule), how
  the bot behaves step by step (per-user state, start points, presses, questions, If, Remember,
  Wait, developer steps, End, `back`, loops), edits, callbacks without a message (10.5), custom
  emoji and button looks, languages, checks, build order and checklist.

**EXP-02** (f76ee1a, 219a140).

Code: Export dialog: `apps/web/src/export/ExportDialog.tsx` (`ExportDialog({ design, onOpenChange,
doc?, look? })`), opened by "Export" in a design card's menu (`src/designs/DesignCard.tsx`,
`src/routes/_app/index.tsx`); The zip: `apps/web/src/export/exportZip.ts` (`buildExport`, `zipName`,
`mediaFiles`, `specChecks`, `download`); Picture maker: `apps/web/src/export/pictures.tsx`
(`picturesOf`, `makePictures`, `picturePath`, `mediaUrlOf`, `defaultLook`); The design outside the
editor: `apps/web/src/export/liveDoc.ts` (`openLiveDoc`) and `apps/web/src/export/useDesignOnce.ts`;
Printable page: `apps/web/src/routes/d.$id_.print.tsx` (path `/d/$id/print`, search `look` and
`theme`), `apps/web/src/export/PrintPage.tsx`; the Markdown parser `apps/web/src/export/markdown.ts`
and its view with Mermaid `apps/web/src/export/MarkdownView.tsx`; Import:
`apps/web/src/export/ImportDialog.tsx`, `apps/web/src/export/importDesign.ts` (`readExport`,
`importExport`); the Designs page's "Import" button is on; Server: `POST /api/designs/import` in
`apps/server/src/routes/designs.ts`, `importDesign` in `apps/server/src/designs/store.ts`, the route
option `bodyLimit` in `apps/server/src/route.ts`, `maxBytes` exported from
`apps/server/src/live/server.ts`, the audit action `design_imported` in `apps/server/src/audit.ts`
("Imported the design" in `apps/web/src/settings/activityText.ts`); Contract: `importDesign` answers
`{ design, files }` in `packages/api/src/routes/designs.ts`; Spec:
`mediaEdits(editor).setServerId(id, serverId)` in `packages/spec/src/ydoc/media.ts`; Guard:
`signedInGuard` in `apps/web/src/app/session.ts`, the `beforeLoad` of `routes/_app.tsx` and of the
printable page.

- Export dialog: title "Export <name>"; "Languages" lists the design's languages as checkboxes, all
  checked, the default one checked and off with "(default)"; "Pictures" is a list of "One picture
  per step and language" (default), "Default language only" and "No pictures", then (unless "No
  pictures") the phone look (Web A, Web K, Desktop, Android, iOS; the editor's look when it passes
  `look`, else Web A) and "Light" or "Dark". "Export" shows "Fetching media files 3 of 12", "Making
  pictures 12 of 40", "Making the zip"; "Cancel" stops a running export (or closes); closing the
  dialog stops it too. Done: the zip downloads and the toast "Exported <name>." shows. Without the
  editor's document (`doc`), the dialog opens the design's live document once (Hocuspocus at
  `/live`, no presence) and closes it after reading.
- Zip name: the design name made an ID name (`toIdName`), then the UTC date:
  `coffee_shop-2026-11-23.xdesign.zip`.
- spec.json: toSpec with the chosen languages, `check(design)` as `checks` (`ignored: true` on the
  ones marked "Ignore here"), `exportedBy` "xDesign <server version>" (from `/api/health`), the
  design header's `docVersion`. design.md: toMarkdown with the same languages, checks and media
  paths, and a picture line for every picture made. HOW-TO-READ.md is `HOW_TO_READ`;
  bot-spec.schema.json is `specJsonSchema()` written as make gen writes the file. All text files
  compressed, media and pictures stored.
- Media: every uploaded file with a server ID, fetched from `/api/media/<id>` with the session, at
  `media/<idName>.<ext>`: the ID name made from the uploaded name (`_2`, `_3` for repeats), the
  extension of that name or of the file type. A file that cannot be fetched stops the export with
  "The file <name> could not be fetched. Try again."
- Pictures: `pictures/<name>.<language>.png`, per picture language: `bot-profile` (the empty chat
  cut at the end of the top bar: name, photo, "bot"), `empty-chat`, `commands-menu` (only when a
  command shows in the menu), and each message step (its message and keyboard) and question (its
  prompt) in the chat screen, at the look's width and screen height, 2x. A message taller than the
  screen makes the screen taller (up to 4000 px). Pictures of uploaded images show the file; video,
  audio and other files show the preview's placeholder with the file name. Six pictures are drawn at
  once offscreen (React root outside the app), then captured one by one with a pause after each
  batch; each capture waits for the fonts, the emoji images and every image.
- Printable page `/d/<id>/print?look=ios&theme=dark` (both optional, Web A and light by default),
  outside the shell with the signed-in guard: a toolbar (not printed) with the design's name as the
  way back to `/d/<id>`, "Making pictures 12 of 40" and "Print or save as PDF" (on once the pictures
  are made; it calls the browser's print dialog), and the document on a white sheet: design.md of
  every language with the pictures made on the spot in that look, the map drawn by Mermaid (theme
  neutral, `securityLevel` strict, `maxTextSize` 10,000,000, `maxEdges` 100,000; one chart at a
  time), a new printed page before every `##` heading but the first, rows and pictures not split
  across pages. The page title is the design name, so the PDF is named after it. A chart Mermaid
  refuses shows "The map could not be drawn: <reason>" and its code.
- The renderer reads headings (IDs as GitHub makes them: lower case, punctuation and symbols left
  out, spaces as `-`, repeats `-1`, `-2`), paragraphs, `- ` lists, quotes (each line kept), fenced
  code blocks, pipe tables (`\|` is a pipe, also in code spans), backslash escapes, code spans,
  `**bold**`, links (`#...` scrolls to the heading, others open in a new tab), pictures and `<br>`;
  it draws React elements only, so no design text is read as HTML.
- Import: "Import" on the Designs page opens "Import" with a drop area "Drop an .xdesign.zip or a
  spec.json here." and "Choose a file". A zip is read with fflate (spec.json at its top, or in the
  one folder it was zipped in, with its `media/`); any other file is read as spec.json. fromSpec
  checks it in the browser; problems show as "This file cannot be imported:" with up to five of
  fromSpec's problems. A good file shows "Import <name>: 34 steps, 2 languages, 12 media files"
  (steps as the cards count them, media files found in the zip), and when some files are not in the
  file "<n> media files of the design come only with its .xdesign.zip; without them they show as
  placeholders."; "Import as a new design" sends the spec, uploads each file with its kind and sizes
  ("Uploading media files 3 of 12"), sets the new server IDs in the new design's live document, then
  opens the design with the toast "Imported <name>." (or "Imported <name>, but not every media file:
  <file>: <reason>").
- `POST /api/designs/import` (`member`): the body is `{ spec }` up to 32 MB; fromSpec reads it (a
  refusal answers `bad_request` "This file cannot be imported: <path> <problem>."); the design gets
  a new ID, its name trimmed to 100 characters ("Imported design" when empty), the importer as
  design owner, no sharing; a document over live editing's 20 MB answers `too_large` "This design is
  too big to import."; the audit row is `design_imported` with the name. The answer is `{ design,
  files }`, `files` the zip path of each uploaded file by its media ID in the new design (its
  `serverId` is empty until the browser sets it).


## As built (M9)

**CMT-02** (a44706a).

Code: "Open questions" in `design.md`: `OpenQuestion` and `openQuestions` in
`packages/spec/src/markdown/to-markdown.ts`; "Include open comments" in
`apps/web/src/export/ExportDialog.tsx`, the threads fetched in `export/exportZip.ts` (`commentsOf`).
With "Include open comments" (on by default) the export fetches the design's threads and lists the
open ones under their step's block as "**Open questions:**", one list item per thread ("On the
button "Buy": ", "On the text in `fa`: " or nothing for the step itself, then "<author> (<date>):
<text>"), replies indented under it; threads on deleted steps, on start points, notes and sections,
and on the map are listed at the end of section 5 under "**Other open questions:**". `spec.json`
gets no comments (06 lists them only in `design.md` and through MCP), so the format stays version 1
unchanged. The page of a view-only link (VIEW-01) has no "Include open comments" and exports none.
Left open: `list_open_comments` for MCP is M10's.

**HIST-02** (4b782b2).

Code: Export dialog "Version": `apps/web/src/export/VersionField.tsx`,
`apps/web/src/export/ExportDialog.tsx` (`ExportedDesign.version`),
`apps/web/src/export/exportZip.ts` (`versionName` into spec.json and design.md); the top bar's
`ExportButton.tsx` starts on the version open. The export dialog starts with "Version" ("Now", then
each version as "<label>, <date and time>"), for people with a session (not on a view link's page);
for "Now" Editors also get "Name this version" ("Optional: makes a named version of the design as it
is now."), made when "Export" is pressed. A version exports its own design with its document version
and, for a named version, its name in spec.json (`design.versionName`) and design.md's summary;
"Now" with a new name exports the editor's document with the new version's document version and
name. The top bar's "Export" starts on the version open, if any; opening a dialog from the History
panel closes the panel and it opens again after.

## As built (M10)

**CL-01** (61a597d).

Tables `claude_links`, `api_keys` and `pictures`: the `// CL-01` block at the end of `apps/server/src/db/schema.ts`, `apps/server/migrations/0006_claude_links.sql`. The contract is `packages/api/src/routes/claude.ts` (`claudeLink`, `claudeLinkUrls`, `apiKey`, `apiKeyName`, `linkQuery`, `pictureFields`, `claudeRoutes`); the routes are `apps/server/src/routes/claude.ts` (links, keys, the picture upload, the link's public files). Claude links (design owner and site owner; a design in Trash answers 404 "This design is in Trash."): `GET /api/designs/:id/claude-links` lists the links that work, newest first, `{ links: [{ id, createdAt, createdBy: { id, name } | null, lastUsedAt }] }`; `POST` makes one and answers `{ link, urls: { spec, doc, howToRead } }`, the three addresses `https://<domain>/api/link/<token>/spec.json`, `/design.md`, `/HOW-TO-READ.md` (shown once, only the token's SHA-256 is kept); `DELETE /:linkId` revokes it. A design may have several links. Removing the person who made a link keeps the link (`created_by` null). API keys (each member, their own): `GET /api/me/api-keys` lists the keys that work, newest first, `{ keys: [{ id, name, createdAt, lastUsedAt }] }`; `POST { name }` (1 to 100 characters) answers `{ key, secret }`, the key shown once; `DELETE /:keyId` revokes it. A key is 32 random bytes as base64url, sent as `Authorization: Bearer <key>`; `keyUserOf` (`apps/server/src/claude/keys.ts`) finds its person (not for a revoked key or a disabled person; a removed person's keys are deleted with them) and sets its last use; `auditKeyUse(key, designId, { tool })` writes the activity row.

The link's files (no session; a wrong or revoked token answers 404 "This link was revoked or does not exist."): `spec.json` (`application/json`), `design.md` and `HOW-TO-READ.md` (`text/markdown`), all `Cache-Control: no-store`. `?version=<name or id>` finds a version by its ID, else a named version by its name ignoring case (404 "This version was not found."); `?languages=en,fa` keeps those languages and the default one. spec.json and design.md are made exactly as the browser's export makes them (the same `mediaFiles` paths, `specChecks`, `exportedBy` "xDesign <version>"), from the stored Yjs state (`design_docs.state`, so changes of the last 2 to 10 seconds in open editors are not in it yet) or the version's state. The shared export helpers `mediaFiles` and `specChecks` moved from `apps/web/src/export/exportZip.ts` to `packages/spec/src/export/files.ts`; `toMarkdown` takes `picturesNote`. The server's export and its memory cache are `apps/server/src/claude/export.ts` (`exportOf`, `specJson`, `designMd`, `openQuestionsOf`, `parseLanguages`, `pictureKey`): per design and `doc_version` (a version per its ID), the plain design, its checks and the files made from it (per languages, pictures and open questions, the last 8); at most 16 exports, fewer when their states and files pass 64 MB together. The export time in the files is when the export was first made for that `doc_version`. design.md through the link lists the open comment threads as "Open questions" as the browser's export does (CMT-02), for the design as it is now; not for a `?version=`.

Pictures in design.md through the link are absolute addresses `https://<domain>/api/link/<token>/pictures/<step ID name>.<language>.png` (with the version's `?version=<id>` for a version). With an empty cache, or a cache newer than the version asked for, there are no picture lines and the summary ends with "- Pictures: export from xDesign to get them"; with an older cache the picture lines stay and the summary ends with "- Pictures are from version <n> (<ISO time>); the design changed since". `GET /api/link/<token>/pictures/<file>`: `<step ID name or bot-profile, empty-chat, commands-menu>.<language>.png`; the ID name is read in the design (or the `?version=`), so a renamed step keeps its picture. It answers `image/png` with `X-Xdesign-Picture-Version: <doc_version>`; a picture the cache has not answers 404 "This picture is not in the cache. Export the design from xDesign to make it." Picture cache upload: `POST /api/designs/:id/pictures` (Viewer and up, as everyone who can export), multipart with the fields `docVersion`, `language`, `look` (`^[\w-]{1,50}$`, the browser names it, for example "web-light") and one PNG file per picture whose field name is the step's ID or `bot-profile`, `empty-chat`, `commands-menu`. Each file is checked to be a PNG by its content, at most 10 MB each, 300 MB and 2000 files together; at least one. It answers `{ pictures: <count> }`. The upload replaces the design's whole set (the last browser export wins, whatever its `doc_version`). Picture storage (`apps/server/src/claude/pictures.ts`: `replacePictures`, `pictureSet`, `findPicture`, `pictureKind`, `pictureViews`): media rows of the kind `picture` (the file at `media/<2>/<sha256>` as every upload, deduplicated) and a `pictures` row each (primary key design, step, language); replaced sets delete their media rows and the files nothing else uses (`removeUnusedFiles`, split out of `deleteForever` in `apps/server/src/designs/trash.ts`). A duplicate does not copy them. Deleting a design forever deletes its links and picture rows (foreign keys) and the files. Activity (`apps/server/src/audit.ts` and `apps/web/src/settings/activityText.ts`): "Made a Claude link", "Revoked a Claude link" (detail `linkId`, `linkCreatedAt`); every fetch of spec.json, design.md and HOW-TO-READ.md through a link is a row by "A Claude link" with no person, "Read <file>" or "Read <file> of the version <version>" (detail `linkId`, `linkCreatedAt`, `file`, `version`, `languages`); picture fetches write one row ("Read pictures") per link in 10 minutes. "Made the API key <name>", "Revoked the API key <name>" (detail `keyId`, `name`); `api_key_used` reads "Used the API key <name> for <tool>" (detail `keyId`, `name`, `tool`). The link does not serve the uploaded media files that spec.json names (`media/<name>.<ext>`); the plan lists only spec.json, design.md, HOW-TO-READ.md and pictures.

**CL-02** (3559330).

The tools are `apps/server/src/claude/mcp.ts` (`mcpServer(key)`: `list_designs`, `get_spec`, `get_doc`, `get_how_to_read`, `get_step`, `list_checks`, `list_open_comments`, `get_picture`, with the server's instructions and the activity rows); the address is `apps/server/src/routes/mcp.ts`. `@modelcontextprotocol/sdk` 1.32.2: `McpServer` with the web-standard Streamable HTTP transport, without sessions, answering JSON (no SSE stream), one server per request. `GET` and `DELETE /mcp` answer 405 with `Allow: POST`. A request needs `Authorization: Bearer <key>` (`keyUserOf` of CL-01); a missing, wrong or revoked key, or a disabled person's, answers 401 `not_signed_in` "Send a working API key: Authorization: Bearer <key>." before the body is read. Cookies are never read. A request without an Origin header passes the Origin check; one with an Origin must have the site's (403 `bad_origin`). Every tool answers text: JSON (2-space indented) or Markdown (`get_doc`, `get_how_to_read`); a failure is a tool error with the message. A design the key's person cannot open, one in Trash and one that does not exist all answer "This design was not found." Steps, buttons and checks are named by ID names, as in spec.json. `designArrows(design)` (every arrow of design.md's map with its words) is in `packages/spec/src/markdown/map.ts`, exported from `packages/spec/src/index.ts`, for `get_step`.

`list_designs { search? }`: `{ designs: [{ id, name, owner, updatedAt, stepCount, languages }] }` (owner's name, ISO time, the default language first), not in Trash, last changed first, the search in the names ignoring case; the site owner gets every design. `get_spec { design, version?, languages? }`: spec.json exactly as the Claude link's (`version`: a version's ID or a named version's name; `languages`: a list of codes, the default always kept). `get_doc { design, version?, languages? }`: design.md as the link's, with the open questions for the current design (none for a version); its picture lines use the zip's paths `pictures/<step ID name>.<language>.png`, and when the cache is current the summary ends with "Pictures: get them with the get_picture tool (the step ID name and the language)" (the link's lines otherwise; `pictures.note` of `designMd` in `apps/server/src/claude/export.ts`). `get_how_to_read`: HOW-TO-READ.md. `get_step { design, step, version?, languages? }`: `{ design: { id, name, docVersion, versionName }, languages, step, comesFrom, goesTo }`; `step` is its spec.json entry (a step or a start point, by ID name; notes and sections are not steps); `comesFrom` and `goesTo` are `{ step, title, how }` per arrow (`step` an ID name, `back`, or null for a deleted step; `how` in design.md's words: `button "Menu" (btn_menu)`, `case "Adult"`, `then`). `list_checks { design, version? }`: `{ design, checks }`, spec.json's checks. `list_open_comments { design }`: `{ design, threads: [{ id, anchor, comments: [{ author, at, body }] }] }`, oldest first; `anchor` is `{ on: "step" | "button" | "text", step, title, button?, label?, language? }` (ID names, null for a step or button deleted since; `title` the step's when the thread started) or `{ on: "map", x, y }`. `get_picture { design, step, language?, version? }`: the step's ID name (or `bot-profile`, `empty-chat`, `commands-menu`) and a language (the default one without it); a text line "<step>.<language>.png, from version <n>" (with "; the design changed since" when older) and the PNG as an image; a picture not in the cache answers CL-01's "This picture is not in the cache. Export the design from xDesign to make it." Activity: every tool call writes `api_key_used` ("Used the API key <name> for <tool>") with its design (none for `list_designs` and `get_how_to_read`), detail `keyId`, `name`, `tool`, and `version` and `languages` when asked; `get_picture` writes one row per key and design in 10 minutes. Connecting, listing the tools and notifications write none (the key's last use is still set).

**CL-03** (413c28f).

The Share dialog's "Claude link" is `apps/web/src/designs/ClaudeLinksSection.tsx`, under "View-only link" in `apps/web/src/designs/ShareDialog.tsx`; the Account page's "API keys" is `ApiKeys` in `apps/web/src/routes/_app/account.tsx` (it reuses `ShownLink` and maintenance's `CodeLine`); the picture cache upload and "Refresh pictures for Claude" are `apps/web/src/export/pictureCache.ts` (`uploadPictures`, `cachePictures`, `refreshPictures`), with the step's ID on each step picture (`Picture.stepId` in `apps/web/src/export/pictures.tsx`), `buildExport` also answering the pictures it made (`apps/web/src/export/exportZip.ts`) and the export dialog sending them (`apps/web/src/export/ExportDialog.tsx`); "Refresh pictures for Claude" sits in the editor's "..." (`apps/web/src/editor/topbar/MoreMenu.tsx`) and the cards' menu (`apps/web/src/designs/DesignCard.tsx`, action `refreshPictures` in `apps/web/src/routes/_app/index.tsx`).

The Share dialog (design owner and site owner) has "Claude link" under "View-only link": the sentence "Anyone with this link can read this design. Give it to a developer or to Claude: 'Build the bot described at <link>'." (with the new link's spec.json address in place of `<link>` once one is made), "Create link", which shows the three addresses (spec.json, design.md, HOW-TO-READ.md) once, each in a field with "Copy", with "The link is shown only now. Add `?version=<name or id>` for a version, `?languages=en,fa` for some languages."; below, the links that work, newest first, each "Made <time ago> by <name>" and "Last used <time ago>" or "Not used yet", and "Revoke" (at once, no question, as view-only links). The Account page ends with "API keys" ("A key reads every design you can open and never changes them."): "Name" (placeholder "Claude Code on my laptop") and "Create key", the key shown once with "Copy" and "The key is shown only now."; the keys that work with "Made <time ago> · Last used <time ago>" (or "Not used yet") and "Revoke"; then "In Claude Code run:" with `claude mcp add --transport http xdesign <site address>/mcp --header "Authorization: Bearer <key>"` and "Copy" (the key just made fills `<key>`), and "Other MCP clients: add the server <site address>/mcp (Streamable HTTP) with the header Authorization: Bearer <key>.". The site address is the browser's own (`window.location.origin`). An export of now with pictures (the dialog's "Version" on "Now", by a person with a session) sends the default language's pictures it made, in the chosen look (named `<look>-<theme>`, for example "web-light"), to the picture cache after the zip downloads, in the background with the export's document version; only a failure shows ("The pictures for Claude were not uploaded. <reason>"). An export of a version from history, an export with "No pictures" and the export on a view link's page send nothing. "Refresh pictures for Claude" (everyone with access, in the editor's "..." and on the Designs cards) reads the design's document version, then the design as it is now (the editor's live document, also while a version is open, or the design's live document opened once from a card), makes the default language's pictures in the person's phone look (the editor's look, on the cards the one last chosen in the editor in this browser) and sends them; a toast counts "Making pictures 12 of 40", then "Uploading the pictures for Claude", with "Cancel", and ends with "Refreshed the pictures of <name> for Claude." or "The pictures for Claude were not refreshed. <reason>". A second click on the same design while it runs does nothing. The editor README has a CL-03 entry.
