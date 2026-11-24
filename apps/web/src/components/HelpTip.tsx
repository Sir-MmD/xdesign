import type { ComponentProps, ReactNode } from 'react'

import { InfoTip } from '@/components/InfoTip'
import { plainText } from '@/components/plainText'
import { cn } from '@/lib/utils'

export interface HelpTipProps {
  /** What the help explains, in plain words (a field's label, a section's title): the "i" is "About <label>". */
  label: string
  /** The help text: what the field, switch, section or dialog is or does. */
  children: ReactNode
  /**
   * The ID of a hidden copy of the text, for the `aria-describedby` of the control, group, heading or dialog that the
   * text explains: a screen reader still reads the help with it (26 section 5.3, D-4655). Leave it out when nothing
   * points at the text.
   */
  id?: string | undefined
  className?: string
  'data-testid'?: string
}

/**
 * The "i" of a help text (26 section 5.3, INF-01): a 16 px "i" right after a field's label, a switch's label, a
 * section's title or a dialog's title, which opens a small box with the text when pointed at (after a short moment),
 * focused with Tab or tapped; leaving it, a tap elsewhere or Escape closes it. A press on it never toggles or focuses
 * the field it explains. Put it right after the label element (never inside the `<label>`, whose words name the
 * field), in a `HelpRow`. With `id`, the text also stays in the page as hidden text that `aria-describedby` points at
 * (hidden, so a link in it is no Tab stop nobody sees). Warnings, problems and values stay visible lines instead
 * (D-4637, D-4659).
 */
export function HelpTip({ label, children, id, className, 'data-testid': testId }: HelpTipProps) {
  return (
    <>
      <InfoTip size="field" label={label} className={className} data-testid={testId}>
        {children}
      </InfoTip>
      {id === undefined ? null : (
        <span id={id} hidden>
          {children}
        </span>
      )}
    </>
  )
}

/**
 * A label, a title or a control's text with its `HelpTip`: the "i" 4 px after it on the same line, centered on it
 * (26 section 5.3, D-4655).
 */
export function HelpRow({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="help-row" className={cn('flex min-w-0 items-center gap-1', className)} {...props} />
}

/**
 * The words of a group's legend with the "i" of its help text after them, as `ChoiceField` draws its own (26 section
 * 5.3; the writer editor's and API settings' pieces of INF-02a and INF-03a, one piece since INF-06c): put it in the
 * legend (a legend holds phrasing content, so it is a span). The fieldset takes `aria-labelledby` to `${id}-label`, so
 * the words without the "i" name the group, and `aria-describedby` to `${id}-description`, the hidden copy of the help.
 */
export function LegendHelp({
  id,
  label,
  helpLabel,
  children,
  'data-testid': testId,
}: {
  /** The prefix of the label's and the help's IDs. */
  id: string
  label: ReactNode
  /** The "i"'s name when the label is not plain words; the label's words by default. */
  helpLabel?: string
  /** The help text. */
  children: ReactNode
  /** The test ID of the "i". */
  'data-testid'?: string
}) {
  return (
    <span className="flex min-w-0 items-center gap-1">
      <span id={`${id}-label`}>{label}</span>
      <HelpTip label={helpLabel ?? (plainText(label) || 'this field')} id={`${id}-description`} data-testid={testId}>
        {children}
      </HelpTip>
    </span>
  )
}
