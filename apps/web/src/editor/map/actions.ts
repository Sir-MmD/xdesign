// What a box asks of the map around it, and what the map tells its boxes (MapPane.tsx provides
// both): a section's new size after the person resized it, written once at the end so the change
// is one step of undo; the boxes the box menu acts on, copied or duplicated with the selection;
// the jump of a short tag and of "Comes here from" (MAP-11); other people's selections, the checks' issues and the comments' pins drawn over each box
// (BoxOverlay.tsx).
import type { Clip, Issue, StepId } from '@xdesign/spec'
import { createContext, useContext } from 'react'

import type { Pin } from '../comments/store'

export type MapActions = {
  /** A section was resized to this place and size (map coordinates). */
  resized: (id: StepId, box: { x: number; y: number; width: number; height: number }) => void
  /** The boxes a box's menu acts on: the selected ones when the box is one of them, else the box. */
  targets: (id: StepId) => StepId[]
  /** Copies steps to the clipboard (the box menu's "Copy", Ctrl+C). */
  copy: (ids: readonly StepId[]) => void
  /** Copies steps 40 pixels down and right, selected ("Duplicate", Ctrl+D). */
  duplicate: (ids: readonly StepId[]) => void
  /** Pastes copied steps with the top left corner of their boxes at a point (map coordinates), selected. */
  paste: (clip: Clip, at: { x: number; y: number }) => void
  /**
   * Moves the map to a box and selects it, as search does, keeping the place before for "Back" (a
   * short tag, a row of "Comes here from", MAP-11).
   */
  jump: (to: StepId) => void
}

export const MapActionsContext = createContext<MapActions | null>(null)

export function useMapActions(): MapActions {
  const actions = useContext(MapActionsContext)
  if (!actions) throw new Error('useMapActions needs the map (src/editor/map/MapPane.tsx)')
  return actions
}

/** Someone else with a box selected: their name and color go around it. */
export type PeerTag = { clientId: number; name: string; color: string }

/** What the map draws over its boxes: other people's selections, each step's issues and pins. */
export type Overlays = {
  peers: ReadonlyMap<StepId, readonly PeerTag[]>
  /** Errors and warnings that are not ignored, by step. */
  issues: ReadonlyMap<StepId, readonly Issue[]>
  /** The open comment threads on a step, its buttons and texts (CMT-02). */
  pins: ReadonlyMap<StepId, readonly Pin[]>
}

export const OverlayContext = createContext<Overlays>({ peers: new Map(), issues: new Map(), pins: new Map() })
