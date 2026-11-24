// The boxes of the map as React Flow nodes (docs/plan/04 section 4.3), built from the plain
// design each time it changes: one node per step at its position. A step in a section is a child
// of its frame, placed relative to it, so a section carries its steps when it moves; the model
// keeps every position absolute. Sections come first (React Flow wants parents before their
// children) and so lie under the boxes, the largest at the bottom.
import type { Design, FrameStep, Step, StepId, StepKind } from '@xdesign/spec'
import type { Node, XYPosition } from '@xyflow/react'

import { boxClass, type Lit } from './lines'

/** A box: its step, by the step's kind (one box renderer per kind, boxes/). */
export type StepNode = Node<{ step: Step }, StepKind>
/** A box of one kind, for its renderer's props. */
export type KindNode<K extends StepKind> = Node<{ step: Extract<Step, { kind: K }> }, K>

export type Size = { width: number; height: number }

/** The size a new box is placed by (boxes are 240 pixels wide; their height follows the content). */
export const BOX_SIZE: Size = { width: 240, height: 80 }

/** The size of a new step of a kind, to center it on a point (a new section is 640 by 400). */
export function newSize(kind: StepKind): Size {
  if (kind === 'frame') return { width: 640, height: 400 }
  if (kind === 'note') return { width: 200, height: 120 }
  return BOX_SIZE
}

/** The section a step sits in, when the design has that section. */
export function frameOf(steps: Design['steps'], step: Step): FrameStep | undefined {
  if (step.kind === 'frame' || step.frame === undefined) return undefined
  const frame = steps[step.frame]
  return frame?.kind === 'frame' ? frame : undefined
}

/** The smallest section around a point of the map (a step dropped there belongs to it). */
export function frameAt(
  steps: Design['steps'],
  at: XYPosition,
  frames?: ReadonlyMap<StepId, XYPosition>,
): StepId | undefined {
  let found: FrameStep | undefined
  for (const step of Object.values(steps)) {
    if (step.kind !== 'frame') continue
    const { x, y } = frames?.get(step.id) ?? step
    const inside = at.x >= x && at.x <= x + step.width && at.y >= y && at.y <= y + step.height
    if (inside && (!found || step.width * step.height < found.width * found.height)) found = step
  }
  return found?.id
}

/**
 * The nodes of the design: positions from the steps, the sizes React Flow measured, the
 * selection, the classes of the lit lines' boxes (lines.ts, on React Flow's wrapper, not the
 * box's props), and sections with their size and a title bar to drag them by. A step whose node
 * would be the same as before keeps that node, so React Flow draws its box again only when its
 * step, place, size or selection changed (PERF-01).
 */
export function buildNodes(
  steps: Design['steps'],
  measured: Readonly<Record<StepId, Size>>,
  selected: ReadonlySet<StepId>,
  readOnly: boolean,
  lit: Lit,
): StepNode[] {
  const frames: FrameStep[] = []
  const nodes: StepNode[] = []
  for (const step of Object.values(steps)) {
    if (step.kind === 'frame') {
      frames.push(step)
      continue
    }
    const frame = frameOf(steps, step)
    const className = boxClass(lit, step.id)
    nodes.push(
      kept({
        id: step.id,
        type: step.kind,
        data: { step },
        position: frame ? { x: step.x - frame.x, y: step.y - frame.y } : { x: step.x, y: step.y },
        ...(frame ? { parentId: frame.id } : {}),
        measured: measured[step.id],
        selected: selected.has(step.id),
        draggable: !readOnly,
        connectable: !readOnly,
        deletable: false,
        ...(className ? { className } : {}),
      }),
    )
  }
  frames.sort((a, b) => b.width * b.height - a.width * a.height)
  return [
    ...frames.map((frame) =>
      kept({
        id: frame.id,
        type: 'frame',
        data: { step: frame },
        position: { x: frame.x, y: frame.y },
        width: frame.width,
        height: frame.height,
        measured: measured[frame.id],
        selected: selected.has(frame.id),
        draggable: !readOnly,
        connectable: false,
        deletable: false,
        dragHandle: '.xd-frame-head',
        className: 'xd-frame',
      }),
    ),
    ...nodes,
  ]
}

// The last node made for each step (the design keeps the object of a step that did not change).
const made = new WeakMap<Step, StepNode>()

// The node made before for the same step when every field is the same, else this one with the
// same `data` as before, so a box whose step did not change gets the same props.
function kept(node: StepNode): StepNode {
  const { step } = node.data
  const before = made.get(step)
  const next = before ? { ...node, data: before.data } : node
  if (before && sameFields(before, next)) return before
  made.set(step, next)
  return next
}

// The same fields, each the same value or an object of the same values (a position, a size).
function sameFields(a: object, b: object): boolean {
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const keys = Object.keys(left)
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => {
      const x = left[key]
      const y = right[key]
      if (x === y) return true
      return typeof x === 'object' && typeof y === 'object' && x !== null && y !== null && sameFields(x, y)
    })
  )
}
