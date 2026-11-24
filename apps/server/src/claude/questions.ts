// The words of a question that asks first (docs/plan/17 section 13.4, MCP-01b): "<the action in
// words>, <the item's name>?", such as `Delete a design forever, "Coffee test"?`. The action's
// words are its `ask` in @xdesign/api's routeActions; the items are read here by the IDs of the
// call's input, only after the route's role check passed (src/claude/actions.ts), so a question
// never names what the person cannot reach. An item that is not found keeps its ID.
import type { HttpsMethod, RouteKey } from '@xdesign/api'
import { and, eq } from 'drizzle-orm'

import { getDb } from '../db/index.ts'
import { designs, users, versions } from '../db/schema.ts'

// The longest name a question shows.
const maxName = 80

function quoted(name: string): string {
  return `"${name.length > maxName ? `${name.slice(0, maxName - 3)}...` : name}"`
}

function textOf(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function designName(id: unknown): string {
  const row = getDb()
    .select({ name: designs.name })
    .from(designs)
    .where(eq(designs.id, textOf(id)))
    .get()
  return row ? quoted(row.name) : textOf(id)
}

function personName(id: unknown): string {
  const row = getDb()
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, textOf(id)))
    .get()
  return row ? quoted(row.name) : textOf(id)
}

function versionName(designId: unknown, versionId: unknown): string {
  const row = getDb()
    .select({ name: versions.name })
    .from(versions)
    .where(and(eq(versions.designId, textOf(designId)), eq(versions.id, textOf(versionId))))
    .get()
  return row?.name ? quoted(row.name) : textOf(versionId)
}

// Settings > HTTPS's methods, as Activity names them.
const httpsWords: Record<HttpsMethod, string> = {
  letsencrypt_http: "Let's Encrypt (port 80)",
  letsencrypt_cloudflare: "Let's Encrypt through Cloudflare DNS",
  file: 'certificate files on this server',
  uploaded: 'an uploaded certificate',
  builtin: 'the built-in self-signed certificate',
}

function fieldsOf(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

// The items a call of the route names, in words; null for a route that names none.
function itemOf(id: RouteKey, input: Record<string, unknown>): string | null {
  const body = fieldsOf(input.body)
  switch (id) {
    case 'deleteDesignForever':
    case 'deleteComment':
    case 'revokeViewLink':
    case 'revokeClaudeLink':
    case 'deleteTemplate':
      return designName(input.id)
    case 'transferDesign':
      return `${designName(input.id)} to ${personName(body.userId)}`
    case 'deleteVersion':
      return `${versionName(input.id, input.versionId)} of ${designName(input.id)}`
    case 'removeMember':
      return body.moveDesignsTo === undefined
        ? personName(input.userId)
        : `${personName(input.userId)}, their designs to ${personName(body.moveDesignsTo)}`
    // USER-01b: the new member's name and username (kept in lower case), never the password.
    case 'addMember':
      return `${quoted(textOf(body.name).trim())} as ${textOf(body.username).trim().toLowerCase()}`
    case 'setMemberPassword':
      return personName(input.userId)
    case 'deleteBackup':
    case 'restoreBackup':
    case 'deleteDesktopBackup':
    case 'restoreDesktopBackup':
      return quoted(textOf(input.name))
    case 'rollback':
      return body.restoreData === true
        ? `xDesign ${textOf(body.to)} with the data from before the update`
        : `xDesign ${textOf(body.to)}`
    case 'chooseHttps': {
      const method = textOf(body.method)
      return Object.hasOwn(httpsWords, method) ? httpsWords[method as HttpsMethod] : method
    }
    case 'changeDomain':
      return quoted(textOf(body.domain))
    case 'changeAddress':
      return `port ${textOf(body.port)} and the path ${quoted(textOf(body.basePath))}`
    default:
      return null
  }
}

// The question of a call of the route: its words, then the items it names.
export function questionOf(id: RouteKey, ask: string, input: Record<string, unknown>): string {
  const item = itemOf(id, input)
  return item === null || item === '' ? `${ask}?` : `${ask}, ${item}?`
}
