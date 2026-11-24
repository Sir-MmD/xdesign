// What the keyboard editing reads of a step, and the label of a new button.
import { type Button, type InvoiceStep, type Keyboard, telegram } from '@xdesign/spec'

import type { SendingStep } from '../../map/arrows'

/** The keyboard of a message or an invoice, or of a question's prompt. */
export function keyboardOf(step: SendingStep): Keyboard {
  return step.kind === 'question' ? step.prompt.keyboard : step.keyboard
}

/**
 * A button as the phone draws it on an invoice: a subscription's pay button is a url button with
 * its invoice link, as the bot sends it (createInvoiceLink, PAY-02).
 */
export function payAsLink(step: InvoiceStep, button: Button): Button {
  if (step.invoice.subscription === undefined || button.place !== 'inline' || button.action.type !== 'pay')
    return button
  return { ...button, action: { type: 'url', url: '' } }
}

/** A new button's text in the design's default language, chosen whole in its popover so typing replaces it. */
export const NEW_LABEL = 'Button'

/** A keyboard type's or option's words, from the catalog (KEYBOARD_TYPES and KEYBOARD_OPTIONS). */
export function keyboardWords(id: string): string {
  const row = [...telegram.KEYBOARD_TYPES, ...telegram.KEYBOARD_OPTIONS].find((item) => item.id === id)
  return row && 'label' in row ? row.label : id
}

/** The most buttons a row and a keyboard hold (the catalog's observed limits). */
export function buttonLimits(place: 'inline' | 'reply'): { row: number; all: number } {
  return place === 'inline'
    ? { row: telegram.limit('inlineButtonsPerRow').max, all: telegram.limit('inlineButtons').max }
    : { row: telegram.limit('replyButtonsPerRow').max, all: telegram.limit('replyButtons').max }
}
