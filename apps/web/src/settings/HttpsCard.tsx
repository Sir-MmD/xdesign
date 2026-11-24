import { useQueryClient } from '@tanstack/react-query'
import { type HttpsView, routes } from '@xdesign/api'
import {
  ChevronDownIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  GlobeIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UploadIcon,
} from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { toast } from 'sonner'

import { apiKey, call, useApi } from '@/api/client'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { TextField } from '@/components/forms'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useConfirmItsYou } from '@/components/useConfirmItsYou'
import { formatDate } from '@/lib/time'
import { cn } from '@/lib/utils'
import { helperRetry, progressLine, useFollow } from '@/maintenance/follow'
import { HelperProblem, Loading, NotTakenNotice } from '@/maintenance/parts'
import {
  covers,
  domainOf,
  expiryOf,
  isBusy,
  isLetsEncrypt,
  issuerName,
  isWildcardName,
  kindChip,
  kindNames,
  kindOf,
  message,
  ownServed,
  statusNote,
  statusPill,
  withView,
} from '@/settings/httpsFacts'
import { HttpsIssueDialog, type IssueMethod, LogList } from '@/settings/HttpsIssueDialog'
import { HttpsUploadDialog } from '@/settings/HttpsUploadDialog'

// Settings > HTTPS (docs/plan/07 section 4, 18 section 7), through the Go helper's control
// socket, in the look of xmtp-panel's SSL manager: the one certificate the site serves as a row
// of its table (a card under 1024 pixels) with its method, expiry, status, actions and last
// error, and the Issue and Upload windows (HttpsIssueDialog.tsx, HttpsUploadDialog.tsx). The
// site's domain can change: the helper restarts xDesign with it on the same port, and the page
// then asks for a certificate of the new domain.

/** How the Issue window starts: the method in use when it is Let's Encrypt, else Cloudflare when a token is saved. */
function issueStart(view: HttpsView, domain: string): { method: IssueMethod; domain: string } {
  const kind = kindOf(view)
  if (kind === 'http' || kind === 'cloudflare' || kind === 'wildcard') return { method: kind, domain }
  return { method: view.cloudflareTokenSet ? 'cloudflare' : 'http', domain }
}

export function HttpsCard() {
  const https = useApi(routes.https, undefined, {
    retry: helperRetry,
    // While Let's Encrypt works, the state and its log are read every 2 seconds.
    refetchInterval: (query) => (isBusy(query.state.data?.view) ? 2000 : false),
  })
  const [issueOpen, setIssueOpen] = useState(false)
  const [issueFrom, setIssueFrom] = useState<{ method: IssueMethod; domain: string }>({ method: 'http', domain: '' })
  const [uploadOpen, setUploadOpen] = useState(false)
  const [replace, setReplace] = useState(false)
  const data = https.data
  const domain = data ? domainOf(data.address) : undefined

  const openIssue = (start: { method: IssueMethod; domain: string }) => {
    setIssueFrom(start)
    setIssueOpen(true)
  }
  const openUpload = (replacing: boolean) => {
    setReplace(replacing)
    setUploadOpen(true)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>HTTPS</h2>
        </CardTitle>
        <CardDescription>
          The certificate the site serves. xDesign renews Let&apos;s Encrypt certificates by itself.
        </CardDescription>
        {data ? (
          <CardAction className="flex-wrap max-sm:col-start-1 max-sm:row-span-1 max-sm:row-start-3 max-sm:mt-2 max-sm:justify-self-start">
            <Button
              variant="outline"
              disabled={isBusy(data.view)}
              onClick={() => {
                openUpload(false)
              }}
            >
              <UploadIcon aria-hidden />
              Upload certificate
            </Button>
            <Button
              disabled={isBusy(data.view)}
              onClick={() => {
                openIssue(issueStart(data.view, domain ?? ''))
              }}
            >
              <ShieldCheckIcon aria-hidden />
              Issue certificate
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {https.isPending ? (
          <Loading label="Loading HTTPS" />
        ) : https.isError ? (
          <HelperProblem error={https.error} />
        ) : (
          <>
            <Managed
              view={https.data.view}
              domain={domain}
              onIssue={openIssue}
              onReplace={() => {
                openUpload(true)
              }}
            />
            <DomainSection address={https.data.address} />
            <HttpsIssueDialog open={issueOpen} onOpenChange={setIssueOpen} view={https.data.view} start={issueFrom} />
            <HttpsUploadDialog
              open={uploadOpen}
              onOpenChange={setUploadOpen}
              view={https.data.view}
              system={https.data.system}
              domain={domain}
              replace={replace}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** The certificate's row, its log while Let's Encrypt works, the domain it misses, and its questions. */
function Managed({
  view,
  domain,
  onIssue,
  onReplace,
}: {
  view: HttpsView
  domain: string | undefined
  onIssue: (start: { method: IssueMethod; domain: string }) => void
  onReplace: () => void
}) {
  const queryClient = useQueryClient()
  const confirm = useConfirmItsYou()
  const [trying, setTrying] = useState(false)
  const [renewing, setRenewing] = useState(false)
  const [removing, setRemoving] = useState(false)
  const busy = isBusy(view)
  const served = view.certificate.names ?? []
  const uncovered = domain !== undefined && !busy && !covers(served, domain) ? domain : undefined
  const problem =
    view.lastProblem !== undefined ||
    view.certificate.problem !== undefined ||
    view.state === 'failed' ||
    view.state === 'expired' ||
    view.state === 'unreadable'
  // "Try now": a Let's Encrypt or file method with a problem; "Renew now": a Let's Encrypt
  // certificate that works renews early by hand, after asking.
  const canTry = (isLetsEncrypt(view.method) || view.method === 'file') && !busy && problem
  const canRenew = isLetsEncrypt(view.method) && view.state === 'active' && !view.lastProblem && view.renewAt != null

  // "Try now" and "Renew now": issue or renew at once; the card then follows the state and its log.
  const issue = async () => {
    const next = await call(routes.issueHttps)
    queryClient.setQueryData(apiKey(routes.https), withView(next))
  }

  const tryNow = async () => {
    setTrying(true)
    try {
      await issue()
    } catch (error) {
      toast.error(message(error))
    } finally {
      setTrying(false)
    }
  }

  // "Remove certificate": the built-in method, after "Confirm it's you".
  const remove = async () => {
    const next = await call(routes.chooseHttps, { body: { method: 'builtin' } })
    queryClient.setQueryData(apiKey(routes.https), withView(next))
    toast.success('Certificate removed. The site serves its built-in certificate.')
  }

  return (
    <div className="flex flex-col gap-4">
      <CertificateRow
        view={view}
        actions={
          <>
            {canRenew ? (
              <RowAction
                label="Renew now"
                onClick={() => {
                  setRenewing(true)
                }}
              >
                <RefreshCwIcon aria-hidden />
              </RowAction>
            ) : null}
            {canTry ? (
              <RowAction label="Try now" disabled={trying} pending={trying} onClick={() => void tryNow()}>
                <RotateCcwIcon aria-hidden />
              </RowAction>
            ) : null}
            {view.method === 'uploaded' ? (
              <RowAction label="Replace" disabled={busy} onClick={onReplace}>
                <UploadIcon aria-hidden />
              </RowAction>
            ) : null}
            {view.method === 'builtin' ? null : (
              <RowAction
                label="Remove certificate"
                disabled={busy}
                className="hover:text-error"
                onClick={() => {
                  setRemoving(true)
                }}
              >
                <Trash2Icon aria-hidden />
              </RowAction>
            )}
          </>
        }
      />
      {busy ? <LogList entries={view.log.slice(-8)} /> : null}
      {uncovered ? (
        <Alert variant="warn" role="status">
          <TriangleAlertIcon aria-hidden />
          <AlertTitle>The certificate is not for {uncovered}</AlertTitle>
          <AlertDescription className="grid gap-2">
            <p>Browsers warn on the site until it has one for {uncovered}. Let&apos;s Encrypt gives one for free.</p>
            <Button
              size="sm"
              className="justify-self-start"
              onClick={() => {
                onIssue({ method: view.cloudflareTokenSet ? 'cloudflare' : 'http', domain: uncovered })
              }}
            >
              Issue certificate for {uncovered}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <ConfirmDialog
        open={renewing}
        onOpenChange={setRenewing}
        title="Renew the certificate now?"
        description={
          view.renewAt
            ? `xDesign renews it by itself from ${formatDate(view.renewAt)}. Let's Encrypt allows only a few new certificates a week for the same names, so renew by hand only when something is wrong.`
            : undefined
        }
        confirmLabel="Renew now"
        destructive={false}
        onConfirm={issue}
      />
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title="Remove the certificate?"
        description="The site goes back to its built-in certificate, which browsers warn about. A Let's Encrypt certificate stops renewing."
        confirmLabel="Remove"
        onConfirm={() => {
          void confirm.ask({ action: 'Changing HTTPS', submitLabel: 'Remove', reuse: true, run: remove })
        }}
      />
      {confirm.dialog}
    </div>
  )
}

/** An action of the row: an icon button whose title names it. */
function RowAction({
  label,
  className,
  children,
  ...props
}: {
  label: string
  className?: string
  children: ReactNode
  disabled?: boolean
  pending?: boolean
  onClick: () => void
}) {
  return (
    <Button variant="outline" size="icon-sm" aria-label={label} title={label} className={className} {...props}>
      {children}
    </Button>
  )
}

// The row's columns from 1024 pixels: the names take the rest, the others xmtp-panel's widths.
const columns = 'lg:grid-cols-[minmax(0,1fr)_8.5rem_8.25rem_8.25rem_auto]'

/** The certificate as xmtp-panel's table row (CertTable.tsx), a card under 1024 pixels. */
function CertificateRow({ view, actions }: { view: HttpsView; actions: ReactNode }) {
  const lastError = view.lastProblem ?? view.certificate.problem
  return (
    <div className="overflow-hidden rounded-xl border">
      <div
        aria-hidden
        className={cn(
          'grid gap-x-3 border-b bg-surface-2 px-4 py-2 text-caption-2 font-bold tracking-[.04em] whitespace-nowrap text-fg-3 uppercase max-lg:hidden',
          columns,
        )}
      >
        <span>Domain</span>
        <span>Method · issuer</span>
        <span>Expires</span>
        <span>Status</span>
        <span />
      </div>
      <dl className={cn('grid gap-x-3 gap-y-3 px-4 py-3 sm:grid-cols-2 lg:items-start', columns)}>
        <Cell label="Domain" className="sm:col-span-2 lg:col-span-1">
          <Names names={view.names} />
        </Cell>
        <Cell label="Method · issuer">
          <Method view={view} />
        </Cell>
        <Cell label="Expires">
          <Expires view={view} />
        </Cell>
        <Cell label="Status">
          <Status view={view} />
        </Cell>
        <Cell label="Actions" hiddenLabel className="sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-1.5 lg:justify-end">{actions}</div>
        </Cell>
      </dl>
      {lastError ? (
        <div className="border-t px-4 py-2">
          <LastError
            text={lastError}
            tone={view.lastProblem ? 'error' : 'warn'}
            log={isBusy(view) ? [] : view.log.slice(-8)}
          />
        </div>
      ) : null}
    </div>
  )
}

/** A cell with its column's name, shown on the card and read out in the table. */
function Cell({
  label,
  hiddenLabel,
  className,
  children,
}: {
  label: string
  hiddenLabel?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <dt
        className={cn(
          'text-caption-2 font-bold tracking-[.04em] text-fg-3 uppercase lg:sr-only',
          hiddenLabel && 'sr-only',
        )}
      >
        {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

/** The first name, then "+N"; "Show all N names" shows the others. */
function Names({ names }: { names: readonly string[] }) {
  const [all, setAll] = useState(false)
  const first = names.find((name) => !isWildcardName(name)) ?? names[0]
  if (first === undefined) return <span className="text-subhead text-fg-3">-</span>
  const rest = names.filter((name) => name !== first)
  return (
    <div className="flex min-w-0 flex-col items-start gap-0.5">
      <span dir="ltr" title={names.join(', ')} className="font-mono text-subhead font-medium [overflow-wrap:anywhere]">
        {first}
        {rest.length > 0 && !all ? <span className="text-fg-2"> +{rest.length}</span> : null}
      </span>
      {all ? (
        <span dir="ltr" className="font-mono text-footnote [overflow-wrap:anywhere] text-fg-2">
          {rest.join(', ')}
        </span>
      ) : null}
      {rest.length > 0 ? (
        <button
          type="button"
          aria-expanded={all}
          className="cursor-pointer rounded-sm text-footnote font-semibold text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus focus-visible:outline-solid"
          onClick={() => {
            setAll((was) => !was)
          }}
        >
          {all ? 'Show fewer names' : `Show all ${String(names.length)} names`}
        </button>
      ) : null}
    </div>
  )
}

/** The method's chip, the issuer under it, and "Self-signed" for a self-signed certificate. */
function Method({ view }: { view: HttpsView }) {
  const kind = kindOf(view)
  const certificate = view.certificate
  const shown = ownServed(view) && certificate.issuer !== ''
  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5 max-lg:flex-row max-lg:flex-wrap max-lg:items-center max-lg:gap-x-2 max-lg:gap-y-1">
      <span
        dir="ltr"
        className={cn(
          'rounded-[5px] px-1.5 py-0.5 font-mono text-caption-2 font-medium whitespace-nowrap',
          kindChip[kind],
        )}
      >
        {kindNames[kind]}
      </span>
      {shown ? (
        <span
          title={`Issuer: ${certificate.issuer}`}
          className="text-footnote [overflow-wrap:anywhere] whitespace-normal text-fg-2"
        >
          {isLetsEncrypt(view.method) ? "Let's Encrypt" : issuerName(certificate.issuer)}
        </span>
      ) : null}
      {shown && certificate.selfSigned ? (
        <span
          title="Browsers do not trust a self-signed certificate"
          className="rounded-[5px] bg-warn-weak px-1.5 py-0.5 text-caption-2 font-semibold whitespace-nowrap text-warn"
        >
          Self-signed
        </span>
      ) : null}
    </div>
  )
}

/** The date, and the bar of the share of its life that is left with the days. */
function Expires({ view }: { view: HttpsView }) {
  const expiry = expiryOf(view)
  const notAfter = view.certificate.notAfter
  if (!expiry || notAfter == null) {
    return <span className="text-subhead text-fg-3">{isLetsEncrypt(view.method) ? 'Not issued' : '-'}</span>
  }
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="font-mono text-footnote whitespace-nowrap">{formatDate(notAfter)}</span>
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <span aria-hidden className="h-1 w-10 shrink-0 overflow-hidden rounded-[2px] bg-border">
          <span
            className={cn(
              'block h-1 rounded-[2px]',
              expiry.tone === 'error' ? 'bg-error' : expiry.tone === 'warn' ? 'bg-warn' : 'bg-fg-3',
            )}
            style={{ width: `${String(expiry.fill)}%` }}
          />
        </span>
        <span
          className={cn(
            'text-footnote whitespace-nowrap',
            expiry.tone === 'error' ? 'text-error' : expiry.tone === 'warn' ? 'text-warn' : 'text-fg-2',
          )}
        >
          {expiry.label}
        </span>
      </span>
    </div>
  )
}

/** The pill, and the line under it. */
function Status({ view }: { view: HttpsView }) {
  const pill = statusPill(view)
  const note = statusNote(view)
  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5 max-lg:flex-row max-lg:flex-wrap max-lg:items-center max-lg:gap-x-2 max-lg:gap-y-1">
      <Badge variant="pill" tone={pill.tone}>
        {pill.label}
      </Badge>
      {note ? <span className="text-footnote text-fg-3">{note}</span> : null}
    </div>
  )
}

/** "Last error: <first line>", a toggle that opens the whole text and the log. */
function LastError({ text, tone, log }: { text: string; tone: 'error' | 'warn'; log: HttpsView['log'] }) {
  const [open, setOpen] = useState(false)
  const color = tone === 'error' ? 'text-error' : 'text-warn'
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        title={open ? 'Show less' : text}
        className="group flex w-full min-w-0 cursor-pointer items-start gap-2 rounded-sm text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus focus-visible:outline-solid max-lg:min-h-10 max-lg:py-1.5"
        onClick={() => {
          setOpen((was) => !was)
        }}
      >
        <TriangleAlertIcon aria-hidden className={cn('mt-0.5 size-[13px] shrink-0', color)} />
        <span
          dir="auto"
          className={cn(
            'min-w-0 grow text-footnote',
            color,
            open
              ? '[overflow-wrap:anywhere] whitespace-pre-wrap'
              : 'line-clamp-2 [overflow-wrap:anywhere] lg:line-clamp-1',
          )}
        >
          <span className="font-semibold">Last error: </span>
          {open ? text : (text.split('\n')[0] ?? text)}
        </span>
        <ChevronDownIcon
          aria-hidden
          className={cn(
            'mt-0.5 size-[13px] shrink-0 text-fg-3 transition-transform duration-(--dur-fast) group-hover:text-fg-2',
            open && 'rotate-180',
          )}
        />
      </button>
      {open ? <LogList entries={log} /> : null}
    </div>
  )
}

/**
 * The site's domain (07 section 4.4): the root helper writes it into the settings and restarts
 * xDesign; the page follows the request and links to the new address.
 */
function DomainSection({ address }: { address: string }) {
  const confirm = useConfirmItsYou()
  const [domain, setDomain] = useState('')
  const [request, setRequest] = useState<{ id: string; domain: string }>()
  const typed = domain.trim().toLowerCase()

  return (
    <section aria-labelledby="domain-label" className="flex flex-col gap-3 border-t pt-5">
      <h3 id="domain-label" className="text-callout font-semibold">
        Domain
      </h3>
      <p className="text-subhead text-fg-2">
        xDesign opens at{' '}
        <span dir="ltr" className="font-mono text-footnote text-foreground">
          {address}
        </span>
        . Changing the domain restarts xDesign.
      </p>
      {request ? (
        <DomainRun key={request.id} id={request.id} domain={request.domain} />
      ) : (
        <form
          noValidate
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault()
            if (typed === '') return
            void confirm.ask({
              action: 'Changing the domain',
              description: `xDesign restarts with ${typed}, so open pages lose their connection for a moment. The certificate stays the one it has until you get one for ${typed} here. It needs ${confirm.needs}.`,
              submitLabel: 'Change the domain',
              run: async () => {
                const answer = await call(routes.changeDomain, { body: { domain: typed } })
                setRequest({ id: answer.id, domain: typed })
              },
            })
          }}
        >
          <div className="min-w-0 flex-1">
            <TextField
              label="New domain"
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
              placeholder="design.example.com"
              description="Its DNS record (A or AAAA) must point to this server."
              value={domain}
              onChange={(event) => {
                setDomain(event.target.value)
              }}
            />
          </div>
          <Button type="submit" variant="outline" className="self-start sm:mb-7" disabled={typed === ''}>
            <GlobeIcon aria-hidden />
            Change the domain
          </Button>
        </form>
      )}
      {confirm.dialog}
    </section>
  )
}

/** A domain change the page follows: the helper's steps, the restart, and the result. */
function DomainRun({ id, domain }: { id: string; domain: string }) {
  const run = useFollow(id)
  const result = run.result
  if (result?.ok) {
    return (
      <Alert variant="ok" role="status">
        <CircleCheckIcon aria-hidden />
        <AlertTitle>{result.message}</AlertTitle>
        <AlertDescription className="grid gap-2">
          <p>Open the new address, then get a certificate for {domain} here: browsers warn until it has one.</p>
          {result.address ? (
            <a href={result.address} className="font-semibold">
              Open {result.address}
            </a>
          ) : null}
        </AlertDescription>
      </Alert>
    )
  }
  if (result) {
    return (
      <Alert variant="destructive" role="status">
        <CircleAlertIcon aria-hidden />
        <AlertTitle>{result.message}</AlertTitle>
      </Alert>
    )
  }
  if (run.notTaken) return <NotTakenNotice />
  return (
    <p role="status" className="text-subhead text-fg-2">
      {run.down
        ? `xDesign is restarting with ${domain}... If this page does not come back, open the site at ${domain}.`
        : run.progress
          ? progressLine(run.progress)
          : 'Waiting for the server to take the change...'}
    </p>
  )
}
