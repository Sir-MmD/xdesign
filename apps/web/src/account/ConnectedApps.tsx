import { type ClaudeApp, routes } from '@xdesign/api'
import { AppWindowIcon, TriangleAlertIcon } from 'lucide-react'
import { useId, useState } from 'react'

import { askFirstOwnerOnly, disconnectText, useRefreshConnections } from '@/account/askFirst'
import { AskFirstSwitch } from '@/account/AskFirstSwitch'
import { call, useApi } from '@/api/client'
import { useMe } from '@/app/session'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormProblem } from '@/components/forms'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  ListGroup,
  ListGroupFooter,
  ListGroupItem,
  ListGroupMedia,
  ListGroupRows,
  ListGroupText,
} from '@/components/ui/grouped-list'
import { Skeleton } from '@/components/ui/skeleton'
import { siteUrl } from '@/lib/base'
import { formatDate, timeAgo } from '@/lib/time'
import { useLast } from '@/lib/useLast'
import { CodeLine } from '@/maintenance/parts'

// The Account page's "Connected apps" (docs/plan/17 sections 13.5 and 13.6, MCP-03b), from
// xWriter's features/api-settings/mcp/McpApps.tsx: the Claude app and claude.ai once the person
// allowed them on the "Allow" page (routes/allow-app.tsx), each with "Connected <date> · Last used
// <date>", its "Ask first" switch, which only the site owner changes, and "Disconnect", asked
// first; then "Add xDesign to the Claude app" with the MCP address to copy, and the note that the
// Claude app cannot trust the site's built-in certificate.

/** "Connected Nov 23, 2026 · Last used 5 minutes ago". */
function appUse(app: Pick<ClaudeApp, 'createdAt' | 'lastUsedAt'>): string {
  const used = app.lastUsedAt === null ? 'Not used yet' : `Last used ${timeAgo(app.lastUsedAt)}`
  return `Connected ${formatDate(app.createdAt)} · ${used}`
}

export function ConnectedApps() {
  const me = useMe()
  const headingId = useId()
  const ownerOnlyId = useId()
  const list = useApi(routes.claudeApps)
  const refresh = useRefreshConnections()
  // The app whose "Disconnect" asks.
  const [leaving, setLeaving] = useState<ClaudeApp>()
  const shownLeaving = useLast(leaving)
  const apps = list.data?.apps ?? []
  const mcpUrl = siteUrl('/mcp')

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4 border-t pt-5">
      <h3 id={headingId} className="text-callout font-semibold">
        Connected apps
      </h3>
      {list.isPending ? (
        <div role="status" aria-label="Loading the connected apps">
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      ) : list.isError ? (
        <FormProblem message={list.error.message} />
      ) : apps.length === 0 ? null : (
        <ListGroup>
          <ListGroupRows>
            {apps.map((app) => (
              <ListGroupItem key={app.id}>
                <ListGroupMedia className="bg-surface-2 text-fg-2">
                  <AppWindowIcon aria-hidden />
                </ListGroupMedia>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-1">
                  <ListGroupText title={<span dir="auto">{app.name}</span>} description={appUse(app)} />
                  <AskFirstSwitch
                    kind="app"
                    id={app.id}
                    name={app.name}
                    askFirst={app.askFirst}
                    owner={me.isSiteOwner}
                    describedBy={ownerOnlyId}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLeaving(app)
                  }}
                >
                  Disconnect
                </Button>
              </ListGroupItem>
            ))}
          </ListGroupRows>
          {me.isSiteOwner ? null : <ListGroupFooter id={ownerOnlyId}>{askFirstOwnerOnly}</ListGroupFooter>}
        </ListGroup>
      )}
      <div className="flex flex-col gap-1.5">
        <p className="text-subhead text-fg-2">Add xDesign to the Claude app</p>
        <CodeLine code={mcpUrl} label="Copy the address" />
        <p className="text-footnote text-fg-3">
          In the Claude app or claude.ai, add a custom connector with this address, then allow it on the page xDesign
          opens.
        </p>
      </div>
      {list.data?.builtInCertificate === true ? (
        <Alert variant="warn" role="note">
          <TriangleAlertIcon aria-hidden />
          <AlertDescription>
            The Claude app needs a certificate browsers trust: choose Let&apos;s Encrypt in Settings &gt; HTTPS.
          </AlertDescription>
        </Alert>
      ) : null}
      <ConfirmDialog
        open={leaving !== undefined}
        onOpenChange={(open) => {
          if (!open) setLeaving(undefined)
        }}
        title={`Disconnect ${shownLeaving?.name ?? ''}?`}
        description={disconnectText}
        confirmLabel="Disconnect"
        onConfirm={async () => {
          if (!leaving) return
          await call(routes.disconnectClaudeApp, { params: { appId: leaving.id } })
          await refresh()
        }}
      />
    </section>
  )
}
