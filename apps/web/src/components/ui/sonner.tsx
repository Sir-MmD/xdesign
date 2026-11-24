// The shadcn/ui Toaster, adapted: the panel theme comes from src/app/theme.ts instead of
// next-themes (not a pinned dependency). sonner's stylesheet is part of the panel CSS
// (styles/app.css) because sonner would otherwise inject a <style> element, which the
// Content Security Policy (`style-src 'self'`) blocks; vite.config.ts removes that injection.
// The colors are the design tokens (17 section 4.2): the raised surface with the strong
// hairline and the 12 px radius, and an icon in the status color of the toast's type; the type
// and the springs are styles/app.css's (docs/plan/35-owner-list-2026-11-04.md section 12.2).
import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

import { usePanelTheme } from '@/app/theme'

/*
 * Toasts never cover a sticky bar's buttons (17 section 4.6): from 760 px they sit at the
 * bottom end, raised by the height a visible save or bulk bar publishes (--actionbar-space,
 * set by components/ActionBar) and by the phone's bottom bar (--bottom-space, the shell);
 * under 760 px they sit at the top under the top bar (the position comes from
 * app/providers.tsx), clear of both, as in the mockups.
 */
const underTopBar = 'calc(env(safe-area-inset-top, 0px) + var(--topbar-h, 56px) + 8px)'
const offset = {
  top: underTopBar,
  right: '24px',
  bottom: 'calc(24px + var(--bottom-space, 0px) + var(--actionbar-space, 0px))',
  left: '24px',
}
const mobileOffset = { top: underTopBar, right: '16px', bottom: '16px', left: '16px' }

function Toaster({ ...props }: ToasterProps) {
  const theme = usePanelTheme()

  return (
    <Sonner
      theme={theme}
      offset={offset}
      mobileOffset={mobileOffset}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-ok" />,
        info: <InfoIcon className="size-4 text-info" />,
        warning: <TriangleAlertIcon className="size-4 text-warn" />,
        error: <OctagonXIcon className="size-4 text-error" />,
        loading: <Loader2Icon className="size-4 animate-spin text-fg-3" />,
      }}
      style={
        {
          '--normal-bg': 'var(--surface-raised)',
          '--normal-text': 'var(--text)',
          '--normal-border': 'var(--border-strong)',
          '--border-radius': 'var(--r-lg)',
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: 'cn-toast',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
