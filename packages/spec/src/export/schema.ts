// The export format, spec.json version 1 (docs/plan/03-design-model.md section 6): everything a
// builder needs, resolved. Buttons are inline in their keyboards, parts are expanded where they
// are placed and also listed, texts come in the three Telegram forms of SPEC-02 plus the rich
// document, and every reference is an ID name. Each step and button names the Bot API methods it
// maps to in a `telegram` block. A reference that names nothing in the design is written as the
// design has it (the checks report it). Arrows, variables and the few fields the plan writes as
// null are null when the design has none; every other optional field is left out, as in the
// model. Adding optional fields or new kinds keeps format version 1 (section 6.6).
import { z } from 'zod'

import { LookSchema } from '../model/buttons.ts'
import { DiceEmojiSchema } from '../model/content.ts'
import { ConditionItemSchema, RememberActionSchema } from '../model/conditions.ts'
import { IdNameSchema, IdSchema, LangSchema } from '../model/ids.ts'
import { ChatActionSchema, OptionsSchema } from '../model/options.ts'
import { MediaKindSchema } from '../model/parts.ts'
import { AnswerChecksSchema, ExpectsSchema } from '../model/question.ts'
import { WaitStepSchema } from '../model/steps.ts'
import { LangTextSchema } from '../model/texts.ts'
import { SubscriptionStateSchema } from '../model/triggers.ts'
import { TestSwitchSchema, VariableSchema } from '../model/variables.ts'
import { ENTITIES } from '../telegram/entities.ts'
import { KEYBOARD_TYPES } from '../telegram/keyboards.ts'
import { BOT_API } from '../telegram/version.ts'
import { RichDocSchema } from '../text/schema.ts'

export const SPEC_FORMAT = 'xdesign.bot-spec'
export const SPEC_FORMAT_VERSION = 1

// The named definitions ($defs) of the JSON Schema (specJsonSchema).
const defs = z.registry<z.core.JSONSchemaMeta>()
function def<T extends z.ZodType>(schema: T, id: string, description: string): T {
  defs.add(schema, { id, description })
  return schema
}

const IdNameDef = def(IdNameSchema, 'IdName', 'An ID name: a letter a to z, then up to 47 of a to z, 0 to 9 and _.')
// A reference: the ID name of a step, button, variable, switch or part, or the ID of a media
// entry. One that names nothing in the design keeps the design's own ID.
const RefSchema = def(
  z.string().regex(/^[\w-]{1,64}$/, 'should be an ID name'),
  'Ref',
  'The ID name of a step, button, variable, switch or part, or the id of a media entry.',
)
// Where an arrow goes: a step, or `back` (the message step the user came from); null: no arrow.
const TargetSchema = def(
  z.union([z.literal('back'), RefSchema]).nullable(),
  'Target',
  'The ID name of the step an arrow goes to, "back" for the message step the user came from, or null for no arrow.',
)
const LangTextDef = def(LangTextSchema, 'LangText', 'A plain text per language.')
const OptionsDef = def(
  OptionsSchema,
  'Options',
  'The options of a message: silent is disable_notification, protect is protect_content, then the link preview, the message effect ID, a chat action sent before it, a delay in seconds, and a draft written out first (draft) with its stop button (draftStop is can_stop, draftKeep keep_on_stop).',
)
def(RichDocSchema, 'RichDoc', 'A rich text document (TipTap JSON); variable and part nodes hold ID names.')

// A MessageEntity as Telegram takes it.
export const SpecEntitySchema = def(
  z.object({
    type: z.enum(ENTITIES.map((row) => row.id)),
    offset: z.number(),
    length: z.number(),
    url: z.string().optional(),
    language: z.string().optional(),
    custom_emoji_id: z.string().optional(),
    unix_time: z.number().optional(),
    date_time_format: z.string().optional(),
  }),
  'Entity',
  'A MessageEntity; offsets and lengths count UTF-16 code units.',
)
export type SpecEntity = z.infer<typeof SpecEntitySchema>

// One language of a text: the text with `{idName}` for each variable, the same as entities and
// as Telegram HTML, where each variable is, and the rich document the designer wrote.
export const SpecLangTextSchema = def(
  z.object({
    text: z.string(),
    entities: z.array(SpecEntitySchema),
    html: z.string(),
    variables: z.array(z.object({ var: RefSchema, offset: z.number(), length: z.number() })),
    // An import without it reads `text`, `entities` and `variables`.
    rich: RichDocSchema.optional(),
  }),
  'LangRichText',
  'One language of a text: plain text with {idName} placeholders, entities, Telegram HTML, the variable places and the rich document.',
)
export type SpecLangText = z.infer<typeof SpecLangTextSchema>

// A language without a text yet is left out.
export const SpecTextSchema = def(
  z.partialRecord(LangSchema, SpecLangTextSchema),
  'RichText',
  'A text of a message, caption or text part per language.',
)
export type SpecText = z.infer<typeof SpecTextSchema>

// A file: the `id` of an entry in `media`.
const MediaRefSchema = RefSchema

// A value to compare with or to remember; a variable is `{ var }`.
const SpecValueSchema = z.union([z.string(), z.number(), z.boolean(), z.object({ var: RefSchema })])

export const SpecConditionItemSchema = z.union([
  z.object({ var: RefSchema, op: ConditionItemSchema.options[0].shape.op, value: SpecValueSchema.optional() }),
  z.object({ switch: RefSchema, is: z.union([z.boolean(), z.string()]) }),
  z.object({ language: z.array(LangSchema) }),
  z.object({ memberOf: z.string() }),
  // The user paid the invoice step (not refunded), or its subscription is active.
  z.object({ hasPaid: RefSchema }),
  z.object({ subscribed: RefSchema }),
])
export type SpecConditionItem = z.infer<typeof SpecConditionItemSchema>

export const SpecConditionSchema = def(
  z.union([z.object({ all: z.array(SpecConditionItemSchema) }), z.object({ any: z.array(SpecConditionItemSchema) })]),
  'Condition',
  'All or any of the items hold.',
)
export type SpecCondition = z.infer<typeof SpecConditionSchema>

export const SpecRememberActionSchema = def(
  z.object({ var: RefSchema, op: RememberActionSchema.shape.op, value: SpecValueSchema.optional() }),
  'RememberAction',
  'Set, clear or change a variable.',
)
export type SpecRememberAction = z.infer<typeof SpecRememberActionSchema>

// What a press does: the inline actions (goTo, url, copyText, loginUrl, pay), then the bottom ones.
export const SpecActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('goTo'),
    // `stay` keeps the message (a popup, `remember`, or both).
    target: z.union([z.literal('stay'), TargetSchema]),
    // edit the clicked message into the target, send the target as a new message, or delete the
    // clicked message and send the target.
    show: z.enum(['edit', 'new', 'replace']),
    popup: z.object({ kind: z.enum(['toast', 'alert']), text: LangTextDef }).nullable(),
    remember: z.array(SpecRememberActionSchema).optional(),
  }),
  z.object({ type: z.literal('url'), url: z.string() }),
  z.object({ type: z.literal('copyText'), text: LangTextDef }),
  z.object({ type: z.literal('loginUrl'), url: z.string(), requestWriteAccess: z.boolean() }),
  // An invoice's pay button: it opens Telegram's payment sheet.
  z.object({ type: z.literal('pay') }),
  z.object({ type: z.literal('text'), goTo: TargetSchema, remember: z.array(SpecRememberActionSchema).optional() }),
  z.object({ type: z.enum(['sharePhone', 'shareLocation']), goTo: RefSchema.nullable(), saveTo: RefSchema.nullable() }),
  z.object({
    type: z.literal('pickUsers'),
    max: z.number(),
    bots: z.boolean().optional(),
    premium: z.boolean().optional(),
    askName: z.boolean(),
    askUsername: z.boolean(),
    askPhoto: z.boolean(),
    goTo: RefSchema.nullable(),
    saveTo: RefSchema.nullable(),
  }),
  z.object({
    type: z.literal('pickChat'),
    channel: z.boolean(),
    forum: z.boolean().optional(),
    hasUsername: z.boolean().optional(),
    userIsOwner: z.boolean().optional(),
    botIsMember: z.boolean().optional(),
    askTitle: z.boolean(),
    askUsername: z.boolean(),
    askPhoto: z.boolean(),
    goTo: RefSchema.nullable(),
    saveTo: RefSchema.nullable(),
  }),
  z.object({
    type: z.literal('createPoll'),
    pollType: z.enum(['any', 'regular', 'quiz']),
    goTo: RefSchema.nullable(),
    saveTo: RefSchema.nullable(),
  }),
])
export type SpecAction = z.infer<typeof SpecActionSchema>

// The Bot API side of a button (docs/plan/08 section 1).
export const SpecButtonTelegramSchema = z.object({
  // The InlineKeyboardButton or KeyboardButton field that gives the button its type.
  button: z.string(),
  // The callback_data to send: the button's ID name (at most 48 bytes, under Telegram's 64).
  suggestedCallbackData: z.string().optional(),
  // The button's style field; left out for the default look.
  style: z.enum(['primary', 'success', 'danger']).optional(),
  icon_custom_emoji_id: z.string().optional(),
  // The calls a press makes, in order: answerCallbackQuery (with the popup's text, and
  // show_alert for an alert), then the edit, send or delete and send of the step it shows.
  // `editMessage*` and `send*`: the step it shows is known only when the bot runs.
  onClick: z.array(z.string()).optional(),
  // The update a press of a bottom button sends the bot (message.text, message.contact, ...).
  update: z.string().optional(),
})
export type SpecButtonTelegram = z.infer<typeof SpecButtonTelegramSchema>

export const SpecButtonSchema = def(
  z.object({
    id: IdNameDef,
    label: LangTextDef,
    look: LookSchema,
    icon: z.object({ customEmojiId: z.string(), fallback: z.string() }).nullable(),
    // Inline buttons only: shown but does nothing.
    disabled: z.boolean().optional(),
    does: SpecActionSchema,
    // Left out where a part lists its buttons: every keyboard that places the part has it.
    telegram: SpecButtonTelegramSchema.optional(),
  }),
  'Button',
  'A button with what a press does and its Bot API mapping.',
)
export type SpecButton = z.infer<typeof SpecButtonSchema>

// A row of buttons, or a row part expanded where it is placed.
export const SpecRowSchema = z.union([
  z.array(SpecButtonSchema),
  z.object({ part: RefSchema, buttons: z.array(z.array(SpecButtonSchema)) }),
])
export type SpecRow = z.infer<typeof SpecRowSchema>

// A block of a rich message, as the model has it; a `buttons` block holds its buttons (a row
// inside the message, InputRichBlockButtons).
export const SpecRichBlockSchema = def(
  z.discriminatedUnion('type', [
    z.object({ type: z.enum(['paragraph', 'footer']), text: SpecTextSchema }),
    z.object({ type: z.literal('heading'), text: SpecTextSchema, size: z.number() }),
    z.object({ type: z.literal('code'), text: SpecTextSchema, language: z.string().optional() }),
    z.object({
      type: z.literal('quote'),
      text: SpecTextSchema,
      credit: SpecTextSchema.optional(),
      expandable: z.boolean().optional(),
    }),
    z.object({
      type: z.literal('list'),
      ordered: z.boolean(),
      items: z.array(z.object({ text: SpecTextSchema, checked: z.boolean().optional() })),
    }),
    z.object({
      type: z.literal('table'),
      rows: z.array(z.object({ cells: z.array(z.object({ text: SpecTextSchema, header: z.boolean().optional() })) })),
      caption: SpecTextSchema.optional(),
      bordered: z.boolean().optional(),
      striped: z.boolean().optional(),
      compact: z.boolean().optional(),
    }),
    z.object({
      type: z.literal('details'),
      summary: SpecTextSchema,
      text: SpecTextSchema,
      open: z.boolean().optional(),
    }),
    z.object({ type: z.literal('divider') }),
    z.object({
      type: z.literal('media'),
      media: MediaRefSchema,
      caption: SpecTextSchema.optional(),
      spoiler: z.boolean().optional(),
    }),
    z.object({
      type: z.literal('buttons'),
      buttons: z.array(SpecButtonSchema),
      align: z.enum(['left', 'center', 'right']).optional(),
    }),
  ]),
  'RichBlock',
  'A block of a rich message (InputRichBlock): paragraph, footer, heading (size 1 to 6), code (pre), quote, list, table, details, divider, media or a row of buttons.',
)
export type SpecRichBlock = z.infer<typeof SpecRichBlockSchema>

// The fields polls and quizzes share (sendPoll); options are plain texts per language.
const specPollFields = {
  question: SpecTextSchema,
  options: z.array(LangTextDef),
  anonymous: z.boolean(),
  multiple: z.boolean(),
  revote: z.boolean().optional(),
  shuffle: z.boolean().optional(),
  hideResults: z.boolean().optional(),
  // open_period in seconds, or close_date as a Unix time.
  closeAfterSec: z.number().optional(),
  closeAt: z.number().optional(),
  // The variable the user's vote goes in (telegram.saveFrom says where it comes from).
  saveTo: RefSchema.optional(),
}

export const SpecContentSchema = def(
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('text'), text: SpecTextSchema }),
    z.object({
      type: z.enum(['photo', 'livePhoto', 'video', 'animation']),
      media: MediaRefSchema,
      caption: SpecTextSchema.optional(),
      spoiler: z.boolean().optional(),
      captionAbove: z.boolean().optional(),
    }),
    z.object({
      type: z.literal('audio'),
      media: MediaRefSchema,
      caption: SpecTextSchema.optional(),
      title: z.string().optional(),
      performer: z.string().optional(),
    }),
    z.object({ type: z.enum(['voice', 'document']), media: MediaRefSchema, caption: SpecTextSchema.optional() }),
    z.object({ type: z.enum(['videoNote', 'sticker']), media: MediaRefSchema }),
    z.object({
      type: z.literal('album'),
      items: z.array(
        z.object({ media: MediaRefSchema, caption: SpecTextSchema.optional(), spoiler: z.boolean().optional() }),
      ),
    }),
    z.object({
      type: z.literal('location'),
      latitude: z.number(),
      longitude: z.number(),
      livePeriodSec: z.number().optional(),
    }),
    z.object({
      type: z.literal('venue'),
      latitude: z.number(),
      longitude: z.number(),
      title: z.string(),
      address: z.string(),
    }),
    z.object({ type: z.literal('contact'), phone: z.string(), firstName: z.string(), lastName: z.string().optional() }),
    z.object({ type: z.literal('poll'), ...specPollFields, addOptions: z.boolean().optional() }),
    // `correct`: the 0-based indexes of the right options (correct_option_ids).
    z.object({
      type: z.literal('quiz'),
      ...specPollFields,
      correct: z.array(z.number()),
      explanation: SpecTextSchema.optional(),
    }),
    // `saveTo`: the variable the value rolled goes in.
    z.object({ type: z.literal('dice'), emoji: DiceEmojiSchema, saveTo: RefSchema.optional() }),
    z.object({
      type: z.literal('paidMedia'),
      items: z.array(z.object({ media: MediaRefSchema })),
      stars: z.number(),
      caption: SpecTextSchema.optional(),
      captionAbove: z.boolean().optional(),
    }),
    // `rtl`: shown right to left (is_rtl).
    z.object({ type: z.literal('rich'), blocks: z.array(SpecRichBlockSchema), rtl: z.boolean().optional() }),
  ]),
  'Message',
  'What a message sends.',
)
export type SpecContent = z.infer<typeof SpecContentSchema>

// null is no keyboard.
export const SpecKeyboardSchema = def(
  z
    .discriminatedUnion('type', [
      z.object({ type: z.literal('inline'), rows: z.array(SpecRowSchema), openReplyField: z.boolean().optional() }),
      z.object({
        type: z.literal('reply'),
        rows: z.array(SpecRowSchema),
        oneTime: z.boolean(),
        persistent: z.boolean(),
        resize: z.boolean(),
        placeholder: LangTextDef.optional(),
        openReplyField: z.boolean().optional(),
      }),
      z.object({ type: z.literal('removeReply') }),
      z.object({ type: z.literal('forceReply'), placeholder: LangTextDef.optional() }),
    ])
    .nullable(),
  'Keyboard',
  'The keyboard of a message, or null for none.',
)
export type SpecKeyboard = z.infer<typeof SpecKeyboardSchema>

// How a message is sent.
export const SpecSendTelegramSchema = z.object({
  method: z.string(),
  // HTML: send `html` with parse_mode HTML, or `text` with `entities` and no parse_mode; null:
  // the message has no text or caption.
  parseMode: z.literal('HTML').nullable(),
  replyMarkup: z.enum(KEYBOARD_TYPES.map((row) => row.object)).nullable(),
  // The method's own parameters that follow from the message's settings (polls, quizzes, dice,
  // paid media, invoices), by their Bot API names: type, is_anonymous, correct_option_ids, emoji,
  // star_count, currency, need_name, is_flexible, subscription_period.
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.number())])).optional(),
  // Where a saved vote or roll comes from (the message's `saveTo`): `poll_answer.option_ids`, the
  // update a non-anonymous poll or quiz sends when the user votes, or `result.dice.value`, the
  // value in the message sendDice returns.
  saveFrom: z.enum(['poll_answer.option_ids', 'result.dice.value']).optional(),
  // "Write it out like a draft" (options.draft): the method that streams the text first, with the
  // same draft_id each time, before `method` sends the complete message.
  draftMethod: z.enum(['sendMessageDraft', 'sendRichMessageDraft']).optional(),
  // A draft with a stop button (options.draftStop): the draft method's can_stop and keep_on_stop,
  // and the update a press on the button sends; the step's `onStop` goes on from it.
  draftStop: z
    .object({
      can_stop: z.literal(true),
      keep_on_stop: z.boolean(),
      update: z.literal('stopped_message_generation'),
    })
    .optional(),
})
export type SpecSendTelegram = z.infer<typeof SpecSendTelegramSchema>

// The fields of every box on the map.
const SpecBoxSchema = z.object({
  id: IdNameDef,
  title: z.string(),
  // The title of the section the box is in.
  section: z.string().nullable(),
  // The designer's note for the developer.
  note: z.string().nullable(),
  // The position on the map; an import without it lays the boxes out in a grid.
  x: z.number().optional(),
  y: z.number().optional(),
})

const SpecStepBaseSchema = SpecBoxSchema.extend({
  // Every start point, step and button with an arrow into this step, by ID name.
  cameFrom: z.array(RefSchema),
})

export const SpecTriggerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('command'), command: z.string(), inMenu: z.boolean(), menuDescription: LangTextDef }),
  z.object({
    type: z.literal('startLink'),
    payload: z.string(),
    match: z.enum(['exact', 'prefix']),
    saveRestTo: RefSchema.nullable(),
  }),
  z.object({ type: z.literal('fallback'), accepts: z.enum(['any', 'text', 'media']) }),
  // A payment the invoice's "Paid" arrow does not take (a subscription paid again), and a refund;
  // `invoice` null: of any invoice.
  z.object({ type: z.literal('paymentDone'), invoice: RefSchema.nullable() }),
  z.object({ type: z.literal('refunded'), invoice: RefSchema.nullable() }),
  // A Stars subscription of `invoice` (null: any) changed to `state` (null: any of canceled,
  // active, failed).
  z.object({
    type: z.literal('subscriptionChanged'),
    invoice: RefSchema.nullable(),
    state: SubscriptionStateSchema.nullable(),
  }),
  // The user blocks the bot, or unblocks it.
  z.object({ type: z.literal('userBlocks') }),
  z.object({ type: z.literal('userRestarts') }),
  // The bot writes first: to `everyone` who started it, or to the users the condition takes, when
  // `when` says.
  z.object({
    type: z.literal('broadcast'),
    audience: z.union([z.literal('everyone'), SpecConditionSchema]),
    when: z.string(),
  }),
])
export type SpecTrigger = z.infer<typeof SpecTriggerSchema>

export const SpecStartPointSchema = SpecStepBaseSchema.extend({
  kind: z.literal('start'),
  trigger: SpecTriggerSchema,
  next: TargetSchema,
  telegram: z.object({
    // The updates that start it (a payment's: message.successful_payment, message.refunded_payment;
    // my_chat_member, subscription); none for a broadcast, which the bot starts itself.
    update: z.array(z.string()),
    // The status the update must carry: new_chat_member.status of my_chat_member (kicked when the
    // user blocks the bot, member when they restart it), or the state of subscription.
    status: z.string().optional(),
    // The command the message text starts with (`/start`, `/help`).
    command: z.string().nullable(),
    // The /start payload of a start link, matched whole or as a prefix.
    payload: z.string().nullable(),
    match: z.enum(['exact', 'prefix']).nullable(),
  }),
})
export type SpecStartPoint = z.infer<typeof SpecStartPointSchema>

export const SpecMessageStepSchema = SpecStepBaseSchema.extend({
  kind: z.literal('message'),
  message: SpecContentSchema,
  keyboard: SpecKeyboardSchema,
  options: OptionsDef,
  next: TargetSchema,
  // "If the user stops it": where the bot goes on once the draft's stop button is pressed; only
  // on a message written out like a draft with a stop button (telegram.draftStop).
  onStop: TargetSchema.optional(),
  telegram: SpecSendTelegramSchema,
})
export type SpecMessageStep = z.infer<typeof SpecMessageStepSchema>

export const SpecQuestionStepSchema = SpecStepBaseSchema.extend({
  kind: z.literal('question'),
  prompt: z.object({ message: SpecContentSchema, keyboard: SpecKeyboardSchema, options: OptionsDef }),
  expects: ExpectsSchema,
  checks: AnswerChecksSchema,
  saveTo: RefSchema,
  wrongAnswer: z.object({
    message: SpecTextSchema,
    maxTries: z.number().optional(),
    afterMaxTries: RefSchema.nullable(),
  }),
  cancel: z.object({ words: LangTextDef, goTo: RefSchema.nullable() }).nullable(),
  // After a valid answer.
  next: RefSchema.nullable(),
  // How the prompt is sent, and the updates an answer may come as (message.text, message.contact).
  telegram: SpecSendTelegramSchema.extend({ waitsFor: z.array(z.string()) }),
})
export type SpecQuestionStep = z.infer<typeof SpecQuestionStepSchema>

export const SpecIfStepSchema = SpecStepBaseSchema.extend({
  kind: z.literal('if'),
  cases: z.array(
    z.object({
      label: z.string(),
      when: SpecConditionSchema,
      // `when` as one plain sentence.
      say: z.string(),
      goTo: TargetSchema,
    }),
  ),
  otherwise: TargetSchema,
})
export type SpecIfStep = z.infer<typeof SpecIfStepSchema>

export const SpecRememberStepSchema = SpecStepBaseSchema.extend({
  kind: z.literal('remember'),
  actions: z.array(SpecRememberActionSchema),
  next: TargetSchema,
})
export type SpecRememberStep = z.infer<typeof SpecRememberStepSchema>

export const SpecWaitStepSchema = SpecStepBaseSchema.extend({
  kind: z.literal('wait'),
  amount: z.number(),
  unit: WaitStepSchema.shape.unit,
  ifUserActs: WaitStepSchema.shape.ifUserActs,
  // With ifUserActs "cancel": the wait stops only when this holds, checked each time the user does
  // something and when the time is up.
  stopWhen: SpecConditionSchema.optional(),
  next: TargetSchema,
})
export type SpecWaitStep = z.infer<typeof SpecWaitStepSchema>

export const SpecDevStepSchema = SpecStepBaseSchema.extend({
  kind: z.literal('devStep'),
  // Verbatim, multi-line.
  description: z.string(),
  uses: z.array(RefSchema),
  sets: z.array(RefSchema),
  outcomes: z.array(z.object({ label: z.string(), goTo: TargetSchema })),
})
export type SpecDevStep = z.infer<typeof SpecDevStepSchema>

// A price line: its label per language and its amount in the smallest unit of the currency.
const SpecPriceSchema = z.object({ label: LangTextDef, amount: z.number() })

export const SpecInvoiceSchema = def(
  z.object({
    title: LangTextDef,
    description: LangTextDef,
    // photo_url: the developer hosts this file.
    photo: MediaRefSchema.optional(),
    // XTR for Telegram Stars, else a card currency (ISO 4217).
    currency: z.string(),
    prices: z.array(SpecPriceSchema),
    // A Stars subscription: paid again every 30 days (subscription_period, createInvoiceLink).
    subscription: z.object({ periodDays: z.number() }).optional(),
    // Physical goods or services (cards allowed); left out: digital goods, sold only in Stars.
    physical: z
      .object({
        needName: z.boolean(),
        needPhone: z.boolean(),
        needEmail: z.boolean(),
        needAddress: z.boolean(),
        // is_flexible: the bot answers each shipping_query with `shippingOptions`.
        flexibleShipping: z.boolean(),
        // `id` is the ShippingOption id to send; its one price line is labeled with its title.
        shippingOptions: z.array(z.object({ id: z.string(), title: LangTextDef, amount: z.number() })),
      })
      .optional(),
    // invoice_payload: the step's ID name unless the design gives another.
    payload: z.string(),
  }),
  'Invoice',
  'What an invoice sells, as sendInvoice takes it: amounts in the smallest unit of the currency.',
)
export type SpecInvoice = z.infer<typeof SpecInvoiceSchema>

export const SpecInvoiceStepSchema = SpecStepBaseSchema.extend({
  kind: z.literal('invoice'),
  invoice: SpecInvoiceSchema,
  // Inline only; its first button is the pay button; null: Telegram's own "Pay" button.
  keyboard: SpecKeyboardSchema,
  options: OptionsDef,
  // The pre-checkout check: what the developer checks, and the message when it refuses
  // (answerPreCheckoutQuery ok false, error_message); null: always ok.
  checkout: z.object({ description: z.string(), refuse: LangTextDef }).nullable(),
  // Paid: where the user goes once message.successful_payment arrives.
  next: TargetSchema,
  // How it is sent (sendInvoice, or createInvoiceLink for a subscription, its link in a url
  // button in place of the pay button), and the updates of a payment with the calls that answer
  // them, in order.
  telegram: SpecSendTelegramSchema.extend({ payment: z.array(z.string()) }),
})
export type SpecInvoiceStep = z.infer<typeof SpecInvoiceStepSchema>

// A Telegram action without a message. `step` and `onStep` name the step whose last sent message it
// acts on (`userMessage`: the user's last message); null: none chosen yet (for unpin: the newest
// pinned message).
export const SpecActionStepSchema = SpecStepBaseSchema.extend({
  kind: z.literal('action'),
  action: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('react'),
      emoji: z.string(),
      onStep: z.union([z.literal('userMessage'), RefSchema]).nullable(),
      big: z.boolean().optional(),
    }),
    z.object({ type: z.literal('pin'), step: RefSchema.nullable() }),
    z.object({ type: z.literal('unpin'), step: RefSchema.nullable() }),
    z.object({ type: z.literal('delete'), step: RefSchema.nullable() }),
    // Which gift in words (find its gift_id with getAvailableGifts), its text, and whether the bot
    // pays for its upgrade.
    z.object({
      type: z.literal('gift'),
      giftDescription: z.string(),
      text: SpecTextSchema.optional(),
      payForUpgrade: z.boolean().optional(),
    }),
    z.object({ type: z.literal('chatAction'), action: ChatActionSchema }),
    // Gives back the user's Stars payment of `invoice` (refundStarPayment).
    z.object({ type: z.literal('refund'), invoice: RefSchema.nullable() }),
  ]),
  next: TargetSchema,
  // The method, and its own parameters that follow from the action, by their Bot API names:
  // reaction and is_big, pay_for_upgrade, action.
  telegram: z.object({
    method: z.string(),
    params: z
      .record(
        z.string(),
        z.union([z.string(), z.boolean(), z.array(z.object({ type: z.string(), emoji: z.string() }))]),
      )
      .optional(),
  }),
})
export type SpecActionStep = z.infer<typeof SpecActionStepSchema>

export const SpecGoToStepSchema = SpecStepBaseSchema.extend({ kind: z.literal('goTo'), target: TargetSchema })
export type SpecGoToStep = z.infer<typeof SpecGoToStepSchema>

export const SpecEndStepSchema = SpecStepBaseSchema.extend({ kind: z.literal('end') })
export type SpecEndStep = z.infer<typeof SpecEndStepSchema>

export const SpecStepSchema = def(
  z.discriminatedUnion('kind', [
    SpecMessageStepSchema,
    SpecQuestionStepSchema,
    SpecIfStepSchema,
    SpecRememberStepSchema,
    SpecWaitStepSchema,
    SpecDevStepSchema,
    SpecGoToStepSchema,
    SpecEndStepSchema,
    SpecInvoiceStepSchema,
    SpecActionStepSchema,
  ]),
  'Step',
  'A step: a box on the map with its arrows by ID name.',
)
export type SpecStep = z.infer<typeof SpecStepSchema>

// A sticky note for the team.
export const SpecNoteSchema = SpecBoxSchema.extend({
  text: z.string(),
  color: z.string(),
  // The steps of the note's section.
  steps: z.array(RefSchema),
})
export type SpecNote = z.infer<typeof SpecNoteSchema>

// A section frame of the map; `steps` are the boxes inside it.
export const SpecSectionSchema = SpecBoxSchema.extend({
  width: z.number(),
  height: z.number(),
  color: z.string(),
  steps: z.array(RefSchema),
})
export type SpecSection = z.infer<typeof SpecSectionSchema>

export const SpecPartSchema = z.discriminatedUnion('kind', [
  z.object({
    id: IdNameDef,
    kind: z.literal('rows'),
    name: z.string(),
    place: z.enum(['inline', 'reply']),
    rows: z.array(z.array(SpecButtonSchema)),
  }),
  z.object({ id: IdNameDef, kind: z.literal('text'), name: z.string(), text: SpecTextSchema }),
])
export type SpecPart = z.infer<typeof SpecPartSchema>

export const SpecVariableSchema = VariableSchema.omit({ id: true, idName: true, idNameFixed: true }).extend({
  id: IdNameDef,
})
export type SpecVariable = z.infer<typeof SpecVariableSchema>

export const SpecTestSwitchSchema = TestSwitchSchema.omit({ id: true, idName: true, idNameFixed: true }).extend({
  id: IdNameDef,
})
export type SpecTestSwitch = z.infer<typeof SpecTestSwitchSchema>

// An uploaded file in the zip's media folder, or a placeholder the developer fills.
export const SpecMediaSchema = z.union([
  z.object({
    id: RefSchema,
    kind: MediaKindSchema,
    // The path in the zip: media/<name>.<ext>.
    file: z.string(),
    // The file name it was uploaded with.
    name: z.string(),
    mime: z.string(),
    bytes: z.number(),
    width: z.number().optional(),
    height: z.number().optional(),
    durationMs: z.number().optional(),
  }),
  // `kind` is null for an album item, which may be a photo or a video.
  z.object({ id: RefSchema, kind: MediaKindSchema.nullable(), placeholder: z.string() }),
])
export type SpecMedia = z.infer<typeof SpecMediaSchema>

// An issue of the checks at export time (D-19); `where` names a step, `button` a button;
// `ignored` when the designer marked it "Ignore here" (warnings and good to know only).
export const SpecCheckSchema = z.object({
  level: z.enum(['error', 'warning', 'info']),
  code: z.string(),
  where: z.string(),
  button: z.string().optional(),
  language: LangSchema.optional(),
  message: z.string(),
  ignored: z.boolean().optional(),
})
export type SpecCheck = z.infer<typeof SpecCheckSchema>

export const SpecBotSchema = z.object({
  // The bot's username without the @, when the design names it (start links of design.md).
  username: z.string().optional(),
  name: LangTextDef,
  // The short description.
  about: LangTextDef,
  // "What can this bot do?"
  description: LangTextDef,
  photo: MediaRefSchema.nullable(),
  menuButton: z.enum(['commands', 'default']),
  // The command start points in the order of the commands menu.
  commandOrder: z.array(RefSchema),
  // The commands menu as setMyCommands takes it: the commands in the menu, in order.
  commands: z.array(z.object({ command: z.string(), description: LangTextDef, startPoint: RefSchema })),
})
export type SpecBot = z.infer<typeof SpecBotSchema>

export const SpecSchema = z.object({
  format: z.literal(SPEC_FORMAT),
  formatVersion: z.literal(SPEC_FORMAT_VERSION),
  exportedAt: z.string(),
  exportedBy: z.string(),
  design: z.object({ id: IdSchema, name: z.string(), docVersion: z.number(), versionName: z.string().nullable() }),
  telegram: z.object({ botApi: z.string(), chats: z.literal('private') }),
  languages: z.object({ default: LangSchema, all: z.array(LangSchema).min(1), rightToLeft: z.array(LangSchema) }),
  bot: SpecBotSchema,
  startPoints: z.array(SpecStartPointSchema),
  steps: z.array(SpecStepSchema),
  parts: z.array(SpecPartSchema),
  variables: z.array(SpecVariableSchema),
  testSwitches: z.array(SpecTestSwitchSchema),
  media: z.array(SpecMediaSchema),
  checks: z.array(SpecCheckSchema),
  notes: z.array(SpecNoteSchema),
  sections: z.array(SpecSectionSchema),
})
export type Spec = z.infer<typeof SpecSchema>

defs.add(SpecSchema, {
  title: `xDesign bot spec, format version ${String(SPEC_FORMAT_VERSION)}`,
  description: `spec.json of an xDesign export: one Telegram bot design, Bot API ${BOT_API}.`,
})

/**
 * The JSON Schema of spec.json (Zod 4's own output), as make gen writes it. It describes what a
 * reader accepts, so fields it does not know are allowed (section 6.6).
 */
export function specJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(SpecSchema, { metadata: defs, io: 'input' })
}
