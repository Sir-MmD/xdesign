import type { AnswerChecks as Checks, Expects } from '@xdesign/spec'
import { type ReactNode, useId, useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

import { OptionalNumber } from './fields'
import { CHECKS_OF, checksFor } from './question'

/**
 * The checks of the kind of answer a question expects (04 section 6): "At least / at most N
 * characters" for a text, "Between A and B" and "Whole number" for a number, "Max file size" for
 * media and files, "File types" for files. Nothing for the other kinds.
 */
export function AnswerChecks({
  expects,
  checks,
  onChange,
}: {
  expects: Expects
  checks: Checks
  onChange: (checks: Checks) => void
}) {
  const wholeId = useId()
  const keys = CHECKS_OF[expects]
  const set = (patch: Partial<Checks>) => {
    onChange(checksFor({ ...checks, ...patch }, expects))
  }
  return (
    <>
      {keys.includes('minLength') ? (
        <div className="grid gap-2">
          <Sentence>
            At least
            <OptionalNumber
              aria-label="At least this many characters"
              className="h-(--control-h-sm) w-20"
              value={checks.minLength}
              min={0}
              whole
              onCommit={(minLength) => {
                set({ minLength })
              }}
            />
            characters
          </Sentence>
          <Sentence>
            At most
            <OptionalNumber
              aria-label="At most this many characters"
              className="h-(--control-h-sm) w-20"
              value={checks.maxLength}
              min={1}
              whole
              onCommit={(maxLength) => {
                set({ maxLength })
              }}
            />
            characters
          </Sentence>
        </div>
      ) : null}
      {keys.includes('min') ? (
        <div className="grid gap-2">
          <Sentence>
            Between
            <OptionalNumber
              aria-label="The least number"
              className="h-(--control-h-sm) w-24"
              value={checks.min}
              min={-Number.MAX_SAFE_INTEGER}
              onCommit={(min) => {
                set({ min })
              }}
            />
            and
            <OptionalNumber
              aria-label="The greatest number"
              className="h-(--control-h-sm) w-24"
              value={checks.max}
              min={-Number.MAX_SAFE_INTEGER}
              onCommit={(max) => {
                set({ max })
              }}
            />
          </Sentence>
          <div className="flex items-center gap-2">
            <Switch
              id={wholeId}
              checked={checks.wholeNumber === true}
              onCheckedChange={(whole) => {
                set({ wholeNumber: whole ? true : undefined })
              }}
            />
            <Label htmlFor={wholeId}>Whole number</Label>
          </div>
        </div>
      ) : null}
      {keys.includes('maxFileMb') ? (
        <Sentence>
          Max file size
          <OptionalNumber
            aria-label="Max file size in MB"
            className="h-(--control-h-sm) w-20"
            value={checks.maxFileMb}
            min={0.1}
            max={2000}
            onCommit={(maxFileMb) => {
              set({ maxFileMb })
            }}
          />
          MB
        </Sentence>
      ) : null}
      {keys.includes('fileTypes') ? (
        <FileTypes
          value={checks.fileTypes}
          onChange={(fileTypes) => {
            set({ fileTypes })
          }}
        />
      ) : null}
    </>
  )
}

function Sentence({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 text-callout">{children}</div>
}

/** "File types": the endings a file may have ("pdf, docx"), typed with commas or spaces between them. */
function FileTypes({
  value,
  onChange,
}: {
  value: readonly string[] | undefined
  onChange: (types: string[] | undefined) => void
}) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>File types</Label>
      <Input
        id={id}
        dir="ltr"
        placeholder="pdf, docx"
        value={draft ?? (value ?? []).join(', ')}
        onChange={(event) => {
          const text = event.target.value
          setDraft(text)
          const types = [
            ...new Set(
              text
                .split(/[\s,،]+/)
                .map((type) => type.trim().replace(/^\.+/, '').toLowerCase())
                .filter((type) => type !== ''),
            ),
          ]
          onChange(types.length > 0 ? types : undefined)
        }}
        onBlur={() => {
          setDraft(null)
        }}
      />
    </div>
  )
}
