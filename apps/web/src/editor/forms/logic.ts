// The logic steps the phone pane shows as forms (docs/plan/04 section 6): every kind but start
// points (START-01's forms), messages and questions (the phone; a question's form sits under its
// prompt, QuestionForm.tsx). Shared lists of the forms: the steps an arrow can go to and the
// variables by where their value comes from.
import type {
  ActionStep,
  DevStep,
  EndStep,
  FrameStep,
  GoToStep,
  IfStep,
  NoteStep,
  RememberStep,
  Step,
  Variable,
  VariableSource,
  WaitStep,
} from '@xdesign/spec'

/** A step whose form fills the phone pane (stage 2: an action, PAY-02). */
export type LogicStep =
  IfStep | RememberStep | WaitStep | DevStep | GoToStep | EndStep | NoteStep | FrameStep | ActionStep

export function isLogicStep(step: Step): step is LogicStep {
  return step.kind !== 'start' && step.kind !== 'message' && step.kind !== 'question' && step.kind !== 'invoice'
}

/** The palette's name of each logic kind (04 section 4.2), the form's heading. */
export const LOGIC_NAMES: Record<LogicStep['kind'], string> = {
  if: 'If',
  remember: 'Remember',
  wait: 'Wait',
  devStep: 'Developer step',
  goTo: 'Go to',
  end: 'End',
  note: 'Note',
  frame: 'Section',
  action: 'Action',
}

/** A choice of a select: its value and the words the closed select shows. */
export type Item = { value: string; label: string }

// Steps an arrow cannot go into: start points, notes and sections (MAP-01's takesArrows).
const notTargets = new Set<Step['kind']>(['start', 'note', 'frame'])

/** The steps an arrow of `from` can point at, by title: every step that takes arrows but itself. */
export function targetSteps(steps: Readonly<Record<string, Step>>, from: Step): Step[] {
  return Object.values(steps)
    .filter((step) => step.id !== from.id && !notTargets.has(step.kind))
    .sort((a, b) => (a.title || a.idName).localeCompare(b.title || b.idName))
}

/** The groups of variables in lists, as TXT-01's "{ } Insert" names them. */
export const VARIABLE_GROUPS: readonly { label: string; sources: readonly VariableSource[] }[] = [
  { label: 'Saved answers', sources: ['question', 'button'] },
  { label: 'Remembered values', sources: ['remember', 'startLink'] },
  { label: 'Developer outputs', sources: ['devStep'] },
  { label: 'Built-ins', sources: ['builtin'] },
]

/** Variables in their groups, by ID name; empty groups are left out. */
export function groupVariables(variables: readonly Variable[]): { label: string; items: Variable[] }[] {
  const sorted = [...variables].sort((a, b) => a.idName.localeCompare(b.idName))
  return VARIABLE_GROUPS.map((group) => ({
    label: group.label,
    items: sorted.filter((variable) => group.sources.includes(variable.source)),
  })).filter((group) => group.items.length > 0)
}
