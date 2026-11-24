import * as React from 'react'
import { cn } from '@/lib/utils'

/** Whether the element's content is wider than the element, so it scrolls sideways. */
function useScrollsSideways(ref: React.RefObject<HTMLElement | null>): boolean {
  const [scrolls, setScrolls] = React.useState(false)
  React.useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const update = () => {
      setScrolls(el.scrollWidth > el.clientWidth + 1)
    }
    const observer = new ResizeObserver(update)
    observer.observe(el)
    if (el.firstElementChild) observer.observe(el.firstElementChild)
    update()
    return () => {
      observer.disconnect()
    }
  }, [ref])
  return scrolls
}

/*
 * The table look of the design system (17 section 4.6, the mockups' .x-table): a surface-2
 * header in the caption-2 style, bold uppercase, cells in the callout style with 12 x 16 px
 * around them (docs/plan/35-owner-list-2026-11-04.md section 12.2), hairlines, rows tinted
 * brand-weak on hover. The frame around it (border and radius) belongs to the page or DataTable. A row
 * with `x-row-in` fades in when it mounts and one with `x-row-out` folds away on the quick spring
 * (styles/components.css, docs/plan/32-owner-list-2026-10-26.md section 18.2, MOT-01).
 */
function Table({ className, ...props }: React.ComponentProps<'table'>) {
  const container = React.useRef<HTMLDivElement>(null)
  // A table wider than its box scrolls sideways, and the keyboard can scroll it only when
  // the box takes focus (WCAG 2.1.1): then it is a named region in the tab order (UI-27).
  const scrolls = useScrollsSideways(container)
  return (
    <div
      ref={container}
      data-slot="table-container"
      className="relative w-full overflow-x-auto outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus focus-visible:outline-solid"
      {...(scrolls ? { tabIndex: 0, role: 'region', 'aria-label': props['aria-label'] } : {})}
    >
      <table data-slot="table" className={cn('w-full caption-bottom text-callout', className)} {...props} />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn('bg-surface-2 [&_tr]:border-b [&_tr]:hover:bg-transparent', className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody data-slot="table-body" className={cn('[&_tr:last-child]:border-0', className)} {...props} />
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('border-t bg-surface-2 font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'border-b transition-colors duration-(--dur-fast) ease-(--ease) hover:bg-brand-weak has-aria-expanded:bg-brand-weak data-[state=selected]:bg-brand-weak',
        className,
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'px-4 py-2 text-start align-middle text-caption-2 font-bold tracking-[.04em] whitespace-nowrap text-fg-3 uppercase [&:has([role=checkbox])]:pe-0',
        className,
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn('px-4 py-3 align-middle whitespace-nowrap [&:has([role=checkbox])]:pe-0', className)}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return <caption data-slot="table-caption" className={cn('mt-4 text-footnote text-fg-3', className)} {...props} />
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption }
