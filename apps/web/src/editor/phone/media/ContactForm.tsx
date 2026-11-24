import type { Content, StepId } from '@xdesign/spec'
import { useId } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { useUpdateContent } from '../message'

/** A contact's fields (sendContact): the phone number, the first name and the last name. */
export function ContactForm({ stepId, content }: { stepId: StepId; content: Extract<Content, { type: 'contact' }> }) {
  const update = useUpdateContent(stepId)
  const ids = { phone: useId(), first: useId(), last: useId() }
  const set = (fields: { phone?: string; firstName?: string; lastName?: string | undefined }) => {
    update((now) => (now.type === 'contact' ? { ...now, ...fields } : undefined))
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor={ids.phone}>Phone number</Label>
        <Input
          id={ids.phone}
          type="tel"
          dir="ltr"
          value={content.phone}
          onChange={(event) => {
            set({ phone: event.target.value })
          }}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={ids.first}>First name</Label>
        <Input
          id={ids.first}
          value={content.firstName}
          onChange={(event) => {
            set({ firstName: event.target.value })
          }}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={ids.last}>Last name</Label>
        <Input
          id={ids.last}
          value={content.lastName ?? ''}
          onChange={(event) => {
            set({ lastName: event.target.value === '' ? undefined : event.target.value })
          }}
        />
      </div>
    </div>
  )
}
