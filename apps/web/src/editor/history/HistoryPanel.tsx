import { useQueryClient } from '@tanstack/react-query'
import { hasRole, routes } from '@xdesign/api'
import { BookmarkPlusIcon, DownloadIcon, EllipsisIcon, HistoryIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'

import { useApi } from '@/api/client'
import { EmptyState } from '@/components/EmptyState'
import { FormProblem } from '@/components/forms'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime, timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'
import { viaWords } from '@/settings/activityText'

import { useEditor } from '../context'
import { useHistory, useHistoryStore } from './store'
import { type DesignVersion, readVersion, versionLabel } from './versions'

/** The History panel (04 section 15, 05 section 7), the editor's right sheet. */
export function HistoryPanel() {
  const store = useHistoryStore()
  const open = useHistory((state) => state.panel)
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        store.setPanel(next)
      }}
    >
      <SheetContent className="flex flex-col data-[side=right]:sm:max-w-md">
        <SheetHeader>
          <SheetTitle>History</SheetTitle>
        </SheetHeader>
        <VersionList />
      </SheetContent>
    </Sheet>
  )
}

/** Who made a version: the person, and (MCP-01b) the key of a change through Claude. */
function madeBy(version: DesignVersion): string {
  const name = version.createdBy?.name ?? ''
  const via = viaWords(version.via)
  return via === undefined ? name : `${name} ${via}`
}

/**
 * The design's versions, newest first: "Automatic", named ones in bold, "Before restore" and
 * "Restored", each with who made it (and the key it was made through) and when. A click opens the
 * version read-only in the editor; a version's menu has "Export", and for a named one "Rename"
 * (Editors) and "Delete" (the design owner). "Name this version" makes a named version of now
 * (Editors).
 */
function VersionList() {
  const { designId, role } = useEditor()
  const store = useHistoryStore()
  const queryClient = useQueryClient()
  const viewed = useHistory((state) => state.viewed?.version.id ?? null)
  const versions = useApi(routes.versions, { params: { id: designId } })
  const [opening, setOpening] = useState<string | null>(null)
  const [problem, setProblem] = useState<string>()
  const canEdit = hasRole(role, 'editor')
  const owner = hasRole(role, 'owner')

  const view = async (version: DesignVersion) => {
    setOpening(version.id)
    setProblem(undefined)
    try {
      store.view(await readVersion(queryClient, designId, version.id))
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error))
    } finally {
      setOpening(null)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {canEdit ? (
        <div className="px-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              store.open({ kind: 'name' })
            }}
          >
            <BookmarkPlusIcon aria-hidden data-icon="inline-start" />
            Name this version
          </Button>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-4">
        <FormProblem message={problem ?? (versions.isError ? versions.error.message : undefined)} />
        {versions.isPending ? (
          <div role="status" aria-label="Loading the versions" className="grid gap-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : versions.data?.versions.length === 0 ? (
          <EmptyState
            icon={HistoryIcon}
            title="No versions yet"
            description="A version is made every 10 minutes while people edit, and when the last editor leaves."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {versions.data?.versions.map((version) => (
              <li
                key={version.id}
                className={cn(
                  'flex items-start gap-1 rounded-xl border bg-surface-2 p-1',
                  version.id === viewed && 'border-focus',
                )}
              >
                <button
                  type="button"
                  disabled={opening !== null}
                  aria-current={version.id === viewed || undefined}
                  className="flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-lg px-2 py-1.5 text-start outline-none hover:bg-surface-press focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-solid disabled:opacity-60"
                  onClick={() => {
                    void view(version)
                  }}
                >
                  <span
                    dir="auto"
                    className={cn('w-full truncate text-subhead', version.kind === 'named' && 'font-bold')}
                  >
                    {opening === version.id ? 'Opening...' : versionLabel(version)}
                  </span>
                  <span className="w-full truncate text-footnote text-fg-3" title={formatDateTime(version.createdAt)}>
                    {version.createdBy ? `${madeBy(version)}, ` : ''}
                    {timeAgo(version.createdAt)}
                  </span>
                </button>
                <VersionMenu
                  version={version}
                  canRename={canEdit && version.kind === 'named'}
                  canDelete={owner && version.kind === 'named'}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function VersionMenu({
  version,
  canRename,
  canDelete,
}: {
  version: DesignVersion
  canRename: boolean
  canDelete: boolean
}) {
  const store = useHistoryStore()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More" />}>
        <EllipsisIcon aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => {
            store.open({ kind: 'export', version })
          }}
        >
          <DownloadIcon aria-hidden />
          Export
        </DropdownMenuItem>
        {canRename ? (
          <DropdownMenuItem
            onClick={() => {
              store.open({ kind: 'rename', version })
            }}
          >
            <PencilIcon aria-hidden />
            Rename
          </DropdownMenuItem>
        ) : null}
        {canDelete ? (
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              store.open({ kind: 'delete', version })
            }}
          >
            <Trash2Icon aria-hidden />
            Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
