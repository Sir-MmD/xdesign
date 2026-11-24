// The site's own routes: health (docs/plan/07 section 8) and the site's name.
import { z } from 'zod'

import { serverMode } from '../common.ts'
import { defineRoute } from '../route.ts'

export const siteRoutes = {
  // Asked by the helper's front and `xdesign status`, and (DESK-01) by the desktop app until its
  // server is ready.
  health: defineRoute({
    key: 'health',
    method: 'GET',
    path: '/api/health',
    response: z.object({ ok: z.literal(true), version: z.string(), mode: serverMode }),
    auth: 'public',
  }),
  // The name in the top bar and on the sign-in page.
  site: defineRoute({
    key: 'site',
    method: 'GET',
    path: '/api/site',
    response: z.object({ name: z.string() }),
    auth: 'public',
  }),
}
