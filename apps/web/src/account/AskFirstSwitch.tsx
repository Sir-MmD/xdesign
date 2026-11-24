import { type ClaudeConnectionKind, routes } from '@xdesign/api'
import { useId } from 'react'
import { toast } from 'sonner'

import { useRefreshConnections } from '@/account/askFirst'
import { useApiMutation } from '@/api/client'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

// The switch "Ask first" of a key or (MCP-03b) a connected app (docs/plan/17 sections 13.4 and
// 13.6, MCP-01b), as the Account page's "Claude" card and Settings' "Claude connections" show it:
// on (the default), Claude asks the person before an action that cannot be undone; off, those run
// at once. Only the site owner turns it on or off, for anyone's key or app; others see its state,
// greyed, with "Only the site owner can turn this off." (their list's note, askFirstOwnerOnly,
// which `describedBy` names).

export function AskFirstSwitch({
  kind,
  id: connectionId,
  name,
  askFirst,
  owner,
  describedBy,
}: {
  kind: ClaudeConnectionKind
  /** The key's or app's ID, and its name. */
  id: string
  name: string
  askFirst: boolean
  /** The signed-in person is the site owner, who alone changes it. */
  owner: boolean
  describedBy?: string
}) {
  const id = useId()
  const refresh = useRefreshConnections()
  const update = useApiMutation(routes.updateClaudeConnection, {
    onSuccess: () => {
      void refresh()
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
  // The new state shows at once, while it is saved.
  const checked = update.isPending ? (update.variables.body.askFirst ?? askFirst) : askFirst
  return (
    <div className="flex items-center gap-2">
      <Switch
        id={id}
        size="sm"
        checked={checked}
        disabled={!owner || update.isPending}
        aria-label={`Ask first for ${name}`}
        aria-describedby={owner ? undefined : describedBy}
        onCheckedChange={(on: boolean) => {
          update.mutate({ params: { kind, id: connectionId }, body: { askFirst: on } })
        }}
      />
      <Label htmlFor={id}>Ask first</Label>
    </div>
  )
}
