import { GlobeIcon } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/ui/combobox'
import { findLanguage, type Language, languageName, languages, searchLanguages } from '@/lib/languages'
import { cn } from '@/lib/utils'
import '@/styles/flags.gen.css'

/**
 * Chooses a language from lib/languages.ts (docs/plan/04 section 3), after xWriter's
 * LanguagePicker without its recent choices: the trigger shows the flag, the English name, the
 * code and "RTL" for a right-to-left language; the popup searches English and native names,
 * codes and other names. `exclude` leaves languages out (those a design already has). With no
 * `value` the trigger shows `placeholder` and stays empty after a choice ("Add a language").
 */
export function LanguagePicker({
  value,
  onChange,
  exclude,
  id,
  disabled,
  placeholder = 'Choose a language',
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  className,
}: {
  /** The chosen language code. */
  value: string | undefined
  onChange: (code: string) => void
  exclude?: readonly string[]
  id?: string
  disabled?: boolean
  placeholder?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  className?: string
}) {
  const [query, setQuery] = useState('')
  const selected = findLanguage(value)
  const all = useMemo(
    () => (exclude === undefined ? languages : languages.filter((language) => !exclude.includes(language.code))),
    [exclude],
  )
  const shown = useMemo(
    () => (query.trim() === '' ? all : searchLanguages(query).filter((language) => all.includes(language))),
    [query, all],
  )

  return (
    <Combobox<Language>
      items={all}
      filteredItems={shown}
      filter={null}
      value={selected ?? null}
      onValueChange={(language) => {
        if (language) onChange(language.code)
      }}
      inputValue={query}
      onInputValueChange={setQuery}
      // Each opening starts with the whole list.
      onOpenChange={(open) => {
        if (!open) setQuery('')
      }}
      itemToStringLabel={(language) => language.english}
      itemToStringValue={(language) => language.code}
      isItemEqualToValue={(a, b) => a.code === b.code}
      disabled={disabled}
    >
      <ComboboxTrigger
        id={id}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        render={
          <Button
            type="button"
            variant="outline"
            // The look of a select field (components/ui/select.tsx), not of a button.
            className={cn(
              'w-full justify-between rounded-md border-control bg-surface ps-3 pe-2.5 text-body font-normal text-foreground hover:border-fg-3 hover:bg-surface hover:text-foreground aria-expanded:border-focus aria-expanded:bg-surface aria-expanded:text-foreground aria-expanded:shadow-[0_0_0_1px_var(--focus),0_0_0_4px_var(--focus-halo)]',
              className,
            )}
          />
        }
      >
        {selected ? <LanguageSummary language={selected} /> : <span className="text-fg-3">{placeholder}</span>}
      </ComboboxTrigger>
      <ComboboxContent className="min-w-72">
        <ComboboxInput placeholder="Search by name or code" showTrigger={false} aria-label="Search languages" />
        <ComboboxEmpty>No language matches.</ComboboxEmpty>
        <ComboboxList>
          {(language: Language) => (
            <ComboboxItem key={language.code} value={language}>
              <LanguageRow language={language} />
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

/**
 * A language's flag, or a globe where a country flag would be wrong (decorative), from xWriter
 * (docs/plan/16 section 3): before a language's name in every list, menu, label, chip and column.
 * Both follow the font size (the flag is 1em high), so small chips stay small.
 */
export function LanguageFlag({ language, className }: { language: Language | undefined; className?: string }) {
  if (!language?.flag) {
    return <GlobeIcon aria-hidden className={cn('size-[1.1em] shrink-0 self-center text-fg-3', className)} />
  }
  return <span aria-hidden className={cn('fi shrink-0 self-center rounded-[2px]', `fi-${language.flag}`, className)} />
}

/** The English names of languages between commas, each after its flag (the cards' languages). */
export function LanguageNames({ codes }: { codes: readonly string[] }) {
  return codes.map((code, index) => (
    <Fragment key={code}>
      {index > 0 ? ', ' : null}
      <span className="inline-flex items-center gap-1 align-top">
        <LanguageFlag language={findLanguage(code)} />
        {languageName(code)}
      </span>
    </Fragment>
  ))
}

/** "RTL" after a right-to-left language. */
export function RtlBadge({ language }: { language: Language }) {
  if (!language.rtl) return null
  return (
    <Badge variant="outline" className="h-4 px-1 text-[10px]">
      RTL
    </Badge>
  )
}

/** The trigger's content: flag, English name, code and RTL badge. */
function LanguageSummary({ language }: { language: Language }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <LanguageFlag language={language} />
      <span className="truncate">{language.english}</span>
      <span className="text-footnote text-fg-3">{language.code}</span>
      <RtlBadge language={language} />
    </span>
  )
}

/** A row of the list: flag, English and native names, code and RTL badge. */
function LanguageRow({ language }: { language: Language }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <LanguageFlag language={language} />
      <span className="truncate">{language.english}</span>
      {language.native !== language.english ? (
        <span dir="auto" className="truncate text-fg-3">
          {language.native}
        </span>
      ) : null}
      <span className="ms-auto text-footnote text-fg-3">{language.code}</span>
      <RtlBadge language={language} />
    </span>
  )
}
