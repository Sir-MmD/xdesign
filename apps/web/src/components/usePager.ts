// The state of the pager under a list the server pages (docs/plan/18 section 6, ACT-01), from
// xWriter's panel (web/src/components/data-table/useTablePager.ts and pages.ts): the open page
// lives in the address (`?page=3`), so a reload or a link keeps it and Back returns to the page
// before; the rows per page are kept per list in this browser (localStorage, which a private
// window or a blocked site may refuse: then the choice lasts while the list is open).
import { useLocation, useNavigate } from '@tanstack/react-router'
import { defaultRowsPerPage, pageNumber, type RowsPerPage, rowsPerPageChoices } from '@xdesign/api'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export function isRowsPerPage(value: unknown): value is RowsPerPage {
  return typeof value === 'number' && (rowsPerPageChoices as readonly number[]).includes(value)
}

/**
 * The page of an address parameter, from 1: the router reads `page=3` as the number 3; a page the
 * server would not take (not a whole number of 1 or more) is page 1.
 */
export function pageOf(value: unknown): number {
  const page = pageNumber.safeParse(value)
  return page.success ? page.data : 1
}

/** How many pages `total` rows fill at `size` per page; an empty list is one empty page. */
export function pageCountOf(total: number, size: number): number {
  return Math.max(1, Math.ceil(total / size))
}

export interface PagerOptions {
  /** The list's name in this browser's storage (`activity`): its size is kept as `xdesign.rows.<id>`. */
  id: string
  /** The address parameter of the open page: `page`, or a name of its own for a second list on a screen. */
  param?: string
  /** The list's filters as one value: when it changes, the list goes back to page 1. */
  resetKey?: string
}

export interface Pager {
  /** The open page, from 1, as the address asks for it; it can lie past the end until the total is known. */
  readonly page: number
  /** Rows per page: the choice kept in this browser for this list, 25 without one. */
  readonly size: RowsPerPage
  /** Opens a page, as a new entry of the browser's history (Back returns to the page before). */
  setPage: (page: number) => void
  /** Moves to a page in place of the open one: page 1 after a change of the filters, or the last page of a shorter list. */
  replacePage: (page: number) => void
  /** Keeps a new size in this browser and goes back to page 1. */
  setSize: (size: RowsPerPage) => void
}

function readSize(key: string): RowsPerPage {
  try {
    const saved = Number(localStorage.getItem(key))
    return isRowsPerPage(saved) ? saved : defaultRowsPerPage
  } catch {
    return defaultRowsPerPage
  }
}

/** The rows per page of list `id` and its save. */
function useRowsPerPage(id: string): [RowsPerPage, (size: RowsPerPage) => void] {
  const key = `xdesign.rows.${id}`
  const [size, setSize] = useState(() => readSize(key))
  const save = useCallback(
    (next: RowsPerPage) => {
      setSize(next)
      try {
        localStorage.setItem(key, String(next))
      } catch {
        // Not kept in this browser; the size still holds while the list is open.
      }
    },
    [key],
  )
  return [size, save]
}

/**
 * The pager of a list: the open page from the address parameter `param` (`page` by default; the
 * route's `validateSearch` keeps it) and the rows per page of list `id`. The screen asks the
 * server for `page` and `size` and hands the pager to `PagerBar` with the server's total. A change
 * of `resetKey` goes back to page 1; a page change keeps the scroll, so the pager under the rows
 * stays where it was.
 */
export function usePager({ id, param = 'page', resetKey }: PagerOptions): Pager {
  const navigate = useNavigate()
  const page = pageOf(useLocation({ select: (location) => (location.search as Record<string, unknown>)[param] }))
  const [size, saveSize] = useRowsPerPage(id)
  const go = useCallback(
    (next: number, replace: boolean) => {
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => ({ ...previous, [param]: next > 1 ? next : undefined }),
        replace,
        resetScroll: false,
      })
    },
    [navigate, param],
  )

  // Back to page 1 when the filters change; a reload keeps the page, because the key it starts
  // with is the same.
  const seenKey = useRef(resetKey)
  useEffect(() => {
    if (seenKey.current === resetKey) return
    seenKey.current = resetKey
    if (page > 1) go(1, true)
  }, [resetKey, page, go])

  return useMemo(
    () => ({
      page,
      size,
      setPage: (next: number) => {
        if (next !== page) go(next, false)
      },
      replacePage: (next: number) => {
        if (next !== page) go(next, true)
      },
      setSize: (next: RowsPerPage) => {
        if (next !== size) saveSize(next)
        if (page > 1) go(1, true)
      },
    }),
    [page, size, go, saveSize],
  )
}

/**
 * Moves a list to its last page when the open one lies past the end (an old link, a list that got
 * shorter), once the server's total is known.
 */
export function usePageInRange(pager: Pager, total: number | undefined): void {
  const last = total === undefined ? undefined : pageCountOf(total, pager.size)
  useEffect(() => {
    if (last !== undefined && pager.page > last) pager.replacePage(last)
  }, [pager, last])
}

/**
 * After another page was opened from the pager under a list, brings the top of the list into view
 * when it was above the screen: under the top bar, which the page's scroll padding keeps clear.
 */
export function revealTop(node: HTMLElement | null): void {
  if (!node) return
  const margin = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
  if (node.getBoundingClientRect().top < margin) node.scrollIntoView({ block: 'start' })
}
