// Variables in the logic forms (docs/plan/04 sections 6 and 11): a select of the design's
// variables by ID name in their groups ("Saved answers", "Remembered values", "Developer
// outputs", "Built-ins"), with "+ New variable" that names a new one in place; and a list of
// variables with a select to add one ("Uses", "Gives back").
import type { NewVariable, VarId } from '@xdesign/spec'
import { XIcon } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

import { useDesign, useEditor } from '../context'
import { groupVariables, type Item } from './logic'

// The select's value of "+ New variable" (variable IDs are nanoids, without "+").
const NEW = '+new'

type VariableChoice = {
  /** Every variable, or only those a step can set (not the built-ins). */
  which?: 'all' | 'settable'
  /** Where a variable "+ New variable" makes gets its value, and its type; no "+ New variable" without it. */
  newVariable?: Pick<NewVariable, 'source' | 'type'> | undefined
  'aria-label'?: string
  'aria-labelledby'?: string
}

/** One variable; a deleted one shows as "Deleted variable". */
export function VariableSelect({
  value,
  onChange,
  which = 'all',
  newVariable,
  exclude,
  placeholder,
  className,
  ...label
}: VariableChoice & {
  value: VarId | undefined
  onChange: (id: VarId) => void
  /** Variables left out of the list (those a list already has). */
  exclude?: readonly VarId[]
  placeholder?: string
  className?: string
}) {
  const design = useDesign()
  const { edits } = useEditor()
  const [naming, setNaming] = useState(false)
  const variables = Object.values(design.variables).filter(
    (variable) => (which === 'all' || variable.source !== 'builtin') && !exclude?.includes(variable.id),
  )
  const items: Item[] = [
    ...variables.map((variable) => ({ value: variable.id, label: variable.idName })),
    ...(value !== undefined && !(value in design.variables) ? [{ value, label: 'Deleted variable' }] : []),
    ...(newVariable ? [{ value: NEW, label: '+ New variable' }] : []),
  ]
  if (naming && newVariable) {
    return (
      <NewName
        placeholder="Name"
        className={className}
        onAdd={(name) => {
          setNaming(false)
          onChange(edits.variables.add({ label: name, ...newVariable }))
        }}
        onCancel={() => {
          setNaming(false)
        }}
      />
    )
  }
  return (
    <Select<string>
      items={items}
      value={value ?? null}
      onValueChange={(next) => {
        if (next === NEW) setNaming(true)
        else if (next !== null && next !== value) onChange(next)
      }}
    >
      <SelectTrigger size="sm" className={className} {...label}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {groupVariables(variables).map((group) => (
          <SelectGroup key={group.label}>
            <SelectLabel>{group.label}</SelectLabel>
            {group.items.map((variable) => (
              <SelectItem key={variable.id} value={variable.id}>
                <span className="font-mono text-subhead">{variable.idName}</span>
                {variable.label.trim() === '' || variable.label === variable.idName ? null : (
                  <span dir="auto" className="truncate text-footnote text-fg-3">
                    {variable.label}
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
        {newVariable ? (
          <>
            {variables.length > 0 ? <SelectSeparator /> : null}
            <SelectItem value={NEW}>+ New variable</SelectItem>
          </>
        ) : null}
      </SelectContent>
    </Select>
  )
}

/** Several variables as chips, each with its remove mark, and a select to add one. */
export function VariableList({
  value,
  onChange,
  ...choice
}: VariableChoice & { value: readonly VarId[]; onChange: (ids: VarId[]) => void }) {
  const design = useDesign()
  const { readOnly } = useEditor()
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((id) => {
        const name = design.variables[id]?.idName ?? 'Deleted variable'
        return (
          <Badge key={id} variant="secondary" className="h-7 gap-1 pe-1 font-mono text-footnote">
            {name}
            {readOnly ? null : (
              <button
                type="button"
                aria-label={`Remove ${name}`}
                className="grid size-5 place-items-center rounded-full hover:bg-surface-press"
                onClick={() => {
                  onChange(value.filter((other) => other !== id))
                }}
              >
                <XIcon className="size-3" />
              </button>
            )}
          </Badge>
        )
      })}
      <VariableSelect
        {...choice}
        value={undefined}
        exclude={value}
        placeholder="Add a variable"
        onChange={(id) => {
          onChange([...value, id])
        }}
      />
    </div>
  )
}

/** A name typed in place of a select ("+ New variable", "+ Switch"): Enter or "Add" adds it, Escape goes back. */
export function NewName({
  placeholder,
  className,
  onAdd,
  onCancel,
}: {
  placeholder: string
  className?: string | undefined
  onAdd: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const add = () => {
    if (name.trim() !== '') onAdd(name.trim())
  }
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Input
        autoFocus
        aria-label={placeholder}
        placeholder={placeholder}
        className="h-(--control-h-sm) min-w-32 flex-1"
        value={name}
        onChange={(event) => {
          setName(event.target.value)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            add()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            onCancel()
          }
        }}
      />
      <Button type="button" size="sm" disabled={name.trim() === ''} onClick={add}>
        Add
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  )
}
