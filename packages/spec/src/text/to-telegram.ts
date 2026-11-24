// Texts to Telegram (docs/plan/03-design-model.md section 5.2): one language's rich document as
// the plain text with a `{idName}` placeholder for each variable, as MessageEntity objects and as
// Telegram HTML (three forms of the same message), with where each placeholder is. Offsets and
// lengths count UTF-16 code units, as the Bot API does and JavaScript string indexes already do.
// Entity types and HTML tags come from the catalog (telegram/entities.ts).
import type { PartId, VarId } from '../model/ids.ts'
import { ENTITIES, type EntityType } from '../telegram/entities.ts'
import { MARK_ENTITY, markKey, normalMarks } from './marks.ts'
import { RICH_MARKS, RICH_NODES, type RichBlock, type RichDoc, type RichInline, type RichMark } from './schema.ts'

/** A MessageEntity as Telegram sends it, with the fields xDesign reads. */
export type MessageEntity = {
  type: string
  offset: number
  length: number
  url?: string
  language?: string
  custom_emoji_id?: string
  unix_time?: number
  date_time_format?: string
}

/** A MessageEntity xDesign writes. */
export type TextEntity = MessageEntity & { type: EntityType }

/** Where a variable's `{idName}` placeholder is in the text. */
export type VariablePlace = { var: VarId; offset: number; length: number }

export type TelegramText = { text: string; entities: TextEntity[]; html: string; variables: VariablePlace[] }

export type ToTelegramOptions = {
  /** A variable's ID name, written as `{idName}`. */
  varName: (id: VarId) => string
  /** A text part's document in the same language; a part it does not give writes nothing. */
  part?: (id: PartId) => RichDoc | undefined
  /** A custom emoji's fallback, for a node without one of its own. */
  emojiFallback?: (id: string) => string | undefined
}

export type MeasureOptions = Omit<ToTelegramOptions, 'varName'> & {
  /** A variable's test value. */
  testValue?: (id: VarId) => string | number | boolean | undefined
}

// The length a variable without a test value counts for.
const UNKNOWN_VALUE_LENGTH = 10

// Where two entities cover the same text, the outer one first: quotes, code blocks, marks, then
// custom emoji.
const NESTING: readonly EntityType[] = [
  'blockquote',
  'expandable_blockquote',
  'pre',
  ...Object.values(MARK_ENTITY),
  'custom_emoji',
]

/**
 * One language's document for Telegram: `text` with `{idName}` for each variable, `entities`
 * sorted by offset, then by length (longest first), the same in `html`, and the `variables`.
 * Blocks and the paragraphs of a quote are joined by `\n`; a text part is written where it is
 * placed, under its node's marks; a custom emoji without a fallback writes nothing.
 */
export function toTelegram(doc: RichDoc, opts: ToTelegramOptions): TelegramText {
  const { text, entities, variables } = write(doc, opts)
  return { text, entities, html: toHtml(text, entities), variables }
}

/**
 * The length Telegram counts against its limits (the plain text after entity parsing), with each
 * variable counted at its test value's length, or 10 characters when it has none.
 */
export function measure(doc: RichDoc, opts: MeasureOptions = {}): number {
  const { text, variables } = write(doc, { ...opts, varName: () => '' })
  return variables.reduce((length, place) => {
    const value = opts.testValue?.(place.var)
    return length - place.length + (value === undefined ? UNKNOWN_VALUE_LENGTH : String(value).length)
  }, text.length)
}

function write(doc: RichDoc, opts: ToTelegramOptions): Omit<TelegramText, 'html'> {
  let text = ''
  const entities: TextEntity[] = []
  const variables: VariablePlace[] = []
  // The marks of the last piece written, by key, each with the offset where it began.
  const open = new Map<string, { mark: RichMark; offset: number }>()
  // The parts being written, so a part placed inside itself writes nothing.
  const expanding = new Set<PartId>()

  const add = (entity: TextEntity) => {
    if (entity.length > 0) entities.push(entity)
  }
  // Writes a piece of text under its marks: the marks it lacks end their entities, new ones begin.
  const put = (piece: string, marks: readonly RichMark[]) => {
    if (!piece) return
    const next = new Map(normalMarks(marks).map((mark) => [markKey(mark), mark]))
    for (const [key, run] of open) {
      if (next.has(key)) continue
      add(markEntity(run.mark, run.offset, text.length))
      open.delete(key)
    }
    for (const [key, mark] of next) {
      if (!open.has(key)) open.set(key, { mark, offset: text.length })
    }
    text += piece
  }

  const inline = (nodes: readonly RichInline[] | undefined, outer: readonly RichMark[], quoted: boolean) => {
    for (const node of nodes ?? []) {
      const marks = [...(node.marks ?? []), ...outer]
      const offset = text.length
      switch (node.type) {
        case RICH_NODES.text:
          put(node.text, marks)
          break
        case RICH_NODES.hardBreak:
          put('\n', marks)
          break
        case RICH_NODES.variable: {
          const placeholder = `{${opts.varName(node.attrs.var)}}`
          put(placeholder, marks)
          variables.push({ var: node.attrs.var, offset, length: placeholder.length })
          break
        }
        case RICH_NODES.customEmoji: {
          const fallback = node.attrs.fallback || opts.emojiFallback?.(node.attrs.id) || ''
          put(fallback, marks)
          add({ type: 'custom_emoji', offset, length: fallback.length, custom_emoji_id: node.attrs.id })
          break
        }
        case RICH_NODES.part: {
          const part = expanding.has(node.attrs.part) ? undefined : opts.part?.(node.attrs.part)
          if (!part) break
          expanding.add(node.attrs.part)
          blocks(part.content, marks, quoted)
          expanding.delete(node.attrs.part)
          break
        }
      }
    }
  }

  // `outer` are the marks of the part node being written (none at the top), `quoted` whether a
  // quote holds it.
  const blocks = (list: readonly RichBlock[], outer: readonly RichMark[], quoted: boolean) => {
    list.forEach((block, index) => {
      if (index > 0) put('\n', outer)
      const offset = text.length
      switch (block.type) {
        case RICH_NODES.paragraph:
          inline(block.content, outer, quoted)
          break
        case RICH_NODES.codeBlock: {
          // Telegram's pre holds no other entity, so the marks of a part around it stop here.
          put((block.content ?? []).map((node) => node.text).join(''), [])
          const language = block.attrs?.language
          add({ type: 'pre', offset, length: text.length - offset, ...(language ? { language } : {}) })
          break
        }
        case RICH_NODES.blockquote:
          block.content.forEach((paragraph, line) => {
            if (line > 0) put('\n', outer)
            inline(paragraph.content, outer, true)
          })
          // Quotes do not nest: a quote in a part placed in a quote is written as its paragraphs.
          if (!quoted) {
            const type = block.attrs?.expandable ? 'expandable_blockquote' : 'blockquote'
            add({ type, offset, length: text.length - offset })
          }
          break
      }
    })
  }

  blocks(doc.content, [], false)
  for (const run of open.values()) add(markEntity(run.mark, run.offset, text.length))
  entities.sort(
    (a, b) => a.offset - b.offset || b.length - a.length || NESTING.indexOf(a.type) - NESTING.indexOf(b.type),
  )
  return { text, entities, variables }
}

function markEntity(mark: RichMark, offset: number, end: number): TextEntity {
  const entity: TextEntity = { type: MARK_ENTITY[mark.type], offset, length: end - offset }
  switch (mark.type) {
    case RICH_MARKS.link:
      return { ...entity, url: mark.attrs.href }
    case RICH_MARKS.dateTime:
      return {
        ...entity,
        unix_time: mark.attrs.unix,
        ...(mark.attrs.format ? { date_time_format: mark.attrs.format } : {}),
      }
    default:
      return entity
  }
}

type TagTemplate = { name: string; attrs: { name: string; value: string | undefined }[] }

// The tags of each entity, read from the catalog's html column (`<a href="{url}">`).
const TAGS = new Map<string, TagTemplate[]>(
  ENTITIES.map((row) => [
    row.id,
    [...row.html.matchAll(/<([\w-]+)([^>]*)>/g)].map(([, name = '', attrs = '']) => ({
      name,
      attrs: [...attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(([, attr = '', value]) => ({ name: attr, value })),
    })),
  ]),
)

const ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const escapeText = (text: string) => text.replace(/[&<>]/g, (char) => ESCAPES[char] ?? char)
const escapeAttr = (text: string) => text.replace(/[&<>"]/g, (char) => ESCAPES[char] ?? char)

// An entity's opening tags with its fields filled in, and its closing tags.
function tagsOf(entity: TextEntity): { open: string; close: string } {
  const fields: Readonly<Record<string, string | undefined>> = {
    url: entity.url,
    language: entity.language,
    custom_emoji_id: entity.custom_emoji_id,
    unix_time: entity.unix_time?.toString(),
    date_time_format: entity.date_time_format,
  }
  const tags = (TAGS.get(entity.type) ?? []).flatMap((tag, index) => {
    const attrs = tag.attrs.flatMap(({ name, value }) => {
      if (value === undefined) return [` ${name}`]
      // An attribute whose field the entity lacks is left out (a date without a format).
      const names = [...value.matchAll(/\{(\w+)\}/g)].map(([, field = '']) => field)
      if (!names.every((field) => fields[field] !== undefined)) return []
      return [` ${name}="${escapeAttr(value.replace(/\{(\w+)\}/g, (_, field: string) => fields[field] ?? ''))}"`]
    })
    // So is a tag after the first left without any (`<pre>` alone for code without a language).
    if (index > 0 && tag.attrs.length > 0 && attrs.length === 0) return []
    return [{ name: tag.name, attrs: attrs.join('') }]
  })
  return {
    open: tags.map((tag) => `<${tag.name}${tag.attrs}>`).join(''),
    close: tags
      .map((tag) => `</${tag.name}>`)
      .reverse()
      .join(''),
  }
}

// Telegram HTML of a text and its sorted entities. Where marks overlap without one holding the
// other, the inner one is closed and opened again around the end of the outer one.
function toHtml(text: string, entities: readonly TextEntity[]): string {
  const end = (entity: TextEntity) => entity.offset + entity.length
  const stops = [...new Set([...entities.flatMap((entity) => [entity.offset, end(entity)]), text.length])].sort(
    (a, b) => a - b,
  )
  const open: { entity: TextEntity; open: string; close: string }[] = []
  let html = ''
  let at = 0
  for (const stop of stops) {
    html += escapeText(text.slice(at, stop))
    at = stop
    const first = open.findIndex((tag) => end(tag.entity) === stop)
    if (first >= 0) {
      const closed = open.splice(first)
      html += closed
        .map((tag) => tag.close)
        .reverse()
        .join('')
      for (const tag of closed) {
        if (end(tag.entity) === stop) continue
        html += tag.open
        open.push(tag)
      }
    }
    for (const entity of entities.filter((entity) => entity.offset === stop)) {
      const tag = { entity, ...tagsOf(entity) }
      html += tag.open
      open.push(tag)
    }
  }
  return html
}
