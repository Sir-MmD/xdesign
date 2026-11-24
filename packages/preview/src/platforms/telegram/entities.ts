// The entity renderer's model (docs/plan/10-frontend.md section 8.4): the text and its
// UTF-16 entity ranges become a tree of nodes; auto links and emoji are split out of the
// text leaves. JavaScript strings are UTF-16, so offsets index them directly.
import emojiRegex from 'emoji-regex'
import { findAutoLinks } from './autolink'
import type { Entity, EntityType } from './model'
import type { EmojiCount, EmojiRule } from './skins/tokens'

export type AutoLinkKind = 'url' | 'email' | 'mention' | 'hashtag' | 'cashtag'

export type SegmentNode =
  | { kind: 'text'; text: string }
  | { kind: 'emoji'; text: string }
  | { kind: 'autolink'; text: string; link: AutoLinkKind; href: string }
  | { kind: 'entity'; entity: Entity; children: SegmentNode[] }

/** Nesting from the outside in; Telegram allows nothing inside pre, code and a formatted date. */
const priority: readonly EntityType[] = [
  'blockquote',
  'pre',
  'text_link',
  'spoiler',
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'custom_emoji',
  'formatted_date',
]

const known = new Set<string>(priority)

function isHigh(c: number): boolean {
  return c >= 0xd800 && c < 0xdc00
}

/** Valid entities inside the text whose ends do not split a surrogate pair. */
function sanitize(text: string, entities: readonly Entity[]): Entity[] {
  const out: Entity[] = []
  for (const e of entities) {
    if (!known.has(e.type) || e.length <= 0) continue
    let start = Math.max(0, Math.min(e.offset, text.length))
    let end = Math.max(0, Math.min(e.offset + e.length, text.length))
    if (start > 0 && isHigh(text.charCodeAt(start - 1))) start += 1
    if (end > 0 && end < text.length && isHigh(text.charCodeAt(end - 1))) end += 1
    if (end > start) out.push({ ...e, offset: start, length: end - start })
  }
  return out
}

/** The entities that hold nothing else: what lies inside them is left out. */
const closing = (e: Entity) => e.type === 'pre' || e.type === 'code' || e.type === 'formatted_date'

/** Orders entities active over the same interval from the outside in. */
function compare(a: Entity, b: Entity): number {
  return priority.indexOf(a.type) - priority.indexOf(b.type) || b.length - a.length || a.offset - b.offset
}

/**
 * Builds the node tree of a text: every interval between entity boundaries is put under
 * the entities that cover it, reusing the open nodes of the previous interval where the
 * same entities go on, so overlapping ranges nest like HTML. Entities inside pre, code or
 * a formatted date are left out. Text outside pre, code, links and formatted dates gets
 * auto links; emoji come last.
 */
export function buildSegments(text: string, entities: readonly Entity[]): SegmentNode[] {
  const ents = sanitize(text, entities)
  const points = [...new Set([0, text.length, ...ents.flatMap((e) => [e.offset, e.offset + e.length])])].sort(
    (a, b) => a - b,
  )
  const root: SegmentNode[] = []
  let stack: { entity: Entity; node: Extract<SegmentNode, { kind: 'entity' }> }[] = []
  for (let i = 0; i + 1 < points.length; i++) {
    const from = points[i] ?? 0
    const to = points[i + 1] ?? 0
    if (to <= from) continue
    let active = ents.filter((e) => e.offset <= from && e.offset + e.length >= to).sort(compare)
    const closed = active.findIndex(closing)
    if (closed >= 0) active = active.slice(0, closed + 1)
    let keep = 0
    while (keep < stack.length && keep < active.length && stack[keep]?.entity === active[keep]) keep++
    stack = stack.slice(0, keep)
    for (const entity of active.slice(keep)) {
      const node: Extract<SegmentNode, { kind: 'entity' }> = { kind: 'entity', entity, children: [] }
      ;(stack.at(-1)?.node.children ?? root).push(node)
      stack.push({ entity, node })
    }
    const plain = !active.some((e) => closing(e) || e.type === 'text_link')
    const leaves = plain ? linkify(text.slice(from, to)) : [{ kind: 'text', text: text.slice(from, to) } as const]
    ;(stack.at(-1)?.node.children ?? root).push(...leaves.flatMap(splitEmoji))
  }
  trimBlockBreaks(root)
  return root
}

/** Code blocks and quotes are blocks of their own: like the apps, drop the one line
 * break that separates them from the text before and after. */
function trimBlockBreaks(nodes: SegmentNode[]): void {
  const isBlock = (n: SegmentNode | undefined) =>
    n?.kind === 'entity' && (n.entity.type === 'pre' || n.entity.type === 'blockquote')
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (!node) continue
    if (node.kind === 'entity') {
      trimBlockBreaks(node.children)
      continue
    }
    if (node.kind !== 'text') continue
    let text = node.text
    if (isBlock(nodes[i - 1]) && text.startsWith('\n')) text = text.slice(1)
    if (isBlock(nodes[i + 1]) && text.endsWith('\n')) text = text.slice(0, -1)
    nodes[i] = { kind: 'text', text }
  }
}

/** Splits a text leaf into text and auto links. */
function linkify(text: string): SegmentNode[] {
  const links = findAutoLinks(text)
  if (links.length === 0) return [{ kind: 'text', text }]
  const out: SegmentNode[] = []
  let pos = 0
  for (const l of links) {
    if (l.start > pos) out.push({ kind: 'text', text: text.slice(pos, l.start) })
    out.push({ kind: 'autolink', text: text.slice(l.start, l.end), link: l.kind, href: l.href })
    pos = l.end
  }
  if (pos < text.length) out.push({ kind: 'text', text: text.slice(pos) })
  return out
}

const emoji = emojiRegex()

/**
 * The emoji of a text of emoji only (no formatting or links): how many, on how many lines, and
 * the most on one line; undefined for any other text. The apps draw such a message big, without
 * a bubble (29 section 8.4, SkinTokens.bigEmoji), each by its rule of what else the text may
 * hold (TGP-02): 'loose', white space anywhere, empty lines not counted; 'spaces', only spaces,
 * tabs, line breaks and U+FE0F, empty lines not counted (Android, RVW-29c); 'lines', only line
 * breaks, and empty lines count; 'strict', nothing else at all.
 */
export function emojiOnly(nodes: readonly SegmentNode[], rule: EmojiRule = 'loose'): EmojiCount | undefined {
  let line = 0
  const perLine: number[] = [0]
  for (const node of nodes) {
    if (node.kind === 'emoji') {
      perLine[line] = (perLine[line] ?? 0) + 1
      continue
    }
    if (node.kind !== 'text') return undefined
    const breaks = node.text.split('\n').length - 1
    let rest = node.text.replace(/\n/g, '')
    if (rule === 'loose') rest = node.text.trim()
    else if (rule === 'spaces') rest = node.text.replace(/[ \t\n]|️/g, '')
    if (rest !== '' || (rule === 'strict' && breaks > 0)) return undefined
    line += breaks
    while (perLine.length <= line) perLine.push(0)
  }
  const counts = rule === 'lines' ? perLine : perLine.filter((n) => n > 0)
  const count = counts.reduce((sum, n) => sum + n, 0)
  return count === 0 ? undefined : { count, lines: counts.length, perLine: Math.max(...counts) }
}

/** A text without formatting or auto links, with its emoji split out: the label of an inline button. */
export function plainSegments(text: string): SegmentNode[] {
  return splitEmoji({ kind: 'text', text })
}

/** Splits emoji out of text leaves (and of auto links, which keep them as text). */
function splitEmoji(node: SegmentNode): SegmentNode[] {
  if (node.kind !== 'text') return [node]
  const out: SegmentNode[] = []
  let pos = 0
  for (const m of node.text.matchAll(emoji)) {
    const at = m.index
    if (at > pos) out.push({ kind: 'text', text: node.text.slice(pos, at) })
    out.push({ kind: 'emoji', text: m[0] })
    pos = at + m[0].length
  }
  if (out.length === 0) return [node]
  if (pos < node.text.length) out.push({ kind: 'text', text: node.text.slice(pos) })
  return out
}
