// The path of a try on the map (docs/plan/04 section 8, "The path lights up on the map"), the
// map's highlight layer: the steps that ran get a ring (PathMark.tsx, in OverlaidBox of
// map/BoxOverlay.tsx), the last one a stronger ring, and the arrows taken between them are drawn
// in the brand color (useTaken in map/ArrowEdge.tsx); outside Try it nothing is drawn.
import type { SimPathItem, StepId } from '@xdesign/spec'
import { useContext, useSyncExternalStore } from 'react'

import { TryContext, type TryStore } from './store'

export type TryPath = {
  steps: ReadonlySet<StepId>
  /** The arrows taken: `button:<id>>to` for a button's, `from>to` for a step's own. */
  arrows: ReadonlySet<string>
  current: StepId | null
}

const noItems: readonly SimPathItem[] = []
const paths = new WeakMap<readonly SimPathItem[], TryPath>()

// One reading per state's path, shared by every box and arrow.
function pathOf(items: readonly SimPathItem[]): TryPath {
  const known = paths.get(items)
  if (known) return known
  const steps = new Set<StepId>()
  const arrows = new Set<string>()
  let current: StepId | null = null
  let before: SimPathItem | undefined
  for (const item of items) {
    if (item.type === 'step') {
      if (before?.type === 'button') arrows.add(`button:${before.id}>${item.id}`)
      else if (before?.type === 'step') arrows.add(`${before.id}>${item.id}`)
      steps.add(item.id)
      current = item.id
    }
    before = item
  }
  const path = { steps, arrows, current }
  paths.set(items, path)
  return path
}

function useItems(): readonly SimPathItem[] | null {
  const store = useContext(TryContext)
  return useSyncExternalStore(store?.subscribe ?? noSubscribe, () => itemsOf(store))
}

/** The path of the try shown now; null outside Try it. */
export function useTryPath(): TryPath | null {
  const items = useItems()
  return items && pathOf(items)
}

function itemsOf(store: TryStore | null): readonly SimPathItem[] | null {
  if (!store?.get().open) return null
  return store.now()?.path ?? noItems
}

const noSubscribe = () => () => undefined

/** Whether the try took an arrow (its box, dot and target): ArrowEdge draws it in the brand color. */
export function useTaken(source: StepId, handle: string | null | undefined, target: StepId): boolean {
  const path = useTryPath()
  if (!path) return false
  const { arrows } = path
  return handle?.startsWith('button:') ? arrows.has(`${handle}>${target}`) : arrows.has(`${source}>${target}`)
}
