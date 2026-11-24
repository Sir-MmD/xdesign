// Adding a step where the person asked for it (docs/plan/04 sections 4.2 and 4.3): a palette
// click (the center of the view), a palette item dropped on the map, "New step here" where an
// arrow was dropped. A step whose box lands in a section belongs to it; the new step is selected,
// so its editor opens.
import type { Design, DesignEdits, StepId } from '@xdesign/spec'
import { useReactFlow, useStoreApi, type XYPosition } from '@xyflow/react'

import { useDesign, useEditor } from '../context'
import { useSelectionStore } from '../selection'
import type { NewStep } from './kinds'
import { frameAt, newSize } from './nodes'

/** Adds a step with its box's top left corner at `at` (map coordinates). */
export function addStep(edits: DesignEdits, steps: Design['steps'], item: NewStep, at: XYPosition): StepId {
  const size = newSize(item.kind)
  const corner = { x: Math.round(at.x), y: Math.round(at.y) }
  const frame =
    item.kind === 'frame' ? undefined : frameAt(steps, { x: corner.x + size.width / 2, y: corner.y + size.height / 2 })
  return edits.steps.add(item.kind, corner, item.trigger ? { trigger: item.trigger, frame } : { frame })
}

/**
 * Adds a step centered on a point of the screen (a drop), or on the center of the map's view
 * without one (a click in the palette), and selects it. Needs the map's React Flow provider.
 */
export function useAddStep(): (item: NewStep, client?: { x: number; y: number }) => StepId {
  const design = useDesign()
  const { edits } = useEditor()
  const selection = useSelectionStore()
  const flow = useReactFlow()
  const store = useStoreApi()
  return (item, client) => {
    let point = client
    if (!point) {
      const rect = store.getState().domNode?.getBoundingClientRect()
      point = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: 0, y: 0 }
    }
    const center = flow.screenToFlowPosition(point)
    const size = newSize(item.kind)
    const id = addStep(edits, design.steps, item, { x: center.x - size.width / 2, y: center.y - size.height / 2 })
    selection.set({ step: id })
    return id
  }
}
