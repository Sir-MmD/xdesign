import { type MaintenanceResult, routes } from '@xdesign/api'
import { CircleAlertIcon, InfoIcon, TriangleAlertIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { useApi } from '@/api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBytes, formatDuration } from '@/lib/format'
import { formatDate, formatDateTime } from '@/lib/time'
import { helperRetry } from '@/maintenance/follow'
import { CodeLine, HelperProblem, Loading } from '@/maintenance/parts'

// Maintenance's status (docs/plan/07 section 8): the version, how long xDesign runs, the address
// and HTTPS mode, the database and media sizes, the free disk and the certificate's expiry, from
// the helper's GET /status; and how the last request of the maintenance helper ended when it
// failed in the last day and this tab did not follow it.

const modeNames: Readonly<Record<string, string>> = {
  port: 'xDesign serves HTTPS itself on its own port',
  dev: 'Development (xdesign serve --dev)',
}

const httpsMethodNames: Readonly<Record<string, string>> = {
  letsencrypt_http: "Let's Encrypt (port 80)",
  letsencrypt_cloudflare: "Let's Encrypt through Cloudflare DNS",
  file: 'Certificate files on this server',
  uploaded: 'A pasted certificate',
  builtin: 'Built-in self-signed certificate',
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="shrink-0 text-subhead text-fg-2 sm:w-36">{label}</dt>
      <dd className="min-w-0 text-callout [overflow-wrap:anywhere]">{children}</dd>
    </div>
  )
}

const dayMs = 24 * 60 * 60 * 1000

export function StatusCard({
  last,
  followedId,
}: {
  last: MaintenanceResult | null | undefined
  followedId: string | undefined
}) {
  const status = useApi(routes.serverStatus, undefined, { retry: helperRetry })
  const server = status.data?.server
  // A failure of the last day (before the status was read) that this tab does not show in its
  // own tracker.
  const failure =
    last && last.id !== followedId && (!last.ok || last.rolledBack) && last.at && last.at > status.dataUpdatedAt - dayMs
      ? last
      : undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>This server</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {status.isPending ? (
          <Loading label="Loading the status" />
        ) : status.isError ? (
          <HelperProblem error={status.error} />
        ) : (
          <>
            <dl className="flex flex-col gap-2">
              <Fact label="Version">xDesign {server?.version ?? status.data.version}</Fact>
              {server ? (
                <>
                  <Fact label="Running for">{formatDuration(server.uptimeSeconds)}</Fact>
                  <Fact label="Address">
                    <span dir="ltr">{server.address}</span>
                  </Fact>
                  <Fact label="HTTPS">
                    {[
                      modeNames[server.mode] ?? server.mode,
                      server.https.method ? (httpsMethodNames[server.https.method] ?? server.https.method) : null,
                      server.https.expiresAt ? `valid until ${formatDate(server.https.expiresAt)}` : null,
                    ]
                      .filter((part) => part !== null)
                      .join(', ')}
                  </Fact>
                  {server.storage ? (
                    <>
                      <Fact label="Database">{formatBytes(server.storage.databaseBytes)}</Fact>
                      <Fact label="Media">
                        {formatBytes(server.storage.mediaBytes)} in {server.storage.mediaFiles.toLocaleString()}{' '}
                        {server.storage.mediaFiles === 1 ? 'file' : 'files'}
                      </Fact>
                      <Fact label="Free disk">{formatBytes(server.storage.freeBytes)}</Fact>
                    </>
                  ) : null}
                </>
              ) : null}
            </dl>
            {status.data.problem ? (
              <Alert role="status">
                <InfoIcon aria-hidden />
                <AlertTitle className="font-semibold">{status.data.problem}</AlertTitle>
              </Alert>
            ) : null}
            {server?.https.lastProblem ? (
              <Alert variant="destructive">
                <CircleAlertIcon aria-hidden />
                <AlertTitle>HTTPS: {server.https.lastProblem}</AlertTitle>
                <AlertDescription>Settings &gt; HTTPS shows more and has &quot;Try now&quot;.</AlertDescription>
              </Alert>
            ) : null}
            {server?.storage?.problem ? (
              <Alert variant="warn">
                <TriangleAlertIcon aria-hidden />
                <AlertTitle className="font-semibold">{server.storage.problem}</AlertTitle>
              </Alert>
            ) : null}
          </>
        )}
        {failure ? (
          <Alert variant="warn" role="status">
            <TriangleAlertIcon aria-hidden />
            <AlertTitle>
              {failure.rolledBack ? 'The last update went back by itself' : 'The last request failed'}
              {failure.at ? ` (${formatDateTime(failure.at)})` : ''}
            </AlertTitle>
            <AlertDescription className="grid gap-1.5">
              <p>{failure.message}</p>
              {failure.failureLog ? <CodeLine code={failure.failureLog} label="Copy the path" /> : null}
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  )
}
