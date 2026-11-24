// Events and actions (docs/plan/08 section 6): E26 a gift's text too long, E29 an action or event
// Telegram cannot do (a reaction that is not one of its emoji, acting on a step that sends no
// message, "Subscription changed" for an invoice that is not a subscription), E30 sending after
// the user blocked the bot, W20 a broadcast that does not say who gets it or when, W21 a wait
// longer than the bot can keep without storing it, I20 refunds only of Stars payments, I21 the
// broadcast rates. A gift's text missing in a language is W03, as every text. Each limit and rule
// comes from the catalog.
import type { StepId, Target } from '../model/ids.ts'
import type { ActionStep, StartStep, Step, WaitStep } from '../model/steps.ts'
import { EVENT_RULES, reactionEmoji } from '../telegram/events.ts'
import { limit } from '../telegram/limits.ts'
import { isStars, PAYMENT_RULES } from '../telegram/payments.ts'
import { andList, asButtonStep, emptyDoc, emptyText, stepTargets, type Context } from './context.ts'

const ruleOf = (rules: readonly { id: string; rule: string }[], id: string) =>
  rules.find((row) => row.id === id)?.rule ?? ''

const SECONDS: Record<WaitStep['unit'], number> = { seconds: 1, minutes: 60, hours: 3600, days: 86400 }

export function checkEvents(ctx: Context): void {
  for (const step of ctx.steps) {
    if (step.kind === 'action') checkAction(ctx, step)
    else if (step.kind === 'start') checkStart(ctx, step)
    else if (step.kind === 'wait') checkWait(ctx, step)
  }
}

// The step an action acts on must send a message (a message, a question's prompt, an invoice);
// `userMessage` is the user's message.
function sendsNoMessage(ctx: Context, id: StepId | undefined): Step | undefined {
  const step = id === undefined || id === 'userMessage' ? undefined : ctx.design.steps[id]
  return step && !asButtonStep(step) ? step : undefined
}

function checkAction(ctx: Context, step: ActionStep): void {
  const { action } = step
  const name = ctx.stepName(step)
  const place = { stepId: step.id }
  switch (action.type) {
    case 'react': {
      if (reactionEmoji(action.emoji) === undefined) {
        ctx.add(
          'E29',
          `${name} reacts with "${action.emoji}", which is not one of Telegram's reaction emoji. ` +
            ruleOf(EVENT_RULES, 'oneReaction'),
          place,
        )
      }
      const other = sendsNoMessage(ctx, action.onStep)
      if (other) ctx.add('E29', `${name} reacts to the message of ${ctx.stepName(other)}, which sends none.`, place)
      break
    }
    case 'pin':
    case 'unpin':
    case 'delete': {
      const other = sendsNoMessage(ctx, action.step)
      const verb = { pin: 'pins', unpin: 'unpins', delete: 'deletes' }[action.type]
      if (other) ctx.add('E29', `${name} ${verb} the message of ${ctx.stepName(other)}, which sends none.`, place)
      break
    }
    case 'gift': {
      const { text } = action
      if (!text) break
      const { max } = limit('giftText')
      for (const lang of ctx.languages) {
        const doc = text.doc[lang]
        if (!doc) continue
        const length = ctx.length(doc, lang)
        if (length <= max) continue
        ctx.add(
          'E26',
          `The gift text of ${name} in ${lang} is ${String(length)} characters long; Telegram allows at most ` +
            `${String(max)}.`,
          { ...place, language: lang },
        )
      }
      for (const lang of ctx.languages) {
        if (lang === ctx.defaultLanguage || emptyDoc(text.doc[ctx.defaultLanguage]) || !emptyDoc(text.doc[lang]))
          continue
        ctx.add('W03', `${name} has no gift text in ${lang}.`, { ...place, language: lang })
      }
      break
    }
    case 'refund':
      refundNote(ctx, step, action.invoice, 'refunds')
      break
    case 'chatAction':
      break
  }
}

// I20: Telegram refunds through the bot (and reports refunds) only for payments in Stars.
function refundNote(ctx: Context, step: Step, invoiceId: StepId | undefined, verb: string): void {
  const invoice = invoiceId === undefined ? undefined : ctx.design.steps[invoiceId]
  if (invoice?.kind !== 'invoice' || isStars(invoice.invoice.currency)) return
  ctx.add(
    'I20',
    `${ctx.stepName(step)} ${verb} ${ctx.stepName(invoice)}, which is paid by card. ` +
      `${ruleOf(PAYMENT_RULES, 'refundStarsOnly')} Telegram tells the bot of no card refund.`,
    { stepId: step.id },
  )
}

function checkStart(ctx: Context, step: StartStep): void {
  const { trigger } = step
  const name = ctx.stepName(step)
  const place = { stepId: step.id }
  switch (trigger.type) {
    case 'refunded':
      refundNote(ctx, step, trigger.invoice, 'waits for refunds of')
      break
    case 'subscriptionChanged': {
      const invoice = trigger.invoice === undefined ? undefined : ctx.design.steps[trigger.invoice]
      if (invoice && (invoice.kind !== 'invoice' || !invoice.invoice.subscription)) {
        ctx.add(
          'E29',
          `${name} waits for changes of the subscription ${ctx.stepName(invoice)}, which is not a subscription: ` +
            'Telegram sends none.',
          place,
        )
      }
      break
    }
    case 'userBlocks': {
      const sends = sendsAfter(ctx, step.next)
      if (sends.length > 0) {
        ctx.add(
          'E30',
          `After ${name} the bot sends ${andList(sends.map((other) => ctx.stepName(other)))}, but the user ` +
            `blocked it. ${ruleOf(EVENT_RULES, 'blockedNoSend')}`,
          place,
        )
      }
      break
    }
    case 'broadcast': {
      const missing: string[] = []
      const { audience } = trigger
      if (audience !== 'everyone' && ('all' in audience ? audience.all : audience.any).length === 0) {
        missing.push('who gets it ("Everyone", or the users a condition takes)')
      }
      if (emptyText(trigger.when)) missing.push('when it is sent')
      if (missing.length > 0) ctx.add('W20', `${name} does not say ${andList(missing)}.`, place)
      const free = limit('broadcastRate')
      const paid = limit('paidBroadcastRate')
      ctx.add(
        'I21',
        `${name} writes to many users at once: Telegram takes about ${String(free.max)} messages per second, ` +
          `${String(paid.max)} with paid broadcasts (allow_paid_broadcast, 0.1 Stars per message above the free ` +
          `rate). ${ruleOf(EVENT_RULES, 'broadcastStarted')}`,
        place,
      )
      break
    }
    default:
      break
  }
}

// The steps that would send to the user from a target on, through logic boxes and actions that
// send nothing, up to the first step that sends on each way (a message, a question, an invoice or
// a chat action).
function sendsAfter(ctx: Context, target: Target | undefined): Step[] {
  const sends: Step[] = []
  const seen = new Set<StepId>()
  const visit = (id: Target | undefined) => {
    if (id === undefined || id === 'back' || seen.has(id)) return
    seen.add(id)
    const step = ctx.design.steps[id]
    if (!step) return
    if (asButtonStep(step) || (step.kind === 'action' && step.action.type === 'chatAction')) {
      sends.push(step)
      return
    }
    stepTargets(step).forEach(visit)
  }
  visit(target)
  return sends.sort((a, b) => (ctx.rank.get(a.id) ?? 0) - (ctx.rank.get(b.id) ?? 0))
}

function checkWait(ctx: Context, step: WaitStep): void {
  const kept = limit('keptWait')
  const seconds = step.amount * SECONDS[step.unit]
  if (seconds <= kept.max * SECONDS[kept.unit]) return
  const unit = step.amount === 1 ? step.unit.slice(0, -1) : step.unit
  ctx.add(
    'W21',
    `${ctx.stepName(step)} waits ${String(step.amount)} ${unit}. ${ruleOf(EVENT_RULES, 'waitsAreTheBots')} ` +
      'The developer stores it, so a restart of the bot does not lose it.',
    { stepId: step.id },
  )
}
