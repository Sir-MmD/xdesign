import { type ReactNode, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const sheets = new Map<string, CSSStyleSheet>()

/** One constructable stylesheet per stylesheet text, shared by every frame. */
function sheetFor(css: string): CSSStyleSheet {
  let sheet = sheets.get(css)
  if (!sheet) {
    sheet = new CSSStyleSheet()
    sheet.replaceSync(css)
    sheets.set(css, sheet)
  }
  return sheet
}

/**
 * Renders the preview into an open shadow root (docs/plan/10-frontend.md section 8.12): the
 * panel's styles do not reach in and the preview's do not reach out. The stylesheet is a
 * constructable stylesheet and the look's tokens are custom properties set through the
 * CSSOM, so the page's Content Security Policy needs no inline styles for it.
 */
export function PreviewFrame({
  css,
  properties,
  children,
  'data-testid': testId,
}: {
  css: string
  properties: Readonly<Record<string, string>>
  children: ReactNode
  'data-testid'?: string
}) {
  const host = useRef<HTMLDivElement>(null)
  const [mount, setMount] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => {
    const el = host.current
    if (!el) return
    const root = el.shadowRoot ?? el.attachShadow({ mode: 'open' })
    root.adoptedStyleSheets = [sheetFor(css)]
    let container = root.querySelector<HTMLElement>('[data-preview-root]')
    if (!container) {
      container = document.createElement('div')
      container.setAttribute('data-preview-root', '')
      root.appendChild(container)
    }
    setMount(container)
  }, [css])
  useLayoutEffect(() => {
    const el = host.current
    if (!el) return
    for (const [name, value] of Object.entries(properties)) el.style.setProperty(name, value)
    return () => {
      for (const name of Object.keys(properties)) el.style.removeProperty(name)
    }
  }, [properties])
  // data-preview-frame marks the platform's own look: its colors copy the platform's (for
  // example Telegram's link blue and the gray of the time), so accessibility checks leave the
  // frame out of the contrast rule only (docs/plan/10-frontend.md section 3.10).
  return (
    <div
      ref={host}
      className="inline-block max-w-full overflow-x-auto align-top"
      data-preview-frame=""
      data-testid={testId}
    >
      {mount ? createPortal(children, mount) : null}
    </div>
  )
}
