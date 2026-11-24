// What start points follow (docs/plan/04 sections 6 and 7): a command's and a start link's
// characters from the catalog, the full start link, `/start`, and where Bot setup's "+ Command"
// puts a new command on the map.
import { type Design, type StartStep, type Step, telegram, type Trigger } from '@xdesign/spec'

import { languageName } from '@/lib/languages'

type Rule = { min: number; max: number; pattern: string }

const command = telegram.limit('command')
const payload = telegram.limit('startPayload')

/** "1 to 32 characters. Only lowercase English letters, digits and underscores." */
export const COMMAND_RULE = `${String(command.min)} to ${String(command.max)} characters. ${command.note}`

/** "1 to 64 characters. A-Z, a-z, 0-9, _ and - only; the bot receives /start <payload>." */
export const PAYLOAD_RULE = `${String(payload.min)} to ${String(payload.max)} characters. ${payload.note}`

/** The longest menu text Telegram takes (a command's description). */
export const MENU_TEXT_MAX = telegram.limit('commandDescription').max

// A text within a limit's length and characters, as the checks read it (E08, E09).
function fits(text: string, rule: Rule): boolean {
  return text.length >= rule.min && text.length <= rule.max && new RegExp(rule.pattern).test(text)
}

export const commandFits = (text: string) => fits(text, command)
export const payloadFits = (text: string) => fits(text, payload)

/** A typed command as it is kept: lower case, without the slash in front. */
export function typedCommand(text: string): string {
  return text.trim().replace(/^\/+/, '').toLowerCase()
}

/** The full start link with the bot username of Bot setup, else `yourbot`. */
export function startLink(design: Pick<Design, 'bot'>, text: string): string {
  return `https://t.me/${design.bot.username ?? 'yourbot'}?start=${text}`
}

/** A command start point. */
export type CommandStep = StartStep & { trigger: Extract<Trigger, { type: 'command' }> }

export function isCommand(step: Step | undefined): step is CommandStep {
  return step?.kind === 'start' && step.trigger.type === 'command'
}

/**
 * The design's `/start`: a command start point `start` while no other has that command (a second
 * one, being typed, keeps its fields until it is something else).
 */
export function isTheStart(step: Step, steps: Design['steps']): boolean {
  if (!isCommand(step) || step.trigger.command !== 'start') return false
  return Object.values(steps).filter((other) => isCommand(other) && other.trigger.command === 'start').length === 1
}

/**
 * "Another start point has the command /help.": the problem of a command another command start
 * point has (E08), else nothing.
 */
export function sameCommand(step: StartStep, steps: Design['steps']): string | undefined {
  if (step.trigger.type !== 'command' || step.trigger.command === '') return undefined
  const { command: name } = step.trigger
  const taken = Object.values(steps).some(
    (other) => other.id !== step.id && isCommand(other) && other.trigger.command === name,
  )
  return taken ? `Another start point has the command /${name}.` : undefined
}

/** A field's label with the language it writes when the design has several ("Menu text (Persian)"). */
export function inLanguage(label: string, design: Pick<Design, 'languages'>, lang: string): string {
  return design.languages.list.length > 1 ? `${label} (${languageName(lang)})` : label
}

/** Where Bot setup's "+ Command" puts a new command: under the lowest start point, left aligned with them. */
export function newCommandAt(steps: Design['steps']): { x: number; y: number } {
  const starts = Object.values(steps).filter((step) => step.kind === 'start')
  if (starts.length === 0) return { x: 0, y: 0 }
  return { x: Math.min(...starts.map((step) => step.x)), y: Math.max(...starts.map((step) => step.y)) + 160 }
}
