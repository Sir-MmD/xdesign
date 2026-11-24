// Version history in the editor (docs/plan/04 section 15, 05 section 7): whether the History panel
// is open, the version shown read-only in place of now, and the dialog open over them, kept in one
// store per open design (Editor.tsx reads it for the design shown; History.tsx draws the panel
// and the dialogs).
import { useSyncExternalStore } from 'react'

import { useEditor } from '../context'
import type { LiveDesign } from '../live'
import type { DesignVersion, VersionDesign } from './versions'

/**
 * The dialogs: "Name this version", "Compare with now", "Restore this version" (it asks first),
 * the export of a version, and a named version's rename and delete.
 */
export type HistoryDialog =
  { kind: 'name' | 'compare' | 'restore' } | { kind: 'export' | 'rename' | 'delete'; version: DesignVersion } | null

export interface HistoryState {
  /** The History panel (the right sheet) is open. */
  panel: boolean
  /** The version the editor shows read-only instead of now; null: now. */
  viewed: VersionDesign | null
  dialog: HistoryDialog
  /** The panel was open under the dialog: it opens again when the dialog closes. */
  fromPanel: boolean
}

const now: HistoryState = { panel: false, viewed: null, dialog: null, fromPanel: false }

export class HistoryStore {
  private state = now
  private readonly listeners = new Set<() => void>()

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  get = (): HistoryState => this.state

  setPanel(panel: boolean): void {
    this.replace({ ...this.state, panel })
  }

  /** Opens a version read-only in the editor (the panel closes). */
  view(viewed: VersionDesign): void {
    this.replace({ ...this.state, panel: false, viewed })
  }

  /** "Back to now". */
  back(): void {
    this.replace({ ...this.state, viewed: null, dialog: null, fromPanel: false })
  }

  /** Opens a dialog; the panel steps aside while it is open (one modal at a time). */
  open(dialog: NonNullable<HistoryDialog>): void {
    this.replace({ ...this.state, dialog, panel: false, fromPanel: this.state.panel })
  }

  close(): void {
    this.replace({ ...this.state, dialog: null, panel: this.state.fromPanel, fromPanel: false })
  }

  private replace(next: HistoryState): void {
    this.state = next
    for (const listener of this.listeners) listener()
  }
}

const stores = new WeakMap<LiveDesign, HistoryStore>()

/** The history store of an open design (like the open part, one per design open in the tab). */
export function historyOf(live: LiveDesign): HistoryStore {
  let store = stores.get(live)
  if (!store) {
    store = new HistoryStore()
    stores.set(live, store)
  }
  return store
}

/** The history store, to act: `useHistoryStore().setPanel(true)`. */
export function useHistoryStore(): HistoryStore {
  const { live } = useEditor()
  return historyOf(live)
}

/** A part of the history state, re-rendering only when it changes: `useHistory((s) => s.viewed)`. */
export function useHistory<T>(pick: (state: HistoryState) => T): T {
  const store = useHistoryStore()
  return useSyncExternalStore(store.subscribe, () => pick(store.get()))
}
