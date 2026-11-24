// The site's own routes (siteRoutes of @xdesign/api): health and the site's name.
import { routes } from '@xdesign/api'

import { config } from '../config.ts'
import { addRoute, type Register } from '../route.ts'
import { readSettings } from '../settings.ts'
import { version } from '../version.ts'

export const register: Register = (app) => {
  addRoute(app, routes.health, () => ({ ok: true, version, mode: config.mode }))
  addRoute(app, routes.site, () => ({ name: readSettings().siteName }))
}
