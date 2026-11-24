// The layout of a design's Yjs document (docs/plan/03-design-model.md section 3): one top-level
// map per area. Nested objects of the plain model are Y.Maps, lists are Y.Arrays, a rich text
// is stored as its text ID (its fragments live in `texts`). Writers use the accessors of this
// folder, never Yjs directly.
import { nanoid } from 'nanoid'
import * as Y from 'yjs'

import type { Id } from '../model/ids.ts'
import { isIdName, RESERVED_ID_NAMES, toIdName } from '../names/id-name.ts'

/** The layout version in `meta.layout`; `migrate` brings older documents up to it. */
export const LAYOUT = 1

export type YMap = Y.Map<unknown>
// A rich text: a fragment per language (TipTap's Collaboration).
export type YText = Y.Map<Y.XmlFragment>

export type DesignMaps = {
  // layout, id, name, languages (Y.Array), defaultLanguage, copiedTexts, ignoredChecks (Y.Array).
  meta: YMap
  // name, about, description (Y.Map per language), photo, menuButton, commandOrder (Y.Array).
  bot: YMap
  steps: Y.Map<YMap>
  buttons: Y.Map<YMap>
  texts: Y.Map<YText>
  variables: Y.Map<YMap>
  switches: Y.Map<YMap>
  parts: Y.Map<YMap>
  media: Y.Map<YMap>
}

export function designMaps(doc: Y.Doc): DesignMaps {
  return {
    meta: doc.getMap('meta'),
    bot: doc.getMap('bot'),
    steps: doc.getMap('steps'),
    buttons: doc.getMap('buttons'),
    texts: doc.getMap('texts'),
    variables: doc.getMap('variables'),
    switches: doc.getMap('switches'),
    parts: doc.getMap('parts'),
    media: doc.getMap('media'),
  }
}

/**
 * Who changes a document: every accessor runs its change in one `doc.transact` with this
 * origin, so the person's undo manager groups it.
 */
export type DesignEditor = { doc: Y.Doc; origin: unknown }

export function change<T>(editor: DesignEditor, fn: (maps: DesignMaps) => T): T {
  return editor.doc.transact(() => fn(designMaps(editor.doc)), editor.origin)
}

/** A fresh random ID (nanoid) for a step, button, text, variable or any other item. */
export function newId(): Id {
  return nanoid()
}

/** A plain value as Yjs: objects as Y.Map, arrays as Y.Array; `undefined` fields are left out. */
export function toY(value: unknown): unknown {
  if (Array.isArray(value)) {
    const array = new Y.Array<unknown>()
    array.push(value.map(toY))
    return array
  }
  if (value !== null && typeof value === 'object') {
    const map = new Y.Map<unknown>()
    for (const [key, field] of Object.entries(value)) {
      if (field !== undefined) map.set(key, toY(field))
    }
    return map
  }
  return value
}

/** A Yjs value as plain data (the inverse of toY). */
export function fromY(value: unknown): unknown {
  if (value instanceof Y.Map) {
    const object: Record<string, unknown> = {}
    value.forEach((field: unknown, key) => {
      object[key] = fromY(field)
    })
    return object
  }
  if (value instanceof Y.Array) return value.toArray().map(fromY)
  return value
}

export function ymap(parent: YMap | undefined, key: string): YMap | undefined {
  const value = parent?.get(key)
  return value instanceof Y.Map ? (value as YMap) : undefined
}

export function yarray(parent: YMap | undefined, key: string): Y.Array<unknown> | undefined {
  const value = parent?.get(key)
  return value instanceof Y.Array ? (value as Y.Array<unknown>) : undefined
}

export function ystring(parent: YMap | undefined, key: string): string | undefined {
  const value = parent?.get(key)
  return typeof value === 'string' ? value : undefined
}

/** The map under a key, created empty when it is missing. */
export function ensureMap(parent: YMap, key: string): YMap {
  return ymap(parent, key) ?? parent.set(key, new Y.Map<unknown>())
}

/** Sets a field, or deletes it for `undefined`. */
export function setField(map: YMap, key: string, value: unknown): void {
  if (value === undefined) map.delete(key)
  else map.set(key, toY(value))
}

/**
 * The ID names in use across steps, buttons, variables, switches and parts (section 4), and the
 * reserved `back` and `stay`.
 */
export function takenIdNames(maps: DesignMaps, except?: Id): Set<string> {
  const taken = new Set<string>(RESERVED_ID_NAMES)
  for (const collection of [maps.steps, maps.buttons, maps.variables, maps.switches, maps.parts]) {
    collection.forEach((item, id) => {
      const name = ystring(item, 'idName')
      if (name !== undefined && id !== except) taken.add(name)
    })
  }
  return taken
}

/**
 * Makes an item's ID name follow its title, label or name again, unless it was edited by hand
 * or exported (`idNameFixed`).
 */
export function followIdName(maps: DesignMaps, id: Id, item: YMap, base: string, prefix = '', fallback?: string): void {
  if (item.get('idNameFixed') === true) return
  const name = toIdName(base, prefix, takenIdNames(maps, id), fallback)
  if (item.get('idName') !== name) item.set('idName', name)
}

/** An ID name edited by hand: false when it is not one or another item has it. */
export function fixIdName(maps: DesignMaps, id: Id, item: YMap, name: string): boolean {
  if (!isIdName(name) || takenIdNames(maps, id).has(name)) return false
  item.set('idName', name)
  item.set('idNameFixed', true)
  return true
}

export function languagesOf(maps: DesignMaps): string[] {
  return (yarray(maps.meta, 'languages')?.toArray() ?? []).filter((lang) => typeof lang === 'string')
}

export function defaultLanguageOf(maps: DesignMaps): string {
  return ystring(maps.meta, 'defaultLanguage') ?? languagesOf(maps)[0] ?? 'en'
}
