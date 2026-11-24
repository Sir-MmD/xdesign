import type { FrameStep } from '@xdesign/spec'

import { useEditor } from '../context'
import { ColorField, FormSection } from './fields'

/**
 * The Section form (04 section 6): its color (its title is the form's "Title"); the steps dragged
 * into it on the map belong to it.
 */
export function SectionForm({ step }: { step: FrameStep }) {
  const { edits } = useEditor()
  return (
    <FormSection>
      <ColorField
        value={step.color}
        onChange={(color) => {
          edits.steps.set(step.id, { color })
        }}
      />
    </FormSection>
  )
}
