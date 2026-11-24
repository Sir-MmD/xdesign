// The Try it engine (docs/plan/04-editor.md section 8): a pure state machine over the plain model,
// with no timers and no DOM. createSim binds a design and a test user; each action takes a state
// and returns a new one. Steps run until the bot waits for the tester (buttons, a question, a
// vote in a poll or quiz), for a choice it cannot make (an "If", a developer step, a wait) or for
// a message's delay; at most 100 steps run without the tester acting. A dice rolls when it is
// shown (the test user's value, else a random one); paid media shows locked until "Pay (test)". A
// vote or a roll goes in the message's `saveTo` variable (a vote not from an anonymous poll). An
// invoice waits for its pay button: the payment sheet's "Pay (test)" runs the pre-checkout check
// (a choice) and then "Paid"; "Cancel" closes the sheet. Actions react, pin, unpin, delete, send a
// gift, show a chat action or refund. Once the user blocks the bot nothing reaches them (messages
// and chat actions are not delivered) until they restart it; a reminder (a wait with `stopWhen`)
// stops once its conditions hold; a broadcast skips a test user outside its audience. A message
// written out like a draft with a stop button waits until it is written or stopped (RICH-02).
import type { Action } from '../model/actions.ts'
import type { Keyboard, ReplyAction, ReplyButton } from '../model/buttons.ts'
import type { DiceEmoji } from '../model/content.ts'
import type { Design } from '../model/design.ts'
import type { ButtonId, StepId, Target } from '../model/ids.ts'
import type { Options } from '../model/options.ts'
import {
  type ActionStep,
  draftStops,
  type InvoiceStep,
  type MessageStep,
  type Outcome,
  type QuestionStep,
  type StartStep,
  type Step,
  type WaitStep,
} from '../model/steps.ts'
import type { Trigger } from '../model/triggers.ts'
import { chatAction } from '../telegram/chatActions.ts'
import { reactionEmoji } from '../telegram/events.ts'
import { limit } from '../telegram/limits.ts'
import { DICE } from '../telegram/messages.ts'
import { priceText } from '../telegram/payments.ts'
import { plainText } from '../text/schema.ts'
import { answerValue, isCancelWord, SIM_TEST_VALUES, sentValue, testFileName } from './answers.ts'
import { fill, inlineRows, langText, replyRows, richText, simContent, simInvoice } from './texts.ts'
import type {
  Sim,
  SimBotEntry,
  SimChoice,
  SimContent,
  SimContext,
  SimInlineButton,
  SimSent,
  SimShippingOption,
  SimStartEntry,
  SimStartPoint,
  SimState,
  SimTestUser,
  SimUserEntry,
  SimValue,
  SimVars,
  SimVia,
} from './types.ts'
import { conditionTruth, decide, remember } from './values.ts'

const MAX_STEPS = 100
const NOTHING = 'Nothing happens next'
const SKIP = 'skip'
// The pay button Telegram shows on an invoice sent without a keyboard, and the pre-checkout
// check's ways.
const PAY = 'pay'
const OK = 'ok'
const REFUSE = 'refuse'

type Request = Exclude<ReplyAction['type'], 'text'>

/** The engine for a design and a test user; `initial` is the empty chat before a start point. */
export function createSim(design: Design, user: SimTestUser): Sim {
  const ctx: SimContext = {
    design,
    user,
    byIdName: new Map(Object.values(design.variables).map((variable) => [variable.idName, variable])),
  }
  // The built-in variables start with the tester's values, else their test values.
  const builtins: Partial<Record<string, SimValue>> = user.builtins
  const vars: SimVars = {}
  for (const variable of Object.values(design.variables)) {
    if (variable.source !== 'builtin') continue
    const value = variable.idName === 'language' ? user.language : (builtins[variable.idName] ?? variable.testValue)
    if (value !== undefined) vars[variable.id] = value
  }
  const initial: SimState = {
    chat: [],
    bottomKeyboard: null,
    placeholder: null,
    forceReply: null,
    popup: null,
    delay: null,
    writing: null,
    question: null,
    choice: null,
    payment: null,
    payments: {},
    blocked: false,
    pinned: [],
    vars,
    path: [],
    backHistory: [],
    ended: false,
    log: [],
    stepsSinceAction: 0,
    nextEntry: 1,
  }
  // A user who blocked the bot can do nothing in its chat but restart it.
  const open = (state: SimState, act: () => SimState) => (state.blocked ? state : act())
  return {
    initial,
    start: (state, entry) => start(ctx, state, entry),
    pressInline: (state, entryId, buttonId) => open(state, () => pressInline(ctx, state, entryId, buttonId)),
    pressReply: (state, buttonId) => open(state, () => pressReply(ctx, state, buttonId)),
    sendText: (state, text) =>
      text.trim() === '' ? state : open(state, () => userSends(ctx, state, { type: 'text', text })),
    sendMedia: (state, kind) =>
      open(state, () =>
        userSends(ctx, state, { type: 'media', kind, name: testFileName(kind, waitingFileTypes(ctx, state)) }),
      ),
    sharePhone: (state, buttonId) => open(state, () => request(ctx, state, 'sharePhone', buttonId)),
    shareLocation: (state, buttonId) => open(state, () => request(ctx, state, 'shareLocation', buttonId)),
    pickUsers: (state, buttonId) => open(state, () => request(ctx, state, 'pickUsers', buttonId)),
    pickChat: (state, buttonId) => open(state, () => request(ctx, state, 'pickChat', buttonId)),
    createPoll: (state, buttonId) => open(state, () => request(ctx, state, 'createPoll', buttonId)),
    vote: (state, entryId, options) => open(state, () => vote(ctx, state, entryId, options)),
    pay: (state, entryId, shippingId) => open(state, () => pay(ctx, state, entryId, shippingId)),
    cancelPayment: (state) => cancelPayment(state),
    choose: (state, optionId) => choose(ctx, state, optionId),
    stopDraft: (state, written) => open(state, () => stopDraft(ctx, state, written)),
    skipWait: (state) => skipWait(ctx, state),
    dismissPopup: (state) => (state.popup ? { ...state, popup: null } : state),
    blockBot: (state) =>
      state.blocked
        ? state
        : personActs(ctx, state, (d) => {
            setBlocked(ctx, d, true)
          }),
    restartBot: (state) =>
      state.blocked
        ? personActs(ctx, state, (d) => {
            setBlocked(ctx, d, false)
          })
        : state,
  }
}

/** The test user a new try starts with: the default language and every switch's test value. */
export function defaultSimUser(design: Design): SimTestUser {
  const switches = Object.fromEntries(Object.values(design.switches).map((item) => [item.id, item.testValue]))
  return { language: design.languages.default, switches, builtins: {} }
}

function startLabel(trigger: Trigger): string {
  switch (trigger.type) {
    case 'command':
      return `/${trigger.command}`
    case 'startLink':
      return `/start ${trigger.payload}`
    case 'fallback':
      return 'A message the bot does not expect'
    case 'paymentDone':
      return 'A payment arrives'
    case 'refunded':
      return 'A payment is refunded'
    case 'subscriptionChanged':
      return 'A subscription changes'
    case 'userBlocks':
      return 'User blocks the bot'
    case 'userRestarts':
      return 'User restarts the bot'
    case 'broadcast':
      return 'A broadcast'
  }
}

function startSteps(design: Design): StartStep[] {
  return Object.values(design.steps).filter((step): step is StartStep => step.kind === 'start')
}

// The start points after /start in the picker's order.
const START_ORDER: readonly Trigger['type'][] = [
  'command',
  'startLink',
  'fallback',
  'paymentDone',
  'refunded',
  'subscriptionChanged',
  'userBlocks',
  'userRestarts',
  'broadcast',
]

// The start points that a message from the user starts.
const takesMessage = (trigger: Trigger) =>
  trigger.type === 'command' || trigger.type === 'startLink' || trigger.type === 'fallback'

/**
 * The "Start from" picker: /start, the other commands, the start links, the fallback, then the
 * payment and event start points.
 */
export function simStartPoints(design: Design): SimStartPoint[] {
  const order = (step: StartStep) =>
    step.trigger.type === 'command' && step.trigger.command === 'start' ? 0 : START_ORDER.indexOf(step.trigger.type) + 1
  return startSteps(design)
    .toSorted((a, b) => order(a) - order(b))
    .map((step) => ({ step: step.id, type: step.trigger.type, label: startLabel(step.trigger) }))
}

// A copy whose arrays and variables belong to the action; entries and other objects in it are
// replaced, never changed.
function draft(s: SimState): SimState {
  return {
    ...s,
    chat: [...s.chat],
    vars: { ...s.vars },
    payments: { ...s.payments },
    pinned: [...s.pinned],
    path: [...s.path],
    backHistory: [...s.backHistory],
    log: [...s.log],
  }
}

function nextId(d: SimState): string {
  const id = `e${String(d.nextEntry)}`
  d.nextEntry += 1
  return id
}

function title(step: Step): string {
  return step.title.trim() || step.idName
}

function varName(ctx: SimContext, id: string): string {
  return ctx.design.variables[id]?.idName ?? id
}

function setInput(d: SimState): void {
  d.placeholder = d.forceReply?.placeholder ?? d.bottomKeyboard?.placeholder ?? null
}

/**
 * Runs an action of the tester. While an "If" or a developer step waits for a choice nothing
 * else applies. A message still held back by its delay, or being written out like a draft, goes
 * out first. A wait is cancelled, or with `ifUserActs: keep` comes back once the action is done; a
 * reminder (`stopWhen`) comes back unless its conditions hold after the action.
 */
function personActs(ctx: SimContext, s: SimState, act: (d: SimState) => void): SimState {
  if (s.choice && s.choice.kind !== 'wait') return s
  const d = draft(s)
  d.popup = null
  d.payment = null
  while (d.delay || d.writing) {
    if (d.writing) written(ctx, d)
    else resume(ctx, d)
  }
  if (d.choice && d.choice.kind !== 'wait') return d
  const wait = d.choice
  if (wait) {
    d.choice = null
    if (wait.ifUserActs === 'cancel' && !wait.stopWhen) d.log.push('The wait was cancelled')
  }
  d.stepsSinceAction = 0
  act(d)
  return keepWait(ctx, d, wait)
}

function keepWait(ctx: SimContext, d: SimState, wait: SimChoice | null): SimState {
  if (wait?.kind !== 'wait' || (wait.ifUserActs !== 'keep' && !wait.stopWhen)) return d
  if (wait.stopWhen && stops(ctx, d, wait.stopWhen)) {
    d.log.push('The reminder stopped waiting: its conditions hold')
    return d
  }
  if (d.choice) d.log.push('The wait was dropped: another choice is open')
  else d.choice = wait
  return d
}

// A reminder's conditions hold (one that cannot be decided does not stop it).
function stops(ctx: SimContext, d: SimState, when: NonNullable<WaitStep['stopWhen']>): boolean {
  return conditionTruth(ctx, d.vars, when, d.payments) === true
}

function resume(ctx: SimContext, d: SimState): void {
  const { delay } = d
  if (!delay) return
  d.delay = null
  run(ctx, d, delay.step, delay.via, delay.step)
}

// The draft being written is sent whole: its keyboard applies and the message goes on.
function written(ctx: SimContext, d: SimState): void {
  const { writing } = d
  if (!writing) return
  d.writing = null
  const step = ctx.design.steps[writing.step]
  const index = d.chat.findIndex((item) => item.id === writing.entryId)
  const entry = d.chat[index]
  if (step?.kind !== 'message' || entry?.from !== 'bot') return
  const sent: SimBotEntry = { ...entry, keyboard: inlineKeyboard(ctx, d, step.keyboard) }
  d.chat[index] = sent
  applyKeyboard(ctx, d, sent.id, step.keyboard)
  setInput(d)
  const next = goesOn(d, step, sent)
  if (next !== undefined) run(ctx, d, next, null)
}

// "Stop" on the draft being written: the message is not sent; the draft stays as written when it
// keeps (keep_on_stop), else it goes; then "If the user stops it".
function stopDraft(ctx: SimContext, s: SimState, part: number): SimState {
  const { writing } = s
  if (!writing) return s
  const d = draft(s)
  d.writing = null
  d.popup = null
  d.stepsSinceAction = 0
  const step = ctx.design.steps[writing.step]
  const index = d.chat.findIndex((item) => item.id === writing.entryId)
  const entry = d.chat[index]
  if (step?.kind !== 'message' || entry?.from !== 'bot') return d
  const keep = step.options.draftKeep === true
  d.chat[index] = keep ? { ...entry, stopped: Math.min(1, Math.max(0, part)) } : { ...entry, deleted: true }
  d.log.push(`Stopped ${title(step)} while it was written${keep ? ': what was written stays' : ''}`)
  run(ctx, d, step.onStop, null)
  return d
}

// The `back` target: the message step before the current one, past any question asked since.
function back(ctx: SimContext, d: SimState): StepId | undefined {
  for (;;) {
    d.backHistory.pop()
    const top = d.backHistory.at(-1)
    if (top === undefined || ctx.design.steps[top]?.kind === 'message') return top
  }
}

// A step that shows a message: a message, a question's prompt or an invoice.
type ShowingStep = MessageStep | QuestionStep | InvoiceStep

// Holds a message back when its options ask for a delay or a chat action first.
function hold(d: SimState, step: ShowingStep, via: SimVia | null): boolean {
  const options = step.kind === 'question' ? step.prompt.options : step.options
  const seconds = Math.max(0, options.delaySec ?? 0)
  if (seconds === 0 && !options.chatAction) return false
  d.delay = { step: step.id, seconds, chatAction: options.chatAction ?? null, via }
  return true
}

const shownAs = { edit: 'by editing the message', new: 'as a new message', replace: 'by replacing the message' }

// Shows a message, a question's prompt or an invoice (`shown`, resolved for the tester): edits
// the clicked message, or adds a new one (deleting the clicked one for `replace`), and applies its
// keyboard. An invoice is never edited into (Telegram cannot): it comes as a new message, with
// Telegram's own pay button when it has no keyboard. A draft being written (`writing`) has no
// keyboard yet (written() applies it).
function show(
  ctx: SimContext,
  d: SimState,
  step: ShowingStep,
  shown: SimContent,
  keyboard: Keyboard,
  options: Options,
  via: SimVia | null,
  writing = false,
): SimBotEntry {
  const clicked = via ? d.chat.findIndex((item) => item.id === via.entryId && item.from === 'bot' && !item.deleted) : -1
  const how = via && clicked >= 0 ? (shown.type === 'invoice' && via.show === 'edit' ? 'new' : via.show) : 'new'
  let rows = writing ? null : inlineKeyboard(ctx, d, keyboard)
  if (shown.type === 'invoice' && keyboard === null) {
    const label = `Pay ${priceText(shown.currency, shown.total)}`
    rows = [[{ id: PAY, label, look: 'default', disabled: false, action: 'pay' } satisfies SimInlineButton]]
  }
  const entry: SimBotEntry = {
    id: via && how === 'edit' ? via.entryId : nextId(d),
    from: 'bot',
    step: step.id,
    content: shown,
    keyboard: rows,
    options,
    edited: how === 'edit',
    deleted: false,
    ...(shown.type === 'dice' && { dice: roll(ctx, shown.emoji) }),
    ...((shown.type === 'paidMedia' || shown.type === 'invoice') && { paid: false }),
  }
  const old = d.chat[clicked]
  if (how === 'edit') {
    d.chat[clicked] = entry
  } else {
    if (how === 'replace' && old?.from === 'bot') d.chat[clicked] = { ...old, deleted: true }
    d.chat.push(entry)
  }
  d.log.push(`${step.kind === 'question' ? 'Asked' : 'Showed'} ${title(step)} ${shownAs[how]}`)
  if (entry.dice !== undefined && shown.type === 'dice') {
    d.log.push(`The ${shown.emoji} rolled ${String(entry.dice)}`)
    if (shown.saveTo !== undefined) {
      d.vars[shown.saveTo] = entry.dice
      d.log.push(`Saved the roll to ${varName(ctx, shown.saveTo)}`)
    }
  }
  if (!writing) applyKeyboard(ctx, d, entry.id, keyboard)
  if (d.backHistory.at(-1) !== step.id) d.backHistory.push(step.id)
  setInput(d)
  return entry
}

// The inline buttons of a keyboard, resolved for the tester.
function inlineKeyboard(ctx: SimContext, d: SimState, keyboard: Keyboard): SimInlineButton[][] | null {
  return keyboard?.type === 'inline' ? inlineRows(ctx, d.vars, keyboard.rows) : null
}

// What a message's keyboard does besides its inline buttons: the bottom keyboard it shows or
// removes, the reply field it opens.
function applyKeyboard(ctx: SimContext, d: SimState, entryId: string, keyboard: Keyboard): void {
  switch (keyboard?.type) {
    case 'inline':
      if (keyboard.openReplyField) d.forceReply = { entryId, placeholder: null }
      break
    case 'reply': {
      const placeholder = langText(ctx, d.vars, keyboard.placeholder) || null
      d.bottomKeyboard = {
        entryId,
        rows: replyRows(ctx, d.vars, keyboard.rows),
        oneTime: keyboard.oneTime,
        persistent: keyboard.persistent,
        resize: keyboard.resize,
        placeholder,
        collapsed: false,
      }
      if (keyboard.openReplyField) d.forceReply = { entryId, placeholder }
      break
    }
    case 'removeReply':
      d.bottomKeyboard = null
      break
    case 'forceReply':
      d.forceReply = { entryId, placeholder: langText(ctx, d.vars, keyboard.placeholder) || null }
      break
  }
}

/**
 * Runs steps from `target` until the bot waits. `via` is the inline button that started the run,
 * for the first message; `ready` is a held-back message whose delay is over.
 */
function run(ctx: SimContext, d: SimState, target: Target | undefined, via: SimVia | null, ready?: StepId): void {
  if (target === undefined) {
    d.log.push(NOTHING)
    return
  }
  d.question = null
  d.ended = false
  let at: Target | undefined = target
  let held = ready
  for (;;) {
    const id: StepId | undefined = at === 'back' ? back(ctx, d) : at
    const step: Step | undefined = id === undefined ? undefined : ctx.design.steps[id]
    if (!step) {
      d.log.push(NOTHING)
      return
    }
    if (d.stepsSinceAction >= MAX_STEPS) {
      d.log.push('Stopped: the steps go round in a loop')
      return
    }
    const showing = step.kind === 'message' || step.kind === 'question' || step.kind === 'invoice'
    // Nothing reaches a user who blocked the bot (check E30).
    if (d.blocked && (showing || (step.kind === 'action' && step.action.type === 'chatAction'))) {
      d.path.push({ type: 'step', id: step.id })
      d.log.push(`${title(step)} is not delivered: the user blocked the bot`)
      return
    }
    if (showing && held !== step.id && hold(d, step, via)) return
    held = undefined
    d.stepsSinceAction += 1
    d.path.push({ type: 'step', id: step.id })

    switch (step.kind) {
      case 'start':
        at = step.next
        break
      case 'goTo':
        at = step.target
        break
      case 'message': {
        // A draft the tester can stop waits until it is written or stopped (written(), stopDraft());
        // it comes as a new message, so a stop leaves the pressed message as it was.
        const writing = draftStops(step)
        const shown = simContent(ctx, d.vars, step.content)
        const entry = show(ctx, d, step, shown, step.keyboard, step.options, writing ? null : via, writing)
        via = null
        if (writing) {
          d.writing = { entryId: entry.id, step: step.id }
          d.log.push(`${title(step)} is written out like a draft`)
          return
        }
        const next = goesOn(d, step, entry)
        if (next === undefined) return
        at = next
        break
      }
      case 'question': {
        const { content, keyboard, options } = step.prompt
        show(ctx, d, step, simContent(ctx, d.vars, content), keyboard, options, via)
        d.question = { step: step.id, tries: 0 }
        return
      }
      case 'if': {
        const decision = decide(ctx, d.vars, step, d.payments)
        if ('ask' in decision) {
          d.choice = { kind: 'if', step: step.id, prompt: 'Which way?', options: decision.ask, via }
          d.log.push(`${title(step)} cannot be decided: asks which way`)
          return
        }
        d.log.push(`Took "${decision.way.label}" at ${title(step)}`)
        at = decision.way.goTo
        break
      }
      case 'remember':
        for (const action of step.actions) d.log.push(remember(ctx, d.vars, action))
        at = step.next
        break
      case 'wait': {
        const unit = step.amount === 1 ? step.unit.slice(0, -1) : step.unit
        const prompt = `Waiting ${String(step.amount)} ${unit}`
        d.choice = {
          kind: 'wait',
          step: step.id,
          prompt,
          options: [{ id: SKIP, label: 'Skip the wait', goTo: step.next }],
          via,
          amount: step.amount,
          unit: step.unit,
          ifUserActs: step.ifUserActs,
          ...(step.ifUserActs === 'cancel' && step.stopWhen && { stopWhen: step.stopWhen }),
        }
        d.log.push(`${prompt} at ${title(step)}`)
        return
      }
      case 'devStep': {
        const outcomes: Outcome[] = step.outcomes.length > 0 ? step.outcomes : [{ id: 'done', label: 'Done' }]
        const job = (step.description.trim() || title(step)).replace(/\.$/, '')
        d.choice = {
          kind: 'devStep',
          step: step.id,
          prompt: `The developer does: ${job}. What happened?`,
          options: outcomes.map(({ id, label, goTo }) => ({ id, label, goTo })),
          via,
        }
        d.log.push(`${title(step)} is a developer step: asks what happened`)
        return
      }
      case 'end':
        d.ended = true
        d.log.push('The conversation ended')
        return
      // The invoice waits for its pay button.
      case 'invoice':
        show(ctx, d, step, simInvoice(ctx, d.vars, step), step.keyboard, step.options, via)
        return
      case 'action':
        act(ctx, d, step, step.action)
        at = step.next
        break
      case 'note':
      case 'frame':
        d.log.push(NOTHING)
        return
    }
  }
}

// Where a message goes on once it is sent: a poll or quiz once the tester votes (vote()); a
// message without "Then" waits for a button, and with none to press nothing goes on.
function goesOn(d: SimState, step: MessageStep, entry: SimBotEntry): Target | undefined {
  if (step.next !== undefined && (step.content.type === 'poll' || step.content.type === 'quiz')) {
    d.log.push(`${title(step)} waits for a vote`)
    return undefined
  }
  if (step.next === undefined) {
    const inside = entry.content.type === 'rich' && entry.content.blocks.some((block) => block.type === 'buttons')
    if (!entry.keyboard?.length && !inside && !d.bottomKeyboard) d.log.push(NOTHING)
    return undefined
  }
  return step.next
}

// The newest message of a step still in the chat, or (`userMessage`) the user's newest message.
function lastEntry(d: SimState, of: StepId): number {
  return d.chat.findLastIndex((item) =>
    of === 'userMessage' ? item.from === 'user' : item.from === 'bot' && item.step === of && !item.deleted,
  )
}

// The message an action acts on, in words: "the user's message", "the message of Main menu".
function whose(ctx: SimContext, of: StepId): string {
  if (of === 'userMessage') return "the user's message"
  const step = ctx.design.steps[of]
  return `the message of ${step ? title(step) : of}`
}

// An action step: a reaction, a pin, an unpin, a delete, a gift, a chat action or a refund.
function act(ctx: SimContext, d: SimState, step: ActionStep, action: Action): void {
  switch (action.type) {
    case 'react': {
      const index = action.onStep === undefined ? -1 : lastEntry(d, action.onStep)
      const entry = d.chat[index]
      if (!entry || action.onStep === undefined) {
        d.log.push(`Reacted to nothing: ${title(step)} has no message to react to`)
        return
      }
      const emoji = reactionEmoji(action.emoji) ?? action.emoji
      d.chat[index] = { ...entry, reaction: { emoji, big: action.big === true } }
      d.log.push(`Reacted with ${emoji} to ${whose(ctx, action.onStep)}`)
      return
    }
    case 'pin':
    case 'delete': {
      const index = action.step === undefined ? -1 : lastEntry(d, action.step)
      const entry = d.chat[index]
      const verb = action.type === 'pin' ? 'Pinned' : 'Deleted'
      if (entry?.from !== 'bot' || action.step === undefined) {
        d.log.push(`${verb} nothing: ${title(step)} has no message to act on`)
        return
      }
      d.pinned = d.pinned.filter((id) => id !== entry.id)
      if (action.type === 'pin') d.pinned.push(entry.id)
      else d.chat[index] = { ...entry, deleted: true }
      d.log.push(`${verb} ${whose(ctx, action.step)}`)
      return
    }
    case 'unpin': {
      // Without a step, the pinned message sent last (Telegram's unpinChatMessage).
      const id =
        action.step === undefined
          ? d.chat.findLast((item) => d.pinned.includes(item.id))?.id
          : d.chat[lastEntry(d, action.step)]?.id
      if (id === undefined || !d.pinned.includes(id)) {
        d.log.push('Unpinned nothing: that message is not pinned')
        return
      }
      d.pinned = d.pinned.filter((pinned) => pinned !== id)
      d.log.push(
        action.step === undefined ? 'Unpinned the newest pinned message' : `Unpinned ${whose(ctx, action.step)}`,
      )
      return
    }
    case 'gift': {
      const description = action.giftDescription.trim() || 'a gift'
      d.chat.push({
        id: nextId(d),
        from: 'bot',
        step: step.id,
        content: {
          type: 'gift',
          description,
          text: action.text ? richText(ctx, d.vars, action.text) : null,
          payForUpgrade: action.payForUpgrade === true,
        },
        keyboard: null,
        options: {},
        edited: false,
        deleted: false,
      })
      d.log.push(`Sent a gift (test): ${description}`)
      return
    }
    case 'chatAction':
      d.log.push(`Showed "${chatAction(action.action).label}"`)
      return
    case 'refund':
      refund(ctx, d, action.invoice)
      return
  }
}

// The refund action: the invoice paid while trying is given back (hasPaid turns false).
function refund(ctx: SimContext, d: SimState, invoice: StepId | undefined): void {
  const step = invoice === undefined ? undefined : ctx.design.steps[invoice]
  if (step?.kind !== 'invoice' || invoice === undefined) {
    d.log.push('Refunded nothing: the refund has no invoice')
    return
  }
  const paid = d.payments[invoice]
  if (!paid || paid.refunded) {
    d.log.push(`Refunded nothing: ${title(step)} was not paid while trying`)
    return
  }
  d.payments[invoice] = { ...paid, refunded: true }
  d.log.push(`Refunded the payment of ${title(step)} (test)`)
}

// Runs a start point; a start link with `prefix` saves the rest of the payload.
function startRun(ctx: SimContext, d: SimState, step: StartStep, payload?: string): void {
  const { trigger } = step
  switch (trigger.type) {
    case 'command':
      d.log.push(`Started from /${trigger.command}`)
      break
    case 'startLink': {
      const given = payload ?? trigger.payload
      d.log.push(`Started from the start link ${given}`)
      if (trigger.match === 'prefix' && trigger.saveRestTo !== undefined) {
        const rest = given.startsWith(trigger.payload) ? given.slice(trigger.payload.length) : given
        d.vars[trigger.saveRestTo] = rest
        d.log.push(`Remembered ${varName(ctx, trigger.saveRestTo)} = ${rest}`)
      }
      break
    }
    case 'fallback':
      d.log.push('Started from a message the bot does not expect')
      break
    case 'paymentDone':
      d.log.push('Started from a payment')
      break
    case 'refunded':
      d.log.push('Started from a refund')
      break
    case 'subscriptionChanged':
      d.log.push(
        `Started from a subscription that ${trigger.state === undefined ? 'changed' : SUBSCRIPTION_LOG[trigger.state]}`,
      )
      break
    case 'userBlocks':
      d.log.push('Started from the user blocking the bot')
      break
    case 'userRestarts':
      d.log.push('Started from the user restarting the bot')
      break
    // A broadcast skips a test user its audience does not take; one it cannot decide gets it.
    case 'broadcast': {
      d.log.push(`Started from the broadcast ${title(step)}`)
      const truth = trigger.audience === 'everyone' ? true : conditionTruth(ctx, d.vars, trigger.audience, d.payments)
      if (truth === false) {
        d.log.push('The test user is not in its audience: the broadcast skips them')
        return
      }
      if (truth === undefined) d.log.push('Cannot tell whether the test user is in its audience: sent anyway')
      break
    }
  }
  run(ctx, d, step.id, null)
}

const SUBSCRIPTION_LOG = { canceled: 'was canceled', active: 'was turned back on', failed: 'could not be paid' }

// The user blocks the bot or restarts it: the event's start point runs, when the design has one.
function setBlocked(ctx: SimContext, d: SimState, blocked: boolean): void {
  d.blocked = blocked
  d.log.push(blocked ? 'The user blocked the bot' : 'The user restarted the bot')
  const type = blocked ? 'userBlocks' : 'userRestarts'
  const step = startSteps(ctx.design).find((item) => item.trigger.type === type)
  if (step) startRun(ctx, d, step)
}

function start(ctx: SimContext, s: SimState, entry: SimStartEntry): SimState {
  const step = ctx.design.steps[entry.step]
  if (!step) return s
  // A user who blocked the bot sends it nothing.
  if (s.blocked && (step.kind !== 'start' || takesMessage(step.trigger))) return s
  // Try it from the selected step (Ctrl+Enter): the bot runs from it, nobody sent anything.
  if (step.kind !== 'start')
    return personActs(ctx, s, (d) => {
      d.log.push(`Started from ${title(step)}`)
      run(ctx, d, step.id, null)
    })
  return personActs(ctx, s, (d) => {
    const { trigger } = step
    // Telegram shows a start link as /start, without its payload; a payment sends no message.
    if (trigger.type === 'fallback') addUser(d, { type: 'unexpected' })
    else if (trigger.type === 'command' || trigger.type === 'startLink') {
      addUser(d, { type: 'text', text: startText(trigger) })
    }
    if (trigger.type === 'userBlocks' || trigger.type === 'userRestarts') d.blocked = trigger.type === 'userBlocks'
    startRun(ctx, d, step, entry.payload)
  })
}

function startText(trigger: Trigger): string {
  return trigger.type === 'command' ? `/${trigger.command}` : '/start'
}

// The start point a typed command or a /start with a payload opens: an exact start link, else the
// longest prefix, else the command.
function commandStart(ctx: SimContext, text: string): { step: StartStep; payload?: string } | undefined {
  const match = /^\/(\w+)(?:@\w+)?(?:\s+(.*))?$/s.exec(text.trim())
  if (!match) return undefined
  const command = (match[1] ?? '').toLowerCase()
  const payload = match[2]?.trim()
  const starts = startSteps(ctx.design)
  if (command === 'start' && payload) {
    let best: StartStep | undefined
    let bestScore = -1
    for (const step of starts) {
      const score = linkScore(step.trigger, payload)
      if (score > bestScore) [best, bestScore] = [step, score]
    }
    if (best) return { step: best, payload }
  }
  const step = starts.find((item) => item.trigger.type === 'command' && item.trigger.command.toLowerCase() === command)
  return step && { step }
}

function linkScore(trigger: Trigger, payload: string): number {
  if (trigger.type !== 'startLink') return -1
  if (trigger.match === 'exact') return payload === trigger.payload ? Number.MAX_SAFE_INTEGER : -1
  return payload.startsWith(trigger.payload) ? trigger.payload.length : -1
}

function fallbackStart(ctx: SimContext, sent: SimSent): StartStep | undefined {
  return startSteps(ctx.design).find(
    (step) =>
      step.trigger.type === 'fallback' &&
      (step.trigger.accepts === 'any' || step.trigger.accepts === (sent.type === 'media' ? 'media' : 'text')),
  )
}

function addUser(d: SimState, sent: SimSent): void {
  const entry: SimUserEntry = { id: nextId(d), from: 'user', sent }
  if (d.forceReply) entry.replyTo = d.forceReply.entryId
  d.chat.push(entry)
  d.forceReply = null
  setInput(d)
}

function sentLog(sent: SimSent, pressed: string | undefined): string {
  switch (sent.type) {
    case 'text':
      return pressed === undefined ? `Sent "${sent.text}"` : `Pressed "${pressed}"`
    case 'media':
      return `Sent a test ${sent.kind}`
    case 'contact':
      return 'Shared the test phone number'
    case 'location':
      return 'Shared the test location'
    case 'users':
      return 'Shared a test user'
    case 'chat':
      return sent.channel ? 'Shared a test channel' : 'Shared a test chat'
    case 'poll':
      return sent.quiz ? 'Sent a test quiz' : 'Sent a test poll'
    case 'unexpected':
      return 'Sent a message the bot does not expect'
  }
}

// A bottom-keyboard button shown now.
function shownReply(ctx: SimContext, s: SimState, buttonId: ButtonId): ReplyButton | undefined {
  if (!s.bottomKeyboard?.rows.some((row) => row.some((button) => button.id === buttonId))) return undefined
  const button = ctx.design.buttons[buttonId]
  return button?.place === 'reply' ? button : undefined
}

// The bottom-keyboard text button whose label was typed by hand.
function typedButton(ctx: SimContext, s: SimState, text: string): ReplyButton | undefined {
  const typed = text.trim()
  const found = s.bottomKeyboard?.rows.flat().find((button) => button.action === 'text' && button.label === typed)
  return found && shownReply(ctx, s, found.id)
}

/** The tester sends something; `button` is the bottom-keyboard button pressed for it. */
function userSends(ctx: SimContext, s: SimState, sent: SimSent, button?: ReplyButton): SimState {
  return personActs(ctx, s, (d) => {
    addUser(d, sent)
    d.log.push(sentLog(sent, button && langText(ctx, d.vars, button.label)))
    const pressed = button ?? (sent.type === 'text' ? typedButton(ctx, d, sent.text) : undefined)
    if (pressed) {
      d.path.push({ type: 'button', id: pressed.id })
      if (d.bottomKeyboard?.oneTime) d.bottomKeyboard = { ...d.bottomKeyboard, collapsed: true }
    }
    received(ctx, d, sent, pressed)
  })
}

// What the bot does with a message: a command, the pressed button's own target, the question's
// answer, or the fallback start point.
function received(ctx: SimContext, d: SimState, sent: SimSent, button: ReplyButton | undefined): void {
  const command = sent.type === 'text' ? commandStart(ctx, sent.text) : undefined
  if (command) {
    startRun(ctx, d, command.step, command.payload)
    return
  }
  let handled = false
  if (button) {
    const { action } = button
    if (action.type === 'text') {
      for (const item of action.remember ?? []) d.log.push(remember(ctx, d.vars, item))
      handled = (action.remember?.length ?? 0) > 0
    } else if (action.saveTo !== undefined) {
      const value = sentValue(sent)
      d.vars[action.saveTo] = value
      d.log.push(`Remembered ${varName(ctx, action.saveTo)} = ${String(value)}`)
      handled = true
    }
    if (action.goTo !== undefined) {
      run(ctx, d, action.goTo, null)
      return
    }
  }
  if (d.question) {
    answer(ctx, d, d.question, sent)
    return
  }
  const fallback = handled ? undefined : fallbackStart(ctx, sent)
  if (fallback) startRun(ctx, d, fallback)
  else d.log.push(NOTHING)
}

// Checks an answer to the waiting question: a cancel word, a valid answer, or a wrong one.
function answer(ctx: SimContext, d: SimState, waiting: { step: StepId; tries: number }, sent: SimSent): void {
  const step = ctx.design.steps[waiting.step]
  d.question = null
  if (step?.kind !== 'question') {
    d.log.push(NOTHING)
    return
  }
  if (sent.type === 'text' && step.cancel && isCancelWord(step.cancel.words, sent.text)) {
    d.log.push('Cancelled the question')
    run(ctx, d, step.cancel.goTo, null)
    return
  }
  const value = answerValue(step, sent)
  if (value !== undefined) {
    d.vars[step.saveTo] = value
    d.log.push(`Saved the answer to ${varName(ctx, step.saveTo)}`)
    run(ctx, d, step.next, null)
    return
  }
  const tries = waiting.tries + 1
  const max = step.wrongAnswer.maxTries ?? 0
  d.chat.push({
    id: nextId(d),
    from: 'bot',
    step: step.id,
    content: { type: 'text', text: richText(ctx, d.vars, step.wrongAnswer.message) },
    keyboard: null,
    options: {},
    edited: false,
    deleted: false,
  })
  d.log.push(`Wrong answer (try ${String(tries)}${max > 0 ? ` of ${String(max)}` : ''})`)
  if (max > 0 && tries >= max) {
    d.log.push('No tries left')
    run(ctx, d, step.wrongAnswer.afterMaxTries, null)
    return
  }
  d.question = { step: step.id, tries }
}

function pressInline(ctx: SimContext, s: SimState, entryId: string, buttonId: ButtonId): SimState {
  const entry = s.chat.find((item) => item.id === entryId)
  // A stopped draft was never sent: its buttons do nothing.
  if (entry?.from !== 'bot' || entry.deleted || entry.stopped !== undefined) return s
  const inside = entry.content.type === 'rich' ? entry.content.blocks : []
  const shown = [...(entry.keyboard ?? []), ...inside.map((block) => (block.type === 'buttons' ? block.buttons : []))]
    .flat()
    .find((item) => item.id === buttonId)
  if (!shown) return s
  const button = ctx.design.buttons[buttonId]
  // Telegram's own pay button of an invoice sent without a keyboard.
  if (buttonId === PAY && shown.action === 'pay' && button === undefined) {
    return personActs(ctx, s, (d) => {
      d.log.push(`Pressed "${shown.label}"`)
      openSheet(d, entryId)
    })
  }
  if (button?.place !== 'inline' || button.disabled) return s
  return personActs(ctx, s, (d) => {
    d.path.push({ type: 'button', id: buttonId })
    d.log.push(`Pressed "${langText(ctx, d.vars, button.label)}"`)
    const { action } = button
    switch (action.type) {
      case 'pay':
        openSheet(d, entryId)
        return
      case 'url':
        d.log.push(`Opened the link ${fill(ctx, d.vars, action.url)}`)
        return
      case 'loginUrl':
        d.log.push(`Opened the login link ${fill(ctx, d.vars, action.url)}`)
        return
      case 'copyText':
        d.log.push(`Copied "${langText(ctx, d.vars, action.text)}"`)
        return
      case 'goTo': {
        for (const item of action.remember ?? []) d.log.push(remember(ctx, d.vars, item))
        // The popup shows before the next step runs.
        if (action.popup) {
          const text = langText(ctx, d.vars, action.popup.text)
          d.popup = { kind: action.popup.kind, text }
          d.log.push(`Showed ${action.popup.kind === 'toast' ? 'a toast' : 'an alert'}: "${text}"`)
        }
        if (action.target === 'stay') return
        run(ctx, d, action.target, { show: action.show, entryId })
      }
    }
  })
}

function pressReply(ctx: SimContext, s: SimState, buttonId: ButtonId): SimState {
  const button = shownReply(ctx, s, buttonId)
  if (!button) return s
  if (button.action.type !== 'text') return request(ctx, s, button.action.type, buttonId)
  return userSends(ctx, s, { type: 'text', text: langText(ctx, s.vars, button.label) }, button)
}

// Shares or sends a test value, through a bottom-keyboard button or (without one) the attachment menu.
function request(ctx: SimContext, s: SimState, type: Request, buttonId?: ButtonId): SimState {
  const button = buttonId === undefined ? undefined : shownReply(ctx, s, buttonId)
  if (buttonId !== undefined && button?.action.type !== type) return s
  return userSends(ctx, s, testSent(type, button?.action), button)
}

function testSent(type: Request, action: ReplyAction | undefined): SimSent {
  switch (type) {
    case 'sharePhone':
      return { type: 'contact', phone: SIM_TEST_VALUES.phone }
    case 'shareLocation':
      return { type: 'location', ...SIM_TEST_VALUES.location }
    case 'pickUsers':
      return { type: 'users', userId: SIM_TEST_VALUES.userId }
    case 'pickChat':
      return { type: 'chat', chatId: SIM_TEST_VALUES.chatId, channel: action?.type === 'pickChat' && action.channel }
    case 'createPoll':
      return {
        type: 'poll',
        question: SIM_TEST_VALUES.pollQuestion,
        quiz: action?.type === 'createPoll' && action.pollType === 'quiz',
      }
  }
}

// The value a dice shows: the test user's when it fits the emoji, else a random one.
function roll(ctx: SimContext, emoji: DiceEmoji): number {
  const row = DICE.find((item) => item.emoji === emoji)
  const max = row ? limit(row.limit).max : 6
  const picked = ctx.user.dice
  if (picked !== undefined && Number.isInteger(picked) && picked >= 1 && picked <= max) return picked
  return 1 + Math.floor(Math.random() * max)
}

// The tester votes in a poll or quiz: once, or again where revoting is allowed (Telegram's
// default: polls yes, quizzes no). A quiz answered wrong shows its explanation as a toast. The
// first vote runs the message's "then".
function vote(ctx: SimContext, s: SimState, entryId: string, options: readonly number[]): SimState {
  const entry = s.chat.find((item) => item.id === entryId)
  if (entry?.from !== 'bot' || entry.deleted) return s
  const { content } = entry
  if (content.type !== 'poll' && content.type !== 'quiz') return s
  const chosen = [...new Set(options)].sort((a, b) => a - b)
  const fits = (index: number) => Number.isInteger(index) && index >= 0 && index < content.options.length
  if (chosen.length === 0 || !chosen.every(fits) || (chosen.length > 1 && !content.multiple)) return s
  const again = entry.vote !== undefined
  if (again && !(content.revote ?? content.type === 'poll')) return s
  return personActs(ctx, s, (d) => {
    const index = d.chat.findIndex((item) => item.id === entryId)
    const now = d.chat[index]
    if (now?.from !== 'bot' || now.content !== content) return
    d.chat[index] = { ...now, vote: chosen }
    const picked = chosen.map((option) => `"${content.options[option] ?? ''}"`).join(', ')
    if (content.type === 'quiz') {
      const right =
        content.correct.length === chosen.length && content.correct.every((option) => chosen.includes(option))
      d.log.push(`Answered ${picked} in the quiz: ${right ? 'right' : 'wrong'}`)
      const explanation = content.explanation && plainText(content.explanation, () => '').trim()
      if (!right && explanation) {
        d.popup = { kind: 'toast', text: explanation }
        d.log.push(`Showed the explanation: "${explanation}"`)
      }
    } else d.log.push(`${again ? 'Changed the vote to' : 'Voted for'} ${picked}`)
    saveVote(ctx, d, now.step, chosen)
    if (again) return
    const step = ctx.design.steps[now.step]
    if (step?.kind === 'message' && step.next !== undefined) run(ctx, d, step.next, null)
  })
}

// A vote saved in the poll's or quiz's variable, as a bot reads it from poll_answer (an anonymous
// one sends none): a poll's chosen options in the default language, a quiz's right or wrong.
function saveVote(ctx: SimContext, d: SimState, stepId: StepId, chosen: readonly number[]): void {
  const step = ctx.design.steps[stepId]
  const content = step?.kind === 'message' ? step.content : step?.kind === 'question' ? step.prompt.content : undefined
  if ((content?.type !== 'poll' && content?.type !== 'quiz') || content.saveTo === undefined || content.anonymous)
    return
  const lang = ctx.design.languages.default
  d.vars[content.saveTo] =
    content.type === 'quiz'
      ? content.correct.length === chosen.length && content.correct.every((option) => chosen.includes(option))
      : chosen.map((option) => content.options[option]?.[lang] ?? '').join(', ')
  d.log.push(`Saved the vote to ${varName(ctx, content.saveTo)}`)
}

// The pay button opens the payment sheet of the invoice it is on (a pay button elsewhere does
// nothing: check E23).
function openSheet(d: SimState, entryId: string): void {
  const entry = d.chat.find((item) => item.id === entryId)
  if (entry?.from !== 'bot' || entry.content.type !== 'invoice' || entry.paid !== false) {
    d.log.push('Nothing happens: a pay button works only on an invoice not paid yet')
    return
  }
  d.payment = { entryId, step: entry.step }
  d.log.push(`Opened the payment sheet of "${entry.content.title}"`)
}

// "Cancel" on the payment sheet.
function cancelPayment(s: SimState): SimState {
  if (!s.payment) return s
  const d = draft(s)
  d.payment = null
  d.log.push('Cancelled the payment')
  return d
}

// "Pay (test)" on the payment sheet: a shipping option is needed with flexible shipping; the
// pre-checkout check (when the invoice has one) asks "OK" or "Refuse", else it is paid.
function payInvoice(ctx: SimContext, s: SimState, entryId: string, shippingId?: string): SimState {
  const entry = s.chat.find((item) => item.id === entryId)
  if (s.payment?.entryId !== entryId || entry?.from !== 'bot' || entry.content.type !== 'invoice') return s
  const step = ctx.design.steps[entry.step]
  if (step?.kind !== 'invoice') return s
  const { shipping } = entry.content
  const option = shipping?.find((item) => item.id === shippingId) ?? null
  if (shipping !== null && shipping.length > 0 && option === null) return s
  return personActs(ctx, s, (d) => {
    if (option) d.log.push(`Chose the shipping option "${option.title}"`)
    const { checkout } = step
    if (!checkout) {
      paid(ctx, d, entryId, step, option)
      return
    }
    const job = (checkout.description.trim() || 'the pre-checkout check').replace(/\.$/, '')
    d.choice = {
      kind: 'checkout',
      step: step.id,
      prompt: `The developer checks: ${job}. What happened?`,
      options: [
        { id: OK, label: 'OK' },
        { id: REFUSE, label: 'Refuse' },
      ],
      via: null,
      entryId,
      shipping: option,
    }
    d.log.push(`${title(step)} has a pre-checkout check: asks what happened`)
  })
}

// The payment went through: the invoice shows paid and its "Paid" arrow runs, else a "Payment
// done" start point of the invoice (or of any).
function paid(ctx: SimContext, d: SimState, entryId: string, step: InvoiceStep, shipping: SimShippingOption | null) {
  const index = d.chat.findIndex((item) => item.id === entryId)
  const entry = d.chat[index]
  if (entry?.from !== 'bot' || entry.content.type !== 'invoice') return
  d.chat[index] = { ...entry, paid: true }
  d.payments[step.id] = { subscription: step.invoice.subscription !== undefined, refunded: false }
  const total = entry.content.total + (shipping?.amount ?? 0)
  d.log.push(`Paid ${priceText(entry.content.currency, total)} (test) for "${entry.content.title}"`)
  if (step.next !== undefined) {
    run(ctx, d, step.next, null)
    return
  }
  const start = startSteps(ctx.design).find(
    (item) =>
      item.trigger.type === 'paymentDone' && (item.trigger.invoice === undefined || item.trigger.invoice === step.id),
  )
  if (start) startRun(ctx, d, start)
  else d.log.push(NOTHING)
}

// "Pay (test)": the paid media of a message shows unlocked; an invoice is paid (payInvoice).
function pay(ctx: SimContext, s: SimState, entryId: string, shippingId?: string): SimState {
  const entry = s.chat.find((item) => item.id === entryId)
  if (entry?.from === 'bot' && entry.content.type === 'invoice') return payInvoice(ctx, s, entryId, shippingId)
  if (entry?.from !== 'bot' || entry.deleted || entry.paid !== false || entry.content.type !== 'paidMedia') return s
  const { stars } = entry.content
  return personActs(ctx, s, (d) => {
    const index = d.chat.findIndex((item) => item.id === entryId)
    const now = d.chat[index]
    if (now?.from !== 'bot' || now.paid !== false) return
    d.chat[index] = { ...now, paid: true }
    d.log.push(`Paid ${String(stars)} ${stars === 1 ? 'Star' : 'Stars'} (test): the paid media is unlocked`)
  })
}

function waitingFileTypes(ctx: SimContext, s: SimState): string[] | undefined {
  const step = s.question ? ctx.design.steps[s.question.step] : undefined
  return step?.kind === 'question' ? step.checks.fileTypes : undefined
}

function choose(ctx: SimContext, s: SimState, optionId: string): SimState {
  const { choice } = s
  const option = choice?.options.find((item) => item.id === optionId)
  if (!choice || !option) return s
  const d = draft(s)
  d.choice = null
  const step = ctx.design.steps[choice.step]
  const name = step ? title(step) : choice.step
  switch (choice.kind) {
    case 'if':
      d.stepsSinceAction = 0
      d.log.push(`Chose "${option.label}" at ${name}`)
      break
    case 'devStep':
      d.stepsSinceAction = 0
      d.log.push(`The developer step ${name} ended with "${option.label}"`)
      break
    case 'wait':
      // Time passing is not the tester acting: the loop guard keeps counting. A reminder whose
      // conditions hold stops instead of going on.
      d.log.push('Skipped the wait')
      if (choice.stopWhen && stops(ctx, d, choice.stopWhen)) {
        d.log.push('The reminder stopped waiting: its conditions hold')
        return d
      }
      break
    // OK: paid. Refuse: the payment sheet shows the message and nothing is paid.
    case 'checkout': {
      d.stepsSinceAction = 0
      if (step?.kind !== 'invoice') return d
      if (option.id === OK) {
        d.log.push(`The pre-checkout check of ${name} said OK`)
        paid(ctx, d, choice.entryId, step, choice.shipping)
        return d
      }
      const text = langText(ctx, d.vars, step.checkout?.refuse)
      d.popup = { kind: 'alert', text }
      d.log.push(`The pre-checkout check of ${name} refused: "${text}"`)
      return d
    }
  }
  run(ctx, d, option.goTo, choice.via)
  return d
}

function skipWait(ctx: SimContext, s: SimState): SimState {
  if (s.delay) {
    const d = draft(s)
    resume(ctx, d)
    return d
  }
  if (s.writing) {
    const d = draft(s)
    written(ctx, d)
    return d
  }
  return s.choice?.kind === 'wait' ? choose(ctx, s, SKIP) : s
}
