import { WebSocketStatus } from '@hocuspocus/provider'
import { useQueryClient } from '@tanstack/react-query'
import { routes, type viewedDesign } from '@xdesign/api'
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { z } from 'zod'

import { type ApiError, apiQuery, NETWORK_ERROR, useApi } from '@/api/client'
import { AuthCard, AuthFrame } from '@/auth/AuthFrame'
import { FormProblem } from '@/components/forms'
import { Skeleton } from '@/components/ui/skeleton'
import { useDesign } from '@/editor/context'
import { EditorFrame } from '@/editor/Editor'
import { linkGone, LiveDesign } from '@/editor/live'
import { ExportButton } from '@/editor/topbar/ExportButton'
import { LanguageSwitch } from '@/editor/topbar/LanguageSwitch'
import { LookSwitch } from '@/editor/topbar/LookSwitch'
import { SaveStateText } from '@/editor/topbar/SaveStateText'
import { TryItButton } from '@/editor/topbar/TryItButton'
import { type SaveState, saveStateOf } from '@/editor/useDesignDoc'

type Viewed = z.output<typeof viewedDesign>

/** A refusal of the link (it was revoked or expired), not a server that could not be reached. */
function refused(error: ApiError): boolean {
  return error.code !== NETWORK_ERROR && error.status >= 400 && error.status < 500 && error.status !== 429
}

/**
 * The page of a view-only link (docs/plan/05 section 8, 04 section 15), with no account: the
 * design's header from the link, then the design live and read-only through the link's token in
 * the editor's frame, as a Viewer on the Map tab: the map, the phone, "Try it", the language and
 * look switches and "Export". No presence, Share, palette, comments or history, and no name but
 * the design owner's. A link that was revoked or expired, before or while the page is open, says
 * "This link no longer works. Ask the person who sent it for a new one."
 */
export function ViewPage({ token }: { token: string }) {
  const header = useApi(routes.viewLinkDesign, { params: { token } })
  if (header.error && refused(header.error)) return <Gone message={header.error.message} />
  if (header.data) return <ViewDesign token={token} viewed={header.data.design} />
  return header.isError ? <Gone message={header.error.message} /> : <Waiting name={null} />
}

function ViewDesign({ token, viewed }: { token: string; viewed: Viewed }) {
  const queryClient = useQueryClient()
  const [live] = useState(() => new LiveDesign(viewed.id, { viewToken: token }))

  useEffect(() => {
    live.start(false)
    return () => {
      live.stop()
    }
  }, [live])

  const state = useSyncExternalStore(live.subscribe, live.getState)

  // A socket that does not come back may mean the link stopped working (the upgrade answers 401):
  // ask the link again, at most every 30 seconds; a refusal shows the link's sentence.
  const down = state.status === WebSocketStatus.Disconnected && state.online
  useEffect(() => {
    if (!down) return
    void queryClient
      .query({ ...apiQuery(routes.viewLinkDesign, { params: { token } }), staleTime: 30_000 })
      .catch(() => undefined)
  }, [down, queryClient, token])

  if (state.end) return <Gone message={state.end.kind === 'noAccess' ? state.end.message : linkGone} />
  if (!state.design) return <Waiting name={viewed.name} />
  return (
    <EditorFrame
      designId={viewed.id}
      role="viewer"
      live={live}
      state={state}
      design={state.design}
      lookKey="view"
      tab="map"
      onTab={() => undefined}
      bar={
        <ViewTopBar ownerName={viewed.ownerName} docVersion={viewed.docVersion} saveState={saveStateOf(state, false)} />
      }
    />
  )
}

/**
 * The page's top bar: the design's name (live) and its design owner's, the save state ("Read
 * only"), the language and look switches, "Try it" and "Export".
 */
function ViewTopBar({
  ownerName,
  docVersion,
  saveState,
}: {
  ownerName: string
  docVersion: number
  saveState: SaveState
}) {
  const design = useDesign()
  return (
    <header className="border-b bg-surface pt-[env(safe-area-inset-top,0px)]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
        <ViewTitle name={design.name} ownerName={ownerName} />
        <div className="ms-auto flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
          <SaveStateText state={saveState} />
          <LanguageSwitch />
          <LookSwitch />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TryItButton />
          <ExportButton docVersion={docVersion} />
        </div>
      </div>
    </header>
  )
}

function ViewTitle({ name, ownerName }: { name: string | null; ownerName?: string | undefined }) {
  return (
    <div className="flex min-w-0 items-baseline gap-x-2 px-2">
      {name === null ? (
        <Skeleton className="h-6 w-48" />
      ) : (
        <h1 dir="auto" className="min-w-0 truncate text-headline">
          {name}
        </h1>
      )}
      {ownerName === undefined ? null : (
        <span dir="auto" className="truncate text-subhead text-fg-2">
          {ownerName}
        </span>
      )}
    </div>
  )
}

/** Before the design is here: its name once known and a placeholder. */
function Waiting({ name }: { name: string | null }) {
  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="border-b bg-surface pt-[env(safe-area-inset-top,0px)]">
        <div className="flex min-h-(--topbar-h) items-center gap-3 px-3 py-2">
          <ViewTitle name={name} />
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
        <Skeleton className="h-64 w-full max-w-3xl rounded-2xl" />
      </main>
    </div>
  )
}

/** A link that does not open (or a server that cannot be reached): the reason on the site's card. */
function Gone({ message }: { message: string }) {
  return (
    <AuthFrame>
      <AuthCard title="View-only link" titleId="view-link-title">
        <FormProblem message={message} />
      </AuthCard>
    </AuthFrame>
  )
}
