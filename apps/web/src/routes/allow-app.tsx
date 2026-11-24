import { createFileRoute, Link } from '@tanstack/react-router'
import { type ClaudeAppRequest, routes } from '@xdesign/api'
import { TriangleAlertIcon } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { z } from 'zod'

import { localDeadline } from '@/account/twoFactor'
import { type ApiError, useApi, useApiMutation } from '@/api/client'
import { requireRoute, signedInGuard } from '@/app/session'
import { useSavedTheme } from '@/app/theme'
import { AuthCard, AuthFrame } from '@/auth/AuthFrame'
import { CountdownTimer } from '@/components/CountdownTimer'
import { FormProblem } from '@/components/forms'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

// The "Allow" page of the Claude app and claude.ai (docs/plan/17 sections 13.5 and 13.6, MCP-03b),
// from xWriter's features/mcp/AllowAppPage.tsx and AllowAppSteps.tsx without its code flow. The
// authorize endpoint sends the browser here with the request's handle
// (`/allow-app?request=<handle>`); the page stands outside the site's frame with the signed-in
// pages' guard, so a browser without a session signs in first (password and code) and comes back.
// "Allow Claude to use xDesign as <name>?" names where the app comes from and where the answer
// goes (a warning when that is the app's own machine); "Deny" and "Allow" send the browser to the
// app with the answer. A request ends after 10 minutes, once answered, or in another browser.
const searchSchema = z.object({
  request: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/allow-app')({
  validateSearch: searchSchema,
  beforeLoad: async (options) => {
    await signedInGuard(options)
    // Not in the desktop app, which has no Claude app connector (DESK-03): there it goes to Designs.
    await requireRoute(options.context.queryClient, 'allowAppRequest')
  },
  component: AllowApp,
})

/** How long a request waits for its answer (MCP-03a). */
const requestMs = 10 * 60 * 1000

/** The server's words for a request that ended, was answered or is another session's. */
const requestGone = 'This request to connect an app has ended or is not yours. Start again from the app.'
const requestExpired = 'It waited 10 minutes without an answer. Start again from the app.'

/** The end of a request on the page: answered (the browser is on its way to the app), or over. */
type Outcome =
  { kind: 'answered'; allowed: boolean; host: string; to: string | undefined } | { kind: 'ended'; why: string }

/** Whether a URL's hostname names the machine itself, as the server's redirect rules do. */
function loopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(hostname)
}

/** The app's address with the answer, when it is one the browser may open: https, or http to the machine itself. */
function answerAddress(redirectTo: string): string | undefined {
  try {
    const url = new URL(redirectTo)
    const fits = url.protocol === 'https:' || (url.protocol === 'http:' && loopbackHost(url.hostname))
    return fits ? url.href : undefined
  } catch {
    return undefined
  }
}

function AllowApp() {
  const { request } = Route.useSearch()
  const me = useApi(routes.me)
  useSavedTheme(me.data?.user.theme)
  return (
    <AuthFrame>
      {request === undefined ? (
        <OutcomeCard outcome={{ kind: 'ended', why: requestGone }} />
      ) : (
        <RequestFlow key={request} handle={request} />
      )}
    </AuthFrame>
  )
}

/**
 * The request of the handle, read once: the first read keeps it for this session, and once it is
 * answered it is gone. Then the consent, then the answer.
 */
function RequestFlow({ handle }: { handle: string }) {
  const opened = useApi(routes.appRequest, { params: { token: handle } }, { staleTime: 'static' })
  const [outcome, setOutcome] = useState<Outcome>()

  if (outcome) return <OutcomeCard outcome={outcome} />
  if (opened.isPending) {
    return (
      <div role="status" aria-label="Loading the request" className="flex w-full max-w-[400px] flex-col gap-3">
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }
  if (opened.isError) {
    if (opened.error.code === 'not_found') return <OutcomeCard outcome={{ kind: 'ended', why: opened.error.message }} />
    return (
      <AuthCard title="The request could not be opened" titleId="allow-app-title">
        <FormProblem message={opened.error.message} />
        <Button
          className="self-start"
          disabled={opened.isFetching}
          pending={opened.isFetching}
          onClick={() => void opened.refetch()}
        >
          Try again
        </Button>
      </AuthCard>
    )
  }
  return <ConsentCard handle={handle} request={opened.data.request} onOutcome={setOutcome} />
}

/** A fact of the request: its label and value, in the consent's list. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-fg-3">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

/** A host as the consent names it: left to right, broken anywhere on a narrow screen. */
function Host({ name }: { name: string }) {
  return (
    <span dir="ltr" className="break-all">
      {name}
    </span>
  )
}

/**
 * The consent: "Allow <app> to use xDesign as <person>?", what it can do, where the app comes from
 * (the host of its client metadata document, or that it registered itself), where the answer goes
 * (a warning when that is the app's own machine) and when the request ends, then "Deny" and
 * "Allow".
 */
function ConsentCard({
  handle,
  request,
  onOutcome,
}: {
  handle: string
  request: ClaudeAppRequest
  onOutcome: (outcome: Outcome) => void
}) {
  const [problem, setProblem] = useState<string>()
  // On this browser's clock, never past the 10 minutes a request waits.
  const [until] = useState(() => localDeadline(request.expiresAt, requestMs))
  const answered = (allowed: boolean) => ({
    onSuccess: ({ redirectTo }: { redirectTo: string }) => {
      const to = answerAddress(redirectTo)
      onOutcome({ kind: 'answered', allowed, host: request.redirectHost, to })
      // The app's address with the code or the refusal: the app goes on from there.
      if (to !== undefined) window.location.assign(to)
    },
    onError: (error: ApiError) => {
      if (error.code === 'not_found') onOutcome({ kind: 'ended', why: error.message })
      else setProblem(error.message)
    },
  })
  const allow = useApiMutation(routes.allowAppRequest, answered(true))
  const deny = useApiMutation(routes.denyAppRequest, answered(false))
  const pending = allow.isPending || deny.isPending
  const answer = (allowed: boolean) => {
    if (pending) return
    setProblem(undefined)
    const input = { params: { token: handle } }
    if (allowed) allow.mutate(input)
    else deny.mutate(input)
  }

  return (
    <AuthCard
      title={`Allow ${request.app} to use xDesign as ${request.person.name}?`}
      lead="It can do everything you can do in xDesign. Actions that cannot be undone ask you first."
      titleId="allow-app-title"
    >
      <div className="flex flex-col gap-2">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-subhead">
          <Fact label="From">
            {request.clientKind === 'metadata' ? <Host name={request.clientHost} /> : 'It registered itself'}
          </Fact>
          <Fact label="Answer goes to">
            <Host name={request.redirectHost} />
          </Fact>
          <Fact label="Ends in">
            <CountdownTimer
              until={until}
              onExpire={() => {
                // An answer on its way decides itself.
                if (!pending) onOutcome({ kind: 'ended', why: requestExpired })
              }}
            />
          </Fact>
        </dl>
        <p className="text-footnote text-fg-3">
          {request.clientKind === 'metadata'
            ? `Its name comes from the details the app publishes at ${request.clientHost}.`
            : 'It registered itself with this site, as any app can, so its name is its own claim.'}
        </p>
      </div>
      {request.loopback ? (
        <Alert variant="warn" role="note">
          <TriangleAlertIcon aria-hidden />
          <AlertDescription>
            The answer goes to <span dir="ltr">{request.redirectHost}</span>, a program on the computer you use now,
            where any program can listen. Allow it only if you started this on this computer.
          </AlertDescription>
        </Alert>
      ) : null}
      <p className="text-footnote text-fg-3">
        Allow it only if you are connecting this app yourself now. You can disconnect it at any time on your Account
        page, under Connected apps.
      </p>
      <FormProblem message={problem} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          disabled={pending}
          pending={deny.isPending}
          pendingLabel="Working..."
          onClick={() => {
            answer(false)
          }}
        >
          Deny
        </Button>
        <Button
          disabled={pending}
          pending={allow.isPending}
          pendingLabel="Working..."
          onClick={() => {
            answer(true)
          }}
        >
          Allow
        </Button>
      </div>
    </AuthCard>
  )
}

/**
 * The end of a request: the answer, with the browser on its way to the app, or why it is over,
 * with the way to the site's designs.
 */
function OutcomeCard({ outcome }: { outcome: Outcome }) {
  if (outcome.kind === 'ended') {
    return (
      <AuthCard title="This request has ended" lead={outcome.why} titleId="allow-app-title">
        <Link to="/" className={buttonVariants({ variant: 'outline', className: 'self-start' })}>
          Go to Designs
        </Link>
      </AuthCard>
    )
  }
  const { allowed, host, to } = outcome
  const title = allowed ? 'Allowed' : 'Denied'
  if (to === undefined) {
    return (
      <AuthCard
        title={title}
        lead={allowed ? 'Done: go back to the app.' : 'Done: the app will not connect. Go back to the app.'}
        titleId="allow-app-title"
      />
    )
  }
  return (
    <AuthCard
      title={title}
      lead={
        <span role="status">
          Taking you back to <span dir="ltr">{host}</span>...
        </span>
      }
      titleId="allow-app-title"
    >
      <a href={to} className={buttonVariants({ variant: 'outline', className: 'self-start' })}>
        Go to <span dir="ltr">{host}</span>
      </a>
    </AuthCard>
  )
}
