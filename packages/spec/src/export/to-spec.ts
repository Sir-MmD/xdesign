// toSpec: a plain design (SPEC-01) as spec.json version 1 (docs/plan/03-design-model.md section 6).
// Collections are listed in ID name order, so two exports of an unchanged design are the same.
// Uploaded files keep the name `mediaFile` gives them; a placeholder gets an id from where it is
// used (`<step>_media`, `<step>_media_<n>` for album items, `bot_photo`). Buttons no keyboard or
// part uses are left out (tidy removes them anyway).
import type { Action } from '../model/actions.ts'
import type { Button, Keyboard, Row } from '../model/buttons.ts'
import type { Condition, ConditionItem, RememberAction, Value } from '../model/conditions.ts'
import type { Content, MediaSlot, RichMessageBlock } from '../model/content.ts'
import type { Design } from '../model/design.ts'
import type { ButtonId, Lang, Target, VarId } from '../model/ids.ts'
import type { MediaItem, MediaKind } from '../model/parts.ts'
import { draftStops, type Step, stopTarget } from '../model/steps.ts'
import type { LangText, RichTextRef } from '../model/texts.ts'
import type { Trigger } from '../model/triggers.ts'
import { BOT_API } from '../telegram/version.ts'
import { toTelegram } from '../text/to-telegram.ts'
import { renameRichRefs } from './rich.ts'
import {
  SPEC_FORMAT,
  SPEC_FORMAT_VERSION,
  type Spec,
  type SpecAction,
  type SpecActionStep,
  type SpecButton,
  type SpecCheck,
  type SpecCondition,
  type SpecConditionItem,
  type SpecContent,
  type SpecKeyboard,
  type SpecMedia,
  type SpecNote,
  type SpecPart,
  type SpecRememberAction,
  type SpecRichBlock,
  type SpecRow,
  type SpecSection,
  type SpecStartPoint,
  type SpecStep,
  type SpecText,
  type SpecTrigger,
} from './schema.ts'
import {
  actionTelegram,
  buttonTelegram,
  invoiceTelegram,
  sendTelegram,
  startTelegram,
  waitsFor,
  type Shown,
  type ShownStep,
} from './telegram.ts'

export type ToSpecOptions = {
  /** Only these languages, with the default one always; every language of the design by default. */
  languages?: readonly Lang[]
  /** The issues of the checks at export time (SPEC-05); IDs in `where` and `button` become ID names. */
  checks?: readonly SpecCheck[]
  /** The app and its version: "xDesign 1.0.0". */
  exportedBy: string
  /** When, as an ISO 8601 time. */
  exportedAt: string
  /** The version of the design's document the export was made from, and its name if it has one. */
  docVersion: number
  versionName?: string | null
  /** The path of an uploaded file in the zip: `media/<idName or hash>.<ext>`. */
  mediaFile: (item: MediaItem) => string
}

// Languages written right to left, by their primary subtag.
const RIGHT_TO_LEFT = new Set(['ar', 'arc', 'ckb', 'dv', 'fa', 'he', 'ps', 'sd', 'ug', 'ur', 'yi'])

type Ctx = {
  design: Design
  langs: readonly Lang[]
  // ID names by ID; an ID that names nothing stays as it is.
  step: (id: string) => string
  button: (id: string) => string
  variable: (id: string) => string
  switch: (id: string) => string
  part: (id: string) => string
  // The arrows into each step, by the ID name of where they start.
  cameFrom: Map<string, Set<string>>
  // Uploaded files by media ID, then the placeholders as they are met.
  files: Map<string, string>
  media: SpecMedia[]
  mediaIds: Set<string>
}

const nameOf =
  (items: Readonly<Record<string, { idName: string } | undefined>>) =>
  (id: string): string =>
    items[id]?.idName ?? id

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
const byIdName = (a: { idName: string }, b: { idName: string }) => compare(a.idName, b.idName)

/** The export of a design: spec.json, version 1. */
export function toSpec(design: Design, options: ToSpecOptions): Spec {
  const { languages } = design
  const langs = languages.list.filter(
    (lang) => lang === languages.default || options.languages?.includes(lang) !== false,
  )
  const ctx: Ctx = {
    design,
    langs,
    step: nameOf(design.steps),
    button: nameOf(design.buttons),
    variable: nameOf(design.variables),
    switch: nameOf(design.switches),
    part: nameOf(design.parts),
    cameFrom: arrowsInto(design),
    files: new Map(),
    media: [],
    mediaIds: new Set(),
  }
  const uploaded = Object.values(design.media)
    .map((item) => ({ item, file: options.mediaFile(item) }))
    .sort((a, b) => compare(a.file, b.file) || compare(a.item.id, b.item.id))
  for (const { item, file } of uploaded) {
    const id = freeMediaId(ctx, fileStem(file))
    ctx.files.set(item.id, id)
    ctx.media.push({
      id,
      kind: item.kind,
      file,
      name: item.name,
      mime: item.mime,
      bytes: item.bytes,
      width: item.width,
      height: item.height,
      durationMs: item.durationMs,
    })
  }

  const boxes = Object.values(design.steps).sort(byIdName)
  const startPoints: SpecStartPoint[] = []
  const steps: SpecStep[] = []
  const notes: SpecNote[] = []
  const sections: SpecSection[] = []
  for (const box of boxes) {
    switch (box.kind) {
      case 'start':
        startPoints.push({
          id: box.idName,
          kind: box.kind,
          ...boxFields(ctx, box),
          trigger: trigger(ctx, box.trigger),
          next: target(ctx, box.next),
          telegram: startTelegram(box.trigger),
          cameFrom: cameFrom(ctx, box),
        })
        break
      case 'note':
        notes.push({
          id: box.idName,
          ...boxFields(ctx, box),
          text: box.text,
          color: box.color,
          steps:
            box.frame === undefined
              ? []
              : boxes
                  .filter((other) => other.frame === box.frame && other.kind !== 'note' && other.kind !== 'frame')
                  .map((other) => other.idName),
        })
        break
      case 'frame':
        sections.push({
          id: box.idName,
          ...boxFields(ctx, box),
          width: box.width,
          height: box.height,
          color: box.color,
          steps: boxes.filter((other) => other.frame === box.id).map((other) => other.idName),
        })
        break
      default:
        steps.push(step(ctx, box))
    }
  }

  const parts = Object.values(design.parts)
    .sort(byIdName)
    .map((part): SpecPart => {
      return part.kind === 'rows'
        ? {
            id: part.idName,
            kind: part.kind,
            name: part.name,
            place: part.place,
            rows: part.rows.map((ids) => buttons(ctx, ids)),
          }
        : { id: part.idName, kind: part.kind, name: part.name, text: text(ctx, part.text) }
    })
  const { bot } = design
  const specBot: Spec['bot'] = {
    ...(bot.username === undefined ? {} : { username: bot.username }),
    name: langText(ctx, bot.name),
    about: langText(ctx, bot.about),
    description: langText(ctx, bot.description),
    photo: bot.photo === undefined ? null : slot(ctx, bot.photo, 'bot_photo', 'photo'),
    menuButton: bot.menuButton,
    commandOrder: bot.commandOrder.map(ctx.step),
    commands: bot.commandOrder.flatMap((id) => {
      const start = design.steps[id]
      if (start?.kind !== 'start' || start.trigger.type !== 'command' || !start.trigger.inMenu) return []
      return [
        {
          command: start.trigger.command,
          description: langText(ctx, start.trigger.menuDescription),
          startPoint: start.idName,
        },
      ]
    }),
  }

  return {
    format: SPEC_FORMAT,
    formatVersion: SPEC_FORMAT_VERSION,
    exportedAt: options.exportedAt,
    exportedBy: options.exportedBy,
    design: {
      id: design.id,
      name: design.name,
      docVersion: options.docVersion,
      versionName: options.versionName ?? null,
    },
    telegram: { botApi: BOT_API, chats: 'private' },
    languages: {
      default: languages.default,
      all: [...langs],
      rightToLeft: langs.filter((lang) => RIGHT_TO_LEFT.has(lang.split('-')[0] ?? lang)),
    },
    bot: specBot,
    startPoints,
    steps,
    parts,
    variables: Object.values(design.variables)
      .sort(byIdName)
      .map((variable) => ({
        id: variable.idName,
        label: variable.label,
        type: variable.type,
        source: variable.source,
        description: variable.description,
        testValue: variable.testValue,
      })),
    testSwitches: Object.values(design.switches)
      .sort(byIdName)
      .map((testSwitch) => ({
        id: testSwitch.idName,
        label: testSwitch.label,
        type: testSwitch.type,
        options: testSwitch.options,
        testValue: testSwitch.testValue,
        description: testSwitch.description,
      })),
    media: ctx.media,
    checks: (options.checks ?? []).map((issue) => ({
      level: issue.level,
      code: issue.code,
      where:
        [ctx.step, ctx.button, ctx.variable, ctx.switch, ctx.part]
          .map((name) => name(issue.where))
          .find((name) => name !== issue.where) ?? issue.where,
      button: issue.button === undefined ? undefined : ctx.button(issue.button),
      language: issue.language,
      message: issue.message,
      ignored: issue.ignored,
    })),
    notes,
    sections,
  }
}

// The fields of every box: a step, a start point, a note or a section.
function boxFields(ctx: Ctx, box: Step) {
  const frame = box.frame === undefined ? undefined : ctx.design.steps[box.frame]
  return {
    title: box.title,
    section: frame?.kind === 'frame' ? frame.title : null,
    note: box.note ?? null,
    x: box.x,
    y: box.y,
  }
}

const cameFrom = (ctx: Ctx, box: Step) => [...(ctx.cameFrom.get(box.id) ?? [])]

function step(ctx: Ctx, box: Exclude<Step, { kind: 'start' | 'note' | 'frame' }>): SpecStep {
  const fields = boxFields(ctx, box)
  switch (box.kind) {
    case 'message': {
      const shown: Shown = { content: box.content, keyboard: box.keyboard, options: box.options }
      return {
        id: box.idName,
        kind: box.kind,
        ...fields,
        message: content(ctx, box.content, box.idName, shown),
        keyboard: keyboard(ctx, box.keyboard, shown),
        options: box.options,
        next: target(ctx, box.next),
        ...(draftStops(box) && { onStop: target(ctx, box.onStop) }),
        telegram: sendTelegram(shown, draftStops(box)),
        cameFrom: cameFrom(ctx, box),
      }
    }
    case 'question': {
      const { prompt, wrongAnswer, cancel } = box
      const shown: Shown = { content: prompt.content, keyboard: prompt.keyboard, options: prompt.options }
      return {
        id: box.idName,
        kind: box.kind,
        ...fields,
        prompt: {
          message: content(ctx, prompt.content, box.idName, shown),
          keyboard: keyboard(ctx, prompt.keyboard, shown),
          options: prompt.options,
        },
        expects: box.expects,
        checks: box.checks,
        saveTo: ctx.variable(box.saveTo),
        wrongAnswer: {
          message: text(ctx, wrongAnswer.message),
          maxTries: wrongAnswer.maxTries,
          afterMaxTries: ref(ctx.step, wrongAnswer.afterMaxTries),
        },
        cancel: cancel === undefined ? null : { words: langText(ctx, cancel.words), goTo: ref(ctx.step, cancel.goTo) },
        next: ref(ctx.step, box.next),
        telegram: { ...sendTelegram(shown), waitsFor: waitsFor(box.expects) },
        cameFrom: cameFrom(ctx, box),
      }
    }
    case 'if':
      return {
        id: box.idName,
        kind: box.kind,
        ...fields,
        cases: box.cases.map((item) => {
          const when = condition(ctx, item.when)
          return { label: item.label, when, say: say(when), goTo: target(ctx, item.goTo) }
        }),
        otherwise: target(ctx, box.otherwise),
        cameFrom: cameFrom(ctx, box),
      }
    case 'remember':
      return {
        id: box.idName,
        kind: box.kind,
        ...fields,
        actions: box.actions.map((action) => rememberAction(ctx, action)),
        next: target(ctx, box.next),
        cameFrom: cameFrom(ctx, box),
      }
    case 'wait':
      return {
        id: box.idName,
        kind: box.kind,
        ...fields,
        amount: box.amount,
        unit: box.unit,
        ifUserActs: box.ifUserActs,
        stopWhen: box.stopWhen && condition(ctx, box.stopWhen),
        next: target(ctx, box.next),
        cameFrom: cameFrom(ctx, box),
      }
    case 'devStep':
      return {
        id: box.idName,
        kind: box.kind,
        ...fields,
        description: box.description,
        uses: box.uses.map(ctx.variable),
        sets: box.sets.map(ctx.variable),
        outcomes: box.outcomes.map((outcome) => ({ label: outcome.label, goTo: target(ctx, outcome.goTo) })),
        cameFrom: cameFrom(ctx, box),
      }
    case 'goTo':
      return {
        id: box.idName,
        kind: box.kind,
        ...fields,
        target: target(ctx, box.target),
        cameFrom: cameFrom(ctx, box),
      }
    case 'end':
      return { id: box.idName, kind: box.kind, ...fields, cameFrom: cameFrom(ctx, box) }
    case 'invoice': {
      const { invoice, checkout } = box
      const { physical } = invoice
      return {
        id: box.idName,
        kind: box.kind,
        ...fields,
        invoice: {
          title: langText(ctx, invoice.title),
          description: langText(ctx, invoice.description),
          photo: invoice.photo && slot(ctx, invoice.photo, `${box.idName}_photo`, 'photo'),
          currency: invoice.currency,
          prices: invoice.prices.map((price) => ({ label: langText(ctx, price.label), amount: price.amount })),
          subscription: invoice.subscription,
          physical: physical && {
            ...physical,
            shippingOptions: physical.shippingOptions.map((option, index) => ({
              id: `${box.idName}_shipping_${String(index + 1)}`,
              title: langText(ctx, option.title),
              amount: option.amount,
            })),
          },
          payload: invoice.payload ?? box.idName,
        },
        keyboard: keyboard(ctx, box.keyboard, 'invoice'),
        options: box.options,
        checkout: checkout ? { description: checkout.description, refuse: langText(ctx, checkout.refuse) } : null,
        next: target(ctx, box.next),
        telegram: invoiceTelegram(box),
        cameFrom: cameFrom(ctx, box),
      }
    }
    case 'action':
      return {
        id: box.idName,
        kind: box.kind,
        ...fields,
        action: specAction(ctx, box.action),
        next: target(ctx, box.next),
        telegram: actionTelegram(box.action),
        cameFrom: cameFrom(ctx, box),
      }
  }
}

function specAction(ctx: Ctx, action: Action): SpecActionStep['action'] {
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
        text: action.text && text(ctx, action.text),
        payForUpgrade: action.payForUpgrade,
      }
    case 'chatAction':
      return action
    case 'refund':
      return { type: action.type, invoice: ref(ctx.step, action.invoice) }
  }
}

function trigger(ctx: Ctx, value: Trigger): SpecTrigger {
  switch (value.type) {
    case 'command':
      return { ...value, menuDescription: langText(ctx, value.menuDescription) }
    case 'startLink':
      return {
        type: value.type,
        payload: value.payload,
        match: value.match,
        saveRestTo: ref(ctx.variable, value.saveRestTo),
      }
    case 'fallback':
      return value
    case 'paymentDone':
    case 'refunded':
      return { type: value.type, invoice: ref(ctx.step, value.invoice) }
    case 'subscriptionChanged':
      return { type: value.type, invoice: ref(ctx.step, value.invoice), state: value.state ?? null }
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

const target = (ctx: Ctx, value: Target | undefined): string | null =>
  value === undefined ? null : value === 'back' ? value : ctx.step(value)

const ref = (name: (id: string) => string, id: string | undefined): string | null =>
  id === undefined ? null : name(id)

function langText(ctx: Ctx, value: LangText): LangText {
  const out: LangText = {}
  for (const lang of ctx.langs) {
    const item = value[lang]
    if (item !== undefined) out[lang] = item
  }
  return out
}

// A text in every exported language that has it: the three Telegram forms and the rich document.
function text(ctx: Ctx, value: RichTextRef): SpecText {
  const out: SpecText = {}
  for (const lang of ctx.langs) {
    const doc = value.doc[lang]
    if (doc === undefined) continue
    const telegram = toTelegram(doc, {
      varName: ctx.variable,
      part: (id) => {
        const part = ctx.design.parts[id]
        return part?.kind === 'text' ? part.text.doc[lang] : undefined
      },
    })
    out[lang] = {
      text: telegram.text,
      entities: telegram.entities,
      html: telegram.html,
      variables: telegram.variables.map((place) => ({ ...place, var: ctx.variable(place.var) })),
      rich: renameRichRefs(doc, ctx.variable, ctx.part),
    }
  }
  return out
}

function fileStem(file: string): string {
  const stem = file
    .slice(file.lastIndexOf('/') + 1)
    .replace(/\.[^.]*$/, '')
    .replace(/[^\w-]+/g, '_')
    .slice(0, 56)
  return stem === '' ? 'media' : stem
}

function freeMediaId(ctx: Ctx, base: string): string {
  let id = base
  for (let n = 2; ctx.mediaIds.has(id); n++) id = `${base}_${String(n)}`
  ctx.mediaIds.add(id)
  return id
}

// A media slot as the id of its entry in `media`; a placeholder adds its entry.
function slot(ctx: Ctx, value: MediaSlot, where: string, kind: MediaKind | null): string {
  if ('media' in value) return ctx.files.get(value.media) ?? value.media
  const id = freeMediaId(ctx, where)
  ctx.media.push({ id, kind, placeholder: value.placeholder.description })
  return id
}

function content(ctx: Ctx, value: Content, where: string, source: Shown): SpecContent {
  const caption = (ref: RichTextRef | undefined) => (ref === undefined ? undefined : text(ctx, ref))
  const saveTo = (id: VarId | undefined) => (id === undefined ? undefined : ctx.variable(id))
  const media = `${where}_media`
  switch (value.type) {
    case 'text':
      return { type: value.type, text: text(ctx, value.text) }
    case 'photo':
    case 'livePhoto':
    case 'video':
    case 'animation':
      return {
        type: value.type,
        media: slot(ctx, value.media, media, value.type),
        caption: caption(value.caption),
        spoiler: value.spoiler,
        captionAbove: value.captionAbove,
      }
    case 'audio':
      return {
        type: value.type,
        media: slot(ctx, value.media, media, value.type),
        caption: caption(value.caption),
        title: value.title,
        performer: value.performer,
      }
    case 'voice':
    case 'document':
      return { type: value.type, media: slot(ctx, value.media, media, value.type), caption: caption(value.caption) }
    case 'videoNote':
    case 'sticker':
      return { type: value.type, media: slot(ctx, value.media, media, value.type) }
    case 'album':
      return {
        type: value.type,
        items: value.items.map((item, index) => ({
          media: slot(ctx, item.media, `${media}_${String(index + 1)}`, null),
          caption: caption(item.caption),
          spoiler: item.spoiler,
        })),
      }
    case 'location':
    case 'venue':
    case 'contact':
      return value
    case 'dice':
      return { ...value, saveTo: saveTo(value.saveTo) }
    case 'poll':
      return {
        ...value,
        question: text(ctx, value.question),
        options: value.options.map((item) => langText(ctx, item)),
        saveTo: saveTo(value.saveTo),
      }
    case 'quiz':
      return {
        ...value,
        question: text(ctx, value.question),
        options: value.options.map((item) => langText(ctx, item)),
        explanation: caption(value.explanation),
        saveTo: saveTo(value.saveTo),
      }
    case 'paidMedia':
      return {
        type: value.type,
        items: value.items.map((item, index) => ({
          media: slot(ctx, item.media, `${media}_${String(index + 1)}`, null),
        })),
        stars: value.stars,
        caption: caption(value.caption),
        captionAbove: value.captionAbove,
      }
    case 'rich':
      return {
        type: value.type,
        blocks: value.blocks.map((block, index) => richBlock(ctx, block, `${media}_${String(index + 1)}`, source)),
        rtl: value.rtl,
      }
  }
}

// A rich message's block; a media block's placeholder is `<step>_media_<block>`.
function richBlock(ctx: Ctx, value: RichMessageBlock, media: string, source: Shown): SpecRichBlock {
  const caption = (ref: RichTextRef | undefined) => (ref === undefined ? undefined : text(ctx, ref))
  switch (value.type) {
    case 'paragraph':
    case 'footer':
    case 'heading':
    case 'code':
      return { ...value, text: text(ctx, value.text) }
    case 'quote':
      return { ...value, text: text(ctx, value.text), credit: caption(value.credit) }
    case 'list':
      return { ...value, items: value.items.map((item) => ({ ...item, text: text(ctx, item.text) })) }
    case 'table':
      return {
        ...value,
        rows: value.rows.map((row) => ({ cells: row.cells.map((cell) => ({ ...cell, text: text(ctx, cell.text) })) })),
        caption: caption(value.caption),
      }
    case 'details':
      return { ...value, summary: text(ctx, value.summary), text: text(ctx, value.text) }
    case 'divider':
      return value
    case 'media':
      return { ...value, media: slot(ctx, value.media, media, null), caption: caption(value.caption) }
    case 'buttons':
      return { type: value.type, buttons: buttons(ctx, value.ids, source), align: value.align }
  }
}

function keyboard(ctx: Ctx, value: Keyboard, source: ShownStep): SpecKeyboard {
  if (value === null) return null
  switch (value.type) {
    case 'inline':
      return { type: value.type, rows: rows(ctx, value.rows, source), openReplyField: value.openReplyField }
    case 'reply':
      return {
        ...value,
        rows: rows(ctx, value.rows, source),
        placeholder: value.placeholder === undefined ? undefined : langText(ctx, value.placeholder),
      }
    case 'removeReply':
      return value
    case 'forceReply':
      return {
        type: value.type,
        placeholder: value.placeholder === undefined ? undefined : langText(ctx, value.placeholder),
      }
  }
}

// The rows of a keyboard, a row part expanded where it is placed.
function rows(ctx: Ctx, value: readonly Row[], source: ShownStep): SpecRow[] {
  return value.map((row) => {
    if (row.type === 'buttons') return buttons(ctx, row.ids, source)
    const part = ctx.design.parts[row.part]
    return {
      part: ctx.part(row.part),
      buttons: part?.kind === 'rows' ? part.rows.map((ids) => buttons(ctx, ids, source)) : [],
    }
  })
}

// Buttons in the message `source` they are shown in get their `telegram` block.
function buttons(ctx: Ctx, ids: readonly ButtonId[], source?: ShownStep): SpecButton[] {
  return ids.flatMap((id) => {
    const value = ctx.design.buttons[id]
    if (value === undefined) return []
    return [
      {
        id: value.idName,
        label: langText(ctx, value.label),
        look: value.look,
        icon: value.icon ?? null,
        disabled: value.place === 'inline' ? value.disabled : undefined,
        does: action(ctx, value),
        telegram: source === undefined ? undefined : buttonTelegram(value, source, ctx.design),
      },
    ]
  })
}

function action(ctx: Ctx, value: Button): SpecAction {
  const remember = (actions: readonly RememberAction[] | undefined) => actions?.map((item) => rememberAction(ctx, item))
  if (value.place === 'inline') {
    const { action } = value
    switch (action.type) {
      case 'goTo':
        return {
          type: action.type,
          target: action.target === 'stay' ? action.target : target(ctx, action.target),
          show: action.show,
          popup:
            action.popup === undefined ? null : { kind: action.popup.kind, text: langText(ctx, action.popup.text) },
          remember: remember(action.remember),
        }
      case 'copyText':
        return { type: action.type, text: langText(ctx, action.text) }
      case 'url':
      case 'loginUrl':
      case 'pay':
        return action
    }
  }
  const { action } = value
  if (action.type === 'text')
    return { type: action.type, goTo: target(ctx, action.goTo), remember: remember(action.remember) }
  return { ...action, goTo: ref(ctx.step, action.goTo), saveTo: ref(ctx.variable, action.saveTo) }
}

const specValue = (ctx: Ctx, item: Value) => (typeof item === 'object' ? { var: ctx.variable(item.var) } : item)

function rememberAction(ctx: Ctx, action: RememberAction): SpecRememberAction {
  return {
    var: ctx.variable(action.var),
    op: action.op,
    value: action.value === undefined ? undefined : specValue(ctx, action.value),
  }
}

function condition(ctx: Ctx, when: Condition): SpecCondition {
  const item = (part: ConditionItem): SpecConditionItem => {
    if ('var' in part) {
      return {
        var: ctx.variable(part.var),
        op: part.op,
        value: part.value === undefined ? undefined : specValue(ctx, part.value),
      }
    }
    if ('switch' in part) return { switch: ctx.switch(part.switch), is: part.is }
    if ('hasPaid' in part) return { hasPaid: ctx.step(part.hasPaid) }
    if ('subscribed' in part) return { subscribed: ctx.step(part.subscribed) }
    return part
  }
  return 'all' in when ? { all: when.all.map(item) } : { any: when.any.map(item) }
}

const OPS: Record<Extract<SpecConditionItem, { op: unknown }>['op'], string> = {
  isSet: 'is set',
  isEmpty: 'is empty',
  equals: 'equals',
  notEquals: 'does not equal',
  contains: 'contains',
  startsWith: 'starts with',
  gt: 'is greater than',
  gte: 'is at least',
  lt: 'is less than',
  lte: 'is at most',
}

const sayValue = (item: string | number | boolean | { var: string }) =>
  typeof item === 'object' ? item.var : typeof item === 'boolean' ? (item ? 'yes' : 'no') : JSON.stringify(item)

/** A condition as one plain sentence: `first_name is set and the user's language is fa`. */
function say(when: SpecCondition): string {
  const item = (part: SpecConditionItem) => {
    if ('var' in part) {
      const op = `${part.var} ${OPS[part.op]}`
      return part.value === undefined || part.op === 'isSet' || part.op === 'isEmpty'
        ? op
        : `${op} ${sayValue(part.value)}`
    }
    if ('switch' in part) return `the test switch ${part.switch} is ${sayValue(part.is)}`
    if ('language' in part) return `the user's language is ${part.language.join(' or ') || 'none'}`
    if ('hasPaid' in part) return `the user has paid ${part.hasPaid}`
    if ('subscribed' in part) return `the user's subscription ${part.subscribed} is active`
    return `the user is a member of ${part.memberOf}`
  }
  if ('all' in when) return when.all.length === 0 ? 'always' : when.all.map(item).join(' and ')
  return when.any.length === 0 ? 'never' : when.any.map(item).join(' or ')
}

// Every arrow into each step, by where it starts: start points and steps (in ID name order),
// then buttons.
function arrowsInto(design: Design): Map<string, Set<string>> {
  const into = new Map<string, Set<string>>()
  const add = (to: string | undefined, from: string) => {
    if (to === undefined || to === 'back' || to === 'stay') return
    const sources = into.get(to) ?? new Set<string>()
    sources.add(from)
    into.set(to, sources)
  }
  for (const box of Object.values(design.steps).sort(byIdName)) {
    for (const to of arrowsOf(box)) add(to, box.idName)
  }
  for (const button of Object.values(design.buttons).sort(byIdName)) {
    add(
      button.place === 'inline'
        ? button.action.type === 'goTo'
          ? button.action.target
          : undefined
        : button.action.goTo,
      button.idName,
    )
  }
  return into
}

function arrowsOf(box: Step): (string | undefined)[] {
  switch (box.kind) {
    case 'message':
      return [box.next, stopTarget(box)]
    case 'start':
    case 'remember':
    case 'wait':
    case 'invoice':
    case 'action':
      return [box.next]
    case 'question':
      return [box.next, box.wrongAnswer.afterMaxTries, box.cancel?.goTo]
    case 'if':
      return [...box.cases.map((item) => item.goTo), box.otherwise]
    case 'devStep':
      return box.outcomes.map((outcome) => outcome.goTo)
    case 'goTo':
      return [box.target]
    default:
      return []
  }
}
