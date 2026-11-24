// Try it for Claude (docs/plan/17 section 13.2, MCP-02b): xdesign_try_it runs a design in the Try
// it engine of @xdesign/spec (createSim, docs/plan/04 section 8) as the editor's Try it drives it:
// from /start (or another start point or step) through a list of the test user's actions, each
// found as the phone shows it (a button by its label, ID name or ID; a poll's options by their
// texts; a choice card's way by its label; the Events menu by its words). Messages held back by a
// delay or written out like a draft go out at once, as with "Skip waits". A switch set midway
// counts from the next step, as in the test user panel. The answer is what happened after each
// action, the chat as Try it shows it (deleted messages left out; each message's texts in Telegram
// HTML or plain, its files by name, its buttons by row) and what the bot waits for now. An action
// that cannot be done stops the run: the answer names it, and the actions after it do not run.
import {
  createSim,
  defaultSimUser,
  plainText,
  simStartPoints,
  toTelegram,
  type Design,
  type RichDoc,
  type Sim,
  type SimBotEntry,
  type SimInlineButton,
  type SimReplyButton,
  type SimState,
  type SimTestUser,
  type StartStep,
  type StepId,
  type TestSwitch,
} from '@xdesign/spec'
import { z } from 'zod'

import { ApiError } from '../errors.ts'

// An action or a choice that Try it cannot take as given, in words.
class Refusal extends ApiError {
  constructor(message: string) {
    super('bad_request', message)
  }
}

const ref = (what: string) => z.string().min(1).max(200).describe(what)
const messageRef = z
  .string()
  .min(1)
  .max(16)
  .optional()
  .describe('The message, by its id in the chat (e3); the newest one without it.')
const switchValue = z.union([z.boolean(), z.string().max(200)])

// The test user's actions, as the phone and its menus offer them.
const tryAction = z.discriminatedUnion('do', [
  z.strictObject({
    do: z.literal('press'),
    button: ref("The button's label as shown, its ID name or its ID: under a message or on the bottom keyboard."),
    message: messageRef,
  }),
  z.strictObject({ do: z.literal('send'), text: ref('The text the test user sends, such as Hello or /help.') }),
  z.strictObject({
    do: z.literal('sendFile'),
    kind: z.enum(['photo', 'video', 'file', 'voice', 'audio']).describe('The test file sent.'),
  }),
  z.strictObject({ do: z.literal('shareContact') }),
  z.strictObject({ do: z.literal('shareLocation') }),
  z.strictObject({
    do: z.literal('vote'),
    options: z.array(ref('An option, by its text.')).min(1).max(12),
    message: messageRef,
  }),
  z.strictObject({
    do: z.literal('choose'),
    option: ref(
      "A way on the choice card, by its label: an If's case, a developer step's outcome, Skip the wait, or OK or Refuse at a payment's check.",
    ),
  }),
  z.strictObject({
    do: z.literal('pay'),
    shipping: ref('A shipping option of the invoice, by its title, when it has some.').optional(),
  }),
  z.strictObject({ do: z.literal('cancelPayment') }),
  z.strictObject({
    do: z.literal('setSwitch'),
    switch: ref("The test switch's ID name."),
    value: switchValue.describe('true or false, or the option of a choice switch.'),
  }),
  z.strictObject({
    do: z.literal('event'),
    event: ref(
      'User blocks the bot, User restarts the bot, Time passes, or a broadcast or a subscription change by its ID name or title.',
    ),
  }),
])
type TryAction = z.output<typeof tryAction>

// The tool's input besides the design (src/claude/more.ts adds it).
export const tryArgs = {
  language: z
    .string()
    .min(1)
    .max(35)
    .optional()
    .describe("The test user's language code; the design's default language without it."),
  from: ref(
    'Where to start: a start point as "Start from" names it (/start, /help, A message the bot does not expect), or any step by its ID name; /start without it.',
  ).optional(),
  switches: z
    .record(z.string().max(64), switchValue)
    .optional()
    .describe(
      'The test switches by ID name: true or false, or the option of a choice switch; their test values without it.',
    ),
  values: z
    .strictObject({
      first_name: z.string().max(64).optional(),
      last_name: z.string().max(64).optional(),
      username: z.string().max(32).optional(),
      user_id: z.number().int().optional(),
      is_premium: z.boolean().optional(),
      dice: z.number().int().min(1).max(64).optional().describe('The value a dice shows; a random one without it.'),
    })
    .optional()
    .describe("The test user's own values; the variables' test values without them."),
  actions: z.array(tryAction).max(100).optional().describe("The test user's actions, in order, after the start."),
  texts: z.enum(['html', 'plain']).optional().describe('Texts as Telegram HTML (without it) or plain.'),
}
export type TryArgs = z.output<z.ZodObject<typeof tryArgs>>

const events = { block: 'user blocks the bot', restart: 'user restarts the bot', time: 'time passes' }

// The broadcasts and subscription changes of the Events menu.
function eventStarts(design: Design): StartStep[] {
  return Object.values(design.steps).filter(
    (step): step is StartStep =>
      step.kind === 'start' && (step.trigger.type === 'broadcast' || step.trigger.type === 'subscriptionChanged'),
  )
}

// The item whose name is `given` exactly, else ignoring case.
function matching<T>(items: readonly T[], names: (item: T) => readonly string[], given: string): T | undefined {
  const lower = given.trim().toLocaleLowerCase()
  return (
    items.find((item) => names(item).includes(given)) ??
    items.find((item) => names(item).some((name) => name.trim().toLocaleLowerCase() === lower))
  )
}

function listOf(words: readonly string[]): string {
  return words.map((word) => `"${word}"`).join(', ')
}

function switchOf(design: Design, given: string, value: boolean | string): TestSwitch {
  const switches = Object.values(design.switches)
  const item = matching(switches, (each) => [each.idName, each.id, each.label], given)
  if (!item) {
    throw new Refusal(
      `There is no test switch ${given}. The test switches: ${listOf(switches.map((each) => each.idName))}.`,
    )
  }
  const fits =
    item.type === 'yesNo'
      ? typeof value === 'boolean'
      : typeof value === 'string' && (item.options ?? []).includes(value)
  if (!fits) {
    throw new Refusal(
      item.type === 'yesNo'
        ? `The test switch ${item.idName} is true or false.`
        : `The test switch ${item.idName} is one of ${listOf(item.options ?? [])}.`,
    )
  }
  return item
}

function testUserOf(design: Design, args: TryArgs): SimTestUser {
  const user = defaultSimUser(design)
  const language = args.language?.trim().toLowerCase() || user.language
  if (!design.languages.list.includes(language)) {
    throw new Refusal(`This design has no language ${language}. Its languages: ${design.languages.list.join(', ')}.`)
  }
  for (const [given, value] of Object.entries(args.switches ?? {})) {
    user.switches[switchOf(design, given, value).id] = value
  }
  const { dice, ...builtins } = args.values ?? {}
  return { ...user, language, builtins, ...(dice !== undefined && { dice }) }
}

// The start point or step the run starts from, and its name.
function startOf(design: Design, from: string | undefined): { step: StepId; label: string } {
  const points = simStartPoints(design)
  if (from === undefined) {
    const first = points.find((point) => point.label === '/start') ?? points[0]
    if (!first) {
      throw new Refusal('This design has no start point to try it from.')
    }
    return first
  }
  const point = matching(points, (each) => [each.label], from)
  if (point) {
    return point
  }
  const step = Object.values(design.steps).find((each) => each.idName === from || each.id === from)
  if (!step) {
    throw new Refusal(
      `There is no start point or step ${from}. The start points: ${listOf(points.map((each) => each.label))}.`,
    )
  }
  return { step: step.id, label: step.idName }
}

// The bot's messages shown now, the newest first.
function shownMessages(state: SimState): SimBotEntry[] {
  return state.chat.filter((entry): entry is SimBotEntry => entry.from === 'bot' && !entry.deleted).reverse()
}

function messageOf(state: SimState, id: string | undefined): SimBotEntry[] {
  const shown = shownMessages(state)
  if (id === undefined) {
    return shown
  }
  const found = shown.find((entry) => entry.id === id)
  if (!found) {
    throw new Refusal(`There is no message ${id} in the chat.`)
  }
  return [found]
}

interface ShownButton {
  // The message it is under or inside; null for the bottom keyboard.
  entryId: string | null
  button: SimInlineButton | SimReplyButton
}

function buttonsOf(entry: SimBotEntry): ShownButton[] {
  const inside = entry.content.type === 'rich' ? entry.content.blocks : []
  return [
    ...(entry.keyboard ?? []).flat(),
    ...inside.flatMap((block) => (block.type === 'buttons' ? block.buttons : [])),
  ].map((button) => ({ entryId: entry.id, button }))
}

// A button shown now: under or inside the newest message, on the bottom keyboard, then under or
// inside the older ones.
function shownButton(design: Design, state: SimState, given: string, message: string | undefined): ShownButton {
  const [newest, ...older] = messageOf(state, message)
  const bottom = message === undefined ? (state.bottomKeyboard?.rows ?? []).flat() : []
  const shown = [
    ...(newest ? buttonsOf(newest) : []),
    ...bottom.map((button) => ({ entryId: null, button })),
    ...older.flatMap(buttonsOf),
  ]
  const found = matching(
    shown,
    ({ button }) => [button.label, button.id, design.buttons[button.id]?.idName ?? button.id],
    given,
  )
  if (!found) {
    const labels = [...new Set(shown.map(({ button }) => button.label))]
    throw new Refusal(
      labels.length === 0
        ? `No button ${given} is shown: there are no buttons.`
        : `No button ${given} is shown. The buttons shown: ${listOf(labels)}.`,
    )
  }
  return found
}

function vote(sim: Sim, state: SimState, action: Extract<TryAction, { do: 'vote' }>): SimState {
  for (const entry of messageOf(state, action.message)) {
    const { content } = entry
    if (content.type !== 'poll' && content.type !== 'quiz') {
      continue
    }
    const chosen = action.options.map((given) => {
      const index = matching([...content.options.keys()], (each) => [content.options[each] ?? ''], given)
      if (index === undefined) {
        throw new Refusal(`The poll has no option ${given}. Its options: ${listOf(content.options)}.`)
      }
      return index
    })
    return sim.vote(state, entry.id, chosen)
  }
  throw new Refusal('There is no poll or quiz in the chat to vote in.')
}

function pay(sim: Sim, state: SimState, shipping: string | undefined): SimState {
  const { payment } = state
  if (payment) {
    const entry = state.chat.find((item) => item.id === payment.entryId)
    const options = entry?.from === 'bot' && entry.content.type === 'invoice' ? (entry.content.shipping ?? []) : []
    if (options.length === 0) {
      return sim.pay(state, payment.entryId)
    }
    const option = shipping === undefined ? undefined : matching(options, (each) => [each.title, each.id], shipping)
    if (!option) {
      throw new Refusal(`Choose a shipping option: ${listOf(options.map((each) => each.title))}.`)
    }
    return sim.pay(state, payment.entryId, option.id)
  }
  const locked = shownMessages(state).find((entry) => entry.content.type === 'paidMedia' && entry.paid === false)
  if (!locked) {
    throw new Refusal("Nothing waits for a payment: press an invoice's pay button first.")
  }
  return sim.pay(state, locked.id)
}

function event(design: Design, sim: Sim, state: SimState, given: string): SimState {
  const lower = given.trim().toLocaleLowerCase()
  if (lower === events.block) {
    return sim.blockBot(state)
  }
  if (lower === events.restart) {
    return sim.restartBot(state)
  }
  if (lower === events.time) {
    return sim.skipWait(state)
  }
  const starts = eventStarts(design)
  const step = matching(starts, (each) => [each.idName, each.id, each.title], given)
  if (!step) {
    const names = ['User blocks the bot', 'User restarts the bot', 'Time passes', ...starts.map((each) => each.idName)]
    throw new Refusal(`There is no event ${given}. The events: ${listOf(names)}.`)
  }
  return sim.start(state, { step: step.id })
}

function act(design: Design, sim: Sim, state: SimState, action: TryAction): SimState {
  switch (action.do) {
    case 'press': {
      const { entryId, button } = shownButton(design, state, action.button, action.message)
      return entryId === null ? sim.pressReply(state, button.id) : sim.pressInline(state, entryId, button.id)
    }
    case 'send':
      return sim.sendText(state, action.text)
    case 'sendFile':
      return sim.sendMedia(state, action.kind)
    case 'shareContact':
      return sim.sharePhone(state)
    case 'shareLocation':
      return sim.shareLocation(state)
    case 'vote':
      return vote(sim, state, action)
    case 'choose': {
      const { choice } = state
      if (!choice) {
        throw new Refusal('Nothing waits for a choice now.')
      }
      const option = matching(choice.options, (each) => [each.label, each.id], action.option)
      if (!option) {
        throw new Refusal(`${choice.prompt} The ways: ${listOf(choice.options.map((each) => each.label))}.`)
      }
      return sim.choose(state, option.id)
    }
    case 'pay':
      return pay(sim, state, action.shipping)
    case 'cancelPayment':
      if (!state.payment) {
        throw new Refusal('No payment sheet is open.')
      }
      return sim.cancelPayment(state)
    case 'event':
      return event(design, sim, state, action.event)
    case 'setSwitch':
      return state
  }
}

// Why an action changed nothing.
function stuck(state: SimState): string {
  if (state.blocked) {
    return 'The user blocked the bot: only the event User restarts the bot works now.'
  }
  if (state.choice && state.choice.kind !== 'wait') {
    return `The bot waits for a choice first: ${state.choice.prompt} The ways: ${listOf(state.choice.options.map((each) => each.label))}.`
  }
  return 'Nothing happened: Try it does not take this action now.'
}

// At most this many held messages go out after an action (each one can hold back the next).
const maxHeld = 100

// Messages held back by a delay or written out like a draft go out at once (Skip waits).
function settled(sim: Sim, state: SimState): SimState {
  let now = state
  for (let held = 0; held < maxHeld && (now.delay !== null || now.writing !== null); held++) {
    now = sim.skipWait(now)
  }
  return now
}

type Texts = (doc: RichDoc) => string

function isRichDoc(value: object): value is RichDoc {
  return 'type' in value && value.type === 'doc' && 'content' in value && Array.isArray(value.content)
}

function isButton(value: object): value is SimInlineButton {
  return 'id' in value && 'label' in value && 'look' in value && 'action' in value
}

// A button as the answer names it: its label and ID name, what it does when it is not going to a
// step or sending its label, its address or text, and whether it is shown disabled.
function buttonOf(design: Design, button: SimInlineButton | SimReplyButton) {
  return {
    label: button.label,
    button: design.buttons[button.id]?.idName ?? button.id,
    ...(button.action !== 'goTo' && button.action !== 'text' && { does: button.action }),
    ...('value' in button && button.value !== undefined && { value: button.value }),
    ...('disabled' in button && button.disabled && { disabled: true }),
  }
}

// A message's content in the answer: its texts in words, its files by name (a placeholder by its
// description), its buttons inside as buttonOf names them, every other field as the engine has it.
function shownValue(design: Design, texts: Texts, value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => shownValue(design, texts, item))
  }
  if (typeof value !== 'object' || value === null) {
    return value
  }
  if (isRichDoc(value)) {
    return texts(value)
  }
  if (isButton(value)) {
    return buttonOf(design, value)
  }
  const fields = Object.entries(value)
  if (fields.length === 1 && 'media' in value && typeof value.media === 'string') {
    return design.media[value.media]?.name ?? value.media
  }
  if (fields.length === 1 && 'placeholder' in value) {
    const { placeholder } = value as { placeholder: { description: string } }
    return `A placeholder: ${placeholder.description}`
  }
  return Object.fromEntries(fields.map(([key, item]) => [key, shownValue(design, texts, item)]))
}

function chatOf(design: Design, texts: Texts, state: SimState) {
  return state.chat.flatMap((entry): object[] => {
    if (entry.from === 'user') {
      return [entry]
    }
    if (entry.deleted) {
      return []
    }
    const { id, keyboard } = entry
    return [
      {
        id,
        from: 'bot',
        step: design.steps[entry.step]?.idName ?? entry.step,
        ...(shownValue(design, texts, entry.content) as Record<string, unknown>),
        ...(keyboard && { buttons: keyboard.map((row) => row.map((button) => buttonOf(design, button))) }),
        ...(entry.edited && { edited: true }),
        ...(state.pinned.includes(id) && { pinned: true }),
        ...(entry.vote && { vote: entry.vote }),
        ...(entry.dice !== undefined && { dice: entry.dice }),
        ...(entry.paid !== undefined && { paid: entry.paid }),
        ...(entry.stopped !== undefined && { stopped: entry.stopped }),
        ...(entry.reaction && { reaction: entry.reaction }),
      },
    ]
  })
}

// What the bot waits for now, the bottom keyboard and the variables' values in this try.
function nowOf(design: Design, state: SimState) {
  const question = state.question ? design.steps[state.question.step] : undefined
  const values = Object.entries(state.vars).flatMap(([id, value]) =>
    value === null || value === undefined ? [] : [[design.variables[id]?.idName ?? id, value] as const],
  )
  return {
    ...(state.bottomKeyboard && {
      keyboard: state.bottomKeyboard.rows.map((row) => row.map((button) => buttonOf(design, button))),
    }),
    ...(state.placeholder !== null && { placeholder: state.placeholder }),
    ...(question?.kind === 'question' && {
      question: { step: question.idName, expects: question.expects, wrongAnswers: state.question?.tries ?? 0 },
    }),
    ...(state.choice && {
      choice: { prompt: state.choice.prompt, ways: state.choice.options.map((each) => each.label) },
    }),
    ...(state.payment && { paymentSheet: state.payment.entryId }),
    ...(state.blocked && { blocked: true }),
    ...(state.ended && { ended: true }),
    variables: Object.fromEntries(values),
  }
}

// Runs the design from its start through the actions as the test user, as Try it does.
export function tryDesign(design: Design, args: TryArgs) {
  let user = testUserOf(design, args)
  let sim = createSim(design, user)
  const start = startOf(design, args.from)
  const texts: Texts = (doc) =>
    args.texts === 'plain' ? plainText(doc, (id) => id) : toTelegram(doc, { varName: (id) => id }).html
  let state = settled(sim, sim.start(sim.initial, { step: start.step }))
  const run: { action: TryAction | { do: 'start'; from: string }; happened: string[] }[] = [
    { action: { do: 'start', from: start.label }, happened: state.log },
  ]
  let problem: string | undefined
  for (const [index, action] of (args.actions ?? []).entries()) {
    const before = state
    let happened: string[]
    try {
      if (action.do === 'setSwitch') {
        const item = switchOf(design, action.switch, action.value)
        user = { ...user, switches: { ...user.switches, [item.id]: action.value } }
        sim = createSim(design, user)
        happened = [`Set the test switch ${item.idName} to ${String(action.value)}`]
      } else {
        state = settled(sim, act(design, sim, state, action))
        if (state === before) {
          throw new Refusal(stuck(state))
        }
        happened = state.log.slice(before.log.length)
      }
    } catch (error) {
      if (!(error instanceof Refusal)) {
        throw error
      }
      problem = `Action ${String(index + 1)} (${action.do}): ${error.message} The actions after it did not run.`
      break
    }
    run.push({ action, happened })
  }
  return {
    language: user.language,
    run,
    ...(problem !== undefined && { problem }),
    chat: chatOf(design, texts, state),
    now: nowOf(design, state),
  }
}
