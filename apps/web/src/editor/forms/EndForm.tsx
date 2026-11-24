import { FormSection } from './fields'

/** The End form (04 section 6): no fields, what happens next in words. */
export function EndForm() {
  return (
    <FormSection>
      <p className="text-callout text-fg-2">
        The conversation ends. The next message goes to &apos;Anything else&apos;.
      </p>
    </FormSection>
  )
}
