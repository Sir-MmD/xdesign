import * as React from 'react'
import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import {
  dialogFooterClasses,
  dialogPopupClasses,
  focusPastHelp,
  SheetDismissContext,
  SheetGrab,
  useSheetPopup,
} from '@/components/ui/dialog'

/*
 * Confirmations in the dialog look of the design system (17 section 4.6; see dialog.tsx),
 * also a bottom sheet under 760 px, with the dialog's motion (32 section 18.2, MOT-01). Their
 * title is a semibold headline, smaller than a dialog's, as an alert's is
 * (docs/plan/35-owner-list-2026-11-04.md section 12.2). A finger that pulls the sheet down closes
 * it as Cancel does (a tap beside it still does not), or it springs back (lib/useSheetDrag.ts,
 * APL-02).
 */

function AlertDialog({ ...props }: AlertDialogPrimitive.Root.Props) {
  // Its sheet closes by a drag also inside a dialog that resists one (its own Cancel is always safe).
  return (
    <SheetDismissContext value>
      <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
    </SheetDismissContext>
  )
}

function AlertDialogTrigger({ ...props }: AlertDialogPrimitive.Trigger.Props) {
  return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
}

function AlertDialogPortal({ ...props }: AlertDialogPrimitive.Portal.Props) {
  return <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
}

function AlertDialogOverlay({ className, ...props }: AlertDialogPrimitive.Backdrop.Props) {
  return (
    <AlertDialogPrimitive.Backdrop
      data-slot="alert-dialog-overlay"
      className={cn('x-backdrop fixed inset-0 isolate z-50 bg-scrim', className)}
      {...props}
    />
  )
}

function AlertDialogContent({
  className,
  size = 'default',
  children,
  initialFocus,
  ...props
}: AlertDialogPrimitive.Popup.Props & {
  size?: 'default' | 'sm'
}) {
  const { popup, closer, ref } = useSheetPopup()
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Popup
        ref={ref}
        // Never on the "i" of a help text in its fields (26 section 5.3, INF-01).
        initialFocus={initialFocus ?? ((openType) => focusPastHelp(popup.current, openType))}
        data-slot="alert-dialog-content"
        data-size={size}
        className={cn(
          dialogPopupClasses,
          'group/alert-dialog-content data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-sm',
          className,
        )}
        {...props}
      >
        <SheetGrab className="min-[760px]:hidden" />
        <AlertDialogPrimitive.Close ref={closer} hidden data-slot="sheet-drag-close" />
        {children}
      </AlertDialogPrimitive.Popup>
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn(
        'grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-4 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-start sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]',
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        dialogFooterClasses,
        'group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2',
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogMedia({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-media"
      className={cn(
        "mb-2 inline-flex size-10 items-center justify-center rounded-lg bg-surface-2 text-fg-2 sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-6",
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn(
        'font-heading text-headline font-bold sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2',
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn(
        'text-subhead text-balance text-fg-2 md:text-pretty *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground',
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogAction({ className, ...props }: React.ComponentProps<typeof Button>) {
  return <Button data-slot="alert-dialog-action" className={cn(className)} {...props} />
}

function AlertDialogCancel({
  className,
  variant = 'outline',
  size = 'default',
  ...props
}: AlertDialogPrimitive.Close.Props & Pick<React.ComponentProps<typeof Button>, 'variant' | 'size'>) {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-cancel"
      className={cn(className)}
      render={<Button variant={variant} size={size} />}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}
