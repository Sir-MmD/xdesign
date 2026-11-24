// What is selected on the map beyond the editor's one step (selection.ts): several boxes (shift
// click, a box dragged around them) and arrows. A plain store, so the change handlers of one
// click (React Flow sends the boxes' and the arrows' changes apart) each see the latest picks.
// The picks hold for the editor's step they were made with; once something else (the phone, an
// avatar, a new step) selects another step, the map shows that step alone.
import { useSyncExternalStore } from 'react'

export type Picks = {
  /** The editor's selected step when these were picked. */
  step: string | null
  nodes: ReadonlySet<string>
  edges: ReadonlySet<string>
}

export const nothingPicked: ReadonlySet<string> = new Set()

export class PickStore {
  private picks: Picks = { step: null, nodes: nothingPicked, edges: nothingPicked }
  private readonly listeners = new Set<() => void>()

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  get = (): Picks => this.picks

  set(picks: Picks): void {
    this.picks = picks
    for (const listener of this.listeners) listener()
  }
}

/** The boxes and arrows selected while the editor's selected step is `step`. */
export function currentPicks(picks: Picks, step: string | null): Picks {
  if (picks.step === step) return picks
  return { step, nodes: step === null ? nothingPicked : new Set([step]), edges: nothingPicked }
}

export function usePicks(store: PickStore): Picks {
  return useSyncExternalStore(store.subscribe, store.get)
}
