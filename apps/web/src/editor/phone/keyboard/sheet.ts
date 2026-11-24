// keyboard.css inside the phone: the preview draws in its own shadow root (PreviewFrame), which
// the page's styles do not reach, so the keyboards adopt their stylesheet there.
import css from './keyboard.css?inline'

let sheet: CSSStyleSheet | null = null

/** Adopts keyboard.css into the shadow root the element is in (a ref callback). */
export function adoptKeyboardSheet(element: HTMLElement | null): void {
  const root = element?.getRootNode()
  if (!(root instanceof ShadowRoot)) return
  if (!sheet) {
    sheet = new CSSStyleSheet()
    sheet.replaceSync(css)
  }
  if (!root.adoptedStyleSheets.includes(sheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]
}
