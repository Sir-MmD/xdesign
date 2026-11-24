// Opening a design (docs/plan/02 section 4, items 1 to 4): the header and the person's role from
// `GET /api/designs/:id`, then the document with its local copy and live connection (live.ts),
// started once the role is known. It also carries out LIVE-01's endings: lost access closes the
// editor to Designs with the server's sentence, an ended session goes to the sign-in page.
import { WebSocketStatus } from '@hocuspocus/provider'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { hasRole, routes } from '@xdesign/api'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'

import { apiKey, apiQuery, useApi } from '@/api/client'
import { useMe } from '@/app/session'

import { LiveDesign, type LiveState } from './live'

/** The top bar's save state (04 section 4.1); null while the first connection is still opening. */
export type SaveState = 'saved' | 'saving' | 'offline' | 'readOnly' | 'reconnecting' | null

export const saveStateTexts = {
  saved: 'Saved',
  saving: 'Saving...',
  offline: 'Offline, your changes are kept on this computer',
  readOnly: 'Read only',
  reconnecting: 'Reconnecting...',
} as const satisfies Record<NonNullable<SaveState>, string>

export function saveStateOf(state: LiveState, canEdit: boolean): SaveState {
  if (!canEdit || state.scope === 'readonly') return 'readOnly'
  if (!state.online || state.problem === 'tooBig') return 'offline'
  if (state.status !== WebSocketStatus.Connected || !state.synced) {
    return state.wasConnected || state.status === WebSocketStatus.Disconnected ? 'reconnecting' : null
  }
  return state.unsynced > 0 ? 'saving' : 'saved'
}

export function useDesignDoc(designId: string) {
  const me = useMe()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const header = useApi(routes.design, { params: { id: designId } })
  // One document per design and person; the route remounts the editor for another design.
  const [live] = useState(() => new LiveDesign(designId, { userId: me.id }))
  const role = header.data?.role
  const canEdit = role === undefined ? undefined : hasRole(role, 'editor')

  useEffect(() => {
    if (canEdit === undefined) return
    live.start(canEdit)
    return () => {
      live.stop()
    }
  }, [live, canEdit])

  useEffect(() => {
    live.setPresence({ user: { id: me.id, name: me.name, color: me.color } })
  }, [live, me.id, me.name, me.color])

  const state = useSyncExternalStore(live.subscribe, live.getState)

  // The server changed the person's role: read it again (the Share and rename buttons follow it).
  const { roleChanges } = state
  useEffect(() => {
    if (roleChanges === 0) return
    void queryClient.invalidateQueries({ queryKey: apiKey(routes.design, { params: { id: designId } }) })
  }, [queryClient, designId, roleChanges])

  const { end } = state
  useEffect(() => {
    if (!end) return
    if (end.kind === 'noAccess') {
      // A person who could edit may have offline changes in this browser: the editor offers them
      // for download first (LostAccess.tsx).
      if (canEdit === true && live.getState().design) return
      toast.error(end.message)
      void navigate({ to: '/', replace: true })
      return
    }
    // A 401 from `GET /api/me` sends the person to sign in (app/session.ts); a session that is
    // still there after all connects again.
    queryClient.query({ ...apiQuery(routes.me), staleTime: 0 }).then(
      () => {
        live.reconnect()
      },
      () => undefined,
    )
  }, [end, live, navigate, queryClient, canEdit])

  // A socket that does not come back may mean the session ended (the upgrade answers 401): ask
  // `GET /api/me` again, at most every 30 seconds.
  const down = state.status === WebSocketStatus.Disconnected && state.online
  useEffect(() => {
    if (!down) return
    void queryClient.query({ ...apiQuery(routes.me), staleTime: 30_000 }).catch(() => undefined)
  }, [down, queryClient])

  return {
    header,
    live,
    state,
    saveState: canEdit === undefined ? null : saveStateOf(state, canEdit),
  }
}
