import { cn } from '@/lib/utils'

import { useEditor } from '../context'
import { useDraft } from '../useDraft'
import type { CellState, PlainRow } from './rows'

/**
 * A plain text's cell in the Texts tab (04 section 10): a field written through SPEC-04's
 * `setPlain` at each change, so the others see it at once (useDraft.ts). Enter leaves it;
 * Shift+Enter starts a new line in the texts that take several.
 */
export function PlainCell({
  row,
  lang,
  state,
  label,
  rtl,
  copiedNote,
}: {
  row: PlainRow
  lang: string
  state: CellState
  /** The cell's name for screen readers: the group, the text and the language. */
  label: string
  rtl: boolean
  /** The tooltip of a copied text ("Copied from English, not translated until edited"). */
  copiedNote: string
}) {
  const { edits, readOnly } = useEditor()
  const value = row.plain[lang] ?? ''
  const draft = useDraft(value)
  if (readOnly) {
    return (
      <p
        dir={rtl ? 'rtl' : 'auto'}
        title={state === 'copied' ? copiedNote : undefined}
        className={cn(
          'min-h-8 px-2 py-1.5 whitespace-pre-wrap',
          state === 'copied' && 'text-fg-2 italic',
          state === 'missing' && 'text-warn',
        )}
      >
        {value === '' && state === 'missing' ? 'Missing' : value}
      </p>
    )
  }
  return (
    <textarea
      aria-label={label}
      dir={rtl ? 'rtl' : 'auto'}
      rows={1}
      spellCheck
      value={draft.value}
      placeholder={state === 'missing' ? 'Missing' : undefined}
      title={state === 'copied' ? copiedNote : undefined}
      className={cn(
        'block field-sizing-content min-h-8 w-full resize-none rounded-md border border-transparent bg-transparent px-2 py-1.5 text-callout text-foreground transition-[border-color,box-shadow] duration-(--dur-fast) ease-(--ease) outline-none placeholder:text-warn hover:border-control focus-visible:border-focus focus-visible:bg-surface focus-visible:shadow-[0_0_0_1px_var(--focus),0_0_0_4px_var(--focus-halo)]',
        state === 'copied' && 'text-fg-2 italic',
      )}
      onFocus={draft.onFocus}
      onBlur={draft.onBlur}
      onChange={(event) => {
        draft.set(event.target.value)
        edits.texts.setPlain(row.at, lang, event.target.value)
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' || event.nativeEvent.isComposing || (row.multiline && event.shiftKey)) return
        event.preventDefault()
        event.currentTarget.blur()
      }}
    />
  )
}
