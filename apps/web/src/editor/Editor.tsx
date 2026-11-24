import { Link } from '@tanstack/react-router'
import { type DesignRole, hasRole } from '@xdesign/api'
import { type Design, designEdits } from '@xdesign/spec'
import { ReactFlowProvider } from '@xyflow/react'
import { ChevronLeftIcon } from 'lucide-react'
import { type ReactNode, useEffect, useEffectEvent, useMemo, useState, useSyncExternalStore } from 'react'

import { useMe } from '@/app/session'
import { FormProblem } from '@/components/forms'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ViewOnlyContext } from '@/components/viewOnly'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'

import { Banners } from './Banners'
import { CommentsPanel } from './comments/CommentsPanel'
import { CommentKeys } from './comments/keys'
import { CommentStore, useCommentsLive } from './comments/store'
import { DesignContext, EditorContext, type EditorValue } from './context'
import { History } from './history/History'
import { historyOf } from './history/store'
import { VersionBanner } from './history/VersionBanner'
import type { LiveDesign, LiveState } from './live'
import { LookContext, LookStore } from './look'
import { LostAccess } from './LostAccess'
import { MapPane } from './map/MapPane'
import { PalettePane } from './palette/PalettePane'
import { PhonePane } from './phone/PhonePane'
import { SelectionContext, SelectionStore } from './selection'
import { useUndoKeys } from './shortcuts'
import { BotSetupTab } from './tabs/BotSetupTab'
import { TextsTab } from './tabs/TextsTab'
import { SaveStateText } from './topbar/SaveStateText'
import type { EditorTab } from './topbar/EditorTabs'
import { TopBar } from './topbar/TopBar'
import { TryKeys } from './try/keys'
import { TryContext, TryStore, usePanelBeside } from './try/store'
import { TestUserPanel } from './try/TestUserPanel'
import { TryPhone } from './try/TryPhone'
import { type SaveState, useDesignDoc } from './useDesignDoc'

/**
 * The editor of a design (docs/plan/04 section 4, 02 section 4): the header and role, then the
 * document from the local copy or the server; until it holds the design, the top bar's first
 * part and a placeholder. README.md in this folder lists where the next tasks build.
 */
export function Editor({
  designId,
  tab,
  onTab,
  comment,
  onCommentShown,
}: {
  designId: string
  tab: EditorTab
  onTab: (tab: EditorTab) => void
  /** A thread to show in the Comments panel (the bell's link); `onCommentShown` once it is. */
  comment?: string | undefined
  onCommentShown?: () => void
}) {
  const me = useMe()
  const { header, live, state, saveState } = useDesignDoc(designId)
  if (!header.data) {
    return (
      <Waiting name={null} saveState={null} state={state}>
        {header.isError ? <FormProblem message={header.error.message} /> : null}
      </Waiting>
    )
  }
  if (!state.design) {
    return <Waiting name={header.data.design.name} saveState={saveState} state={state} />
  }
  return (
    <EditorFrame
      designId={designId}
      role={header.data.role}
      live={live}
      state={state}
      design={state.design}
      lookKey={me.id}
      tab={tab}
      onTab={onTab}
      comment={comment}
      onCommentShown={onCommentShown}
      bar={<TopBar saveState={saveState} tab={tab} onTab={onTab} />}
    />
  )
}

/** Before the design is here: "< Designs", the name once known, the save state and a placeholder. */
function Waiting({
  name,
  saveState,
  state,
  children,
}: {
  name: string | null
  saveState: SaveState
  state: LiveState
  children?: ReactNode
}) {
  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="border-b bg-surface pt-[env(safe-area-inset-top,0px)]">
        <div className="flex min-h-(--topbar-h) items-center gap-3 px-3 py-2">
          <Link
            to="/"
            className="flex h-(--control-h-sm) shrink-0 items-center gap-0.5 rounded-md ps-1 pe-2 text-callout font-semibold text-fg-2 hover:bg-surface-2 hover:text-foreground"
          >
            <ChevronLeftIcon aria-hidden className="size-4" />
            Designs
          </Link>
          {name === null ? (
            <Skeleton className="h-6 w-48" />
          ) : (
            <h1 dir="auto" className="min-w-0 truncate text-headline">
              {name}
            </h1>
          )}
          <div className="ms-auto">
            <SaveStateText state={saveState} />
          </div>
        </div>
      </header>
      <Banners state={state} />
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
        {children ?? <Skeleton className="h-64 w-full max-w-3xl rounded-2xl" />}
      </main>
    </div>
  )
}

/**
 * The frame around an open design: the editor's stores and contexts, `bar` (the top bar), the
 * connection's notices and the tab's panes. The page of a view-only link (VIEW-01) uses it too,
 * as a Viewer on the Map tab with a top bar of its own.
 */
export function EditorFrame({
  designId,
  role,
  live,
  state,
  design,
  lookKey,
  tab,
  onTab,
  comment,
  onCommentShown,
  bar,
}: {
  designId: string
  role: DesignRole
  live: LiveDesign
  state: LiveState
  design: Design
  /** Whose phone look this browser remembers: the person's ID (`view` on a view link's page). */
  lookKey: string
  tab: EditorTab
  onTab: (tab: EditorTab) => void
  /** A thread to show in the Comments panel (the bell's link); `onCommentShown` once it is. */
  comment?: string | undefined
  onCommentShown?: (() => void) | undefined
  bar: ReactNode
}) {
  // Under 900 pixels: the map or the phone, read-only (04 section 13).
  const narrow = useMediaQuery('(width < 900px)')
  const [selection] = useState(() => new SelectionStore())
  const [looks] = useState(() => new LookStore(lookKey))
  const [tries] = useState(() => new TryStore())
  const [comments] = useState(() => new CommentStore())
  const trying = useSyncExternalStore(tries.subscribe, () => tries.get().open)
  // HIST-02: a version from history shows read-only in place of now.
  const history = historyOf(live)
  const viewed = useSyncExternalStore(history.subscribe, () => history.get().viewed)
  const shown = viewed?.design ?? design
  const readOnly =
    viewed !== null ||
    !hasRole(role, 'editor') ||
    state.scope === 'readonly' ||
    narrow ||
    state.problem === 'tooBig' ||
    state.problem === 'newerLayout'
  const edits = useMemo(() => designEdits(live.doc, live.origin), [live])
  const editor = useMemo<EditorValue>(
    () => ({ designId, role, readOnly, edits, undoManager: live.undoManager, live, comments }),
    [designId, role, readOnly, edits, live, comments],
  )
  useUndoKeys(live.undoManager, !readOnly)

  // The selected step and button go into the person's presence.
  useEffect(() => {
    const publish = () => {
      const { step, button } = selection.get()
      live.setPresence({ step, button })
    }
    publish()
    return selection.subscribe(publish)
  }, [selection, live])

  // A step someone deleted is no longer selected.
  const selectedStep = useSyncExternalStore(selection.subscribe, () => selection.get().step)
  useEffect(() => {
    if (selectedStep !== null && !(selectedStep in shown.steps)) selection.set({ step: null })
  }, [selectedStep, shown.steps, selection])

  // The bell's link: the Comments panel opens on the thread, and the address forgets it.
  const commentShown = useEffectEvent(() => {
    onCommentShown?.()
  })
  useEffect(() => {
    if (comment === undefined) return
    comments.show(comment)
    commentShown()
  }, [comment, comments])

  // Try it shows on the Map tab (TRY-02): opening it goes there, another tab ends it.
  const toMap = useEffectEvent(() => {
    if (tab !== 'map') onTab('map')
  })
  useEffect(() => {
    if (trying) toMap()
  }, [trying])
  useEffect(() => {
    if (tab !== 'map') tries.stop()
  }, [tab, tries])

  return (
    <SelectionContext value={selection}>
      <LookContext value={looks}>
        <EditorContext value={editor}>
          <DesignContext value={shown}>
            <TryContext value={tries}>
              <TryKeys />
              <CommentKeys />
              <CommentsLive />
              <CommentsPanel />
              <History />
              <div className="flex h-dvh flex-col bg-background pr-[env(safe-area-inset-right,0px)] pl-[env(safe-area-inset-left,0px)]">
                {bar}
                <Banners state={state} live={live} />
                <VersionBanner />
                <LostAccess state={state} />
                <ViewOnlyContext value={readOnly}>
                  {/* A restore (HIST-01) may replace texts the open text editors are bound to: they start again. */}
                  <main key={state.restores} className="flex min-h-0 flex-1 flex-col">
                    {tab === 'setup' ? (
                      <div className="min-h-0 flex-1 overflow-y-auto">
                        <BotSetupTab />
                      </div>
                    ) : tab === 'texts' ? (
                      <div className="min-h-0 flex-1 overflow-y-auto">
                        <TextsTab />
                      </div>
                    ) : (
                      // The map's React Flow store, shared with the palette (it adds steps at the view's center).
                      <ReactFlowProvider>
                        {narrow ? (
                          <NarrowPanes trying={trying} canEdit={hasRole(role, 'editor')} />
                        ) : (
                          <WidePanes readOnly={readOnly} trying={trying} />
                        )}
                      </ReactFlowProvider>
                    )}
                  </main>
                </ViewOnlyContext>
              </div>
            </TryContext>
          </DesignContext>
        </EditorContext>
      </LookContext>
    </SelectionContext>
  )
}

/** Reads the comments again at the live connection's notices (CMT-02). */
function CommentsLive() {
  useCommentsLive()
  return null
}

/**
 * The Map tab from 900 pixels: the palette (for people who can edit), the map and the phone. In
 * Try it (TRY-02) the palette is dimmed, the phone is the chat and, from 1280 pixels, the test user
 * panel has a column of its own beside it.
 */
function WidePanes({ readOnly, trying }: { readOnly: boolean; trying: boolean }) {
  const beside = usePanelBeside()
  const panel = trying && beside
  return (
    <div
      className={cn(
        'grid min-h-0 flex-1',
        readOnly
          ? panel
            ? 'grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)_16rem]'
            : 'grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)]'
          : panel
            ? 'grid-cols-[12.5rem_minmax(0,1fr)_minmax(22rem,28rem)_16rem]'
            : 'grid-cols-[12.5rem_minmax(0,1fr)_minmax(22rem,28rem)]',
      )}
    >
      {readOnly ? null : (
        <div className={cn('min-h-0 border-e bg-surface', trying && 'opacity-40')} inert={trying}>
          <PalettePane />
        </div>
      )}
      <div className="min-h-0 min-w-0">
        <MapPane />
      </div>
      <div className="min-h-0 border-s bg-surface-2">{trying ? <TryPhone /> : <PhonePane />}</div>
      {panel ? (
        <div className="min-h-0 overflow-y-auto border-s bg-surface">
          <TestUserPanel />
        </div>
      ) : null}
    </div>
  )
}

/**
 * The Map tab under 900 pixels (04 section 13): the map or the phone with a switch at the bottom,
 * read-only, with the note "Editing works on a computer screen" for people who can edit. Try it
 * works here too: opening it shows the phone.
 */
function NarrowPanes({ trying, canEdit }: { trying: boolean; canEdit: boolean }) {
  const [shown, setShown] = useState<'map' | 'phone'>('map')
  const [wasTrying, setWasTrying] = useState(trying)
  if (trying !== wasTrying) {
    setWasTrying(trying)
    if (trying) setShown('phone')
  }
  return (
    <Tabs
      value={shown}
      onValueChange={(value: 'map' | 'phone') => {
        setShown(value)
      }}
      className="min-h-0 flex-1 gap-0"
    >
      <TabsContent value="map" className="min-h-0 overflow-hidden">
        <MapPane />
      </TabsContent>
      <TabsContent value="phone" className="min-h-0 overflow-hidden bg-surface-2">
        {trying ? <TryPhone /> : <PhonePane />}
      </TabsContent>
      <div className="flex flex-col items-center gap-2 border-t bg-surface px-3 pt-2 pb-[calc(--spacing(2)+env(safe-area-inset-bottom,0px))]">
        {canEdit ? <p className="text-footnote text-fg-3">Editing works on a computer screen</p> : null}
        <TabsList aria-label="Show">
          <TabsTrigger value="map">Map</TabsTrigger>
          <TabsTrigger value="phone">Phone</TabsTrigger>
        </TabsList>
      </div>
    </Tabs>
  )
}
