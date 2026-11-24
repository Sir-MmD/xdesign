// Where the document refers to steps, buttons, texts and media (docs/plan/03-design-model.md
// sections 2 and 3): the walkers behind the cascades of rule 2, `tidy` and the language
// changes. Each knows the fields of the plain model that hold such a reference.
import * as Y from 'yjs'

import type { ButtonId, StepId, TextId } from '../model/ids.ts'
import type { RichTextRef } from '../model/texts.ts'
import { fromY, languagesOf, yarray, ymap, ystring, type DesignMaps, type YMap } from './layout.ts'
import { addRichText } from './rich.ts'

type Holder = Record<string, unknown>

function isObject(value: unknown): value is Holder {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Calls `visit(holder, key)` for every rich text of a plain step or part: `holder[key]` is a
 * `RichTextRef`, or its text ID as Yjs stores it. A message's text and captions, a poll's or
 * quiz's question and a quiz's explanation, each text of a rich message's blocks, a question's
 * prompt and wrong answer message, a gift's text, a text part's text.
 */
export function forEachRichSlot(item: unknown, visit: (holder: Holder, key: string) => void): void {
  if (!isObject(item)) return
  const content = (value: unknown) => {
    if (!isObject(value)) return
    if (value.type === 'text' && value.text !== undefined) visit(value, 'text')
    if (value.caption !== undefined) visit(value, 'caption')
    if ((value.type === 'poll' || value.type === 'quiz') && value.question !== undefined) visit(value, 'question')
    if (value.type === 'quiz' && value.explanation !== undefined) visit(value, 'explanation')
    if (value.type === 'album' && Array.isArray(value.items)) {
      for (const albumItem of value.items) {
        if (isObject(albumItem) && albumItem.caption !== undefined) visit(albumItem, 'caption')
      }
    }
    if (value.type === 'rich' && Array.isArray(value.blocks)) {
      for (const block of value.blocks) if (isObject(block)) richBlock(block)
    }
  }
  // A rich message's block: its own texts, a list's items and a table's cells.
  const richBlock = (block: Holder) => {
    for (const key of ['text', 'summary', 'credit', 'caption']) if (block[key] !== undefined) visit(block, key)
    const items: unknown[] = Array.isArray(block.items) ? block.items : []
    const rows: unknown[] = Array.isArray(block.rows) ? block.rows : []
    const cells = rows.flatMap((row): unknown[] => (isObject(row) && Array.isArray(row.cells) ? row.cells : []))
    for (const holder of [...items, ...cells]) if (isObject(holder) && holder.text !== undefined) visit(holder, 'text')
  }
  switch (item.kind) {
    case 'message':
      content(item.content)
      break
    case 'question':
      if (isObject(item.prompt)) content(item.prompt.content)
      if (isObject(item.wrongAnswer) && item.wrongAnswer.message !== undefined) visit(item.wrongAnswer, 'message')
      break
    case 'action':
      if (isObject(item.action) && item.action.type === 'gift' && item.action.text !== undefined) {
        visit(item.action, 'text')
      }
      break
    // A text part (steps have no kind `text`).
    case 'text':
      if (item.text !== undefined) visit(item, 'text')
      break
  }
}

/**
 * A copy of a plain step or part (or of some of its fields, with its `kind`) as Yjs stores it:
 * each rich text is its text ID, and a text the document does not have yet is added with its
 * documents (an existing one keeps its fragments, which people type into).
 */
export function storeTexts(maps: DesignMaps, item: object): Holder {
  const copy = JSON.parse(JSON.stringify(item)) as Holder
  forEachRichSlot(copy, (holder, key) => {
    const ref = holder[key] as RichTextRef
    holder[key] = ref.id
    if (!maps.texts.has(ref.id)) addRichText(maps.texts, ref.id, ref.doc, languagesOf(maps))
  })
  return copy
}

/** The text IDs a step or part in Yjs uses. */
export function textIdsOf(item: YMap): TextId[] {
  const ids: TextId[] = []
  forEachRichSlot(fromY(item), (holder, key) => {
    const id = holder[key]
    if (typeof id === 'string') ids.push(id)
  })
  return ids
}

/** A message's content, or a question's prompt content. */
export function stepContent(step: YMap): YMap | undefined {
  return ystring(step, 'kind') === 'question' ? ymap(ymap(step, 'prompt'), 'content') : ymap(step, 'content')
}

/** The content of a step's poll or quiz, if it sends one. */
export function pollOf(step: YMap): YMap | undefined {
  const content = stepContent(step)
  const type = ystring(content, 'type')
  return type === 'poll' || type === 'quiz' ? content : undefined
}

/** A message's keyboard, or a question's prompt keyboard. */
export function stepKeyboard(step: YMap): YMap | undefined {
  return ystring(step, 'kind') === 'question' ? ymap(ymap(step, 'prompt'), 'keyboard') : ymap(step, 'keyboard')
}

/** The `buttons` blocks of a step's rich message, as Yjs stores them. */
function richButtonBlocks(step: YMap): YMap[] {
  const content = stepContent(step)
  if (ystring(content, 'type') !== 'rich') return []
  return (yarray(content, 'blocks')?.toArray() ?? []).filter(
    (block): block is YMap => block instanceof Y.Map && ystring(block as YMap, 'type') === 'buttons',
  )
}

/**
 * Calls `visit(ids, rows, index)` for every list of button IDs: the button rows of every
 * keyboard (`ids` of a `buttons` row), the rows of every row part and the `buttons` blocks of a
 * rich message (whose `rows` is the message's blocks); `rows.get(index)` is the row or block
 * the list belongs to.
 */
export function forEachButtonList(
  maps: DesignMaps,
  visit: (ids: Y.Array<unknown>, rows: Y.Array<unknown>, index: number) => void,
): void {
  const lists: [Y.Array<unknown>, Y.Array<unknown>, number][] = []
  maps.steps.forEach((step) => {
    const rows = yarray(stepKeyboard(step), 'rows')
    rows?.forEach((row, index) => {
      const ids = row instanceof Y.Map ? yarray(row as YMap, 'ids') : undefined
      if (ids) lists.push([ids, rows, index])
    })
    const blocks = yarray(stepContent(step), 'blocks')
    for (const block of richButtonBlocks(step)) {
      const ids = yarray(block, 'ids')
      if (ids && blocks) lists.push([ids, blocks, blocks.toArray().indexOf(block)])
    }
  })
  maps.parts.forEach((part) => {
    const rows = yarray(part, 'rows')
    rows?.forEach((row, index) => {
      if (row instanceof Y.Array) lists.push([row as Y.Array<unknown>, rows, index])
    })
  })
  // Collected first, so the visitor may change the rows.
  for (const [ids, rows, index] of lists) visit(ids, rows, index)
}

/** The buttons of a step's keyboard (not those of the part rows in it) and of its rich message. */
export function buttonIdsOf(step: YMap): ButtonId[] {
  const ids: ButtonId[] = []
  const rows = (yarray(stepKeyboard(step), 'rows')?.toArray() ?? []).filter((row) => row instanceof Y.Map) as YMap[]
  for (const row of [...rows, ...richButtonBlocks(step)]) {
    for (const id of yarray(row, 'ids')?.toArray() ?? []) if (typeof id === 'string') ids.push(id)
  }
  return ids
}

/** Removes buttons from every row; a row left without buttons is removed too. */
export function removeFromRows(maps: DesignMaps, ids: ReadonlySet<ButtonId>): void {
  const emptied: [Y.Array<unknown>, unknown][] = []
  forEachButtonList(maps, (list, rows, index) => {
    for (let i = list.length - 1; i >= 0; i--) {
      const id = list.get(i)
      if (typeof id === 'string' && ids.has(id)) list.delete(i, 1)
    }
    if (list.length === 0) emptied.push([rows, rows.get(index)])
  })
  for (const [rows, row] of emptied) {
    const index = rows.toArray().indexOf(row)
    if (index >= 0) rows.delete(index, 1)
  }
}

/** The texts and buttons some step or part uses. */
export function usedIds(maps: DesignMaps): { texts: Set<TextId>; buttons: Set<ButtonId> } {
  const texts = new Set<TextId>()
  const buttons = new Set<ButtonId>()
  for (const collection of [maps.steps, maps.parts]) {
    collection.forEach((item) => {
      for (const id of textIdsOf(item)) texts.add(id)
    })
  }
  forEachButtonList(maps, (list) => {
    for (const id of list.toArray()) if (typeof id === 'string') buttons.add(id)
  })
  return { texts, buttons }
}

/** Deletes those of the given texts and buttons that no step or part uses any more. */
export function deleteUnused(maps: DesignMaps, texts: Iterable<TextId>, buttons: Iterable<ButtonId>): void {
  const used = usedIds(maps)
  for (const id of texts) if (!used.texts.has(id)) maps.texts.delete(id)
  for (const id of buttons) if (!used.buttons.has(id)) maps.buttons.delete(id)
}

/**
 * Calls `visit(holder, key)` for every arrow: `holder.get(key)` is its target. A step's `next`,
 * `otherwise`, `target` and `onStop`, case and outcome `goTo`, `wrongAnswer.afterMaxTries`,
 * `cancel.goTo`, and every button's target.
 */
export function forEachArrow(maps: DesignMaps, visit: (holder: YMap, key: string) => void): void {
  const visitKey = (holder: YMap | undefined, key: string) => {
    if (holder?.has(key)) visit(holder, key)
  }
  maps.steps.forEach((step) => {
    for (const key of ['next', 'otherwise', 'target', 'onStop']) visitKey(step, key)
    for (const list of ['cases', 'outcomes']) {
      yarray(step, list)?.forEach((item) => {
        if (item instanceof Y.Map) visitKey(item as YMap, 'goTo')
      })
    }
    visitKey(ymap(step, 'wrongAnswer'), 'afterMaxTries')
    visitKey(ymap(step, 'cancel'), 'goTo')
  })
  maps.buttons.forEach((button) => {
    const action = ymap(button, 'action')
    visitKey(action, 'target')
    visitKey(action, 'goTo')
  })
}

/**
 * The conditions of a step in Yjs: each case of an "If", a wait's `stopWhen` and a broadcast's
 * audience (a broadcast to everyone has none).
 */
export function conditionMaps(step: YMap): YMap[] {
  const conditions: YMap[] = []
  yarray(step, 'cases')?.forEach((item) => {
    const when = item instanceof Y.Map ? ymap(item as YMap, 'when') : undefined
    if (when) conditions.push(when)
  })
  const stopWhen = ymap(step, 'stopWhen')
  if (stopWhen) conditions.push(stopWhen)
  const audience = ymap(ymap(step, 'trigger'), 'audience')
  if (audience) conditions.push(audience)
  return conditions
}

/**
 * Clears every arrow into the given steps, the frame of the steps inside a given frame, the
 * invoice a payment start point or a refund names and the step an action acts on; a condition
 * item about a given invoice (`hasPaid`, `subscribed`) is removed.
 */
export function clearArrowsInto(maps: DesignMaps, ids: ReadonlySet<StepId>): void {
  forEachArrow(maps, (holder, key) => {
    const target = holder.get(key)
    if (typeof target === 'string' && ids.has(target)) holder.delete(key)
  })
  const named = (holder: YMap | undefined, key: string) => {
    const id = ystring(holder, key)
    return id !== undefined && ids.has(id)
  }
  maps.steps.forEach((step) => {
    if (named(step, 'frame')) step.delete('frame')
    for (const holder of [ymap(step, 'trigger'), ymap(step, 'action')]) {
      if (holder && named(holder, 'invoice')) holder.delete('invoice')
    }
    const action = ymap(step, 'action')
    for (const key of ['step', 'onStep']) if (action && named(action, key)) action.delete(key)
    for (const when of conditionMaps(step)) {
      for (const list of [yarray(when, 'all'), yarray(when, 'any')]) {
        if (!list) continue
        for (let i = list.length - 1; i >= 0; i--) {
          const entry = list.get(i)
          if (entry instanceof Y.Map && (named(entry as YMap, 'hasPaid') || named(entry as YMap, 'subscribed'))) {
            list.delete(i, 1)
          }
        }
      }
    }
  })
}

/**
 * Calls `visit(text)` for every plain text per language: the bot's name, about and description,
 * a command's menu text, a keyboard's input hint, a question's cancel words, a poll's or quiz's
 * options, an invoice's title, description, price labels, shipping options and refusal message, a
 * button's label, its popup and the text it copies.
 */
export function forEachLangText(maps: DesignMaps, visit: (text: YMap) => void): void {
  const visitMap = (text: YMap | undefined) => {
    if (text) visit(text)
  }
  for (const key of ['name', 'about', 'description']) visitMap(ymap(maps.bot, key))
  maps.steps.forEach((step) => {
    visitMap(ymap(ymap(step, 'trigger'), 'menuDescription'))
    visitMap(ymap(stepKeyboard(step), 'placeholder'))
    visitMap(ymap(ymap(step, 'cancel'), 'words'))
    yarray(pollOf(step), 'options')?.forEach((option) => {
      if (option instanceof Y.Map) visit(option as YMap)
    })
    const invoice = ymap(step, 'invoice')
    visitMap(ymap(invoice, 'title'))
    visitMap(ymap(invoice, 'description'))
    yarray(invoice, 'prices')?.forEach((price) => {
      if (price instanceof Y.Map) visitMap(ymap(price as YMap, 'label'))
    })
    yarray(ymap(invoice, 'physical'), 'shippingOptions')?.forEach((option) => {
      if (option instanceof Y.Map) visitMap(ymap(option as YMap, 'title'))
    })
    visitMap(ymap(ymap(step, 'checkout'), 'refuse'))
  })
  maps.buttons.forEach((button) => {
    visitMap(ymap(button, 'label'))
    const action = ymap(button, 'action')
    visitMap(ymap(ymap(action, 'popup'), 'text'))
    if (ystring(action, 'type') === 'copyText') visitMap(ymap(action, 'text'))
  })
}

/** Calls `visit(holder, key)` for every media slot: `holder.get(key)` is a `MediaSlot` map. */
export function forEachMediaSlot(maps: DesignMaps, visit: (holder: YMap, key: string) => void): void {
  if (ymap(maps.bot, 'photo')) visit(maps.bot, 'photo')
  maps.steps.forEach((step) => {
    const content = stepContent(step)
    if (ymap(content, 'media') && content) visit(content, 'media')
    for (const list of ['items', 'blocks']) {
      yarray(content, list)?.forEach((item) => {
        if (item instanceof Y.Map && ymap(item as YMap, 'media')) visit(item as YMap, 'media')
      })
    }
    const invoice = ymap(step, 'invoice')
    if (invoice && ymap(invoice, 'photo')) visit(invoice, 'photo')
  })
}

/** The `/start` command start point (every design has one; it cannot be deleted). */
export function isSlashStart(step: YMap): boolean {
  const trigger = ymap(step, 'trigger')
  return (
    ystring(step, 'kind') === 'start' &&
    ystring(trigger, 'type') === 'command' &&
    ystring(trigger, 'command') === 'start'
  )
}

/** Keeps `bot.commandOrder` to the command start points: gone ones out, new ones at the end. */
export function syncCommandOrder(maps: DesignMaps): void {
  const commands = new Set<StepId>()
  maps.steps.forEach((step, id) => {
    if (ystring(step, 'kind') === 'start' && ystring(ymap(step, 'trigger'), 'type') === 'command') commands.add(id)
  })
  let order = yarray(maps.bot, 'commandOrder')
  if (!order) order = maps.bot.set('commandOrder', new Y.Array<unknown>())
  const listed = order.toArray()
  for (let i = listed.length - 1; i >= 0; i--) {
    const id = listed[i]
    if (typeof id !== 'string' || !commands.has(id) || listed.indexOf(id) !== i) order.delete(i, 1)
  }
  const missing = [...commands].filter((id) => !listed.includes(id))
  if (missing.length > 0) order.push(missing)
}
