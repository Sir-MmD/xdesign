# 18. The owner's third list of 2026-11-23 (M14, M15, M16)

The owner's third list, after they used xDesign on their server with a big design: usernames
instead of emails, the site owner making accounts and setting passwords, a big design that takes
minutes to open, a map whose lines cannot be told apart, Activity in pages, the HTTPS card in
xmtp-panel's look, a Windows server and a desktop app, and `build.sh` asking the platform.
Planned on 2026-11-23 from the owner's words, seven rounds of answers (Q-54 to Q-81) and a
measurement of the slow design on this computer; built as M14, M15 and M16 (14) only on the
owner's "start".

## 1. The owner's words

> - remove email. we go with username isntead
> - owner can set and change password of others
> - owner can create permanent user
> - when designs is big it takes some minutes to get open!
> - i beilive the design visual or method we are using to show relation and boxes and lines fails on design with big parametered and we dont know which is which.
> - the activity should be page like and its list shouldnt be unlimited!
> - the ssl manager design is bad. use xmtp-panel ssl manager instead
> - add windows build support to build.sh (platform should be asked)
> - we need a version where its a local app on a desktop pc. it opens like a app

## 2. Questions and answers

| ID | Question (short) | The owner's answer | Decision |
|---|---|---|---|
| Q-54 | Usernames: a username to sign in and a Name others see, or one username for both? | "Username + Name": like xWriter. | D-729, D-730 |
| Q-55 | What username does an account that exists today get? | "Made from their Name" ("MmD" becomes "mmd", a number on a clash; the owner can change it later). | D-731 |
| Q-56 | The site owner sets another person's password: they keep it, must change it, or a temporary one? | "You type it, they keep it": the owner types it or presses Generate; the person is signed out everywhere and signs in with it from then on. | D-733 |
| Q-57 | "Create permanent user": add directly, add and remove invites, or permanent and temporary accounts? | "add directly. remove the invite": an "Add member" button with username, name and password; invite links go away. | D-734 |
| Q-58 | What shows while the big design opens? | "Loading view for minutes", then the map works normally. | (context) |
| Q-59 | Where and how often? | "On the server, every time". | (context) |
| Q-60 | The map's lines: highlight and names (A), short jump tags (B), both, or a list view? | "A + B together": selecting a step highlights its lines with names and fades the rest; far lines and lines into a step many go to become short tags that jump there; a busy step shows "N come here". | D-738, D-739, D-740 |
| Q-61 | Activity "page like": its own page or page numbers in Settings? | "Page numbers, stays in Settings": Previous, 1 2 3 ... Next in place of "Load more". | D-742 |
| Q-62 | May the lead measure the slow open in the owner's Chrome? | "Yes, measure it now" (the Chrome extension was not connected; Q-66). | (context) |
| Q-63 | HTTPS: xmtp-panel's whole SSL page (a list of certificates), or one certificate in its look? | "Same look, one certificate": the site keeps one certificate; the card is redesigned in xmtp-panel's look (its Issue window with method cards, the expiry bar, the status pill). | D-744 |
| Q-64 | Should the server keep fewer Activity rows (1 year today)? | "Keep 1 year, as today": the pages stop the endless list. | D-743 |
| Q-65 | The installer and the owner's username? | "Ask it, \"owner\" as default": "Owner username [owner]:" and "Owner name:". | D-736 |
| Q-66 | How to find the cause of the slow open without the extension? | "Copy it here and measure": a production build on this computer with a copy of the design, timed in a hidden Chrome (section 4). | D-737 |
| Q-67 | The desktop app: own designs offline, a window for the server, or both? | "Own designs, offline": one person, no sign-in, designs saved on the PC, no internet needed; designs move with Export and Import. | D-751 |
| Q-68 | Its window: an app window through Edge or Chrome, or a fully built-in window? | "Fully built-in window" (Electron). | D-752 |
| Q-69 | The Windows build: the desktop app only, or also a Windows server? | "Desktop app + Windows server". | D-746 |
| Q-70 | Keep "Make a password reset link"? | "Remove it": "Set password" replaces it. | D-735 |
| Q-71 | Who changes usernames? | "Only the site owner": on Members, and their own on the Account page; everyone still changes their own Name. | D-732 |
| Q-72 | Which ways should the new HTTPS card offer? | All four: Let's Encrypt over port 80, Let's Encrypt through Cloudflare (with xmtp-panel's Wildcard), Upload a certificate (paste, load file, drop), Files on this server; the built-in certificate stays as the fallback. | D-745 |
| Q-73 | Which computers should the desktop app run on? | "Windows, Linux, macOS". | D-754 |
| Q-74 | The Windows desktop file: a setup file or one portable .exe? | "One portable .exe". | D-754 |
| Q-75 | Besides the editor, Try it, Checks, Export, Import, Print and templates, what should the desktop app have? | All four offered: the Claude Code connection, version history, backups (with a daily one), comments. | D-753 |
| Q-76 | How much of the Linux server should the Windows server have? | "Everything Linux has": install, a service, the firewall, HTTPS in all its ways, the random port and secret path, backups, updates and going back from Maintenance, the commands. | D-746 |
| Q-77 | Is there a Mac to build the Mac app on? | "No, build it here": an unsigned Mac app made on Linux; it may need extra steps the first time and may not open on newer Macs. | D-754, R-345 |
| Q-78 | Which CPUs for the new files? | "x64 and ARM": amd64 and arm64 for every platform. | D-746, D-754 |
| Q-79 | Which Windows versions for the server? | "Server 2019, 2022, 2025 + Windows 10 and 11". | D-746 |
| Q-80 | A switch to see all lines again? | "Yes, a switch": "Short tags" (the default) or "All lines", remembered for the person. | D-741 |
| Q-81 | `build.sh`'s platform menu? | "Server or desktop first": what to build, then the server's systems, then the desktop's, then the CPUs. | D-756 |

The items needed no other questions: Activity's filters stay; the HTTPS card's domain change
stays where it is (17 section 14); Settings, Maintenance and the rest of the website stay as they
are.

## 3. Usernames instead of emails (USER-01a, USER-01b, USER-02, USER-03)

### 3.1 The username

- Every person has a **username** to sign in and a **Name** the others see (Q-54), as in xWriter.
  The email is gone from the whole site: the database, the sign-in, the Members page, the Account
  page, the Share dialog, the comments, Activity, the installer and the commands. xDesign never
  sent emails, so nothing else changes.
- The rules (D-730), from xWriter: 3 to 32 characters; lower-case letters a to z, digits, dots,
  underscores and hyphens; it starts with a letter or a digit; unique on the site ignoring case;
  kept in lower case (what a person types in capitals is lowered). The hint under every username
  field: "Letters, digits, dots, underscores and hyphens." Problems: "A username has 3 to 32
  characters.", "Use letters a to z, digits, dots, underscores and hyphens, starting with a letter
  or a digit.", "Someone on this site already uses this username."
- Only the site owner changes usernames (Q-71): any member's on the Members page and their own on
  the Account page. Everyone changes their own Name on the Account page, as today.

### 3.2 The accounts that exist (the update)

- The update's migration adds `users.username` (unique, lower case), removes `users.email` and its
  index, and drops the tables `invites` and `password_resets` (D-734, D-735).
- Each existing account gets a username **made from its Name** (Q-55, D-731), once, at the first
  start of the new version, before the server answers: the Name in lower case; letters a to z and
  digits kept; spaces and the characters `.`, `_` and `-` become one dot; every other character is
  dropped (so a Persian Name gives nothing); dots at the start and end removed; cut to 32
  characters. A result shorter than 3 characters becomes "user". A username taken by an earlier
  account gets the first free number added: "mmd", "mmd2", "mmd3" (cut so it stays within 32).
  Accounts are taken oldest first, so the site owner, the first account, keeps the plain name.
- Activity gets one row per account: "Gave <name> the username <username>" (action
  `username_given`, by nobody). The site owner sees every username on the Members page and
  changes any that came out wrong (R-338).
- Sessions, API keys, connected apps, two-factor and recovery codes keep working; nobody is signed
  out by the update. An authenticator app keeps its old label with the email; its codes keep
  working (the label is only a name).

### 3.3 Signing in

- The sign-in page asks "Username" (with `autocomplete="username"`, no `type="email"`) and
  "Password"; "Sign in". A wrong one: "Username or password is wrong." The limits stay (5 failed
  tries in 15 minutes per address and per username); the text "Too many tries. Wait 15 minutes or
  ask the site owner to set a new password." The two-factor step is unchanged.
- The username is matched ignoring case and surrounding spaces. Failed sign-ins keep the typed
  username in Activity's detail (`username`), "Failed sign-in as <username>".
- The authenticator label for a new two-factor setup: `xDesign (<domain>):<username>`.

### 3.4 Members: Add member, Set password, Change username

The Members page (site owner) loses "Invite", the invite list and "Make a password reset link"
(Q-57, Q-70). It gains:

- **"Add member"** (the page's main button, where "Invite" was). The dialog "Add member", text
  "They sign in with this username and password. Give them both yourself.", fields "Username"
  (with the hint), "Name" and "Password". The password field has "Generate" (fills a new random
  password of 20 characters and shows it), an eye to show or hide it, and "Copy". The password
  follows the site's rules (at least 10 characters, not a common one). Buttons "Cancel" and "Add
  member", after "Confirm it's you" (action "Adding a member"). The account works at once and
  never expires (Q-57). Toast "Added <name>." Activity "Added <name> as <username>"
  (`member_added`).
- A member's menu: **"Set password"**: dialog "Set the password of <name>", text "<name> is signed
  out everywhere and signs in with the new password from now on.", field "New password" with
  "Generate", the eye and "Copy"; buttons "Cancel" and "Set password", after "Confirm it's you"
  (action "Setting a password"). The person keeps it (Q-56); they change it on their Account page
  when they like. Their sessions, live connections and open editors end, as "Disable" ends them;
  their API keys and connected apps stay. Toast "Set the password of <name>." Activity "Set the
  password of <name>" (`password_set`). The site owner's own row says "Change your password on the
  Account page" in place of the item.
- A member's menu: **"Change username"**: dialog "Change the username of <name>", text "They sign
  in with the new username from now on; their password stays.", field "Username"; buttons
  "Cancel" and "Change". No "Confirm it's you"; nobody is signed out. Activity "Changed the
  username of <name> from <old> to <new>" (`username_changed`).
- Rows show the Name and, under it, "@<username>" where the email was; the search on the page
  matches the name or the username.
- "Disable", "Enable", "Turn off two-factor authentication" and "Remove" stay as they are.

Old links: `/invite/<token>` shows "Invite links no longer work. Ask the site owner for an
account." and `/reset/<token>` shows "Password reset links no longer work. Ask the site owner to
set a new password.", each with "Go to sign in". Activity's old invite and reset rows keep their
words (their detail may hold an email; it is shown as stored).

### 3.5 The Account page

- "Username": for the site owner an editable field ("Save"), for everyone else read-only with the
  hint "Only the site owner changes usernames." "Name" stays editable for everyone.
- "Change password" stays as it is (current password, new password); the password manager hint
  uses the username.
- The top bar's person menu shows the Name and "@<username>" (in place of the email).

### 3.6 Elsewhere on the site

- The Share dialog's search: placeholder "Name or username", results "Name · @username".
- The comment mention picker: the Name with "@username" on the right.
- A design's "People with access": `{ id, name, username, role }`.
- The API (`packages/api`): every `email` becomes `username`; new routes `addMember` (`POST
  /api/members`), `setMemberPassword` (`PUT /api/members/:userId/password`), `changeUsername`
  (`PUT /api/members/:userId/username`); `PATCH /api/me` takes `username` from the site owner
  only; the invite and reset routes are removed. Each new route has its summary, area and marks in
  the action list (17 section 13.4): `addMember` change, `setMemberPassword` change and asks
  first (it cannot be undone), `changeUsername` change; the guide for AIs (`xdesign://guide`)
  says how members are added now, and Claude acts with the person's role as before.
- The MCP answers and `design.md` already name people by Name; nothing else changes there.

### 3.7 The installer and the commands (USER-03)

- The installer asks ":: Owner username [owner]:" (Enter takes "owner"; the rules of 3.1, asked
  again with the problem's words) and ":: Owner name:" (Q-65, D-736). The flags
  `--owner-username NAME` (default `owner` with `--yes`) and `--owner-name NAME` replace
  `--owner-email`. The end block's line "Email:" becomes "Username: owner".
- The app's command `init-owner --username <username> --name <name>`.
- `xdesign admin reset-password <username>`, `xdesign admin reset-2fa <username> [--yes]` and
  `xdesign admin list-users` (columns Username, Name, Role, Status, Last seen) take and show
  usernames.

## 4. A big design takes minutes to open, a bug (PERF-01)

**What the owner saw (Q-58, Q-59).** On their server, opening the big design shows the loading view
for minutes, every time, then the map works normally. Smaller designs open fast.

**The design.** 146 steps (113 steps and 33 starts), 10 sections, 109 buttons, 219 lines, 58
variables, one language; its spec.json is 229 KB. That is within the plan's target of 300 steps
with the first paint under 3 seconds (02 section 9), so the slowness is a bug.

**The measurement (Q-66).** A production build (`apps/server/dist`, the SPA built by Vite) ran on
this computer with a copy of the design imported from its spec.json, opened in headless Chromium
and timed through the Chrome DevTools protocol, with a CPU profile and counters in an unminified
build (the script and the copy are kept in `.dev/m14/perf/`):

- The first box shows after 1.4 to 3.5 seconds; then **one task blocks the page for 19 to 37
  seconds** on this fast desktop (three runs). On a slower computer that is minutes, during which
  the page cannot even paint.
- The task is one synchronous React render (`performSyncWorkOnRoot`): React's own work, Base UI's
  menu roots and positioners (`MenuRoot`, `MenuTrigger`, `usePositioner`), dialog roots, buttons
  and icons.
- Counters: **23,045 renders of a box (`BoxShell`) for 146 boxes**, about 158 each, and 38,567
  calls of `useRemeasure`. The loading, the Yjs document and the spec package are fast (all of
  `packages/spec` on this design takes under 150 ms: reading, checks, arrows, `design.md`).

**Cause.** The map redraws every box each time any one box is measured: each box asks React Flow
to measure its dots again on mount (`useRemeasure` calling `updateNodeInternals` for its own id),
each measurement updates the map's state (`setMeasured`, then `buildNodes` makes every node
again), and every box re-renders, with its "..." menu and note dialog mounted even while closed.
So the work grows with the square of the number of boxes: 146 boxes x 158 renders.

**Fix (PERF-01, D-737).**

1. A box renders again only when its own step, selection, measured size, look or role changed:
   `buildNodes` keeps the same node object for a step that did not change, the box components are
   memoized, and a box reads the parts of the design it needs (its step, the parts it uses) in
   place of the whole design from `useDesign()`.
2. Measuring is batched: the boxes that need their dots measured again are collected and React
   Flow is asked once per frame (`updateNodeInternals` with the list of ids); a box does not ask on
   its first mount (React Flow measures new nodes itself); `setMeasured` changes the state only
   when a size really changed.
3. The box's "..." menu and its note dialog are mounted only from the first time the person opens
   them; until then the box draws only the button. The same for any other menu or dialog root that
   each box mounts while closed (comment pins, check badges).
4. Whatever else the profile names as running per box on open is moved out of the per-box path
   the same way.

**Target.** The big design opens with at most 3 renders per box (under 450 `BoxShell` renders), no
task over 1 second on this computer, and the map usable within 3 seconds of the page starting to
load (02 section 9). The lead measures after the merge with `.dev/m14/perf/open.mjs` (the same
production build and copy); if the target is missed, the profile goes into a follow-up brief.

## 5. Lines on a big map (MAP-10, MAP-11)

**What the owner saw (Q-60).** On the big design the lines between boxes cannot be told apart: one
dev step has 8 outcome lines, "Main menu" has 29 lines coming in from all over a map 13,000 pixels
tall, 26 lines run more than 5,000 pixels, and a line carries no name, so nobody can say which
line belongs to which button.

### 5.1 Selecting a step shows its lines with names (MAP-10, D-738)

- When a step is selected (a click on its box), every line out of it and into it is drawn **bold
  in the brand color**, each with a **label** at its middle: a button's text (up to 24 characters,
  then "..."), an outcome's or a case's name ("card in use", "Otherwise"), "Then", "Valid answer",
  "Wrong 3 times", "Cancel" as the dots say. A line into the step carries the label of the button
  or outcome it comes from. Labels sit on a small pill with the map's background so lines under
  them do not cross the text.
- Every other box and line **fades** (about 30% strength) while a step is selected; clicking the
  empty map ends it. With several steps selected, all their lines show this way.
- Hovering a dot or a button row draws that one line bold with its label, and outlines its target
  box, also with nothing selected. Hovering a line shows its label.
- Lines keep their kinds: a Go to box's line stays dashed; a button's click mode ("Edit", "New",
  "Replace") and the popup bell stay on the label.
- A view-only link and Try it's map behave the same (they only read).

### 5.2 Short tags for far lines (MAP-11, D-739, D-740)

- In the "Short tags" view (5.3, the default), a line is drawn as a **tag** at its dot instead of
  a line across the map when:
  - its target is in another section than its source, or
  - its target has 5 or more lines coming in (a hub such as "Main menu"), or
  - its dot and its target are more than 1,600 map pixels apart.
- The tag is a small pill beside the dot: an arrow icon and the target's title (up to 20
  characters, then "..."), for example "⤴ Main menu", in the line's color. Its tooltip says "Goes to
  <title>" and, when the target is in another section, "(<section>)". Clicking it jumps: the map
  moves and zooms to the target box (as search does) and selects it. A "Back" button then shows in
  the map's tools and returns to where the person was (the last 10 places; it goes when the person
  moves the map themselves).
- A box that has any line in drawn as a tag shows a pill in its header: "<N> come here" (N counts
  every line in, tags and lines). Clicking it opens a list "Comes here from" with one row per line
  in: the source step's title and the button's or outcome's label, for example "Invite friends ·
  Back to menu"; clicking a row jumps to that step and selects it.
- While a step is selected (5.1), its lines are drawn in full, tags included, bold with their
  labels, so its whole structure shows when needed; the tags come back when it is no longer
  selected.
- Drawing a line or reconnecting its end works as today; a new line that meets the rules shows as
  a tag as soon as it is made.
- Only the map changes: the export, `design.md`'s Mermaid map, the checks and Try it are the same.
  Auto-arrange still uses every line.

### 5.3 The Lines switch (MAP-11, D-741)

- In the map's tools, beside Auto-arrange: a two-way switch "Lines: Short tags | All lines" (Q-80).
  "All lines" draws every line as today (with 5.1's highlight and labels).
- The choice is saved for the person on the server (`users.map_lines`, `short` by default) and
  follows them to every device, as the theme does (17 section 8); `PATCH /api/me` takes it. A
  view-only link's page starts with "Short tags" and keeps a change only while open.

## 6. Activity in pages (ACT-01, D-742, D-743)

- Settings > Activity stays where it is with its filters (person, design) (Q-61). "Load more" goes;
  under the list comes xWriter's pager (its `PagerBar`, `docs/plan/28` of xWriter section 11.3):
  "Rows per page" (10, 25, 50 or 100; 25 to start, kept in this browser), "Rows 26 to 50 of 312",
  then "Previous", the page numbers with the open one marked (1 2 3 ... 13) and "Next". Under 640
  pixels wide, "Previous" and "Next" keep only their arrows.
- The open page is in the address (`?page=3`), so a reload or a link keeps it; Back returns to the
  page before. Changing a filter or the rows per page goes back to page 1. A page past the end
  opens the last page.
- The server: `GET /api/activity` takes `page` (from 1) and `size` (10, 25, 50 or 100) with the
  filters and answers `{ entries, total }`, newest first; `before` and `beforeId` go. The MCP
  action `activity` takes `page` and `size` the same way.
- Rows are still kept 1 year (Q-64).

## 7. The HTTPS card in xmtp-panel's look (SSL-03, SSL-04)

**What stays (Q-63).** The site serves one certificate; xDesign gets and renews it as today
(17 sections 3 to 5); Settings > HTTPS stays a card in Settings, with its domain part ("Domain",
"Change the domain") below as it is. What changes is the look and the windows, copied from
xmtp-panel's SSL manager (`web/src/pages/Certificates.tsx`, `certificates/CertTable.tsx`,
`certificates/IssueWindow.tsx`, `web/src/components/UploadCertDialog.tsx`,
`certificates/facts.ts`, `web/src/api/certs.ts` and `web/src/lib/states.ts` in
`/mnt/files/work/xmtp-panel`), restyled with xDesign's components (Card, Badge, Dialog,
ConfirmDialog).

### 7.1 The card

- Title "HTTPS", text "The certificate the site serves. xDesign renews Let's Encrypt certificates
  by itself." Buttons at the top right: "Upload certificate" (outline) and "Issue certificate"
  (primary).
- One certificate row in xmtp-panel's table look (a card under 1024 pixels):
  - "Domain": the first name, then "+N" with "Show all N names".
  - "Method · issuer": a chip "HTTP-01", "Cloudflare DNS-01", "Wildcard", "Uploaded", "Files on this
    server" or "Built-in"; under it the issuer ("Let's Encrypt", or the certificate's issuer), and
    for a self-signed one the warning chip "Self-signed" with the title "Browsers do not trust a
    self-signed certificate".
  - "Expires": xmtp-panel's bar (the share of the certificate's life that is left) with "62 days",
    "Expires today", "Expired 3 days ago", or hours on the last day.
  - "Status": xmtp-panel's pill: "Valid", "Issuing", "Renewing", "Renewal failing", "Issuance
    failing", "Expires soon" (an uploaded or file certificate with 30 days or fewer), "Expired",
    "Files unreadable"; the note under it: "Renews from <date>", "Next attempt <date>", "Not
    auto-renewed" or "Upload a renewed certificate".
  - Actions (icon buttons with titles): "Renew now" (a working Let's Encrypt certificate; it asks
    as today, 17 section 4), "Try now" (a Let's Encrypt or file method with a problem), "Replace"
    (an uploaded one; opens the Upload window to replace it), "Remove certificate" (any but the
    built-in).
- A row with a problem shows "Last error: <first line>" as a toggle that opens the whole text and
  the log (the last 8 lines, as today's log). While issuing or renewing the card reads the state
  every 2 seconds as today.
- "The certificate is not for <domain>" stays, with its button now "Issue certificate for
  <domain>", which opens the Issue window on HTTP-01 (or Cloudflare when a token is saved).
- No stat tiles: with one certificate the pill says it.

### 7.2 The Issue window

xmtp-panel's Issue window as a dialog with three sections, without its "This panel itself" switch
and its nodes:

- "Names": "Domain" (the site's domain to start); under it "Certificate will be issued for
  <names>" ("*.example.com and example.com" for Wildcard). An IP address is refused: "Let's
  Encrypt needs a domain name."
- "Method", "How Let's Encrypt checks that the name is yours.", three cards:
  - "HTTP-01": "A certificate for this name through port 80. No Cloudflare token needed."
  - "Cloudflare DNS-01": "A certificate for this name through a Cloudflare TXT record. Port 80 can
    stay closed."
  - "Wildcard": "One certificate for the domain and every name one level under it, through
    Cloudflare DNS."
  For the two Cloudflare cards: "Cloudflare API token" (hint "Needs Zone:Read and DNS:Edit on the
  zone. Stored write-only.", placeholder "paste token"; with a saved token "A token is saved:
  leave empty to keep it") and xmtp-panel's collapsible "How to create a Cloudflare API token".
  HTTP-01 with port 80 in use fails at the helper's own port 80 check, before Let's Encrypt is
  asked, and the Result shows the helper's reason ("Another program on this server uses port 80.
  Stop it, or use Cloudflare or certificate files.").
- "Result": while running "Requesting the certificate" and "Let's Encrypt checks the name now.
  This can take a few minutes." with the log lines as they come; then "Certificate issued for
  <name>. Auto-renewal is on." or "The certificate was not issued", the reason and "Fix the cause,
  then issue it again."
- Buttons "Cancel", "Issue certificate" (busy "Requesting..."), then "Done". "Issue certificate"
  asks "Confirm it's you" first (action "Changing HTTPS"), as today's Save. The site keeps its
  current certificate until the new one is issued.

### 7.3 The Upload window

- Title "Upload a certificate" ("Replace the certificate" from "Replace"), text "A certificate you
  got elsewhere, with its private key. xDesign serves it and does not renew it."
- Two tabs:
  - "Paste or load file": "Certificate (PEM, full chain)" and "Private key (PEM)", each a text area
    with "Load file..." and dropping a file on it (xmtp-panel's); the key's hint "Unencrypted (no
    passphrase)."; a key pasted into the certificate's field is taken from there; a .pfx, .p12 or
    .der file gets xmtp-panel's message that it holds no PEM block.
  - "Files on this server": "Certificate chain (full chain)" and "Private key" as paths, with
    today's hint "The xdesign user must be able to read both files." and "xDesign reads them again
    every minute, so a renewal by certbot is picked up."
- Buttons "Cancel" and "Upload certificate" ("Use these files" on the second tab), after "Confirm
  it's you". Results in xmtp-panel's words: "Certificate stored" (or "Certificate stored,
  replacing the earlier upload"), "One certificate of the bundle was left out" ("N certificates of
  the bundle were left out"), the "Self-signed" warning, "It does not cover <domain>", and the
  refusal "The certificate was not stored" with its reason.

### 7.4 Remove

"Remove certificate" asks "Remove the certificate?" with "The site goes back to its built-in
certificate, which browsers warn about. A Let's Encrypt certificate stops renewing." and "Remove",
after "Confirm it's you"; it chooses the built-in method (`PUT /api/https` with `builtin`). Toast
"Certificate removed. The site serves its built-in certificate."

### 7.5 The helper and the API (SSL-04)

- Wildcard: the Cloudflare method with the names `*.<domain>` and `<domain>` issues for
  `*.<domain>` and `<domain>` through DNS-01 (lego's DNS-01 does both names in one order), and
  "covers the domain" knows a wildcard covers one level. No `wildcard` field was added (D-806).
- The HTTPS view adds what the card shows that it lacks today: the issuer, `selfSigned` and the
  certificate's `notBefore` (for the bar); whether an upload replaced an earlier one is known in
  the Upload window from the method before it.
- `PUT /api/https`, `POST /api/https/certificate` and their helper calls keep their routes; the
  route schemas gain the new view fields; the action list's summaries follow.

## 8. The Windows server (M15: WIN-01 to WIN-07)

### 8.1 What it is (Q-69, Q-76, Q-78, Q-79, D-746)

The same xDesign server for Windows: the same single file (`xdesign-<version>-windows-<cpu>.exe`)
with the same website inside, installed with `xdesign.exe --install` in a terminal opened as
Administrator, with everything the Linux server has: a service that starts with Windows, the
firewall rule, HTTPS in all its ways, the random port and secret path, backups (daily and by hand),
updates and going back from Maintenance and from the command line, the update guard, `status`,
the `admin` commands and `--uninstall`. Supported: Windows Server 2019, 2022 and 2025, Windows 10
(1809 or later) and Windows 11, 64-bit, on amd64 and arm64. Everything the website shows is the
same as on Linux; the differences are under the hood and in the commands' words.

### 8.2 How it runs (D-747)

```
 internet --> :<site port> (and :80 for Let's Encrypt checks)
   xdesign.exe serve (service "xdesign",                  node.exe app\server.mjs (child, same account)
   account NT SERVICE\xdesign)                            +---------------------------+
   +------------------------------+  TCP 127.0.0.1:<r1>   | Fastify /api, Hocuspocus  |
   | HTTPS front, SSL manager,    | -- + proxy secret --> | /live, /mcp, the SPA      |
   | port-80 answers, proxy,      |                       |                           |
   | starts and watches the child | <-- TCP 127.0.0.1:<r2>| calls the helper for      |
   | control server               |     + control secret  | HTTPS, backups, updates   |
   +------------------------------+                       +---------------------------+
   C:\ProgramData\xDesign\maintenance\request.json, then the service "xdesign-maintenance"
   (LocalSystem, started on demand) runs xdesign.exe admin maintenance --request
```

- Program files: `C:\Program Files\xDesign\releases\<version>\` (`xdesign.exe`, `runtime\node.exe`,
  `app\`) and `C:\Program Files\xDesign\current`, a directory junction to the running release (the
  Linux `current` symlink). Data: `C:\ProgramData\xDesign\` with `config.toml`, `install.json`,
  `data\` (the database, the media and `certs\`), `backups\`, `maintenance\`, `update-failures\` and
  `logs\`. The folder's permissions: SYSTEM and Administrators full control, the service account
  `NT SERVICE\xdesign` modify on everything but `config.toml` and `install.json` (read), nobody
  else.
- As built (WIN-04a): the service account is named by its SID
  (`S-1-5-80-2098923330-2051758124-151170182-548055611-3226271214`), so the installer sets the
  permissions before the service exists; `C:\ProgramData\xDesign` gives it modify on the folder
  itself, read on the files in it and, through CREATOR OWNER, modify on what it makes there
  (`control.json`); `data\`, `backups\`, `maintenance\`, `update-failures\` and `logs\` give it
  modify on everything inside; `install.log` is for SYSTEM and Administrators only.
- The service `xdesign` (display name "xDesign", automatic start, delayed) runs
  `"C:\Program Files\xDesign\current\xdesign.exe" serve --config C:\ProgramData\xDesign\config.toml`
  as the virtual account `NT SERVICE\xdesign` (no password, no sign-in, only what it is given),
  restarted by Windows after a crash (5 seconds, three times, then every 60 seconds). Windows has
  no privileged ports, so ports 80 and 443 need no capability.
- The app channel: Windows has no Unix sockets that both Go and Node use, so at each start the
  helper picks two free loopback ports and two random 32-byte secrets and gives them to the child
  (`XD_PORT` on 127.0.0.1, `XD_PROXY_SECRET`, `XD_CONTROL_URL`, `XD_CONTROL_SECRET`). The front
  adds the header `X-Xdesign-Proxy: <secret>` to every proxied request; the app answers 403 with an
  empty body without it, and trusts `X-Forwarded-For` and `X-Forwarded-Proto` only then (as on the
  Unix socket today). The app calls the control server with `Authorization: Bearer <secret>`; the
  helper refuses anything else. Neither port is opened in the firewall; both listen on 127.0.0.1
  only.
- The child runs in a Windows job object, so it ends with the helper. To stop it, the helper
  closes the child's standard input; the app (when `XD_STOP_ON_STDIN=1`) closes its connections
  and the database and exits; after 10 seconds the job object ends it. Restarts with backoff and
  the health poll are the same as on Linux.
- Logs: the helper writes its own lines and the child's output to
  `C:\ProgramData\xDesign\logs\xdesign.log` (a new file at 10 MB, 5 kept); `xdesign logs [-f]
  [--lines N]` shows them (on Linux it says to use `journalctl -u xdesign`).
- The daily backup runs inside `serve` at 03:30 server time (no scheduled task) (D-749); the
  backups themselves are the same archives as on Linux (8.5).

As built (WIN-02): the app's channel on Windows is in place in the helper and the server. The
control server's port and secret are chosen once per `xdesign serve` (it listens on 127.0.0.1:0 and
keeps the listener); the app's port and proxy secret at each start of the app (the front listens on
port 0 and closes just before the start; if the app cannot listen, the start fails and the next one
picks again). `serve` writes the control server's address and secret to
`C:\ProgramData\xDesign\control.json` (`{"url":"http://127.0.0.1:<port>","secret":"<64 hex>"}`;
`.dev\run\control.json` for `--dev`) for the installer and `xdesign status`, and removes it at its
stop; the file takes the folder's permissions. The control server answers 401 with `{"error": "the
control secret is missing or wrong"}`. The app refuses a request without the proxy header with 403
and an empty body in its first `onRequest` hook and in the live upgrade handler, and drops its
X-Forwarded headers; the session cookie is Secure and the X-Forwarded headers are trusted behind the
front (its socket or its proxy secret). The front removes an incoming `X-Xdesign-Proxy` header on
both systems. The child is put in its job object right after its start; after 10 seconds the process
is ended (the same timer as Linux's SIGKILL), and closing the job then ends anything left in it.
`internal/controlclient` is the client of the control server for the helper's commands on both
systems.

As built (WIN-03): `xdesign serve` asks Windows whether the service manager started it
(`svc.IsWindowsService`). As the service `xdesign` it reports Start pending, runs `serve`, and
reports Running once the front's listener is open; it accepts Stop and Shutdown, at either reports
Stop pending (wait hint 30 seconds, systemd's `TimeoutStopSec`) and ends `serve`, which lets the
requests in flight finish (5 seconds), stops the app (its standard input closed, its job object
after 10 seconds) and closes the control server. A `serve` that ends with an error ends the service
with the service-specific exit code 1. Only the service manager stops it: the console events Go
turns into SIGTERM (a user signing out of the server) are ignored. From a console it runs as on
Linux, its lines and the app's output on stderr. The service writes the helper's lines (the JSON
lines of the journal) and the app's standard output and error to
`C:\ProgramData\xDesign\logs\xdesign.log`, each line with its local time in front
(`2026-11-23T03:30:00.123+03:30 ...`, journalctl's short-iso-precise), through a writer per source
so their lines never mix; a line longer than 64 KiB is cut; a line the file does not take is lost so
the app never waits on its output; the process's fatal errors and unhandled panics go to the file
too (`debug.SetCrashOutput`). When the next line would pass 10 MB the file is renamed to
`xdesign.log.0` first (if another program holds it without sharing its renaming, nothing moves and
the lines go on in the same file for a minute before the next try), then `.4` to `.5` (replacing the
oldest) down to `.0` to `.1`, and a new file starts. Without its log file (the folder cannot be
written) the service still runs. `xdesign logs [-f] [--lines N]` (Administrator) prints the last N
lines (default 100, 0 allowed), from the older files too when the current one has fewer; with `-f`
it looks every half second, reads the old file to its end when a new one started and goes on with
the new one from its start; its files are opened sharing their renaming, so it never stops a
rotation. On Linux it prints "Use journalctl -u xdesign (add -f to follow)." and exits 0. The daily
backup runs inside `serve` on Windows outside `--dev` (also when `serve` runs from a console with
`--config`), with the rule of `xdesign-backup.timer`, which is `Persistent=true`: at 03:30 local
time, the clock read every minute (`AccuracySec=1min`; a server that slept past 03:30 makes it at
its wake), one a day; at `serve`'s start, when a 03:30 passed after the newest daily backup, the
missed one is made at once; with no daily backup yet, the first waits for 03:30. It calls
`backup.Make` with the kind daily and the same options as `xdesign backup --daily`, and logs "daily
backup made" (path, size, deleted), "the daily backup failed", the retention's warning and "next
daily backup" with its time. It runs at the service's normal priority (Linux's `Nice=10` and idle
I/O class have no counterpart inside `serve`). In a release on Windows `serve` starts
`runtime\node.exe`. `xdesign status` on Windows asks the control server through
`controlclient.New(C:\ProgramData\xDesign\control.json)`; without the file (the service stopped) it
shows what the files say, as on Linux.

### 8.3 Install

`xdesign.exe --install` (or double-clicking the file, which opens a console and asks for
Administrator) follows the Linux installer (07 section 3) step by step, in the same pacman style,
logging to `C:\ProgramData\xDesign\logs\install.log`:

1. Preflight: Administrator ("Run this in a terminal opened as Administrator."), the Windows
   version and build (Server 2019 is build 17763, Windows 10 1809 is build 17763; older ones are
   refused with the list), the CPU, free space on the system drive (at least 1 GB), the time in
   sync (a warning), an existing install (repair, update, or refuse a newer one, as on Linux), and
   port 80: " -> ports     80 free" or " -> ports     80 (IIS or another HTTP.sys program) in use"
   when the owner of port 80 is the System process (HTTP.sys), or the program's name otherwise.
2. to 4. The backup question, the domain, the site port and the web base path: the same questions,
   checks and words as on Linux, then the "HTTPS certificate" question (17 section 5), where "port
   80 in use" names IIS when it is HTTP.sys (R-343).
5. The firewall: when Windows Defender Firewall is on for any profile, "Open port <n> in Windows
   Firewall? [Y/n]" for the site's port, and port 80 when xDesign answers Let's Encrypt there. The
   rules are named "xDesign (TCP <n>)", inbound, for all profiles; they are made after the health
   check and recorded in `install.json`. No SELinux step.
6. ":: Owner username [owner]:", ":: Owner name:" (3.7), the summary and ":: Proceed with
   installation? [Y/n]".
7. Install: the release folder and the `current` junction, `C:\ProgramData\xDesign\` with its
   permissions, `config.toml`, the two services (8.2 and 8.6), the folder `C:\Program Files\xDesign\current`
   added to the system PATH (so `xdesign` works in a new terminal), the app's migrations and the
   owner account (`node.exe app\cli.mjs migrate` and `init-owner`, with `XD_DATA_DIR`), start, the
   health check (45 seconds), the firewall, the certificate step.
8. The end, as on Linux, with "Service:  Get-Service xdesign     Logs: xdesign logs -f" and "Keep
   this address: the site answers only there. xdesign status shows it again."

The flags are the Linux ones without `--undo-selinux`: `--yes`, `--json`, `--dry-run`, `--domain`,
`--port`, `--base-path`, `--owner-username`, `--owner-name`, `--https`, `--cloudflare-token`,
`--no-color`, `--log`. The console uses colors (Windows' terminal sequences turned on at start)
unless `--no-color`; passwords and tokens are read without echo.

As built (WIN-04a): on Windows `xdesign.exe --install` runs the shared installer (questions, words,
flags, log, `install.json`) with Windows steps, numbered in their order: 1 Preflight checks, 2
Folders, 3 Program files, 4 Settings, 5 Restore the backup, 6 Database migrations, 7 Owner account,
8 HTTPS method, 9 Windows services, 10 Start and health check, 11 Windows Firewall, 12 HTTPS
certificate, 13 Finish; there is no system user and no SELinux, and the services come after the data
they run with. Preflight checks Administrator (the token's elevation; "Run this in a terminal opened
as Administrator."), Windows 10.0 build 17763 or later (refused otherwise with "xDesign installs on
Windows Server 2019, 2022 and 2025, Windows 10 (1809 or later) and Windows 11, 64-bit; this system
is ..."), the system's own CPU (IsWow64Process2, so an amd64 file on arm64 Windows is refused with
the arm64 file's name), 1 GB free on the drive of `C:\Program Files` and `C:\ProgramData`, the clock
(`w32tm /query /status`; a warning when it fails or names the local clock or "Leap Indicator: 3",
with the fix "net start w32time, then w32tm /resync") and port 80 (GetExtendedTcpTable: the System
process is "IIS or another HTTP.sys program", another process its file name; a port Windows refuses
counts as in use). The system fact reads "Windows Server 2022 Datacenter (build 20348), amd64" (the
registry's ProductName, Windows 11 from build 22000). The install log needs Administrator ("open the
install log: run this in a terminal opened as Administrator") and is readable by SYSTEM and
Administrators only. `C:\ProgramData\xDesign` is created with its permissions in one call
(CreateDirectory with its security descriptor) by whatever writes there first (the log,
`install.json`, the folders step): owner Administrators, a protected DACL with SYSTEM and
Administrators full control of everything, `NT SERVICE\xdesign` modify on the folder itself and read
on the files in it, and CREATOR OWNER modify on what is made inside (`serve`'s `control.json`);
`data`, `backups`, `maintenance`, `update-failures` and `logs` add modify for `NT SERVICE\xdesign`
on everything inside. The account is named by its SID,
`S-1-5-80-2098923330-2051758124-151170182-548055611-3226271214` (SHA-1 of "XDESIGN" in UTF-16LE),
which Windows accepts before the service exists. The folders step refuses a link or a junction in a
folder's place and checks the owner, the protection and the explicit entries of each folder
(`SecurityMatches`). `C:\Program Files\xDesign` and its releases keep what `C:\Program Files` gives.
The release folder is written as on Linux (`release-files`, `xdesign.exe`, `runtime\node.exe`,
`app\`); `current` is a directory junction made with `cmd.exe /c mklink /J` (a junction to another
release is removed first), and `C:\Program Files\xDesign\current` is added to the system PATH (the
registry value Path, its type kept, then WM_SETTINGCHANGE). `config.toml` starts with "written by
the installer (xdesign.exe --install)" and "Restart-Service xdesign after a change"; it and
`install.json` take the folder's permissions. `migrate`, `list-users` and `init-owner` run as
`C:\Program Files\xDesign\current\runtime\node.exe C:\Program Files\xDesign\current\app\cli.mjs ...`
as the Administrator, with `XD_DATA_DIR` and `NODE_ENV` in the environment; the HTTPS manager's
`state.json` is written in `data\certs` with the data folder's permissions. The console's terminal
sequences are turned on for every command (ENABLE_VIRTUAL_TERMINAL_PROCESSING), a console that
refuses them counts as no terminal, and the Cloudflare token is read with the echo off. The messages
name the commands without "sudo" on Windows, and the command to run the installer again is `.\<this
file's name> --install`, or `xdesign --install` from `C:\Program Files\xDesign`.

As built (WIN-04b): after the HTTPS method the installer makes the two services through the service
manager (`svc/mgr`). `xdesign` ("xDesign", own process, automatic with delayed start, `NT
SERVICE\xdesign` with the service SID type unrestricted, `"C:\Program
Files\xDesign\current\xdesign.exe" serve --config C:\ProgramData\xDesign\config.toml`) is restarted
5 seconds after each of its first three failures and then after 60 seconds, also when `serve` stops
with an error, and the count starts again after a day without a failure. `xdesign-maintenance`
("xDesign maintenance", manual start, LocalSystem, `"C:\Program Files\xDesign\current\xdesign.exe"
admin maintenance --request C:\ProgramData\xDesign\maintenance\request.json`, the Linux unit's flag)
gives SYSTEM and Administrators what Windows gives them and `NT SERVICE\xdesign`, by its SID, only
the rights to query its status and to start it. Each run compares every setting (command line,
account, type, start, display name, failure actions, permissions); a repair gives existing services
these settings again, and `install.json` records both under "services" (Linux records no units: its
uninstall lists `/etc/systemd/system`). The start step runs Start-Service (Restart-Service in a
repair or when the service runs) and waits up to 45 seconds for Running and the health check; a
service that stops, or a site that does not answer, shows the last 20 lines of
`C:\ProgramData\xDesign\logs\xdesign.log` under the step and names `xdesign logs --lines 50`.
Windows Defender Firewall counts as on when any profile is on, read from the registry's
EnableFirewall values (the Group Policy's key first, then the local one; a profile with neither is
on), so the language of Windows does not matter; the fact reads "Windows Defender Firewall is on for
the Private and Public profiles" or "Windows Defender Firewall is off". "Open port <n> in Windows
Firewall? [Y/n]" is asked for each port whose rule "xDesign (TCP <n>)" is missing (`netsh`'s exit
status), and the rule is added after the health check with `netsh advfirewall firewall add rule
name="xDesign (TCP <n>)" dir=in action=allow protocol=TCP localport=<n> profile=any` and recorded in
`install.json` with "tool": "windows-firewall". The end reads "Service:  Get-Service xdesign   Logs:
xdesign logs -f", the failure block's state "the service xdesign starts at boot; the failed step and
the ones after it are missing", and the finish writes `install.json` with the folder's permissions.
A repair while the service runs writes no file when the release folder holds this file byte for byte
(the files step is skipped); a damaged release folder that the service runs from is replaced after
Stop-Service, and the start step starts it again. Started with no arguments from Explorer
(GetConsoleProcessList counts this process alone), `xdesign.exe` runs the installer when it is
elevated, or starts itself again with `--install` through the Administrator prompt (ShellExecute
with "runas"); the installer's own window then waits for Enter at its end ("Press Enter to close
this window."), and a refused or cancelled prompt says "Run this in a terminal opened as
Administrator." and waits for Enter. There is no manifest, so `xdesign version` runs in any
terminal.

As built (UNINST-01): the Windows installer has 14 steps; step 11, "Installed apps", lists xDesign
in Windows' list of installed apps (19 section 3).

### 8.4 HTTPS

The SSL manager, the front and the HTTPS card are the same Go and web code; the certificate files
live in `C:\ProgramData\xDesign\certs\`. Let's Encrypt over port 80 is the same, with the port-80
answerer opened only while a check waits. "Files on this server" takes Windows paths (the service
account must be able to read them; the hint says "The xDesign service must be able to read both
files." on Windows).

As built (WIN-06 and the lead, 8184c08): the certificates stay in `<data_dir>\certs` (that is
`C:\ProgramData\xDesign\data\certs\`), not beside `data\` as written above, and `backups\` and the
restore take them from there; whoever moves the folder changes `cmd_backup.go`,
`install.BackupOptions` and `cmd_serve.go`'s `backupOptions` together. "Files on this server" uses
the same examples in the helper and the website on Windows,
`C:\Certificates\design.example.com\fullchain.pem` and `privkey.pem`: the helper's checks of the
files name `NT SERVICE\xdesign` for an unreadable file and do not check a file's mode on Windows,
and the website's dialog asks `GET /api/https`, which answers also `system` ("linux" or "windows",
from the server's `process.platform`): on Windows the tab shows those examples and the hint "The xDesign service
must be able to read both files. xDesign reads them again every minute, so a renewal is picked up."
(Linux is unchanged; certbot is not named on Windows, it has no Windows release).

### 8.5 Backups and restore

The same archives (`backups\xdesign-<UTC time>.tar.zst` with `backup.json` first, 14 kept, the
pre-update ones, 3 kept), made with `VACUUM INTO` and read with the same strict reader. On Windows
the archive records no owners or Unix modes (the files take the folder's permissions), the
database lock and the free-space check use Windows calls. A backup made on Linux restores on
Windows and the other way round (the same database, media and certificates; the restore keeps
this server's `config.toml`). Restoring runs in the maintenance service (8.6) as on Linux.

On Windows `serve` makes the daily backup at 03:30 with the timer's rule (`Persistent=true`: one
missed while `serve` did not run is made at its start).

As built (WIN-06): on Windows the backups are the same archives, in `C:\ProgramData\xDesign\backups`
beside the data folder (`Options.Dir` derives it from `data_dir`). Nothing gets an owner: the files
take the folder's permissions, and the archive's member owners and modes (a fixed 0600, no owner)
are never applied on either system. `backup.json` records "system": "windows" for a backup made on
Windows and nothing on Linux, so Linux archives are unchanged. A restore on Windows always keeps
this server's `config.toml`; on Linux a backup made on Windows keeps it too, while a Linux backup
puts it back as before; the database, the media and the certificates are put back either way, and
the backup's settings are checked only when they are put back. VACUUM INTO opens a Windows path as
`file:/C:/...`; the lock is LockFileEx, the free space GetDiskFreeSpaceEx, and the flush of the
unpacked files and of the renames FlushFileBuffers on each fixed drive (Administrator or
LocalSystem; nothing for the service's account). The lock file is opened without following a reparse
point and refused when it is one (a symbolic link or a junction), where Linux refuses a link; a
member whose name Windows reads as something else (CON, NUL, COM1, a colon, `<>"|?*`, a part ending
in a dot or a space) makes the file "not an xDesign backup" on Windows. `xdesign backup`, `restore`
and `status` run in a terminal opened as Administrator (the token's elevation) and answer "Run this
in a terminal opened as Administrator." otherwise; their usages and words name Windows things ("the
service xdesign is stopped (xdesign logs says why)", "xdesign backup makes one"). `status` reads the
service's state from the service manager (running, stopped, starting, stopping, paused, not
installed).

As built (WIN-05b): `xdesign restore FILE` in a terminal opened as Administrator and Maintenance >
Backups > Restore through the maintenance service stop the service `xdesign` as the update does, run
the migrations with `node.exe` and start it with the installer's 45 seconds for the health check; a
service that stops on the way is waited for, as Windows restarts it.

### 8.6 Updates and going back (D-748)

- Maintenance > Update and `xdesign update FILE` work as on Linux (07 section 6), with one more
  check row on both systems: "System: Windows" (or "System: Linux"); a file for the other system
  is refused: "This file is for Linux; this server runs Windows." (and the other way round). The
  upload accepts the `.exe` or the `.zip` holding it.
- Stage 2 runs in the service `xdesign-maintenance` (display name "xDesign maintenance", manual
  start, LocalSystem). Its permissions let `NT SERVICE\xdesign` start it and nothing else; after
  writing `maintenance\request.json` the helper starts it (in place of the Linux path unit). It
  runs a copy of the new file from `C:\ProgramData\xDesign\maintenance\run\`, makes the pre-update
  backup, writes the new release folder, stops the service `xdesign`, runs the migrations, points
  `current` at the new release (a new junction made beside it, then the two renamed, with the
  service stopped), starts the service, checks its health for up to 120 seconds, and goes back on
  failure, as on Linux. The service then stops itself.
- As built (WIN-04b): the installer makes `xdesign-maintenance` with the command line `"C:\Program
  Files\xDesign\current\xdesign.exe" admin maintenance --request
  C:\ProgramData\xDesign\maintenance\request.json` and the permissions
  `D:(A;;CCLCSWRPWPDTLOCRRC;;;SY)(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;BA)(A;;LCRP;;;<the SID of NT
  SERVICE\xdesign>)`; it never starts it.
- The update guard is the same (`C:\ProgramData\xDesign\update-guard.json`); a rollback request
  starts the maintenance service. `xdesign rollback`, `admin set-port`, `admin set-path` and the
  domain change run through it too.
- 3 releases kept, as on Linux.

As built (WIN-05a): `xdesign.exe admin maintenance --request`, started by the service manager,
answers it (`golang.org/x/sys/windows/svc`): Start pending, Running at once, then the work, then
Stopped, with the service-specific exit code 1 when the request failed. While it works it takes no
Stop (Stop-Service answers that the service cannot accept the control: an update must not stop
halfway) and takes Shutdown, at which it reports Stop pending and goes on as long as Windows waits.
Its lines go to `C:\ProgramData\xDesign\logs\maintenance.log` (a new file at 10 MB, 5 kept), which
the website's results name where Linux names journalctl, and before it stops it carries out a
request written while it ran (up to 10 in one start). Run by hand it needs a terminal opened as
Administrator (LocalSystem counts as one) and works as on Linux. It opens
`C:\ProgramData\xDesign\maintenance`, which must have the permissions the installer gives it, and
every folder and file it reads there once: a link (a reparse point) and a file with other names (a
hard link) are refused, and nothing is opened with delete sharing, so what it checked cannot be
renamed or replaced while it is open. It writes `progress.json` and `result.json` through a new file
and a rename; they take the folder's permissions. A command's output goes to an append-only
temporary file that Windows deletes when its last handle closes, in place of Linux's unlinked file.

`serve` writes `request.json`, then starts `xdesign-maintenance` (OpenSCManager with
SC_MANAGER_CONNECT, OpenService with SERVICE_START|SERVICE_QUERY_STATUS, StartService). One that
runs already takes the request before it stops; `serve` watches it for up to 2 minutes and starts it
again if it stopped with the request still there. A service `serve` cannot start takes the request
back, and the website shows "xDesign could not start its maintenance helper (<error>). Run the
installer again on the server to repair it: xdesign --install". The helper counts as ready when
`serve` can open the service with those rights; a missing service reads "This installation has no
maintenance helper (the service xdesign-maintenance). Run the installer again on the server to
repair it: xdesign --install", and one `serve` may not start "xDesign may not start its maintenance
helper (<error>). Run the installer again ...".  `xdesign update FILE` (in a terminal opened as
Administrator), Maintenance > Update and `xdesign.exe --install` with a newer file over an
installation run Linux's two stages with Windows steps. Stage 1 copies the file (or the .exe out of
its .zip) to `C:\ProgramData\xDesign\maintenance\run\xdesign-update-<random>\xdesign.exe`. The `run`
folder has its own protected permissions (SYSTEM and Administrators only); a link in its place or a
folder with other permissions is removed and made again, and folders a stopped run left there for
more than a day are removed. The `maintenance` folder must have the installer's permissions and
stays held open until the process ends; the maintenance service copies an upload into `run` the same
way. Stage 2 runs from the copy: the pre-update backup, the release folder (`release-files` into
`releases\.staging-<random>`, then renamed), Stop-Service `xdesign`, the new app's migrations
(`releases\<new>\runtime\node.exe releases\<new>\app\cli.mjs migrate`), the step "Windows services"
in place of "systemd units" (both services get the installer's settings where they differ), the
guard's marker, the switch (`cmd /c mklink /J current.new <new release>`, `current` renamed to
`current.old`, `current.new` to `current`, `current.old` removed; junctions an interrupted switch
left are removed first), Start-Service `xdesign` and the health check of up to 120 seconds (a
stopped service is waited for, as Windows restarts it), then `install.json` and the old releases. A
stop that finds the site stopped by a failure waits up to 65 seconds for the restart Windows'
failure actions plan and stops it again, as `systemctl stop` cancels systemd's. Going back on
failure is Linux's, with the last 200 lines of `logs\xdesign.log` saved in
`C:\ProgramData\xDesign\update-failures\<UTC time>.log`. The update guard's marker is
`C:\ProgramData\xDesign\update-guard.json` with an entry that lets `NT SERVICE\xdesign` change and
remove it, so `serve` counts its starts in it. 3 releases are kept, and a release folder whose
`xdesign.exe` or `node.exe` cannot be opened for writing (a running program uses it: the maintenance
service runs the release before) is never removed. The messages and the usage name Windows things:
no sudo, "under C:\Program Files", Stop-Service, Start-Service, "the services".  The checks of an
update file get the row "System: Linux" or "System: Windows" before "CPU: <arch>" on both systems,
and a file for the other system is refused: "This file is for Linux; this server runs Windows." (and
"This file is for Windows; this server runs Linux.") in the website, "the update failed: this file
is for Windows; this server runs Linux" in `xdesign update`. A file's system is its program header:
an ELF file is Linux, a PE file ("MZ", and "PE\0\0" where the DOS header says) Windows; the Go build
information's GOOS must agree, the machine (AMD64, ARM64) must match GOARCH, and the stamped build
information is read from the PE file's COFF symbol table as from the ELF one. The upload, `xdesign
update` and the unpacker take the PE file as they take the ELF file, alone or in a zip, tar or
compressed file; in a container that holds several, `xdesign-<version>-windows-<cpu>.exe` counts as
a release's name. The website's Update card keeps its words: "the new xdesign file" and "A tar.gz,
zip, tar.xz or tar.zst file that holds it" already fit the Windows .exe and its .zip.

As built (WIN-05b): `xdesign rollback`, `xdesign admin set-port`, `xdesign admin set-path`, `xdesign
restore FILE` and the domain change run on Windows, in a terminal opened as Administrator or in the
maintenance service (Maintenance > Go back, the guard's rollback request, Settings > Site address,
Settings > HTTPS, Maintenance > Backups > Restore), with Linux's steps and Windows' forms. Anything
else refuses with "<command> must run as Administrator: run this in a terminal opened as
Administrator". The rollback stops the service `xdesign` (Stop-Service, waiting for a restart
Windows planned after a failure), points `C:\Program Files\xDesign\current` at the kept release as
the update does (`current.new`, then the two renamed), starts it with the update's health check of
up to 120 seconds, and goes back the same way when a step fails. The address and domain changes
write `config.toml` with the folder's permissions, as the installer does; `set-port` changes no
service (Windows lets the service's account listen on any port, below 1024 too) and has no SELinux
step, and its steps are 1 New port, 2 Windows Firewall, 3 Settings, 4 Stop xDesign, 5 Start and
health check, 6 Finish. While Windows Defender Firewall is on, the new port gets the rule "xDesign
(TCP <new>)" and `install.json` records it; once xDesign answers there, the rule "xDesign (TCP
<old>)" is deleted when `install.json` records it (the installer or an earlier `set-port` made it),
and a port the owner opened by hand is left alone. While the firewall is off and `install.json`
records the old port's rule, that rule moves to the new port all the same, as Windows keeps the
rules of a firewall that is off; otherwise the note reads "Windows Defender Firewall is off: if
another firewall guards this server (your provider's), allow TCP port <n> in it". With
`--no-firewall` the note gives `netsh advfirewall firewall add rule name="xDesign (TCP <n>)" dir=in
action=allow protocol=TCP localport=<n> profile=any`. Run by hand, `set-port` and `set-path` refuse
while the service `xdesign-maintenance` runs ("... (the service xdesign-maintenance runs): try again
when it is done"). The restore stops the service `xdesign` as the update does, runs the migrations
with `node.exe`, and starts it with the installer's 45 seconds for the health check; a service that
stops on the way is waited for, as Windows restarts it, and the error names `Get-Service xdesign`
and `xdesign logs --lines 50`. No helper command answers "not available on Windows yet" any more.

### 8.7 The command line and uninstall

- The commands of 07 section 7, run in a terminal opened as Administrator (in place of `sudo`):
  `serve`, `--install`, `update FILE`, `rollback`, `backup`, `restore FILE`, `status`, `logs`,
  `admin reset-password <username>`, `admin reset-2fa <username>`, `admin list-users`, `admin
  set-port`, `admin set-path`, `admin maintenance --request`, `--uninstall`, `version`. The words
  that name Linux things ("systemctl", "journalctl", "sudo") have Windows forms on Windows.
  `logs [-f] [--lines N]` shows the last lines of the service's log (default 100) and with -f
  follows it across a new file; on Linux it prints "Use journalctl -u xdesign (add -f to follow)."
  `backup`, `restore` and `status` say "Run this in a terminal opened as Administrator." where Linux
  says sudo or root, "the service xdesign" for xdesign.service and "xdesign logs says why" for
  journalctl.
- `--uninstall` asks "Keep the data" or "Remove everything" (a backup offered first) and removes
  the two services, the firewall rules it made, the PATH entry and the program folder; "Remove
  everything" also removes `C:\ProgramData\xDesign\`.

As built (WIN-04b): `xdesign --uninstall` runs on Windows, with the Linux questions and words but no
SELinux question and no `--undo-selinux` flag. It needs a terminal opened as Administrator, stops
`xdesign` and then `xdesign-maintenance`, deletes both services (`sc.exe delete`), deletes the
firewall rules `install.json` records (whether the firewall is on or off: Windows keeps them),
removes `C:\Program Files\xDesign\current` from the system PATH (then WM_SETTINGCHANGE), removes the
`current` junction (the link only) and then `C:\Program Files\xDesign`. Run from the program folder
(`xdesign --uninstall` from the PATH), it first moves its own running file to
`C:\Windows\Temp\xdesign-uninstall-<random>.exe`, as Windows lets a running program's file be moved
but not deleted, and has Windows delete it at the next restart (MoveFileEx with
MOVEFILE_DELAY_UNTIL_REBOOT); anything another program still holds in the folder is deleted at the
next restart the same way, with a warning. "Keep the data" keeps `C:\ProgramData\xDesign` whole.
"Remove everything" deletes it but for the uninstall's own open log (`logs\install.log`, listed
under "What remains" as Linux lists its log), and its final backup goes to `xdesign-final-<UTC
time>` in the profile folder of the Administrator who runs it.

As built (WIN-05b): the words that name Linux things have Windows forms on Windows; Linux keeps
every word it has. The free-space refusal of an update reads "There is not enough free space under
C:\Program Files\xDesign: ...", and the progress titles "Copying the uploaded file into a protected
folder" and "Copying the backup into a protected folder" (`maintenance\run`). The usages of `xdesign
rollback`, `admin reset-password`, `admin reset-2fa`, `admin list-users`, `admin set-port`, `admin
set-path` and `logs` name no sudo, /opt, /etc or journalctl and say "Run it in a terminal opened as
Administrator"; `xdesign help` shows `.\xdesign.exe --install` and `xdesign --uninstall`.
`reset-password`, `reset-2fa` and `list-users` run in a terminal opened as Administrator (on Linux
as root or as the xdesign user) and otherwise answer "Run this in a terminal opened as
Administrator.". The update guard's log lines name "the maintenance service" and "xdesign rollback
in a terminal opened as Administrator". For "Certificate files on this server" the example paths are
`C:\Certificates\design.example.com\fullchain.pem` and `privkey.pem`, an unreadable file names `NT
SERVICE\xdesign`, and the files' mode is not checked (a Windows file's mode tells only whether it is
read-only, so every key file was refused with "Run: chmod o-rwx").

### 8.8 How the helper's code is split (WIN-01)

The Linux-only parts (systemd units and `systemctl`, `/etc/os-release`, users and `chown`, ufw and
firewalld, SELinux, Unix sockets, process groups and signals, `statfs`, `flock`, `uname`,
`/proc/self/exe`) move behind build tags: `*_linux.go` and `*_windows.go` beside each other in
the same packages, with a small `internal/platform` package for the paths, the service manager,
the firewall, the folder permissions, the child process and the disk space. Windows code uses
`golang.org/x/sys/windows` (with `svc`, `svc/mgr`) and `golang.org/x/term`. `make helper-check`
builds, vets and lints the helper for `GOOS=windows` as well as Linux, on both CPUs. The agents
cannot run Windows (R-342): the hand tests on Windows machines (O-03) are the first run.

As built (WIN-01): `internal/platform` holds what differs between Linux and Windows with the same
names in a `_linux.go` and a `_windows.go` file: the paths of section 8.2 and today's Linux ones,
`DiskSpace`, `TryLock`, `FileOwner`, `NoFollow`, `SyncAll`, the child process (`PrepareChild`,
`Started`, `Stop`, `Release`, WIN-02), the port errors (`ErrAddrInUse`, `ErrAccess`, `ErrPerm`),
`Name`, `Machine` and `Version`. `internal/certs`, which may import only the standard library, has
its own `fileid_linux.go` and `fileid_windows.go`. The control socket's listen moved to
`server_linux.go`. The installer's Linux step files stayed shared at first and compiled on Windows,
where a check at each entry point of `internal/install` answered "<command>: not available on
Windows yet"; WIN-04 and WIN-05 moved each to a `_linux.go` file as they wrote its Windows
counterpart, and the check is gone. `make helper-check` builds and vets for linux/amd64,
linux/arm64, windows/amd64 and windows/arm64 and runs golangci-lint with `GOOS=linux` and
`GOOS=windows`.

The installer's Windows steps are in `internal/install`'s `_windows.go` files (steps, preflight,
system, files, service, https, log, certificate), the Linux ones in the matching `_linux.go` files;
Windows' folder permissions, PATH, listening ports and edition are in `internal/platform`.

The services, the firewall and the uninstall on Windows are in `internal/install`'s
`services_windows.go`, `firewall_windows.go` and `uninstall_windows.go` (the Linux uninstall's own
steps in `uninstall_linux.go`, ufw and firewalld in `firewall_linux.go`); the firewall's state and
the PATH entry's removal are in `internal/platform`. Windows' list of installed apps is in
`internal/install`'s `apps_windows.go`, with the registry in `internal/platform`'s
`apps_windows.go`; the uninstall Maintenance asks for is started by `PrepareUninstaller` and
`StartUninstaller` in `uninstall_linux.go` and `uninstall_windows.go`, with `platform.StartDetached`
on Windows (19 sections 3 and 5).

The update's Windows steps are in `internal/install`'s `update_windows.go` (Linux's in
`update_linux.go`), `files_windows.go` (`pointCurrent`, the junction switch) and
`tempdir_windows.go` (`maintenance\run`); the maintenance service in `internal/app`'s
`maintenance_windows.go` and `internal/cli`'s `cmd_maintenance_windows.go` and `owned_windows.go`;
`serve`'s start of it in `internal/maintenance`'s `helper_windows.go`; the held opens in
`internal/platform`'s `held_windows.go`; the PE reader in `internal/release`'s `pe.go`.

The rollback, the address and domain changes and the restore's service share Linux's code; their
Windows steps are in `internal/install`'s `address_windows.go` (`config.toml`, Windows Firewall's
rule, the maintenance service's state) and `restore_windows.go` (the service's stop and start), with
`update_windows.go`'s (`pointCurrent`, `stopSite`, `startAndCheck`); Linux's moved unchanged to
`address_linux.go` and `restore_linux.go`. The words that name each system's things are in the
`_linux.go` and `_windows.go` files beside the code that shows them (cli's `cmd_admin`, `cmd_logs`,
`cmd_update` and `cmd_maintenance`, app's usage, maintenance's helper, guard's system, certs' load).
`platform.ErrNotYet` and install's `systemSupported` are gone.

## 9. The desktop app (M16: DESK-01 to DESK-05)

### 9.1 What it is (Q-67, Q-73, Q-75, D-751, D-753)

xDesign as an app on a PC, for one person, offline: it opens like any app, in its own window with
xDesign's icon, keeps its designs on the PC and needs no internet, no server and no sign-in. It
runs on Windows 10 and 11, on Linux and on macOS, on amd64 and arm64. Designs move between the app
and a server with Export and Import. The website stays as it is (D-01 still holds for the server;
the desktop app is a second form of the same code).

It has: the designs list with templates, the editor, Try it, Checks, Export, Import, Print,
version history, comments (as notes for oneself), the Claude Code connection, Backups and the
theme switch. It has no: sign-in, password, two-factor, members, sharing, view-only links, Claude
links, the claude.ai and Claude app connector, Activity, Settings' site name, site address and
HTTPS cards, Maintenance (server backups and updates). The menus and pages for those are not shown.

### 9.2 How it runs (Q-68, D-752)

- An Electron app (a pinned Electron version) whose main process starts the same server bundle
  with the official Node.js runtime as a child process, exactly as the Linux helper starts it:
  `runtime/node app/server.mjs`, with the same native modules as the server (better-sqlite3 and
  argon2 prebuilt for the system and CPU), so the server code is the one the website runs. The
  window loads `http://127.0.0.1:<port>/`.
- The server listens on 127.0.0.1 only, port 47823 (D-757), or the next free one when another
  program holds it; the app's window and the Claude card always use the port in use (R-350).
- The window: "xDesign", the size and place remembered; one app at a time (opening it again brings
  the window to the front); a small "Starting xDesign..." view while the server starts (a few
  seconds); if the server does not start, the window says why with the log's place. Links to other
  sites open in the default browser; the window never navigates away from the app. The menus:
  Edit (undo, cut, copy, paste, select all), View (reload, zoom, full screen) and Help ("About
  xDesign" with the version and "Open data folder"). Closing the window quits the app (also on
  macOS) and stops the server cleanly.
- The window's own pages: "Starting xDesign..."; "xDesign stopped unexpectedly." (the server
  ended), "xDesign did not start in 60 seconds." (no answer), "xDesign did not start: <the
  system's error>" (Node.js could not be run) or the server's own sentence (it cannot use the data
  folder), each with "Log: <the log's path>" and, but for the last, "Start again".
- Electron's window runs with context isolation, without Node in the page and sandboxed, as
  Electron's security guide says.

### 9.3 No sign-in: the one person (DESK-01)

- The server in desktop mode (`XD_DESKTOP=1`) makes one account on its first start: username
  "me", the Name taken from the computer's user name (else "Me"), the site owner. It has no
  password anyone types.
- The Electron main process makes a random key at each start and gives it to the server
  (`XD_DESKTOP_KEY`); the window opens `/api/desktop/enter` with the header
  `X-Xdesign-Desktop: <key>`, which signs the window in as that account and goes to the designs.
  A browser on the same PC that opens the address without the key gets the page "Open xDesign
  from its app." and nothing else; the API answers 401 as today.
- The server refuses the routes of what the app does not have (9.1) with 404 "Not in the desktop
  app.", and `GET /api/health` and `GET /api/me` say `mode: "desktop"` (or `"server"`), which the
  web reads to hide them (DESK-03).

As built (DESK-01, 23ec6b8): the server's desktop mode (`XD_DESKTOP=1`, set by the app's shell with
`XD_DESKTOP_KEY`, `XD_DESKTOP_PREFERRED_PORT=47823` and `XD_STOP_ON_STDIN=1`; a missing or
malformed key stops the start with "The environment is not valid").

- Start, in this order: when the database file exists, the settings row `newestVersion` (the
  newest xDesign version that opened it) is read with a connection of its own before the
  migrations; if it is newer than this build (semantic versioning's order), the server writes
  `xdesign-desktop-error: These designs were saved by xDesign <version>. Use that version or a
  newer one.` as its last line on standard error and exits with code 78. Then the database opens
  (the migrations), `newestVersion` becomes this version when it is newer or missing, and the one
  person is made when there is no site owner: username "me", the Name from the computer's user
  name without control characters and cut to 100 characters (else "Me"), site owner, the argon2
  hash of a random secret nobody is told. All of this happens before the server listens, so the
  window never enters before the person exists. DESK-02's restore goes in place just before the
  version check, and a restore ends the server with exit code 75.
- `GET /api/desktop/enter` (desktop mode only; a server answers 404 `not_found` as for any unknown
  `/api` path; no HEAD): the header `X-Xdesign-Desktop` is compared with the key in constant time
  (their SHA-256 with `timingSafeEqual`); the right key starts a session for the site owner (the
  browser's previous session ends, as at sign-in) and answers 302 to `/` (the base path) with
  `Cache-Control: no-store`; a wrong or missing key answers 403 with the page "Open xDesign from
  its app." (HTML, centered, the desktop pages' colors, light or dark as the system is). No
  Activity row. The header is hidden in logs.
- Pages: in desktop mode index.html (every SPA address) goes only to a request with a session;
  without one it is the same 403 page, so a browser on the PC sees nothing else. The built files
  (scripts, styles) are served as before. The API answers 401 `not_signed_in` as on a server.
- `GET /api/health`: `{ ok: true, version, mode }`, `mode` `"desktop"` or `"server"`.
  `GET /api/me`: `{ user, mode, desktop }`, `desktop` `{ port, preferredPort }` (the port of this
  start from `XD_PORT`, the preferred one from `XD_DESKTOP_PREFERRED_PORT`) or null on a server.
- Refused routes: an `onRequest` hook, added before the routes, answers 404
  `{ "error": { "code": "not_in_desktop", "message": "Not in the desktop app." } }` with
  `Cache-Control: no-store`, before any sign-in or role check, matching the route's method and
  path (HEAD as GET). The list is `notInDesktop` of `@xdesign/api` (`packages/api/src/desktop.ts`):
  - Whole areas, every route of their file in `packages/api/src/routes/`, also routes added later:
    members (`members`, `searchMembers`, `updateMember`, `removeMember`, `resetTwoFactor`,
    `addMember`, `setMemberPassword`, `changeUsername`), https (`https`, `chooseHttps`,
    `pasteCertificate`, `issueHttps`, `changeDomain`, `changeAddress`), maintenance
    (`serverStatus`, `maintenance`, `backups`, `makeBackup`, `backupFile`, `deleteBackup`,
    `restoreBackup`, `uploadUpdate`, `updateCheck`, `discardUpdate`, `installUpdate`, `releases`,
    `rollback`), view-only links (`viewLinks`, `createViewLink`, `revokeViewLink`,
    `viewLinkDesign`).
  - By route key in the areas kept in part: sign-in (`signIn`, `signInCode`, `signOut`,
    `changePassword`, `sessions`, `endSession`, `signOutOthers`, `confirm`, `twoFactorSetup`,
    `twoFactorOn`, `twoFactorOff`, `newRecoveryCodes`); sharing (`setDesignMember`,
    `removeDesignMember`); settings (`updateSettings`, `activity`); Claude (`claudeLinks`,
    `createClaudeLink`, `revokeClaudeLink`, `linkSpec`, `linkDoc`, `linkHowToRead`,
    `linkPicture`, `claudeApps`, `disconnectClaudeApp`, `appRequest`, `allowAppRequest`,
    `denyAppRequest`, `claudeConnections`, `revokeClaudeConnection`).
  - The OAuth endpoints, any method: `/oauth/authorize`, `/oauth/token`, `/oauth/register`,
    `/.well-known/oauth-protected-resource/mcp`, `/.well-known/oauth-authorization-server`.
  - Kept: `health`, `site`, `me`, `updateMe`, designs (all, with `transferDesign`),
    `designMembers` (the comments' mentions read it), `importDesign`, comments, media, `settings`
    (read), versions, templates, `apiKeys`, `createApiKey`, `revokeApiKey`,
    `updateClaudeConnection` (the Account page's "Ask first" switch of a key), `uploadPictures`,
    live editing, `/mcp`.
- Claude: in desktop mode the refused routes are not actions (`xdesign_find_actions` does not list
  them, their areas drop out of its list), and describing or running one answers
  `not_in_desktop`. `/mcp` takes API keys only (no connected app's token) and its 401 has no
  `resource_metadata`.
- Stopping: with `XD_STOP_ON_STDIN=1` the end or close of standard input runs the same stop as
  SIGINT and SIGTERM (the app closes: jobs stop, live documents are saved, the database closes)
  and exits 0. The start line logs `mode`.

### 9.4 The screens (DESK-03)

- The top bar: Designs, the theme switch, the person menu with "Account" (no "Sign out"); no
  Members, no Settings for people, no Maintenance.
- The Account page: "Name" and the "Claude" card (API keys and the `claude mcp add` command with
  `http://127.0.0.1:<port>/mcp`, 9.6). No username, password, two-factor or connected apps.
- A "Backups" page in the person menu (9.5).
- The editor: no "Share", no view-only or Claude links; comments and History stay.

As built (DESK-03, 4d54037): the web in the desktop app (`apps/web`).

- The mode: the first answer of `GET /api/me` (the signed-in pages' guard) or, on a page without a
  session, of `GET /api/health` (a server that cannot be reached counts as a server) says `mode`
  and the app's ports once; they hold until the window loads again. What is shown follows the
  routes the server has: a page, menu item or card whose route is in `notInDesktop` of
  `@xdesign/api` is not shown in the app, and the app's own (`onlyInDesktop`, the Backups page) is
  not shown on a server.
- Not shown in the app: Members, Settings (the whole page) and Maintenance in the top bar; "Sign
  out" and the "@username" line in the person menu; "Share" in the editor's top bar and in a
  design card's menu (so the Share dialog with its view-only and Claude links); the chip "Shared
  with me" on Designs; on the Account page the username, "Change password", "Two-factor
  authentication", "Sessions" and the Claude card's "Connected apps". Comments, the bell, History,
  Export, Import, Print and "Refresh pictures for Claude" stay.
- A page the app does not have, opened by its address, goes to Designs: Members, Settings,
  Maintenance, the sign-in page, the old invite and reset links, a view-only link's page and the
  Claude app's "Allow" page. On a server, `/backups` goes to Designs.
- A session that ends while the app's window is open (401 `not_signed_in`) loads the window again
  instead of going to the sign-in page; the server then shows "Open xDesign from its app.".
- The cached `GET /api/me` answer: a name, username, color or theme change merges the new `user`
  into it (MAP-11's map lines did already); a sign-in stores `{ user, mode: "server", desktop:
  null }`, as only a server signs in.
- The top bar in the app: the site name, Designs, the theme switch, the comments' bell and the
  person menu with "Account" and "Backups".
- The Account page in the app: "Name" and the color, then the card "Claude" with "API keys" (each
  with "Ask first" and "Revoke"), the command `claude mcp add --transport http xdesign
  http://127.0.0.1:<port>/mcp --header "Authorization: Bearer <key>"` with the port of this start
  (`desktop.port` of `GET /api/me`) and the line for other MCP clients with the same address. When
  `port` is not `preferredPort`, a notice under them: "xDesign uses port <n> this time, so Claude
  Code's saved address does not work. Add it again with the command above."

### 9.5 Backups in the app (DESK-02)

- The page "Backups": "Make a backup now", the list (time, size, "Automatic", "Made by hand" or "Before a restore"),
  and on each "Restore", "Save a copy..." (a save dialog) and "Delete"; "Restore from a file..."
  for a backup saved elsewhere; "Open the backups folder".
- A backup is one file `xdesign-backup-<UTC time>.zip` in `<data>/backups/`: `backup.json` first
  (the app's version, the files with their sizes and SHA-256), the database copied with SQLite's
  backup, and the media folder. 14 kept, automatic and by hand together.
- Automatic: at start when the newest backup is older than 24 hours, then every 24 hours while the
  app runs.
- Restore asks "Restore this backup?" with "The designs as they were at <time> replace the ones in
  the app now. A backup of the app as it is now is made first." and "Restore"; the app makes that
  backup, stops the server, replaces the database and media, starts it again and reloads the
  window. A backup from a newer xDesign is refused: "This backup is from xDesign <version>. Use
  that version or a newer one."
- Desktop backups and server backups are different files: to move designs, Export and Import.

As built (DESK-02, 14c49de): the desktop app's backups live in its server (desktop mode only;
`apps/server/src/desktop/backups.ts`).

- Files: `<userData>/backups/` (beside `XD_DATA_DIR`, made 0700), one
  `xdesign-backup-<UTC time as YYYYMMDD-HHMMSS>.zip` (0600) per backup, written as
  `<name>.partial` and renamed; the database's copy (better-sqlite3's online `backup()`) goes to a
  temporary folder `<name>.db.partial`, removed afterwards. The zip's entries in order:
  `backup.json` (deflated, `{ version, createdAt, kind, files: [{ path, size, sha256 }] }`,
  `createdAt` as ISO 8601 UTC, `kind` `automatic`, `manual` or `beforeRestore`), `xdesign.db`
  (deflated), then each media file as `media/<first 2 of the SHA-256>/<SHA-256>` (stored, sorted);
  `media/tmp/` and anything else in the media folder stay out. The database's copy and the media
  are read twice: once for backup.json's sizes and SHA-256, then into the zip; a file that changed
  between the two stops the backup. A second backup in the same second waits for the next second.
  After each backup the oldest beyond 14 go (every kind, by the time in the name). One backup,
  restore or deletion runs at a time, in the order asked.
- Limits: fflate writes no ZIP64, so a backup holds at most 65,000 files and 4,000,000,000 bytes;
  past that, making one answers 413 `too_large` "The designs and their files are over 4 GB, too
  large for a backup."
- Automatic: the job `desktopBackup` checks every hour, the first check a minute after the server
  listens (as every job), and makes an `automatic` backup when the newest backup of any kind is 24
  hours old or there is none; a backup made by hand counts as the newest.
- Routes, for the site owner (the app's one person), without "Confirm it's you" and without
  Activity rows (the app has neither):
  - `GET /api/desktop/backups`: `{ backups: [{ name, createdAt, size, kind, version }], running }`,
    newest first; `createdAt` in UTC milliseconds, `size` the file's bytes, `version` the xDesign
    that made it; `running` is true while a backup or a restore runs or waits. A file with a
    backup's name that cannot be read as one is left out (and logged).
  - `POST /api/desktop/backups`: makes a `manual` backup and answers its entry once it is made.
  - `GET /api/desktop/backups/:name`: the zip with `Content-Type: application/zip`,
    `Content-Disposition: attachment; filename="<name>"` and `Cache-Control: no-store`.
  - `DELETE /api/desktop/backups/:name`: `{ deleted: "<name>" }`.
  - `POST /api/desktop/backups/:name/restore`: `{ before: <the entry of the beforeRestore backup> }`.
  - `POST /api/desktop/backups/restore`: a multipart form with one file (any field name, other
    fields ignored), then as the restore above; no file: 400 "Choose a backup file."; not a
    multipart form: 400 "Send the backup file as a multipart form."
  - `POST /api/desktop/backups/folder`: `{ ok: true }` once the file manager started.
  - `:name` is `xdesign-backup-<8 digits>-<6 digits>.zip`, else 400 "name: Not a backup name.";
    a backup that is not there: 404 `not_found` "This was not found."
- On a server none of these routes is registered: 404 `not_found` as for any unknown `/api` path.
- Restore: the file is read from its central directory: a zip without ZIP64 or encryption, plain
  files only (no folders or links), stored or deflated, each named once, in order and without
  overlaps; `backup.json` first (at most 32 MiB) and valid; the other entries exactly its files
  with their sizes, `xdesign.db` among them, every other name `media/<2 hex>/<SHA-256>`. Anything
  else answers 400 `bad_request` "This is not an xDesign backup." (the reason goes to the log); a
  backup of a newer xDesign (`compareVersions`) answers 400 "This backup is from xDesign <version>.
  Use that version or a newer one." Then the database and media are unpacked into
  `<data>/restore-staging.partial/`, each file checked against its size and SHA-256 as it is
  written (a mismatch: "This is not an xDesign backup."); then the `beforeRestore` backup of the
  app as it is; then the folder is renamed `<data>/restore-staging/`, the answer goes out, and the
  server stops as on a quit (jobs, live documents saved, database closed) and exits with 75, at
  the latest 5 seconds after the answer.
- Restore from a file: the upload is written to `<backups>/upload-<id>.partial` (at most 4 GB and
  64 MiB, else "This is not an xDesign backup."), restored, then removed.
- At the next start, before the data folder's version check: `*.partial` files and folders in the
  backups folder go (a backup or an upload that stopped); `<data>/restore-staging.partial/` is
  removed with the log line "an incomplete restore was removed"; a `<data>/restore-staging/`
  replaces the data: `xdesign.db`, `xdesign.db-wal`, `xdesign.db-shm` and `media/` move into
  `<data>/restore-replaced/`, the staged `xdesign.db` and `media/` move in, the staging folder
  goes, then `restore-replaced/` is removed ("a desktop backup was restored"). Each move happens
  only when its target is free, so a swap cut short by a crash goes on at the next start.
- Open the backups folder: `explorer` on Windows, `open` on macOS, `xdg-open` elsewhere, with the
  folder as its one argument, detached, without a shell, its output ignored and its exit code not
  read; a program that cannot start answers 500 `server_error` "The backups folder could not be
  opened."
- Claude (area `maintenance`, in the app its only actions): `desktopBackups` reads,
  `makeDesktopBackup` changes, `deleteDesktopBackup` and `restoreDesktopBackup` ask first
  ("Delete a backup, "<name>"?", "Restore a backup, "<name>"?"). Hidden: `desktopBackupFile` and
  `restoreDesktopBackupFile` (a file), `openDesktopBackupsFolder` (the new reason `window`: "This
  action opens a window on the person's computer: they do it in the desktop app."). On a server
  the four are no actions: describing or running one answers `not_found` "There is no action
  <id>. Find one with xdesign_find_actions."
- The page "Backups" (DESK-03, 4d54037; `/backups`, in the person menu): the title with "Open the
  backups folder", "Restore from a file..." and "Make a backup now" ("Made the backup <name>."
  when done), the line "A backup is made every day while xDesign runs; the last 14 are kept.",
  "A backup is being made or restored now." while the server's `running` (the list is read every 5
  seconds meanwhile), then the backups, newest first: the time, the kind ("Automatic", "Made by
  hand", "Before a restore"), the size, the xDesign version and the file name, with "Restore",
  "Save a copy..." and "Delete"; "No backups yet." without any.
  - "Restore" asks "Restore this backup?" with "The designs as they were at <time> replace the
    ones in the app now. A backup of the app as it is now is made first." and "Restore"; a refusal
    (a newer xDesign's backup) shows in the question.
  - "Restore from a file..." chooses a `.zip`, reads when it was made from its `backup.json`
    (found through the zip's central directory, so only a few small pieces of the file are read),
    asks the same question with that time and sends the file to
    `POST /api/desktop/backups/restore`. A file whose `backup.json` cannot be read says "This is
    not an xDesign backup." without sending it.
  - Once a restore is taken the page shows only "Restoring... xDesign starts again in a moment."
    until the app loads the window again.
  - "Save a copy..." downloads `GET /api/desktop/backups/<name>` (the app's window shows the save
    dialog, DESK-04).
  - "Delete" asks "Delete the backup of <time>?" with "This cannot be undone." and "Delete", then
    "Deleted the backup <name>.".
  - "Open the backups folder" calls its route; a failure shows the server's words in a toast.

### 9.6 Claude Code (DESK-01, DESK-03)

The MCP server of 17 section 13 runs in the app at `http://127.0.0.1:<port>/mcp` with API keys made
on the Account page, with "Ask first" as on the site. The Claude app and claude.ai cannot reach a
PC, so their connector is not shown. If the port had to change (another program held 47823), the
Claude card says so: "xDesign uses port <n> this time, so Claude Code's saved address does not
work. Add it again with the command above."

As built (DESK-03): the Account page's command and the line for other MCP clients use
`http://127.0.0.1:<port>/mcp` with the port of this start from `GET /api/me`; the notice stands
under them when `port` is not `preferredPort`.

### 9.7 Files, data and updates (Q-74, Q-77, D-754, D-755)

- Windows: one portable `xdesign-desktop-<version>-windows-<cpu>.exe` that runs without installing
  (it unpacks itself to a temporary folder at each start, a few seconds, R-346), or the setup file
  `xdesign-desktop-<version>-windows-<cpu>-setup.exe`, which installs it for the current user
  (docs/plan/20), or both. Linux: one
  `xdesign-desktop-<version>-linux-<cpu>.AppImage`. macOS: `xdesign-desktop-<version>-macos-<cpu>.zip`
  holding `xDesign.app`, signed ad hoc on Linux (no Apple account): the first time, right-click >
  Open, or "Open Anyway" in Privacy & Security; on newer Macs it may need
  `xattr -dr com.apple.quarantine xDesign.app` (R-345). Windows warns about an unsigned file the
  first time ("More info" > "Run anyway") (R-344).
- The data folder is the system's place for app data: `%APPDATA%\xDesign` on Windows,
  `~/.config/xDesign` on Linux, `~/Library/Application Support/xDesign` on macOS; inside it
  `data/`, `backups/` and `logs/`.
- Updating: use the newer file in place of the old one; the designs stay in the data folder and the
  new version updates the database at its first start (the migrations, as on the server). An older
  version refuses a newer data folder: "These designs were saved by xDesign <version>. Use that
  version or a newer one." Installed with the setup file: run the newer setup file, which closes
  xDesign, replaces it and keeps the data folder (docs/plan/20 section 2).

## 10. `build.sh` asks the platform (BUILD-01, WIN-07, DESK-05)

- Run without options in a terminal, `build.sh` asks (Q-81, D-756):

```
:: What to build:
   1) Server   2) Desktop app   3) Both
   Choose [1]:
:: Server for:
   1) Linux   2) Windows   3) Both
   Choose [1]:
:: Desktop app for:
   1) Windows  2) Linux  3) macOS  4) All
   Choose [4]:
:: Windows desktop file:
   1) Portable   2) Installer   3) Both
   Choose [1]:
:: CPUs:
   1) amd64   2) arm64   3) both
   Choose [3]:
```

  The server question shows only when a server is built, the desktop one only for the desktop app,
  and "Windows desktop file" only when Windows is chosen for it.
  The version is asked first, as today. Flags for the same, without the menu: `--servers
  linux,windows|none`, `--desktops windows,linux,macos|none`, `--windows-desktop
  portable|installer|both`, `--arches amd64,arm64`; `make release` passes `SERVERS`, `DESKTOPS`,
  `WINDOWS_DESKTOP` and `ARCHES`.
- The files in `dist/`, all in `SHA256SUMS` (and its signature) and in the release notes:
  - Linux server: `xdesign-<version>-linux-<cpu>` and its `.tar.gz`, as today.
  - Windows server: `xdesign-<version>-windows-<cpu>.exe` and `xdesign-<version>-windows-<cpu>.zip`
    (the file alone). The payload holds Node's official Windows build (`node.exe` from
    `node-<version>-win-<cpu>.zip`, pinned with its SHA-256 in `tools/release/node.env`) and the
    Windows native modules (better-sqlite3's `prebuilds/win32-<cpu>.node`,
    `@node-rs/argon2-win32-<cpu>-msvc`). The proof checks the PE header with `file`; it cannot run
    the file on Linux.
  - Desktop: the three files of 9.7 per CPU, made by electron-builder (pinned in `apps/desktop`)
    from the SPA, the server bundle, Node's official build for that system and CPU and its native
    modules; the Windows icon and file details are written by electron-builder itself, without Wine
    (R-349); the macOS app is signed ad hoc with `rcodesign` (pinned download, checked by SHA-256).
    For Windows the portable file, the setup file `-setup.exe` or both (docs/plan/20); the setup
    file's uninstaller is made by electron-builder under Wine, so the setup file needs Wine on the
    build computer (R-349 holds for the portable file only).
- `build.sh` keeps its pacman look, its checks of a clean tree and its pinned downloads in
  `.dev/cache/`; the step count follows what was chosen.

As built (DESK-05, 46499ed): choosing the desktop app builds, after the servers, for each system and
CPU in 2 phases (3 for macOS): Node.js's official build for them and `app/` as in the server's
payload in `dist/build/desktop-<system>-<cpu>/`; electron-builder 26.18.1 with
`apps/desktop/electron-builder.config.ts` (Windows `portable`, Linux `AppImage`, macOS `dir`; the
build's version in the packaged package.json; the staged folder as `<resources>/runtime` and
`<resources>/app`); for macOS rcodesign 0.29.0's ad hoc signature and a zip that keeps the links.
Electron is electron-builder's own download, cached in `.dev/cache/electron/` and checked against
electron's `checksums.json`; electron-builder's tools are cached in `.dev/cache/electron-builder/`.
No Wine: electron-builder writes the .exe's icon and file details with resedit. The proof unpacks
each file (7z, unsquashfs, unzip) without running it and reads Electron's program, the runtime and
the app for the system and CPU, the native modules, the version and, for macOS, `rcodesign verify`.
The icon is new (`apps/desktop/build/icon.svg`, with its `.png`, `.ico` and `.icns`).

As built (WIN-07): choosing the Windows server builds, for each CPU after the Linux server, in 3
phases: the payload `dist/build/payload-windows-<cpu>.tar.zst` (`runtime/node.exe` from Node's
pinned Windows zip, `app/` with better-sqlite3's `prebuilds/win32-<cpu>.node` and
`@node-rs/argon2-win32-<cpu>-msvc` from the npm registry, checked against pnpm-lock.yaml),
`xdesign-<version>-windows-<cpu>.exe` (`GOOS=windows`, the Linux file's flags and stamps) and
`xdesign-<version>-windows-<cpu>.zip` (the file alone, `zip -X -9`, the commit time in UTC). Phase 1
checks the Windows pins and `zip` and `unzip`. The payload's names are checked for what Windows
refuses (names that differ in case only, device names, `< > : " | ? * \`, a final dot or space). The
proof reads the .exe: `file` names a Windows console program of the CPU, the .exe holds the payload
byte for byte and its stamped SHA-256, and the payload holds `runtime/node.exe` alone and the two
Windows native modules, all Windows programs of the CPU; the zip holds the .exe alone. `xdesign
release-files` on Windows writes `xdesign.exe` and finds the running file with `os.Executable`.

## 11. What stays as it is

- The website's look, the editor (apart from the map's lines), Try it, the checks, the export and
  import formats, the Claude tools (apart from the members' actions and Activity's paging).
- Settings > HTTPS keeps one certificate (Q-63) and its domain part; Activity keeps its filters and
  1 year (Q-64).
- The Linux server, its installer (apart from the owner's username), its updates and backups.
- Two-factor sign-in, "Confirm it's you", "Ask first", API keys and connected apps.

## 12. Tasks, waves and agents

| Task | What | Agent |
|---|---|---|
| USER-01a | Section 3.1 to 3.3 and 3.7's app command in the server: the migration (`username`, no `email`, no invites and resets), usernames made from Names at start with Activity, sign-in by username, `PATCH /api/me` with the owner's username, the commands `init-owner`, `reset-password`, `reset-2fa`, `list-users`, the two-factor label. | Opus, effort xhigh |
| USER-01b | Section 3.4 and 3.6 in the server: `addMember`, `setMemberPassword`, `changeUsername`, the invite and reset routes removed, the search, "People with access", Activity, the action list and the guide. After USER-01a. | Opus, effort xhigh |
| USER-02 | Sections 3.3 to 3.6 in the web: sign-in, the Members page and its dialogs, the Account page, the old links' pages, the Share search, the mention picker, the top bar, Activity's words. After USER-01b. | Opus, effort xhigh |
| USER-03 | Section 3.7 in the helper: the installer's questions and flags, the end block, the `admin` commands' arguments and words. On USER-01a's contract (`init-owner --username`). | Opus, effort xhigh |
| PERF-01 | Section 4: the map's boxes render once per change, batched measuring, menus and dialogs mounted when first opened. | Opus, effort xhigh |
| MAP-10 | Section 5.1: the selected step's lines bold with labels, the rest faded, hover. After PERF-01. | Opus, effort xhigh |
| MAP-11 | Sections 5.2 and 5.3: short tags, "N come here", "Back", the Lines switch and `users.map_lines` (migration). After MAP-10 and USER-01a. | Opus, effort xhigh |
| ACT-01 | Section 6: the server's paged activity with `total`, xWriter's pager in the web, the MCP action. | Opus, effort xhigh |
| SSL-04 | Section 7.5: wildcard through Cloudflare, the view's new fields, the routes' schemas. | Opus, effort xhigh |
| SSL-03 | Sections 7.1 to 7.4: the card, the Issue window, the Upload window, Remove. After SSL-04. | Opus, effort xhigh |
| DOC-M14 | Fold the M14 notes: 05 (accounts), 04 (map, Activity), 07 (installer, HTTPS), the user guide, "As built (M14)", status. | Sonnet, effort high |
| BUILD-01 | Section 10's menu and flags in `build.sh` and `make release`, with the Linux server as today; the slots the Windows and desktop targets fill. | Opus, effort xhigh |
| WIN-01 | Section 8.8: the build tags and `internal/platform`, Windows stubs where later pieces fill in, `make helper-check` for Windows. | Opus, effort xhigh |
| WIN-02 | Section 8.2's app channel: loopback ports and secrets in the front and the control server, the job object and stopping by standard input in the helper; `XD_PROXY_SECRET`, `XD_CONTROL_URL`, `XD_CONTROL_SECRET` and `XD_STOP_ON_STDIN` in the server. After WIN-01. | Opus, effort xhigh |
| WIN-03 | Section 8.2's service and logs: `serve` as a Windows service, the log files and `xdesign logs`, the daily backup inside `serve`. After WIN-01. | Opus, effort xhigh |
| WIN-06 | Section 8.5: backups and restore on Windows, `status`. After WIN-01. | Opus, effort xhigh |
| WIN-04 | Sections 8.3 and 8.7's uninstall: the installer on Windows. After WIN-02 and WIN-03. | Opus, effort xhigh |
| WIN-05 | Section 8.6 and 8.7's commands: the maintenance service, updates, the junction switch, the guard, rollback, set-port, set-path, the domain change, the "System" check row (helper and web). After WIN-04. | Opus, effort xhigh |
| WIN-07 | Section 10's Windows server target in `build.sh`: Node's Windows build, the native modules, the payload, the PE proof, the zip. After BUILD-01 and WIN-01. | Opus, effort xhigh |
| DOC-M15 | Fold the M15 notes: 07 (a Windows part), the user guide's install chapter for Windows, "As built (M15)", status. | Sonnet, effort high |
| DESK-01 | Sections 9.3 and 9.6 in the server: desktop mode, the one person, the key and `/api/desktop/enter`, the refused routes, `mode`, the port. | Opus, effort xhigh |
| DESK-02 | Section 9.5 in the server: the desktop backups, their routes, the automatic ones, restore with the shell's restart. After DESK-01. | Opus, effort xhigh |
| DESK-03 | Sections 9.4 to 9.6 in the web: what desktop mode hides, the Account page, the Backups page, the Claude card's address. After DESK-01 and DESK-02. | Opus, effort xhigh |
| DESK-04 | Sections 9.2 and 9.7 in `apps/desktop`: the Electron shell, the server child, the window, the menus, single instance, the data folder, the key. After DESK-01. | Opus, effort xhigh |
| DESK-05 | Section 10's desktop targets: electron-builder, Node and the native modules per system and CPU, the portable exe, the AppImage, the macOS zip with `rcodesign`. After BUILD-01 and DESK-04. | Opus, effort xhigh |
| DOC-M16 | Fold the M16 notes: 02 and 07 (the desktop form), 04 (its screens), the user guide's desktop chapter, D-01's note, "As built (M16)", status. | Sonnet, effort high |

Waves (at most 8 agents at once; one task that changes the database per wave):

1. USER-01a (migration), USER-03, PERF-01, ACT-01, SSL-04, BUILD-01, WIN-01, DESK-01.
2. USER-01b, MAP-10, SSL-03, WIN-02, WIN-03, WIN-06, DESK-04, WIN-07.
3. USER-02, MAP-11 (migration), WIN-04, DESK-02, DESK-05.
4. WIN-05, DESK-03, DOC-M14.
5. DOC-M15, DOC-M16.

M14 is 10 Opus runs, M15 8, M16 5: 23 Opus coding runs and 3 Sonnet runs (each DOC may be split
in two, as DOC-M13). With the usual continuations, most likely in WIN-04, WIN-05 and DESK-05,
about 26 to 29 Opus runs. The lead measures PERF-01 after its merge (section 4). M14 comes first
for the owner's server; M15 and M16 share waves because they touch different code (the helper; the
server's desktop mode, `apps/desktop` and the web).

## 13. Hand tests

On the owner's server, after a new build (`./build.sh`, Server, Linux) and Maintenance > Update:

1. USER: sign in with the username the update gave (Members shows them all; "MmD" became "mmd").
   Change a member's username; "Add member" with "Generate", sign in as them in a private window;
   "Set password" for them: the private window is signed out and the new password works. The
   Account page: your username changes, a member's is read-only. An old invite link says it no
   longer works. Activity names each change.
2. PERF-01: open the big design: the map shows within a few seconds and responds at once.
3. MAP: select "Check the card": its 8 lines bold with their names, the rest faded. "Short tags":
   "Invite friends" shows "⤴ Main menu"; click it, then "Back". "Main menu" shows "29 come here";
   open the list and jump to one. Switch to "All lines" and back; reload: the choice stays.
4. ACT-01: Settings > Activity: pages, "Rows per page", a filter goes back to page 1, reload keeps
   the page.
5. SSL: Settings > HTTPS in the new look: the row, the bar, the pill; "Issue certificate" with
   Wildcard and the Cloudflare token; "Upload certificate" with "Load file..."; "Remove
   certificate" goes back to the built-in one; issue again.

On a new VM (O-01): 6. `sudo ./xdesign --install`: "Owner username [owner]:"; the end block shows
"Username: owner"; `sudo xdesign admin reset-password owner`.

On Windows (O-03), with the files of `./build.sh` (Server, Windows, both CPUs where a machine
exists):

7. WIN: on Windows Server 2022, `xdesign.exe --install` in an Administrator terminal with a
   domain: the questions, the firewall rule, Let's Encrypt over port 80 (and with IIS on port 80:
   the reason and Cloudflare); the site opens at the printed address; `Get-Service xdesign`;
   restart Windows: the site comes back. Make a backup in Maintenance and download it; update to a
   newer build from Maintenance (the four steps; "System: Windows"); a Linux file is refused;
   `xdesign rollback`; `xdesign logs -f`; `xdesign --uninstall` keeping the data, then install
   again with the backup. The same install on Windows 11.

The desktop app (the files of `./build.sh`, Desktop app, All):

8. DESK: on Windows 11 run the portable exe ("Run anyway" the first time): xDesign opens in its
   own window with no sign-in; make a design from a template, Try it, Export, Print; History and a
   comment; close and open again: everything is there. "Make a backup now", change a design,
   "Restore": it is back. Account > Claude: add the key to Claude Code on the same PC and ask it to
   list the designs. Open `http://127.0.0.1:47823/` in a browser: "Open xDesign from its app."
9. The AppImage on this Linux desktop: the same in short. On a Mac if one is at hand (O-04): the
   zip, right-click > Open.

## As built (M14)

**USER-01a** (2b002e8), usernames, the rename and the removals. Two migrations make the change:
0011 drops `invites` and `password_resets` and adds `users.username` (nullable) with a unique index
on `lower(username)`; 0012 drops the index on `lower(email)` and the `email` column. Neither
rebuilds a table, so no row of another table is touched. `openDatabase` (the server, `migrate` and
every command) gives each account without a username one right after the migrations, in one
transaction: oldest account first (created_at, then id), the rule of section 3.2, and a row
`username_given` with the detail `{ memberId, name, username }` and no person, which Activity shows
as "The site": "Gave <name> the username <username>". The column stays nullable in the database;
the code types the username as a string (an empty string stands in for the null no account has
after the fill). Sign-in accepts any text of 1 to 200 characters as the username ("Enter your
username." when empty), trimmed and lowered, so a mistyped or old email answers only "Username or
password is wrong." `PATCH /api/me` refuses a username from anyone but the site owner with 403
"Only the site owner changes usernames.", a used one with 409 "Someone on this site already uses
this username.", and writes `username_changed` ("Changed the username of <name> from <old> to
<new>"). The Account page shows "Username" read-only with the hint for everyone, the site owner
too, until USER-02. The Share dialog's line under "Add people" reads "Not on the site yet? Ask the
site owner to add them." The old link pages are a card titled "Invite link" or "Password reset
link" with the sentence of section 3.4 and a full-width "Go to sign in". Activity's failed sign-ins
read the `username` of the detail, or the `email` of a row from before the update. `make dev`'s
owner is the username "owner" named "Owner"; `dev-owner.txt` holds the username and the password,
and every dev start prints "Dev owner: <the site owner's username> / <password>" (an old file's
email line is not shown). The words of the four app commands are in 07's "As built (M2)". A
rollback without its data breaks sign-in: `SCHEMA_FLOOR` in `tools/release/compat.env` must be the
first M14 version at release.

**USER-01b** (9ab7df8), the three member routes. `addMember` makes the account at once, never
expiring, with the next person color; it checks the common-password list first, then makes the
hash, then checks the username with nothing awaited before the insert, so two adds of one username
cannot both pass. Activity `member_added` has the detail `{ memberId, name, username }`.
`setMemberPassword` refuses the caller's own row with 400 "Change your password on the Account
page.", replaces the hash, ends every session and sign-in step of the member (live editing closes
their connections, as for "Disable") and writes `password_set` with `{ memberId, name, username }`;
a member removed while the hash was made answers 404. `changeUsername` writes `username_changed`
with `{ memberId, name, from, to }` as the owner's own change on the Account page does, and also
takes the site owner's own row. All three are for the site owner only (401 `not_signed_in` signed
out, 403 `no_access` for anyone else; a body that fails its schema answers 400 `bad_request` with
the first problem as "<field>: <text>"); `addMember` and `setMemberPassword` need "Confirm it's
you" (403 `confirm_needed`). Through Claude: `addMember` is marked change and `setMemberPassword`
change and asks first; both need "Confirm it's you", so both ask first ("Add a person to the site,
"<name>" as <username>?" and "Set the password of a person, "<name>"?"; the password is never in
the question), and `changeUsername` runs at once. The guide for AIs (`xdesign://guide`) has a
section "Members": only the site owner manages members, there are no invite or password reset
links, addMember with a username, a name and a password given to the person, setMemberPassword
(signed out everywhere, they keep it), changeUsername (the password stays), the username rules, and
updateMe for one's own name. The sign-in limit was left as it was here; USER-02 clears it.

**USER-02** (e966e10), the member dialogs and the owner's username. The Members page loads every
member (`GET /api/members`), so its search box filters the loaded list in the browser: a member
matches when the Name (ignoring case) or the username holds the typed words, a typed "@" before a
username included; nothing matching shows "No member matches.". The box has the placeholder "Name
or username" and the label "Search members by name or username", as the Share dialog's. The member
menu starts with "Set password" (on the site owner's own row "Change your password on the Account
page", which opens the Account page) and "Change username"; the site owner's own row, which had no
menu, now has these two items only. "Add member" and "Set password" check the fields first (the
username rules, the name, at least 10 characters), then ask "Confirm it's you" every time ("Adding
a member needs your password.", "Setting a password needs your password.", the button "Add member"
or "Set password"), then call the route; a username in use shows under the Username field, any
other refusal ("This password is too common. Choose another one.") above the buttons, and the
dialog stays open. "Change username" opens with the member's username filled in and closes when it
is saved, with no toast; the site owner's own username changed there also shows at once in the top
bar. The password field is the password with an eye button inside it (accessible name "Show the
password", pressed while shown), "Generate" inside it (20 characters of a to z, A to Z and 0 to 9
from `crypto.getRandomValues`, shown at once), and "Copy" beside it (off while the field is empty).
On the Account page the site owner's "Save" of the username shows the toast "Username saved."; a
username in use shows under the field. "Set password" also forgets the failed sign-in tries of the
member's username and the same tries counted for the addresses they came from, so a member locked
out by 5 wrong tries signs in with the new password at once; the address's tries for other
usernames stay.

**USER-03** (b224f81), the installer's owner username and the `admin` commands. The installer asks
":: Owner username [owner]:" (Enter takes "owner"; an answer is trimmed and lowered; "A username
has 3 to 32 characters." or "Use letters a to z, digits, dots, underscores and hyphens, starting
with a letter or a digit." asks again) and ":: Owner name:". The summary's owner fact reads "<Name>,
username <username>, with a password made now and shown at the end", or "username <username> (the
site has its owner)". `--owner-username NAME` is checked by the same rules ("--owner-username "x":
A username has 3 to 32 characters."); given without `--owner-name` it is a usage error
("--owner-username needs --owner-name"). `--yes` on a site without an owner needs only
`--owner-name` ("--yes needs --owner-name: the site has no owner yet"); a dry run without it plans
the username with the name OWNER_NAME. The owner step runs `init-owner --username <username> --name
<name>`; the step's fact for a site with an owner is "the site has its owner, <username>". The end
block shows "   Username: <username>" and, in a repair, "   Password: unchanged (sudo xdesign admin
reset-password <username> makes a new one)"; the failure block after a made owner shows the facts
"username" and "password"; the `--json` result carries `username` instead of `email`. Standard
input ending at a question says "Run the installer with --yes and --owner-name to install without
questions". The `admin` commands pass the username as typed (the app matches it ignoring case and
surrounding spaces); their `-h` texts say "the person with this username" and list-users'
"username, name, ...".

**PERF-01** (74f050c), the big design's slow open. The boxes read the design through a store of the
map (`map/shown.ts`): each box picks what it shows of the rest of the design (a variable's name, a
part's buttons, another step's title, in the language shown) with `useShown`, and renders again
only when that pick changes; `useDesign` and `useLang` are no longer read inside a box.
`buildNodes` keeps one node per step object while its place, size, selection and editing state are
the same, and the box (`OverlaidBox`) is memoized, so on open a box renders twice: when it mounts
and when React Flow first measures it. A box asks React Flow to measure its dots again only after a
change, never on mount; the requests are collected and sent once per frame. The "..." menu is a
plain button until its first click: the menu is made then and opens a frame later, so it still
slides in; the note dialog is made at its first "Add a note" the same way, and the checks' tooltip
the first time the pointer comes over the dots (it then opens on the next move of the pointer). The
map's actions are one object for the whole time the map is open, and the boxes' click handler stays
the same while comment mode does, so a change of the design or of a measured size reaches no box
that did not change. What re-renders which boxes: an edit of one step, that box once (and once more
if its measured size changes), the other boxes only when what they pick changed; the language
shown, the boxes whose texts in it differ; selection, the boxes whose selected state changed;
read-only or the role changing, every box; other people's selections, the checks' badges, comment
pins and Try it's path only the overlay parts (`BoxOverlay`, `PathMark`). Whatever a box shows from
a selection or a hover goes on the node's `className` or `style`, or in an overlay read through a
context or store, never in `data` or as a value read with `useDesign` inside a box.

**MAP-10** (0f3c379), the selected step's lines with names. Selecting a box (a click, Shift and a
click, a box dragged around several, or the phone's selection) draws every line out of it and into
it bold in the brand color, its arrowhead too, with a label at its middle, and fades every other
box, line and label to 30%; sections do not fade, and the boxes at both ends of a lit line stay at
full strength. Selecting only notes or sections fades nothing. A label is the button's text, or the
name of the outcome, the case or the dot ("Then", "Valid answer", "Wrong 3 times", "Cancel",
"Otherwise"), cut at 24 characters with "..." (outcome and case names too; "No text" for a button
without text), followed by the click mode ("· Edit", "· New", "· Replace") and the bell; it sits on
a pill of the map's background with a brand border, over every line. Hovering a dot, the row of a
labeled dot or a button's pill draws its one line the same way and outlines its target box like a
selected one, with or without a selection; hovering a line shows its label only. A line picked with
a click is lit too, without the fade. Lit lines lie over the faded boxes; the lines of a selected
box stay under that box. A selection or a hover renders no box again: the classes go on React
Flow's node and edge wrappers and on the map, and only the nodes and edges whose state changed get
new objects. The place to build on is `map/lines.ts` (`linesOf`, `lightLines`, `arrowLabel`,
`arrowEdges`, `lineAt`, `boxClass`).

**MAP-11** (a5641ba), short tags, "N come here", "Back" and the Lines switch. In "Short tags" a line
is a tag when its target is in a section and its source is not in that section, when its target has
5 or more lines in, or when the middle of its box's right edge (by the measured size) is more than
1,600 map pixels from its target's dot. The tags of a box's row (a row of buttons, else one labeled
dot) sit together right of the box at the row's height, in the row's order: a pill with an arrow
and the target's title (20 characters, then "..."), its border in the lines' gray (dashed for a Go
to box's line, the brand color for a line Try it took); they lie over the lines and boxes, under
the lit labels, and fade with the rest while a step is selected. Every lit line is drawn in full
with its label, never as a tag: the selected steps' lines, a picked line, and the line of the dot
or button under the pointer (as MAP-10 draws it). The tooltip says "Goes to <title>" and, for a
target in another section, "(<section>)". A click on a tag, or on a row of "Comes here from",
moves the map to the box as search does and selects it; "Back" (with an arrow, first in the map's
tools) returns to the view and the selected boxes before the jump, one place at a time, up to 10,
and goes when the person drags or scrolls the map, uses the minimap, the zoom buttons or "Fit"
(Auto-arrange fits too). "<N> come here" sits between the title and the "..." in the header of
every box with a line in drawn as a tag; it follows the switch, the design and the sizes, not the
selection, so it stays on a selected hub. "Comes here from" lists the lines in map order (left to
right, then top to bottom, as search), each as the source step's title and the line's label (24
characters, then "...", as on the lines). The switch "Lines: Short tags | All lines" is the last
of the map's tools, after "Auto-arrange", and works read-only too; a change shows at once and is
saved with `PATCH /api/me` as `mapLines` (`users.map_lines`, migration 0013, `short` by default; a
failed save goes back to the saved choice with the error as a toast). A view-only link's page
starts with "Short tags" and keeps a change while its map is open. A selection, a hover or a jump
renders no box but the selected ones: the tags are edges in React Flow's label layer, and only the
boxes whose "<N> come here" changes render again (after a change of the design, the sizes or the
switch).

**ACT-01** (436c2ce), Activity in pages. Settings > Activity has the pager under the list: "Rows
per page" (10, 25, 50, 100; 25 to start, kept in this browser under `xdesign.rows.activity`), "Rows
26 to 50 of 312" ("Row 313 of 313" when a page holds one row), then "Previous", the page numbers
and "Next". Up to 7 pages every number shows; beyond that the first and last page, the open one
with its neighbours and "..." gaps, always 7 items. The open page is marked and is the address's
`?page=3` (page 1 leaves it out); opening a page adds a history entry, so Back returns to the page
before; a change of a filter or of the rows per page goes back to page 1 in place of the open
entry. A page past the end (an old link, a shorter list) shows the loading rows and then the last
page. Opening a page keeps the scroll, and brings the top of the list into view when it was above
the screen. The pager does not show while the list is empty. `GET /api/activity` has `page` and
`size` with defaults (1 and 25), so the MCP action `activity` can leave them out; an invalid page
or size answers `bad_request` ("Use page 1 or later.", "Use a lower page.", "Use 10, 25, 50 or
100."). The pager is `apps/web/src/components/Pager.tsx` with `usePager.ts`, for later lists too.
Rows are still kept 1 year; nothing in the pruning changed.

**SSL-03** (bd82788) with SSL-04 (folded into it), the HTTPS card in xmtp-panel's look. Settings >
HTTPS is xmtp-panel's SSL manager for one certificate. The row shows the method the owner chose:
its chip is HTTP-01, Cloudflare DNS-01, Wildcard (the Cloudflare method when its names hold a `*.`
name), Uploaded, Files on this server or Built-in; the issuer under it is "Let's Encrypt" for a
Let's Encrypt certificate, else the organization (or common name) of the certificate's issuer, and
the full issuer is the title. While the method's own certificate is not served (the built-in one is
served in its place) no issuer shows and Expires says "Not issued" for Let's Encrypt, "-" for an
upload or files that cannot be used (the pill and the last error say why). The status pill comes
from the helper's state: issuing "Issuing", renewing "Renewing", failed "Issuance failing", expired
"Expired", unreadable "Files unreadable", a Let's Encrypt certificate with failures "Renewal
failing", an uploaded or file certificate within 30 calendar days "Expires soon", else "Valid". The
note is "Renews from <date>" or "Next attempt <date and time>" for Let's Encrypt, "Not
auto-renewed" or "Upload a renewed certificate" for an upload, none for files and the built-in one.
The expiry bar is the share of the certificate's life left (at least 4 percent), red when expired
or failing, amber when a third of an issued certificate's life is left or an upload or file
certificate has 30 days or fewer; its words are "62 days", "Expires today", "Expired 3 days ago",
or hours when less than a day is left. "Last error" is the helper's last problem, else the served
certificate's problem (red or amber); the open toggle shows the whole text and the last 8 log
lines; while Let's Encrypt works the last 8 lines show under the row. "Try now" shows for a Let's
Encrypt or file method with a last problem, a served certificate's problem, or the state failed,
expired or unreadable. The header buttons and Replace and Remove are off while Let's Encrypt
works. The Issue window starts on the method in use when it is Let's Encrypt (Wildcard included),
else on Cloudflare DNS-01 when a token is saved, else HTTP-01, with the site's domain; a typed
`*.` is dropped from the domain. Its description is "The site keeps its current certificate until
the new one is issued." Wildcard sends `letsencrypt_cloudflare` with the names `*.<domain>` and
`<domain>`: no `wildcard` field was added, as the helper already takes a `*.` name with the
Cloudflare method. The result follows the card's view (read every 2 seconds while Let's Encrypt
works); a refusal of `PUT /api/https` is shown as "The certificate was not issued" with the
helper's words. The Upload window starts on "Files on this server" (with the paths in use) when
the method in use is the file method, else on "Paste or load file"; "Replace" always starts on the
paste tab. Whether an upload replaced an earlier one is known in the browser from the method
before it, so the view has no `replaced` field. The stored answer says "Covers <names>." and
"Issued by <issuer>, expires <date>.", the left-out certificates with xmtp-panel's reasons, the
Self-signed warning, and "It does not cover <domain>" against the site's domain; the files tab
gives the same answer. Remove asks "Remove the certificate?", then "Confirm it's you", then chooses
`builtin`. There is no check of port 80 in the window before an HTTP-01 issuance: the running
helper has no such check short of an issuance (only the installer, as root, probes it), so the
helper's own port 80 check fails within about 20 seconds, before Let's Encrypt is asked, and the
window shows its reason. The Status card and Activity's words still say "A pasted certificate".

**The lead's measurement.** After PERF-01 (production build, `.dev/m14/perf/open.mjs`, two runs) the
first box showed in 0.6 to 0.7 s and the longest task was 246 to 275 ms, where it had been 19 to 37
s; the target was met. The map then drew 68 boxes and 149 lines at fit. After MAP-11 and the rest
of main (two runs) the first box showed in 1.0 to 1.3 s, the longest task was 461 to 548 ms and the
long tasks added up to 1.1 to 1.4 s: within the target (no task over 1 second, usable within 3
seconds), slower than PERF-01 alone because of the tags.

**The lead's fix and the new sanity step.** Since DESK-02, fflate's `createRequire` collided with
the esbuild banner, so the server bundle built but did not start; the PERF re-measure found it and
the lead fixed it. `make sanity` has a new step, `start-check` (after `build`, nine steps in all), which
starts the built server bundle (`apps/server/dist/server.mjs`) on a free loopback port with an
empty data folder, once as a server and once in the desktop app's mode, and waits for `GET
/api/health` to answer 200, so a bundle that builds but does not start fails there.

## As built (M16)

**DESK-01** (23ec6b8), the server's desktop mode. `XD_DESKTOP=1` is set by the app's shell with
`XD_DESKTOP_KEY` (64 lower-case hex, required; a missing or malformed key stops the start with "The
environment is not valid"), `XD_DESKTOP_PREFERRED_PORT=47823` and `XD_STOP_ON_STDIN=1`;
`config.desktop` is `{ key, preferredPort }` or null and `config.mode` is `desktop` or `server`
(`apps/server/src/config.ts`). At start, before the migrations, a connection of its own reads the
settings row `newestVersion` (the newest xDesign that opened the database); a version newer than this
build writes `xdesign-desktop-error: These designs were saved by xDesign <version>. Use that version
or a newer one.` as the last line on standard error and exits with 78 (`dataFolder.ts`, called from
`main.ts`; DESK-02's restore goes in place just before it, and a restore ends the server with 75).
Then the database opens, `newestVersion` becomes this version when it is newer or missing, and
`ensureDesktopPerson` makes the one person when there is no site owner: username "me", the Name from
the computer's user name without control characters and cut to 100 characters (else "Me"), site
owner, the argon2 hash of a random secret nobody is told, all before the server listens.
`GET /api/desktop/enter` (desktop mode only; a server answers 404 `not_found`; no HEAD) compares the
header `X-Xdesign-Desktop` with the key in constant time (their SHA-256 with `timingSafeEqual`): the
right key starts a session for the site owner (the browser's previous session ends) and answers 302
to `/` with `Cache-Control: no-store`; a wrong or missing key answers 403 with the page "Open xDesign
from its app." (HTML, centered, light or dark as the system is). No Activity row, and the header is
hidden in logs. In desktop mode index.html goes only to a request with a session, else the same 403
page, so a browser on the PC sees nothing else; the built files are served as before and the API
answers 401 `not_signed_in` as on a server. `GET /api/health` answers `{ ok, version, mode }` and
`GET /api/me` answers `{ user, mode, desktop }` with `desktop` `{ port, preferredPort }` or null on a
server (`packages/api/src/common.ts`, `routes/site.ts`, `routes/auth.ts`). The refused routes are
listed once, as `notInDesktop(key)` in `packages/api/src/desktop.ts`: whole route files for members
(also USER-01b's three), https, maintenance and view-only links, and route keys where an area is
mixed (sign-in, sharing, settings' update and Activity, Claude's links, connected apps and
connections); the OAuth endpoints and `/.well-known` documents are refused by path. One `onRequest`
hook (`refuseNotInDesktop`) added before the routes answers 404 `not_in_desktop` "Not in the desktop
app." with `Cache-Control: no-store` before any sign-in or role check (HEAD as GET), so the
OAuth endpoints, which are not routes of `@xdesign/api`, are covered too. Kept: designs, comments,
media, versions, templates, API keys, `updateClaudeConnection` (the Account page's "Ask first" switch
of a key; `claudeConnections` and `revokeClaudeConnection`, Settings' card, are refused), live
editing and `/mcp`. In desktop mode the refused routes are not Claude's actions (`xdesign_find_actions`
does not list them; describing or running one answers `not_in_desktop`), and `/mcp` takes API keys
only, its 401 without `resource_metadata`. With `XD_STOP_ON_STDIN=1` the end of standard input runs
the same stop as SIGINT and SIGTERM and exits 0. The lead accepted the list, the gate on index.html
(needs a session in desktop mode) and the kept `updateClaudeConnection`, and told DESK-03 to keep
`mode` and `desktop` when the web stores `{ user }`.

**DESK-02** (14c49de), the desktop app's backups in the server (desktop mode only;
`apps/server/src/desktop/backups.ts`, routes in `routes/desktopBackups.ts`, the zip writer and strict
reader in `desktop/zip.ts`, the contract in `packages/api/src/routes/desktopBackups.ts` with
`onlyInDesktop(key)`). A backup is `<userData>/backups/xdesign-backup-<UTC YYYYMMDD-HHMMSS>.zip`
(0600, folder 0700), written as `.partial` and renamed: `backup.json` first (`{ version, createdAt,
kind, files }`, `kind` `automatic`, `manual` or `beforeRestore`, each file with its size and
SHA-256), `xdesign.db` copied with better-sqlite3's online `backup()`, then `media/<2 hex>/<SHA-256>`
(only the media store's own files). The database copy and the media are read twice, once for
backup.json and once into the zip, and a file that changed between the two stops the backup. The
oldest beyond 14 go (every kind); one backup, restore or deletion runs at a time. fflate writes no
ZIP64, so a backup holds at most 65,000 files and 4,000,000,000 bytes, else 413 `too_large` "The
designs and their files are over 4 GB, too large for a backup." The job `desktopBackup` checks every
hour (the first a minute after the server listens) and makes an `automatic` backup when the newest of
any kind is 24 hours old or there is none (the lead accepted this count). The seven routes under
`/api/desktop/backups` (list with `running`, make, download as an attachment, delete, restore a
named backup, restore an uploaded file, open the folder) are for the site owner, without "Confirm
it's you" and without Activity rows; a server registers none of them and answers 404. A restore
reads the zip from its central directory (no ZIP64 or encryption, plain files, each named once,
`backup.json` first and valid, the other entries exactly its files), and anything else answers 400
"This is not an xDesign backup." (the reason goes to the log); a newer xDesign's backup answers "This
backup is from xDesign <version>. Use that version or a newer one." It then unpacks into
`<data>/restore-staging.partial/` checking each file against its size and SHA-256, makes the
`beforeRestore` backup (so a refused file costs no backup, and the lead accepted this order), renames
the folder to `<data>/restore-staging/`, answers, and stops the server as on a quit with exit 75, at
the latest 5 seconds later. At the next start, before the data folder's version check, `*.partial`
leftovers go and a staged restore replaces `xdesign.db`, its `-wal` and `-shm` and `media/` through
`<data>/restore-replaced/`, each move only when its target is free, so a swap cut short by a crash
goes on at the next start. The folder opener runs `explorer`, `open` or `xdg-open` detached without a
shell and answers 500 "The backups folder could not be opened." when it cannot start. Claude has
`desktopBackups`, `makeDesktopBackup`, `deleteDesktopBackup` and `restoreDesktopBackup` (the last two
ask first) in the area `maintenance`; the file actions and `openDesktopBackupsFolder` are hidden, the
latter with the new reason `window` ("This action opens a window on the person's computer: they do
it in the desktop app."); on a server the four are no actions.

**DESK-03** (4d54037), the web in the desktop app. The web reads `mode` and the ports once per page
load, from `GET /api/me` or, without a session, `GET /api/health` (`apps/web/src/app/session.ts`:
`inDesktopApp`, `desktopPorts`, `hasRoute`, `requireRoute`, `setMeUser`), and shows what the server's
routes allow, from `notInDesktop` and `onlyInDesktop` of `@xdesign/api`, not from a list of its own.
In the app there are no Members, Settings and Maintenance, no "Sign out" or "@username", no "Share"
(the editor and a design card's menu), no chip "Shared with me" (the lead accepted it hidden), and
the Account page has only "Name", the color and the Claude card (API keys with "Ask first" and
"Revoke", the `claude mcp add` command with `http://127.0.0.1:<port>/mcp` and the line for other MCP
clients, and the notice when the port is not the preferred one); the pages the app lacks go to
Designs, and on a server `/backups` goes to Designs. A session that ends in the app (401) loads the
window again instead of opening the sign-in page. The cached `me` answer keeps `mode` and `desktop`
when a name, username, color or theme change merges the new `user`, and a sign-in stores `{ user,
mode: "server", desktop: null }`. The Backups page (`routes/_app/backups.tsx`, `desktop/backupFile.ts`)
has the title with "Open the backups folder", "Restore from a file..." and "Make a backup now", the
line "A backup is made every day while xDesign runs; the last 14 are kept." (accepted), the list with
the kinds "Automatic", "Made by hand" and "Before a restore", "Restore", "Save a copy..." and
"Delete", and "Restoring... xDesign starts again in a moment." once a restore is taken; the question
of "Restore from a file..." names the time read from the zip's `backup.json` in the browser through
its central directory, and a file that cannot be read says "This is not an xDesign backup." without
being sent. The words of every question and toast are in section 9.5.

**DESK-04** (3a24f91), the Electron shell, `apps/desktop` (the main process only: no preload, and no
files besides `dist/main.mjs` and `package.json`; `src/main.ts`, `server.ts`, `window.ts`, `pages.ts`,
`menu.ts`, `log.ts`, `paths.ts`, `identity.ts`). `identity.ts` holds the name "xDesign", the app id
`io.github.sir-mmd.xdesign` and the main script `dist/main.mjs` for electron-builder, and
`package.json` repeats the name (`productName`) and the main script (`main`). The data folder is
`<appData>/xDesign` whatever the package is called, and Chromium's own files (cache, cookies, local
storage) go into `<userData>/session/`, beside `data/`, `backups/`, `logs/` and `window.json`, so the
folder the person opens stays readable. The server runs with the system's variables minus any `XD_`
variable and `NODE_ENV` of the app's own, plus the contract's, with the app folder as its working
folder and without a console window on Windows; it is stopped by closing its standard input and
killed after 10 seconds; exit 75 starts it again with a new key and loads the enter address again,
and exit 78 shows the server's own sentence. The shell writes its own lines into
`<userData>/logs/xdesign.log` (JSON lines with `"from":"desktop"`; a new file at 10 MB, 5 kept). The
window's own pages are `data:` URLs without scripts, and "Start again" is a link to
`xdesign-desktop:start-again` that the window's navigation guard catches: "Starting xDesign...",
"xDesign stopped unexpectedly.", the server's own sentence (exit 78), "xDesign did not start in 60
seconds." (the server is stopped first, so a second never runs beside a hung one) and "xDesign did
not start: <the system's error>", each with "Log: <the path>" and, except for exit 78, "Start
again". The window keeps the title "xDesign"; its first size is 1280 x 800 (within the main screen), at
least 1000 x 680, and a kept place is used when at least 200 x 100 of it is on a screen. It runs with
context isolation, sandboxed and without Node; it may use only copying to the clipboard and full
screen, only from the server's origin; spell checking is off (Chromium would download dictionaries).
`window.open` is always refused: http and https links of other sites open in the default browser, the
app's own address and other schemes go nowhere. On macOS "About xDesign" is in the app menu only. On
Linux a packaged window takes its icon from `<resources>/icon.png`. The shell expects
`<resources>/runtime/node` (`node.exe` on Windows) and `<resources>/app/`. A developer runs `make
build` (which now includes `make build-desktop`), then Electron on `apps/desktop` with Node.js from
`XD_DESKTOP_NODE` and the server from `XD_DESKTOP_APP`. esbuild is the server's version, 0.28.2, and
ESLint forbids `apps/desktop` to import the other packages and apps. The lead accepted the texts of
the problem pages and the place of Chromium's files. Electron could not run on the build computer, so
the shell was checked only by the type check, ESLint and the bundle until the lead's first run (the
test build below).

**DESK-05** (46499ed), the desktop files in `build.sh`. `check_desktop`, `build_desktop`,
`package_desktop`, `sign_macos`, `fetch_rcodesign`, `rcodesign_verify` and `prove_desktop` are the
desktop slot, and `stage_payload` (split out of `pack_payload`) stages the folder of `runtime/` and
`app/` for the server's payload and the desktop alike; `fetch_node` and `native_modules` gained macOS
(`node-<version>-darwin-<cpu>.tar.gz`, `NODE_SHA256_MACOS_<CPU>`, `prebuilds/darwin-<cpu>.node`,
`@node-rs/argon2-darwin-<cpu>`). The steps for each system and CPU are in section 10's "As built
(DESK-05)": "app files", "packaging" with electron-builder 26.18.1 and
`apps/desktop/electron-builder.config.ts` (Windows `portable` to `xdesign-desktop-<version>-windows-<cpu>.exe`,
Linux `AppImage` to `xdesign-desktop-<version>-linux-<cpu>.AppImage`, macOS the `dir` target), and for
macOS "signing": rcodesign 0.29.0 (downloaded once into `.dev/cache/rcodesign/` and checked against
`tools/release/desktop.env`) signs `xDesign.app` ad hoc, `rcodesign verify` checks its program, and
Info-ZIP zips it with its links kept (`-y`) into `xdesign-desktop-<version>-macos-<cpu>.zip`. Electron
45.2.3 is electron-builder's own download, cached in `.dev/cache/electron/` through
`electronDownload.cache` (electron-builder 26 no longer reads `ELECTRON_CACHE`) and checked offline
against a `SHASUMS256.txt-<version>` that build.sh writes from electron's `checksums.json` (build.sh
checks the zip's SHA-256 again and prints "Electron: PASS"); electron-builder's tools go into
`.dev/cache/electron-builder/`. No Wine is needed (accepted): electron-builder writes the .exe's icon
and file details with resedit, and a portable .exe has no uninstaller, the only step that runs Wine,
so R-349 is replaced. electron-builder copies the staged folder itself into `<resources>` (`to: "."`)
because it leaves out a `node_modules` folder at the top of a folder it copies, and `npmRebuild` is
off. The macOS app is the `dir` target signed and zipped by build.sh (accepted), so the signature is
inside the zip. Phase 1 checks electron and electron-builder in `apps/desktop`, Electron's SHA-256 in
`checksums.json`, Node's pin for each CPU and the tools (`unzip` and `7z` for Windows, `unsquashfs`
for Linux, `zip` and `unzip` for macOS, and for macOS the rcodesign pins). The proof does not run a
file: it unpacks it (`7z`, `unsquashfs` at the byte where the AppImage's ELF runtime ends, `unzip`)
and reads the header, Electron's program of the system and CPU, `<resources>/runtime` with Node.js
alone, `<resources>/app` equal to the staged folder (byte for byte for Windows and Linux, by name for
macOS, whose programs the signature changes), exactly the two native modules of the system and CPU,
`app.asar`'s package.json "xDesign <version> dist/main.mjs", `resources/icon.png` for Linux, and for
macOS the frameworks' links and `rcodesign verify` of `Contents/MacOS/xDesign` and
`Contents/Resources/runtime/node`. The summary labels each file "Desktop" and `SHA256SUMS` lists them
after the servers' files (Windows, Linux, macOS; amd64 before arm64), without a payload row.
`rcodesign verify` passes when the only problem it names is the missing CMS signature, which an ad hoc
signature has none of by design (accepted; the lead's fix 465aeb1 below adds verify's own warning). The icon is new,
because the website has none: a chat bubble holding a small map of three boxes on the site's blue
(`apps/desktop/build/icon.svg`, with `icon.png`, `icon.ico` and `icon.icns` made once with
rsvg-convert and icotool and kept as files); the owner is to approve it. The release notes template
has the desktop line in Files, the desktop paragraph in How to update and a note in Going back.

**The lead's test build** (2026-11-23). In a worktree of its own (`.dev/m14/buildtest`, so the owner's
`dist/` was untouched) the lead ran the real build. Run 1 (0.3.0, Windows server and three desktops,
amd64) built the Windows server, the Windows desktop file and the Linux AppImage, and stopped at the
macOS signature check: rcodesign 0.29.0 prints "known to be buggy" and counts the ad hoc signature's
empty CMS blob as a problem. Fix 465aeb1 makes the check skip those two lines; a changed byte still
fails with "code digest mismatch" (tried). Run 2 (0.3.0, Linux and Windows servers, three desktops,
amd64 and arm64) made all 14 files, `SHA256SUMS` and the release notes, and the proof passed for every
file. The Linux AppImage was run under `xvfb-run` with `XDG_CONFIG_HOME` in a scratch folder: the
window opened `http://127.0.0.1:47823/` already signed in (no sign-in page), showed the designs list,
"New design" opened the editor with "Saved" (live editing), and the first automatic desktop backup was
made; `window.close()` logged "stopping the server" and "server exited" with code 0, and no process was
left (Chromium's singleton socket fails with a very long `TMPDIR`, a test setup matter only). The
lead also read the AppRun that electron-builder 26.18.1 puts in the AppImage: it probes `unshare -Ur
true` and adds `--no-sandbox` when user namespaces are refused (Ubuntu 24.04's AppArmor rule), so
the AppImage starts there without Chromium's OS sandbox for its pages, which are only the app's own
local server's (the window keeps `contextIsolation` and `sandbox: true` in Electron's sense; R-388).
Not run: the Windows and macOS files, which need machines of their own (O-03 and O-04).

## As built (M15)

**BUILD-01** (3532094), `build.sh`'s platform menu. After the version the menu asks the questions of
section 10 with its texts: "What to build" (default 1), "Server for" only when a server is built
(default 1), "Desktop app for" only for the desktop app (default 4), then "CPUs" (default 3); it
replaces the old CPU question. A wrong answer prints "warning: the choice is 1, 2 or 3, not: <answer>"
(or "1, 2, 3 or 4") and asks again; an empty answer, or the end of the input, takes the default. After
the questions the checks print "servers: ...", "desktop app: ..." and "CPUs: ...". `--servers` and
`--desktops` take names separated by commas or spaces, or `none`; either one skips the questions of
what to build, and the one not given keeps its default (`--servers linux`, `--desktops none`), so
`./build.sh --desktops macos` builds the Linux server and the macOS desktop app, as `make release
DESKTOPS=macos` does. Both `none` stops with "nothing to build: --servers and --desktops are both
none". Without a terminal and without flags it builds the Linux server for both CPUs, as before.
`make release` runs `./build.sh --version "$VERSION" --servers "${SERVERS:-linux}" --desktops
"${DESKTOPS:-none}" --arches "${ARCHES:-amd64 arm64}"`. A build that was not ready stopped in the
checks, before anything was built and before `dist/` was cleaned ("error: The Windows server build is
not ready yet (WIN-07)." and the desktop one, until WIN-07 and DESK-05 filled the slots). The Linux
server is built as before; only its check of the per-CPU SHA-256 pins of `tools/release/node.env`
moved to `check_server_linux`. Build order: the servers (Linux, then Windows) for each CPU, then the
desktop app (Windows, Linux, macOS) for each CPU. The release files are a list the builds fill with
`add_release_file KIND NAME LABEL [PROOF [ARG...]]`: `SHA256SUMS` lists the packs (a release file alone
in a .tar.gz or .zip) first, then the files, each in build order; the notes' `{{files}}` and the
summary list them in build order; the notes' `{{payload_sha256}}` names each payload by system and CPU
(`linux-amd64`), or "none"; the proof checks `SHA256SUMS`, then runs each file's own proof in build
order (the file's run, then its tar.gz). Each system is a pair of functions under "The builds"
(`check_server_windows`, `build_server_windows CPU`, `check_desktop SYSTEM`, `build_desktop SYSTEM
CPU`); a build calls `advance` exactly `BUILD_PHASES[...]` times, and the bar's step count is 6 plus the
phases of every chosen build for each CPU (a Linux build for both CPUs still has 12). `clean_dist`
also removes earlier `xdesign-*-windows-*.exe`, `xdesign-*-windows-*.zip` and `xdesign-desktop-*` files.

**WIN-01** (9fe4fd5), the helper split for Windows. `helper/internal/platform` holds what differs
between the systems, with the same names in `_linux.go` and `_windows.go` files: `paths_*.go` (Linux:
`/opt/xdesign`, `/etc/xdesign`, `/var/lib/xdesign`, `/run/xdesign`; Windows: `C:\Program Files\xDesign`
with `releases` and the `current` junction, `C:\ProgramData\xDesign` with `config.toml`, `install.json`,
`data`, no run folder, and `logs\install.log`; Windows also names `CertsDir`, `BackupsDir`,
`MaintenanceDir`, `UpdateFailuresDir`, `LogDir` and `ServiceLog`, which Linux derives from `data_dir`),
`files_*.go` (`NoFollow`, `DiskSpace`, `TryLock`, `FileOwner`, `SyncAll`), `process_*.go` (the child)
and `system_*.go` (`Name`, `ErrAddrInUse`, `ErrAccess`, `ErrPerm`, `Machine`, `Version`);
`ErrNotYet` ("not available on Windows yet") was the Windows stubs' error. The Linux system calls of
host, guard, backup, status, maintenance, cli, front, ssl and install go through it, with Linux values
and messages unchanged; `certs` (standard library only) has its own `fileid_linux.go` and
`fileid_windows.go`; the control socket's `listen` moved to `server_linux.go`. The installer's Linux
step files stayed shared and compiled on Windows, with `systemSupported()` refusing each entry point
(install, update, rollback, uninstall, the domain and address changes, the restore's service) with
"<command>: not available on Windows yet"; WIN-04 and WIN-05 moved each file to a `_linux.go` file as
they wrote the Windows side. `DiskSpace` (GetDiskFreeSpaceEx), `TryLock` (LockFileEx) and `Version`
(RtlGetVersion) were real calls from the start, the rest stubs. `make helper-check` builds and vets for
linux/amd64, linux/arm64, windows/amd64 and windows/arm64 (`HELPER_TARGETS`) and runs golangci-lint with
`GOOS=linux` and `GOOS=windows`; the build and vet run per system and CPU, the linters once per system
(about 90 seconds with cold Windows caches).

**WIN-02** (0dd4bbe), the app channel on Windows. In the helper `platform.PrepareChild` returns a
`ChildProcess` (`Started`, `Stop`, `Release`): Linux keeps Setpgid and SIGTERM; Windows puts the process
in a job object with kill on job close right after its start, gives it a pipe on standard input and
`XD_STOP_ON_STDIN=1`, and stops it by closing the pipe (after 10 seconds Go's exec ends the process
and closing the job ends anything left). `control.Listen` returns an `Endpoint` with `AppEnv`, then
`control.Start`; with a secret every request needs `Authorization: Bearer <secret>` (401 JSON,
constant-time compare). On Windows the control server listens on 127.0.0.1:0 with a new 32-byte hex
secret, once per `serve`, and writes both to `C:\ProgramData\xDesign\control.json`
(`platform.ControlFile`; `.dev\run\control.json` for `--dev`; removed at a clean stop; the file takes the
folder's permissions). `internal/controlclient` (new) is the client for `xdesign status` and the
installer: Linux the Unix socket, Windows the control file's address with the bearer. The front picks at
each start where the app listens (`XD_SOCKET`, or without a socket a free loopback port and a new
32-byte hex proxy secret: `XD_PORT`, `XD_PROXY_SECRET`) and asks the health with the header; the proxy
removes an incoming `X-Xdesign-Proxy` and adds the secret. `internal/app`'s `channel_linux.go` and
`channel_windows.go` hold `appSocket`, `controlPath` and `devChannel`. In the server `config.ts` reads
`XD_PROXY_SECRET`, `XD_CONTROL_URL`, `XD_CONTROL_SECRET` and `behindFront`; `front.ts` answers 403 with an
empty body without the header in the first `onRequest` hook and `live/server.ts` does the same for an
upgrade; `helper/control.ts` speaks TCP with the bearer; the session cookie is Secure and X-Forwarded
headers are trusted on `behindFront`. The control port and secret are per `serve`, the app's per start
(accepted). The Windows code compiled and linted but had not run.

**WIN-03** (fbb7c55), `serve` as a Windows service, the log files, `xdesign logs` and the daily backup.
`helper/internal/app/serve_windows.go` runs `serve` under the service manager (`svc.IsWindowsService`):
Start pending, Running once the front's listener is open, Stop and Shutdown (Stop pending with a wait
hint of 30 seconds), the service-specific exit code 1 when `serve` fails, and the console's SIGTERM
(a user signing out) ignored; from a console it runs as on Linux. The installer must set the failure
actions, with failure actions on non-crash failures (`sc failureflag xdesign 1`), so that Windows
restarts the service after an error as systemd's `Restart=on-failure` does. `internal/logfile` (new)
writes the helper's lines and the app's output to `C:\ProgramData\xDesign\logs\xdesign.log`, each line
with its local time, through a writer per source, rotated at 10 MB with 5 files kept (renamed to `.0`
first, so a program holding the file leaves nothing lost); without its log file the service still
runs. `xdesign logs [-f] [--lines N]` (Administrator; `cmd_logs_windows.go`) prints the last lines
across the old files and with `-f` follows across a new file, opening the files with FILE_SHARE_DELETE
so it never blocks a rotation; on Linux it prints "Use journalctl -u xdesign (add -f to follow).". The
daily backup (`daily_windows.go`) runs inside `serve` outside `--dev`, with the Linux timer's
`Persistent=true` rule: 03:30 local time, the clock read every minute, a missed one made at `serve`'s
start (judged by the newest daily backup); it logs "daily backup made", "the daily backup failed" and
"next daily backup". Leftovers: `serve` starts `runtime\node.exe` on Windows, and `xdesign status`
asks the control server through `controlclient.New(platform.ControlFile)`. Nothing had run on
Windows.

**WIN-04a** (0bc41f1), the Windows installer, first part. `steps_windows.go` lists the Windows steps in
their order (1 Preflight checks to 13 Finish; no system user and no SELinux, the services after the
data); `steps.go` moved as it was to `steps_linux.go`. Preflight (`preflight_windows.go`) checks
Administrator, Windows 10.0 build 17763 or later (Server 2019 and Windows 10 1809), the system's own
CPU (IsWow64Process2, so an amd64 file on arm64 Windows is refused), 1 GB free, the clock (`w32tm`, a
warning only) and port 80's owner from GetExtendedTcpTable ("IIS or another HTTP.sys program" for the
System process); the system fact reads for example "Windows Server 2022 Datacenter (build 20348),
amd64". `system_windows.go` and `platform/security_windows.go` make `C:\ProgramData\xDesign` with its
permissions in one call, SYSTEM and Administrators full control, `NT SERVICE\xdesign` named by its SID
(`S-1-5-80-2098923330-2051758124-151170182-548055611-3226271214`, which Windows accepts before the
service exists) with modify on the folder itself, read on its files, modify on `data`, `backups`,
`maintenance`, `update-failures` and `logs`, and CREATOR OWNER modify on what is made inside
(`control.json`); the folders step refuses a link or a junction in a folder's place and checks each
folder with `SecurityMatches`. `files_windows.go` writes the release folder as on Linux and makes the
`current` junction with `cmd.exe /c mklink /J`; `platform/envpath_windows.go` adds
`C:\Program Files\xDesign\current` to the system PATH in the registry with WM_SETTINGCHANGE.
`service_windows.go` writes `config.toml` (with `config/header_windows.go`) and runs `migrate`,
`list-users` and `init-owner` as `node.exe app\cli.mjs` as the Administrator with `XD_DATA_DIR` and
`NODE_ENV`; the HTTPS method's first state, the install log (readable by SYSTEM and Administrators
only), the certificate step's control client (`control.json`) and the console (`cli/terminal_windows.go`:
terminal sequences turned on, echo off for the Cloudflare token, `cmd_install_windows.go`) follow;
`install.json` records `"os": {"id": "windows", "version_id": "10.0.<build>"}`. The messages name the
commands without "sudo". Until WIN-04b the installer stopped at step 9.

**WIN-04b** (e9cd324), the Windows installer, second part, and `--uninstall`. `services_windows.go`
makes `xdesign` (automatic with delayed start, `NT SERVICE\xdesign`, service SID type unrestricted,
failure actions 5 s, 5 s, 5 s then 60 s with a reset after a day, also for failures that are not
crashes) and `xdesign-maintenance` (manual, LocalSystem, no failure actions, a DACL that gives the
site's account only query status and start) through `svc/mgr`, compares every setting at each run and
records both under "services" in `install.json`; the start step runs Start-Service (Restart-Service in
a repair) and waits up to 45 seconds for Running and the health check, showing the last 20 lines of
`logs\xdesign.log` when the service stops. `firewall_windows.go` reads Windows Defender Firewall's state
from the registry (the Group Policy's key first), asks "Open port <n> in Windows Firewall? [Y/n]" for
each port whose rule "xDesign (TCP <n>)" is missing and adds it with `netsh` after the health check,
recorded with "tool": "windows-firewall"; `firewall.go` keeps the shared part and `firewall_linux.go`
holds ufw and firewalld. The end block's words (`serviceWords`, `endServiceLine`, `stateFileWords`)
come from `service_linux.go` and `service_windows.go`. Started with no arguments from Explorer,
`xdesign.exe` runs the installer when elevated or starts itself again with `--install` through the
Administrator prompt and holds its window at the end; there is no manifest. `--uninstall`
(`uninstall.go` shared, `uninstall_linux.go`, `uninstall_windows.go`) needs Administrator, stops and
deletes both services, deletes the recorded firewall rules, removes the PATH entry
(`RemoveFromSystemPath`) and the junction, moves its own running file to `C:\Windows\Temp` and has
Windows delete it at the next restart; "Remove everything" keeps its own log, and its final backup goes
to the profile folder of the Administrator. A repair while the service runs stops it only before it
removes a damaged release folder (`stopForFiles`). The lead accepted `install.json`'s "services" key
(Windows only), the log kept by "Remove everything", the final backup's place, the running file's move
and the firewall state from the registry.

**WIN-05a** (442743d), the maintenance service and updates on Windows. `maintenance_windows.go` makes
`xdesign admin maintenance --request` answer the service manager (Running at once, Stopped at the end,
exit code 1 on failure, no Stop while it works, Shutdown accepted), log to `logs\maintenance.log` (10
MB, 5 kept) and carry out a request written while it ran (up to 10 per start); `owned_windows.go` and
`platform/held_windows.go` open the maintenance folder and everything read there held (no reparse
point, no hard link, no delete sharing) after checking the folder's permissions against the
installer's; command output goes to an append-only temporary file deleted on close. `serve` starts it
(`maintenance/helper_windows.go`: OpenSCManager with SC_MANAGER_CONNECT, OpenService with
SERVICE_START|SERVICE_QUERY_STATUS), watches it for up to 2 minutes and takes the request back when
it cannot start it; `maintreq/folder_windows.go` puts the folder at `C:\ProgramData\xDesign\maintenance`.
Updates (`update_windows.go`, `files_windows.go`, `tempdir_windows.go`) run Linux's two stages: stage 1
copies the file to `maintenance\run\xdesign-update-<random>`, stage 2 makes the backup and the release
folder, stops the service, runs the migrations with `node.exe`, makes both services right, writes the
guard's marker (`C:\ProgramData\xDesign\update-guard.json`, with an entry for `NT SERVICE\xdesign`),
switches the junction (`current.new`, then the two renames), starts the service with a health check of
up to 120 seconds that waits for a restart Windows planned, and goes back on failure with the end of
`logs\xdesign.log` saved in `update-failures\`; a stop waits up to 65 seconds for such a restart, 3
releases are kept and one a running program uses is never removed. The guard (`guard/system_*.go`)
refuses a link in the marker's place. Update files get the row "System: Linux" or "System: Windows"
before "CPU:" on both systems and a file for the other system is refused ("This file is for Linux; this
server runs Windows."): `release/pe.go` reads a PE file's header and its stamped values from the COFF
symbol table, `release/binary.go` (`InspectBinary`, `SystemName`, `DetectKind`) tells ELF from PE and
checks the Go build information's GOOS and machine, and the upload, `xdesign update` and the unpacker
take the .exe or its .zip. The lead accepted the stop rules, the request carried out before the
service stops, the 65 seconds and the header-based system check.

**WIN-05b** (297c556), rollback, the address and domain moves and the restore on Windows. `rollback.go`
uses `pointCurrent` for the switch and the switch back, with `stopSite` and `startAndCheck` of the
update; `address.go` and `domain.go` are shared, each system's `writeConfig`, firewall rule and
maintenance state in `address_linux.go` and `address_windows.go`; `restore.go` is shared with
`restore_windows.go` (Stop through `stopSite`, Start through the service manager with the 45-second
health check). `xdesign rollback`, `admin set-port`, `admin set-path`, `restore FILE` and the domain
change run on Windows, in a terminal opened as Administrator or in the maintenance service. `set-port`
changes no service (no privileged ports), has six steps without SELinux, gives the new port the rule
"xDesign (TCP <new>)" and deletes the old port's recorded rule once xDesign answers (a rule opened by
hand is left alone), and moves the recorded rule even while the firewall is off. The gate
(`supported_*.go`) and `platform.ErrNotYet` are gone: no helper command answers "not available on
Windows yet" any more. Words that named Linux things now have Windows forms on Windows (the lead
overruled WIN-05a's choice to leave "under /opt" and "a folder of root's"): "under C:\Program
Files\xDesign", "a protected folder", usages without sudo, /opt, /etc or journalctl,
`reset-password`, `reset-2fa` and `list-users` for Administrators, the guard's log lines, and
certificate files with the example `C:\Certificates\design.example.com\fullchain.pem` and no mode
check (Go reports 0666 or 0444 for every Windows file, so every key file had been refused). The code
that Windows no longer reaches moved unchanged to `_linux.go` files (`cmd_admin_linux.go`,
`cmd_backup_linux.go`, `cmd_logs_linux.go`, `usage_linux.go`, `load_linux.go` and others). Left
open: the website's own placeholders in Settings > HTTPS > Certificate files showed `/etc/letsencrypt`
paths on Windows; the lead fixed that after WIN-05b (below).

**WIN-06** (2ab78c6), backups, restore and `status` on Windows. The backups are the same archives in
`C:\ProgramData\xDesign\backups`, with no owners or modes applied; `backup.json` records "system":
"windows" on Windows and nothing on Linux (accepted), and a restore on Windows always keeps this
server's `config.toml`, as does a Linux restore of a Windows backup (accepted). `platform` gained
`NoFollow` as FILE_FLAG_OPEN_REPARSE_POINT with `RefuseLink` (a reparse point on the opened handle is
refused with ELOOP), `SyncAll` (FlushFileBuffers on each fixed drive; the service's account does
nothing) and `Elevated` (root, or the token's elevation). `backup/system_*.go` hold `Options.Dir`,
`Meta.RestoresConfig`, `dataOwner`, `syncDir`, `localName` and the restore command in messages;
`make.go` writes the system and VACUUM INTO's `file:/C:/...` path and refuses a link for the lock;
`read.go` refuses member names Windows would misread (a colon, device names, `<>"|?*`, a part ending in
a dot or a space). `cmd_backup_windows.go` and `cmd_status_windows.go` give `backup`, `restore` and
`status` their Administrator check ("Run this in a terminal opened as Administrator."), Windows words
and the service's state from the service manager. The certificates stay in `<data_dir>\certs` on
Windows (accepted as is; plan 8.4's `C:\ProgramData\xDesign\certs` follows whoever moves the three
places that name it). The control channel's client of `status` was left as a stub until WIN-03 connected
it.

**WIN-07** (197470f), the Windows server file in `build.sh`. Choosing the Windows server builds, for
each CPU after the Linux server, in 3 phases ("payload windows <cpu>", "compiling windows <cpu>",
"zipping windows <cpu>"): `dist/build/payload-windows-<cpu>.tar.zst` (`runtime/node.exe` from
`node-<version>-win-<x64|arm64>.zip`, cached in `.dev/cache/node/` and checked against
`NODE_SHA256_WINDOWS_<CPU>`; `app/` as for Linux with better-sqlite3's `prebuilds/win32-<cpu>.node` and
`@node-rs/argon2-win32-<cpu>-msvc` from the npm registry, cached in `.dev/cache/npm/` and checked
against pnpm-lock.yaml's integrity), `dist/xdesign-<version>-windows-<cpu>.exe` (the helper with
`GOOS=windows`, `-tags payload`, the Linux file's flags and stamps, `-w` and never `-s`) and
`dist/xdesign-<version>-windows-<cpu>.zip` (that file alone, `zip -X -9` after its time is set to the
commit time, `TZ=UTC0`, so one commit gives the same bytes). `check_server_windows` checks the two
Windows pins of the chosen CPUs and `zip` and `unzip`; before packing, the payload's names are checked
(none differs from another in case only, none is a device name, none holds `< > : " | ? * \` or ends in
a dot or a space). The compile step checks with `file` that the .exe is a 64-bit Windows console
program of the CPU and with `go tool nm` that the symbol table is there. The proof cannot run the file,
so it reads it: `file`, the payload inside the .exe byte for byte and its stamped SHA-256, a payload
with `runtime/node.exe` alone and exactly the two Windows native modules (Windows DLLs of the CPU); the
zip's proof lists the .exe alone and unpacks to the same bytes. `SHA256SUMS` lists the Linux .tar.gz
files, the Windows .zip files, then the Linux files and the Windows .exe files; the summary labels the
Windows files File and Zip; the notes' payloads add `windows-<cpu>`. `xdesign release-files` on
Windows writes `xdesign.exe` (`release_files_windows.go`, finding the running file with
`os.Executable`; Linux keeps `/proc/self/exe`). `docs/release-notes-template.md` names the .exe and
.zip, the Windows update command (`xdesign update --dry-run .\xdesign-<version>-windows-amd64.exe`
in a terminal opened as Administrator) and the Windows form of `xdesign rollback`. The Linux server
build is unchanged. In the lead's test build (2026-11-23, with the desktop files, in M16's section) the
Windows server's files were built for both CPUs and the proof passed for each; none of them was run.

**The lead's addition** (8184c08, after WIN-05b). `GET /api/https` answers also `system` ("linux" or
"windows", from the server's `process.platform`). On Windows Settings > HTTPS > "Upload certificate" >
"Files on this server" shows the examples `C:\Certificates\design.example.com\fullchain.pem` and
`...\privkey.pem` and the hint "The xDesign service must be able to read both files. xDesign reads
them again every minute, so a renewal is picked up."; Linux is unchanged and certbot is not named on
Windows, which it has no release for. The website's dialog thus differs from the helper's own examples
(`C:\Certificates\...`, WIN-05b); 18 section 8.4 says so.

None of the Windows code has run on Windows: the agents compiled, vetted and linted it for both CPUs
(`make helper-check`) and the lead built and read the Windows server files, but no machine was at hand
(R-342). The hand tests (section 13, 7, on O-03's machines) are its first run.
