// What a thread is on (CMT-01's anchors, docs/plan/05 section 6): made from what the person clicked
// (a box, a button's pill or the empty map in comment mode, the phone's bubble or a button), and
// said in words for the panel, "on a deleted step" with the title kept when the thread started;
// the phone's elements of an anchor, for its pins.
import type { CommentAnchor } from '@xdesign/api'
import type { Design, MessageStep, QuestionStep, Step } from '@xdesign/spec'

import { languageName } from '@/lib/languages'

import { buttonText } from '../map/arrows'

// The server keeps a title or a label of up to 200 characters.
const cut = (text: string) => text.slice(0, 200)

/** A step's name as the panels say it: its title, else its ID name. */
export function stepName(step: Step): string {
  return step.title.trim() || step.idName
}

/** A thread on a step, or on one of its buttons. */
export function stepAnchor(
  design: Design,
  stepId: string,
  buttonId: string | null,
  lang: string,
): CommentAnchor | null {
  const step = design.steps[stepId]
  if (!step) return null
  const title = cut(stepName(step))
  const button = buttonId === null ? undefined : design.buttons[buttonId]
  if (!button) return { on: 'step', stepId, title }
  return {
    on: 'button',
    stepId,
    buttonId: button.id,
    title,
    label: cut(buttonText(button, design, lang) || button.idName),
  }
}

/** A thread on a step's text in a language (the phone's bubble). */
export function textAnchor(design: Design, stepId: string, lang: string): CommentAnchor | null {
  const step = design.steps[stepId]
  return step ? { on: 'text', stepId, lang, title: cut(stepName(step)) } : null
}

/** Where a thread is, in words, and whether its step or button was deleted since. */
export function anchorWords(design: Design, anchor: CommentAnchor, lang: string): { words: string; gone: boolean } {
  if (anchor.on === 'map') return { words: 'On the map', gone: false }
  const step = design.steps[anchor.stepId]
  if (!step) return { words: `On a deleted step: ${anchor.title}`, gone: true }
  const name = stepName(step)
  if (anchor.on === 'text') return { words: `${name}, the text in ${languageName(anchor.lang)}`, gone: false }
  if (anchor.on === 'step') return { words: name, gone: false }
  const button = design.buttons[anchor.buttonId]
  if (!button) return { words: `${name} › on a deleted button: ${anchor.label}`, gone: true }
  return { words: `${name} › ${buttonText(button, design, lang) || button.idName}`, gone: false }
}

// The preview's classes of a keyboard's rows and buttons by place (packages/preview's Keyboard and Chat).
const PLACES = {
  inline: { row: 'tg-kb-row', button: 'tg-kb-button' },
  reply: { row: 'tg-rk-row', button: 'tg-rk-button' },
} as const

type Place = keyof typeof PLACES

/**
 * The buttons' IDs as the preview draws a step's keyboard, row by row: row parts placed, only the
 * keyboard's place (as adapt.ts's placedRows).
 */
function placedIds(design: Design, step: MessageStep | QuestionStep, place: Place): string[][] {
  const keyboard = step.kind === 'message' ? step.keyboard : step.prompt.keyboard
  if (keyboard?.type !== place) return []
  const out: string[][] = []
  for (const row of keyboard.rows) {
    const part = row.type === 'part' ? design.parts[row.part] : undefined
    const idRows = row.type === 'buttons' ? [row.ids] : part?.kind === 'rows' && part.place === place ? part.rows : []
    for (const ids of idRows) out.push(ids.filter((id) => design.buttons[id]?.place === place))
  }
  return out
}

// The index of an element among its siblings with a class.
function indexAmong(element: Element, name: string): number {
  return Array.from(element.parentElement?.children ?? [])
    .filter((child) => child.classList.contains(name))
    .indexOf(element)
}

/**
 * What a click on the phone is on, in comment mode (the phone then draws the preview's read-only
 * keyboard): a button, by its row and place, or the bubble (the step's text in the language shown).
 */
export function phoneAnchorAt(target: Element, design: Design, step: MessageStep | QuestionStep, lang: string) {
  for (const place of ['inline', 'reply'] as const) {
    const button = target.closest(`.${PLACES[place].button}`)
    const row = button?.parentElement
    if (!button || !row) continue
    const id = placedIds(design, step, place)[indexAmong(row, PLACES[place].row)]?.[
      indexAmong(button, PLACES[place].button)
    ]
    return id === undefined ? null : stepAnchor(design, step.id, id, lang)
  }
  return target.closest('.tg-bubble-wrap, .tg-bubble') ? textAnchor(design, step.id, lang) : null
}

// A button's element in the phone: the editable keyboard marks it with data-button, the preview's
// by its row and place.
export function buttonElement(
  root: ShadowRoot,
  design: Design,
  step: MessageStep | QuestionStep,
  id: string,
): Element | null {
  const marked = root.querySelector(`[data-button="${CSS.escape(id)}"]`)
  if (marked) return marked
  for (const place of ['inline', 'reply'] as const) {
    const rows = placedIds(design, step, place)
    const line = rows.findIndex((ids) => ids.includes(id))
    if (line < 0) continue
    const row = root.querySelectorAll(`.${PLACES[place].row}`)[line]
    return row?.querySelectorAll(`:scope > .${PLACES[place].button}`)[rows[line]?.indexOf(id) ?? -1] ?? null
  }
  return null
}
