import { rowsPerPageChoices } from '@xdesign/api'
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from 'lucide-react'
import { useId } from 'react'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { isRowsPerPage, type Pager, pageCountOf } from '@/components/usePager'
import { ViewOnlyContext } from '@/components/viewOnly'
import { cn } from '@/lib/utils'

const numberFormat = new Intl.NumberFormat('en')

const sizeItems = rowsPerPageChoices.map((size) => ({ value: String(size), label: String(size) }))

/** A page number of the pager, or a gap ("...") between page numbers that are not next to each other. */
type PageItem = number | 'gap'

/**
 * The page numbers the pager shows ("1 2 3 ... 13"): every page up to 7 pages; beyond that the
 * first and the last page, the open one with its neighbours, and gaps. The row always holds 7
 * items, so it keeps its width from page to page.
 */
function pageItems(current: number, count: number): PageItem[] {
  if (count <= 7) return Array.from({ length: count }, (_, index) => index + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, 'gap', count]
  if (current >= count - 3) return [1, 'gap', count - 4, count - 3, count - 2, count - 1, count]
  return [1, 'gap', current - 1, current, current + 1, 'gap', count]
}

/**
 * The pager under a list the server pages (docs/plan/18 section 6, ACT-01), from xWriter's panel
 * (web/src/components/data-table/Pager.tsx): "Rows per page" with 10, 25, 50 and 100, "Rows 26 to
 * 50 of 312", and Previous, the page numbers (the open one marked) and Next. Under 640 px Previous
 * and Next keep only their arrows. It works in a view-only part too: paging changes nothing.
 * `onPageOpened` runs after another page was opened, for example to bring the top of the rows into
 * view (usePager.ts `revealTop`).
 */
export function PagerBar({
  pager,
  total,
  'aria-label': ariaLabel,
  onPageOpened,
  className,
}: {
  pager: Pager
  /** The rows of the whole list. */
  total: number
  /** The list's name: the page numbers are the navigation "Pages of <name>". */
  'aria-label': string
  onPageOpened?: () => void
  className?: string
}) {
  const labelId = useId()
  const count = pageCountOf(total, pager.size)
  const current = Math.min(pager.page, count)
  const first = total === 0 ? 0 : (current - 1) * pager.size + 1
  const last = Math.min(current * pager.size, total)
  const open = (page: number) => {
    if (page < 1 || page > count || page === current) return
    pager.setPage(page)
    onPageOpened?.()
  }
  return (
    <ViewOnlyContext value={false}>
      <div
        className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-subhead text-fg-2', className)}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span id={labelId}>Rows per page</span>
            <Select
              items={sizeItems}
              value={String(pager.size)}
              onValueChange={(value) => {
                const size = Number(value)
                if (isRowsPerPage(size)) pager.setSize(size)
              }}
            >
              <SelectTrigger size="sm" aria-labelledby={labelId} className="w-[74px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sizeItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-fg-3 tabular-nums">
            {first === last
              ? `Row ${numberFormat.format(first)} of ${numberFormat.format(total)}`
              : `Rows ${numberFormat.format(first)} to ${numberFormat.format(last)} of ${numberFormat.format(total)}`}
          </span>
        </div>
        <nav aria-label={`Pages of ${ariaLabel}`} className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={current <= 1}
            onClick={() => {
              open(current - 1)
            }}
          >
            <ChevronLeftIcon aria-hidden />
            <span className="max-sm:sr-only">Previous</span>
          </Button>
          {pageItems(current, count).map((item, index) =>
            item === 'gap' ? (
              <MoreHorizontalIcon key={`gap-${String(index)}`} aria-hidden className="size-4 shrink-0 text-fg-3" />
            ) : (
              <Button
                key={item}
                variant={item === current ? 'soft' : 'ghost'}
                size="sm"
                className="min-w-[30px] px-1.5 tabular-nums"
                aria-label={`Page ${String(item)}`}
                aria-current={item === current ? 'page' : undefined}
                onClick={() => {
                  open(item)
                }}
              >
                {numberFormat.format(item)}
              </Button>
            ),
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={current >= count}
            onClick={() => {
              open(current + 1)
            }}
          >
            <span className="max-sm:sr-only">Next</span>
            <ChevronRightIcon aria-hidden />
          </Button>
        </nav>
      </div>
    </ViewOnlyContext>
  )
}
