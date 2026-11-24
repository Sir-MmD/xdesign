import type { NoteStep } from '@xdesign/spec'
import { useId } from 'react'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { useEditor } from '../context'
import { ColorField, FormSection } from './fields'

/** The Note form (04 section 6): its text (several lines) and the color of its paper on the map. */
export function NoteForm({ step }: { step: NoteStep }) {
  const { edits } = useEditor()
  const textId = useId()
  return (
    <FormSection>
      <div className="grid gap-2">
        <Label htmlFor={textId}>Text</Label>
        <Textarea
          id={textId}
          className="min-h-32"
          value={step.text}
          onChange={(event) => {
            edits.steps.set(step.id, { text: event.target.value })
          }}
        />
      </div>
      <ColorField
        value={step.color}
        onChange={(color) => {
          edits.steps.set(step.id, { color })
        }}
      />
    </FormSection>
  )
}
