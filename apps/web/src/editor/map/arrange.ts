// Auto-arrange (docs/plan/04 section 4.3): ELK's layered layout, left to right, in a web worker
// (elkjs' own worker script, started on the first use), so a big design does not stop the page.
// Each section is a box of its own with its steps inside, so it stays together; every dot is a
// port at its place on the box's edge, so arrows leave in their order. The arranged design keeps
// its top left corner where it was.
import type { ArrangedBox, Design, StepId } from '@xdesign/spec'
import ElkConstructor, { type ELK, type ElkExtendedEdge, type ElkNode, type ElkPort } from 'elkjs/lib/elk-api'
import elkWorkerUrl from 'elkjs/lib/elk-worker.min.js?url'

import type { Arrow } from './arrows'
import { IN } from './arrows'
import { frameOf } from './nodes'

/** A box as the map shows it: its size and its dots (handle ID and middle, from its top left). */
export type BoxShape = {
  width: number
  height: number
  dots: readonly { id: string; type: 'source' | 'target'; x: number; y: number }[]
}

// Room around a section's steps, its title bar on top.
const FRAME_PADDING = '[top=60,left=32,bottom=32,right=32]'

const LAYOUT = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.spacing.nodeNode': '48',
  'elk.layered.spacing.nodeNodeBetweenLayers': '96',
  'elk.spacing.componentComponent': '96',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
}

let elk: ELK | undefined

const portId = (step: StepId, handle: string) => `port:${step}:${handle}`

/**
 * The new place of every box (and the size of every section), in map coordinates. `shape` gives
 * a box's measured size and dots; the steps go to ELK in map order, so it keeps that order where
 * it can.
 */
export async function arrangeBoxes(
  steps: Design['steps'],
  arrows: readonly Arrow[],
  shape: (id: StepId) => BoxShape,
): Promise<Record<StepId, ArrangedBox>> {
  elk ??= new ElkConstructor({ workerUrl: elkWorkerUrl })
  const ordered = Object.values(steps).sort((a, b) => a.x - b.x || a.y - b.y)
  const ports = new Set<string>()
  const inside = new Map<StepId, ElkNode[]>()
  const top: ElkNode[] = []
  for (const step of ordered) {
    if (step.kind === 'frame') continue
    const { width, height, dots } = shape(step.id)
    const node: ElkNode = {
      id: step.id,
      width,
      height,
      layoutOptions: { 'elk.portConstraints': 'FIXED_POS' },
      ports: dots.map((dot): ElkPort => {
        const id = portId(step.id, dot.id)
        ports.add(id)
        return {
          id,
          x: dot.x,
          y: dot.y,
          width: 1,
          height: 1,
          layoutOptions: { 'elk.port.side': dot.type === 'source' ? 'EAST' : 'WEST' },
        }
      }),
    }
    const frame = frameOf(steps, step)
    if (frame) inside.set(frame.id, [...(inside.get(frame.id) ?? []), node])
    else top.push(node)
  }
  for (const frame of ordered) {
    if (frame.kind !== 'frame') continue
    const children = inside.get(frame.id)
    top.push(
      children
        ? { id: frame.id, children, layoutOptions: { 'elk.padding': FRAME_PADDING } }
        : { id: frame.id, width: frame.width, height: frame.height },
    )
  }
  const edges = arrows.map((arrow): ElkExtendedEdge => {
    const from = portId(arrow.from.id, arrow.handle)
    const to = portId(arrow.to, IN)
    return {
      id: `edge:${arrow.id}`,
      sources: [ports.has(from) ? from : arrow.from.id],
      targets: [ports.has(to) ? to : arrow.to],
    }
  })
  const laid = await elk.layout({ id: 'map', layoutOptions: LAYOUT, children: top, edges })

  const boxes: Record<StepId, ArrangedBox> = {}
  for (const node of laid.children ?? []) {
    const x = node.x ?? 0
    const y = node.y ?? 0
    const frame = steps[node.id]?.kind === 'frame'
    boxes[node.id] = frame ? { x, y, width: node.width ?? 0, height: node.height ?? 0 } : { x, y }
    for (const child of node.children ?? []) boxes[child.id] = { x: x + (child.x ?? 0), y: y + (child.y ?? 0) }
  }
  // Keep the top left corner of the design where it was.
  const all = Object.values(boxes)
  const dx = Math.min(...ordered.map((step) => step.x)) - Math.min(...all.map((box) => box.x))
  const dy = Math.min(...ordered.map((step) => step.y)) - Math.min(...all.map((box) => box.y))
  for (const box of all) {
    box.x = Math.round(box.x + dx)
    box.y = Math.round(box.y + dy)
    if (box.width !== undefined) box.width = Math.round(box.width)
    if (box.height !== undefined) box.height = Math.round(box.height)
  }
  return boxes
}
