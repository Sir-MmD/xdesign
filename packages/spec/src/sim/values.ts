// Variables while trying: their values, "If" conditions and remember actions
// (docs/plan/03-design-model.md section 2.10). A condition is true, false, or undefined when Try
// it cannot decide it: a variable only the developer sets with no test value, a membership no
// test switch tells.
import type { Condition, ConditionItem, RememberAction, Value } from '../model/conditions.ts'
import type { VarId } from '../model/ids.ts'
import type { IfStep } from '../model/steps.ts'
import type { SimContext, SimOption, SimPayments, SimValue, SimVars } from './types.ts'

/** The option of an "If" that no case takes. */
export const OTHERWISE = 'otherwise'

/** The value of a variable: set while trying, else its test value; undefined when it has neither. */
export function lookup(ctx: SimContext, vars: SimVars, id: VarId): SimValue | null | undefined {
  const own = vars[id]
  return own !== undefined ? own : ctx.design.variables[id]?.testValue
}

/** A value as a message shows it; undefined (unknown) shows as `{idName}`. */
export function shown(value: SimValue | null | undefined, idName: string): string {
  if (value === undefined) return `{${idName}}`
  if (value === null) return ''
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  return String(value)
}

/** Persian and Arabic digits as Latin ones, so typed numbers read the same. */
export function latinDigits(text: string): string {
  return text
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/٫/g, '.')
    .replace(/٬/g, '')
}

/** A value as a number; NaN when it is not one. */
export function toNumber(value: SimValue | null | undefined): number {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return Number.NaN
  const text = latinDigits(value).trim()
  return text === '' ? Number.NaN : Number(text)
}

// A value in a condition or a remember action; a variable without a value is undefined.
function valueOf(ctx: SimContext, vars: SimVars, value: Value | undefined): SimValue | null | undefined {
  if (value === undefined) return null
  return typeof value === 'object' ? lookup(ctx, vars, value.var) : value
}

function isSet(value: SimValue | null): boolean {
  return value !== null && value !== ''
}

function same(a: SimValue | null, b: SimValue | null): boolean {
  if (!isSet(a) || !isSet(b)) return !isSet(a) && !isSet(b)
  if (typeof a === typeof b) return a === b
  const [x, y] = [toNumber(a), toNumber(b)]
  return Number.isNaN(x) || Number.isNaN(y) ? shown(a, '') === shown(b, '') : x === y
}

function compare(a: SimValue | null, b: SimValue | null, test: (x: number, y: number) => boolean): boolean {
  const [x, y] = [toNumber(a), toNumber(b)]
  return !Number.isNaN(x) && !Number.isNaN(y) && test(x, y)
}

function itemTruth(ctx: SimContext, vars: SimVars, item: ConditionItem, paid: SimPayments): boolean | undefined {
  const { design, user } = ctx
  if ('var' in item) {
    let value = lookup(ctx, vars, item.var)
    if (value === undefined) {
      // Only the developer knows a value a developer step sets; anything else is simply not set.
      const variable = design.variables[item.var]
      if (!variable || variable.source === 'devStep') return undefined
      value = null
    }
    const other = valueOf(ctx, vars, item.value)
    if (other === undefined) return undefined
    const text = shown(value, '')
    switch (item.op) {
      case 'isSet':
        return isSet(value)
      case 'isEmpty':
        return !isSet(value)
      case 'equals':
        return same(value, other)
      case 'notEquals':
        return !same(value, other)
      case 'contains':
        return text.includes(shown(other, ''))
      case 'startsWith':
        return text.startsWith(shown(other, ''))
      case 'gt':
        return compare(value, other, (x, y) => x > y)
      case 'gte':
        return compare(value, other, (x, y) => x >= y)
      case 'lt':
        return compare(value, other, (x, y) => x < y)
      case 'lte':
        return compare(value, other, (x, y) => x <= y)
    }
  }
  if ('switch' in item) {
    const value = user.switches[item.switch] ?? design.switches[item.switch]?.testValue
    return value === undefined ? undefined : value === item.is
  }
  if ('language' in item) {
    return item.language.some((lang) => user.language === lang || user.language.startsWith(`${lang}-`))
  }
  // A test user has paid only what they paid while trying (and was not refunded).
  if ('hasPaid' in item) return paid[item.hasPaid]?.refunded === false
  if ('subscribed' in item) {
    const payment = paid[item.subscribed]
    return payment?.subscription === true && !payment.refunded
  }
  // A membership is decided by a yes/no test switch whose label names the chat ("Member of @shop").
  const chat = item.memberOf.trim().toLowerCase()
  const known = Object.values(design.switches).find(
    (testSwitch) => chat !== '' && testSwitch.type === 'yesNo' && testSwitch.label.toLowerCase().includes(chat),
  )
  if (!known) return undefined
  return (user.switches[known.id] ?? known.testValue) === true
}

/** A condition: `all` is false once an item is false, `any` true once an item is true. */
export function conditionTruth(
  ctx: SimContext,
  vars: SimVars,
  condition: Condition,
  paid: SimPayments = {},
): boolean | undefined {
  const all = 'all' in condition
  const truths = (all ? condition.all : condition.any).map((item) => itemTruth(ctx, vars, item, paid))
  if (truths.includes(!all)) return !all
  return truths.includes(undefined) ? undefined : all
}

/**
 * The way an "If" takes: the first case that is true, else "Otherwise". When a case before it
 * cannot be decided, the ways it could take are asked instead.
 */
export function decide(
  ctx: SimContext,
  vars: SimVars,
  step: IfStep,
  paid: SimPayments = {},
): { way: SimOption } | { ask: SimOption[] } {
  const open: SimOption[] = []
  for (const ifCase of step.cases) {
    const truth = conditionTruth(ctx, vars, ifCase.when, paid)
    if (truth === false) continue
    const option: SimOption = { id: ifCase.id, label: ifCase.label, goTo: ifCase.goTo }
    if (truth && open.length === 0) return { way: option }
    open.push(option)
    if (truth) return { ask: open }
  }
  const otherwise: SimOption = { id: OTHERWISE, label: 'Otherwise', goTo: step.otherwise }
  return open.length === 0 ? { way: otherwise } : { ask: [...open, otherwise] }
}

function changed(current: SimValue | null, value: SimValue | null, op: RememberAction['op']): SimValue | null {
  // A value that is not a number counts as 0.
  const number = (x: SimValue | null) => {
    const n = toNumber(x)
    return Number.isNaN(n) ? 0 : n
  }
  switch (op) {
    case 'set':
      return value
    case 'clear':
      return null
    case 'add':
      return number(current) + number(value)
    case 'subtract':
      return number(current) - number(value)
    case 'append':
      return shown(current, '') + shown(value, '')
  }
}

/** Applies a remember action to `vars` (a draft's copy) and says what it did. */
export function remember(ctx: SimContext, vars: SimVars, action: RememberAction): string {
  const name = ctx.design.variables[action.var]?.idName ?? action.var
  const value = changed(lookup(ctx, vars, action.var) ?? null, valueOf(ctx, vars, action.value) ?? null, action.op)
  vars[action.var] = value
  return value === null ? `Cleared ${name}` : `Remembered ${name} = ${shown(value, name)}`
}
