// Comments in the editor (docs/plan/04 section 15, 05 section 6, CMT-02): comment mode, the
// Comments panel's state, the design's threads (CMT-01's routes) read again at each
// `commentsChanged` notice, and the numbered pins of the open ones. One store per open design,
// in the editor's context (useEditor().comments).
import { useQueryClient } from '@tanstack/react-query'
import { type CommentAnchor, type commentThread, hasRole, routes } from '@xdesign/api'
import type { StepId } from '@xdesign/spec'
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { z } from 'zod'

import { apiKey, useApi } from '@/api/client'

import { useEditor } from '../context'

export type Thread = z.output<typeof commentThread>

export interface CommentsState {
  /** Comment mode (C): a click on a box, a button, the phone or the map starts a thread there. */
  mode: boolean
  /** The Comments panel is open. */
  panel: boolean
  /** Where the thread being written goes; the panel shows its box at the top. */
  draft: CommentAnchor | null
  /** The thread the panel brings into view (a pin's or the bell's click); `n` counts the asks. */
  focus: { id: string; n: number } | null
}

const closed: CommentsState = { mode: false, panel: false, draft: null, focus: null }

export class CommentStore {
  private state = closed
  private readonly listeners = new Set<() => void>()

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  get = (): CommentsState => this.state

  set(patch: Partial<CommentsState>): void {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }

  /** Opens the panel with a new thread's box on the anchor. */
  start(anchor: CommentAnchor): void {
    this.set({ panel: true, draft: anchor })
  }

  /** Opens the panel on a thread. */
  show(id: string): void {
    this.set({ panel: true, focus: { id, n: (this.state.focus?.n ?? 0) + 1 } })
  }
}

export function useCommentStore(): CommentStore {
  return useEditor().comments
}

/** A part of the comments' state, re-rendering only when it changes (as useSelection). */
export function useComments<T>(pick: (state: CommentsState) => T): T {
  const store = useCommentStore()
  return useSyncExternalStore(store.subscribe, () => pick(store.get()))
}

/** Whether the person can write comments: Commenter and above (a Viewer reads them). */
export function useCanComment(): boolean {
  const { role } = useEditor()
  return hasRole(role, 'commenter')
}

/**
 * The design's threads, newest first, and when the person last marked them read; none on the page
 * of a view-only link (04 section 15: no account needed, no comments).
 */
export function useThreads() {
  const { designId, live } = useEditor()
  return useApi(routes.comments, { params: { id: designId } }, { enabled: live.viewToken === null })
}

/**
 * Reads the threads and the bell again at each `commentsChanged` notice of the live connection
 * (Editor.tsx calls it once).
 */
export function useCommentsLive(): void {
  const { designId, live } = useEditor()
  const queryClient = useQueryClient()
  const changes = useSyncExternalStore(live.subscribe, () => live.getState().commentsChanged)
  useEffect(() => {
    if (changes === 0) return
    void queryClient.invalidateQueries({ queryKey: apiKey(routes.comments, { params: { id: designId } }) })
    void queryClient.invalidateQueries({ queryKey: [routes.unreadComments.key] })
  }, [changes, designId, queryClient])
}

/** An open thread's pin: its number (the oldest open thread is 1) and its anchor. */
export type Pin = { id: string; n: number; anchor: CommentAnchor }

/** The pins of the open threads: by step (on the step, a button or a text of it) and on the map. */
export type Pins = {
  all: readonly Pin[]
  byStep: ReadonlyMap<StepId, readonly Pin[]>
  onMap: readonly (Pin & { anchor: { on: 'map' } })[]
}

const noThreads: readonly Thread[] = []

export function usePins(): Pins {
  const threads = useThreads().data?.threads ?? noThreads
  return useMemo(() => {
    const all: Pin[] = threads
      .filter((thread) => thread.resolvedAt === null)
      .reverse()
      .map((thread, index) => ({ id: thread.id, n: index + 1, anchor: thread.anchor }))
    const byStep = new Map<StepId, Pin[]>()
    const onMap: (Pin & { anchor: { on: 'map' } })[] = []
    for (const pin of all) {
      const { anchor } = pin
      if (anchor.on === 'map') onMap.push({ ...pin, anchor })
      else byStep.set(anchor.stepId, [...(byStep.get(anchor.stepId) ?? []), pin])
    }
    return { all, byStep, onMap }
  }, [threads])
}

/** Someone picked from the "@" list. */
export type Mentioned = { id: string; name: string }

/** A comment being written: its text and the people picked from the "@" list. */
export type CommentDraft = { body: string; mentions: readonly Mentioned[] }

export const emptyDraft: CommentDraft = { body: '', mentions: [] }

/** The IDs of the picked people whose "@name" is still in the text, each once. */
export function mentionIds(draft: CommentDraft): string[] {
  return [
    ...new Set(draft.mentions.filter((person) => draft.body.includes(`@${person.name}`)).map((person) => person.id)),
  ]
}
