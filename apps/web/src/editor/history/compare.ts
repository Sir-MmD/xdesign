// "Compare" (docs/plan/05 section 7 item 4): the steps added, removed and changed between a version
// and now, with their old and new texts, built from the two plain models. A version is an earlier
// state of the same document, so steps and buttons keep their IDs and are matched by them. A
// moved or resized box is not a change; anything else in a step besides its texts (an arrow, a
// setting, a file) shows as "Other changes".
import { type Design, type LangText, plainText, type RichTextRef, type Step, type StepId } from '@xdesign/spec'

import { shownRowsOf } from '../map/arrows'

/** One text that differs, in one language ('' for a text in no language: a title, a note). */
export interface TextChange {
  /** What it is: "Title", "Text", "Caption", "Button", ... */
  what: string
  lang: string
  /** The version's text ('' when it had none). */
  before: string
  /** Now's text ('' when it has none). */
  after: string
}

export interface StepChange {
  id: StepId
  change: 'added' | 'removed' | 'changed'
  /** The step's title, else its ID name (the version's for a removed step). */
  name: string
  /** A changed step's texts that differ; an added or removed step's texts in the language shown. */
  texts: TextChange[]
  /** Something besides its texts changed (a setting, an arrow, a file, a button's target). */
  other: boolean
}

export interface DesignChanges {
  /** In map order (left to right, then top to bottom). */
  steps: StepChange[]
  /** The other parts of the design that changed: "Bot setup", "Languages", "Variables", ... */
  also: string[]
}

// A step's texts by a key that stays the same between the two designs, each per language.
type Texts = Map<string, { what: string; byLang: LangText }>

const NONE: ReadonlySet<string> = new Set()
// What a step's other changes leave out: where its box is and its size (not a change of the
// design), and its texts (compared as texts): its own, and every rich text's documents.
const STEP_KEYS: ReadonlySet<string> = new Set([
  'x',
  'y',
  'width',
  'height',
  'idNameFixed',
  'title',
  'note',
  'text',
  'description',
])
const RICH_KEYS: ReadonlySet<string> = new Set(['doc'])
const BUTTON_KEYS: ReadonlySet<string> = new Set(['label'])

/** The changes from `before` (a version) to `after` (now); `lang` is the language shown. */
export function compareDesigns(before: Design, after: Design, lang: string): DesignChanges {
  const steps: { at: Step; change: StepChange }[] = []
  for (const step of Object.values(after.steps)) {
    const old = before.steps[step.id]
    if (!old) {
      steps.push({ at: step, change: whole(after, step, 'added', lang) })
      continue
    }
    const change = changed(before, old, after, step)
    if (change) steps.push({ at: step, change })
  }
  for (const step of Object.values(before.steps)) {
    if (!(step.id in after.steps)) steps.push({ at: step, change: whole(before, step, 'removed', lang) })
  }
  steps.sort((a, b) => a.at.x - b.at.x || a.at.y - b.at.y)

  const also: string[] = []
  if (!same(before.bot, after.bot)) also.push('Bot setup')
  if (!same(before.languages, after.languages)) also.push('Languages')
  if (!same(before.variables, after.variables)) also.push('Variables')
  if (!same(before.switches, after.switches)) also.push('Test switches')
  if (!same(before.parts, after.parts)) also.push('Parts')
  return { steps: steps.map((item) => item.change), also }
}

/** An added or removed step: its texts in the language shown (else the default one). */
function whole(design: Design, step: Step, change: 'added' | 'removed', lang: string): StepChange {
  const shown = design.languages.list.includes(lang) ? lang : design.languages.default
  const texts: TextChange[] = []
  for (const { what, byLang } of textsOf(design, step).values()) {
    const key = '' in byLang ? '' : shown
    const text = byLang[key] ?? ''
    if (text.trim() === '') continue
    texts.push(
      change === 'added' ? { what, lang: key, before: '', after: text } : { what, lang: key, before: text, after: '' },
    )
  }
  return { id: step.id, change, name: nameOf(step), texts, other: false }
}

/** A step in both designs: the texts that differ, in every language, or null when nothing did. */
function changed(before: Design, old: Step, after: Design, step: Step): StepChange | null {
  const oldTexts = textsOf(before, old)
  const newTexts = textsOf(after, step)
  const texts: TextChange[] = []
  for (const key of new Set([...oldTexts.keys(), ...newTexts.keys()])) {
    const was = oldTexts.get(key)
    const is = newTexts.get(key)
    const what = (is ?? was)?.what ?? ''
    const langs = new Set([...Object.keys(was?.byLang ?? {}), ...Object.keys(is?.byLang ?? {})])
    for (const lang of langs) {
      const beforeText = was?.byLang[lang] ?? ''
      const afterText = is?.byLang[lang] ?? ''
      if (beforeText !== afterText) texts.push({ what, lang, before: beforeText, after: afterText })
    }
  }
  const other = !sameExcept(old, step, STEP_KEYS, RICH_KEYS) || !sameButtons(before, old, after, step)
  if (texts.length === 0 && !other) return null
  return { id: step.id, change: 'changed', name: nameOf(step), texts, other }
}

// The buttons of the two steps are the same, up to their texts (compared as texts).
function sameButtons(before: Design, old: Step, after: Design, step: Step): boolean {
  const oldIds = buttonIds(before, old)
  const newIds = buttonIds(after, step)
  if (oldIds.join(' ') !== newIds.join(' ')) return false
  return newIds.every((id) => sameExcept(before.buttons[id], after.buttons[id], BUTTON_KEYS))
}

function buttonIds(design: Design, step: Step): string[] {
  if (step.kind !== 'message' && step.kind !== 'question') return []
  return shownRowsOf(design, step).flatMap((row) => row.map((button) => button.id))
}

function nameOf(step: Step): string {
  return step.title.trim() || step.idName
}

/** A step's texts: its title and note, its message's texts, a question's wrong answer, its buttons. */
function textsOf(design: Design, step: Step): Texts {
  const texts: Texts = new Map()
  const varName = (id: string) => design.variables[id]?.idName ?? id
  const partText = (lang: string) => (id: string) => {
    const part = design.parts[id]
    const doc = part?.kind === 'text' ? part.text.doc[lang] : undefined
    return doc ? plainText(doc, varName) : ''
  }
  const plain = (key: string, what: string, text: string | undefined) => {
    if (text !== undefined) texts.set(key, { what, byLang: { '': text } })
  }
  const rich = (key: string, what: string, ref: RichTextRef | undefined) => {
    if (!ref) return
    const byLang: LangText = {}
    for (const [lang, doc] of Object.entries(ref.doc)) {
      if (doc) byLang[lang] = plainText(doc, varName, partText(lang))
    }
    texts.set(key, { what, byLang })
  }

  plain('title', 'Title', step.title)
  plain('note', 'Note', step.note)
  if (step.kind === 'note') plain('text', 'Text', step.text)
  if (step.kind === 'devStep') plain('description', 'Description', step.description)
  if (step.kind === 'message' || step.kind === 'question') {
    const content = step.kind === 'message' ? step.content : step.prompt.content
    switch (content.type) {
      case 'text':
        rich('text', 'Text', content.text)
        break
      case 'album':
        content.items.forEach((item, index) => {
          rich(
            `caption:${String(index)}`,
            content.items.length > 1 ? `Caption ${String(index + 1)}` : 'Caption',
            item.caption,
          )
        })
        break
      case 'poll':
      case 'quiz':
        rich('question', 'Question', content.question)
        content.options.forEach((option, index) => {
          texts.set(`option:${String(index)}`, { what: `Option ${String(index + 1)}`, byLang: option })
        })
        if (content.type === 'quiz') rich('explanation', 'Explanation', content.explanation)
        break
      default:
        if ('caption' in content) rich('caption', 'Caption', content.caption)
    }
    if (step.kind === 'question') rich('wrongAnswer', 'Wrong answer', step.wrongAnswer.message)
    for (const id of buttonIds(design, step)) {
      const button = design.buttons[id]
      if (button) texts.set(`button:${id}`, { what: 'Button', byLang: button.label })
    }
  }
  return texts
}

// The same plain values, with a field set to undefined counted as missing; the fields in `deep`
// are left out at every depth.
function same(a: unknown, b: unknown, deep = NONE): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, index) => same(item, b[index], deep))
  }
  return sameExcept(a, b, deep, deep)
}

// The same objects but for their fields in `skip` (and the fields in `deep` at every depth).
function sameExcept(a: object | undefined, b: object | undefined, skip: ReadonlySet<string>, deep = NONE): boolean {
  if (a === undefined || b === undefined) return a === b
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    if (!skip.has(key) && !same(left[key], right[key], deep)) return false
  }
  return true
}
