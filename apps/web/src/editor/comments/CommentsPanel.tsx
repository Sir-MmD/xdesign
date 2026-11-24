import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { type comment as commentSchema, hasRole, routes } from '@xdesign/api'
import { EllipsisIcon, MessageSquareIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { z } from 'zod'

import { apiKey, useApiMutation } from '@/api/client'
import { useMe } from '@/app/session'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { PersonAvatar } from '@/components/PersonAvatar'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDateTime, timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'

import { useDesign, useEditor, useLang } from '../context'
import { useSelectionStore } from '../selection'
import { anchorWords } from './anchors'
import { CommentInput } from './CommentInput'
import { PinDot } from './Pins'
import {
  type CommentDraft,
  emptyDraft,
  mentionIds,
  type Pin,
  type Thread,
  useCanComment,
  useCommentStore,
  useComments,
  usePins,
  useThreads,
} from './store'

type Comment = z.output<typeof commentSchema>

/** The element ID of a thread in the panel, to bring it into view. */
const threadElement = (id: string) => `comment-thread-${id}`

/**
 * The "Comments" panel (docs/plan/04 section 15, 05 section 6), the editor's right sheet: the box
 * of a new thread when comment mode or a box menu started one, then "Open" and "Resolved", each
 * thread with its comments. Opening it marks the design's comments read (the bell's count).
 */
export function CommentsPanel() {
  const store = useCommentStore()
  const open = useComments((state) => state.panel)
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        store.set(next ? { panel: true } : { panel: false, draft: null, focus: null })
      }}
    >
      <SheetContent className="flex flex-col data-[side=right]:sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Comments</SheetTitle>
        </SheetHeader>
        <CommentsList />
      </SheetContent>
    </Sheet>
  )
}

/** Shows a failed call's message. */
const failed = (error: Error) => {
  toast.error(error.message)
}

/**
 * The threads under "Open" (numbered as their pins) and "Resolved", newest first. A thread's
 * place, when its step is still there, closes the panel and selects the step or button on the
 * Map (in the text's language). Commenter and above reply, resolve and reopen; a comment's author
 * edits and deletes it, the design owner deletes any.
 */
function CommentsList() {
  const design = useDesign()
  const { designId } = useEditor()
  const store = useCommentStore()
  const selection = useSelectionStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const draft = useComments((state) => state.draft)
  const focus = useComments((state) => state.focus)
  const threads = useThreads()
  const { all } = usePins()
  const [tab, setTab] = useState<'open' | 'resolved'>('open')
  const list = threads.data?.threads ?? []
  const open = list.filter((thread) => thread.resolvedAt === null)
  const resolved = list.filter((thread) => thread.resolvedAt !== null)

  // A pin's or the bell's thread: its tab, then (below) into view.
  const [focused, setFocused] = useState<number>()
  const asked = focus ? list.find((thread) => thread.id === focus.id) : undefined
  if (focus && asked && focus.n !== focused) {
    setFocused(focus.n)
    setTab(asked.resolvedAt === null ? 'open' : 'resolved')
  }
  useEffect(() => {
    if (focused === undefined || !focus) return
    requestAnimationFrame(() => {
      document.getElementById(threadElement(focus.id))?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }, [focused, focus])

  // Read while the panel is open: marked read at each new reading.
  const { mutate: markRead } = useApiMutation(routes.markCommentsRead)
  const readAt = threads.dataUpdatedAt
  useEffect(() => {
    if (readAt === 0) return
    markRead(
      { params: { id: designId } },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: [routes.unreadComments.key] })
        },
      },
    )
  }, [readAt, designId, markRead, queryClient])

  const jump = (thread: Thread) => {
    const { anchor } = thread
    if (anchor.on === 'map' || !(anchor.stepId in design.steps)) return
    store.set({ panel: false, draft: null, focus: null })
    if (anchor.on === 'text') selection.set({ lang: anchor.lang })
    selection.reveal(
      anchor.stepId,
      anchor.on === 'button' && anchor.buttonId in design.buttons ? anchor.buttonId : null,
    )
    void navigate({ to: '/d/$id', params: { id: designId }, search: {}, replace: true })
  }

  const shown = tab === 'open' ? open : resolved
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {draft ? <NewThread key={JSON.stringify(draft)} /> : null}
      <div className="px-4">
        <Tabs
          value={tab}
          onValueChange={(value: 'open' | 'resolved') => {
            setTab(value)
          }}
        >
          <TabsList aria-label="Threads">
            <TabsTrigger value="open">Open {open.length > 0 ? <Count n={open.length} /> : null}</TabsTrigger>
            <TabsTrigger value="resolved">
              Resolved {resolved.length > 0 ? <Count n={resolved.length} /> : null}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4">
        {threads.isPending ? (
          <div role="status" aria-label="Loading the comments" className="flex flex-col gap-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        ) : threads.isError ? (
          <p className="text-subhead text-error">{threads.error.message}</p>
        ) : shown.length === 0 ? (
          <EmptyState icon={MessageSquareIcon} title={tab === 'open' ? 'No open comments' : 'No resolved comments'} />
        ) : (
          <ul className="flex flex-col gap-3">
            {shown.map((thread) => (
              <ThreadCard
                key={thread.id}
                thread={thread}
                pin={all.find((pin) => pin.id === thread.id)}
                focused={focus?.id === thread.id}
                onJump={() => {
                  jump(thread)
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Count({ n }: { n: number }) {
  return <span className="text-fg-3 tabular-nums">{n}</span>
}

/** Reads the design's threads again after a change (the live notice comes too, a moment later). */
function useReload(): () => void {
  const { designId } = useEditor()
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: apiKey(routes.comments, { params: { id: designId } }) })
  }
}

/** The box of a new thread at the top of the panel: where it goes, the text, "Cancel" and "Comment". */
function NewThread() {
  const design = useDesign()
  const lang = useLang()
  const { designId } = useEditor()
  const store = useCommentStore()
  const anchor = useComments((state) => state.draft)
  const reload = useReload()
  const [text, setText] = useState<CommentDraft>(emptyDraft)
  const start = useApiMutation(routes.startThread)
  if (!anchor) return null
  const send = () => {
    if (text.body.trim() === '' || start.isPending) return
    start.mutate(
      { params: { id: designId }, body: { anchor, body: text.body, mentions: mentionIds(text) } },
      {
        onSuccess: ({ thread }) => {
          reload()
          store.set({ draft: null })
          store.show(thread.id)
        },
        onError: failed,
      },
    )
  }
  return (
    <section
      aria-label="New comment"
      className="mx-4 flex flex-col gap-2 rounded-xl border border-brand bg-surface-2 p-3"
    >
      <p dir="auto" className="truncate text-footnote font-semibold text-fg-2">
        {anchorWords(design, anchor, lang).words}
      </p>
      <CommentInput
        draft={text}
        onChange={setText}
        onSend={send}
        label="Comment"
        placeholder="Write a comment. Type @ to mention someone."
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            store.set({ draft: null })
          }}
        >
          Cancel
        </Button>
        <Button size="sm" disabled={text.body.trim() === ''} pending={start.isPending} onClick={send}>
          Comment
        </Button>
      </div>
    </section>
  )
}

/**
 * A thread: its pin and place ("on a deleted step" with the old title once the step is gone), its
 * comments, "Resolved by" once resolved, then "Reply" and "Resolve" or "Reopen".
 */
function ThreadCard({
  thread,
  pin,
  focused,
  onJump,
}: {
  thread: Thread
  pin: Pin | undefined
  focused: boolean
  onJump: () => void
}) {
  const design = useDesign()
  const lang = useLang()
  const canComment = useCanComment()
  const { words, gone } = anchorWords(design, thread.anchor, lang)
  const canJump = !gone && thread.anchor.on !== 'map'
  return (
    <li
      id={threadElement(thread.id)}
      className={cn(
        'flex scroll-m-2 flex-col gap-3 rounded-xl border bg-surface-2 p-3',
        focused && 'border-brand',
        thread.resolvedAt !== null && 'opacity-80',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {pin ? <PinDot pin={pin} /> : null}
        {canJump ? (
          <button
            type="button"
            className="min-w-0 truncate rounded-sm text-start text-footnote font-semibold text-fg-2 outline-none hover:text-brand focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-solid"
            dir="auto"
            onClick={onJump}
          >
            {words}
          </button>
        ) : (
          <span dir="auto" className={cn('min-w-0 truncate text-footnote font-semibold text-fg-3', gone && 'italic')}>
            {words}
          </span>
        )}
      </div>
      <ul className="flex flex-col gap-3">
        {thread.comments.map((comment, index) => (
          <CommentItem key={comment.id} comment={comment} first={index === 0} />
        ))}
      </ul>
      {thread.resolvedAt !== null ? (
        <p className="text-footnote text-fg-3">
          Resolved{thread.resolvedBy ? ` by ${thread.resolvedBy.name}` : ''}{' '}
          <time dateTime={new Date(thread.resolvedAt).toISOString()} title={formatDateTime(thread.resolvedAt)}>
            {timeAgo(thread.resolvedAt)}
          </time>
        </p>
      ) : null}
      {canComment ? <ThreadActions thread={thread} /> : null}
    </li>
  )
}

/** "Reply" (a box for the reply), "Resolve" or "Reopen". */
function ThreadActions({ thread }: { thread: Thread }) {
  const { designId } = useEditor()
  const reload = useReload()
  const [replying, setReplying] = useState(false)
  const [text, setText] = useState<CommentDraft>(emptyDraft)
  const reply = useApiMutation(routes.replyToThread)
  const resolve = useApiMutation(routes.resolveThread)
  const reopen = useApiMutation(routes.reopenThread)
  const params = { id: designId, commentId: thread.id }
  const done = { onSuccess: reload, onError: failed }
  const send = () => {
    if (text.body.trim() === '' || reply.isPending) return
    reply.mutate(
      { params, body: { body: text.body, mentions: mentionIds(text) } },
      {
        onSuccess: () => {
          reload()
          setText(emptyDraft)
          setReplying(false)
        },
        onError: failed,
      },
    )
  }
  if (replying) {
    return (
      <div className="flex flex-col gap-2">
        <CommentInput draft={text} onChange={setText} onSend={send} label="Reply" autoFocus />
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setReplying(false)
            }}
          >
            Cancel
          </Button>
          <Button size="sm" disabled={text.body.trim() === ''} pending={reply.isPending} onClick={send}>
            Reply
          </Button>
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setReplying(true)
        }}
      >
        Reply
      </Button>
      {thread.resolvedAt === null ? (
        <Button
          variant="outline"
          size="sm"
          pending={resolve.isPending}
          onClick={() => {
            resolve.mutate({ params }, done)
          }}
        >
          Resolve
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          pending={reopen.isPending}
          onClick={() => {
            reopen.mutate({ params }, done)
          }}
        >
          Reopen
        </Button>
      )}
    </div>
  )
}

/**
 * One comment: its author (or "A removed member"), when, "(edited)", the text with its "@name"
 * mentions marked, and for its author "Edit" and "Delete" (the design owner deletes any).
 */
function CommentItem({ comment, first }: { comment: Comment; first: boolean }) {
  const me = useMe()
  const { designId, role } = useEditor()
  const canComment = useCanComment()
  const reload = useReload()
  const [editing, setEditing] = useState<CommentDraft | null>(null)
  const [deleting, setDeleting] = useState(false)
  const edit = useApiMutation(routes.editComment)
  const remove = useApiMutation(routes.deleteComment)
  const params = { id: designId, commentId: comment.id }
  const mine = comment.author?.id === me.id
  const canEdit = canComment && mine
  const canDelete = canComment && (mine || hasRole(role, 'owner'))
  const author = comment.author?.name ?? 'A removed member'

  const save = () => {
    if (!editing || editing.body.trim() === '' || edit.isPending) return
    edit.mutate(
      { params, body: { body: editing.body, mentions: mentionIds(editing) } },
      {
        onSuccess: () => {
          reload()
          setEditing(null)
        },
        onError: failed,
      },
    )
  }

  return (
    <li className="flex gap-2">
      <PersonAvatar name={author} color={comment.author?.color ?? 'var(--color-fg-3)'} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-subhead font-semibold">{author}</span>
          <time
            dateTime={new Date(comment.createdAt).toISOString()}
            title={formatDateTime(comment.createdAt)}
            className="shrink-0 text-footnote text-fg-3"
          >
            {timeAgo(comment.createdAt)}
          </time>
          {comment.editedAt !== null ? <span className="shrink-0 text-footnote text-fg-3">(edited)</span> : null}
          {(canEdit || canDelete) && !editing ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon-xs" className="ms-auto" aria-label="Comment menu" />}
              >
                <EllipsisIcon aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {canEdit ? (
                  <DropdownMenuItem
                    onClick={() => {
                      setEditing({ body: comment.body, mentions: comment.mentions })
                    }}
                  >
                    <PencilIcon aria-hidden />
                    Edit
                  </DropdownMenuItem>
                ) : null}
                {canDelete ? (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                      setDeleting(true)
                    }}
                  >
                    <Trash2Icon aria-hidden />
                    Delete
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
        {editing ? (
          <div className="flex flex-col gap-2">
            <CommentInput draft={editing} onChange={setEditing} onSend={save} label="Edit the comment" autoFocus />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(null)
                }}
              >
                Cancel
              </Button>
              <Button size="sm" disabled={editing.body.trim() === ''} pending={edit.isPending} onClick={save}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <p dir="auto" className="text-subhead break-words whitespace-pre-wrap">
            <Mentions body={comment.body} names={comment.mentions.map((person) => person.name)} />
          </p>
        )}
      </div>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={first ? 'Delete this thread?' : 'Delete this comment?'}
        description={first ? 'Its replies are deleted too.' : undefined}
        confirmLabel="Delete"
        destructive
        onConfirm={() => remove.mutateAsync({ params }).then(reload, failed)}
      />
    </li>
  )
}

/** A comment's text with each "@name" of its mentions marked. */
function Mentions({ body, names }: { body: string; names: readonly string[] }) {
  const marks = names.map((name) => `@${name}`).sort((a, b) => b.length - a.length)
  if (marks.length === 0) return body
  const parts: ReactNode[] = []
  let rest = body
  let key = 0
  while (rest !== '') {
    const found = marks
      .map((mark) => ({ mark, at: rest.indexOf(mark) }))
      .filter((hit) => hit.at >= 0)
      .sort((a, b) => a.at - b.at)[0]
    if (!found) {
      parts.push(rest)
      break
    }
    if (found.at > 0) parts.push(rest.slice(0, found.at))
    parts.push(
      <span key={key++} className="font-semibold text-brand">
        {found.mark}
      </span>,
    )
    rest = rest.slice(found.at + found.mark.length)
  }
  return parts
}
