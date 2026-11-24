// The activity rows (docs/plan/05 section 9, 02 section 8 item 8): who did what, when and on
// which design. The site owner's Settings > Activity lists them newest first; rows are kept one
// year.
import type { RouteResponse, Routes } from '@xdesign/api'
import { and, count, desc, eq, lt, type SQL } from 'drizzle-orm'
import { nanoid } from 'nanoid'

import { callVia, countCallRow } from './auth/calls.ts'
import { getDb } from './db/index.ts'
import { audit as auditRows, designs, users } from './db/schema.ts'

// What happened. `userId` is who did it; for a failed sign-in, the person whose username was
// typed (rows from before USER-01a have the email typed).
export type AuditAction =
  | 'sign_in'
  | 'sign_in_failed'
  // TFA-01: two-factor sign-in turned on and off, new recovery codes, one used (detail: how many
  // are left), and turned off for someone: by the site owner (detail: the member) or by
  // `reset-2fa` (the person's own row, detail `by: 'command'`).
  | 'two_factor_on'
  | 'two_factor_off'
  | 'recovery_codes_made'
  | 'recovery_code_used'
  | 'two_factor_reset'
  | 'owner_created'
  // Invite and reset links are gone (USER-01a); their old rows still read.
  | 'invite_created'
  | 'invite_revoked'
  | 'invite_accepted'
  | 'reset_link_created'
  | 'password_reset'
  | 'password_changed'
  // USER-01a: an account made before usernames got one at the update's first start (by nobody;
  // detail: memberId, name, username), and the site owner changed a username (detail: memberId,
  // name, from, to).
  | 'username_given'
  | 'username_changed'
  // USER-01b: the site owner added a member (detail: memberId, name, username) and set a
  // member's password (detail: memberId, name, username).
  | 'member_added'
  | 'password_set'
  | 'member_disabled'
  | 'member_enabled'
  | 'member_removed'
  | 'design_created'
  | 'design_imported'
  | 'design_renamed'
  | 'design_duplicated'
  | 'design_deleted'
  | 'design_restored'
  | 'design_deleted_forever'
  | 'design_transferred'
  | 'design_member_added'
  | 'design_member_changed'
  | 'design_member_removed'
  | 'comment_added'
  | 'comment_resolved'

  // HIST-01
  | 'version_named'
  | 'version_restored'
  | 'version_deleted'
  | 'view_link_created'
  | 'view_link_revoked'

  // CL-01
  | 'claude_link_created'
  | 'claude_link_revoked'
  | 'claude_link_used'
  | 'api_key_created'
  | 'api_key_revoked'
  | 'api_key_used'
  // MCP-01b: the site owner turned a key's "Ask first" on or off (detail: kind, keyId, name, on,
  // and `of`, the person, for someone else's key; api_key_revoked has `of` too). MCP-03a: an app's
  // has kind `app` and appId instead of keyId.
  | 'ask_first_changed'
  // MCP-03a: a connected app (detail: appId, name, and the client's host): connected by its
  // person's "Allow", disconnected (`of` for someone else's; `reason: 'reused'` when a used
  // refresh token came back), and used as api_key_used is.
  | 'claude_app_connected'
  | 'claude_app_disconnected'
  | 'claude_app_used'
  | 'https_changed'
  | 'domain_change_started'
  | 'address_change_started'
  | 'backup_made'
  | 'backup_downloaded'
  | 'backup_deleted'
  | 'restore_started'
  | 'update_started'
  | 'rollback_started'
  // M17: "Uninstall xDesign" (detail: keepData).
  | 'uninstall_started'

  // TPL-01
  | 'template_saved'
  | 'template_used'
  | 'template_deleted'

export interface AuditFields {
  userId?: string | null
  designId?: string | null
  // Plain JSON for the list: the username typed, the member acted on, the designs moved. A row
  // written in Claude's call (src/auth/calls.ts) also gets `via`: the key or app it came through.
  detail?: unknown
}

const dayMs = 24 * 60 * 60 * 1000
const keepMs = 365 * dayMs

// Rows older than a year are deleted at most once a day, by the first row written after that.
let prunedAt = 0

// The row's detail, with the key (or app) of Claude's call it is written in (MCP-01a); a key's or
// app's own use already names it.
function detailOf(action: AuditAction, detail: unknown): unknown {
  const via = action === 'api_key_used' || action === 'claude_app_used' ? undefined : callVia()
  if (via === undefined) {
    return detail ?? null
  }
  return typeof detail === 'object' && detail !== null ? { ...detail, via } : { via }
}

export function audit(action: AuditAction, fields: AuditFields = {}): void {
  const db = getDb()
  const now = Date.now()
  const detail = detailOf(action, fields.detail)
  db.insert(auditRows)
    .values({
      id: nanoid(),
      at: now,
      userId: fields.userId ?? null,
      action,
      designId: fields.designId ?? null,
      detail,
    })
    .run()
  countCallRow()
  if (now - prunedAt > dayMs) {
    prunedAt = now
    db.delete(auditRows)
      .where(lt(auditRows.at, now - keepMs))
      .run()
  }
}

export interface ActivityFilter {
  user?: string | undefined
  design?: string | undefined
  // ACT-01: the page, from 1, and its rows per page (10, 25, 50 or 100).
  page: number
  size: number
}

// One page of the Activity list, newest first, with the names of the people and designs that
// still exist, and the rows of the whole list with the same filters (ACT-01): a page past the end
// has no entries, and the web opens the last page.
export function readActivity(filter: ActivityFilter): RouteResponse<Routes['activity']> {
  const where: SQL[] = []
  if (filter.user !== undefined) {
    where.push(eq(auditRows.userId, filter.user))
  }
  if (filter.design !== undefined) {
    where.push(eq(auditRows.designId, filter.design))
  }
  const db = getDb()
  const total =
    db
      .select({ n: count() })
      .from(auditRows)
      .where(and(...where))
      .get()?.n ?? 0
  const rows = db
    .select({
      id: auditRows.id,
      at: auditRows.at,
      action: auditRows.action,
      detail: auditRows.detail,
      userId: auditRows.userId,
      userName: users.name,
      designId: auditRows.designId,
      designName: designs.name,
    })
    .from(auditRows)
    .leftJoin(users, eq(users.id, auditRows.userId))
    .leftJoin(designs, eq(designs.id, auditRows.designId))
    .where(and(...where))
    .orderBy(desc(auditRows.at), desc(auditRows.id))
    .limit(filter.size)
    .offset((filter.page - 1) * filter.size)
    .all()
  const entries = rows.map((row) => ({
    id: row.id,
    at: row.at,
    user: row.userId === null ? null : { id: row.userId, name: row.userName },
    action: row.action,
    design: row.designId === null ? null : { id: row.designId, name: row.designName },
    detail: row.detail,
  }))
  return { entries, total }
}
