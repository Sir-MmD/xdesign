// Two plain designs compared up to their internal IDs: the round trip of the export
// (fromSpec(toSpec(design)) gives fresh IDs; docs/plan/06-export-and-claude-link.md section 6).
// Steps, buttons, variables, switches and parts are compared by ID name and every reference to
// one becomes its ID name; media items by their fields. Left out: the design's ID, text, case,
// outcome and shipping option IDs, `idNameFixed` (an export fixes every ID name) and a file's `serverId` (an import
// uploads it again). A field set to undefined counts as missing.
import type { Design } from '../model/design.ts'

type Kind = 'step' | 'button' | 'variable' | 'switch' | 'part' | 'media'

// The fields of the plain model that refer to an item, and to which kind (03 section 2).
const REFS: Partial<Record<string, Kind>> = {
  next: 'step',
  otherwise: 'step',
  goTo: 'step',
  target: 'step',
  afterMaxTries: 'step',
  onStop: 'step',
  invoice: 'step',
  hasPaid: 'step',
  subscribed: 'step',
  step: 'step',
  onStep: 'step',
  frame: 'step',
  commandOrder: 'step',
  ids: 'button',
  var: 'variable',
  saveTo: 'variable',
  saveRestTo: 'variable',
  uses: 'variable',
  sets: 'variable',
  switch: 'switch',
  part: 'part',
  media: 'media',
}

const LEFT_OUT = new Set(['idNameFixed', 'serverId'])

/** The designs are the same up to their internal IDs. */
export function sameDesign(a: Design, b: Design): boolean {
  return designDifference(a, b) === null
}

/** Where two designs first differ (`steps.main_menu.content.text.en`), or null when they are the same. */
export function designDifference(a: Design, b: Design): string | null {
  return difference(canonical(a), canonical(b), [])
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function canonical(design: Design): Record<string, unknown> {
  const names: Record<Kind, Map<string, string>> = {
    step: nameMap(design.steps),
    button: nameMap(design.buttons),
    variable: nameMap(design.variables),
    switch: nameMap(design.switches),
    part: nameMap(design.parts),
    media: new Map(),
  }

  // `key` is the field the value is in; a list passes its own to its items. `item`: an object
  // whose ID is left out (a case, an outcome, an item of a collection).
  const walk = (value: unknown, key?: string, item = false): unknown => {
    if (typeof value === 'string') {
      const kind = key === undefined ? undefined : REFS[key]
      return kind === undefined ? value : (names[kind].get(value) ?? value)
    }
    if (Array.isArray(value)) {
      // A row part's rows are lists of button IDs.
      return value.map((element) =>
        walk(
          element,
          Array.isArray(element) && key === 'rows' ? 'ids' : key,
          key === 'cases' || key === 'outcomes' || key === 'shippingOptions',
        ),
      )
    }
    if (!isObject(value)) return value
    // A rich text: its documents, without the text ID.
    if (Object.keys(value).length === 2 && 'id' in value && 'doc' in value) return walk(value.doc)
    const out: Record<string, unknown> = {}
    for (const [field, inner] of Object.entries(value)) {
      if (inner === undefined || LEFT_OUT.has(field) || (item && field === 'id')) continue
      out[field] = walk(inner, field)
    }
    return out
  }

  // Media items have no ID name: each is known by its fields.
  const media: Record<string, unknown> = {}
  for (const file of Object.values(design.media)) {
    const fields = walk(file, undefined, true)
    let key = JSON.stringify(fields)
    for (let n = 2; key in media; n++) key = `${JSON.stringify(fields)}#${String(n)}`
    names.media.set(file.id, key)
    media[key] = fields
  }
  const byName = (items: Readonly<Record<string, { idName: string }>>) =>
    Object.fromEntries(Object.values(items).map((value) => [value.idName, walk(value, undefined, true)]))

  return {
    formatVersion: design.formatVersion,
    name: design.name,
    languages: walk(design.languages),
    bot: walk(design.bot),
    steps: byName(design.steps),
    buttons: byName(design.buttons),
    variables: byName(design.variables),
    switches: byName(design.switches),
    parts: byName(design.parts),
    media,
  }
}

function nameMap(items: Readonly<Record<string, { id: string; idName: string }>>): Map<string, string> {
  return new Map(Object.values(items).map((item) => [item.id, item.idName]))
}

function difference(a: unknown, b: unknown, path: readonly string[]): string | null {
  if (Object.is(a, b)) return null
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return [...path, 'length'].join('.')
    for (let index = 0; index < a.length; index++) {
      const found = difference(a[index], b[index], [...path, String(index)])
      if (found !== null) return found
    }
    return null
  }
  if (isObject(a) && isObject(b)) {
    for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      const found = difference(a[key], b[key], [...path, key])
      if (found !== null) return found
    }
    return null
  }
  return path.join('.')
}
