import { ChevronDownIcon, LanguagesIcon } from 'lucide-react'
import { useState } from 'react'

import { LanguageFlag, RtlBadge } from '@/components/LanguagePicker'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { findLanguage, languageName } from '@/lib/languages'

import { useDesign, useEditor, useLang } from '../context'
import { useSelectionStore } from '../selection'
import { LanguagesDialog } from './LanguagesDialog'

/**
 * The language switch (04 section 4.1): the design's languages; the phone and the map show the
 * chosen one. "Languages..." (people who can edit) adds, removes and picks the default one.
 */
export function LanguageSwitch() {
  const design = useDesign()
  const lang = useLang()
  const { readOnly } = useEditor()
  const selection = useSelectionStore()
  const [managing, setManaging] = useState(false)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="sm" aria-label={`Language: ${languageName(lang)}`} />}
        >
          <LanguageFlag language={findLanguage(lang)} />
          {lang.toUpperCase()}
          <ChevronDownIcon aria-hidden data-icon="inline-end" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuRadioGroup
            value={lang}
            onValueChange={(value: string) => {
              selection.set({ lang: value })
            }}
          >
            {design.languages.list.map((code) => {
              const language = findLanguage(code)
              return (
                <DropdownMenuRadioItem key={code} value={code}>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex min-w-0 items-center gap-2">
                      <LanguageFlag language={language} />
                      <span className="truncate">{languageName(code)}</span>
                      {language ? <RtlBadge language={language} /> : null}
                    </span>
                    <span dir="auto" className="truncate text-footnote font-normal text-fg-3">
                      {language?.native ?? code}
                      {code === design.languages.default ? ' · Default' : ''}
                    </span>
                  </span>
                </DropdownMenuRadioItem>
              )
            })}
          </DropdownMenuRadioGroup>
          {readOnly ? null : (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setManaging(true)
                }}
              >
                <LanguagesIcon aria-hidden />
                Languages...
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {readOnly ? null : <LanguagesDialog open={managing} onOpenChange={setManaging} />}
    </>
  )
}
