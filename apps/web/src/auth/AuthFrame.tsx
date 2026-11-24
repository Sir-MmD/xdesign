import { routes } from '@xdesign/api'
import type { ReactNode } from 'react'

import { useApi } from '@/api/client'
import { Logo } from '@/app/Logo'
import { cn } from '@/lib/utils'

/**
 * The frame of the pages a visitor opens without a session (sign in, an old invite or reset
 * link), from xWriter's panel: the page gray with a soft blue glow at the top, the logo and the
 * site's name (`GET /api/site`) centered above the card.
 */
export function AuthFrame({ children }: { children: ReactNode }) {
  const site = useApi(routes.site)
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background bg-[radial-gradient(900px_420px_at_50%_-140px,var(--brand-weak),transparent_72%)] bg-no-repeat px-4 pt-[max(--spacing(10),env(safe-area-inset-top))] pb-[max(--spacing(10),env(safe-area-inset-bottom))]">
      <div className="flex max-w-full flex-col items-center gap-3">
        <Logo className="size-16" />
        <p className="min-h-[1lh] max-w-full truncate text-title-3 font-bold text-foreground">{site.data?.name}</p>
      </div>
      {children}
    </main>
  )
}

/**
 * The card of such a page: the title (the page's h1) and a lead line, then the page's own
 * content. 400 px at most, 32 px of padding (24 px under 420 px).
 */
export function AuthCard({
  title,
  lead,
  titleId,
  children,
  className,
}: {
  title: ReactNode
  lead?: ReactNode
  /** The ID of the h1, which names the card. */
  titleId: string
  children?: ReactNode
  className?: string
}) {
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'flex w-full max-w-[400px] min-w-0 flex-col gap-5 rounded-2xl border border-border bg-surface p-6 text-foreground shadow-(--shadow-md) min-[420px]:p-8',
        className,
      )}
    >
      <header className="flex flex-col gap-2">
        <h1 id={titleId} className="text-title-1 font-bold break-words">
          {title}
        </h1>
        {lead ? <p className="text-subhead break-words text-fg-2">{lead}</p> : null}
      </header>
      {children}
    </section>
  )
}
