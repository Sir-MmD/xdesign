import { routes } from '@xdesign/api'
import { CircleAlertIcon, CircleCheckIcon, GlobeIcon, ShuffleIcon } from 'lucide-react'
import { useId, useState } from 'react'

import { call, useApi } from '@/api/client'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { TextField } from '@/components/forms'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { useConfirmItsYou } from '@/components/useConfirmItsYou'
import { helperRetry, progressLine, useFollow } from '@/maintenance/follow'
import { CodeLine, HelperProblem, Loading, NotTakenNotice } from '@/maintenance/parts'

// Settings > Site address (docs/plan/17 section 6): the port and the secret web base path the site
// is served under, for the site owner. A change is a request of the root helper, as the domain's in
// HttpsCard.tsx: it moves xDesign and goes back to the old address when the new one does not
// start. The page cannot follow the move (the old address stops answering and the new one is
// another origin), so once the old address is gone the card links to the new one.

// The helper's rule (config.CheckBasePath) without "/" alone, which is no secret: the card does
// not offer it.
const basePathPattern = /^\/(?:[A-Za-z0-9_-]{4,64}\/){1,3}$/
const basePathProblem =
  'The path starts and ends with / and has 1 to 3 parts of 4 to 64 letters, digits, - or _, for example /k3v9x2m1q8wz7r4t/.'

// "Random": 16 of a-z and 0-9, as the helper's RandomBasePath.
const pathChars = 'abcdefghijklmnopqrstuvwxyz0123456789'
const pathLength = 16

function randomBasePath(): string {
  let path = ''
  while (path.length < pathLength) {
    for (const byte of crypto.getRandomValues(new Uint8Array(pathLength))) {
      // Bytes from 252 (7 times 36) up are skipped, so every character is as likely.
      if (byte < 252 && path.length < pathLength) path += pathChars.charAt(byte % pathChars.length)
    }
  }
  return `/${path}/`
}

/** The port and the base path of the site's address (`https://design.example.com:34567/k3v9x2m1q8wz7r4t`). */
function partsOf(address: string): { port: number; basePath: string } {
  const url = new URL(address)
  const port = url.port === '' ? (url.protocol === 'https:' ? 443 : 80) : Number(url.port)
  return { port, basePath: url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/` }
}

/** The full address at a port and a path: `https://design.example.com:34567/k3v9x2m1q8wz7r4t/`. */
function addressAt(address: string, port: number, basePath: string): string {
  const url = new URL(address)
  url.port = String(port)
  url.pathname = basePath
  return url.href
}

/** A port number from 1 to 65535, else undefined. */
function portOf(typed: string): number | undefined {
  const value = typed.trim()
  if (!/^\d{1,5}$/.test(value)) return undefined
  const port = Number(value)
  return port >= 1 && port <= 65535 ? port : undefined
}

// What the move breaks, in the dialog before "Move".
const moveText =
  'The site restarts at the new address. Links you sent before (view-only and Claude links), the Claude Code command and connected Claude apps keep the old address and stop working. People editing see Reconnecting.'

/** What "Move" asks the helper for, and the address it makes. */
interface Move {
  port: number
  basePath: string
  address: string
  newPath: boolean
}

export function AddressCard() {
  const https = useApi(routes.https, undefined, { retry: helperRetry })
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Site address</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {https.isPending ? (
          <Loading label="Loading the site address" />
        ) : https.isError ? (
          <HelperProblem error={https.error} />
        ) : (
          <AddressForm key={https.data.address} address={https.data.address} />
        )}
      </CardContent>
    </Card>
  )
}

/** The address with "Copy", the port and the path from today's values, and "Change address". */
function AddressForm({ address }: { address: string }) {
  const pathId = useId()
  const confirm = useConfirmItsYou()
  const current = partsOf(address)
  const [port, setPort] = useState(String(current.port))
  const [basePath, setBasePath] = useState(current.basePath)
  const [move, setMove] = useState<Move>()
  const [moveOpen, setMoveOpen] = useState(false)
  const [request, setRequest] = useState<{ id: string; address: string }>()

  const newPort = portOf(port)
  const newPath = basePath.trim()
  const portProblem =
    newPort === undefined
      ? 'Give a port number from 1 to 65535.'
      : newPort === 80
        ? 'Port 80 cannot serve HTTPS; choose another one.'
        : undefined
  const pathProblem = newPath === current.basePath || basePathPattern.test(newPath) ? undefined : basePathProblem
  const changed = newPort !== current.port || newPath !== current.basePath
  const ready = newPort !== undefined && portProblem === undefined && pathProblem === undefined && changed
  const described = pathProblem === undefined ? `${pathId}-description` : `${pathId}-description ${pathId}-error`

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-subhead font-semibold text-fg-2">Address</span>
        <CodeLine code={addressAt(address, current.port, current.basePath)} label="Copy the address" />
      </div>
      {request ? (
        <AddressRun key={request.id} id={request.id} address={request.address} />
      ) : (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!ready) return
            const next = {
              port: newPort,
              basePath: newPath,
              address: addressAt(address, newPort, newPath),
              newPath: newPath !== current.basePath,
            }
            void confirm.ask({
              action: 'Changing the site address',
              run: () => {
                setMove(next)
                setMoveOpen(true)
                return Promise.resolve()
              },
            })
          }}
        >
          <TextField
            label="Port"
            type="number"
            inputMode="numeric"
            min={1}
            max={65535}
            className="max-w-40"
            value={port}
            error={portProblem}
            onChange={(event) => {
              setPort(event.target.value)
            }}
          />
          <Field data-invalid={pathProblem === undefined ? undefined : true}>
            <FieldLabel htmlFor={pathId}>Web base path</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id={pathId}
                dir="ltr"
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
                value={basePath}
                aria-invalid={pathProblem === undefined ? undefined : true}
                aria-describedby={described}
                onChange={(event) => {
                  setBasePath(event.target.value)
                }}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  onClick={() => {
                    setBasePath(randomBasePath())
                  }}
                >
                  <ShuffleIcon aria-hidden />
                  Random
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription id={`${pathId}-description`}>
              Starts and ends with /, 1 to 3 parts of 4 to 64 letters, digits, - or _.
            </FieldDescription>
            <FieldError id={`${pathId}-error`}>{pathProblem}</FieldError>
          </Field>
          <Button type="submit" variant="outline" className="self-start" disabled={!ready}>
            <GlobeIcon aria-hidden />
            Change address
          </Button>
        </form>
      )}
      {confirm.dialog}
      {move ? (
        <ConfirmDialog
          open={moveOpen}
          onOpenChange={setMoveOpen}
          title={
            <>
              Move xDesign to{' '}
              <span dir="ltr" className="[overflow-wrap:anywhere]">
                {move.address}
              </span>
              ?
            </>
          }
          description={move.newPath ? `${moveText} Everyone signs in again at the new address.` : moveText}
          confirmLabel="Move"
          onConfirm={async () => {
            const answer = await call(routes.changeAddress, { body: { port: move.port, basePath: move.basePath } })
            setRequest({ id: answer.id, address: move.address })
          }}
        />
      ) : null}
    </div>
  )
}

/** A step of the move as it came: the helper's step and its line ("Opening the port... 50%"). */
interface Step {
  step: string
  line: string
}

/**
 * A move the page follows while the old address answers: the helper's steps as they come. Once
 * the old address stops answering the page cannot see the rest, so it links to the new address.
 */
function AddressRun({ id, address }: { id: string; address: string }) {
  const run = useFollow(id)
  const [steps, setSteps] = useState<Step[]>([])
  const progress = run.progress
  const last = steps.at(-1)
  if (progress) {
    const line = progressLine(progress)
    if (last?.step !== progress.step || last.line !== line) {
      const step = { step: progress.step, line }
      setSteps(last?.step === progress.step ? [...steps.slice(0, -1), step] : [...steps, step])
    }
  }
  const result = run.result
  if (result && !result.ok) {
    return (
      <Alert variant="destructive" role="status">
        <CircleAlertIcon aria-hidden />
        <AlertTitle>{result.message}</AlertTitle>
      </Alert>
    )
  }
  if (result) {
    return (
      <Alert variant="ok" role="status">
        <CircleCheckIcon aria-hidden />
        <AlertTitle>{result.message}</AlertTitle>
        <AlertDescription>
          <a href={result.address ?? address} className="font-semibold">
            Open the new address
          </a>
        </AlertDescription>
      </Alert>
    )
  }
  if (run.notTaken) return <NotTakenNotice />
  return (
    <div className="flex flex-col gap-3">
      <div role="status" className="flex flex-col gap-2 text-subhead text-fg-2">
        <p>
          Moving to{' '}
          <span dir="ltr" className="font-mono text-footnote [overflow-wrap:anywhere] text-foreground">
            {address}
          </span>
          ...
        </p>
        {steps.length > 0 ? (
          <ul className="flex list-disc flex-col gap-1 ps-5">
            {steps.map((step, index) => (
              <li key={index}>{step.line}</li>
            ))}
          </ul>
        ) : null}
      </div>
      {run.wentDown ? (
        <Alert role="status">
          <GlobeIcon aria-hidden />
          <AlertTitle>
            <a href={address}>Open the new address</a>
          </AlertTitle>
          <AlertDescription>
            If it does not open within a minute, xDesign went back to the old address: reload this page.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
