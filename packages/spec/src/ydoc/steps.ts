// Step accessors (docs/plan/03-design-model.md section 3, rules 1 and 2): add at a position,
// move, retitle, change fields, draw arrows, duplicate, and delete with the cascades (arrows
// into the step cleared, its own buttons and texts deleted). The last `/start` start point
// cannot be deleted.
import * as Y from 'yjs'

import type { FrameId, StepId, Target } from '../model/ids.ts'
import type { Step, StepBase, StepKind } from '../model/steps.ts'
import type { Trigger } from '../model/triggers.ts'
import { toIdName } from '../names/id-name.ts'
import { STARS_CURRENCY } from '../telegram/payments.ts'
import {
  change,
  defaultLanguageOf,
  fixIdName,
  followIdName,
  fromY,
  languagesOf,
  newId,
  setField,
  takenIdNames,
  toY,
  yarray,
  ymap,
  ensureMap,
  type DesignEditor,
  type DesignMaps,
  type YMap,
} from './layout.ts'
import {
  buttonIdsOf,
  clearArrowsInto,
  deleteUnused,
  forEachRichSlot,
  isSlashStart,
  storeTexts,
  syncCommandOrder,
  textIdsOf,
} from './refs.ts'
import { addRichText, readRichText } from './rich.ts'
import { createVariable } from './variables.ts'

export type Point = { x: number; y: number }

// Some of the fields of a step beyond the common ones, for each kind (an end step has none).
type KindFields<S> = S extends Step ? Partial<Omit<S, keyof StepBase | 'kind'>> : never
/** Fields `add` and `set` take: some fields of the step's kind, the note and the frame. */
export type StepPatch = KindFields<Exclude<Step, { kind: 'end' }>> & Partial<Pick<StepBase, 'note' | 'frame'>>

/** Where an arrow starts: a field of a step, or one of its cases or outcomes. */
export type ArrowFrom =
  | { step: StepId; arrow: 'next' | 'otherwise' | 'target' | 'afterMaxTries' | 'cancel' | 'onStop' }
  | { step: StepId; case: string }
  | { step: StepId; outcome: string }

// The palette's names (docs/plan/04-editor.md section 4.2).
const titles: Record<StepKind, string> = {
  start: 'Start point',
  message: 'Message',
  question: 'Question',
  if: 'If',
  remember: 'Remember',
  wait: 'Wait',
  devStep: 'Developer step',
  goTo: 'Go to',
  end: 'End',
  note: 'Note',
  frame: 'Section',
  invoice: 'Invoice',
  action: 'Action',
}

function startTitle(trigger: Trigger): string {
  switch (trigger.type) {
    case 'command':
      return trigger.command === '' ? 'Command' : `/${trigger.command}`
    case 'startLink':
      return 'Start link'
    case 'fallback':
      return 'Anything else'
    case 'paymentDone':
      return 'Payment done'
    case 'refunded':
      return 'Refund'
    case 'subscriptionChanged':
      return 'Subscription changed'
    case 'userBlocks':
      return 'User blocks the bot'
    case 'userRestarts':
      return 'User restarts the bot'
    case 'broadcast':
      return 'Broadcast'
  }
}

const emptyText = () => ({ id: newId(), doc: {} })

// The fields of a new step of a kind; a question gets a new variable for its answer.
function newFields(maps: DesignMaps, kind: StepKind, fields: Record<string, unknown>): Record<string, unknown> {
  switch (kind) {
    case 'start':
      return { trigger: { type: 'command', command: '', inMenu: false, menuDescription: {} } }
    case 'message':
      return { content: { type: 'text', text: emptyText() }, keyboard: null, options: {} }
    case 'question':
      return {
        prompt: { content: { type: 'text', text: emptyText() }, keyboard: null, options: {} },
        expects: 'text',
        checks: {},
        saveTo: fields.saveTo ?? createVariable(maps, { label: 'Answer', type: 'text', source: 'question' }),
        wrongAnswer: { message: emptyText() },
      }
    case 'if':
      return { cases: [{ id: newId(), label: 'Yes', when: { all: [] } }] }
    case 'remember':
      return { actions: [] }
    case 'wait':
      return { amount: 1, unit: 'minutes', ifUserActs: 'cancel' }
    case 'devStep':
      return { description: '', uses: [], sets: [], outcomes: [{ id: newId(), label: 'Done' }] }
    case 'note':
      return { text: '', color: 'yellow' }
    case 'frame':
      return { width: 640, height: 400, color: 'gray' }
    // One price in Stars, and the pay button as the keyboard's first button (unless `fields`
    // bring a keyboard).
    case 'invoice': {
      const invoice = { title: {}, description: {}, currency: STARS_CURRENCY, prices: [{ label: {}, amount: 1 }] }
      if (fields.keyboard !== undefined) return { invoice, options: {} }
      const pay = newId()
      const idName = toIdName('Pay', 'btn_', takenIdNames(maps))
      const button = { id: pay, idName, label: { [defaultLanguageOf(maps)]: 'Pay' }, look: 'default' }
      maps.buttons.set(pay, toY({ ...button, place: 'inline', action: { type: 'pay' } }) as YMap)
      return { invoice, keyboard: { type: 'inline', rows: [{ type: 'buttons', ids: [pay] }] }, options: {} }
    }
    case 'action':
      return { action: { type: 'refund' } }
    case 'goTo':
    case 'end':
      return {}
  }
}

export function stepEdits(editor: DesignEditor) {
  return {
    /**
     * Adds a step at a position with a fresh ID, the palette's title (a start point's from its
     * trigger) and an ID name made from it; `fields` replace the kind's defaults.
     */
    add(kind: StepKind, at: Point, fields: StepPatch = {}, title?: string): StepId {
      return change(editor, (maps) => {
        const id = newId()
        const plain: Record<string, unknown> = { ...newFields(maps, kind, fields), ...fields }
        const stepTitle = title ?? (kind === 'start' ? startTitle(plain.trigger as Trigger) : titles[kind])
        const step = {
          id,
          kind,
          idName: toIdName(stepTitle, '', takenIdNames(maps)),
          title: stepTitle,
          x: at.x,
          y: at.y,
          ...plain,
        }
        maps.steps.set(id, toY(storeTexts(maps, step)) as YMap)
        if (kind === 'start') syncCommandOrder(maps)
        return id
      })
    },
    /**
     * Moves steps (several in one change, as when a selection is dragged); `frames` puts steps
     * into a section or takes them out of theirs (null) in the same change, as a drop does.
     */
    move(positions: Partial<Record<StepId, Point>>, frames: Partial<Record<StepId, FrameId | null>> = {}): void {
      change(editor, (maps) => {
        for (const [id, at] of Object.entries(positions)) {
          const step = maps.steps.get(id)
          if (!step || !at) continue
          step.set('x', at.x)
          step.set('y', at.y)
        }
        for (const [id, frame] of Object.entries(frames)) {
          const step = maps.steps.get(id)
          if (step && frame !== undefined) setField(step, 'frame', frame ?? undefined)
        }
      })
    },
    /** A new title; the ID name follows it until it is fixed. */
    setTitle(id: StepId, title: string): boolean {
      return change(editor, (maps) => {
        const step = maps.steps.get(id)
        if (!step) return false
        step.set('title', title)
        followIdName(maps, id, step, title)
        return true
      })
    },
    setIdName(id: StepId, name: string): boolean {
      return change(editor, (maps) => {
        const step = maps.steps.get(id)
        return step ? fixIdName(maps, id, step, name) : false
      })
    },
    /**
     * Replaces fields (`undefined` clears one). A new rich text (an ID the document does not
     * have) is added with its documents; texts and buttons the step no longer uses are deleted.
     * The last `/start` keeps its trigger. A start point's title (and so its ID name) follows a
     * new trigger while it is the one its trigger gave it ("/help" for the command help).
     */
    set(id: StepId, fields: StepPatch): boolean {
      return change(editor, (maps) => {
        const step = maps.steps.get(id)
        if (!step) return false
        const kind = step.get('kind')
        if ('trigger' in fields && isSlashStart(step) && lastSlashStart(maps, id)) {
          const trigger = fields.trigger
          if (trigger?.type !== 'command' || trigger.command !== 'start') return false
        }
        const before = kind === 'start' ? ymap(step, 'trigger') : undefined
        const followsTrigger = before !== undefined && step.get('title') === startTitle(fromY(before) as Trigger)
        const texts = textIdsOf(step)
        const buttons = buttonIdsOf(step)
        const stored = storeTexts(maps, { ...fields, kind })
        for (const [key, value] of Object.entries(fields)) {
          if (key !== 'kind') setField(step, key, value === undefined ? undefined : stored[key])
        }
        const newTrigger = 'trigger' in fields ? fields.trigger : undefined
        if (followsTrigger && newTrigger !== undefined) {
          const title = startTitle(newTrigger)
          step.set('title', title)
          followIdName(maps, id, step, title)
        }
        deleteUnused(maps, texts, buttons)
        if (kind === 'start') syncCommandOrder(maps)
        return true
      })
    },
    /** Points an arrow at a target, or clears it (`undefined`). */
    connect(from: ArrowFrom, target: Target | undefined): boolean {
      return change(editor, (maps) => {
        const step = maps.steps.get(from.step)
        if (!step) return false
        let holder: YMap | undefined
        let key = 'goTo'
        if ('case' in from) holder = listItem(step, 'cases', from.case)
        else if ('outcome' in from) holder = listItem(step, 'outcomes', from.outcome)
        else if (from.arrow === 'afterMaxTries') {
          holder = ymap(step, 'wrongAnswer')
          key = 'afterMaxTries'
        } else if (from.arrow === 'cancel') {
          holder = step.get('kind') === 'question' ? ensureCancel(step) : undefined
        } else if (from.arrow === 'onStop') {
          holder = step.get('kind') === 'message' ? step : undefined
          key = 'onStop'
        } else {
          holder = step
          key = from.arrow
        }
        if (!holder) return false
        setField(holder, key, target)
        return true
      })
    },
    /**
     * Copies a step to a position (the map's "Duplicate"): the same title, fields and arrows out,
     * with copies of its texts and its own buttons (a part row stays the part), new case and
     * outcome IDs and an ID name of its own. `/start` is not copied (a design has one).
     */
    duplicate(id: StepId, at: Point): StepId | undefined {
      return change(editor, (maps) => {
        const source = maps.steps.get(id)
        if (!source || isSlashStart(source)) return undefined
        const copy = fromY(source) as Holder
        const copyId = newId()
        forEachRichSlot(copy, (holder, key) => {
          const textId = holder[key]
          if (typeof textId !== 'string') return
          const fresh = newId()
          addRichText(maps.texts, fresh, readRichText(maps.texts.get(textId)), languagesOf(maps))
          holder[key] = fresh
        })
        const keyboard = asHolder(copy.kind === 'question' ? asHolder(copy.prompt)?.keyboard : copy.keyboard)
        if (keyboard && Array.isArray(keyboard.rows)) {
          keyboard.rows = (keyboard.rows as unknown[]).flatMap((row) => {
            const ids = asHolder(row)?.ids
            if (!Array.isArray(ids)) return [row]
            const copies = (ids as unknown[]).flatMap((buttonId) => copyButton(maps, buttonId) ?? [])
            return copies.length > 0 ? [{ type: 'buttons', ids: copies }] : []
          })
        }
        // A rich message's buttons inside, as a keyboard's.
        const content = asHolder(copy.content)
        if (content?.type === 'rich' && Array.isArray(content.blocks)) {
          content.blocks = (content.blocks as unknown[]).flatMap((block) => {
            const holder = asHolder(block)
            if (holder?.type !== 'buttons' || !Array.isArray(holder.ids)) return [block]
            const copies = (holder.ids as unknown[]).flatMap((buttonId) => copyButton(maps, buttonId) ?? [])
            return copies.length > 0 ? [{ ...holder, ids: copies }] : []
          })
        }
        for (const list of [copy.cases, copy.outcomes]) {
          if (!Array.isArray(list)) continue
          for (const item of list as unknown[]) {
            const holder = asHolder(item)
            if (holder) holder.id = newId()
          }
        }
        delete copy.idNameFixed
        const title = typeof copy.title === 'string' ? copy.title : ''
        Object.assign(copy, { id: copyId, idName: toIdName(title, '', takenIdNames(maps)), x: at.x, y: at.y })
        maps.steps.set(copyId, toY(copy) as YMap)
        if (copy.kind === 'start') syncCommandOrder(maps)
        return copyId
      })
    },
    /**
     * Deletes steps with the cascades of rule 2: every arrow into them is cleared, steps in a
     * deleted frame leave it, and their buttons and texts are deleted. Returns the deleted IDs
     * (the last `/start` stays).
     */
    remove(ids: readonly StepId[]): StepId[] {
      return change(editor, (maps) => {
        const removing = new Set(ids.filter((id) => maps.steps.has(id)))
        const starts = [...maps.steps.entries()].filter(([, step]) => isSlashStart(step)).map(([id]) => id)
        if (starts.length > 0 && starts.every((id) => removing.has(id))) removing.delete(starts[0] ?? '')
        const texts: string[] = []
        const buttons: string[] = []
        for (const id of removing) {
          const step = maps.steps.get(id)
          if (!step) continue
          texts.push(...textIdsOf(step))
          buttons.push(...buttonIdsOf(step))
          maps.steps.delete(id)
        }
        clearArrowsInto(maps, removing)
        deleteUnused(maps, texts, buttons)
        syncCommandOrder(maps)
        return [...removing]
      })
    },
  }
}

type Holder = Record<string, unknown>

function asHolder(value: unknown): Holder | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Holder) : undefined
}

// A copy of a button under a new ID, with an ID name made from its label like a new button's.
function copyButton(maps: DesignMaps, id: unknown): string | undefined {
  const button = typeof id === 'string' ? maps.buttons.get(id) : undefined
  if (!button) return undefined
  const copy = fromY(button) as Holder
  const label = asHolder(copy.label)?.[defaultLanguageOf(maps)]
  const copyId = newId()
  delete copy.idNameFixed
  Object.assign(copy, {
    id: copyId,
    idName: toIdName(typeof label === 'string' ? label : '', 'btn_', takenIdNames(maps)),
  })
  maps.buttons.set(copyId, toY(copy) as YMap)
  return copyId
}

function lastSlashStart(maps: DesignMaps, id: StepId): boolean {
  return ![...maps.steps.entries()].some(([other, step]) => other !== id && isSlashStart(step))
}

function listItem(step: YMap, list: string, id: string): YMap | undefined {
  const item = yarray(step, list)
    ?.toArray()
    .find((entry) => entry instanceof Y.Map && entry.get('id') === id)
  return item as YMap | undefined
}

// A question's cancel words and target, created when an arrow is drawn from it.
function ensureCancel(step: YMap): YMap {
  const cancel = ensureMap(step, 'cancel')
  ensureMap(cancel, 'words')
  return cancel
}
