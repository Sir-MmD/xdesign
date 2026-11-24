import { useId, useState } from 'react'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { LanguageFlag, LanguagePicker, RtlBadge } from '@/components/LanguagePicker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { findLanguage, languageName } from '@/lib/languages'
import { useLast } from '@/lib/useLast'

import { useDesign, useEditor } from '../context'

/**
 * "Languages..." (04 sections 4.1 and 10): the design's languages with "Default" and "Remove"
 * (after a question: its texts go with it), and "Add a language" from WEB-02's searchable list
 * with right-to-left ones marked. Each change is SPEC-04's and shows to everyone at once.
 */
export function LanguagesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const design = useDesign()
  const { edits } = useEditor()
  const [removing, setRemoving] = useState<string>()
  const removed = useLast(removing)
  const addId = useId()
  const { list, default: fallback } = design.languages
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Languages</DialogTitle>
          </DialogHeader>
          <ul className="flex flex-col divide-y rounded-lg border">
            {list.map((code) => {
              const language = findLanguage(code)
              const name = language?.english ?? code
              return (
                <li key={code} className="flex items-center gap-2 py-2 ps-3 pe-2">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex min-w-0 items-center gap-2">
                      <LanguageFlag language={language} />
                      <span className="truncate font-semibold">{name}</span>
                      <span className="text-footnote text-fg-3">{code}</span>
                      {language ? <RtlBadge language={language} /> : null}
                    </span>
                    {language && language.native !== language.english ? (
                      <span dir="auto" className="truncate text-footnote text-fg-3">
                        {language.native}
                      </span>
                    ) : null}
                  </span>
                  {code === fallback ? (
                    <Badge variant="pill" tone="brand">
                      Default
                    </Badge>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Make ${name} the default language`}
                        onClick={() => {
                          edits.languages.setDefault(code)
                        }}
                      >
                        Default
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="hover:bg-error-weak hover:text-error"
                        aria-label={`Remove ${name}`}
                        onClick={() => {
                          setRemoving(code)
                        }}
                      >
                        Remove
                      </Button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
          <Field>
            <FieldLabel htmlFor={addId} className="sr-only">
              Add a language
            </FieldLabel>
            <LanguagePicker
              id={addId}
              value={undefined}
              placeholder="Add a language"
              exclude={list}
              onChange={(code) => {
                edits.languages.add(code)
              }}
            />
          </Field>
          <DialogFooter>
            <Button
              onClick={() => {
                onOpenChange(false)
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={removing !== undefined}
        onOpenChange={(next) => {
          if (!next) setRemoving(undefined)
        }}
        title={`Remove ${languageName(removed ?? '')}?`}
        description="Its texts in this design are deleted."
        confirmLabel="Remove"
        onConfirm={() => {
          if (removing !== undefined) edits.languages.remove(removing)
        }}
      />
    </>
  )
}
