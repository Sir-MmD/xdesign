import { type DevStep, newId, type Outcome } from '@xdesign/spec'
import { XIcon } from 'lucide-react'
import { useId } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { useEditor } from '../context'
import { Field, FormSection, TargetSelect } from './fields'
import { VariableList } from './VariableSelect'

/**
 * The Developer step form (04 section 6): "What the developer does" (several lines), "Uses" and
 * "Gives back" (variables, "+ New variable"), and "Outcomes": named, at least one ("Done" at
 * first), each a dot of the box with where it goes.
 */
export function DevStepForm({ step }: { step: DevStep }) {
  const { edits, readOnly } = useEditor()
  const descriptionId = useId()
  const setOutcomes = (outcomes: Outcome[]) => {
    edits.steps.set(step.id, { outcomes })
  }
  return (
    <>
      <FormSection>
        <div className="grid gap-2">
          <Label htmlFor={descriptionId}>What the developer does</Label>
          <Textarea
            id={descriptionId}
            className="min-h-24"
            value={step.description}
            onChange={(event) => {
              edits.steps.set(step.id, { description: event.target.value })
            }}
          />
        </div>
        <Field label="Uses">
          {(labelId) => (
            <VariableList
              aria-labelledby={labelId}
              value={step.uses}
              onChange={(uses) => {
                edits.steps.set(step.id, { uses })
              }}
            />
          )}
        </Field>
        <Field label="Gives back">
          {(labelId) => (
            <VariableList
              aria-labelledby={labelId}
              which="settable"
              newVariable={{ source: 'devStep', type: 'text' }}
              value={step.sets}
              onChange={(sets) => {
                edits.steps.set(step.id, { sets })
              }}
            />
          )}
        </Field>
      </FormSection>
      <FormSection title="Outcomes">
        {step.outcomes.map((outcome, index) => (
          <OutcomeRow
            key={outcome.id}
            step={step}
            outcome={outcome}
            index={index}
            onChange={(patch) => {
              setOutcomes(step.outcomes.map((other) => (other.id === outcome.id ? { ...other, ...patch } : other)))
            }}
            onRemove={
              step.outcomes.length > 1
                ? () => {
                    setOutcomes(step.outcomes.filter((other) => other.id !== outcome.id))
                  }
                : undefined
            }
          />
        ))}
        {readOnly ? null : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => {
              setOutcomes([...step.outcomes, { id: newId(), label: '' }])
            }}
          >
            + Outcome
          </Button>
        )}
      </FormSection>
    </>
  )
}

function OutcomeRow({
  step,
  outcome,
  index,
  onChange,
  onRemove,
}: {
  step: DevStep
  outcome: Outcome
  index: number
  onChange: (patch: Partial<Outcome>) => void
  /** Undefined for the last outcome left. */
  onRemove: (() => void) | undefined
}) {
  const { edits, readOnly } = useEditor()
  const fallback = `Outcome ${String(index + 1)}`
  return (
    <div className="grid gap-2 rounded-lg border p-3">
      <div className="flex items-center gap-1.5">
        <Input
          aria-label="Outcome name"
          placeholder={fallback}
          className="h-(--control-h-sm) min-w-0 flex-1"
          value={outcome.label}
          onChange={(event) => {
            onChange({ label: event.target.value })
          }}
        />
        {readOnly ? null : (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remove this outcome"
            disabled={onRemove === undefined}
            onClick={onRemove}
          >
            <XIcon />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2 text-callout">
        <span className="shrink-0">Goes to</span>
        <TargetSelect
          from={step}
          value={outcome.goTo}
          aria-label={`Where ${outcome.label.trim() || fallback} goes`}
          onChange={(target) => {
            edits.steps.connect({ step: step.id, outcome: outcome.id }, target)
          }}
        />
      </div>
    </div>
  )
}
