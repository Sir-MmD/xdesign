// What a question's form knows of each kind of answer (docs/plan/04 section 6, 03 section 2.8):
// its name in "Expects", the checks it has, and the type of the variable it is saved in.
import type { AnswerChecks, Expects, VariableType } from '@xdesign/spec'

/** "Expects", in the plan's order. */
export const EXPECTS_ITEMS: readonly { value: Expects; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone number' },
  { value: 'location', label: 'Location' },
  { value: 'photo', label: 'Photo' },
  { value: 'video', label: 'Video' },
  { value: 'file', label: 'File' },
  { value: 'voice', label: 'Voice' },
  { value: 'audio', label: 'Audio' },
  { value: 'any', label: 'Anything' },
]

/** The type of the variable an answer is saved in. */
export const ANSWER_TYPES: Record<Expects, VariableType> = {
  text: 'text',
  number: 'number',
  email: 'text',
  phone: 'phone',
  location: 'location',
  photo: 'file',
  video: 'file',
  file: 'file',
  voice: 'file',
  audio: 'file',
  any: 'text',
}

/** The checks of each kind of answer (`pattern` has no field; a text keeps an imported one). */
export const CHECKS_OF: Record<Expects, readonly (keyof AnswerChecks)[]> = {
  text: ['minLength', 'maxLength', 'pattern'],
  any: ['minLength', 'maxLength'],
  number: ['min', 'max', 'wholeNumber'],
  email: [],
  phone: [],
  location: [],
  photo: ['maxFileMb'],
  video: ['maxFileMb'],
  voice: ['maxFileMb'],
  audio: ['maxFileMb'],
  file: ['maxFileMb', 'fileTypes'],
}

/** The checks a question keeps for a kind of answer: those the kind has. */
export function checksFor(checks: AnswerChecks, expects: Expects): AnswerChecks {
  const kept: AnswerChecks = {}
  for (const key of CHECKS_OF[expects]) {
    if (checks[key] !== undefined) Object.assign(kept, { [key]: checks[key] })
  }
  return kept
}
