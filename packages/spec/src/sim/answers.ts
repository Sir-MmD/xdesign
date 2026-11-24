// Answers to questions while trying (docs/plan/03-design-model.md section 2.8): what each
// `expects` takes, the checks, cancel words, and the test values shared and sent ("Send a test
// photo/file"). A test file always meets the question's file checks.
import type { AnswerChecks, Expects } from '../model/question.ts'
import type { QuestionStep } from '../model/steps.ts'
import type { LangText } from '../model/texts.ts'
import type { SimMediaKind, SimSent, SimValue } from './types.ts'
import { latinDigits, toNumber } from './values.ts'

/** What Try it shares and sends for the tester. */
export const SIM_TEST_VALUES = {
  phone: '+12025550100',
  location: { latitude: 48.8584, longitude: 2.2945 },
  userId: 1000001,
  chatId: -1001000000001,
  pollQuestion: 'Test poll',
} as const

const fileTypes: Record<SimMediaKind, string> = { photo: 'jpg', video: 'mp4', file: 'pdf', voice: 'ogg', audio: 'mp3' }

/** The name of a test file, of the first type the question takes when it lists some. */
export function testFileName(kind: SimMediaKind, types: string[] | undefined): string {
  const type = types?.[0]?.replace(/^\./, '').toLowerCase() || fileTypes[kind]
  return `test_${kind}.${type}`
}

/** What a share or pick button saves to its variable. */
export function sentValue(sent: SimSent): SimValue {
  switch (sent.type) {
    case 'text':
      return sent.text
    case 'media':
      return sent.name
    case 'contact':
      return sent.phone
    case 'location':
      return `${String(sent.latitude)}, ${String(sent.longitude)}`
    case 'users':
      return sent.userId
    case 'chat':
      return sent.chatId
    case 'poll':
      return sent.question
    case 'unexpected':
      return ''
  }
}

const patterns: Record<NonNullable<AnswerChecks['pattern']>, RegExp> = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  url: /^(?:https?:\/\/)?[^\s/.]+(?:\.[^\s/.]+)+(?:\/\S*)?$/i,
  phone: /^\+?(?:[\s().-]*\d){5,15}[\s().-]*$/,
  date: /^(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})$/,
}

function textChecks(text: string, checks: AnswerChecks): boolean {
  // Characters as code points, as most bot libraries count them.
  const length = Array.from(text).length
  if (checks.minLength !== undefined && length < checks.minLength) return false
  if (checks.maxLength !== undefined && length > checks.maxLength) return false
  return checks.pattern === undefined || patterns[checks.pattern].test(latinDigits(text))
}

function numberChecks(n: number, checks: AnswerChecks): boolean {
  if (checks.min !== undefined && n < checks.min) return false
  if (checks.max !== undefined && n > checks.max) return false
  return !checks.wholeNumber || Number.isInteger(n)
}

function textAnswer(expects: Expects, checks: AnswerChecks, raw: string): SimValue | undefined {
  const text = raw.trim()
  switch (expects) {
    case 'text':
    case 'any':
      return textChecks(text, checks) ? text : undefined
    case 'email':
      return patterns.email.test(text) && textChecks(text, checks) ? text : undefined
    case 'phone':
      return patterns.phone.test(latinDigits(text)) && textChecks(text, checks) ? text : undefined
    case 'number': {
      const n = toNumber(text)
      return Number.isFinite(n) && numberChecks(n, checks) ? n : undefined
    }
    default:
      return undefined
  }
}

/** The value a valid answer saves, or undefined for a wrong answer. */
export function answerValue(step: QuestionStep, sent: SimSent): SimValue | undefined {
  const { expects } = step
  const takes = (...kinds: Expects[]) => expects === 'any' || kinds.includes(expects)
  switch (sent.type) {
    case 'text':
      return textAnswer(expects, step.checks, sent.text)
    case 'media':
      return takes(sent.kind) ? sent.name : undefined
    case 'contact':
      return takes('phone') ? sent.phone : undefined
    case 'location':
      return takes('location') ? sentValue(sent) : undefined
    default:
      return takes() ? sentValue(sent) : undefined
  }
}

/** Whether a text is one of the cancel words, in any language ("Cancel", "انصراف"). */
export function isCancelWord(words: LangText, text: string): boolean {
  const typed = text.trim().toLowerCase()
  return (
    typed !== '' &&
    Object.values(words).some((list) =>
      (list ?? '').split(/[,،\n]/).some((word) => word.trim().toLowerCase() === typed),
    )
  )
}
