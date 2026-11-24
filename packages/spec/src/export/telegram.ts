// The `telegram` blocks of the export (docs/plan/03-design-model.md section 6.3, 08 sections 1 and
// 7): the Bot API methods and fields a step or a press maps to, all read from the catalog
// (src/telegram/). Edits follow the edit matrix (telegram/edit.ts): where Telegram cannot edit
// (check E05), the press sends the step as a new message.
import type { Action } from '../model/actions.ts'
import type { Button, InlineAction, Keyboard, ReplyAction } from '../model/buttons.ts'
import type { Content } from '../model/content.ts'
import type { Design } from '../model/design.ts'
import type { StepId } from '../model/ids.ts'
import type { Options } from '../model/options.ts'
import type { Expects } from '../model/question.ts'
import type { InvoiceStep } from '../model/steps.ts'
import type { Trigger } from '../model/triggers.ts'
import { BUTTON_KINDS, LOOKS, type ButtonKind } from '../telegram/buttons.ts'
import { editRule } from '../telegram/edit.ts'
import { ACTION_METHODS, reactionEmoji } from '../telegram/events.ts'
import { KEYBOARD_TYPES } from '../telegram/keyboards.ts'
import { limit } from '../telegram/limits.ts'
import { messageKind, type ContentKind } from '../telegram/messages.ts'
import { isStars } from '../telegram/payments.ts'
import { draftMethod } from '../telegram/rich.ts'
import type { SpecActionStep, SpecButtonTelegram, SpecInvoiceStep, SpecSendTelegram, SpecStartPoint } from './schema.ts'

/** A message as the bot sends it: a message step, or a question's prompt. */
export type Shown = { content: Content; keyboard: Keyboard; options?: Options }

/** What a step shows, for the calls of a press: a message, or an invoice. */
export type ShownStep = Shown | 'invoice'

/**
 * How a message is sent: its method, parse mode and reply markup, for polls, quizzes, dice, paid
 * media and rich messages the method's own parameters, and the draft method that writes a text
 * or rich message out first, with its stop button when it has one (`stops`: a message step's
 * draftStops; a question's prompt has none).
 */
export function sendTelegram({ content, keyboard, options }: Shown, stops = false): SpecSendTelegram {
  const params = sendParams(content)
  const saveFrom = saveFromOf(content)
  const draft = options?.draft === true ? draftMethod(content.type)?.id : undefined
  return {
    method: messageKind(content.type).method,
    parseMode: hasText(content) ? 'HTML' : null,
    replyMarkup: keyboard === null ? null : (KEYBOARD_TYPES.find((row) => row.id === keyboard.type)?.object ?? null),
    ...(params && { params }),
    ...(saveFrom && { saveFrom }),
    ...(draft && { draftMethod: draft as NonNullable<SpecSendTelegram['draftMethod']> }),
    ...(draft &&
      stops && {
        draftStop: {
          can_stop: true as const,
          keep_on_stop: options?.draftKeep === true,
          update: 'stopped_message_generation' as const,
        },
      }),
  }
}

// Where a saved vote (poll_answer) or roll (sendDice's result) comes from.
function saveFromOf(content: Content): SpecSendTelegram['saveFrom'] {
  switch (content.type) {
    case 'poll':
    case 'quiz':
      return content.saveTo === undefined ? undefined : 'poll_answer.option_ids'
    case 'dice':
      return content.saveTo === undefined ? undefined : 'result.dice.value'
    default:
      return undefined
  }
}

function hasText(content: Content): boolean {
  switch (content.type) {
    case 'text':
    case 'poll':
    case 'quiz':
    case 'rich':
      return true
    case 'album':
      return content.items.some((item) => item.caption !== undefined)
    default:
      return 'caption' in content && content.caption !== undefined
  }
}

type Params = NonNullable<SpecSendTelegram['params']>

// The parameters a kind's settings give, by their Bot API names (telegram/polls.ts); fields the
// design leaves out are left out (Telegram's defaults).
function sendParams(content: Content): Params | undefined {
  const params: Params = {}
  const set = (name: string, value: Params[string] | undefined) => {
    if (value !== undefined) params[name] = value
  }
  switch (content.type) {
    case 'poll':
    case 'quiz':
      set('type', content.type === 'quiz' ? 'quiz' : 'regular')
      set('is_anonymous', content.anonymous)
      set('allows_multiple_answers', content.multiple)
      set('allows_revoting', content.revote)
      set('shuffle_options', content.shuffle)
      if (content.type === 'poll') set('allow_adding_options', content.addOptions)
      set('hide_results_until_closes', content.hideResults)
      if (content.type === 'quiz')
        set(
          'correct_option_ids',
          content.correct.toSorted((a, b) => a - b),
        )
      set('open_period', content.closeAfterSec)
      set('close_date', content.closeAt)
      return params
    case 'dice':
      set('emoji', content.emoji)
      return params
    case 'paidMedia':
      set('star_count', content.stars)
      set('show_caption_above_media', content.captionAbove)
      return params
    case 'rich':
      set('is_rtl', content.rtl)
      return Object.keys(params).length > 0 ? params : undefined
    default:
      return undefined
  }
}

/**
 * How an invoice is sent (sendInvoice; a subscription's link with createInvoiceLink, which the bot
 * sends in a url button in place of the pay button) and the updates of a payment with the calls
 * that answer them, in order (telegram/payments.ts).
 */
export function invoiceTelegram(step: InvoiceStep): SpecInvoiceStep['telegram'] {
  const { invoice, keyboard } = step
  const { physical } = invoice
  const params: Params = { currency: invoice.currency }
  if (physical && !isStars(invoice.currency)) {
    params.need_name = physical.needName
    params.need_phone_number = physical.needPhone
    params.need_email = physical.needEmail
    params.need_shipping_address = physical.needAddress
    params.is_flexible = physical.flexibleShipping
  }
  if (invoice.subscription) params.subscription_period = limit('subscriptionPeriod').value
  const payment = [
    ...(physical?.flexibleShipping ? ['shipping_query: answerShippingQuery'] : []),
    'pre_checkout_query: answerPreCheckoutQuery',
    'message.successful_payment',
  ]
  return {
    method: invoice.subscription ? 'createInvoiceLink' : 'sendInvoice',
    parseMode: null,
    replyMarkup: keyboard?.type === 'inline' ? 'InlineKeyboardMarkup' : null,
    params,
    payment,
  }
}

const ANSWER_UPDATES: Record<Expects, string[]> = {
  text: ['message.text'],
  number: ['message.text'],
  email: ['message.text'],
  phone: ['message.contact', 'message.text'],
  location: ['message.location', 'message.venue'],
  photo: ['message.photo'],
  video: ['message.video'],
  file: ['message.document'],
  voice: ['message.voice'],
  audio: ['message.audio'],
  any: ['message'],
}

/** The updates an answer of a question may come as. */
export function waitsFor(expects: Expects): string[] {
  return ANSWER_UPDATES[expects]
}

const MEDIA_UPDATES = [
  'message.photo',
  'message.video',
  'message.animation',
  'message.audio',
  'message.voice',
  'message.document',
  'message.video_note',
  'message.sticker',
]

/** What starts a start point: `/start` with or without a payload, another command, or any message. */
export function startTelegram(trigger: Trigger): SpecStartPoint['telegram'] {
  switch (trigger.type) {
    case 'command':
      return { update: ['message.text'], command: `/${trigger.command}`, payload: null, match: null }
    case 'startLink':
      return { update: ['message.text'], command: '/start', payload: trigger.payload, match: trigger.match }
    case 'fallback': {
      const update = { any: ['message'], text: ['message.text'], media: MEDIA_UPDATES }[trigger.accepts]
      return { update, command: null, payload: null, match: null }
    }
    case 'paymentDone':
      return { update: ['message.successful_payment'], command: null, payload: null, match: null }
    case 'refunded':
      return { update: ['message.refunded_payment'], command: null, payload: null, match: null }
    case 'subscriptionChanged':
      return {
        update: ['subscription'],
        ...(trigger.state !== undefined && { status: trigger.state }),
        command: null,
        payload: null,
        match: null,
      }
    case 'userBlocks':
    case 'userRestarts': {
      const status = trigger.type === 'userBlocks' ? 'kicked' : 'member'
      return { update: ['my_chat_member'], status, command: null, payload: null, match: null }
    }
    case 'broadcast':
      return { update: [], command: null, payload: null, match: null }
  }
}

/** The method of an action step and its own parameters (a reaction, a gift's upgrade, a chat action). */
export function actionTelegram(action: Action): SpecActionStep['telegram'] {
  const method = ACTION_METHODS.find((row) => row.action === action.type)?.id ?? ''
  switch (action.type) {
    case 'react': {
      const emoji = reactionEmoji(action.emoji) ?? action.emoji
      return { method, params: { reaction: [{ type: 'emoji', emoji }], ...(action.big && { is_big: true }) } }
    }
    case 'gift':
      return action.payForUpgrade ? { method, params: { pay_for_upgrade: true } } : { method }
    case 'chatAction':
      return { method, params: { action: action.action } }
    default:
      return { method }
  }
}

// The catalog's button kind of each action (telegram/buttons.ts).
const BUTTON_KIND: Record<InlineAction['type'] | ReplyAction['type'], ButtonKind> = {
  goTo: 'callback',
  url: 'url',
  copyText: 'copy_text',
  loginUrl: 'login_url',
  pay: 'pay',
  text: 'text',
  sharePhone: 'request_contact',
  shareLocation: 'request_location',
  pickUsers: 'request_users',
  pickChat: 'request_chat',
  createPoll: 'request_poll',
}

// What a press of a bottom button sends the bot.
const REPLY_UPDATES: Record<ReplyAction['type'], string> = {
  text: 'message.text',
  sharePhone: 'message.contact',
  shareLocation: 'message.location',
  pickUsers: 'message.users_shared',
  pickChat: 'message.chat_shared',
  createPoll: 'message.poll',
}

const buttonField = (kind: ButtonKind) => BUTTON_KINDS.find((row) => row.id === kind)?.field ?? kind

/**
 * A button's Bot API side in the message `source` it is in: its field, the callback data, style
 * and icon, and for a callback button the calls a press makes.
 */
export function buttonTelegram(button: Button, source: ShownStep, design: Design): SpecButtonTelegram {
  const style = LOOKS.find((row) => row.id === button.look)?.style ?? undefined
  const looks = { style, icon_custom_emoji_id: button.icon?.customEmojiId }
  if (button.place === 'reply') {
    return { button: buttonField(BUTTON_KIND[button.action.type]), ...looks, update: REPLY_UPDATES[button.action.type] }
  }
  if (button.disabled === true) return { button: buttonField('disabled'), ...looks }
  const { action } = button
  if (action.type !== 'goTo') return { button: buttonField(BUTTON_KIND[action.type]), ...looks }
  return {
    button: buttonField('callback'),
    suggestedCallbackData: button.idName,
    ...looks,
    onClick: clickCalls(action, source, design),
  }
}

type GoToAction = Extract<InlineAction, { type: 'goTo' }>

function clickCalls(action: GoToAction, source: ShownStep, design: Design): string[] {
  const answer =
    action.popup === undefined
      ? 'answerCallbackQuery'
      : action.popup.kind === 'alert'
        ? 'answerCallbackQuery(text, show_alert)'
        : 'answerCallbackQuery(text)'
  const { target } = action
  if (target === undefined || target === 'stay') return [answer]
  const shown = target === 'back' ? undefined : shownBy(design, target, new Set())
  if (shown === null) return [answer]
  const send = shown === undefined ? 'send*' : sendMethod(shown)
  switch (action.show) {
    case 'new':
      return [answer, send]
    case 'replace':
      return [answer, 'deleteMessage', send]
    case 'edit':
      return [answer, shown === undefined ? 'editMessage*' : editMethod(source, shown)]
  }
}

/**
 * The message the bot shows on going to a step: through Go to and Remember boxes to a message, a
 * question's prompt or an invoice; null when nothing is shown (an end, a missing arrow), undefined
 * when it is known only when the bot runs (back, an If, a wait, a developer step).
 */
function shownBy(design: Design, id: StepId, seen: Set<StepId>): ShownStep | null | undefined {
  const step = design.steps[id]
  if (step === undefined || seen.has(id)) return null
  seen.add(id)
  const next = (target: string | undefined) =>
    target === undefined ? null : target === 'back' ? undefined : shownBy(design, target, seen)
  switch (step.kind) {
    case 'message':
      return { content: step.content, keyboard: step.keyboard }
    case 'question':
      return { content: step.prompt.content, keyboard: step.prompt.keyboard }
    case 'invoice':
      return 'invoice'
    case 'goTo':
      return next(step.target)
    case 'remember':
      return next(step.next)
    case 'end':
      return null
    default:
      return undefined
  }
}

const kindOf = (shown: ShownStep): ContentKind => (shown === 'invoice' ? shown : shown.content.type)
const sendMethod = (shown: ShownStep) => messageKind(kindOf(shown)).method

// The file (or the whole content, for kinds without one) that an edit of the caption or the
// buttons alone keeps; invoices are sent anew.
function fileOf(shown: ShownStep): string {
  if (shown === 'invoice') return shown
  const { content } = shown
  return JSON.stringify('media' in content ? content.media : content)
}

/** The edit that turns the clicked message into `to`, or the send of `to` where none can. */
function editMethod(from: ShownStep, to: ShownStep): string {
  // An edit sets only an inline keyboard (EDIT_FACTS inlineKeyboardOnly); an invoice is not edited into.
  if (to === 'invoice' || (to.keyboard !== null && to.keyboard.type !== 'inline')) return sendMethod(to)
  const { allowed, change, method } = editRule(kindOf(from), to.content.type)
  if (!allowed || method === undefined) return sendMethod(to)
  const sameFile = fileOf(from) === fileOf(to)
  switch (change) {
    case 'all':
      // The same file: only the caption and the buttons change.
      return method === 'editMessageMedia' && kindOf(from) === to.content.type && sameFile
        ? 'editMessageCaption'
        : method
    case 'caption':
    case 'buttons':
      return sameFile ? method : sendMethod(to)
    default:
      return method
  }
}
