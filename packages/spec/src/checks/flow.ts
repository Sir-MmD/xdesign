// Flow and arrows (docs/plan/03-design-model.md section 8): E11 questions with nowhere to go,
// W01 steps nobody reaches, W02 arrows that go nowhere yet, W05 questions without a wrong answer
// message, W06 "If" without "otherwise", W07 developer steps (and pre-checkout checks and gifts)
// without a description, W10 messages where the user can only type. An invoice without "Paid"
// goes nowhere unless a "Payment done" start point takes its payments; an action needs the
// message or invoice it acts on.
import type { Action } from '../model/actions.ts'
import type { Design } from '../model/design.ts'
import type { Target } from '../model/ids.ts'
import { andList, emptyDoc, emptyText, goesNowhere, keyboardOf, type Context } from './context.ts'

// What an action does not name yet, as the end of a sentence after its name; undefined when it
// names all it needs (unpin without a step unpins the newest pinned message).
function actionMissing(design: Design, action: Action): string | undefined {
  const none = (id: string | undefined) => id === undefined || design.steps[id] === undefined
  switch (action.type) {
    case 'react':
      return action.onStep !== 'userMessage' && none(action.onStep)
        ? "reacts to no message yet: choose a step's message or the user's message."
        : undefined
    case 'pin':
      return none(action.step) ? 'pins no message yet: choose the step whose message it pins.' : undefined
    case 'delete':
      return none(action.step) ? 'deletes no message yet: choose the step whose message it deletes.' : undefined
    case 'refund':
      return design.steps[action.invoice ?? '']?.kind === 'invoice'
        ? undefined
        : 'refunds no invoice yet: choose the invoice whose payment it gives back.'
    case 'unpin':
    case 'gift':
    case 'chatAction':
      return undefined
  }
}

export function checkFlow(ctx: Context): void {
  const { design } = ctx
  const nowhere = (target: Target | undefined) => goesNowhere(design, target)
  for (const step of ctx.steps) {
    const name = ctx.stepName(step)
    const place = { stepId: step.id }

    if (step.kind !== 'start' && step.kind !== 'note' && step.kind !== 'frame' && !ctx.arrowsIn.has(step.id)) {
      ctx.add('W01', `Nothing leads to ${name}: no arrow goes into it and it is not a start point.`, place)
    }

    // The arrows of the step itself, in one issue (its key is the step's).
    const loose: string[] = []
    switch (step.kind) {
      case 'start':
      case 'remember':
      case 'wait':
        if (nowhere(step.next)) loose.push('"then"')
        break
      case 'invoice': {
        const taken = ctx.steps.some(
          (other) =>
            other.kind === 'start' &&
            other.trigger.type === 'paymentDone' &&
            (other.trigger.invoice === undefined || other.trigger.invoice === step.id),
        )
        if (nowhere(step.next) && (step.next !== undefined || !taken)) loose.push('"paid"')
        if (step.checkout && emptyText(step.checkout.description)) {
          ctx.add('W07', `The pre-checkout check of ${name} has no description.`, place)
        }
        break
      }
      case 'action': {
        if (nowhere(step.next)) loose.push('"then"')
        const missing = actionMissing(design, step.action)
        if (missing !== undefined) ctx.add('W02', `${name} ${missing}`, place)
        if (step.action.type === 'gift' && emptyText(step.action.giftDescription)) {
          ctx.add('W07', `The gift of ${name} has no description of which gift to send.`, place)
        }
        break
      }
      case 'goTo':
        if (nowhere(step.target)) ctx.add('W02', `${name} goes nowhere yet.`, place)
        break
      case 'if':
        for (const item of step.cases) {
          if (nowhere(item.goTo)) loose.push(item.label.trim() ? `the case "${item.label.trim()}"` : 'a case')
        }
        if (nowhere(step.otherwise)) ctx.add('W06', `${name} has no "otherwise" for when no case matches.`, place)
        break
      case 'devStep':
        for (const outcome of step.outcomes) {
          if (nowhere(outcome.goTo)) {
            loose.push(outcome.label.trim() ? `the outcome "${outcome.label.trim()}"` : 'an outcome')
          }
        }
        if (emptyText(step.description)) ctx.add('W07', `The developer step ${name} has no description.`, place)
        break
      case 'question':
        if (nowhere(step.next)) ctx.add('E11', `${name} has nowhere to go after a valid answer.`, place)
        if (step.expects !== 'any' && emptyDoc(step.wrongAnswer.message.doc[ctx.defaultLanguage])) {
          ctx.add('W05', `${name} has no message for a wrong answer.`, place)
        }
        break
      case 'message': {
        // A message's "then" is optional; one to a deleted step goes nowhere.
        if (step.next !== undefined && nowhere(step.next)) loose.push('"then"')
        const keyboard = keyboardOf(step)
        const buttons = [...ctx.rows(step), ...ctx.richRows(step)].some((row) => row.length > 0)
        if (
          nowhere(step.next) &&
          !buttons &&
          (keyboard === null || keyboard.type === 'inline' || keyboard.type === 'reply')
        ) {
          ctx.add('W10', `${name} has no buttons and no "then": the user can only type.`, place)
        }
        break
      }
      default:
        break
    }
    if (loose.length > 0) {
      ctx.add('W02', `In ${name}, ${andList(loose)} ${loose.length === 1 ? 'goes' : 'go'} nowhere yet.`, place)
    }
  }

  // Buttons: each at the first step that shows it. A bottom keyboard button on a question is the
  // answer, which goes on with the question's own arrow.
  for (const { button, step } of ctx.buttons) {
    let home = step
    let loose = false
    if (button.place === 'inline') {
      const { action } = button
      if (button.disabled) continue
      if (action.type === 'goTo') loose = action.target !== 'stay' && nowhere(action.target)
      else if (action.type === 'url' || action.type === 'loginUrl') loose = emptyText(action.url)
    } else {
      const message = ctx.buttonSteps.get(button.id)?.find((shownIn) => shownIn.kind === 'message')
      if (!message) continue
      home = message
      loose = nowhere(button.action.goTo)
    }
    if (loose) {
      ctx.add('W02', `The button ${ctx.buttonName(button)} in ${ctx.stepName(home)} goes nowhere yet.`, {
        stepId: home.id,
        buttonId: button.id,
      })
    }
  }
}
