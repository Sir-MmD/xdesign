// The rich text schema (docs/plan/03-design-model.md section 5.1): TipTap JSON limited to what
// Telegram renders. The editor (TXT-01) and the converters (SPEC-02) take the node and mark names
// from here: TipTap's default names, and the custom spoiler, dateTime, variable, customEmoji and
// part. Attributes TipTap adds that Telegram has no use for (a link's target, rel and class) are
// dropped when a document is parsed.
import { z } from 'zod'

import { PartIdSchema, VarIdSchema, type PartId, type VarId } from '../model/ids.ts'

export const RICH_NODES = {
  doc: 'doc',
  paragraph: 'paragraph',
  text: 'text',
  hardBreak: 'hardBreak',
  codeBlock: 'codeBlock',
  blockquote: 'blockquote',
  variable: 'variable',
  customEmoji: 'customEmoji',
  part: 'part',
} as const
export type RichNodeName = (typeof RICH_NODES)[keyof typeof RICH_NODES]

export const RICH_MARKS = {
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  strike: 'strike',
  spoiler: 'spoiler',
  code: 'code',
  link: 'link',
  dateTime: 'dateTime',
} as const
export type RichMarkName = (typeof RICH_MARKS)[keyof typeof RICH_MARKS]

export const RichMarkSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.enum([
      RICH_MARKS.bold,
      RICH_MARKS.italic,
      RICH_MARKS.underline,
      RICH_MARKS.strike,
      RICH_MARKS.spoiler,
      RICH_MARKS.code,
    ]),
  }),
  z.object({ type: z.literal(RICH_MARKS.link), attrs: z.object({ href: z.string() }) }),
  // Telegram's date_time entity (Bot API 9.5): the time as a Unix timestamp and its format.
  z.object({ type: z.literal(RICH_MARKS.dateTime), attrs: z.object({ unix: z.number(), format: z.string() }) }),
])
export type RichMark = z.infer<typeof RichMarkSchema>

const marks = z.array(RichMarkSchema).optional()

export const TextNodeSchema = z.object({ type: z.literal(RICH_NODES.text), text: z.string(), marks })
export type TextNode = z.infer<typeof TextNodeSchema>

// Inline nodes; variable, customEmoji and part are atoms. A part node places a text part.
export const RichInlineSchema = z.discriminatedUnion('type', [
  TextNodeSchema,
  z.object({ type: z.literal(RICH_NODES.hardBreak), marks }),
  z.object({ type: z.literal(RICH_NODES.variable), attrs: z.object({ var: VarIdSchema }), marks }),
  z.object({
    type: z.literal(RICH_NODES.customEmoji),
    attrs: z.object({ id: z.string(), fallback: z.string() }),
    marks,
  }),
  z.object({ type: z.literal(RICH_NODES.part), attrs: z.object({ part: PartIdSchema }), marks }),
])
export type RichInline = z.infer<typeof RichInlineSchema>

export const ParagraphSchema = z.object({
  type: z.literal(RICH_NODES.paragraph),
  content: z.array(RichInlineSchema).optional(),
})
export type Paragraph = z.infer<typeof ParagraphSchema>

// Telegram's pre entity: plain text only, with the language of the code if it is known.
export const CodeBlockSchema = z.object({
  type: z.literal(RICH_NODES.codeBlock),
  attrs: z.object({ language: z.string().nullable().optional() }).optional(),
  content: z.array(TextNodeSchema.omit({ marks: true })).optional(),
})
export type CodeBlock = z.infer<typeof CodeBlockSchema>

// A quote holds paragraphs only, no code block or quote inside (Telegram cannot nest quotes);
// `expandable` is Telegram's expandable_blockquote.
export const BlockquoteSchema = z.object({
  type: z.literal(RICH_NODES.blockquote),
  attrs: z.object({ expandable: z.boolean().optional() }).optional(),
  content: z.array(ParagraphSchema),
})
export type Blockquote = z.infer<typeof BlockquoteSchema>

export const RichBlockSchema = z.discriminatedUnion('type', [ParagraphSchema, CodeBlockSchema, BlockquoteSchema])
export type RichBlock = z.infer<typeof RichBlockSchema>

export const RichDocSchema = z.object({ type: z.literal(RICH_NODES.doc), content: z.array(RichBlockSchema) })
export type RichDoc = z.infer<typeof RichDocSchema>

/**
 * The plain text of a document: blocks and the paragraphs of a quote joined by `\n`, a hard
 * break as `\n`, a variable as `{idName}` (from `varName`), a custom emoji as its fallback, and
 * a text part as `partText` gives it (nothing by default).
 */
export function plainText(
  doc: RichDoc,
  varName: (id: VarId) => string,
  partText: (id: PartId) => string = () => '',
): string {
  const inline = (nodes: RichInline[] | undefined): string =>
    (nodes ?? [])
      .map((node) => {
        switch (node.type) {
          case RICH_NODES.text:
            return node.text
          case RICH_NODES.hardBreak:
            return '\n'
          case RICH_NODES.variable:
            return `{${varName(node.attrs.var)}}`
          case RICH_NODES.customEmoji:
            return node.attrs.fallback
          case RICH_NODES.part:
            return partText(node.attrs.part)
        }
      })
      .join('')
  return doc.content
    .map((block) => {
      switch (block.type) {
        case RICH_NODES.paragraph:
          return inline(block.content)
        case RICH_NODES.codeBlock:
          return (block.content ?? []).map((node) => node.text).join('')
        case RICH_NODES.blockquote:
          return block.content.map((paragraph) => inline(paragraph.content)).join('\n')
      }
    })
    .join('\n')
}
