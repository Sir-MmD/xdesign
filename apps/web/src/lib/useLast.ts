import { useState } from 'react'

/**
 * The value, or while it is undefined the last one that was not: what a dialog opened for an
 * item (a design, a member) keeps showing while it closes.
 */
export function useLast<T>(value: T | undefined): T | undefined {
  const [last, setLast] = useState(value)
  if (value !== undefined && value !== last) setLast(value)
  return value ?? last
}
