// The parts every box of the map is made of (docs/plan/04 section 4.3): the frame with the
// kind's icon, the title and the box menu, the dot arrows come in on, labeled dots for the
// step's exits, a one-line summary, and a message's buttons as pills in their looks, each with
// its dot. Each kind's renderer (one file per kind in this folder) puts them together, so
// LOGIC-01 and START-01 can change one kind without the others.
import {
  type Button,
  type Content,
  type Design,
  type Look,
  plainText,
  type RichTextRef,
  type Step,
  telegram,
} from '@xdesign/spec'
import { Handle, Position, useNodeId, useStoreApi, useUpdateNodeInternals } from '@xyflow/react'
import { BellIcon, CopyIcon, LinkIcon, LogInIcon, Undo2Icon } from 'lucide-react'
import { type ReactNode, useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

import { useEditor } from '../../context'
import { useSelectionStore } from '../../selection'
import { buttonTarget, buttonText, canGo, type Exit, handles, IN, type SendingStep, shownRowsOf } from '../arrows'
import { BoxMenu } from '../BoxMenu'
import { ComeHere } from '../ComeHere'
import { KIND_ICONS } from '../kinds'
import { useShown } from '../shown'

// The boxes waiting to be measured again, by map (its React Flow store).
const remeasuring = new WeakMap<object, Set<string>>()

/**
 * React Flow measures a box's dots when the box mounts or changes size; when they change without
 * that (a button added to a row, a part's buttons changed), it is asked to measure them again:
 * once per frame for all the boxes that changed (PERF-01), never on a box's first mount.
 */
function useRemeasure(change: unknown): void {
  const nodeId = useNodeId()
  const map = useStoreApi()
  const updateNodeInternals = useUpdateNodeInternals()
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    if (nodeId === null) return
    const waiting = remeasuring.get(map)
    if (waiting) {
      waiting.add(nodeId)
      return
    }
    remeasuring.set(map, new Set([nodeId]))
    requestAnimationFrame(() => {
      const ids = remeasuring.get(map) ?? []
      remeasuring.delete(map)
      updateNodeInternals([...ids])
    })
  }, [nodeId, map, updateNodeInternals, change])
}

/**
 * A box: the kind's icon, the title, "<N> come here" while lines into it are short tags (MAP-11)
 * and (for people who can edit) the "..." menu, with the dot arrows come in on (`takesArrows`) and
 * a single dot out on the right (`out`, a step field such as `next`), then the kind's own content.
 */
export function BoxShell({
  step,
  selected,
  takesArrows = true,
  out,
  className,
  children,
}: {
  step: Step
  selected: boolean
  takesArrows?: boolean
  out?: string
  className?: string
  children?: ReactNode
}) {
  const { readOnly } = useEditor()
  const Icon = KIND_ICONS[step.kind]
  useRemeasure(step)
  return (
    <div
      className={cn(
        'xd-box group/box relative w-60 rounded-xl border bg-surface text-callout shadow-(--shadow-sm) transition-colors duration-(--dur-fast) ease-(--ease)',
        selected ? 'border-brand outline-2 outline-brand/30 outline-solid' : 'hover:border-border-strong',
        className,
      )}
    >
      <div className="relative flex min-h-9 items-center gap-2 ps-3 pe-1.5">
        {takesArrows ? (
          <Handle type="target" position={Position.Left} id={IN} isConnectableStart={false} className="xd-dot xd-in" />
        ) : null}
        <Icon aria-hidden className="size-4 shrink-0 text-fg-3" />
        <span dir="auto" className="min-w-0 flex-1 truncate font-semibold">
          {step.title}
        </span>
        {takesArrows ? <ComeHere step={step} /> : null}
        {readOnly ? null : <BoxMenu step={step} />}
      </div>
      {children}
      {out === undefined ? null : <Handle type="source" position={Position.Right} id={out} className="xd-dot" />}
    </div>
  )
}

/** A short line under the title; `muted` for an empty state. */
export function Summary({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <p dir="auto" className={cn('line-clamp-2 px-3 pb-2 text-subhead', muted ? 'text-fg-3' : 'text-fg-2')}>
      {children}
    </p>
  )
}

/**
 * Labeled dots, one per line, each on the box's right edge: "Yes", "Otherwise", "Valid answer".
 * Hovering a row draws its line bold with its label (`data-exit`, lines.ts).
 */
export function Exits({ exits }: { exits: readonly Exit[] }) {
  if (exits.length === 0) return null
  return (
    <div className="border-t py-1">
      {exits.map((exit) => (
        <div
          key={exit.handle}
          data-exit={exit.handle}
          className="relative flex min-h-6 items-center justify-end px-3 text-footnote text-fg-2"
        >
          <span dir="auto" className="truncate">
            {exit.label}
          </span>
          <Handle type="source" position={Position.Right} id={exit.handle} className="xd-dot" />
        </div>
      ))}
    </div>
  )
}

/** The first line of a rich text in the language shown (else the default one), its variables as `{name}`. */
function firstLine(text: RichTextRef | undefined, design: Design, lang: string): string {
  const doc = text?.doc[lang] ?? text?.doc[design.languages.default]
  if (!doc) return ''
  const varName = (id: string) => design.variables[id]?.idName ?? id
  const partText = (id: string) => {
    const part = design.parts[id]
    const partDoc = part?.kind === 'text' ? (part.text.doc[lang] ?? part.text.doc[design.languages.default]) : undefined
    return partDoc ? plainText(partDoc, varName) : ''
  }
  return (
    plainText(doc, varName, partText)
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line !== '') ?? ''
  )
}

/**
 * What a message sends, in one line: the first line of its text, or the kind ("Photo") with
 * the first line of its caption, an album's count, a venue's title, a contact's name.
 */
export function ContentSummary({ content }: { content: Content }) {
  // The first line of the text or the caption.
  const first = useShown(content, (design, lang) => {
    if (content.type === 'text') return firstLine(content.text, design, lang)
    return 'caption' in content ? firstLine(content.caption, design, lang) : ''
  })
  if (content.type === 'text') {
    return <Summary muted={first === ''}>{first === '' ? 'No text yet' : first}</Summary>
  }
  const kind = telegram.messageKind(content.type).label
  let detail = ''
  if (content.type === 'album') detail = `${String(content.items.length)} items`
  else if (content.type === 'venue') detail = content.title
  else if (content.type === 'contact') detail = content.firstName
  else if ('caption' in content) detail = first
  return (
    <Summary>
      <span className="font-medium text-foreground">{kind}</span>
      {detail === '' ? null : ` · ${detail}`}
    </Summary>
  )
}

const LOOKS: Record<Look, string> = {
  default: 'border bg-surface-2 text-foreground',
  primary: 'bg-tg-blue text-on-tg-blue',
  success: 'bg-ok text-on-status',
  danger: 'bg-error text-on-status',
}

/**
 * A message's buttons as pills in their looks, row by row: a rich message's buttons inside, then
 * the keyboard's, row parts placed. A button that can go to a step has a dot on the pill's right
 * edge (once per box, as a button shows once).
 */
export function ButtonRows({ step }: { step: SendingStep }) {
  const selection = useSelectionStore()
  const rows = useShown(step, (design, lang) =>
    shownRowsOf(design, step).map((row) => row.map((button) => ({ button, text: buttonText(button, design, lang) }))),
  )
  useRemeasure(rows.map((row) => row.map(({ button }) => `${button.id}:${String(canGo(button))}`).join(' ')).join('\n'))
  if (rows.length === 0) return null
  const dotted = new Set<string>()
  return (
    <div className="flex flex-col gap-1 px-3 pb-2">
      {rows.map((row, index) => (
        <div key={index} className="flex gap-1">
          {row.map(({ button, text }, place) => {
            const dot = canGo(button) && !dotted.has(button.id)
            if (dot) dotted.add(button.id)
            return (
              <Pill
                key={`${button.id}-${String(place)}`}
                button={button}
                text={text}
                dot={dot}
                select={() => {
                  selection.set({ step: step.id, button: button.id })
                }}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** A button's pill; a click selects it, so its popover opens on the phone (BTN-01). */
function Pill({ button, text, dot, select }: { button: Button; text: string; dot: boolean; select: () => void }) {
  const target = buttonTarget(button)
  const action = button.place === 'inline' ? button.action : undefined
  return (
    <div
      onClick={select}
      // Comment mode reads which button was clicked (CMT-02), the map which line is hovered (lines.ts).
      data-button={button.id}
      className={cn(
        'relative flex h-6 min-w-0 flex-1 items-center justify-center gap-1 rounded-full px-2.5 text-caption font-medium',
        LOOKS[button.look],
        button.place === 'inline' && button.disabled === true && 'opacity-50',
      )}
    >
      {/* The icon and the label are one run that takes its direction from the label's first letter, so
      the icon stays at the label's start (docs/plan/17 section 11). */}
      <span dir="auto" className="truncate">
        {button.icon ? (
          <span aria-hidden className="me-1">
            {button.icon.fallback}
          </span>
        ) : null}
        <span className={cn(text === '' && 'opacity-60')}>{text === '' ? 'No text' : text}</span>
      </span>
      {action?.type === 'url' ? <LinkIcon aria-label="Link" className="size-3 shrink-0" /> : null}
      {action?.type === 'copyText' ? <CopyIcon aria-label="Copy text" className="size-3 shrink-0" /> : null}
      {action?.type === 'loginUrl' ? <LogInIcon aria-label="Login link" className="size-3 shrink-0" /> : null}
      {target === 'back' ? <Undo2Icon aria-label="Back" className="size-3 shrink-0" /> : null}
      {action?.type === 'goTo' && action.popup !== undefined && target === undefined ? (
        <BellIcon aria-label="Popup" className="size-3 shrink-0" />
      ) : null}
      {dot ? (
        <Handle type="source" position={Position.Right} id={handles.button(button.id)} className="xd-dot" />
      ) : null}
    </div>
  )
}
