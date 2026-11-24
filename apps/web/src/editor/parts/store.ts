// Which part's editor is open (docs/plan/04 section 12): the palette's list and "+ Part", the box
// menu's "Make a part from its buttons", a row part's "Edit the part" on the phone and the uses of
// a text part open it; the palette's "PARTS" draws it (PartEditor.tsx). One store per open design,
// kept with its connection, so nothing in Editor.tsx provides it.
import { useCallback, useSyncExternalStore } from 'react'

import { useEditor } from '../context'

class OpenPart {
  private id: string | null = null
  private readonly listeners = new Set<() => void>()

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  get = (): string | null => this.id

  set(id: string | null): void {
    if (id === this.id) return
    this.id = id
    for (const listener of this.listeners) listener()
  }
}

const stores = new WeakMap<object, OpenPart>()

function useStore(): OpenPart {
  const { live } = useEditor()
  let store = stores.get(live)
  if (!store) {
    store = new OpenPart()
    stores.set(live, store)
  }
  return store
}

/** Opens a part's editor (null closes it); the same function while the design stays open. */
export function useOpenPart(): (id: string | null) => void {
  const store = useStore()
  return useCallback(
    (id: string | null) => {
      store.set(id)
    },
    [store],
  )
}

/** The part whose editor is open, and the function that opens another one (null closes it). */
export function usePartEditor(): [string | null, (id: string | null) => void] {
  const store = useStore()
  return [useSyncExternalStore(store.subscribe, store.get), useOpenPart()]
}

/**
 * The drag types of a part dragged from the palette, by what it is: the drop targets see the
 * types (not the data) while the part is over them, so the type says where it fits. The data is
 * the part's ID, and for a text part also its text's ID (`TextPartDrag`).
 */
export const PART_DRAG = {
  inline: 'application/x-xdesign-part-inline',
  reply: 'application/x-xdesign-part-reply',
  text: 'application/x-xdesign-part-text',
} as const

/** What a dragged text part carries. */
export type TextPartDrag = { part: string; text: string }
