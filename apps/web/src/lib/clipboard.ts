// Copying text to the clipboard (copied from xWriter's web/src/lib/clipboard.ts). The Clipboard
// API exists only in secure contexts (HTTPS and localhost): a site opened over plain HTTP on a LAN
// address has none, so a hidden text field and the old copy command stand in for it there.

/** Copies `text` with a hidden, selected text field (the old way, for pages without the Clipboard API). */
function copyBySelection(text: string): boolean {
  const field = document.createElement('textarea')
  field.value = text
  field.setAttribute('readonly', '')
  field.setAttribute('aria-hidden', 'true')
  field.style.position = 'fixed'
  field.style.top = '0'
  field.style.insetInlineStart = '0'
  field.style.opacity = '0'
  const focused = document.activeElement
  document.body.append(field)
  try {
    field.focus()
    field.select()
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- the only way to copy without the Clipboard API
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    field.remove()
    if (focused instanceof HTMLElement) focused.focus()
  }
}

/** Copies `text` to the clipboard; resolves to whether it worked (a refusal is not an error). */
export async function copyText(text: string): Promise<boolean> {
  // The typing says `clipboard` always exists; it does not in a page that is not a secure context.
  const clipboard = (navigator as { clipboard?: Clipboard }).clipboard
  if (clipboard === undefined) return copyBySelection(text)
  try {
    await clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
