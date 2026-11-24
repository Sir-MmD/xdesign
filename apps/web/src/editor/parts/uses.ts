// Where each part is used (docs/plan/04 section 12, "Uses"): the steps whose keyboard places a row
// part or whose texts place a text part, in map order (left to right, then top to bottom), then
// the text parts whose text places it. Read from the plain design each time it changes.
import { type Design, type Part, RICH_NODES, type RichDoc, type RichTextRef, type Step } from '@xdesign/spec'

import { keyboardOf } from '../phone/keyboard/model'

/** A place that uses a part: a step, or another text part's text. */
export type PartUse = { kind: 'step'; step: Step } | { kind: 'part'; part: Part }

// The rich texts of a step: a message's text or captions, a question's prompt and wrong answer message.
function richTexts(step: Step): RichTextRef[] {
  const content = step.kind === 'message' ? step.content : step.kind === 'question' ? step.prompt.content : undefined
  const texts: RichTextRef[] = []
  if (content?.type === 'text') texts.push(content.text)
  else if (content?.type === 'album') {
    for (const item of content.items) if (item.caption) texts.push(item.caption)
  } else if (content && 'caption' in content && content.caption) texts.push(content.caption)
  if (step.kind === 'question') texts.push(step.wrongAnswer.message)
  return texts
}

// Adds the text parts a text places, in any language.
function placedParts(text: RichTextRef, into: Set<string>): void {
  const visit = (doc: RichDoc) => {
    for (const block of doc.content) {
      const paragraphs =
        block.type === RICH_NODES.blockquote ? block.content : block.type === RICH_NODES.paragraph ? [block] : []
      for (const paragraph of paragraphs) {
        for (const node of paragraph.content ?? []) if (node.type === RICH_NODES.part) into.add(node.attrs.part)
      }
    }
  }
  for (const doc of Object.values(text.doc)) if (doc) visit(doc)
}

/** Every part's uses by part ID; a part nothing uses has no entry. */
export function partUses(design: Design): Map<string, PartUse[]> {
  const uses = new Map<string, PartUse[]>()
  const add = (ids: Set<string>, use: PartUse) => {
    for (const id of ids) {
      const list = uses.get(id)
      if (list) list.push(use)
      else uses.set(id, [use])
    }
  }
  const steps = Object.values(design.steps).sort((a, b) => a.x - b.x || a.y - b.y)
  for (const step of steps) {
    const ids = new Set<string>()
    if (step.kind === 'message' || step.kind === 'question') {
      const keyboard = keyboardOf(step)
      if (keyboard?.type === 'inline' || keyboard?.type === 'reply') {
        for (const row of keyboard.rows) if (row.type === 'part') ids.add(row.part)
      }
    }
    for (const text of richTexts(step)) placedParts(text, ids)
    add(ids, { kind: 'step', step })
  }
  for (const part of Object.values(design.parts)) {
    if (part.kind !== 'text') continue
    const ids = new Set<string>()
    placedParts(part.text, ids)
    // A part placed inside itself writes nothing (03, As built).
    ids.delete(part.id)
    add(ids, { kind: 'part', part })
  }
  return uses
}

/** "3 uses", "1 use", "No uses". */
export function usesWords(count: number): string {
  if (count === 0) return 'No uses'
  return count === 1 ? '1 use' : `${String(count)} uses`
}

/** A part's kind in the palette's words: "Buttons" or "Text". */
export function kindWords(part: Part): string {
  return part.kind === 'rows' ? 'Buttons' : 'Text'
}
