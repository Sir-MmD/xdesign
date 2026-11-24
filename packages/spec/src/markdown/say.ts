// Logic in plain English (docs/plan/06-export-and-claude-link.md section 3, 03 section 2.10): the
// conditions of If boxes, remember actions and arrows as the sentences design.md writes and the
// editor shows ("If saved answer age is at least 18, go to Adult menu (adult_menu); otherwise go
// to Sorry (sorry)"). A variable is named by where its value comes from and its ID name, a test
// switch by its ID name, a step by its title and ID name. The sentences are plain text: design.md
// escapes them for Markdown.
import type { Condition, ConditionItem, RememberAction, Value } from '../model/conditions.ts'
import type { Design } from '../model/design.ts'
import type { Target, VarId } from '../model/ids.ts'
import type { IfStep, Step } from '../model/steps.ts'
import type { VariableSource } from '../model/variables.ts'

// The interface's words for the kinds of variables (01 section 9, 04 section 11): a value the
// user gave (an answer, a shared contact, the rest of a start link), one the bot remembered, one
// the developer's code gives back, or one Telegram gives.
const SOURCE_WORDS: Record<VariableSource, string> = {
  question: 'saved answer',
  button: 'saved answer',
  startLink: 'saved answer',
  remember: 'remembered value',
  devStep: 'developer output',
  builtin: 'built-in',
}

/** The comparisons of a condition as the sentences read them. */
export const CONDITION_OPS: Record<Extract<ConditionItem, { op: unknown }>['op'], string> = {
  isSet: 'is set',
  isEmpty: 'is empty',
  equals: 'equals',
  notEquals: 'does not equal',
  contains: 'contains',
  startsWith: 'starts with',
  gt: 'is greater than',
  gte: 'is at least',
  lt: 'is less than',
  lte: 'is at most',
}

type Names = Pick<Design, 'variables' | 'switches' | 'steps'>

/** A variable: "saved answer age", "remembered value cart_count"; one the design no longer has by its ID. */
export function sayVariable(id: VarId, design: Pick<Design, 'variables'>): string {
  const variable = design.variables[id]
  return variable === undefined ? `deleted variable ${id}` : `${SOURCE_WORDS[variable.source]} ${variable.idName}`
}

/** A value: a text in quotes, a number, yes or no, or a variable. */
export function sayValue(value: Value, design: Pick<Design, 'variables'>): string {
  if (typeof value === 'object') return sayVariable(value.var, design)
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  return typeof value === 'number' ? String(value) : JSON.stringify(value)
}

function sayItem(item: ConditionItem, design: Names): string {
  if ('var' in item) {
    const said = `${sayVariable(item.var, design)} ${CONDITION_OPS[item.op]}`
    if (item.op === 'isSet' || item.op === 'isEmpty') return said
    return `${said} ${item.value === undefined ? '(no value yet)' : sayValue(item.value, design)}`
  }
  if ('switch' in item) {
    const name = design.switches[item.switch]?.idName ?? `deleted switch ${item.switch}`
    return `test switch ${name} is ${sayValue(item.is, design)}`
  }
  if ('language' in item) return `the user's language is ${item.language.join(' or ') || '(no language yet)'}`
  if ('hasPaid' in item) return `the user has paid ${sayTarget(item.hasPaid, design)}`
  if ('subscribed' in item) return `the user's subscription ${sayTarget(item.subscribed, design)} is active`
  return `the user is a member of ${item.memberOf.trim() || '(no chat yet)'}`
}

/**
 * A condition as one sentence, without "If": "saved answer age is at least 18 and the user's
 * language is fa or en"; "always" for an empty "all of these", "never" for an empty "any of these".
 */
export function sayCondition(when: Condition, design: Names): string {
  const all = 'all' in when
  const items = all ? when.all : when.any
  if (items.length === 0) return all ? 'always' : 'never'
  return items.map((item) => sayItem(item, design)).join(all ? ' and ' : ' or ')
}

/** A remember action: "Set remembered value cart_count to 0", "Add 1 to ...", "Clear ...". */
export function sayRemember(action: RememberAction, design: Pick<Design, 'variables'>): string {
  const name = sayVariable(action.var, design)
  const value = action.value === undefined ? '(no value yet)' : sayValue(action.value, design)
  switch (action.op) {
    case 'set':
      return `Set ${name} to ${value}`
    case 'clear':
      return `Clear ${name}`
    case 'add':
      return `Add ${value} to ${name}`
    case 'subtract':
      return `Subtract ${value} from ${name}`
    case 'append':
      return `Append ${value} to ${name}`
  }
}

/** A step: "Adult menu (adult_menu)", or its ID name alone when it has no title. */
export function sayStep(step: Pick<Step, 'title' | 'idName'>): string {
  const title = step.title.replace(/\s+/g, ' ').trim()
  return title === '' ? step.idName : `${title} (${step.idName})`
}

/** Where an arrow goes: a step, "back (the message the user came from)", or "nowhere yet". */
export function sayTarget(target: Target | undefined, design: Pick<Design, 'steps'>): string {
  if (target === undefined) return 'nowhere yet'
  if (target === 'back') return 'back (the message the user came from)'
  const step = design.steps[target]
  return step === undefined ? `a deleted step (${target})` : sayStep(step)
}

/** Following an arrow: "go to Adult menu (adult_menu)", "go back to ...", "go nowhere yet"; `goes` for buttons. */
export function sayGoTo(target: Target | undefined, design: Pick<Design, 'steps'>, verb: 'go' | 'goes' = 'go'): string {
  if (target === undefined) return `${verb} nowhere yet`
  if (target === 'back') return `${verb} back to the message the user came from`
  return `${verb} to ${sayTarget(target, design)}`
}

/**
 * An If box as one sentence: "If saved answer age is at least 18, go to Adult menu (adult_menu);
 * otherwise go to Sorry (sorry)". The first case that holds decides.
 */
export function sayIf(step: Pick<IfStep, 'cases' | 'otherwise'>, design: Names): string {
  const otherwise = sayGoTo(step.otherwise, design)
  if (step.cases.length === 0) return otherwise.charAt(0).toUpperCase() + otherwise.slice(1)
  const cases = step.cases.map(
    (item, index) => `${index === 0 ? 'If' : 'if'} ${sayCondition(item.when, design)}, ${sayGoTo(item.goTo, design)}`,
  )
  return [...cases, `otherwise ${otherwise}`].join('; ')
}
