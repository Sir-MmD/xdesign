// The rows of Settings > Activity in words (docs/plan/05 section 9): what each action of the
// server's audit list (apps/server/src/audit.ts) did, with the names its detail keeps (a member
// acted on, the old and new name of a design, a role). An action this list does not know (from a
// newer server) shows as its code.
import { type activityEntry, designRoles } from '@xdesign/api'
import type { z } from 'zod'

import { roleNames } from '@/designs/roles'

export type ActivityEntry = z.output<typeof activityEntry>

function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined
}

function text(value: unknown, key: string): string | undefined {
  const found = field(value, key)
  return typeof found === 'string' ? found : undefined
}

function role(value: unknown, key: string): string {
  const found = field(value, key)
  const known = designRoles.find((name) => name === found)
  return known ? roleNames[known] : String(found)
}

// Settings > HTTPS's methods in a sentence.
const httpsMethodTexts: Readonly<Record<string, string>> = {
  letsencrypt_http: "Let's Encrypt (port 80)",
  letsencrypt_cloudflare: "Let's Encrypt through Cloudflare DNS",
  file: 'certificate files on this server',
  uploaded: 'a pasted certificate',
  builtin: 'the built-in self-signed certificate',
}

function httpsMethodText(method: string | undefined): string {
  return (method === undefined ? undefined : httpsMethodTexts[method]) ?? 'another method'
}

// MCP-01b: whose key the site owner revoked or switched, when it is someone else's.
function ofText(detail: unknown): string {
  const of = text(detail, 'of')
  return of === undefined ? '' : ` of ${of}`
}

/** What happened: "Signed in", "Renamed the design from Menu to Coffee shop". */
export function activityText(entry: ActivityEntry): string {
  const detail = entry.detail
  const name = text(detail, 'name') ?? 'a member'
  const backup = text(detail, 'name') ?? ''
  switch (entry.action) {
    case 'sign_in':
      return field(detail, 'recoveryCode') === true ? 'Signed in with a recovery code' : 'Signed in'
    case 'sign_in_failed': {
      // USER-01a: the username typed; rows from before it keep the email typed.
      const typed = text(detail, 'username') ?? text(detail, 'email')
      const tried = typed === undefined ? 'Failed sign-in' : `Failed sign-in as ${typed}`
      if (field(detail, 'twoFactor') === true) return `${tried} (wrong code)`
      return field(detail, 'disabled') === true ? `${tried} (disabled)` : tried
    }
    case 'owner_created':
      return 'Became the site owner'
    // Invite and reset links are gone (USER-01a); their old rows keep their words.
    case 'invite_created':
    case 'invite_revoked': {
      const who = text(detail, 'note') ?? text(detail, 'email')
      const done = entry.action === 'invite_created' ? 'Made an invite' : 'Revoked an invite'
      return who === undefined ? done : `${done} for ${who}`
    }
    case 'invite_accepted':
      return 'Joined with an invite'
    case 'reset_link_created':
      return `Made a password reset link for ${name}`
    case 'password_reset':
      return text(detail, 'by') === 'command'
        ? 'Got a new password from the server'
        : 'Set a new password with a reset link'
    case 'password_changed':
      return 'Changed their password'
    // USER-01a: an account made before usernames got one at the update's first start.
    case 'username_given':
      return `Gave ${name} the username ${text(detail, 'username') ?? ''}`
    case 'username_changed':
      return `Changed the username of ${name} from ${text(detail, 'from') ?? ''} to ${text(detail, 'to') ?? ''}`
    // USER-01b: the site owner's Add member and Set password.
    case 'member_added':
      return `Added ${name} as ${text(detail, 'username') ?? ''}`
    case 'password_set':
      return `Set the password of ${name}`
    case 'two_factor_on':
      return 'Turned on two-factor authentication'
    case 'two_factor_off':
      return 'Turned off two-factor authentication'
    case 'recovery_codes_made':
      return 'Made new recovery codes'
    case 'recovery_code_used': {
      const left = field(detail, 'left')
      return typeof left === 'number' ? `Used a recovery code (${String(left)} left)` : 'Used a recovery code'
    }
    case 'two_factor_reset':
      // The server command's reset is the person's own row; the site owner's names the member.
      return text(detail, 'by') === 'command'
        ? `Two-factor authentication was turned off on the server for ${entry.user?.name ?? 'a removed member'}`
        : `Turned off two-factor authentication for ${name}`
    case 'member_disabled':
      return `Disabled ${name}`
    case 'member_enabled':
      return `Enabled ${name}`
    case 'member_removed': {
      const movedTo = text(field(detail, 'movedTo'), 'name')
      return movedTo === undefined ? `Removed ${name}` : `Removed ${name} and moved their designs to ${movedTo}`
    }
    case 'design_created':
      return 'Created the design'
    case 'design_imported':
      return 'Imported the design'
    case 'design_renamed':
      return `Renamed the design from ${text(detail, 'from') ?? ''} to ${text(detail, 'to') ?? ''}`
    case 'design_duplicated':
      return `Duplicated ${text(detail, 'fromName') ?? 'a design'}`
    case 'design_deleted':
      return 'Moved the design to Trash'
    case 'design_restored':
      return 'Restored the design from Trash'
    case 'design_deleted_forever': {
      const design = text(detail, 'name') ?? 'a design'
      return text(detail, 'by') === 'trash'
        ? `Deleted ${design} forever after 30 days in Trash`
        : `Deleted ${design} forever`
    }
    case 'design_transferred': {
      const to = text(field(detail, 'to'), 'name') ?? 'a member'
      const from = text(field(detail, 'from'), 'name')
      return from === undefined ? `Made ${to} the design owner` : `Made ${to} the design owner instead of ${from}`
    }
    case 'design_member_added':
      return `Shared the design with ${name} as ${role(detail, 'role')}`
    case 'design_member_changed':
      return `Changed the role of ${name} from ${role(detail, 'before')} to ${role(detail, 'role')}`
    case 'design_member_removed':
      return `Removed ${name} from the design`
    case 'comment_added':
      return 'Commented'
    case 'comment_resolved':
      return 'Resolved a comment'

    case 'version_named':
      return 'Named a version'
    case 'version_restored':
      return 'Restored a version'
    case 'version_deleted':
      return 'Deleted a version'

    case 'view_link_created':
      return 'Made a view-only link'
    case 'view_link_revoked':
      return 'Revoked a view-only link'

    case 'claude_link_created':
      return 'Made a Claude link'
    case 'claude_link_revoked':
      return 'Revoked a Claude link'
    case 'claude_link_used': {
      const file = text(detail, 'file') ?? 'the design'
      const version = text(detail, 'version')
      return version === undefined ? `Read ${file}` : `Read ${file} of the version ${version}`
    }
    case 'api_key_created':
      return `Made the API key ${name}`
    case 'api_key_revoked':
      return `Revoked the API key ${name}${ofText(detail)}`
    case 'ask_first_changed': {
      const what = text(detail, 'kind') === 'app' ? 'the app' : 'the API key'
      return field(detail, 'on') === true
        ? `Turned Ask first on for ${what} ${name}${ofText(detail)}`
        : `Turned Ask first off for ${what} ${name}${ofText(detail)}`
    }
    case 'api_key_used':
    case 'claude_app_used': {
      const used = entry.action === 'api_key_used' ? `Used the API key ${name}` : `Used the connected app ${name}`
      const tool = text(detail, 'tool')
      const action = text(detail, 'action')
      if (tool === undefined) return used
      return action === undefined ? `${used} for ${tool}` : `${used} for ${tool}: ${action}`
    }
    // MCP-03a: the Claude app or claude.ai connected through the "Allow" page.
    case 'claude_app_connected':
      return `Connected the app ${name}`
    case 'claude_app_disconnected':
      return text(detail, 'reason') === 'reused'
        ? `The app ${name} was disconnected: one of its used sign-in tokens came back`
        : `Disconnected the app ${name}${ofText(detail)}`
    case 'https_changed':
      return `Changed HTTPS to ${httpsMethodText(text(detail, 'method'))}`
    case 'domain_change_started':
      return `Asked to change the domain to ${text(detail, 'domain') ?? 'another one'}`
    case 'address_change_started': {
      const port = field(detail, 'port')
      return `Asked to move the site to port ${typeof port === 'number' ? String(port) : ''} and the path ${text(detail, 'basePath') ?? ''}`
    }
    case 'backup_made':
      return `Made the backup ${backup}`
    case 'backup_downloaded':
      return `Downloaded the backup ${backup}`
    case 'backup_deleted':
      return `Deleted the backup ${backup}`
    case 'restore_started':
      return `Asked to restore the backup ${backup}`
    case 'update_started':
      return `Asked to update xDesign from ${text(detail, 'from') ?? 'an earlier version'} to ${text(detail, 'to') ?? 'a new one'}`
    case 'rollback_started':
      return field(detail, 'restoreData') === true
        ? `Asked to go back to xDesign ${text(detail, 'to') ?? ''} with the data from before the update`
        : `Asked to go back to xDesign ${text(detail, 'to') ?? ''}`
    case 'uninstall_started':
      return field(detail, 'keepData') === true
        ? 'Started the uninstall: keep the data'
        : 'Started the uninstall: remove everything'

    case 'template_saved':
      return `Saved the design as the template ${text(detail, 'name') ?? ''}`
    case 'template_used':
      return field(detail, 'builtIn') === true
        ? `Made the design from the starter template ${text(detail, 'name') ?? ''}`
        : `Made the design from the template ${text(detail, 'name') ?? ''}`
    case 'template_deleted':
      return `Removed the template ${text(detail, 'name') ?? ''}`
    default:
      return entry.action
  }
}

/**
 * The API key a change through Claude was made with (MCP-01a), as Activity and (MCP-01b) History
 * name it beside the person: "via Claude Code key "Laptop""; (MCP-03a) a connected app by its
 * name: "via Claude (connected app)".
 */
export function viaWords(via: unknown): string | undefined {
  const name = text(via, 'name')
  if (name === undefined) return undefined
  const kind = text(via, 'kind')
  if (kind === 'app') return `via ${name} (connected app)`
  return kind === 'key' ? `via Claude Code key "${name}"` : undefined
}

// `via` of a row's detail.
function viaText(detail: unknown): string | undefined {
  return viaWords(field(detail, 'via'))
}

/**
 * Who did it: their name, "A removed member" once they are gone, "Someone" for a failed sign-in
 * with a username nobody has, "A Claude link" for a link's use, "The site" for its own jobs
 * (Trash's daily deletes, the usernames given at the update). A change made through Claude names
 * the key beside the person ("Sara via Claude Code key "Laptop"").
 */
export function activityWho(entry: ActivityEntry): string {
  if (entry.user === null && entry.action === 'claude_link_used') return 'A Claude link'
  if (entry.user === null) return entry.action === 'sign_in_failed' ? 'Someone' : 'The site'
  const who = entry.user.name ?? 'A removed member'
  const via = viaText(entry.detail)
  return via === undefined ? who : `${who} ${via}`
}
