// fromSpec: spec.json back to a plain design (import, docs/plan/06-export-and-claude-link.md
// section 6). ID names and texts are kept, every internal ID is fresh, positions are kept (a box
// without one is laid out in a grid), and the ID names become fixed (they were exported). A text
// without its rich document is read from its Telegram form (fromTelegram). A reference that
// names nothing in the spec is kept as it is; the checks report it. Older format versions go
// through SPEC_MIGRATIONS first.
import type { Action } from '../model/actions.ts'
import type { Button, ButtonBase, Keyboard, Row } from '../model/buttons.ts'
import type { Condition, ConditionItem, RememberAction, Value } from '../model/conditions.ts'
import type { Content, MediaSlot, RichMessageBlock } from '../model/content.ts'
import { plainMessage, validateDesign, type Design, type DesignProblem } from '../model/design.ts'
import type { ButtonId, Lang, MediaId, PartId, StepId, SwitchId, Target, VarId } from '../model/ids.ts'
import type { MediaItem, Part } from '../model/parts.ts'
import type { Step, StepBase } from '../model/steps.ts'
import type { RichText, RichTextRef } from '../model/texts.ts'
import type { Trigger } from '../model/triggers.ts'
import type { TestSwitch, Variable } from '../model/variables.ts'
import { fromTelegram } from '../text/from-telegram.ts'
import { newId } from '../ydoc/layout.ts'
import { renameRichRefs } from './rich.ts'
import {
  SPEC_FORMAT,
  SPEC_FORMAT_VERSION,
  SpecSchema,
  type Spec,
  type SpecActionStep,
  type SpecButton,
  type SpecCondition,
  type SpecConditionItem,
  type SpecContent,
  type SpecKeyboard,
  type SpecRememberAction,
  type SpecRichBlock,
  type SpecRow,
  type SpecStartPoint,
  type SpecStep,
  type SpecText,
  type SpecTrigger,
} from './schema.ts'

export type FromSpecResult =
  // `files`: the path in the zip of each uploaded file, by its media ID (its `serverId` is empty
  // until the importer uploads it).
  { ok: true; design: Design; files: Record<MediaId, string> } | { ok: false; problems: DesignProblem[] }

type SpecObject = Record<string, unknown>

/** The migration of each older format version to the next one (none yet: version 1 is the first). */
export const SPEC_MIGRATIONS: Readonly<Partial<Record<number, (spec: SpecObject) => SpecObject>>> = {}

/** Reads an export's spec.json as a new design, or lists its problems in plain words. */
export function fromSpec(input: unknown): FromSpecResult {
  const migrated = migrateSpec(input)
  if (!migrated.ok) return migrated
  const parsed = SpecSchema.safeParse(migrated.spec, { error: plainMessage })
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
      })),
    }
  }
  const problems = nameProblems(parsed.data)
  if (problems.length > 0) return { ok: false, problems }
  const { design, files } = build(parsed.data)
  const result = validateDesign(design)
  return result.ok ? { ok: true, design: result.design, files } : result
}

function migrateSpec(input: unknown): { ok: true; spec: unknown } | { ok: false; problems: DesignProblem[] } {
  // What is not an export of a known format version is left to the schema to describe.
  if (!isObject(input) || input.format !== SPEC_FORMAT || typeof input.formatVersion !== 'number') {
    return { ok: true, spec: input }
  }
  const version = input.formatVersion
  const problem = (message: string) => ({ ok: false as const, problems: [{ path: 'formatVersion', message }] })
  if (version > SPEC_FORMAT_VERSION) {
    return problem(`is ${String(version)}, newer than this xDesign reads (${String(SPEC_FORMAT_VERSION)})`)
  }
  let spec = input
  for (let from = version; from < SPEC_FORMAT_VERSION; from++) {
    const migrate = SPEC_MIGRATIONS[from]
    if (migrate === undefined) return problem(`is ${String(version)}, an old version this xDesign cannot read`)
    spec = migrate(spec)
  }
  return { ok: true, spec }
}

function isObject(value: unknown): value is SpecObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// ID names are unique across steps, buttons, variables, switches and parts (03 section 4), so
// every reference names one thing; a box is never named back or stay, which are targets.
function nameProblems(spec: Spec): DesignProblem[] {
  const problems: DesignProblem[] = []
  const names = new Set<string>()
  const name = (id: string, ...path: (string | number)[]) => {
    if (names.has(id)) {
      problems.push({
        path: path.join('.'),
        message: 'is the ID name of another step, button, variable, switch or part too',
      })
    }
    names.add(id)
  }
  const box = (id: string, ...path: (string | number)[]) => {
    if (id === 'back' || id === 'stay') {
      problems.push({ path: path.join('.'), message: 'should not be back or stay, which are special targets' })
    }
    name(id, ...path)
  }
  const buttonRows = (rows: readonly (SpecRow | SpecButton[])[], ...path: (string | number)[]) => {
    rows.forEach((row, r) => {
      // The buttons of a part placed in a keyboard are the part's own, listed in `parts`.
      if (!Array.isArray(row)) return
      row.forEach((button, b) => {
        name(button.id, ...path, r, b, 'id')
      })
    })
  }
  const keyboard = (value: SpecKeyboard, ...path: (string | number)[]) => {
    if (value?.type === 'inline' || value?.type === 'reply') buttonRows(value.rows, ...path, 'rows')
  }

  spec.startPoints.forEach((start, i) => {
    box(start.id, 'startPoints', i, 'id')
  })
  spec.steps.forEach((step, i) => {
    box(step.id, 'steps', i, 'id')
    if (step.kind === 'message') keyboard(step.keyboard, 'steps', i, 'keyboard')
    if (step.kind === 'question') keyboard(step.prompt.keyboard, 'steps', i, 'prompt', 'keyboard')
  })
  spec.notes.forEach((note, i) => {
    box(note.id, 'notes', i, 'id')
  })
  spec.sections.forEach((section, i) => {
    box(section.id, 'sections', i, 'id')
  })
  spec.parts.forEach((part, i) => {
    name(part.id, 'parts', i, 'id')
    if (part.kind === 'rows') buttonRows(part.rows, 'parts', i, 'rows')
  })
  spec.variables.forEach((variable, i) => {
    name(variable.id, 'variables', i, 'id')
  })
  spec.testSwitches.forEach((testSwitch, i) => {
    name(testSwitch.id, 'testSwitches', i, 'id')
  })
  const media = new Set<string>()
  spec.media.forEach((entry, i) => {
    if (media.has(entry.id)) problems.push({ path: `media.${String(i)}.id`, message: 'is the id of another file too' })
    media.add(entry.id)
  })
  return problems
}

type Ctx = {
  langs: readonly Lang[]
  // Fresh IDs by ID name; a name the spec does not have stays as it is.
  step: (name: string) => StepId
  variable: (name: string) => VarId
  switch: (name: string) => SwitchId
  part: (name: string) => PartId
  slot: (ref: string) => MediaSlot
  buttons: Record<ButtonId, Button>
}

// Boxes without a position are laid out in rows of this many.
const GRID_COLUMNS = 8
const GRID_X = 320
const GRID_Y = 240

function build(spec: Spec): { design: Design; files: Record<MediaId, string> } {
  const boxes = [...spec.startPoints, ...spec.steps, ...spec.notes, ...spec.sections]
  const fresh = (items: readonly { id: string }[]) => {
    const ids = new Map(items.map((item) => [item.id, newId()]))
    return (name: string) => ids.get(name) ?? name
  }
  const mediaIds = new Map<string, MediaId>()
  const placeholders = new Map<string, string>()
  for (const entry of spec.media) {
    if ('file' in entry) mediaIds.set(entry.id, newId())
    else placeholders.set(entry.id, entry.placeholder)
  }
  const ctx: Ctx = {
    langs: spec.languages.all,
    step: fresh(boxes),
    variable: fresh(spec.variables),
    switch: fresh(spec.testSwitches),
    part: fresh(spec.parts),
    slot: (ref) => {
      const description = placeholders.get(ref)
      return description === undefined ? { media: mediaIds.get(ref) ?? ref } : { placeholder: { description } }
    },
    buttons: {},
  }

  // The section each box is in.
  const frames = new Map<string, StepId>()
  for (const section of spec.sections) {
    for (const name of section.steps) frames.set(name, ctx.step(section.id))
  }
  const steps: Record<StepId, Step> = {}
  boxes.forEach((box, index) => {
    const fields = {
      id: ctx.step(box.id),
      idName: box.id,
      idNameFixed: true,
      title: box.title,
      x: box.x ?? (index % GRID_COLUMNS) * GRID_X,
      y: box.y ?? Math.floor(index / GRID_COLUMNS) * GRID_Y,
      note: box.note ?? undefined,
      frame: frames.get(box.id),
    }
    if ('kind' in box) steps[fields.id] = { ...fields, ...stepFields(ctx, box) }
    else if ('text' in box) steps[fields.id] = { ...fields, kind: 'note', text: box.text, color: box.color }
    else {
      steps[fields.id] = { ...fields, kind: 'frame', width: box.width, height: box.height, color: box.color }
    }
  })

  const parts: Record<PartId, Part> = {}
  for (const part of spec.parts) {
    const fields = { id: ctx.part(part.id), idName: part.id, idNameFixed: true, name: part.name }
    parts[fields.id] =
      part.kind === 'rows'
        ? {
            ...fields,
            kind: part.kind,
            place: part.place,
            rows: part.rows.map((row) => row.map((b) => button(ctx, b))),
          }
        : { ...fields, kind: part.kind, text: richText(ctx, part.text) }
  }
  const variables: Record<VarId, Variable> = {}
  for (const variable of spec.variables) {
    const id = ctx.variable(variable.id)
    variables[id] = { ...variable, id, idName: variable.id, idNameFixed: true }
  }
  const switches: Record<SwitchId, TestSwitch> = {}
  for (const testSwitch of spec.testSwitches) {
    const id = ctx.switch(testSwitch.id)
    switches[id] = { ...testSwitch, id, idName: testSwitch.id, idNameFixed: true }
  }
  const media: Record<MediaId, MediaItem> = {}
  const files: Record<MediaId, string> = {}
  for (const entry of spec.media) {
    const id = mediaIds.get(entry.id)
    if (!('file' in entry) || id === undefined) continue
    media[id] = {
      id,
      serverId: '',
      kind: entry.kind,
      name: entry.name,
      mime: entry.mime,
      bytes: entry.bytes,
      width: entry.width,
      height: entry.height,
      durationMs: entry.durationMs,
    }
    files[id] = entry.file
  }

  const { bot } = spec
  const design: Design = {
    formatVersion: 1,
    id: newId(),
    name: spec.design.name,
    languages: { default: spec.languages.default, list: spec.languages.all },
    bot: {
      ...(bot.username === undefined ? {} : { username: bot.username }),
      name: bot.name,
      about: bot.about,
      description: bot.description,
      photo: bot.photo === null ? undefined : ctx.slot(bot.photo),
      menuButton: bot.menuButton,
      commandOrder: bot.commandOrder.map(ctx.step),
    },
    steps,
    buttons: ctx.buttons,
    variables,
    switches,
    parts,
    media,
  }
  return { design, files }
}

// The fields of a step's own kind.
type KindFields<T> = T extends Step ? Omit<T, keyof StepBase> : never

function stepFields(ctx: Ctx, box: SpecStartPoint | SpecStep): KindFields<Step> {
  switch (box.kind) {
    case 'start':
      return { kind: box.kind, trigger: trigger(ctx, box.trigger), next: target(ctx, box.next) }
    case 'message':
      return {
        kind: box.kind,
        content: content(ctx, box.message),
        keyboard: keyboard(ctx, box.keyboard),
        options: box.options,
        next: target(ctx, box.next),
        onStop: target(ctx, box.onStop ?? null),
      }
    case 'question': {
      const { prompt, wrongAnswer, cancel } = box
      return {
        kind: box.kind,
        prompt: {
          content: content(ctx, prompt.message),
          keyboard: keyboard(ctx, prompt.keyboard),
          options: prompt.options,
        },
        expects: box.expects,
        checks: box.checks,
        saveTo: ctx.variable(box.saveTo),
        wrongAnswer: {
          message: richText(ctx, wrongAnswer.message),
          maxTries: wrongAnswer.maxTries,
          afterMaxTries: ref(ctx.step, wrongAnswer.afterMaxTries),
        },
        cancel: cancel === null ? undefined : { words: cancel.words, goTo: ref(ctx.step, cancel.goTo) },
        next: ref(ctx.step, box.next),
      }
    }
    case 'if':
      return {
        kind: box.kind,
        cases: box.cases.map((item) => ({
          id: newId(),
          label: item.label,
          when: condition(ctx, item.when),
          goTo: target(ctx, item.goTo),
        })),
        otherwise: target(ctx, box.otherwise),
      }
    case 'remember':
      return {
        kind: box.kind,
        actions: box.actions.map((action) => rememberAction(ctx, action)),
        next: target(ctx, box.next),
      }
    case 'wait':
      return {
        kind: box.kind,
        amount: box.amount,
        unit: box.unit,
        ifUserActs: box.ifUserActs,
        stopWhen: box.stopWhen && condition(ctx, box.stopWhen),
        next: target(ctx, box.next),
      }
    case 'devStep':
      return {
        kind: box.kind,
        description: box.description,
        uses: box.uses.map(ctx.variable),
        sets: box.sets.map(ctx.variable),
        outcomes: box.outcomes.map((outcome) => ({
          id: newId(),
          label: outcome.label,
          goTo: target(ctx, outcome.goTo),
        })),
      }
    case 'goTo':
      return { kind: box.kind, target: target(ctx, box.target) }
    case 'end':
      return { kind: box.kind }
    // The payload when it is the ID name is left out, as the design has it.
    case 'invoice': {
      const { invoice, checkout } = box
      const { physical } = invoice
      return {
        kind: box.kind,
        invoice: {
          title: invoice.title,
          description: invoice.description,
          photo: invoice.photo === undefined ? undefined : ctx.slot(invoice.photo),
          currency: invoice.currency,
          prices: invoice.prices,
          subscription: invoice.subscription,
          physical: physical && {
            ...physical,
            shippingOptions: physical.shippingOptions.map((option) => ({
              id: newId(),
              title: option.title,
              amount: option.amount,
            })),
          },
          payload: invoice.payload === box.id ? undefined : invoice.payload,
        },
        keyboard: keyboard(ctx, box.keyboard),
        options: box.options,
        checkout: checkout ?? undefined,
        next: target(ctx, box.next),
      }
    }
    case 'action':
      return { kind: box.kind, action: modelAction(ctx, box.action), next: target(ctx, box.next) }
  }
}

function modelAction(ctx: Ctx, action: SpecActionStep['action']): Action {
  switch (action.type) {
    case 'react':
      return {
        type: action.type,
        emoji: action.emoji,
        onStep: action.onStep === 'userMessage' ? action.onStep : ref(ctx.step, action.onStep),
        big: action.big,
      }
    case 'pin':
    case 'unpin':
    case 'delete':
      return { type: action.type, step: ref(ctx.step, action.step) }
    case 'gift':
      return {
        type: action.type,
        giftDescription: action.giftDescription,
        text: action.text && richText(ctx, action.text),
        payForUpgrade: action.payForUpgrade,
      }
    case 'chatAction':
      return action
    case 'refund':
      return { type: action.type, invoice: ref(ctx.step, action.invoice) }
  }
}

function trigger(ctx: Ctx, value: SpecTrigger): Trigger {
  switch (value.type) {
    case 'startLink':
      return {
        type: value.type,
        payload: value.payload,
        match: value.match,
        saveRestTo: ref(ctx.variable, value.saveRestTo),
      }
    case 'command':
    case 'fallback':
      return value
    case 'paymentDone':
    case 'refunded':
      return { type: value.type, invoice: ref(ctx.step, value.invoice) }
    case 'subscriptionChanged':
      return { type: value.type, invoice: ref(ctx.step, value.invoice), state: value.state ?? undefined }
    case 'userBlocks':
    case 'userRestarts':
      return value
    case 'broadcast':
      return {
        type: value.type,
        audience: value.audience === 'everyone' ? value.audience : condition(ctx, value.audience),
        when: value.when,
      }
  }
}

const target = (ctx: Ctx, value: string | null): Target | undefined =>
  value === null ? undefined : value === 'back' ? value : ctx.step(value)

const ref = <T extends string>(id: (name: string) => T, name: string | null): T | undefined =>
  name === null ? undefined : id(name)

// The rich document of each language, its references to fresh IDs, or the Telegram form read back.
function richText(ctx: Ctx, value: SpecText): RichTextRef {
  const doc: RichText = {}
  for (const lang of ctx.langs) {
    const form = value[lang]
    if (form === undefined) continue
    doc[lang] =
      form.rich === undefined
        ? fromTelegram({
            text: form.text,
            entities: form.entities,
            variables: form.variables.map((place) => ({ ...place, var: ctx.variable(place.var) })),
          })
        : renameRichRefs(form.rich, ctx.variable, ctx.part)
  }
  return { id: newId(), doc }
}

function content(ctx: Ctx, value: SpecContent): Content {
  const caption = (text: SpecText | undefined) => (text === undefined ? undefined : richText(ctx, text))
  switch (value.type) {
    case 'text':
      return { type: value.type, text: richText(ctx, value.text) }
    case 'photo':
    case 'livePhoto':
    case 'video':
    case 'animation':
      return {
        type: value.type,
        media: ctx.slot(value.media),
        caption: caption(value.caption),
        spoiler: value.spoiler,
        captionAbove: value.captionAbove,
      }
    case 'audio':
      return {
        type: value.type,
        media: ctx.slot(value.media),
        caption: caption(value.caption),
        title: value.title,
        performer: value.performer,
      }
    case 'voice':
    case 'document':
      return { type: value.type, media: ctx.slot(value.media), caption: caption(value.caption) }
    case 'videoNote':
    case 'sticker':
      return { type: value.type, media: ctx.slot(value.media) }
    case 'album':
      return {
        type: value.type,
        items: value.items.map((item) => ({
          media: ctx.slot(item.media),
          caption: caption(item.caption),
          spoiler: item.spoiler,
        })),
      }
    case 'location':
    case 'venue':
    case 'contact':
      return value
    case 'dice':
      return { ...value, saveTo: ref(ctx.variable, value.saveTo ?? null) }
    case 'poll':
      return { ...value, question: richText(ctx, value.question), saveTo: ref(ctx.variable, value.saveTo ?? null) }
    case 'quiz':
      return {
        ...value,
        question: richText(ctx, value.question),
        explanation: caption(value.explanation),
        saveTo: ref(ctx.variable, value.saveTo ?? null),
      }
    case 'paidMedia':
      return {
        type: value.type,
        items: value.items.map((item) => ({ media: ctx.slot(item.media) })),
        stars: value.stars,
        caption: caption(value.caption),
        captionAbove: value.captionAbove,
      }
    case 'rich':
      return { type: value.type, blocks: value.blocks.map((block) => richBlock(ctx, block)), rtl: value.rtl }
  }
}

function richBlock(ctx: Ctx, value: SpecRichBlock): RichMessageBlock {
  const caption = (text: SpecText | undefined) => (text === undefined ? undefined : richText(ctx, text))
  switch (value.type) {
    case 'paragraph':
    case 'footer':
    case 'heading':
    case 'code':
      return { ...value, text: richText(ctx, value.text) }
    case 'quote':
      return { ...value, text: richText(ctx, value.text), credit: caption(value.credit) }
    case 'list':
      return { ...value, items: value.items.map((item) => ({ ...item, text: richText(ctx, item.text) })) }
    case 'table':
      return {
        ...value,
        rows: value.rows.map((row) => ({
          cells: row.cells.map((cell) => ({ ...cell, text: richText(ctx, cell.text) })),
        })),
        caption: caption(value.caption),
      }
    case 'details':
      return { ...value, summary: richText(ctx, value.summary), text: richText(ctx, value.text) }
    case 'divider':
      return value
    case 'media':
      return { ...value, media: ctx.slot(value.media), caption: caption(value.caption) }
    case 'buttons':
      return { type: value.type, ids: value.buttons.map((item) => button(ctx, item)), align: value.align }
  }
}

function keyboard(ctx: Ctx, value: SpecKeyboard): Keyboard {
  if (value === null) return null
  switch (value.type) {
    case 'inline':
      return { type: value.type, rows: rows(ctx, value.rows), openReplyField: value.openReplyField }
    case 'reply':
      return { ...value, rows: rows(ctx, value.rows) }
    case 'removeReply':
    case 'forceReply':
      return value
  }
}

// A placed part keeps only its reference: its buttons are the part's own.
function rows(ctx: Ctx, value: readonly SpecRow[]): Row[] {
  return value.map((row) =>
    Array.isArray(row)
      ? { type: 'buttons', ids: row.map((item) => button(ctx, item)) }
      : { type: 'part', part: ctx.part(row.part) },
  )
}

function button(ctx: Ctx, value: SpecButton): ButtonId {
  const id = newId()
  const base: ButtonBase = {
    id,
    idName: value.id,
    idNameFixed: true,
    label: value.label,
    look: value.look,
    icon: value.icon ?? undefined,
  }
  const remember = (actions: readonly SpecRememberAction[] | undefined) =>
    actions?.map((item) => rememberAction(ctx, item))
  const action = value.does
  switch (action.type) {
    case 'goTo':
      ctx.buttons[id] = {
        ...base,
        place: 'inline',
        disabled: value.disabled,
        action: {
          type: action.type,
          target: action.target === 'stay' ? action.target : target(ctx, action.target),
          show: action.show,
          popup: action.popup ?? undefined,
          remember: remember(action.remember),
        },
      }
      break
    case 'url':
    case 'copyText':
    case 'loginUrl':
    case 'pay':
      ctx.buttons[id] = { ...base, place: 'inline', disabled: value.disabled, action }
      break
    case 'text':
      ctx.buttons[id] = {
        ...base,
        place: 'reply',
        action: { type: action.type, goTo: target(ctx, action.goTo), remember: remember(action.remember) },
      }
      break
    default:
      ctx.buttons[id] = {
        ...base,
        place: 'reply',
        action: { ...action, goTo: ref(ctx.step, action.goTo), saveTo: ref(ctx.variable, action.saveTo) },
      }
  }
  return id
}

const modelValue = (ctx: Ctx, item: string | number | boolean | { var: string }): Value =>
  typeof item === 'object' ? { var: ctx.variable(item.var) } : item

function rememberAction(ctx: Ctx, action: SpecRememberAction): RememberAction {
  return {
    var: ctx.variable(action.var),
    op: action.op,
    value: action.value === undefined ? undefined : modelValue(ctx, action.value),
  }
}

function condition(ctx: Ctx, when: SpecCondition): Condition {
  const item = (part: SpecConditionItem): ConditionItem => {
    if ('var' in part) {
      return {
        var: ctx.variable(part.var),
        op: part.op,
        value: part.value === undefined ? undefined : modelValue(ctx, part.value),
      }
    }
    if ('switch' in part) return { switch: ctx.switch(part.switch), is: part.is }
    if ('hasPaid' in part) return { hasPaid: ctx.step(part.hasPaid) }
    if ('subscribed' in part) return { subscribed: ctx.step(part.subscribed) }
    return part
  }
  return 'all' in when ? { all: when.all.map(item) } : { any: when.any.map(item) }
}
