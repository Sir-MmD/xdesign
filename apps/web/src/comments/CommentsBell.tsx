import { useNavigate } from '@tanstack/react-router'
import { AtSignIcon, BellIcon } from 'lucide-react'
import { useState } from 'react'

import { PersonAvatar } from '@/components/PersonAvatar'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { formatDateTime, timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'

import { useUnread } from './unread'

/**
 * The bell (docs/plan/04 section 15, 05 section 6), in the site's top bar and the editor's: the
 * count of unread comments in the designs the person can open (marked when some mention them),
 * and a list of them, newest first, each with its design, its author and "Mentions you". A
 * comment's click opens its design with the Comments panel on its thread. No emails.
 */
export function CommentsBell() {
  const unread = useUnread()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const designs = unread.data?.designs ?? []
  const comments = unread.data?.comments ?? []
  const count = designs.reduce((sum, design) => sum + design.unread, 0)
  const mentions = designs.reduce((sum, design) => sum + design.mentions, 0)
  const label =
    count === 0
      ? 'Comments, none unread'
      : `Comments, ${String(count)} unread${mentions > 0 ? `, ${String(mentions)} mentioning you` : ''}`
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon" className="relative rounded-full" aria-label={label} />}
      >
        <BellIcon aria-hidden />
        {count > 0 ? (
          <span
            aria-hidden
            className={cn(
              'absolute -end-0.5 -top-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center gap-0.5 rounded-full px-1 text-caption-2 leading-none font-semibold text-on-brand tabular-nums',
              mentions > 0 ? 'bg-error' : 'bg-brand-strong',
            )}
          >
            {mentions > 0 ? <AtSignIcon className="size-2.5" /> : null}
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="flex w-88 max-w-[calc(100vw-2rem)] flex-col gap-3 p-3">
        <PopoverTitle className="px-1">Unread comments</PopoverTitle>
        {comments.length === 0 ? (
          <p className="px-1 pb-1 text-subhead text-fg-3">{unread.isError ? unread.error.message : 'Nothing new.'}</p>
        ) : (
          <ul className="-mx-1 flex max-h-[60dvh] flex-col gap-0.5 overflow-y-auto">
            {comments.map((comment) => {
              const author = comment.author?.name ?? 'A removed member'
              return (
                <li key={comment.id}>
                  <button
                    type="button"
                    className="flex w-full gap-2 rounded-lg px-2 py-2 text-start outline-none hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-solid"
                    onClick={() => {
                      setOpen(false)
                      void navigate({
                        to: '/d/$id',
                        params: { id: comment.design.id },
                        search: { comment: comment.threadId },
                      })
                    }}
                  >
                    <PersonAvatar name={author} color={comment.author?.color ?? 'var(--color-fg-3)'} size="sm" />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex min-w-0 items-center gap-1.5 text-footnote text-fg-2">
                        <span className="truncate">
                          <span className="font-semibold text-foreground">{author}</span> in{' '}
                          <span dir="auto">{comment.design.name}</span>
                        </span>
                        <time
                          dateTime={new Date(comment.createdAt).toISOString()}
                          title={formatDateTime(comment.createdAt)}
                          className="ms-auto shrink-0 text-fg-3"
                        >
                          {timeAgo(comment.createdAt)}
                        </time>
                      </span>
                      <span dir="auto" className="line-clamp-2 text-subhead break-words">
                        {comment.body}
                      </span>
                      {comment.mentionsYou ? (
                        <span className="flex items-center gap-1 text-caption font-semibold text-brand">
                          <AtSignIcon aria-hidden className="size-3" />
                          Mentions you
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
