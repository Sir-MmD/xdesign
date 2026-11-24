// The map's tools in the document (docs/plan/04-editor.md section 4.3, 05 section 4 item 6): copy
// and paste of steps, in one design or between designs, and auto-arrange. A clip holds the copied
// steps as the plain model has them with everything they use (their buttons, row and text parts,
// variables, test switches and media), so it pastes anywhere; a paste and an arrangement are one
// transaction each, so others see them at once and the person undoes them in one step.
import type * as Y from 'yjs'
import { z } from 'zod'

import { ButtonSchema, type Button, type Keyboard, type Row } from '../model/buttons.ts'
import type { Condition } from '../model/conditions.ts'
import type { RichMessageBlock } from '../model/content.ts'
import { LanguagesSchema, type Design } from '../model/design.ts'
import {
  ButtonIdSchema,
  IdSchema,
  MediaIdSchema,
  PartIdSchema,
  SwitchIdSchema,
  VarIdSchema,
  type FrameId,
  type StepId,
} from '../model/ids.ts'
import { MediaItemSchema, PartSchema } from '../model/parts.ts'
import { StepSchema, type Step } from '../model/steps.ts'
import type { RichTextRef } from '../model/texts.ts'
import { TestSwitchSchema, VariableSchema } from '../model/variables.ts'
import { toIdName } from '../names/id-name.ts'
import {
  change,
  defaultLanguageOf,
  languagesOf,
  newId,
  takenIdNames,
  toY,
  ystring,
  type DesignEditor,
  type YMap,
} from './layout.ts'
import { forEachRichSlot, storeTexts, syncCommandOrder } from './refs.ts'
import type { Point } from './steps.ts'

/** The clipboard's data type for copied steps; the same JSON also goes as plain text. */
export const CLIP_TYPE = 'application/x-xdesign'
const CLIP_FORMAT = 'xdesign.clipboard'

const ClipSchema = z.object({
  format: z.literal(CLIP_FORMAT),
  version: z.literal(1),
  // The design they were copied from.
  design: IdSchema,
  languages: LanguagesSchema,
  steps: z.array(StepSchema),
  buttons: z.record(ButtonIdSchema, ButtonSchema),
  parts: z.record(PartIdSchema, PartSchema),
  variables: z.record(VarIdSchema, VariableSchema),
  switches: z.record(SwitchIdSchema, TestSwitchSchema),
  media: z.record(MediaIdSchema, MediaItemSchema),
})
/** Copied steps with what they use, as the clipboard carries them. */
export type Clip = z.infer<typeof ClipSchema>

/** A box's new place, and a section's new size. */
export type ArrangedBox = { x: number; y: number; width?: number; height?: number }

type RefKind = 'step' | 'variable' | 'switch' | 'part' | 'media'
type Holder = Record<string, unknown>

// The fields of the plain model that point at another item, by name: arrows (`next`,
// `otherwise`, a Go to's or a button's `target`, `goTo`, `afterMaxTries`, `onStop`), invoice
// steps (a payment start point's or a refund's `invoice`, `hasPaid` and `subscribed`), the step an
// action acts on (`step`, `onStep`), variables (conditions, remember actions, `saveTo`, a rich
// text's variable node), test switches, parts (a part row, a rich text's part node) and media (a
// media slot).
const REF_FIELDS: Readonly<Partial<Record<string, RefKind>>> = {
  next: 'step',
  otherwise: 'step',
  target: 'step',
  goTo: 'step',
  afterMaxTries: 'step',
  onStop: 'step',
  invoice: 'step',
  hasPaid: 'step',
  subscribed: 'step',
  step: 'step',
  onStep: 'step',
  var: 'variable',
  saveTo: 'variable',
  saveRestTo: 'variable',
  switch: 'switch',
  part: 'part',
  media: 'media',
}
// Lists of variables: a developer step's `uses` and `sets`.
const VARIABLE_LISTS = new Set(['uses', 'sets'])

function isHolder(value: unknown): value is Holder {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** Calls `visit(kind, id, holder, key)` for every reference in a plain step, button or part. */
function forEachRef(value: unknown, visit: (kind: RefKind, id: string, holder: Holder, key: string) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) forEachRef(item, visit)
    return
  }
  if (!isHolder(value)) return
  for (const [key, field] of Object.entries(value)) {
    const kind = REF_FIELDS[key]
    if (kind !== undefined && typeof field === 'string') visit(kind, field, value, key)
    else if (VARIABLE_LISTS.has(key) && Array.isArray(field)) {
      field.forEach((id, index) => {
        if (typeof id === 'string') visit('variable', id, field as unknown as Holder, String(index))
      })
    } else forEachRef(field, visit)
  }
}

/** Replaces every reference with what `rename` gives; `undefined` removes the field. */
function mapRefs(value: unknown, rename: (kind: RefKind, id: string, holder: Holder) => string | undefined): void {
  forEachRef(value, (kind, id, holder, key) => {
    const next = rename(kind, id, holder)
    if (next === undefined) Reflect.deleteProperty(holder, key)
    else holder[key] = next
  })
}

function keyboardOf(step: Step): Keyboard {
  if (step.kind === 'message' || step.kind === 'invoice') return step.keyboard
  return step.kind === 'question' ? step.prompt.keyboard : null
}

// The `buttons` blocks of a message's rich message (buttons inside it).
function richButtonBlocks(step: Step): Extract<RichMessageBlock, { type: 'buttons' }>[] {
  if (step.kind !== 'message' || step.content.type !== 'rich') return []
  return step.content.blocks.filter((block) => block.type === 'buttons')
}

function isSlashStart(step: Step): boolean {
  return step.kind === 'start' && step.trigger.type === 'command' && step.trigger.command === 'start'
}

/**
 * The given steps as a clip (the map's Copy, Ctrl+C, Ctrl+D): a section brings its steps, `/start`
 * stays behind (a design has one); undefined when nothing is left to copy.
 */
export function copySteps(design: Design, ids: Iterable<StepId>): Clip | undefined {
  const picked = new Set<StepId>()
  for (const id of ids) {
    const step = design.steps[id]
    if (step && !isSlashStart(step)) picked.add(id)
  }
  for (const step of Object.values(design.steps)) {
    if (step.kind !== 'frame' && step.frame !== undefined && picked.has(step.frame) && !isSlashStart(step)) {
      picked.add(step.id)
    }
  }
  if (picked.size === 0) return undefined
  const clip: Clip = {
    format: CLIP_FORMAT,
    version: 1,
    design: design.id,
    languages: clone(design.languages),
    steps: [],
    buttons: {},
    parts: {},
    variables: {},
    switches: {},
    media: {},
  }
  const addButton = (id: string) => {
    const button = design.buttons[id]
    if (!button || id in clip.buttons) return
    clip.buttons[id] = clone(button)
    collect(button)
  }
  const collect = (item: unknown) => {
    forEachRef(item, (kind, id) => {
      if (kind === 'variable') {
        const variable = design.variables[id]
        if (variable) clip.variables[id] = clone(variable)
      } else if (kind === 'switch') {
        const testSwitch = design.switches[id]
        if (testSwitch) clip.switches[id] = clone(testSwitch)
      } else if (kind === 'media') {
        const media = design.media[id]
        if (media) clip.media[id] = clone(media)
      } else if (kind === 'part') {
        const part = design.parts[id]
        if (!part || id in clip.parts) return
        clip.parts[id] = clone(part)
        collect(part)
        if (part.kind === 'rows') part.rows.flat().forEach(addButton)
      }
    })
  }
  for (const step of Object.values(design.steps)) {
    if (!picked.has(step.id)) continue
    clip.steps.push(clone(step))
    collect(step)
    const keyboard = keyboardOf(step)
    if (keyboard?.type === 'inline' || keyboard?.type === 'reply') {
      for (const row of keyboard.rows) if (row.type === 'buttons') row.ids.forEach(addButton)
    }
    for (const block of richButtonBlocks(step)) block.ids.forEach(addButton)
  }
  return clip
}

/** A clip from the clipboard's text, or undefined when it holds something else. */
export function readClip(text: string): Clip | undefined {
  if (!text.includes(CLIP_FORMAT)) return undefined
  try {
    const result = ClipSchema.safeParse(JSON.parse(text) as unknown)
    return result.success ? result.data : undefined
  } catch {
    return undefined
  }
}

// Texts per language for the design pasted into: its languages only; when its default language
// is not one of the clip's, the clip's default text stands in for it.
type Fit = <T>(text: Partial<Record<string, T>>) => Partial<Record<string, T>>

function fitter(from: Clip['languages'], languages: readonly string[], main: string): Fit {
  return <T>(text: Partial<Record<string, T>>) => {
    const fitted: Partial<Record<string, T>> = {}
    for (const lang of languages) if (text[lang] !== undefined) fitted[lang] = text[lang]
    const stand = text[from.default]
    if (fitted[main] === undefined && !from.list.includes(main) && stand !== undefined) fitted[main] = stand
    return fitted
  }
}

// A step's texts fitted to the languages, each rich text under a fresh text ID.
function fitStep(step: Step, fit: Fit): void {
  forEachRichSlot(step, (holder, key) => {
    const ref = holder[key] as RichTextRef
    holder[key] = { id: newId(), doc: fit(ref.doc) }
  })
  if (step.kind === 'start' && step.trigger.type === 'command') {
    step.trigger.menuDescription = fit(step.trigger.menuDescription)
  }
  const keyboard = keyboardOf(step)
  if ((keyboard?.type === 'reply' || keyboard?.type === 'forceReply') && keyboard.placeholder) {
    keyboard.placeholder = fit(keyboard.placeholder)
  }
  if (step.kind === 'question' && step.cancel) step.cancel.words = fit(step.cancel.words)
  if (step.kind === 'invoice') {
    const { invoice } = step
    invoice.title = fit(invoice.title)
    invoice.description = fit(invoice.description)
    for (const price of invoice.prices) price.label = fit(price.label)
    for (const option of invoice.physical?.shippingOptions ?? []) option.title = fit(option.title)
    if (step.checkout) step.checkout.refuse = fit(step.checkout.refuse)
  }
}

function fitButton(button: Button, fit: Fit): void {
  button.label = fit(button.label)
  if (button.place !== 'inline') return
  const { action } = button
  if (action.type === 'goTo' && action.popup) action.popup.text = fit(action.popup.text)
  if (action.type === 'copyText') action.text = fit(action.text)
}

// A pasted condition: an item about an invoice this design does not have lost its step and is dropped.
function keptItems(when: Condition): Condition {
  const kept = ('all' in when ? when.all : when.any).filter((item) => Object.keys(item).length > 0)
  return 'all' in when ? { all: kept } : { any: kept }
}

// The ID of an item with this ID name.
function idByName(items: Y.Map<YMap>, idName: string): string | undefined {
  for (const [id, item] of items) if (ystring(item, 'idName') === idName) return id
  return undefined
}

export function mapEdits(editor: DesignEditor) {
  return {
    /**
     * Pastes a clip with the top left corner of its boxes at `at`, everything under fresh IDs and
     * ID names: steps, their texts, their own buttons, cases and outcomes. Arrows between the
     * pasted steps follow them, arrows to steps this design has stay, others are cleared. The
     * design's variables, test switches, parts and media are used when it has them (by ID, a
     * variable or switch also by ID name), else they are added (parts with their buttons and
     * text); a file from another design becomes a placeholder with its name. Texts keep the
     * design's languages. A step whose section was not copied joins the one `frameAt` finds for
     * its new top left corner. Returns the new steps' IDs.
     */
    paste(clip: Clip, at: Point, frameAt?: (corner: Point) => FrameId | undefined): StepId[] {
      return change(editor, (maps) => {
        const main = defaultLanguageOf(maps)
        const fit = fitter(clip.languages, languagesOf(maps), main)
        const taken = takenIdNames(maps)
        const name = (base: string, prefix: string, fallback?: string) => {
          const idName = toIdName(base, prefix, taken, fallback)
          taken.add(idName)
          return idName
        }

        // Variables and test switches: the design's own (same ID, else same ID name), or new ones.
        const variables = new Map<string, string>()
        for (const variable of Object.values(clip.variables)) {
          const own = maps.variables.has(variable.id) ? variable.id : idByName(maps.variables, variable.idName)
          if (own !== undefined) {
            variables.set(variable.id, own)
            continue
          }
          const id = newId()
          const idName = taken.has(variable.idName) ? name(variable.label, '', 'var_') : variable.idName
          taken.add(idName)
          maps.variables.set(id, toY({ ...variable, id, idName, idNameFixed: undefined }) as YMap)
          variables.set(variable.id, id)
        }
        const switches = new Map<string, string>()
        for (const testSwitch of Object.values(clip.switches)) {
          const own = maps.switches.has(testSwitch.id) ? testSwitch.id : idByName(maps.switches, testSwitch.idName)
          if (own !== undefined) {
            switches.set(testSwitch.id, own)
            continue
          }
          const id = newId()
          const idName = taken.has(testSwitch.idName) ? name(testSwitch.label, '', 'switch_') : testSwitch.idName
          taken.add(idName)
          maps.switches.set(id, toY({ ...testSwitch, id, idName, idNameFixed: undefined }) as YMap)
          switches.set(testSwitch.id, id)
        }
        const parts = new Map<string, string>()
        for (const part of Object.values(clip.parts)) parts.set(part.id, maps.parts.has(part.id) ? part.id : newId())
        const steps = new Map(clip.steps.map((step) => [step.id, newId()]))

        const rename = (kind: RefKind, id: string, holder: Holder): string | undefined => {
          switch (kind) {
            case 'step':
              if (id === 'back' || id === 'stay' || id === 'userMessage') return id
              return steps.get(id) ?? (maps.steps.has(id) ? id : undefined)
            case 'variable':
              return variables.get(id) ?? id
            case 'switch':
              return switches.get(id) ?? id
            case 'part':
              return parts.get(id) ?? id
            case 'media':
              if (maps.media.has(id)) return id
              holder.placeholder = { description: clip.media[id]?.name ?? '' }
              return undefined
          }
        }
        const copyButton = (id: string): string[] => {
          const source = clip.buttons[id]
          if (!source) return []
          const button = clone(source)
          mapRefs(button, rename)
          fitButton(button, fit)
          const copyId = newId()
          const idName = name(button.label[main] ?? '', 'btn_')
          maps.buttons.set(copyId, toY({ ...button, id: copyId, idName, idNameFixed: undefined }) as YMap)
          return [copyId]
        }

        for (const source of Object.values(clip.parts)) {
          const id = parts.get(source.id)
          if (id === undefined || id === source.id) continue
          const part = clone(source)
          mapRefs(part, rename)
          if (part.kind === 'rows')
            part.rows = part.rows.map((row) => row.flatMap(copyButton)).filter((row) => row.length > 0)
          else part.text = { id: newId(), doc: fit(part.text.doc) }
          const plain = { ...part, id, idName: name(part.name, '', 'part_'), idNameFixed: undefined }
          maps.parts.set(id, toY(storeTexts(maps, plain)) as YMap)
        }

        const left = Math.min(...clip.steps.map((step) => step.x))
        const top = Math.min(...clip.steps.map((step) => step.y))
        const pasted: StepId[] = []
        for (const source of clip.steps) {
          const id = steps.get(source.id)
          if (id === undefined) continue
          const step = clone(source)
          mapRefs(step, rename)
          fitStep(step, fit)
          const keyboard = keyboardOf(step)
          if (keyboard?.type === 'inline' || keyboard?.type === 'reply') {
            keyboard.rows = keyboard.rows.flatMap((row): Row[] => {
              if (row.type === 'part') return [row]
              const ids = row.ids.flatMap(copyButton)
              return ids.length > 0 ? [{ type: 'buttons', ids }] : []
            })
          }
          for (const block of richButtonBlocks(step)) block.ids = block.ids.flatMap(copyButton)
          if (step.kind === 'if') {
            for (const item of step.cases) {
              item.id = newId()
              item.when = keptItems(item.when)
            }
          }
          if (step.kind === 'wait' && step.stopWhen) step.stopWhen = keptItems(step.stopWhen)
          if (step.kind === 'start' && step.trigger.type === 'broadcast' && step.trigger.audience !== 'everyone') {
            step.trigger.audience = keptItems(step.trigger.audience)
          }
          if (step.kind === 'devStep') for (const outcome of step.outcomes) outcome.id = newId()
          const corner = { x: Math.round(at.x + step.x - left), y: Math.round(at.y + step.y - top) }
          let frame: FrameId | undefined
          if (step.kind !== 'frame') {
            frame = step.frame === undefined ? undefined : steps.get(step.frame)
            frame ??= frameAt?.(corner)
          }
          const plain = { ...step, id, idName: name(step.title, ''), idNameFixed: undefined, ...corner, frame }
          maps.steps.set(id, toY(storeTexts(maps, plain)) as YMap)
          pasted.push(id)
        }
        syncCommandOrder(maps)
        return pasted
      })
    },
    /** Auto-arrange: every box at its new place and sections at their new size, in one change. */
    arrange(boxes: Partial<Record<StepId, ArrangedBox>>): void {
      change(editor, (maps) => {
        for (const [id, box] of Object.entries(boxes)) {
          const step = maps.steps.get(id)
          if (!step || !box) continue
          step.set('x', box.x)
          step.set('y', box.y)
          if (box.width !== undefined && box.height !== undefined && ystring(step, 'kind') === 'frame') {
            step.set('width', box.width)
            step.set('height', box.height)
          }
        }
      })
    },
  }
}
