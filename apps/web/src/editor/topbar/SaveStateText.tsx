import { CheckIcon, CloudOffIcon, EyeIcon, LoaderCircleIcon, RefreshCwIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

import { type SaveState, saveStateTexts } from '../useDesignDoc'

const icons = {
  saved: CheckIcon,
  saving: LoaderCircleIcon,
  offline: CloudOffIcon,
  readOnly: EyeIcon,
  reconnecting: RefreshCwIcon,
}

/**
 * The save state of 04 section 4.1: "Saved", "Saving...", "Offline, your changes are kept on this
 * computer", "Read only" (Commenter, Viewer) or "Reconnecting...", said to screen readers as it changes.
 */
export function SaveStateText({ state }: { state: SaveState }) {
  const Icon = state === null ? null : icons[state]
  return (
    <p
      role="status"
      className={cn(
        'flex min-w-0 items-center gap-1.5 text-footnote text-fg-3',
        (state === 'offline' || state === 'reconnecting') && 'text-warn',
      )}
    >
      {Icon ? (
        <Icon aria-hidden className={cn('size-3.5 shrink-0', state === 'saving' && 'motion-safe:animate-spin')} />
      ) : null}
      {state === null ? null : <span className="truncate">{saveStateTexts[state]}</span>}
    </p>
  )
}
