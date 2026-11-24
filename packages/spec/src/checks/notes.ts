// Telegram notes (docs/plan/03-design-model.md section 8): W09 message effects shown by editing,
// W11 custom emoji, I01 placeholder media, I02 button looks, I03 "Delete this one and send a new
// one" (a dice message only after its waiting time), I04 long chat actions. The rules and their
// words come from the catalog.
import type { Button } from '../model/buttons.ts'
import type { StepId } from '../model/ids.ts'
import { BUTTON_RULES, LOOKS } from '../telegram/buttons.ts'
import { chatAction } from '../telegram/chatActions.ts'
import { ENTITY_RULES } from '../telegram/entities.ts'
import { limit } from '../telegram/limits.ts'
import { RICH_NODES } from '../text/schema.ts'
import { andList, asButtonStep, contentOf, mediaSlots, optionsOf, showsBy, textSlots, type Context } from './context.ts'

const ruleOf = (rules: readonly { id: string; rule: string }[], id: string) =>
  rules.find((row) => row.id === id)?.rule ?? ''

// A button whose look sets Telegram's style field (the default look leaves it out).
const styled = (button: Button) => (LOOKS.find((row) => row.id === button.look)?.style ?? null) !== null

export function checkNotes(ctx: Context): void {
  const customEmoji = ruleOf(ENTITY_RULES, 'customEmoji')
  const looks = ruleOf(BUTTON_RULES, 'styleShownByNewApps')
  const { max: actionMax } = limit('chatActionDuration')
  // The first button (and its step) that shows each step with an effect by editing.
  const effectEdits = new Map<StepId, string>()

  for (const step of ctx.steps) {
    const sending = asButtonStep(step)
    if (!sending) continue
    const name = ctx.stepName(step)
    const place = { stepId: step.id }
    const options = optionsOf(sending)
    // An invoice has plain texts and its photo.
    const emoji =
      sending.kind !== 'invoice' &&
      textSlots(sending).some((slot) => ctx.inlines(slot.text.doc).some((node) => node.type === RICH_NODES.customEmoji))
    if (emoji) ctx.add('W11', `${name} has a custom emoji. ${customEmoji}`, place)

    const { photo } = sending.kind === 'invoice' ? sending.invoice : {}
    const slots = sending.kind === 'invoice' ? (photo ? [photo] : []) : mediaSlots(contentOf(sending))
    const placeholders = slots.flatMap((slot) => ('placeholder' in slot ? [slot.placeholder.description.trim()] : []))
    if (placeholders.length > 0) {
      const named = [...new Set(placeholders.filter((description) => description !== ''))].map((text) => `"${text}"`)
      ctx.add('I01', `${name} still has placeholder media${named.length > 0 ? `: ${andList(named)}` : ''}.`, place)
    }

    const buttons = [...new Set(ctx.rows(sending).flat())]
    const colored = buttons.filter(styled).map((button) => ctx.buttonName(button))
    if (colored.length > 0) {
      const which =
        colored.length === 1
          ? `The button ${andList(colored)} in ${name} has`
          : `The buttons ${andList(colored)} in ${name} have`
      ctx.add('I02', `${which} a color. ${looks}`, place)
    }

    if (options.chatAction && options.chatAction.seconds > actionMax) {
      const { action, seconds } = options.chatAction
      ctx.add(
        'I04',
        `${name} shows "${chatAction(action).label}" for ${String(seconds)} seconds; Telegram shows it for at most ` +
          `${String(actionMax)} seconds at once, so the developer repeats it.`,
        place,
      )
    }

    for (const button of buttons) {
      if (!showsBy(button, 'edit') || button.action.type !== 'goTo') continue
      const { target } = button.action
      if (target === undefined || target === 'stay') continue
      for (const shown of ctx.shown(target)) {
        if (optionsOf(shown).effect && !effectEdits.has(shown.id)) {
          effectEdits.set(shown.id, `the button ${ctx.buttonName(button)} in ${name}`)
        }
      }
    }
  }

  for (const step of ctx.steps) {
    const by = effectEdits.get(step.id)
    if (by === undefined) continue
    ctx.add(
      'W09',
      `${ctx.stepName(step)} has a message effect, but ${by} shows it by editing the message; effects play only ` +
        'on new messages.',
      { stepId: step.id },
    )
  }

  const deleteWindow = limit('deleteWindow')
  const diceWait = limit('deleteDiceWait')
  for (const { button, step } of ctx.buttons) {
    const place = { stepId: step.id, buttonId: button.id }
    const name = `${ctx.buttonName(button)} in ${ctx.stepName(step)}`
    if (button.icon) ctx.add('W11', `The button ${name} has a custom emoji as its icon. ${customEmoji}`, place)
    const replaces = showsBy(button, 'replace') && button.action.type === 'goTo' ? button.action.target : undefined
    if (replaces !== undefined && replaces !== 'stay') {
      const dice = step.kind !== 'invoice' && contentOf(step).type === 'dice'
      ctx.add(
        'I03',
        dice
          ? `The button ${name} deletes the message and sends a new one; Telegram deletes a dice message only ` +
              `after ${String(diceWait.min)} ${diceWait.unit} and within ${String(deleteWindow.max)} ` +
              `${deleteWindow.unit} of sending it, before and after that the old message stays.`
          : `The button ${name} deletes the message and sends a new one; Telegram deletes a message only within ` +
              `${String(deleteWindow.max)} ${deleteWindow.unit} of sending it, after that the old message stays.`,
        place,
      )
    }
  }

  const photo = ctx.design.bot.photo
  if (photo && 'placeholder' in photo) ctx.add('I01', 'The bot photo is still a placeholder.')
}
