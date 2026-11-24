import { InfoIcon } from 'lucide-react'
import { type ReactNode, useRef, useState } from 'react'

import { Popover, PopoverContent, PopoverDescription, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface InfoTipProps {
  /** What the text is about: screen readers hear the button and the box as "About <label>". */
  label: string
  /** The text in the box, for example a page's description. */
  children: ReactNode
  /**
   * `bar`: a 28 px round button, the top bar's "i" of a page's description (UI-28; the default). `field`: a 16 px "i"
   * right after a label or a title, with a touch target of 24 px (32 px below 760 px), the `HelpTip` of a help text
   * (26 section 5.3, INF-01).
   */
  size?: 'bar' | 'field'
  className?: string
  'data-testid'?: string
}

const sizeClasses = {
  bar: 'grid size-7 rounded-full hover:bg-surface-2 hover:text-brand aria-expanded:bg-brand-weak aria-expanded:text-brand',
  // The touch target is a transparent box around the icon, so the "i" takes no more room in its row than the icon.
  field:
    'relative inline-grid size-4 rounded-full align-middle after:absolute after:-inset-1 hover:text-foreground aria-expanded:text-foreground max-[760px]:after:-inset-2',
} as const

/** Whether the focus came from the keyboard (`:focus-visible`); false where the browser cannot tell. */
function keyboardFocus(element: Element): boolean {
  try {
    return element.matches(':focus-visible')
  } catch {
    return false
  }
}

/**
 * An "i" button that shows a text in a small box, in the popover look (the owner's list of 2026-10-14 (M48), UI-28):
 * pointing at it, focusing it with the keyboard or tapping it opens the box; Escape, a tap outside or leaving it closes
 * it. The keyboard's focus stays on the button: Enter or Space then moves into the box, where a screen reader reads
 * the text as the box's description, and Tab moves on into a link the text may hold.
 *
 * The field size (HelpTip, 26 section 5.3, INF-01) is not a form control but an element with the button role, so it
 * works in a disabled fieldset (a view-only form, a disabled group of choices), and a press on it opens its box and
 * does nothing else: inside a label it does not toggle the label's switch or checkbox or focus its field.
 */
export function InfoTip({ label, children, size = 'bar', className, 'data-testid': testId }: InfoTipProps) {
  const [open, setOpen] = useState(false)
  const popup = useRef<HTMLDivElement>(null)
  // The box opened because the keyboard focused the button; the focus then stays on the button.
  const byFocus = useRef(false)
  // Closed with Escape or the button: the focus that comes back to the button must not open the box again, until the
  // focus or the pointer leaves the button (as Base UI's tooltips do).
  const blocked = useRef(false)
  const field = size === 'field'
  return (
    <Popover
      open={open}
      onOpenChange={(next, details) => {
        if (!next) {
          byFocus.current = false
          blocked.current = details.reason === 'escape-key' || details.reason === 'trigger-press'
        }
        setOpen(next)
      }}
    >
      <PopoverTrigger
        openOnHover
        aria-label={`About ${label}`}
        data-testid={testId}
        {...(field ? { nativeButton: false, render: <span />, 'data-slot': 'help-tip' } : {})}
        onFocus={(event) => {
          if (open || blocked.current || !keyboardFocus(event.currentTarget)) return
          byFocus.current = true
          setOpen(true)
        }}
        onBlur={() => {
          blocked.current = false
        }}
        onMouseLeave={() => {
          blocked.current = false
        }}
        onClick={(event) => {
          // A label around the "i" must not take the press as a press on the label (26 section 5.3, INF-01).
          if (field) event.preventDefault()
          if (!open || !byFocus.current) return
          // Open from the focus: Enter or Space moves into the box instead of closing it.
          event.preventBaseUIHandler()
          byFocus.current = false
          popup.current?.focus()
        }}
        className={cn(
          'shrink-0 place-items-center text-fg-3 transition-colors duration-(--dur-fast) ease-(--ease) [&_svg]:size-4',
          sizeClasses[size],
          className,
        )}
      >
        <InfoIcon aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        ref={popup}
        aria-label={`About ${label}`}
        side="bottom"
        align="start"
        // Opened by the focus, the focus stays on the button; a tap focuses the box itself (Base UI's default).
        initialFocus={(type) => !byFocus.current && (type === 'touch' ? popup.current : true)}
        className="w-max max-w-[min(20rem,calc(100vw-2rem))]"
      >
        {/* A div and not Base UI's p, so a text may hold paragraphs and a list (the guides of 28 section 13.3). */}
        <PopoverDescription render={<div />}>{children}</PopoverDescription>
      </PopoverContent>
    </Popover>
  )
}
