// The state of the Try it engine (docs/plan/04-editor.md section 8). It is a plain object that is
// never changed in place: every action returns a new one, so the UI can keep a history for
// "Step back". Texts in it are already resolved for the tester (language, variables, parts).
import type { InlineAction, Look, ReplyAction } from '../model/buttons.ts'
import type { Condition } from '../model/conditions.ts'
import type { Content, MediaSlot, RichMessageBlock } from '../model/content.ts'
import type { Design } from '../model/design.ts'
import type { ButtonId, Lang, StepId, SwitchId, Target, VarId } from '../model/ids.ts'
import type { ChatAction, Options } from '../model/options.ts'
import type { WaitStep } from '../model/steps.ts'
import type { RichTextRef } from '../model/texts.ts'
import type { TriggerType } from '../model/triggers.ts'
import type { Variable } from '../model/variables.ts'
import type { RichDoc } from '../text/schema.ts'

/** A variable's value while trying: text, a number, or yes or no. */
export type SimValue = string | number | boolean

/** The values set while trying, by variable ID; null is a cleared variable. */
export type SimVars = Partial<Record<VarId, SimValue | null>>

/** The built-in variables the tester sets, by ID name (the language comes from `language`). */
export type SimBuiltin = 'first_name' | 'last_name' | 'username' | 'user_id' | 'is_premium'

/**
 * The test user: the language, the test switch values and the built-in values; `dice` is the
 * value the next dice shows (a random one when it is unset or does not fit the emoji).
 */
export type SimTestUser = {
  language: Lang
  switches: Partial<Record<SwitchId, boolean | string>>
  builtins: Partial<Record<SimBuiltin, SimValue>>
  dice?: number
}

// Content with every rich text resolved into one document in the tester's language.
type Resolved<T> = T extends RichTextRef
  ? RichDoc
  : T extends readonly (infer U)[]
    ? Resolved<U>[]
    : T extends object
      ? { [K in keyof T]: Resolved<T[K]> }
      : T

type ResolvedContent = Resolved<Content>
// A poll or quiz with its options in the tester's language.
type SimPoll<K> = Omit<Extract<ResolvedContent, { type: K }>, 'options'> & { options: string[] }

// A block of a rich message with its texts resolved; a `buttons` block holds its buttons.
export type SimRichBlock =
  | Exclude<Resolved<RichMessageBlock>, { type: 'buttons' }>
  | { type: 'buttons'; buttons: SimInlineButton[]; align?: 'left' | 'center' | 'right' }
type SimRich = { type: 'rich'; blocks: SimRichBlock[]; rtl?: boolean }

export type SimShippingOption = { id: string; title: string; amount: number }

/**
 * An invoice as the phone shows it, its texts in the tester's language; amounts are in the
 * smallest unit of the currency. `physical`: what the payment sheet asks for (null for digital
 * goods); `shipping`: the options it offers with flexible shipping, else null.
 */
export type SimInvoice = {
  type: 'invoice'
  title: string
  description: string
  photo?: MediaSlot
  currency: string
  prices: { label: string; amount: number }[]
  total: number
  subscription?: { periodDays: number }
  physical: { needName: boolean; needPhone: boolean; needEmail: boolean; needAddress: boolean } | null
  shipping: SimShippingOption[] | null
}

/** A gift the bot sent (an action step): which gift in words, its text, and whether its upgrade is paid. */
export type SimGift = { type: 'gift'; description: string; text: RichDoc | null; payForUpgrade: boolean }

/**
 * A message's content as the phone shows it: the model's content with each rich text resolved,
 * a poll's or quiz's options as texts, the buttons inside a rich message, an invoice, or a gift.
 */
export type SimContent =
  | Exclude<ResolvedContent, { type: 'poll' | 'quiz' | 'rich' }>
  | SimPoll<'poll'>
  | SimPoll<'quiz'>
  | SimRich
  | SimInvoice
  | SimGift

/** The bot's reaction on a message (an action step), played large with `big`. */
export type SimReaction = { emoji: string; big: boolean }

export type SimIcon = { customEmojiId: string; fallback: string }

export type SimInlineButton = {
  id: ButtonId
  label: string
  look: Look
  icon?: SimIcon
  // Shown but does nothing (Bot API 10.3).
  disabled: boolean
  action: InlineAction['type']
  // The address of a url or loginUrl button, or the text of a copyText button, filled in.
  value?: string
}

export type SimReplyButton = { id: ButtonId; label: string; look: Look; icon?: SimIcon; action: ReplyAction['type'] }

export type SimBotEntry = {
  id: string
  from: 'bot'
  // The message or question step it shows (a wrong-answer message has its question's step).
  step: StepId
  content: SimContent
  keyboard: SimInlineButton[][] | null
  options: Options
  edited: boolean
  deleted: boolean
  // A poll or quiz: the options the tester voted for, once voted.
  vote?: number[]
  // A dice: the value it shows.
  dice?: number
  // Paid media or an invoice: false until "Pay (test)".
  paid?: boolean
  // A draft the tester stopped and that stays (keep_on_stop): the part written, 0 to 1 (RICH-02).
  stopped?: number
  reaction?: SimReaction
}

/** The kinds of file a tester can send ("Send a test photo/file"). */
export type SimMediaKind = 'photo' | 'video' | 'file' | 'voice' | 'audio'

/** What the tester sent; `unexpected` is the start point "A message the bot does not expect". */
export type SimSent =
  | { type: 'text'; text: string }
  | { type: 'media'; kind: SimMediaKind; name: string }
  | { type: 'contact'; phone: string }
  | { type: 'location'; latitude: number; longitude: number }
  | { type: 'users'; userId: number }
  | { type: 'chat'; chatId: number; channel: boolean }
  | { type: 'poll'; question: string; quiz: boolean }
  | { type: 'unexpected' }

export type SimUserEntry = {
  id: string
  from: 'user'
  sent: SimSent
  // The bot message it answers while a force reply was open.
  replyTo?: string
  reaction?: SimReaction
}

export type SimEntry = SimBotEntry | SimUserEntry

export type SimBottomKeyboard = {
  // The message that showed it.
  entryId: string
  rows: SimReplyButton[][]
  oneTime: boolean
  persistent: boolean
  resize: boolean
  placeholder: string | null
  // A one-time keyboard folds away once used; the keyboard button in the input field opens it.
  collapsed: boolean
}

export type SimPopup = { kind: 'toast' | 'alert'; text: string }

/** How the next message shows: through the inline button pressed on message `entryId`. */
export type SimVia = { show: 'edit' | 'new' | 'replace'; entryId: string }

/**
 * A message held back by its options: first `seconds` of nothing (delaySec), then the chat
 * action for its seconds ("typing..."), then the message. skipWait() sends it.
 */
export type SimDelay = {
  step: StepId
  seconds: number
  chatAction: { action: ChatAction; seconds: number } | null
  via: SimVia | null
}

/**
 * A message written out like a draft with a stop button (can_stop, RICH-02): it shows without
 * its keyboard while it is written; skipWait() (or any other action of the tester) sends it
 * whole and goes on, stopDraft() stops it and takes "If the user stops it".
 */
export type SimWriting = { entryId: string; step: StepId }

export type SimOption = { id: string; label: string; goTo?: Target }

/**
 * What the engine cannot decide alone: an "If" ("Which way?"), a developer step's outcome, a wait
 * ("Skip the wait", with a reminder's `stopWhen`), or an invoice's pre-checkout check ("OK" or
 * "Refuse", for the invoice of message `entryId` with the shipping option chosen). `prompt` is the
 * card's text.
 */
export type SimChoice = { step: StepId; prompt: string; options: SimOption[]; via: SimVia | null } & (
  | { kind: 'if' }
  | { kind: 'devStep' }
  | {
      kind: 'wait'
      amount: number
      unit: WaitStep['unit']
      ifUserActs: WaitStep['ifUserActs']
      stopWhen?: Condition
    }
  | { kind: 'checkout'; entryId: string; shipping: SimShippingOption | null }
)

/** The payment sheet open on the invoice of message `entryId` (its pay button was pressed). */
export type SimPayment = { entryId: string; step: StepId }

/** The invoice steps paid while trying: a subscription, and whether a refund gave it back. */
export type SimPayments = Partial<Record<StepId, { subscription: boolean; refunded: boolean }>>

/** A step that ran or a button that was pressed, in order (the path on the map). */
export type SimPathItem = { type: 'step'; id: StepId } | { type: 'button'; id: ButtonId }

export type SimState = {
  chat: SimEntry[]
  bottomKeyboard: SimBottomKeyboard | null
  // The input field: its placeholder, and the message a force reply answers.
  placeholder: string | null
  forceReply: { entryId: string; placeholder: string | null } | null
  popup: SimPopup | null
  delay: SimDelay | null
  writing: SimWriting | null
  // The question waiting for an answer and the wrong answers so far.
  question: { step: StepId; tries: number } | null
  choice: SimChoice | null
  // The payment sheet, and the invoices paid so far (hasPaid and subscribed read them).
  payment: SimPayment | null
  payments: SimPayments
  // The user blocked the bot ("User blocks the bot"): nothing reaches them and they can only
  // restart it.
  blocked: boolean
  // The pinned messages by entry, in the order pinned (the pinned bar shows the last).
  pinned: string[]
  vars: SimVars
  path: SimPathItem[]
  // The message and question steps shown, for the `back` target (which goes past questions).
  backHistory: StepId[]
  ended: boolean
  // What happened, in plain words ("Showed Main menu by editing the message").
  log: string[]
  // Steps run since the tester last acted (the loop guard), and the number of the next entry.
  stepsSinceAction: number
  nextEntry: number
}

/**
 * Where a try starts: a start point, and for a start link the payload ("ref_123"); any other step
 * runs from it without a message from the tester (Try it from the selected step).
 */
export type SimStartEntry = { step: StepId; payload?: string }

/** A start point for the "Start from" picker. */
export type SimStartPoint = { step: StepId; type: TriggerType; label: string }

/**
 * The engine for one design and one test user. Each action takes a state and returns the next;
 * an action that does not apply (a button no longer shown, anything but choose() while an "If"
 * or a developer step waits for a choice) returns the same state.
 */
export type Sim = {
  initial: SimState
  start: (state: SimState, entry: SimStartEntry) => SimState
  pressInline: (state: SimState, entryId: string, buttonId: ButtonId) => SimState
  pressReply: (state: SimState, buttonId: ButtonId) => SimState
  sendText: (state: SimState, text: string) => SimState
  sendMedia: (state: SimState, kind: SimMediaKind) => SimState
  // Without a button these send from the attachment menu; with one, that button's goTo and saveTo apply.
  sharePhone: (state: SimState, buttonId?: ButtonId) => SimState
  shareLocation: (state: SimState, buttonId?: ButtonId) => SimState
  pickUsers: (state: SimState, buttonId?: ButtonId) => SimState
  pickChat: (state: SimState, buttonId?: ButtonId) => SimState
  createPoll: (state: SimState, buttonId?: ButtonId) => SimState
  // Votes in the poll or quiz of message `entryId` (option indexes); its "then" runs after the vote.
  vote: (state: SimState, entryId: string, options: readonly number[]) => SimState
  // "Pay (test)": the paid media of message `entryId` shows unlocked; the invoice of message
  // `entryId`, its payment sheet open, is paid (with a shipping option of its flexible shipping),
  // after its pre-checkout check.
  pay: (state: SimState, entryId: string, shippingId?: string) => SimState
  // "Cancel" on the payment sheet: it closes, nothing is paid.
  cancelPayment: (state: SimState) => SimState
  choose: (state: SimState, optionId: string) => SimState
  // "Stop" on a draft being written (`writing`), `written` its part written so far (0 to 1).
  stopDraft: (state: SimState, written: number) => SimState
  // Sends a held-back message, or skips a wait ("Skip the wait", the events menu's "Time passes"):
  // a reminder whose `stopWhen` holds stops instead.
  skipWait: (state: SimState) => SimState
  dismissPopup: (state: SimState) => SimState
  // The events menu: "User blocks the bot" (its start point runs; nothing reaches the user and the
  // tester can only restart), "User restarts the bot" (its start point runs).
  blockBot: (state: SimState) => SimState
  restartBot: (state: SimState) => SimState
}

// What every part of the engine reads (not exported from the package).
export type SimContext = { design: Design; user: SimTestUser; byIdName: ReadonlyMap<string, Variable> }
