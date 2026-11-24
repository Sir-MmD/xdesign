// The arrows of the map (D-08): never stored on their own, read from their sources each time the
// design changes: button targets (a keyboard's and a rich message's buttons inside), `next`, a
// draft's "If the user stops it", the cases and `otherwise` of an If box, the outcomes of a
// developer step, a question's "Valid answer", "Wrong N times" and "Cancel", and a Go to box's
// target. Each source is a dot (a React Flow handle) on its box, named here; drawing an arrow
// or deleting it sets that source through the accessors.
import {
  type Button,
  type Design,
  type DesignEdits,
  draftStops,
  type InvoiceStep,
  type MessageStep,
  type QuestionStep,
  type Step,
  type StepId,
  type Target,
  telegram,
} from '@xdesign/spec'

/** The dot a box takes arrows on (every box but start points, notes and sections). */
export const IN = 'in'

/** The handle IDs of the dots of cases, outcomes and buttons; a step's own arrows use their field. */
export const handles = {
  case: (id: string) => `case:${id}`,
  outcome: (id: string) => `outcome:${id}`,
  button: (id: string) => `button:${id}`,
}

/** A step that sends a message, with buttons: a message, a question with its prompt, an invoice (PAY-02). */
export type SendingStep = MessageStep | QuestionStep | InvoiceStep

/** Whether a step sends a message with buttons. */
export function isSending(step: Step | undefined): step is SendingStep {
  return step?.kind === 'message' || step?.kind === 'question' || step?.kind === 'invoice'
}

/** An arrow's ID (its edge's): the box and the dot it leaves from. */
export function arrowId(step: StepId, handle: string): string {
  return `${step}|${handle}`
}

/** An arrow of the map: from a dot of a box to another box. */
export type Arrow = {
  /** The edge's ID: the box and the dot. */
  id: string
  from: Step
  handle: string
  to: StepId
  /** What it leaves from, in words: a button's text, an outcome's name, "Then". */
  label: string
  button?: Button
  /** A button's row in its box (`shownRowsOf`), whose short tags sit together beside it (lines.ts). */
  row?: number
}

/** What the arrows are read from. */
export type ArrowSources = Pick<Design, 'steps' | 'buttons' | 'parts' | 'languages'>

/** A labeled dot of a box, its buttons aside: its handle, its words and where it goes. */
export type Exit = { handle: string; label: string; to: Target | undefined }

/** Whether arrows can go into a box: start points, notes and sections take none. */
export function takesArrows(step: Step): boolean {
  return step.kind !== 'start' && step.kind !== 'note' && step.kind !== 'frame'
}

/** The rows of a message's keyboard (a question's prompt keyboard), row parts placed. */
export function rowsOf(design: Pick<Design, 'buttons' | 'parts'>, step: SendingStep): Button[][] {
  const keyboard = step.kind === 'question' ? step.prompt.keyboard : step.keyboard
  if (keyboard?.type !== 'inline' && keyboard?.type !== 'reply') return []
  const rows: Button[][] = []
  const add = (ids: readonly string[]) => {
    const row = ids.flatMap((id) => design.buttons[id] ?? [])
    if (row.length > 0) rows.push(row)
  }
  for (const row of keyboard.rows) {
    if (row.type === 'buttons') add(row.ids)
    else {
      const part = design.parts[row.part]
      if (part?.kind === 'rows') part.rows.forEach(add)
    }
  }
  return rows
}

/** The button rows inside a step's rich message (its `buttons` blocks), in block order (RICH-02). */
export function richRowsOf(design: Pick<Design, 'buttons'>, step: SendingStep): Button[][] {
  const content = step.kind === 'message' ? step.content : step.kind === 'question' ? step.prompt.content : undefined
  if (content?.type !== 'rich') return []
  return content.blocks
    .flatMap((block) => (block.type === 'buttons' ? [block.ids.flatMap((id) => design.buttons[id] ?? [])] : []))
    .filter((row) => row.length > 0)
}

/** Every row of buttons a step shows: those inside its rich message, then its keyboard's. */
export function shownRowsOf(design: Pick<Design, 'buttons' | 'parts'>, step: SendingStep): Button[][] {
  return [...richRowsOf(design, step), ...rowsOf(design, step)]
}

/** Whether a button has a dot: inline buttons that go to a step, and every bottom button. */
export function canGo(button: Button): boolean {
  return button.place === 'reply' || button.action.type === 'goTo'
}

/** Where a button goes; `stay` and the actions without a target (links, copy texts) give none. */
export function buttonTarget(button: Button): Target | undefined {
  if (button.place === 'reply') return button.action.goTo
  return button.action.type === 'goTo' && button.action.target !== 'stay' ? button.action.target : undefined
}

/** A button's text in the language shown, else in the default language. */
export function buttonText(button: Button, design: Pick<Design, 'languages'>, lang: string): string {
  return button.label[lang]?.trim() || button.label[design.languages.default]?.trim() || ''
}

/**
 * A step's labeled dots, its buttons aside: "Then", a draft's "If the user stops it", a
 * question's "Valid answer", "Wrong N times" ("Wrong answer" until it has a number of tries) and
 * "Cancel", an If box's cases and "Otherwise", a developer step's outcomes, a Go to box's target,
 * an invoice's "Paid".
 */
export function exitsOf(step: Step): Exit[] {
  switch (step.kind) {
    case 'message':
      return [
        { handle: 'next', label: 'Then', to: step.next },
        ...(draftStops(step)
          ? [{ handle: 'onStop', label: telegram.draftStopLabel('stopped_message_generation'), to: step.onStop }]
          : []),
      ]
    case 'start':
    case 'remember':
    case 'wait':
    case 'action':
      return [{ handle: 'next', label: 'Then', to: step.next }]
    case 'invoice':
      return [{ handle: 'next', label: 'Paid', to: step.next }]
    case 'question': {
      const { maxTries } = step.wrongAnswer
      return [
        { handle: 'next', label: 'Valid answer', to: step.next },
        {
          handle: 'afterMaxTries',
          label: maxTries === undefined ? 'Wrong answer' : `Wrong ${String(maxTries)} times`,
          to: step.wrongAnswer.afterMaxTries,
        },
        { handle: 'cancel', label: 'Cancel', to: step.cancel?.goTo },
      ]
    }
    case 'if':
      return [
        ...step.cases.map((item, index) => ({
          handle: handles.case(item.id),
          label: item.label.trim() || `Case ${String(index + 1)}`,
          to: item.goTo,
        })),
        { handle: 'otherwise', label: 'Otherwise', to: step.otherwise },
      ]
    case 'devStep':
      return step.outcomes.map((outcome, index) => ({
        handle: handles.outcome(outcome.id),
        label: outcome.label.trim() || `Outcome ${String(index + 1)}`,
        to: outcome.goTo,
      }))
    case 'goTo':
      return [{ handle: 'target', label: 'Go to', to: step.target }]
    case 'end':
    case 'note':
    case 'frame':
      return []
  }
}

/**
 * Every arrow of the design into a box: each shown button once per box that shows it (a row
 * part's buttons in every message that uses the part, a rich message's buttons inside), then the
 * step's own dots. Arrows back (`back`) and into steps the design does not have, or that take
 * none, are not drawn.
 */
export function deriveArrows(design: ArrowSources, lang: string): Arrow[] {
  const arrows: Arrow[] = []
  const add = (from: Step, handle: string, to: Target | undefined, label: string, button?: Button, row?: number) => {
    if (to === undefined || to === 'back') return
    const target = design.steps[to]
    if (!target || !takesArrows(target)) return
    arrows.push({ id: arrowId(from.id, handle), from, handle, to, label, button, row })
  }
  for (const step of Object.values(design.steps)) {
    if (isSending(step)) {
      const seen = new Set<string>()
      shownRowsOf(design, step).forEach((buttons, row) => {
        for (const button of buttons) {
          if (seen.has(button.id)) continue
          seen.add(button.id)
          add(step, handles.button(button.id), buttonTarget(button), buttonText(button, design, lang), button, row)
        }
      })
    }
    for (const exit of exitsOf(step)) add(step, exit.handle, exit.to, exit.label)
  }
  return arrows
}

// The dots of a step's own arrow fields.
const STEP_ARROWS = ['next', 'otherwise', 'target', 'afterMaxTries', 'cancel', 'onStop'] as const
type StepArrow = (typeof STEP_ARROWS)[number]

function isStepArrow(handle: string): handle is StepArrow {
  return (STEP_ARROWS as readonly string[]).includes(handle)
}

/** Points the arrow of a box's dot at a step, or clears it (`undefined`). */
export function setArrow(edits: DesignEdits, step: StepId, handle: string, target: StepId | undefined): boolean {
  if (isStepArrow(handle)) return edits.steps.connect({ step, arrow: handle }, target)
  const colon = handle.indexOf(':')
  const id = handle.slice(colon + 1)
  switch (handle.slice(0, colon)) {
    case 'button':
      return edits.buttons.setTarget(id, target)
    case 'case':
      return edits.steps.connect({ step, case: id }, target)
    case 'outcome':
      return edits.steps.connect({ step, outcome: id }, target)
    default:
      return false
  }
}
