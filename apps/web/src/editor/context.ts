// What the editor gives every pane, panel and top bar button (docs/plan/04 section 4): the plain
// design (useDesign), the accessors bound to the person's origin with their undo manager
// (useEditor), the other people in the design (usePresence) and the language shown (useLang).
// Editor.tsx provides them.
import type { DesignRole } from '@xdesign/api'
import { type Design, type DesignEdits } from '@xdesign/spec'
import { createContext, useCallback, useContext, useSyncExternalStore } from 'react'
import type * as Y from 'yjs'

import type { CommentStore } from './comments/store'
import type { LiveDesign, Peer, PresenceState } from './live'
import { useSelection } from './selection'

export interface EditorValue {
  designId: string
  /** The person's role on the design ('owner' also for the site owner). */
  role: DesignRole
  /**
   * No editing tools: Commenter and Viewer, a read-only connection, a screen under 900 pixels,
   * or a connection that stopped (a refused change, a newer layout).
   */
  readOnly: boolean
  /** SPEC-04's accessors; every change is one transaction with the person's origin. */
  edits: DesignEdits
  /** Undo and redo of this person's changes only (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y). */
  undoManager: Y.UndoManager
  /** The open design: its document, origin, awareness and connection state. */
  live: LiveDesign
  /** Comment mode and the Comments panel (CMT-02's comments/store.ts, read with useComments). */
  comments: CommentStore
}

export const EditorContext = createContext<EditorValue | null>(null)

/** The editor's accessors, undo manager and read-only state. */
export function useEditor(): EditorValue {
  const editor = useContext(EditorContext)
  if (!editor) throw new Error('useEditor needs the editor (src/editor/Editor.tsx)')
  return editor
}

export const DesignContext = createContext<Design | null>(null)

/**
 * The plain design (SPEC-04's watchDesign): a new object after every change, while unchanged
 * steps, buttons and other items keep theirs, so `useMemo` on one step re-runs only when it changed.
 */
export function useDesign(): Design {
  const design = useContext(DesignContext)
  if (!design) throw new Error('useDesign needs the editor (src/editor/Editor.tsx)')
  return design
}

/** The other people's tabs with this design open (avatars, MAP-02's cursors and outlines). */
export function usePresence(): Peer[] {
  const { live } = useEditor()
  return useSyncExternalStore(live.subscribePeers, live.getPeers)
}

/** Publishes this person's cursor on the map (map coordinates, null when it leaves the map). */
export function usePublishCursor(): (cursor: PresenceState['cursor']) => void {
  const { live } = useEditor()
  return useCallback(
    (cursor: PresenceState['cursor']) => {
      live.setPresence({ cursor })
    },
    [live],
  )
}

/** The language the phone and the map show: the top bar's choice, else the design's default. */
export function useLang(): string {
  const design = useDesign()
  const chosen = useSelection((selection) => selection.lang)
  return chosen !== null && design.languages.list.includes(chosen) ? chosen : design.languages.default
}
