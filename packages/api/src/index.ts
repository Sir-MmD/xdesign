// The API contract, shared by the server and the web app (docs/plan/02-architecture.md section
// 7): the route declaration helper, the schemas of every request and answer, and `routes`, the
// list of every route by its key. One file per area in routes/; Claude's actions of the routes in
// actions.ts; the routes the desktop app refuses in desktop.ts.
import type { Route } from './route.ts'
import { authRoutes } from './routes/auth.ts'
import { claudeRoutes } from './routes/claude.ts'
import { commentRoutes } from './routes/comments.ts'
import { designRoutes } from './routes/designs.ts'
import { desktopBackupRoutes } from './routes/desktopBackups.ts'
import { httpsRoutes } from './routes/https.ts'
import { maintenanceRoutes } from './routes/maintenance.ts'
import { mediaRoutes } from './routes/media.ts'
import { memberRoutes } from './routes/members.ts'
import { settingsRoutes } from './routes/settings.ts'
import { siteRoutes } from './routes/site.ts'
import { templateRoutes } from './routes/templates.ts'
import { versionRoutes } from './routes/versions.ts'

import { viewLinkRoutes } from './routes/viewLinks.ts'

export * from './actions.ts'
export * from './common.ts'
export * from './desktop.ts'
export * from './route.ts'
export * from './routes/auth.ts'
export * from './routes/claude.ts'
export * from './routes/comments.ts'
export * from './routes/designs.ts'
export * from './routes/desktopBackups.ts'
export * from './routes/https.ts'
export * from './routes/maintenance.ts'
export * from './routes/media.ts'
export * from './routes/members.ts'
export * from './routes/settings.ts'
export * from './routes/site.ts'
export * from './routes/templates.ts'
export * from './routes/versions.ts'

export * from './routes/viewLinks.ts'

// Fails to compile when a route's key is not its name in the list.
function routeList<T extends { [K in keyof T]: Route & { key: K } }>(list: T): T {
  return list
}

export const routes = routeList({
  ...siteRoutes,
  ...authRoutes,
  ...memberRoutes,
  ...designRoutes,
  ...commentRoutes,
  ...mediaRoutes,
  ...settingsRoutes,
  ...httpsRoutes,
  ...maintenanceRoutes,
  ...versionRoutes,
  ...templateRoutes,

  ...viewLinkRoutes,

  ...claudeRoutes,
  ...desktopBackupRoutes,
})
export type Routes = typeof routes
export type RouteKey = keyof Routes
