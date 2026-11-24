import { type ClaudeConnection, routes } from '@xdesign/api'
import { AppWindowIcon, KeyRoundIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { disconnectText, useRefreshConnections } from '@/account/askFirst'
import { AskFirstSwitch } from '@/account/AskFirstSwitch'
import { call, useApi, useApiMutation } from '@/api/client'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormProblem } from '@/components/forms'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ListGroup, ListGroupItem, ListGroupMedia, ListGroupRows, ListGroupText } from '@/components/ui/grouped-list'
import { Skeleton } from '@/components/ui/skeleton'
import { timeAgo } from '@/lib/time'
import { useLast } from '@/lib/useLast'

// Settings > Claude connections (docs/plan/17 section 13.6, MCP-01b), for the site owner: every
// person's API keys and (MCP-03b) connected apps with the person, "Last used", the "Ask first"
// switch and "Revoke", or for an app "Disconnect", asked first. A key or app whose app answered a
// question with a No in under 3 seconds says "Can't show questions": "Ask in the chat again" lets
// Claude's app ask once more.
export function ClaudeCard() {
  const list = useApi(routes.claudeConnections)
  const refresh = useRefreshConnections()
  const onError = (error: Error) => {
    toast.error(error.message)
  }
  const update = useApiMutation(routes.updateClaudeConnection, {
    onSuccess: () => {
      void refresh()
    },
    onError,
  })
  const revoke = useApiMutation(routes.revokeClaudeConnection, {
    onSuccess: () => {
      void refresh()
    },
    onError,
  })
  const connections = list.data?.connections ?? []
  // The app whose "Disconnect" asks.
  const [leaving, setLeaving] = useState<ClaudeConnection>()
  const shownLeaving = useLast(leaving)

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Claude connections</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {list.isPending ? (
          <div role="status" aria-label="Loading the Claude connections">
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        ) : list.isError ? (
          <FormProblem message={list.error.message} />
        ) : connections.length === 0 ? (
          <p className="text-subhead text-fg-2">No API keys or connected apps yet.</p>
        ) : (
          <ListGroup>
            <ListGroupRows>
              {connections.map((connection) => {
                const params = { kind: connection.kind, id: connection.id }
                const revoking = revoke.isPending && revoke.variables.params.id === connection.id
                const clearing =
                  update.isPending &&
                  update.variables.params.id === connection.id &&
                  update.variables.body.cannotAsk === false
                const used =
                  connection.lastUsedAt === null ? 'Not used yet' : `Last used ${timeAgo(connection.lastUsedAt)}`
                return (
                  <ListGroupItem key={`${connection.kind}:${connection.id}`}>
                    <ListGroupMedia className="bg-surface-2 text-fg-2">
                      {connection.kind === 'app' ? <AppWindowIcon aria-hidden /> : <KeyRoundIcon aria-hidden />}
                    </ListGroupMedia>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-1">
                      <ListGroupText
                        title={<span dir="auto">{connection.name}</span>}
                        description={
                          <>
                            {connection.kind === 'app' ? 'Connected app · ' : 'API key · '}
                            <span dir="auto">{connection.person.name}</span>
                            {` · ${used}`}
                            {connection.cannotAsk ? " · Can't show questions" : null}
                          </>
                        }
                      />
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <AskFirstSwitch
                          kind={connection.kind}
                          id={connection.id}
                          name={connection.name}
                          askFirst={connection.askFirst}
                          owner
                        />
                        {connection.cannotAsk ? (
                          <Button
                            variant="link"
                            size="sm"
                            className="px-0"
                            disabled={clearing}
                            pending={clearing}
                            onClick={() => {
                              update.mutate({ params, body: { cannotAsk: false } })
                            }}
                          >
                            Ask in the chat again
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    {connection.kind === 'app' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setLeaving(connection)
                        }}
                      >
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={revoking}
                        pending={revoking}
                        onClick={() => {
                          revoke.mutate({ params })
                        }}
                      >
                        Revoke
                      </Button>
                    )}
                  </ListGroupItem>
                )
              })}
            </ListGroupRows>
          </ListGroup>
        )}
        <ConfirmDialog
          open={leaving !== undefined}
          onOpenChange={(open) => {
            if (!open) setLeaving(undefined)
          }}
          title={`Disconnect ${shownLeaving?.name ?? ''} of ${shownLeaving?.person.name ?? ''}?`}
          description={disconnectText}
          confirmLabel="Disconnect"
          onConfirm={async () => {
            if (!leaving) return
            await call(routes.revokeClaudeConnection, { params: { kind: 'app', id: leaving.id } })
            await refresh()
          }}
        />
      </CardContent>
    </Card>
  )
}
