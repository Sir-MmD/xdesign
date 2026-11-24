'use client'

import * as React from 'react'
import { Dialog as SheetPrimitive } from '@base-ui/react/dialog'
import { cn } from '@/lib/utils'

import { HelpRow, HelpTip } from '@/components/HelpTip'
import { plainText } from '@/components/plainText'
import { Button } from '@/components/ui/button'
import { focusPastHelp, SheetDismissContext, SheetGrab, useSheetPopup } from '@/components/ui/dialog'
import { XIcon } from 'lucide-react'

/*
 * Sheets of the design system (17 section 4.6, the mockups' .x-sheet): the strong hairline,
 * the large shadow and radius 16 on the open edge, over the --scrim backdrop. Under 760 px
 * a right sheet becomes a bottom sheet with a grab handle; a left sheet (a menu drawer)
 * keeps its side. It stands on the raised surface with a title-3 title. A sheet slides in
 * from its edge on the soft spring and goes on the quick one, turning back from where it is
 * when it is opened again meanwhile (`x-sheet` and `x-backdrop` of styles/components.css,
 * docs/plan/32-owner-list-2026-10-26.md section 18.2, MOT-01; docs/plan/35-owner-list-2026-11-04.md
 * section 12.2, APL-01). A bottom sheet (and a right one on a phone) follows a finger that pulls it
 * down and closes or springs back with its speed (lib/useSheetDrag.ts, 35 section 12.2, APL-02).
 */
function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return (
    <SheetDismissContext value={props.disablePointerDismissal !== true}>
      <SheetPrimitive.Root data-slot="sheet" {...props} />
    </SheetDismissContext>
  )
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn('x-backdrop fixed inset-0 z-50 bg-scrim', className)}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = 'right',
  showCloseButton = true,
  initialFocus,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: 'top' | 'right' | 'bottom' | 'left'
  showCloseButton?: boolean
}) {
  const { popup, closer, ref } = useSheetPopup()
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        ref={ref}
        // Never on the "i" of a help text (26 section 5.3, INF-01).
        initialFocus={initialFocus ?? ((openType) => focusPastHelp(popup.current, openType))}
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          'x-sheet fixed z-50 flex flex-col gap-4 border-border-strong bg-popover bg-clip-padding text-body text-popover-foreground shadow-(--shadow-lg)',
          'data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:max-h-[88dvh] data-[side=bottom]:rounded-t-2xl data-[side=bottom]:border-t data-[side=bottom]:pb-[env(safe-area-inset-bottom,0px)]',
          'data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:rounded-r-2xl data-[side=left]:border-r data-[side=left]:sm:max-w-sm',
          'data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:rounded-l-2xl data-[side=right]:border-l data-[side=right]:sm:max-w-sm',
          'data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:rounded-b-2xl data-[side=top]:border-b',
          // A right sheet on a phone: a bottom sheet (the width is important, so a sheet's
          // own sm:max-w-* does not narrow it).
          'max-[760px]:data-[side=right]:inset-x-0 max-[760px]:data-[side=right]:top-auto max-[760px]:data-[side=right]:bottom-0 max-[760px]:data-[side=right]:h-auto max-[760px]:data-[side=right]:max-h-[88dvh] max-[760px]:data-[side=right]:w-full! max-[760px]:data-[side=right]:max-w-none! max-[760px]:data-[side=right]:rounded-none max-[760px]:data-[side=right]:rounded-t-2xl max-[760px]:data-[side=right]:border-t max-[760px]:data-[side=right]:border-l-0 max-[760px]:data-[side=right]:pb-[env(safe-area-inset-bottom,0px)]',
          className,
        )}
        {...props}
      >
        {side === 'bottom' || side === 'right' ? (
          <SheetGrab className={cn('mt-2', side === 'right' && 'min-[760px]:hidden')} />
        ) : null}
        <SheetPrimitive.Close ref={closer} hidden data-slot="sheet-drag-close" />
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            render={<Button variant="ghost" className="absolute end-3 top-3" size="icon-sm" />}
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sheet-header" className={cn('flex flex-col gap-1 p-4 pe-12', className)} {...props} />
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sheet-footer" className={cn('mt-auto flex flex-col gap-2 p-4', className)} {...props} />
}

/**
 * A sheet's title. With `help`, the "i" of the sheet's help text follows it (26 section 5.3, INF-01), and the text is
 * the sheet's hidden description, which a screen reader reads when the sheet opens: use it in place of a
 * `SheetDescription`, never with one.
 */
function SheetTitle({
  className,
  help,
  helpLabel,
  ...props
}: SheetPrimitive.Title.Props & {
  /** The sheet's help text: what it shows or is for. */
  help?: React.ReactNode
  /** The "i"'s name when the title is not plain words; the title's words by default. */
  helpLabel?: string
}) {
  const title = (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('font-heading text-title-3 font-bold text-foreground', className)}
      {...props}
    />
  )
  if (!help) return title
  // The "i" after the title and not in it, whose words name the sheet.
  return (
    <HelpRow>
      {title}
      <HelpTip label={helpLabel ?? (plainText(props.children) || 'this sheet')}>{help}</HelpTip>
      <SheetPrimitive.Description hidden>{help}</SheetPrimitive.Description>
    </HelpRow>
  )
}

function SheetDescription({ className, ...props }: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-subhead text-fg-2', className)}
      {...props}
    />
  )
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription }
