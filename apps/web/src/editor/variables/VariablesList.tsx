import {
  type Step,
  type Variable,
  type VariableSource,
  type VariableType,
  VariableTypeSchema,
  variableSteps,
} from '@xdesign/spec'
import { Trash2Icon } from 'lucide-react'
import { useId, useMemo, useState } from 'react'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Field, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

import { useDesign, useEditor } from '../context'
import { IdNameField, LiveField, StepPlaces } from './fields'

/** The groups of the panel, in the plan's order (04 section 11), by where the value comes from. */
const groups: readonly { label: string; sources: readonly VariableSource[] }[] = [
  { label: 'Built-ins', sources: ['builtin'] },
  { label: 'Saved answers', sources: ['question', 'button'] },
  { label: 'Remembered values', sources: ['remember', 'startLink'] },
  { label: 'Developer outputs', sources: ['devStep'] },
]

const typeNames: Record<VariableType, string> = {
  text: 'Text',
  number: 'Number',
  yesNo: 'Yes or no',
  phone: 'Phone number',
  location: 'Location',
  file: 'File',
  users: 'Users',
  chat: 'Group or channel',
  poll: 'Poll',
}
const typeItems = VariableTypeSchema.options.map((value) => ({ value, label: typeNames[value] }))

/**
 * The variables (04 section 11): built-ins (read-only), saved answers, remembered values and
 * developer outputs, each with its label, type, ID name, test value and the steps that set and use
 * it (a click jumps there); "+ Variable" adds a remembered value or a developer output.
 */
export function VariablesList({ onJump }: { onJump: (step: Step) => void }) {
  const design = useDesign()
  const { edits } = useEditor()
  const [added, setAdded] = useState<string>()
  const places = useMemo(() => variableSteps(design), [design])
  const add = (source: VariableSource) => {
    setAdded(edits.variables.add({ label: 'New variable', type: 'text', source }))
  }
  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => {
        const items = Object.values(design.variables)
          .filter((variable) => group.sources.includes(variable.source))
          .sort((a, b) => a.label.localeCompare(b.label) || a.idName.localeCompare(b.idName))
        return (
          <section key={group.label} className="flex flex-col gap-2">
            <h3 className="text-caption-2 font-bold tracking-(--tracking-label) text-fg-3 uppercase">{group.label}</h3>
            {items.length === 0 ? (
              <p className="text-footnote text-fg-3">None yet</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map((variable) => (
                  <VariableItem
                    key={variable.id}
                    variable={variable}
                    sets={places.sets.get(variable.id)}
                    uses={places.uses.get(variable.id)}
                    focus={variable.id === added}
                    onJump={onJump}
                  />
                ))}
              </ul>
            )}
          </section>
        )
      })}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" className="self-start" />}>
          + Variable
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem
            onClick={() => {
              add('remember')
            }}
          >
            Remembered value
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              add('devStep')
            }}
          >
            Developer output
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function VariableItem({
  variable,
  sets,
  uses,
  focus,
  onJump,
}: {
  variable: Variable
  sets: readonly Step[] | undefined
  uses: readonly Step[] | undefined
  /** Just added: its label takes the focus. */
  focus: boolean
  onJump: (step: Step) => void
}) {
  const { edits } = useEditor()
  const [deleting, setDeleting] = useState(false)
  const typeId = useId()
  if (variable.source === 'builtin') {
    return (
      <li className="flex flex-col gap-1.5 rounded-xl border bg-surface-2 p-3">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold">{variable.label}</span>
          <code className="text-footnote text-fg-2">{`{${variable.idName}}`}</code>
          <span className="ms-auto text-footnote text-fg-3">{typeNames[variable.type]}</span>
        </div>
        {variable.description ? <p className="text-footnote text-fg-3">{variable.description}</p> : null}
        <StepPlaces label="Used in" steps={uses} onJump={onJump} />
      </li>
    )
  }
  const steps = new Set([...(sets ?? []), ...(uses ?? [])]).size
  const remove = () => {
    edits.variables.remove(variable.id)
  }
  return (
    <li className="flex flex-col gap-3 rounded-xl border bg-surface p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
        <LiveField
          label="Label"
          autoComplete="off"
          // The label of the variable the person just added.
          autoFocus={focus}
          value={variable.label}
          onValue={(label) => {
            edits.variables.set(variable.id, { label })
          }}
        />
        <Field>
          <FieldLabel htmlFor={typeId}>Type</FieldLabel>
          <Select
            items={typeItems}
            value={variable.type}
            onValueChange={(type: VariableType | null) => {
              // A test value of the old type would not fit the new one.
              if (type !== null) edits.variables.set(variable.id, { type, testValue: undefined })
            }}
          >
            <SelectTrigger id={typeId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {typeItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-error-weak hover:text-error"
          aria-label={`Delete ${variable.label}`}
          onClick={() => {
            if (steps > 0) setDeleting(true)
            else remove()
          }}
        >
          <Trash2Icon aria-hidden />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <IdNameField value={variable.idName} onSet={(name) => edits.variables.setIdName(variable.id, name)} />
        <TestValueField variable={variable} />
      </div>
      <StepPlaces label="Set in" steps={sets} onJump={onJump} />
      <StepPlaces label="Used in" steps={uses} onJump={onJump} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${variable.label}?`}
        description={`${String(steps)} ${steps === 1 ? 'step still sets or uses it' : 'steps still set or use it'}; the checks will list them.`}
        confirmLabel="Delete"
        onConfirm={remove}
      />
    </li>
  )
}

/** The value Try it starts with: yes or no, a number, or a text for the other types. */
function TestValueField({ variable }: { variable: Variable }) {
  const { edits } = useEditor()
  const id = useId()
  const { testValue } = variable
  if (variable.type === 'yesNo') {
    return (
      <Field>
        <FieldLabel htmlFor={id}>Test value</FieldLabel>
        <div className="flex h-(--control-h) items-center gap-2 text-callout">
          <Switch
            id={id}
            checked={testValue === true}
            onCheckedChange={(checked) => {
              edits.variables.set(variable.id, { testValue: checked })
            }}
          />
          {testValue === true ? 'Yes' : 'No'}
        </div>
      </Field>
    )
  }
  const number = variable.type === 'number'
  return (
    <LiveField
      label="Test value"
      autoComplete="off"
      inputMode={number ? 'decimal' : undefined}
      value={testValue === undefined ? '' : String(testValue)}
      onValue={(text) => {
        const value = text.trim() === '' ? undefined : number ? Number(text) : text
        if (typeof value === 'number' && !Number.isFinite(value)) return
        edits.variables.set(variable.id, { testValue: value })
      }}
    />
  )
}
