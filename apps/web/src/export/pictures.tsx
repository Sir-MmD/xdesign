// The picture maker (docs/plan/06 sections 2 and 5): the Telegram phone of packages/preview
// (PRV-02) drawn offscreen, as the editor draws it, then turned into PNG files by
// modern-screenshot at 2x. Each message step shows its message with its keyboard and each
// question its prompt, in the chat screen of the chosen look and theme at the look's own width
// (its skin tokens); Bot setup adds the profile header (the chat's top bar), the empty chat and
// the commands menu. The screen grows when a message is taller than it, so the whole message
// shows. The fonts are the page's own (the preview declares them at document level), which
// modern-screenshot embeds, so Persian and emoji look as in the editor. Pictures are drawn in
// small batches with a pause between them, so the page stays responsive; the signal stops it.
import {
  type BotMessage,
  CommandsMenu,
  EmptyChat,
  menuCommands,
  type PreviewTheme,
  type SkinId,
  TelegramChat,
  telegramLooks,
} from '@xdesign/preview'
import type { Design, Lang, StepId } from '@xdesign/spec'
import { domToBlob } from 'modern-screenshot'
import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'

import { mediaUrl } from '@/api/media'

/** The look of the pictures: one of the five phone looks, light or dark. */
export interface PictureLook {
  skin: SkinId
  theme: PreviewTheme
}

/** The look of the pictures when the editor gives none: the first look, light. */
export const defaultLook: PictureLook = { skin: telegramLooks[0]?.id ?? 'web', theme: 'light' }

/**
 * A picture of the export: a message or question step's (its ID name, and its ID for the picture
 * cache) or a Bot setup view's, in a language.
 */
export type Picture =
  | { kind: 'bot-profile' | 'empty-chat' | 'commands-menu'; name: string; lang: Lang }
  | { kind: 'step'; name: string; stepId: StepId; lang: Lang; message: BotMessage }

/** Where a picture goes in the zip: `pictures/<name>.<language>.png`. */
export function picturePath(name: string, lang: Lang): string {
  return `pictures/${name}.${lang}.png`
}

/**
 * The pictures of a design in these languages: per language the profile header, the empty chat,
 * the commands menu (when a command shows in it), then every message and question step in ID
 * name order. Start points and logic steps get none (the map and the text describe them).
 */
export function picturesOf(design: Design, langs: readonly Lang[]): Picture[] {
  const steps = Object.values(design.steps).sort((a, b) => (a.idName < b.idName ? -1 : a.idName > b.idName ? 1 : 0))
  return langs.flatMap((lang): Picture[] => [
    { kind: 'bot-profile', name: 'bot-profile', lang },
    { kind: 'empty-chat', name: 'empty-chat', lang },
    ...(menuCommands(design, lang).length > 0 ? [{ kind: 'commands-menu' as const, name: 'commands-menu', lang }] : []),
    ...steps.flatMap((step): Picture[] => {
      if (step.kind === 'message') {
        const message = { content: step.content, keyboard: step.keyboard }
        return [{ kind: 'step', name: step.idName, stepId: step.id, lang, message }]
      }
      if (step.kind === 'question') {
        const { content, keyboard } = step.prompt
        return [{ kind: 'step', name: step.idName, stepId: step.id, lang, message: { content, keyboard } }]
      }
      return []
    }),
  ])
}

/**
 * How an uploaded file shows in a picture: a picture file through the server (with the
 * person's session or the view link's token); other files (a video, an audio file) as the
 * preview's placeholder.
 */
export function mediaUrlOf(design: Design): (id: string) => string | undefined {
  return (id) => {
    const item = design.media[id]
    if (!item?.serverId || !item.mime.startsWith('image/')) return undefined
    return mediaUrl(item.serverId)
  }
}

export interface MakePicturesOptions {
  look: PictureLook
  /** The time the messages show (ISO). */
  date: string
  signal?: AbortSignal | undefined
  /** After each picture: how many are made of how many. */
  onProgress?: ((done: number, total: number) => void) | undefined
  /** Each picture once made, by its path. */
  onPicture?: ((path: string, png: Blob) => void) | undefined
}

// Pictures drawn at once, then captured one by one before a pause.
const batchSize = 6
// A message screen grows to at most this height (CSS pixels), within the browsers' canvas limits.
const maxHeight = 4000

let emojiIndexLoaded = false

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function shadowRoots(host: HTMLElement): ShadowRoot[] {
  return [...host.querySelectorAll<HTMLElement>('[data-preview-frame]')].flatMap((frame) =>
    frame.shadowRoot ? [frame.shadowRoot] : [],
  )
}

/**
 * Waits until the drawn pictures are complete: the fonts their text uses, the emoji images (the
 * preview loads their index once, after drawing an emoji as text) and every image decoded.
 */
async function settle(host: HTMLElement): Promise<void> {
  // Laying the pictures out starts the downloads of the fonts they use.
  host.getBoundingClientRect()
  const until = Date.now() + 2000
  while (!emojiIndexLoaded && shadowRoots(host).some((root) => root.querySelector('.tg-emoji.text'))) {
    if (Date.now() > until) {
      emojiIndexLoaded = true
      break
    }
    await wait(50)
  }
  if (shadowRoots(host).some((root) => root.querySelector('img.tg-emoji'))) emojiIndexLoaded = true
  await document.fonts.ready
  const images = shadowRoots(host).flatMap((root) => [...root.querySelectorAll('img')])
  await Promise.all(images.map((image) => image.decode().catch(() => undefined)))
  await wait(0)
}

// What a picture draws: the empty chat (also for the profile header), the commands menu, or the
// chat with the step's message.
function pictureView(
  picture: Picture,
  design: Design,
  look: PictureLook,
  date: string,
  mediaUrl: (id: string) => string | undefined,
  height: number | undefined,
): ReactNode {
  const frame = { design, lang: picture.lang, skin: look.skin, theme: look.theme, date, mediaUrl, height }
  switch (picture.kind) {
    case 'bot-profile':
    case 'empty-chat':
      return <EmptyChat {...frame} />
    case 'commands-menu':
      return <CommandsMenu {...frame} />
    case 'step':
      return <TelegramChat {...frame} entries={[{ type: 'bot', message: picture.message }]} />
  }
}

/** Makes the pictures as PNG files by their paths in the zip; throws the signal's reason when stopped. */
export async function makePictures(
  design: Design,
  pictures: readonly Picture[],
  options: MakePicturesOptions,
): Promise<Map<string, Blob>> {
  const { look, date, signal } = options
  const made = new Map<string, Blob>()
  const mediaUrl = mediaUrlOf(design)
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.position = 'fixed'
  host.style.top = '0'
  host.style.left = '-100000px'
  host.style.pointerEvents = 'none'
  document.body.append(host)
  const root = createRoot(host)
  const slots = () => [...host.children].filter((child): child is HTMLElement => child instanceof HTMLElement)
  try {
    for (let start = 0; start < pictures.length; start += batchSize) {
      await wait(0)
      signal?.throwIfAborted()
      const batch = pictures.slice(start, start + batchSize)
      const heights: (number | undefined)[] = batch.map(() => undefined)
      const draw = () => {
        flushSync(() => {
          root.render(
            batch.map((picture, index) => (
              // Each picture in its own box, as wide as its screen.
              <div key={String(start + index)} className="w-max">
                {pictureView(picture, design, look, date, mediaUrl, heights[index])}
              </div>
            )),
          )
        })
      }
      draw()
      await settle(host)
      // A message taller than the screen: the screen grows by what its list scrolls.
      let grown = false
      for (const [index, slot] of slots().entries()) {
        const shadow = slot.querySelector('[data-preview-frame]')?.shadowRoot
        const list = shadow?.querySelector<HTMLElement>('.tg-list')
        const screen = shadow?.querySelector<HTMLElement>('.tg-chat.screen')
        if (batch[index]?.kind !== 'step' || !list || !screen) continue
        const extra = list.scrollHeight - list.clientHeight
        if (extra > 1) {
          heights[index] = Math.min(maxHeight, screen.offsetHeight + extra)
          grown = true
        }
      }
      if (grown) {
        draw()
        await settle(host)
      }
      for (const [index, slot] of slots().entries()) {
        const picture = batch[index]
        if (!picture) continue
        signal?.throwIfAborted()
        if (picture.kind === 'bot-profile') {
          // The profile header: the top of the empty chat down to the top bar's end (a floating
          // bar keeps the same space under it as above it).
          const header = slot.querySelector('[data-preview-frame]')?.shadowRoot?.querySelector('.tg-header')
          if (header) {
            const top = slot.getBoundingClientRect().top
            const bar = header.getBoundingClientRect()
            slot.style.height = `${String(Math.ceil(bar.bottom - top + (bar.top - top)))}px`
            slot.style.overflow = 'hidden'
          }
        }
        const png = await domToBlob(slot, { scale: 2, type: 'image/png' })
        const path = picturePath(picture.name, picture.lang)
        made.set(path, png)
        options.onPicture?.(path, png)
        options.onProgress?.(made.size, pictures.length)
      }
    }
  } finally {
    root.unmount()
    host.remove()
  }
  return made
}
