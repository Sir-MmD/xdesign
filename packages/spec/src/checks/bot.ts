// Bot setup (docs/plan/03-design-model.md section 8): E08 commands that break Telegram's rules or
// are used twice, E09 start link payloads, E10 bot texts and command descriptions too long.
// Lengths, ranges and allowed characters come from the catalog's limits.
import type { StepId } from '../model/ids.ts'
import type { LangText } from '../model/texts.ts'
import { limit, type LimitRow } from '../telegram/limits.ts'
import type { Context } from './context.ts'

// A text within a limit's length and characters.
function fits(text: string, row: LimitRow): boolean {
  return (
    text.length >= (row.min ?? 0) &&
    text.length <= (row.max ?? Infinity) &&
    (row.pattern === undefined || new RegExp(row.pattern).test(text))
  )
}

export function checkBot(ctx: Context): void {
  const tooLong = (what: string, text: LangText, max: number, stepId?: StepId) => {
    for (const lang of ctx.languages) {
      const length = (text[lang] ?? '').length
      if (length <= max) continue
      ctx.add(
        'E10',
        `The ${what} in ${lang} is ${String(length)} characters long; Telegram allows at most ${String(max)}.`,
        stepId === undefined ? { language: lang } : { stepId, language: lang },
      )
    }
  }
  const { bot } = ctx.design
  tooLong('bot name', bot.name, limit('botName').max)
  tooLong('about text', bot.about, limit('botAbout').max)
  tooLong('description', bot.description, limit('botDescription').max)

  const command = limit('command')
  const payload = limit('startPayload')
  const commands = new Map<string, string>()
  for (const step of ctx.steps) {
    if (step.kind !== 'start') continue
    const { trigger } = step
    const name = ctx.stepName(step)
    const place = { stepId: step.id }
    if (trigger.type === 'command') {
      if (!fits(trigger.command, command)) {
        ctx.add(
          'E08',
          `The command /${trigger.command} of ${name} is not valid: Telegram takes ${String(command.min)} to ` +
            `${String(command.max)} characters, only lowercase English letters, digits and _.`,
          place,
        )
      }
      const first = commands.get(trigger.command)
      if (first === undefined) commands.set(trigger.command, name)
      else ctx.add('E08', `The command /${trigger.command} of ${name} is also the command of ${first}.`, place)
      if (trigger.inMenu) {
        tooLong(
          `menu description of /${trigger.command}`,
          trigger.menuDescription,
          limit('commandDescription').max,
          step.id,
        )
      }
    } else if (trigger.type === 'startLink' && !fits(trigger.payload, payload)) {
      ctx.add(
        'E09',
        `The start link payload "${trigger.payload}" of ${name} is not valid: Telegram takes ${String(payload.min)} ` +
          `to ${String(payload.max)} characters, only English letters, digits, _ and -.`,
        place,
      )
    }
  }
}
