// Steps on the clipboard (docs/plan/04 section 4.3): SPEC's clip as JSON under its own data type
// with the same JSON as text, so a paste in another design, tab or browser window brings the
// steps, their buttons, texts and parts. The copy and paste events carry them, which works on a
// plain HTTP address too (the Clipboard API needs HTTPS).
import { CLIP_TYPE, type Clip, readClip } from '@xdesign/spec'

import { copyText } from '@/lib/clipboard'

/** Puts a clip on the clipboard of a copy event. */
export function putClip(data: DataTransfer, clip: Clip): void {
  const json = JSON.stringify(clip)
  data.setData(CLIP_TYPE, json)
  data.setData('text/plain', json)
}

/** The clip of a paste event, when it holds copied steps. */
export function takeClip(data: DataTransfer): Clip | undefined {
  return readClip(data.getData(CLIP_TYPE)) ?? readClip(data.getData('text/plain'))
}

/**
 * The box menu's "Copy": a click is no copy event, so it asks the page for one and fills it;
 * where the page cannot, the text goes alone.
 */
export function copyClip(clip: Clip): void {
  const onCopy = (event: ClipboardEvent) => {
    if (!event.clipboardData) return
    event.preventDefault()
    event.stopImmediatePropagation()
    putClip(event.clipboardData, clip)
  }
  document.addEventListener('copy', onCopy, true)
  const copied = fireCopy()
  document.removeEventListener('copy', onCopy, true)
  if (!copied) void copyText(JSON.stringify(clip))
}

function fireCopy(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- the only way to fire a copy event with our data type
    return document.execCommand('copy')
  } catch {
    return false
  }
}
