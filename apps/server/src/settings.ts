// The site's settings (Settings page, docs/plan/04 section 1): rows of the settings table, one
// JSON value per key. A key never saved, or a value that no longer fits, reads as its default.
import { siteSettings, type SiteSettings } from '@xdesign/api'
import { z } from 'zod'

import { getDb } from './db/index.ts'
import { settings } from './db/schema.ts'

const stored = z.object({
  siteName: siteSettings.shape.siteName.catch('xDesign'),
  // 20 MB per file by default (D-25).
  uploadLimitMb: siteSettings.shape.uploadLimitMb.catch(20),
})

export function readSettings(): SiteSettings {
  const rows = getDb().select().from(settings).all()
  return stored.parse(Object.fromEntries(rows.map((row) => [row.key, row.value])))
}

// Saves the settings given, one row per key, and answers all of them.
export function writeSettings(changes: Partial<SiteSettings>): SiteSettings {
  getDb().transaction((tx) => {
    for (const [key, value] of Object.entries(changes)) {
      tx.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run()
    }
  })
  return readSettings()
}
