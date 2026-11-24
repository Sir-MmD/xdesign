import { ChevronRightIcon } from 'lucide-react'
import { useMemo } from 'react'

import { useDesign } from '../context'
import { telegramDetails } from './details'
import type { PhoneStep } from './message'

/**
 * "Telegram details" under the phone (04 section 4.4): a fold-out with the Bot API method and
 * fields the step's message maps to, read-only, for the curious.
 */
export function TelegramDetails({ step }: { step: PhoneStep }) {
  const design = useDesign()
  const rows = useMemo(() => telegramDetails(step, design), [step, design])
  return (
    <details className="group border-t px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-subhead font-semibold text-fg-2 select-none [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon aria-hidden className="size-4 transition-transform group-open:rotate-90" />
        Telegram details
      </summary>
      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-footnote">
        {rows.map((row, at) => (
          <div key={`${row.name}-${String(at)}`} className="contents">
            <dt className="font-mono text-fg-2">{row.name}</dt>
            <dd className="font-mono break-words">{row.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}
