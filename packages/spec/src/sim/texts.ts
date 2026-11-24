// Texts while trying: the tester's language with the design's default language as fallback,
// variables filled in with their current values (or the test value, or `{idName}` when unknown)
// and text parts expanded in place. Rich texts keep their document form, since the phone renders
// them.
import type { Row } from '../model/buttons.ts'
import type { Content, RichMessageBlock } from '../model/content.ts'
import type { ButtonId, PartId } from '../model/ids.ts'
import type { InvoiceStep } from '../model/steps.ts'
import type { LangText, RichTextRef } from '../model/texts.ts'
import {
  RICH_NODES,
  type Paragraph,
  type RichBlock,
  type RichDoc,
  type RichInline,
  type RichMark,
} from '../text/schema.ts'
import type {
  SimContent,
  SimContext,
  SimInlineButton,
  SimInvoice,
  SimReplyButton,
  SimRichBlock,
  SimVars,
} from './types.ts'
import { lookup, shown } from './values.ts'

/** A plain text in the tester's language, with `{idName}` filled in for each known variable. */
export function langText(ctx: SimContext, vars: SimVars, text: LangText | undefined): string {
  const { design, user } = ctx
  const raw = text?.[user.language] ?? text?.[design.languages.default] ?? ''
  return fill(ctx, vars, raw)
}

/** Fills in `{idName}` in a plain text (a URL, a label); unknown names stay as they are. */
export function fill(ctx: SimContext, vars: SimVars, text: string): string {
  return text.replace(/\{([a-z][a-z0-9_]*)\}/g, (match, name: string) => {
    const variable = ctx.byIdName.get(name)
    return variable ? shown(lookup(ctx, vars, variable.id), name) : match
  })
}

function withMarks(node: RichInline, outer: RichMark[]): RichInline {
  if (outer.length === 0) return node
  const own = node.marks ?? []
  return { ...node, marks: [...own, ...outer.filter((mark) => !own.some((ownMark) => ownMark.type === mark.type))] }
}

// Inline nodes with variables as text and text parts expanded; `seen` stops a part inside itself.
function inline(
  ctx: SimContext,
  vars: SimVars,
  nodes: RichInline[] | undefined,
  outer: RichMark[],
  seen: ReadonlySet<PartId>,
): RichInline[] {
  return (nodes ?? []).flatMap((node): RichInline[] => {
    switch (node.type) {
      case RICH_NODES.variable: {
        const name = ctx.design.variables[node.attrs.var]?.idName ?? node.attrs.var
        const text = shown(lookup(ctx, vars, node.attrs.var), name)
        return text === '' ? [] : [withMarks({ type: RICH_NODES.text, text, marks: node.marks }, outer)]
      }
      case RICH_NODES.part: {
        const part = ctx.design.parts[node.attrs.part]
        if (part?.kind !== 'text' || seen.has(part.id)) return []
        const marks = [...(node.marks ?? []), ...outer]
        return partInline(ctx, vars, pick(ctx, part.text), marks, new Set([...seen, part.id]))
      }
      case RICH_NODES.text:
        return node.text === '' ? [] : [withMarks(node, outer)]
      default:
        return [withMarks(node, outer)]
    }
  })
}

// A text part's blocks as one run of inline nodes, the blocks joined by line breaks.
function partInline(
  ctx: SimContext,
  vars: SimVars,
  doc: RichDoc,
  outer: RichMark[],
  seen: ReadonlySet<PartId>,
): RichInline[] {
  const lines = doc.content.flatMap((block): RichInline[][] => {
    switch (block.type) {
      case RICH_NODES.paragraph:
        return [inline(ctx, vars, block.content, outer, seen)]
      case RICH_NODES.codeBlock:
        return [(block.content ?? []).map((node) => withMarks({ ...node, marks: [{ type: 'code' }] }, outer))]
      case RICH_NODES.blockquote:
        return block.content.map((paragraph) => inline(ctx, vars, paragraph.content, outer, seen))
    }
  })
  const lineBreak: RichInline = { type: RICH_NODES.hardBreak }
  return lines.flatMap((line, index) => (index === 0 ? line : [lineBreak, ...line]))
}

function pick(ctx: SimContext, ref: RichTextRef): RichDoc {
  const { design, user } = ctx
  return ref.doc[user.language] ?? ref.doc[design.languages.default] ?? { type: RICH_NODES.doc, content: [] }
}

/** A rich text as one document in the tester's language, filled in. */
export function richText(ctx: SimContext, vars: SimVars, ref: RichTextRef): RichDoc {
  const paragraph = (item: Paragraph): Paragraph => ({
    ...item,
    content: inline(ctx, vars, item.content, [], new Set()),
  })
  const block = (item: RichBlock): RichBlock => {
    switch (item.type) {
      case RICH_NODES.paragraph:
        return paragraph(item)
      case RICH_NODES.codeBlock:
        return item
      case RICH_NODES.blockquote:
        return { ...item, content: item.content.map(paragraph) }
    }
  }
  return { type: RICH_NODES.doc, content: pick(ctx, ref).content.map(block) }
}

/** A message's content with each rich text resolved, and a poll's options in the tester's language. */
export function simContent(ctx: SimContext, vars: SimVars, content: Content): SimContent {
  const rich = (ref: RichTextRef | undefined) => ref && richText(ctx, vars, ref)
  switch (content.type) {
    case 'text':
      return { ...content, text: richText(ctx, vars, content.text) }
    case 'photo':
    case 'livePhoto':
    case 'video':
    case 'animation':
    case 'audio':
    case 'voice':
    case 'document':
    case 'paidMedia':
      return { ...content, caption: rich(content.caption) }
    case 'album':
      return { ...content, items: content.items.map((item) => ({ ...item, caption: rich(item.caption) })) }
    case 'poll':
      return {
        ...content,
        question: richText(ctx, vars, content.question),
        options: content.options.map((option) => langText(ctx, vars, option)),
      }
    case 'quiz':
      return {
        ...content,
        question: richText(ctx, vars, content.question),
        options: content.options.map((option) => langText(ctx, vars, option)),
        explanation: rich(content.explanation),
      }
    case 'rich':
      return { ...content, blocks: content.blocks.map((block) => simBlock(ctx, vars, block)) }
    default:
      return content
  }
}

// A rich message's block with its texts resolved and a button row's buttons as shown.
function simBlock(ctx: SimContext, vars: SimVars, block: RichMessageBlock): SimRichBlock {
  const rich = (ref: RichTextRef) => richText(ctx, vars, ref)
  switch (block.type) {
    case 'paragraph':
    case 'footer':
    case 'heading':
    case 'code':
      return { ...block, text: rich(block.text) }
    case 'quote':
      return { ...block, text: rich(block.text), credit: block.credit && rich(block.credit) }
    case 'list':
      return { ...block, items: block.items.map((item) => ({ ...item, text: rich(item.text) })) }
    case 'table':
      return {
        ...block,
        rows: block.rows.map((row) => ({ cells: row.cells.map((cell) => ({ ...cell, text: rich(cell.text) })) })),
        caption: block.caption && rich(block.caption),
      }
    case 'details':
      return { ...block, summary: rich(block.summary), text: rich(block.text) }
    case 'media':
      return { ...block, caption: block.caption && rich(block.caption) }
    case 'divider':
      return block
    case 'buttons':
      return {
        type: 'buttons',
        buttons: inlineRows(ctx, vars, [{ type: 'buttons', ids: block.ids }]).flat(),
        ...(block.align && { align: block.align }),
      }
  }
}

/** An invoice in the tester's language, with its total and the shipping options its sheet offers. */
export function simInvoice(ctx: SimContext, vars: SimVars, step: InvoiceStep): SimInvoice {
  const { invoice } = step
  const { physical } = invoice
  return {
    type: 'invoice',
    title: langText(ctx, vars, invoice.title),
    description: langText(ctx, vars, invoice.description),
    ...(invoice.photo && { photo: invoice.photo }),
    currency: invoice.currency,
    prices: invoice.prices.map((price) => ({ label: langText(ctx, vars, price.label), amount: price.amount })),
    total: invoice.prices.reduce((sum, price) => sum + price.amount, 0),
    ...(invoice.subscription && { subscription: invoice.subscription }),
    physical: physical
      ? {
          needName: physical.needName,
          needPhone: physical.needPhone,
          needEmail: physical.needEmail,
          needAddress: physical.needAddress,
        }
      : null,
    shipping: physical?.flexibleShipping
      ? physical.shippingOptions.map((option) => ({
          id: option.id,
          title: langText(ctx, vars, option.title),
          amount: option.amount,
        }))
      : null,
  }
}

/** The button IDs of a keyboard's rows, with row parts expanded. */
export function rowIds(ctx: SimContext, rows: Row[]): ButtonId[][] {
  return rows.flatMap((row) => {
    if (row.type === 'buttons') return [row.ids]
    const part = ctx.design.parts[row.part]
    return part?.kind === 'rows' ? part.rows : []
  })
}

export function inlineRows(ctx: SimContext, vars: SimVars, rows: Row[]): SimInlineButton[][] {
  return rowIds(ctx, rows)
    .map((ids) =>
      ids.flatMap((id): SimInlineButton[] => {
        const button = ctx.design.buttons[id]
        if (button?.place !== 'inline') return []
        const { action } = button
        let value: string | undefined
        if (action.type === 'url' || action.type === 'loginUrl') value = fill(ctx, vars, action.url)
        if (action.type === 'copyText') value = langText(ctx, vars, action.text)
        return [
          {
            id,
            label: langText(ctx, vars, button.label),
            look: button.look,
            ...(button.icon && { icon: button.icon }),
            disabled: button.disabled ?? false,
            action: action.type,
            ...(value !== undefined && { value }),
          },
        ]
      }),
    )
    .filter((row) => row.length > 0)
}

export function replyRows(ctx: SimContext, vars: SimVars, rows: Row[]): SimReplyButton[][] {
  return rowIds(ctx, rows)
    .map((ids) =>
      ids.flatMap((id): SimReplyButton[] => {
        const button = ctx.design.buttons[id]
        if (button?.place !== 'reply') return []
        const label = langText(ctx, vars, button.label)
        return [{ id, label, look: button.look, ...(button.icon && { icon: button.icon }), action: button.action.type }]
      }),
    )
    .filter((row) => row.length > 0)
}
