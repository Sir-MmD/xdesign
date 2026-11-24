// The stage 1 tables of docs/plan/02-architecture.md section 5. Times are UTC milliseconds, IDs
// random 21-character nanoid strings (made by the app), secret tokens stored as SHA-256 hashes.
// `make gen` writes the migrations into ../../migrations from this file (drizzle.config.ts).
import { sql } from 'drizzle-orm'
import { blob, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import type { Via } from '../auth/calls.ts'

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    // USER-01a: what the person signs in with (D-730), stored in lower case; the unique index also
    // compares in lower case. Null only from the update's migration to the fill that follows it in
    // openDatabase (db/usernames.ts), so every account has one.
    username: text('username'),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    isSiteOwner: integer('is_site_owner', { mode: 'boolean' }).notNull().default(false),
    disabledAt: integer('disabled_at'),
    createdAt: integer('created_at').notNull(),
    lastSeenAt: integer('last_seen_at'),
    // The person's color for cursors and avatars, "#rrggbb".
    color: text('color').notNull(),
    // TFA-01 two-factor sign-in: the authenticator secret (base32) while it is on, kept as it is
    // beside the password hash (D-649); null when it is off.
    totpSecret: text('totp_secret'),
    // An unfinished setup: its secret and when it started (15 minutes to enter a code).
    totpPending: text('totp_pending'),
    totpPendingAt: integer('totp_pending_at'),
    // The last time step whose code was used: each code works once.
    totpLastStep: integer('totp_last_step').notNull().default(0),
    // The SHA-256 hashes of the unused recovery codes.
    recoveryCodes: text('recovery_codes', { mode: 'json' }).notNull().$type<string[]>().default([]),
    // THEME-01: the site's Light or Dark from the top bar's switch; null until pressed (the site
    // follows the computer).
    theme: text('theme', { enum: ['light', 'dark'] }),
    // MAP-11: the map's Lines switch: far lines as short tags ('short') or every line ('all').
    mapLines: text('map_lines', { enum: ['short', 'all'] })
      .notNull()
      .default('short'),
  },
  (t) => [uniqueIndex('users_username_unique').on(sql`lower(${t.username})`)],
)

export const sessions = sqliteTable(
  'sessions',
  {
    // The SHA-256 hash of the cookie's token.
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
    lastUsedAt: integer('last_used_at').notNull(),
    userAgent: text('user_agent'),
    ip: text('ip'),
    // "Confirm it's you": the site owner's risky actions are open until this time.
    confirmedUntil: integer('confirmed_until'),
  },
  (t) => [index('sessions_user').on(t.userId)],
)

// TFA-01: a right password of a person with two-factor sign-in on, waiting for the code. It lasts
// 5 minutes, allows 5 wrong codes and only from the same IP address; it goes once used, and with
// the person's sessions (a new password ends it too).
export const signInSteps = sqliteTable(
  'sign_in_steps',
  {
    // The SHA-256 hash of the step's token (the `challenge` the sign-in page sends back).
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
    ip: text('ip').notNull(),
    // The wrong codes sent so far.
    attempts: integer('attempts').notNull().default(0),
  },
  (t) => [index('sign_in_steps_user').on(t.userId)],
)

export const designs = sqliteTable(
  'designs',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    // A member with designs cannot be removed until they are moved (docs/plan/05 section 1).
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    // Who saved the last change ("Edited <time> by <name>" on the card).
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
    // Set while the design is in Trash.
    deletedAt: integer('deleted_at'),
    docVersion: integer('doc_version').notNull().default(0),
    // The card's summary of the document (src/designs/summary.ts): its steps without notes and
    // sections, and its languages with the default one first.
    stepCount: integer('step_count').notNull().default(0),
    languages: text('languages', { mode: 'json' }).notNull().$type<string[]>().default([]),
    // One of the server's templates (TPL-01, src/designs/templates.ts): a copy saved with "Save as
    // template", listed in the gallery only, never opened; its gallery text in template_meta.
    isTemplate: integer('is_template', { mode: 'boolean' }).notNull().default(false),
    templateMeta: text('template_meta', { mode: 'json' }).$type<{ description: string }>(),
  },
  (t) => [index('designs_owner').on(t.ownerId)],
)

export const designMembers = sqliteTable(
  'design_members',
  {
    designId: text('design_id')
      .notNull()
      .references(() => designs.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // editor, commenter or viewer; the design owner is designs.owner_id.
    role: text('role', { enum: ['editor', 'commenter', 'viewer'] }).notNull(),
    addedBy: text('added_by').references(() => users.id, { onDelete: 'set null' }),
    addedAt: integer('added_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.designId, t.userId] }), index('design_members_user').on(t.userId)],
)

export const designDocs = sqliteTable('design_docs', {
  designId: text('design_id')
    .primaryKey()
    .references(() => designs.id, { onDelete: 'cascade' }),
  // The Yjs document as one update.
  state: blob('state', { mode: 'buffer' }).notNull(),
  stateBytes: integer('state_bytes').notNull(),
  savedAt: integer('saved_at').notNull(),
})

export const media = sqliteTable(
  'media',
  {
    id: text('id').primaryKey(),
    designId: text('design_id')
      .notNull()
      .references(() => designs.id, { onDelete: 'cascade' }),
    // The file is media/<first 2>/<sha256> in the data folder, shared by every row with it.
    sha256: text('sha256').notNull(),
    kind: text('kind').notNull(),
    mime: text('mime').notNull(),
    bytes: integer('bytes').notNull(),
    width: integer('width'),
    height: integer('height'),
    durationMs: integer('duration_ms'),
    originalName: text('original_name'),
    uploadedBy: text('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    uploadedAt: integer('uploaded_at').notNull(),
  },
  (t) => [index('media_design').on(t.designId), index('media_sha256').on(t.sha256)],
)

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull().$type<unknown>(),
})

// The activity list (docs/plan/05 section 9). No foreign keys: a row keeps its IDs after the
// person or the design is gone.
export const audit = sqliteTable(
  'audit',
  {
    id: text('id').primaryKey(),
    at: integer('at').notNull(),
    userId: text('user_id'),
    action: text('action').notNull(),
    designId: text('design_id'),
    detail: text('detail', { mode: 'json' }).$type<unknown>(),
  },
  (t) => [
    index('audit_at').on(t.at),
    index('audit_user').on(t.userId, t.at),
    index('audit_design').on(t.designId, t.at),
  ],
)

// CMT-01
// Comments on a design (docs/plan/05 section 6, stage 2). A thread is its first comment, whose
// thread_id is its own id, and the replies with that thread_id; the anchor and the resolved
// fields are kept on the first comment only.
export const comments = sqliteTable(
  'comments',
  {
    id: text('id').primaryKey(),
    designId: text('design_id')
      .notNull()
      .references(() => designs.id, { onDelete: 'cascade' }),
    threadId: text('thread_id').notNull(),
    // What the thread is on (commentAnchor of @xdesign/api); null on replies.
    anchor: text('anchor', { mode: 'json' }).$type<unknown>(),
    // Null once the person is removed from the site; the comment stays.
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    // The IDs of the people mentioned with "@name".
    mentions: text('mentions', { mode: 'json' }).notNull().$type<string[]>().default([]),
    createdAt: integer('created_at').notNull(),
    editedAt: integer('edited_at'),
    resolvedAt: integer('resolved_at'),
    resolvedBy: text('resolved_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [index('comments_design').on(t.designId, t.createdAt), index('comments_thread').on(t.threadId)],
)

// When each person last marked the comments of a design read; later comments by others are
// unread for them.
export const commentReads = sqliteTable(
  'comment_reads',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    designId: text('design_id')
      .notNull()
      .references(() => designs.id, { onDelete: 'cascade' }),
    lastReadAt: integer('last_read_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.designId] })],
)

// HIST-01
// Version history (docs/plan/05 section 7): automatic versions of a design's document (thinned by
// the versions job), named ones, and the two of each restore ("Before restore" and the restored
// content). Deleting the design forever deletes them.
export const versions = sqliteTable(
  'versions',
  {
    id: text('id').primaryKey(),
    designId: text('design_id')
      .notNull()
      .references(() => designs.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['auto', 'named', 'restore', 'before_restore'] }).notNull(),
    // A named version's name; for a restore, the name of the version restored when it had one.
    name: text('name'),
    // The Yjs document as one update, like design_docs.state.
    state: blob('state', { mode: 'buffer' }).notNull(),
    // The design's doc_version of the state.
    docVersion: integer('doc_version').notNull(),
    // Who made it; an automatic version names the person of the last change.
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at').notNull(),
    // MCP-01b: the key a change through Claude made it with (src/auth/calls.ts' Via), as History
    // names it beside the person.
    via: text('via', { mode: 'json' }).$type<Via>(),
  },
  (t) => [index('versions_design').on(t.designId, t.createdAt)],
)

// VIEW-01
// View-only links of a design (docs/plan/05 section 8): the token is shown once in the link and
// kept as its SHA-256. Deleting a design forever deletes its links (the foreign key cascades).
export const viewLinks = sqliteTable(
  'view_links',
  {
    id: text('id').primaryKey(),
    designId: text('design_id')
      .notNull()
      .references(() => designs.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at').notNull(),
    // Null for a link that never expires.
    expiresAt: integer('expires_at'),
    revokedAt: integer('revoked_at'),
    // Moved at most once a minute (src/designs/viewLinks.ts).
    lastUsedAt: integer('last_used_at'),
  },
  (t) => [index('view_links_design').on(t.designId)],
)

// CL-01
// Claude links (docs/plan/06 section 7.1): a design's secret read-only link, made and revoked by
// its design owner or the site owner. Deleting the design forever deletes its links.
export const claudeLinks = sqliteTable(
  'claude_links',
  {
    id: text('id').primaryKey(),
    designId: text('design_id')
      .notNull()
      .references(() => designs.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at').notNull(),
    revokedAt: integer('revoked_at'),
    lastUsedAt: integer('last_used_at'),
  },
  (t) => [index('claude_links_design').on(t.designId)],
)

// Personal API keys (06 section 7.2): each does what its person can do, as them (MCP-01a).
// Removing the person deletes their keys.
export const apiKeys = sqliteTable(
  'api_keys',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    createdAt: integer('created_at').notNull(),
    revokedAt: integer('revoked_at'),
    lastUsedAt: integer('last_used_at'),
    // MCP-01b (17 section 13.4): "Ask first", which only the site owner turns off; and "can't
    // show questions", set when Claude's app answered a question with a No in under 3 seconds.
    askFirst: integer('ask_first', { mode: 'boolean' }).notNull().default(true),
    cannotAsk: integer('cannot_ask', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [index('api_keys_user').on(t.userId)],
)

// MCP-03a
// The Claude app and claude.ai as connected apps (docs/plan/17 section 13.5): xDesign is their
// OAuth 2.1 server (src/claude/oauth.ts). A client is known by its metadata document or by its
// registration; a request waits for the person's "Allow", which makes a one-time code; the code
// makes a grant (the connected app) with its access and refresh tokens. Secrets are kept only as
// SHA-256 hashes; removing the person deletes their requests, codes and apps.
export const oauthClients = sqliteTable('oauth_clients', {
  // The client_id: the https address of its metadata document, or the ID xDesign made for it.
  id: text('id').primaryKey(),
  kind: text('kind', { enum: ['metadata', 'registered'] }).notNull(),
  // Its client_name, cleaned; '' when a registration gave none.
  name: text('name').notNull(),
  redirectUris: text('redirect_uris', { mode: 'json' }).notNull().$type<string[]>(),
  // How it proves itself at the token endpoint; a metadata document's client is always `none`.
  authMethod: text('auth_method', { enum: ['none', 'client_secret_post', 'client_secret_basic'] }).notNull(),
  secretHash: text('secret_hash'),
  createdAt: integer('created_at').notNull(),
  usedAt: integer('used_at').notNull(),
  // A metadata document's copy is fetched again after this time; null for a registration.
  freshUntil: integer('fresh_until'),
})

// A request of the authorize endpoint, waiting 10 minutes for "Allow" or "Deny". The "Allow" page
// that opens it first binds it to its person and session: nobody else answers it.
export const oauthRequests = sqliteTable(
  'oauth_requests',
  {
    id: text('id').primaryKey(),
    // The SHA-256 hash of the handle in the "Allow" page's address.
    handleHash: text('handle_hash').notNull().unique(),
    clientId: text('client_id')
      .notNull()
      .references(() => oauthClients.id, { onDelete: 'cascade' }),
    redirectUri: text('redirect_uri').notNull(),
    // The client's state, sent back as it came; null without one.
    state: text('state'),
    codeChallenge: text('code_challenge').notNull(),
    // The MCP address the tokens will be bound to.
    resource: text('resource').notNull(),
    // The sender's IP address: one address keeps at most 10 requests waiting.
    ip: text('ip').notNull(),
    createdAt: integer('created_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    sessionId: text('session_id'),
  },
  (t) => [index('oauth_requests_ip').on(t.ip)],
)

// A connected app: the grant of one "Allow", acting as its person (as an API key does). It ends 30
// days after its last refresh, at "Disconnect", or when a used refresh token comes back.
export const oauthGrants = sqliteTable(
  'oauth_grants',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: text('client_id')
      .notNull()
      .references(() => oauthClients.id, { onDelete: 'cascade' }),
    // The app's name when it was allowed, as the lists and Activity show it.
    name: text('name').notNull(),
    resource: text('resource').notNull(),
    createdAt: integer('created_at').notNull(),
    lastUsedAt: integer('last_used_at'),
    expiresAt: integer('expires_at').notNull(),
    // As api_keys' (MCP-01b).
    askFirst: integer('ask_first', { mode: 'boolean' }).notNull().default(true),
    cannotAsk: integer('cannot_ask', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [index('oauth_grants_user').on(t.userId)],
)

// A one-time code of an allowed request, exchanged within 10 minutes. It stays until then, so a
// code that comes back after its exchange ends the app it made.
export const oauthCodes = sqliteTable('oauth_codes', {
  hash: text('hash').primaryKey(),
  clientId: text('client_id')
    .notNull()
    .references(() => oauthClients.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  redirectUri: text('redirect_uri').notNull(),
  codeChallenge: text('code_challenge').notNull(),
  resource: text('resource').notNull(),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
  usedAt: integer('used_at'),
  grantId: text('grant_id').references(() => oauthGrants.id, { onDelete: 'set null' }),
})

// A grant's tokens: access tokens of an hour, and refresh tokens of 30 days that work once (each
// refresh rotates both; a used one is kept until its end to notice it coming back).
export const oauthTokens = sqliteTable(
  'oauth_tokens',
  {
    hash: text('hash').primaryKey(),
    grantId: text('grant_id')
      .notNull()
      .references(() => oauthGrants.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['access', 'refresh'] }).notNull(),
    createdAt: integer('created_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
    usedAt: integer('used_at'),
  },
  (t) => [index('oauth_tokens_grant').on(t.grantId)],
)

// The picture cache (06 section 7.4): the pictures of a design's last browser export, one per
// step (or Bot setup view) and language, kept as media rows of the kind `picture`. A new upload
// replaces the design's whole set.
export const pictures = sqliteTable(
  'pictures',
  {
    designId: text('design_id')
      .notNull()
      .references(() => designs.id, { onDelete: 'cascade' }),
    // The step's ID, or `bot-profile`, `empty-chat` or `commands-menu`.
    stepId: text('step_id').notNull(),
    language: text('language').notNull(),
    // The phone look and theme of the export, as the browser names it.
    look: text('look').notNull(),
    // The design's doc_version the pictures were made from.
    docVersion: integer('doc_version').notNull(),
    mediaId: text('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.designId, t.stepId, t.language] })],
)
