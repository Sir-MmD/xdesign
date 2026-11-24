import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { designName, routes, templateDescription } from '@xdesign/api'
import { useId, useState } from 'react'
import { toast } from 'sonner'

import { isApiError, useApiMutation } from '@/api/client'
import { FormProblem, TextField } from '@/components/forms'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { useLast } from '@/lib/useLast'

/**
 * "Save as template" of a design's menu (docs/plan/04 section 15; design owner and site owner): the
 * template's name (the design's to start with) and description; "Save as template" copies the
 * design as it is now into the gallery, where every member can use it.
 */
export function SaveTemplateDialog({
  design,
  onOpenChange,
}: {
  /** The design to save; the dialog is open while it is set. */
  design: { id: string; name: string } | undefined
  onOpenChange: (open: boolean) => void
}) {
  const shown = useLast(design)
  return (
    <Dialog open={design !== undefined} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {shown ? (
          <SaveTemplateForm
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

function SaveTemplateForm({ design, onDone }: { design: { id: string; name: string }; onDone: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const save = useApiMutation(routes.saveAsTemplate)
  const [name, setName] = useState(design.name)
  const [nameError, setNameError] = useState<string>()
  const [description, setDescription] = useState('')
  const [descriptionError, setDescriptionError] = useState<string>()
  const [problem, setProblem] = useState<string>()
  const descriptionId = useId()

  const submit = async () => {
    const checkedName = designName.safeParse(name)
    const checkedDescription = templateDescription.safeParse(description)
    setNameError(checkedName.success ? undefined : checkedName.error.issues[0]?.message)
    setDescriptionError(checkedDescription.success ? undefined : checkedDescription.error.issues[0]?.message)
    if (!checkedName.success || !checkedDescription.success) return
    setProblem(undefined)
    try {
      const { template } = await save.mutateAsync({
        params: { id: design.id },
        body: { name: checkedName.data, description: checkedDescription.data },
      })
      void queryClient.invalidateQueries({ queryKey: [routes.templates.key] })
      onDone()
      toast.success(`Saved ${template.name} as a template.`, {
        action: {
          label: 'Templates',
          onClick: () => {
            void navigate({ to: '/templates' })
          },
        },
      })
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
        if (!save.isPending) void submit()
      }}
    >
      <DialogHeader>
        <DialogTitle>Save as template</DialogTitle>
        <DialogDescription>
          A copy of the design as it is now goes to Templates, where every member can start a design from it.
        </DialogDescription>
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
      <Field data-invalid={descriptionError !== undefined || undefined}>
        <FieldLabel htmlFor={descriptionId}>Description</FieldLabel>
        <Textarea
          id={descriptionId}
          rows={3}
          maxLength={300}
          value={description}
          placeholder="What the template is for"
          aria-invalid={descriptionError !== undefined || undefined}
          onChange={(event) => {
            setDescription(event.target.value)
          }}
        />
        <FieldError>{descriptionError}</FieldError>
      </Field>
      <FormProblem message={problem} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending} pending={save.isPending}>
          Save as template
        </Button>
      </DialogFooter>
    </form>
  )
}
