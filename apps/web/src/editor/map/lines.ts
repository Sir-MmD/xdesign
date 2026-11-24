// The lines of the map lit with their names (docs/plan/18 section 5.1, MAP-10): the lines out of
// and into the selected steps, the line of the dot or the button under the pointer and the lines
// picked with a click are drawn bold in the brand color with a label at their middle, and while a
// step is selected every other box and line fades. The one place for which lines are lit
// (`linesOf`, `lightLines`) and what a line's label says (`arrowLabel`). In "Short tags" (MAP-11,
// 18 sections 5.2 and 5.3) a far line that is not lit is drawn as a tag at its dot that jumps to
// its target (`farLines`, `arrowEdges`, TagEdge.tsx), and a box with lines in drawn as tags shows
// "<N> come here" (`far.into`, read through shown.ts). MapPane.tsx builds the edges here and
// nodes.ts gives the boxes their classes (`boxClass`), on React Flow's wrappers, so no box renders
// again for it (PERF-01); map.css draws them.
import type { MapLinesView } from '@xdesign/api'
import type { Design, StepId } from '@xdesign/spec'
import { MarkerType } from '@xyflow/react'

import type { ArrowEdgeType } from './ArrowEdge'
import { type Arrow, arrowId, handles, IN } from './arrows'
import { BOX_SIZE, frameOf, type Size } from './nodes'

/** How many characters of a button's text or an outcome's name a label shows before "...". */
const LABEL_CHARS = 24

// A text cut at a number of characters, then "...".
function cut(text: string, chars: number): string {
  const all = Array.from(text)
  return all.length > chars ? `${all.slice(0, chars).join('')}...` : text
}

/** A line's label: the button's text (up to 24 characters, then "..."), the outcome's or the case's name, "Then". */
export function arrowLabel(arrow: Arrow): string {
  const label = arrow.label.trim()
  return label === '' ? 'No text' : cut(label, LABEL_CHARS)
}

/** How many lines into a box make it a hub ("Main menu"), whose lines in are drawn as tags. */
const HUB_LINES = 5
/** How far apart a dot and its target box are (map pixels) when their line is drawn as a tag. */
const FAR_PIXELS = 1600
/** How many characters of the target's title a tag shows before "...". */
const TAG_CHARS = 20
// Where a line comes into a box: the dot in the middle of its header.
const IN_DOT_Y = 18

/** A line drawn as a short tag at its dot (MAP-11): where it goes, in words. */
export type Tag = {
  /** The line's ID (its arrow's). */
  line: string
  /** The dot it leaves from. */
  handle: string
  to: StepId
  /** The target's title, up to 20 characters, then "...". */
  title: string
  /** The tooltip: "Goes to <title>", with "(<section>)" when the target is in another section. */
  tip: string
}

/** The lines drawn as short tags (18 section 5.2) and the boxes they go into. */
export type Far = {
  /** The tag of each far line, by the line's ID. */
  tags: ReadonlyMap<string, Tag>
  /** How many lines in ("<N> come here", every line) each box with any line in drawn as a tag has. */
  into: ReadonlyMap<StepId, number>
}

const noFar: Far = { tags: new Map(), into: new Map() }

/**
 * The far lines, drawn as short tags in "Short tags" ("All lines" has none): a line into a step in
 * another section than its source, into a step with 5 or more lines in (a hub), or whose dot (the
 * middle of its box's right edge, by the measured size) is more than 1,600 map pixels from its
 * target's dot. Only the map draws them so: auto-arrange still uses every line.
 */
export function farLines(
  arrows: readonly Arrow[],
  steps: Design['steps'],
  measured: Readonly<Record<StepId, Size>>,
  view: MapLinesView,
): Far {
  if (view === 'all') return noFar
  const counts = new Map<StepId, number>()
  for (const arrow of arrows) counts.set(arrow.to, (counts.get(arrow.to) ?? 0) + 1)
  const tags = new Map<string, Tag>()
  const into = new Map<StepId, number>()
  for (const arrow of arrows) {
    const target = steps[arrow.to]
    if (!target) continue
    const count = counts.get(arrow.to) ?? 0
    const section = frameOf(steps, target)
    const away = section !== undefined && section.id !== frameOf(steps, arrow.from)?.id
    const size = measured[arrow.from.id] ?? BOX_SIZE
    const apart = Math.hypot(
      target.x - (arrow.from.x + size.width),
      target.y + IN_DOT_Y - (arrow.from.y + size.height / 2),
    )
    if (!away && count < HUB_LINES && apart <= FAR_PIXELS) continue
    const title = target.title.trim()
    const where = away ? section.title.trim() : ''
    tags.set(arrow.id, {
      line: arrow.id,
      handle: arrow.handle,
      to: arrow.to,
      title: cut(title, TAG_CHARS),
      tip: where === '' ? `Goes to ${title}` : `Goes to ${title} (${where})`,
    })
    into.set(arrow.to, count)
  }
  return { tags, into }
}

/** The lines of some steps (the selected ones): every line out of them and into them. */
export function linesOf(arrows: readonly Arrow[], steps: ReadonlySet<StepId>): Set<string> {
  const lines = new Set<string>()
  if (steps.size === 0) return lines
  for (const arrow of arrows) {
    if (steps.has(arrow.from.id) || steps.has(arrow.to)) lines.add(arrow.id)
  }
  return lines
}

/** The lines lit on the map and what they do to the boxes. */
export type Lit = {
  /** The lines drawn bold in the brand color with their labels. */
  lines: ReadonlySet<string>
  /** The boxes at full strength while the rest fades: the selected ones and both ends of each lit line. */
  boxes: ReadonlySet<StepId>
  /** The box the line under the pointer goes into, outlined. */
  aimed: StepId | null
  /** Whether every box and line not lit fades: a step with lines (not a note or a section) is selected. */
  fade: boolean
}

/**
 * The lines lit: those of the selected steps, the picked ones, and the line of the dot or button
 * under the pointer (`hovered`, an arrow's ID from `lineAt`), which also outlines its target.
 */
export function lightLines(
  arrows: readonly Arrow[],
  steps: Design['steps'],
  selected: ReadonlySet<StepId>,
  picked: ReadonlySet<string>,
  hovered: string | null,
): Lit {
  const lines = linesOf(arrows, selected)
  for (const id of picked) lines.add(id)
  const pointed = hovered === null ? undefined : arrows.find((arrow) => arrow.id === hovered)
  if (pointed) lines.add(pointed.id)
  const boxes = new Set(selected)
  for (const arrow of arrows) {
    if (!lines.has(arrow.id)) continue
    boxes.add(arrow.from.id)
    boxes.add(arrow.to)
  }
  const fade = [...selected].some((id) => {
    const kind = steps[id]?.kind
    return kind !== undefined && kind !== 'note' && kind !== 'frame'
  })
  return { lines, boxes, aimed: pointed?.to ?? null, fade }
}

/** A box's classes from the lit lines (map.css): `xd-lit` at full strength, `xd-aimed` outlined. */
export function boxClass(lit: Lit, id: StepId): string | undefined {
  if (lit.aimed === id) return 'xd-lit xd-aimed'
  return lit.boxes.has(id) ? 'xd-lit' : undefined
}

/**
 * The line of the dot or the button under the pointer, as its arrow's ID: a dot (React Flow's
 * handle), the row of a labeled dot ("Then", "Valid answer", an outcome) or a button's pill.
 */
export function lineAt(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null
  const step = target.closest('.react-flow__node')?.getAttribute('data-id')
  if (!step) return null
  const button = target.closest('[data-button]')?.getAttribute('data-button')
  const handle =
    target.closest('.react-flow__handle.source')?.getAttribute('data-handleid') ??
    target.closest('[data-exit]')?.getAttribute('data-exit') ??
    (button ? handles.button(button) : null)
  return handle ? arrowId(step, handle) : null
}

const arrowEnd = { type: MarkerType.ArrowClosed, width: 18, height: 18 }
// A lit line's head, in the brand color (it grows with the line's width).
const litEnd = { type: MarkerType.ArrowClosed, width: 14, height: 14, color: 'var(--brand)' }
// A lit line over the boxes when React Flow does not raise it already (the lines of a selected box
// and a picked line are raised with it, under the selected box).
const LIT_Z = 1000

// The edge made for each arrow in each state, so a line whose state did not change keeps its edge
// and React Flow draws again only the lines that changed.
const made = new WeakMap<Arrow, Map<string, ArrowEdgeType>>()

// The edge of an arrow in a state: the one made before, else a new one.
function keptEdge(arrow: Arrow, key: string, make: () => ArrowEdgeType): ArrowEdgeType {
  let edges = made.get(arrow)
  if (!edges) {
    edges = new Map()
    made.set(arrow, edges)
  }
  const known = edges.get(key)
  if (known) return known
  const edge = make()
  edges.set(key, edge)
  return edge
}

// The tags drawn together beside one row of a box: a row of its buttons, else one labeled dot's.
function tagRow(arrow: Arrow): string {
  return arrow.row === undefined ? arrow.id : `${arrow.from.id}|row:${String(arrow.row)}`
}

/**
 * The edges of the map: one per arrow into its target's dot, a Go to box's dashed, a button's with
 * its click mode and popup, the lit ones bold with their labels (ArrowEdge.tsx). A far line that
 * is not lit is a short tag instead (`far`, none in "All lines"): the tags of one row of a box are
 * one edge, its first line's, drawn beside the row (TagEdge.tsx).
 */
export function arrowEdges(
  arrows: readonly Arrow[],
  lit: Lit,
  picked: ReadonlySet<string>,
  selected: ReadonlySet<StepId>,
  far: Far,
): ArrowEdgeType[] {
  const rows = new Map<string, Tag[]>()
  for (const arrow of arrows) {
    const tag = far.tags.get(arrow.id)
    if (!tag || lit.lines.has(arrow.id)) continue
    const row = tagRow(arrow)
    rows.set(row, [...(rows.get(row) ?? []), tag])
  }
  return arrows.flatMap((arrow) => {
    const row = far.tags.has(arrow.id) && !lit.lines.has(arrow.id) ? rows.get(tagRow(arrow)) : undefined
    if (row) {
      if (row[0]?.line !== arrow.id) return []
      return keptEdge(arrow, `tags ${row.map((tag) => tag.line).join(' ')}`, () => ({
        id: arrow.id,
        type: 'tag',
        source: arrow.from.id,
        sourceHandle: arrow.handle,
        target: arrow.to,
        targetHandle: IN,
        // Not a line to pick: its tags are buttons of their own.
        selectable: false,
        focusable: false,
        deletable: false,
        data: { label: arrowLabel(arrow), lit: false, jump: arrow.from.kind === 'goTo', tags: row },
      }))
    }
    const isPicked = picked.has(arrow.id)
    const isLit = lit.lines.has(arrow.id)
    const raised = isPicked || selected.has(arrow.from.id) || selected.has(arrow.to)
    return keptEdge(arrow, `${String(isPicked)} ${String(isLit)} ${String(raised)}`, () => {
      const action =
        arrow.button?.place === 'inline' && arrow.button.action.type === 'goTo' ? arrow.button.action : undefined
      return {
        id: arrow.id,
        type: 'arrow',
        source: arrow.from.id,
        sourceHandle: arrow.handle,
        target: arrow.to,
        targetHandle: IN,
        selected: isPicked,
        deletable: false,
        markerEnd: isLit ? litEnd : arrowEnd,
        ...(isLit ? { className: 'xd-lit' } : {}),
        ...(isLit && !raised ? { zIndex: LIT_Z } : {}),
        data: {
          label: arrowLabel(arrow),
          lit: isLit,
          show: action?.show,
          popup: action?.popup !== undefined,
          jump: arrow.from.kind === 'goTo',
        },
      }
    })
  })
}
