import { CopyIcon, LanguagesIcon } from 'lucide-react'
import { Fragment, useDeferredValue, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { LanguageFlag, RtlBadge } from '@/components/LanguagePicker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ViewOnlyContext } from '@/components/viewOnly'
import { findLanguage, languageName } from '@/lib/languages'
import { cn } from '@/lib/utils'

import { useDesign, useEditor } from '../context'
import { PlainCell } from '../texts/PlainCell'
import { RichCell } from '../texts/RichCell'
import { type CellState, cellState, cellValue, isEmpty, textGroups, type TextGroup } from '../texts/rows'
import { LanguagesDialog } from '../topbar/LanguagesDialog'

/** Rows drawn at first and added by each "Show more" (no list virtualizer is installed). */
const PAGE = 100

/**
 * The "Texts" tab (04 section 10): every text of the design grouped by step in map order (the bot
 * setup first, the parts last), a column per language, editable cells (plain texts in place, rich
 * texts in TXT-01's editor in a popover), "Only missing", the missing count per language, and
 * "Copy the default language into empty cells", whose copies show in italics until edited.
 */
export function TextsTab() {
  // The table follows the design a moment later, so typing in a cell stays first.
  const design = useDeferredValue(useDesign())
  const { edits, readOnly } = useEditor()
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const [managing, setManaging] = useState(false)
  const { list, default: fallback } = design.languages

  const groups = useMemo(() => textGroups(design), [design])
  // Each cell's state, the missing count per language, and how many empty cells a copy would fill.
  const { states, missing, copyable } = useMemo(() => {
    const states = new Map<string, CellState[]>()
    const missing = new Map(list.map((lang) => [lang, 0]))
    let copyable = 0
    for (const group of groups) {
      for (const row of group.rows) {
        const rowStates = list.map((lang) => cellState(design, row, lang))
        states.set(row.id, rowStates)
        rowStates.forEach((state, index) => {
          const lang = list[index] ?? fallback
          if (state === 'missing' || state === 'copied') missing.set(lang, (missing.get(lang) ?? 0) + 1)
        })
        if (!isEmpty(cellValue(row, fallback))) {
          copyable += list.filter((lang) => lang !== fallback && isEmpty(cellValue(row, lang))).length
        }
      }
    }
    return { states, missing, copyable }
  }, [groups, design, list, fallback])

  // The groups shown: with "Only missing" the rows with a missing cell; at most `limit` rows.
  const { shown, total } = useMemo(() => {
    const shown: TextGroup[] = []
    let total = 0
    for (const group of groups) {
      const rows = onlyMissing
        ? group.rows.filter((row) => states.get(row.id)?.some((state) => state === 'missing' || state === 'copied'))
        : group.rows
      if (rows.length === 0) continue
      const room = limit - total
      if (room > 0) shown.push({ ...group, rows: rows.slice(0, room) })
      total += rows.length
    }
    return { shown, total }
  }, [groups, states, onlyMissing, limit])

  const copy = () => {
    const count = edits.texts.copyDefault(groups.flatMap((group) => group.rows.map((row) => row.at)))
    toast.success(`Copied the default language into ${String(count)} empty ${count === 1 ? 'cell' : 'cells'}.`)
  }
  const copiedNote = `Copied from ${languageName(fallback)}, not translated until edited`

  return (
    <section aria-labelledby="texts-title" className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 id="texts-title" className="text-title-3 font-bold">
          Texts
        </h2>
        <ul aria-label="Missing texts" className="flex flex-wrap gap-1.5">
          {list.map((lang) => {
            const count = missing.get(lang) ?? 0
            if (lang === fallback && count === 0) return null
            return (
              <li key={lang}>
                <Badge variant="pill" tone={count > 0 ? 'warn' : 'ok'}>
                  {lang}: {count} missing
                </Badge>
              </li>
            )
          })}
        </ul>
        {/* A filter, not an edit: it works while the editor is read-only too. */}
        <ViewOnlyContext value={false}>
          <label className="flex items-center gap-2 text-callout">
            <Switch
              checked={onlyMissing}
              onCheckedChange={(checked) => {
                setOnlyMissing(checked)
                setLimit(PAGE)
              }}
            />
            Only missing
          </label>
        </ViewOnlyContext>
        {readOnly ? null : (
          <div className="ms-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={list.length < 2 || copyable === 0} onClick={copy}>
              <CopyIcon aria-hidden data-icon="inline-start" />
              Copy the default language into empty cells
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setManaging(true)
              }}
            >
              <LanguagesIcon aria-hidden data-icon="inline-start" />
              Languages...
            </Button>
          </div>
        )}
      </div>

      {total === 0 ? (
        <p className="py-8 text-center text-callout text-fg-3">Every text is translated.</p>
      ) : (
        <div className="rounded-xl border bg-surface">
          {/* Fixed columns: 11rem for what the text is, 18rem per language; wider tables scroll sideways. */}
          <Table aria-label="Texts" className="table-fixed" style={{ minWidth: `${String(11 + list.length * 18)}rem` }}>
            <colgroup>
              <col className="w-44" />
              {list.map((lang) => (
                <col key={lang} className="w-72" />
              ))}
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>Text</TableHead>
                {list.map((lang) => {
                  const language = findLanguage(lang)
                  return (
                    <TableHead key={lang}>
                      <span className="flex items-center gap-1.5">
                        <LanguageFlag language={language} />
                        <span className="truncate">{language?.english ?? lang}</span>
                        <span className="font-normal normal-case">{lang}</span>
                        {lang === fallback ? (
                          <Badge variant="tag" tone="brand">
                            Default
                          </Badge>
                        ) : null}
                        {language ? <RtlBadge language={language} /> : null}
                      </span>
                    </TableHead>
                  )
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((group) => (
                <Fragment key={group.id}>
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={list.length + 1}
                      dir="auto"
                      className="truncate bg-surface-2 py-2 text-subhead font-semibold"
                    >
                      {group.title}
                    </TableCell>
                  </TableRow>
                  {group.rows.map((row) => {
                    const rowStates = states.get(row.id)
                    return (
                      <TableRow key={row.id} className="hover:bg-transparent">
                        <TableCell className="py-2 align-top whitespace-normal text-fg-2">{row.what}</TableCell>
                        {list.map((lang, index) => {
                          const state = rowStates?.[index] ?? 'empty'
                          const props = {
                            lang,
                            state,
                            label: `${group.title}, ${row.what}, ${languageName(lang)}`,
                            rtl: findLanguage(lang)?.rtl === true,
                            copiedNote,
                          }
                          return (
                            <TableCell
                              key={lang}
                              className={cn('p-1 align-top whitespace-normal', state === 'missing' && 'bg-warn-weak')}
                            >
                              {'rich' in row ? <RichCell row={row} {...props} /> : <PlainCell row={row} {...props} />}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    )
                  })}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {total > limit ? (
        <div className="flex flex-col items-center gap-1">
          <Button
            variant="outline"
            onClick={() => {
              setLimit((shownRows) => shownRows + PAGE)
            }}
          >
            Show more
          </Button>
          <p className="text-footnote text-fg-3">
            {limit} of {total} texts
          </p>
        </div>
      ) : null}
      {readOnly ? null : <LanguagesDialog open={managing} onOpenChange={setManaging} />}
    </section>
  )
}
