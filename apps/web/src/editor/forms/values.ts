// The values of conditions and Remember lines (docs/plan/03 section 2.10) as their fields show
// them: typed text, a number, yes or no, or another variable written `{name}` as texts write it
// ("[Append] [{answer}] [to] [notes]"); and the condition "+ Condition" adds.
import type { ConditionItem, Design, RememberAction, Value, VariableType } from '@xdesign/spec'

import { groupVariables } from './logic'

/** How a typed value is read: digits as a number, yes and no as yes or no, else as text. */
export type ValueKind = 'text' | 'number' | 'yesNo'

/** A value as its field shows it. */
export function valueText(value: Value | undefined, design: Pick<Design, 'variables'>): string {
  if (value === undefined) return ''
  if (typeof value === 'object') return `{${design.variables[value.var]?.idName ?? '?'}}`
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  return String(value)
}

// Persian and Arabic digits typed in a number.
function latinDigits(text: string): string {
  return text
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
}

/**
 * The value a typed text stands for: undefined when it is empty, null when a number field holds
 * something that is not a number. `{name}` is the variable of that ID name.
 */
export function readValue(text: string, design: Pick<Design, 'variables'>, kind: ValueKind): Value | undefined | null {
  const trimmed = text.trim()
  if (trimmed === '') return undefined
  const name = /^\{([a-z][a-z0-9_]*)\}$/i.exec(trimmed)?.[1]
  if (name !== undefined) {
    const variable = Object.values(design.variables).find((item) => item.idName === name)
    if (variable) return { var: variable.id }
  }
  if (kind === 'number') {
    const number = Number(latinDigits(trimmed).replace(',', '.'))
    return Number.isFinite(number) ? number : null
  }
  if (kind === 'yesNo' && /^(yes|no)$/i.test(trimmed)) return trimmed.toLowerCase() === 'yes'
  return text
}

function kindOfType(type: VariableType | undefined): ValueKind {
  return type === 'number' ? 'number' : type === 'yesNo' ? 'yesNo' : 'text'
}

type VariableCondition = Extract<ConditionItem, { op: unknown }>

/** How a condition's value is read: a number for the comparisons, else as its variable holds it. */
export function conditionValueKind(item: VariableCondition, design: Pick<Design, 'variables'>): ValueKind {
  if (item.op === 'gt' || item.op === 'gte' || item.op === 'lt' || item.op === 'lte') return 'number'
  return kindOfType(design.variables[item.var]?.type)
}

/** How a Remember line's value is read: a number to add or subtract, text to append. */
export function rememberValueKind(action: RememberAction, design: Pick<Design, 'variables'>): ValueKind {
  if (action.op === 'add' || action.op === 'subtract') return 'number'
  if (action.op === 'append') return 'text'
  return kindOfType(design.variables[action.var]?.type)
}

/** A new condition: the first variable of the list (saved answers first) equals a value. */
export function newCondition(design: Pick<Design, 'variables'>): ConditionItem {
  const first = groupVariables(Object.values(design.variables))[0]?.items[0]
  return first ? { var: first.id, op: 'equals' } : { language: [] }
}
