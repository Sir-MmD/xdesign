// Telegram texts back to the rich text (docs/plan/03-design-model.md section 5), for import and for
// pasting Telegram-formatted text: a text with its MessageEntity objects, or Telegram HTML. What
// the schema has no place for becomes plain text (other entity types, a code block or quote inside
// a quote). The result is in normal form (normalize.ts).
import type { VarId } from '../model/ids.ts'
import type { EntityType } from '../telegram/entities.ts'
import { MARK_ENTITY } from './marks.ts'
import { normalizeRichDoc } from './normalize.ts'
import {
  RICH_MARKS,
  RICH_NODES,
  type Paragraph,
  type RichBlock,
  type RichDoc,
  type RichInline,
  type RichMark,
  type RichMarkName,
} from './schema.ts'
import type { MessageEntity, VariablePlace } from './to-telegram.ts'

/**
 * A Telegram text: what toTelegram gives, or a message's `text` (or `caption`) and `entities`.
 * With `variables`, exactly those places become variables; without, `{name}` placeholders do.
 */
export type TelegramInput = {
  text: string
  entities?: readonly MessageEntity[]
  variables?: readonly VariablePlace[]
}

export type FromTelegramOptions = {
  /** The variable an ID name in a `{name}` placeholder stands for, if it is one. */
  variable?: (idName: string) => VarId | undefined
}

const BLOCK_ENTITIES = new Set<string>(['pre', 'blockquote', 'expandable_blockquote'] satisfies EntityType[])
const ENTITY_MARK = new Map<string, RichMarkName>(Object.values(RICH_MARKS).map((mark) => [MARK_ENTITY[mark], mark]))

type Span = { start: number; end: number }
type EntitySpan = Span & { entity: MessageEntity }

/** A Telegram text as a rich document. */
export function fromTelegram(input: TelegramInput, opts: FromTelegramOptions = {}): RichDoc {
  const { text } = input
  const span = <T extends { offset: number; length: number }>(item: T) => {
    const start = Math.max(0, Math.min(item.offset, text.length))
    const end = Math.min(item.offset + item.length, text.length)
    return end > start ? [{ ...item, start, end }] : []
  }
  const spans = (input.entities ?? [])
    .flatMap((entity) => span({ entity, offset: entity.offset, length: entity.length }))
    .sort((a, b) => a.start - b.start || b.end - a.end)

  // Quotes and code blocks that do not overlap one before them are blocks; a code block that
  // does becomes code.
  const blocks: EntitySpan[] = []
  const marks: (Span & { mark: RichMark })[] = []
  const emoji: (Span & { node: RichInline })[] = []
  for (const { entity, start, end } of spans) {
    if (BLOCK_ENTITIES.has(entity.type)) {
      if (blocks.every((block) => block.end <= start || block.start >= end)) {
        blocks.push({ entity, start, end })
      } else if (entity.type === 'pre') {
        marks.push({ start, end, mark: { type: RICH_MARKS.code } })
      }
    } else if (entity.type === 'custom_emoji') {
      const id = entity.custom_emoji_id
      if (id) {
        const node: RichInline = { type: RICH_NODES.customEmoji, attrs: { id, fallback: text.slice(start, end) } }
        emoji.push({ start, end, node })
      }
    } else {
      const mark = markOf(entity)
      if (mark) marks.push({ start, end, mark })
    }
  }

  const places = input.variables ?? placeholders(text, opts)
  const variables = places.flatMap((place) =>
    span(place).map(({ start, end }) => ({
      start,
      end,
      node: { type: RICH_NODES.variable, attrs: { var: place.var } },
    })),
  )
  // Atoms (custom emoji and variables) stay on one line, outside code blocks, and do not overlap.
  const atoms: (Span & { node: RichInline })[] = []
  for (const atom of [...emoji, ...variables].sort((a, b) => a.start - b.start)) {
    const block = blocks.find(({ start, end }) => start < atom.end && end > atom.start)
    const fits = block ? block.entity.type !== 'pre' && block.start <= atom.start && block.end >= atom.end : true
    const last = atoms.at(-1)
    if (fits && !text.slice(atom.start, atom.end).includes('\n') && (!last || last.end <= atom.start)) {
      atoms.push(atom)
    }
  }

  // One paragraph with the text from `from` to `to`; normalizing splits it at its line breaks.
  const paragraph = (from: number, to: number): Paragraph => {
    const inside = atoms.filter((atom) => atom.start >= from && atom.end <= to)
    const stops = new Set([from, to, ...inside.flatMap((atom) => [atom.start, atom.end])])
    for (const mark of marks) {
      for (const at of [mark.start, mark.end]) {
        if (at > from && at < to && !inside.some((atom) => at > atom.start && at < atom.end)) stops.add(at)
      }
    }
    const [first = from, ...rest] = [...stops].sort((a, b) => a - b)
    const content: RichInline[] = []
    let start = first
    for (const end of rest) {
      const covering = marks.filter((mark) => mark.start <= start && mark.end >= end).map(({ mark }) => mark)
      const atom = inside.find((item) => item.start === start)
      content.push(
        atom
          ? { ...atom.node, marks: covering }
          : { type: RICH_NODES.text, text: text.slice(start, end), marks: covering },
      )
      start = end
    }
    return { type: RICH_NODES.paragraph, content }
  }

  const content: RichBlock[] = []
  // The paragraphs between two blocks, before the first or after the last. Blocks are joined by
  // `\n`, so between two blocks a lone `\n` holds no paragraph.
  const between = (from: number, to: number, before: boolean, after: boolean) => {
    if (from === to ? before || after : before && after && text.slice(from, to) === '\n') return
    const start = before && text[from] === '\n' ? from + 1 : from
    const end = after && to > start && text[to - 1] === '\n' ? to - 1 : to
    content.push(paragraph(start, end))
  }
  let at = 0
  blocks.forEach((block, index) => {
    between(at, block.start, index > 0, true)
    if (block.entity.type === 'pre') {
      content.push({
        type: RICH_NODES.codeBlock,
        attrs: { language: block.entity.language || null },
        content: [{ type: RICH_NODES.text, text: text.slice(block.start, block.end) }],
      })
    } else {
      content.push({
        type: RICH_NODES.blockquote,
        attrs: { expandable: block.entity.type === 'expandable_blockquote' },
        content: [paragraph(block.start, block.end)],
      })
    }
    at = block.end
  })
  between(at, text.length, blocks.length > 0, false)
  return normalizeRichDoc({ type: RICH_NODES.doc, content })
}

/** Telegram HTML (parse_mode HTML) as a rich document; `{name}` placeholders as in fromTelegram. */
export function fromTelegramHtml(html: string, opts: FromTelegramOptions = {}): RichDoc {
  return fromTelegram(parseHtml(html), opts)
}

function markOf(entity: MessageEntity): RichMark | undefined {
  const type = ENTITY_MARK.get(entity.type)
  switch (type) {
    case undefined:
      return undefined
    case RICH_MARKS.link:
      return entity.url === undefined ? undefined : { type, attrs: { href: entity.url } }
    case RICH_MARKS.dateTime:
      return entity.unix_time === undefined
        ? undefined
        : { type, attrs: { unix: entity.unix_time, format: entity.date_time_format ?? '' } }
    default:
      return { type }
  }
}

// The `{name}` placeholders of known variables.
function placeholders(text: string, opts: FromTelegramOptions): VariablePlace[] {
  return [...text.matchAll(/\{([^{}\n]+)\}/g)].flatMap((match) => {
    const id = match[1] === undefined ? undefined : opts.variable?.(match[1])
    return id === undefined ? [] : [{ var: id, offset: match.index, length: match[0].length }]
  })
}

type OpenTag = { name: string; entity: MessageEntity | undefined }

const TAG = /<(\/?)([a-z][\w-]*)((?:\s+[\w-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/iy
const ATTR = /([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g
const CHAR = /&(?:#(\d+)|#x([\da-f]+)|(lt|gt|amp|quot));/gi
const NAMED: Readonly<Record<string, string>> = { lt: '<', gt: '>', amp: '&', quot: '"' }

// Telegram HTML as a text and its entities, without a DOM (it runs in Node too). Tags Telegram
// does not know keep only their text; a `<` that starts no tag is text; a closing tag closes the
// tags opened after its own.
function parseHtml(html: string): { text: string; entities: MessageEntity[] } {
  let text = ''
  const entities: MessageEntity[] = []
  const open: OpenTag[] = []
  const close = (index: number) => {
    for (const tag of open.splice(index).reverse()) {
      if (!tag.entity) continue
      tag.entity.length = text.length - tag.entity.offset
      entities.push(tag.entity)
    }
  }
  let at = 0
  while (at < html.length) {
    const lt = html.indexOf('<', at)
    text += decode(html.slice(at, lt < 0 ? html.length : lt))
    if (lt < 0) break
    TAG.lastIndex = lt
    const match = TAG.exec(html)
    if (!match) {
      text += '<'
      at = lt + 1
      continue
    }
    at = TAG.lastIndex
    const [, slash, tagName = '', rawAttrs = ''] = match
    const name = tagName.toLowerCase()
    if (slash) {
      const index = open.map((tag) => tag.name).lastIndexOf(name)
      if (index >= 0) close(index)
      continue
    }
    const attrs = new Map(
      [...rawAttrs.matchAll(ATTR)].map(([, key = '', ...values]: (string | undefined)[]) => [
        key.toLowerCase(),
        decode(values.find((value) => value !== undefined) ?? ''),
      ]),
    )
    open.push({ name, entity: entityOf(name, attrs, open.at(-1), text.length) })
  }
  close(0)
  return { text, entities }
}

// The entity a tag Telegram allows opens (with its other spellings: strong, em, ins, strike, del,
// span class="tg-spoiler"). A `<code class="language-x">` right inside `<pre>` gives the pre its
// language instead.
function entityOf(
  name: string,
  attrs: ReadonlyMap<string, string>,
  parent: OpenTag | undefined,
  offset: number,
): MessageEntity | undefined {
  const entity = (type: EntityType, fields: Partial<MessageEntity> = {}): MessageEntity => ({
    type,
    offset,
    length: 0,
    ...fields,
  })
  switch (name) {
    case 'b':
    case 'strong':
      return entity('bold')
    case 'i':
    case 'em':
      return entity('italic')
    case 'u':
    case 'ins':
      return entity('underline')
    case 's':
    case 'strike':
    case 'del':
      return entity('strikethrough')
    case 'tg-spoiler':
      return entity('spoiler')
    case 'span':
      return attrs.get('class') === 'tg-spoiler' ? entity('spoiler') : undefined
    case 'code': {
      const pre = parent?.entity?.type === 'pre' ? parent.entity : undefined
      if (!pre) return entity('code')
      const language = /^language-(.+)$/.exec(attrs.get('class') ?? '')?.[1]
      if (language) pre.language = language
      return undefined
    }
    case 'pre':
      return entity('pre')
    case 'blockquote':
      return entity(attrs.has('expandable') ? 'expandable_blockquote' : 'blockquote')
    case 'a': {
      const url = attrs.get('href')
      return url === undefined ? undefined : entity('text_link', { url })
    }
    case 'tg-emoji': {
      const id = attrs.get('emoji-id')
      return id ? entity('custom_emoji', { custom_emoji_id: id }) : undefined
    }
    case 'tg-time': {
      const unix = Number(attrs.get('unix'))
      const format = attrs.get('format')
      if (!Number.isInteger(unix)) return undefined
      return entity('date_time', { unix_time: unix, ...(format ? { date_time_format: format } : {}) })
    }
    default:
      return undefined
  }
}

// Telegram's character references: numeric ones and &lt;, &gt;, &amp; and &quot;; others stay text.
function decode(text: string): string {
  return text.replace(CHAR, (whole: string, decimal?: string, hex?: string, named?: string) => {
    if (named) return NAMED[named.toLowerCase()] ?? whole
    const code = decimal ? Number.parseInt(decimal, 10) : Number.parseInt(hex ?? '', 16)
    return code <= 0x10ffff ? String.fromCodePoint(code) : whole
  })
}
