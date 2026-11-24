// Helpers of the fixture designs (make spec-check): ID names made from titles as the editor makes
// them, the built-in variables, collections from lists and rich texts from plain lines.
import {
  BUILTIN_VARIABLES,
  RESERVED_ID_NAMES,
  toIdName,
  type Lang,
  type Paragraph,
  type RichInline,
  type RichTextRef,
  type TextId,
  type Variable,
} from '../src/index.ts'

/**
 * ID names from titles, labels and names as the editor gives them (toIdName), unique across the
 * design: the built-in variables' names and the special targets `back` and `stay` are taken.
 */
export function idNames(): (base: string, prefix?: string, fallback?: string) => string {
  const taken = new Set<string>([...RESERVED_ID_NAMES, ...BUILTIN_VARIABLES.map((variable) => variable.idName)])
  return (base, prefix = '', fallback) => {
    const name = toIdName(base, prefix, taken, fallback)
    taken.add(name)
    return name
  }
}

/** The built-in variables, with readable IDs (`var-first-name`). */
export function builtinVariables(): Variable[] {
  return BUILTIN_VARIABLES.map((variable) => ({
    id: `var-${variable.idName.replaceAll('_', '-')}`,
    ...variable,
    idNameFixed: true,
    source: 'builtin',
  }))
}

/** A collection of the design from its items, each under its own ID. */
export function byId<T extends { id: string }>(items: readonly T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]))
}

/**
 * Rich texts from plain lines per language: one paragraph per line, and `{name}` the variable of
 * that ID name (other braces stay text).
 */
export function sayer(
  variables: readonly Variable[],
): (id: TextId, texts: Readonly<Record<Lang, string>>) => RichTextRef {
  const byName = new Map(variables.map((variable) => [variable.idName, variable.id]))
  const paragraph = (line: string): Paragraph => {
    const content: RichInline[] = []
    for (const [index, piece] of line.split(/\{([a-z][a-z0-9_]*)\}/).entries()) {
      const variable = index % 2 === 1 ? byName.get(piece) : undefined
      if (variable !== undefined) content.push({ type: 'variable', attrs: { var: variable } })
      else if (index % 2 === 1) content.push({ type: 'text', text: `{${piece}}` })
      else if (piece !== '') content.push({ type: 'text', text: piece })
    }
    return content.length > 0 ? { type: 'paragraph', content } : { type: 'paragraph' }
  }
  return (id, texts) => ({
    id,
    doc: Object.fromEntries(
      Object.entries(texts).map(([lang, text]) => [lang, { type: 'doc', content: text.split('\n').map(paragraph) }]),
    ),
  })
}
