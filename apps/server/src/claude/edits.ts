// Claude's design edits (docs/plan/17 section 13.3, MCP-02a): the editor's own accessors of
// @xdesign/spec (designEdits) as named edits, each with a Zod input in the editor's words and a
// run function. xdesign_edit_design (src/claude/mcp.ts) runs a list of them as one change by the
// person: every input is checked first, then the edits run in one transaction on a copy of the
// design, which reaches the design only when all of them worked and the result still reads as a
// design (editDesignAs in src/live/server.ts). Items are named by their ID names, as spec.json
// names them, or by their IDs; the answer names the IDs and ID names of what was made and
// removed. xdesign_find_actions and xdesign_describe_action list and describe these edits beside
// the API's routes, and xdesign_change runs one (src/claude/actions.ts, MCP-01a).
import { hasRole } from '@xdesign/api'
import {
  CHECK_LEVELS,
  copySteps,
  designEdits,
  fromTelegramHtml,
  IdNameSchema,
  InlineActionSchema,
  LangSchema,
  LangTextSchema,
  LookSchema,
  MediaSlotSchema,
  newId,
  plainMessage,
  readDesign,
  ReplyActionSchema,
  RichDocSchema,
  StepSchema,
  validateDesign,
  VariableSourceSchema,
  VariableTypeSchema,
  type ArrowFrom,
  type Design,
  type DesignEdits,
  type Issue,
  type IssueCode,
  type KeyboardAt,
  type KeyboardOptions,
  type MediaSlot,
  type PlainTextAt,
  type RichDoc,
  type StepKind,
  type StepPatch,
  type TextAt,
} from '@xdesign/spec'
import * as Y from 'yjs'
import { z } from 'zod'

import { getDesignRole } from '../auth/context.ts'
import { ApiError } from '../errors.ts'
import { loadDoc } from '../live/docs.ts'
import { editDesignAs, flushLiveDesign } from '../live/server.ts'

// At most this many edits in one call.
export const maxEdits = 500

// An edit that cannot be done, in words; the call then changes nothing.
class Refusal extends Error {}

export interface EditContext {
  doc: Y.Doc
  edits: DesignEdits
  // The plain model of a design to copy steps from: this one without an ID, else another design
  // the person can open (DesignEdit.sources loads it before the edits run).
  source: (designId: string | undefined) => Design
}

// What an edit answers besides its name: what it made, removed or filled.
export type EditResult = Record<string, unknown> | undefined

export interface DesignEdit {
  // Its name in xdesign_edit_design, such as steps.add.
  name: string
  // One line in the editor's words.
  summary: string
  input: z.ZodType
  // Other designs it copies from, by ID.
  sources?: (input: unknown) => string[]
  run: (ctx: EditContext, input: unknown) => EditResult
}

function defineEdit<S extends z.ZodType>(
  name: string,
  summary: string,
  input: S,
  run: (ctx: EditContext, input: z.output<S>) => EditResult,
  sources?: (input: z.output<S>) => string[],
): DesignEdit {
  return {
    name,
    summary,
    input,
    run: (ctx, value) => run(ctx, value as z.output<S>),
    ...(sources && { sources: (value: unknown) => sources(value as z.output<S>) }),
  }
}

// The collections of named items in the document (docs/plan/03 section 3).
type Collection = 'steps' | 'buttons' | 'variables' | 'switches' | 'parts' | 'media'
type YItem = Y.Map<unknown>

const collections: readonly Collection[] = ['steps', 'buttons', 'variables', 'switches', 'parts', 'media']
// An item of each in the answer, and in words.
const kinds: Record<Collection, string> = {
  steps: 'step',
  buttons: 'button',
  variables: 'variable',
  switches: 'switch',
  parts: 'part',
  media: 'file',
}
const nouns: Record<Collection, string> = { ...kinds, switches: 'test switch' }

function itemsOf(doc: Y.Doc, collection: Collection): Y.Map<YItem> {
  return doc.getMap<YItem>(collection)
}

// The field that names an item for people: a file's uploaded name, any other item's ID name.
function nameField(collection: Collection): string {
  return collection === 'media' ? 'name' : 'idName'
}

// The ID of an item named by its ID or its ID name (a file by its ID or its name), or undefined.
function findId(doc: Y.Doc, collection: Collection, ref: string): string | undefined {
  const items = itemsOf(doc, collection)
  if (items.has(ref)) {
    return ref
  }
  const field = nameField(collection)
  for (const [id, item] of items) {
    if (item.get(field) === ref) {
      return id
    }
  }
  return undefined
}

function idOf(doc: Y.Doc, collection: Collection, ref: string): string {
  const id = findId(doc, collection, ref)
  if (id === undefined) {
    throw new Refusal(`There is no ${nouns[collection]} "${ref}" in this design.`)
  }
  return id
}

function itemOf(doc: Y.Doc, collection: Collection, ref: string): YItem {
  const item = itemsOf(doc, collection).get(idOf(doc, collection, ref))
  if (!item) {
    throw new Refusal(`There is no ${nouns[collection]} "${ref}" in this design.`)
  }
  return item
}

// An item as the answer names it: its ID and ID name (a file's name).
function named(doc: Y.Doc, collection: Collection, id: string): Record<string, unknown> {
  const field = nameField(collection)
  return { id, [field]: itemsOf(doc, collection).get(id)?.get(field) }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function languagesOf(doc: Y.Doc): string[] {
  const list = doc.getMap('meta').get('languages')
  const langs = list instanceof Y.Array ? (list as Y.Array<unknown>).toArray() : []
  return langs.filter((lang): lang is string => typeof lang === 'string')
}

function languageOf(doc: Y.Doc, lang: string): string {
  if (!languagesOf(doc).includes(lang)) {
    throw new Refusal(`This design has no language "${lang}". Add it first with languages.add.`)
  }
  return lang
}

// The fields of the design model that name another item, as src/ydoc/map.ts of @xdesign/spec
// lists them, with a step's section (`frame`); and the fields that list items.
const refFields: Partial<Record<string, Collection>> = {
  next: 'steps',
  otherwise: 'steps',
  target: 'steps',
  goTo: 'steps',
  afterMaxTries: 'steps',
  onStop: 'steps',
  invoice: 'steps',
  hasPaid: 'steps',
  subscribed: 'steps',
  step: 'steps',
  onStep: 'steps',
  frame: 'steps',
  var: 'variables',
  saveTo: 'variables',
  saveRestTo: 'variables',
  switch: 'switches',
  part: 'parts',
  media: 'media',
}
const refLists: Partial<Record<string, Collection>> = { uses: 'variables', sets: 'variables', ids: 'buttons' }
// Targets that are no item: the message step the user came from, staying on the clicked message,
// the user's own message.
const keptRefs = new Set(['back', 'stay', 'userMessage'])

// A plain value of the design model with the ID name in each field that names an item turned into
// the item's ID.
function withIds(doc: Y.Doc, value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => withIds(doc, item))
  }
  if (!isObject(value)) {
    return value
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, field]) => {
      const collection = refFields[key]
      if (collection !== undefined && typeof field === 'string') {
        return [key, keptRefs.has(field) ? field : idOf(doc, collection, field)]
      }
      const list = refLists[key]
      if (list !== undefined && Array.isArray(field)) {
        return [key, (field as unknown[]).map((item) => (typeof item === 'string' ? idOf(doc, list, item) : item))]
      }
      return [key, withIds(doc, field)]
    }),
  )
}

// Telegram HTML as a rich text, as the editor's paste reads it; `{name}` places the variable of
// that ID name.
function fromHtml(doc: Y.Doc, html: string): RichDoc {
  return fromTelegramHtml(html, { variable: (idName) => findId(doc, 'variables', idName) })
}

// Step fields with each rich text (`{ id, doc }`, or only `{ doc }`) as a new text of its own under
// a fresh ID; a language's words may be Telegram HTML.
function withNewTexts(doc: Y.Doc, value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => withNewTexts(doc, item))
  }
  if (!isObject(value)) {
    return value
  }
  const { doc: words } = value
  if (isObject(words) && Object.keys(value).every((key) => key === 'id' || key === 'doc')) {
    return {
      id: newId(),
      doc: Object.fromEntries(
        Object.entries(words).map(([lang, text]) => [
          languageOf(doc, lang),
          typeof text === 'string' ? fromHtml(doc, text) : text,
        ]),
      ),
    }
  }
  return Object.fromEntries(Object.entries(value).map(([key, field]) => [key, withNewTexts(doc, field)]))
}

// A patch where null clears a field, as `undefined` does in the editor.
function clearNulls(patch: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, value ?? undefined]))
}

// A Zod failure in words: the first few problems, each with the field it is about.
export function problemsOf(error: z.ZodError): string {
  const problems = error.issues
    .slice(0, 5)
    .map((issue) => (issue.path.length > 0 ? `${issue.path.map(String).join('.')}: ${issue.message}` : issue.message))
  return `${problems.join('; ')}.`
}

// An input's form as JSON Schema, for an answer to a wrong one.
export function formOf(schema: z.ZodType): string {
  return JSON.stringify(z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }))
}

// The fields of each kind of step that steps.add and steps.set take: the model's own, without the
// ones every step has (its ID, ID name, title and place, which other edits change), with its note
// and section.
interface KindFields {
  schema: z.ZodObject
  fields: Record<string, z.ZodType>
}
const stepFields = new Map<string, KindFields>(
  StepSchema.options.map((schema): [string, KindFields] => {
    const fields: Record<string, z.ZodType> = { ...schema.shape }
    for (const key of ['id', 'idName', 'idNameFixed', 'title', 'x', 'y', 'kind']) {
      Reflect.deleteProperty(fields, key)
    }
    return [schema.shape.kind.value, { schema: z.strictObject(z.object(fields).partial().shape), fields }]
  }),
)
export const stepKinds = StepSchema.options.map((schema) => schema.shape.kind.value) as [StepKind, ...StepKind[]]

// The fields a step of a kind takes in steps.add and steps.set, for describing them.
export function stepFieldsOf(kind: StepKind): z.ZodObject | undefined {
  return stepFields.get(kind)?.schema
}

// Step fields as the accessors take them: null clears a field that cannot be null, ID names
// become IDs and rich texts new texts; checked against the kind's fields.
function stepPatch(doc: Y.Doc, kind: string, fields: Record<string, unknown>): StepPatch {
  const kindFields = stepFields.get(kind)
  if (!kindFields) {
    throw new Refusal(`There is no step kind "${kind}".`)
  }
  const { schema } = kindFields
  const cleared = Object.keys(fields).filter((key) => {
    const field = kindFields.fields[key]
    return fields[key] === null && field !== undefined && !field.safeParse(null).success
  })
  const given = Object.fromEntries(Object.entries(fields).filter(([key]) => !cleared.includes(key)))
  const result = schema.safeParse(withIds(doc, withNewTexts(doc, given)), { error: plainMessage })
  if (!result.success) {
    throw new Refusal(`fields: ${problemsOf(result.error)} The fields of a ${kind} step: ${formOf(schema)}`)
  }
  return { ...result.data, ...Object.fromEntries(cleared.map((key) => [key, undefined])) }
}

function stringOf(item: YItem | undefined, key: string): string | undefined {
  const value = item?.get(key)
  return typeof value === 'string' ? value : undefined
}

function numberOf(item: YItem, key: string): number | undefined {
  const value = item.get(key)
  return typeof value === 'number' ? value : undefined
}

// A place right of every box on the map, for steps added or pasted without one.
function freePlace(doc: Y.Doc): { x: number; y: number } {
  let right: number | undefined
  let top: number | undefined
  for (const step of itemsOf(doc, 'steps').values()) {
    const x = numberOf(step, 'x') ?? 0
    const y = numberOf(step, 'y') ?? 0
    right = Math.max(right ?? x, x + (numberOf(step, 'width') ?? 240))
    top = Math.min(top ?? y, y)
  }
  return right === undefined ? { x: 0, y: 0 } : { x: right + 80, y: top ?? 0 }
}

// The text ID of a rich text: a text part's, or a step's at a path of its fields (by default its
// message's text, caption or poll question, a question's prompt, a gift's text).
function textIdOf(doc: Y.Doc, at: RichAt): string {
  if ('part' in at) {
    const textId = stringOf(itemOf(doc, 'parts', at.part), 'text')
    if (textId === undefined) {
      throw new Refusal('This part is a row part; only a text part has a text.')
    }
    return textId
  }
  const step = itemOf(doc, 'steps', at.step)
  const path = at.path ?? defaultTextPath(step)
  let value: unknown = step
  for (const segment of path.split('.')) {
    if (value instanceof Y.Map) {
      value = (value as YItem).get(segment)
    } else if (value instanceof Y.Array && /^\d+$/.test(segment)) {
      value = (value as Y.Array<unknown>).get(Number(segment))
    } else {
      value = undefined
    }
  }
  if (typeof value !== 'string' || !doc.getMap('texts').has(value)) {
    throw new Refusal(`The step has no rich text at ${path}. A new caption or text comes with steps.set first.`)
  }
  return value
}

function defaultTextPath(step: YItem): string {
  const kind = step.get('kind')
  if (kind === 'action') {
    return 'action.text'
  }
  const prompt = step.get('prompt')
  const content =
    kind === 'question' && prompt instanceof Y.Map ? (prompt as YItem).get('content') : step.get('content')
  const type = content instanceof Y.Map ? (content as YItem).get('type') : undefined
  const field = type === 'text' ? 'text' : type === 'poll' || type === 'quiz' ? 'question' : 'caption'
  return `${kind === 'question' ? 'prompt.content' : 'content'}.${field}`
}

// The arguments the edits share.
const ref = (what: string) =>
  z.string().min(1).max(64).describe(`The ${what}'s ID name, as spec.json and get_step name it, or its ID.`)
const stepRef = ref('step')
const buttonRef = ref('button')
const variableRef = ref('variable')
const switchRef = ref('test switch')
const partRef = ref('part')
const fileRef = z.string().min(1).max(255).describe("The file's ID, or its name as it was uploaded.")
const designRef = z.string().min(1).max(64).describe("A design's id, from list_designs.")
const languageArg = LangSchema.describe('A language code of the design, such as en or fa.')
const nth = z.number().int().min(0)
const point = z
  .strictObject({ x: z.number(), y: z.number() })
  .describe('A place on the map in pixels: x to the right, y down (a box is about 240 wide).')
const idNameArg = IdNameSchema.optional().describe(
  "An ID name to give it at once (the developer's name for it: a to z, 0 to 9 and _, a letter first), to name it in the edits after this one; made from its title or label otherwise.",
)
const fieldsArg = z
  .record(z.string(), z.unknown())
  .describe(
    "Fields of the step's kind as the design model has them (a wrong field answers the kind's fields as JSON Schema); null clears one. Name items by their ID names. A rich text is { doc: { <language>: <Telegram HTML> } } and becomes a new text.",
  )

const richAt = z.union([
  z.strictObject({
    step: stepRef,
    path: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe(
        "Where the text is in the step's fields, such as content.text, content.caption, content.question, content.explanation, content.items.0.caption, content.blocks.2.text, prompt.content.text or wrongAnswer.message; the message's text, caption or poll question without it.",
      ),
  }),
  z.strictObject({ part: partRef.describe("A text part's ID name or ID.") }),
])
type RichAt = z.output<typeof richAt>

const plainAt = z.union([
  z.strictObject({ bot: z.enum(['name', 'about', 'description']).describe("The bot's name, about or description.") }),
  z.strictObject({
    button: buttonRef,
    field: z
      .enum(['label', 'popup', 'copyText'])
      .describe("The button's label, its popup's text or the text it copies."),
  }),
  z.strictObject({
    step: stepRef,
    field: z
      .enum(['menuDescription', 'placeholder', 'cancelWords', 'invoiceTitle', 'invoiceDescription', 'refuse'])
      .describe(
        "A command's menu text, a bottom keyboard's input hint, a question's cancel words, an invoice's title, description or refusal message.",
      ),
  }),
  z.strictObject({
    step: stepRef,
    field: z.enum(['option', 'shipping']).describe("An option of a poll or quiz, or an invoice's shipping option."),
    option: nth.describe('Which one, from 0.'),
  }),
  z.strictObject({
    step: stepRef,
    field: z.literal('price').describe("A price line's label of an invoice."),
    price: nth.describe('Which one, from 0.'),
  }),
])

function plainAtOf(doc: Y.Doc, at: z.output<typeof plainAt>): PlainTextAt {
  if ('bot' in at) {
    return at
  }
  if ('button' in at) {
    return { ...at, button: idOf(doc, 'buttons', at.button) }
  }
  return { ...at, step: idOf(doc, 'steps', at.step) }
}

const keyboardAt = z
  .union([
    z.strictObject({ step: stepRef }),
    z.strictObject({ part: partRef }),
    z.strictObject({ rich: stepRef.describe('A step whose message is a rich message: its button rows.') }),
  ])
  .describe(
    "Which rows: a step's keyboard (a question's is its prompt's), a row part's rows, or a rich message's rows.",
  )

function keyboardAtOf(doc: Y.Doc, at: z.output<typeof keyboardAt>): KeyboardAt {
  if ('step' in at) {
    return { step: idOf(doc, 'steps', at.step) }
  }
  return 'part' in at ? { part: idOf(doc, 'parts', at.part) } : { rich: idOf(doc, 'steps', at.rich) }
}

const noRows =
  'There are no such rows: the step has no inline or bottom keyboard, the part is not a row part, or the message is not a rich message.'

// Fixes the ID name of an item just made, when the edit asks for one.
function giveIdName(name: string | undefined, fix: (name: string) => boolean): void {
  if (name !== undefined && !fix(name)) {
    throw new Refusal(`The ID name "${name}" is taken by another item.`)
  }
}

function done(ok: boolean, refusal: string): EditResult {
  if (!ok) {
    throw new Refusal(refusal)
  }
  return undefined
}

// The ID of a case of an If or an outcome of a developer step, by its ID or its label.
function listItemId(step: YItem, list: 'cases' | 'outcomes', ref: string): string {
  const items = step.get(list)
  for (const item of items instanceof Y.Array ? (items as Y.Array<unknown>).toArray() : []) {
    const entry = item instanceof Y.Map ? (item as YItem) : undefined
    const id = stringOf(entry, 'id')
    if (id !== undefined && (id === ref || entry?.get('label') === ref)) {
      return id
    }
  }
  throw new Refusal(`This step has no ${list === 'cases' ? 'case' : 'outcome'} "${ref}".`)
}

// A target of an arrow or a button: a step, `back`, `stay`, or none (null).
function targetOf(doc: Y.Doc, to: string | null): string | undefined {
  return to === null ? undefined : keptRefs.has(to) ? to : idOf(doc, 'steps', to)
}

// The ID of a step of another design's plain model, by its ID or its ID name.
function sourceStepId(design: Design, ref: string): string {
  const step = design.steps[ref] ?? Object.values(design.steps).find((item) => item.idName === ref)
  if (!step) {
    throw new Refusal(`There is no step "${ref}" in the design to copy from.`)
  }
  return step.id
}

const steps = [
  defineEdit(
    'steps.add',
    "Adds a step (a box on the map) of a kind, with the palette title, an ID name made from it and the kind's defaults.",
    z.strictObject({
      kind: z
        .enum(stepKinds)
        .describe(
          'start (a start point), message, question, if, remember, wait, devStep (a developer step), goTo, end, note, frame (a section), invoice or action.',
        ),
      title: z.string().max(200).optional().describe('Its name on the map; the palette name without it.'),
      at: point.optional().describe('Its place on the map; right of every box without it.'),
      idName: idNameArg,
      fields: fieldsArg.optional().describe("Fields of the kind's to replace its defaults (see steps.set)."),
    }),
    ({ doc, edits }, input) => {
      const fields = input.fields === undefined ? {} : stepPatch(doc, input.kind, input.fields)
      const id = edits.steps.add(input.kind, input.at ?? freePlace(doc), fields, input.title)
      giveIdName(input.idName, (name) => edits.steps.setIdName(id, name))
      return named(doc, 'steps', id)
    },
  ),
  defineEdit(
    'steps.move',
    'Moves steps on the map, and puts steps into a section or takes them out of theirs.',
    z.strictObject({
      positions: z.record(z.string(), point).optional().describe('Each step (by ID name or ID) at its new place.'),
      sections: z
        .record(z.string(), z.string().nullable())
        .optional()
        .describe('Each step (by ID name or ID) in a section (a frame step), or out of its section (null).'),
    }),
    ({ doc, edits }, input) => {
      const positions = Object.fromEntries(
        Object.entries(input.positions ?? {}).map(([step, at]) => [idOf(doc, 'steps', step), at]),
      )
      const frames = Object.fromEntries(
        Object.entries(input.sections ?? {}).map(([step, frame]) => [
          idOf(doc, 'steps', step),
          frame === null ? null : idOf(doc, 'steps', frame),
        ]),
      )
      edits.steps.move(positions, frames)
      return undefined
    },
  ),
  defineEdit(
    'steps.setTitle',
    'Renames a step; its ID name follows the title until it is fixed.',
    z.strictObject({ step: stepRef, title: z.string().min(1).max(200) }),
    ({ doc, edits }, input) => {
      edits.steps.setTitle(idOf(doc, 'steps', input.step), input.title)
      return named(doc, 'steps', idOf(doc, 'steps', input.step))
    },
  ),
  defineEdit(
    'steps.setIdName',
    "Sets a step's ID name by hand (it stops following the title).",
    z.strictObject({ step: stepRef, idName: IdNameSchema }),
    ({ doc, edits }, input) => {
      giveIdName(input.idName, (name) => edits.steps.setIdName(idOf(doc, 'steps', input.step), name))
      return undefined
    },
  ),
  defineEdit(
    'steps.set',
    'Changes fields of a step (its message, keyboard, options, trigger, cases, conditions and the others of its kind); texts and buttons it no longer uses are deleted.',
    z.strictObject({ step: stepRef, fields: fieldsArg }),
    ({ doc, edits }, input) => {
      const id = idOf(doc, 'steps', input.step)
      const kind = stringOf(itemsOf(doc, 'steps').get(id), 'kind') ?? ''
      return done(
        edits.steps.set(id, stepPatch(doc, kind, input.fields)),
        'The last /start start point keeps its trigger.',
      )
    },
  ),
  defineEdit(
    'steps.connect',
    "Draws an arrow from a step (its next step, a case of an If, an outcome, a question's other ways) to a step, or clears it.",
    z.strictObject({
      step: stepRef.describe('The step the arrow starts from, by its ID name or ID.'),
      arrow: z
        .enum(['next', 'otherwise', 'target', 'afterMaxTries', 'cancel', 'onStop'])
        .optional()
        .describe(
          "Which arrow: next (Then, or a question's answer), otherwise (an If's), target (a Go to's), afterMaxTries (after a question's last wrong answer), cancel (a question's cancel words), onStop (a message the user stops); next without it.",
        ),
      case: z.string().min(1).max(200).optional().describe('A case of an If, by its label or ID, instead of an arrow.'),
      outcome: z
        .string()
        .min(1)
        .max(200)
        .optional()
        .describe('An outcome of a developer step, by its label or ID, instead of an arrow.'),
      to: z
        .string()
        .min(1)
        .max(64)
        .nullable()
        .describe(
          'The step it goes to (its ID name or ID), back (the message step the user came from), or null to clear it.',
        ),
    }),
    ({ doc, edits }, input) => {
      const step = itemOf(doc, 'steps', input.step)
      const id = idOf(doc, 'steps', input.step)
      const kind = stringOf(step, 'kind') ?? ''
      const arrow = input.arrow ?? 'next'
      let from: ArrowFrom = { step: id, arrow }
      if (input.case !== undefined) {
        from = { step: id, case: listItemId(step, 'cases', input.case) }
      } else if (input.outcome !== undefined) {
        from = { step: id, outcome: listItemId(step, 'outcomes', input.outcome) }
      } else if (arrow === 'afterMaxTries' ? kind !== 'question' : stepFields.get(kind)?.fields[arrow] === undefined) {
        // The accessor sets any field it is given; a step only has the arrows of its kind.
        throw new Refusal(`A ${kind} step has no ${arrow} arrow.`)
      }
      return done(edits.steps.connect(from, targetOf(doc, input.to)), 'This step has no such arrow.')
    },
  ),
  defineEdit(
    'steps.duplicate',
    "Copies a step (the map's Duplicate): its fields, arrows out, texts and own buttons, under a new ID name.",
    z.strictObject({
      step: stepRef,
      at: point.optional().describe("The copy's place; next to the step without it."),
      idName: idNameArg,
    }),
    ({ doc, edits }, input) => {
      const step = itemOf(doc, 'steps', input.step)
      const at = input.at ?? { x: (numberOf(step, 'x') ?? 0) + 40, y: (numberOf(step, 'y') ?? 0) + 40 }
      const id = edits.steps.duplicate(idOf(doc, 'steps', input.step), at)
      if (id === undefined) {
        throw new Refusal('The /start start point is not copied: a design has one.')
      }
      giveIdName(input.idName, (name) => edits.steps.setIdName(id, name))
      return named(doc, 'steps', id)
    },
  ),
  defineEdit(
    'steps.remove',
    'Deletes steps: arrows into them are cleared, their own buttons and texts deleted, the last /start stays.',
    z.strictObject({ steps: z.array(stepRef).min(1).max(maxEdits) }),
    ({ doc, edits }, input) => ({
      removed: edits.steps.remove(input.steps.map((step) => idOf(doc, 'steps', step))),
    }),
  ),
]

const keyboard = [
  defineEdit(
    'keyboard.setType',
    "Gives a step's message an inline keyboard, a bottom keyboard, Remove the bottom keyboard, Force a reply, or none; the buttons it had are deleted.",
    z.strictObject({
      step: stepRef,
      type: z
        .enum(['inline', 'reply', 'removeReply', 'forceReply'])
        .nullable()
        .describe(
          'inline (buttons under the message), reply (a bottom keyboard), removeReply, forceReply, or null for none.',
        ),
    }),
    ({ doc, edits }, input) =>
      done(
        edits.keyboard.setType(idOf(doc, 'steps', input.step), input.type),
        'Only a message, a question or an invoice has a keyboard, and an invoice only an inline one.',
      ),
  ),
  defineEdit(
    'keyboard.setOptions',
    "Changes the options of a step's keyboard; null clears one.",
    z.strictObject({
      step: stepRef,
      options: z.strictObject({
        oneTime: z.boolean().nullable().optional().describe('A bottom keyboard hides after a press.'),
        persistent: z.boolean().nullable().optional().describe('A bottom keyboard stays shown.'),
        resize: z.boolean().nullable().optional().describe('A bottom keyboard fits its buttons.'),
        placeholder: LangTextSchema.nullable().optional().describe('The input hint per language.'),
        openReplyField: z.boolean().nullable().optional().describe('Opens the reply field (force_reply).'),
      }),
    }),
    ({ doc, edits }, input) =>
      done(
        edits.keyboard.setOptions(idOf(doc, 'steps', input.step), clearNulls(input.options) as KeyboardOptions),
        'This step has no keyboard; give it one first with keyboard.setType.',
      ),
  ),
  defineEdit(
    'keyboard.addRow',
    'Adds a row with one new button to a keyboard, a row part or a rich message.',
    z.strictObject({
      at: keyboardAt,
      index: nth.optional().describe('Where the row goes, from 0; at the end without it.'),
      label: z.string().max(200).optional().describe("The new button's label in the default language."),
      idName: idNameArg,
    }),
    ({ doc, edits }, input) => {
      const id = edits.keyboard.addRow(keyboardAtOf(doc, input.at), input.index, input.label)
      if (id === undefined) {
        throw new Refusal(noRows)
      }
      giveIdName(input.idName, (name) => edits.buttons.setIdName(id, name))
      return named(doc, 'buttons', id)
    },
  ),
  defineEdit(
    'keyboard.addButton',
    'Adds a new button to a row of a keyboard, a row part or a rich message (an inline one goes to a step, a bottom one sends its text).',
    z.strictObject({
      at: keyboardAt,
      row: nth.describe('The row, from 0; the row after the last makes a new row.'),
      index: nth.optional().describe('Where it goes in the row, from 0; at the end without it.'),
      label: z.string().max(200).optional().describe('Its label in the default language.'),
      idName: idNameArg,
    }),
    ({ doc, edits }, input) => {
      const id = edits.keyboard.addButton(keyboardAtOf(doc, input.at), input.row, input.index, input.label)
      if (id === undefined) {
        throw new Refusal(`${noRows} Or there is no row ${String(input.row)}.`)
      }
      giveIdName(input.idName, (name) => edits.buttons.setIdName(id, name))
      return named(doc, 'buttons', id)
    },
  ),
  defineEdit(
    'keyboard.moveButton',
    'Moves a button within or between rows; a row left empty is removed.',
    z.strictObject({
      at: keyboardAt,
      button: buttonRef,
      toRow: nth.describe('The row it goes to, counted before the move; the row after the last makes a new row.'),
      toIndex: nth.describe('Its place in that row, from 0.'),
    }),
    ({ doc, edits }, input) =>
      done(
        edits.keyboard.moveButton(
          keyboardAtOf(doc, input.at),
          idOf(doc, 'buttons', input.button),
          input.toRow,
          input.toIndex,
        ),
        'The button is not in these rows, or there is no such row.',
      ),
  ),
  defineEdit(
    'keyboard.moveRow',
    'Moves a row of a keyboard, a row part or a rich message.',
    z.strictObject({ at: keyboardAt, from: nth, to: nth }),
    ({ doc, edits }, input) =>
      done(edits.keyboard.moveRow(keyboardAtOf(doc, input.at), input.from, input.to), 'There is no such row.'),
  ),
  defineEdit(
    'keyboard.removeRow',
    'Removes a row: its buttons are deleted; a part row only stops using the part.',
    z.strictObject({ at: keyboardAt, index: nth }),
    ({ doc, edits }, input) =>
      done(edits.keyboard.removeRow(keyboardAtOf(doc, input.at), input.index), 'There is no such row.'),
  ),
  defineEdit(
    'keyboard.usePart',
    "Places a row part in a step's keyboard.",
    z.strictObject({
      step: stepRef,
      part: partRef,
      index: nth.optional().describe('Where the row goes, from 0; at the end without it.'),
    }),
    ({ doc, edits }, input) => {
      if (stringOf(itemOf(doc, 'parts', input.part), 'kind') !== 'rows') {
        throw new Refusal('Only a row part goes in a keyboard.')
      }
      return done(
        edits.keyboard.usePart(idOf(doc, 'steps', input.step), idOf(doc, 'parts', input.part), input.index),
        'The step has no inline or bottom keyboard.',
      )
    },
  ),
]

const buttons = [
  defineEdit(
    'buttons.setLabel',
    "A button's label in a language ('' clears it); its ID name follows the default language's label.",
    z.strictObject({ button: buttonRef, language: languageArg, text: z.string().max(200) }),
    ({ doc, edits }, input) => {
      const id = idOf(doc, 'buttons', input.button)
      edits.buttons.setLabel(id, languageOf(doc, input.language), input.text)
      return named(doc, 'buttons', id)
    },
  ),
  defineEdit(
    'buttons.setLook',
    "A button's color.",
    z.strictObject({
      button: buttonRef,
      look: LookSchema.describe('default, primary (blue), success (green) or danger (red).'),
    }),
    ({ doc, edits }, input) => {
      edits.buttons.setLook(idOf(doc, 'buttons', input.button), input.look)
      return undefined
    },
  ),
  defineEdit(
    'buttons.setIcon',
    "A button's custom emoji icon, or none (null).",
    z.strictObject({
      button: buttonRef,
      icon: z
        .strictObject({ customEmojiId: z.string().min(1).max(64), fallback: z.string().min(1).max(16) })
        .nullable()
        .describe("The custom emoji's ID and the emoji shown where it cannot be."),
    }),
    ({ doc, edits }, input) => {
      edits.buttons.setIcon(idOf(doc, 'buttons', input.button), input.icon ?? undefined)
      return undefined
    },
  ),
  defineEdit(
    'buttons.setDisabled',
    'An inline button shown but doing nothing, or working again.',
    z.strictObject({ button: buttonRef, disabled: z.boolean() }),
    ({ doc, edits }, input) =>
      done(
        edits.buttons.setDisabled(idOf(doc, 'buttons', input.button), input.disabled),
        'Only an inline button can do nothing.',
      ),
  ),
  defineEdit(
    'buttons.setAction',
    'What a button does: an inline one goes to a step, opens a link, copies a text, logs in or pays; a bottom one sends its text or shares something.',
    z.strictObject({
      button: buttonRef,
      action: z
        .union([InlineActionSchema, ReplyActionSchema])
        .describe('The action as the design model has it; steps and variables by their ID names.'),
    }),
    ({ doc, edits }, input) =>
      done(
        edits.buttons.setAction(idOf(doc, 'buttons', input.button), withIds(doc, input.action) as typeof input.action),
        "The action does not fit the button's place (inline or bottom keyboard).",
      ),
  ),
  defineEdit(
    'buttons.setTarget',
    'Where a button goes, or nowhere (null).',
    z.strictObject({
      button: buttonRef,
      to: z
        .string()
        .min(1)
        .max(64)
        .nullable()
        .describe('A step (its ID name or ID), back, stay (an inline button keeps the message), or null.'),
    }),
    ({ doc, edits }, input) =>
      done(
        edits.buttons.setTarget(idOf(doc, 'buttons', input.button), targetOf(doc, input.to)),
        'This button goes nowhere (a link, a copied text, a login or pay), or only an inline button that goes to a step can stay.',
      ),
  ),
  defineEdit(
    'buttons.setIdName',
    "Sets a button's ID name by hand (it stops following the label).",
    z.strictObject({ button: buttonRef, idName: IdNameSchema }),
    ({ doc, edits }, input) => {
      giveIdName(input.idName, (name) => edits.buttons.setIdName(idOf(doc, 'buttons', input.button), name))
      return undefined
    },
  ),
  defineEdit(
    'buttons.remove',
    'Deletes a button from every row it is in.',
    z.strictObject({ button: buttonRef }),
    ({ doc, edits }, input) => {
      edits.buttons.remove(idOf(doc, 'buttons', input.button))
      return undefined
    },
  ),
]

const texts = [
  defineEdit(
    'texts.setRich',
    "Replaces a rich text in a language: a message's text or caption, a question's prompt or wrong answer message, a poll's question, a text part.",
    z
      .strictObject({
        at: richAt,
        language: languageArg,
        html: z
          .string()
          .max(100_000)
          .optional()
          .describe(
            'The words as Telegram HTML (b, i, u, s, tg-spoiler, code, pre, blockquote, a href); {name} places the variable of that ID name.',
          ),
        doc: RichDocSchema.optional().describe("Or the editor's rich text (TipTap JSON), for text parts placed in it."),
      })
      .refine((input) => (input.html === undefined) !== (input.doc === undefined), 'Give html or doc, one of them.'),
    ({ doc, edits }, input) => {
      const textId = textIdOf(doc, input.at)
      const lang = languageOf(doc, input.language)
      edits.texts.setRich(
        textId,
        lang,
        input.html === undefined ? (withIds(doc, input.doc) as RichDoc) : fromHtml(doc, input.html),
      )
      return undefined
    },
  ),
  defineEdit(
    'texts.setPlain',
    "A plain text in a language ('' clears it): the bot's name, about or description, a button's label or popup, a command's menu text, an input hint, cancel words, a poll option, an invoice's texts.",
    z.strictObject({ at: plainAt, language: languageArg, text: z.string().max(10_000) }),
    ({ doc, edits }, input) =>
      done(
        edits.texts.setPlain(plainAtOf(doc, input.at), languageOf(doc, input.language), input.text),
        'This place cannot hold a text (for example a menu text of a start point that is not a command).',
      ),
  ),
  defineEdit(
    'texts.copyDefault',
    "Copy the default language into empty cells: each of these texts empty in another language gets the default language's text, marked not translated until edited.",
    z.strictObject({
      places: z
        .array(z.union([richAt, plainAt]))
        .min(1)
        .max(maxEdits),
    }),
    ({ doc, edits }, input) => {
      const places = input.places.map((at): TextAt =>
        'field' in at || 'bot' in at ? plainAtOf(doc, at) : { text: textIdOf(doc, at) },
      )
      return { filled: edits.texts.copyDefault(places) }
    },
  ),
]

const languages = [
  defineEdit(
    'languages.add',
    'Adds a language to the design; every text gets an empty place for it.',
    z.strictObject({ language: LangSchema.describe('A language code, such as fa or pt-br.') }),
    ({ edits }, input) => done(edits.languages.add(input.language), 'The design has this language already.'),
  ),
  defineEdit(
    'languages.remove',
    'Removes a language and every text in it.',
    z.strictObject({ language: languageArg }),
    ({ edits }, input) =>
      done(edits.languages.remove(input.language), 'The design has no such language, or it is the default one.'),
  ),
  defineEdit(
    'languages.setDefault',
    "Makes one of the design's languages the default one.",
    z.strictObject({ language: languageArg }),
    ({ edits }, input) => done(edits.languages.setDefault(input.language), 'The design has no such language.'),
  ),
]

const testValue = z.union([z.string(), z.number(), z.boolean()])
const switchType = z.enum(['yesNo', 'choice']).describe('yesNo, or choice (one of its options).')

const variables = [
  defineEdit(
    'variables.add',
    'Adds a variable, with an ID name made from its label.',
    z.strictObject({
      label: z.string().min(1).max(100),
      type: VariableTypeSchema,
      source: VariableSourceSchema.exclude(['builtin'])
        .optional()
        .describe('What sets it: question, remember, devStep, button or startLink; remember without it.'),
      description: z.string().max(2000).optional(),
      testValue: testValue.optional().describe('The value Try it starts with.'),
      idName: idNameArg,
    }),
    ({ doc, edits }, input) => {
      const id = edits.variables.add({
        label: input.label,
        type: input.type,
        source: input.source ?? 'remember',
        description: input.description,
        testValue: input.testValue,
      })
      giveIdName(input.idName, (name) => edits.variables.setIdName(id, name))
      return named(doc, 'variables', id)
    },
  ),
  defineEdit(
    'variables.set',
    'Changes a variable (not a built-in one); null clears a field; its ID name follows the label until it is fixed.',
    z.strictObject({
      variable: variableRef,
      fields: z.strictObject({
        label: z.string().min(1).max(100).optional(),
        type: VariableTypeSchema.optional(),
        description: z.string().max(2000).nullable().optional(),
        testValue: testValue.nullable().optional(),
      }),
    }),
    ({ doc, edits }, input) => {
      const id = idOf(doc, 'variables', input.variable)
      done(edits.variables.set(id, clearNulls(input.fields)), 'A built-in variable cannot be changed.')
      return named(doc, 'variables', id)
    },
  ),
  defineEdit(
    'variables.setIdName',
    "Sets a variable's ID name by hand.",
    z.strictObject({ variable: variableRef, idName: IdNameSchema }),
    ({ doc, edits }, input) => {
      giveIdName(input.idName, (name) => edits.variables.setIdName(idOf(doc, 'variables', input.variable), name))
      return undefined
    },
  ),
  defineEdit(
    'variables.remove',
    'Deletes a variable (not a built-in one); the checks list the places still using it.',
    z.strictObject({ variable: variableRef }),
    ({ doc, edits }, input) =>
      done(edits.variables.remove(idOf(doc, 'variables', input.variable)), 'A built-in variable cannot be deleted.'),
  ),
]

const switches = [
  defineEdit(
    'switches.add',
    'Adds a test switch: a fact about the user only the developer knows ("User is admin"), set in Try it.',
    z.strictObject({
      label: z.string().min(1).max(100),
      type: switchType,
      options: z.array(z.string().max(100)).max(50).optional().describe('The choices of a choice switch.'),
      testValue: z.union([z.boolean(), z.string()]).describe('Its value in Try it: yes or no, or one of the choices.'),
      description: z.string().max(2000).optional().describe('How the developer knows it.'),
      idName: idNameArg,
    }),
    ({ doc, edits }, input) => {
      const id = edits.switches.add({
        label: input.label,
        type: input.type,
        options: input.options,
        testValue: input.testValue,
        description: input.description,
      })
      giveIdName(input.idName, (name) => edits.switches.setIdName(id, name))
      return named(doc, 'switches', id)
    },
  ),
  defineEdit(
    'switches.set',
    'Changes a test switch; null clears a field; its ID name follows the label until it is fixed.',
    z.strictObject({
      switch: switchRef,
      fields: z.strictObject({
        label: z.string().min(1).max(100).optional(),
        type: switchType.optional(),
        options: z.array(z.string().max(100)).max(50).nullable().optional(),
        testValue: z.union([z.boolean(), z.string()]).optional(),
        description: z.string().max(2000).nullable().optional(),
      }),
    }),
    ({ doc, edits }, input) => {
      const id = idOf(doc, 'switches', input.switch)
      edits.switches.set(id, clearNulls(input.fields))
      return named(doc, 'switches', id)
    },
  ),
  defineEdit(
    'switches.setIdName',
    "Sets a test switch's ID name by hand.",
    z.strictObject({ switch: switchRef, idName: IdNameSchema }),
    ({ doc, edits }, input) => {
      giveIdName(input.idName, (name) => edits.switches.setIdName(idOf(doc, 'switches', input.switch), name))
      return undefined
    },
  ),
  defineEdit(
    'switches.remove',
    'Deletes a test switch; the checks list the conditions still using it.',
    z.strictObject({ switch: switchRef }),
    ({ doc, edits }, input) => {
      edits.switches.remove(idOf(doc, 'switches', input.switch))
      return undefined
    },
  ),
]

const parts = [
  defineEdit(
    'parts.addRows',
    'Adds an empty row part: button rows to place in many keyboards.',
    z.strictObject({
      name: z.string().min(1).max(100),
      place: z.enum(['inline', 'reply']).describe('For inline keyboards or bottom keyboards.'),
      idName: idNameArg,
    }),
    ({ doc, edits }, input) => {
      const id = edits.parts.addRows(input.name, input.place)
      giveIdName(input.idName, (name) => edits.parts.setIdName(id, name))
      return named(doc, 'parts', id)
    },
  ),
  defineEdit(
    'parts.addText',
    'Adds an empty text part: a text to place in many texts (its words with texts.setRich).',
    z.strictObject({ name: z.string().min(1).max(100), idName: idNameArg }),
    ({ doc, edits }, input) => {
      const id = edits.parts.addText(input.name)
      giveIdName(input.idName, (name) => edits.parts.setIdName(id, name))
      return named(doc, 'parts', id)
    },
  ),
  defineEdit(
    'parts.fromButtons',
    "Make a part from its buttons: the button rows of a step's keyboard become a new row part placed there.",
    z.strictObject({ step: stepRef, name: z.string().min(1).max(100), idName: idNameArg }),
    ({ doc, edits }, input) => {
      const id = edits.parts.fromButtons(idOf(doc, 'steps', input.step), input.name)
      if (id === undefined) {
        throw new Refusal("The step's keyboard has no buttons of its own.")
      }
      giveIdName(input.idName, (name) => edits.parts.setIdName(id, name))
      return named(doc, 'parts', id)
    },
  ),
  defineEdit(
    'parts.rename',
    'Renames a part; its ID name follows the name until it is fixed.',
    z.strictObject({ part: partRef, name: z.string().min(1).max(100) }),
    ({ doc, edits }, input) => {
      const id = idOf(doc, 'parts', input.part)
      edits.parts.rename(id, input.name)
      return named(doc, 'parts', id)
    },
  ),
  defineEdit(
    'parts.setIdName',
    "Sets a part's ID name by hand.",
    z.strictObject({ part: partRef, idName: IdNameSchema }),
    ({ doc, edits }, input) => {
      giveIdName(input.idName, (name) => edits.parts.setIdName(idOf(doc, 'parts', input.part), name))
      return undefined
    },
  ),
  defineEdit(
    'parts.detach',
    "Detach: a step's uses of a part become its own buttons or text.",
    z.strictObject({ step: stepRef, part: partRef }),
    ({ doc, edits }, input) => {
      edits.parts.detach(idOf(doc, 'steps', input.step), idOf(doc, 'parts', input.part))
      return undefined
    },
  ),
  defineEdit(
    'parts.remove',
    'Deletes a part: every use is detached first.',
    z.strictObject({ part: partRef }),
    ({ doc, edits }, input) => {
      edits.parts.remove(idOf(doc, 'parts', input.part))
      return undefined
    },
  ),
]

const bot = [
  defineEdit(
    'bot.setUsername',
    "The bot's username without the @ ('' clears it), for the start links.",
    z.strictObject({ username: z.string().max(64) }),
    ({ edits }, input) => {
      edits.bot.setUsername(input.username.replace(/^@/, ''))
      return undefined
    },
  ),
  defineEdit(
    'bot.setMenuButton',
    "The menu button: the commands menu, or Telegram's default.",
    z.strictObject({ menuButton: z.enum(['commands', 'default']) }),
    ({ edits }, input) => {
      edits.bot.setMenuButton(input.menuButton)
      return undefined
    },
  ),
  defineEdit(
    'bot.setPhoto',
    "The bot's profile photo: an uploaded file or a placeholder the developer fills, or none (null).",
    z.strictObject({
      photo: MediaSlotSchema.nullable().describe(
        '{ media: <file ID or name> } or { placeholder: { description } }, or null.',
      ),
    }),
    ({ doc, edits }, input) => {
      edits.bot.setPhoto(input.photo === null ? undefined : (withIds(doc, input.photo) as MediaSlot))
      return undefined
    },
  ),
  defineEdit(
    'bot.moveCommand',
    'Moves a command in the commands menu.',
    z.strictObject({
      step: stepRef.describe("A command start point's ID name or ID."),
      to: nth.describe('Its place in the menu, from 0.'),
    }),
    ({ doc, edits }, input) =>
      done(edits.bot.moveCommand(idOf(doc, 'steps', input.step), input.to), 'This step is not a command of the menu.'),
  ),
]

const media = [
  defineEdit(
    'media.rename',
    'Renames an uploaded file.',
    z.strictObject({ file: fileRef, name: z.string().min(1).max(255) }),
    ({ doc, edits }, input) => {
      edits.media.rename(idOf(doc, 'media', input.file), input.name)
      return undefined
    },
  ),
  defineEdit(
    'media.remove',
    'Deletes an uploaded file; the places that showed it become placeholders.',
    z.strictObject({ file: fileRef }),
    ({ doc, edits }, input) => {
      edits.media.remove(idOf(doc, 'media', input.file))
      return undefined
    },
  ),
]

const map = [
  defineEdit(
    'map.paste',
    "Copies steps with what they use (the map's Copy and Paste), from this design or another one you can open, under new IDs and ID names.",
    z.strictObject({
      steps: z.array(stepRef).min(1).max(maxEdits).describe('The steps to copy (a section brings its steps).'),
      from: designRef.optional().describe('The design to copy from; this one without it.'),
      at: point.optional().describe('The top left corner of the pasted boxes; right of every box without it.'),
    }),
    ({ doc, edits, source }, input) => {
      const design = source(input.from)
      const clip = copySteps(
        design,
        input.steps.map((step) => sourceStepId(design, step)),
      )
      if (!clip) {
        throw new Refusal('Nothing to copy: the /start start point stays behind (a design has one).')
      }
      const pasted = edits.map.paste(clip, input.at ?? freePlace(doc))
      return { steps: pasted.map((id) => named(doc, 'steps', id)) }
    },
    (input) => (input.from === undefined ? [] : [input.from]),
  ),
  defineEdit(
    'map.arrange',
    'Arranges the map: each step at its new place, and sections at a new size.',
    z.strictObject({
      boxes: z
        .record(
          z.string(),
          z.strictObject({
            x: z.number(),
            y: z.number(),
            width: z.number().positive().optional(),
            height: z.number().positive().optional(),
          }),
        )
        .describe('Each step (by ID name or ID) at its place; a section (frame) also with its width and height.'),
    }),
    ({ doc, edits }, input) => {
      edits.map.arrange(
        Object.fromEntries(Object.entries(input.boxes).map(([step, box]) => [idOf(doc, 'steps', step), box])),
      )
      return undefined
    },
  ),
]

const issueArgs = z.strictObject({
  code: z.string().min(1).max(64).describe("The check's code, as list_checks gives it."),
  step: stepRef.optional().describe('The step it is about (where), if any.'),
  button: buttonRef.optional().describe('The button it is about, if any.'),
  language: languageArg.optional().describe('The language it is about, if any.'),
})

// The issue of a check as list_checks names it.
function issueOf(doc: Y.Doc, input: z.output<typeof issueArgs>): Issue {
  if (!Object.hasOwn(CHECK_LEVELS, input.code)) {
    throw new Refusal(`There is no check "${input.code}".`)
  }
  const code = input.code as IssueCode
  const level = CHECK_LEVELS[code]
  return {
    code,
    level,
    stepId: input.step === undefined ? undefined : idOf(doc, 'steps', input.step),
    buttonId: input.button === undefined ? undefined : idOf(doc, 'buttons', input.button),
    language: input.language,
    message: '',
    ignorable: level !== 'error',
  }
}

const checks = [
  defineEdit(
    'checks.ignore',
    'Ignore here: marks a warning or a good-to-know as seen; errors are never ignored.',
    issueArgs,
    ({ doc, edits }, input) =>
      done(edits.checks.ignore(issueOf(doc, input)), 'This check is an error, or it is ignored already.'),
  ),
  defineEdit(
    'checks.stopIgnoring',
    'Stop ignoring: a check marked Ignore here shows again.',
    issueArgs,
    ({ doc, edits }, input) => done(edits.checks.stopIgnoring(issueOf(doc, input)), 'This check is not ignored.'),
  ),
]

// Every edit Claude can make to a design's content, in the editor's order of areas.
export const designEditList: readonly DesignEdit[] = [
  ...steps,
  ...keyboard,
  ...buttons,
  ...texts,
  ...languages,
  ...variables,
  ...switches,
  ...parts,
  ...bot,
  ...media,
  ...map,
  ...checks,
]
const editsByName = new Map(designEditList.map((edit) => [edit.name, edit]))

// One edit of a call: its name and its input.
export interface EditCall {
  edit: string
  input?: unknown
}

interface CheckedCall {
  edit: DesignEdit
  input: unknown
}

function editFailed(index: number, name: string, message: string): ApiError {
  return new ApiError('bad_request', `Edit ${String(index + 1)} (${name}): ${message}`)
}

// Every call's edit and input, checked before anything runs.
function checkCalls(calls: readonly EditCall[]): CheckedCall[] {
  return calls.map((call, index) => {
    const edit = editsByName.get(call.edit)
    if (!edit) {
      throw editFailed(index, call.edit, `there is no such edit. The edits: ${[...editsByName.keys()].join(', ')}.`)
    }
    const result = edit.input.safeParse(call.input ?? {}, { error: plainMessage })
    if (!result.success) {
      throw editFailed(index, edit.name, `${problemsOf(result.error)} Its input: ${formOf(edit.input)}`)
    }
    return { edit, input: result.data }
  })
}

// The IDs of the named items now, with their ID names (a file's name).
function itemIds(doc: Y.Doc): Map<Collection, Map<string, unknown>> {
  return new Map(
    collections.map((collection) => {
      const field = nameField(collection)
      const items = new Map<string, unknown>()
      for (const [id, item] of itemsOf(doc, collection)) {
        items.set(id, item.get(field))
      }
      return [collection, items]
    }),
  )
}

// The answer of a call: each edit's own, and every item the call made and removed.
export interface EditAnswer {
  edits: Record<string, unknown>[]
  created: Record<string, unknown>[]
  removed: Record<string, unknown>[]
}

function changesSince(doc: Y.Doc, before: Map<Collection, Map<string, unknown>>): Omit<EditAnswer, 'edits'> {
  const after = itemIds(doc)
  const listed = (from: typeof before, to: typeof before) =>
    collections.flatMap((collection) =>
      [...(from.get(collection) ?? new Map<string, unknown>())]
        .filter(([id]) => to.get(collection)?.has(id) !== true)
        .map(([id, name]) => ({ kind: kinds[collection], id, [nameField(collection)]: name })),
    )
  return { created: listed(after, before), removed: listed(before, after) }
}

// Refuses a result the editor could not open: a document that no longer reads as a design.
function checkResult(doc: Y.Doc): void {
  let problems: string
  try {
    const result = validateDesign(readDesign(doc))
    if (result.ok) {
      return
    }
    problems = result.problems
      .slice(0, 5)
      .map((problem) => `${problem.path} ${problem.message}`)
      .join('; ')
  } catch (error) {
    problems = error instanceof Error ? error.message : 'it does not read as a design'
  }
  throw new ApiError('bad_request', `These edits would leave the design broken (${problems}). Nothing was changed.`)
}

// Who makes the change in the document while the edits run; the change reaches the design as the
// person's (editDesignAs).
const editOrigin = Symbol('claude-edits')

// Runs the checked calls on a document in one transaction; a refusal names its edit.
function runCalls(doc: Y.Doc, calls: readonly CheckedCall[], sources: ReadonlyMap<string, Design>): EditAnswer {
  const before = itemIds(doc)
  const ctx: EditContext = {
    doc,
    edits: designEdits(doc, editOrigin),
    source: (designId) => {
      const design = designId === undefined ? undefined : sources.get(designId)
      return design ?? readDesign(doc)
    },
  }
  const results = doc.transact(
    () =>
      calls.map(({ edit, input }, index) => {
        try {
          return { edit: edit.name, ...edit.run(ctx, input) }
        } catch (error) {
          if (error instanceof Refusal) {
            throw editFailed(index, edit.name, error.message)
          }
          throw error
        }
      }),
    editOrigin,
  )
  checkResult(doc)
  return { edits: results, ...changesSince(doc, before) }
}

// The other designs the calls copy from, as their plain models: each one the person can open.
async function sourcesOf(userId: string, designId: string, calls: readonly CheckedCall[]) {
  const sources = new Map<string, Design>()
  const ids = new Set(calls.flatMap(({ edit, input }) => edit.sources?.(input) ?? []))
  for (const id of ids) {
    if (id === designId) {
      continue
    }
    if (getDesignRole(userId, id) === null) {
      throw new ApiError('not_found', 'The design to copy from was not found.')
    }
    await flushLiveDesign(id)
    const stored = loadDoc(id)
    if (!stored) {
      throw new ApiError('not_found', 'The design to copy from has no document yet.')
    }
    sources.set(id, readDesign(stored.doc))
  }
  return sources
}

// Runs a list of edits on a design as one change by the person: all of them, or none and an
// ApiError naming the edit that could not be done. The person must be an editor of the design or
// above; without a role it is "not found", as the read tools answer.
export async function editDesign(userId: string, designId: string, calls: readonly EditCall[]): Promise<EditAnswer> {
  const role = getDesignRole(userId, designId)
  if (role === null) {
    throw new ApiError('not_found', 'This design was not found.')
  }
  if (!hasRole(role, 'editor')) {
    throw new ApiError('no_access', 'You can open this design but not edit it.')
  }
  const checked = checkCalls(calls)
  const sources = await sourcesOf(userId, designId, checked)
  const edited = await editDesignAs(designId, userId, (doc) => runCalls(doc, checked, sources))
  if (edited === null) {
    throw new ApiError('too_large', 'This design is too big to save more changes.')
  }
  return edited.value
}
