// ID names (docs/plan/03-design-model.md section 4): the snake_case names of steps, buttons,
// variables, switches and parts that the developer sees in the export, unique in the design.
import { toLatin } from './transliterate.ts'

/** A letter a to z, then up to 47 of a to z, 0 to 9 and `_`. */
export const ID_NAME_PATTERN = /^[a-z][a-z0-9_]{0,47}$/

const maxLength = 48

/**
 * `back` and `stay`, the special targets of an arrow, are never ID names: a step named so would
 * be read as the target. Every caller of toIdName counts them as taken.
 */
export const RESERVED_ID_NAMES: ReadonlySet<string> = new Set(['back', 'stay'])

export function isIdName(name: string): boolean {
  return ID_NAME_PATTERN.test(name)
}

/**
 * The ID name made from a title or label in the default language: lower case Latin (toLatin),
 * every run of other characters to `_`, then `prefix` in front (`btn_` for buttons, `''` for
 * the rest). A name that starts with a digit loses its leading digits. A taken name gets `_2`,
 * `_3` and so on; a base with nothing usable gives `fallback` and the first free number from 1
 * (`step_1`, `btn_1`).
 */
export function toIdName(
  base: string,
  prefix: string,
  taken: ReadonlySet<string>,
  fallback = prefix || 'step_',
): string {
  const stem = toLatin(base)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const name = stem === '' ? '' : cut((prefix + stem).replace(/^[^a-z]+/, ''), maxLength)
  if (name === '') {
    for (let n = 1; ; n++) {
      const numbered = fallback + String(n)
      if (!taken.has(numbered)) return numbered
    }
  }
  if (!taken.has(name)) return name
  for (let n = 2; ; n++) {
    const suffix = '_' + String(n)
    const numbered = cut(name, maxLength - suffix.length) + suffix
    if (!taken.has(numbered)) return numbered
  }
}

// The first `length` characters, without a `_` at the end.
function cut(name: string, length: number): string {
  return name.slice(0, length).replace(/_+$/, '')
}
