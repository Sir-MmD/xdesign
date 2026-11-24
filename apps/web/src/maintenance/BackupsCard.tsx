import { useQueryClient } from '@tanstack/react-query'
import { type BackupEntry, routes } from '@xdesign/api'
import { ArchiveIcon, CircleAlertIcon, CircleCheckIcon, DownloadIcon, HistoryIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { call, useApi } from '@/api/client'
import { EmptyState } from '@/components/EmptyState'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useConfirmItsYou } from '@/components/useConfirmItsYou'
import { formatBytes } from '@/lib/format'
import { formatDateTime } from '@/lib/time'
import { downloadRequest } from '@/maintenance/download'
import { helperRetry, progressLine, type Run, useFollow } from '@/maintenance/follow'
import { HelperProblem, Loading, NotTakenNotice } from '@/maintenance/parts'

// Maintenance > Backups (docs/plan/07 sections 5.3 and 5.4): the list with size and time and the
// space used, "Make a backup now", and on each backup "Download", "Delete" and "Restore" (after
// "Confirm it's you"). A restore goes through the root helper: the page follows its steps while
// xDesign stops and starts again, then shows how it ended.

const kindNames: Readonly<Record<string, string>> = {
  daily: 'Daily',
  manual: 'Made by hand',
  'pre-update': 'Before an update',
}

/** A restore this tab follows: the helper's step, the restart, and the result. */
function RestoreRun({ run, onDone }: { run: Run; onDone: () => void }) {
  const followed = useFollow(run.id)
  const result = followed.result
  if (result) {
    return (
      <Alert variant={result.ok ? 'ok' : 'destructive'} role="status">
        {result.ok ? <CircleCheckIcon aria-hidden /> : <CircleAlertIcon aria-hidden />}
        <AlertTitle>{result.message}</AlertTitle>
        <AlertDescription>
          <Button size="sm" variant="outline" className="mt-1" onClick={onDone}>
            Done
          </Button>
        </AlertDescription>
      </Alert>
    )
  }
  if (followed.notTaken) return <NotTakenNotice />
  return (
    <p role="status" className="text-subhead text-fg-2">
      {`Restoring ${run.to}: `}
      {followed.down
        ? 'xDesign is restarting...'
        : followed.progress
          ? progressLine(followed.progress)
          : 'Waiting for the server to take the restore...'}
    </p>
  )
}

export function BackupsCard({
  ready,
  busy,
  run,
  onStart,
  onDone,
}: {
  /** The maintenance helper carries out requests (a restore). */
  ready: boolean
  busy: boolean
  run: Run | undefined
  onStart: (run: Run) => void
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const confirm = useConfirmItsYou()
  const list = useApi(routes.backups, undefined, {
    retry: helperRetry,
    // While a backup is made (by the timer, or in another tab) the list is read again.
    refetchInterval: (query) => (query.state.data?.running ? 5000 : false),
  })
  const [making, setMaking] = useState(false)
  const refresh = () => queryClient.invalidateQueries({ queryKey: [routes.backups.key] })

  const make = async () => {
    setMaking(true)
    try {
      const made = await call(routes.makeBackup)
      toast.success(`Made the backup ${made.name}.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setMaking(false)
      void refresh()
    }
  }

  const download = (backup: BackupEntry) => {
    void confirm.ask(downloadRequest(backup, confirm.needs))
  }

  const remove = (backup: BackupEntry) => {
    void confirm.ask({
      action: `Deleting ${backup.name}`,
      description: `Delete the backup ${backup.name}? This cannot be undone. It needs ${confirm.needs}.`,
      submitLabel: 'Delete',
      run: async () => {
        await call(routes.deleteBackup, { params: { name: backup.name } })
        toast.success(`Deleted the backup ${backup.name}.`)
        await refresh()
      },
    })
  }

  const restore = (backup: BackupEntry) => {
    void confirm.ask({
      action: `Restoring ${backup.name}`,
      description: `The server makes a backup of the site as it is now, then puts back the database, the media, the settings and the certificates of ${backup.name}, and restarts xDesign. Everything changed since the backup is lost. It needs ${confirm.needs}.`,
      submitLabel: 'Restore',
      run: async () => {
        const request = await call(routes.restoreBackup, { params: { name: backup.name } })
        onStart({ id: request.id, kind: 'restore', from: '', to: backup.name })
      },
    })
  }

  const data = list.data
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Backups</h2>
        </CardTitle>
        <CardDescription>
          A backup is made every day at 03:30; the last 14 are kept.
          {data ? ` ${formatBytes(data.spaceUsed)} used.` : ''}
        </CardDescription>
        <CardAction>
          <Button
            variant="outline"
            disabled={making || busy || !data || data.running}
            pending={making}
            pendingLabel="Making a backup..."
            onClick={() => void make()}
          >
            <ArchiveIcon aria-hidden />
            Make a backup now
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {run ? <RestoreRun key={run.id} run={run} onDone={onDone} /> : null}
        {data?.running && !making ? (
          <p role="status" className="text-subhead text-fg-2">
            A backup is being made or restored now.
          </p>
        ) : null}
        {list.isPending ? (
          <Loading label="Loading the backups" />
        ) : list.isError ? (
          <HelperProblem error={list.error} />
        ) : list.data.backups.length === 0 ? (
          <EmptyState icon={HistoryIcon} title="No backups yet." />
        ) : (
          <ul className="flex flex-col divide-y rounded-xl border">
            {list.data.backups.map((backup) => (
              <li key={backup.name} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      {backup.createdAt ? formatDateTime(backup.createdAt) : backup.name}
                    </span>
                    <Badge variant="pill" tone={backup.kind === 'pre-update' ? 'info' : 'off'}>
                      {kindNames[backup.kind] ?? backup.kind}
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
                      download(backup)
                    }}
                  >
                    <DownloadIcon aria-hidden />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!ready || busy || list.data.running}
                    onClick={() => {
                      restore(backup)
                    }}
                  >
                    <HistoryIcon aria-hidden />
                    Restore
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy || list.data.running}
                    onClick={() => {
                      remove(backup)
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
        {confirm.dialog}
      </CardContent>
    </Card>
  )
}
