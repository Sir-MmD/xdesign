// The editable slots of the phone (PRV-02, docs/plan/04-editor.md sections 4.4 and 5): the web
// app draws a part of a bot's message or of the chat in place of the read-only drawing (TXT-01
// the text, MSG-01 the media, BTN-01 the inline and the bottom keyboard, M4). Without a slot the
// part is drawn read-only. ChatPresses make the chat act (Try it, TRY-02).
import type { KeyboardEvent, ReactNode } from 'react'

/** Draws a part in its place: it gets the read-only drawing (null where there is none) and returns what shows there. */
export type Slot = (shown: ReactNode) => ReactNode

/**
 * The slots of a bot's message: its text (or caption, or a poll's question), its media, its inline
 * keyboard, and a poll's or quiz's option texts by index (MSG-03).
 */
export interface MessageSlots {
  text?: Slot | undefined
  media?: Slot | undefined
  keyboard?: Slot | undefined
  option?: ((index: number, shown: ReactNode) => ReactNode) | undefined
}

/**
 * The slots of the chat: those of its last bot message, and the bottom keyboard; with `each`, the
 * slots of every bot message by its row's key instead (Try it's whole conversation).
 */
export interface ChatSlots extends MessageSlots {
  replyKeyboard?: Slot | undefined
  each?: ((key: string) => MessageSlots | undefined) | undefined
}

/**
 * A button of the input field that acts: the menu button, the attach button, the bottom keyboard's
 * button, send, the empty chat's Start button, and Restart once the user blocked the bot (EVT-02).
 */
export type ComposerPress = 'menu' | 'attach' | 'keyboard' | 'send' | 'start' | 'restart'

/**
 * What acts in the chat when pressed (Try it, TRY-02, 04 section 8); without it only the alert's
 * button does. Inline buttons by their row's key, line and place; bottom keyboard buttons by line
 * and place; the open commands menu's commands; the input field's buttons; and the field itself,
 * which then takes typed text (Enter sends).
 */
export interface ChatPresses {
  inline?: ((row: string, line: number, button: number) => void) | undefined
  /** A button inside a row's rich message: the button row's number among its button rows, and its place (RICH-02). */
  inside?: ((row: string, line: number, button: number) => void) | undefined
  /** A vote in a row's poll or quiz (its option indexes), and the price button of its paid media (MSG-03). */
  vote?: ((row: string, options: number[]) => void) | undefined
  unlock?: ((row: string) => void) | undefined
  /** The payment sheet's "Pay (test)" with the shipping option chosen, and "Cancel" (PAY-02). */
  pay?: ((shipping: string | undefined) => void) | undefined
  cancelPayment?: (() => void) | undefined
  reply?: ((line: number, button: number) => void) | undefined
  command?: ((command: string) => void) | undefined
  composer?: ((part: ComposerPress) => void) | undefined
  field?: { value: string; onChange: (value: string) => void; onEnter: () => void } | undefined
}

/** The props that make a drawn part a button (by mouse, Enter or Space); none without `onPress`. */
export function pressProps(onPress: (() => void) | undefined) {
  if (!onPress) return {}
  return {
    role: 'button',
    tabIndex: 0,
    'data-press': '',
    onClick: onPress,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      onPress()
    },
  }
}

/** Whether a slot drew something. */
export function drawn(node: ReactNode): boolean {
  return node !== null && node !== undefined && node !== false
}
