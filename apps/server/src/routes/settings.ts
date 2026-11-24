// The site owner's Settings and the Activity list (settingsRoutes of @xdesign/api); the values
// come from src/settings.ts, the activity rows from src/audit.ts.
import { routes } from '@xdesign/api'
import type { FastifyInstance } from 'fastify'

import { readActivity } from '../audit.ts'
import { addRoute, type Register } from '../route.ts'
import { readSettings, writeSettings } from '../settings.ts'

// The site's name and the upload limit (GET and PATCH /api/settings).
function addSiteSettings(app: FastifyInstance): void {
  addRoute(app, routes.settings, () => readSettings())
  addRoute(app, routes.updateSettings, ({ body }) => writeSettings(body))
}

// Settings > Activity: newest first, by person or design (docs/plan/05 section 9), one page of
// 10, 25, 50 or 100 rows with the total (ACT-01).
function registerActivity(app: FastifyInstance): void {
  addRoute(app, routes.activity, ({ query }) => readActivity(query))
}

export const register: Register = (app) => {
  addSiteSettings(app)
  registerActivity(app)
}
