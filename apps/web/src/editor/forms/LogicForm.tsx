import { KIND_ICONS } from '../map/kinds'
import { ActionForm } from './ActionForm'
import { DevStepForm } from './DevStepForm'
import { EndForm } from './EndForm'
import { FormSection, TitleField } from './fields'
import { GoToForm } from './GoToForm'
import { IfForm } from './IfForm'
import { LOGIC_NAMES, type LogicStep } from './logic'
import { NoteForm } from './NoteForm'
import { RememberForm } from './RememberForm'
import { SectionForm } from './SectionForm'
import { WaitForm } from './WaitForm'

/**
 * The phone pane for a logic step (04 sections 4.4 and 6): the kind's name, then its form alone,
 * as nothing of it shows in the chat: the step's "Title" (its box's name on the map), then the
 * kind's own fields. Every change goes through SPEC-04's accessors, so others see it at once.
 */
export function LogicForm({ step }: { step: LogicStep }) {
  const Icon = KIND_ICONS[step.kind]
  return (
    <>
      <div className="flex min-h-12 items-center gap-2 border-b px-4 py-2">
        <Icon aria-hidden className="size-4 shrink-0 text-fg-3" />
        <h2 className="text-callout font-semibold">{LOGIC_NAMES[step.kind]}</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <FormSection>
          <TitleField step={step} />
        </FormSection>
        <KindForm step={step} />
      </div>
    </>
  )
}

function KindForm({ step }: { step: LogicStep }) {
  switch (step.kind) {
    case 'if':
      return <IfForm step={step} />
    case 'remember':
      return <RememberForm step={step} />
    case 'wait':
      return <WaitForm step={step} />
    case 'devStep':
      return <DevStepForm step={step} />
    case 'goTo':
      return <GoToForm step={step} />
    case 'end':
      return <EndForm />
    case 'note':
      return <NoteForm step={step} />
    case 'frame':
      return <SectionForm step={step} />
    case 'action':
      return <ActionForm step={step} />
  }
}
