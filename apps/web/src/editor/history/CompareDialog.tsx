import { CircleCheckIcon } from 'lucide-react'
import { useMemo, useSyncExternalStore } from 'react'

import { EmptyState } from '@/components/EmptyState'
import { LanguageFlag } from '@/components/LanguagePicker'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { findLanguage, languageName } from '@/lib/languages'
import { cn } from '@/lib/utils'

import { useEditor, useLang } from '../context'
import { compareDesigns, type StepChange, type TextChange } from './compare'
import { useHistory, useHistoryStore } from './store'
import { versionTitle } from './versions'

const groups: readonly { change: StepChange['change']; label: string }[] = [
  { change: 'added', label: 'Added' },
  { change: 'removed', label: 'Removed' },
  { change: 'changed', label: 'Changed' },
]

/**
 * "Compare with now" (05 section 7 item 4): the steps added, removed and changed between the open
 * version and now, with the old texts beside the new ones, and the other parts that changed.
 */
export function CompareDialog() {
  const store = useHistoryStore()
  const open = useHistory((state) => state.dialog?.kind === 'compare')
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) store.close()
      }}
    >
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-3xl">
        <Changes />
      </DialogContent>
    </Dialog>
  )
}

function Changes() {
  const { live } = useEditor()
  const lang = useLang()
  const viewed = useHistory((state) => state.viewed)
  // The live design: the editor's own design is the version while it is open.
  const now = useSyncExternalStore(live.subscribe, () => live.getState().design)
  const changes = useMemo(() => (viewed && now ? compareDesigns(viewed.design, now, lang) : null), [viewed, now, lang])
  if (!viewed || !changes) return null
  const title = versionTitle(viewed.version)
  const multilingual = new Set([...viewed.design.languages.list, ...(now?.languages.list ?? [])]).size > 1
  const empty = changes.steps.length === 0 && changes.also.length === 0
  return (
    <>
      <DialogHeader>
        <DialogTitle>Compare with now</DialogTitle>
        <DialogDescription dir="auto">{title} on the left, now on the right.</DialogDescription>
      </DialogHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
        {empty ? <EmptyState icon={CircleCheckIcon} title="No changes" /> : null}
        {groups.map((group) => {
          const steps = changes.steps.filter((step) => step.change === group.change)
          if (steps.length === 0) return null
          return (
            <section key={group.change} className="flex flex-col gap-2">
              <h3 className="flex items-baseline gap-1.5 text-caption-2 font-bold tracking-(--tracking-label) text-fg-3 uppercase">
                {group.label}
                <span className="tabular-nums">{steps.length}</span>
              </h3>
              <ul className="flex flex-col gap-2">
                {steps.map((step) => (
                  <StepLines key={step.id} step={step} multilingual={multilingual} />
                ))}
              </ul>
            </section>
          )
        })}
        {changes.also.length > 0 ? (
          <p className="text-subhead text-fg-2">Also changed: {changes.also.join(', ')}</p>
        ) : null}
      </div>
    </>
  )
}

/** A step: its name, then each text with the version's words beside now's. */
function StepLines({ step, multilingual }: { step: StepChange; multilingual: boolean }) {
  return (
    <li className="flex flex-col gap-2 rounded-xl border bg-surface-2 p-3">
      <span dir="auto" className="truncate text-subhead font-semibold">
        {step.name}
      </span>
      {step.texts.map((text, index) => (
        <TextLine key={`${text.what} ${text.lang} ${String(index)}`} text={text} multilingual={multilingual} />
      ))}
      {step.other ? <span className="text-footnote text-fg-3">Other changes</span> : null}
    </li>
  )
}

function TextLine({ text, multilingual }: { text: TextChange; multilingual: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-footnote font-semibold text-fg-2">
        {text.what}
        {multilingual && text.lang !== '' ? (
          <span
            title={languageName(text.lang)}
            className="flex items-center gap-1 rounded-sm bg-surface px-1.5 text-caption-2 font-bold text-fg-3"
          >
            <LanguageFlag language={findLanguage(text.lang)} />
            {text.lang.toUpperCase()}
          </span>
        ) : null}
      </span>
      <div className="grid grid-cols-2 gap-2">
        <Words words={text.before} gone />
        <Words words={text.after} />
      </div>
    </div>
  )
}

function Words({ words, gone = false }: { words: string; gone?: boolean }) {
  return (
    <p
      dir="auto"
      className={cn(
        'min-h-8 rounded-lg px-2 py-1.5 text-subhead break-words whitespace-pre-wrap',
        words === '' ? 'bg-surface' : gone ? 'bg-error-weak' : 'bg-ok-weak',
      )}
    >
      {words}
    </p>
  )
}
