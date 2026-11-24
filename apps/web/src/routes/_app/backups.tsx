import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { type DesktopBackup, type DesktopBackupKind, routes } from '@xdesign/api'
import {
  ArchiveIcon,
  DownloadIcon,
  FileUpIcon,
  FolderOpenIcon,
  HistoryIcon,
  LoaderCircleIcon,
  Trash2Icon,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { call, isApiError, routeUrl, useApi, useApiMutation } from '@/api/client'
import { requireRoute } from '@/app/session'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { FormProblem } from '@/components/forms'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { backupTime, notABackup, restoreFromFile } from '@/desktop/backupFile'
import { formatBytes } from '@/lib/format'
import { formatDateTime } from '@/lib/time'
import { useLast } from '@/lib/useLast'
import { Loading } from '@/maintenance/parts'

// Backups (docs/plan/18 section 9.5, DESK-03), the desktop app's own page in the person menu, on
// DESK-02's routes: "Open the backups folder", "Restore from a file..." and "Make a backup now",
// then the backups, newest first (the time, the kind, the size) with "Restore", "Save a copy..."
// (the app's window shows the save dialog) and "Delete", both asked first. Once a restore is
// taken, the app's server stops and starts again with the backup and the app loads the window
// again; until then the page says so. A server has no such page: there it goes to Designs.
export const Route = createFileRoute('/_app/backups')({
  beforeLoad: async ({ context }) => {
    await requireRoute(context.queryClient, 'desktopBackups')
  },
  component: Backups,
})

const kindNames: Readonly<Record<DesktopBackupKind, string>> = {
  automatic: 'Automatic',
  manual: 'Made by hand',
  beforeRestore: 'Before a restore',
}

/** A restore being asked: a backup of the list or a chosen file, when it was made, and how it is sent. */
interface Restore {
  createdAt: number
  send: () => Promise<unknown>
}

function errorText(error: unknown): string {
  return isApiError(error) || error instanceof Error ? error.message : String(error)
}

function Backups() {
  const queryClient = useQueryClient()
  const list = useApi(routes.desktopBackups, undefined, {
    // While a backup is made (the daily one, or one Claude asked for) the list is read again.
    refetchInterval: (query) => (query.state.data?.running ? 5000 : false),
  })
  const [making, setMaking] = useState(false)
  const [asking, setAsking] = useState<Restore>()
  const shownAsking = useLast(asking)
  const [deleting, setDeleting] = useState<DesktopBackup>()
  const shownDeleting = useLast(deleting)
  // A restore was taken: the app starts again with it and loads this window.
  const [restarting, setRestarting] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const refresh = () => queryClient.invalidateQueries({ queryKey: [routes.desktopBackups.key] })
  const openFolder = useApiMutation(routes.openDesktopBackupsFolder, {
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const make = async () => {
    setMaking(true)
    try {
      const made = await call(routes.makeDesktopBackup)
      toast.success(`Made the backup ${made.name}.`)
    } catch (error) {
      toast.error(errorText(error))
    } finally {
      setMaking(false)
      void refresh()
    }
  }

  // The browser's download, which the app's window turns into its save dialog.
  const save = (backup: DesktopBackup) => {
    const link = document.createElement('a')
    link.href = routeUrl(routes.desktopBackupFile, { params: { name: backup.name } })
    link.download = backup.name
    document.body.append(link)
    link.click()
    link.remove()
  }

  const choose = async (file: File) => {
    const createdAt = await backupTime(file)
    if (createdAt === undefined) {
      toast.error(notABackup)
      return
    }
    setAsking({ createdAt, send: () => restoreFromFile(file) })
  }

  if (restarting) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <h1 className="text-title-2 font-bold">Backups</h1>
        <p role="status" className="flex items-center gap-2 text-subhead text-fg-2">
          <LoaderCircleIcon aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
          Restoring... xDesign starts again in a moment.
        </p>
      </div>
    )
  }

  const data = list.data
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="me-auto text-title-2 font-bold">Backups</h1>
        <Button
          variant="outline"
          disabled={openFolder.isPending}
          onClick={() => {
            openFolder.mutate()
          }}
        >
          <FolderOpenIcon aria-hidden />
          Open the backups folder
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            fileInput.current?.click()
          }}
        >
          <FileUpIcon aria-hidden />
          Restore from a file...
        </Button>
        <Button disabled={making} pending={making} pendingLabel="Making a backup..." onClick={() => void make()}>
          <ArchiveIcon aria-hidden />
          Make a backup now
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".zip,application/zip"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void choose(file)
          }}
        />
      </div>
      <p className="text-subhead text-fg-2">A backup is made every day while xDesign runs; the last 14 are kept.</p>
      {data?.running && !making ? (
        <p role="status" className="text-subhead text-fg-2">
          A backup is being made or restored now.
        </p>
      ) : null}
      {list.isPending ? (
        <Loading label="Loading the backups" />
      ) : list.isError ? (
        <FormProblem message={list.error.message} />
      ) : list.data.backups.length === 0 ? (
        <EmptyState icon={HistoryIcon} title="No backups yet." />
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {list.data.backups.map((backup) => (
            <li key={backup.name} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{formatDateTime(backup.createdAt)}</span>
                  <Badge variant="pill" tone={backup.kind === 'manual' ? 'info' : 'off'}>
                    {kindNames[backup.kind]}
                  </Badge>
                </span>
                <span className="text-footnote text-fg-3">
                  {formatBytes(backup.size)} · xDesign {backup.version} ·{' '}
                  <span dir="ltr" className="font-mono">
                    {backup.name}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setAsking({
                      createdAt: backup.createdAt,
                      send: () => call(routes.restoreDesktopBackup, { params: { name: backup.name } }),
                    })
                  }}
                >
                  <HistoryIcon aria-hidden />
                  Restore
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    save(backup)
                  }}
                >
                  <DownloadIcon aria-hidden />
                  Save a copy...
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    setDeleting(backup)
                  }}
                >
                  <Trash2Icon aria-hidden />
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={asking !== undefined}
        onOpenChange={(open) => {
          if (!open) setAsking(undefined)
        }}
        title="Restore this backup?"
        description={`The designs as they were at ${shownAsking ? formatDateTime(shownAsking.createdAt) : ''} replace the ones in the app now. A backup of the app as it is now is made first.`}
        confirmLabel="Restore"
        onConfirm={async () => {
          if (!asking) return
          await asking.send()
          setRestarting(true)
        }}
      />
      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(open) => {
          if (!open) setDeleting(undefined)
        }}
        title={`Delete the backup of ${shownDeleting ? formatDateTime(shownDeleting.createdAt) : ''}?`}
        description="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleting) return
          await call(routes.deleteDesktopBackup, { params: { name: deleting.name } })
          toast.success(`Deleted the backup ${deleting.name}.`)
          await refresh()
        }}
      />
    </div>
  )
}
