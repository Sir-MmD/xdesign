'use client'

import * as React from 'react'
import { Select as SelectPrimitive } from '@base-ui/react/select'
import { useViewOnly } from '@/components/viewOnly'
import { cn } from '@/lib/utils'
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from 'lucide-react'

/*
 * The trigger looks like a text field and the list like a menu (17 section 4.6, the
 * mockups' .x-select and .x-menu): items as high as a control (36 px, 44 on phones), the
 * chosen one in brand, a pressed one in --surface-press. The list comes with the menus'
 * motion (`x-pop`, docs/plan/32-owner-list-2026-10-26.md section 18.2, MOT-01) on the raised
 * surface (docs/plan/35-owner-list-2026-11-04.md section 12.2); laid over the trigger with the
 * chosen item in line, it only fades.
 */
const Select = SelectPrimitive.Root

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return <SelectPrimitive.Group data-slot="select-group" className={cn('scroll-my-1', className)} {...props} />
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value data-slot="select-value" className={cn('flex flex-1 text-start', className)} {...props} />
  )
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: 'sm' | 'default'
}) {
  const viewOnly = useViewOnly()
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-fit touch-manipulation items-center justify-between gap-1.5 rounded-md border border-control bg-surface py-2 ps-3 pe-2.5 text-body whitespace-nowrap text-foreground transition-[border-color,box-shadow] duration-(--dur-fast) ease-(--ease) outline-none select-none [-webkit-tap-highlight-color:transparent] hover:border-fg-3 focus-visible:border-focus focus-visible:shadow-[0_0_0_1px_var(--focus),0_0_0_4px_var(--focus-halo)] disabled:cursor-not-allowed disabled:border-border-strong disabled:bg-surface-2 disabled:text-fg-3 aria-invalid:border-error aria-invalid:focus-visible:shadow-[0_0_0_1px_var(--error),0_0_0_4px_var(--error-weak)] data-placeholder:text-fg-3 data-[size=default]:h-(--control-h) data-[size=sm]:h-(--control-h-sm) data-[size=sm]:text-subhead *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
      {...(viewOnly ? { disabled: true } : {})}
    >
      {children}
      <SelectPrimitive.Icon render={<ChevronDownIcon className="pointer-events-none size-4 text-fg-3" />} />
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  side = 'bottom',
  sideOffset = 4,
  align = 'center',
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<SelectPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset' | 'alignItemWithTrigger'>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn(
            'x-pop relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-xl border border-border-strong bg-popover p-1.5 text-popover-foreground shadow-(--shadow-lg)',
            className,
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn(
        'px-2.5 pt-2 pb-1 text-caption-2 font-bold tracking-(--tracking-label) text-fg-3 uppercase',
        className,
      )}
      {...props}
    />
  )
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex min-h-(--control-h) w-full cursor-default items-center gap-2.5 rounded-md py-1.5 ps-2.5 pe-8 text-callout outline-hidden select-none [-webkit-tap-highlight-color:transparent] focus:bg-surface-2 active:bg-surface-press aria-selected:font-semibold aria-selected:text-brand data-highlighted:bg-surface-2 dark:focus:bg-surface-press dark:data-highlighted:bg-surface-press data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute end-2 flex size-4 items-center justify-center text-brand" />
        }
      >
        <CheckIcon className="pointer-events-none" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({ className, ...props }: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn('pointer-events-none mx-0.5 my-1 h-px bg-border', className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 text-fg-3 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <ChevronUpIcon />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 text-fg-3 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <ChevronDownIcon />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
