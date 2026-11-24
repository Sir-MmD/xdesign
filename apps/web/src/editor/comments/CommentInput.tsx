import { routes } from '@xdesign/api'
import { type KeyboardEvent, useId, useRef, useState } from 'react'

import { useApi } from '@/api/client'
import { useMe } from '@/app/session'
import { PersonAvatar } from '@/components/PersonAvatar'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import { useEditor } from '../context'
import type { CommentDraft, Mentioned } from './store'

// "@" and what follows it up to the caret, at the start or after a space.
const typedMention = /(?:^|\s)@([^\s@]{0,30})$/

/**
 * A comment's text (docs/plan/05 section 6): "@" lists the people with access to the design
 * (`GET /api/designs/:id/members`, the person left out) whose name matches what follows it; the
 * arrows and Enter or Tab pick one, Esc closes the list. Ctrl+Enter (Cmd on a Mac) sends.
 */
export function CommentInput({
  draft,
  onChange,
  onSend,
  label,
  placeholder,
  autoFocus,
}: {
  draft: CommentDraft
  onChange: (draft: CommentDraft) => void
  onSend: () => void
  label: string
  placeholder?: string
  autoFocus?: boolean
}) {
  const me = useMe()
  const { designId } = useEditor()
  const members = useApi(routes.designMembers, { params: { id: designId } })
  const field = useRef<HTMLTextAreaElement>(null)
  const listId = useId()
  const [caret, setCaret] = useState(0)
  const [active, setActive] = useState(0)
  const [dismissed, setDismissed] = useState<number | null>(null)

  const typed = typedMention.exec(draft.body.slice(0, caret))?.[1]
  const query = typed?.toLowerCase()
  const start = typed === undefined ? -1 : caret - typed.length - 1
  const people =
    query === undefined || dismissed === start
      ? []
      : (members.data?.members ?? [])
          .filter(
            (person) =>
              person.id !== me.id &&
              person.name
                .toLowerCase()
                .split(/\s+/)
                .some((word) => word.startsWith(query)),
          )
          .slice(0, 6)
  const shown = Math.min(active, Math.max(0, people.length - 1))

  const pick = (person: Mentioned) => {
    const inserted = `@${person.name} `
    const body = draft.body.slice(0, start) + inserted + draft.body.slice(caret)
    const at = start + inserted.length
    onChange({ body, mentions: [...draft.mentions.filter((one) => one.id !== person.id), person] })
    setCaret(at)
    setActive(0)
    requestAnimationFrame(() => {
      field.current?.focus()
      field.current?.setSelectionRange(at, at)
    })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      onSend()
      return
    }
    const person = people[shown]
    if (!person) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((shown + step + people.length) % people.length)
    } else if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
      event.preventDefault()
      pick({ id: person.id, name: person.name })
    } else if (event.key === 'Escape') {
      // The list closes; the panel stays.
      event.preventDefault()
      event.stopPropagation()
      setDismissed(start)
    }
  }

  const readCaret = () => {
    setCaret(field.current?.selectionStart ?? 0)
  }

  return (
    <div className="relative">
      <Textarea
        ref={field}
        value={draft.body}
        aria-label={label}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={3}
        maxLength={5000}
        dir="auto"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={people.length > 0}
        aria-controls={listId}
        className="min-h-20 resize-y"
        onChange={(event) => {
          onChange({ ...draft, body: event.target.value })
          setCaret(event.target.selectionStart)
          setActive(0)
        }}
        onSelect={readCaret}
        onKeyDown={onKeyDown}
      />
      {people.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="People with access"
          className="absolute inset-x-0 top-full z-10 mt-1 flex flex-col gap-0.5 rounded-lg border bg-popover p-1 shadow-(--shadow-md)"
        >
          {people.map((person, index) => (
            <li
              key={person.id}
              role="option"
              aria-selected={index === shown}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-subhead',
                index === shown && 'bg-surface-2',
              )}
              onPointerDown={(event) => {
                // Keeps the focus in the text.
                event.preventDefault()
                pick({ id: person.id, name: person.name })
              }}
            >
              <PersonAvatar name={person.name} color={person.color} size="sm" />
              <span className="truncate">{person.name}</span>
              <span className="ms-auto truncate text-footnote text-fg-3">@{person.username}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
