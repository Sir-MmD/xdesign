// Markdown writing for design.md: the designer's words escaped so Markdown reads none of them as
// formatting, code blocks whose fence no text can close, quotes and tables. Only the characters
// that change how a line renders are escaped (not `_`, which GitHub's Markdown does not read
// inside words), so the file stays easy to read as plain text.
import type { Lang } from '../model/ids.ts'
import type { LangText } from '../model/texts.ts'

const escapeChars = (text: string) => text.replace(/[\\`*[\]<>|]/g, '\\$&')

/** A text inside a line: escaped, its line breaks as spaces. */
export function inline(text: string): string {
  return escapeChars(text.replace(/\s*\n\s*/g, ' ').trim())
}

/** A table cell: escaped, its line breaks as `<br>`. */
export function cell(text: string): string {
  return text
    .trim()
    .split('\n')
    .map((line) => escapeChars(line.trim()))
    .join('<br>')
}

/** A code span that no backtick inside can close. */
export function code(text: string): string {
  const longest = Math.max(0, ...Array.from(text.matchAll(/`+/g), (match) => match[0].length))
  const ticks = '`'.repeat(longest + 1)
  return longest > 0 ? `${ticks} ${text} ${ticks}` : `${ticks}${text}${ticks}`
}

/** A code block whose fence is longer than any run of backticks in the text. */
export function fence(text: string, info = ''): string[] {
  const longest = Math.max(2, ...Array.from(text.matchAll(/`+/g), (match) => match[0].length))
  const bar = '`'.repeat(longest + 1)
  return [bar + info, ...text.split('\n'), bar]
}

// A line that starts like a heading, a quote, a list, a rule or a setext underline.
const BLOCK_START = /^(\s*)([#>+=_-]|\d+(?=[.)]))/

/** A plain text as a quote, line by line. */
export function quote(text: string): string[] {
  return text.split('\n').map((line) => {
    if (line.trim() === '') return '>'
    const escaped = escapeChars(line).replace(BLOCK_START, (_, space: string, start: string) =>
      /\d/.test(start) ? `${space}${start}\\` : `${space}\\${start}`,
    )
    return `> ${escaped}`
  })
}

/**
 * A table; the cells are Markdown already (cell, inline or code). A pipe not escaped yet (in a
 * code span) is escaped, as GitHub's tables need even there.
 */
export function table(head: readonly string[], rows: readonly (readonly string[])[]): string[] {
  const line = (cells: readonly string[]) => `| ${cells.map((text) => text.replace(/(?<!\\)\|/g, '\\|')).join(' | ')} |`
  return [line(head), `|${head.map(() => '---').join('|')}|`, ...rows.map(line)]
}

/** A link or picture target, in angle brackets when it has spaces or parentheses. */
export function target(path: string): string {
  return /[\s()<>]/.test(path) ? `<${path.replace(/[<>]/g, encodeURIComponent)}>` : path
}

/**
 * A plain text per language, quoted and escaped: `"Cancel", fa: "انصراف"`; the first language
 * (the default one) without its code.
 */
export function quoteLangs(text: LangText, langs: readonly Lang[]): string {
  const said = langs.flatMap((lang, index) => {
    const value = text[lang]?.trim()
    if (value === undefined || value === '') return []
    return [index === 0 ? `"${inline(value)}"` : `${lang}: "${inline(value)}"`]
  })
  return said.length === 0 ? '(no text yet)' : said.join(', ')
}
