import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { designName, routes } from '@xdesign/api'
import { LayoutTemplateIcon, XIcon } from 'lucide-react'
import { useId, useState } from 'react'

import { isApiError, useApiMutation } from '@/api/client'
import { FormProblem, TextField } from '@/components/forms'
import { LanguageFlag, LanguagePicker, RtlBadge } from '@/components/LanguagePicker'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { findLanguage } from '@/lib/languages'

/**
 * "New design" (docs/plan/04 section 3): the name, the default language (English preselected)
 * and more languages, each from the searchable list; "Create" makes the design with `/start` and
 * an empty "Main menu" (the server's newDesignDoc) and opens it in the editor. "Start from a
 * template" goes to the gallery instead (TPL-01).
 */
export function NewDesignDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Mounted only while open, so each new design starts from an empty form. */}
        <NewDesignForm
          onDone={() => {
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function NewDesignForm({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const create = useApiMutation(routes.createDesign)
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string>()
  const [defaultLanguage, setDefaultLanguage] = useState('en')
  const [more, setMore] = useState<string[]>([])
  const [problem, setProblem] = useState<string>()
  const defaultId = useId()
  const moreId = useId()

  const submit = async () => {
    const checked = designName.safeParse(name)
    if (!checked.success) {
      setNameError(checked.error.issues[0]?.message)
      return
    }
    setNameError(undefined)
    setProblem(undefined)
    try {
      const { design } = await create.mutateAsync({
        body: { name: checked.data, defaultLanguage, languages: [defaultLanguage, ...more] },
      })
      void queryClient.invalidateQueries({ queryKey: [routes.designs.key] })
      onDone()
      await navigate({ to: '/d/$id', params: { id: design.id } })
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
        if (!create.isPending) void submit()
      }}
    >
      <DialogHeader>
        <DialogTitle>New design</DialogTitle>
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
      <Field>
        <FieldLabel htmlFor={defaultId}>Default language</FieldLabel>
        <LanguagePicker
          id={defaultId}
          value={defaultLanguage}
          onChange={(code) => {
            setDefaultLanguage(code)
            setMore((list) => list.filter((other) => other !== code))
          }}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={moreId}>More languages</FieldLabel>
        {more.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {more.map((code) => {
              const language = findLanguage(code)
              return (
                <li
                  key={code}
                  className="flex h-7 items-center gap-1 rounded-full bg-surface-2 ps-2.5 pe-0.5 text-footnote font-semibold text-fg-2"
                >
                  <LanguageFlag language={language} />
                  {language?.english ?? code}
                  {language ? <RtlBadge language={language} /> : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="rounded-full hover:bg-error-weak hover:text-error"
                    aria-label={`Remove ${language?.english ?? code}`}
                    onClick={() => {
                      setMore((list) => list.filter((other) => other !== code))
                    }}
                  >
                    <XIcon aria-hidden />
                  </Button>
                </li>
              )
            })}
          </ul>
        ) : null}
        <LanguagePicker
          id={moreId}
          value={undefined}
          placeholder="Add a language"
          exclude={[defaultLanguage, ...more]}
          onChange={(code) => {
            setMore((list) => [...list, code])
          }}
        />
      </Field>
      <FormProblem message={problem} />
      <DialogFooter>
        <Button
          variant="link"
          className="px-0 sm:me-auto"
          nativeButton={false}
          render={<Link to="/templates" onClick={onDone} />}
        >
          <LayoutTemplateIcon aria-hidden />
          Start from a template
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={create.isPending} pending={create.isPending}>
          Create
        </Button>
      </DialogFooter>
    </form>
  )
}
