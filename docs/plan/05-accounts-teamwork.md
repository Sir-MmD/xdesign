# 05. Accounts, sharing and teamwork

Who gets in, who can do what, and how people work together: live editing, presence, comments,
history and view-only links. Tables are in 02 section 5; pages in 04.

## 1. Accounts

1. **The site owner** is made by the installer with a username and a name (07 section 3, 18
   section 3.7); members are added by the site owner (18 section 3.4). Invite links and password
   reset links were removed (USER-01a). `xdesign admin reset-password <username>` on the server
   prints a new password.
2. **Adding members** (Members page, site owner only, 18 section 3.4): "Add member" with a
   username, a name and a password ("Generate", the eye, "Copy"), after "Confirm it's you"; the
   account works at once and never expires (USER-01b, USER-02). A member's menu has "Set
   password" (after "Confirm it's you"; the member is signed out everywhere, keeps it and changes
   it on their Account page, and their sign-in limit starts afresh) and "Change username"
   (nobody is signed out); the site owner's own row has "Change username" and "Change your
   password on the Account page". The page's search matches the name or the username.
3. **Disabling** (site owner): "Disable" ends the member's sessions and live connections at
   once; their designs stay and keep their sharing; "Enable" restores access. "Remove" is only
   possible after moving or deleting the member's designs ("Move their designs to: <member>").
4. **Sessions**: 30 days from the last use; the account page lists them with "Sign out" each.
5. Passwords, rate limits, tokens: 02 section 8.

## 2. Roles (D-16)

| Can | Site owner | Design owner | Editor | Commenter | Viewer | View link (S2) |
|---|---|---|---|---|---|---|
| See the design in Designs | all designs | yes | yes | yes | yes | no |
| Open the map, phone, Bot setup, Texts | yes | yes | yes | yes | yes | map and phone |
| Try it | yes | yes | yes | yes | yes | yes |
| Export, print | yes | yes | yes | yes | yes | yes |
| Edit anything | yes | yes | yes | no | no | no |
| Upload media | yes | yes | yes | no | no | no |
| Comment (S2) | yes | yes | yes | yes | no | no |
| Name and restore versions (S2) | yes | yes | yes | no | no | no |
| See history (S2) | yes | yes | yes | yes | yes | no |
| Share, change roles | yes | yes | no | no | no | no |
| View links, Claude links (S2) | yes | yes | no | no | no | no |
| Rename, duplicate | yes | yes | duplicate only | duplicate only | duplicate only | no |
| Delete, restore from Trash | yes | yes | no | no | no | no |
| Transfer ownership | yes | no | no | no | no | no |
| Save as template (S2) | yes | yes | no | no | no | no |

- Duplicating makes the person the design owner of the copy (no sharing is copied).
- Every member can create designs (Q-22).
- The site owner passes every check, also for designs not shared with them; their actions on
  others' designs are in the activity list.

## 3. Sharing

The "Share" dialog (design owner and site owner):

- "People with access": each person with their role ("Editor", "Commenter", "Viewer") as a
  drop-down and "Remove"; the design owner is listed as "Owner".
- "Add people": search the site's members by name or username, pick a role, "Add". Only existing
  members: to bring someone new, the site owner adds them first ("Not on the site yet? Ask the
  site owner to add them.").
- The site owner's role drop-down also has "Owner": "Make <name> the design owner?" (the old
  design owner becomes an Editor).
- (S2) "View-only link": the expiry ("1 day", "7 days", "30 days", "Never expires") and "Create
  link", which shows the link once with "Copy"; several links can exist, each listed with its
  creation date, expiry and last use, and "Revoke".
- (S2) "Claude link": 06 section 7.1.
- Changes take effect at once: a removed person's open editor shows "You no longer have access
  to this design." and closes; a person turned Viewer goes read-only within a second.

## 4. Live editing (D-06)

1. Everyone with edit rights edits at once (02 section 4). Changes to different things merge;
   two people moving the same box: the last move wins; two people typing in the same text: both
   texts merge character by character.
2. **Presence**: avatars in the top bar; on the map each person's cursor with their name in
   their color; the box someone edits gets their color as an outline and a small name tag; in a
   text, their caret with their name.
3. **Undo** is per person (02 section 4, item 6).
4. **Offline**: the browser keeps the design; edits made offline are merged on reconnect; if the
   design was deleted or the person lost access meanwhile, the editor says so and offers
   "Download my offline changes" (an xDesign export of the local copy).
5. **Read-only** connections (Commenter, Viewer) never send document changes; the server drops
   any that arrive.
6. **Big changes**: auto-arrange, paste of many steps, restore of a version (S2) and import are
   one transaction each, so others see them at once and the author can undo them in one step.

## 5. Trash

- Deleting puts a design in Trash for 30 days (only the design owner and site owner see it
  there); a daily job deletes older ones for good, with their media that no other design uses.
- A design in Trash opens nowhere: open editors close when it is deleted, and only "Restore" and
  "Delete forever" reach it.
- "Delete forever" asks: "Delete <name> forever? This cannot be undone."

## 6. Comments (stage 2)

1. Anchors: a step, a button, a text (step and language), or a free spot on the map.
2. Threads: the first comment and replies; edit your own, delete your own (the design owner
   deletes any; deleting the first comment deletes the thread); "Resolve" and "Reopen" by anyone
   who can comment.
3. Mentions: "@" lists the people with access; a mention makes an unread notification for
   them.
4. Notifications: the bell shows unread comments in designs the person can open, newest first;
   no emails.
5. Live: new comments appear for everyone in the design within a second (stateless messages on
   the live connection).
6. When an anchored step or button is deleted, its threads stay, marked "on a deleted step",
   with the old title.
7. Export: open comments are listed in `design.md` under each step as "Open questions" (optional
   in the export dialog, on by default), and through MCP (06 section 7.2).

## 7. Version history (stage 2, D-26)

1. **Automatic versions**: after 10 minutes with changes since the last version, and when the
   last editor leaves; thinned to one per hour after a day and one per day after a week; kept
   90 days.
2. **Named versions** ("Sent to developer", "v1 approved"): made by Editors and owners from the
   History panel or the export dialog ("Name this version"); kept until deleted by the design
   owner.
3. **View** opens a version read-only (04 section 15).
4. **Compare** lists added, removed and changed steps, buttons and texts between a version and
   now (or two versions), built from the plain models.
5. **Restore** makes a "Before restore" version of now, then replaces the document's content
   with the old one in one transaction (a new change, so it syncs to everyone and can be undone
   by restoring "Before restore").
6. **Export a version** from the History panel; the Claude link takes `?version=<name or id>`.

As built: automatic versions are made at the first save 10 minutes or more after the last version,
and when no Editor or owner is left on the design (their pending save runs first); thinning runs
hourly by UTC hours and days; "Before restore" and restore versions are kept 90 days without
thinning. Names of named versions are unique per design ignoring case; only named versions can be
renamed (Editors) or deleted (the design owner). A restore is one Yjs change that undoes the
changes made since the version (checked, with a copy of the version as fallback), keeps the
design's current name, and sends `versionRestored` to open editors.

## 8. View-only links (stage 2)

1. Created in the Share dialog; 32-byte tokens shown once in the link; revocable; optional
   expiry.
2. `/v/<token>` opens a read-only view with no account: map, phone, Try it, look and language
   switches, Export. No comments, no history, no other designs, no names of the people (only
   the design owner's name on the page).
3. The live connection for a view link is read-only and sees the design live (changes appear).
4. Media is served to the link's token only for that design.
5. Every use updates "last used"; revoked or expired: "This link no longer works. Ask the person
   who sent it for a new one."

## 9. Activity

The site owner's Settings has "Activity": sign-ins and failed sign-ins, members added, passwords
set and usernames changed, role changes, links and keys made or revoked, deletes and restores,
backups, updates and going back (made, downloaded, deleted and restored backups, HTTPS and domain
changes, updates and rollbacks asked for), each with who, when and which design; filter by person
or design; kept 1 year.

## As built (M2)

**AUTH-01** (0570b62).

Code: Passwords: `apps/server/src/auth/passwords.ts` (argon2id, `verifyPassword` with a stand-in
hash for unknown emails), `src/auth/common-passwords.ts` (208 common passwords of 10 or more
characters); Tokens: `src/auth/tokens.ts` (32 random bytes as base64url, SHA-256 hex, generated
32-character passwords); Sessions: `src/auth/sessions.ts` (start, read and renew, end one, end all
or all but one, confirm, list), `src/auth/context.ts` (`getSessionUser`), `src/auth/http.ts`
(@fastify/cookie, the Origin check, the renewed cookie), registered from `src/app.ts`; Rate limits:
`src/auth/limits.ts` (`TryLimit`, one table each for sign-in, invites and resets); Events:
`src/auth/events.ts` (`onUserAccessChanged`, `emitUserAccessChanged`); People: `src/auth/users.ts`
(`toUser`, `findUserByEmail`, `findSiteOwner`, `createUser` with the next of 10 colors); Routes:
`src/routes/auth.ts` (sign in and out, me, account, password, sessions, confirm),
`src/routes/invites.ts`, `src/routes/members.ts` (members, search, disable and enable, remove, reset
links and the reset page), `src/routes/settings.ts` (activity); "Confirm it's you":
`sessions.confirmed_until` (`migrations/0001_session_confirmed.sql`), the `confirm: true` option of
`addRoute` in `src/route.ts`; Activity: `src/audit.ts` (`audit(action, { userId, designId, detail
})`, `readActivity`); Ownership: `src/designs/ownership.ts` (`moveDesigns(from, to)`); Commands:
`src/commands/init-owner.ts`, `reset-password.ts`, `list-users.ts` in the table of `src/cli.ts`; Dev
owner: `src/auth/dev-owner.ts`, called from `src/main.ts` when `XD_DEV=1`; the Makefile's `dev`
target sets `XD_DEV=1`; Contract: `packages/api/src/common.ts` (codes `confirm_needed`,
`bad_origin`), `packages/api/src/routes/auth.ts` (`updateMe.email`).

- Session cookie `xd_session`: the token is 32 random bytes as base64url, the row's ID is its
  SHA-256 in hex; Path `XD_BASE_PATH` (`/` in `make dev`), HttpOnly, SameSite=Lax, Max-Age 30 days, Secure when the app listens on
  the helper's socket (not on the TCP port of `make dev`). A request whose session was last renewed
  over an hour ago moves `last_used_at`, `expires_at` (30 more days) and the person's
  `last_seen_at`, and gets the cookie again. Signing in removes the browser's previous session and
  every ended session of the site.
- A session of a disabled person counts as none (401); disabling also deletes the sessions. An ended
  session's row is deleted when it is read.
- Wrong passwords answer 400 `bad_request` (never 401, which the web app treats as signed out):
  "Email or password is wrong." on sign-in (unknown email or wrong password, the same time spent),
  "The current password is wrong." on Change password, "The password is wrong." on Confirm it's you.
  A disabled member with the right password gets 403 `no_access` "This account is disabled. Ask the
  owner to enable it."
- A new password of the most common ones answers 400 "This password is too common. Choose another
  one." (compared ignoring case).
- Rate limits: failed tries only (wrong password, unknown email, a used or expired link), 5 within
  15 minutes per IP address and per email, kept in memory; while used up the request answers 429
  `too_many_tries` before any check. Sign-in says "Too many tries. Wait 15 minutes or ask the owner
  to reset your password."; accepting an invite and saving a reset password say "Too many tries.
  Wait 15 minutes and try again." Change password and Confirm it's you count against the sign-in
  limit of the person's email.
- Change password ends the person's other sessions.
- Confirm it's you: `POST /api/auth/confirm` sets `sessions.confirmed_until` to 5 minutes ahead and
  answers `{ until }`. `addRoute(app, route, handler, { confirm: true })` answers 403
  `confirm_needed` ("Confirm it's you with your password first.") after the role check when the
  session's time has passed.
- Origin check: every request but GET and HEAD needs an `Origin` header equal to `XD_PUBLIC_URL`'s
  origin (with `XD_DEV=1` also `http://localhost:5173` and `http://127.0.0.1:5173`), else 403
  `bad_origin` ("This request did not come from the site's own address."). It runs in an onRequest
  hook before every route, including routes that do not exist.
- Invites: links `<XD_PUBLIC_URL><XD_BASE_PATH>invite/<token>`; status `used` before `revoked` before `expired`;
  revoking a used or revoked invite changes nothing and answers ok. The invite page answers 404 with
  "This invite link was used or has expired. Ask the owner for a new one." Accepting takes the
  invite and makes the member in one transaction, then signs them in; an email already in use
  answers 409 "Someone on this site already uses this email."
- Resets: links `<XD_PUBLIC_URL><XD_BASE_PATH>reset/<token>`, 24 hours, one use; a new link for a member deletes
  their earlier unused ones. A used or expired link answers 404 "This reset link was used or has
  expired. Ask the owner for a new one." Saving the password ends every session of the person; it
  does not sign them in.
- Members: listed oldest first; `designCount` counts the designs they own, those in Trash too. The
  site owner cannot be disabled or removed (400). "Remove" without `moveDesignsTo` while they own
  designs answers 409 "Move their designs to another member first."; moving makes the target the
  owner of every design (Trash too) and drops the target's design membership rows on them, in the
  same transaction as deleting the person.
- Search (`GET /api/members/search`): enabled members whose name or email contains the words,
  ignoring case in any script, sorted by name, at most 20.
- Account: `PATCH /api/me` also takes `username` (USER-01a), for the site owner only (403 for others, 409 when in
  use); `theme` (`light`, `dark` or null, THEME-01) and `mapLines` (`short` or `all`, MAP-11) for everyone; colors are stored in lower case. New people get the next of 10 colors in turn.
- Events: `onUserAccessChanged(listener)` returns a function that removes it; changes carry
  `userId`, `reason` (`disabled`, `removed`, `sessionsEnded`, `designRole`) and an optional
  `designId`. Emitted for sign-out, ending sessions, password changes and resets, disable
  (sessionsEnded and disabled), remove (removed, and designRole for the member who got designs).
  Listeners check again with `findSessionUser(sessionId)` (sessions.ts) and `getDesignRole`.
- Activity actions: `sign_in`, `sign_in_failed` (detail `email`, and `disabled: true` for a disabled
  member), `owner_created`, `invite_created`, `invite_revoked` (detail `inviteId`, `note`, `email`),
  `invite_accepted` (by the new member), `reset_link_created`, `member_disabled`, `member_enabled`,
  `member_removed` (detail `memberId`, `name`, `email`; remove also `movedTo` and `designsMoved`),
  `password_reset` (by the member; `by: "command"` from the command), `password_changed`. `userId`
  is who did it; a failed sign-in names the person whose email was typed. Rows older than a year are
  deleted at most once a day by the next row written. The list is newest first (time, then ID),
  with the names of people and designs that still exist; ACT-01: the route takes `page` (from 1)
  and `size` (10, 25, 50 or 100, 25 by default) and answers `{ entries, total }`, `total`
  counting the rows with the same filters.
- Later (ACT-01): `before` and `beforeId` are gone; the route pages by page number and size.

**AUTH-02** (6fadcaa).

Code: Routes: `apps/server/src/routes/designs.ts` (the list with filters and search, create, the
header, rename, duplicate, delete to Trash, restore, delete forever, transfer, the design members
list, add or change a role, remove). Not `importDesign` (EXP-02); Roles: `getDesignRole(userId,
designId, { trash })` in `src/auth/context.ts`; the `trash` option of `addRoute` in `src/route.ts`;
Designs with their documents: `src/designs/store.ts` (`createDesign` from `newDesignDoc`,
`duplicateDesign` with its media rows, `renameDesign`); Card summary: `src/designs/summary.ts`
(`summaryOf`, `refreshDesignSummary(designId, doc)`); columns `designs.step_count` and
`designs.languages` in `src/db/schema.ts`, `migrations/0002_design_summary.sql`; Trash:
`src/designs/trash.ts` (`deleteForever`, `emptyTrash`, `trashJob`); Jobs: `src/jobs.ts`
(`startJobs`, `stopJobs`); `src/main.ts` starts them after listening and stops them on close;
Transfer: `transferDesign` in `src/designs/ownership.ts`, beside AUTH-01's `moveDesigns`, which was
complete and stays as it is for "Remove"; Activity actions: ten design actions in `AuditAction` of
`src/audit.ts`.

- Filters: `all` lists the designs not in Trash, every one for the site owner, own and shared for
  others; `mine` own; `shared` those with a design_members row of the person (also for the site
  owner); `trash` deleted ones, own, or every one for the site owner. Newest change first; Trash
  newest deleted first. `q` matches part of the name, ignoring case in any script (as the member
  search).
- Cards: `role` is the effective role; `stepCount` counts the steps without notes and sections (a
  new design has 2); `languages` lists the design's languages, the default first. Both are kept in
  `designs.step_count` and `designs.languages` (JSON), set at create and duplicate;
  `refreshDesignSummary(designId, doc)` sets them from a document with `readDesign`.
- Create: language codes are stored in lower case; the creator is the design owner and `updated_by`;
  the document is `newDesignDoc` with the row's ID, stored with `encodeDoc` in `design_docs`.
- Rename: sets `designs.name` and the stored document's `meta.name`, and bumps `doc_version`,
  `updated_at` and `updated_by`; the same name changes nothing.
- Duplicate (every role): "<name> (copy)", the person as design owner and `updated_by`, no sharing.
  Media rows are copied with new IDs and the copy's media items get them as `serverId`; the copy's
  `meta.id` and `meta.name` are its own.
- Roles: the site owner and the design owner get `owner`, members their row's role, anyone else
  null. A design in Trash gives null, except with `trash: true` (the Trash routes: delete, restore,
  delete forever, registered with `addRoute(..., { trash: true })`) for its design owner and the
  site owner. Other routes answer 404 "This design is in Trash." to the site owner and 403 to
  others; a missing design 404 "This design was not found.".
- Trash: delete sets `deleted_at` and emits a `designRole` access change for the design owner, each
  member and the site owner, so open editors close; restore clears it; both again change nothing.
  Delete forever answers 409 "This design is not in Trash." outside Trash; it deletes the design row
  (the document, member and media rows cascade), then each media file no other media row uses.
- Daily job `trash`: the first run a minute after the start, the next 24 hours after a run ends; it
  deletes designs deleted 30 days ago or more the same way, with a `design_deleted_forever` row
  without a person and `by: "trash"`. Each run logs "job done" with `job`, `ms` and `deleted`, or
  "job failed" with the error.
- Sharing: the members list starts with the design owner as `owner`, then the members in the order
  added. Adding or changing a role (the same role changes nothing) answers 404 "This member was not
  found." for unknown people, 400 "The design owner cannot be added as a member.", and 400 "This
  member is disabled." when adding a disabled member. Removing the design owner answers 400 "The
  design owner cannot be removed."; removing someone without a row answers ok. A role change and a
  removal emit `designRole` for the person.
- Transfer: the new owner is any enabled member of the site (404 unknown, 400 disabled); their
  membership goes, and the old design owner gets an Editor row added by the site owner; the current
  owner changes nothing. Both people get a `designRole` access change. A design in Trash cannot be
  transferred (404).
- Activity actions: `design_created` (detail `name`), `design_renamed` (`from`, `to`),
  `design_duplicated` (on the copy; `fromId`, `fromName`), `design_deleted`, `design_restored`,
  `design_deleted_forever` (`name`; `by: "trash"` from the job), `design_transferred` (`from`, `to`,
  each `memberId`, `name`, `email`), `design_member_added` (`memberId`, `name`, `email`, `role`),
  `design_member_changed` (also `before`), `design_member_removed` (`memberId`, `name`, `email`,
  `before`).


## As built (M9)

**CMT-01** (a2afb2d).

Code: Tables: `comments` and `comment_reads` in `apps/server/src/db/schema.ts` (the `// CMT-01`
block at the end), `migrations/0003_comments.sql`; Contract: `packages/api/src/routes/comments.ts`
(`commentRoutes`, `commentAnchor`, `commentThread`, `comment`, `unreadDesign`, `unreadComment`),
exported from `packages/api/src/index.ts`; Routes: `apps/server/src/routes/comments.ts`, registered
in `src/main.ts` after the design routes; Live notice: `{ type: 'commentsChanged' }` in
`LiveMessage` of `src/live/server.ts`, sent with `sendToDesign` after every change; Activity:
`comment_added` ("Commented") and `comment_resolved` ("Resolved a comment") in `src/audit.ts` and
`apps/web/src/settings/activityText.ts`; Delete forever: the comment and comment read rows cascade
with the design (`src/designs/trash.ts` comment updated, no code change). Routes: `GET
/api/designs/:id/comments` (Viewer and above: every thread, newest first, each with its comments
oldest first, and `lastReadAt`, the person's last "mark read" or null), `POST
/api/designs/:id/comments` (start a thread), `POST .../comments/:commentId/replies`, `PATCH` and
`DELETE .../comments/:commentId`, `POST .../comments/:commentId/resolve` and `/reopen` (all
Commenter and above), `POST /api/designs/:id/comments/read` (Viewer and above), `GET
/api/comments/unread` (any member). A design in Trash or missing answers 404 also to the site owner,
as the other design routes. Threads: a thread is its first comment, whose `thread_id` is its own id,
and the replies with that `thread_id`. The anchor, `resolved_at` and `resolved_by` are kept on the
first comment only. Reply, resolve and reopen take any comment of the thread; replying to a resolved
thread keeps it resolved. Anchors (JSON with `on`): `{ on: 'step', stepId, title }`, `{ on:
'button', stepId, buttonId, title, label }`, `{ on: 'text', stepId, lang, title }`, `{ on: 'map', x,
y }` (map coordinates). `title` (the step's title) and `label` (the button's) are what the editor
sends when the thread starts, up to 200 characters, kept for "on a deleted step". The server does
not check the IDs against the document. Text: 1 to 5000 characters after trimming ("Write a
comment.", "Use at most 5000 characters."). Mentions: the editor sends the IDs of the people picked
from the "@" list (at most 50) beside the text; the server keeps each once, only people with a role
on the design (the site owner included), in the column `comments.mentions` (JSON). A comment returns
them as `{ id, name }` of the people still on the site. Edit: only the author ("Only its author can
edit a comment."); sets `edited_at`; the same text and mentions change nothing. A mention added by
an edit does not make the comment unread again. Delete: the author, or the design owner and the site
owner ("Only its author or the design owner can delete a comment."). Deleting a thread's first
comment deletes the thread with its replies. Resolve and Reopen: anyone who can comment; again
changes nothing (no notice, no activity row). Authors: `{ id, name, color }`, null once the person
is removed from the site (the comment stays, `author_id` set null; `resolved_by` too). Unread:
comments by others (or by removed members) written after the person's `comment_reads.last_read_at`
for that design, every one when they never marked it read, in the designs they can open (not in
Trash; the site owner: every design, as "All"). "Mark read" sets `last_read_at` to now. `GET
/api/comments/unread` answers `designs` (each design with unread comments: `id`, `name`, `unread`,
`mentions` (how many of them mention the person), `lastAt`), newest first, and `comments` (the 50
newest unread: `id`, `threadId`, `design`, `author`, `body`, `createdAt`, `mentionsYou`). Live:
every change (start, reply, edit, delete, resolve, reopen) sends `{ "type": "commentsChanged" }` to
everyone with the design open; "mark read" sends nothing. Activity: `comment_added` for a new thread
(detail `threadId`) and a reply (`threadId`, `commentId`), "Commented"; `comment_resolved`
(`threadId`), "Resolved a comment". Edits, deletes and reopening have no row. Left open: the editor
side is CMT-02's; the bell outside an open design gets no live notice (it polls `GET
/api/comments/unread` or reloads on focus); `list_open_comments` for MCP is M10's.

**HIST-01** (b5f1a56).

Code: Table `versions` (id, design_id, kind, name, state, doc_version, created_by, created_at; index
`versions_design` on design_id and created_at): the `// HIST-01` block at the end of
`apps/server/src/db/schema.ts`, `apps/server/migrations/0004_versions.sql` (drizzle-kit `--name
versions`, made as 0003 and renumbered on merge); Contract: `packages/api/src/routes/versions.ts`
(`versionKind`, `versionName`, `designVersion`, `versionRoutes`), exported from
`packages/api/src/index.ts`; Routes: `apps/server/src/routes/versions.ts`, registered from
`src/main.ts`; Automatic versions, stored versions, thinning and its job:
`apps/server/src/designs/versions.ts` (`versionOnSave`, `versionOnLeave`, `addStoredVersion`,
`addVersionOf`, `thinVersions`, `versionsJob`); `saveDoc` in `src/live/docs.ts` calls
`versionOnSave` in its transaction; `versionsJob` starts beside `trashJob` in `src/main.ts`; Live
side: `src/live/server.ts` (`LiveMessage` `{ type: 'versionRestored' }`, the version when the last
editor leaves in `onDisconnect`, `flushLiveDesign`, `restoreLiveDesign`); the Yjs restore update:
`src/live/revert.ts` (`restoreUpdate`); Activity: `version_named`, `version_restored`,
`version_deleted` in `src/audit.ts` and `apps/web/src/settings/activityText.ts`. Kinds: `auto` (made
by the server), `named` ("Name this version"), `before_restore` (the document just before a restore)
and `restore` (the document a restore made, named after the restored version when it had a name).
Each holds the whole Yjs state (as `design_docs.state`) and the design's `doc_version` of that
state. Automatic versions: at the first save (2 to 10 seconds after a change) 10 minutes or more
after the design's last version of any kind (before the first one, after the design's creation), of
the saved state, in the save's transaction; and when no connection that may write is left on the
design (the last Editor or owner closed it, Viewers and Commenters may stay): the pending save runs
at once, then a version of the stored state is made when its `doc_version` is past the last
version's. Not while the server shuts down. An automatic version names the person of the last
change. Thinning: the hourly job `versions` keeps, among automatic versions older than a day, the
newest of each UTC hour, older than a week the newest of each UTC day; every version except named
ones is deleted after 90 days; "Before restore" and restore versions are not thinned. Each run logs
`job done` with `deleted`. Routes (all under `/api/designs/:id/versions`, a design in Trash answers
404 "This design is in Trash."): `GET` list, newest first, `{ versions: [{ id, kind, name,
createdAt, createdBy: { id, name } | null, docVersion }] }` (Viewer and up); `GET /:versionId` `{
version, design }` with `design` the version's plain Design from `readDesign` (Viewer and up);
`POST` `{ name }` "Name this version" of now, the open document's pending changes saved first
(Editor and up); `PATCH /:versionId` `{ name }` renames a named version, others answer 409 "Only a
named version can be renamed." (Editor and up); `DELETE /:versionId` deletes a named version, others
answer 409 "Only a named version can be deleted." (design owner); `POST /:versionId/restore` answers
`{ before }`, the "Before restore" version (Editor and up). Names: 1 to 100 characters, unique among
the design's named versions ignoring case (409 "Another version has this name."), as the Claude link
finds a version by name. Unknown version: 404 "This version was not found.". Restore: always one Yjs
change on the design's own document, never a replaced document. When the design is loaded in the
live server (or loading), its pending save runs first, then, synchronously: the update is computed,
a "Before restore" version of the open document is stored, the update is applied with the person as
origin (Hocuspocus sends it to every connection), the save runs at once, and a `restore` version of
the result is stored. When it is not loaded, the same runs synchronously on the stored document with
`saveDoc`. Open editors then get `{ "type": "versionRestored" }`. The restored document keeps the
design's current name (`meta.name`, renaming is the owner's) and is brought to the current layout
with `migrate` when the version is older. A result over 20 MB answers 413 "This version is too big
to restore." and changes nothing. The update: the version is an earlier state of the same document,
so the changes made since are undone with a Yjs `UndoManager` over a copy of the version (without
garbage collection) with those changes applied; unchanged content keeps its Yjs items, so open text
editors stay bound. The result is compared with the version (every top-level map as JSON with sorted
keys) on a copy of the document; if they differ, the server logs "a restore did not undo to its
version; the version is copied instead" and the update instead clears every top-level map and copies
the version's content into it. Activity: "Named a version" (also for a rename, detail `versionId`,
`name`, `from`), "Restored a version" (detail `versionId`, `kind`, `name`, `createdAt`), "Deleted a
version" (detail `versionId`, `name`). Deleting a design forever deletes its versions (foreign key
cascade); a removed person's versions keep `created_by` null. Left open: `?version=<name or id>` of
the Claude link is CL-01's; names are unique per design for it.

**VIEW-01** (266c663, 1b6c83b, 4b494e0).

Code: Table: `view_links` at the end of `apps/server/src/db/schema.ts` (block `// VIEW-01`),
migration `apps/server/migrations/0005_view_links.sql` (drizzle-kit, named `view_links`, made as
0003 and renumbered on merge); Contract: `packages/api/src/routes/viewLinks.ts` (`viewLinks`,
`createViewLink`, `revokeViewLink`, the public `viewLinkDesign`), exported from
`packages/api/src/index.ts`; `mediaFile` takes an optional `view` query; Server: the links' rules in
`apps/server/src/designs/viewLinks.ts` (`openViewLink`, `viewLinkWorks`, the sentence), the routes
in `apps/server/src/routes/viewLinks.ts` (registered in `main.ts`), the route helper's `viewLink`
option in `apps/server/src/route.ts` (used by the media file route), the token left out of request
logs in `app.ts`; Live: `apps/server/src/live/access.ts` (upgrade, `admit` and `recheck` for a view
token; `LiveContext` is a person or a view link), `apps/server/src/live/view.ts` (the token of a
socket, presence emptied on a view link's socket), `apps/server/src/live/server.ts` (the new
arguments, `beforeHandleAwareness`, `recheckDesign`); Activity: `view_link_created` and
`view_link_revoked` in `audit.ts`, "Made a view-only link" and "Revoked a view-only link" in
`activityText.ts`. The routes are `GET`/`POST /api/designs/:id/view-links` and `DELETE
/api/designs/:id/view-links/:linkId` (design owner and site owner; a design in Trash answers "This
design is in Trash."), and the public `GET /api/view/:token`, which answers the design's id, name,
document version and the design owner's name only, or 404 with "This link no longer works. Ask the
person who sent it for a new one." for a revoked or expired link or a design in Trash. A link works
again when its design comes back from Trash; deleting the design forever deletes its links (the
foreign key cascades). Every use (the page's header, the live connection, each media file) moves
`last_used_at`, at most once a minute. The page opens `/live?view=<token>`: the upgrade checks the
Origin and the link instead of a session, each document must be the link's design, and the
connection is read-only. Its socket gets every awareness message emptied (an update with no clients,
which still keeps the provider's connection alive) and its own awareness reaches the others as an
empty state, so the viewer sees nobody and nobody sees the viewer. Revoking a link closes its open
pages at once (code 4403 with the link's sentence); an expired link closes them at the next
30-second check, and moving the design to Trash closes them at once (4b494e0: `deleteDesign` in
`apps/server/src/routes/designs.ts` calls `recheckDesign(designId)` from `live/server.ts`). Media
files take the token as `?view=<token>` and only for the link's design. Request logs write
`/v/:token` and `view=:token` instead of the token. The Share dialog's list and the page are in 04
As built (M9).

## As built (M11)

**TPL-01** (69e7182).

- The server's own templates are design rows with `is_template` set and `template_meta` `{
  "description": ... }`: a copy of the design (with its media rows, as "Duplicate" copies) made by
  "Save as template", owned by the person who saved it, named as they chose. They are not on the
  Designs page or the MCP list, no one has a role on them, design routes answer 404 "This design was
  not found." for them; they are never opened, only copied. Removing a member moves their templates
  with their designs (the member list's design count includes them).
- Activity: `template_saved` (on the design saved; detail `templateId`, `name`) "Saved the design as
  the template <name>"; `template_used` (on the new design; `templateId`, `name`, `builtIn`) "Made
  the design from the starter template <name>" or "... from the template <name>"; `template_deleted`
  (no design; `templateId`, `name`) "Removed the template <name>".
