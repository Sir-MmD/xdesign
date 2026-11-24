import type { template } from '@xdesign/api'
import {
  BrainIcon,
  ClipboardListIcon,
  EllipsisIcon,
  LifeBuoyIcon,
  type LucideIcon,
  ShoppingBagIcon,
  Trash2Icon,
  WorkflowIcon,
} from 'lucide-react'
import type { z } from 'zod'

import { useMe } from '@/app/session'
import { LanguageNames } from '@/components/LanguagePicker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { formatDateTime, timeAgo } from '@/lib/time'

/** A card of the gallery (`GET /api/templates`). */
export type TemplateData = z.output<typeof template>

// The pictures of the built-in templates; the server's own show the design tile's icon.
const icons: Readonly<Record<string, LucideIcon>> = {
  shop: ShoppingBagIcon,
  support: LifeBuoyIcon,
  quiz: BrainIcon,
  signUp: ClipboardListIcon,
}

/** "2 steps", "1 step". */
function steps(count: number): string {
  return count === 1 ? '1 step' : `${String(count)} steps`
}

/**
 * A template in the gallery (docs/plan/04 section 15), in the style of a design's card: its
 * picture, the name, "Starter template" or who saved it and when, the description, the step count
 * and languages, and "Use this template". One of the server's templates has a menu with "Remove"
 * for the person who saved it and the site owner.
 */
export function TemplateCard({
  template,
  using,
  onUse,
  onRemove,
}: {
  template: TemplateData
  /** "Use this template" of this card is running. */
  using: boolean
  onUse: (template: TemplateData) => void
  onRemove: (template: TemplateData) => void
}) {
  const me = useMe()
  const Icon = (template.icon === null ? undefined : icons[template.icon]) ?? WorkflowIcon
  const canRemove = !template.builtIn && (me.isSiteOwner || template.savedBy?.id === me.id)

  return (
    <article className="relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-(--shadow-md)">
      <div className="grid h-28 place-items-center border-b bg-surface-2 text-fg-3">
        <Icon aria-hidden className="size-8 opacity-60" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-4 pt-3">
        <div className="flex items-start gap-2">
          <h2 dir="auto" className="line-clamp-2 min-w-0 flex-1 pt-1 text-headline break-words">
            {template.name}
          </h2>
          {canRemove ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon-sm" className="-me-1.5" aria-label={`Menu of ${template.name}`} />
                }
              >
                <EllipsisIcon aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    onRemove(template)
                  }}
                >
                  <Trash2Icon aria-hidden />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
        {template.savedBy && template.savedAt !== null ? (
          <p className="truncate text-footnote text-fg-3">
            Saved by {template.savedBy.name}{' '}
            <time dateTime={new Date(template.savedAt).toISOString()} title={formatDateTime(template.savedAt)}>
              {timeAgo(template.savedAt)}
            </time>
          </p>
        ) : (
          <div>
            <Badge variant="secondary">Starter template</Badge>
          </div>
        )}
        {template.description ? (
          <p dir="auto" className="text-subhead break-words text-fg-2">
            {template.description}
          </p>
        ) : null}
        <p className="truncate text-footnote text-fg-3">
          {steps(template.stepCount)} · <LanguageNames codes={template.languages} />
        </p>
        <div className="mt-auto pt-2">
          <Button
            disabled={using}
            pending={using}
            onClick={() => {
              onUse(template)
            }}
          >
            Use this template
          </Button>
        </div>
      </div>
    </article>
  )
}
