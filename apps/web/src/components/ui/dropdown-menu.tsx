'use client'

import * as React from 'react'
import { Menu as MenuPrimitive } from '@base-ui/react/menu'
import { cn } from '@/lib/utils'
import { ChevronRightIcon, CheckIcon } from 'lucide-react'

/*
 * Menus of the design system (17 section 4.6, the mockups' .x-menu): radius 12, the strong
 * hairline and the large shadow on the raised surface; items as high as a control (36 px,
 * 44 on phones) in the callout style with their icons in the third ink, a pressed one in
 * --surface-press, the checked item in brand, a destructive item in the error colors. A menu
 * fades in with a 4 px slide on the quick spring (`x-pop` of styles/components.css,
 * docs/plan/32-owner-list-2026-10-26.md section 18.2, MOT-01; docs/plan/35-owner-list-2026-11-04.md
 * section 12.2, APL-01).
 */
function DropdownMenu({ ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuPortal({ ...props }: MenuPrimitive.Portal.Props) {
  return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
}

function DropdownMenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
}

function DropdownMenuContent({
  align = 'start',
  alignOffset = 0,
  side = 'bottom',
  sideOffset = 4,
  className,
  ...props
}: MenuPrimitive.Popup.Props & Pick<MenuPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset'>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            'x-pop z-50 max-h-(--available-height) w-(--anchor-width) min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-xl border border-border-strong bg-popover p-1.5 text-popover-foreground shadow-(--shadow-lg) outline-none data-closed:overflow-hidden',
            className,
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

function DropdownMenuGroup({ ...props }: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: MenuPrimitive.GroupLabel.Props & {
  inset?: boolean
}) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        'px-2.5 pt-2 pb-1 text-caption-2 font-bold tracking-(--tracking-label) text-fg-3 uppercase data-inset:ps-8',
        className,
      )}
      {...props}
    />
  )
}

function DropdownMenuItem({
  className,
  inset,
  variant = 'default',
  ...props
}: MenuPrimitive.Item.Props & {
  inset?: boolean
  variant?: 'default' | 'destructive'
}) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "group/dropdown-menu-item relative flex min-h-(--control-h) cursor-default items-center gap-2.5 rounded-md px-2.5 py-1.5 text-callout outline-hidden select-none [-webkit-tap-highlight-color:transparent] focus:bg-surface-2 active:bg-surface-press data-inset:ps-8 data-[variant=destructive]:text-error data-[variant=destructive]:focus:bg-error-weak dark:focus:bg-surface-press data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-fg-3 data-[variant=destructive]:*:[svg]:text-error",
        className,
      )}
      {...props}
    />
  )
}

function DropdownMenuSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
  return <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: MenuPrimitive.SubmenuTrigger.Props & {
  inset?: boolean
}) {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "flex min-h-(--control-h) cursor-default items-center gap-2.5 rounded-md px-2.5 py-1.5 text-callout outline-hidden select-none [-webkit-tap-highlight-color:transparent] focus:bg-surface-2 active:bg-surface-press data-inset:ps-8 data-popup-open:bg-surface-2 dark:focus:bg-surface-press dark:data-popup-open:bg-surface-press data-open:bg-surface-2 dark:data-open:bg-surface-press [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-fg-3",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ms-auto rtl:-scale-x-100" />
    </MenuPrimitive.SubmenuTrigger>
  )
}

function DropdownMenuSubContent({
  align = 'start',
  alignOffset = -3,
  side = 'right',
  sideOffset = 0,
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        'w-auto min-w-[96px] rounded-xl border border-border-strong bg-popover p-1.5 text-popover-foreground shadow-(--shadow-lg)',
        className,
      )}
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  ...props
}: MenuPrimitive.CheckboxItem.Props & {
  inset?: boolean
}) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      data-inset={inset}
      className={cn(
        "relative flex min-h-(--control-h) cursor-default items-center gap-2.5 rounded-md py-1.5 ps-2.5 pe-8 text-callout outline-hidden select-none [-webkit-tap-highlight-color:transparent] focus:bg-surface-2 active:bg-surface-press aria-checked:font-semibold aria-checked:text-brand data-inset:ps-8 dark:focus:bg-surface-press data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      checked={checked}
      {...props}
    >
      <span
        className="pointer-events-none absolute end-2 flex items-center justify-center text-brand"
        data-slot="dropdown-menu-checkbox-item-indicator"
      >
        <MenuPrimitive.CheckboxItemIndicator>
          <CheckIcon />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
  return <MenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />
}

function DropdownMenuRadioItem({
  className,
  children,
  inset,
  ...props
}: MenuPrimitive.RadioItem.Props & {
  inset?: boolean
}) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      data-inset={inset}
      className={cn(
        "relative flex min-h-(--control-h) cursor-default items-center gap-2.5 rounded-md py-1.5 ps-2.5 pe-8 text-callout outline-hidden select-none [-webkit-tap-highlight-color:transparent] focus:bg-surface-2 active:bg-surface-press aria-checked:font-semibold aria-checked:text-brand data-inset:ps-8 dark:focus:bg-surface-press data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <span
        className="pointer-events-none absolute end-2 flex items-center justify-center text-brand"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        <MenuPrimitive.RadioItemIndicator>
          <CheckIcon />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  )
}

function DropdownMenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn('mx-0.5 my-1 h-px bg-border', className)}
      {...props}
    />
  )
}

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn('ms-auto text-caption tracking-widest text-fg-3', className)}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
