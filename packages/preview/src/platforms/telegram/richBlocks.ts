// A Telegram rich message as the preview draws it (docs/plan/28-owner-list-2026-10-20.md
// sections 14.5 and 14.7, RCH-04b): each block's own text is a range of the message's text
// (UTF-16 offsets, which JavaScript strings index directly), drawn with the formatting inside
// that range; the text between the ranges (the empty lines, "• ", "1. " and " | ") belongs
// to the message's normal form only.
import { paragraphDirection } from './bidi'
import { buildSegments, type SegmentNode } from './entities'
import type { Entity, PreviewRich, RichBlock } from './model'

/** The entities over a range of the text, cut to it and moved to start where it starts. */
function entitiesIn(entities: readonly Entity[], start: number, end: number): Entity[] {
  const out: Entity[] = []
  for (const e of entities) {
    const from = Math.max(e.offset, start)
    const to = Math.min(e.offset + e.length, end)
    if (to > from) out.push({ ...e, offset: from - start, length: to - from })
  }
  return out
}

/** The node tree of a block's own text with its formatting (a quote's blockquote and a pre block's pre among it). */
export function blockSegments(
  rich: Pick<PreviewRich, 'text' | 'entities'>,
  block: Pick<RichBlock, 'start' | 'end'>,
): SegmentNode[] {
  const start = Math.max(0, Math.min(block.start, rich.text.length))
  const end = Math.max(start, Math.min(block.end, rich.text.length))
  return buildSegments(rich.text.slice(start, end), entitiesIn(rich.entities, start, end))
}

/** Whether a block has text of its own: a picture's caption, for example. */
export function hasOwnText(block: Pick<RichBlock, 'start' | 'end'>): boolean {
  return block.end > block.start
}

/** Calls f for every block and every block inside one, in order. */
function walk(blocks: readonly RichBlock[], f: (block: RichBlock) => void): void {
  for (const block of blocks) {
    f(block)
    if (block.blocks) walk(block.blocks, f)
  }
}

/**
 * The positions, from 1, of the post's media that the blocks place between paragraphs: the
 * others go first in the message, where a normal post shows its media (RCH-02's sender).
 */
export function placedMedia(blocks: readonly RichBlock[]): ReadonlySet<number> {
  const placed = new Set<number>()
  walk(blocks, (block) => {
    if (block.kind === 'media' && block.media !== undefined) placed.add(block.media)
  })
  return placed
}

/**
 * Whether a rich message takes the bubble's whole width: one with a table, a picture, a map
 * or a row of buttons, or media of its own. Others are as wide as their text, like a normal message.
 */
export function wideRich(blocks: readonly RichBlock[], mediaCount: number): boolean {
  let wide = mediaCount > 0
  walk(blocks, (block) => {
    if (block.kind === 'table' || block.kind === 'media' || block.kind === 'map' || block.kind === 'buttons')
      wide = true
  })
  return wide
}

/**
 * A rich doc that carries no direction of its own (a rich source post, source_posts.rich) as
 * the preview draws it: right to left when its first strong letter is, as the sender shows a
 * post of a language the panel does not know (format.RTLText).
 */
export function richOfDoc(doc: Omit<PreviewRich, 'rtl'>): PreviewRich {
  return { ...doc, rtl: paragraphDirection(doc.text) === 'rtl' }
}
