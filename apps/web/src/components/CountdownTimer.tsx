import { useEffect, useEffectEvent, useSyncExternalStore } from 'react'

import { cn } from '@/lib/utils'

// Copied from xWriter's web/src/components/CountdownTimer.tsx with its shared clock
// (lib/useNow.ts) and its formats (lib/time.ts), cut to minutes and seconds: xDesign counts down
// only the two-factor steps (5 and 15 minutes, docs/plan/17 section 7).

const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | undefined

/** One interval ticks every second while any countdown listens. */
function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  timer ??= setInterval(() => {
    for (const notify of listeners) notify()
  }, 1000)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer !== undefined) {
      clearInterval(timer)
      timer = undefined
    }
  }
}

/** Whole seconds left until `target`, rounded up, never negative: two minutes start at 2:00. */
function useSecondsLeft(target: number): number {
  return useSyncExternalStore(subscribe, () => Math.max(0, Math.ceil((target - Date.now()) / 1000)))
}

/** The spoken form for screen readers: "4 minutes 12 seconds". */
function describeSeconds(total: number): string {
  const parts: [number, string][] = [
    [Math.floor(total / 60), 'minute'],
    [total % 60, 'second'],
  ]
  const words = parts.filter(([n]) => n > 0).map(([n, unit]) => `${String(n)} ${unit}${n === 1 ? '' : 's'}`)
  return words.length === 0 ? '0 seconds' : words.join(' ')
}

export interface CountdownTimerProps {
  /** When the countdown reaches zero (milliseconds since the epoch). */
  until: number
  /** Called once when the countdown reaches zero (also when it is already over at mount). */
  onExpire?: () => void
  className?: string
}

/**
 * Time left until `until` as "4:12". Screen readers get the duration in words; the timer role
 * keeps them from announcing every second.
 */
export function CountdownTimer({ until, onExpire, className }: CountdownTimerProps) {
  const left = useSecondsLeft(until)
  const expired = left === 0
  const notifyExpired = useEffectEvent(() => {
    onExpire?.()
  })

  useEffect(() => {
    if (expired) notifyExpired()
  }, [expired, until])

  return (
    <span role="timer" data-expired={expired || undefined} className={cn('font-mono tabular-nums', className)}>
      <span aria-hidden>{`${String(Math.floor(left / 60))}:${String(left % 60).padStart(2, '0')}`}</span>
      <span className="sr-only">{describeSeconds(left)}</span>
    </span>
  )
}
