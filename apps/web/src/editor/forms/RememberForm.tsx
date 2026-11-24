import type { RememberAction, RememberStep } from '@xdesign/spec'
import { XIcon } from 'lucide-react'
import { type ReactNode, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { useDesign, useEditor } from '../context'
import { Field, FormSection, TargetSelect } from './fields'
import { groupVariables } from './logic'
import { ValueInput } from './ValueInput'
import { rememberValueKind } from './values'
import { NewName, VariableSelect } from './VariableSelect'

type Op = RememberAction['op']

const opItems: { value: Op; label: string }[] = [
  { value: 'set', label: 'Set' },
  { value: 'add', label: 'Add' },
  { value: 'subtract', label: 'Subtract' },
  { value: 'clear', label: 'Clear' },
  { value: 'append', label: 'Append' },
]

/**
 * The Remember form (04 section 6): its lines in order as sentences, "[Set] [cart_count] [to]
 * [0]", "[Add] [1] [to] [cart_count]", "[Subtract] [1] [from] [cart_count]", "[Clear] [coupon]",
 * "[Append] [{answer}] [to] [notes]", each with its remove mark; "+ Action"; and "Then".
 */
export function RememberForm({ step }: { step: RememberStep }) {
  const { edits } = useEditor()
  return (
    <>
      <FormSection>
        <RememberLines
          lines={step.actions}
          onChange={(actions) => {
            edits.steps.set(step.id, { actions })
          }}
        />
      </FormSection>
      <FormSection>
        <Field label="Then">
          {(labelId) => (
            <TargetSelect
              from={step}
              value={step.next}
              aria-labelledby={labelId}
              onChange={(target) => {
                edits.steps.connect({ step: step.id, arrow: 'next' }, target)
              }}
            />
          )}
        </Field>
      </FormSection>
    </>
  )
}

/**
 * Remember lines as sentences, each with its remove mark, and "+ Action": the Remember form's, and
 * a button's "Also remember" (BTN-01).
 */
export function RememberLines({
  lines,
  onChange,
}: {
  lines: readonly RememberAction[]
  onChange: (lines: RememberAction[]) => void
}) {
  const design = useDesign()
  const { edits, readOnly } = useEditor()
  const [naming, setNaming] = useState(false)
  // A new line sets the first variable a step can set; without one, it is named first.
  const first = groupVariables(Object.values(design.variables).filter((variable) => variable.source !== 'builtin'))[0]
    ?.items[0]
  return (
    <>
      {lines.length === 0 ? <p className="text-callout text-fg-3">Nothing to remember yet</p> : null}
      {lines.map((action, index) => (
        <ActionRow
          key={index}
          action={action}
          onChange={(next) => {
            onChange(lines.map((other, at) => (at === index ? next : other)))
          }}
          onRemove={() => {
            onChange(lines.filter((_other, at) => at !== index))
          }}
        />
      ))}
      {readOnly ? null : naming ? (
        <NewName
          placeholder="Name"
          onAdd={(name) => {
            setNaming(false)
            const id = edits.variables.add({ label: name, type: 'text', source: 'remember' })
            onChange([...lines, { var: id, op: 'set' }])
          }}
          onCancel={() => {
            setNaming(false)
          }}
        />
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() => {
            if (first) onChange([...lines, { var: first.id, op: 'set' }])
            else setNaming(true)
          }}
        >
          + Action
        </Button>
      )}
    </>
  )
}

function ActionRow({
  action,
  onChange,
  onRemove,
}: {
  action: RememberAction
  onChange: (action: RememberAction) => void
  onRemove: () => void
}) {
  const design = useDesign()
  const { readOnly } = useEditor()
  const number = action.op === 'add' || action.op === 'subtract'
  const variable = (
    <VariableSelect
      aria-label="Variable"
      which="settable"
      newVariable={{ source: 'remember', type: number ? 'number' : 'text' }}
      className="max-w-full"
      value={action.var}
      onChange={(id) => {
        onChange({ ...action, var: id })
      }}
    />
  )
  const value = (
    <ValueInput
      aria-label="Value"
      placeholder="Value"
      className="h-(--control-h-sm) w-24 min-w-0 flex-1"
      kind={rememberValueKind(action, design)}
      value={action.value}
      onCommit={(next) => {
        onChange(next === undefined ? { var: action.var, op: action.op } : { ...action, value: next })
      }}
    />
  )
  let sentence: ReactNode
  switch (action.op) {
    case 'set':
      sentence = (
        <>
          {variable}
          <Word>to</Word>
          {value}
        </>
      )
      break
    case 'clear':
      sentence = variable
      break
    case 'subtract':
      sentence = (
        <>
          {value}
          <Word>from</Word>
          {variable}
        </>
      )
      break
    case 'add':
    case 'append':
      sentence = (
        <>
          {value}
          <Word>to</Word>
          {variable}
        </>
      )
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Select<Op>
        items={opItems}
        value={action.op}
        onValueChange={(op) => {
          if (op === null || op === action.op) return
          onChange(op === 'clear' || action.value === undefined ? { var: action.var, op } : { ...action, op })
        }}
      >
        <SelectTrigger size="sm" aria-label="What to do">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {opItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {sentence}
      {readOnly ? null : (
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove this line" onClick={onRemove}>
          <XIcon />
        </Button>
      )}
    </div>
  )
}

function Word({ children }: { children: ReactNode }) {
  return <span className="text-callout">{children}</span>
}
