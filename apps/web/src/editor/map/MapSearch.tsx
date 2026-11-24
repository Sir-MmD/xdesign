import { Panel } from '@xyflow/react'
import { ChevronDownIcon, ChevronUpIcon, SearchIcon, XIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'

import { useDesign } from '../context'
import { useSelectionStore } from '../selection'
import { findInDesign } from './search'

/**
 * Search on the map (04 section 4.3, Ctrl+F): steps, buttons and texts in any language. Enter
 * jumps to the next match (Shift+Enter to the one before), selects it and brings it into view;
 * Esc closes. `focus` counts the Ctrl+F presses, each one puts the cursor back in the field.
 */
export function MapSearch({ focus, onClose }: { focus: number; onClose: () => void }) {
  const design = useDesign()
  const selection = useSelectionStore()
  const field = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(-1)
  const found = useMemo(() => findInDesign(design, query), [design, query])
  const at = index < found.length ? index : -1

  useEffect(() => {
    field.current?.focus()
    field.current?.select()
  }, [focus])

  const go = (by: 1 | -1) => {
    if (found.length === 0) return
    const next = at < 0 ? (by === 1 ? 0 : found.length - 1) : (at + by + found.length) % found.length
    const hit = found[next]
    if (!hit) return
    setIndex(next)
    selection.reveal(hit.step, hit.button)
  }

  let count = ''
  if (query.trim() !== '') {
    if (found.length === 0) count = 'No matches'
    else if (at >= 0) count = `${String(at + 1)} of ${String(found.length)}`
    else count = found.length === 1 ? '1 match' : `${String(found.length)} matches`
  }

  return (
    <Panel position="top-right">
      <div
        role="search"
        className="flex items-center gap-1 rounded-lg border bg-surface py-1 ps-2.5 pe-1 shadow-(--shadow-sm)"
      >
        <SearchIcon aria-hidden className="size-4 shrink-0 text-fg-3" />
        <input
          ref={field}
          type="search"
          aria-label="Search the map"
          placeholder="Steps, buttons and texts"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setIndex(-1)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              go(event.shiftKey ? -1 : 1)
            } else if (event.key === 'Escape') {
              event.preventDefault()
              onClose()
            }
          }}
          className="h-7 w-52 min-w-0 bg-transparent text-callout outline-none placeholder:text-fg-3 [&::-webkit-search-cancel-button]:hidden"
        />
        <span aria-live="polite" className="min-w-16 text-end text-footnote text-fg-3 tabular-nums">
          {count}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Previous match"
          disabled={found.length === 0}
          onClick={() => {
            go(-1)
          }}
        >
          <ChevronUpIcon aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Next match"
          disabled={found.length === 0}
          onClick={() => {
            go(1)
          }}
        >
          <ChevronDownIcon aria-hidden />
        </Button>
        <Button variant="ghost" size="icon-xs" aria-label="Close search" onClick={onClose}>
          <XIcon aria-hidden />
        </Button>
      </div>
    </Panel>
  )
}
