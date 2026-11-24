// The message a step shows on the phone (docs/plan/04 section 5): a message step's own content,
// keyboard and options, or a question's prompt. Changes go through SPEC-04's steps.set, one
// change each: a message's fields, a question's whole prompt.
import type { Content, DesignEdits, MessageStep, Prompt, QuestionStep, StepId } from '@xdesign/spec'

import { useEditor } from '../context'
import type { LiveDesign } from '../live'

/** A step the phone edits. */
export type PhoneStep = MessageStep | QuestionStep

/** The content, keyboard and options the step sends. */
export function shownOf(step: PhoneStep): Prompt {
  return step.kind === 'message' ? step : step.prompt
}

/** Replaces the content or the options of the message the step sends. */
export function setShown(edits: DesignEdits, step: PhoneStep, fields: Partial<Pick<Prompt, 'content' | 'options'>>) {
  return step.kind === 'message'
    ? edits.steps.set(step.id, fields)
    : edits.steps.set(step.id, { prompt: { ...step.prompt, ...fields } })
}

/**
 * The step as the document has it now, for work that ends later (an upload): the step the
 * screen showed may have changed meanwhile. Undefined once it is gone or is no longer a message
 * or a question.
 */
export function latestStep(live: LiveDesign, id: StepId): PhoneStep | undefined {
  const step = live.getState().design?.steps[id]
  return step?.kind === 'message' || step?.kind === 'question' ? step : undefined
}

/**
 * Changes the content of the step's message as the document has it now (`change` returns
 * undefined to leave it), so a change that ends later (an upload) keeps what others did meanwhile.
 */
export function updateContent(
  edits: DesignEdits,
  live: LiveDesign,
  id: StepId,
  change: (content: Content) => Content | undefined,
): void {
  const step = latestStep(live, id)
  if (!step) return
  const content = change(shownOf(step).content)
  if (content) setShown(edits, step, { content })
}

/** updateContent for one step with the editor's accessors. */
export function useUpdateContent(id: StepId): (change: (content: Content) => Content | undefined) => void {
  const { edits, live } = useEditor()
  return (change) => {
    updateContent(edits, live, id, change)
  }
}
