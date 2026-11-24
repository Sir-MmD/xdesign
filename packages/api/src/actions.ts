// Claude's actions (docs/plan/17 sections 13.2 and 13.4, MCP-01a): every route of `routes` as an
// action of the MCP connector, with its area, a one-line summary and its marks, or hidden from
// Claude (D-657). The table is checked against the route list when it compiles: a new route
// without an entry fails `make sanity`, and so does a route that changes something (any method but
// GET) marked as a read. The server's xdesign_find_actions, xdesign_describe_action,
// xdesign_read and xdesign_change (apps/server/src/claude/) list, describe and run them.
import type { Routes } from './index.ts'

// The panel's areas, as xdesign_find_actions groups the actions.
export const actionAreas = [
  'designs',
  'sharing',
  'links',
  'comments',
  'versions',
  'templates',
  'account',
  'members',
  'settings',
  'https',
  'maintenance',
] as const
export type ActionArea = (typeof actionAreas)[number]

// What an action does: it reads, or it changes something; one that cannot be undone also asks
// the person first (D-658).
export type ActionMark = 'read' | 'change' | 'asksFirst'

export interface ReadAction {
  area: ActionArea
  summary: string
  marks: readonly ['read']
}

export interface ChangeAction {
  area: ActionArea
  summary: string
  marks: readonly ['change'] | readonly ['change', 'asksFirst']
  // MCP-01b: the action in words, as its question starts ("Delete a design forever").
  ask?: string
}

// Why Claude never runs a route (D-657): the person's own sign-in security, API keys and connected
// apps (Claude cannot give itself new access), a public page's step (view-only and Claude links),
// a raw file the tools replace, (DESK-02) a window it would open on the person's computer, or
// (M17, Q-85) uninstalling xDesign, which only the site owner does, in Maintenance.
export type HiddenReason = 'signIn' | 'access' | 'public' | 'file' | 'window' | 'uninstall'

export interface HiddenAction {
  hidden: HiddenReason
}

export type RouteAction = ReadAction | ChangeAction | HiddenAction

function reads(area: ActionArea, summary: string): ReadAction {
  return { area, summary, marks: ['read'] }
}

// `ask`: the words of a change whose route needs "Confirm it's you", so it asks first through
// Claude all the same (17 section 13.4); without them it asks with its summary's.
function changes(area: ActionArea, summary: string, ask?: string): ChangeAction {
  return ask === undefined ? { area, summary, marks: ['change'] } : { area, summary, marks: ['change'], ask }
}

// 17 section 13.4's list: what cannot be undone, with the words its question starts with.
function asksFirst(area: ActionArea, summary: string, ask: string): ChangeAction {
  return { area, summary, marks: ['change', 'asksFirst'], ask }
}

function hidden(reason: HiddenReason): HiddenAction {
  return { hidden: reason }
}

type ActionOf<K extends keyof Routes> = HiddenAction | (Routes[K]['method'] extends 'GET' ? ReadAction : ChangeAction)

export const routeActions = {
  health: hidden('public'),
  site: reads('settings', "The site's name."),

  signIn: hidden('signIn'),
  signInCode: hidden('signIn'),
  signOut: hidden('signIn'),
  me: reads('account', 'Your own account: name, username, color and whether you are the site owner.'),
  updateMe: changes('account', 'Changes your name or your color (the site owner also their username).'),
  changePassword: hidden('signIn'),
  sessions: hidden('signIn'),
  endSession: hidden('signIn'),
  signOutOthers: hidden('signIn'),
  confirm: hidden('signIn'),
  twoFactorSetup: hidden('signIn'),
  twoFactorOn: hidden('signIn'),
  twoFactorOff: hidden('signIn'),
  newRecoveryCodes: hidden('signIn'),

  members: reads('members', 'Every member of the site, with whether they are disabled.'),
  // USER-01b: members are added with a username, a name and a password (no invite links).
  addMember: changes(
    'members',
    'Adds a member with a username, a name and a password: they sign in with them at once, and the account never expires.',
    'Add a person to the site',
  ),
  searchMembers: reads('sharing', 'Finds members by name or username, to share a design with.'),
  updateMember: changes('members', 'Disables a member (their sessions end at once) or enables them again.'),
  removeMember: asksFirst(
    'members',
    'Removes a member from the site, once they own no designs or moving them to another member.',
    'Remove a person from the site',
  ),
  resetTwoFactor: hidden('signIn'),
  setMemberPassword: asksFirst(
    'members',
    "Sets a member's password: they are signed out everywhere and sign in with it from now on; not your own.",
    'Set the password of a person',
  ),
  changeUsername: changes(
    'members',
    "Changes a member's username: they sign in with it from now on, their password stays and nobody is signed out.",
  ),

  designs: reads('designs', 'The designs you can open (all, mine, shared with me or Trash), found by name.'),
  createDesign: changes('designs', 'Makes a new empty design with its languages; you own it.'),
  design: reads('designs', "A design's name, owner, languages and your role on it."),
  renameDesign: changes('designs', 'Renames a design.'),
  duplicateDesign: changes('designs', 'Makes a copy of a design that you own, without its sharing.'),
  deleteDesign: changes('designs', 'Moves a design to Trash, where it is kept 30 days.'),
  restoreDesign: changes('designs', 'Brings a design back from Trash.'),
  deleteDesignForever: asksFirst(
    'designs',
    'Deletes a design in Trash forever, with its versions, comments and files.',
    'Delete a design forever',
  ),
  transferDesign: asksFirst(
    'designs',
    'Hands a design over to another member as its owner.',
    'Hand a design to another owner',
  ),
  designMembers: reads('sharing', 'The people a design is shared with, and their roles.'),
  setDesignMember: changes('sharing', 'Shares a design with a member, or changes their role on it.'),
  removeDesignMember: changes('sharing', 'Stops sharing a design with a member.'),
  importDesign: hidden('file'),

  comments: reads('comments', 'Every comment thread of a design, newest first, and when you last read them.'),
  startThread: changes('comments', 'Starts a comment thread on a step, a button, a text or a spot on the map.'),
  replyToThread: changes('comments', 'Replies to a comment thread.'),
  editComment: changes('comments', 'Edits one of your own comments.'),
  deleteComment: asksFirst(
    'comments',
    'Deletes a comment; deleting the first comment of a thread deletes the thread.',
    'Delete a comment',
  ),
  resolveThread: changes('comments', 'Resolves a comment thread.'),
  reopenThread: changes('comments', 'Reopens a resolved comment thread.'),
  markCommentsRead: changes('comments', 'Marks every comment of a design as read for you.'),
  unreadComments: reads('comments', 'The designs with comments you have not read, and the 50 newest unread comments.'),

  uploadMedia: hidden('file'),
  mediaFile: hidden('file'),

  settings: reads('settings', "The site's settings: its name and the upload limit per file."),
  updateSettings: changes('settings', "Changes the site's name or the upload limit per file."),
  activity: reads(
    'settings',
    'Activity: who did what and when, newest first, for a person or a design; one page at a time (page from 1, size 10, 25, 50 or 100 rows, 25 by default) with the total.',
  ),

  https: reads('https', "The site's address and HTTPS: the method, its state, the certificate and the last log."),
  chooseHttps: asksFirst(
    'https',
    "Changes how the site gets its HTTPS certificate: Let's Encrypt over port 80 or through Cloudflare (a wildcard with the names *.<domain> and <domain>), certificate files on this server, or the built-in one, which removes the certificate.",
    'Change HTTPS',
  ),
  pasteCertificate: asksFirst(
    'https',
    'Serves an uploaded certificate: the full chain and its private key as PEM text.',
    'Change HTTPS to an uploaded certificate',
  ),
  issueHttps: changes(
    'https',
    "Issues or renews the Let's Encrypt certificate now; the file method reads its files again.",
  ),
  changeDomain: asksFirst(
    'https',
    "Moves the site to another domain; the server's helper restarts xDesign there.",
    'Change the domain',
  ),
  changeAddress: asksFirst(
    'https',
    "Moves the site to another port and path; the server's helper restarts xDesign there.",
    'Change the site address',
  ),

  serverStatus: reads('maintenance', "The server's status: the versions, uptime, storage and HTTPS."),
  maintenance: reads('maintenance', 'Maintenance: the request waiting, its progress and how the last one ended.'),
  backups: reads('maintenance', 'The backups on the server and the space they use.'),
  makeBackup: changes('maintenance', 'Makes a backup now.'),
  backupFile: hidden('file'),
  deleteBackup: asksFirst('maintenance', 'Deletes a backup.', 'Delete a backup'),
  restoreBackup: asksFirst(
    'maintenance',
    "Restores the site's data from a backup; xDesign restarts.",
    'Restore a backup',
  ),
  uploadUpdate: hidden('file'),
  updateCheck: reads('maintenance', 'The check of an uploaded update file.'),
  discardUpdate: changes('maintenance', 'Discards an uploaded update file.'),
  installUpdate: asksFirst('maintenance', 'Installs a checked update file; xDesign restarts.', 'Install an update'),
  releases: reads('maintenance', 'The kept releases older than the running one, to go back to.'),
  rollback: asksFirst(
    'maintenance',
    'Goes back to an earlier release, with or without the data from before the update.',
    'Go back to an earlier release',
  ),
  uninstall: hidden('uninstall'),

  versions: reads('versions', "A design's versions (History), newest first."),
  version: reads('versions', 'One version of a design, with its whole content.'),
  nameVersion: changes('versions', 'Names a version of the design as it is now.'),
  renameVersion: changes('versions', 'Renames a named version.'),
  deleteVersion: asksFirst('versions', 'Deletes a named version.', 'Delete a version'),
  restoreVersion: changes(
    'versions',
    'Restores a version for everyone; a "Before restore" version keeps the design as it was.',
  ),

  templates: reads('templates', 'The templates: the built-in ones, then those saved on this site.'),
  useTemplate: changes('templates', 'Makes a new design from a template; you own it.'),
  saveAsTemplate: changes('templates', 'Saves a copy of a design as a template every member sees.'),
  deleteTemplate: asksFirst('templates', 'Removes a template saved on this site.', 'Delete a template'),

  viewLinks: reads('links', "A design's view-only links that work."),
  createViewLink: changes('links', 'Makes a view-only link of a design, shown once.'),
  revokeViewLink: asksFirst('links', 'Revokes a view-only link: it stops working.', 'Revoke a view-only link'),
  viewLinkDesign: hidden('public'),

  claudeLinks: reads('links', "A design's Claude links that work."),
  createClaudeLink: changes(
    'links',
    'Makes a Claude link of a design: read-only addresses of its spec.json, design.md and pictures, shown once.',
  ),
  revokeClaudeLink: asksFirst('links', 'Revokes a Claude link: its addresses stop working.', 'Revoke a Claude link'),
  apiKeys: hidden('access'),
  createApiKey: hidden('access'),
  revokeApiKey: hidden('access'),
  claudeApps: hidden('access'),
  disconnectClaudeApp: hidden('access'),
  appRequest: hidden('access'),
  allowAppRequest: hidden('access'),
  denyAppRequest: hidden('access'),
  claudeConnections: hidden('access'),
  updateClaudeConnection: hidden('access'),
  revokeClaudeConnection: hidden('access'),
  uploadPictures: hidden('file'),
  linkSpec: hidden('public'),
  linkDoc: hidden('public'),
  linkHowToRead: hidden('public'),
  linkPicture: hidden('public'),

  // DESK-02: the desktop app's backups (only in the app). Saving a copy and restoring from a file
  // send a file; opening the backups folder opens a window on the computer.
  desktopBackups: reads(
    'maintenance',
    "The desktop app's backups, newest first: their time, size, kind (automatic, manual or beforeRestore) and version.",
  ),
  makeDesktopBackup: changes('maintenance', "Makes a backup of the desktop app's designs now."),
  desktopBackupFile: hidden('file'),
  deleteDesktopBackup: asksFirst('maintenance', 'Deletes a backup of the desktop app.', 'Delete a backup'),
  restoreDesktopBackup: asksFirst(
    'maintenance',
    "Restores the desktop app's designs from a backup, after a backup of them as they are; xDesign restarts.",
    'Restore a backup',
  ),
  restoreDesktopBackupFile: hidden('file'),
  openDesktopBackupsFolder: hidden('window'),
} satisfies { [K in keyof Routes]: ActionOf<K> }
