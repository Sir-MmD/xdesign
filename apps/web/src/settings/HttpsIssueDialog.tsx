import { useQueryClient } from '@tanstack/react-query'
import { type HttpsView, routes } from '@xdesign/api'
import {
  AsteriskIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CloudIcon,
  GlobeIcon,
  LoaderCircleIcon,
  type LucideIcon,
} from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'

import { apiKey, call, isApiError } from '@/api/client'
import { TextField } from '@/components/forms'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FieldLegend, FieldSet } from '@/components/ui/field'
import { useConfirmItsYou } from '@/components/useConfirmItsYou'
import { formatDateTime } from '@/lib/time'
import { cn } from '@/lib/utils'
import { isBusy, kindNames, message, ownServed, withView } from '@/settings/httpsFacts'

// The Issue certificate window of Settings > HTTPS (docs/plan/18 section 7.2), xmtp-panel's
// (web/src/pages/certificates/IssueWindow.tsx) without "This panel itself" and its nodes: the
// sections Names, Method (HTTP-01, Cloudflare DNS-01 or Wildcard, with the token and its guide)
// and Result, which follows the issuance through the card's view (read every 2 seconds while
// Let's Encrypt works) and shows its log. A wildcard is the Cloudflare method with the names
// `*.<domain>` and `<domain>`.

export type IssueMethod = 'http' | 'cloudflare' | 'wildcard'

const methods: readonly { value: IssueMethod; icon: LucideIcon; description: string }[] = [
  {
    value: 'http',
    icon: GlobeIcon,
    description: 'A certificate for this name through port 80. No Cloudflare token needed.',
  },
  {
    value: 'cloudflare',
    icon: CloudIcon,
    description: 'A certificate for this name through a Cloudflare TXT record. Port 80 can stay closed.',
  },
  {
    value: 'wildcard',
    icon: AsteriskIcon,
    description: 'One certificate for the domain and every name one level under it, through Cloudflare DNS.',
  },
]

/** An IP address, which Let's Encrypt does not certify here. */
const isIpAddress = (host: string) => host.includes(':') || /^[\d.]+$/.test(host)

export function HttpsIssueDialog({
  open,
  onOpenChange,
  view,
  start,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  view: HttpsView
  /** What the window starts with. */
  start: { method: IssueMethod; domain: string }
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {/* Mounted only while open, so each opening starts afresh. */}
        <IssueForm
          view={view}
          start={start}
          onDone={() => {
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function IssueForm({
  view,
  start,
  onDone,
}: {
  view: HttpsView
  start: { method: IssueMethod; domain: string }
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const confirm = useConfirmItsYou()
  const id = useId()
  const [domain, setDomain] = useState(start.domain)
  const [method, setMethod] = useState<IssueMethod>(start.method)
  const [token, setToken] = useState('')
  const [guideOpen, setGuideOpen] = useState(false)
  const [sending, setSending] = useState(false)
  // What the last press asked for, and the helper's refusal of it.
  const [sent, setSent] = useState<string>()
  const [refusal, setRefusal] = useState<string>()
  // The helper's answer, and the card's view it changed: the answer stands for the view until the
  // card's view follows it, so the old state never shows as the result.
  const [answer, setAnswer] = useState<{ before: HttpsView; next: HttpsView }>()
  const live = answer && view === answer.before ? answer.next : view

  const clean = domain
    .trim()
    .toLowerCase()
    .replace(/^\*\.?/, '')
  const ip = clean !== '' && isIpAddress(clean)
  const shown = clean || 'example.com'
  const preview = method === 'wildcard' ? `*.${shown} and ${shown}` : shown
  const cloudflare = method !== 'http'
  const missing = clean === '' || ip || (cloudflare && !view.cloudflareTokenSet && token.trim() === '')

  // The result: running while the request or Let's Encrypt works, then issued or not.
  const running = sending || (sent !== undefined && refusal === undefined && isBusy(live))
  const issued =
    sent !== undefined &&
    !running &&
    refusal === undefined &&
    live.state === 'active' &&
    !live.lastProblem &&
    ownServed(live)
  const reason = refusal ?? live.lastProblem ?? live.certificate.problem

  const issue = async () => {
    const names = method === 'wildcard' ? [`*.${clean}`, clean] : [clean]
    setSending(true)
    setRefusal(undefined)
    try {
      const next = await call(routes.chooseHttps, {
        body: {
          method: cloudflare ? 'letsencrypt_cloudflare' : 'letsencrypt_http',
          names,
          ...(cloudflare && token.trim() !== '' ? { cloudflareToken: token } : {}),
        },
      })
      queryClient.setQueryData(apiKey(routes.https), withView(next))
      setAnswer({ before: view, next })
      setSent(preview)
    } catch (error) {
      // An ended "Confirm it's you" asks again; any other refusal is the result.
      if (isApiError(error) && error.code === 'confirm_needed') throw error
      setRefusal(message(error))
      setSent(preview)
    } finally {
      setSending(false)
    }
  }

  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        if (missing || running) return
        void confirm.ask({ action: 'Changing HTTPS', submitLabel: 'Issue certificate', reuse: true, run: issue })
      }}
    >
      <DialogHeader>
        <DialogTitle>Issue certificate</DialogTitle>
        <DialogDescription>The site keeps its current certificate until the new one is issued.</DialogDescription>
      </DialogHeader>
      {issued ? null : (
        <>
          <Section id={`${id}-names`} title="Names">
            <TextField
              label="Domain"
              dir="ltr"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="design.example.com"
              className="font-mono"
              description={ip ? undefined : `Certificate will be issued for ${preview}`}
              error={ip ? "Let's Encrypt needs a domain name." : undefined}
              value={domain}
              onChange={(event) => {
                setDomain(event.target.value)
              }}
            />
          </Section>
          <Section id={`${id}-method`} title="Method" description="How Let's Encrypt checks that the name is yours.">
            <FieldSet className="gap-2.5">
              <FieldLegend className="sr-only">Method</FieldLegend>
              {methods.map((choice) => (
                <MethodCard
                  key={choice.value}
                  name={`${id}-method-choice`}
                  checked={method === choice.value}
                  icon={choice.icon}
                  title={kindNames[choice.value]}
                  description={choice.description}
                  onChoose={() => {
                    setMethod(choice.value)
                  }}
                />
              ))}
            </FieldSet>
            {cloudflare ? (
              <>
                <TextField
                  label="Cloudflare API token"
                  type="password"
                  dir="ltr"
                  autoComplete="off"
                  className="font-mono"
                  placeholder={view.cloudflareTokenSet ? 'A token is saved: leave empty to keep it' : 'paste token'}
                  description="Needs Zone:Read and DNS:Edit on the zone. Stored write-only."
                  value={token}
                  onChange={(event) => {
                    setToken(event.target.value)
                  }}
                />
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-expanded={guideOpen}
                    aria-controls={`${id}-guide`}
                    className="-ms-2.5 self-start"
                    onClick={() => {
                      setGuideOpen((was) => !was)
                    }}
                  >
                    <ChevronDownIcon
                      aria-hidden
                      className={cn('transition-transform duration-(--dur-fast)', guideOpen && 'rotate-180')}
                    />
                    How to create a Cloudflare API token
                  </Button>
                  <div
                    id={`${id}-guide`}
                    hidden={!guideOpen}
                    className="rounded-xl border bg-surface p-4 max-[760px]:p-3.5"
                  >
                    <CloudflareTokenGuide />
                  </div>
                </div>
              </>
            ) : null}
          </Section>
        </>
      )}
      {sent !== undefined || sending ? (
        <Section id={`${id}-result`} title="Result">
          {running ? (
            <div role="status" className="flex items-start gap-2">
              <LoaderCircleIcon
                aria-hidden
                className="mt-0.5 size-4 shrink-0 animate-spin text-brand motion-reduce:animate-none"
              />
              <div className="grid gap-0.5">
                <p className="text-callout font-semibold">Requesting the certificate</p>
                <p className="text-subhead text-fg-2">
                  Let&apos;s Encrypt checks the name now. This can take a few minutes.
                </p>
              </div>
            </div>
          ) : issued ? (
            <Alert variant="ok" role="status">
              <CircleCheckIcon aria-hidden />
              <AlertTitle className="[overflow-wrap:anywhere]">
                Certificate issued for {sent}. Auto-renewal is on.
              </AlertTitle>
            </Alert>
          ) : (
            <Alert variant="destructive" role="alert">
              <CircleAlertIcon aria-hidden />
              <AlertTitle className="font-semibold">The certificate was not issued</AlertTitle>
              <AlertDescription className="grid gap-1">
                {reason ? <p className="[overflow-wrap:anywhere]">{reason}</p> : null}
                <p>Fix the cause, then issue it again.</p>
              </AlertDescription>
            </Alert>
          )}
          {refusal === undefined && !sending ? <LogList entries={live.log} /> : null}
        </Section>
      ) : null}
      <DialogFooter>
        {issued ? (
          <Button type="button" onClick={onDone}>
            Done
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={onDone}>
              Cancel
            </Button>
            <Button type="submit" disabled={missing || running}>
              {running ? 'Requesting...' : 'Issue certificate'}
            </Button>
          </>
        )}
      </DialogFooter>
      {confirm.dialog}
    </form>
  )
}

/** One section of the window: its heading, an optional line under it, and its fields. */
function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 border-t pt-4">
      <div className="grid gap-0.5">
        <h3 id={id} className="text-callout font-semibold">
          {title}
        </h3>
        {description ? <p className="text-subhead text-fg-2">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

/**
 * A method as xmtp-panel's choice card: a radio button with its icon, name and words (also
 * Maintenance > Uninstall xDesign's two choices).
 */
export function MethodCard({
  name,
  checked,
  icon: Icon,
  title,
  description,
  onChoose,
}: {
  name: string
  checked: boolean
  icon: LucideIcon
  title: string
  description: string
  onChoose: () => void
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-[border-color,background-color] duration-(--dur-fast) ease-(--ease) has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-solid',
        checked ? 'border-brand bg-brand-weak' : 'hover:border-border-strong',
      )}
    >
      <input type="radio" name={name} checked={checked} className="sr-only" onChange={onChoose} />
      <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', checked ? 'text-brand' : 'text-fg-3')} />
      <span className="grid gap-0.5">
        <span className={cn('text-callout font-semibold', checked && 'text-brand')}>{title}</span>
        <span className="text-subhead text-fg-2">{description}</span>
      </span>
    </label>
  )
}

/** The log of the last (or running) issuance, newest last. */
export function LogList({ entries }: { entries: HttpsView['log'] }) {
  if (entries.length === 0) return null
  return (
    <ul aria-label="The log of the certificate" className="flex flex-col gap-1 rounded-xl border px-3 py-2">
      {entries.map((entry, index) => (
        <li key={`${String(entry.at)}-${String(index)}`} className="text-footnote [overflow-wrap:anywhere]">
          {entry.at ? <span className="text-fg-3">{formatDateTime(entry.at)} </span> : null}
          <span className={entry.level === 'error' ? 'text-error' : 'text-fg-2'}>{entry.text}</span>
        </li>
      ))}
    </ul>
  )
}

const apiTokensUrl = 'https://dash.cloudflare.com/profile/api-tokens'

/** A label as Cloudflare's dashboard shows it. */
function UI({ children }: { children: ReactNode }) {
  return (
    <strong className="font-semibold text-foreground">
      <bdi>{children}</bdi>
    </strong>
  )
}

/** Machine text (a name, a command): always left to right. */
function Code({ children }: { children: ReactNode }) {
  return (
    <code
      dir="ltr"
      className="rounded-[5px] border bg-surface-2 px-1 py-px font-mono text-footnote [overflow-wrap:anywhere] text-foreground"
    >
      {children}
    </code>
  )
}

/** xmtp-panel's steps to create the token (components/CloudflareTokenHelp.tsx), without its Radar row. */
function CloudflareTokenGuide() {
  return (
    <div className="flex min-w-0 flex-col gap-4 text-subhead text-fg-2">
      <p className="rounded-lg border bg-surface-2 p-3">
        <span className="font-semibold text-foreground">Before you start: </span>
        the domain must be added to Cloudflare and show <UI>Active</UI> (its nameservers point to Cloudflare).
      </p>
      <ol className="flex list-decimal flex-col gap-2 ps-5 marker:font-semibold marker:text-fg-3">
        <li>
          Open{' '}
          <a
            href={apiTokensUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-brand underline underline-offset-2"
          >
            dash.cloudflare.com/profile/api-tokens
          </a>{' '}
          (or click the profile icon at the top right, then <UI>API Tokens</UI>).
        </li>
        <li>
          Click <UI>Create Token</UI>.
        </li>
        <li>
          Find the <UI>Edit zone DNS</UI> template and click <UI>Use template</UI>.
        </li>
        <li>
          Token name: enter something you will recognize, for example <Code>xDesign DNS-01</Code>.
        </li>
        <li>
          Permissions: keep the first row as <UI>Zone | DNS | Edit</UI>.
        </li>
        <li>
          Click <UI>+ Add more</UI> and set the new row to <UI>Zone | Zone | Read</UI>.
        </li>
        <li>
          Zone Resources: choose <UI>Include | Specific zone | your domain</UI> (for example <Code>example.com</Code>).
          Pick <UI>All zones</UI> only if you want one token for every domain in this account.
        </li>
        <li>
          Client IP Address Filtering: leave it empty. If you add a rule, include this server&apos;s public IPv4 and
          IPv6 addresses, or Cloudflare will refuse xDesign.
        </li>
        <li>TTL: leave it empty so the token never expires. An expired token stops automatic renewals.</li>
        <li>
          Click <UI>Continue to summary</UI> and check that it lists your domain with <UI>DNS:Edit</UI> and{' '}
          <UI>Zone:Read</UI>.
        </li>
        <li>
          Click <UI>Create Token</UI>, then copy the token. Cloudflare shows it only once.
        </li>
        <li>Paste the token here. xDesign keeps it on the server and reuses it for the renewals.</li>
      </ol>
      <section className="flex flex-col gap-2">
        <h4 className="font-semibold text-foreground">Good to know</h4>
        <ul className="flex list-disc flex-col gap-1.5 ps-5 marker:text-fg-3">
          <li>
            Use an <UI>API Token</UI>. The Global API Key (under <UI>API Keys</UI> on the same page) and the Origin CA
            Key do not work here.
          </li>
          <li>
            Lost the token? On the API Tokens page click the three dots next to it, then <UI>Roll</UI>, and paste the
            new value here.
          </li>
          <li>
            Wildcard certificates (<Code>*.example.com</Code>) can only be issued with DNS-01, so they always need this
            token.
          </li>
        </ul>
      </section>
    </div>
  )
}
