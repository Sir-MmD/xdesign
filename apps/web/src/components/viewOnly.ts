import { createContext, useContext } from 'react'

/**
 * True inside a form that the signed-in admin may look at but not change (docs/plan/20-cards-kinds-x-admins-docker.md
 * section 11.13): `ViewOnlyFields` (src/features/auth/ViewOnly.tsx) provides it. The switches, checkboxes, selects,
 * toggle groups and combobox inputs of the design system read it and disable themselves; native controls follow the
 * `fieldset` that `ViewOnlyFields` renders. Outside such a form it is false and changes nothing.
 */
export const ViewOnlyContext = createContext(false)

/** Whether the controls below are only to be looked at. */
export function useViewOnly(): boolean {
  return useContext(ViewOnlyContext)
}
