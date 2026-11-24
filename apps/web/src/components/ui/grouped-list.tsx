import * as React from 'react'
import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { ChevronRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/*
 * A grouped list with insets (docs/plan/35-owner-list-2026-11-04.md section 12.2, APL-01), the way a phone lays out
 * its settings: a group's label above (the panel's uppercase label), its rows together in one rounded box on the
 * surface, a hairline between two rows that starts where their words start (past a leading icon), and a note below.
 * Each row is at least --row-h (44 px) high and is a link, a button or plain content (`render`): a row that acts
 * shows its hover, and its press at once on pointer-down; `chevron` marks one that leads to another page or pane.
 *
 *   <ListGroup>
 *     <ListGroupLabel>Accounts</ListGroupLabel>
 *     <ListGroupRows>
 *       <ListGroupItem render={<Link to="/accounts" />} chevron>
 *         <ListGroupMedia className="bg-brand-weak text-brand"><UsersIcon /></ListGroupMedia>
 *         <ListGroupText title="Accounts" description="3 signed in" />
 *         <ListGroupValue>3</ListGroupValue>
 *       </ListGroupItem>
 *     </ListGroupRows>
 *     <ListGroupFooter>Accounts post to the channels.</ListGroupFooter>
 *   </ListGroup>
 */
function ListGroup({ className, ...props }: React.ComponentProps<'section'>) {
  return <section data-slot="list-group" className={cn('flex min-w-0 flex-col gap-2', className)} {...props} />
}

/** The group's label above its rows; `render` makes it a heading (`<h2 />`) where the page's outline needs one. */
function ListGroupLabel({ className, render, ...props }: useRender.ComponentProps<'div'>) {
  return useRender({
    defaultTagName: 'div',
    props: mergeProps<'div'>(
      {
        className: cn('px-4 text-footnote font-semibold tracking-(--tracking-label) text-fg-3 uppercase', className),
      },
      props,
    ),
    render,
    state: { slot: 'list-group-label' },
  })
}

/** The rounded box that holds the rows. */
function ListGroupRows({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="list-group-rows"
      className={cn('flex flex-col overflow-hidden rounded-xl border bg-card', className)}
      {...props}
    />
  )
}

/**
 * A row. The hairline under it starts 16 px in, or past its icon when it has a ListGroupMedia, and the last row has
 * none. Its focus ring is drawn inside it, as the box clips what stands out.
 */
function ListGroupItem({
  className,
  render,
  chevron = false,
  children,
  ...props
}: useRender.ComponentProps<'div'> & {
  /** A chevron at its end: the row opens another page or pane. */
  chevron?: boolean
}) {
  const row = useRender({
    defaultTagName: 'div',
    props: mergeProps<'div'>(
      {
        className: cn(
          'group/list-row relative flex min-h-(--row-h) w-full touch-manipulation items-center gap-3 px-4 py-2 text-start text-body text-foreground no-underline transition-colors duration-(--dur-fast) ease-(--ease) outline-none [--list-inset:--spacing(4)] [-webkit-tap-highlight-color:transparent] after:pointer-events-none after:absolute after:start-(--list-inset) after:end-0 after:bottom-0 after:h-px after:bg-border group-last/list-item:after:hidden focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus focus-visible:outline-solid has-[>[data-slot=list-group-media]]:[--list-inset:--spacing(14)] aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-[current=page]:text-brand [a]:cursor-pointer [a]:hover:bg-surface-2 [a]:active:bg-surface-press [button]:cursor-pointer [button]:hover:bg-surface-2 [button]:active:bg-surface-press',
          className,
        ),
        children: (
          <>
            {children}
            {chevron ? <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-fg-3 rtl:-scale-x-100" /> : null}
          </>
        ),
      },
      props,
    ),
    render,
    state: { slot: 'list-group-item' },
  })
  return (
    <li data-slot="list-group-li" className="group/list-item">
      {row}
    </li>
  )
}

/** A row's leading icon on a 28 px rounded tile; give it the colors of what it stands for. */
function ListGroupMedia({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      aria-hidden
      data-slot="list-group-media"
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-2 text-fg-2 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  )
}

/** A row's words: its title in the body style and an optional line under it in the subhead style. */
function ListGroupText({
  className,
  title,
  description,
  ...props
}: Omit<React.ComponentProps<'div'>, 'title'> & { title: React.ReactNode; description?: React.ReactNode }) {
  return (
    <div data-slot="list-group-text" className={cn('flex min-w-0 flex-1 flex-col', className)} {...props}>
      <span className="truncate">{title}</span>
      {description === undefined ? null : <span className="text-subhead text-fg-3">{description}</span>}
    </div>
  )
}

/** A value at a row's end, before its chevron: a count, a state, the chosen option. */
function ListGroupValue({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="list-group-value"
      className={cn('ms-auto shrink-0 text-body text-fg-3 tabular-nums', className)}
      {...props}
    />
  )
}

/** A note under the group's rows. */
function ListGroupFooter({ className, ...props }: React.ComponentProps<'p'>) {
  return <p data-slot="list-group-footer" className={cn('px-4 text-footnote text-fg-3', className)} {...props} />
}

export {
  ListGroup,
  ListGroupLabel,
  ListGroupRows,
  ListGroupItem,
  ListGroupMedia,
  ListGroupText,
  ListGroupValue,
  ListGroupFooter,
}
