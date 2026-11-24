import { Link } from '@tanstack/react-router'
import type { designCard, unreadDesign } from '@xdesign/api'
import {
  ArchiveRestoreIcon,
  CopyIcon,
  DownloadIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  ImageUpIcon,
  LayoutTemplateIcon,
  MessageSquareIcon,
  PencilIcon,
  Trash2Icon,
  UserPlusIcon,
  WorkflowIcon,
} from 'lucide-react'
import type { z } from 'zod'

import { hasRoute, useMe } from '@/app/session'
import { LanguageNames } from '@/components/LanguagePicker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { roleNames } from '@/designs/roles'
import { formatDateTime, timeAgo } from '@/lib/time'

/** A card of the designs list (`GET /api/designs`). */
export type DesignCardData = z.output<typeof designCard>

/** What a card's menu asks the page to do. */
export type DesignAction =
  | 'open'
  | 'rename'
  | 'duplicate'
  | 'share'
  | 'export'
  | 'refreshPictures'
  | 'saveTemplate'
  | 'delete'
  | 'restore'
  | 'deleteForever'

/** "3 unread comments", "1 unread comment". */
function unreadWords(count: number): string {
  return count === 1 ? '1 unread comment' : `${String(count)} unread comments`
}

/** "2 steps", "1 step". */
function steps(count: number): string {
  return count === 1 ? '1 step' : `${String(count)} steps`
}

/**
 * A design on the Designs page (docs/plan/04 section 3): a tile where its map's picture comes
 * later, the name (a link to the editor), the design owner and the person's role, "Edited <time>
 * by <name>" (in Trash when it was deleted), the step count and the languages, and the menu:
 * "Open", "Rename" and "Share" for the design owner and the site owner, "Duplicate" and "Export"
 * for everyone, "Delete"; in Trash "Restore" and "Delete forever". (S2) The count of the person's
 * unread comments on the picture's tile, marked "@" when some mention them; "Refresh pictures for
 * Claude" for everyone (CL-03); "Save as template" for the design owner and the site owner (TPL-01).
 * The desktop app has no "Share" (DESK-03).
 */
export function DesignCard({
  design,
  unread,
  onAction,
}: {
  design: DesignCardData
  unread?: z.output<typeof unreadDesign> | undefined
  onAction: (action: DesignAction, design: DesignCardData) => void
}) {
  const me = useMe()
  const inTrash = design.deletedAt !== null
  const owner = design.role === 'owner'
  // The site owner passes every check: on someone else's design that is not the role of an owner.
  const role = owner && design.owner.id !== me.id && me.isSiteOwner ? 'Site owner' : roleNames[design.role]
  const act = (action: DesignAction) => () => {
    onAction(action, design)
  }

  return (
    <article className="group/design relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-(--shadow-md) transition-[translate,border-color] duration-(--dur-fast) ease-(--ease) has-[a:hover]:-translate-y-0.5 has-[a:hover]:border-border-strong">
      {/* The small picture of the map comes later; a neutral tile holds its place. */}
      <div className="relative grid h-28 place-items-center border-b bg-surface-2 text-fg-3">
        <WorkflowIcon aria-hidden className="size-8 opacity-60" />
        {unread && !inTrash ? (
          <span className="absolute end-3 top-3 inline-flex h-6 items-center gap-1 rounded-full bg-brand-strong px-2 text-caption font-semibold text-on-brand tabular-nums">
            <MessageSquareIcon aria-hidden className="size-3.5" />
            <span aria-hidden>
              {unread.unread}
              {unread.mentions > 0 ? ' @' : null}
            </span>
            <span className="sr-only">
              {unreadWords(unread.unread)}
              {unread.mentions > 0 ? ', some mention you' : ''}
            </span>
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-1 p-4 pt-3">
        <div className="flex items-start gap-2">
          <h2 className="min-w-0 flex-1 pt-1 text-headline">
            {inTrash ? (
              <span dir="auto" className="line-clamp-2 break-words">
                {design.name}
              </span>
            ) : (
              <Link
                to="/d/$id"
                params={{ id: design.id }}
                dir="auto"
                // The whole card opens the design; the menu button stays above the link.
                className="line-clamp-2 break-words text-foreground no-underline outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus focus-visible:after:outline-solid"
              >
                {design.name}
              </Link>
            )}
          </h2>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="relative -me-1.5"
                  aria-label={`Menu of ${design.name}`}
                />
              }
            >
              <EllipsisIcon aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {inTrash ? (
                <>
                  <DropdownMenuItem onClick={act('restore')}>
                    <ArchiveRestoreIcon aria-hidden />
                    Restore
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={act('deleteForever')}>
                    <Trash2Icon aria-hidden />
                    Delete forever
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem onClick={act('open')}>
                    <ExternalLinkIcon aria-hidden />
                    Open
                  </DropdownMenuItem>
                  {owner ? (
                    <DropdownMenuItem onClick={act('rename')}>
                      <PencilIcon aria-hidden />
                      Rename
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem onClick={act('duplicate')}>
                    <CopyIcon aria-hidden />
                    Duplicate
                  </DropdownMenuItem>
                  {owner && hasRoute('setDesignMember') ? (
                    <DropdownMenuItem onClick={act('share')}>
                      <UserPlusIcon aria-hidden />
                      Share
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem onClick={act('export')}>
                    <DownloadIcon aria-hidden />
                    Export
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={act('refreshPictures')}>
                    <ImageUpIcon aria-hidden />
                    Refresh pictures for Claude
                  </DropdownMenuItem>
                  {owner ? (
                    <>
                      <DropdownMenuItem onClick={act('saveTemplate')}>
                        <LayoutTemplateIcon aria-hidden />
                        Save as template
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={act('delete')}>
                        <Trash2Icon aria-hidden />
                        Delete
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex min-w-0 items-center gap-2 text-subhead text-fg-2">
          <span className="truncate">{design.owner.name}</span>
          <Badge variant="secondary">{role}</Badge>
        </div>
        <p className="text-footnote text-fg-3">
          {inTrash && design.deletedAt !== null ? (
            <time dateTime={new Date(design.deletedAt).toISOString()} title={formatDateTime(design.deletedAt)}>
              Deleted {timeAgo(design.deletedAt)}
            </time>
          ) : (
            <>
              <time dateTime={new Date(design.updatedAt).toISOString()} title={formatDateTime(design.updatedAt)}>
                Edited {timeAgo(design.updatedAt)}
              </time>
              {design.updatedBy ? ` by ${design.updatedBy.name}` : null}
            </>
          )}
        </p>
        <p className="truncate text-footnote text-fg-3">
          {steps(design.stepCount)} · <LanguageNames codes={design.languages} />
        </p>
      </div>
    </article>
  )
}
