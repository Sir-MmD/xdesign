import type { GoToStep } from '@xdesign/spec'

import { useEditor } from '../context'
import { Field, FormSection, TargetSelect } from './fields'

/** The Go to form (04 section 6): the step it jumps to (its dot's arrow on the map, drawn dashed). */
export function GoToForm({ step }: { step: GoToStep }) {
  const { edits } = useEditor()
  return (
    <FormSection>
      <Field label="Go to">
        {(labelId) => (
          <TargetSelect
            from={step}
            value={step.target}
            aria-labelledby={labelId}
            onChange={(target) => {
              edits.steps.connect({ step: step.id, arrow: 'target' }, target)
            }}
          />
        )}
      </Field>
    </FormSection>
  )
}
