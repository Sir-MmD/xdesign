// The map of design.md (docs/plan/06-export-and-claude-link.md section 3): every arrow of the
// design with its label, and Mermaid flowcharts of the steps and arrows, sections as subgraphs. A
// design of more than 80 steps gets an overview of its sections and one chart per section. Node
// IDs are the steps' ID names with a prefix (no ID name can then be a Mermaid word such as `end`),
// and every label is quoted with Mermaid's entity codes for the characters its syntax reads, so
// any title (quotes, brackets, Persian text, emoji) is valid Mermaid.
import { asButtonStep, buildContext, buttonTarget, type Context } from '../checks/context.ts'
import type { Button } from '../model/buttons.ts'
import type { Design } from '../model/design.ts'
import type { ButtonId, StepId, Target } from '../model/ids.ts'
import { type Step, type StepKind, stopTarget } from '../model/steps.ts'
import { draftStopLabel } from '../telegram/rich.ts'
import { inline } from './md.ts'
import { sayStep } from './say.ts'

// A draft's stop arrow, in the editor's words (RICH-02).
const STOPPED = draftStopLabel('stopped_message_generation')

/** An arrow of the map: from a step, or a button the step shows, to a target. */
export type MapArrow = {
  from: Step
  to: Target
  /** On the map: a button's text in the default language, an outcome's name, or "then". */
  label: string
  /** In "Comes from": `button "Menu" (btn_menu)`, `case "Adult"`, "then". */
  how: string
  button?: Button
}

/** Every arrow, the steps in map order: each step's buttons (row parts placed), then its own arrows. */
export function mapArrows(ctx: Context): MapArrow[] {
  const arrows: MapArrow[] = []
  const add = (from: Step, to: Target | undefined, label: string, how = label, button?: Button) => {
    if (to !== undefined) arrows.push({ from, to, label, how, button })
  }
  for (const step of ctx.steps) {
    const sending = asButtonStep(step)
    if (sending) {
      const seen = new Set<ButtonId>()
      for (const button of ctx.rows(sending).flat()) {
        if (seen.has(button.id) || (button.place === 'inline' && button.disabled === true)) continue
        seen.add(button.id)
        const text = button.label[ctx.defaultLanguage]?.trim() || button.idName
        add(step, buttonTarget(button), text, `button "${text}" (${button.idName})`, button)
      }
    }
    switch (step.kind) {
      case 'message':
        add(step, step.next, 'then')
        add(step, stopTarget(step), STOPPED, STOPPED.toLowerCase())
        break
      case 'start':
      case 'remember':
      case 'wait':
      case 'action':
        add(step, step.next, 'then')
        break
      case 'invoice':
        add(step, step.next, 'Paid', 'paid')
        break
      case 'question': {
        const { maxTries } = step.wrongAnswer
        add(step, step.next, 'Valid answer', 'valid answer')
        const wrong = maxTries === undefined ? 'Wrong answer' : `Wrong ${String(maxTries)} times`
        add(step, step.wrongAnswer.afterMaxTries, wrong, wrong.toLowerCase())
        add(step, step.cancel?.goTo, 'Cancel', 'cancel')
        break
      }
      case 'if':
        step.cases.forEach((item, index) => {
          const name = item.label.trim() || `Case ${String(index + 1)}`
          add(step, item.goTo, name, `case "${name}"`)
        })
        add(step, step.otherwise, 'Otherwise', 'otherwise')
        break
      case 'devStep':
        step.outcomes.forEach((outcome, index) => {
          const name = outcome.label.trim() || `Outcome ${String(index + 1)}`
          add(step, outcome.goTo, name, `outcome "${name}"`)
        })
        break
      case 'goTo':
        add(step, step.target, 'then')
        break
      default:
        break
    }
  }
  return arrows
}

/** Every arrow of a design, as design.md's map has them (the MCP connector's steps around a step). */
export function designArrows(design: Design): MapArrow[] {
  return mapArrows(buildContext(design, []))
}

// More steps than this get one chart per section and an overview of the sections.
const ONE_CHART_MAX = 80

// The node shape of each kind: start points are stadiums, messages boxes, questions slanted, If
// boxes diamonds, Remember boxes cylinders, waits hexagons, developer steps double-sided boxes,
// go-to boxes flags, ends circles, invoices trapezoids, actions parallelograms.
const SHAPES: Record<Exclude<StepKind, 'note' | 'frame'>, readonly [string, string]> = {
  start: ['([', '])'],
  message: ['[', ']'],
  question: ['[/', '/]'],
  if: ['{', '}'],
  remember: ['[(', ')]'],
  wait: ['{{', '}}'],
  devStep: ['[[', ']]'],
  goTo: ['>', ']'],
  end: ['((', '))'],
  invoice: ['[/', '\\]'],
  action: ['[\\', '\\]'],
}

const LEGEND =
  'Arrows are labeled with the button text (default language), the outcome or "then". Start points are rounded, messages boxes, questions slanted, If boxes diamonds, Remember boxes cylinders, waits hexagons, developer steps double-edged boxes, go-to boxes flags, ends circles, invoices trapezoids and actions parallelograms.'

// Inside a quoted label Mermaid reads the quote, entity codes (#...;), HTML, Markdown strings (`),
// `style ...:` and `classDef ...:` lines, and %% comments: each such character is written as its
// entity code (`#34;`), which Mermaid shows as the character.
const MERMAID_SPECIAL = /["#&<>`|:%]/g
const esc = (text: string) =>
  text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(MERMAID_SPECIAL, (char) => `#${String(char.codePointAt(0))};`)

type Node = Step & { kind: keyof typeof SHAPES }
const isNode = (step: Step | undefined): step is Node =>
  step !== undefined && step.kind !== 'note' && step.kind !== 'frame'

// The node and subgraph IDs: `s_` and the ID name, made unique; `back` and the overview's group of
// the steps outside every section have IDs no ID name gives (ID names start with a letter).
const BACK = 's__back'
const NO_SECTION = 's__none'

type MapInfo = {
  ctx: Context
  arrows: readonly MapArrow[]
  ids: ReadonlyMap<StepId, string>
  nodes: readonly Node[]
  /** The section frame of each step that sits in one. */
  sectionOf: (step: Step) => Step | undefined
}

/** design.md's map: one Mermaid chart, or for a big design the overview and a chart per section. */
export function mapLines(ctx: Context, arrows: readonly MapArrow[]): string[] {
  const { design } = ctx
  const ids = new Map<StepId, string>()
  const used = new Set<string>()
  for (const step of ctx.steps) {
    let id = `s_${step.idName}`
    for (let n = 2; used.has(id); n++) id = `s_${step.idName}_${String(n)}`
    used.add(id)
    ids.set(step.id, id)
  }
  const sectionOf = (step: Step) => {
    const frame = step.frame === undefined ? undefined : design.steps[step.frame]
    return frame?.kind === 'frame' ? frame : undefined
  }
  const map: MapInfo = { ctx, arrows, ids, nodes: ctx.steps.filter(isNode), sectionOf }
  if (map.nodes.length === 0) return ['The map has no steps yet.']

  const sections = ctx.steps.filter((step) => step.kind === 'frame')
  const groups = [...sections, undefined].flatMap((section) => {
    const nodes = map.nodes.filter((node) => sectionOf(node)?.id === section?.id)
    return nodes.length === 0 ? [] : [{ section, nodes }]
  })
  if (map.nodes.length <= ONE_CHART_MAX || groups.length < 2) {
    return [
      `Every step and arrow, sections as frames around their steps. ${LEGEND}`,
      '',
      ...chart(map, groups, () => true),
    ]
  }

  const lines = [
    `The design has more than ${String(ONE_CHART_MAX)} steps: an overview of the sections, then a map of each section with the steps its arrows go to elsewhere. ${LEGEND}`,
    '',
    '### Overview of the sections',
    '',
    ...overview(map, groups),
  ]
  for (const group of groups) {
    lines.push(
      '',
      group.section === undefined ? '### Steps not in a section' : `### ${inline(sayStep(group.section))}`,
      '',
      ...chart(map, [group], (node) => sectionOf(node)?.id === group.section?.id),
    )
  }
  return lines
}

const nodeLabel = (step: Step) => {
  const title = esc(step.title)
  return title === '' ? step.idName : `${title}<br/>(${step.idName})`
}

const nodeLine = (map: MapInfo, node: Node, extra = '') => {
  const [open, close] = SHAPES[node.kind]
  return `${map.ids.get(node.id) ?? ''}${open}"${nodeLabel(node)}${extra}"${close}`
}

// One chart: the groups' nodes (a section as a subgraph), the steps outside them that their
// arrows go to, and the arrows from the nodes `from` accepts.
function chart(
  map: MapInfo,
  groups: readonly { section: Step | undefined; nodes: readonly Node[] }[],
  from: (node: Node) => boolean,
): string[] {
  const { design } = map.ctx
  const lines = ['```mermaid', 'flowchart LR']
  const shown = new Set<StepId>()
  for (const { section, nodes } of groups) {
    const indent = section === undefined ? '  ' : '    '
    if (section !== undefined)
      lines.push(`  subgraph ${map.ids.get(section.id) ?? ''}["${esc(section.title) || section.idName}"]`)
    for (const node of nodes) {
      lines.push(indent + nodeLine(map, node))
      shown.add(node.id)
    }
    if (section !== undefined) lines.push('  end')
  }

  const edges: string[] = []
  let back = false
  for (const arrow of map.arrows) {
    if (!isNode(arrow.from) || !shown.has(arrow.from.id) || !from(arrow.from)) continue
    let to: string
    if (arrow.to === 'back') {
      to = BACK
      back = true
    } else {
      const step = design.steps[arrow.to]
      if (!isNode(step)) continue
      if (!shown.has(step.id)) {
        const section = map.sectionOf(step)
        lines.push(
          `  ${nodeLine(map, step, `<br/>in ${section === undefined ? 'no section' : esc(section.title) || section.idName}`)}`,
        )
        shown.add(step.id)
      }
      to = map.ids.get(step.id) ?? ''
    }
    edges.push(`  ${map.ids.get(arrow.from.id) ?? ''} -->|"${esc(arrow.label)}"| ${to}`)
  }
  if (back) lines.push(`  ${BACK}(["Back to the message the user came from"])`)
  return [...lines, ...edges, '```']
}

// The overview: a node per section, and an arrow between two sections for the arrows from steps
// of one into steps of the other, labeled with their number.
function overview(map: MapInfo, groups: readonly { section: Step | undefined; nodes: readonly Node[] }[]): string[] {
  const { design } = map.ctx
  const groupId = (section: Step | undefined) => (section === undefined ? NO_SECTION : (map.ids.get(section.id) ?? ''))
  const lines = ['```mermaid', 'flowchart LR']
  for (const { section, nodes } of groups) {
    const title = section === undefined ? 'Not in a section' : esc(section.title) || section.idName
    const count = `${String(nodes.length)} ${nodes.length === 1 ? 'step' : 'steps'}`
    lines.push(`  ${groupId(section)}["${title}<br/>${count}"]`)
  }
  const counts = new Map<string, number>()
  for (const arrow of map.arrows) {
    const to = arrow.to === 'back' ? undefined : design.steps[arrow.to]
    if (!isNode(to) || !isNode(arrow.from)) continue
    const [a, b] = [groupId(map.sectionOf(arrow.from)), groupId(map.sectionOf(to))]
    if (a !== b) counts.set(`${a} ${b}`, (counts.get(`${a} ${b}`) ?? 0) + 1)
  }
  for (const [pair, count] of counts) {
    const [a, b] = pair.split(' ')
    lines.push(`  ${a ?? ''} -->|"${String(count)} ${count === 1 ? 'arrow' : 'arrows'}"| ${b ?? ''}`)
  }
  return [...lines, '```']
}
