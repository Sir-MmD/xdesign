// What the checks report (docs/plan/03-design-model.md section 8): each rule's code and level,
// the issue with where it is, and the key "Ignore here" stores in the design's `ignoredChecks`.
import type { ButtonId, Lang, StepId } from '../model/ids.ts'

export type IssueLevel = 'error' | 'warning' | 'info'

/**
 * Every rule by code, in the order of 03 section 8 (issues of one step follow it): stage 1's,
 * then stage 2's (section 6 of 08).
 */
export const CHECK_LEVELS = {
  E01: 'error',
  E02: 'error',
  E03: 'error',
  E04: 'error',
  E05: 'error',
  E06: 'error',
  E07: 'error',
  E08: 'error',
  E09: 'error',
  E10: 'error',
  E11: 'error',
  E12: 'error',
  E20: 'error',
  E21: 'error',
  E22: 'error',
  E23: 'error',
  E24: 'error',
  E25: 'error',
  E26: 'error',
  E27: 'error',
  E28: 'error',
  E29: 'error',
  E30: 'error',
  W01: 'warning',
  W02: 'warning',
  W03: 'warning',
  W04: 'warning',
  W05: 'warning',
  W06: 'warning',
  W07: 'warning',
  W08: 'warning',
  W09: 'warning',
  W10: 'warning',
  W11: 'warning',
  W20: 'warning',
  W21: 'warning',
  I01: 'info',
  I02: 'info',
  I03: 'info',
  I04: 'info',
  I20: 'info',
  I21: 'info',
} as const satisfies Record<string, IssueLevel>

export type IssueCode = keyof typeof CHECK_LEVELS

export type Issue = {
  code: IssueCode
  level: IssueLevel
  /** The step it is about; bot setup issues have none. */
  stepId?: StepId
  buttonId?: ButtonId
  language?: Lang
  /** In plain words, naming the step title and the button text. */
  message: string
  /** False for errors: Telegram cannot do what the design says. */
  ignorable: boolean
  /** Marked "Ignore here" (its key is in the design's `ignoredChecks`); it stays in the list. */
  ignored?: boolean
}

/** Where an issue is, for `check`'s rules. */
export type IssuePlace = Pick<Issue, 'stepId' | 'buttonId' | 'language'>

/**
 * The key "Ignore here" stores: `<code>:<stepId>[:<buttonId>][:<language>]`; an issue without a
 * step (the bot photo) has an empty step part.
 */
export function issueKey(issue: Pick<Issue, 'code' | 'stepId' | 'buttonId' | 'language'>): string {
  let key = `${issue.code}:${issue.stepId ?? ''}`
  if (issue.buttonId !== undefined) key += `:${issue.buttonId}`
  if (issue.language !== undefined) key += `:${issue.language}`
  return key
}
