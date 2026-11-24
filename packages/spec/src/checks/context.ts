// What every rule of the checks reads (docs/plan/03-design-model.md section 8), built once per
// check: the steps in map order, each keyboard's rows with its row parts placed, the steps that
// show each button, the arrows into each step, where each variable is used and set, the steps a
// button's edit shows, and the lengths Telegram counts (SPEC-02's measure).
import type { Button, InlineButton, Keyboard } from '../model/buttons.ts'
import type { Condition, RememberAction, Value } from '../model/conditions.ts'
import type { Content, MediaSlot, RichMessageBlock } from '../model/content.ts'
import type { Design } from '../model/design.ts'
import type { ButtonId, Lang, PartId, StepId, Target, VarId } from '../model/ids.ts'
import type { Options } from '../model/options.ts'
import { type InvoiceStep, type MessageStep, type QuestionStep, type Step, stopTarget } from '../model/steps.ts'
import type { LangText, RichText, RichTextRef } from '../model/texts.ts'
import { plainText, RICH_NODES, type RichDoc, type RichInline } from '../text/schema.ts'
import { measure, type MeasureOptions } from '../text/to-telegram.ts'
import { CHECK_LEVELS, type Issue, type IssueCode, type IssuePlace } from './issues.ts'

/** A step that sends a message: a message step, or a question with its prompt. */
export type SendingStep = MessageStep | QuestionStep

/** A step whose message has a keyboard: a sending step or an invoice. */
export type ButtonStep = SendingStep | InvoiceStep

/**
 * A rich text a step sends: its text or caption, an album item's caption, a poll's or quiz's
 * question, a quiz's explanation, a text of a rich message's block (`item` is the block's
 * number), a wrong answer message.
 */
export type TextSlot = {
  what: 'text' | 'caption' | 'question' | 'explanation' | 'block' | 'wrongAnswer'
  text: RichTextRef
  item?: number
}

export type Context = {
  design: Design
  languages: readonly Lang[]
  defaultLanguage: Lang
  /** The steps in map order: left to right, then top to bottom. */
  steps: readonly Step[]
  /** The place of each step in `steps`. */
  rank: ReadonlyMap<StepId, number>
  /** Each shown button once, with the first step (in map order) that shows it. */
  buttons: readonly { button: Button; step: ButtonStep }[]
  /** The steps that show each button, in map order. */
  buttonSteps: ReadonlyMap<ButtonId, readonly ButtonStep[]>
  /** The steps an arrow of another step or of a shown button goes into. */
  arrowsIn: ReadonlySet<StepId>
  /** The steps that use and set each variable, in map order. */
  varUses: ReadonlyMap<VarId, readonly Step[]>
  varSets: ReadonlyMap<VarId, readonly Step[]>
  /** The steps that use or set a variable the design no longer has. */
  deletedVarSteps: ReadonlySet<StepId>
  /** The rows of a step's keyboard, row parts placed (buttons the design does not have left out). */
  rows: (step: ButtonStep) => readonly (readonly Button[])[]
  /** The button rows inside a step's rich message, its `buttons` blocks in order (the same left out). */
  richRows: (step: ButtonStep) => readonly (readonly Button[])[]
  /** The messages, questions and invoices an arrow into this target shows first (through If, Remember, ...). */
  shown: (target: Target) => readonly ButtonStep[]
  /** Every inline node of a rich text in the design's languages, the text parts it places included. */
  inlines: (text: RichText) => RichInline[]
  /** The length Telegram counts for one language's document. */
  length: (doc: RichDoc, lang: Lang) => number
  /** The same for a plain text (a label, a popup), with `{idName}` of a variable as a variable. */
  plainLength: (text: string) => number
  stepName: (step: Step) => string
  buttonName: (button: Button) => string
  add: (code: IssueCode, message: string, place?: IssuePlace) => void
}

export function asSending(step: Step): SendingStep | undefined {
  return step.kind === 'message' || step.kind === 'question' ? step : undefined
}

export function asButtonStep(step: Step): ButtonStep | undefined {
  return step.kind === 'invoice' ? step : asSending(step)
}

export function contentOf(step: SendingStep): Content {
  return step.kind === 'message' ? step.content : step.prompt.content
}

export function keyboardOf(step: ButtonStep): Keyboard {
  return step.kind === 'question' ? step.prompt.keyboard : step.keyboard
}

export function optionsOf(step: ButtonStep): Options {
  return step.kind === 'question' ? step.prompt.options : step.options
}

/** The media slots of a content: its file, each album or paid media item's, or a rich message's media blocks'. */
export function mediaSlots(content: Content): MediaSlot[] {
  if (content.type === 'album' || content.type === 'paidMedia') return content.items.map((item) => item.media)
  if (content.type === 'rich') return content.blocks.flatMap((block) => (block.type === 'media' ? [block.media] : []))
  return 'media' in content ? [content.media] : []
}

/** Every rich text of a rich message's block: its own texts, a list's items and a table's cells. */
export function blockTexts(block: RichMessageBlock): RichTextRef[] {
  switch (block.type) {
    case 'paragraph':
    case 'footer':
    case 'heading':
    case 'code':
      return [block.text]
    case 'quote':
      return block.credit ? [block.text, block.credit] : [block.text]
    case 'list':
      return block.items.map((item) => item.text)
    case 'table':
      return [
        ...block.rows.flatMap((row) => row.cells.map((cell) => cell.text)),
        ...(block.caption ? [block.caption] : []),
      ]
    case 'details':
      return [block.summary, block.text]
    case 'media':
      return block.caption ? [block.caption] : []
    case 'divider':
    case 'buttons':
      return []
  }
}

export function textSlots(step: SendingStep): TextSlot[] {
  const content = contentOf(step)
  const slots: TextSlot[] = []
  if (content.type === 'text') slots.push({ what: 'text', text: content.text })
  else if (content.type === 'album') {
    content.items.forEach((item, index) => {
      if (item.caption) slots.push({ what: 'caption', text: item.caption, item: index + 1 })
    })
  } else if (content.type === 'poll' || content.type === 'quiz') {
    slots.push({ what: 'question', text: content.question })
    if (content.type === 'quiz' && content.explanation) slots.push({ what: 'explanation', text: content.explanation })
  } else if (content.type === 'rich') {
    content.blocks.forEach((block, index) => {
      for (const text of blockTexts(block)) slots.push({ what: 'block', text, item: index + 1 })
    })
  } else if ('caption' in content && content.caption) slots.push({ what: 'caption', text: content.caption })
  if (step.kind === 'question') slots.push({ what: 'wrongAnswer', text: step.wrongAnswer.message })
  return slots
}

/** The slot in plain words: "text", "caption of item 2", "wrong answer message". */
export function slotName(slot: TextSlot): string {
  if (slot.what === 'wrongAnswer') return 'wrong answer message'
  if (slot.what === 'block') return `block ${String(slot.item)}`
  return slot.item === undefined ? slot.what : `${slot.what} of item ${String(slot.item)}`
}

/** An arrow that goes nowhere: none yet, or to a step the design does not have. */
export function goesNowhere(design: Design, target: Target | undefined): boolean {
  return target === undefined || (target !== 'back' && design.steps[target] === undefined)
}

/** A rich text with nothing to show in this language (no document, or only spaces). */
export function emptyDoc(doc: RichDoc | undefined): boolean {
  return (
    doc === undefined ||
    plainText(
      doc,
      () => 'v',
      () => 'p',
    ).trim() === ''
  )
}

export function emptyText(text: string | undefined): boolean {
  return text === undefined || text.trim() === ''
}

/** "a", "a and b", "a, b and c". */
export function andList(items: readonly string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1) ?? ''}`
}

/** "a", "a or b", "a, b or c". */
export function orList(items: readonly string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} or ${items.at(-1) ?? ''}`
}

/** A button's go-to target, `stay` and the actions without one (links, copy texts) left out. */
export function buttonTarget(button: Button): Target | undefined {
  if (button.place === 'reply') return button.action.goTo
  return button.action.type === 'goTo' && button.action.target !== 'stay' ? button.action.target : undefined
}

/** An inline button that goes to a step and shows it this way. */
export function showsBy(button: Button, show: 'edit' | 'new' | 'replace'): button is InlineButton {
  return button.place === 'inline' && button.action.type === 'goTo' && button.action.show === show
}

/** The conditions of a step: each case of an "If", a reminder's `stopWhen`, a broadcast's audience. */
export function conditionsOf(step: Step): Condition[] {
  switch (step.kind) {
    case 'if':
      return step.cases.map((item) => item.when)
    case 'wait':
      return step.stopWhen ? [step.stopWhen] : []
    case 'start':
      return step.trigger.type === 'broadcast' && step.trigger.audience !== 'everyone' ? [step.trigger.audience] : []
    default:
      return []
  }
}

/** The arrows of a step, without its buttons. */
export function stepTargets(step: Step): (Target | undefined)[] {
  switch (step.kind) {
    case 'message':
      return [step.next, stopTarget(step)]
    case 'start':
    case 'remember':
    case 'wait':
    case 'invoice':
    case 'action':
      return [step.next]
    case 'question':
      return [step.next, step.wrongAnswer.afterMaxTries, step.cancel?.goTo]
    case 'if':
      return [...step.cases.map((item) => item.goTo), step.otherwise]
    case 'devStep':
      return step.outcomes.map((outcome) => outcome.goTo)
    case 'goTo':
      return [step.target]
    case 'end':
    case 'note':
    case 'frame':
      return []
  }
}

// A plain text's `{idName}` placeholders.
const PLACEHOLDER = /\{([a-z][a-z0-9_]*)\}/g

export function buildContext(design: Design, issues: Issue[]): Context {
  const languages = design.languages.list
  const defaultLanguage = design.languages.default
  // Map order: left to right, then top to bottom; equal places keep the design's order.
  const steps = Object.values(design.steps).sort((a, b) => a.x - b.x || a.y - b.y)
  const rank = new Map(steps.map((step, index) => [step.id, index]))
  const varByName = new Map(Object.values(design.variables).map((variable) => [variable.idName, variable]))

  const rowsOf = new Map<StepId, Button[][]>()
  const rows = (step: ButtonStep): Button[][] => {
    const known = rowsOf.get(step.id)
    if (known) return known
    const keyboard = keyboardOf(step)
    const result: Button[][] = []
    const add = (ids: readonly ButtonId[]) => {
      result.push(ids.flatMap((id) => design.buttons[id] ?? []))
    }
    if (keyboard?.type === 'inline' || keyboard?.type === 'reply') {
      for (const row of keyboard.rows) {
        if (row.type === 'buttons') add(row.ids)
        else {
          const part = design.parts[row.part]
          if (part?.kind === 'rows') part.rows.forEach(add)
        }
      }
    }
    rowsOf.set(step.id, result)
    return result
  }
  const richRows = (step: ButtonStep): Button[][] => {
    if (step.kind === 'invoice') return []
    const content = contentOf(step)
    if (content.type !== 'rich') return []
    return content.blocks.flatMap((block) =>
      block.type === 'buttons' ? [block.ids.flatMap((id) => design.buttons[id] ?? [])] : [],
    )
  }

  const inlines = (text: RichText): RichInline[] => {
    const nodes: RichInline[] = []
    const walk = (doc: RichDoc | undefined, lang: Lang, placing: ReadonlySet<PartId>) => {
      for (const block of doc?.content ?? []) {
        const paragraphs = block.type === 'paragraph' ? [block] : block.type === 'blockquote' ? block.content : []
        for (const node of paragraphs.flatMap((paragraph) => paragraph.content ?? [])) {
          nodes.push(node)
          if (node.type !== RICH_NODES.part || placing.has(node.attrs.part)) continue
          const part = design.parts[node.attrs.part]
          if (part?.kind === 'text') walk(part.text.doc[lang], lang, new Set([...placing, part.id]))
        }
      }
    }
    for (const lang of languages) walk(text[lang], lang, new Set())
    return nodes
  }

  // One pass over the steps for the buttons, the arrows and the variables.
  const buttons: { button: Button; step: ButtonStep }[] = []
  const buttonSteps = new Map<ButtonId, ButtonStep[]>()
  const arrowsIn = new Set<StepId>()
  const varUses = new Map<VarId, Step[]>()
  const varSets = new Map<VarId, Step[]>()
  const deletedVarSteps = new Set<StepId>()
  const note = (index: Map<VarId, Step[]>, id: VarId, step: Step) => {
    if (design.variables[id] === undefined) deletedVarSteps.add(step.id)
    const list = index.get(id)
    if (!list) index.set(id, [step])
    else if (list.at(-1) !== step) list.push(step)
  }
  const useValue = (value: Value | undefined, step: Step) => {
    if (typeof value === 'object') note(varUses, value.var, step)
  }
  const useCondition = (when: Condition, step: Step) => {
    for (const term of 'all' in when ? when.all : when.any) {
      if ('var' in term) {
        note(varUses, term.var, step)
        useValue(term.value, step)
      }
    }
  }
  const remember = (actions: readonly RememberAction[] | undefined, step: Step) => {
    for (const action of actions ?? []) {
      note(varSets, action.var, step)
      useValue(action.value, step)
    }
  }
  const usePlain = (text: LangText | string | undefined, step: Step) => {
    for (const value of typeof text === 'string' ? [text] : Object.values(text ?? {})) {
      for (const [, name] of (value ?? '').matchAll(PLACEHOLDER)) {
        const variable = name === undefined ? undefined : varByName.get(name)
        if (variable) note(varUses, variable.id, step)
      }
    }
  }
  const arrow = (target: Target | undefined, from: Step) => {
    if (target !== undefined && target !== 'back' && target !== from.id) arrowsIn.add(target)
  }

  for (const step of steps) {
    for (const target of stepTargets(step)) arrow(target, step)
    for (const when of conditionsOf(step)) useCondition(when, step)
    switch (step.kind) {
      case 'start':
        if (step.trigger.type === 'startLink' && step.trigger.saveRestTo) note(varSets, step.trigger.saveRestTo, step)
        break
      case 'question':
        note(varSets, step.saveTo, step)
        break
      case 'remember':
        remember(step.actions, step)
        break
      case 'action':
        if (step.action.type === 'gift' && step.action.text) {
          for (const node of inlines(step.action.text.doc)) {
            if (node.type === RICH_NODES.variable) note(varUses, node.attrs.var, step)
          }
        }
        break
      case 'devStep':
        for (const id of step.uses) note(varUses, id, step)
        for (const id of step.sets) note(varSets, id, step)
        break
      default:
        break
    }
    const sending = asSending(step)
    if (sending) {
      for (const slot of textSlots(sending)) {
        for (const node of inlines(slot.text.doc)) {
          if (node.type === RICH_NODES.variable) note(varUses, node.attrs.var, step)
        }
      }
      const content = contentOf(sending)
      if (content.type === 'poll' || content.type === 'quiz')
        for (const option of content.options) usePlain(option, step)
      if ((content.type === 'poll' || content.type === 'quiz' || content.type === 'dice') && content.saveTo)
        note(varSets, content.saveTo, step)
    }
    if (step.kind === 'invoice') {
      const { invoice } = step
      for (const text of [invoice.title, invoice.description, ...invoice.prices.map((price) => price.label)])
        usePlain(text, step)
      usePlain(step.checkout?.refuse, step)
    }
    const shower = asButtonStep(step)
    if (!shower) continue
    const seen = new Set<ButtonId>()
    for (const button of [...rows(shower).flat(), ...richRows(shower).flat()]) {
      if (seen.has(button.id)) continue
      seen.add(button.id)
      const shownIn = buttonSteps.get(button.id)
      if (shownIn) shownIn.push(shower)
      else {
        buttonSteps.set(button.id, [shower])
        buttons.push({ button, step: shower })
      }
      arrow(buttonTarget(button), step)
      usePlain(button.label, step)
      if (button.place === 'inline') {
        const { action } = button
        if (action.type === 'goTo') {
          remember(action.remember, step)
          usePlain(action.popup?.text, step)
        } else if (action.type === 'copyText') usePlain(action.text, step)
        else if (action.type !== 'pay') usePlain(action.url, step)
      } else if (button.action.type === 'text') remember(button.action.remember, step)
      else if (button.action.saveTo) note(varSets, button.action.saveTo, step)
    }
  }

  const shownOf = new Map<StepId, ButtonStep[]>()
  const shown = (target: Target): readonly ButtonStep[] => {
    if (target === 'back') return []
    const known = shownOf.get(target)
    if (known) return known
    const result: ButtonStep[] = []
    const visited = new Set<StepId>()
    const visit = (id: Target | undefined) => {
      if (id === undefined || id === 'back' || visited.has(id)) return
      visited.add(id)
      const step = design.steps[id]
      if (!step) return
      const sending = asButtonStep(step)
      if (sending) result.push(sending)
      else stepTargets(step).forEach(visit)
    }
    visit(target)
    shownOf.set(target, result)
    return result
  }

  const testValue = (id: VarId) => design.variables[id]?.testValue
  const measureOptions = new Map<Lang, MeasureOptions>()
  const length = (doc: RichDoc, lang: Lang) => {
    let opts = measureOptions.get(lang)
    if (!opts) {
      opts = {
        testValue,
        part: (id) => {
          const part = design.parts[id]
          return part?.kind === 'text' ? part.text.doc[lang] : undefined
        },
      }
      measureOptions.set(lang, opts)
    }
    return measure(doc, opts)
  }
  const plainLength = (text: string) => {
    const nodes: RichInline[] = []
    let from = 0
    for (const match of text.matchAll(PLACEHOLDER)) {
      const variable = match[1] === undefined ? undefined : varByName.get(match[1])
      if (!variable) continue
      if (match.index > from) nodes.push({ type: RICH_NODES.text, text: text.slice(from, match.index) })
      nodes.push({ type: RICH_NODES.variable, attrs: { var: variable.id } })
      from = match.index + match[0].length
    }
    if (from < text.length) nodes.push({ type: RICH_NODES.text, text: text.slice(from) })
    return measure({ type: RICH_NODES.doc, content: [{ type: RICH_NODES.paragraph, content: nodes }] }, { testValue })
  }

  return {
    design,
    languages,
    defaultLanguage,
    steps,
    rank,
    buttons,
    buttonSteps,
    arrowsIn,
    varUses,
    varSets,
    deletedVarSteps,
    rows,
    richRows,
    shown,
    inlines,
    length,
    plainLength,
    stepName: (step) => `"${step.title.trim() || step.idName}"`,
    buttonName: (button) => `"${button.label[defaultLanguage]?.trim() || button.idName}"`,
    add: (code, message, place = {}) => {
      const level = CHECK_LEVELS[code]
      issues.push({ code, level, ...place, message, ignorable: level !== 'error' })
    },
  }
}
