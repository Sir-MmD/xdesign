// New design documents, documents from a plain design (import, templates) and the Yjs update
// bytes the server stores (docs/plan/03-design-model.md section 3, rule 7).
import * as Y from 'yjs'

import type { Design } from '../model/design.ts'
import type { Id, Lang } from '../model/ids.ts'
import type { Step } from '../model/steps.ts'
import type { Variable } from '../model/variables.ts'
import { RESERVED_ID_NAMES, toIdName } from '../names/id-name.ts'
import { designMaps, LAYOUT, newId, setField, toY, type YMap } from './layout.ts'
import { storeTexts } from './refs.ts'

/** The built-in variables every design has (section 2.6): not deletable, names fixed. */
export const BUILTIN_VARIABLES = [
  { idName: 'first_name', label: 'First name', type: 'text', description: "The user's first name in Telegram" },
  { idName: 'last_name', label: 'Last name', type: 'text', description: "The user's last name in Telegram, if set" },
  { idName: 'username', label: 'Username', type: 'text', description: "The user's username without the @, if set" },
  { idName: 'user_id', label: 'User ID', type: 'number', description: "The user's Telegram ID" },
  {
    idName: 'language',
    label: 'Language',
    type: 'text',
    description: "The language of the user's Telegram app (language_code)",
  },
  { idName: 'is_premium', label: 'Premium user', type: 'yesNo', description: 'The user has Telegram Premium' },
] as const satisfies readonly Pick<Variable, 'idName' | 'label' | 'type' | 'description'>[]

export type NewDesign = {
  // The design's ID on the server (`designs.id`); a fresh one without it.
  id?: Id
  name: string
  // English unless the creator chose another.
  defaultLanguage?: Lang
  // More languages; the default comes first in the list either way.
  languages?: readonly Lang[]
}

/**
 * A new design: the `/start` start point (x 0) pointing to an empty "Main menu" message (x 320),
 * the built-in variables, and the languages.
 */
export function newDesignDoc({ id = newId(), name, defaultLanguage = 'en', languages = [] }: NewDesign): Y.Doc {
  const startId = newId()
  const menuId = newId()
  const taken = new Set<string>([...RESERVED_ID_NAMES, ...BUILTIN_VARIABLES.map((variable) => variable.idName)])
  const start: Step = {
    id: startId,
    kind: 'start',
    idName: toIdName('/start', '', taken),
    title: '/start',
    x: 0,
    y: 0,
    trigger: { type: 'command', command: 'start', inMenu: false, menuDescription: {} },
    next: menuId,
  }
  taken.add(start.idName)
  const menu: Step = {
    id: menuId,
    kind: 'message',
    idName: toIdName('Main menu', '', taken),
    title: 'Main menu',
    x: 320,
    y: 0,
    content: { type: 'text', text: { id: newId(), doc: {} } },
    keyboard: null,
    options: {},
  }
  const variables: Record<Id, Variable> = {}
  for (const builtin of BUILTIN_VARIABLES) {
    const variableId = newId()
    variables[variableId] = { id: variableId, ...builtin, idNameFixed: true, source: 'builtin' }
  }
  return docFromDesign({
    formatVersion: 1,
    id,
    name,
    languages: { default: defaultLanguage, list: [...new Set([defaultLanguage, ...languages])] },
    bot: { name: {}, about: {}, description: {}, menuButton: 'default', commandOrder: [startId] },
    steps: { [startId]: start, [menuId]: menu },
    buttons: {},
    variables,
    switches: {},
    parts: {},
    media: {},
  })
}

/** A Yjs document holding a plain design (import, templates, fixtures). */
export function docFromDesign(design: Design): Y.Doc {
  const doc = new Y.Doc()
  doc.transact(() => {
    const maps = designMaps(doc)
    maps.meta.set('layout', LAYOUT)
    maps.meta.set('id', design.id)
    maps.meta.set('name', design.name)
    maps.meta.set('languages', Y.Array.from([...design.languages.list]))
    maps.meta.set('defaultLanguage', design.languages.default)
    setField(maps.meta, 'copiedTexts', design.copiedTexts)
    setField(maps.meta, 'ignoredChecks', design.ignoredChecks)
    for (const [key, value] of Object.entries(design.bot)) setField(maps.bot, key, value)
    for (const [id, step] of Object.entries(design.steps)) maps.steps.set(id, toY(storeTexts(maps, step)) as YMap)
    for (const [id, part] of Object.entries(design.parts)) maps.parts.set(id, toY(storeTexts(maps, part)) as YMap)
    for (const [name, items] of [
      ['buttons', design.buttons],
      ['variables', design.variables],
      ['switches', design.switches],
      ['media', design.media],
    ] as const) {
      for (const [id, item] of Object.entries(items)) maps[name].set(id, toY(item) as YMap)
    }
  })
  return doc
}

/** The whole document as Yjs update bytes (what the server stores in `design_docs.state`). */
export function encodeDoc(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc)
}

/** A document from Yjs update bytes. */
export function decodeDoc(update: Uint8Array): Y.Doc {
  const doc = new Y.Doc()
  Y.applyUpdate(doc, update)
  return doc
}
