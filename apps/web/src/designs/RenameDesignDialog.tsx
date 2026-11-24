import { useQueryClient } from '@tanstack/react-query'
import { designName, routes } from '@xdesign/api'
import { useState } from 'react'

import { isApiError, useApiMutation } from '@/api/client'
import { FormProblem, TextField } from '@/components/forms'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useLast } from '@/lib/useLast'

/** "Rename" of a design's menu (design owner and site owner): the new name, "Rename". */
export function RenameDesignDialog({
  design,
  onOpenChange,
}: {
  /** The design to rename; the dialog is open while it is set. */
  design: { id: string; name: string } | undefined
  onOpenChange: (open: boolean) => void
}) {
  const shown = useLast(design)
  return (
    <Dialog open={design !== undefined} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {shown ? (
          <RenameForm
            key={shown.id}
            design={shown}
            onDone={() => {
              onOpenChange(false)
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function RenameForm({ design, onDone }: { design: { id: string; name: string }; onDone: () => void }) {
  const queryClient = useQueryClient()
  const rename = useApiMutation(routes.renameDesign)
  const [name, setName] = useState(design.name)
  const [nameError, setNameError] = useState<string>()
  const [problem, setProblem] = useState<string>()

  const submit = async () => {
    const checked = designName.safeParse(name)
    if (!checked.success) {
      setNameError(checked.error.issues[0]?.message)
      return
    }
    setNameError(undefined)
    setProblem(undefined)
    try {
      await rename.mutateAsync({ params: { id: design.id }, body: { name: checked.data } })
      void queryClient.invalidateQueries({ queryKey: [routes.designs.key] })
      void queryClient.invalidateQueries({ queryKey: [routes.design.key] })
      onDone()
    } catch (error) {
      setProblem(isApiError(error) || error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (!rename.isPending) void submit()
      }}
    >
      <DialogHeader>
        <DialogTitle>Rename</DialogTitle>
      </DialogHeader>
      <TextField
        label="Name"
        autoComplete="off"
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
        <Button type="submit" disabled={rename.isPending} pending={rename.isPending}>
          Rename
        </Button>
      </DialogFooter>
    </form>
  )
}
