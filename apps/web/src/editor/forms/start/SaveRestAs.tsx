import type { VarId } from '@xdesign/spec'
import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { useDesign, useEditor } from '../../context'

const NONE = 'none'
const NEW = 'new'

/**
 * "Save the rest as" of a start link that starts with a text (03 section 2.3: `ref_123` saves
 * `123`): "None", the design's text variables but the built-ins, or "+ New variable" with a name.
 */
export function SaveRestAs({
  value,
  onChange,
}: {
  value: VarId | undefined
  onChange: (id: VarId | undefined) => void
}) {
  const design = useDesign()
  const { edits } = useEditor()
  const id = useId()
  const [naming, setNaming] = useState(false)
  const [label, setLabel] = useState('')
  const items = [
    { value: NONE, label: 'None' },
    ...Object.values(design.variables)
      .filter((variable) => variable.type === 'text' && variable.source !== 'builtin')
      .map((variable) => ({ value: variable.id, label: variable.label })),
    { value: NEW, label: '+ New variable' },
  ]
  const add = () => {
    const name = label.trim()
    if (name === '') return
    onChange(edits.variables.add({ label: name, type: 'text', source: 'startLink' }))
    setNaming(false)
    setLabel('')
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>Save the rest as</FieldLabel>
      <Select
        items={items}
        value={value !== undefined && value in design.variables ? value : NONE}
        onValueChange={(chosen) => {
          if (chosen === NEW) setNaming(true)
          else if (chosen !== null) onChange(chosen === NONE ? undefined : chosen)
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {naming ? (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            add()
          }}
        >
          <Input
            autoFocus
            aria-label="Name"
            placeholder="Name"
            value={label}
            onChange={(event) => {
              setLabel(event.target.value)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setNaming(false)
            }}
          />
          <Button type="submit" disabled={label.trim() === ''}>
            Add
          </Button>
        </form>
      ) : null}
    </Field>
  )
}
