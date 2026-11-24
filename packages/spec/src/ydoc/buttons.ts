// Button and keyboard accessors (docs/plan/03-design-model.md sections 2.5 and 3). Buttons live
// in `buttons`; a keyboard's rows (or a row part's) list them by ID. Deleting a button removes it
// from every row (rule 2); a row left without buttons is removed. Rows always hold a button:
// adding a row adds its first button.
import * as Y from 'yjs'

import type { Button, InlineAction, Keyboard, Look, ReplyAction } from '../model/buttons.ts'
import type { ButtonId, PartId, StepId, Target } from '../model/ids.ts'
import { toIdName } from '../names/id-name.ts'
import {
  change,
  defaultLanguageOf,
  ensureMap,
  fixIdName,
  followIdName,
  fromY,
  newId,
  setField,
  takenIdNames,
  toY,
  yarray,
  ymap,
  ystring,
  type DesignEditor,
  type DesignMaps,
  type YMap,
} from './layout.ts'
import { deleteUnused, removeFromRows, stepContent, stepKeyboard } from './refs.ts'

/**
 * The keyboard of a step (a question's prompt keyboard), the rows of a row part, or the button
 * rows inside a step's rich message (`rich`: its blocks are the rows, its `buttons` blocks the
 * rows with buttons; a new row is a new `buttons` block).
 */
export type KeyboardAt = { step: StepId } | { part: PartId } | { rich: StepId }
export type KeyboardType = NonNullable<Keyboard>['type'] | null
// The options of an inline or bottom keyboard, set apart from its rows.
export type KeyboardOptions = {
  oneTime?: boolean
  persistent?: boolean
  resize?: boolean
  placeholder?: Partial<Record<string, string>>
  openReplyField?: boolean
}

const inlineActions = new Set<string>(['goTo', 'url', 'copyText', 'loginUrl', 'pay'])

type Rows = { rows: Y.Array<unknown>; place: 'inline' | 'reply'; part: boolean }

// The rows of a keyboard with buttons, of a row part, or the blocks of a rich message.
function rowsAt(maps: DesignMaps, at: KeyboardAt): Rows | undefined {
  if ('rich' in at) {
    const step = maps.steps.get(at.rich)
    const content = step && stepContent(step)
    const blocks = ystring(content, 'type') === 'rich' ? yarray(content, 'blocks') : undefined
    return blocks ? { rows: blocks, place: 'inline', part: false } : undefined
  }
  if ('part' in at) {
    const part = maps.parts.get(at.part)
    const rows = yarray(part, 'rows')
    const place = ystring(part, 'place')
    return rows && (place === 'inline' || place === 'reply') ? { rows, place, part: true } : undefined
  }
  const step = maps.steps.get(at.step)
  const keyboard = step && stepKeyboard(step)
  const rows = yarray(keyboard, 'rows')
  const type = ystring(keyboard, 'type')
  return rows && (type === 'inline' || type === 'reply') ? { rows, place: type, part: false } : undefined
}

// The button IDs of a row: a keyboard's `buttons` row (none for a part row), or a part's row.
function rowIds(row: unknown): Y.Array<unknown> | undefined {
  if (row instanceof Y.Array) return row as Y.Array<unknown>
  if (row instanceof Y.Map && row.get('type') === 'buttons') return yarray(row as YMap, 'ids')
  return undefined
}

function newRow(at: Rows, ids: ButtonId[]): unknown {
  return at.part ? Y.Array.from(ids) : toY({ type: 'buttons', ids })
}

// A new button in the given place: an inline one goes to a step (edit), a bottom one sends its text.
function createButton(maps: DesignMaps, place: 'inline' | 'reply', label: string): ButtonId {
  const id = newId()
  const base = {
    id,
    idName: toIdName(label, 'btn_', takenIdNames(maps)),
    label: label === '' ? {} : { [defaultLanguageOf(maps)]: label },
    look: 'default' as const,
  }
  const button: Button =
    place === 'inline'
      ? { ...base, place, action: { type: 'goTo', show: 'edit' } }
      : { ...base, place, action: { type: 'text' } }
  maps.buttons.set(id, toY(button) as YMap)
  return id
}

// Where a button is in a list of rows: [row, index].
function findButton(rows: Y.Array<unknown>, id: ButtonId): [number, number] | undefined {
  for (let row = 0; row < rows.length; row++) {
    const index = rowIds(rows.get(row))?.toArray().indexOf(id) ?? -1
    if (index >= 0) return [row, index]
  }
  return undefined
}

function buttonsOfRows(rows: Y.Array<unknown>): ButtonId[] {
  return rows.toArray().flatMap((row) => (rowIds(row)?.toArray() ?? []).filter((id) => typeof id === 'string'))
}

export function keyboardEdits(editor: DesignEditor) {
  return {
    /**
     * Gives a step's message an inline keyboard, a bottom keyboard, "Remove the bottom keyboard",
     * "Force a reply" or none; the buttons of the keyboard it had are deleted.
     */
    setType(stepId: StepId, type: KeyboardType): boolean {
      return change(editor, (maps) => {
        const step = maps.steps.get(stepId)
        const kind = step?.get('kind')
        if (!step || (kind !== 'message' && kind !== 'question' && kind !== 'invoice')) return false
        // An invoice has inline buttons or none (Telegram's own pay button).
        if (kind === 'invoice' && type !== 'inline' && type !== null) return false
        const old = stepKeyboard(step)
        if ((ystring(old, 'type') ?? null) === type) return true
        const holder = step.get('kind') === 'question' ? ymap(step, 'prompt') : step
        if (!holder) return false
        const buttons = buttonsOfRows(yarray(old, 'rows') ?? new Y.Array())
        const keyboards: Record<NonNullable<KeyboardType>, Keyboard> = {
          inline: { type: 'inline', rows: [] },
          reply: { type: 'reply', rows: [], oneTime: false, persistent: false, resize: true },
          removeReply: { type: 'removeReply' },
          forceReply: { type: 'forceReply' },
        }
        holder.set('keyboard', type === null ? null : toY(keyboards[type]))
        deleteUnused(maps, [], buttons)
        return true
      })
    },
    /** Changes the options of a step's keyboard (`undefined` clears one). */
    setOptions(stepId: StepId, options: KeyboardOptions): boolean {
      return change(editor, (maps) => {
        const step = maps.steps.get(stepId)
        const keyboard = step && stepKeyboard(step)
        if (!keyboard) return false
        for (const [key, value] of Object.entries(options)) setField(keyboard, key, value)
        return true
      })
    },
    /** Adds a row at `index` (the end by default) with one new button; returns the button. */
    addRow(at: KeyboardAt, index?: number, label = ''): ButtonId | undefined {
      return change(editor, (maps) => {
        const found = rowsAt(maps, at)
        if (!found) return undefined
        const id = createButton(maps, found.place, label)
        found.rows.insert(clamp(index ?? found.rows.length, found.rows.length), [newRow(found, [id])])
        return id
      })
    },
    /** Adds a button to a row at `index` (the end by default); the row after the last is a new row. */
    addButton(at: KeyboardAt, row: number, index?: number, label = ''): ButtonId | undefined {
      return change(editor, (maps) => {
        const found = rowsAt(maps, at)
        if (!found || row < 0 || row > found.rows.length) return undefined
        const id = createButton(maps, found.place, label)
        const ids = row < found.rows.length ? rowIds(found.rows.get(row)) : undefined
        if (ids) ids.insert(clamp(index ?? ids.length, ids.length), [id])
        else found.rows.insert(row, [newRow(found, [id])])
        return id
      })
    },
    /**
     * Moves a button within or between rows of a keyboard; `toRow` is counted before the move,
     * and the row after the last is a new row. A row left empty is removed.
     */
    moveButton(at: KeyboardAt, id: ButtonId, toRow: number, toIndex: number): boolean {
      return change(editor, (maps) => {
        const found = rowsAt(maps, at)
        const from = found && findButton(found.rows, id)
        if (!found || !from || toRow < 0 || toRow > found.rows.length) return false
        const [fromRow, fromIndex] = from
        const target = toRow < found.rows.length ? rowIds(found.rows.get(toRow)) : undefined
        if (toRow < found.rows.length && !target) return false
        const source = rowIds(found.rows.get(fromRow))
        source?.delete(fromIndex, 1)
        if (target) target.insert(clamp(toIndex, target.length), [id])
        else found.rows.insert(toRow, [newRow(found, [id])])
        if (source?.length === 0) {
          const emptied = toRow <= fromRow && !target ? fromRow + 1 : fromRow
          found.rows.delete(emptied, 1)
        }
        return true
      })
    },
    moveRow(at: KeyboardAt, from: number, to: number): boolean {
      return change(editor, (maps) => {
        const found = rowsAt(maps, at)
        if (!found || from < 0 || from >= found.rows.length) return false
        const row = fromY(found.rows.get(from))
        found.rows.delete(from, 1)
        found.rows.insert(clamp(to, found.rows.length), [toY(row)])
        return true
      })
    },
    /** Removes a row: its buttons are deleted; a part row only stops using the part. */
    removeRow(at: KeyboardAt, index: number): boolean {
      return change(editor, (maps) => {
        const found = rowsAt(maps, at)
        if (!found || index < 0 || index >= found.rows.length) return false
        const buttons = (rowIds(found.rows.get(index))?.toArray() ?? []).filter((id) => typeof id === 'string')
        found.rows.delete(index, 1)
        deleteUnused(maps, [], buttons)
        return true
      })
    },
    /** Places a row part in a step's keyboard at `index` (the end by default). */
    usePart(stepId: StepId, part: PartId, index?: number): boolean {
      return change(editor, (maps) => {
        const found = rowsAt(maps, { step: stepId })
        if (!found || !maps.parts.has(part)) return false
        found.rows.insert(clamp(index ?? found.rows.length, found.rows.length), [toY({ type: 'part', part })])
        return true
      })
    },
  }
}

export function buttonEdits(editor: DesignEditor) {
  // Runs `fn` on a button; it refuses by returning false.
  const edit = (id: ButtonId, fn: (button: YMap, maps: DesignMaps) => unknown): boolean =>
    change(editor, (maps) => {
      const button = maps.buttons.get(id)
      return button ? fn(button, maps) !== false : false
    })
  return {
    /** The label in a language ('' clears it); the ID name follows the default language's label. */
    setLabel(id: ButtonId, lang: string, text: string): boolean {
      return edit(id, (button, maps) => {
        const label = ensureMap(button, 'label')
        if (text === '') label.delete(lang)
        else label.set(lang, text)
        if (lang === defaultLanguageOf(maps)) followIdName(maps, id, button, text, 'btn_')
      })
    },
    setLook(id: ButtonId, look: Look): boolean {
      return edit(id, (button) => {
        button.set('look', look)
      })
    },
    setIcon(id: ButtonId, icon: Button['icon']): boolean {
      return edit(id, (button) => {
        setField(button, 'icon', icon)
      })
    },
    /** Shown but does nothing (inline buttons). */
    setDisabled(id: ButtonId, disabled: boolean): boolean {
      return edit(id, (button) => {
        if (button.get('place') !== 'inline') return false
        setField(button, 'disabled', disabled || undefined)
      })
    },
    /** What the button does; the action must fit its place (inline or bottom keyboard). */
    setAction(id: ButtonId, action: InlineAction | ReplyAction): boolean {
      return edit(id, (button) => {
        if (inlineActions.has(action.type) !== (button.get('place') === 'inline')) return false
        button.set('action', toY(action))
      })
    },
    /**
     * Where the button goes (`undefined` clears it; `stay` for an inline button); false for
     * actions without a target.
     */
    setTarget(id: ButtonId, target: Target | undefined): boolean {
      return edit(id, (button) => {
        const action = ymap(button, 'action')
        const type = ystring(action, 'type')
        if (!action || type === undefined || ['url', 'copyText', 'loginUrl', 'pay'].includes(type)) return false
        if (target === 'stay' && type !== 'goTo') return false
        setField(action, type === 'goTo' ? 'target' : 'goTo', target)
      })
    },
    setIdName(id: ButtonId, name: string): boolean {
      return edit(id, (button, maps) => fixIdName(maps, id, button, name))
    },
    /** Deletes a button and removes it from every row (rule 2). */
    remove(id: ButtonId): boolean {
      return change(editor, (maps) => {
        if (!maps.buttons.has(id)) return false
        removeFromRows(maps, new Set([id]))
        maps.buttons.delete(id)
        return true
      })
    },
  }
}

function clamp(index: number, length: number): number {
  return Math.max(0, Math.min(index, length))
}
