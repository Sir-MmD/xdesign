// The pins of the open threads (docs/plan/04 section 15): numbered dots on the map's boxes (a
// box's own threads and those on its buttons and texts), on free spots of the map, and on the
// phone's bubble and buttons. A pin's click opens the Comments panel on its thread.
import type { Design, MessageStep, QuestionStep } from '@xdesign/spec'
import { ViewportPortal } from '@xyflow/react'
import { type CSSProperties, type RefObject, useLayoutEffect, useState } from 'react'

import { cn } from '@/lib/utils'

import { useLang } from '../context'
import { buttonElement } from './anchors'
import { type Pin, useCommentStore, usePins } from './store'

/** A thread's number in a round dot; a click opens the panel on it. */
export function PinDot({ pin, className, style }: { pin: Pin; className?: string; style?: CSSProperties }) {
  const store = useCommentStore()
  return (
    <button
      type="button"
      aria-label={`Comment ${String(pin.n)}`}
      style={style}
      className={cn(
        'nodrag pointer-events-auto grid size-5 shrink-0 place-items-center rounded-full rounded-bl-none bg-brand-strong text-caption-2 leading-none font-bold text-on-brand tabular-nums shadow-(--shadow-sm) outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus focus-visible:outline-solid',
        className,
      )}
      onClick={(event) => {
        event.stopPropagation()
        store.show(pin.id)
      }}
    >
      {pin.n}
    </button>
  )
}

/** The pins of a box, down its left edge (BoxOverlay.tsx). */
export function BoxPins({ pins }: { pins: readonly Pin[] }) {
  return (
    <div className="pointer-events-none absolute -start-2.5 top-2 flex flex-col gap-1">
      {pins.map((pin) => (
        <PinDot key={pin.id} pin={pin} />
      ))}
    </div>
  )
}

/** The pins on free spots of the map, in map coordinates (inside React Flow). */
export function MapSpotPins() {
  const { onMap } = usePins()
  if (onMap.length === 0) return null
  return (
    <ViewportPortal>
      {onMap.map((pin) => (
        <div
          key={pin.id}
          className="absolute"
          style={{ transform: `translate(${String(pin.anchor.x)}px, ${String(pin.anchor.y - 20)}px)` }}
        >
          <PinDot pin={pin} />
        </div>
      ))}
    </ViewportPortal>
  )
}

type Placed = { pin: Pin; left: number; top: number }

/**
 * The pins over the phone (its preview is a shadow root): on the bubble the threads on the step and
 * on its text in the language shown, on each button its own; placed again when the phone or the
 * chat inside it changes. `box` is the element around the phone, positioned.
 */
export function PhonePins({
  box,
  design,
  step,
}: {
  box: RefObject<HTMLDivElement | null>
  design: Design
  step: MessageStep | QuestionStep
}) {
  const lang = useLang()
  const pins = usePins().byStep.get(step.id)
  const [placed, setPlaced] = useState<readonly Placed[]>([])
  useLayoutEffect(() => {
    const element = box.current
    if (!element) return
    let frame = 0
    // The preview's shadow root, watched once it is there (the phone draws after its size is known).
    let watched: ShadowRoot | null = null
    const place = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const root = element.querySelector('[data-preview-frame]')?.shadowRoot ?? null
        if (root && root !== watched) {
          watched = root
          changed.observe(root, { subtree: true, childList: true, characterData: true })
          root.addEventListener('scroll', place, true)
        }
        if (!root || !pins) {
          setPlaced([])
          return
        }
        const around = element.getBoundingClientRect()
        const counts = new Map<Element, number>()
        const next: Placed[] = []
        for (const pin of pins) {
          const { anchor } = pin
          const on =
            anchor.on === 'button'
              ? buttonElement(root, design, step, anchor.buttonId)
              : anchor.on === 'step' || (anchor.on === 'text' && anchor.lang === lang)
                ? root.querySelector('.tg-bubble')
                : null
          if (!on) continue
          const rect = on.getBoundingClientRect()
          const count = counts.get(on) ?? 0
          counts.set(on, count + 1)
          next.push({ pin, left: rect.right - around.left - 10 - count * 22, top: rect.top - around.top - 10 })
        }
        setPlaced(next)
      })
    }
    const changed = new MutationObserver(place)
    changed.observe(element, { subtree: true, childList: true })
    const resized = new ResizeObserver(place)
    resized.observe(element)
    place()
    return () => {
      cancelAnimationFrame(frame)
      resized.disconnect()
      changed.disconnect()
      watched?.removeEventListener('scroll', place, true)
    }
  }, [box, design, step, pins, lang])
  return (
    <>
      {placed.map(({ pin, left, top }) => (
        <PinDot key={pin.id} pin={pin} className="absolute z-10" style={{ left, top }} />
      ))}
    </>
  )
}
