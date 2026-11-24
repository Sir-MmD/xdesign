import { useId } from 'react'

import { cn } from '@/lib/utils'

/**
 * xDesign's logo (the owner's choice E of 2026-11-24; apps/desktop/build/icon.svg, where tools/icons.sh
 * makes the app's and the browser's icons from): the letters xD, the D a speech bubble with a bot's
 * typing dots, on dark navy. `small` draws its form for 32 pixels and less (icon-small.svg): bolder,
 * without the dots. Decorative: the site's name beside it says what it is.
 */
export function Logo({ small = false, className }: { small?: boolean; className?: string }) {
  // Each drawing has its own gradient names, so two logos on one page do not share them.
  const id = useId().replace(/[^\w-]/g, '')
  const bg = `xd-bg-${id}`
  const ink = `xd-ink-${id}`
  return (
    <svg viewBox="0 0 512 512" aria-hidden="true" focusable="false" className={cn('shrink-0', className)}>
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1C2642" />
          <stop offset="1" stopColor="#0F1424" />
        </linearGradient>
        <linearGradient id={ink} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5CD6FF" />
          <stop offset="1" stopColor="#3B6FF6" />
        </linearGradient>
      </defs>
      {small ? (
        <>
          <rect width="512" height="512" rx="104" fill={`url(#${bg})`} />
          <path d="M68 184L196 328M196 184L68 328" stroke="#FFFFFF" strokeWidth="60" strokeLinecap="round" />
          <path d="M244 104H310A152 152 0 0 1 310 408H296L236 456L244 408Z" fill={`url(#${ink})`} />
        </>
      ) : (
        <>
          <path
            d="M128 24H384A104 104 0 0 1 488 128V384A104 104 0 0 1 384 488H128A104 104 0 0 1 24 384V128A104 104 0 0 1 128 24Z"
            fill={`url(#${bg})`}
          />
          <path d="M106 212L190 300M190 212L106 300" stroke="#FFFFFF" strokeWidth="30" strokeLinecap="round" />
          <path d="M236 150H312A106 106 0 0 1 312 362H286L232 404L236 362Z" fill={`url(#${ink})`} />
          <circle cx="282" cy="256" r="15" fill="#0F1424" />
          <circle cx="324" cy="256" r="15" fill="#0F1424" />
          <circle cx="366" cy="256" r="15" fill="#0F1424" />
        </>
      )}
    </svg>
  )
}
