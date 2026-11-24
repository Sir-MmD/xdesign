import * as React from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { cn } from '@/lib/utils'

import { HelpRow, HelpTip } from '@/components/HelpTip'
import { plainText } from '@/components/plainText'
import { Button } from '@/components/ui/button'
import { useSheetDrag } from '@/lib/useSheetDrag'
import { XIcon } from 'lucide-react'

/*
 * Dialogs of the design system (17 section 4.6, the mockups' .x-dialog): radius 16, the
 * strong hairline and the large shadow over the --scrim backdrop, on the raised surface,
 * 24 px of padding (16 at a phone's sides), a title-3 title and subhead description; the
 * footer has a hairline, 12 px between its buttons and an optional reason at its start (why
 * the main action is off). Under 760 px a dialog opens as a bottom sheet with a grab handle
 * (D-241). It grows from 98% with a fade on the smooth spring, a bottom sheet slides up from
 * the edge on the soft one, and both close on the quick one, turning back from where they are
 * when they open again meanwhile (`x-dialog` and `x-backdrop` of styles/components.css,
 * docs/plan/32-owner-list-2026-10-26.md section 18.2, MOT-01; docs/plan/35-owner-list-2026-11-04.md
 * section 12.2, APL-01). A bottom sheet follows a finger that pulls it down and closes or springs
 * back with its speed (lib/useSheetDrag.ts, 35 section 12.2, APL-02).
 */

/**
 * Whether a drag may close the sheet of the dialog around it: false where a tap beside the dialog keeps it open
 * (`disablePointerDismissal`, unsaved changes), so its sheet resists and springs back (35 section 12.2, APL-02).
 */
const SheetDismissContext = React.createContext(true)

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return (
    <SheetDismissContext value={props.disablePointerDismissal !== true}>
      <DialogPrimitive.Root data-slot="dialog" {...props} />
    </SheetDismissContext>
  )
}

/**
 * The ref of a dialog's, a sheet's or an alert's popup with the drag of its bottom sheet (lib/useSheetDrag.ts), the
 * popup itself for its first focus (`popup`), and the hidden close part that the drag presses (`closer`), so a dialog
 * closed by a drag goes through its own close, which it may refuse (35 section 12.2, APL-02).
 */
function useSheetPopup() {
  const popup = React.useRef<HTMLDivElement | null>(null)
  const closer = React.useRef<HTMLButtonElement>(null)
  const drag = useSheetDrag({
    dismissible: React.use(SheetDismissContext),
    close: () => {
      closer.current?.click()
    },
  })
  const ref = React.useCallback(
    (element: HTMLDivElement | null) => {
      popup.current = element
      drag(element)
    },
    [drag],
  )
  return { popup, closer, ref }
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn('x-backdrop fixed inset-0 isolate z-50 bg-scrim', className)}
      {...props}
    />
  )
}

/**
 * The popup classes shared with the alert dialog: centered from 760 px, growing in from 98%,
 * a bottom sheet that slides up from the edge below it (`x-dialog`). The width classes are
 * important on phones, so a dialog's own `sm:max-w-*` does not narrow the sheet.
 */
const dialogPopupClasses =
  'x-dialog fixed top-1/2 left-1/2 z-50 grid max-h-[min(86dvh,760px)] w-full -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-2xl border border-border-strong bg-popover p-6 text-body text-popover-foreground shadow-(--shadow-lg) outline-none max-[760px]:top-auto max-[760px]:bottom-0 max-[760px]:left-0 max-[760px]:max-h-[88dvh] max-[760px]:w-full! max-[760px]:max-w-none! max-[760px]:translate-x-0 max-[760px]:translate-y-0 max-[760px]:rounded-b-none max-[760px]:border-x-0 max-[760px]:border-b-0 max-[760px]:px-4 max-[760px]:pt-2 max-[760px]:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]'

/**
 * The grab handle of a bottom sheet; only phones show it, and while it shows the sheet can be pulled down
 * (lib/useSheetDrag.ts): a finger anywhere at the top of its content, a mouse or a pen by the handle, which has a hit
 * area of 96 x 32 px around its bar (35 section 12.2, APL-02).
 */
function SheetGrab({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      data-slot="sheet-grab"
      className={cn(
        "relative mx-auto block h-[5px] w-9 shrink-0 cursor-grab touch-none rounded-full bg-border-strong after:absolute after:-inset-x-[30px] after:-inset-y-[13.5px] after:content-[''] active:cursor-grabbing",
        className,
      )}
    />
  )
}

const tabbableCandidates =
  'a[href],button,input,select,textarea,summary,[tabindex],[contenteditable]:not([contenteditable="false"])'

/** Whether the Tab key stops at an element: not disabled, hidden, inert or taken out of the order. */
function tabbable(element: HTMLElement): boolean {
  return (
    element.tabIndex >= 0 &&
    !element.matches(':disabled, input[type="hidden"]') &&
    element.closest('[inert]') === null &&
    element.checkVisibility()
  )
}

/** The help a popup never opens on: the "i" of a help text and the fold of a key's guide (28 section 13.3, GDE-01). */
const helpSlots = '[data-slot="help-tip"],[data-slot="help-guide"]'

/**
 * The first focus of a dialog, a sheet or an alert, for its `initialFocus` (26 section 5.3, INF-01): Base UI's own
 * choice (the popup itself when a touch opened it, else true: its first tabbable element), unless that is the "i" of
 * a help text (HelpTip) after its title or a field's label, or the summary of a guide's fold at its top (GuideFold,
 * 28 section 13.3), which a popup never opens on: then the first tabbable element after them, so it still opens on
 * its first field or button.
 */
function focusPastHelp(popup: HTMLElement | null, openType: string): HTMLElement | true {
  // As Base UI does: a touch focuses the popup, so no virtual keyboard opens.
  if (openType === 'touch') return popup ?? true
  if (!popup?.querySelector(helpSlots)) return true
  let pastHelp = false
  for (const element of popup.querySelectorAll<HTMLElement>(tabbableCandidates)) {
    if (!tabbable(element)) continue
    if (element.closest(helpSlots)) {
      pastHelp = true
      continue
    }
    return pastHelp ? element : true
  }
  return true
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  initialFocus,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  const { popup, closer, ref } = useSheetPopup()
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        ref={ref}
        data-slot="dialog-content"
        className={cn(dialogPopupClasses, 'max-w-[calc(100%-2rem)] sm:max-w-sm', className)}
        initialFocus={initialFocus ?? ((openType) => focusPastHelp(popup.current, openType))}
        {...props}
      >
        <SheetGrab className="min-[760px]:hidden" />
        <DialogPrimitive.Close ref={closer} hidden data-slot="sheet-drag-close" />
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={<Button variant="ghost" className="absolute end-3 top-3" size="icon-sm" />}
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="dialog-header" className={cn('flex flex-col gap-1', className)} {...props} />
}

/** The footer's classes, shared with the alert dialog. */
const dialogFooterClasses =
  '-mx-6 -mb-6 flex flex-col-reverse gap-3 border-t px-6 pt-4 pb-4 max-[760px]:-mx-4 max-[760px]:px-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end'

/** Why the main action is off, at the start of a dialog footer (above the buttons on phones). */
function DialogFooterReason({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="dialog-footer-reason"
      className={cn('order-last text-footnote text-fg-3 sm:order-first sm:me-auto sm:min-w-0 sm:flex-1', className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  reason,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  showCloseButton?: boolean
  /** Why the main action is off, shown at the footer's start. */
  reason?: React.ReactNode
}) {
  return (
    <div data-slot="dialog-footer" className={cn(dialogFooterClasses, className)} {...props}>
      {reason ? <DialogFooterReason>{reason}</DialogFooterReason> : null}
      {children}
      {showCloseButton && <DialogPrimitive.Close render={<Button variant="outline" />}>Close</DialogPrimitive.Close>}
    </div>
  )
}

/** The look of a dialog's visible description, shared with the note under a title with help. */
const descriptionClasses = 'text-subhead text-fg-2 *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground'

/**
 * A dialog's title. With `help`, the "i" of the dialog's help text follows it (26 section 5.3, INF-01), and the text is
 * the dialog's hidden description, which a screen reader reads when the dialog opens: use it in place of a
 * `DialogDescription`, never with one. A confirmation's message, a warning or a fact stays a visible
 * `DialogDescription` (D-4657); beside `help`, a warning goes into `note`, a visible line under the title that joins
 * the help in the dialog's description (Base UI keeps one description per dialog), so the help and the warning work
 * together (INF-06a).
 */
function DialogTitle({
  className,
  help,
  helpLabel,
  note,
  ...props
}: DialogPrimitive.Title.Props & {
  /** The dialog's help text: what it adds, changes or is for. */
  help?: React.ReactNode
  /** The "i"'s name when the title is not plain words; the title's words by default. */
  helpLabel?: string
  /** A visible line under the title beside `help`: a warning or a fact that must stay in sight (26 section 5.3). */
  note?: React.ReactNode
}) {
  if (!help) {
    const title = (
      <DialogPrimitive.Title
        data-slot="dialog-title"
        className={cn('pe-8 font-heading text-title-3 font-bold', className)}
        {...props}
      />
    )
    if (!note) return title
    return (
      <>
        {title}
        <DialogDescription>{note}</DialogDescription>
      </>
    )
  }
  // The "i" after the title and not in it, whose words name the dialog; the row keeps the room of the close button.
  const row = (
    <HelpRow className="pe-8">
      <DialogPrimitive.Title
        data-slot="dialog-title"
        className={cn('font-heading text-title-3 font-bold', className)}
        {...props}
      />
      <HelpTip label={helpLabel ?? (plainText(props.children) || 'this dialog')}>{help}</HelpTip>
      <DialogPrimitive.Description hidden>
        {help}
        {note ? <> {note}</> : null}
      </DialogPrimitive.Description>
    </HelpRow>
  )
  if (!note) return row
  // The note stays in sight under the title, as a visible description would; the hidden description reads it too.
  return (
    <div className="flex flex-col gap-1">
      {row}
      <p data-slot="dialog-note" className={descriptionClasses}>
        {note}
      </p>
    </div>
  )
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(descriptionClasses, className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogFooterReason,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  SheetDismissContext,
  SheetGrab,
  dialogFooterClasses,
  dialogPopupClasses,
  focusPastHelp,
  useSheetPopup,
}
