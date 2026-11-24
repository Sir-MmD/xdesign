// One open design in this tab (docs/plan/02 section 4, LIVE-01's protocol): the Yjs document, its
// copy in IndexedDB (y-indexeddb, one database per design and person), the Hocuspocus connection
// to /live as `design:<id>`, the person's presence (awareness) and undo manager, and the plain
// model read through SPEC-04's watchDesign. React reads its state with useSyncExternalStore
// (useDesignDoc.ts); nothing here imports React.
import { HocuspocusProvider, WebSocketStatus } from '@hocuspocus/provider'
import { type Design, designUndoManager, hasDesign, LAYOUT, layoutOf, migrate, tidy, watchDesign } from '@xdesign/spec'
import { clearDocument, IndexeddbPersistence } from 'y-indexeddb'
import type { Awareness } from 'y-protocols/awareness'
import * as Y from 'yjs'

import { socketUrl } from '@/lib/base'

/** What each person publishes in the awareness (05 section 4); MAP-02 draws the cursors. */
export interface PresenceState {
  user: { id: string; name: string; color: string }
  /** The step and button they have selected (their color goes around it). */
  step: string | null
  button: string | null
  /** The text they type in (TXT-01 publishes it with the language). */
  text: { id: string; lang: string } | null
  /** Their pointer on the map, in map coordinates (MAP-02 publishes it). */
  cursor: { x: number; y: number } | null
}

/** Another person's tab with the design open: its awareness client and what it publishes. */
export interface Peer extends PresenceState {
  clientId: number
}

/**
 * Why the connection stopped or waits, from LIVE-01's reasons: `busy` (tried again shortly),
 * `tooBig` (stopped: a change was refused), `newerLayout` (this build cannot read the design).
 */
export type LiveProblem = 'busy' | 'tooBig' | 'newerLayout' | null

/** The editor must close: the person lost access to the design, or their session ended. */
export type LiveEnd = { kind: 'noAccess'; message: string } | { kind: 'signedOut' } | null

export interface LiveState {
  /** The WebSocket: connecting, connected or disconnected. */
  status: WebSocketStatus
  /** The server's copy is in the document and the connection is authenticated. */
  synced: boolean
  /** The connection was up once (a later drop shows "Reconnecting..."). */
  wasConnected: boolean
  /** Changes sent and not yet acknowledged by the server (0 only after a short calm, so "Saving..." does not flicker). */
  unsynced: number
  /** The connection's scope: 'readonly' for Commenter and Viewer (and right after a role change). */
  scope: 'read-write' | 'readonly' | null
  /** The browser says it is online. */
  online: boolean
  /** The plain model, once the document holds a design (from the local copy or the server). */
  design: Design | undefined
  problem: LiveProblem
  end: LiveEnd
  /** The server's version from its `serverVersion` message. */
  serverVersion: string | null
  /** Counts the role changes the server announced (`role_changed`): the editor reads the role again. */
  roleChanges: number
  /** Counts the server's `commentsChanged` notices (CMT-02): the comments are read again. */
  commentsChanged: number
  /** Counts the restores of a version the server announced (HIST-01's `versionRestored`). */
  restores: number
  /** The current awareness (each connection has its own). */
  awareness: Awareness | null
}

/**
 * Who opens the design: a signed-in person, or the page of a view-only link (VIEW-01) with the
 * link's token, read-only, without a local copy or presence.
 */
export type Opener = { userId: string } | { viewToken: string }

// LIVE-01's close sentence for a design that is no longer the person's.
const accessLost = 'You no longer have access to this design.'
/** VIEW-01: a view-only link that was revoked or expired (the server's close sentence). */
export const linkGone = 'This link no longer works. Ask the person who sent it for a new one.'
// How long to wait before trying again when the server is busy.
const busyRetryMs = 5_000
// How long "Saving..." stays after the server acknowledged the last change.
const savedCalmMs = 600

/** The WebSocket address of the live connection on this site (under its base path); a view link's carries its token. */
function liveUrl(viewToken: string | null): string {
  const url = socketUrl('/live')
  return viewToken === null ? url : `${url}?view=${encodeURIComponent(viewToken)}`
}

export class LiveDesign {
  readonly designId: string
  readonly doc = new Y.Doc()
  /** The origin of this person's changes in this tab: their accessors use it, their undo tracks it. */
  readonly origin: { person: string }
  readonly undoManager: Y.UndoManager
  /** The view-only link's token on its page (VIEW-01), else null. */
  readonly viewToken: string | null

  private readonly userId: string | null
  private provider: HocuspocusProvider | null = null
  private local: IndexeddbPersistence | null = null
  private unwatch: (() => void) | null = null
  private retry: ReturnType<typeof setTimeout> | null = null
  private calm: ReturnType<typeof setTimeout> | null = null
  private tidied = false
  private presence: Omit<PresenceState, 'user'> & { user: PresenceState['user'] | null } = {
    user: null,
    step: null,
    button: null,
    text: null,
    cursor: null,
  }
  private peers: Peer[] = []
  private state: LiveState = {
    status: WebSocketStatus.Connecting,
    synced: false,
    wasConnected: false,
    unsynced: 0,
    scope: null,
    online: navigator.onLine,
    design: undefined,
    problem: null,
    end: null,
    serverVersion: null,
    roleChanges: 0,
    commentsChanged: 0,
    restores: 0,
    awareness: null,
  }
  private readonly listeners = new Set<() => void>()
  private readonly peerListeners = new Set<() => void>()

  constructor(designId: string, opener: Opener) {
    this.designId = designId
    this.userId = 'userId' in opener ? opener.userId : null
    this.viewToken = 'viewToken' in opener ? opener.viewToken : null
    // A view link changes nothing: its origin names nobody.
    this.origin = { person: this.userId ?? '' }
    this.undoManager = designUndoManager(this.doc, this.origin)
  }

  /**
   * Opens the local copy (people who can edit; others have it cleared, as their changes never
   * reach the server) and the connection. `stop` closes both; the document and the undo history
   * stay, so a second start (React's development double mount, a role change) goes on with them.
   * A view link's page keeps no copy and has none to clear.
   */
  start(keepLocal: boolean): void {
    if (this.provider) return
    const localName = this.localName()
    if (localName !== null && keepLocal) {
      try {
        const local = new IndexeddbPersistence(localName, this.doc)
        local.on('synced', () => {
          this.checkLoaded()
        })
        this.local = local
      } catch {
        // No IndexedDB here (a private window may refuse it): the server's copy is enough.
      }
    } else if (localName !== null) {
      try {
        void clearDocument(localName).catch(() => undefined)
      } catch {
        // No IndexedDB here: there is no copy to clear.
      }
    }

    const provider = new HocuspocusProvider({
      url: liveUrl(this.viewToken),
      name: `design:${this.designId}`,
      document: this.doc,
      onStatus: ({ status }) => {
        this.set({
          status,
          wasConnected: this.state.wasConnected || status === WebSocketStatus.Connected,
          ...(status === WebSocketStatus.Connected ? {} : { synced: false }),
        })
      },
      onAuthenticated: ({ scope }) => {
        this.set({ scope, ...(this.state.problem === 'busy' ? { problem: null } : {}) })
      },
      onAuthenticationFailed: ({ reason }) => {
        this.refused(reason)
      },
      onSynced: () => {
        this.set({ synced: true })
        this.afterServerSync()
      },
      onUnsyncedChanges: ({ number }) => {
        this.unsyncedChanges(number)
      },
      onClose: ({ event }) => {
        this.closed(event.reason)
      },
      onStateless: ({ payload }) => {
        this.stateless(payload)
      },
    })
    this.provider = provider
    this.bindAwareness(provider.awareness)
    window.addEventListener('online', this.onOnline)
    window.addEventListener('offline', this.onOnline)
    this.checkLoaded()
  }

  /**
   * After a refused change: throws away this browser's copy (the change in it would be refused
   * again) and loads the page again, so the design comes from the server.
   */
  async discardLocal(): Promise<void> {
    this.stop()
    const localName = this.localName()
    if (localName !== null) await clearDocument(localName).catch(() => undefined)
    window.location.reload()
  }

  stop(): void {
    window.removeEventListener('online', this.onOnline)
    window.removeEventListener('offline', this.onOnline)
    if (this.retry !== null) clearTimeout(this.retry)
    if (this.calm !== null) clearTimeout(this.calm)
    this.retry = null
    this.calm = null
    this.unwatch?.()
    this.unwatch = null
    this.state.awareness?.off('change', this.onPeers)
    this.provider?.destroy()
    this.provider = null
    void this.local?.destroy()
    this.local = null
    this.peers = []
    for (const listener of this.peerListeners) listener()
    this.set({
      status: WebSocketStatus.Disconnected,
      synced: false,
      scope: null,
      unsynced: 0,
      awareness: null,
      // A refused change stays refused; a busy server is asked again at the next start.
      ...(this.state.problem === 'busy' ? { problem: null } : {}),
    })
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getState = (): LiveState => this.state

  /** The other people's tabs with the design open, for usePresence. */
  subscribePeers = (listener: () => void): (() => void) => {
    this.peerListeners.add(listener)
    return () => {
      this.peerListeners.delete(listener)
    }
  }

  getPeers = (): Peer[] => this.peers

  /**
   * Changes what this person publishes (their name and color, selection, text, cursor). Fields
   * others write stay: TipTap's `caret` in the text being typed (TXT-01).
   */
  setPresence(patch: Partial<PresenceState>): void {
    this.presence = { ...this.presence, ...patch }
    const { awareness } = this.state
    if (awareness && this.presence.user) awareness.setLocalState({ ...awareness.getLocalState(), ...this.presence })
  }

  /** After `end` with a session that turned out to be fine: connect again. */
  reconnect(): void {
    this.set({ end: null })
    this.provider?.disconnect()
    void this.provider?.connect().catch(() => undefined)
  }

  // The IndexedDB database of this person's copy; a view link's page has none.
  private localName(): string | null {
    return this.userId === null ? null : `xdesign-${this.designId}-${this.userId}`
  }

  private set(patch: Partial<LiveState>): void {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }

  private unsyncedChanges(number: number): void {
    if (this.calm !== null) clearTimeout(this.calm)
    this.calm = null
    if (number > 0) {
      if (number !== this.state.unsynced) this.set({ unsynced: number })
      return
    }
    this.calm = setTimeout(() => {
      this.calm = null
      this.set({ unsynced: 0 })
    }, savedCalmMs)
  }

  private onOnline = () => {
    this.set({ online: navigator.onLine })
  }

  // The document holds a design: watch it (not when its layout is newer than this build).
  private checkLoaded(): void {
    if (this.unwatch || !hasDesign(this.doc)) return
    if (layoutOf(this.doc) > LAYOUT) {
      this.set({ problem: 'newerLayout' })
      return
    }
    this.unwatch = watchDesign(this.doc, (design) => {
      this.set({ design })
    })
  }

  // After the first sync with the server: a writer brings an older layout up to date and removes
  // orphans, once per opening (03 section 3, rules 4 and 5); neither is undoable.
  private afterServerSync(): void {
    this.checkLoaded()
    if (this.tidied || this.state.scope !== 'read-write' || !hasDesign(this.doc)) return
    if (layoutOf(this.doc) > LAYOUT) return
    this.tidied = true
    migrate(this.doc)
    tidy(this.doc)
  }

  // A document the server would not open (LIVE-01's reasons for onAuthenticate).
  private refused(reason: string): void {
    switch (reason) {
      case 'no_access':
        this.set({ end: { kind: 'noAccess', message: this.viewToken === null ? accessLost : linkGone } })
        break
      case 'not_signed_in':
        this.set({ end: { kind: 'signedOut' } })
        break
      case 'busy':
        this.set({ problem: 'busy' })
        if (this.retry === null) {
          this.retry = setTimeout(() => {
            this.retry = null
            this.provider?.disconnect()
            void this.provider?.connect().catch(() => undefined)
          }, busyRetryMs)
        }
        break
    }
  }

  // A closed document connection or socket: LIVE-01's sentence for lost access (VIEW-01's for a
  // view link that stopped working), `too_big` for a refused change, `role_changed` before the
  // provider connects again with the new scope.
  private closed(reason: string): void {
    if (reason === accessLost || reason === linkGone) {
      this.set({ end: { kind: 'noAccess', message: reason } })
    } else if (reason === 'too_big') {
      // Stop here: the refused change stays in this copy and would be refused again.
      this.provider?.disconnect()
      this.set({ problem: 'tooBig' })
    } else if (reason === 'role_changed') {
      this.set({ scope: 'readonly', roleChanges: this.state.roleChanges + 1 })
    }
  }

  private stateless(payload: string): void {
    let message: unknown
    try {
      message = JSON.parse(payload)
    } catch {
      return
    }
    if (typeof message !== 'object' || message === null) return
    const { type, version } = message as { type?: unknown; version?: unknown }
    if (type === 'serverVersion' && typeof version === 'string') this.set({ serverVersion: version })
    else if (type === 'commentsChanged') this.set({ commentsChanged: this.state.commentsChanged + 1 })
    else if (type === 'versionRestored') this.restored()
  }

  // A version was restored (HIST-01): the change itself came through the document, just before
  // this notice. This person's undo history would bring back what the restore took away, so it
  // starts again; a layout newer than this build (the server was updated since the page loaded)
  // stops here with the reload banner.
  private restored(): void {
    this.undoManager.clear()
    const newer = hasDesign(this.doc) && layoutOf(this.doc) > LAYOUT
    this.set({ restores: this.state.restores + 1, ...(newer ? { problem: 'newerLayout' as const } : {}) })
  }

  private bindAwareness(awareness: Awareness | null): void {
    this.set({ awareness })
    if (!awareness) return
    awareness.on('change', this.onPeers)
    if (this.presence.user) awareness.setLocalState(this.presence)
    this.readPeers()
  }

  // Only other people's changes: this tab's own cursor moves change no peer.
  private onPeers = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
    const own = this.doc.clientID
    if ([...added, ...updated, ...removed].some((clientId) => clientId !== own)) this.readPeers()
  }

  private readPeers(): void {
    const { awareness } = this.state
    const peers: Peer[] = []
    if (awareness) {
      awareness.getStates().forEach((state, clientId) => {
        if (clientId === this.doc.clientID) return
        const shown = state as Partial<PresenceState>
        if (!shown.user) return
        peers.push({
          clientId,
          user: shown.user,
          step: shown.step ?? null,
          button: shown.button ?? null,
          text: shown.text ?? null,
          cursor: shown.cursor ?? null,
        })
      })
    }
    this.peers = peers
    for (const listener of this.peerListeners) listener()
  }
}
