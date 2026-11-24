// Changes of a person's access that open live connections must follow at once (docs/plan/05
// section 1 item 5): sessions ended, disabled or removed (here), a role on a design changed
// (AUTH-02). Live editing (LIVE-01) listens and closes or downgrades the person's connections.
import { log } from '../log.ts'

export interface AccessChange {
  userId: string
  // Why, for the listener's log: the person was disabled or removed, some or all of their
  // sessions ended (sign out, reset, a new password), or their role on a design changed.
  reason: 'disabled' | 'removed' | 'sessionsEnded' | 'designRole'
  // The design whose role changed; for the other reasons every design.
  designId?: string
}

// Listeners check the person's sessions (findSessionUser) and roles (getDesignRole) again.
export type AccessListener = (change: AccessChange) => void

const listeners = new Set<AccessListener>()

// Adds a listener; the function it returns removes it again.
export function onUserAccessChanged(listener: AccessListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitUserAccessChanged(change: AccessChange): void {
  for (const listener of listeners) {
    try {
      listener(change)
    } catch (error) {
      log.error({ err: error, change }, 'an access listener failed')
    }
  }
}
