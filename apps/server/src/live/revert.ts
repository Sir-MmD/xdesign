// A restore as one Yjs change (HIST-01, docs/plan/05 section 7 item 5): the update that turns a
// design's document into one of its versions. A version is an earlier state of the same document,
// so the update undoes every change made since (a Yjs UndoManager over the version with those
// changes applied): what nobody changed keeps its Yjs items, so open editors' text bindings stay,
// and the update is about as big as the changes. The result is compared with the version on a
// copy; if they differ, the update copies the version's content into every top-level map instead.
import { LAYOUT, layoutOf, migrate } from '@xdesign/spec'
import * as Y from 'yjs'

import { log } from '../log.ts'

const revertOrigin = Symbol('revert')

function copyOf(doc: Y.Doc): Y.Doc {
  const copy = new Y.Doc()
  Y.applyUpdate(copy, Y.encodeStateAsUpdate(doc))
  return copy
}

// The update that undoes, in `doc`, every change made since `state`.
function undoSince(doc: Y.Doc, state: Uint8Array): Uint8Array {
  // Without garbage collection, so the content those changes deleted can come back.
  const past = new Y.Doc({ gc: false })
  Y.applyUpdate(past, state)
  const undo = new Y.UndoManager(past, { trackedOrigins: new Set([revertOrigin]) })
  Y.applyUpdate(past, Y.encodeStateAsUpdate(doc, Y.encodeStateVector(past)), revertOrigin)
  undo.undo()
  undo.destroy()
  return Y.encodeStateAsUpdate(past, Y.encodeStateVector(doc))
}

// The design keeps its current name (renaming is the design owner's) and the current layout.
function finish(doc: Y.Doc, name: string): void {
  const meta = doc.getMap('meta')
  if (meta.get('name') !== name) {
    meta.set('name', name)
  }
  if (layoutOf(doc) < LAYOUT) {
    migrate(doc)
  }
}

// JSON with every object's keys sorted, so equal content gives equal text.
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, field: unknown) =>
    field !== null && typeof field === 'object' && !Array.isArray(field)
      ? Object.fromEntries(Object.entries(field).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : field,
  )
}

// Every top-level type of the layout is a map (src/ydoc/layout.ts of @xdesign/spec).
function topNames(a: Y.Doc, b: Y.Doc): string[] {
  return [...new Set([...a.share.keys(), ...b.share.keys()])]
}

function sameContent(a: Y.Doc, b: Y.Doc): boolean {
  return topNames(a, b).every((name) => stable(a.getMap(name).toJSON()) === stable(b.getMap(name).toJSON()))
}

function replaceContent(doc: Y.Doc, source: Y.Doc): void {
  const names = topNames(doc, source)
  doc.transact(() => {
    for (const name of names) {
      const map = doc.getMap(name)
      for (const key of [...map.keys()]) {
        map.delete(key)
      }
      source.getMap(name).forEach((value, key) => {
        map.set(key, value instanceof Y.AbstractType ? value.clone() : value)
      })
    }
  })
}

export interface RestoreUpdate {
  update: Uint8Array
  // The size of the document's state once the update is applied.
  bytes: number
}

// The update that turns `doc` (the design's document now, left untouched) into the version
// `state`, with the design's current `name`.
export function restoreUpdate(doc: Y.Doc, state: Uint8Array, name: string): RestoreUpdate {
  const target = new Y.Doc()
  Y.applyUpdate(target, state)
  finish(target, name)
  let result = copyOf(doc)
  Y.applyUpdate(result, undoSince(doc, state))
  finish(result, name)
  if (!sameContent(result, target)) {
    log.warn('a restore did not undo to its version; the version is copied instead')
    result = copyOf(doc)
    replaceContent(result, target)
  }
  return {
    update: Y.encodeStateAsUpdate(result, Y.encodeStateVector(doc)),
    bytes: Y.encodeStateAsUpdate(result).byteLength,
  }
}
