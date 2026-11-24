import { type Clip, copySteps, type Issue, type StepId } from '@xdesign/spec'
import {
  Background,
  BackgroundVariant,
  type Connection,
  type EdgeChange,
  type FitViewOptions,
  type NodeChange,
  type NodeMouseHandler,
  type NodeTypes,
  type OnConnectEnd,
  type OnNodeDrag,
  ReactFlow,
  useReactFlow,
  type Viewport,
  type XYPosition,
} from '@xyflow/react'
import {
  type DragEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'

import { useChecks } from '../checks'
import { stepAnchor } from '../comments/anchors'
import { MapSpotPins } from '../comments/Pins'
import { useCanComment, useCommentStore, useComments, usePins } from '../comments/store'
import { useDesign, useEditor, useLang, usePublishCursor } from '../context'
import type { Peer } from '../live'
import { useSelection, useSelectionStore } from '../selection'
import { type MapActions, MapActionsContext, OverlayContext, type Overlays, type PeerTag } from './actions'
import { addStep, useAddStep } from './addStep'
import { arrangeBoxes, type BoxShape } from './arrange'
import { ArrowEdge, type ArrowEdgeType } from './ArrowEdge'
import { deriveArrows, IN, setArrow, takesArrows } from './arrows'
import { boxTypes } from './boxes'
import { OverlaidBox } from './BoxOverlay'
import { copyClip } from './clipboard'
import { useMapKeys } from './keys'
import { ADD_STEPS, isSlashStart, type NewStep, PALETTE_DRAG_TYPE, START_POINTS } from './kinds'
import { arrowEdges, farLines, lightLines, lineAt } from './lines'
import { useLinesView } from './linesView'
import './map.css'
import { MapSearch } from './MapSearch'
import { MapTools } from './MapTools'
import { NewStepMenu } from './NewStepMenu'
import { BOX_SIZE, buildNodes, frameAt, newSize, type Size, type StepNode } from './nodes'
import { PeerCursors } from './PeerCursors'
import { currentPicks, nothingPicked, type Picks, PickStore, usePicks } from './picks'
import { ShownContext, ShownStore } from './shown'
import { TagEdge } from './TagEdge'

// Every kind's box with the overlay of other people's selections and the checks' badges.
const nodeTypes: NodeTypes = Object.fromEntries(Object.keys(boxTypes).map((kind) => [kind, OverlaidBox]))
// A line, or the short tags of a row of a box (MAP-11).
const edgeTypes = { arrow: ArrowEdge, tag: TagEdge }
const fitOptions: FitViewOptions = { maxZoom: 1, padding: 0.2 }
// Shift adds a box to the selection (Ctrl and Cmd too); Shift and a drag on the map draws a box around several.
const multiKeys = ['Shift', 'Meta', 'Control']
// The header's middle: a step made by "New step here" takes the arrow on its dot there.
const IN_DOT_Y = 18
// How far a duplicate lands from what it was made from.
const COPY_OFFSET = 40
// How often at most the pointer goes to the others (milliseconds).
const CURSOR_EVERY = 60

/** Positions and sizes while a box is dragged or a section resized, written to the design at the end. */
type Moving = { positions: Readonly<Record<StepId, XYPosition>>; sizes: Readonly<Record<StepId, Size>> }
const still: Moving = { positions: {}, sizes: {} }

/** "New step here": where the menu shows (pixels in the pane) and the arrow it connects. */
type NewStepAt = { left: number; top: number; flow: XYPosition; from: { step: StepId; handle: string } }

/** A place "Back" returns to after a jump (MAP-11): the view and what was selected. */
type Place = { viewport: Viewport; picks: Picks }
const noPlaces: readonly Place[] = []
// How many places "Back" keeps.
const BACK_PLACES = 10

// The top left corner of a clip's boxes.
function clipCorner(clip: Clip): XYPosition {
  return { x: Math.min(...clip.steps.map((step) => step.x)), y: Math.min(...clip.steps.map((step) => step.y)) }
}

/**
 * The map in the center (04 section 4.3): React Flow over the plain design. Boxes come from the
 * steps (nodes.ts, one renderer per kind in boxes/), arrows from their sources (arrows.ts);
 * nothing of the map is stored apart from the design. Dragging writes the positions at the end
 * (one change, one undo), a step dropped in a section joins it, a drawn arrow sets its source,
 * an arrow dropped on empty space offers "New step here", Delete removes the selected boxes
 * (with the cascades of steps.remove) or clears the selected arrows. A click selects the step in
 * the editor's selection, so the phone shows it; the phone's selection selects the box, and
 * `reveal` brings it into view. The selected boxes' lines, a picked line and the line of the dot
 * or button under the pointer are drawn bold with their labels, and while a step is selected the
 * rest fades (lines.ts). In "Short tags" (the Lines switch, linesView.ts) a far line that is not
 * lit is a short tag at its dot, which jumps to its target as search does, and "Back" returns to
 * the last 10 places until the person moves the map. Read-only: no dragging, drawing, resizing or
 * deleting.
 * Its tools: copy, paste and duplicate (the clipboard carries steps to any design), the arrow
 * keys, search, the minimap, zoom, "Fit", "Auto-arrange" (ELK in a worker, one change), other
 * people's pointers and selections, and the checks' badges on the boxes (keys.ts lists the keys).
 */
export function MapPane() {
  const pane = useRef<HTMLElement>(null)
  const design = useDesign()
  const lang = useLang()
  const { edits, readOnly } = useEditor()
  const selection = useSelectionStore()
  const selectedStep = useSelection((s) => s.step)
  const reveal = useSelection((s) => s.reveal)
  const flow = useReactFlow<StepNode, ArrowEdgeType>()
  // React Flow's own: the same function for the whole time the map is open (`flow` is not).
  const { getViewport } = flow
  const addAtPoint = useAddStep()
  const [picks] = useState(() => new PickStore())
  // What the boxes read of the design beyond their steps (shown.ts), the new design before they render again.
  const [shown] = useState(() => new ShownStore({ design, lang }))
  useLayoutEffect(() => {
    shown.set(design, lang)
  }, [shown, design, lang])
  const picked = usePicks(picks)
  const current = useMemo(() => currentPicks(picked, selectedStep), [picked, selectedStep])
  const [measured, setMeasured] = useState<Readonly<Record<StepId, Size>>>({})
  const [moving, setMoving] = useState<Moving>(still)
  const [menu, setMenu] = useState<NewStepAt | null>(null)
  const [search, setSearch] = useState<{ open: boolean; focus: number }>({ open: false, focus: 0 })
  const [arranging, setArranging] = useState(false)
  // The line of the dot or the button under the pointer (lines.ts), drawn bold with its label.
  const [hovered, setHovered] = useState<string | null>(null)
  // "Short tags" or "All lines" (MAP-11), and the places before the jumps, the last one at the end.
  const [linesView, setLinesView] = useLinesView()
  const [back, setBack] = useState(noPlaces)
  const publishCursor = usePublishCursor()
  const comments = useCommentStore()
  const canComment = useCanComment()
  const commenting = useComments((state) => state.mode) && canComment
  // The pointer over the map (client pixels): the cursor others see, where Ctrl+V pastes.
  const pointer = useRef<XYPosition | null>(null)
  const cursorTimer = useRef<number | undefined>(undefined)

  const { steps, buttons, parts, languages } = design
  const arrows = useMemo(
    () => deriveArrows({ steps, buttons, parts, languages }, lang),
    [steps, buttons, parts, languages, lang],
  )
  // The lines of the selected boxes, the picked ones and the hovered one, lit with their labels
  // (MAP-10): only the boxes and lines whose state changes get new nodes and edges.
  const lit = useMemo(
    () => lightLines(arrows, steps, current.nodes, current.edges, hovered),
    [arrows, steps, current, hovered],
  )
  const base = useMemo(
    () => buildNodes(steps, measured, current.nodes, readOnly, lit),
    [steps, measured, current.nodes, readOnly, lit],
  )
  const nodes = useMemo(() => {
    if (moving === still) return base
    return base.map((node) => {
      const position = moving.positions[node.id]
      const size = moving.sizes[node.id]
      if (!position && !size) return node
      return { ...node, ...(position ? { position } : {}), ...(size ? { width: size.width, height: size.height } : {}) }
    })
  }, [base, moving])
  // The far lines drawn as short tags, and the boxes' "<N> come here" (MAP-11), once per change of
  // the design, the measured sizes or the Lines switch; the boxes read theirs through `shown`.
  const far = useMemo(() => farLines(arrows, steps, measured, linesView), [arrows, steps, measured, linesView])
  useLayoutEffect(() => {
    shown.setComeHere(far.into)
  }, [shown, far])
  const edges = useMemo(() => arrowEdges(arrows, lit, current.edges, current.nodes, far), [arrows, lit, current, far])

  // The same actions for the whole time the map is open, so the boxes that use them do not render
  // again at each change of the design (they read the design when they run).
  const actions = useMemo<MapActions>(() => {
    // Pastes copied steps with the top left corner of their boxes at a point and selects them (the
    // first is the editor's step); a step whose box lands in a section joins it.
    const pasteAt = (clip: Clip, at: XYPosition) => {
      const pasted = edits.map.paste(clip, at, (corner) =>
        frameAt(shown.get().design.steps, { x: corner.x + BOX_SIZE.width / 2, y: corner.y + BOX_SIZE.height / 2 }),
      )
      const step = pasted[0] ?? null
      if (step === null) return
      picks.set({ step, nodes: new Set(pasted), edges: nothingPicked })
      selection.set({ step })
    }
    return {
      resized: (id, box) => {
        edits.steps.move({ [id]: { x: Math.round(box.x), y: Math.round(box.y) } })
        edits.steps.set(id, { width: Math.round(box.width), height: Math.round(box.height) })
        setMoving(still)
      },
      targets: (id) => {
        const now = currentPicks(picks.get(), selection.get().step)
        return now.nodes.has(id) ? [...now.nodes] : [id]
      },
      copy: (ids) => {
        const clip = copySteps(shown.get().design, ids)
        if (clip) copyClip(clip)
      },
      duplicate: (ids) => {
        const clip = copySteps(shown.get().design, ids)
        if (!clip) return
        const corner = clipCorner(clip)
        pasteAt(clip, { x: corner.x + COPY_OFFSET, y: corner.y + COPY_OFFSET })
      },
      paste: pasteAt,
      jump: (to) => {
        const place = { viewport: getViewport(), picks: currentPicks(picks.get(), selection.get().step) }
        setBack((now) => [...now.slice(1 - BACK_PLACES), place])
        selection.reveal(to)
      },
    }
  }, [edits, shown, picks, selection, getViewport])

  // The boxes' changes: where they are dragged or resized to (until the drag ends), their measured
  // sizes (all the boxes React Flow measured at once in one change of the state, and only the sizes
  // that changed), the selection.
  const onNodesChange = (changes: NodeChange<StepNode>[]) => {
    const positions: Record<StepId, XYPosition> = {}
    const sizes: Record<StepId, Size> = {}
    const ended = new Set<StepId>()
    const sizesMeasured: Record<StepId, Size> = {}
    const picking: { id: string; selected: boolean }[] = []
    for (const change of changes) {
      if (change.type === 'position') {
        if (change.dragging === false) ended.add(change.id)
        else if (change.position) positions[change.id] = change.position
      } else if (change.type === 'dimensions' && change.dimensions) {
        const { width, height } = change.dimensions
        if (change.resizing === true) sizes[change.id] = { width, height }
        sizesMeasured[change.id] = { width, height }
      } else if (change.type === 'select') picking.push(change)
    }
    if (Object.keys(positions).length > 0 || Object.keys(sizes).length > 0 || ended.size > 0) {
      setMoving((now) => {
        const next: Moving = {
          positions: Object.fromEntries(
            Object.entries({ ...now.positions, ...positions }).filter(([id]) => !ended.has(id)),
          ),
          sizes: { ...now.sizes, ...sizes },
        }
        return Object.keys(next.positions).length > 0 || Object.keys(next.sizes).length > 0 ? next : still
      })
    }
    if (Object.keys(sizesMeasured).length > 0) {
      setMeasured((now) => {
        const changed = Object.entries(sizesMeasured).filter(([id, size]) => {
          const known = now[id]
          return !known || known.width !== size.width || known.height !== size.height
        })
        return changed.length === 0 ? now : { ...now, ...Object.fromEntries(changed) }
      })
    }
    if (picking.length > 0) pickNodes(picking)
  }

  // Selecting boxes: the last one picked is the editor's step (the phone shows it).
  const pickNodes = (changes: readonly { id: string; selected: boolean }[]) => {
    const now = currentPicks(picks.get(), selection.get().step)
    const next = new Set(now.nodes)
    let last: string | null = null
    for (const change of changes) {
      if (change.selected) {
        next.add(change.id)
        last = change.id
      } else next.delete(change.id)
    }
    const step = last ?? (now.step !== null && next.has(now.step) ? now.step : ([...next][0] ?? null))
    selection.set({ step })
    picks.set({ step, nodes: next, edges: now.edges })
  }

  const onEdgesChange = (changes: EdgeChange<ArrowEdgeType>[]) => {
    const step = selection.get().step
    const now = currentPicks(picks.get(), step)
    const next = new Set(now.edges)
    let changed = false
    for (const change of changes) {
      if (change.type !== 'select') continue
      changed = true
      if (change.selected) next.add(change.id)
      else next.delete(change.id)
    }
    if (changed) picks.set({ step, nodes: now.nodes, edges: next })
  }

  // Boxes moved to new places (a drag, the arrow keys) in one change: a section's steps go with
  // it, a step whose center lands in a section joins it, one moved out of its section leaves it.
  const writeMoves = (moved: Readonly<Record<StepId, XYPosition>>) => {
    const moves: Record<StepId, XYPosition> = { ...moved }
    const frames = new Map<StepId, XYPosition>()
    for (const [id, at] of Object.entries(moved)) {
      const step = steps[id]
      if (step?.kind !== 'frame') continue
      frames.set(step.id, at)
      for (const inside of Object.values(steps)) {
        if (inside.kind === 'frame' || inside.frame !== step.id || inside.id in moves) continue
        moves[inside.id] = { x: inside.x + at.x - step.x, y: inside.y + at.y - step.y }
      }
    }
    const joins: Record<StepId, StepId | null> = {}
    for (const [id, at] of Object.entries(moved)) {
      const step = steps[id]
      if (!step || step.kind === 'frame') continue
      const size = measured[id] ?? BOX_SIZE
      const frame = frameAt(steps, { x: at.x + size.width / 2, y: at.y + size.height / 2 }, frames)
      if (frame !== step.frame) joins[step.id] = frame ?? null
    }
    edits.steps.move(moves, joins)
  }

  // The end of a drag: every dragged box at its new place.
  const onNodeDragStop: OnNodeDrag<StepNode> = (_event, _node, dragged) => {
    const moved: Record<StepId, XYPosition> = {}
    for (const node of dragged) {
      const step = steps[node.id]
      if (!step) continue
      const parent = node.parentId === undefined ? undefined : steps[node.parentId]
      moved[step.id] = {
        x: Math.round(node.position.x + (parent?.x ?? 0)),
        y: Math.round(node.position.y + (parent?.y ?? 0)),
      }
    }
    writeMoves(moved)
    setMoving(still)
  }

  const isValidConnection = (connection: Connection | ArrowEdgeType) => {
    const target = steps[connection.target]
    return connection.targetHandle === IN && target !== undefined && takesArrows(target)
  }

  const onConnect = (connection: Connection) => {
    if (connection.sourceHandle && isValidConnection(connection)) {
      setArrow(edits, connection.source, connection.sourceHandle, connection.target)
    }
  }

  // An arrow dropped on a box (anywhere on it) goes into it; dropped on empty space, it offers
  // "New step here" (a section's inside counts as empty space).
  const onConnectEnd: OnConnectEnd = (event, connection) => {
    if (connection.isValid !== null || !connection.fromNode || connection.fromHandle.type !== 'source') return
    const handle = connection.fromHandle.id
    const point = 'changedTouches' in event ? event.changedTouches[0] : event
    if (!handle || !point) return
    const from = { step: connection.fromNode.id, handle }
    const under = document.elementFromPoint(point.clientX, point.clientY)
    const boxId = under?.closest('.react-flow__node')?.getAttribute('data-id')
    if (boxId) {
      const target = steps[boxId]
      if (target && takesArrows(target)) setArrow(edits, from.step, from.handle, boxId)
      return
    }
    const rect = pane.current?.getBoundingClientRect()
    if (!rect || !under?.closest('.react-flow__pane')) return
    const at: NewStepAt = {
      left: point.clientX - rect.left,
      top: point.clientY - rect.top,
      flow: flow.screenToFlowPosition({ x: point.clientX, y: point.clientY }),
      from,
    }
    // After this pointer's click, which would close the menu again.
    setTimeout(() => {
      setMenu(at)
    }, 0)
  }

  const pickNewStep = (item: NewStep) => {
    if (!menu) return
    const id = addStep(edits, steps, item, { x: menu.flow.x, y: menu.flow.y - IN_DOT_Y })
    setArrow(edits, menu.from.step, menu.from.handle, id)
    selection.set({ step: id })
    setMenu(null)
  }

  // A palette item dragged onto the map.
  const onDragOver = (event: DragEvent) => {
    if (readOnly || !event.dataTransfer.types.includes(PALETTE_DRAG_TYPE)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }
  const onDrop = (event: DragEvent) => {
    const label = event.dataTransfer.getData(PALETTE_DRAG_TYPE)
    const item = [...ADD_STEPS, ...START_POINTS].find((entry) => entry.label === label)
    if (readOnly || !item) return
    event.preventDefault()
    addAtPoint(item, { x: event.clientX, y: event.clientY })
  }

  // Comment mode (CMT-02): a box, a button's pill or the empty map starts a thread there. The
  // boxes' click is the same function while comment mode stays, as React Flow gives it to every box.
  const onNodeClick = useCallback<NodeMouseHandler<StepNode>>(
    (event, node) => {
      if (!commenting) return
      const pill = event.target instanceof Element ? event.target.closest('[data-button]') : null
      const now = shown.get()
      const anchor = stepAnchor(now.design, node.id, pill?.getAttribute('data-button') ?? null, now.lang)
      if (anchor) comments.start(anchor)
    },
    [commenting, shown, comments],
  )
  const onPaneClick = (event: { clientX: number; clientY: number }) => {
    if (!commenting) return
    const at = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY })
    comments.start({ on: 'map', x: Math.round(at.x), y: Math.round(at.y) })
  }

  // The person moved the map themselves (a drag, the wheel, the minimap, the zoom buttons, "Fit"):
  // "Back" goes (MAP-11). The map's own moves (a jump, "Back", search) have no event.
  const moved = () => {
    setBack((now) => (now.length === 0 ? now : noPlaces))
  }
  // "Back": the view and the selection before the last jump.
  const goBack = () => {
    const place = back.at(-1)
    if (!place) return
    setBack(back.slice(0, -1))
    picks.set(place.picks)
    selection.set({ step: place.picks.step })
    void flow.setViewport(place.viewport, { duration: 300 })
  }

  const fit = () => {
    moved()
    void flow.fitView({ ...fitOptions, duration: 300 })
  }
  const openSearch = () => {
    setSearch((now) => ({ open: true, focus: now.focus + 1 }))
  }

  useMapKeys(pane, readOnly, {
    // Delete (or Backspace): the selected boxes go (not `/start`), with the arrows into them; with
    // no box selected, the selected arrows are cleared. (A box dragged around several also
    // selects their arrows, which must not be cleared from a box that stays.)
    remove: () => {
      const step = selection.get().step
      const now = currentPicks(picks.get(), step)
      if (now.nodes.size > 0) {
        const removing = [...now.nodes].filter((id) => {
          const box = steps[id]
          return box !== undefined && !isSlashStart(box)
        })
        if (removing.length > 0) edits.steps.remove(removing)
        return
      }
      for (const arrow of arrows) {
        if (now.edges.has(arrow.id)) setArrow(edits, arrow.from.id, arrow.handle, undefined)
      }
      picks.set({ step, nodes: now.nodes, edges: nothingPicked })
    },
    copy: () => copySteps(design, currentPicks(picks.get(), selection.get().step).nodes),
    // Ctrl+V: the copied boxes centered on the pointer, else on the view's center.
    paste: (clip) => {
      const rect = pane.current?.getBoundingClientRect()
      const center = flow.screenToFlowPosition(
        pointer.current ?? (rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: 0, y: 0 }),
      )
      const corner = clipCorner(clip)
      let right = corner.x
      let bottom = corner.y
      for (const step of clip.steps) {
        const size = step.kind === 'frame' ? step : newSize(step.kind)
        right = Math.max(right, step.x + size.width)
        bottom = Math.max(bottom, step.y + size.height)
      }
      actions.paste(clip, { x: center.x - (right - corner.x) / 2, y: center.y - (bottom - corner.y) / 2 })
    },
    duplicate: () => {
      actions.duplicate([...currentPicks(picks.get(), selection.get().step).nodes])
    },
    nudge: (dx, dy) => {
      const moved: Record<StepId, XYPosition> = {}
      for (const id of currentPicks(picks.get(), selection.get().step).nodes) {
        const step = steps[id]
        if (step) moved[id] = { x: step.x + dx, y: step.y + dy }
      }
      if (Object.keys(moved).length === 0) return false
      writeMoves(moved)
      return true
    },
    fit,
    search: openSearch,
    escape: () => {
      setSearch((now) => (now.open ? { ...now, open: false } : now))
    },
  })

  // Auto-arrange: ELK places every box in a worker, then one change writes them all.
  const arrange = () => {
    const shape = (id: StepId): BoxShape => {
      const node = flow.getInternalNode(id)
      const size = measured[id] ?? BOX_SIZE
      const bounds = node?.internals.handleBounds
      const dots = [
        ...(bounds?.source ?? []).map((dot) => ({ ...dot, type: 'source' as const })),
        ...(bounds?.target ?? []).map((dot) => ({ ...dot, type: 'target' as const })),
      ].flatMap((dot) =>
        dot.id ? [{ id: dot.id, type: dot.type, x: dot.x + dot.width / 2, y: dot.y + dot.height / 2 }] : [],
      )
      return { width: node?.measured.width ?? size.width, height: node?.measured.height ?? size.height, dots }
    }
    setArranging(true)
    arrangeBoxes(steps, arrows, shape)
      .then((boxes) => {
        edits.map.arrange(boxes)
        setTimeout(fit, 50)
      })
      .catch(() => {
        toast.error('Auto-arrange did not work. Try again.')
      })
      .finally(() => {
        setArranging(false)
      })
  }

  // The pointer goes to the others in map coordinates, at most every CURSOR_EVERY milliseconds.
  const onPointerMove = (event: PointerEvent) => {
    pointer.current = { x: event.clientX, y: event.clientY }
    cursorTimer.current ??= window.setTimeout(() => {
      cursorTimer.current = undefined
      const at = pointer.current ? flow.screenToFlowPosition(pointer.current) : null
      publishCursor(at ? { x: Math.round(at.x), y: Math.round(at.y) } : null)
    }, CURSOR_EVERY)
  }
  const onPointerOver = (event: PointerEvent) => {
    setHovered(lineAt(event.target))
  }
  const onPointerLeave = () => {
    setHovered(null)
    pointer.current = null
    window.clearTimeout(cursorTimer.current)
    cursorTimer.current = undefined
    publishCursor(null)
  }
  useEffect(
    () => () => {
      window.clearTimeout(cursorTimer.current)
      publishCursor(null)
    },
    [publishCursor],
  )

  // An avatar's click (later a check's line) brings the selected step into view.
  useEffect(() => {
    if (reveal === 0) return
    const step = selection.get().step
    const node = step === null ? undefined : flow.getInternalNode(step)
    if (!node) return
    const { x, y } = node.internals.positionAbsolute
    const width = node.measured.width ?? BOX_SIZE.width
    const height = node.measured.height ?? BOX_SIZE.height
    void flow.setCenter(x + width / 2, y + height / 2, { zoom: Math.max(flow.getZoom(), 0.8), duration: 300 })
  }, [reveal, selection, flow])

  return (
    <section
      ref={pane}
      aria-label="Map"
      className={cn('xd-map relative h-full', commenting && 'xd-commenting', lit.fade && 'xd-fade')}
      onPointerMove={onPointerMove}
      onPointerOver={onPointerOver}
      onPointerLeave={onPointerLeave}
    >
      <MapActionsContext value={actions}>
        <ShownContext value={shown}>
          <OverlayProvider>
            <ReactFlow<StepNode, ArrowEdgeType>
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDragStop={onNodeDragStop}
              onConnect={onConnect}
              onConnectEnd={onConnectEnd}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              onMove={(event) => {
                if (event) moved()
              }}
              isValidConnection={isValidConnection}
              onDragOver={onDragOver}
              onDrop={onDrop}
              nodesDraggable={!readOnly}
              nodesConnectable={!readOnly}
              deleteKeyCode={null}
              multiSelectionKeyCode={multiKeys}
              disableKeyboardA11y
              onlyRenderVisibleElements
              fitView
              fitViewOptions={fitOptions}
              minZoom={0.1}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} />
              <PeerCursors />
              <MapSpotPins />
              <MapTools
                onSearch={openSearch}
                onFit={fit}
                onArrange={readOnly ? undefined : arrange}
                arranging={arranging}
                onBack={back.length > 0 ? goBack : undefined}
                onMoved={moved}
                lines={linesView}
                onLines={setLinesView}
              />
              {search.open ? (
                <MapSearch
                  focus={search.focus}
                  onClose={() => {
                    setSearch((now) => ({ ...now, open: false }))
                  }}
                />
              ) : null}
            </ReactFlow>
          </OverlayProvider>
        </ShownContext>
      </MapActionsContext>
      <NewStepMenu
        at={menu}
        onPick={pickNewStep}
        onClose={() => {
          setMenu(null)
        }}
      />
    </section>
  )
}

/**
 * Gives the boxes what goes over them: other people's selections (read again only when someone
 * selects something else, not at each move of their pointer), the errors and warnings that
 * are not ignored, by step, and the pins of the open comment threads. A component of its own, so a change re-renders the overlays only.
 */
function OverlayProvider({ children }: { children: ReactNode }) {
  const { live } = useEditor()
  const [tags] = useState(() => new PeerTags())
  const peers = useSyncExternalStore(live.subscribePeers, () => tags.read(live.getPeers()))
  const checks = useChecks()
  const { byStep: pins } = usePins()
  const issues = useMemo(() => {
    const byStep = new Map<StepId, Issue[]>()
    for (const issue of checks) {
      if (issue.ignored === true || issue.level === 'info' || issue.stepId === undefined) continue
      byStep.set(issue.stepId, [...(byStep.get(issue.stepId) ?? []), issue])
    }
    return byStep
  }, [checks])
  const value = useMemo<Overlays>(() => ({ peers, issues, pins }), [peers, issues, pins])
  return <OverlayContext value={value}>{children}</OverlayContext>
}

/** Other people's selections by step, the same map until someone selects something else. */
class PeerTags {
  private key = ''
  private tags: ReadonlyMap<StepId, readonly PeerTag[]> = new Map()

  read(peers: readonly Peer[]): ReadonlyMap<StepId, readonly PeerTag[]> {
    const key = peers.map((peer) => [peer.clientId, peer.step, peer.user.name, peer.user.color].join(' ')).join('\n')
    if (key === this.key) return this.tags
    const tags = new Map<StepId, PeerTag[]>()
    for (const peer of peers) {
      if (peer.step === null) continue
      const tag = { clientId: peer.clientId, name: peer.user.name, color: peer.user.color }
      tags.set(peer.step, [...(tags.get(peer.step) ?? []), tag])
    }
    this.key = key
    this.tags = tags
    return tags
  }
}
