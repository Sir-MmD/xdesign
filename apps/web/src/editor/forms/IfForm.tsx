import { type IfCase, type IfStep, newId } from '@xdesign/spec'
import { ArrowDownIcon, ArrowUpIcon, Trash2Icon } from 'lucide-react'
import { useId } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { useEditor } from '../context'
import { ConditionList } from './ConditionList'
import { Field, FormSection, TargetSelect } from './fields'

/**
 * The If form (04 section 6): the cases in order, the first that holds deciding, each with its
 * "Case name", "all of these" or "any of these", its conditions as sentences of selects and the
 * whole condition in words (EXP-01's sayCondition), and where it goes; "+ Case"; "Otherwise" and
 * where it goes. The case names are the labels of the box's dots.
 */
export function IfForm({ step }: { step: IfStep }) {
  const { edits, readOnly } = useEditor()
  const setCases = (cases: IfCase[]) => {
    edits.steps.set(step.id, { cases })
  }
  return (
    <>
      {step.cases.map((item, index) => (
        <CaseSection
          key={item.id}
          step={step}
          item={item}
          index={index}
          onChange={(patch) => {
            setCases(step.cases.map((other) => (other.id === item.id ? { ...other, ...patch } : other)))
          }}
          onMove={(by) => {
            const cases = [...step.cases]
            cases.splice(index, 1)
            cases.splice(index + by, 0, item)
            setCases(cases)
          }}
          onRemove={() => {
            setCases(step.cases.filter((other) => other.id !== item.id))
          }}
        />
      ))}
      {readOnly ? null : (
        <div className="border-t px-4 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setCases([...step.cases, { id: newId(), label: '', when: { all: [] } }])
            }}
          >
            + Case
          </Button>
        </div>
      )}
      <FormSection title="Otherwise">
        <Field label="Goes to" hint="When no case holds.">
          {(labelId) => (
            <TargetSelect
              from={step}
              value={step.otherwise}
              aria-labelledby={labelId}
              onChange={(target) => {
                edits.steps.connect({ step: step.id, arrow: 'otherwise' }, target)
              }}
            />
          )}
        </Field>
      </FormSection>
    </>
  )
}

function CaseSection({
  step,
  item,
  index,
  onChange,
  onMove,
  onRemove,
}: {
  step: IfStep
  item: IfCase
  index: number
  onChange: (patch: Partial<IfCase>) => void
  onMove: (by: -1 | 1) => void
  onRemove: () => void
}) {
  const { edits } = useEditor()
  const nameId = useId()
  const fallback = `Case ${String(index + 1)}`
  return (
    <FormSection
      title={item.label.trim() || fallback}
      actions={
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Move up"
            disabled={index === 0}
            onClick={() => {
              onMove(-1)
            }}
          >
            <ArrowUpIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Move down"
            disabled={index === step.cases.length - 1}
            onClick={() => {
              onMove(1)
            }}
          >
            <ArrowDownIcon />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Delete this case" onClick={onRemove}>
            <Trash2Icon />
          </Button>
        </>
      }
    >
      <div className="grid gap-2">
        <Label htmlFor={nameId}>Case name</Label>
        <Input
          id={nameId}
          placeholder={fallback}
          value={item.label}
          onChange={(event) => {
            onChange({ label: event.target.value })
          }}
        />
      </div>
      <ConditionList
        when={item.when}
        lead="If"
        onChange={(when) => {
          onChange({ when })
        }}
      />
      <Field label="Goes to">
        {(labelId) => (
          <TargetSelect
            from={step}
            value={item.goTo}
            aria-labelledby={labelId}
            onChange={(target) => {
              edits.steps.connect({ step: step.id, case: item.id }, target)
            }}
          />
        )}
      </Field>
    </FormSection>
  )
}
