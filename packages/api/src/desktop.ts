// The desktop app (docs/plan/18 section 9, DESK-01): xDesign on a PC for one person, without
// sign-in. Its server refuses the routes of what the app does not have (9.1) with 404
// not_in_desktop, and Claude's actions leave them out: whole areas of routes/, and the routes of
// the areas it keeps only in part. DESK-02: the app's own backups are the other way round, only in
// the app.
import type { RouteKey } from './index.ts'
import { desktopBackupRoutes } from './routes/desktopBackups.ts'
import { httpsRoutes } from './routes/https.ts'
import { maintenanceRoutes } from './routes/maintenance.ts'
import { memberRoutes } from './routes/members.ts'
import { viewLinkRoutes } from './routes/viewLinks.ts'

// Members (with the Share dialog's member search), the site's address and HTTPS, Maintenance
// (the server's backups, updates and, M17, its uninstall) and view-only links: every route of
// their files, also the ones added later.
const refusedAreas: readonly object[] = [memberRoutes, httpsRoutes, maintenanceRoutes, viewLinkRoutes]

const refusedRoutes: ReadonlySet<string> = new Set<RouteKey>([
  // Signing in and out, the password, sessions, "Confirm it's you" and two-factor sign-in; the
  // account keeps its name, color and theme (me, updateMe).
  'signIn',
  'signInCode',
  'signOut',
  'changePassword',
  'sessions',
  'endSession',
  'signOutOthers',
  'confirm',
  'twoFactorSetup',
  'twoFactorOn',
  'twoFactorOff',
  'newRecoveryCodes',
  // Sharing a design with people; designMembers stays (the comments' mentions read it).
  'setDesignMember',
  'removeDesignMember',
  // The site's name and upload limit, and Activity; reading the settings stays.
  'updateSettings',
  'activity',
  // Claude links and their addresses, the claude.ai and Claude app connector (its "Allow" page and
  // connected apps) and Settings' "Claude connections"; the Account page's API keys and their
  // "Ask first" (updateClaudeConnection) stay.
  'claudeLinks',
  'createClaudeLink',
  'revokeClaudeLink',
  'linkSpec',
  'linkDoc',
  'linkHowToRead',
  'linkPicture',
  'claudeApps',
  'disconnectClaudeApp',
  'appRequest',
  'allowAppRequest',
  'denyAppRequest',
  'claudeConnections',
  'revokeClaudeConnection',
])

// True for a route the desktop app does not have.
export function notInDesktop(key: RouteKey): boolean {
  return refusedRoutes.has(key) || refusedAreas.some((area) => Object.hasOwn(area, key))
}

// DESK-02: true for a route only the desktop app has; a server registers none of them (404
// not_found as for any unknown path) and Claude's actions there leave them out.
export function onlyInDesktop(key: RouteKey): boolean {
  return Object.hasOwn(desktopBackupRoutes, key)
}
