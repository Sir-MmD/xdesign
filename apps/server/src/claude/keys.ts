// Personal API keys in use (docs/plan/06 section 7.2): the MCP connector (CL-02) finds the person
// of a request's `Authorization: Bearer <key>` here and writes each use to the activity list. A
// key reads every design its person can open (getDesignRole), edits those they may edit
// (MCP-02a) and runs every action of the panel they may run, as them (MCP-01a), asking first before
// what cannot be undone unless the site owner turned its "Ask first" off (MCP-01b); a revoked key,
// a disabled person's and a removed person's (their keys are deleted with them) find nobody. A
// connected app's access token (MCP-03a, src/claude/oauth.ts) finds its person the same way.
import type { User } from '@xdesign/api'
import { and, eq, isNull } from 'drizzle-orm'
import type { FastifyRequest } from 'fastify'

import { audit } from '../audit.ts'
import type { Via } from '../auth/calls.ts'
import { hashToken } from '../auth/tokens.ts'
import { toUser } from '../auth/users.ts'
import { getDb } from '../db/index.ts'
import { apiKeys, oauthGrants, users } from '../db/schema.ts'

// The person of a call through Claude, and what it comes through: an API key, or (MCP-03a) a
// connected app.
export interface KeyUser extends User {
  via: Via
  // MCP-01b: the key's (or app's) "Ask first" and "can't show questions" (src/claude/ask.ts).
  askFirst: boolean
  cannotAsk: boolean
}

// What the texts for Claude call each kind: "Ask first is off for this key."
export const viaNouns: Record<Via['kind'], string> = { key: 'key', app: 'app' }

// The key of an `Authorization: Bearer <key>` header, or null without one.
export function bearerOf(req: FastifyRequest): string | null {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(req.headers.authorization ?? '')
  return match?.[1] ?? null
}

// The person of the request's key, or null; a key that works gets its last use set.
export function keyUserOf(req: FastifyRequest): KeyUser | null {
  const key = bearerOf(req)
  if (key === null) {
    return null
  }
  const db = getDb()
  const row = db
    .select({ key: apiKeys, user: users })
    .from(apiKeys)
    .innerJoin(users, eq(users.id, apiKeys.userId))
    .where(and(eq(apiKeys.tokenHash, hashToken(key)), isNull(apiKeys.revokedAt)))
    .get()
  if (!row || row.user.disabledAt !== null) {
    return null
  }
  db.update(apiKeys).set({ lastUsedAt: Date.now() }).where(eq(apiKeys.id, row.key.id)).run()
  return {
    ...toUser(row.user),
    via: { kind: 'key', id: row.key.id, name: row.key.name },
    askFirst: row.key.askFirst,
    cannotAsk: row.key.cannotAsk,
  }
}

// MCP-01b: the key's app (or the connected app) answered a question with a No in under 3 seconds,
// faster than a person reads it: its next questions go through Claude's own answer with a ticket.
export function markCannotAsk(via: Via): void {
  const db = getDb()
  if (via.kind === 'app') {
    db.update(oauthGrants).set({ cannotAsk: true }).where(eq(oauthGrants.id, via.id)).run()
    return
  }
  db.update(apiKeys).set({ cannotAsk: true }).where(eq(apiKeys.id, via.id)).run()
}

// An activity row for a use of the key (or the connected app): what it read or changed (the MCP
// tool's name, for one) and on which design, if any.
export function auditKeyUse(key: KeyUser, designId: string | null, detail: Record<string, unknown> = {}): void {
  const { via } = key
  if (via.kind === 'app') {
    audit('claude_app_used', { userId: key.id, designId, detail: { appId: via.id, name: via.name, ...detail } })
    return
  }
  audit('api_key_used', { userId: key.id, designId, detail: { keyId: via.id, name: via.name, ...detail } })
}
