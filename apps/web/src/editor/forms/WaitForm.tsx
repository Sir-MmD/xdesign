import type { WaitStep } from '@xdesign/spec'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import { useDesign, useEditor } from '../context'
import { NumberInput } from '../phone/NumberInput'
import { ConditionList } from './ConditionList'
import { Field, FormSection, TargetSelect } from './fields'
import { SwitchRow } from './start/fields'
import { newCondition } from './values'

type Unit = WaitStep['unit']

const units: readonly Unit[] = ['seconds', 'minutes', 'hours', 'days']

/**
 * The Wait form (04 section 6): "Wait [2] [hours]"; "If the user does something before the time
 * is up": "Stop waiting" (the default) or "Still go on"; with "Stop waiting", "Only once these
 * hold" makes it a reminder (its conditions, EVT-02: "unless the user has paid"); and "Then".
 */
export function WaitForm({ step }: { step: WaitStep }) {
  const design = useDesign()
  const { edits } = useEditor()
  // "1 hour", "2 hours".
  const unitItems = units.map((unit) => ({ value: unit, label: step.amount === 1 ? unit.slice(0, -1) : unit }))
  return (
    <>
      <FormSection>
        <div className="flex flex-wrap items-center gap-2 text-callout">
          <span>Wait</span>
          <NumberInput
            aria-label="How long"
            className="h-(--control-h-sm) w-20"
            value={step.amount}
            min={1}
            max={9999}
            whole
            onCommit={(amount) => {
              edits.steps.set(step.id, { amount })
            }}
          />
          <Select<Unit>
            items={unitItems}
            value={step.unit}
            onValueChange={(unit) => {
              if (unit !== null && unit !== step.unit) edits.steps.set(step.id, { unit })
            }}
          >
            <SelectTrigger size="sm" aria-label="Unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {unitItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Field label="If the user does something before the time is up">
          {(labelId) => (
            <ToggleGroup
              aria-labelledby={labelId}
              spacing={0}
              value={[step.ifUserActs]}
              onValueChange={([choice]) => {
                // Only a wait that stops has conditions to stop on.
                if (choice === 'cancel' && choice !== step.ifUserActs) edits.steps.set(step.id, { ifUserActs: choice })
                else if (choice === 'keep' && choice !== step.ifUserActs) {
                  edits.steps.set(step.id, { ifUserActs: choice, stopWhen: undefined })
                }
              }}
            >
              <ToggleGroupItem value="cancel">Stop waiting</ToggleGroupItem>
              <ToggleGroupItem value="keep">Still go on</ToggleGroupItem>
            </ToggleGroup>
          )}
        </Field>
        {step.ifUserActs === 'cancel' ? (
          <div className="grid gap-2">
            <SwitchRow
              label="Only once these hold"
              checked={step.stopWhen !== undefined}
              onChange={(on) => {
                edits.steps.set(step.id, { stopWhen: on ? { all: [newCondition(design)] } : undefined })
              }}
            />
            {step.stopWhen ? (
              <ConditionList
                when={step.stopWhen}
                lead="Stops waiting once"
                onChange={(stopWhen) => {
                  edits.steps.set(step.id, { stopWhen })
                }}
              />
            ) : (
              <p className="text-footnote text-fg-3">Anything the user does stops the wait.</p>
            )}
          </div>
        ) : null}
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
