# 17. The owner's second list of 2026-11-23 (M13)

The owner's second list, after they installed xDesign on a server: HTTPS at install and in the
panel, two-factor sign-in, the site's port and path in Settings, a light and dark switch, a
confirm before deleting a design, three display bugs (right to left on buttons, a blue that
looks purple, bold in the Android look) and Claude with full access. Planned on 2026-11-23 from
the owner's words, five rounds of answers (Q-36 to Q-53) and the server's log; built as M13 (14)
only on the owner's "start".

## 1. The owner's words

> - add ssl get on --install
> - add ssl manager (renewal) to the panel
> - add 2fa support for login
> - add website settings (port, path) to the settings
> - add light mode theme support
> - ask for confirm on removing a design
> - right to left get is not correct if the text goes for example persian. specially if we wanted to have 1 emojy before text (emojy goes to left!)
> - the blue color shows as purple! (in the editor not the live)
> - add mcp support
> - bolding a text doesnt show as bold specially on persian

## 2. Questions and answers

| ID | Question (short) | The owner's answer | Decision |
|---|---|---|---|
| Q-36 | Where did you try these: `make dev` or a server install? | "A server install". | (context) |
| Q-37 | What should the install do about the certificate? | "Ask and get it": the installer asks Let's Encrypt over port 80, Let's Encrypt through Cloudflare DNS (with the token) or the built-in certificate, gets it before it finishes and shows the result; a failure says why and keeps the built-in one. | D-644 |
| Q-38 | The SSL manager: xWriter's full SSL tab, today's card with "Renew now", or nothing new? | "Today's card + Renew now". | D-643 |
| Q-39 | Two-factor sign-in: like xWriter for each person, required for everyone, or the owner chooses? | "Like xWriter, each person": an authenticator app, a QR code, 10 recovery codes; the site owner turns it off for a person who lost their phone; a server command for the owner's own. | D-648, D-650 |
| Q-40 | On the server, what did HTTPS look like? | Settings > HTTPS showed "Something went wrong on the server. Try again in a moment." The server's log (`journalctl -u xdesign`) gave the cause (section 3). | D-642 |
| Q-41 | Port and path in the panel: a Site address card, or with the domain too? | "A Site address card": port and path with a Random button; the domain change stays in the HTTPS card. | D-646 |
| Q-42 | Light mode: a switch on the Account page, in the top bar, or both? | "Switch in the top bar". | D-651 |
| Q-43 | MCP: change designs, the Claude app, or nothing new? | "i want mcp to have FULL access to every part of this project". | D-656 |
| Q-44 | Does Settings > Maintenance load on the server? | "Maintenance loads". | (context) |
| Q-45 | Full access: everything in the panel, or everything but the site owner's jobs? | "Everything in the panel". | D-656 |
| Q-46 | Connect from Claude Code only, or the Claude app and claude.ai too? | "Claude Code + Claude app": a connector that signs in with the xDesign account, no key. | D-660 |
| Q-47 | Right to left: where? | "Buttons": a button's label with an emoji and Persian. | D-654 |
| Q-48 | Which blue looks purple? | "The Blue choice in settings": the Blue swatch of a button's color. | D-653 |
| Q-49 | Bold: where and in which look? | "android only". | D-655 |
| Q-50 | The light switch: a toggle, a menu with System, or the phone follows too? | "Sun/moon toggle": one button switches Light and Dark; until it is pressed the site follows the computer; remembered for the person on every device; the phone keeps its own Light and Dark. | D-651 |
| Q-51 | Ask before actions that cannot be undone? | "Like xWriter": Claude asks Yes or No in the chat; an Ask first switch on each key and connected app, on by default, that the site owner can turn off. | D-658 |
| Q-52 | Who may connect Claude? | "Everyone, with their role". | D-659 |
| Q-53 | The Android look copies stock Android, where Persian bold draws as normal text: match it or make it bold? | "Make it bold": bold always looks bold (Roboto, which the option named, turned out to be bundled already). | D-655 |

"Ask for confirm on removing a design" needed no question: "Delete" on a design asks first
(section 9).

## 3. The HTTPS card's error, a bug (SSL-01)

**What the owner saw.** On their server, Settings > HTTPS showed "Something went wrong on the
server. Try again in a moment." every time; Maintenance loaded.

**Cause (from the server's log).** Every `GET /api/https` failed the API's answer check with
"`view.log[N].at`: expected number, received string". The helper sends its times as RFC 3339
text and the server turns them into milliseconds in `apps/server/src/helper/control.ts`
(`fromHelper`), but only for keys that end in `_at` or are `not_before` and `not_after`
(`timeKey`). The HTTPS log's entries have a bare `at`, so they stay text. The card fails as soon
as the log has a line, which is from the first Let's Encrypt attempt on; `make dev` has no
helper, so it never showed there.

The same bare `at` is in the maintenance request's progress and result (`maintreq.Progress.At`
and `Result.At`): Maintenance loads today only because no update, go back, restore or domain
change has run on that server yet; during one, `GET /api/maintenance` would fail the same way.

**Fix.** `timeKey` also takes the bare key `at`, so every helper time reaches the API in
milliseconds: the HTTPS log, the maintenance progress and result. SSL-01 also checks every
other helper answer the server reads (`/status`, backups, updates, releases) against its API
schema for a time or a field of the wrong form, and fixes what it finds the same way.

## 4. "Renew now" in Settings > HTTPS (SSL-01)

**Today.** The card shows the method, the certificate, "Valid until", "Renews from" and the
log, and renews by itself. Its "Try now" button shows only after a problem or for the file
method; a healthy Let's Encrypt certificate has no button.

**Change.**

- With a Let's Encrypt certificate that works (`active`), the card has the button "Renew now".
  It asks first: title "Renew the certificate now?", text "xDesign renews it by itself from
  <date>. Let's Encrypt allows only a few new certificates a week for the same names, so renew
  by hand only when something is wrong.", buttons "Renew now" and "Cancel". It then runs what
  "Try now" runs (`POST /api/https/issue`, the helper's `IssueNow`, a real early renewal) and the
  card follows the state ("Renewing", the log) as it does today.
- While a run is going ("Issuing", "Renewing") the button is hidden, as "Try now" is.
- "Try now" stays as it is for a Let's Encrypt method with a problem and for the file method.
- Nothing else in the card changes (Q-38: no list of several certificates).

## 5. The certificate at install (SSL-02)

**Today.** The installer asks no HTTPS question. Step 13 writes the HTTPS manager's first state:
Let's Encrypt over port 80 when the site has a domain name and port 80 is free, else the
built-in certificate. The site asks Let's Encrypt on its first start (step 14), which comes
before step 15 opens the firewall, and the installer never says whether it worked.

**Change: the question.** After "Web base path", when the site has a domain name (not an IP
address), the installer asks:

```
HTTPS certificate:
  1) Let's Encrypt over port 80 (free, trusted by browsers)
  2) Let's Encrypt through Cloudflare DNS (free, trusted, needs a Cloudflare API token)
  3) The built-in certificate (browsers show a warning)
Choose [1]:
```

- The default is 1 when port 80 is free, else 2. Choosing 1 while port 80 is in use is refused
  with the held text: "Another program (nginx) uses port 80, so Let's Encrypt cannot check this
  server over it. Choose 2 or 3."
- Choosing 2 asks "Cloudflare API token:" without echo. The text before it: "A token with Zone
  Read and DNS Edit for the domain's zone, made in Cloudflare under My Profile > API Tokens."
  An empty answer asks again; the token's form is checked as Settings checks it (at most 200
  printable characters, no spaces).
- With an IP address there is no question: the built-in certificate, with the note "Let's
  Encrypt needs a domain name; xDesign uses its built-in certificate."
- The summary before "Proceed with installation?" gains the line "HTTPS: Let's Encrypt over
  port 80 for design.example.com" (or "through Cloudflare DNS", or "the built-in certificate").
- Flags for `--yes`: `--https letsencrypt|cloudflare|builtin` and `--cloudflare-token TOKEN`.
  Without `--https`, `--yes` takes Let's Encrypt over port 80 when the site has a domain name
  and port 80 is free, else the built-in certificate. `--https cloudflare` needs
  `--cloudflare-token`; `--https letsencrypt` with port 80 in use is refused before anything
  changes. A repair or a reinstall that keeps the HTTPS state asks nothing ("the HTTPS settings
  are kept").

**Change: getting it.** Step 13 always writes the built-in state first. A new step,
"certificate", after the firewall step and before "finish", runs when the choice is Let's
Encrypt:

- It asks the running site through the helper's control socket (as `xdesign status` does):
  `PUT /https` with the method, the domain and the token, then reads `GET /https` every 2
  seconds and prints each new log line ("Asking Let's Encrypt for a certificate for
  design.example.com...").
- It waits up to 5 minutes. Issued: "Certificate issued by Let's Encrypt, valid until
  <date>." Failed: "Let's Encrypt could not issue the certificate: <the manager's problem in
  plain words>. xDesign uses its built-in certificate for now; after fixing it, press Try now
  in Settings > HTTPS." Still working after 5 minutes: "Let's Encrypt is still working; see
  Settings > HTTPS."
- A failure never fails the install: the site works with the built-in certificate, and the
  chosen method stays in Settings > HTTPS with its problem, so "Try now" runs it again. The end
  block shows the certificate's state, and `--json` gains `certificate: {method, state,
  problem}`.
- The address in the end block stays `https://<domain>:<port>/<path>/`.

## 6. The site's port and path in Settings (ADDR-01, ADDR-02)

**Today.** Only `sudo xdesign admin set-port` and `set-path` (GO-11) change them.

**Change: the card.** Settings gains the card "Site address" between the site's card and
HTTPS, for the site owner:

- "Address" shows the full address, for example `https://design.example.com:34567/k3v9x2m1q8wz7r4t/`,
  with a copy button.
- "Port" (a number field) and "Web base path" (a text field with the button "Random", which
  fills a new random path of 16 letters and digits), both starting with today's values. The
  path's help: "Starts and ends with /, 1 to 3 parts of 4 to 64 letters, digits, - or _."
- The button "Change address", active when a value changed and both are valid. It asks
  "Confirm it's you" (the password, and the code when two-factor sign-in is on), then shows:
  title "Move xDesign to <new address>?", text "The site restarts at the new address. Links you
  sent before (view-only and Claude links), the Claude Code command and connected Claude apps
  keep the old address and stop working. People editing see Reconnecting." A new path adds
  "Everyone signs in again at the new address." Buttons "Move" and "Cancel".
- Refused before anything changes, with the helper's words: port 80, a port in use ("Port N is
  in use; choose another one."), a path that fails the rule, the same port and path, a backup
  or another maintenance job running ("A backup is running. Try again when it ends.").
- After "Move": "Moving to <new address>..." with the steps as they come; once the site stops
  answering at the old address the card shows "Open the new address" (a link to it) and "If it
  does not open within a minute, xDesign went back to the old address: reload this page." (The
  page cannot follow the move: the old port closes or the old path shows the empty page, and
  the new address is another origin.)

**Change: the helper.** A new maintenance request kind `address` with a part `{port, base_path}`
(as `domain`): the control socket's `PUT /address` checks it and writes the request; the
maintenance service runs GO-11's change (`install.ChangeAddress`) in its own process with
`--yes` (the firewall opened, SELinux labeled, install.json's history, going back on a failed
start), but without the busy check that would see the maintenance service itself; the backups'
lock is still checked. The server's route `PUT /api/address` (`confirm: true`, site owner)
returns the maintenance request and writes Activity "Changed the site address to <address>"
(audit `address_change_started`).

## 7. Two-factor sign-in (TFA-01, TFA-02, GO-12)

**Today.** A password alone signs in; "Confirm it's you" asks only the password.

**Change**, as xWriter (`web/src/features/panel-settings/security/`, `services/auth/`), with
"the panel" read as "xDesign":

- **Account page**, a card "Two-factor authentication" between "Password" and "Sessions":
  "A code from an authenticator app on your phone, asked at every sign-in after the password."
  with "On" or "Off".
  - Off: "Two-factor authentication is off", "Turning it on signs out your other sessions.",
    "Without it, the password alone opens xDesign.", button "Turn on".
  - Turning on: "Confirm it's you" (password), then the setup dialog: "Scan the QR code", "In
    your authenticator app (for example Google Authenticator, Microsoft Authenticator, 2FAS or
    Aegis), add an account and scan this code.", "Can't scan it? Type this key into the app
    instead:" with "Copy key" and the key in groups of 4, "Finish within <countdown>.", "Cancel"
    and "Next"; then "Enter the code from the app", "The app now shows a 6-digit code for
    xDesign. Enter it to turn on two-factor authentication.", the field "6-digit code", "Back"
    and "Turn on". Then "Save your recovery codes": "If you lose your phone, each code signs you
    in once instead of a code from the app. They are shown only now.", "Copy codes", "Download",
    the box "I saved these codes" and "Done" (active once the box is ticked). Toast "Two-factor
    authentication is on. Other sessions were signed out."
  - On: "Recovery codes" with "N recovery codes left." (and at 3 or fewer " Create new ones so
    you do not get locked out."), button "New recovery codes"; "Turn off two-factor
    authentication", "The password alone then opens xDesign. Your other sessions are signed
    out.", button "Turn off". Both ask "Confirm it's you" with the password and a code or a
    recovery code.
  - The QR code is drawn in the browser (`react-qr-code`); the `otpauth://` address names the
    issuer "xDesign" and the account as "xDesign (<domain>):<email>".
- **Sign-in.** After a right password, a person with two-factor sign-in on gets the step "Enter
  your code" / "Two-factor authentication is on for your account.": the field "6-digit code"
  ("Open your authenticator app and enter the code it shows for xDesign."), sent by itself on
  the sixth digit, "Verify", and "Use a recovery code" (the field "Recovery code",
  `XXXX-XXXX-XXXX-XXXX`, "One of the recovery codes you saved when you turned on two-factor
  authentication. Each code works once."). The messages are xWriter's: "Wrong code. N attempts
  left.", "Wrong code, and no attempts are left. Enter your password again.", "The sign-in step
  expired. Enter your password again.", "Too many failed attempts. Wait and try again." After a
  recovery code, the toast "N recovery codes left." or "That was your last recovery code.".
- **Confirm it's you** gains the code field (and "Use a recovery code") for a person with
  two-factor sign-in on: "<action> needs your password and a code from your authenticator app."
- **Members page**: the person's menu gains "Turn off two-factor authentication" (only when it is
  on), for the site owner: "<name> loses their authenticator app and recovery codes and is
  signed out everywhere. They can turn it on again on their Account page." after "Confirm it's
  you"; toast "Two-factor authentication is off for <name>. They were signed out everywhere."
- **The site owner's own**, when they lost the phone and the codes: `sudo xdesign admin reset-2fa
  <email>` on the server (asks "Turn off two-factor authentication for <email>? [y/N]", prints
  "Two-factor authentication is off now.").
- **Rules** (xWriter's): TOTP of RFC 6238 (SHA-1, 6 digits, 30 seconds, one step either way, a
  code used once: the last used step is kept); a pending sign-in lasts 5 minutes, allows 5
  wrong codes and must come from the same IP address; wrong codes count in the sign-in limits;
  10 recovery codes of 16 characters, kept only as hashes, each used once; turning on and off
  signs out the person's other sessions; a password reset link does not turn it off; Activity
  lists turning on and off, new recovery codes, a recovery code used and the owner's reset.
- **Storage**: new columns on `users` (secret, pending setup with its time, last used step,
  recovery code hashes) and a table of pending sign-ins (migration). The secret is kept in the
  database as it is, beside the password hashes (D-649).

## 8. The light and dark switch (THEME-01)

**Today.** The site follows the computer's Light or Dark (D-162); there is no switch.

**Change.**

- The top bar gains a button left of the comments bell: a sun in Dark ("Switch to light mode"),
  a moon in Light ("Switch to dark mode"). Pressing it switches the whole site at once.
- Until a person presses it, the site follows the computer as today. The choice is saved for
  the person (a `theme` on `users`: none, light or dark, through `PATCH /api/me`), so it follows
  them to every device; the browser also keeps the last choice so the first paint has the
  right colors before the person's data arrives.
- Pages without a person (sign-in, invite, reset, view-only links) use the browser's last
  choice, else the computer's.
- The phone in the editor and Try it keep their own Light and Dark; the printable page keeps its
  paper colors.

## 9. Confirm before deleting a design (FIX-01)

**Today.** "Delete" in a design's menu moves it to Trash at once, with "Undo" in the toast;
"Delete forever" in Trash already asks.

**Change.** "Delete" asks first: title "Delete "<name>"?", text "It moves to Trash for 30 days.
The people it is shared with lose it until it is restored.", buttons "Delete" and "Cancel".
Then it moves to Trash with the toast and "Undo" as today. Every place that deletes a design
asks the same.

## 10. The Blue swatch looks purple, a bug (FIX-01)

**Cause.** A button's color choice draws its "Blue" swatch with the panel's "info" color, which
is violet on purpose (blue is the panel's own brand color); the map's pills of blue buttons use the same color. The phone
draws the real Telegram blue, so only the editor's swatch and pill look purple.

**Fix.** The swatch and the map's pill of a blue button use Telegram's blue of the button style
`primary` (the preview's color for it), in Light and Dark, with white text that reads (4.5:1).
Green and red stay as they are.

## 11. Right to left on buttons, a bug (FIX-02)

**Cause.** A button's label on the phone takes the bubble's direction, left to right, so a
label "🛒 خرید" draws the emoji (a picture of the look) on the left.

**Fix.** Every button label on the phone (the inline keyboard, the bottom keyboard, a rich
message's buttons, the menu button) takes its direction from its first letter, as Telegram's
apps do: "🛒 خرید" draws right to left with the emoji on the right; an English label stays left
to right. A button's custom emoji icon stays at the label's start. This holds in the editor,
Try it, view-only links and the printable page. The map's pills of button labels do the same.

## 12. Bold in the Android look, a bug (FIX-02)

**Cause.** The Android look draws bold at weight 500 (Telegram Android's Medium). Its Latin,
Cyrillic and Greek letters use Roboto, which the preview brings as a variable font
(`@fontsource-variable/roboto`), so they are Medium as on the phone. Its Persian and Arabic
letters use Noto Naskh Arabic UI, which has only 400 and 700, so 500 falls back to 400 and bold
Persian looks like normal text; this was copied on purpose from stock Android.

**Fix** (Q-53, replaces that calibration for bold).

- The Android look's bold always looks bold: Persian and Arabic bold (and the other places the
  look draws them at 500, such as names and titles) draw with Noto Naskh Arabic UI Bold.
- Latin bold stays Roboto Medium, as now. The other four looks do not change.

## 13. Claude with full access (MCP-01a, MCP-01b, MCP-02a, MCP-02b, MCP-03a, MCP-03b, GO-12)

**Today.** `/mcp` (M10, CL-02) is a read-only MCP server for Claude Code with API keys: 8 tools
that list and read designs, checks, comments and pictures. Nothing can change through it.

**Change**, after xWriter's MCP server (`internal/web/mcpserver/`, `internal/web/api/marks.go`,
`mcp_keys.go`, `mcp_apps.go`, `internal/web/mcpauth/`, `web/src/features/api-settings/mcp/`,
`web/src/features/mcp/`).

### 13.1 What Claude can do

Claude acts as the person whose key or connected app it uses, with that person's role:
everything the person can do in xDesign (Q-45), and nothing more (Q-52). A Viewer's Claude only
reads; an Editor's edits the designs shared with them; the site owner's can do everything.

- **Every action of the panel**: designs (create, rename, duplicate, delete to Trash, restore,
  delete forever, hand over, share), comments, versions, view-only and Claude links, templates,
  import and export, members and invites, settings and Activity, HTTPS, the domain and the site
  address, backups, updates and going back.
- **Every part of a design's content**: steps, texts and their translations, buttons and
  keyboards, parts, variables and switches, the start, languages, the bot's settings, pictures
  and files, the map's layout. None of the panel's routes changes a design's content (the
  editor edits the live document), so these are new design edits (13.3).
- **Try it**: run the design as a test user and read what the bot answers.
- **Not through Claude** (as in xWriter): the person's own sign-in security (sign in and out,
  the password, sessions, "Confirm it's you", two-factor sign-in), API keys and connected apps
  (Claude cannot make itself new access), the public steps of invite and reset links, and the
  raw downloads and uploads that the tools of 13.3 replace (a backup's file, an update's file
  from the computer, media files; pictures are read with `get_picture`), and opening the desktop
  app's backups folder, a window on the person's computer (DESK-02).

### 13.2 The tools

- **Kept**: the 8 read tools of CL-02 (`list_designs`, `get_spec`, `get_doc`, `get_how_to_read`,
  `get_step`, `list_checks`, `list_open_comments`, `get_picture`).
- **The panel's actions**, as xWriter's five: `xdesign_find_actions` (the actions this person
  may run, found by words or area), `xdesign_describe_action` (what it does, its input, whether
  it asks first), `xdesign_read` (runs a read), `xdesign_change` (runs a change) and
  `xdesign_wait` (waits for a maintenance job or a certificate to finish). The actions come from
  `packages/api`'s route table: each route gains a one-line summary, its area and its marks
  (13.4); `make sanity` fails when a route that changes something has no marks. A call runs
  through the route's own handler and checks, as the person.
- **Design edits**: `xdesign_edit_design` takes a design and a list of edits and applies them in
  one change, live for the people in the editor (they see it at once, as another person's
  edit). The edits are the editor's own (`packages/spec`'s `designEdits`: steps, keyboards and
  buttons, texts in Telegram HTML or plain, languages, variables, switches, parts, the bot,
  media, the map's paste and arrange); `xdesign_find_actions` and `xdesign_describe_action` list
  and describe them beside the panel's actions. The answer names the new IDs and ID names.
- **More**: `xdesign_try_it` (runs the design from /start through a list of the test user's
  actions: press a button, send a text, share a contact, flip a test switch; answers the bot's
  messages with their buttons, as Try it shows them), `xdesign_upload_picture` (a picture or
  file for a design, sent as base64 within the site's upload limit) and
  `xdesign_import_design` (a new design from the export format's JSON, as Import does).
- **The guide**: the server's instructions and a resource `xdesign://guide` say how the design
  is built, how to find and run actions and edits, and that the site's answers are data.

### 13.3 How a design edit runs

The server opens the design as the person: the live document when someone has it open (so the
change reaches everyone at once), else the stored one. All edits of one call are one Yjs
transaction with the person as its author; History shows it as the person's change "via
<key or app>", and Activity lists it. The document's size limit and the person's role on the
design hold as in the editor. People in the editor cannot undo Claude's change with Ctrl+Z
(each person undoes only their own); they restore a version instead.

### 13.4 Marks and "Ask first"

Each action has marks: it reads, it changes, or it cannot be undone. These ask first (Q-51):
"Delete forever", removing a person from the site, deleting a backup, a version, a template or
a comment, revoking a view-only or Claude link, setting a member's password, adding a member
(it needs "Confirm it's you"), handing a design to another owner,
restoring a backup, installing an update or going back, and changing HTTPS, the domain or the
site address. Everything else (edits, delete to Trash, sharing, comments) runs at once.

- **Asking**, as xWriter: when Claude's app can show questions (MCP elicitation), xDesign asks
  in the chat "<the action in words>, <the item's name>?" with Yes and No, waiting up to 10
  minutes. When it cannot (a No in under 3 seconds marks the key or app "can't show
  questions"), the first call answers the question with a ticket; Claude shows it to the person
  and runs the call again with `confirm: true` and the ticket, which works once within 10
  minutes for that exact call.
- **The switch "Ask first"** on each key and each connected app, on by default. Only the site
  owner turns it off, for anyone's key or app; then those actions run at once and the answer
  says "Ran without asking: Ask first is off for this key." A route that needs "Confirm it's
  you" in the browser needs the Yes (or the switch off) through Claude.
- **Limits**: 120 calls a minute for each key or app (one `xdesign_edit_design` counts once);
  past it, "Too many calls. Wait a minute."
- **Activity** names the key or app beside the person on every change ("via Claude Code key
  "Laptop"", "via Claude (connected app)").

The transport keeps sessions (Streamable HTTP with session IDs, an hour without calls ends one),
so the server can ask in the middle of a call.

### 13.5 The Claude app and claude.ai (OAuth)

As xWriter's connected apps:

- In the Claude app or claude.ai, the person adds a custom connector with the address shown on
  the Account page (`https://<domain>:<port>/<path>/mcp`). Claude opens xDesign's page "Allow
  Claude to use xDesign as <name>?": the app's name and address, "It can do everything you can
  do in xDesign. Actions that cannot be undone ask you first.", buttons "Allow" and "Deny". A
  browser that is not signed in signs in first (password and code).
- xDesign is an OAuth 2.1 server: the protected resource and authorization server metadata, the
  client's metadata document (as Claude sends) or dynamic registration, authorize with PKCE
  (S256), token with refresh tokens that rotate (an access token lasts an hour, a refresh token
  30 days, a reused one ends the connection), tokens bound to the `/mcp` address, no scopes.
- The metadata addresses with the secret path inserted after `/.well-known/...` (RFC 9728 and
  RFC 8414: `/.well-known/oauth-protected-resource/<path>/mcp` and
  `/.well-known/oauth-authorization-server/<path>`) are answered outside the path, by the
  server and by the helper's front (GO-12); every other address outside the path keeps the
  empty page. Only someone who knows the path can name them.
- The Claude app reaches the site from the internet: it needs the port open and a certificate
  browsers trust. When the site uses the built-in certificate, the Account page says "The
  Claude app needs a certificate browsers trust: choose Let's Encrypt in Settings > HTTPS."

### 13.6 The screens

- **Account page**, the card "Claude" (today "API keys"):
  - "Claude can do everything you can do in xDesign, as you. Actions that cannot be undone ask
    you first." (in place of "A key reads every design you can open and never changes them").
  - "API keys" as today (create, copy once, the Claude Code command, revoke), each with its
    "Ask first" switch.
  - "Connected apps": each app's name, "Connected <date> · Last used <date>", its "Ask first"
    switch and "Disconnect" (asks first); "Add xDesign to the Claude app" with the address to
    copy.
  - The switches can be changed only by the site owner; for others they show the state, with
    "Only the site owner can turn this off."
- **Settings**, for the site owner, the card "Claude connections": every person's keys and
  connected apps with the person, "Last used", the "Ask first" switch, "Revoke" or
  "Disconnect".

## 14. What stays as it is

- Settings > HTTPS keeps one certificate at a time (Q-38); the domain change stays in it (Q-41).
- `xdesign admin set-port` and `set-path` stay; the card runs the same change.
- Two-factor sign-in stays each person's choice; nobody is made to turn it on (Q-39).
- The phone's own Light and Dark (Q-50), the other four phone looks (section 12), the colors
  green and red (section 10).
- The read tools of CL-02 keep their names and answers; existing API keys keep working, with
  "Ask first" on.

## 15. Tasks, waves and agents

| Task | What | Agent |
|---|---|---|
| SSL-01 | Sections 3 and 4: the bare `at` (and any other helper answer that does not match its schema), "Renew now". | Opus, effort xhigh |
| SSL-02 | Section 5: the installer's certificate question, flags, step 13 always built-in, the new step "certificate", the end block and `--json`. | Opus, effort xhigh |
| ADDR-01 | Section 6 in the helper: the request kind `address`, `PUT /address` on the control socket, the maintenance service's run of the change. | Opus, effort xhigh |
| ADDR-02 | Section 6 in the server and web: `PUT /api/address`, the "Site address" card, Activity. Beside ADDR-01, on the control socket's contract. | Opus, effort xhigh |
| TFA-01 | Section 7 in the server: the migration, TOTP, recovery codes, the sign-in step, the routes, "Confirm it's you" with the code, the owner's reset, the server command `reset-2fa`, Activity. | Opus, effort xhigh |
| TFA-02 | Section 7 in the web: the Account card and its dialogs, the sign-in step, "Confirm it's you", the Members item. After TFA-01. | Opus, effort xhigh |
| GO-12 | The helper's small parts: `xdesign admin reset-2fa` (section 7), the front answering the OAuth metadata addresses with the path (section 13.5). After TFA-01. | Opus, effort xhigh |
| THEME-01 | Section 8: `users.theme`, the top bar button, the first paint. After TFA-01 (one database change at a time). | Opus, effort xhigh |
| FIX-01 | Sections 9 and 10: the delete confirm, the blue swatch and pill. | Opus, effort xhigh |
| FIX-02 | Sections 11 and 12: button labels' direction, the Android look's Persian bold. | Opus, effort xhigh |
| MCP-01a | After TFA-01 and ADDR-02. Section 13.2 and 13.4 without asking: summaries, areas and marks for every route, the sanity check, the five action tools, running a route as the key's person, sessions in the transport, Activity's "via", the limits. | Opus, effort xhigh |
| MCP-02a | Section 13.3: opening a design as a person (live or stored), `xdesign_edit_design` and the edits in the action list. | Opus, effort xhigh |
| MCP-01b | Section 13.4's asking: elicitation, tickets, `ask_first` on keys (migration), the switches on the Account page and the Settings card. After MCP-01a and THEME-01. | Opus, effort xhigh |
| MCP-02b | Section 13.2's `xdesign_try_it`, `xdesign_upload_picture`, `xdesign_import_design`, the guide. After MCP-01a and MCP-02a. | Opus, effort xhigh |
| MCP-03a | Section 13.5 in the server: OAuth (tables, metadata, register, authorize, token), the metadata outside the path, `/mcp`'s 401 challenge, connected apps as principals with "Ask first". After MCP-01b. | Opus, effort xhigh |
| MCP-03b | Section 13.5 and 13.6 in the web: the "Allow" page, "Connected apps" on the Account page and in the Settings card, the certificate note. After MCP-03a. | Opus, effort xhigh |
| DOC-M13 | Fold the notes: 07 (install, address, two-factor command), 06 (MCP), 04 and 05 (screens), the user guide, "As built (M13)", status. | Sonnet, effort high |

Waves (at most 8 agents at once; one task that changes the database per wave, since migrations
made in parallel collide; the lead set them at build time):

1. SSL-01, SSL-02, ADDR-01, ADDR-02 (on the control socket's contract, as PATH-01 and PATH-02),
   FIX-01, FIX-02, TFA-01 (migration), MCP-02a.
2. MCP-01a (after every route of wave 1, so its marks cover them), TFA-02, GO-12, THEME-01
   (migration).
3. MCP-01b (migration), MCP-02b.
4. MCP-03a (migration).
5. MCP-03b.
6. DOC-M13.

16 Opus coding runs and 1 Sonnet run; with the usual continuations in the MCP pieces, about 18
to 20 Opus runs. SSL-01 is the fix for the owner's server and lands first; M13 comes before
releases 1.0 and 2.0 (REL-01, REL-02).

## 16. Hand tests

On the desktop (`make dev`):

1. FIX-01: Designs, a design's menu, "Delete": the question; "Cancel" keeps it; "Delete" moves
   it to Trash with "Undo". In the editor, a button's color: "Blue" is blue (Light and Dark); on
   the map the blue button's pill is blue.
2. FIX-02: a button "🛒 خرید" and a button "🛒 Shop": on the phone in each of the five looks, the
   Persian one has the emoji on the right, the English one on the left; the same in Try it and
   a view-only link. A Persian text with a bold word in the Android look: the word is clearly
   bold.
3. THEME-01: the top bar's moon and sun switch the site; reload: the choice stays; sign in from
   another browser: the same choice; the phone's own Light and Dark is unchanged.
4. TFA-02: Account, "Turn on", scan with a phone's authenticator app, enter the code, save the
   recovery codes; sign out and in: the code is asked; a wrong code says how many attempts are
   left; sign in with a recovery code; "Confirm it's you" asks the code; "Turn off". As the site
   owner, turn it off for a second person on Members.
5. MCP: Account, "Claude": create a key and add it to Claude Code; ask Claude to create a design
   "Coffee test" with a main menu, two buttons and a Persian translation while the editor is
   open in the browser (the steps appear live); ask Claude to run it with Try it; ask it to
   delete the design forever: Claude asks first; as the site owner turn "Ask first" off for the
   key and ask again: it runs at once. Activity names the key on each change.

On the owner's server (after a new build: `./build.sh`, then Maintenance > update):

6. SSL-01: Settings > HTTPS shows the certificate and its log, no error; with a working Let's
   Encrypt certificate, "Renew now" asks, then the card shows "Renewing" and the new date.
   Maintenance shows the update's progress during the update.
7. ADDR-02: Settings > Site address: change the port, "Random" for the path, "Move": the card
   gives the new address, which opens (sign in again); the old one shows the empty page. Try
   port 80 and a port in use: refused.
8. GO-12: lose the phone on purpose: `sudo xdesign admin reset-2fa <email>`, then sign in with the
   password alone.
9. MCP-03: in claude.ai, Settings > Connectors, add a custom connector with the address from
   the Account page: xDesign's "Allow" page (sign in with the code), "Allow"; ask Claude to list
   the designs; the app shows under "Connected apps"; "Disconnect" ends it.

On a fresh VM with a domain (O-01):

10. SSL-02: `sudo ./xdesign --install`: the "HTTPS certificate" question; choose 1: the
    install prints the Let's Encrypt lines and "Certificate issued"; the browser shows the
    lock. Again with nginx on port 80: 1 is refused, 2 asks the token and issues through
    Cloudflare. With a wrong token: the install finishes with the reason, the site works with
    the built-in certificate, Settings > HTTPS shows the problem and "Try now".

**As built hand tests** (from the tasks' notes):

- SSL-01: On the owner's server after an update: Open Settings > HTTPS: the card loads (no
  "Something went wrong on the server"), with the log's lines and their times when there was a
  problem. With a working Let's Encrypt certificate, "Renew now" shows. Press it: the question "Renew
  the certificate now?" names the renewal date; "Cancel" closes it. Press "Renew now" in the question:
  the pill turns to "Renewing", the log fills, then the pill is "Active" with a new "Valid until".
  Maintenance loads, and during an update, go back, restore or domain change its progress still shows.
- SSL-02: On a fresh server with a domain: run `sudo ./xdesign --install`, answer the "HTTPS
  certificate" question with 1. Near the end the install shows the Let's Encrypt lines and
  "Certificate issued by Let's Encrypt, valid until ...", the end block shows "HTTPS: a certificate
  from Let's Encrypt", and the browser shows the lock. With nginx on port 80, 1 is refused and 2 asks
  the token without showing it. With a wrong token the install still finishes, names the reason, and
  Settings > HTTPS shows the problem and "Try now".
- ADDR-01: On a server, open Settings > Site address, change only the port to a free one and choose
  "Change address", then "Move": the page loses the site, and the new address opens within a minute.
  Change only the path (or "Random"): the old address shows the empty page, the new one opens and asks
  to sign in again. Change both at once: xDesign restarts twice and then opens at the new address. Try
  port 80, a port another program uses, and the address in use: each is refused at once with its
  sentence, and nothing restarts.
- ADDR-02: Settings > Site address shows the address with a copy button, and the port and path of
  today. Type port 80: "Port 80 cannot serve HTTPS; choose another one." and "Change address" stays
  off. Type a port another program uses, confirm, "Move": the dialog shows "Port N is in use; choose
  another one." and nothing changes. Press "Random" for the path, "Change address", give the password,
  read the dialog, "Move": the steps show, then "Open the new address"; it opens there (sign in
  again), and the old address shows the empty page. Settings > Activity has "Asked to move the site to
  port N and the path /.../".
- FIX-01: On Designs, open a design's menu and choose "Delete": a dialog asks "Delete "<name>"?".
  "Cancel" keeps it; "Delete" moves it to Trash with "Undo" in the toast, and "Undo" brings it back.
  In the editor, click a button on the phone: the "Blue" swatch under "Look" is blue, not purple, in
  Light and Dark. Choose it: the button's pill on the map is the same blue with white text. Give a
  button the label "🛒 خرید" (or a Persian label with a custom emoji icon): its pill on the map reads
  right to left with the emoji on the right.
- FIX-02: In the editor, give an inline button the text "🛒 خرید": the emoji shows on the right of
  the Persian word, on the phone and while the popover is open. "🛒 Buy" keeps the emoji on the left.
  Do the same on a bottom keyboard button and on a rich message's button; then open Try it and a
  view-only link: the same. Switch the phone to the Android look and write a Persian message with a
  bold word: the bold word is clearly bold. English bold looks as before.
- TFA-01: On the Account page (after TFA-02), turn on two-factor sign-in with an authenticator app,
  sign out and sign in: the password then asks a 6-digit code; a wrong code says "Wrong code. 4
  attempts left.". Sign in with a recovery code instead: it works once; the same code a second time is
  wrong. As the site owner, turn it off for a member on Members: the member is signed out and signs in
  with the password alone. On the server, `sudo xdesign admin reset-2fa <email>` (after GO-12) prints
  "Two-factor authentication is off now.".
- TFA-02: On Account, "Turn on": confirm with the password, scan the QR code with an authenticator
  app, "Next", type its code, "Turn on": the recovery codes show once; "Done" works only after ticking
  "I saved these codes"; the card says "On" and "10 recovery codes left.". Sign out and sign in: after
  the password comes "Enter your code"; a wrong code says "Wrong code. 4 attempts left."; the right
  one signs in as soon as the sixth digit is typed. Sign in with "Use a recovery code": a toast says
  "9 recovery codes left.". On Maintenance, download a backup: "Confirm it's you" now asks the
  password and a 6-digit code. As the site owner, on Members, open the menu of a member who has it on,
  "Turn off two-factor authentication": they are signed out and the item is gone.
- GO-12: On the server, `sudo xdesign admin reset-2fa <email>` of someone with two-factor sign-in
  on: it asks "Turn off two-factor authentication for <email>? [y/N]"; answer y: "Two-factor
  authentication is off now.", and they sign in with the password alone. Run it again: "Two-factor
  authentication is already off for <email>.". With a wrong email: "No one on this site has the email
  <email>.". Answer n (or Enter): ":: Nothing was changed.". After MCP-03a, in a browser,
  `https://<domain>:<port>/.well-known/oauth-protected-resource/<path>/mcp` shows xDesign's metadata
  (JSON); the same address with another path, or with a slash at the end, shows the empty page.
- THEME-01: Sign in: the site shows the computer's Light or Dark; the top bar has a moon (in Light)
  or a sun (in Dark) left of the bell. Press it: the whole site switches at once; hovering it says
  "Switch to light mode" or "Switch to dark mode". Reload, and open the site on another device or
  browser and sign in: it opens in the chosen mode. Sign out: the sign-in page keeps the last chosen
  mode. Open a design: the editor follows the site's mode, and the phone's own Light and Dark switch
  still works on its own.
- MCP-02a: On the Account page make an API key and connect Claude Code to xDesign with it; open a
  design in the editor in the browser. Ask Claude: "In <design>, add a message step Welcome after
  /start with the text Hello and the buttons Shop and Help." The step, its text and its buttons appear
  in the open editor at once, and Claude's answer names their ID names. Ctrl+Z in the browser does not
  take Claude's change back; History shows it as your change once you leave the editor, and restoring
  the version before it undoes it. With the key of a person who only views the design, Claude answers
  "You can open this design but not edit it." Activity shows "Used the API key <name> for
  xdesign_edit_design".
- MCP-01a: On the Account page make an API key and connect Claude Code to xDesign with it. Ask
  Claude "What can you do in xDesign?": it lists the areas. Ask it to rename a design and to share it
  with a member: both happen, and Settings > Activity shows "Renamed the design ..." and "Shared the
  design ..." with "<your name> via Claude Code key "<key name>"". Ask it to delete a design forever
  or revoke a view-only link: it answers "This action asks you first; that comes in the next update."
  and nothing changes. With a key of a member who is not the site owner, ask for the members list or
  the backups: Claude does not find those actions, and running one by its id answers "Only the site
  owner may run this action." Ask it to read Activity 130 times in a minute: from the 121st call it
  answers "Too many calls. Wait a minute."
- MCP-01b: As the site owner, on the Account page make an API key and connect Claude Code with it.
  Ask Claude to delete a design in Trash forever: Claude Code shows "Delete a design forever,
  "<name>"?"; answer No and nothing happens; ask again and answer Yes: the design is gone, and
  Activity shows "Deleted ... forever" by you via the key. Settings > Claude connections lists the key
  with you and its last use. Turn "Ask first" off: Activity says "Turned Ask first off for the API key
  <name>". Ask Claude to revoke a view-only link: it happens at once and Claude's answer says "Ran
  without asking: Ask first is off for this key." Sign in as a member who is not the site owner: on
  the Account page their key's "Ask first" switch is greyed with "Only the site owner can turn this
  off." Ask Claude to make a change to a design nobody has open with xdesign_edit_design, then open
  History: the version says "<you> via Claude Code key "<name>"".
- MCP-02b: On the Account page make an API key, connect Claude Code to xDesign with it, and open a
  design in the editor. Ask Claude "Try <design>: start, press the first button, then type hello". It
  answers the bot's messages with their buttons and what happened, the same as Try it shows in the
  editor. Ask Claude to put a picture from your computer into a message step. The file appears in the
  step in the open editor at once; Settings > Activity shows "Used the API key <name> for
  xdesign_upload_picture". Ask Claude to copy a design by reading its spec.json and importing it as
  "Import test". The new design is on the Designs page, and Activity shows "Imported the design" via
  the key. Ask Claude "Read the xDesign guide": it reads xdesign://guide and explains how a design is
  built.
- MCP-03a: In a browser, `https://<domain>:<port>/.well-known/oauth-protected-resource/<path>/mcp`
  shows JSON with the MCP address, and
  `https://<domain>:<port>/.well-known/oauth-authorization-server/<path>` shows the issuer
  `https://<domain>:<port>/<path>`; the same with another path shows the empty page. After MCP-03b,
  with a Let's Encrypt certificate: in claude.ai, Settings > Connectors, add a custom connector with
  the Account page's MCP address; xDesign's "Allow" page opens (sign in with the code first), "Allow";
  ask Claude to list the designs. Settings > Activity shows "Connected the app Claude"; ask Claude to
  rename a design: Activity shows "<you> via Claude (connected app)". "Disconnect" in Settings ends
  it: Claude's next call asks to connect again.
- MCP-03b: With a Let's Encrypt certificate: in claude.ai, Settings > Connectors, add a custom
  connector with the address the Account page shows under "Add xDesign to the Claude app". xDesign's
  page "Allow Claude to use xDesign as <you>?" opens (sign in with the code first in a fresh browser);
  "From" says claude.ai. "Allow": claude.ai connects; ask Claude to list the designs. Account >
  Claude: the app shows under "Connected apps" with "Connected <today> · Last used just now".
  "Disconnect" asks, then the app is gone and Claude's next call asks to connect again. As the site
  owner, Settings > Claude connections shows the app with "Connected app · <you>"; turn its "Ask
  first" off and on. A member sees the switch greyed with "Only the site owner can turn this off.". On
  a site with the built-in certificate, the Account page shows the Let's Encrypt warning under the
  address.

## As built (M13)

**SSL-01** (60f97b7), the HTTPS card's error and "Renew now". The server's `fromHelper` now turns
the bare key `at` into UTC milliseconds besides the keys that end in `_at` and `not_before` and
`not_after`, so the HTTPS log, the maintenance progress and the maintenance result pass the API's
check. The other helper answers the server reads were checked, Go struct against Zod schema (`GET
/status`, `GET /https` and the HTTPS changes, `GET /backups`, `POST /backups`, `DELETE
/backups/<name>`, the restore, update, rollback and domain requests, `GET /maintenance`, `GET
/maintenance/releases`, the upload check and its discard): no other field has the wrong form. Lists
the schemas require are never null (the backups, the releases, the check's rows and warnings start
as empty lists), times the schemas take are `*_at` or `not_*`, optional fields are left out with
`omitempty` or `omitzero`, and fields only Go sends (`front_started_at`, `app.last_exit`,
`built_at`, `from_build`, `schema_floor`, `renewal_explanation_url`, ...) are cut by the schemas.
"Renew now" shows when the method is Let's Encrypt, the state is `active`, there is no last problem
and the renewal date is known (always so for an issued Let's Encrypt certificate); exactly one of
"Try now" and "Renew now" shows for a Let's Encrypt method that is not issuing or renewing. "Renew
now" sits beside "Change the method" with "Try now"'s icon; the question's confirm button is not
red. "Try now" and "Renew now" share the same call (`POST /api/https/issue`); a refusal of "Renew
now" shows in the question, as other questions do, and "Try now" keeps its toast.

**SSL-02** (d0cb380), the certificate at install. The question prints in the installer's style: "::
HTTPS certificate:", the three choices as written, then ":: Choose [1]:" (or [2] when port 80 is
held). Another answer: "please answer 1, 2 or 3". The token question shows the help text as a note,
then ":: Cloudflare API token:" without echo; an empty answer says "give the Cloudflare API token"
and asks again, a malformed one "that is not a Cloudflare API token: it has at most 200 printable
characters and no spaces; copy it again from Cloudflare (My Profile > API Tokens)". A domain name
Let's Encrypt does not take (for example a single label) is treated as an IP address: no question,
the built-in certificate, with the note "Let's Encrypt cannot take this domain (<why>); xDesign uses
its built-in certificate." The summary's HTTPS fact holds only the certificate: "Let's Encrypt over
port 80 for design.example.com", "Let's Encrypt through Cloudflare DNS for design.example.com", "the
built-in certificate", "the HTTPS settings are kept" or "the HTTPS settings of the backup" (a
restore of the same domain); "xDesign serves HTTPS itself on port n" is gone, the port is in the
address line above it. `--yes` without `--https`, on a domain whose port 80 is held, keeps the
built-in certificate with the note "Another program (nginx) uses port 80, so Let's Encrypt cannot
check this server over it: xDesign uses its built-in certificate (--https cloudflare gets one
through Cloudflare DNS)." It replaces the Cloudflare hint the installer printed before. Refused
before anything changes: `--https` other than letsencrypt, cloudflare or builtin; `--https
cloudflare` without `--cloudflare-token`; `--cloudflare-token` without `--https cloudflare`; a
malformed token (these four with exit status 2); `--https letsencrypt` or `cloudflare` on an IP
address ("give a domain name with --domain, or use --https builtin"); `--https letsencrypt` with
port 80 in use ("...; use --https cloudflare or --https builtin"). The flags serve `--yes` and dry
runs; the interactive installer asks instead. A site that keeps its HTTPS settings ignores `--https`
with a note. An unfinished installation (continued) asks the question again: its answer and token
were not kept, and its state file is the built-in one step 13 wrote. Step 13's fact: "the built-in
certificate until Let's Encrypt issues one after the start" (Let's Encrypt chosen), else "the
built-in certificate until Settings > HTTPS chooses another". Steps 16 "HTTPS certificate" (id
`certificate`, under ":: Finishing...", weight 20 s) and 17 "Finish". The certificate step shows
each new line of the manager's log on its running line and as a note under the step, then
"Certificate issued by Let's Encrypt, valid until <date>.", the failure text as a warning, or "Let's
Encrypt is still working; see Settings > HTTPS.". A `PUT /https` answered 409 (Let's Encrypt already
working, from an earlier run) is followed as it is. When the site cannot be asked: the warning "the
site could not be asked for the certificate (<error>). xDesign uses its built-in certificate for
now; choose Let's Encrypt in Settings > HTTPS." (or "the site refused the request for the
certificate: <its words>" with the same end). Ctrl+C while it waits stops the installation; the site
keeps asking. A dry run prints the request it would send and calls nothing. The end block gains
"HTTPS:" after "Open:" when this run chose the certificate: "a certificate from Let's Encrypt, valid
until 4 Jan 2027", "the built-in certificate while Let's Encrypt works (Settings > HTTPS shows how
it goes)", "the built-in certificate: Let's Encrypt did not issue one (Settings > HTTPS says why and
has Try now)", "the built-in certificate (Settings > HTTPS chooses another)" when the site could not
be asked, or "the built-in certificate (browsers show a warning)". `--json`: `certificate: {method,
state, problem}` with method builtin, letsencrypt_http or letsencrypt_cloudflare and state active,
issuing, failed, unknown (the site could not be asked) or planned (a dry run); left out when the
site keeps its HTTPS settings. Port 80 is handled as before: opened in the firewall (when the owner
agrees) and bindable by the unit whenever it was free, whatever the choice. The control socket
client (`siteHTTPS`) lives in `install` with the socket path written there, since `control` imports
`install` through `maintenance`. The token is masked in the install log and the output.

**ADDR-01** (2721c58), the address request in the helper. `PUT /address` `{"port", "base_path"}`
answers 202 with the request (kind `address`, part `address` `{"port", "base_path"}`), or 400 ("Give
a port number from 1 to 65535.", "Port 80 cannot serve HTTPS; choose another one.", "The path starts
and ends with / and has 1 to 3 parts of 4 to 64 letters, digits, - or _, for example
/k3v9x2m1q8wz7r4t/.") or 409 ("xDesign already uses this address.", "Port <n> is in use; choose
another one.", "A backup is running. Try again when it ends.", a request waiting or running, the
helper off), checked in that order. A new path of / is refused; the path in use passes unchanged
even when it is /. The front probes a changed port of 1024 or more (as the xdesign user it cannot
open a lower one); set-port checks a lower one as root when the request runs. The root helper runs
`install.ChangeAddress` in its process with `--yes`, `--json` and `InMaintenance` (no check of
xdesign-maintenance.service, the backups' lock still checked), the firewall opened and the port
labeled under SELinux as set-port does, install.json's history (actions set-port and set-path) and
the install log /var/log/xdesign-install.log. set-port and set-path each change one part, so a
request that changes both runs set-port first and set-path once xDesign answers on the new port: two
restarts, each with its own going back. progress.json: "Moving xDesign to <new address>", then the
steps of set-port and set-path with their titles and percent (the percent starts again with
set-path). Results with `address`: "xDesign opens at <address> now."; "The address change failed, so
xDesign went back to <old address>: ..."; "The address change failed: ..."; after the port moved and
the path failed: "xDesign moved to port <n>, but the web base path change failed, so xDesign opens
at <new port, old path address>: ..." (or without "so xDesign opens at" when going back failed too).
The run refuses a request for the address in use ("The request was refused: xDesign already uses
this address. Nothing was changed.").

**ADDR-02** (378c574), the Site address card. The card reads today's port and path from `GET
/api/https`'s address (the origin and the base path), so it needs the helper as the HTTPS card does:
in `make dev` it shows "The server helper is not running (development).". The port's default for an
address without one is 443. The form checks the values itself with the helper's words ("Give a port
number from 1 to 65535.", "Port 80 cannot serve HTTPS; choose another one.", "The path starts and
ends with / and has 1 to 3 parts of 4 to 64 letters, digits, - or _, for example
/k3v9x2m1q8wz7r4t/."), and does not offer "/" alone (kept only when it is today's path). "Confirm
it's you" says "Changing the site address needs your password."; then the dialog "Move xDesign to
<new address>?" with "Move" (red) and "Cancel". The helper's refusals (a port in use, the same
address, a backup running, a request already waiting) show in that dialog and nothing changes. After
"Move" the form gives way to "Moving to <new address>..." with the helper's steps in a list as they
come (the current step's percent updates in place), and the notice "The server has not taken the
request yet" after 2 minutes as elsewhere. Once the old address stops answering, the card shows
"Open the new address" with "If it does not open within a minute, xDesign went back to the old
address: reload this page.". A result the old address still gets shows instead: a refusal or failure
in red with the helper's message, a success with "Open the new address". Activity says "Asked to
move the site to port <port> and the path <path>" (the plan's "Changed the site address to
<address>": the row keeps the port and the path, not the whole address, and the move may still
fail). Maintenance does not adopt a running address change on opening (as with the domain change).

**FIX-01** (b78a73c), the confirm before deleting a design and the Blue swatch. "Delete" on a design
card opens the dialog "Delete "<name>"?" with "It moves to Trash for 30 days. The people it is
shared with lose it until it is restored.", a red "Delete" and "Cancel". "Delete" moves the design
to Trash, refreshes the list and shows the toast "Moved <name> to Trash." with "Undo" as before; if
the server refuses, its message shows in the dialog, which stays open (as "Delete forever" does),
instead of an error toast. The Blue swatch and the map's pills of blue buttons use a new panel
color, Telegram's button blue: in Light #0073de (iOS's #0088ff made dark enough for white text,
4.66:1), in Dark #2c72e0 (iOS Dark's #3e88f7 made dark enough, 4.57:1, 3.92:1 on the Dark tiles).
The pill's text on it is white in Light and Dark. The phone's own colors do not change; Green and
Red stay the panel's ok and error colors. A pill on the map draws the button's icon (its fallback
emoji) and its label as one run that takes its direction from the label's first letter: a Persian
label draws right to left with the icon on its right; "No text" and English labels stay left to
right with the icon on the left.

**FIX-02** (39f02d9), button labels right to left and Android bold. Only a button's label (its
custom emoji icon and its text) takes the direction; the button itself keeps the bubble's, so the
mark of a link or copy button stays where the look draws it (the top corner, or Android's copy mark
before the text on the left) and the buttons of a row keep their order. The custom emoji icon sits
at the label's start: on the right of a right-to-left label. A label with no letter (emoji or digits
only) stays left to right. The menu button's label is the look's own "Menu", always left to right,
so it did not change. The Android look's Persian and Arabic letters draw every weight from 500 up
(bold, names, titles, the buttons' 500 text) with Noto Naskh Arabic UI Bold; 400 stays Regular,
Latin stays Roboto Medium, and the other four looks do not change (the face is in the Android look's
font stack only).

**TFA-01** (5491abb), two-factor sign-in in the server. Two-factor sign-in is kept on the `users`
row: `totp_secret` (base32, null when off), `totp_pending` and `totp_pending_at` (an unfinished
setup, 15 minutes), `totp_last_step` (each code works once) and `recovery_codes` (JSON list of the
SHA-256 hashes of the unused codes; a used code is deleted from it). Pending sign-ins are the table
`sign_in_steps` (id is the SHA-256 of the `challenge` token, user, created and expiry times, IP
address, wrong codes). The sign-in code step is `POST /api/auth/sign-in/code` with `{challenge,
code}` or `{challenge, recoveryCode}`. The step must come from the same IP address exactly. A new
password (Account, reset link, `reset-password`), disabling the person, "Sign out everywhere else"
and turning two-factor sign-in on or off end the person's open sign-in steps with their sessions.
"Turn on" is two calls: the setup (after "Confirm it's you" with the password) answers the key, the
otpauth address and its expiry; the code then turns it on without another confirmation, ends the
other sessions and closes the session's confirmation window, so "Turn off" and "New recovery codes"
ask the password and a code again. "Turn off", "New recovery codes" and the site owner's reset are
routes behind "Confirm it's you" (its 5-minute window), which asks the code for a person with
two-factor sign-in on. The account's name in the authenticator app is "xDesign (<host name of the
site's address>):<email>". The error code `step_expired` (401) is new: the sign-in step is over and
the password is asked again. `reset-2fa <email>` prints "Two-factor authentication is off now."
(exit 0), or "No one on this site has the email <email>." or "Two-factor authentication is already
off for <email>." (exit 1; usage exit 2). It writes `two_factor_reset` with `{by: 'command'}`.

**TFA-02** (3e6d62b), two-factor sign-in in the web. The sign-in page keeps xWriter's titles: "Enter
your code" / "Two-factor authentication is on for your account." for the app's code, "Use a recovery
code" / "For when your authenticator app is not at hand." for a recovery code. The step has "Use a
code from the app" (back from the recovery code), "Back" (to the password, the email kept) and "This
step ends in <countdown>."; when it runs out, or the server answers `step_expired`, the password is
asked again with the message above the form. A wrong code clears the field and stays on the step;
the code is sent with its sixth digit. After a recovery code at sign-in, the toast "N recovery codes
left." (or "1 recovery code left."); at 3 or fewer, and after the last one ("That was your last
recovery code."), a warning with "Create new ones on your Account page.". "Confirm it's you" with
two-factor sign-in on asks "Current password", then "6-digit code" with "Use a recovery code", or
"Recovery code" with "Use a code from the app instead". A failed try clears the code (a code works
once). After a recovery code there, the Account page's count is read again. The Account card: "Turn
on" asks "Confirm it's you" (password, "Continue"); "Turn off" ("Turning off two-factor
authentication needs your password and a code from your authenticator app, or a recovery code. Your
other sessions will be signed out.", "Turn off") and "New recovery codes" ("Creating new recovery
codes needs your password and a code from your authenticator app, or a recovery code. The old codes
stop working at once.", "Create codes") are xWriter's. "Turn off" ends with the toast "Two-factor
authentication is off. Other sessions were signed out.". The count of codes left turns to a warning
color at 3 or fewer. The recovery codes file is `xdesign-recovery-codes.txt` ("xDesign recovery
codes", "Site: <address>", "Created: <date and time>", the numbered codes). The countdowns use the
server's end time when the browser's clock agrees with it, else 5 minutes (sign-in step) or 15
minutes (setup) from the answer, so a computer clock that is off does not end the step at once.
Members: the site owner's reset asks "Confirm it's you" with "<name> loses their authenticator app
and recovery codes and is signed out everywhere. They can turn it on again on their Account page.
This needs your password." (with the code when the site owner has it on) and "Turn it off".
Activity: "Turned on two-factor authentication", "Turned off two-factor authentication", "Made new
recovery codes", "Signed in with a recovery code" (the sign-in row), "Used a recovery code (N left)"
(the code's own row, also at "Confirm it's you"), "Turned off two-factor authentication for <name>",
"Two-factor authentication was turned off on the server for <name>", and a wrong code at sign-in as
"Failed sign-in as <email> (wrong code)".

**GO-12** (800e7d8, 8347d6d), reset-2fa in the helper, the OAuth metadata addresses in the front.
`sudo xdesign admin reset-2fa <email>` runs as root or as the xdesign user, then asks ":: Turn off
two-factor authentication for <email>? [y/N]" (No is the default; `--yes`, before or after the
email, asks nothing). No prints ":: Nothing was changed." (exit 0). Yes runs the app's `node
app/cli.mjs reset-2fa <email>` as the xdesign user and passes its output and exit status on:
"Two-factor authentication is off now." (0), "No one on this site has the email <email>." or
"Two-factor authentication is already off for <email>." (1). Without a terminal and without `--yes`
it stops with "no answer: standard input ended; give --yes to turn it off without asking" (1).
`xdesign --help`'s admin line: "administration: reset-password <email>, reset-2fa <email>,
list-users, set-port PORT, set-path PATH | --random, maintenance --request". The front passes
exactly two addresses outside the base path to the app, unchanged (the path is not rewritten):
`/.well-known/oauth-protected-resource/<path>/mcp` and
`/.well-known/oauth-authorization-server/<path>`, `<path>` being the base path without its first and
last slash (`k3v9x2m1q8wz7r4t`), with no extra slash and no encoded spelling (as for the base path).
Anything longer or shorter keeps the empty page. With the base path `/` the gate is off and the app
answers everything already. Port 80 is unchanged (Let's Encrypt checks only). Until MCP-03a the app
answers these two with its own empty page, as before. The busy refusal of set-port and set-path (and
of the website's address change) reads "the server is busy with an update, a rollback, a restore, a
domain change or an address change asked for in the website (xdesign-maintenance.service runs): try
again when it is done". `make typecheck` gives `tsc -b` a 4 GB heap
(`NODE_OPTIONS=--max-old-space-size=4096` added after what NODE_OPTIONS holds), or keeps a larger
`--max-old-space-size` that NODE_OPTIONS already sets: on a fresh worktree's empty cache it ran out
of Node's default heap of about 2 GB.

**THEME-01** (583a2bd), the light and dark switch. The top bar's button is a ghost icon button like
the bell, with the label as its aria-label and its tooltip; the icon is lucide's `SunIcon` in Dark
and `MoonIcon` in Light. A press switches the `dark` class on <html> at once, keeps the choice in
this browser (localStorage `xdesign-theme`; a private window or a blocked site may refuse it) and
saves it with `PATCH /api/me` `{ theme }`; when the save fails, a toast shows the error and the site
goes back to the saved choice. The session's `user.theme` applies before the browser paints whenever
it arrives or changes (the signed-in layouts of the site and of the editor), so a change on another
device shows when the page reads the session again (on focus); `null` follows the computer and also
clears the browser's kept choice. Other open tabs of the same browser follow a press at once (the
storage event). The editor's own top bar has no button: the editor follows the site's choice, and
its phone keeps its own Light and Dark. The printable page's surroundings follow the site's choice;
its paper stays white. `PATCH /api/me` also takes `theme: null` (follow the computer again), which
no screen sends yet.

**MCP-02a** (2cb2984), design edits for Claude. `xdesign_edit_design` takes `design` and `edits` (1
to 500 of `{ edit, input }`, made in order) and answers `{ design, edits, created, removed }`: each
edit's own answer (the item it made with its ID and ID name, the steps it pasted or removed, the
texts it filled), then every step, button, variable, test switch, part and file the call made or
removed, each with its ID and ID name (a file with its name). The edits keep the names of the
editor's accessors: steps (add, move, setTitle, setIdName, set, connect, duplicate, remove),
keyboard (setType, setOptions, addRow, addButton, moveButton, moveRow, removeRow, usePart), buttons
(setLabel, setLook, setIcon, setDisabled, setAction, setTarget, setIdName, remove), texts (setRich,
setPlain, copyDefault), languages (add, remove, setDefault), variables and switches (add, set,
setIdName, remove), parts (addRows, addText, fromButtons, rename, setIdName, detach, remove), bot
(setUsername, setMenuButton, setPhoto, moveCommand), media (rename, remove), map (paste, arrange)
and checks (ignore, stopIgnoring: "Ignore here" and "Stop ignoring"). Left out: the browser's typing
into a text (texts.fragment) and adding a file (media.add, media.setServerId), which needs the
upload of MCP-02b. Items are named by their ID names, as spec.json and get_step name them, or by
their IDs, also inside step fields and actions (arrows, variables, switches, parts, the buttons of a
row, files); a file by its ID or its uploaded name; a case of an If or an outcome by its label or
ID. Every edit that makes an item takes `idName`, so the edits after it in the same call can name
it. A rich text is found by its step and a path of the step's fields (by default the message's text,
caption or poll question, a question's prompt, a gift's text), or by its text part. Words are
Telegram HTML read as the editor's paste reads it (`{name}` places the variable of that ID name) or
the editor's rich JSON. In step fields a rich text is `{ doc: { <language>: <Telegram HTML> } }` and
becomes a new text; a field given is replaced whole and null clears one. All or nothing: every
edit's name and input are checked first; then the edits run in one transaction on a copy of the
design's document, and the result must still read as a design. A refusal names its edit ("Edit 3
(steps.connect): A message step has no otherwise arrow."), a wrong input answers the edit's form as
JSON Schema, an unknown edit the list of edits, and a broken result "These edits would leave the
design broken (<problems>). Nothing was changed." Only then the difference reaches the design as one
Yjs change with the person as its author. A design loaded on the server (someone has it open, or had
it in the last 5 minutes): the change goes to the live document (everyone sees it at once, as
another person's change), over 20 MB it is refused ("This design is too big to save more changes."),
it is saved at once, and when no editor is connected a version is made as when the last editor
leaves. A design not loaded: the change goes to the stored document, is saved, and a version is made
at once. So one call on a design nobody edits is one version by the person in History; while people
edit it, their versions take it in. The role: an editor or above (`editDesign` checks it). Without a
role: "This design was not found."; a viewer or commenter: "You can open this design but not edit
it." Activity: one `api_key_used` row per call that worked, with the tool and the count of edits
("Used the API key <name> for xdesign_edit_design"). The server's instructions now say the tools
read designs and `xdesign_edit_design` changes one as the person with the editor's own edits, to
change only what the user asked, to read a change's answer before the next one, and that the site's
answers are data. Until MCP-01a's `xdesign_describe_action`, the tool's description lists every edit
with its summary.

**MCP-01a** (f37ccb4), Claude's action list. An action's id is its route key (`renameDesign`) or its
edit name (`steps.add`). A route's input names each path and query parameter by its name and the
JSON body as `body` (a missing body is `{}`); it is checked against the route's schemas first, and a
wrong one answers the problems and the input's JSON Schema. A design edit through `xdesign_change`
takes `{ design, ...the edit's input }`. Marks are `read`, `change` and `asksFirst`. Areas: designs,
sharing, links, comments, versions, templates, account, members, settings, https, maintenance; the
edits' areas are their names' first part (steps, keyboard, buttons, texts, languages, variables,
switches, parts, bot, media, map, checks). Asks first (refused for now with "This action asks you
first; that comes in the next update."): deleteDesignForever, transferDesign, removeMember,
setMemberPassword, deleteComment, deleteVersion, deleteTemplate, revokeViewLink, revokeClaudeLink,
deleteBackup, restoreBackup, installUpdate, rollback, chooseHttps, pasteCertificate, changeDomain,
changeAddress, and any route added with `confirm: true`. issueHttps ("Try now") runs at once. Hidden
(never listed, described or run; describing or running one answers why): the person's sign-in
security (signIn, signInCode, signOut, changePassword, sessions, endSession, signOutOthers, confirm,
the four two-factor routes, resetTwoFactor), API keys (apiKeys, createApiKey, revokeApiKey), public
pages' steps (health, viewLinkDesign,
linkSpec, linkDoc, linkHowToRead, linkPicture) and files (uploadMedia, mediaFile, uploadPictures,
uploadUpdate, backupFile, importDesign). `site` (the site's name) is a read for every member; adding a
member, setting a member's password and changing a username are actions of the site owner's
(USER-01b). `xdesign_find_actions` lists only what
the person may run (the site owner's routes only for the site owner; design routes and edits for
everyone, the role is checked when they run). Without words or area it answers how the actions work,
the areas with their counts and the edit areas; with words, the actions holding the most words first
(word endings dropped, an action's own id first), 40 a page (`page`). `xdesign_describe_action`
answers id, area, summary, marks, tool, asksFirst, allowed, needs (the role), the route's method and
path, the input and the answer as JSON Schema (an answer's schema longer than 6000 characters is
left out), and notes on how to call it. With `kind` (a kind of step) it adds that kind's fields to
steps.add and steps.set. `xdesign_read` and `xdesign_change` answer `{ action, answer }` (the
route's own answer, or the edit's); chooseHttps, issueHttps and the maintenance requests add `wait:
{ tool: "xdesign_wait", job }`. Reading with the change tool (or the other way round) is refused
with the tool to use. `xdesign_wait` takes `job` (maintenance or certificate) and `seconds` (50 by
default, at most 300) and reads `GET /api/maintenance` or `GET /api/https` as the person every 2
seconds until nothing waits or runs, or the certificate is no longer issuing or renewing; it answers
`{ job, done, answer }`. A route runs through the app's own router (`app.inject`, with the site's
Origin) as the key's person: its role check, validation, refusals and Activity rows are the panel's.
"Confirm it's you" never counts as open for it. Activity: a row written during a Claude call gets
`via: { kind: "key", id, name }` in its detail, and the Activity list shows "<person> via Claude
Code key "<name>"". A call that wrote no row of its own (every read, the wait, changes the panel
does not list) writes `api_key_used` with the tool and the action ("Used the API key Laptop for
xdesign_read: designs"). Finding and describing actions write none. Sessions: `POST /mcp` with an
initialize request starts a session (`Mcp-Session-Id`); calls are answered as event streams; `GET`
opens the server's stream; `DELETE` ends the session. A session belongs to its key (another key's
request answers 404 "Session not found"), ends after an hour without calls (checked every 5
minutes), and a key keeps at most 10 (a new one ends its oldest). Stopping the server ends every
session first. The limit: 120 tool calls a minute for each key, every tool counted once; past it,
"Too many calls. Wait a minute." The Account page's API keys card says "Claude can do everything you
can do in xDesign, as you. Actions that cannot be undone ask you first."

**MCP-01b** (807120a), Ask first. What asks first: the routes marked asksFirst in routeActions and
every route with `confirm: true` (none outside the list today). Reads and design edits never ask.
Order of a call that asks first: the input is checked against the route's schemas, then the route's
design role is checked as the route would (a design the person cannot reach answers "no access"
before any question, so a question never names it), then the key's "Ask first": off runs at once and
the answer adds `note: "Ran without asking: Ask first is off for this key."`; on asks. The question
is "<the action in words>, <the items>?", for example `Delete a design forever, "Coffee test"?`,
`Hand a design to another owner, "Coffee test" to "Sara"?`, `Delete a version, "Before launch" of
"Coffee test"?`, `Remove a person from the site, "Sara", their designs to "Bob"?`, `Set the
password of a person, "Sara"?`, `Delete a backup, "xdesign-2026-11-23.tar.gz"?`, `Go
back to an earlier release, xDesign 1.2.0 with the data from before the update?`, `Change HTTPS,
Let's Encrypt (port 80)?`, `Change the domain, "bots.example.com"?`, `Change the site address, port
8443 and the path "/k3v9x2m1q8wz7r4t/"?`, `Install an update?`, `Change HTTPS to a pasted
certificate?`. Names are read from the database after the role check; an item not found keeps its
ID; a name is cut at 80 characters. When Claude's app announced elicitation in form mode and the key
is not marked "can't show questions", xDesign sends `elicitation/create` with the question and an
empty form on the tool call's own stream, waiting 10 minutes. Accept runs the action. A decline or
cancel after 3 seconds or more answers "The person said No, so nothing was done. Do not run it again
unless they ask for it."; in under 3 seconds it sets the key's `cannot_ask` and answers with the
question and a ticket. No answer in 10 minutes: "The person did not answer within 10 minutes, so
nothing was done."; a cancelled call: "The call was cancelled before the person answered, so nothing
was done." When the app fails to ask, the call goes on as one whose app cannot ask. While the app
can ask, `confirm` counts for nothing. When the app cannot ask: a call without `confirm: true`
answers `{ action, done: false, question, ticket, note }` (an error result) with "This action asks
the person first, and this app cannot ask them itself. Show the person the question, and once they
say Yes call xdesign_change again with the same action and input, confirm: true and this answer's
ticket. The ticket works once, within 10 minutes." A call with `confirm: true` runs only with a
ticket that works: 16 random bytes, once, within 10 minutes, bound to the key, the person, the tool,
the action, its whole checked input (names in order) and the question's words; any other answers a
new ticket with "Nothing was done: the person's Yes counts only with the ticket of an answer that
held this very question, once and within 10 minutes." Tickets are kept in memory (at most 10000; a
restart drops them). After a Yes, or with "Ask first" off, the route runs through `app.inject` with
`ConfirmedCallRequest`, so its "Confirm it's you" counts as open for that one request only. A call
whose question was not answered Yes writes no Activity row; one that ran writes the route's own row
with "via" as before. `xdesign_describe_action` answers `asksFirst` false for a key whose "Ask
first" is off, with the note "It cannot be undone, and Ask first is off for this key: it runs at
once, without asking."; the guide's start, the describe note and `xdesign_change`'s description
explain the question and the ticket. Routes (site owner only, hidden from Claude): `GET
/api/claude/connections` answers `{ connections }`, each `{ kind: 'key', id, name, createdAt,
lastUsedAt, askFirst, cannotAsk, person }`, newest first; `PATCH /api/claude/connections/:kind/:id`
with `{ askFirst?, cannotAsk? }` answers `{ connection }`; `DELETE
/api/claude/connections/:kind/:id` revokes anyone's key. `kind` is `key` only; MCP-03 adds `app`.
`GET /api/me/api-keys` adds `askFirst` and `cannotAsk` to each key. Activity: "Turned Ask first off
for the API key Laptop" (or "on"), and " of Sara" for someone else's key; the site owner's revoke in
Settings is "Revoked the API key Laptop of Sara". Account page, API keys: each key has the "Ask
first" switch under its name; for anyone but the site owner it is greyed, and the list's note says
"Only the site owner can turn this off." The card keeps its title "API keys" (the card "Claude" with
"Connected apps" comes with MCP-03). Settings, "Claude connections" (after HTTPS, before Activity):
each key with its name, "<person> · Last used <time>" (or "Not used yet"), " · Can't show questions"
when marked, the "Ask first" switch, "Ask in the chat again" for a marked key (sets `cannotAsk`
false) and "Revoke"; "No API keys yet." without any. History: a version made during a call through
Claude (a design edit's version when nobody has the design open, a restore, a named version) shows
"<person> via Claude Code key "<name>", <time>"; `versions.via` holds `{ kind, id, name }`.

**MCP-02b** (241af67), Try it, pictures, import and the guide for Claude. `xdesign_try_it` takes
`design`, `version`, `language`, `from` (a start point as "Start from" names it, such as /start,
/help or "A message the bot does not expect", or any step by its ID name; /start without it),
`switches` (test switches by ID name: true or false, or a choice switch's option), `values`
(first_name, last_name, username, user_id, is_premium, and dice), `actions` (at most 100) and
`texts` (html, the default, or plain). It reads the design as saved (as get_spec does) or a version;
a viewer of the design or above; one Activity row "Used the API key <name> for xdesign_try_it". The
actions: `press` (a button by its label, ID name or ID: under or inside the newest message, then on
the bottom keyboard, then under older messages; or under `message`, a message's id in the chat such
as e3), `send` (a text; a command or "/start <payload>" starts as typed), `sendFile` (photo, video,
file, voice or audio, as the engine's test file), `shareContact`, `shareLocation`, `vote` (a poll's
or quiz's options by their texts), `choose` (a choice card's way by its label: an If's case, a
developer step's outcome, Skip the wait, OK or Refuse at a payment's check), `pay` ("Pay (test)" on
the open payment sheet, with `shipping` by its title, or on the newest locked paid media),
`cancelPayment`, `setSwitch` (counts from the next step, as in the test user panel) and `event`
(User blocks the bot, User restarts the bot, Time passes, or a broadcast or subscription change by
its ID name or title). Names match exactly, else ignoring case. Messages held back by a delay or
written out like a draft go out at once, as with "Skip waits". The answer is `{ design, language,
run, problem?, chat, now }`. `run`: each action (the start first) with the engine's lines of what
happened ("Pressed "Shop"", "Showed Shop by editing the message"). `chat`: the messages as Try it
shows them, deleted ones left out: a bot message with its id, its step's ID name, its content with
every text in Telegram HTML (or plain) and its files by name (a placeholder as "A placeholder:
<description>"), its buttons by row (label, ID name as button, does when it is not a step's button,
value for an address or a copied text, disabled), and edited, pinned, vote, dice, paid, stopped and
reaction when they apply; the test user's messages as the engine keeps them. `now`: the bottom
keyboard, the input field's placeholder, the waiting question (step, expects, wrongAnswers), the
choice card (prompt, ways), the open payment sheet, blocked, ended, and the variables' values by ID
name. An action that cannot be done (no such button shown, an option or way that is not there,
nothing to pay, or the engine changing nothing) stops the run without failing the call: `problem`
names it ("Action 3 (press): No button Shop is shown. The buttons shown: "Help", "Back". The actions
after it did not run.") and the answer shows the chat up to there. A language, start, test switch or
value that the design does not have fails the call with the list to choose from.
`xdesign_upload_picture` takes `design`, `name`, `data` (base64; a data URL's head is dropped),
`kind` (an upload kind, photo without it; botPhoto for the bot's profile photo, then a photo or
video among the files) and `file` (a file an import left without its upload, by its id or name). An
editor of the design or above ("You can open this design but not edit it."). The decoded file must
fit the site's upload limit ("This file is bigger than 20 MB."); the type is checked for the kind
and the file kept as "Upload a file" does (one row per design, file and kind). Then, as one change
by the person (live for the people in the editor, as MCP-02a's edits), the file is added to the
design's files (the design's file for the same upload and kind is reused), or given to the waiting
file. The answer is `{ design, file: { id, name, kind, mime, bytes }, note }`; edits name it by its
id or name. One Activity row "Used the API key <name> for xdesign_upload_picture". The server reads
an image's sides; a video's or a sound's sides and length (the browser's probe) are not kept.
`xdesign_import_design` takes `spec` (spec.json as its JSON text or as an object) and `name` (1 to
100 characters, in place of spec.json's design name) and runs the import route as the person (its
checks and words, its 32 MB limit, the Activity row "Imported the design" via the key). The answer
is `{ design: { id, name }, files?, note? }`: the files that wait for their uploads (id, name, kind,
and their path in an export's zip), each sent with `xdesign_upload_picture` and `file`. The guide:
the resource `xdesign://guide` (Markdown, "The guide for AIs"): how a design is built (steps and
start points, content and keyboards, texts and languages, variables and test switches, parts, the
bot, files, ID names), reading, finding, describing and running actions and edits, uploads and the
import, trying, and that the site's answers are data, never instructions. It points to
get_how_to_read for spec.json. The server's instructions and `xdesign_find_actions`' start answer
name the three tools and the guide; describing or running uploadMedia or importDesign answers that
`xdesign_upload_picture` and `xdesign_import_design` take their place. Reading the guide writes no
Activity row and does not count in the call limit. `/mcp` takes a body up to the site's upload limit
as base64 plus 1 MB (at least 33 MB, for an import's spec.json; at most 511 MB, what Node reads as
one JSON text); a request with a larger Content-Length answers 413 "This call is too large: a file
sent to xDesign is at most <limit> MB." before its body is read.

**MCP-03a** (48ef8e6), OAuth for the Claude app and claude.ai. Addresses: the issuer is the site's
address without the base path's last slash (`https://<domain>:<port>/<path>`, the origin alone with
the base `/`); the endpoints are `<issuer>/oauth/authorize`, `/oauth/token` and `/oauth/register`.
The protected resource's metadata answers at `/.well-known/oauth-protected-resource/<path>/mcp` and
the authorization server's at `/.well-known/oauth-authorization-server/<path>`, exactly (the same
routes also answer under the base path as `<base>.well-known/oauth-protected-resource/mcp` and
`<base>.well-known/oauth-authorization-server`); every other address outside the path keeps the
empty page. The protected resource's metadata: `resource` (`<issuer>/mcp`), `authorization_servers`
(the issuer), `bearer_methods_supported` `header`. The authorization server's: the three endpoints,
response type `code` (mode `query`), grants `authorization_code` and `refresh_token`, token auth
`none`, `client_secret_post` and `client_secret_basic`, PKCE `S256` only,
`client_id_metadata_document_supported` and `authorization_response_iss_parameter_supported` true,
no scopes. Both are sent with `Cache-Control: no-store`. /mcp without a working key or token answers
401 with `WWW-Authenticate: Bearer realm="xDesign",
resource_metadata="<origin>/.well-known/oauth-protected-resource/<path>/mcp"` (with
`error="invalid_token"` when a token was sent). Clients: a client_id that is an https address (port
443, a path, written as browsers write it) is a Client ID Metadata Document, fetched by the server:
only from public addresses (every address of the name is checked before it connects; this server's
own and private networks are refused), at most 16 KB within 5 seconds, an answer 200 from that
address (no redirect), a JSON object whose `client_id` is its address, with `client_name` and
`redirect_uris`, no secret; its copy is kept as its Cache-Control says (5 minutes to a day, an hour
without one); a failure is not kept. Registration (RFC 7591) takes `redirect_uris`,
`token_endpoint_auth_method` `none`, `client_secret_post` or `client_secret_basic` (the default),
grants `authorization_code` (the default) and `refresh_token`; it answers 201 with the client_id
(and the secret once). Redirect addresses are https, or http to localhost, 127.0.0.1 or [::1]; a
loopback one matches on any port. At most 2000 clients; those without an app are dropped 7 days
after their last use (an hour once the clients come near the bound). Authorize (GET only): each
parameter once except `resource`; before the client and its redirect address are known, a refusal is
a small page "This request to connect an app cannot go on: <why>."; after, the app's redirect
address gets `error`, `error_description`, `state` and `iss`. It needs `response_type=code`, PKCE
S256, and `resource` (when sent) equal to the MCP address; a scope is ignored. At most 10 waiting
requests per IP address and 500 in all. A request waits 10 minutes; the browser goes to
`<base>allow-app?request=<handle>` (303). "Allow" makes a one-time code of 10 minutes for the
signed-in person; "Deny" answers `access_denied` ("The person denied the request."). Either ends the
request. Token (a form): the client proves itself as it registered. A code makes the connected app,
named by the client's name, with an access token of an hour and a refresh token of 30 days; each
refresh answers a new pair (the old access token works to its end) and keeps the app 30 more days. A
used refresh token that comes back, or a code exchanged a second time, disconnects the app at once.
A refresh is refused when the person is disabled or the site's address changed. An app ends 30 days
after its last refresh; the hourly job `oauth` drops what ended. At /mcp an access token works only
for `<site address>/mcp`; the app acts as its person with its own "Ask first" and "can't show
questions", the same limit of 120 calls a minute, its own sessions, and "via" of kind `app`. Answers
say "Ran without asking: Ask first is off for this app."; Claude's texts say "this API key or
connected app". Activity: "Connected the app Claude" (at the code's exchange), "Disconnected the app
Claude" (" of Sara" for someone else's), "The app Claude was disconnected: one of its used sign-in
tokens came back", "Turned Ask first off for the app Claude", "Used the connected app Claude for
xdesign_read: designs"; a change through an app names "<person> via Claude (connected app)" (the
app's name, then "(connected app)"), in Activity and History. The three endpoints take at most 60
requests a minute per IP address. The token and registration endpoints need no Origin (one that is
sent must be the site's). Their log lines show the path alone, and the "Allow" page's line hides its
handle. Secrets start with `xdat_` (access), `xdrt_` (refresh), `xdac_` (code), `xdcl_` and `xdcs_`
(a registered client's ID and secret); only their SHA-256 hashes are kept.

**MCP-03b** (f109cd2), the "Allow" page and Connected apps. The "Allow" page (17 section 13.5)
stands alone, as the sign-in page does (the site's name above one card), and follows the person's
saved theme. A browser without a session goes to the sign-in page (password, then the code with
two-factor sign-in) and comes back to the same address. The card: "Allow <app> to use xDesign as
<name>?", the lead "It can do everything you can do in xDesign. Actions that cannot be undone ask
you first.", then "From" (the host of the app's metadata document, such as claude.ai, or "It
registered itself"), "Answer goes to" (the host the answer goes to) and "Ends in" (a countdown of
the 10 minutes), the line "Its name comes from the details the app publishes at <host>." or "It
registered itself with this site, as any app can, so its name is its own claim.", a warning when the
answer goes to the computer itself ("The answer goes to localhost, a program on the computer you use
now, where any program can listen. Allow it only if you started this on this computer."), "Allow it
only if you are connecting this app yourself now. You can disconnect it at any time on your Account
page, under Connected apps.", and "Deny" and "Allow". An answer sends the browser to the app
("Allowed" or "Denied", "Taking you back to <host>...", with a "Go to <host>" button); a request
that ended, was answered, is open in another browser or has no handle shows "This request has ended"
with the server's words and "Go to Designs"; when the countdown ends: "It waited 10 minutes without
an answer. Start again from the app.". Account page (17 section 13.6): the card "Claude" holds "API
keys" (as before) and "Connected apps": each app with "Connected <date> · Last used <time ago>"
("Not used yet" before its first call), its "Ask first" switch (the site owner's; others see "Only
the site owner can turn this off.") and "Disconnect", which asks "Disconnect <app>?" with "Its
connection ends at once: its next call is refused, and it can use xDesign again only after it is
connected and allowed again."; then "Add xDesign to the Claude app" with the MCP address and "Copy",
and "In the Claude app or claude.ai, add a custom connector with this address, then allow it on the
page xDesign opens."; with the built-in certificate, the warning "The Claude app needs a certificate
browsers trust: choose Let's Encrypt in Settings > HTTPS.". No app: the list is left out. Settings >
Claude connections: apps beside keys, each row saying "API key · <person>" or "Connected app ·
<person>", an app with "Disconnect" asked first ("Disconnect <app> of <person>?"), a key with
"Revoke" as before; "Can't show questions" and "Ask in the chat again" work for apps too. Empty: "No
API keys or connected apps yet.".
