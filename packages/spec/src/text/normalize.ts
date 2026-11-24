// The normal form of a rich document (docs/plan/03-design-model.md section 5): of the documents
// Telegram cannot tell apart, the one fromTelegram gives back. So fromTelegram(toTelegram(doc))
// equals normalizeRichDoc(doc) for every document without a part node (a part comes back as the
// text it expands to).
import { normalMarks } from './marks.ts'
import { RICH_NODES, type Paragraph, type RichBlock, type RichDoc, type RichInline, type RichMark } from './schema.ts'

/**
 * A document in normal form: marks as `normalMarks` gives them, left out when there are none;
 * adjacent texts with equal marks merged, empty texts and custom emoji without a fallback
 * dropped; a line break (a hard break or a `\n` in a text) stays a hard break when it has marks
 * and starts a new paragraph when it has none; a code block's language null when it is empty, a
 * quote's `expandable` true or false; an empty code block, an empty quote and a document without
 * blocks become an empty paragraph. Part nodes are kept as they are.
 */
export function normalizeRichDoc(doc: RichDoc): RichDoc {
  const content = doc.content.flatMap((block) => normalBlock(block))
  return { type: RICH_NODES.doc, content: content.length > 0 ? content : [{ type: RICH_NODES.paragraph }] }
}

function normalBlock(block: RichBlock): RichBlock[] {
  switch (block.type) {
    case RICH_NODES.paragraph:
      return paragraphs(block.content)
    case RICH_NODES.codeBlock: {
      const text = (block.content ?? []).map((node) => node.text).join('')
      if (!text) return [{ type: RICH_NODES.paragraph }]
      return [
        {
          type: RICH_NODES.codeBlock,
          attrs: { language: block.attrs?.language || null },
          content: [{ type: RICH_NODES.text, text }],
        },
      ]
    }
    case RICH_NODES.blockquote: {
      const content = block.content.flatMap((paragraph) => paragraphs(paragraph.content))
      if (content.length < 2 && !content[0]?.content) return [{ type: RICH_NODES.paragraph }]
      return [{ type: RICH_NODES.blockquote, attrs: { expandable: block.attrs?.expandable === true }, content }]
    }
  }
}

// The paragraphs one paragraph's inline nodes make: a line break without marks starts the next.
function paragraphs(nodes: readonly RichInline[] | undefined): Paragraph[] {
  let line: RichInline[] = []
  const lines = [line]
  const add = (node: RichInline) => {
    const last = line.at(-1)
    if (node.type === RICH_NODES.text && last?.type === RICH_NODES.text && sameMarks(last.marks, node.marks)) {
      line[line.length - 1] = { ...last, text: last.text + node.text }
    } else {
      line.push(node)
    }
  }
  const lineBreak = (marks: RichMark[]) => {
    if (marks.length > 0) {
      add(withMarks({ type: RICH_NODES.hardBreak }, marks))
    } else {
      line = []
      lines.push(line)
    }
  }
  for (const node of nodes ?? []) {
    const marks = normalMarks(node.marks)
    switch (node.type) {
      case RICH_NODES.text:
        node.text.split('\n').forEach((piece, index) => {
          if (index > 0) lineBreak(marks)
          if (piece) add(withMarks({ type: RICH_NODES.text, text: piece }, marks))
        })
        break
      case RICH_NODES.hardBreak:
        lineBreak(marks)
        break
      case RICH_NODES.variable:
        add(withMarks({ type: RICH_NODES.variable, attrs: { var: node.attrs.var } }, marks))
        break
      case RICH_NODES.customEmoji:
        if (node.attrs.fallback) {
          add(
            withMarks(
              { type: RICH_NODES.customEmoji, attrs: { id: node.attrs.id, fallback: node.attrs.fallback } },
              marks,
            ),
          )
        }
        break
      case RICH_NODES.part:
        add(withMarks({ type: RICH_NODES.part, attrs: { part: node.attrs.part } }, marks))
        break
    }
  }
  return lines.map((content) =>
    content.length > 0 ? { type: RICH_NODES.paragraph, content } : { type: RICH_NODES.paragraph },
  )
}

function withMarks<T extends RichInline>(node: T, marks: RichMark[]): T {
  return marks.length > 0 ? { ...node, marks } : node
}

// Marks in normal form are equal when their JSON is.
function sameMarks(a: RichMark[] | undefined, b: RichMark[] | undefined): boolean {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? [])
}
