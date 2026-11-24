import { keepPreviousData, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { routes } from '@xdesign/api'
import { LayoutTemplateIcon, PlusIcon, SearchIcon, Trash2Icon, UploadIcon, WorkflowIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { call, useApi, useApiMutation } from '@/api/client'
import { hasRoute, useMe } from '@/app/session'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { FormProblem } from '@/components/forms'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Skeleton } from '@/components/ui/skeleton'
import { type DesignAction, DesignCard, type DesignCardData } from '@/designs/DesignCard'
import { NewDesignDialog } from '@/designs/NewDesignDialog'
import { RenameDesignDialog } from '@/designs/RenameDesignDialog'
import { SaveTemplateDialog } from '@/designs/SaveTemplateDialog'
import { ShareDialog } from '@/designs/ShareDialog'
import { LookStore } from '@/editor/look'
import { ExportDialog } from '@/export/ExportDialog'
import { useUnread } from '@/comments/unread'
import { ImportDialog } from '@/export/ImportDialog'
import { refreshPictures } from '@/export/pictureCache'
import { useDebounced } from '@/lib/useDebounced'
import { useLast } from '@/lib/useLast'
import { cn } from '@/lib/utils'

// Designs (docs/plan/04 section 3, 05 section 5), the first page after signing in: the header
// with "Search designs", "New design", "New from template" (the gallery, TPL-01) and "Import" (06
// section 6), the filter chips "All" (for the site owner every design on the server), "Mine",
// "Shared with me" and "Trash", and the cards. The chip is the page's `filter` search, so going
// back to the page keeps it. The desktop app has no sharing, so no "Shared with me" (DESK-03).
const filters = [
  { value: 'all', label: 'All' },
  { value: 'mine', label: 'Mine' },
  { value: 'shared', label: 'Shared with me' },
  { value: 'trash', label: 'Trash' },
] as const
type Filter = (typeof filters)[number]['value']

const searchSchema = z.object({
  filter: z.enum(['mine', 'shared', 'trash']).optional().catch(undefined),
})

export const Route = createFileRoute('/_app/')({
  validateSearch: searchSchema,
  component: Designs,
})

const chipClass =
  'x-target inline-flex min-h-[30px] shrink-0 cursor-pointer touch-manipulation items-center rounded-full border border-transparent bg-surface-2 px-3.5 text-footnote font-semibold whitespace-nowrap text-fg-2 transition-[color,background-color,border-color] duration-(--dur-fast) ease-(--ease) outline-none select-none [-webkit-tap-highlight-color:transparent] hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus focus-visible:outline-solid active:border-brand active:text-brand aria-pressed:border-brand aria-pressed:bg-brand-weak aria-pressed:text-brand'

function Designs() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const filter: Filter = search.filter ?? 'all'
  const chips = filters.filter((chip) => chip.value !== 'shared' || hasRoute('setDesignMember'))
  const [text, setText] = useState('')
  const words = useDebounced(text.trim())
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const list = useApi(
    routes.designs,
    { query: { filter, q: words === '' ? undefined : words } },
    { placeholderData: keepPreviousData },
  )
  const designs = list.data?.designs ?? []
  const actions = useDesignActions()
  const unread = useUnread().data?.designs

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="me-auto text-title-2 font-bold">Designs</h1>
        <Button
          variant="outline"
          onClick={() => {
            setImporting(true)
          }}
        >
          <UploadIcon aria-hidden />
          Import
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link to="/templates" />}>
          <LayoutTemplateIcon aria-hidden />
          New from template
        </Button>
        <Button
          onClick={() => {
            setCreating(true)
          }}
        >
          <PlusIcon aria-hidden />
          New design
        </Button>
      </div>
      <div className="flex flex-col gap-3 min-[760px]:flex-row min-[760px]:items-center">
        <InputGroup className="min-[760px]:max-w-sm">
          <InputGroupInput
            type="search"
            value={text}
            maxLength={100}
            placeholder="Search designs"
            aria-label="Search designs"
            onChange={(event) => {
              setText(event.target.value)
            }}
          />
          <InputGroupAddon>
            <SearchIcon aria-hidden />
          </InputGroupAddon>
        </InputGroup>
        <div role="group" aria-label="Show" className="-mx-1 no-scrollbar flex gap-2 overflow-x-auto px-1 py-1">
          {chips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              aria-pressed={filter === chip.value}
              className={chipClass}
              onClick={() => {
                void navigate({
                  search: chip.value === 'all' ? {} : { filter: chip.value },
                  replace: true,
                })
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>
      {list.isPending ? (
        <div role="status" aria-label="Loading the designs" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-60 rounded-2xl" />
          <Skeleton className="h-60 rounded-2xl" />
          <Skeleton className="h-60 rounded-2xl" />
        </div>
      ) : list.isError ? (
        <FormProblem message={list.error.message} />
      ) : designs.length === 0 ? (
        <NoDesigns
          filter={filter}
          searching={words !== ''}
          onCreate={() => {
            setCreating(true)
          }}
        />
      ) : (
        <ul
          aria-label="Designs"
          className={cn(
            'x-cards grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
            list.isPlaceholderData && 'opacity-60',
          )}
        >
          {designs.map((design) => (
            <li key={design.id} className="flex flex-col *:flex-1">
              <DesignCard
                design={design}
                unread={unread?.find((item) => item.id === design.id)}
                onAction={actions.run}
              />
            </li>
          ))}
        </ul>
      )}
      <NewDesignDialog open={creating} onOpenChange={setCreating} />
      <ImportDialog open={importing} onOpenChange={setImporting} />
      {actions.dialogs}
    </div>
  )
}

/** What the list says when it has no design: for a search, for Trash, for "Shared with me", or none at all. */
function NoDesigns({ filter, searching, onCreate }: { filter: Filter; searching: boolean; onCreate: () => void }) {
  if (searching) return <EmptyState icon={SearchIcon} title="No design matches." />
  if (filter === 'trash') {
    return <EmptyState icon={Trash2Icon} title="Trash is empty." description="Deleted designs stay here for 30 days." />
  }
  if (filter === 'shared') return <EmptyState icon={WorkflowIcon} title="Nothing is shared with you yet." />
  return (
    <EmptyState
      icon={WorkflowIcon}
      title="No designs yet."
      action={
        <Button onClick={onCreate}>
          <PlusIcon aria-hidden />
          New design
        </Button>
      }
    />
  )
}

/**
 * The actions of a card's menu: "Open" goes to the editor; "Duplicate" and "Restore" run at once;
 * "Delete" asks first, then moves the design to Trash with "Undo" in the toast (docs/plan/17
 * section 9); "Rename", "Share", "Export", "Save as template" and "Delete forever" open their
 * dialogs; "Refresh pictures for Claude" runs in a toast, in the phone look the person last chose
 * in the editor.
 */
function useDesignActions() {
  const me = useMe()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [renaming, setRenaming] = useState<DesignCardData>()
  const [sharing, setSharing] = useState<DesignCardData>()
  const [exporting, setExporting] = useState<DesignCardData>()
  const [templating, setTemplating] = useState<DesignCardData>()
  const [deleting, setDeleting] = useState<DesignCardData>()
  const shownDeleting = useLast(deleting)
  const [erasing, setErasing] = useState<DesignCardData>()
  const shownErasing = useLast(erasing)
  const refresh = () => queryClient.invalidateQueries({ queryKey: [routes.designs.key] })
  const failed = (error: { message: string }) => {
    toast.error(error.message)
  }
  const duplicate = useApiMutation(routes.duplicateDesign, {
    onSuccess: ({ design }) => {
      toast.success(`Made ${design.name}.`)
      return refresh()
    },
    onError: failed,
  })
  const restore = useApiMutation(routes.restoreDesign, {
    onSuccess: ({ design }) => {
      toast.success(`Restored ${design.name}.`)
      return refresh()
    },
    onError: failed,
  })

  const run = (action: DesignAction, design: DesignCardData) => {
    const params = { id: design.id }
    switch (action) {
      case 'open':
        void navigate({ to: '/d/$id', params })
        break
      case 'rename':
        setRenaming(design)
        break
      case 'share':
        setSharing(design)
        break
      case 'export':
        setExporting(design)
        break
      case 'saveTemplate':
        setTemplating(design)
        break
      case 'refreshPictures':
        refreshPictures(design, { look: new LookStore(me.id).get() })
        break
      case 'duplicate':
        duplicate.mutate({ params })
        break
      case 'delete':
        setDeleting(design)
        break
      case 'restore':
        restore.mutate({ params })
        break
      case 'deleteForever':
        setErasing(design)
        break
    }
  }

  const dialogs = (
    <>
      <RenameDesignDialog
        design={renaming}
        onOpenChange={(open) => {
          if (!open) setRenaming(undefined)
        }}
      />
      <ShareDialog
        design={sharing}
        onOpenChange={(open) => {
          if (!open) setSharing(undefined)
        }}
      />
      <ExportDialog
        design={exporting}
        onOpenChange={(open) => {
          if (!open) setExporting(undefined)
        }}
      />
      <SaveTemplateDialog
        design={templating}
        onOpenChange={(open) => {
          if (!open) setTemplating(undefined)
        }}
      />
      <ConfirmDialog
        open={deleting !== undefined}
        onOpenChange={(open) => {
          if (!open) setDeleting(undefined)
        }}
        title={`Delete "${shownDeleting?.name ?? ''}"?`}
        description="It moves to Trash for 30 days. The people it is shared with lose it until it is restored."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleting) return
          const params = { id: deleting.id }
          await call(routes.deleteDesign, { params })
          await refresh()
          toast(`Moved ${deleting.name} to Trash.`, {
            action: {
              label: 'Undo',
              onClick: () => {
                restore.mutate({ params })
              },
            },
          })
        }}
      />
      <ConfirmDialog
        open={erasing !== undefined}
        onOpenChange={(open) => {
          if (!open) setErasing(undefined)
        }}
        title={`Delete ${shownErasing?.name ?? ''} forever?`}
        description="This cannot be undone."
        confirmLabel="Delete forever"
        onConfirm={async () => {
          if (!erasing) return
          await call(routes.deleteDesignForever, { params: { id: erasing.id } })
          await refresh()
        }}
      />
    </>
  )

  return { run, dialogs }
}
