import { useNavigate } from '@tanstack/react-router'
import { type Issue, issueKey, type IssueLevel } from '@xdesign/spec'
import { ChevronRightIcon, CircleCheckIcon } from 'lucide-react'
import { type ReactNode, useState } from 'react'

import { EmptyState } from '@/components/EmptyState'
import { LanguageFlag } from '@/components/LanguagePicker'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { findLanguage, languageName } from '@/lib/languages'
import { cn } from '@/lib/utils'

import { useChecks } from '../checks'
import { useDesign, useEditor, useLang } from '../context'
import { buttonText } from '../map/arrows'
import { useSelectionStore } from '../selection'

/** The groups by level, in the plan's order (04 section 9); ignored lines go under "Ignored". */
const groups: readonly { level: IssueLevel; label: string; note?: string }[] = [
  { level: 'error', label: 'Errors', note: 'Telegram cannot do this' },
  { level: 'warning', label: 'Warnings' },
  { level: 'info', label: 'Good to know' },
]

const levelColor: Record<IssueLevel, string> = { error: 'bg-error', warning: 'bg-warn', info: 'bg-info' }

const ALL = 'all'

/** The "Checks" panel (04 section 9), open while `open`; a line's click closes it. */
export function ChecksPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col data-[side=right]:sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Checks</SheetTitle>
        </SheetHeader>
        <ChecksList
          onJumped={() => {
            onOpenChange(false)
          }}
        />
      </SheetContent>
    </Sheet>
  )
}

/**
 * The issues of the live design grouped by level: "Errors" (Telegram cannot do this), "Warnings",
 * "Good to know", then the ignored ones greyed under "Ignored" with "Stop ignoring". A line names
 * the step and button, the language and the message; its click selects the step and the button
 * (in the line's language) on the Map, or opens Bot setup for the bot's own texts and photo.
 * Warnings and good-to-know lines can be marked "Ignore here"; a filter shows one language's lines.
 */
function ChecksList({ onJumped }: { onJumped: () => void }) {
  const design = useDesign()
  const issues = useChecks()
  const { designId, readOnly, edits } = useEditor()
  const selection = useSelectionStore()
  const navigate = useNavigate()
  const [filter, setFilter] = useState(ALL)
  const { list } = design.languages
  const language = list.length > 1 && list.includes(filter) ? filter : null
  // A step deleted since the last run has no line.
  const shown = issues.filter(
    (issue) =>
      (issue.stepId === undefined || issue.stepId in design.steps) &&
      (language === null || issue.language === language),
  )
  const ignored = shown.filter((issue) => issue.ignored === true)

  const jump = (issue: Issue) => {
    onJumped()
    if (issue.stepId === undefined) {
      void navigate({ to: '/d/$id', params: { id: designId }, search: { tab: 'setup' }, replace: true })
      return
    }
    if (issue.language !== undefined) selection.set({ lang: issue.language })
    selection.reveal(issue.stepId, issue.buttonId ?? null)
    void navigate({ to: '/d/$id', params: { id: designId }, search: {}, replace: true })
  }

  const languageItems = [
    { value: ALL, label: 'All languages' },
    ...list.map((code) => ({ value: code, label: languageName(code) })),
  ]
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {list.length > 1 ? (
        <div className="px-4">
          <Select<string>
            items={languageItems}
            value={language ?? ALL}
            onValueChange={(next) => {
              if (next !== null) setFilter(next)
            }}
          >
            <SelectTrigger size="sm" aria-label="Language">
              <SelectValue>
                {(value: string) =>
                  value === ALL ? (
                    'All languages'
                  ) : (
                    <>
                      <LanguageFlag language={findLanguage(value)} />
                      {languageName(value)}
                    </>
                  )
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {languageItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.value === ALL ? null : <LanguageFlag language={findLanguage(item.value)} />}
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4">
        {shown.length === 0 ? (
          <EmptyState
            icon={CircleCheckIcon}
            title={language === null ? 'No problems found' : `Nothing in ${languageName(language)}`}
          />
        ) : null}
        {groups.map((group) => {
          const lines = shown.filter((issue) => issue.level === group.level && issue.ignored !== true)
          if (lines.length === 0) return null
          return (
            <CheckGroup key={group.level} label={group.label} note={group.note} count={lines.length}>
              {lines.map((issue, index) => (
                <CheckLine
                  key={`${issueKey(issue)} ${String(index)}`}
                  issue={issue}
                  onJump={jump}
                  action={
                    issue.ignorable && !readOnly ? (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          edits.checks.ignore(issue)
                        }}
                      >
                        Ignore here
                      </Button>
                    ) : null
                  }
                />
              ))}
            </CheckGroup>
          )
        })}
        {ignored.length > 0 ? (
          <CheckGroup label="Ignored" count={ignored.length}>
            {ignored.map((issue, index) => (
              <CheckLine
                key={`${issueKey(issue)} ${String(index)}`}
                issue={issue}
                onJump={jump}
                action={
                  readOnly ? null : (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        edits.checks.stopIgnoring(issue)
                      }}
                    >
                      Stop ignoring
                    </Button>
                  )
                }
              />
            ))}
          </CheckGroup>
        ) : null}
      </div>
    </div>
  )
}

function CheckGroup({
  label,
  note,
  count,
  children,
}: {
  label: string
  note?: string
  count: number
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <h3 className="flex items-baseline gap-1.5 text-caption-2 font-bold tracking-(--tracking-label) text-fg-3 uppercase">
          {label}
          <span className="tabular-nums">{count}</span>
        </h3>
        {note ? <p className="text-footnote text-fg-3">{note}</p> : null}
      </div>
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  )
}

/**
 * One issue: where it is (the step, "Bot setup" without one, and the button), its language and
 * its message; a click jumps to it. An ignored line is greyed.
 */
function CheckLine({ issue, onJump, action }: { issue: Issue; onJump: (issue: Issue) => void; action: ReactNode }) {
  const design = useDesign()
  const lang = useLang()
  const step = issue.stepId === undefined ? undefined : design.steps[issue.stepId]
  const button = issue.buttonId === undefined ? undefined : design.buttons[issue.buttonId]
  const label = button ? buttonText(button, design, lang) || button.idName : undefined
  return (
    <li
      className={cn(
        'flex items-start gap-1 rounded-xl border bg-surface-2 p-1',
        issue.ignored === true && 'opacity-60',
      )}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 flex-col items-start gap-1 rounded-lg px-2 py-1.5 text-start outline-none hover:bg-surface-press focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-solid"
        onClick={() => {
          onJump(issue)
        }}
      >
        <span className="flex w-full min-w-0 items-center gap-1.5 text-footnote font-semibold text-fg-2">
          <span aria-hidden className={cn('size-2 shrink-0 rounded-full', levelColor[issue.level])} />
          <span dir="auto" className="truncate">
            {step ? step.title.trim() || step.idName : 'Bot setup'}
          </span>
          {label !== undefined ? (
            <>
              <ChevronRightIcon aria-hidden className="size-3 shrink-0 text-fg-3 rtl:rotate-180" />
              <span dir="auto" className="truncate">
                {label}
              </span>
            </>
          ) : null}
          {issue.language !== undefined ? (
            <span
              title={languageName(issue.language)}
              className="ms-auto flex shrink-0 items-center gap-1 rounded-sm bg-surface px-1.5 text-caption-2 font-bold text-fg-3"
            >
              <LanguageFlag language={findLanguage(issue.language)} />
              {issue.language.toUpperCase()}
            </span>
          ) : null}
        </span>
        <span dir="auto" className="text-subhead text-foreground">
          {issue.message}
        </span>
      </button>
      {action}
    </li>
  )
}
