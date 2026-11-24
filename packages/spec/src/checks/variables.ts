// Variables (docs/plan/03-design-model.md section 8): W04 a variable used but never set, or set
// but never used, and places that refer to a deleted variable. Built-in variables are set by
// Telegram and need no use. One issue per step (the first that uses or sets the variable), so
// "Ignore here" has one key for it.
import type { StepId } from '../model/ids.ts'
import type { Variable } from '../model/variables.ts'
import { andList, type Context } from './context.ts'

export function checkVariables(ctx: Context): void {
  const unset = new Map<StepId, Variable[]>()
  const unused = new Map<StepId, Variable[]>()
  const note = (index: Map<StepId, Variable[]>, id: StepId | undefined, variable: Variable) => {
    if (id === undefined) return
    const list = index.get(id)
    if (list) list.push(variable)
    else index.set(id, [variable])
  }
  for (const variable of Object.values(ctx.design.variables)) {
    if (variable.source === 'builtin') continue
    const uses = ctx.varUses.get(variable.id)
    const sets = ctx.varSets.get(variable.id)
    if (uses && !sets) note(unset, uses[0]?.id, variable)
    if (sets && !uses) note(unused, sets[0]?.id, variable)
  }

  const names = (list: readonly Variable[] | undefined) =>
    andList((list ?? []).map((variable) => `"${variable.label.trim() || variable.idName}"`))
  for (const step of ctx.steps) {
    const sentences: string[] = []
    const name = ctx.stepName(step)
    if (unset.has(step.id)) sentences.push(`${name} uses ${names(unset.get(step.id))}, which nothing sets.`)
    if (unused.has(step.id)) sentences.push(`${name} sets ${names(unused.get(step.id))}, which nothing uses.`)
    if (ctx.deletedVarSteps.has(step.id)) sentences.push(`${name} refers to a variable that was deleted.`)
    if (sentences.length > 0) ctx.add('W04', sentences.join(' '), { stepId: step.id })
  }
}
