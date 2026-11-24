// The variable and part nodes of a rich document with their references renamed: IDs to ID names
// for the export, ID names back to the fresh IDs of an import.
import { RICH_NODES, type Paragraph, type RichDoc, type RichInline } from '../text/schema.ts'

export function renameRichRefs(
  doc: RichDoc,
  variable: (ref: string) => string,
  part: (ref: string) => string,
): RichDoc {
  const inline = (node: RichInline): RichInline => {
    switch (node.type) {
      case RICH_NODES.variable:
        return { ...node, attrs: { var: variable(node.attrs.var) } }
      case RICH_NODES.part:
        return { ...node, attrs: { part: part(node.attrs.part) } }
      default:
        return node
    }
  }
  const paragraph = (block: Paragraph): Paragraph =>
    block.content === undefined ? block : { ...block, content: block.content.map(inline) }
  return {
    ...doc,
    content: doc.content.map((block) => {
      switch (block.type) {
        case RICH_NODES.paragraph:
          return paragraph(block)
        case RICH_NODES.blockquote:
          return { ...block, content: block.content.map(paragraph) }
        case RICH_NODES.codeBlock:
          return block
      }
    }),
  }
}
