// A field bound to the live design (the Texts tab's plain cells, the Variables panel): each change
// is written at once through SPEC-04's accessors, while the field keeps the person's own text as
// long as it has the focus, so another person's change of the same value never moves the caret.
import { useState } from 'react'

export interface Draft {
  /** What the field shows: the person's text while focused, else the design's. */
  value: string
  onFocus: () => void
  onBlur: () => void
  /** Keeps what the person typed (call it with each change, beside the accessor). */
  set: (text: string) => void
}

export function useDraft(value: string): Draft {
  const [draft, setDraft] = useState<string | null>(null)
  return {
    value: draft ?? value,
    onFocus: () => {
      setDraft(value)
    },
    onBlur: () => {
      setDraft(null)
    },
    set: setDraft,
  }
}
