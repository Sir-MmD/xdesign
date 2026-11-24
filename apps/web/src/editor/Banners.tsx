import { useEffect, type ReactNode } from 'react'

import { noteOutdated, noteServerVersion } from '@/app/serverVersion'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { LiveDesign, LiveState } from './live'

/**
 * The connection's notices under the top bar (LIVE-01's protocol): a busy server (the
 * connection tries again by itself) and a refused change of a design over 20 MB, with a way out
 * (the browser's copy holds the refused change). A newer server or document goes to the site's
 * one reload banner (app/ReloadBanner.tsx).
 */
export function Banners({ state, live }: { state: LiveState; live?: LiveDesign }) {
  const { serverVersion, problem } = state
  useEffect(() => {
    if (serverVersion !== null) noteServerVersion(serverVersion)
  }, [serverVersion])
  useEffect(() => {
    if (problem === 'newerLayout') noteOutdated()
  }, [problem])
  return (
    <>
      {state.problem === 'busy' ? <Banner tone="warn">The server is busy. Trying again...</Banner> : null}
      {state.problem === 'tooBig' ? (
        <Banner tone="error">
          <span>This design is too big to save more changes.</span>
          {live ? (
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                void live.discardLocal()
              }}
            >
              Discard unsaved changes
            </Button>
          ) : null}
        </Banner>
      ) : null}
    </>
  )
}

/** A notice under the top bar; HIST-02's version banner uses it too (history/VersionBanner.tsx). */
export function Banner({ tone, children }: { tone: 'info' | 'warn' | 'error'; children: ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b px-4 py-1.5 text-center text-footnote font-semibold',
        tone === 'info' && 'bg-info-weak text-info',
        tone === 'warn' && 'bg-warn-weak text-warn',
        tone === 'error' && 'bg-error-weak text-error',
      )}
    >
      {children}
    </div>
  )
}
