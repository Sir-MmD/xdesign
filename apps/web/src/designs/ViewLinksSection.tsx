import { useQueryClient } from '@tanstack/react-query'
import { routes, type ViewLinkExpiry } from '@xdesign/api'
import { useId, useState } from 'react'
import { toast } from 'sonner'

import { useApi, useApiMutation } from '@/api/client'
import { FormProblem } from '@/components/forms'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatDateTime, timeAgo } from '@/lib/time'
import { ShownLink } from '@/members/ShownLink'

const expiryItems: { value: ViewLinkExpiry; label: string }[] = [
  { value: '1d', label: '1 day' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'never', label: 'Never expires' },
]

function failed(error: { message: string }) {
  toast.error(error.message)
}

function When({ time, children }: { time: number; children: string }) {
  return (
    <time dateTime={new Date(time).toISOString()} title={formatDateTime(time)}>
      {children}
    </time>
  )
}

/**
 * "View-only link" in the Share dialog (docs/plan/05 sections 3 and 8): "Create link" with an
 * optional expiry (1 day, 7 days, 30 days, never) shows the link once with "Copy"; the links that
 * still work are listed with their creation date, expiry and last use, each with "Revoke".
 */
export function ViewLinksSection({ designId }: { designId: string }) {
  const headingId = useId()
  const queryClient = useQueryClient()
  const list = useApi(routes.viewLinks, { params: { id: designId } })
  const refresh = () => queryClient.invalidateQueries({ queryKey: [routes.viewLinks.key] })
  const [expires, setExpires] = useState<ViewLinkExpiry>('never')
  // The link just made, shown until the dialog closes or it is revoked.
  const [made, setMade] = useState<{ id: string; url: string }>()
  const create = useApiMutation(routes.createViewLink, {
    onSuccess: ({ link, url }) => {
      setMade({ id: link.id, url })
      void refresh()
    },
    onError: failed,
  })
  const revoke = useApiMutation(routes.revokeViewLink, {
    onSuccess: (_answer, { params }) => {
      if (made?.id === params.linkId) setMade(undefined)
      void refresh()
    },
    onError: failed,
  })
  const links = list.data?.links ?? []

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className="text-callout font-semibold">
        View-only link
      </h3>
      <p className="text-footnote text-fg-3">
        Anyone with the link sees the map and the phone and can try the bot, without an account.
      </p>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (!create.isPending) create.mutate({ params: { id: designId }, body: { expires } })
        }}
      >
        <Select
          items={expiryItems}
          value={expires}
          onValueChange={(next) => {
            if (next !== null) setExpires(next)
          }}
        >
          <SelectTrigger aria-label="Expires">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {expiryItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" variant="outline" disabled={create.isPending} pending={create.isPending}>
          Create link
        </Button>
      </form>
      {made ? (
        <div className="flex flex-col gap-1">
          <ShownLink link={made.url} label="View-only link" />
          <p className="text-footnote text-fg-3">The link is shown only now.</p>
        </div>
      ) : null}
      {list.isPending ? (
        <div role="status" aria-label="Loading the view-only links">
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      ) : list.isError ? (
        <FormProblem message={list.error.message} />
      ) : links.length === 0 ? null : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {links.map((link) => {
            const busy = revoke.isPending && revoke.variables.params.linkId === link.id
            return (
              <li key={link.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-callout">
                    <When time={link.createdAt}>{`Made ${timeAgo(link.createdAt)}`}</When>
                  </span>
                  <span className="text-footnote text-fg-3">
                    {link.expiresAt === null ? (
                      'Never expires'
                    ) : (
                      <When time={link.expiresAt}>{`Valid until ${formatDate(link.expiresAt)}`}</When>
                    )}
                    {' · '}
                    {link.lastUsedAt === null ? (
                      'Not used yet'
                    ) : (
                      <When time={link.lastUsedAt}>{`Last used ${timeAgo(link.lastUsedAt)}`}</When>
                    )}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  pending={busy}
                  onClick={() => {
                    revoke.mutate({ params: { id: designId, linkId: link.id } })
                  }}
                >
                  Revoke
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
