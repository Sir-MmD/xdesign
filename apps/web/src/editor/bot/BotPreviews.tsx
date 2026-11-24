import { CommandsMenu, EmptyChat } from '@xdesign/preview'
import type { Design } from '@xdesign/spec'
import { useCallback, useState } from 'react'

import { mediaUrl } from '@/api/media'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import { useDesign, useLang } from '../context'
import { useLook } from '../look'

export type BotPreview = 'empty' | 'commands'

/**
 * Bot setup's previews (04 section 7) in the chosen look and language, live: the empty chat
 * (PRV-02's EmptyChat: "What can this bot do?" with the description and the Start button) or the
 * commands menu as Telegram shows it, each under the chat's top bar with the bot's name and photo.
 */
export function BotPreviews({ shown, onShown }: { shown: BotPreview; onShown: (shown: BotPreview) => void }) {
  const design = useDesign()
  const lang = useLang()
  const [look] = useLook()
  const mediaUrl = usePhotoUrl(design)
  // The phone takes the column's room: its width up to the look's own, its whole height.
  const [box, setBox] = useState<{ width: number; height: number }>()
  const measure = useCallback((element: HTMLDivElement) => {
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { width, height } = entry.contentRect
      setBox({ width: Math.floor(width), height: Math.floor(height) })
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [])
  const Preview = shown === 'empty' ? EmptyChat : CommandsMenu

  return (
    <section aria-label="Preview" className="flex h-full min-h-0 flex-col gap-3 p-4">
      <ToggleGroup
        aria-label="Preview"
        spacing={0}
        className="self-center"
        value={[shown]}
        onValueChange={([next]) => {
          if (next === 'empty' || next === 'commands') onShown(next)
        }}
      >
        <ToggleGroupItem value="empty">Empty chat</ToggleGroupItem>
        <ToggleGroupItem value="commands">Commands menu</ToggleGroupItem>
      </ToggleGroup>
      <div ref={measure} className="flex min-h-0 flex-1 justify-center overflow-hidden">
        {box ? (
          <Preview
            design={design}
            lang={lang}
            skin={look.skin}
            theme={look.theme}
            maxWidth={box.width}
            height={box.height}
            mediaUrl={mediaUrl}
          />
        ) : null}
      </div>
    </section>
  )
}

/** The picture of an uploaded photo for the top bar; a video or a placeholder shows the look's letters. */
function usePhotoUrl(design: Design): (id: string) => string | undefined {
  const { media } = design
  return useCallback(
    (id: string) => {
      const item = media[id]
      if (!item?.mime.startsWith('image/')) return undefined
      return mediaUrl(item.serverId)
    },
    [media],
  )
}
