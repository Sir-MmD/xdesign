import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

// Copied from xWriter's web/src/components/EmptyState.tsx without the test ID.

export interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  /** The title's element: a heading when the empty state is the whole page (default p). */
  titleAs?: 'p' | 'h1' | 'h2' | 'h3'
  description?: ReactNode
  /** The primary action, for example a "Create writer" button. */
  action?: ReactNode
  className?: string
}

/**
 * What a list or widget shows when it has nothing: an icon, a text and the next step (10
 * section 5), in a dashed frame with a round icon (the mockups' .x-empty).
 */
export function EmptyState({
  icon: Icon,
  title,
  titleAs: Title = 'p',
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-2xl border-[1.5px] border-dashed border-border-strong px-6 py-8 text-center text-body',
        className,
      )}
    >
      {Icon ? (
        <span className="mb-1 grid size-[46px] place-items-center rounded-full bg-surface-2 text-fg-3">
          <Icon aria-hidden className="size-[22px]" />
        </span>
      ) : null}
      <div className="grid max-w-[46ch] gap-1">
        <Title className="text-headline text-foreground">{title}</Title>
        {description ? <div className="text-subhead text-fg-2">{description}</div> : null}
      </div>
      {action ? <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  )
}
