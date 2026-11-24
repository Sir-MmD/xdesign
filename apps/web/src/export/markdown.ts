// A small Markdown renderer for design.md on the printable page (docs/plan/06 section 5): what
// toMarkdown (packages/spec/src/markdown/) writes and nothing more. Blocks: ATX headings with
// GitHub-style IDs (so the summary's `#9-checks` jumps), paragraphs, `- ` lists, quotes (their
// lines kept, as the messages' lines), fenced code blocks (a `mermaid` one is drawn as the map)
// and pipe tables; inline: backslash escapes, code spans, `**bold**`, links, pictures and the
// `<br>` of table cells. Everything is drawn as React elements, so no text of the design is read
// as HTML (MarkdownView.tsx).

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'code'; text: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'link'; href: string; children: Inline[] }
  | { type: 'image'; src: string; alt: string }
  // A line break: `<br>` in a table cell, a line of a quote.
  | { type: 'break' }
  // A line break inside a paragraph, read as a space (pictures stand side by side).
  | { type: 'soft' }

export type Block =
  | { type: 'heading'; level: number; id: string; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; items: Inline[][] }
  | { type: 'quote'; paragraphs: Inline[][] }
  | { type: 'code'; info: string; text: string }
  | { type: 'table'; head: Inline[][]; rows: Inline[][][] }

const punctuation = /^[!-/:-@[-`{-~]$/

// The length of the run of `char` at `from`.
function runOf(src: string, from: number, char: string): number {
  let end = from
  while (src[end] === char) end++
  return end - from
}

// Where the next run of exactly `length` backticks starts, from `from`; -1 without one.
function findTicks(src: string, from: number, length: number): number {
  for (let at = from; at < src.length;) {
    if (src[at] !== '`') {
      at++
      continue
    }
    const run = runOf(src, at, '`')
    if (run === length) return at
    at += run
  }
  return -1
}

// The end of a `**bold**` opened before `from`, past escapes and code spans; -1 without one.
function findStrongEnd(src: string, from: number): number {
  for (let at = from; at < src.length;) {
    if (src[at] === '\\') at += 2
    else if (src[at] === '`') {
      const run = runOf(src, at, '`')
      const close = findTicks(src, at + run, run)
      at = close < 0 ? at + run : close + run
    } else if (src.startsWith('**', at)) return at
    else at++
  }
  return -1
}

// `[label](target)` or `[label](<target>)` at `from` (a `[`).
function readLink(src: string, from: number): { label: string; target: string; end: number } | undefined {
  let depth = 0
  let close = -1
  for (let at = from + 1; at < src.length; at++) {
    const char = src[at]
    if (char === '\\') at++
    else if (char === '[') depth++
    else if (char === ']') {
      if (depth === 0) {
        close = at
        break
      }
      depth--
    }
  }
  if (close < 0 || src[close + 1] !== '(') return undefined
  const open = close + 2
  const angled = src[open] === '<'
  const end = angled ? src.indexOf('>)', open) : src.indexOf(')', open)
  if (end < 0) return undefined
  const target = angled ? src.slice(open + 1, end) : src.slice(open, end)
  return { label: src.slice(from + 1, close), target, end: end + (angled ? 2 : 1) }
}

function parseInline(src: string): Inline[] {
  const out: Inline[] = []
  let text = ''
  const flush = () => {
    if (text !== '') out.push({ type: 'text', text })
    text = ''
  }
  for (let at = 0; at < src.length;) {
    const char = src.charAt(at)
    const next = src.charAt(at + 1)
    if (char === '\\' && punctuation.test(next)) {
      text += next
      at += 2
    } else if (char === '\n') {
      flush()
      out.push({ type: 'soft' })
      at++
    } else if (char === '`') {
      const run = runOf(src, at, '`')
      const close = findTicks(src, at + run, run)
      if (close < 0) {
        text += src.slice(at, at + run)
        at += run
        continue
      }
      let code = src.slice(at + run, close).replace(/\n/g, ' ')
      if (code.length > 2 && code.startsWith(' ') && code.endsWith(' ') && code.trim() !== '') code = code.slice(1, -1)
      flush()
      out.push({ type: 'code', text: code })
      at = close + run
    } else if (src.startsWith('<br>', at)) {
      flush()
      out.push({ type: 'break' })
      at += 4
    } else if (src.startsWith('**', at) && findStrongEnd(src, at + 2) > at + 2) {
      const close = findStrongEnd(src, at + 2)
      flush()
      out.push({ type: 'strong', children: parseInline(src.slice(at + 2, close)) })
      at = close + 2
    } else if ((char === '!' && next === '[') || char === '[') {
      const image = char === '!'
      const link = readLink(src, image ? at + 1 : at)
      if (!link) {
        text += char
        at++
        continue
      }
      flush()
      const label = parseInline(link.label)
      out.push(
        image
          ? { type: 'image', src: link.target, alt: plain(label) }
          : { type: 'link', href: link.target, children: label },
      )
      at = link.end
    } else {
      text += char
      at++
    }
  }
  flush()
  return out
}

/** The text of inline content, as a heading's ID and a picture's description read it. */
export function plain(inlines: readonly Inline[]): string {
  return inlines
    .map((inline) => {
      switch (inline.type) {
        case 'text':
        case 'code':
          return inline.text
        case 'strong':
        case 'link':
          return plain(inline.children)
        case 'image':
          return inline.alt
        case 'break':
        case 'soft':
          return ' '
      }
    })
    .join('')
}

/** GitHub's heading IDs: lower case, punctuation and symbols left out, spaces as `-`, repeats numbered. */
function headingId(text: string, seen: Map<string, number>): string {
  const base = text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
    .replace(/ /g, '-')
  const count = seen.get(base)
  seen.set(base, (count ?? 0) + 1)
  return count === undefined ? base : `${base}-${String(count)}`
}

// The cells of a table row: `|` splits, `\|` is a pipe (also in a code span, as GitHub reads it).
function cells(line: string): string[] {
  const body = line.trim().replace(/^\|/, '')
  const out: string[] = []
  let cell = ''
  for (let at = 0; at < body.length; at++) {
    const char = body.charAt(at)
    if (char === '\\' && at + 1 < body.length) {
      cell += body[at + 1] === '|' ? '|' : char + body.charAt(at + 1)
      at++
    } else if (char === '|') {
      out.push(cell.trim())
      cell = ''
    } else cell += char
  }
  if (cell.trim() !== '') out.push(cell.trim())
  return out
}

const delimiterRow = /^\|(\s*:?-+:?\s*\|)+\s*$/

/** design.md as blocks. */
export function parseMarkdown(src: string): Block[] {
  const lines = src.split('\n')
  const blocks: Block[] = []
  const seen = new Map<string, number>()
  let paragraph: string[] = []
  const endParagraph = () => {
    if (paragraph.length > 0) blocks.push({ type: 'paragraph', children: parseInline(paragraph.join('\n')) })
    paragraph = []
  }
  for (let at = 0; at < lines.length;) {
    const line = lines[at] ?? ''
    const fence = /^(`{3,})(.*)$/.exec(line)
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (fence) {
      endParagraph()
      const bar = fence[1] ?? '```'
      const body: string[] = []
      at++
      while (at < lines.length && !((lines[at] ?? '').startsWith(bar) && /^`+\s*$/.test(lines[at] ?? ''))) {
        body.push(lines[at] ?? '')
        at++
      }
      at++
      blocks.push({ type: 'code', info: (fence[2] ?? '').trim(), text: body.join('\n') })
    } else if (line.trim() === '') {
      endParagraph()
      at++
    } else if (heading) {
      endParagraph()
      const children = parseInline(heading[2] ?? '')
      blocks.push({ type: 'heading', level: heading[1]?.length ?? 1, id: headingId(plain(children), seen), children })
      at++
    } else if (line.startsWith('>')) {
      endParagraph()
      const paragraphs: string[][] = [[]]
      for (; at < lines.length && (lines[at] ?? '').startsWith('>'); at++) {
        const text = (lines[at] ?? '').replace(/^> ?/, '')
        if (text.trim() === '') paragraphs.push([])
        else paragraphs.at(-1)?.push(text)
      }
      blocks.push({
        type: 'quote',
        paragraphs: paragraphs
          .filter((part) => part.length > 0)
          .map((part) =>
            parseInline(part.join('\n')).map((inline): Inline => (inline.type === 'soft' ? { type: 'break' } : inline)),
          ),
      })
    } else if (line.startsWith('- ')) {
      endParagraph()
      const items: Inline[][] = []
      for (; at < lines.length && (lines[at] ?? '').startsWith('- '); at++)
        items.push(parseInline((lines[at] ?? '').slice(2)))
      blocks.push({ type: 'list', items })
    } else if (line.startsWith('|') && delimiterRow.test(lines[at + 1] ?? '')) {
      endParagraph()
      const head = cells(line).map(parseInline)
      const rows: Inline[][][] = []
      for (at += 2; at < lines.length && (lines[at] ?? '').startsWith('|'); at++)
        rows.push(cells(lines[at] ?? '').map(parseInline))
      blocks.push({ type: 'table', head, rows })
    } else {
      paragraph.push(line)
      at++
    }
  }
  endParagraph()
  return blocks
}
