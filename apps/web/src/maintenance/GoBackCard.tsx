import { type RouteResponse, routes } from '@xdesign/api'
import { CircleAlertIcon, CircleCheckIcon, TriangleAlertIcon, Undo2Icon } from 'lucide-react'
import { useId, useState } from 'react'

import { call, useApi } from '@/api/client'
import { useMe } from '@/app/session'
import { ConfirmItsYouDialog } from '@/components/ConfirmItsYouDialog'
import { proofWords } from '@/components/confirmProof'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { confirmItsYou } from '@/components/useConfirmItsYou'
import { formatDateTime } from '@/lib/time'
import { helperRetry, progressLine, type Run, useFollow } from '@/maintenance/follow'
import { HelperProblem, Loading, NotTakenNotice } from '@/maintenance/parts'
import { ProgressBar, Tracker, type TrackerStep } from '@/maintenance/Tracker'

// Maintenance > Go back (docs/plan/07 section 6.2 step 6, from xWriter's Go back section): the
// releases the server keeps, each with "Roll back to 1.0.0" (a fresh "Confirm it's you") and,
// when the update from it made a backup first, "Also restore the data from before the update";
// a release below the running one's schema floor goes back only with that data. A rollback
// follows the tracker of an update with its last two steps.

type Release = RouteResponse<typeof routes.releases>['previous'][number]

/** "the last 3 versions". */
const keptText = (count: number) => (count === 1 ? 'the last version' : `the last ${String(count)} versions`)

function rollbackSteps(run: Run, followed: ReturnType<typeof useFollow>): TrackerStep[] {
  const install = 'Go back and restart'
  const back = `Back on ${run.to}`
  const { result } = followed
  if (!result) {
    const first: TrackerStep = followed.down
      ? { title: install, state: 'active', line: 'xDesign is restarting...' }
      : followed.progress
        ? {
            title: install,
            state: 'active',
            line: progressLine(followed.progress),
            extra:
              followed.progress.percent === undefined ? undefined : (
                <ProgressBar value={followed.progress.percent} label="Return to the earlier version" />
              ),
          }
        : followed.wentDown
          ? { title: install, state: 'done', line: 'xDesign restarted.' }
          : { title: install, state: 'active', line: 'Waiting for the server to take the rollback...' }
    const second: TrackerStep =
      followed.wentDown && !followed.down
        ? { title: back, state: 'active', line: 'xDesign answers again: checking which build runs...' }
        : { title: back, state: 'pending', line: 'This page asks xDesign every 2 seconds which build it runs.' }
    return [first, second]
  }
  if (result.ok) {
    return [
      { title: install, state: 'done', line: 'xDesign restarted.' },
      { title: back, state: 'done', line: `xDesign ${result.to ?? run.to} runs now.` },
    ]
  }
  return [
    {
      title: install,
      state: 'failed',
      line: result.rolledBack ? `xDesign ${run.to} did not start, so ${run.from} runs again.` : result.message,
    },
    {
      title: back,
      state: result.rolledBack ? 'warn' : 'pending',
      line: result.rolledBack ? `Still xDesign ${run.from}.` : undefined,
    },
  ]
}

function RollbackRun({ run, onDone }: { run: Run; onDone: () => void }) {
  const followed = useFollow(run.id)
  const result = followed.result
  return (
    <div className="grid gap-4 border-b pb-4">
      <Tracker steps={rollbackSteps(run, followed)} label={`Going back to xDesign ${run.to}`} />
      {followed.notTaken && !result ? <NotTakenNotice /> : null}
      {result ? (
        <Alert variant={result.ok ? 'ok' : result.rolledBack ? 'warn' : 'destructive'} role="status">
          {result.ok ? (
            <CircleCheckIcon aria-hidden />
          ) : result.rolledBack ? (
            <TriangleAlertIcon aria-hidden />
          ) : (
            <CircleAlertIcon aria-hidden />
          )}
          <AlertTitle>{result.message}</AlertTitle>
          <AlertDescription>
            <Button size="sm" variant="outline" className="mt-1" onClick={onDone}>
              Done
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}

export function GoBackCard({
  ready,
  busy,
  run,
  onStart,
  onDone,
}: {
  /** The maintenance helper carries out requests. */
  ready: boolean
  busy: boolean
  run: Run | undefined
  onStart: (run: Run) => void
  onDone: () => void
}) {
  const me = useMe()
  const releases = useApi(routes.releases, undefined, { retry: helperRetry })
  const restoreId = useId()
  const [asking, setAsking] = useState<Release>()
  const [open, setOpen] = useState(false)
  const [restoreData, setRestoreData] = useState(false)
  const data = releases.data

  const ask = (release: Release) => {
    setAsking(release)
    setRestoreData(release.rollback === 'needs_restore')
    setOpen(true)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Go back</h2>
        </CardTitle>
        {data ? (
          <CardDescription>xDesign keeps {keptText(data.keepReleases)}. Going back keeps your data.</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {run ? <RollbackRun key={run.id} run={run} onDone={onDone} /> : null}
        {releases.isPending ? (
          <Loading label="Loading the kept versions" />
        ) : releases.isError ? (
          <HelperProblem error={releases.error} />
        ) : releases.data.previous.length === 0 ? (
          <p className="text-subhead text-fg-2">
            No earlier version is kept on this server yet: the version before the next update shows here.
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-xl border">
            {releases.data.previous.map((release) => (
              <li key={release.version} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-semibold">xDesign {release.version}</span>
                  {release.installedAt ? (
                    <span className="text-footnote text-fg-3">Installed {formatDateTime(release.installedAt)}</span>
                  ) : null}
                  {release.note ? <span className="text-footnote text-fg-2">{release.note}</span> : null}
                </div>
                {release.rollback === 'missing' ? (
                  <Badge variant="pill" tone="off">
                    Not kept
                  </Badge>
                ) : (
                  <Button
                    variant="outline"
                    disabled={!ready || busy}
                    onClick={() => {
                      ask(release)
                    }}
                  >
                    <Undo2Icon aria-hidden />
                    Roll back to {release.version}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {asking ? (
          <ConfirmItsYouDialog
            open={open}
            onOpenChange={setOpen}
            action={`Going back to xDesign ${asking.version}`}
            description={`The server installs xDesign ${asking.version} again and restarts it. It needs ${proofWords(me.twoFactor)}.`}
            submitLabel={`Roll back to ${asking.version}`}
            onConfirm={async (proof) => {
              await confirmItsYou(proof)
              const request = await call(routes.rollback, { body: { to: asking.version, restoreData } })
              onStart({ id: request.id, kind: 'rollback', from: data?.running ?? '', to: asking.version })
            }}
          >
            {asking.backup || asking.rollback === 'needs_restore' ? (
              <div className="grid gap-1.5">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id={restoreId}
                    checked={restoreData}
                    disabled={asking.rollback === 'needs_restore'}
                    onCheckedChange={(checked) => {
                      setRestoreData(checked)
                    }}
                  />
                  <Label htmlFor={restoreId} className="leading-snug font-normal">
                    Also restore the data from before the update
                  </Label>
                </div>
                <p className="text-footnote text-fg-2">
                  {asking.rollback === 'needs_restore'
                    ? `The update changed the database, so xDesign ${asking.version} needs the data from before it. Changes made since are lost; a backup of the site as it is now is made first.`
                    : 'Changes made since the update are lost; a backup of the site as it is now is made first.'}
                </p>
              </div>
            ) : null}
          </ConfirmItsYouDialog>
        ) : null}
      </CardContent>
    </Card>
  )
}
