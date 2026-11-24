// toMarkdown: a plain design (SPEC-01) as design.md, the readable doc of the export
// (docs/plan/06-export-and-claude-link.md section 3): the summary, bot setup, the Mermaid map,
// start points, the steps grouped by section in map order (left to right, top to bottom) with
// their pictures, texts, buttons, options, logic and arrows in, then variables, parts, media,
// checks and the glossary; the open comments (stage 2) under each step as "Open questions". Texts are SPEC-02's Telegram HTML and plain text, the methods those of
// SPEC-03's telegram blocks; spec.json stays the source of truth.
import { check } from '../checks/check.ts'
import {
  andList,
  asButtonStep,
  asSending,
  buildContext,
  conditionsOf,
  contentOf,
  keyboardOf,
  mediaSlots,
  optionsOf,
  textSlots,
  type ButtonStep,
  type Context,
  type SendingStep,
} from '../checks/context.ts'
import type { Issue } from '../checks/issues.ts'
import { actionTelegram, buttonTelegram, invoiceTelegram, sendTelegram, waitsFor } from '../export/telegram.ts'
import type { Action } from '../model/actions.ts'
import type { Button, InlineAction, Keyboard, ReplyAction, Row } from '../model/buttons.ts'
import type { RememberAction } from '../model/conditions.ts'
import type { Content, MediaSlot, RichMessageBlock } from '../model/content.ts'
import type { Design } from '../model/design.ts'
import type { ButtonId, Lang, StepId } from '../model/ids.ts'
import type { Options } from '../model/options.ts'
import type { MediaItem } from '../model/parts.ts'
import type { AnswerChecks, Expects } from '../model/question.ts'
import { draftStops, type InvoiceStep, type Step } from '../model/steps.ts'
import type { LangText, RichTextRef } from '../model/texts.ts'
import type { SubscriptionState, Trigger } from '../model/triggers.ts'
import type { VariableType } from '../model/variables.ts'
import { LOOKS } from '../telegram/buttons.ts'
import { chatAction } from '../telegram/chatActions.ts'
import { EFFECTS } from '../telegram/effects.ts'
import { KEYBOARD_OPTIONS, KEYBOARD_TYPES } from '../telegram/keyboards.ts'
import { messageKind } from '../telegram/messages.ts'
import { isStars, priceText } from '../telegram/payments.ts'
import { BOT_API } from '../telegram/version.ts'
import { RICH_NODES, type RichDoc } from '../text/schema.ts'
import { toTelegram } from '../text/to-telegram.ts'
import { mapArrows, mapLines, type MapArrow } from './map.ts'
import { cell, code, fence, inline, quote, quoteLangs, table, target } from './md.ts'
import { sayCondition, sayGoTo, sayIf, sayRemember, sayStep, sayTarget, sayVariable } from './say.ts'

export type ToMarkdownOptions = {
  /** Only these languages, with the default one always; every language of the design by default. */
  languages?: readonly Lang[]
  /** The issues of the checks at export time; check(design) by default. */
  checks?: readonly Issue[]
  /**
   * The relative path of a picture in the export, or null when there is none (no picture line
   * then): `name` is a message or question step's ID name, or `bot-profile`, `empty-chat` or
   * `commands-menu`. No pictures without it.
   */
  pictures?: (name: string, lang: Lang) => string | null
  /**
   * A line about the pictures at the end of the summary: the Claude link's when its picture cache
   * has none or older ones (docs/plan/06 section 7.4). None by default.
   */
  picturesNote?: string | null
  /** When, as an ISO 8601 time. */
  exportedAt: string
  /** The version of the design's document the export was made from, and its name if it has one. */
  version: number
  versionName?: string | null
  /** The path of an uploaded file in the export, as toSpec's mediaFile gives it; its uploaded name without it. */
  mediaFile?: (item: MediaItem) => string
  /** The open comment threads (docs/plan/05 section 6), listed under their steps; none without it. */
  openQuestions?: readonly OpenQuestion[]
}

/**
 * An open comment thread as design.md lists it: on a step (its button, or its text in a language)
 * or a spot on the map (no step), the step's title when the thread started (for a step deleted
 * since), and its comments, the first one first.
 */
export type OpenQuestion = {
  stepId?: StepId
  buttonId?: ButtonId
  lang?: Lang
  title?: string
  comments: readonly { author: string; at: string; body: string }[]
}

type Doc = {
  design: Design
  ctx: Context
  /** The exported languages, the default one first. */
  langs: readonly Lang[]
  arrows: readonly MapArrow[]
  options: ToMarkdownOptions
}

// A Markdown block: lines that belong together; blocks are separated by an empty line.
type Block = string[]

/** design.md of an export. */
export function toMarkdown(design: Design, options: ToMarkdownOptions): string {
  const { languages } = design
  const langs = [
    languages.default,
    ...languages.list.filter((lang) => lang !== languages.default && options.languages?.includes(lang) !== false),
  ]
  const ctx = buildContext(design, [])
  const doc: Doc = { design, ctx, langs, arrows: mapArrows(ctx), options }
  const checks = options.checks ?? check(design)
  const blocks: Block[] = [
    [`# ${inline(design.name) || 'Untitled design'}`],
    ...summary(doc, checks),
    ...botSetup(doc),
    ['## 3. Map'],
    mapLines(ctx, doc.arrows),
    ...startPoints(doc),
    ...steps(doc),
    ...variables(doc),
    ...parts(doc),
    ...media(doc),
    ...checksSection(doc, checks),
    ...glossary(),
  ]
  return blocks.map((block) => block.join('\n')).join('\n\n') + '\n'
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)
const plural = (n: number, word: string) => `${String(n)} ${n === 1 ? word : `${word}s`}`
const byIdName = (a: { idName: string }, b: { idName: string }) =>
  a.idName < b.idName ? -1 : a.idName > b.idName ? 1 : 0
const stepMd = (step: Step) => inline(sayStep(step))
const isBox = (step: Step) => step.kind !== 'start' && step.kind !== 'note' && step.kind !== 'frame'

// 1. Title and summary.
function summary(doc: Doc, checks: readonly Issue[]): Block[] {
  const { ctx, options } = doc
  const count = (level: Issue['level']) => checks.filter((issue) => issue.level === level).length
  const ignored = checks.filter((issue) => issue.ignored === true).length
  const startCount = ctx.steps.filter((step) => step.kind === 'start').length
  const version = options.versionName?.trim()
  return [
    ['## 1. Summary'],
    [
      `- Exported: ${inline(options.exportedAt)}, version ${String(options.version)}${version ? ` ("${inline(version)}")` : ''}`,
      `- Telegram: Bot API ${BOT_API}, private chats`,
      `- Languages: ${doc.langs.map((lang, index) => (index === 0 ? `${lang} (default)` : lang)).join(', ')}`,
      `- ${plural(startCount, 'start point')}, ${plural(ctx.steps.filter(isBox).length, 'step')} and ${plural(ctx.buttons.length, 'button')}`,
      `- Checks: [${plural(count('error'), 'error')}, ${plural(count('warning'), 'warning')}, ${String(count('info'))} good-to-know](#9-checks)${
        ignored > 0 ? ` (${String(ignored)} marked "Ignore here")` : ''
      }`,
      ...(options.picturesNote ? [`- ${inline(options.picturesNote)}`] : []),
    ],
    [
      'Build from `spec.json`, the source of truth; this file is the reading aid. `HOW-TO-READ.md` explains both and how the design maps to the Bot API.',
    ],
  ]
}

// The picture lines of a step or a bot setup view, one per language that has a picture.
function pictureLines(doc: Doc, name: string, alt: string): string[] {
  const { pictures } = doc.options
  if (!pictures) return []
  return doc.langs.flatMap((lang) => {
    const path = pictures(name, lang)
    return path === null ? [] : [`![${inline(alt)}, ${lang}](${target(path)})`]
  })
}

// 2. Bot setup.
function botSetup(doc: Doc): Block[] {
  const { design, langs } = doc
  const { bot } = design
  const blocks: Block[] = [['## 2. Bot setup']]
  blocks.push(
    table(
      ['Language', 'Name', 'About', 'Description'],
      langs.map((lang) => [
        lang,
        cell(bot.name[lang] ?? ''),
        cell(bot.about[lang] ?? ''),
        cell(bot.description[lang] ?? ''),
      ]),
    ),
  )
  blocks.push([
    ...(bot.username === undefined ? [] : [`- Username: ${code(`@${bot.username}`)}`]),
    `- Profile photo: ${bot.photo === undefined ? 'none' : mediaRef(doc, bot.photo)} (\`setMyProfilePhoto\`)`,
    bot.menuButton === 'commands'
      ? '- Menu button: opens the commands menu (`setChatMenuButton` with `MenuButtonCommands`)'
      : "- Menu button: Telegram's default (`MenuButtonDefault`)",
  ])
  const commands = bot.commandOrder.flatMap((id) => {
    const start = design.steps[id]
    return start?.kind === 'start' && start.trigger.type === 'command' && start.trigger.inMenu
      ? [{ start, trigger: start.trigger }]
      : []
  })
  if (commands.length === 0) blocks.push(['The commands menu is empty.'])
  else {
    blocks.push(['The commands menu, in order (`setMyCommands` per `language_code`):'])
    blocks.push(
      table(
        ['Command', ...langs.map((lang) => `Menu text (${lang})`), 'Goes to'],
        commands.map(({ start, trigger }) => [
          code(`/${trigger.command}`),
          ...langs.map((lang) => cell(trigger.menuDescription[lang] ?? '')),
          inline(sayTarget(start.next, design)),
        ]),
      ),
    )
  }
  const pictures = [
    ...pictureLines(doc, 'bot-profile', 'Bot profile'),
    ...pictureLines(doc, 'empty-chat', 'Empty chat'),
    ...pictureLines(doc, 'commands-menu', 'Commands menu'),
  ]
  if (pictures.length > 0) blocks.push(pictures)
  return blocks
}

// 4. Start points: /start, the other commands, the start links, anything else, then the events
// (as Try it lists them), each in map order.
function startPoints(doc: Doc): Block[] {
  const { design } = doc
  const order = (trigger: Trigger) =>
    trigger.type === 'command' && trigger.command === 'start' ? 0 : TRIGGER_ORDER.indexOf(trigger.type) + 1
  const starts = doc.ctx.steps
    .flatMap((step) => (step.kind === 'start' ? [step] : []))
    .sort((a, b) => order(a.trigger) - order(b.trigger))
  if (starts.length === 0) return [['## 4. Start points'], ['The design has no start points yet.']]
  return [
    ['## 4. Start points'],
    table(
      ['Start point', 'When', 'Goes to', 'Note'],
      starts.map((start) => [
        stepMd(start),
        triggerWords(doc, start.trigger),
        inline(sayTarget(start.next, design)),
        cell(start.note ?? ''),
      ]),
    ),
  ]
}

function triggerWords(doc: Doc, trigger: Trigger): string {
  switch (trigger.type) {
    case 'command':
      return trigger.command === 'start'
        ? `The user opens the bot or sends ${code('/start')}`
        : `The command ${code(`/${trigger.command}`)}${trigger.inMenu ? ', in the commands menu' : ''}`
    case 'startLink': {
      const link = code(`t.me/${doc.design.bot.username ?? 'yourbot'}?start=${trigger.payload}`)
      const saved =
        trigger.saveRestTo === undefined
          ? ''
          : `; the rest is saved as ${inline(sayVariable(trigger.saveRestTo, doc.design))}`
      return trigger.match === 'exact'
        ? `The start link ${link} (${code(`/start ${trigger.payload}`)})`
        : `A start link that starts with ${link} (${code(`/start ${trigger.payload}<rest>`)})${saved}`
    }
    case 'fallback':
      return {
        any: 'Anything else the user sends',
        text: 'Any other text the user sends',
        media: 'Any other photo, video or file the user sends',
      }[trigger.accepts]
    case 'paymentDone': {
      const of = trigger.invoice === undefined ? 'any invoice' : inline(sayTarget(trigger.invoice, doc.design))
      return `A payment of ${of} that its "Paid" arrow does not take, such as a subscription paid again (${code('message.successful_payment')})`
    }
    case 'refunded': {
      const of = trigger.invoice === undefined ? 'any invoice' : inline(sayTarget(trigger.invoice, doc.design))
      return `A payment of ${of} is refunded (${code('message.refunded_payment')})`
    }
    case 'subscriptionChanged': {
      const of = trigger.invoice === undefined ? 'any invoice' : inline(sayTarget(trigger.invoice, doc.design))
      const changes =
        trigger.state === undefined ? 'is canceled, turned back on or not paid' : SUBSCRIPTION_WORDS[trigger.state]
      const state = trigger.state === undefined ? '' : `, state ${code(trigger.state)}`
      return `The user's Stars subscription of ${of} ${changes} (${code('subscription')}${state})`
    }
    case 'userBlocks':
      return `The user blocks the bot (${code('my_chat_member')}, status ${code('kicked')}); until the user restarts it, the bot cannot send them anything`
    case 'userRestarts':
      return `The user restarts the bot after blocking it (${code('my_chat_member')}, status ${code('member')}); Telegram's Restart button also sends ${code('/start')}`
    case 'broadcast': {
      const when = trigger.when.trim() === '' ? 'not given yet' : inline(trigger.when.trim())
      return `The bot writes first to ${audienceWords(doc, trigger.audience)} (no update: the bot starts it). When: ${when}`
    }
  }
}

// The order of the start points after /start, as Try it lists them.
const TRIGGER_ORDER: readonly Trigger['type'][] = [
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

const SUBSCRIPTION_WORDS: Record<SubscriptionState, string> = {
  canceled: 'is canceled',
  active: 'is turned back on',
  failed: 'could not be paid',
}

// Who a broadcast goes to, in words.
function audienceWords(doc: Doc, audience: Extract<Trigger, { type: 'broadcast' }>['audience']): string {
  if (audience === 'everyone') return 'everyone who started the bot and did not block it'
  if (('all' in audience ? audience.all : audience.any).length === 0) return 'users not chosen yet'
  return `the users for whom ${inline(sayCondition(audience, doc.design))}`
}

// 5. Steps, grouped by section, in map order.
function steps(doc: Doc): Block[] {
  const { design, ctx } = doc
  const sectionOf = (step: Step) => {
    const frame = step.frame === undefined ? undefined : design.steps[step.frame]
    return frame?.kind === 'frame' ? frame.id : undefined
  }
  const groupBlocks = (section: StepId | undefined): Block[] => {
    const inGroup = ctx.steps.filter((step) => sectionOf(step) === section)
    return [
      ...inGroup.filter(isBox).flatMap((step) => stepBlocks(doc, step)),
      ...inGroup.flatMap((step) =>
        step.kind === 'note' && step.text.trim() !== '' ? [['**Note on the map:**', ...quote(step.text.trim())]] : [],
      ),
    ]
  }
  const sections = ctx.steps.filter((step) => step.kind === 'frame')
  if (sections.length === 0) {
    const blocks = groupBlocks(undefined)
    return [
      ['## 5. Steps'],
      [blocks.length === 0 ? 'No steps yet.' : 'In map order: left to right, top to bottom.'],
      ...blocks,
      ...questionBlocks(doc, undefined),
    ]
  }
  const result: Block[] = [['## 5. Steps'], ['Grouped by section, in map order: left to right, top to bottom.']]
  let n = 0
  for (const section of [...sections, undefined]) {
    const blocks = groupBlocks(section?.id)
    if (blocks.length === 0) continue
    n += 1
    result.push([`## 5.${String(n)} ${section === undefined ? 'Not in a section' : stepMd(section)}`])
    if (section?.note?.trim()) result.push(["**Designer's note:**", ...quote(section.note.trim())])
    result.push(...blocks)
  }
  result.push(...questionBlocks(doc, undefined))
  return result
}

// The open questions of a step, or (no step) the others: on deleted steps, on boxes without a step
// block (start points, notes, sections) and on the map, at the end of section 5.
function questionBlocks(doc: Doc, step: Step | undefined): Block[] {
  const { design } = doc
  const elsewhere = (id: StepId | undefined) => {
    const on = id === undefined ? undefined : design.steps[id]
    return on === undefined || !isBox(on)
  }
  const questions = (doc.options.openQuestions ?? []).filter((question) =>
    step === undefined ? elsewhere(question.stepId) : question.stepId === step.id,
  )
  if (questions.length === 0) return []
  const lines = questions.flatMap((question) => {
    const [first, ...replies] = question.comments
    if (!first) return []
    const said = (comment: OpenQuestion['comments'][number]) =>
      `${inline(comment.author) || 'Someone'} (${comment.at.slice(0, 10)}): ${inline(comment.body)}`
    return [`- ${questionPlace(doc, question)}${said(first)}`, ...replies.map((reply) => `  - ${said(reply)}`)]
  })
  if (lines.length === 0) return []
  return [[step === undefined ? '**Other open questions:**' : '**Open questions:**', '', ...lines]]
}

// Where a question is, before its first comment: "On the button "Buy": ", nothing on the step itself.
function questionPlace(doc: Doc, question: OpenQuestion): string {
  const { design, langs } = doc
  if (question.stepId === undefined) return 'On the map: '
  const step = design.steps[question.stepId]
  if (!step) return `On a deleted step, "${inline(question.title ?? '')}": `
  if (!isBox(step)) return `On ${stepMd(step)}: `
  if (question.buttonId !== undefined) {
    const button = design.buttons[question.buttonId]
    return button ? `On the button ${quoteLangs(button.label, langs.slice(0, 1))}: ` : 'On a deleted button: '
  }
  return question.lang === undefined ? '' : `On the text in ${code(question.lang)}: `
}

function stepBlocks(doc: Doc, step: Step): Block[] {
  const blocks: Block[] = [[`### ${stepMd(step)}`], [kindWords(step)]]
  const sending = asButtonStep(step)
  if (sending) {
    const pictures = pictureLines(doc, step.idName, step.title.trim() || step.idName)
    if (pictures.length > 0) blocks.push(pictures)
    blocks.push(
      ...(sending.kind === 'invoice' ? invoiceBlocks(doc, sending) : contentBlocks(doc, contentOf(sending), sending)),
    )
    blocks.push(...keyboardBlocks(doc, sending))
    const options = optionsWords(optionsOf(sending))
    if (options.length > 0) blocks.push([`**Options:** ${options.join('; ')}.`])
  }
  blocks.push(...logicBlocks(doc, step))
  blocks.push(comesFrom(doc, step))
  if (step.note?.trim()) blocks.push(["**Designer's note:**", ...quote(step.note.trim())])
  blocks.push(...questionBlocks(doc, step))
  return blocks
}

// The catalog's name of a content kind: "Text", "Photo", "Album of 3 items", "Dice 🎲".
function contentWords(content: Content): string {
  const { label } = messageKind(content.type)
  switch (content.type) {
    case 'album':
    case 'paidMedia':
      return `${label} of ${plural(content.items.length, 'item')}`
    case 'poll':
    case 'quiz':
      return `${label} with ${plural(content.options.length, 'option')}`
    case 'dice':
      return `${label} ${content.emoji}`
    case 'rich':
      return `${label} of ${plural(content.blocks.length, 'block')}`
    default:
      return label
  }
}

const EXPECTS: Record<Expects, string> = {
  text: 'a text',
  number: 'a number',
  email: 'an email address',
  phone: 'a phone number (a shared contact or typed digits)',
  location: 'a location (a shared location or venue)',
  photo: 'a photo',
  video: 'a video',
  file: 'a file',
  voice: 'a voice message',
  audio: 'an audio file',
  any: 'anything',
}

function kindWords(step: Step): string {
  switch (step.kind) {
    case 'message': {
      const { method } = sendTelegram({ content: step.content, keyboard: step.keyboard })
      return `A message: ${contentWords(step.content)}, sent with ${code(method)}.`
    }
    case 'question': {
      const { method } = sendTelegram({ content: step.prompt.content, keyboard: step.prompt.keyboard })
      const updates = waitsFor(step.expects).map(code).join(' or ')
      return `A question: asks with a message (${contentWords(step.prompt.content)}, ${code(method)}) and waits for ${EXPECTS[step.expects]} (${updates}).`
    }
    case 'if':
      return 'An If box: the first case that holds decides the way on.'
    case 'remember':
      return 'A Remember box: sets, clears or changes variables, then goes on.'
    case 'wait':
      return 'A Wait box: waits, then goes on.'
    case 'devStep':
      return 'A developer step: a job only the developer can do; its outcomes are the only ways on.'
    case 'goTo':
      return 'A Go to box: jumps to a step elsewhere on the map.'
    case 'end':
      return 'An End box: the conversation ends.'
    case 'invoice': {
      const { method } = invoiceTelegram(step)
      const { invoice } = step
      const total = invoice.prices.reduce((sum, price) => sum + price.amount, 0)
      const what = invoice.subscription
        ? `a subscription of ${priceText(invoice.currency, total)} every ${plural(invoice.subscription.periodDays, 'day')}`
        : `${priceText(invoice.currency, total)} ${isStars(invoice.currency) ? 'in Telegram Stars' : 'by card'}`
      return `An invoice: asks the user to pay ${what}, sent with ${code(method)}.`
    }
    case 'action':
      return `An action: ${ACTION_WORDS[step.action.type]} (${code(actionTelegram(step.action).method)}), then goes on.`
    default:
      return ''
  }
}

const ACTION_WORDS: Record<Action['type'], string> = {
  react: "sets the bot's reaction on a message",
  pin: 'pins a message',
  unpin: 'unpins a message',
  delete: 'deletes a message',
  gift: "sends the user a gift paid from the bot's Stars",
  chatAction: "shows a chat action under the bot's name",
  refund: "gives back the user's Stars payment",
}

// What an invoice sells, in words: its texts per language, the price lines, a subscription, what
// the payment sheet asks for and the shipping options.
function invoiceBlocks(doc: Doc, step: InvoiceStep): Block[] {
  const { invoice } = step
  const { langs } = doc
  const money = (amount: number) => code(priceText(invoice.currency, amount))
  const blocks: Block[] = [
    table(
      ['Language', 'Title', 'Description'],
      langs.map((lang) => [lang, cell(invoice.title[lang] ?? ''), cell(invoice.description[lang] ?? '')]),
    ),
  ]
  const lines = [
    `**Currency:** ${code(invoice.currency)}${isStars(invoice.currency) ? ' (Telegram Stars)' : ' (paid by card)'}.`,
    '',
    `**Sells:** ${invoice.physical ? 'physical goods or a service outside the app stores' : 'digital goods or services'}.`,
  ]
  if (invoice.photo) lines.push('', `**Photo:** ${mediaRef(doc, invoice.photo)} (sent as ${code('photo_url')}).`)
  if (invoice.subscription) {
    lines.push(
      '',
      `**Subscription:** the user pays again every ${plural(invoice.subscription.periodDays, 'day')}; the bot makes the link with ${code('createInvoiceLink')} and sends it in a url button in place of the pay button, on a plain message with the title in bold over the description (Telegram has no invoice card for a subscription).`,
    )
  }
  if (step.keyboard === null) {
    const total = invoice.prices.reduce((sum, price) => sum + price.amount, 0)
    lines.push(
      '',
      `**Buttons:** none; Telegram shows its own pay button ("Pay ${priceText(invoice.currency, total)}").`,
    )
  }
  lines.push('', `**Payload:** ${code(invoice.payload ?? step.idName)}.`)
  blocks.push(lines)
  blocks.push(
    invoice.prices.length === 0
      ? ['**Prices:** none yet.']
      : table(
          [...langs.map((lang) => `Price line (${lang})`), 'Amount'],
          invoice.prices.map((price) => [...langs.map((lang) => cell(price.label[lang] ?? '')), money(price.amount)]),
        ),
  )
  const { physical } = invoice
  if (physical) {
    const asks = [
      physical.needName && 'the name',
      physical.needPhone && 'the phone number',
      physical.needEmail && 'the email',
      physical.needAddress && 'the shipping address',
    ].filter((item) => item !== false)
    blocks.push([`**The payment sheet asks for:** ${asks.length === 0 ? 'nothing more' : andList(asks)}.`])
    if (physical.flexibleShipping) {
      blocks.push(
        ['**Shipping:** the price depends on the address; the bot answers with these options:'],
        physical.shippingOptions.length === 0
          ? ['No shipping options yet.']
          : table(
              ['Option', ...langs.map((lang) => `Title (${lang})`), 'Price'],
              physical.shippingOptions.map((option, index) => [
                code(`${step.idName}_shipping_${String(index + 1)}`),
                ...langs.map((lang) => cell(option.title[lang] ?? '')),
                money(option.amount),
              ]),
            ),
      )
    }
  }
  return blocks
}

// An uploaded file by its path in the export (or its uploaded name), or a placeholder.
function mediaRef(doc: Doc, slot: MediaSlot): string {
  if ('placeholder' in slot) return `placeholder: "${inline(slot.placeholder.description)}"`
  const item = doc.design.media[slot.media]
  if (item === undefined) return 'a file the design no longer has'
  return doc.options.mediaFile ? code(doc.options.mediaFile(item)) : `"${inline(item.name)}" (uploaded)`
}

// A rich text in every exported language: Telegram HTML in a code block and the plain reading.
function textBlocks(doc: Doc, what: string, text: RichTextRef): Block[] {
  const { design } = doc
  return doc.langs.flatMap((lang): Block[] => {
    const rich = text.doc[lang]
    if (rich === undefined) return [[`**${what} (${lang}):** none in this language.`]]
    const telegram = toTelegram(rich, {
      varName: (id) => design.variables[id]?.idName ?? id,
      part: (id) => {
        const part = design.parts[id]
        return part?.kind === 'text' ? part.text.doc[lang] : undefined
      },
    })
    const plain = telegram.text.trim() === '' ? ['(empty)'] : quote(telegram.text)
    return [[`**${what} (${lang})**`], fence(telegram.html, 'html'), plain]
  })
}

function contentBlocks(doc: Doc, content: Content, step: SendingStep): Block[] {
  const caption = (ref: RichTextRef | undefined, what = 'Caption') =>
    ref === undefined ? [] : textBlocks(doc, what, ref)
  const flags = (words: (string | false | undefined)[]) =>
    words.filter((word): word is string => typeof word === 'string' && word !== '').join(', ')
  const label = content.type === 'album' ? 'Album' : messageKind(content.type).label
  switch (content.type) {
    case 'text':
      return textBlocks(doc, 'Text', content.text)
    case 'poll':
    case 'quiz':
      return pollBlocks(doc, content)
    case 'dice':
      return [
        [`**Dice:** ${content.emoji}; Telegram rolls the value, the bot reads it from ${code('message.dice.value')}.`],
        ...(content.saveTo === undefined
          ? []
          : [[`**Saves the roll as:** ${inline(sayVariable(content.saveTo, doc.design))}.`]]),
      ]
    case 'paidMedia':
      return [
        [
          `**Paid media:** ${plural(content.stars, 'Star')} to unlock${
            content.captionAbove === true ? ', caption above' : ''
          }`,
          ...content.items.map((item, index) => `${String(index + 1)}. ${mediaRef(doc, item.media)}`),
        ],
        ...caption(content.caption),
      ]
    case 'photo':
    case 'livePhoto':
    case 'video':
    case 'animation': {
      const more = flags([
        content.spoiler === true && 'with a spoiler',
        content.captionAbove === true && 'caption above',
      ])
      return [[`**${label}:** ${mediaRef(doc, content.media)}${more ? `, ${more}` : ''}`], ...caption(content.caption)]
    }
    case 'audio': {
      const more = flags([
        content.title?.trim() && `title "${inline(content.title)}"`,
        content.performer?.trim() && `performer "${inline(content.performer)}"`,
      ])
      return [[`**${label}:** ${mediaRef(doc, content.media)}${more ? `, ${more}` : ''}`], ...caption(content.caption)]
    }
    case 'voice':
    case 'document':
      return [[`**${label}:** ${mediaRef(doc, content.media)}`], ...caption(content.caption)]
    case 'videoNote':
    case 'sticker':
      return [[`**${label}:** ${mediaRef(doc, content.media)}`]]
    case 'album':
      return [
        [
          '**Album items:**',
          ...content.items.map(
            (item, index) =>
              `${String(index + 1)}. ${mediaRef(doc, item.media)}${item.spoiler === true ? ', with a spoiler' : ''}`,
          ),
        ],
        ...content.items.flatMap((item, index) => caption(item.caption, `Caption of item ${String(index + 1)}`)),
      ]
    case 'location':
      return [
        [
          `**Location:** ${String(content.latitude)}, ${String(content.longitude)}${
            content.livePeriodSec === undefined ? '' : `, shared live for ${plural(content.livePeriodSec, 'second')}`
          }`,
        ],
      ]
    case 'venue':
      return [
        [
          `**Venue:** "${inline(content.title)}", "${inline(content.address)}", at ${String(content.latitude)}, ${String(content.longitude)}`,
        ],
      ]
    case 'contact':
      return [
        [`**Contact:** ${inline(content.phone)}, ${inline([content.firstName, content.lastName ?? ''].join(' '))}`],
      ]
    case 'rich':
      return [
        [
          `**Rich message:** ${plural(content.blocks.length, 'block')}${content.rtl === true ? ', right to left' : ''}; ` +
            `send them as ${code('rich_message.blocks')} (InputRichBlock), each text as its own block's text.`,
        ],
        ...content.blocks.flatMap((block, index) => richBlockBlocks(doc, block, index + 1, step)),
      ]
  }
}

const RICH_BLOCK_WORDS = {
  paragraph: 'Paragraph',
  footer: 'Footer',
  heading: 'Heading',
  code: 'Code block',
  quote: 'Quote',
  list: 'List',
  table: 'Table',
  details: 'Details',
  divider: 'Divider',
  media: 'Media',
  buttons: 'Buttons',
} as const

// A rich message's block: what it is and its settings in words, then its texts.
function richBlockBlocks(doc: Doc, block: RichMessageBlock, n: number, step: SendingStep): Block[] {
  const what = `Block ${String(n)}`
  const head = (words: (string | false | undefined)[]) => {
    const more = words.filter((word): word is string => typeof word === 'string' && word !== '')
    return [`**${what}: ${RICH_BLOCK_WORDS[block.type]}${more.length > 0 ? `, ${more.join(', ')}` : ''}**`]
  }
  switch (block.type) {
    case 'paragraph':
    case 'footer':
      return [head([]), ...textBlocks(doc, what, block.text)]
    case 'heading':
      return [head([`size ${String(block.size)}`]), ...textBlocks(doc, what, block.text)]
    case 'code':
      return [
        head([block.language?.trim() && `language ${code(block.language)}`]),
        ...textBlocks(doc, what, block.text),
      ]
    case 'quote':
      return [
        head([block.expandable === true && 'expandable']),
        ...textBlocks(doc, what, block.text),
        ...(block.credit ? textBlocks(doc, `Credit of block ${String(n)}`, block.credit) : []),
      ]
    case 'list':
      return [
        head([block.ordered ? 'numbered' : 'bulleted', plural(block.items.length, 'item')]),
        ...block.items.flatMap((item, index) =>
          textBlocks(
            doc,
            `Item ${String(index + 1)}${item.checked === undefined ? '' : item.checked ? ' (ticked box)' : ' (empty box)'}`,
            item.text,
          ),
        ),
      ]
    case 'table': {
      const columns = Math.max(0, ...block.rows.map((row) => row.cells.length))
      return [
        head([
          `${plural(block.rows.length, 'row')} of ${plural(columns, 'column')}`,
          block.bordered === true && 'bordered',
          block.striped === true && 'striped',
          block.compact === true && 'compact',
        ]),
        ...doc.langs.map((lang) =>
          table(
            Array.from({ length: columns }, (_, index) => `Column ${String(index + 1)} (${lang})`),
            block.rows.map((row) =>
              row.cells.map((item) => {
                const text = item.text.doc[lang] === undefined ? '' : richPlain(doc, item.text.doc[lang], lang)
                return item.header === true ? `**${cell(text)}**` : cell(text)
              }),
            ),
          ),
        ),
        ...(block.caption ? textBlocks(doc, `Caption of block ${String(n)}`, block.caption) : []),
      ]
    }
    case 'details':
      return [
        head([block.open === true ? 'shown open' : 'closed until tapped']),
        ...textBlocks(doc, `Title of block ${String(n)}`, block.summary),
        ...textBlocks(doc, what, block.text),
      ]
    case 'divider':
      return [head([])]
    case 'media':
      return [
        [`**${what}: Media:** ${mediaRef(doc, block.media)}${block.spoiler === true ? ', with a spoiler' : ''}`],
        ...(block.caption ? textBlocks(doc, `Caption of block ${String(n)}`, block.caption) : []),
      ]
    case 'buttons':
      return [
        head([
          block.align !== undefined && `aligned ${block.align}`,
          `inside the message (${code('InputRichBlockButtons')})`,
        ]),
        buttonsTable(doc, step, [{ type: 'buttons', ids: block.ids }]),
      ]
  }
}

// One language of a rich text as Telegram's plain text.
function richPlain(doc: Doc, rich: RichDoc, lang: Lang): string {
  const { design } = doc
  return toTelegram(rich, {
    varName: (id) => design.variables[id]?.idName ?? id,
    part: (id) => {
      const part = design.parts[id]
      return part?.kind === 'text' ? part.text.doc[lang] : undefined
    },
  }).text
}

// A poll or quiz: its settings in words, the question, the options per language and the explanation.
function pollBlocks(doc: Doc, poll: Extract<Content, { type: 'poll' | 'quiz' }>): Block[] {
  const quiz = poll.type === 'quiz'
  const words = [
    poll.anonymous ? 'anonymous' : 'not anonymous (the bot learns who voted)',
    poll.multiple ? 'several answers allowed' : 'one answer',
    poll.revote !== undefined && (poll.revote ? 'votes can be changed' : 'votes cannot be changed'),
    poll.shuffle === true && 'options in random order',
    poll.type === 'poll' && poll.addOptions === true && 'users can add options',
    poll.hideResults === true && 'results hidden until it closes',
    poll.closeAfterSec !== undefined && `closes ${plural(poll.closeAfterSec, 'second')} after it is sent`,
    poll.closeAt !== undefined && `closes at ${new Date(poll.closeAt * 1000).toISOString()}`,
  ].filter((word): word is string => typeof word === 'string')
  const right = (index: number) => (quiz && poll.correct.includes(index) ? 'yes' : '')
  const rows = poll.options.map((option, index) => [
    String(index + 1),
    ...doc.langs.map((lang) => cell(option[lang] ?? '')),
    ...(quiz ? [right(index)] : []),
  ])
  return [
    [`**${quiz ? 'Quiz' : 'Poll'}:** ${words.join(', ')}.`],
    ...textBlocks(doc, 'Question', poll.question),
    rows.length === 0
      ? ['No options yet.']
      : table(['Option', ...doc.langs.map((lang) => `Text (${lang})`), ...(quiz ? ['Right answer'] : [])], rows),
    ...(poll.type === 'quiz' && poll.explanation ? textBlocks(doc, 'Explanation', poll.explanation) : []),
    ...(poll.saveTo === undefined
      ? []
      : [
          [
            `**Saves the vote as:** ${inline(sayVariable(poll.saveTo, doc.design))} (${
              quiz ? 'yes when the answer is right, else no' : "the option's text in the default language"
            }; from ${code('poll_answer.option_ids')}).`,
          ],
        ]),
  ]
}

const optionLabel = (id: (typeof KEYBOARD_OPTIONS)[number]['id']) =>
  KEYBOARD_OPTIONS.find((row) => row.id === id)?.label ?? id
const keyboardObject = (type: NonNullable<Keyboard>['type']) =>
  code(KEYBOARD_TYPES.find((row) => row.id === type)?.object ?? type)

function keyboardBlocks(doc: Doc, step: ButtonStep): Block[] {
  const keyboard = keyboardOf(step)
  if (keyboard === null) return []
  const hint = (placeholder: LangText | undefined) =>
    placeholder === undefined
      ? ''
      : `; ${lower(optionLabel('input_field_placeholder'))}: ${quoteLangs(placeholder, doc.langs)}`
  switch (keyboard.type) {
    case 'removeReply':
      return [[`**Keyboard:** removes the bottom keyboard (${keyboardObject(keyboard.type)}).`]]
    case 'forceReply':
      return [
        [
          `**Keyboard:** opens the reply field for an answer (${keyboardObject(keyboard.type)})${hint(keyboard.placeholder)}.`,
        ],
      ]
    case 'inline':
    case 'reply': {
      const words =
        keyboard.type === 'inline'
          ? [`buttons under the message (${keyboardObject(keyboard.type)})`]
          : [
              `a bottom keyboard (${keyboardObject(keyboard.type)})`,
              ...[
                keyboard.oneTime && optionLabel('one_time_keyboard'),
                keyboard.persistent && optionLabel('is_persistent'),
                keyboard.resize && optionLabel('resize_keyboard'),
              ].flatMap((word) => (word === false ? [] : [lower(word)])),
            ]
      if (keyboard.openReplyField === true) words.push(`also ${lower(optionLabel('force_reply'))}`)
      const head = `**Buttons:** ${words.join(', ')}${keyboard.type === 'reply' ? hint(keyboard.placeholder) : ''}.`
      return [[head], buttonsTable(doc, step, keyboard.rows)]
    }
  }
}

// A look by the editor's swatch name and its style: "Blue (primary)".
function lookWords(button: Button): string {
  const look = LOOKS.find((row) => row.id === button.look)
  if (look === undefined) return button.look
  return look.style === null ? look.label : `${look.label} (${look.style})`
}

function buttonsTable(doc: Doc, step: ButtonStep, rows: readonly Row[]): Block {
  const { design, langs } = doc
  const lines: string[][] = []
  let n = 0
  const add = (ids: readonly string[], part?: string) => {
    n += 1
    for (const id of ids) {
      const button = design.buttons[id]
      if (button === undefined) continue
      const icon = button.icon === undefined ? '' : `${inline(button.icon.fallback)} ${code(button.icon.customEmojiId)}`
      lines.push([
        part === undefined ? String(n) : `${String(n)} (part ${part})`,
        ...langs.map((lang) => cell(button.label[lang] ?? '')),
        lookWords(button),
        icon,
        buttonDoes(doc, button, step),
      ])
    }
  }
  for (const row of rows) {
    if (row.type === 'buttons') add(row.ids)
    else {
      const part = design.parts[row.part]
      if (part?.kind !== 'rows') continue
      for (const ids of part.rows) add(ids, inline(part.name.trim() || part.idName))
    }
  }
  if (lines.length === 0) return ['No buttons yet.']
  return table(['Row', ...langs.map((lang) => `Text (${lang})`), 'Look', 'Icon', 'What it does'], lines)
}

const SHOW_WORDS = {
  edit: 'by editing this message',
  new: 'by sending a new message',
  replace: 'by deleting this one and sending a new one',
} as const

function rememberWords(doc: Doc, actions: readonly RememberAction[] | undefined): string[] {
  if (actions === undefined || actions.length === 0) return []
  return [`remembers: ${andList(actions.map((action) => inline(lower(sayRemember(action, doc.design)))))}`]
}

// What a press does, in words: "Goes to Coffee list (coffee_list), by editing this message, shows
// a toast: "Opening your cart"". An edit Telegram cannot make is a new message (SPEC-03's onClick).
function buttonDoes(doc: Doc, button: Button, step: ButtonStep): string {
  const { design, langs } = doc
  if (button.place === 'reply') return replyDoes(doc, button.action)
  if (button.disabled === true) return 'Does nothing (disabled)'
  const { action } = button
  switch (action.type) {
    case 'goTo': {
      const words: string[] = []
      if (action.target === 'stay') words.push('Stays on this message')
      else {
        words.push(inline(capital(sayGoTo(action.target, design, 'goes'))))
        if (action.target !== undefined) words.push(showWords(doc, button, action, step))
      }
      if (action.popup) {
        const kind = action.popup.kind === 'alert' ? 'an alert' : 'a toast'
        words.push(`shows ${kind}: ${quoteLangs(action.popup.text, langs)}`)
      }
      return [...words, ...rememberWords(doc, action.remember)].join(', ')
    }
    case 'url':
      return action.url.trim() === '' ? 'Opens a link (none yet)' : `Opens the link ${code(action.url)}`
    case 'copyText':
      return `Copies ${quoteLangs(action.text, langs)}`
    case 'loginUrl':
      return `Logs the user in on ${action.url.trim() === '' ? 'a website (no link yet)' : code(action.url)}${
        action.requestWriteAccess ? ', asking to let the bot message them' : ''
      }`
    case 'pay':
      return "Opens Telegram's payment sheet (the pay button)"
  }
}

function showWords(
  doc: Doc,
  button: Button,
  action: Extract<InlineAction, { type: 'goTo' }>,
  step: ButtonStep,
): string {
  if (action.show !== 'edit') return SHOW_WORDS[action.show]
  const shown = step.kind === 'invoice' ? 'invoice' : { content: contentOf(step), keyboard: keyboardOf(step) }
  const last = buttonTelegram(button, shown, doc.design).onClick?.at(-1) ?? ''
  return last.startsWith('send') && last !== 'send*'
    ? 'by sending a new message (Telegram cannot edit this message into it)'
    : SHOW_WORDS.edit
}

function replyDoes(doc: Doc, action: ReplyAction): string {
  const { design } = doc
  const words: string[] = []
  const asks = (items: [boolean, string][]) => {
    const asked = items.flatMap(([on, word]) => (on ? [word] : []))
    return asked.length === 0 ? '' : `, asking for ${andList(asked)}`
  }
  switch (action.type) {
    case 'text':
      words.push('Sends its text', ...rememberWords(doc, action.remember))
      break
    case 'sharePhone':
      words.push("Shares the user's phone number")
      break
    case 'shareLocation':
      words.push("Shares the user's location")
      break
    case 'pickUsers': {
      const only = [
        action.bots === true ? 'bots only' : action.bots === false ? 'no bots' : '',
        action.premium === true ? 'Premium users only' : action.premium === false ? 'no Premium users' : '',
      ].filter((word) => word !== '')
      words.push(
        `Picks ${action.max === 1 ? 'a user' : `up to ${String(action.max)} users`}${only.length > 0 ? ` (${only.join(', ')})` : ''}${asks(
          [
            [action.askName, 'their name'],
            [action.askUsername, 'username'],
            [action.askPhoto, 'photo'],
          ],
        )}`,
      )
      break
    }
    case 'pickChat': {
      const only = [
        action.forum === true ? 'a forum' : action.forum === false ? 'not a forum' : '',
        action.hasUsername === true ? 'with a username' : action.hasUsername === false ? 'without a username' : '',
        action.userIsOwner === true ? 'that the user owns' : '',
        action.botIsMember === true ? 'that the bot is in' : '',
      ].filter((word) => word !== '')
      words.push(
        `Picks ${action.channel ? 'a channel' : 'a group'}${only.length > 0 ? ` (${only.join(', ')})` : ''}${asks([
          [action.askTitle, 'its title'],
          [action.askUsername, 'username'],
          [action.askPhoto, 'photo'],
        ])}`,
      )
      break
    }
    case 'createPoll':
      words.push({ any: 'Creates a poll', regular: 'Creates a regular poll', quiz: 'Creates a quiz' }[action.pollType])
      break
  }
  if (action.type !== 'text' && action.saveTo !== undefined) {
    words.push(`saves it as ${inline(sayVariable(action.saveTo, design))}`)
  }
  words.push(`then ${inline(sayGoTo(action.goTo, design, 'goes'))}`)
  return words.join(', ')
}

function optionsWords(options: Options): string[] {
  const words: string[] = []
  if (options.delaySec !== undefined && options.delaySec > 0) {
    words.push(`waits ${plural(options.delaySec, 'second')} before sending`)
  }
  if (options.chatAction) {
    const { action, seconds } = options.chatAction
    words.push(`shows "${chatAction(action).label}" (${code(action)}) for ${plural(seconds, 'second')} first`)
  }
  if (options.silent === true) words.push('silent: no sound (`disable_notification`)')
  if (options.protect === true) words.push('protected: no forwarding or saving (`protect_content`)')
  const preview = options.linkPreview
  if (preview) {
    words.push(
      preview.off
        ? 'no link preview'
        : `link preview${preview.url ? ` of ${code(preview.url)}` : ''}, size ${preview.size}${preview.above ? ', above the text' : ''}`,
    )
  }
  if (options.effect !== undefined) {
    const effect = EFFECTS.find((row) => row.id === options.effect || row.effectId === options.effect)
    words.push(
      effect === undefined
        ? `message effect ${code(options.effect)}`
        : `message effect ${effect.emoji} (\`message_effect_id\` ${code(effect.effectId)})`,
    )
  }
  if (options.draft === true) {
    words.push('written out like a draft first (`sendMessageDraft`, or `sendRichMessageDraft` for a rich message)')
    if (options.draftStop === true) {
      words.push(
        options.draftKeep === true
          ? 'the user can stop the draft (`can_stop`), which then stays a while (`keep_on_stop`)'
          : 'the user can stop the draft (`can_stop`)',
      )
    }
  }
  return words
}

const UNITS = { seconds: 'second', minutes: 'minute', hours: 'hour', days: 'day' } as const

const PATTERN_WORDS: Record<NonNullable<AnswerChecks['pattern']>, string> = {
  email: 'an email address',
  url: 'a link',
  phone: 'a phone number',
  date: 'a date',
}

const CHECK_WORDS: Record<keyof AnswerChecks, (checks: AnswerChecks) => string | undefined> = {
  minLength: ({ minLength }) => (minLength === undefined ? undefined : `at least ${plural(minLength, 'character')}`),
  maxLength: ({ maxLength }) => (maxLength === undefined ? undefined : `at most ${plural(maxLength, 'character')}`),
  min: ({ min }) => (min === undefined ? undefined : `at least ${String(min)}`),
  max: ({ max }) => (max === undefined ? undefined : `at most ${String(max)}`),
  wholeNumber: ({ wholeNumber }) => (wholeNumber === true ? 'a whole number' : undefined),
  pattern: ({ pattern }) => (pattern === undefined ? undefined : `in the form of ${PATTERN_WORDS[pattern]}`),
  maxFileMb: ({ maxFileMb }) => (maxFileMb === undefined ? undefined : `at most ${String(maxFileMb)} MB`),
  fileTypes: ({ fileTypes }) =>
    fileTypes === undefined || fileTypes.length === 0 ? undefined : `of type ${fileTypes.join(', ')}`,
}

// Options and logic in sentences, and where the step goes on.
function logicBlocks(doc: Doc, step: Step): Block[] {
  const { design, langs } = doc
  const goes = (to: Parameters<typeof sayGoTo>[0]) => inline(capital(sayGoTo(to, design, 'goes')))
  switch (step.kind) {
    case 'message': {
      // A draft the user can stop: no complete message then, the stop arrow instead (RICH-02).
      const stop: Block[] = draftStops(step)
        ? [
            [
              `**If the user stops it:** ${lower(goes(step.onStop))} once ${code('stopped_message_generation')} arrives (instead of sending the complete message).`,
            ],
          ]
        : []
      if (step.next === undefined) return stop
      return step.content.type === 'poll' || step.content.type === 'quiz'
        ? [[`**Then:** ${lower(goes(step.next))} once the user votes.`]]
        : [[`**Then:** ${lower(goes(step.next))} without a press.`], ...stop]
    }
    case 'question': {
      const checks = (Object.keys(CHECK_WORDS) as (keyof AnswerChecks)[]).flatMap(
        (key) => CHECK_WORDS[key](step.checks) ?? [],
      )
      const blocks: Block[] = [
        [
          `**Expects:** ${EXPECTS[step.expects]}${checks.length > 0 ? `, ${andList(checks)}` : ''}.`,
          '',
          `**Saves the answer as:** ${inline(sayVariable(step.saveTo, design))}.`,
          '',
          `**Valid answer:** ${lower(goes(step.next))}.`,
        ],
        ...textBlocks(doc, 'Wrong answer message', step.wrongAnswer.message),
      ]
      const { maxTries, afterMaxTries } = step.wrongAnswer
      blocks.push([
        maxTries === undefined
          ? '**Wrong answer:** sends the message above and asks again until the answer is valid.'
          : `**Wrong answer:** sends the message above and asks again; after ${plural(maxTries, 'wrong answer')} ${lower(goes(afterMaxTries))}.`,
      ])
      if (step.cancel) {
        blocks.push([
          `**Cancel:** the words ${quoteLangs(step.cancel.words, langs)} (in any language; several words are separated by commas or lines) cancel the question and ${lower(goes(step.cancel.goTo))}.`,
        ])
      }
      return blocks
    }
    case 'if':
      return [[`**Logic:** ${inline(sayIf(step, design))}.`]]
    case 'remember':
      return [
        [
          '**Logic:**',
          ...(step.actions.length === 0
            ? ['- Nothing to remember yet.']
            : step.actions.map((action) => `- ${inline(sayRemember(action, design))}.`)),
        ],
        [`**Then:** ${lower(goes(step.next))}.`],
      ]
    case 'wait': {
      const { stopWhen } = step
      const acts =
        step.ifUserActs === 'keep'
          ? 'If the user does something before the time is up: still go on.'
          : stopWhen === undefined
            ? 'If the user does something before the time is up: stop waiting.'
            : `A reminder: it stops waiting once ${inline(sayCondition(stopWhen, design))}, checked each time the user does something and when the time is up; otherwise it still goes on.`
      return [
        [
          `**Logic:** waits ${String(step.amount)} ${step.amount === 1 ? UNITS[step.unit] : step.unit}, then ${lower(goes(step.next))}.`,
          acts,
        ],
      ]
    }
    case 'devStep': {
      const vars = (ids: readonly string[]) =>
        ids.length === 0 ? 'nothing' : ids.map((id) => inline(sayVariable(id, design))).join(', ')
      return [
        ['**What the developer does:**'],
        fence(step.description.trim() === '' ? '(not written yet)' : step.description, 'text'),
        [`**Uses:** ${vars(step.uses)}.`, '', `**Gives back:** ${vars(step.sets)}.`],
        [
          '**Outcomes:**',
          ...(step.outcomes.length === 0
            ? ['- None yet: the developer step goes nowhere.']
            : step.outcomes.map(
                (outcome, index) =>
                  `- "${inline(outcome.label.trim() || `Outcome ${String(index + 1)}`)}": ${lower(goes(outcome.goTo))}.`,
              )),
        ],
      ]
    }
    case 'goTo':
      return [[`**Logic:** ${lower(goes(step.target))}.`]]
    case 'invoice': {
      const blocks: Block[] = []
      if (step.checkout) {
        blocks.push(
          [`**Pre-checkout check** (${code('pre_checkout_query')}, answered within 10 seconds): the developer checks:`],
          fence(step.checkout.description.trim() === '' ? '(not written yet)' : step.checkout.description, 'text'),
          [
            `- "OK": ${code('answerPreCheckoutQuery')} with ok, and Telegram takes the payment.`,
            `- "Refuse": ok false with the message ${quoteLangs(step.checkout.refuse, langs)}; nothing is paid.`,
          ],
        )
      } else {
        blocks.push([`**Pre-checkout check:** none; the bot answers ${code('answerPreCheckoutQuery')} with ok.`])
      }
      blocks.push([`**Paid:** ${lower(goes(step.next))} once ${code('message.successful_payment')} arrives.`])
      return blocks
    }
    case 'action':
      return actionBlocks(doc, step.action, lower(goes(step.next)))
    case 'end': {
      const fallback = doc.ctx.steps.find((other) => other.kind === 'start' && other.trigger.type === 'fallback')
      return [
        [
          fallback === undefined
            ? '**Logic:** the conversation ends. Only a command or a start link starts it again.'
            : `**Logic:** the conversation ends. A command or a start link starts it again; any other message goes to ${stepMd(fallback)}.`,
        ],
      ]
    }
    default:
      return []
  }
}

// An action in sentences: what it acts on, a gift's description and text, and where it goes on.
function actionBlocks(doc: Doc, action: Action, then: string): Block[] {
  const { design } = doc
  // The message a step sent last, in words.
  const message = (id: StepId | undefined) =>
    id === undefined ? 'no message yet' : `the message ${inline(sayTarget(id, design))} sent last`
  switch (action.type) {
    case 'react': {
      const on = action.onStep === 'userMessage' ? "the user's last message" : message(action.onStep)
      const big = action.big ? ' with the big animation' : ''
      return [[`**Logic:** reacts with ${action.emoji}${big} to ${on}, then ${then}.`]]
    }
    case 'pin':
      return [[`**Logic:** pins ${message(action.step)} (Telegram does not notify the user), then ${then}.`]]
    case 'unpin': {
      const which = action.step === undefined ? 'the newest pinned message' : message(action.step)
      return [[`**Logic:** unpins ${which}, then ${then}.`]]
    }
    case 'delete':
      return [
        [
          `**Logic:** deletes ${message(action.step)} (Telegram deletes only within 48 hours of sending), then ${then}.`,
        ],
      ]
    case 'gift': {
      const upgrade = action.payForUpgrade ? 'yes, the bot pays for the upgrade too' : 'no'
      return [
        [`**Which gift** (the developer finds its ${code('gift_id')} with ${code('getAvailableGifts')}):`],
        fence(action.giftDescription.trim() === '' ? '(not written yet)' : action.giftDescription, 'text'),
        [`**Pays for the upgrade:** ${upgrade}.`],
        ...(action.text === undefined ? [] : textBlocks(doc, 'Gift text', action.text)),
        [`**Then:** ${then}.`],
      ]
    }
    case 'chatAction': {
      const { label } = chatAction(action.action)
      return [[`**Logic:** shows "${label}" for 5 seconds at most or until the bot's next message, then ${then}.`]]
    }
    case 'refund': {
      const invoice = action.invoice === undefined ? 'no invoice yet' : inline(sayTarget(action.invoice, design))
      return [[`**Logic:** refunds the user's payment of ${invoice}, then ${then}.`]]
    }
  }
}

function comesFrom(doc: Doc, step: Step): Block {
  const into = doc.arrows.filter((arrow) => arrow.to === step.id)
  if (into.length === 0) return ['**Comes from:** nothing yet (no arrow goes into this step).']
  return ['**Comes from:**', ...into.map((arrow) => `- ${stepMd(arrow.from)}: ${inline(arrow.how)}`)]
}

// 6. Variables and test switches.
const TYPE_WORDS: Record<VariableType, string> = {
  text: 'text',
  number: 'number',
  yesNo: 'yes or no',
  phone: 'phone number',
  location: 'location',
  file: 'file',
  users: 'users',
  chat: 'chat',
  poll: 'poll',
}

function variables(doc: Doc): Block[] {
  const { design, ctx } = doc
  const names = (steps: readonly Step[] | undefined) =>
    steps === undefined || steps.length === 0 ? 'nothing yet' : steps.map(stepMd).join(', ')
  const switchUses = new Map<string, Step[]>()
  for (const step of ctx.steps) {
    for (const item of conditionsOf(step).flatMap((when) => ('all' in when ? when.all : when.any))) {
      if (!('switch' in item)) continue
      const uses = switchUses.get(item.switch) ?? []
      if (uses.at(-1) !== step) uses.push(step)
      switchUses.set(item.switch, uses)
    }
  }
  const rows = [
    ...Object.values(design.variables)
      .sort(byIdName)
      .map((variable) => [
        code(variable.idName),
        cell(variable.label),
        TYPE_WORDS[variable.type],
        variable.source === 'builtin' ? 'Telegram (built-in)' : names(ctx.varSets.get(variable.id)),
        names(ctx.varUses.get(variable.id)),
        cell(variable.description ?? ''),
      ]),
    ...Object.values(design.switches)
      .sort(byIdName)
      .map((testSwitch) => [
        code(testSwitch.idName),
        cell(testSwitch.label),
        testSwitch.type === 'yesNo'
          ? 'test switch: yes or no'
          : `test switch: one of ${(testSwitch.options ?? []).map((option) => `"${inline(option)}"`).join(', ')}`,
        'the developer (a fact the bot knows)',
        names(switchUses.get(testSwitch.id)),
        cell(testSwitch.description ?? ''),
      ]),
  ]
  return [
    ['## 6. Variables and test switches'],
    rows.length === 0
      ? ['The design has no variables or test switches.']
      : table(['ID name', 'Label', 'Type', 'Set by', 'Used by', 'Description'], rows),
  ]
}

// 7. Parts: where each one is used.
function parts(doc: Doc): Block[] {
  const { design, ctx } = doc
  const list = Object.values(design.parts).sort(byIdName)
  if (list.length === 0) return [['## 7. Parts'], ['The design has no parts.']]
  const blocks: Block[] = [['## 7. Parts']]
  const sending = ctx.steps.flatMap((step) => asSending(step) ?? [])
  for (const part of list) {
    blocks.push([`### ${inline(part.name.trim() || part.idName)} (${part.idName})`])
    let used: SendingStep[]
    if (part.kind === 'rows') {
      used = sending.filter((step) => {
        const keyboard = keyboardOf(step)
        return (
          (keyboard?.type === 'inline' || keyboard?.type === 'reply') &&
          keyboard.rows.some((row) => row.type === 'part' && row.part === part.id)
        )
      })
      const place = part.place === 'inline' ? 'buttons under a message' : 'bottom keyboard buttons'
      blocks.push([
        `A row part of ${place}:`,
        ...part.rows.map(
          (ids, index) =>
            `- Row ${String(index + 1)}: ${
              ids
                .flatMap((id) => design.buttons[id] ?? [])
                .map((button) => `"${inline(button.label[doc.langs[0] ?? ''] ?? '')}" (${button.idName})`)
                .join(', ') || 'no buttons'
            }`,
        ),
      ])
    } else {
      used = sending.filter((step) =>
        textSlots(step).some((slot) =>
          ctx.inlines(slot.text.doc).some((node) => node.type === RICH_NODES.part && node.attrs.part === part.id),
        ),
      )
      blocks.push(['A text part.'], ...textBlocks(doc, 'Text', part.text))
    }
    blocks.push([`**Used in:** ${used.length === 0 ? 'no step yet' : used.map(stepMd).join(', ')}.`])
  }
  return blocks
}

// 8. Media: the uploaded files, then the placeholders, with where they are used.
function media(doc: Doc): Block[] {
  const { design, ctx, options } = doc
  const uses = new Map<string, string[]>()
  const placeholders: string[][] = []
  const use = (slot: MediaSlot, where: string, kind: string) => {
    if ('placeholder' in slot) {
      placeholders.push([`placeholder: "${inline(slot.placeholder.description)}"`, kind, '', where])
      return
    }
    const list = uses.get(slot.media) ?? []
    if (list.at(-1) !== where) list.push(where)
    uses.set(slot.media, list)
  }
  if (design.bot.photo) use(design.bot.photo, 'Bot setup (profile photo)', 'Photo')
  for (const step of ctx.steps) {
    if (step.kind === 'invoice' && step.invoice.photo) use(step.invoice.photo, stepMd(step), 'Invoice photo')
    const sending = asSending(step)
    if (!sending) continue
    const content = contentOf(sending)
    const kind =
      content.type === 'album'
        ? 'Album item'
        : content.type === 'paidMedia'
          ? 'Paid media item'
          : content.type === 'rich'
            ? 'Rich message media'
            : messageKind(content.type).label
    for (const slot of mediaSlots(content)) use(slot, stepMd(step), kind)
  }
  const size = (bytes: number) =>
    bytes < 1024
      ? plural(bytes, 'byte')
      : bytes < 1024 * 1024
        ? `${String(Math.round(bytes / 1024))} KB`
        : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  const files = Object.values(design.media)
    .map((item) => ({ item, file: options.mediaFile?.(item) ?? item.name }))
    .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))
    .map(({ item, file }) => {
      const details = [
        options.mediaFile ? `uploaded as "${inline(item.name)}"` : '',
        size(item.bytes),
        item.width !== undefined && item.height !== undefined ? `${String(item.width)} x ${String(item.height)}` : '',
        item.durationMs === undefined ? '' : `${String(Math.round(item.durationMs / 100) / 10)} s`,
      ].filter((word) => word !== '')
      return [
        options.mediaFile ? code(file) : cell(file),
        messageKind(item.kind).label,
        details.join(', '),
        (uses.get(item.id) ?? ['not used']).join(', '),
      ]
    })
  const rows = [...files, ...placeholders]
  return [
    ['## 8. Media'],
    rows.length === 0
      ? ['The design has no media files or placeholders.']
      : table(['File', 'Kind', 'Details', 'Used in'], rows),
  ]
}

// 9. Checks: every issue with where it is, the ones marked "Ignore here" too.
const LEVEL_WORDS: Record<Issue['level'], string> = { error: 'Error', warning: 'Warning', info: 'Good to know' }

function checksSection(doc: Doc, checks: readonly Issue[]): Block[] {
  const { design } = doc
  if (checks.length === 0) return [['## 9. Checks'], ['No errors, warnings or good-to-know: every check passed.']]
  const rows = checks.map((issue) => {
    const step = issue.stepId === undefined ? undefined : design.steps[issue.stepId]
    const button = issue.buttonId === undefined ? undefined : design.buttons[issue.buttonId]
    const where = [
      issue.stepId === undefined ? 'Bot setup' : step === undefined ? 'a deleted step' : stepMd(step),
      ...(issue.buttonId === undefined
        ? []
        : [`button "${inline(button?.label[design.languages.default] ?? '')}" (${button?.idName ?? issue.buttonId})`]),
      ...(issue.language === undefined ? [] : [`language ${issue.language}`]),
    ]
    return [
      issue.ignored === true ? `${LEVEL_WORDS[issue.level]} (ignored here)` : LEVEL_WORDS[issue.level],
      issue.code,
      where.join(', '),
      cell(issue.message),
    ]
  })
  return [
    ['## 9. Checks'],
    [
      'Errors are things Telegram cannot do as designed: resolve them with the designer. Warnings are open points; good-to-know are facts for the builder.',
    ],
    table(['Level', 'Code', 'Where', 'What'], rows),
  ]
}

// 10. Glossary: the interface words (docs/plan/01-requirements.md section 9) and their Telegram side.
const GLOSSARY: readonly (readonly [string, string, string])[] = [
  ['Design', 'One bot: its steps, texts, buttons, languages and setup.', 'One bot and its token from BotFather.'],
  ['Map', 'The canvas with all steps as boxes and arrows.', 'The flow the bot follows; nothing is sent for it.'],
  ['Step', 'One box on the map: a message, a question, or a logic box.', 'Where a user is in the conversation.'],
  [
    'Message step',
    'Something the bot sends: text, media, poll and so on, with its buttons.',
    'One `send*` call (`sendMessage`, `sendPhoto`, `sendMediaGroup`, ...) with its `reply_markup`.',
  ],
  [
    'Start point',
    'Where a conversation starts: /start, a start link, a command, a bottom-keyboard text, "anything else the user sends", and in stage 2 events such as a payment or a reaction.',
    'A `message` update: `/start`, `/start <payload>`, another command, or any other message.',
  ],
  [
    'Button look',
    'Default, Blue (primary), Green (success), Red (danger).',
    "The button's `style`: left out, `primary`, `success` or `danger`.",
  ],
  ['Goes to', 'The arrow from a button or an outcome to the next step.', 'What the bot does next.'],
  [
    'Show it by',
    'How the next message appears after a click: "Edit this message", "Send a new message", "Delete this one and send a new one".',
    '`editMessage*`; `send*`; `deleteMessage` then `send*`; each after `answerCallbackQuery`.',
  ],
  [
    'Popup',
    'The small toast or the alert window Telegram shows after a click.',
    '`answerCallbackQuery` with `text`, and `show_alert` for an alert.',
  ],
  [
    'Saved answer / remembered value',
    'A variable, shown in texts as a chip like {name}.',
    'Per-user state the bot keeps; `{name}` in a text is replaced by its value.',
  ],
  [
    'Developer step',
    'A job only the developer can do (look up an order, check a code), with named outcomes.',
    "The developer's own code; it goes on by one of its outcomes.",
  ],
  [
    'Part',
    'A reusable button row or text used on many steps.',
    'Nothing of its own: `spec.json` expands it where it is used.',
  ],
  [
    'Test user',
    'The switches Try it uses for "If" boxes (admin, paid, language...).',
    'Facts the bot knows about the user: `testSwitches` in `spec.json`.',
  ],
  [
    'Phone look',
    "Web A, Web K, Desktop, Android or iOS (xWriter's five looks); light or dark.",
    'Only how the pictures were drawn.',
  ],
  [
    'Check',
    'A warning or error about Telegram limits or a broken flow.',
    'Section 9 of this file, `checks` in `spec.json`.',
  ],
  ['Spec', 'The exact export file (`spec.json`) builders build from.', '`spec.json`.'],
]

function glossary(): Block[] {
  return [
    ['## 10. Glossary'],
    table(
      ['Word', 'Meaning', 'In Telegram'],
      GLOSSARY.map(([word, meaning, telegram]) => [word, meaning.replace(/[|<>]/g, '\\$&'), telegram]),
    ),
  ]
}
