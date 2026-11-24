// The site owner's Settings (docs/plan/04 section 1, 05 section 9): site name, upload limit and
// the Activity list.
import { z } from 'zod'

import { defaultRowsPerPage, id, pageNumber, rowsPerPage, time } from '../common.ts'
import { defineRoute } from '../route.ts'

export const siteSettings = z.object({
  siteName: z.string().trim().min(1, 'Enter a name.').max(100, 'Use at most 100 characters.'),
  // Per file, 20 MB by default (D-25).
  uploadLimitMb: z.number().int('Use a whole number.').min(1, 'Use at least 1 MB.').max(2000, 'Use at most 2000 MB.'),
})
export type SiteSettings = z.output<typeof siteSettings>

// A person or design an activity row names; the name is null once they are gone.
const named = z.object({ id: z.string(), name: z.string().nullable() })

export const activityEntry = z.object({
  id,
  at: time,
  user: named.nullable(),
  action: z.string(),
  design: named.nullable(),
  detail: z.unknown(),
})

export const settingsRoutes = {
  settings: defineRoute({
    key: 'settings',
    method: 'GET',
    path: '/api/settings',
    response: siteSettings,
    auth: 'siteOwner',
  }),
  updateSettings: defineRoute({
    key: 'updateSettings',
    method: 'PATCH',
    path: '/api/settings',
    body: siteSettings.partial(),
    response: siteSettings,
    auth: 'siteOwner',
  }),
  // ACT-01: newest first, one page at a time: `page` from 1 and `size` rows per page (10, 25, 50
  // or 100), with `total`, the rows of the whole list with the same filters. A page past the end
  // answers no entries and the true total.
  activity: defineRoute({
    key: 'activity',
    method: 'GET',
    path: '/api/activity',
    query: z.object({
      user: id.optional(),
      design: id.optional(),
      page: pageNumber.default(1),
      size: rowsPerPage.default(defaultRowsPerPage),
    }),
    response: z.object({ entries: z.array(activityEntry), total: z.number().int() }),
    auth: 'siteOwner',
  }),
}
