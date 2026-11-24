import { useQueryClient } from '@tanstack/react-query'
import { type claudeLinkUrls, routes } from '@xdesign/api'
import { useId, useState } from 'react'
import { toast } from 'sonner'
import type { z } from 'zod'

import { useApi, useApiMutation } from '@/api/client'
import { FormProblem } from '@/components/forms'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime, timeAgo } from '@/lib/time'
import { ShownLink } from '@/members/ShownLink'

type LinkUrls = z.output<typeof claudeLinkUrls>

const files: { key: keyof LinkUrls; label: string }[] = [
  { key: 'spec', label: 'spec.json' },
  { key: 'doc', label: 'design.md' },
  { key: 'howToRead', label: 'HOW-TO-READ.md' },
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
 * "Claude link" in the Share dialog (docs/plan/06 section 7.1, CL-01's routes): "Create link"
 * shows the link's spec.json, design.md and HOW-TO-READ.md addresses once, each with "Copy"; the
 * links that work are listed with who made them, when, and their last use, each with "Revoke".
 */
export function ClaudeLinksSection({ designId }: { designId: string }) {
  const headingId = useId()
  const queryClient = useQueryClient()
  const list = useApi(routes.claudeLinks, { params: { id: designId } })
  const refresh = () => queryClient.invalidateQueries({ queryKey: [routes.claudeLinks.key] })
  // The link just made, shown until the dialog closes or it is revoked.
  const [made, setMade] = useState<{ id: string; urls: LinkUrls }>()
  const create = useApiMutation(routes.createClaudeLink, {
    onSuccess: ({ link, urls }) => {
      setMade({ id: link.id, urls })
      void refresh()
    },
    onError: failed,
  })
  const revoke = useApiMutation(routes.revokeClaudeLink, {
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
        Claude link
      </h3>
      <p className="text-footnote break-words text-fg-3">
        {`Anyone with this link can read this design. Give it to a developer or to Claude: 'Build the bot described at ${made?.urls.spec ?? '<link>'}'.`}
      </p>
      <Button
        variant="outline"
        className="self-start"
        disabled={create.isPending}
        pending={create.isPending}
        onClick={() => {
          create.mutate({ params: { id: designId } })
        }}
      >
        Create link
      </Button>
      {made ? (
        <div className="flex flex-col gap-2">
          {files.map((file) => (
            <div key={file.key} className="flex flex-col gap-1">
              <span className="font-mono text-footnote text-fg-2">{file.label}</span>
              <ShownLink link={made.urls[file.key]} label={`Claude link to ${file.label}`} />
            </div>
          ))}
          <p className="text-footnote text-fg-3">
            The link is shown only now. Add <code className="font-mono">?version=&lt;name or id&gt;</code> for a
            version, <code className="font-mono">?languages=en,fa</code> for some languages.
          </p>
        </div>
      ) : null}
      {list.isPending ? (
        <div role="status" aria-label="Loading the Claude links">
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
                    {link.createdBy ? ` by ${link.createdBy.name}` : null}
                  </span>
                  <span className="text-footnote text-fg-3">
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
