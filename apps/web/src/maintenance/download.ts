// A backup's "Download" (docs/plan/07 section 5.3) after "Confirm it's you", or in the window of
// the last 5 minutes: Backups' and (docs/plan/19 section 4) Uninstall xDesign's "Download a backup".
import { type BackupEntry, routes } from '@xdesign/api'

import { routeUrl } from '@/api/client'
import type { ConfirmRequest } from '@/components/useConfirmItsYou'

/** The request for useConfirmItsYou: the browser saves the backup's file itself, then `onSaved` runs. */
export function downloadRequest(backup: BackupEntry, needs: string, onSaved?: () => void): ConfirmRequest {
  return {
    action: `Downloading ${backup.name}`,
    description: `A backup holds everything of the site: the designs, the members and their password hashes, the settings and the certificates. Downloading it needs ${needs}.`,
    submitLabel: 'Download',
    reuse: true,
    run: () => {
      // The server checked the confirmation's window.
      const link = document.createElement('a')
      link.href = routeUrl(routes.backupFile, { params: { name: backup.name } })
      link.download = backup.file
      document.body.append(link)
      link.click()
      link.remove()
      onSaved?.()
      return Promise.resolve()
    },
  }
}
