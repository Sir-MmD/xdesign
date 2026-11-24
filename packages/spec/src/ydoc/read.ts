// The plain model of a design document (docs/plan/03-design-model.md section 3, rule 6): checks,
// Try it, the phone and the export read only this. `watchDesign` keeps it current per changed
// item (docs/plan/02-architecture.md section 9) and reuses the objects of unchanged ones.
import type * as Y from 'yjs'

import type { BotSetup } from '../model/bot.ts'
import { validateDesign, type Design } from '../model/design.ts'
import type { Lang, TextId } from '../model/ids.ts'
import type { RichText } from '../model/texts.ts'
import {
  defaultLanguageOf,
  designMaps,
  fromY,
  LAYOUT,
  languagesOf,
  yarray,
  ymap,
  ystring,
  type DesignMaps,
  type YMap,
} from './layout.ts'
import { layoutOf, migratedView } from './migrate.ts'
import { readRichText } from './rich.ts'
import { forEachRichSlot } from './refs.ts'

// Development builds check every model they build: Vite sets import.meta.env.DEV, and Node
// checks unless NODE_ENV is production.
const viteEnv = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env
const nodeProcess = (globalThis as { process?: { env: Partial<Record<string, string>> } }).process
const devBuild = viteEnv?.DEV ?? (nodeProcess !== undefined && nodeProcess.env.NODE_ENV !== 'production')

/** Whether the document holds a design yet: false until its first sync (local copy or server) brought one. */
export function hasDesign(doc: Y.Doc): boolean {
  return ystring(designMaps(doc).meta, 'id') !== undefined
}

/** The plain design of a document (an older layout is read through its migration in memory). */
export function readDesign(doc: Y.Doc): Design {
  const maps = designMaps(migratedView(doc))
  const texts = new Map<TextId, RichText>()
  const design = buildDesign(maps, (id) => cachedText(maps, texts, id))
  if (devBuild) checkDesign(design)
  return design
}

/**
 * Calls `cb` with the plain design now and after each transaction that changed it. Only the
 * items whose maps or texts changed are rebuilt; the others keep their objects, and so do the
 * collections where nothing changed. Returns the function that stops watching.
 */
export function watchDesign(doc: Y.Doc, cb: (design: Design) => void): () => void {
  const maps = designMaps(doc)
  const texts = new Map<TextId, RichText>()
  const text = (id: TextId) => cachedText(maps, texts, id)
  let design = layoutOf(doc) === LAYOUT ? buildDesign(maps, text) : readDesign(doc)
  if (devBuild) checkDesign(design)

  let metaChanged = false
  const dirty = {
    steps: new Set<string>(),
    buttons: new Set<string>(),
    texts: new Set<string>(),
    variables: new Set<string>(),
    switches: new Set<string>(),
    parts: new Set<string>(),
    media: new Set<string>(),
  }
  // The changed item of each event: the first step of its path, or the changed keys of the map.
  const collect = (into: Set<string>) => (events: Y.YEvent<Y.AbstractType<unknown>>[]) => {
    for (const event of events) {
      const first = event.path[0]
      if (first === undefined) for (const key of event.keys.keys()) into.add(key)
      else into.add(String(first))
    }
  }
  const metaObserver = () => {
    metaChanged = true
  }
  const observers = (Object.keys(dirty) as (keyof typeof dirty)[]).map((name) => {
    const observer = collect(dirty[name])
    maps[name].observeDeep(observer)
    return () => {
      maps[name].unobserveDeep(observer)
    }
  })
  maps.meta.observeDeep(metaObserver)
  maps.bot.observeDeep(metaObserver)

  const afterTransaction = () => {
    const changed = metaChanged || Object.values(dirty).some((ids) => ids.size > 0)
    if (!changed) return
    if (layoutOf(doc) !== LAYOUT) {
      // Readers of an older layout: the whole model through the migration.
      design = readDesign(doc)
    } else {
      for (const id of dirty.texts) texts.delete(id)
      // Items that show a changed text are rebuilt too.
      if (dirty.texts.size > 0) {
        for (const [collection, items] of [
          ['steps', design.steps],
          ['parts', design.parts],
        ] as const) {
          for (const [id, item] of Object.entries(items)) {
            forEachRichSlot(item, (holder, key) => {
              const ref = holder[key] as { id: TextId }
              if (dirty.texts.has(ref.id)) dirty[collection].add(id)
            })
          }
        }
      }
      const next: Design = {
        ...design,
        // A header without copied texts or ignored checks drops the old list.
        ...(metaChanged
          ? { copiedTexts: undefined, ignoredChecks: undefined, ...readHeader(maps), bot: readBot(maps) }
          : {}),
        steps: update(design.steps, maps.steps, dirty.steps, (map) => readItem(map, text)),
        buttons: update(design.buttons, maps.buttons, dirty.buttons, fromY),
        variables: update(design.variables, maps.variables, dirty.variables, fromY),
        switches: update(design.switches, maps.switches, dirty.switches, fromY),
        parts: update(design.parts, maps.parts, dirty.parts, (map) => readItem(map, text)),
        media: update(design.media, maps.media, dirty.media, fromY),
      }
      design = next
      if (devBuild) checkDesign(design)
    }
    metaChanged = false
    for (const ids of Object.values(dirty)) ids.clear()
    cb(design)
  }
  doc.on('afterTransaction', afterTransaction)
  cb(design)
  return () => {
    for (const stop of observers) stop()
    maps.meta.unobserveDeep(metaObserver)
    maps.bot.unobserveDeep(metaObserver)
    doc.off('afterTransaction', afterTransaction)
  }
}

// A collection where only the changed items are read again; unchanged, it is the same object.
// The shapes are the accessors'; checkDesign checks them in development builds.
function update<T>(
  previous: Record<string, T>,
  map: Y.Map<YMap>,
  changed: ReadonlySet<string>,
  read: (map: YMap) => unknown,
): Record<string, T> {
  if (changed.size === 0) return previous
  const next: Record<string, T> = {}
  map.forEach((item, id) => {
    next[id] = (changed.has(id) ? undefined : previous[id]) ?? (read(item) as T)
  })
  return next
}

function buildDesign(maps: DesignMaps, text: (id: TextId) => RichText): Design {
  const empty = {}
  const all = new Set(maps.steps.keys())
  for (const collection of [maps.buttons, maps.variables, maps.switches, maps.parts, maps.media]) {
    for (const id of collection.keys()) all.add(id)
  }
  return {
    ...readHeader(maps),
    bot: readBot(maps),
    steps: update(empty, maps.steps, all, (map) => readItem(map, text)),
    buttons: update(empty, maps.buttons, all, fromY),
    variables: update(empty, maps.variables, all, fromY),
    switches: update(empty, maps.switches, all, fromY),
    parts: update(empty, maps.parts, all, (map) => readItem(map, text)),
    media: update(empty, maps.media, all, fromY),
  }
}

function readHeader(
  maps: DesignMaps,
): Pick<Design, 'formatVersion' | 'id' | 'name' | 'languages' | 'copiedTexts' | 'ignoredChecks'> {
  const list: Lang[] = languagesOf(maps)
  const copied = ymap(maps.meta, 'copiedTexts')
  const ignored = yarray(maps.meta, 'ignoredChecks')
    ?.toArray()
    .filter((key) => typeof key === 'string')
  return {
    formatVersion: 1,
    id: ystring(maps.meta, 'id') ?? '',
    name: ystring(maps.meta, 'name') ?? '',
    languages: { default: defaultLanguageOf(maps), list },
    ...(copied && copied.size > 0 ? { copiedTexts: fromY(copied) as Record<string, string> } : {}),
    ...(ignored && ignored.length > 0 ? { ignoredChecks: [...new Set(ignored)] } : {}),
  }
}

function readBot(maps: DesignMaps): BotSetup {
  return fromY(maps.bot) as BotSetup
}

// A step or part, its text IDs replaced by rich text references with their documents.
function readItem(map: YMap, text: (id: TextId) => RichText): unknown {
  const item = fromY(map)
  forEachRichSlot(item, (holder, key) => {
    const id = holder[key]
    if (typeof id === 'string') holder[key] = { id, doc: text(id) }
  })
  return item
}

function cachedText(maps: DesignMaps, cache: Map<TextId, RichText>, id: TextId): RichText {
  let rich = cache.get(id)
  if (!rich) {
    rich = readRichText(maps.texts.get(id))
    cache.set(id, rich)
  }
  return rich
}

function checkDesign(design: Design): void {
  const result = validateDesign(design)
  if (result.ok) return
  const problems = result.problems.slice(0, 5).map((problem) => `${problem.path} ${problem.message}`)
  throw new Error(`The design document does not read as a design: ${problems.join('; ')}`)
}
