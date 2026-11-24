// How much the site moves, from xWriter's panel (web/src/app/motion.ts) without its Animations setting: the
// `data-motion` attribute on <html>, `on`, `reduced` (nothing moves, only short fades: a device that asks for less
// motion, prefers-reduced-motion, followed while the page is open) or `off` (everything at once: while the browser
// hides the tab and a moment after it shows it again, so what changed meanwhile is there at once instead of playing all
// together). The design system's CSS reads it (styles/app.css and components.css), so no component needs code for it.
// main.tsx imports this module right after the theme, so the attribute is set before React renders.
import { useSyncExternalStore } from 'react'

/** The levels of the attribute. */
export type Animations = 'on' | 'reduced' | 'off'

/** A device that asks for less motion. */
export const reducedMotionQuery = '(prefers-reduced-motion: reduce)'

/** How long a tab that shows again stays still: past the longest entrance (the smooth spring, 400 ms). */
const settleMs = 800

const root = document.documentElement
const query = window.matchMedia(reducedMotionQuery)
const listeners = new Set<() => void>()
let level: Animations = query.matches ? 'reduced' : 'on'
// The tab is hidden, or it showed again less than settleMs ago.
let still = document.visibilityState === 'hidden'
let settle: ReturnType<typeof setTimeout> | undefined

function apply() {
  const next: Animations = query.matches ? 'reduced' : 'on'
  const attribute = still ? 'off' : next
  if (next === level && root.dataset.motion === attribute) return
  level = next
  root.dataset.motion = attribute
  // useReducedMotion follows the level and useMotionStill the attribute; each re-renders only when its own changes.
  for (const listener of listeners) listener()
}

query.addEventListener('change', apply)
document.addEventListener('visibilitychange', () => {
  clearTimeout(settle)
  if (document.visibilityState === 'hidden') {
    still = true
    apply()
    return
  }
  settle = setTimeout(() => {
    still = false
    apply()
  }, settleMs)
})
apply()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Whether the site moves less right now (Reduced or Off), at the moment of the call. */
export function motionReduced(): boolean {
  return level !== 'on'
}

/**
 * Whether nothing may move right now: Reduced or Off, and also a hidden tab and the moment after it shows again (the
 * attribute's own level), for scripted motion that would otherwise play late.
 */
export function motionStill(): boolean {
  return root.dataset.motion !== 'on'
}

/** Whether the site moves less (Reduced or Off), for the motion that scripts draw instead of the CSS: drag and drop. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, motionReduced)
}

/** Whether nothing may move right now (motionStill), for what a script animates from a render. */
export function useMotionStill(): boolean {
  return useSyncExternalStore(subscribe, motionStill)
}

/**
 * The springs (styles/app.css): how fast each one reaches its place (`response`, seconds) and how much it swings past
 * it (`damping`, 1 for none). The CSS tokens `--ease-quick`, `--ease-smooth` and `--ease-soft` are these three from rest.
 */
export const springs = {
  quick: { response: 0.2, damping: 1 },
  smooth: { response: 0.3, damping: 1 },
  soft: { response: 0.4, damping: 1 },
} as const

/** A spring for springCurve. */
export interface Spring {
  /** How fast it reaches its place, in seconds (a spring has no fixed length; it settles when it is there). */
  response: number
  /** 1 reaches its place without swinging past it; below 1 it swings past and back, the lower the more. */
  damping: number
}

/** A spring as a transition: its CSS `linear()` curve and the milliseconds it settles in. */
export interface SpringCurve {
  easing: string
  duration: number
}

/** A number of a `linear()` curve: three decimals at most, no trailing zeros. */
const curvePoint = (value: number) => String(Math.round(value * 1000) / 1000)

/**
 * A spring as a transition that starts with a speed: a sheet the finger lets go of, which carries the finger's speed
 * on, so no seam shows between the drag and the motion. `velocity` is the speed at the start as a share of the way per
 * second: the finger's pixels per second over the pixels left to go, positive toward the target. The curve is the
 * spring's way from 0 to 1, sampled every 1/60 s until less than `rest` of the way is left and it barely moves; run it
 * as a CSS transition from where the element is, which the browser can stop and turn back from where it is. Under
 * Reduced and Off a script moves nothing and needs none of this (motionStill).
 */
export function springCurve(spring: Spring, velocity = 0, rest = 0.001): SpringCurve {
  const omega = (2 * Math.PI) / spring.response
  const zeta = Math.min(Math.max(spring.damping, 0.1), 1)
  // The distance left at time t, from -1 (all of it) with the starting speed (the way's share per second).
  let left: (t: number) => number
  if (zeta < 1) {
    const wave = omega * Math.sqrt(1 - zeta * zeta)
    const b = (velocity - zeta * omega) / wave
    left = (t) => Math.exp(-zeta * omega * t) * (-Math.cos(wave * t) + b * Math.sin(wave * t))
  } else {
    const b = velocity - omega
    left = (t) => (-1 + b * t) * Math.exp(-omega * t)
  }
  const step = 1 / 60
  // Settled once every later frame is within `rest` of the place; two seconds at most.
  let frames = 1
  for (let frame = 1; frame <= 120; frame++) if (Math.abs(left(frame * step)) >= rest) frames = frame + 1
  const points = ['0']
  for (let frame = 1; frame < frames; frame++) points.push(curvePoint(1 + left(frame * step)))
  points.push('1')
  return { easing: `linear(${points.join(', ')})`, duration: Math.round(frames * step * 1000) }
}
