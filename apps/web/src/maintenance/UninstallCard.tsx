import { useQueryClient } from '@tanstack/react-query'
import { routes } from '@xdesign/api'
import {
  CircleAlertIcon,
  CircleCheckIcon,
  DatabaseIcon,
  DownloadIcon,
  LoaderCircleIcon,
  PackageXIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { toast } from 'sonner'

import { call } from '@/api/client'
import { TextField } from '@/components/forms'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldLegend, FieldSet } from '@/components/ui/field'
import { useConfirmItsYou } from '@/components/useConfirmItsYou'
import { downloadRequest } from '@/maintenance/download'
import { progressLine, type Run, useFollow } from '@/maintenance/follow'
import { NotTakenNotice } from '@/maintenance/parts'
import { MethodCard } from '@/settings/HttpsIssueDialog'

// Maintenance > Uninstall xDesign (docs/plan/19 section 4), the last card: "Keep the data" or
// "Remove everything", the offer to download a backup first, the word typed, then "Confirm it's
// you". The root helper starts the uninstaller apart from xDesign and records the request as
// done; the page then asks GET /api/health every 2 seconds until it fails 3 times in a row (xDesign
// is gone) or still answers 3 minutes later (the uninstall did not finish).

const pollMs = 2000
const goneAfter = 3
const stillMs = 3 * 60 * 1000

const choices = [
  {
    keepData: true,
    icon: DatabaseIcon,
    title: 'Keep the data',
    description:
      'The program goes. The designs, the settings and the backups stay on this server; installing xDesign again picks them up.',
  },
  {
    keepData: false,
    icon: Trash2Icon,
    title: 'Remove everything',
    description: 'The program, the designs, the settings and the backups on this server go. This cannot be undone.',
  },
] as const

/** The typed word unlocks the button: spaces around it and letter case do not count. */
const confirmed = (typed: string) => typed.trim().toLowerCase() === 'uninstall'

type Gone = 'asking' | 'gone' | 'answers'

/** After the uninstaller started: whether xDesign stopped answering, or still answers after 3 minutes. */
function useGone(started: boolean): Gone {
  const [gone, setGone] = useState<Gone>('asking')
  useEffect(() => {
    if (!started) return
    const since = Date.now()
    let failures = 0
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const ask = async () => {
      try {
        await call(routes.health)
        failures = 0
      } catch {
        failures += 1
      }
      if (stopped) return
      if (failures >= goneAfter) {
        setGone('gone')
      } else if (failures === 0 && Date.now() - since >= stillMs) {
        setGone('answers')
      } else {
        timer = setTimeout(() => void ask(), pollMs)
      }
    }
    timer = setTimeout(() => void ask(), pollMs)
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [started])
  return gone
}

/** An uninstall this tab follows: the request taken, the uninstaller started, then xDesign gone. */
function UninstallRun({ run, onDone }: { run: Run; onDone: () => void }) {
  const followed = useFollow(run.id)
  const result = followed.result
  // The result, or xDesign stopping before this tab read it, says the uninstaller started.
  const started = result ? result.ok : followed.wentDown
  const gone = useGone(started)
  const doneButton = (
    <Button size="sm" variant="outline" className="mt-1" onClick={onDone}>
      Done
    </Button>
  )

  if (result && !result.ok) {
    return (
      <Alert variant="destructive" role="status">
        <CircleAlertIcon aria-hidden />
        <AlertTitle>{result.message}</AlertTitle>
        <AlertDescription>{doneButton}</AlertDescription>
      </Alert>
    )
  }
  if (gone === 'gone') {
    return (
      <Alert variant="ok" role="status">
        <CircleCheckIcon aria-hidden />
        <AlertTitle>xDesign is uninstalled from this server.</AlertTitle>
        {run.keepData === undefined ? null : (
          <AlertDescription>
            {run.keepData
              ? 'Its data stays on the server: installing xDesign again picks it up.'
              : 'Nothing of it is left on the server.'}
          </AlertDescription>
        )}
      </Alert>
    )
  }
  if (gone === 'answers') {
    return (
      <Alert variant="warn" role="status">
        <TriangleAlertIcon aria-hidden />
        <AlertTitle>xDesign still answers: the uninstall did not finish.</AlertTitle>
        <AlertDescription>
          <p>
            Run{' '}
            <code dir="ltr" className="font-mono">
              xdesign --uninstall
            </code>{' '}
            on the server.
          </p>
          {doneButton}
        </AlertDescription>
      </Alert>
    )
  }
  if (followed.notTaken && !started) return <NotTakenNotice />
  return (
    <Alert role="status">
      <LoaderCircleIcon aria-hidden className="animate-spin motion-reduce:animate-none" />
      <AlertTitle>Uninstalling xDesign...</AlertTitle>
      <AlertDescription>
        {started
          ? 'The uninstaller started. The site stops in a moment.'
          : followed.progress
            ? progressLine(followed.progress)
            : 'Waiting for the server to take the request.'}
      </AlertDescription>
    </Alert>
  )
}

export function UninstallCard({
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
  const queryClient = useQueryClient()
  const confirm = useConfirmItsYou()
  const id = useId()
  const [keepData, setKeepData] = useState<boolean>()
  const [typed, setTyped] = useState('')
  const [making, setMaking] = useState(false)
  const [saved, setSaved] = useState<string>()

  // "Download a backup": a new backup, then its file (Backups' "Make a backup now" and "Download").
  const backUp = async () => {
    setMaking(true)
    setSaved(undefined)
    try {
      const made = await call(routes.makeBackup)
      void confirm.ask(
        downloadRequest(made, confirm.needs, () => {
          setSaved(made.file)
        }),
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setMaking(false)
      void queryClient.invalidateQueries({ queryKey: [routes.backups.key] })
    }
  }

  const uninstall = () => {
    const choice = choices.find((item) => item.keepData === keepData)
    if (!choice) return
    void confirm.ask({
      action: 'Uninstalling xDesign',
      description: `${choice.description} It needs ${confirm.needs}.`,
      submitLabel: 'Uninstall xDesign',
      run: async () => {
        const request = await call(routes.uninstall, { body: { keepData: choice.keepData } })
        setTyped('')
        onStart({ id: request.id, kind: 'uninstall', from: '', to: '', keepData: choice.keepData })
      },
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Uninstall xDesign</h2>
        </CardTitle>
        <CardDescription>Removes xDesign from this server. The site stops at once.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {run ? (
          <UninstallRun key={run.id} run={run} onDone={onDone} />
        ) : (
          <>
            <FieldSet className="gap-2.5">
              <FieldLegend className="sr-only">Uninstall xDesign</FieldLegend>
              {choices.map((choice) => (
                <MethodCard
                  key={choice.title}
                  name={`${id}-choice`}
                  checked={keepData === choice.keepData}
                  icon={choice.icon}
                  title={choice.title}
                  description={choice.description}
                  onChoose={() => {
                    setKeepData(choice.keepData)
                  }}
                />
              ))}
            </FieldSet>
            <div className="flex flex-col items-start gap-2">
              <p className="text-subhead text-fg-2">
                Make a backup and download it before you uninstall. With Remove everything, the backups on this server
                go too.
              </p>
              <Button
                variant="outline"
                disabled={making || busy}
                pending={making}
                pendingLabel="Making a backup..."
                onClick={() => void backUp()}
              >
                <DownloadIcon aria-hidden />
                Download a backup
              </Button>
              <p role="status" className="text-footnote text-fg-2 empty:hidden">
                {making ? 'Making a backup...' : saved ? `Downloaded ${saved}.` : null}
              </p>
            </div>
            <TextField
              label="Type uninstall to confirm"
              placeholder="uninstall"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={typed}
              onChange={(event) => {
                setTyped(event.target.value)
              }}
            />
            <div>
              <Button
                variant="destructive"
                disabled={!ready || busy || keepData === undefined || !confirmed(typed)}
                onClick={uninstall}
              >
                <PackageXIcon aria-hidden />
                Uninstall xDesign
              </Button>
            </div>
          </>
        )}
        {confirm.dialog}
      </CardContent>
    </Card>
  )
}
