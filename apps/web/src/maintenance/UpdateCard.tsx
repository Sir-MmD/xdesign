import { routes, type UpdateCheck } from '@xdesign/api'
import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleStopIcon,
  CloudUploadIcon,
  FileArchiveIcon,
  FileKeyIcon,
  FileTextIcon,
  PackagePlusIcon,
  TriangleAlertIcon,
  UploadIcon,
} from 'lucide-react'
import { type DragEvent, useId, useRef, useState } from 'react'

import { type ApiError, call, isApiError } from '@/api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { forgetConfirmation, useConfirmItsYou } from '@/components/useConfirmItsYou'
import { formatBytes } from '@/lib/format'
import { formatDateTime } from '@/lib/time'
import { cn } from '@/lib/utils'
import { type Followed, progressLine, type Run, useFollow } from '@/maintenance/follow'
import { CodeLine, HelperProblem, NotTakenNotice } from '@/maintenance/parts'
import { ProgressBar, Tracker, type TrackerStep } from '@/maintenance/Tracker'
import { fileRole, fileRoleNames, filesProblem, sendUpdate, type UploadProgress } from '@/maintenance/upload'

// Maintenance > Update (docs/plan/07 section 6.2, from xWriter's Panel settings > Update): drop
// the new xdesign file with SHA256SUMS and its .sig, "Upload and check" (after "Confirm it's
// you"), the check's rows, "Install and restart" (a fresh "Confirm it's you"), then the 4-step
// tracker of xWriter: "Upload the file", "Check it", "Install and restart", "Back on the new
// build", and how it ended, with "The update went back by itself." when the new version did not
// start.

type Phase = 'idle' | 'uploading' | 'checked' | 'refused' | 'failed'

export interface Helper {
  state: string
  message?: string | undefined
}

/** What blocks "Install and restart" on this server, in plain words. */
function helperBlock(helper: Helper | undefined): string | undefined {
  if (!helper || helper.state === 'ready') return undefined
  return helper.message ?? 'The maintenance helper is off.'
}

const percentOf = (upload: UploadProgress) => (upload.total > 0 ? (upload.loaded / upload.total) * 100 : 0)
const allSent = (upload: UploadProgress) => upload.total > 0 && upload.loaded >= upload.total

function uploadStep(phase: Phase, upload: UploadProgress, run: Run | undefined): TrackerStep {
  const title = 'Upload the file'
  if (phase === 'uploading' && !allSent(upload)) {
    return {
      title,
      state: 'active',
      line: `${String(Math.floor(percentOf(upload)))}% · ${formatBytes(upload.loaded)} of ${formatBytes(upload.total)}`,
      extra: <ProgressBar value={percentOf(upload)} label="Upload of the new build" />,
    }
  }
  if (phase === 'failed' && !allSent(upload)) {
    return {
      title,
      state: 'failed',
      line:
        upload.loaded > 0
          ? `Stopped at ${String(Math.floor(percentOf(upload)))}% (${formatBytes(upload.loaded)} of ${formatBytes(upload.total)}).`
          : 'The upload did not start.',
    }
  }
  // A run followed after a reload or from another tab knows no file.
  if (run && upload.total === 0) return { title, state: 'done' }
  return { title, state: 'done', line: `${formatBytes(upload.total)} sent.` }
}

function checkStep(
  phase: Phase,
  upload: UploadProgress,
  error: ApiError | undefined,
  run: Run | undefined,
): TrackerStep {
  const title = 'Check it'
  if (run) return { title, state: 'done', line: 'Passed.' }
  switch (phase) {
    case 'uploading':
      return allSent(upload)
        ? {
            title,
            state: 'active',
            line: 'xDesign checks the file: an xDesign build for this server, newer than this one, with its checksum and signature.',
          }
        : { title, state: 'pending', line: 'xDesign checks the file before anything changes.' }
    case 'checked':
      return { title, state: 'done', line: 'Passed.' }
    case 'refused':
      return { title, state: 'failed', line: 'This file cannot be installed here: see why below.' }
    case 'failed':
      return allSent(upload)
        ? { title, state: 'failed', line: error?.message ?? 'The check did not finish.' }
        : { title, state: 'pending' }
    default:
      return { title, state: 'pending' }
  }
}

function installStep(phase: Phase, run: Run | undefined, followed: Followed | undefined): TrackerStep {
  const title = 'Install and restart'
  if (!run || !followed) {
    return phase === 'checked'
      ? { title, state: 'pending', line: 'Starts when you press Install and restart.' }
      : { title, state: 'pending' }
  }
  const { result } = followed
  if (!result) {
    if (followed.down) return { title, state: 'active', line: 'xDesign is restarting...' }
    if (followed.progress) {
      return {
        title,
        state: 'active',
        line: progressLine(followed.progress),
        extra:
          followed.progress.percent === undefined ? undefined : (
            <ProgressBar value={followed.progress.percent} label="Install of the new build" />
          ),
      }
    }
    if (followed.wentDown) return { title, state: 'done', line: 'xDesign restarted.' }
    return { title, state: 'active', line: 'Waiting for the server to take the update...' }
  }
  if (result.ok) return { title, state: 'done', line: 'Installed, and xDesign restarted.' }
  if (result.rolledBack) {
    return {
      title,
      state: 'failed',
      line: `xDesign ${result.to ?? run.to} did not start, so the server went back to ${result.from ?? run.from} by itself.`,
    }
  }
  return { title, state: 'failed', line: result.message }
}

function backStep(run: Run | undefined, followed: Followed | undefined): TrackerStep {
  const title = 'Back on the new build'
  if (!run || !followed) return { title, state: 'pending' }
  const { result } = followed
  if (!result) {
    return followed.wentDown && !followed.down
      ? { title, state: 'active', line: 'xDesign answers again: checking which build runs...' }
      : { title, state: 'pending', line: 'This page asks xDesign every 2 seconds which build it runs.' }
  }
  if (result.ok) return { title, state: 'done', line: `xDesign ${result.to ?? run.to} runs now.` }
  if (result.rolledBack) return { title, state: 'warn', line: `Still xDesign ${result.from ?? run.from}.` }
  return { title, state: 'pending' }
}

const roleIcons = { build: FileArchiveIcon, sums: FileTextIcon, signature: FileKeyIcon } as const

function filesOf(list: FileList | null): File[] {
  return list ? Array.from(list) : []
}

/**
 * Where the new build goes: drop the xdesign file (or a tar.gz, zip, tar.xz or tar.zst holding
 * it) with SHA256SUMS and SHA256SUMS.sig on it, or click it to choose files.
 */
function DropZone({ disabled, onFiles }: { disabled: boolean; onFiles: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const hintId = useId()
  const [dragging, setDragging] = useState(false)
  const drop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDragging(false)
    const files = filesOf(event.dataTransfer.files)
    if (files.length > 0 && !disabled) onFiles(files)
  }
  return (
    <div>
      <input
        ref={input}
        type="file"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const files = filesOf(event.target.files)
          event.target.value = ''
          if (files.length > 0) onFiles(files)
        }}
      />
      <button
        type="button"
        disabled={disabled}
        aria-describedby={hintId}
        className={cn(
          'flex min-h-36 w-full touch-manipulation flex-col items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed p-6 text-center text-callout transition-colors duration-(--dur-fast) ease-(--ease) [-webkit-tap-highlight-color:transparent] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus focus-visible:outline-solid disabled:cursor-not-allowed disabled:opacity-50',
          dragging ? 'border-brand bg-brand-weak' : 'border-border-strong hover:bg-surface-2 active:bg-surface-press',
        )}
        onClick={() => {
          input.current?.click()
        }}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => {
          setDragging(false)
        }}
        onDrop={drop}
      >
        <CloudUploadIcon aria-hidden className="size-6 text-fg-3" />
        <span className="font-semibold text-foreground">
          Drop the new xdesign file here, or <span className="text-brand">choose files</span>
        </span>
        <span id={hintId} className="text-subhead text-fg-2">
          A tar.gz, zip, tar.xz or tar.zst file that holds it works too. Add SHA256SUMS and SHA256SUMS.sig from the
          release if you have them.
        </span>
      </button>
    </div>
  )
}

/** The chosen files, each with what it is and its size. */
function ChosenFiles({ files }: { files: readonly File[] }) {
  return (
    <ul className="m-0 grid list-none gap-2 p-0">
      {files.map((file) => {
        const role = fileRole(file)
        const Icon = roleIcons[role]
        return (
          <li
            key={`${file.name}-${String(file.size)}-${String(file.lastModified)}`}
            className="flex min-w-0 items-center gap-3 rounded-lg border bg-surface-2 px-3 py-2"
          >
            <Icon aria-hidden className="size-4 shrink-0 text-brand" />
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="truncate font-mono text-subhead text-foreground" dir="ltr">
                {file.name}
              </span>
              <span className="text-footnote text-fg-2">
                {fileRoleNames[role]} · {formatBytes(file.size)}
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** The check's rows (07 section 6.2 step 2), its warnings, and the release notes when the file has them. */
function CheckResult({ check }: { check: UpdateCheck }) {
  return (
    <div className="grid gap-3">
      <ul aria-label="The checks" className="m-0 grid list-none gap-1.5 p-0">
        {check.rows.map((row) => (
          <li key={row} className="flex items-center gap-2 text-callout">
            <CircleCheckIcon aria-hidden className="size-4 shrink-0 text-ok" />
            {row}
          </li>
        ))}
      </ul>
      {check.warnings.map((warning) => (
        <Alert key={warning} variant="warn" role="status">
          <TriangleAlertIcon aria-hidden />
          <AlertTitle className="font-semibold">{warning}</AlertTitle>
        </Alert>
      ))}
      {check.releaseNotes ? (
        <section aria-label="Release notes" className="grid gap-1.5">
          <h3 className="text-callout font-semibold">Release notes</h3>
          <div className="max-h-72 overflow-y-auto rounded-xl border px-3 py-2 text-subhead whitespace-pre-wrap">
            {check.releaseNotes}
          </div>
        </section>
      ) : null}
      {check.expiresAt ? (
        <p className="text-footnote text-fg-3">
          The checked file waits until {formatDateTime(check.expiresAt)}; after that, check it again.
        </p>
      ) : null}
    </div>
  )
}

/** How the update ended: the result's words, and the saved journal after going back. */
function Outcome({ followed, onDone }: { followed: Followed; onDone: () => void }) {
  const result = followed.result
  if (!result) return null
  const done = (
    <Button size="sm" variant="outline" className="justify-self-start" onClick={onDone}>
      Done
    </Button>
  )
  if (result.ok) {
    return (
      <Alert variant="ok" role="status">
        <CircleCheckIcon aria-hidden />
        <AlertTitle>{result.message}</AlertTitle>
        <AlertDescription className="grid gap-2">{done}</AlertDescription>
      </Alert>
    )
  }
  return (
    <Alert variant={result.rolledBack ? 'warn' : 'destructive'} role="status">
      {result.rolledBack ? <TriangleAlertIcon aria-hidden /> : <CircleAlertIcon aria-hidden />}
      <AlertTitle>{result.rolledBack ? 'The update went back by itself' : 'The update did not finish'}</AlertTitle>
      <AlertDescription className="grid gap-2">
        <p>{result.message}</p>
        {result.failureLog ? <CodeLine code={result.failureLog} label="Copy the path" /> : null}
        {done}
      </AlertDescription>
    </Alert>
  )
}

/** The tracker of an install this tab follows, with how it ended. */
function InstallRun({
  phase,
  upload,
  run,
  onDone,
}: {
  phase: Phase
  upload: UploadProgress
  run: Run
  onDone: () => void
}) {
  const followed = useFollow(run.id)
  const steps = [
    uploadStep(phase, upload, run),
    checkStep(phase, upload, undefined, run),
    installStep(phase, run, followed),
    backStep(run, followed),
  ]
  return (
    <div className="grid gap-4">
      <Tracker steps={steps} label={run.to ? `Installing xDesign ${run.to}` : 'Installing a new build'} />
      {followed.notTaken && !followed.result ? <NotTakenNotice /> : null}
      <Outcome followed={followed} onDone={onDone} />
    </div>
  )
}

export function UpdateCard({
  helper,
  helperError,
  busy,
  run,
  onStart,
  onDone,
}: {
  helper: Helper | undefined
  /** GET /api/maintenance failed: no helper in `make dev`, or a restart the tracker shows itself. */
  helperError: ApiError | null
  /** A request of the helper waits or runs. */
  busy: boolean
  /** The update this tab follows. */
  run: Run | undefined
  onStart: (run: Run) => void
  onDone: () => void
}) {
  const confirm = useConfirmItsYou()
  const [files, setFiles] = useState<File[]>([])
  const [phase, setPhase] = useState<Phase>('idle')
  const [upload, setUpload] = useState<UploadProgress>({ loaded: 0, total: 0 })
  const [check, setCheck] = useState<UpdateCheck>()
  const [error, setError] = useState<ApiError>()
  const stop = useRef<() => void>(undefined)
  const block = helperBlock(helper)
  const problem = files.length > 0 ? filesProblem(files) : undefined

  const reset = () => {
    if (check?.uploadId) {
      // The checked file waits on the server otherwise; nothing to tell when this fails.
      void call(routes.discardUpdate, { params: { uploadId: check.uploadId } }).catch(() => undefined)
    }
    setFiles([])
    setPhase('idle')
    setUpload({ loaded: 0, total: 0 })
    setCheck(undefined)
    setError(undefined)
  }

  const startUpload = () => {
    const total = files.reduce((sum, file) => sum + file.size, 0)
    setPhase('uploading')
    setUpload({ loaded: 0, total })
    setCheck(undefined)
    setError(undefined)
    const sending = sendUpdate(files, (progress) => {
      setUpload({ loaded: progress.loaded, total: progress.total || total })
    })
    stop.current = sending.abort
    sending.done.then(
      (answer) => {
        setUpload({ loaded: total, total })
        setCheck(answer)
        setPhase(answer.refusal ? 'refused' : 'checked')
      },
      (failure: unknown) => {
        if (isApiError(failure) && failure.code === 'confirm_needed') forgetConfirmation()
        setError(isApiError(failure) ? failure : undefined)
        setPhase('failed')
      },
    )
  }

  // The check runs the uploaded file's checks on the server, so it asks for "Confirm it's you"
  // unless one passed within 5 minutes.
  const askCheck = () => {
    void confirm.ask({
      action: 'Checking a new build',
      description: `The file goes to the server, which checks it before anything changes. It needs ${confirm.needs}; the confirmation counts for 5 minutes.`,
      submitLabel: 'Confirm and upload',
      reuse: true,
      run: () => {
        startUpload()
        return Promise.resolve()
      },
    })
  }

  const askInstall = () => {
    if (!check?.uploadId) return
    const uploadId = check.uploadId
    const to = check.version
    void confirm.ask({
      action: `Installing xDesign ${to}`,
      description: `The server backs up the site, puts xDesign ${to} in place and restarts it; if the new version does not start, it goes back to ${check.fromVersion} by itself. It needs ${confirm.needs}.`,
      submitLabel: 'Install and restart',
      run: async () => {
        const request = await call(routes.installUpdate, { body: { uploadId } })
        onStart({ id: request.id, kind: 'update', from: check.fromVersion, to })
      },
    })
  }

  const finish = () => {
    onDone()
    setFiles([])
    setPhase('idle')
    setUpload({ loaded: 0, total: 0 })
    setCheck(undefined)
    setError(undefined)
  }

  const tracking = run !== undefined || phase !== 'idle'

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Update</h2>
        </CardTitle>
        <CardDescription>
          Upload the new xdesign file. xDesign checks it before anything changes, then installs it and restarts, and
          goes back by itself if the new version does not start.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {helperError && !run ? <HelperProblem error={helperError} /> : null}
        {block ? (
          <Alert variant="warn" role="status">
            <TriangleAlertIcon aria-hidden />
            <AlertTitle className="font-semibold">{block}</AlertTitle>
          </Alert>
        ) : null}
        {run ? (
          <InstallRun phase={phase} upload={upload} run={run} onDone={finish} />
        ) : tracking ? (
          <div className="grid gap-4">
            <Tracker
              steps={[
                uploadStep(phase, upload, undefined),
                checkStep(phase, upload, error, undefined),
                installStep(phase, undefined, undefined),
                backStep(undefined, undefined),
              ]}
              label={check?.version ? `Installing xDesign ${check.version}` : 'Installing a new build'}
            />
            {check && phase === 'checked' ? <CheckResult check={check} /> : null}
            {phase === 'refused' && check?.refusal ? (
              <Alert variant="destructive">
                <CircleAlertIcon aria-hidden />
                <AlertTitle>This file cannot be installed</AlertTitle>
                <AlertDescription>{check.refusal}</AlertDescription>
              </Alert>
            ) : null}
            {phase === 'failed' && error ? (
              <Alert variant="destructive">
                <CircleAlertIcon aria-hidden />
                <AlertTitle>{allSent(upload) ? 'The check did not finish' : 'The upload did not finish'}</AlertTitle>
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              {phase === 'uploading' && !allSent(upload) ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    stop.current?.()
                  }}
                >
                  <CircleStopIcon aria-hidden />
                  Stop the upload
                </Button>
              ) : null}
              {phase === 'checked' ? (
                <Button disabled={block !== undefined || busy} onClick={askInstall}>
                  <PackagePlusIcon aria-hidden />
                  Install and restart
                </Button>
              ) : null}
              {phase === 'failed' && error?.code !== 'aborted' ? (
                <Button
                  onClick={() => {
                    askCheck()
                  }}
                >
                  <UploadIcon aria-hidden />
                  Try again
                </Button>
              ) : null}
              {phase === 'checked' || phase === 'refused' || phase === 'failed' ? (
                <Button variant="outline" onClick={reset}>
                  Choose another file
                </Button>
              ) : null}
            </div>
          </div>
        ) : files.length === 0 ? (
          <DropZone disabled={busy || helperError !== null} onFiles={setFiles} />
        ) : (
          <div className="grid gap-4">
            <ChosenFiles files={files} />
            {problem ? (
              <Alert variant="destructive">
                <CircleAlertIcon aria-hidden />
                <AlertTitle className="font-semibold">{problem}</AlertTitle>
              </Alert>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={problem !== undefined || busy}
                onClick={() => {
                  askCheck()
                }}
              >
                <UploadIcon aria-hidden />
                Upload and check
              </Button>
              <Button variant="outline" onClick={reset}>
                Choose other files
              </Button>
            </div>
          </div>
        )}
        {confirm.dialog}
      </CardContent>
    </Card>
  )
}
