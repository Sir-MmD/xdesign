// The drag of a bottom sheet (docs/plan/35-owner-list-2026-11-04.md section 12.2, APL-02): under 760 px every dialog,
// alert dialog and right sheet is a bottom sheet, and so is every bottom sheet at any width; wherever its grab handle
// shows, a finger can pull it down, as the platform's sheets are swiped away. Pulled down from the top of its content
// (or by the handle, with a mouse or a pen) it follows the finger one to one; let go, it closes past a quarter of its
// height or with a flick down and springs back otherwise, the finger's speed carried into the spring (springCurve of
// app/motion.ts) so no seam shows between the drag and the motion. A finger that catches it while it springs back or
// slides in holds it where it is drawn. A dialog that a tap beside it keeps open (unsaved changes,
// disablePointerDismissal) resists with a rubber band and springs back. A drag never starts on a field, a slider or
// anything that handles its own touches (its touch-action), nor inside a list that is scrolled away from its top, and a
// move up or sideways stays the page's scroll. Under Reduced and Off the sheet still follows the finger, which moves it
// itself, and then only fades away where the finger left it or is back at its place at once.
import { useEffect, useEffectEvent, useState } from 'react'

import { motionStill, springCurve, springs } from '@/app/motion'

/** A let-go moving down faster than this (px per second) closes the sheet, wherever it is. */
const closeSpeed = 400
/** A let-go moving up faster than this (px per second) springs it back, wherever it is (the speed's sign decides). */
const backSpeed = 100
/** Past this share of its height a slower let-go closes it. */
const closeShare = 0.25
/** The finger's samples of the last 100 ms give its speed at the let-go. */
const sampleMs = 100
/** How hard a sheet that may not close resists, the platform's rubber band. */
const resistance = 0.55
/**
 * How far a finger moves before its direction is told: 2 px, well before the browser starts a scroll (about 10 px)
 * that a script can no longer stop; in a row that scrolls sideways 6 px, so the row's own swipe is told apart.
 */
const directionPx = 2
const sidewaysPx = 6

/** What handles its own touches: a field, a slider. */
const ownGestures = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"]'

export interface SheetDragOptions {
  /** Whether a drag may close the sheet; false for a dialog that a tap beside it keeps open: it resists instead. */
  dismissible: boolean
  /** Closes the dialog as its close button does; the dialog may stay open (a run that is still busy). */
  close: () => void
}

/**
 * Lets the sheet whose popup gets the returned ref be pulled down (above). The popup's grab handle
 * (`[data-slot="sheet-grab"]`, its child) marks where it is a sheet: while the handle is hidden (a dialog on a
 * computer, a full-screen dialog on a phone) the popup does not move.
 */
export function useSheetDrag({ dismissible, close }: SheetDragOptions): (popup: HTMLElement | null) => void {
  const [sheet, setSheet] = useState<HTMLElement | null>(null)
  const mayClose = useEffectEvent(() => dismissible)
  const closeSheet = useEffectEvent(() => {
    close()
  })
  useEffect(() => {
    if (sheet === null) return
    return followFinger(sheet, {
      mayClose: () => mayClose(),
      close: () => {
        closeSheet()
      },
    })
  }, [sheet])
  return setSheet
}

interface DragHooks {
  mayClose: () => boolean
  close: () => void
}

/**
 * Whether a node between the touch and the sheet handles its own touches (a field, a slider, a touch-action); the
 * sheet's own handle (touch-action none, so a touch on it never scrolls) is the sheet's.
 */
function ownsGesture(target: Element, sheet: HTMLElement): boolean {
  if (target.closest(ownGestures)) return true
  for (let node: Element | null = target; node !== null && node !== sheet; node = node.parentElement) {
    if (node.parentElement === sheet && node.matches('[data-slot="sheet-grab"]')) continue
    const action = getComputedStyle(node).touchAction
    if (action !== 'auto' && action !== 'manipulation' && !action.includes('pan-y')) return true
  }
  return false
}

/** Whether a list between the touch and the sheet is scrolled away from its top, so a move down scrolls it. */
function scrolledWithin(target: EventTarget | null, sheet: HTMLElement): boolean {
  let node = target instanceof Element ? target : null
  for (; node !== null && node !== sheet; node = node.parentElement) {
    if (node.scrollTop > 0 && node.scrollHeight > node.clientHeight) return true
  }
  return false
}

/** Whether the touch is in a row that scrolls sideways (chips, a strip of pictures). */
function inSidewaysRow(target: Element, sheet: HTMLElement): boolean {
  for (let node: Element | null = target; node !== null && node !== sheet; node = node.parentElement) {
    if (node.scrollWidth > node.clientWidth && /auto|scroll/.test(getComputedStyle(node).overflowX)) return true
  }
  return false
}

/** Follows the finger on one sheet; returns what stops it. */
function followFinger(sheet: HTMLElement, hooks: DragHooks): () => void {
  let state: 'idle' | 'pending' | 'drag' = 'idle'
  let startX = 0
  let startY = 0
  // In a sideways row the direction is told after sidewaysPx; elsewhere at the first move, before the page scrolls.
  let sideways = false
  // The finger where the drag began, and the sheet's place then in the finger's units (before the rubber band).
  let fingerY = 0
  let from = 0
  // The sheet's offset under its place now, px.
  let offset = 0
  let height = 1
  let resist = false
  let samples: { at: number; y: number }[] = []
  let settle: ReturnType<typeof setTimeout> | undefined
  let pointer: number | undefined

  // The dialog's scrim beside it in the portal, which fades as the sheet goes down.
  const scrim = () => sheet.parentElement?.querySelector<HTMLElement>(':scope > .x-backdrop') ?? null
  const draggable = () => {
    const handle = sheet.querySelector<HTMLElement>(':scope > [data-slot="sheet-grab"]')
    return handle !== null && handle.checkVisibility() && !sheet.hasAttribute('data-closed')
  }
  /** Where the sheet is drawn now, also in the middle of a spring or of its slide in. */
  const drawn = () => {
    const transform = getComputedStyle(sheet).transform
    return transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42
  }
  const rubber = (way: number) => (way * height * resistance) / (height + resistance * way)
  /** The finger's way that the rubber band draws at `shown`. */
  const unrubber = (shown: number) => (shown * height) / (resistance * (height - shown))

  const show = (y: number) => {
    offset = y
    sheet.style.transform = `translateY(${String(y)}px)`
    const dim = scrim()
    if (dim && !resist) dim.style.opacity = String(Math.max(0, 1 - y / height))
  }

  /** The sheet at its place with its own styles, at once: no transition plays on the way. */
  const rest = () => {
    clearTimeout(settle)
    sheet.style.transition = 'none'
    sheet.style.transform = ''
    sheet.style.opacity = ''
    sheet.style.willChange = ''
    const dim = scrim()
    if (dim) {
      dim.style.transition = 'none'
      dim.style.opacity = ''
    }
    // The change lands (a layout read applies it) before the transitions come back.
    sheet.getBoundingClientRect()
    sheet.style.transition = ''
    if (dim) dim.style.transition = ''
  }

  const begin = (y: number) => {
    clearTimeout(settle)
    state = 'drag'
    height = Math.max(sheet.offsetHeight, 1)
    resist = !hooks.mayClose()
    // A sheet that resists is never drawn past its height; the rubber band's way back needs it under that.
    const now = resist ? Math.min(Math.max(drawn(), 0), height * 0.9) : Math.max(drawn(), 0)
    from = resist ? unrubber(now) : now
    fingerY = y
    samples = [{ at: performance.now(), y }]
    // The place follows the finger from where it is drawn; an opening's fade goes on.
    sheet.style.transitionProperty = 'opacity'
    sheet.style.willChange = 'transform'
    const dim = scrim()
    if (dim) dim.style.transitionProperty = 'none'
    show(now)
  }

  const move = (y: number) => {
    const at = performance.now()
    samples.push({ at, y })
    while (samples.length > 2 && at - (samples[0]?.at ?? at) > sampleMs) samples.shift()
    const way = from + y - fingerY
    show(way <= 0 ? 0 : resist ? rubber(way) : way)
  }

  /** The finger's speed over its last 100 ms, px per second, positive downward; 0 when it rested before it let go. */
  const speed = () => {
    const at = performance.now()
    const recent = samples.filter((sample) => at - sample.at <= sampleMs)
    const first = recent[0]
    const last = recent.at(-1)
    if (first === undefined || last === undefined || last.at - first.at < 1) return 0
    return ((last.y - first.y) / (last.at - first.at)) * 1000
  }

  /** Springs the sheet back to its place from where it is drawn, with the finger's speed toward it. */
  const back = (velocity: number) => {
    const at = drawn()
    if (at <= 0.5 || motionStill()) {
      rest()
      return
    }
    // No faster than the spring would swing past its place: a sheet held to the bottom edge would show a gap under it.
    const toward = Math.min(Math.max(-velocity, 0) / at, (2 * Math.PI) / springs.smooth.response)
    const curve = springCurve(springs.smooth, toward)
    const timing = `${String(curve.duration)}ms ${curve.easing}`
    sheet.style.transition = `transform ${timing}`
    sheet.style.transform = 'translateY(0px)'
    const dim = scrim()
    if (dim) {
      dim.style.transition = `opacity ${timing}`
      dim.style.opacity = ''
    }
    settle = setTimeout(rest, curve.duration + 50)
  }

  /** Slides the sheet away with the finger's speed and closes its dialog; one that stays open springs back. */
  const leave = (velocity: number) => {
    sheet.style.willChange = ''
    if (motionStill()) {
      // Reduced fades it where the finger left it, Off closes it at once.
      sheet.style.transitionProperty = 'opacity'
    } else {
      const curve = springCurve(springs.smooth, Math.max(velocity, 0) / Math.max(height - offset, 1))
      sheet.style.transition = `transform ${String(curve.duration)}ms ${curve.easing}`
      sheet.style.transform = 'translateY(100%)'
      // It slides away whole while the scrim fades with the dialog's own ending.
      sheet.style.opacity = '1'
    }
    hooks.close()
    requestAnimationFrame(() => {
      if (!sheet.isConnected) return
      if (sheet.hasAttribute('data-closed')) {
        const dim = scrim()
        if (dim) {
          dim.style.transitionProperty = ''
          dim.style.opacity = ''
        }
        return
      }
      sheet.style.opacity = ''
      back(0)
    })
  }

  const release = (cancelled: boolean) => {
    if (state !== 'drag') {
      state = 'idle'
      return
    }
    state = 'idle'
    const velocity = cancelled ? 0 : speed()
    const closing =
      !cancelled &&
      !resist &&
      offset > 0 &&
      velocity > -backSpeed &&
      (velocity > closeSpeed || offset > height * closeShare)
    if (closing) leave(velocity)
    else back(velocity)
  }

  const onTouchStart = (event: TouchEvent) => {
    if (state === 'drag') {
      // A second finger: the sheet goes back to its place.
      release(true)
      return
    }
    state = 'idle'
    const touch = event.touches[0]
    const target = event.target
    if (event.touches.length !== 1 || touch === undefined || !(target instanceof Element) || !draggable()) return
    if (ownsGesture(target, sheet)) return
    startX = touch.clientX
    startY = touch.clientY
    sideways = inSidewaysRow(target, sheet)
    state = 'pending'
  }

  const onTouchMove = (event: TouchEvent) => {
    if (state === 'idle') return
    const touch = event.touches[0]
    if (touch === undefined) return
    if (state === 'pending') {
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      if (Math.max(Math.abs(dx), Math.abs(dy)) < (sideways ? sidewaysPx : directionPx)) return
      // Down from the top only: up, sideways or inside a list scrolled away from its top is the page's scroll.
      if (
        dy < 0 ||
        Math.abs(dx) > dy ||
        !event.cancelable ||
        sheet.scrollTop > 0 ||
        scrolledWithin(event.target, sheet)
      ) {
        state = 'idle'
        return
      }
      begin(touch.clientY)
    }
    event.preventDefault()
    move(touch.clientY)
  }

  const onTouchEnd = (event: TouchEvent) => {
    if (event.touches.length > 0) return
    release(false)
  }

  const onTouchCancel = () => {
    release(true)
  }

  // A mouse or a pen drags the sheet by its handle.
  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'touch' || event.button !== 0 || !(event.target instanceof Element)) return
    const handle = event.target.closest('[data-slot="sheet-grab"]')
    if (handle?.parentElement !== sheet || !draggable()) return
    event.preventDefault()
    pointer = event.pointerId
    sheet.setPointerCapture(event.pointerId)
    begin(event.clientY)
  }

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId === pointer && state === 'drag') move(event.clientY)
  }

  const onPointerEnd = (event: PointerEvent) => {
    if (event.pointerId !== pointer) return
    pointer = undefined
    release(event.type === 'pointercancel')
  }

  sheet.addEventListener('touchstart', onTouchStart, { passive: true })
  sheet.addEventListener('touchmove', onTouchMove, { passive: false })
  sheet.addEventListener('touchend', onTouchEnd)
  sheet.addEventListener('touchcancel', onTouchCancel)
  sheet.addEventListener('pointerdown', onPointerDown)
  sheet.addEventListener('pointermove', onPointerMove)
  sheet.addEventListener('pointerup', onPointerEnd)
  sheet.addEventListener('pointercancel', onPointerEnd)
  return () => {
    clearTimeout(settle)
    sheet.removeEventListener('touchstart', onTouchStart)
    sheet.removeEventListener('touchmove', onTouchMove)
    sheet.removeEventListener('touchend', onTouchEnd)
    sheet.removeEventListener('touchcancel', onTouchCancel)
    sheet.removeEventListener('pointerdown', onPointerDown)
    sheet.removeEventListener('pointermove', onPointerMove)
    sheet.removeEventListener('pointerup', onPointerEnd)
    sheet.removeEventListener('pointercancel', onPointerEnd)
  }
}
