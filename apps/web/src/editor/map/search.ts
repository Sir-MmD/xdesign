// Search on the map (docs/plan/04 section 4.3): steps by their title, ID name, note and own
// words, buttons by their text, and the texts of messages and questions, in every language of
// the design. Matches come in map order (left to right, then top to bottom), a step's buttons
// after the step.
import { type Design, plainText, type RichTextRef, type Step, type StepId } from '@xdesign/spec'

import { shownRowsOf } from './arrows'

/** A match: a step, or a button of it. */
export type Found = { step: StepId; button: string | null }

// The rich texts of a step: a message's text or captions, a question's prompt and wrong answer.
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

// A step's own words beyond its title and texts.
function ownWords(step: Step): (string | undefined)[] {
  switch (step.kind) {
    case 'start':
      if (step.trigger.type === 'command')
        return [`/${step.trigger.command}`, ...Object.values(step.trigger.menuDescription)]
      return step.trigger.type === 'startLink' ? [step.trigger.payload] : []
    case 'question':
      return Object.values(step.cancel?.words ?? {})
    case 'if':
      return step.cases.map((item) => item.label)
    case 'devStep':
      return [step.description, ...step.outcomes.map((outcome) => outcome.label)]
    case 'note':
      return [step.text]
    default:
      return []
  }
}

/** Every match of the words in the design (no case), in map order. */
export function findInDesign(design: Design, query: string): Found[] {
  const words = query.trim().toLocaleLowerCase()
  if (words === '') return []
  const has = (text: string | undefined) => text?.toLocaleLowerCase().includes(words) === true
  const varName = (id: string) => design.variables[id]?.idName ?? id
  const partText = (lang: string) => (id: string) => {
    const part = design.parts[id]
    const doc = part?.kind === 'text' ? part.text.doc[lang] : undefined
    return doc ? plainText(doc, varName) : ''
  }
  const found: Found[] = []
  const steps = Object.values(design.steps).sort((a, b) => a.x - b.x || a.y - b.y)
  for (const step of steps) {
    const texts = richTexts(step).flatMap((text) =>
      Object.entries(text.doc).map(([lang, doc]) => (doc ? plainText(doc, varName, partText(lang)) : '')),
    )
    if ([step.title, step.idName, step.note, ...ownWords(step), ...texts].some(has)) {
      found.push({ step: step.id, button: null })
    }
    if (step.kind !== 'message' && step.kind !== 'question') continue
    const seen = new Set<string>()
    for (const button of shownRowsOf(design, step).flat()) {
      if (seen.has(button.id)) continue
      seen.add(button.id)
      if ([button.idName, ...Object.values(button.label)].some(has)) found.push({ step: step.id, button: button.id })
    }
  }
  return found
}
