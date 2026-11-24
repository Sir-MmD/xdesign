import type { StepId } from '@xdesign/spec'

import { cn } from '@/lib/utils'

import { useTryPath } from './path'

/** The ring around a box the try went through (path.ts); the last step's is stronger. */
export function PathMark({ id }: { id: StepId }) {
  const path = useTryPath()
  if (!path?.steps.has(id)) return null
  const current = path.current === id
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute -inset-1 rounded-[16px] border-2',
        current ? 'border-brand shadow-[0_0_0_4px_color-mix(in_srgb,var(--brand)_25%,transparent)]' : 'border-brand/45',
      )}
    />
  )
}
