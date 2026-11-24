// Whether xDesign was updated while this tab was open, for the reload banner (docs/plan/07
// section 6.2 step 4): the server reports another version than this tab's code (`webVersion`,
// stamped by the build) from a `/api/health` poll (ReloadBanner) or the live connection's
// `serverVersion` message, or a design's document has a newer layout than this code knows (the
// editor calls noteServerVersion and noteOutdated). One banner for the whole site.
import { useSyncExternalStore } from 'react'

import { webVersion } from './version'

let outdated = false
const listeners = new Set<() => void>()

function markOutdated(): void {
  if (outdated) return
  outdated = true
  for (const listener of listeners) listener()
}

/** Notes a version the server reported. */
export function noteServerVersion(version: string): void {
  if (version !== webVersion) markOutdated()
}

/** Notes that the server holds something newer than this tab's code knows. */
export function noteOutdated(): void {
  markOutdated()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** True once xDesign was updated since this tab loaded its code. */
export function useOutdated(): boolean {
  return useSyncExternalStore(subscribe, () => outdated)
}
