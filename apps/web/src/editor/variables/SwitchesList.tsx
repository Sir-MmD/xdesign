import type { Step, TestSwitch } from '@xdesign/spec'
import { Trash2Icon } from 'lucide-react'
import { useId, useMemo, useState } from 'react'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

import { useDesign, useEditor } from '../context'
import { IdNameField, LiveField, StepPlaces } from './fields'

const typeItems = [
  { value: 'yesNo', label: 'Yes or no' },
  { value: 'choice', label: 'A choice' },
] as const

/** The options of a choice as the field writes them: one per line. */
function optionList(text: string): string[] {
  return text
    .split('\n')
    .map((option) => option.trim())
    .filter((option) => option !== '')
}

/**
 * The test switches (04 section 11): facts about the user only the developer knows ("User is
 * admin"), which set the If steps' way in Try it. Each with its label, type (yes or no, or a choice
 * with options), test value, "How the developer knows it" and the If steps that use it; "+ Switch".
 */
export function SwitchesList({ onJump }: { onJump: (step: Step) => void }) {
  const design = useDesign()
  const { edits } = useEditor()
  const [added, setAdded] = useState<string>()
  // The If steps that use each switch, in map order.
  const uses = useMemo(() => {
    const map = new Map<string, Step[]>()
    const steps = Object.values(design.steps).sort((a, b) => a.x - b.x || a.y - b.y)
    for (const step of steps) {
      if (step.kind !== 'if') continue
      const ids = new Set(
        step.cases.flatMap((item) =>
          ('all' in item.when ? item.when.all : item.when.any).flatMap((term) =>
            'switch' in term ? [term.switch] : [],
          ),
        ),
      )
      for (const id of ids) map.set(id, [...(map.get(id) ?? []), step])
    }
    return map
  }, [design.steps])
  const items = Object.values(design.switches).sort(
    (a, b) => a.label.localeCompare(b.label) || a.idName.localeCompare(b.idName),
  )
  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 ? (
        <p className="text-footnote text-fg-3">None yet</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <SwitchItem key={item.id} item={item} uses={uses.get(item.id)} focus={item.id === added} onJump={onJump} />
          ))}
        </ul>
      )}
      <Button
        variant="outline"
        className="mt-3 self-start"
        onClick={() => {
          setAdded(edits.switches.add({ label: 'New switch', type: 'yesNo', testValue: false }))
        }}
      >
        + Switch
      </Button>
    </div>
  )
}

function SwitchItem({
  item,
  uses,
  focus,
  onJump,
}: {
  item: TestSwitch
  uses: readonly Step[] | undefined
  /** Just added: its label takes the focus. */
  focus: boolean
  onJump: (step: Step) => void
}) {
  const { edits } = useEditor()
  const [deleting, setDeleting] = useState(false)
  const typeId = useId()
  const valueId = useId()
  const options = item.options ?? []
  const remove = () => {
    edits.switches.remove(item.id)
  }
  return (
    <li className="flex flex-col gap-3 rounded-xl border bg-surface p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
        <LiveField
          label="Label"
          autoComplete="off"
          // The label of the switch the person just added.
          autoFocus={focus}
          value={item.label}
          onValue={(label) => {
            edits.switches.set(item.id, { label })
          }}
        />
        <Field>
          <FieldLabel htmlFor={typeId}>Type</FieldLabel>
          <Select
            items={typeItems}
            value={item.type}
            onValueChange={(type: TestSwitch['type'] | null) => {
              if (type === 'yesNo') edits.switches.set(item.id, { type, options: undefined, testValue: false })
              else if (type === 'choice') edits.switches.set(item.id, { type, options, testValue: options[0] ?? '' })
            }}
          >
            <SelectTrigger id={typeId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {typeItems.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-error-weak hover:text-error"
          aria-label={`Delete ${item.label}`}
          onClick={() => {
            if (uses && uses.length > 0) setDeleting(true)
            else remove()
          }}
        >
          <Trash2Icon aria-hidden />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <IdNameField value={item.idName} onSet={(name) => edits.switches.setIdName(item.id, name)} />
        {item.type === 'yesNo' ? (
          <Field>
            <FieldLabel htmlFor={valueId}>Test value</FieldLabel>
            <div className="flex h-(--control-h) items-center gap-2 text-callout">
              <Switch
                id={valueId}
                checked={item.testValue === true}
                onCheckedChange={(checked) => {
                  edits.switches.set(item.id, { testValue: checked })
                }}
              />
              {item.testValue === true ? 'Yes' : 'No'}
            </div>
          </Field>
        ) : (
          <Field>
            <FieldLabel htmlFor={valueId}>Test value</FieldLabel>
            <Select
              items={options.map((option) => ({ value: option, label: option }))}
              value={typeof item.testValue === 'string' && options.includes(item.testValue) ? item.testValue : null}
              onValueChange={(value: string | null) => {
                if (value !== null) edits.switches.set(item.id, { testValue: value })
              }}
            >
              <SelectTrigger id={valueId} className="w-full" disabled={options.length === 0}>
                <SelectValue placeholder="No options yet" />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>
      {item.type === 'choice' ? (
        <LiveField
          label="Options, one per line"
          multiline
          value={options.join('\n')}
          onValue={(text) => {
            const next = optionList(text)
            // The test value stays one of the options.
            const testValue =
              typeof item.testValue === 'string' && next.includes(item.testValue) ? item.testValue : (next[0] ?? '')
            edits.switches.set(item.id, { options: next, testValue })
          }}
        />
      ) : null}
      <LiveField
        label="How the developer knows it"
        multiline
        value={item.description ?? ''}
        onValue={(text) => {
          edits.switches.set(item.id, { description: text === '' ? undefined : text })
        }}
      />
      <StepPlaces label="Used in" steps={uses} onJump={onJump} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${item.label}?`}
        description={`${String(uses?.length ?? 0)} ${uses?.length === 1 ? 'If step still uses it' : 'If steps still use it'}; the checks will list them.`}
        confirmLabel="Delete"
        onConfirm={remove}
      />
    </li>
  )
}
