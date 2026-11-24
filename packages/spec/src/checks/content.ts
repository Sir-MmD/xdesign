// Stage 2 message kinds (docs/plan/08 section 6): E20 poll and quiz limits (question, options,
// explanation, closing, users adding options), E21 a quiz without a right answer, E22 paid media
// (its Stars, its 1 to 10 items and their kinds), E27 an anonymous poll or quiz that saves the
// vote (only a non-anonymous one tells the bot who voted, poll_answer), E28 rich messages (blocks,
// text length, media and their kinds, table columns, heading sizes, button rows inside). Each
// limit comes from the catalog; a text missing in a language other than the default one is W03's.
import type { Content } from '../model/content.ts'
import type { Lang } from '../model/ids.ts'
import type { MediaKind } from '../model/parts.ts'
import { limit } from '../telegram/limits.ts'
import { messageKind } from '../telegram/messages.ts'
import { PAID_MEDIA_KINDS, paidMediaKind } from '../telegram/polls.ts'
import { RICH_MEDIA_KINDS, richMediaKind } from '../telegram/rich.ts'
import { plainText, type RichDoc } from '../text/schema.ts'
import {
  andList,
  asSending,
  blockTexts,
  contentOf,
  emptyDoc,
  emptyText,
  mediaSlots,
  orList,
  type Context,
  type SendingStep,
} from './context.ts'

type Poll = Extract<Content, { type: 'poll' | 'quiz' }>
type PaidMedia = Extract<Content, { type: 'paidMedia' }>
type Rich = Extract<Content, { type: 'rich' }>

const outside = (value: number, min: number, max: number) => !Number.isInteger(value) || value < min || value > max

export function checkContent(ctx: Context): void {
  for (const step of ctx.steps) {
    const sending = asSending(step)
    if (!sending) continue
    const content = contentOf(sending)
    const name = ctx.stepName(step)
    if (content.type === 'poll' || content.type === 'quiz') checkPoll(ctx, content, step.id, name)
    else if (content.type === 'paidMedia') checkPaidMedia(ctx, content, step.id, name)
    else if (content.type === 'rich') checkRich(ctx, sending, content, name)
  }
}

function checkPoll(ctx: Context, poll: Poll, stepId: string, name: string): void {
  const what = `The ${poll.type} in ${name}`
  const add = (message: string, language?: Lang) => {
    ctx.add('E20', message, { stepId, ...(language !== undefined && { language }) })
  }
  const tooLong = (thing: string, lang: Lang, length: number, max: number) => {
    add(
      `${thing} of ${name} in ${lang} is ${String(length)} characters long; Telegram allows at most ${String(max)}.`,
      lang,
    )
  }

  const question = limit('pollQuestion')
  for (const lang of ctx.languages) {
    const doc = poll.question.doc[lang]
    if (lang === ctx.defaultLanguage && emptyDoc(doc)) {
      add(`${what} has no question in ${lang}; Telegram needs one.`, lang)
      continue
    }
    const length = doc ? ctx.length(doc, lang) : 0
    if (length > question.max) tooLong('The question', lang, length, question.max)
  }

  const count = limit('pollOptions')
  if (poll.options.length < count.min || poll.options.length > count.max) {
    const has = poll.options.length === 0 ? 'no options' : `${String(poll.options.length)} options`
    add(`${what} has ${has}; Telegram needs ${String(count.min)} to ${String(count.max)}.`)
  }
  const option = limit('pollOption')
  poll.options.forEach((text, index) => {
    const which = `Option ${String(index + 1)}`
    for (const lang of ctx.languages) {
      if (lang === ctx.defaultLanguage && emptyText(text[lang])) {
        add(`${which} of ${name} has no text in ${lang}; Telegram needs one.`, lang)
        continue
      }
      const length = ctx.plainLength(text[lang] ?? '')
      if (length > option.max) tooLong(which, lang, length, option.max)
    }
  })

  if (poll.type === 'quiz' && poll.explanation) {
    const explanation = limit('pollExplanation')
    const { max: lineFeeds } = limit('pollExplanationLineFeeds')
    for (const lang of ctx.languages) {
      const doc = poll.explanation.doc[lang]
      if (!doc) continue
      const length = ctx.length(doc, lang)
      if (length > explanation.max) tooLong('The explanation', lang, length, explanation.max)
      const breaks = lineBreaks(ctx, doc, lang)
      if (breaks > lineFeeds) {
        add(
          `The explanation of ${name} in ${lang} has ${String(breaks)} line breaks; Telegram allows at most ` +
            `${String(lineFeeds)}.`,
          lang,
        )
      }
    }
  }

  if (poll.closeAfterSec !== undefined && poll.closeAt !== undefined) {
    add(`${what} closes both after a time and at a date; Telegram takes only one of them.`)
  } else if (poll.closeAfterSec !== undefined) {
    const { min, max } = limit('pollOpenPeriod')
    if (outside(poll.closeAfterSec, min, max)) {
      add(
        `${what} closes after ${String(poll.closeAfterSec)} seconds; Telegram needs a whole number from ` +
          `${String(min)} to ${String(max)} (about 30 days).`,
      )
    }
  }
  if (poll.type === 'poll' && poll.addOptions === true && poll.anonymous) {
    add(`${what} lets users add options, which Telegram does not allow on an anonymous poll.`)
  }

  if (poll.anonymous && poll.saveTo !== undefined) {
    ctx.add(
      'E27',
      `${what} saves the vote, but an anonymous ${poll.type} does not tell the bot who voted. Turn off ` +
        `anonymous voting or stop saving the vote.`,
      { stepId },
    )
  }

  if (poll.type === 'quiz') {
    const wrong = poll.correct.filter((index) => !Number.isInteger(index) || index < 0 || index >= poll.options.length)
    if (poll.correct.length === 0)
      ctx.add('E21', `${what} has no right answer; Telegram needs at least one.`, { stepId })
    else if (wrong.length > 0) {
      const options = wrong.map((index) => String(index + 1))
      ctx.add(
        'E21',
        `${what} marks ${wrong.length === 1 ? 'option' : 'options'} ${andList(options)} as right, but it has ` +
          `only ${String(poll.options.length)} options.`,
        { stepId },
      )
    }
  }
}

// The line breaks Telegram counts in a text: between blocks, hard breaks and those of its parts.
function lineBreaks(ctx: Context, doc: RichDoc, lang: Lang): number {
  const part = (id: string): string => {
    const found = ctx.design.parts[id]
    const text = found?.kind === 'text' ? found.text.doc[lang] : undefined
    return text ? plainText(text, () => '') : ''
  }
  return plainText(doc, () => '', part).split('\n').length - 1
}

function checkPaidMedia(ctx: Context, paid: PaidMedia, stepId: string, name: string): void {
  const place = { stepId }
  const stars = limit('paidMediaStars')
  if (outside(paid.stars, stars.min, stars.max)) {
    ctx.add(
      'E22',
      `The paid media in ${name} costs ${String(paid.stars)} Stars; Telegram needs a whole number from ` +
        `${String(stars.min)} to ${String(stars.max)}.`,
      place,
    )
  }
  const items = limit('paidMediaItems')
  const count = paid.items.length
  if (count < items.min || count > items.max) {
    ctx.add(
      'E22',
      `The paid media in ${name} has ${count === 0 ? 'no items' : `${String(count)} ${count === 1 ? 'item' : 'items'}`}; ` +
        `Telegram needs ${String(items.min)} to ${String(items.max)}.`,
      place,
    )
  }
  // Placeholders have no kind yet.
  const kinds = new Set<MediaKind>()
  for (const item of paid.items) {
    const kind = 'media' in item.media ? ctx.design.media[item.media.media]?.kind : undefined
    if (kind && !paidMediaKind(kind)) kinds.add(kind)
  }
  if (kinds.size > 0) {
    const label = (kind: MediaKind) => messageKind(kind).label
    ctx.add(
      'E22',
      `The paid media in ${name} has ${andList([...kinds].map(label))} items; Telegram sells only ` +
        `${orList(PAID_MEDIA_KINDS.map((row) => lower(messageKind(row.id).label)))} items.`,
      place,
    )
  }
}

function checkRich(ctx: Context, step: SendingStep, rich: Rich, name: string): void {
  const add = (message: string, language?: Lang) => {
    ctx.add('E28', message, { stepId: step.id, ...(language !== undefined && { language }) })
  }
  const what = `The rich message in ${name}`
  if (rich.blocks.length === 0) add(`${what} has no blocks; Telegram needs at least one.`)

  // Telegram counts nested blocks too: list items and the paragraph in each, table rows, and the
  // paragraph inside a quote or a details block.
  const count = rich.blocks.reduce((sum, block) => {
    if (block.type === 'list') return sum + 1 + 2 * block.items.length
    if (block.type === 'table') return sum + 1 + block.rows.length
    return sum + (block.type === 'quote' || block.type === 'details' ? 2 : 1)
  }, 0)
  const blocks = limit('richBlocks')
  if (count > blocks.max)
    add(`${what} has ${String(count)} blocks with those inside; Telegram allows at most ${String(blocks.max)}.`)

  const text = limit('richText')
  for (const lang of ctx.languages) {
    const length = rich.blocks
      .flatMap(blockTexts)
      .reduce((sum, ref) => sum + (ref.doc[lang] ? ctx.length(ref.doc[lang], lang) : 0), 0)
    if (length > text.max) {
      add(`${what} is ${String(length)} characters long in ${lang}; Telegram allows at most ${String(text.max)}.`, lang)
    }
  }

  const slots = mediaSlots(rich)
  const media = limit('richMedia')
  if (slots.length > media.max)
    add(`${what} has ${String(slots.length)} media; Telegram allows at most ${String(media.max)}.`)
  // Placeholders have no kind yet.
  const kinds = new Set<MediaKind>()
  for (const slot of slots) {
    const kind = 'media' in slot ? ctx.design.media[slot.media]?.kind : undefined
    if (kind && !richMediaKind(kind)) kinds.add(kind)
  }
  if (kinds.size > 0) {
    const label = (kind: MediaKind) => lower(messageKind(kind).label)
    add(
      `${what} has ${andList([...kinds].map(label))} media; a rich message takes only ` +
        `${orList(RICH_MEDIA_KINDS.map((row) => lower(messageKind(row.id).label)))} files.`,
    )
  }

  const { max: columns } = limit('richTableColumns')
  const size = limit('richHeadingSize')
  rich.blocks.forEach((block, index) => {
    const which = `Block ${String(index + 1)} of ${name}`
    if (block.type === 'table') {
      const widest = Math.max(0, ...block.rows.map((row) => row.cells.length))
      if (widest > columns)
        add(`${which} is a table of ${String(widest)} columns; Telegram allows at most ${String(columns)}.`)
      if (block.rows.length === 0 || widest === 0)
        add(`${which} is a table without cells; Telegram needs at least one.`)
    } else if (block.type === 'list' && block.items.length === 0) {
      add(`${which} is a list without items; Telegram needs at least one.`)
    } else if (block.type === 'heading' && outside(block.size, size.min, size.max)) {
      add(
        `${which} is a heading of size ${String(block.size)}; Telegram needs ${String(size.min)} to ${String(size.max)}.`,
      )
    }
  })

  const buttons = limit('richButtons')
  ctx.richRows(step).forEach((row, index) => {
    const which = `Button row ${String(index + 1)} inside the rich message of ${name}`
    if (row.length < buttons.min || row.length > buttons.max) {
      add(
        `${which} has ${String(row.length)} buttons; Telegram needs ${String(buttons.min)} to ${String(buttons.max)}.`,
      )
    }
    const reply = row.filter((button) => button.place === 'reply').map((button) => ctx.buttonName(button))
    if (reply.length > 0) add(`${which} holds ${andList(reply)}, which only a bottom keyboard has; use inline buttons.`)
  })
}

const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)
