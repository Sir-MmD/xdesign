import * as React from 'react'
import { cn } from '@/lib/utils'

import { HelpRow, HelpTip } from '@/components/HelpTip'
import { plainText } from '@/components/plainText'

/*
 * The card is the design system's tile (17 section 4.6, the mockups' .x-tile): the surface
 * with a 1 px hairline, radius 16, padding 16 and 12 between its parts, body text, and the
 * medium shadow, which is none in Dark (the hairline carries the depth; the tile is lighter
 * than the page there). `interactive` lifts it 2 px on hover and gives a little while
 * pressed, for tiles that are links; tiles that hold fields stay put (D-228). Cards of a grid
 * or a list come in one after another, 30 ms apart, when the grid carries `x-cards`
 * (styles/components.css, docs/plan/32-owner-list-2026-10-26.md section 18.2, MOT-01;
 * docs/plan/35-owner-list-2026-11-04.md section 12.2, APL-01).
 */
function Card({
  className,
  size = 'default',
  interactive = false,
  ...props
}: React.ComponentProps<'div'> & { size?: 'default' | 'sm'; interactive?: boolean }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      data-interactive={interactive || undefined}
      className={cn(
        'group/card flex flex-col gap-(--card-gap) overflow-hidden rounded-2xl border bg-card py-(--card-py) text-body text-card-foreground shadow-(--shadow-md) [--card-gap:--spacing(3)] [--card-px:--spacing(4)] [--card-py:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-gap:--spacing(2)] data-[size=sm]:[--card-px:--spacing(3)] data-[size=sm]:[--card-py:--spacing(3)] *:[img:first-child]:rounded-t-2xl *:[img:last-child]:rounded-b-2xl',
        interactive &&
          'transition-[translate,border-color,scale] duration-(--dur-fast) ease-(--ease) hover:translate-y-(--lift) hover:border-border-strong active:translate-y-0 motion-safe:active:scale-[.99]',
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        'group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-2xl px-(--card-px) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-py)',
        className,
      )}
      {...props}
    />
  )
}

/**
 * The tile title: small, bold and uppercase in the second ink, with an optional icon. With `help`, its children are the
 * words of a heading it draws itself (`as`, an h2 by default), and the help text opens from an "i" after the title,
 * outside the heading, whose words name the tile; the heading points at the text's hidden copy, as `Tile`'s `help`
 * does (26 section 5.3, INF-06c).
 */
function CardTitle({
  className,
  help,
  helpLabel,
  as: Heading = 'h2',
  children,
  ...props
}: React.ComponentProps<'div'> & {
  /** A help text about the tile (what it shows, how it works), in an "i" after the title. */
  help?: React.ReactNode
  /** The "i"'s name when the title is not plain words; the title's words by default. */
  helpLabel?: string
  /** The heading that holds the title's words when it has `help`. */
  as?: 'h2' | 'h3'
}) {
  const helpId = React.useId()
  const title = (
    <div
      data-slot="card-title"
      className={cn(
        'flex min-w-0 items-center gap-2 font-heading text-footnote font-bold tracking-(--tracking-label) text-fg-2 uppercase [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-[15px] [&_svg:not([class*="text-"])]:text-fg-3',
        className,
      )}
      {...props}
    >
      {help === undefined ? children : <Heading aria-describedby={helpId}>{children}</Heading>}
    </div>
  )
  if (help === undefined) return title
  return (
    // After the title and not in it, whose words name the tile.
    <HelpRow>
      {title}
      <HelpTip label={helpLabel ?? (plainText(children) || 'this tile')} id={helpId}>
        {help}
      </HelpTip>
    </HelpRow>
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-description" className={cn('text-subhead text-fg-2', className)} {...props} />
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        'col-start-2 row-span-2 row-start-1 flex items-center gap-1.5 self-start justify-self-end',
        className,
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('px-(--card-px)', className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('mt-auto flex flex-wrap items-center gap-2 border-t px-(--card-px) py-3', className)}
      {...props}
    />
  )
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent }
