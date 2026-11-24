import { useQueryClient } from '@tanstack/react-query'
import { routes, versionName } from '@xdesign/api'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'

import { apiKey, call, isApiError } from '@/api/client'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormProblem, TextField } from '@/components/forms'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ExportDialog } from '@/export/ExportDialog'
import { useLast } from '@/lib/useLast'

import { useDesign, useEditor } from '../context'
import { useLook } from '../look'
import { CompareDialog } from './CompareDialog'
import { HistoryPanel } from './HistoryPanel'
import { useHistory, useHistoryStore } from './store'
import { type DesignVersion, versionLabel, versionTitle } from './versions'

/**
 * Version history in the editor (04 section 15, 05 section 7): the History panel and the dialogs
 * opened from it, from the "..." menu and from the banner (history/VersionBanner.tsx): "Name this
 * version", "Compare with now", "Restore this version" (it asks first), a version's export, and a
 * named version's rename and delete. A restore by anyone refreshes the list and says so.
 */
export function History() {
  const { designId, live } = useEditor()
  const { name } = useDesign()
  const [look] = useLook()
  const store = useHistoryStore()
  const queryClient = useQueryClient()
  const dialog = useHistory((state) => state.dialog)
  const viewed = useHistory((state) => state.viewed)
  const close = (open: boolean) => {
    if (!open) store.close()
  }
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: apiKey(routes.versions, { params: { id: designId } }) })
  }

  // HIST-01's `versionRestored`: the document already follows (live.ts); the list gains the
  // "Before restore" and restore versions.
  const restores = useSyncExternalStore(live.subscribe, () => live.getState().restores)
  useEffect(() => {
    if (restores === 0) return
    void queryClient.invalidateQueries({ queryKey: apiKey(routes.versions, { params: { id: designId } }) })
    toast.success('This design was restored to an earlier version.')
  }, [restores, queryClient, designId])

  const exported = dialog?.kind === 'export' ? dialog.version : undefined
  const renamed = dialog?.kind === 'rename' ? dialog.version : undefined
  const deleted = useLast(dialog?.kind === 'delete' ? dialog.version : undefined)
  // The version stays named while the dialog closes, after "Back to now".
  const restored = useLast(viewed ?? undefined)
  return (
    <>
      <HistoryPanel />
      <CompareDialog />
      <VersionNameDialog
        open={dialog?.kind === 'name'}
        onOpenChange={close}
        onSave={async (chosen) => {
          await call(routes.nameVersion, { params: { id: designId }, body: { name: chosen } })
          refresh()
          toast.success(`Named this version "${chosen}".`)
        }}
      />
      <VersionNameDialog
        version={renamed}
        open={renamed !== undefined}
        onOpenChange={close}
        onSave={async (chosen) => {
          if (!renamed) return
          await call(routes.renameVersion, { params: { id: designId, versionId: renamed.id }, body: { name: chosen } })
          refresh()
          void queryClient.invalidateQueries({ queryKey: [routes.version.key] })
        }}
      />
      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        onOpenChange={close}
        title={`Delete "${deleted ? versionLabel(deleted) : ''}"?`}
        description="The version is deleted for everyone. The design does not change."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleted) return
          await call(routes.deleteVersion, { params: { id: designId, versionId: deleted.id } })
          refresh()
          if (store.get().viewed?.version.id === deleted.id) store.back()
        }}
      />
      <ConfirmDialog
        open={dialog?.kind === 'restore'}
        onOpenChange={close}
        title="Restore this version?"
        description={
          restored
            ? `The design goes back to ${versionTitle(restored.version)} for everyone. Now is kept as "Before restore", so you can go back to it.`
            : undefined
        }
        confirmLabel="Restore"
        destructive={false}
        onConfirm={async () => {
          if (!viewed) return
          await call(routes.restoreVersion, { params: { id: designId, versionId: viewed.version.id } })
          store.back()
        }}
      />
      <ExportDialog
        design={exported ? { id: designId, name, version: exported.id } : undefined}
        onOpenChange={close}
        doc={live.doc}
        look={look}
      />
    </>
  )
}

/** "Name this version" (a named version of now), or a named version's "Rename" when `version` is set. */
function VersionNameDialog({
  version,
  open,
  onOpenChange,
  onSave,
}: {
  version?: DesignVersion | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (name: string) => Promise<void>
}) {
  const shown = useLast(version)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Mounted only while open, so the name and problems start fresh each time. */}
        <NameForm
          initial={shown?.name ?? ''}
          renaming={shown !== undefined}
          onSave={onSave}
          onDone={() => {
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function NameForm({
  initial,
  renaming,
  onSave,
  onDone,
}: {
  initial: string
  renaming: boolean
  onSave: (name: string) => Promise<void>
  onDone: () => void
}) {
  const [name, setName] = useState(initial)
  const [nameError, setNameError] = useState<string>()
  const [problem, setProblem] = useState<string>()
  const [pending, setPending] = useState(false)

  const submit = async () => {
    const checked = versionName.safeParse(name)
    if (!checked.success) {
      setNameError(checked.error.issues[0]?.message)
      return
    }
    setNameError(undefined)
    setProblem(undefined)
    setPending(true)
    try {
      await onSave(checked.data)
      onDone()
    } catch (error) {
      setProblem(isApiError(error) || error instanceof Error ? error.message : String(error))
      setPending(false)
    }
  }

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (!pending) void submit()
      }}
    >
      <DialogHeader>
        <DialogTitle>{renaming ? 'Rename version' : 'Name this version'}</DialogTitle>
      </DialogHeader>
      <TextField
        label="Name"
        autoComplete="off"
        placeholder="Sent to developer"
        value={name}
        error={nameError}
        onChange={(event) => {
          setName(event.target.value)
        }}
      />
      <FormProblem message={problem} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending} pending={pending}>
          {renaming ? 'Rename' : 'Save'}
        </Button>
      </DialogFooter>
    </form>
  )
}
