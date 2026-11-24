// Part accessors (docs/plan/03-design-model.md sections 2.11 and 3, rule 2): row parts and text
// parts. "Detach" copies the part's buttons (as new buttons) or text into the place that used
// it; deleting a part (the editor asks first) detaches every use.
import * as Y from 'yjs'

import type { Button } from '../model/buttons.ts'
import type { ButtonId, PartId, StepId } from '../model/ids.ts'
import type { Part } from '../model/parts.ts'
import { toIdName } from '../names/id-name.ts'
import { RICH_NODES } from '../text/schema.ts'
import {
  change,
  defaultLanguageOf,
  fixIdName,
  followIdName,
  fromY,
  newId,
  takenIdNames,
  toY,
  yarray,
  ystring,
  type DesignEditor,
  type DesignMaps,
  type YMap,
} from './layout.ts'
import { deleteUnused, stepKeyboard, storeTexts, textIdsOf } from './refs.ts'
import { fragmentToDoc, richNodesToY, type RichJsonNode } from './rich.ts'

// A part without its ID and ID name, for each kind.
type NewPart = Part extends infer P ? (P extends Part ? Omit<P, 'id' | 'idName'> : never) : never

function addPart(maps: DesignMaps, part: NewPart): PartId {
  const id = newId()
  const plain = { id, idName: toIdName(part.name, '', takenIdNames(maps), 'part_'), ...part }
  maps.parts.set(id, toY(storeTexts(maps, plain)) as YMap)
  return id
}

// A copy of a button with a fresh ID and ID name.
function copyButton(maps: DesignMaps, id: ButtonId): ButtonId | undefined {
  const button = maps.buttons.get(id)
  if (!button) return undefined
  const plain = fromY(button) as Button
  const copyId = newId()
  const idName = toIdName(plain.label[defaultLanguageOf(maps)] ?? '', 'btn_', takenIdNames(maps))
  maps.buttons.set(copyId, toY({ ...plain, id: copyId, idName, idNameFixed: undefined }) as YMap)
  return copyId
}

// Replaces the part rows of a step's keyboard with rows of copies of the part's buttons.
function detachRows(maps: DesignMaps, step: YMap, partId: PartId): void {
  const rows = yarray(stepKeyboard(step), 'rows')
  if (!rows) return
  const partRows = (fromY(yarray(maps.parts.get(partId), 'rows')) ?? []) as unknown[][]
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows.get(i)
    if (!(row instanceof Y.Map) || row.get('type') !== 'part' || row.get('part') !== partId) continue
    const copies = partRows
      .map((ids) =>
        ids.flatMap((id) => {
          const copy = typeof id === 'string' ? copyButton(maps, id) : undefined
          return copy === undefined ? [] : [copy]
        }),
      )
      .filter((ids) => ids.length > 0)
    rows.delete(i, 1)
    rows.insert(
      i,
      copies.map((ids) => toY({ type: 'buttons', ids })),
    )
  }
}

// The inline nodes of a text part in a language (the default one when it has no text there):
// its paragraphs joined by hard breaks.
function partInline(maps: DesignMaps, partId: PartId, lang: string): RichJsonNode[] {
  const textId = ystring(maps.parts.get(partId), 'text')
  const text = textId === undefined ? undefined : maps.texts.get(textId)
  const own = text?.get(lang)
  const fragment = own && own.length > 0 ? own : text?.get(defaultLanguageOf(maps))
  if (!fragment) return []
  const doc: RichJsonNode = fragmentToDoc(fragment)
  const blocks = (doc.content ?? []).flatMap((block) =>
    block.type === RICH_NODES.blockquote ? (block.content ?? []) : [block],
  )
  return blocks.flatMap((block, index) => [
    ...(index > 0 ? [{ type: RICH_NODES.hardBreak }] : []),
    ...(block.content ?? []),
  ])
}

// Replaces the part nodes of a text part in the given rich texts with the part's text.
function detachText(maps: DesignMaps, textIds: Iterable<string>, partId: PartId): void {
  const replace = (parent: Y.XmlFragment, lang: string) => {
    const children = parent.toArray()
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i]
      if (!(child instanceof Y.XmlElement)) continue
      if (child.nodeName === RICH_NODES.part && child.getAttribute('part') === partId) {
        parent.delete(i, 1)
        parent.insert(i, richNodesToY(partInline(maps, partId, lang)))
      } else {
        replace(child, lang)
      }
    }
  }
  for (const id of textIds) {
    maps.texts.get(id)?.forEach((fragment, lang) => {
      replace(fragment, lang)
    })
  }
}

export function partEdits(editor: DesignEditor) {
  return {
    /** A new, empty row part for inline or bottom keyboards. */
    addRows(name: string, place: 'inline' | 'reply'): PartId {
      return change(editor, (maps) => addPart(maps, { kind: 'rows', name, place, rows: [] }))
    },
    /** A new, empty text part. */
    addText(name: string): PartId {
      return change(editor, (maps) => addPart(maps, { kind: 'text', name, text: { id: newId(), doc: {} } }))
    },
    /**
     * "Make a part from its buttons": the button rows of a step's keyboard become a new row part
     * (the same buttons), placed where the first of them was; rows that place a part stay.
     * Undefined when the keyboard has no buttons of its own.
     */
    fromButtons(stepId: StepId, name: string): PartId | undefined {
      return change(editor, (maps) => {
        const step = maps.steps.get(stepId)
        const keyboard = step && stepKeyboard(step)
        const rows = yarray(keyboard, 'rows')
        const place = ystring(keyboard, 'type')
        if (!rows || (place !== 'inline' && place !== 'reply')) return undefined
        const own: number[] = []
        rows.forEach((row, index) => {
          if (row instanceof Y.Map && row.get('type') === 'buttons') own.push(index)
        })
        const first = own[0]
        if (first === undefined) return undefined
        const partRows = own
          .map((index) =>
            (yarray(rows.get(index) as YMap, 'ids')?.toArray() ?? []).filter((id) => typeof id === 'string'),
          )
          .filter((ids) => ids.length > 0)
        const id = addPart(maps, { kind: 'rows', name, place, rows: partRows })
        for (const index of own.reverse()) rows.delete(index, 1)
        rows.insert(first, [toY({ type: 'part', part: id })])
        return id
      })
    },
    /** A new name; the ID name follows it until it is fixed. */
    rename(id: PartId, name: string): boolean {
      return change(editor, (maps) => {
        const part = maps.parts.get(id)
        if (!part) return false
        part.set('name', name)
        followIdName(maps, id, part, name, '', 'part_')
        return true
      })
    },
    setIdName(id: PartId, name: string): boolean {
      return change(editor, (maps) => {
        const part = maps.parts.get(id)
        return part ? fixIdName(maps, id, part, name) : false
      })
    },
    /** "Detach" in one step: its uses of the part become its own buttons or text. */
    detach(stepId: StepId, partId: PartId): boolean {
      return change(editor, (maps) => {
        const step = maps.steps.get(stepId)
        if (!step || !maps.parts.has(partId)) return false
        detachRows(maps, step, partId)
        detachText(maps, textIdsOf(step), partId)
        return true
      })
    },
    /** Deletes a part: every use is detached first, then its own buttons and text go. */
    remove(id: PartId): boolean {
      return change(editor, (maps) => {
        const part = maps.parts.get(id)
        if (!part) return false
        const own = textIdsOf(part)
        maps.steps.forEach((step) => {
          detachRows(maps, step, id)
        })
        detachText(
          maps,
          [...maps.texts.keys()].filter((textId) => !own.includes(textId)),
          id,
        )
        const buttons = ((fromY(yarray(part, 'rows')) ?? []) as unknown[][]).flat().filter((b) => typeof b === 'string')
        maps.parts.delete(id)
        deleteUnused(maps, own, buttons)
        return true
      })
    },
  }
}
