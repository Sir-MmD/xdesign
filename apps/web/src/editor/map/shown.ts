// What the boxes of the map read of the design beyond their own step (PERF-01): a variable's name,
// a part's buttons, another step's title, in the language shown, and (MAP-11) how many lines come
// into the box when some are short tags. MapPane.tsx keeps the design and the language in a plain
// store, and each box picks the few things it shows with useShown, so a change of the design
// re-renders only the boxes whose picks changed, not every box.
import type { Design } from '@xdesign/spec'
import { createContext, useContext, useState, useSyncExternalStore } from 'react'

export type Shown = { design: Design; lang: string }

export class ShownStore {
  private shown: Shown
  // MAP-11: how many lines come into each box with lines in drawn as short tags (lines.ts).
  private into: ReadonlyMap<string, number> = new Map()
  private readonly listeners = new Set<() => void>()

  constructor(shown: Shown) {
    this.shown = shown
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  get = (): Shown => this.shown

  set(design: Design, lang: string): void {
    if (design === this.shown.design && lang === this.shown.lang) return
    this.shown = { design, lang }
    this.changed()
  }

  /** The "<N> come here" of a box: every line into it when any of them is a short tag, else 0. */
  comeHere = (id: string): number => this.into.get(id) ?? 0

  setComeHere(into: ReadonlyMap<string, number>): void {
    const now = this.into
    if (into.size === now.size && [...into].every(([id, count]) => now.get(id) === count)) return
    this.into = into
    this.changed()
  }

  private changed(): void {
    for (const listener of this.listeners) listener()
  }
}

export const ShownContext = createContext<ShownStore | null>(null)

/**
 * What a box shows of the design: `pick` reads it from the design and the language shown, again
 * when one of them or `of` (what it is picked for: the box's step, a message's content) changed.
 * The box re-renders only when the result changes: the same text, names or objects of the design
 * (which keep their identity while they do not change) count as no change.
 */
export function useShown<T>(of: unknown, pick: (design: Design, lang: string) => T): T {
  const store = useContext(ShownContext)
  if (!store) throw new Error('useShown needs the map (src/editor/map/MapPane.tsx)')
  const [picked] = useState(() => new Picked<T>())
  return useSyncExternalStore(store.subscribe, () => picked.read(store.get(), of, pick))
}

/** A box's "<N> come here" (MAP-11): it renders again only when its own number changes. */
export function useComeHere(id: string): number {
  const store = useContext(ShownContext)
  if (!store) throw new Error('useComeHere needs the map (src/editor/map/MapPane.tsx)')
  return useSyncExternalStore(store.subscribe, () => store.comeHere(id))
}

/** A box's last pick, the same value while it reads the same. */
class Picked<T> {
  private last: { shown: Shown; of: unknown; value: T } | null = null

  read(shown: Shown, of: unknown, pick: (design: Design, lang: string) => T): T {
    const { last } = this
    if (last?.shown === shown && last.of === of) return last.value
    const value = pick(shown.design, shown.lang)
    this.last = { shown, of, value: last && same(last.value, value) ? last.value : value }
    return this.last.value
  }
}

// The same plain values: arrays and objects with the same items, at any depth.
function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, index) => same(item, b[index]))
  }
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const keys = Object.keys(left)
  return keys.length === Object.keys(right).length && keys.every((key) => key in right && same(left[key], right[key]))
}
