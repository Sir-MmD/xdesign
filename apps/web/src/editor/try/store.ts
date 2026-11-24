// Try it (docs/plan/04 section 8): whether the phone is in Try it, the test user and the states of
// the conversation so far, kept in one store like the selection (Editor.tsx provides it). The
// engine is TRY-01's createSim: every action returns a new state, so "Step back" drops the last.
import { createSim, defaultSimUser, type Design, type Sim, type SimState, type SimTestUser } from '@xdesign/spec'
import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'

import { useMediaQuery } from '@/lib/useMediaQuery'

import { useDesign } from '../context'

export interface TrySession {
  /** The phone is a Telegram chat driven by the engine; the editing tools are dimmed. */
  open: boolean
  /** The tester: language, test switches, built-in values; null until Try it first opens. */
  user: SimTestUser | null
  /** The states so far, the first the empty chat; the last is shown. */
  history: readonly SimState[]
  /** Messages held back by a delay or a chat action go out at once. */
  skipWaits: boolean
}

const closed: TrySession = { open: false, user: null, history: [], skipWaits: false }

export class TryStore {
  private session = closed
  private readonly listeners = new Set<() => void>()

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  get = (): TrySession => this.session

  /** The state shown now (the empty chat before a start). */
  now = (): SimState | undefined => this.session.history.at(-1)

  /**
   * Opens Try it on the empty chat, or runs from a step (a start point, or the selected step for
   * Ctrl+Enter). The test user stays from the last try, else the design's with the language shown.
   */
  open(design: Design, lang: string, from?: string): void {
    const user = this.session.user ?? { ...defaultSimUser(design), language: lang }
    const sim = createSim(design, user)
    const history = from === undefined ? [sim.initial] : [sim.initial, sim.start(sim.initial, { step: from })]
    this.replaceSession({ ...this.session, open: true, user, history })
  }

  /** "Stop trying": the phone shows the selected step again; the test user is kept. */
  stop(): void {
    if (this.session.open) this.replaceSession({ ...this.session, open: false, history: [] })
  }

  /** A tester's action: a new state goes on the history (the same one is nothing). */
  push(next: SimState): void {
    const { history } = this.session
    if (next === history.at(-1)) return
    this.replaceSession({ ...this.session, history: [...history, next] })
  }

  /** What follows by itself (a delay over, a toast gone): the shown state changes, not the history. */
  replace(next: SimState): void {
    const { history } = this.session
    if (next === history.at(-1) || history.length === 0) return
    this.replaceSession({ ...this.session, history: [...history.slice(0, -1), next] })
  }

  /** "Step back": the state before the last action. */
  back(): void {
    const { history } = this.session
    if (history.length > 1) this.replaceSession({ ...this.session, history: history.slice(0, -1) })
  }

  /** "Restart": the empty chat again, or a new run from a start point. */
  restart(sim: Sim, from?: string): void {
    const history = from === undefined ? [sim.initial] : [sim.initial, sim.start(sim.initial, { step: from })]
    this.replaceSession({ ...this.session, history })
  }

  /** A change of the test user; `vars` set by it (a built-in) go into the shown state too. */
  setUser(user: SimTestUser, vars?: SimState['vars']): void {
    const { history } = this.session
    const top = history.at(-1)
    const next = top && vars ? [...history.slice(0, -1), { ...top, vars: { ...top.vars, ...vars } }] : history
    this.replaceSession({ ...this.session, user, history: next })
  }

  setSkipWaits(skipWaits: boolean): void {
    this.replaceSession({ ...this.session, skipWaits })
  }

  private replaceSession(next: TrySession): void {
    this.session = next
    for (const listener of this.listeners) listener()
  }
}

export const TryContext = createContext<TryStore | null>(null)

/** The Try it store, to act: `useTryStore().push(sim.pressReply(state, id))`. */
export function useTryStore(): TryStore {
  const store = useContext(TryContext)
  if (!store) throw new Error('useTryStore needs the editor (src/editor/Editor.tsx)')
  return store
}

/** A part of the session, re-rendering only when it changes: `useTry((s) => s.open)`. */
export function useTry<T>(pick: (session: TrySession) => T): T {
  const store = useTryStore()
  return useSyncExternalStore(store.subscribe, () => pick(store.get()))
}

/** The engine for the live design and the test user (a new one after either changes). */
export function useSim(): Sim {
  const design = useDesign()
  const user = useTry((session) => session.user)
  return useMemo(() => createSim(design, user ?? defaultSimUser(design)), [design, user])
}

/** Whether the test user panel has its own column beside the phone; narrower, it opens as a sheet. */
export function usePanelBeside(): boolean {
  return useMediaQuery('(width >= 1280px)')
}
