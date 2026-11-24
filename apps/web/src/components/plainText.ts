import { isValidElement, type ReactNode } from 'react'

import { FieldTag } from '@/components/ui/field'

/**
 * The words of a label or a title given as React nodes, for the name of its "i" ("About <label>", 26 section 5.3,
 * INF-01): the text of its strings and numbers and of its elements' children, without a field's tags ("Required",
 * "Optional"), which say something about the field and are not its name. Empty for words that a component makes from
 * other props: the caller then names the "i" itself (`helpLabel`).
 */
export function plainText(node: ReactNode): string {
  return words(node).replace(/\s+/g, ' ').trim()
}

function words(node: ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number' || typeof node === 'bigint') return String(node)
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return node.type === FieldTag ? '' : words(node.props.children)
  }
  if (typeof node === 'object' && node !== null && Symbol.iterator in node) {
    return Array.from(node as Iterable<ReactNode>, words).join('')
  }
  return ''
}
