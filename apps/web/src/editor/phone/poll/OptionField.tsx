// A poll's or quiz's option in the phone's bubble, written in place (docs/plan/04 section 5.1,
// MSG-03; PRV-02's `option` slot): a plain text in the language shown, written at each change
// through SPEC-04's setPlain while the field keeps the person's own text (useDraft). A language
// without the option's text shows the default language's as the placeholder. The field draws in
// the preview's shadow root, so it takes the bubble's font and colors through inline styles.
import type { LangText, StepId } from '@xdesign/spec'

import { useDesign, useEditor, useLang } from '../../context'
import { useDraft } from '../../useDraft'

const fieldStyle = {
  display: 'block',
  width: '100%',
  margin: 0,
  padding: 0,
  border: 0,
  outline: 'none',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
} as const

export function OptionField({ stepId, index, option }: { stepId: StepId; index: number; option: LangText }) {
  const design = useDesign()
  const lang = useLang()
  const { edits } = useEditor()
  const draft = useDraft(option[lang] ?? '')
  const name = `Option ${String(index + 1)}`
  const fallback = lang === design.languages.default ? undefined : option[design.languages.default]
  return (
    <input
      value={draft.value}
      placeholder={fallback ?? name}
      aria-label={name}
      dir="auto"
      style={fieldStyle}
      onFocus={draft.onFocus}
      onBlur={draft.onBlur}
      onChange={(event) => {
        const text = event.target.value
        draft.set(text)
        edits.texts.setPlain({ step: stepId, field: 'option', option: index }, lang, text)
      }}
    />
  )
}
