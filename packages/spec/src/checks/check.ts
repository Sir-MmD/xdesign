// The checks (docs/plan/03-design-model.md section 8, D-19): a pure function of the plain design.
// The indexes are built once (context.ts), each rule group adds its issues, then the list is
// sorted by level and map order and the issues marked "Ignore here" are flagged.
import type { Design } from '../model/design.ts'
import type { VarId } from '../model/ids.ts'
import type { Step } from '../model/steps.ts'
import { checkBot } from './bot.ts'
import { checkContent } from './content.ts'
import { buildContext } from './context.ts'
import { checkEvents } from './events.ts'
import { checkFlow } from './flow.ts'
import { CHECK_LEVELS, issueKey, type Issue, type IssueCode, type IssueLevel } from './issues.ts'
import { checkKeyboards } from './keyboards.ts'
import { checkLanguages } from './languages.ts'
import { checkNotes } from './notes.ts'
import { checkPayments } from './payments.ts'
import { checkTexts } from './texts.ts'
import { checkVariables } from './variables.ts'

export type CheckOptions = {
  /** The keys marked "Ignore here" (issueKey); the design's `ignoredChecks` when left out. */
  ignored?: readonly string[]
}

const LEVEL_ORDER: Record<IssueLevel, number> = { error: 0, warning: 1, info: 2 }
const CODE_ORDER = new Map(Object.keys(CHECK_LEVELS).map((code, index) => [code as IssueCode, index]))

/**
 * Every issue of the design: errors, then warnings, then good-to-know; within a level, bot setup
 * first, then the steps in map order (left to right, top to bottom), each step's in rule order.
 * Ignored issues stay in the list with `ignored: true`; errors are never ignored.
 */
export function check(design: Design, opts: CheckOptions = {}): Issue[] {
  const issues: Issue[] = []
  const ctx = buildContext(design, issues)
  checkTexts(ctx)
  checkKeyboards(ctx)
  checkContent(ctx)
  checkPayments(ctx)
  checkEvents(ctx)
  checkFlow(ctx)
  checkLanguages(ctx)
  checkVariables(ctx)
  checkBot(ctx)
  checkNotes(ctx)

  const ignored = new Set(opts.ignored ?? design.ignoredChecks ?? [])
  if (ignored.size > 0) {
    for (const issue of issues) {
      if (issue.ignorable && ignored.has(issueKey(issue))) issue.ignored = true
    }
  }
  const rank = (issue: Issue) => (issue.stepId === undefined ? -1 : (ctx.rank.get(issue.stepId) ?? -1))
  return issues.sort(
    (a, b) =>
      LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] ||
      rank(a) - rank(b) ||
      (CODE_ORDER.get(a.code) ?? 0) - (CODE_ORDER.get(b.code) ?? 0),
  )
}

/**
 * The steps that set and use each variable, in map order, as the checks count them (the
 * Variables panel, 04 section 11).
 */
export function variableSteps(design: Design): {
  sets: ReadonlyMap<VarId, readonly Step[]>
  uses: ReadonlyMap<VarId, readonly Step[]>
} {
  const ctx = buildContext(design, [])
  return { sets: ctx.varSets, uses: ctx.varUses }
}
