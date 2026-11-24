// The editor's selection (docs/plan/04 section 4): one store shared by the map, the phone and the
// panels, read with useSyncExternalStore so a component re-renders only when the part it reads
// changes. The selected step and button also go into the person's presence (live.ts), where
// others see their color around it.
import { createContext, useContext, useSyncExternalStore } from 'react'

export interface Selection {
  /** The selected step: the phone shows it, its editor opens. */
  step: string | null
  /** A button of that step (BTN-01's editor). */
  button: string | null
  /** The text being edited, by its text ID (TXT-01). */
  text: string | null
  /** The language the phone and the map show; null for the design's default language. */
  lang: string | null
  /**
   * Counts the selections that should be brought into view (an avatar's click, a check's line):
   * the map pans to the step when it changes.
   */
  reveal: number
}

const nothing: Selection = { step: null, button: null, text: null, lang: null, reveal: 0 }

export class SelectionStore {
  private selection = nothing
  private readonly listeners = new Set<() => void>()

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  get = (): Selection => this.selection

  /** Changes part of the selection; a new step without a button clears the button and the text. */
  set(patch: Partial<Omit<Selection, 'reveal'>>): void {
    const next: Selection = { ...this.selection, ...patch }
    if (patch.step !== undefined && patch.step !== this.selection.step) {
      next.button = patch.button ?? null
      next.text = patch.text ?? null
    }
    this.replace(next)
  }

  /** Selects a step (and a button of it) and asks the map to bring it into view. */
  reveal(step: string, button: string | null = null): void {
    this.replace({ ...this.selection, step, button, text: null, reveal: this.selection.reveal + 1 })
  }

  private replace(next: Selection): void {
    const now = this.selection
    if (
      next.step === now.step &&
      next.button === now.button &&
      next.text === now.text &&
      next.lang === now.lang &&
      next.reveal === now.reveal
    )
      return
    this.selection = next
    for (const listener of this.listeners) listener()
  }
}

export const SelectionContext = createContext<SelectionStore | null>(null)

/** The selection store, to change the selection: `useSelectionStore().set({ step })`. */
export function useSelectionStore(): SelectionStore {
  const store = useContext(SelectionContext)
  if (!store) throw new Error('useSelectionStore needs the editor (src/editor/Editor.tsx)')
  return store
}

/**
 * A part of the selection, re-rendering only when it changes: `useSelection((s) => s.step)`. The
 * function must return a value that compares equal while nothing changed (an ID, not a new object).
 */
export function useSelection<T>(pick: (selection: Selection) => T): T {
  const store = useSelectionStore()
  return useSyncExternalStore(store.subscribe, () => pick(store.get()))
}
