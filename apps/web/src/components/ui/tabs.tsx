'use client'

import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/lib/useMediaQuery'

/*
 * Tabs of the design system (17 section 4.6): `default` is the segmented look (the
 * mockups' .x-seg: a surface-2 track, the current tab on the surface in brand), `line` the
 * underlined tab row (.x-tabs: 13.5 px semibold in the third ink, the current one in brand
 * with a 2 px underline). `TabsCount` is the small count pill inside a tab. With
 * `phoneChips` a tab row becomes a wrapping row of chips under 760 px, as the Queue's
 * (queue.html), so no tab is cut at the edge of a phone. The current tab's surface or
 * underline is a marker that slides to the tab the admin picks, and the new content fades
 * in, both on the smooth spring (docs/plan/32-owner-list-2026-10-26.md section 18.2, MOT-01;
 * docs/plan/35-owner-list-2026-11-04.md section 12.2, APL-01), so a marker sent on before it
 * arrives turns from where it is; chips keep their own look. The segmented row stands as high
 * as a button (36 px, 44 on phones), a line tab is a control's height, and on phones every
 * tab keeps a 44 px hit area (`x-target`).
 */
function Tabs({ className, orientation = 'horizontal', ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn('group/tabs flex gap-3 data-horizontal:flex-col', className)}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  'group/tabs-list inline-flex max-w-full items-center text-fg-3 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col',
  {
    variants: {
      variant: {
        // The rows that scroll sideways clip up and down, so a tab's hit area (x-target) never scrolls them.
        default:
          'w-fit [scrollbar-width:none] justify-center gap-0.5 overflow-x-auto overflow-y-hidden rounded-lg border bg-surface-2 p-[3px] [&::-webkit-scrollbar]:hidden',
        line: '[scrollbar-width:none] justify-start gap-0.5 overflow-x-auto overflow-y-hidden group-data-horizontal/tabs:w-full group-data-horizontal/tabs:border-b [&::-webkit-scrollbar]:hidden',
        chips: 'w-full flex-wrap gap-1.5',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

/**
 * The marker of the current tab (32 section 18.2, MOT-01): the surface under a segmented
 * tab or the 2 px underline of a line tab, placed by Base UI's indicator (--active-tab-*,
 * from the list's padding edge) behind the tabs' words, gliding to a new tab on the smooth
 * spring (--dur-swap, 35 section 12.2); it jumps under Reduced and Off.
 */
const tabsIndicatorClasses = {
  default:
    'h-(--active-tab-height) translate-y-(--active-tab-top) rounded-[7px] bg-surface shadow-[0_0_0_1px_var(--border),var(--shadow-sm)]',
  line: 'h-0.5 translate-y-[calc(var(--active-tab-top)+var(--active-tab-height)-2px)] bg-brand forced-colors:bg-[Highlight]',
}

function TabsList({
  className,
  variant = 'default',
  phoneChips = false,
  children,
  ...props
}: TabsPrimitive.List.Props &
  VariantProps<typeof tabsListVariants> & {
    /** Under 760 px, a wrapping row of chips instead (the same tabs, so the keys stay the same). */
    phoneChips?: boolean
  }) {
  const phone = useMediaQuery('(width < 760px)')
  const shown = phoneChips && phone ? 'chips' : (variant ?? 'default')
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={shown}
      className={cn('relative isolate', tabsListVariants({ variant: shown }), className)}
      {...props}
    >
      {children}
      {shown === 'chips' ? null : (
        <TabsPrimitive.Indicator
          data-slot="tabs-indicator"
          className={cn(
            'pointer-events-none absolute top-0 left-0 -z-1 w-(--active-tab-width) translate-x-(--active-tab-left) transition-[translate,width,height] duration-(--dur-swap) ease-(--ease-enter) motion-reduce:transition-none',
            tabsIndicatorClasses[shown],
          )}
        />
      )}
    </TabsPrimitive.List>
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "group/tabs-trigger x-target relative inline-flex flex-1 touch-manipulation items-center justify-center gap-2 font-semibold whitespace-nowrap transition-[color,background-color,border-color,box-shadow] duration-(--dur-fast) ease-(--ease) outline-none [-webkit-tap-highlight-color:transparent] group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-solid disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 forced-colors:aria-selected:outline-2 forced-colors:aria-selected:-outline-offset-2 forced-colors:aria-selected:outline-solid [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // segmented (default); the current tab's surface is the list's marker
        'group-data-[variant=default]/tabs-list:h-[calc(var(--control-h)-8px)] group-data-[variant=default]/tabs-list:rounded-[7px] group-data-[variant=default]/tabs-list:px-3 group-data-[variant=default]/tabs-list:text-subhead group-data-[variant=default]/tabs-list:text-fg-2 group-data-[variant=default]/tabs-list:hover:text-foreground group-data-[variant=default]/tabs-list:focus-visible:outline-offset-1 group-data-[variant=default]/tabs-list:aria-selected:text-brand',
        // underlined (line); the current tab's underline is the list's marker
        'group-data-[variant=line]/tabs-list:-mb-px group-data-[variant=line]/tabs-list:min-h-(--control-h) group-data-[variant=line]/tabs-list:flex-none group-data-[variant=line]/tabs-list:border-b-2 group-data-[variant=line]/tabs-list:border-transparent group-data-[variant=line]/tabs-list:px-3 group-data-[variant=line]/tabs-list:py-2 group-data-[variant=line]/tabs-list:text-callout group-data-[variant=line]/tabs-list:text-fg-3 group-data-[variant=line]/tabs-list:hover:text-fg-2 group-data-[variant=line]/tabs-list:focus-visible:-outline-offset-2 group-data-[variant=line]/tabs-list:aria-selected:text-brand',
        // chips (a tab row on a phone, the Queue's chip look)
        'group-data-[variant=chips]/tabs-list:min-h-(--control-h-sm) group-data-[variant=chips]/tabs-list:flex-none group-data-[variant=chips]/tabs-list:gap-2 group-data-[variant=chips]/tabs-list:rounded-full group-data-[variant=chips]/tabs-list:border group-data-[variant=chips]/tabs-list:border-transparent group-data-[variant=chips]/tabs-list:bg-surface-2 group-data-[variant=chips]/tabs-list:px-3 group-data-[variant=chips]/tabs-list:py-1 group-data-[variant=chips]/tabs-list:text-footnote group-data-[variant=chips]/tabs-list:text-fg-2 group-data-[variant=chips]/tabs-list:hover:border-brand group-data-[variant=chips]/tabs-list:hover:text-brand group-data-[variant=chips]/tabs-list:focus-visible:outline-offset-2 group-data-[variant=chips]/tabs-list:active:border-brand group-data-[variant=chips]/tabs-list:active:text-brand group-data-[variant=chips]/tabs-list:aria-selected:border-brand group-data-[variant=chips]/tabs-list:aria-selected:bg-brand-weak group-data-[variant=chips]/tabs-list:aria-selected:text-brand',
        className,
      )}
      {...props}
    />
  )
}

/**
 * A count inside a tab (the mockups' .x-count): neutral, in brand while its tab is current;
 * `info` and `brand` are solid counts that ask for attention, `error` the tint of a problem.
 */
function TabsCount({
  className,
  tone = 'neutral',
  ...props
}: ComponentProps<'span'> & { tone?: 'neutral' | 'info' | 'brand' | 'error' }) {
  return (
    <span
      data-slot="tabs-count"
      data-tone={tone}
      className={cn(
        'inline-grid h-[18px] min-w-5 place-items-center rounded-full px-1.5 text-caption-2 leading-none font-semibold tabular-nums',
        tone === 'neutral' &&
          'bg-surface-2 text-fg-2 group-aria-selected/tabs-trigger:bg-brand-weak group-aria-selected/tabs-trigger:text-brand in-data-[variant=chips]:bg-surface',
        tone === 'info' && 'bg-info text-on-status',
        tone === 'brand' && 'bg-brand-strong text-on-brand',
        tone === 'error' && 'bg-error-weak text-error',
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  // The panel is a tab stop after the tab list (Base UI gives it tabIndex 0), so it shows
  // where the keyboard focus is (UI-27). A new one fades in (`x-swap`, 32 section 18.2).
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn(
        'x-swap flex-1 rounded-md text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus focus-visible:outline-solid',
        className,
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsCount, TabsContent, tabsListVariants }
