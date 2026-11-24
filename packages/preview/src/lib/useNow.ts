// A shared clock for live times (relative times, countdowns), copied from xWriter's
// web/src/lib/useNow.ts (its useNow only). One interval ticks every second while any
// component listens; each component re-renders only when the current time crosses its own
// granularity, so a table of relative times does not re-render every second.
import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | undefined

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

/** The current time in milliseconds, rounded down to `granularityMs`, updated while mounted. */
export function useNow(granularityMs = 1000): number {
  // Rounding keeps the snapshot equal between ticks inside one granularity step, which is
  // what useSyncExternalStore needs to skip re-renders.
  return useSyncExternalStore(subscribe, () => Math.floor(Date.now() / granularityMs) * granularityMs)
}
