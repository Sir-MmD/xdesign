// The map's Lines switch (docs/plan/18 section 5.3, MAP-11): "Short tags" (the default) draws far
// lines as short tags at their dots (lines.ts), "All lines" every line across the map. The choice
// is the person's (`mapLines` of `PATCH /api/me`, as the theme is, 17 section 8), so it follows
// them to every device; a view-only link's page has no person: it starts with "Short tags" and
// keeps a change only while it is open.
import { useQueryClient } from '@tanstack/react-query'
import { type MapLinesView, routes } from '@xdesign/api'
import { useContext, useState } from 'react'
import { toast } from 'sonner'

import { apiQuery, useApiMutation } from '@/api/client'
import { SessionContext } from '@/app/session'

/** The map's lines view and the switch's change: shown at once, saved for the signed-in person. */
export function useLinesView(): [MapLinesView, (view: MapLinesView) => void] {
  // Undefined on a view-only link's page, outside the signed-in layouts.
  const me = useContext(SessionContext)
  const queryClient = useQueryClient()
  // The choice made on this map, shown until it closes; else the person's saved one.
  const [chosen, setChosen] = useState<MapLinesView | null>(null)
  const save = useApiMutation(routes.updateMe, {
    onSuccess: ({ user }) => {
      // The other fields of the session's answer (the mode, the desktop app's port) stay as they are.
      queryClient.setQueryData(apiQuery(routes.me).queryKey, (now) => (now ? { ...now, user } : now))
    },
    onError: (error) => {
      setChosen(null)
      toast.error(error.message)
    },
  })
  const view = chosen ?? me?.mapLines ?? 'short'
  const choose = (next: MapLinesView) => {
    if (next === view) return
    setChosen(next)
    if (me) save.mutate({ body: { mapLines: next } })
  }
  return [view, choose]
}
