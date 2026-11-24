import { useMemo, useState } from 'react'
import { type AdaptOptions, adaptMessage, type BotMessage, type MessageDesign } from './adapt'
import { PreviewFrame } from './core/PreviewFrame'
import { defaultPreviewOptions, type PreviewOptions, type PreviewTheme } from './core/types'
import './platforms/telegram/fonts'
import { TelegramPost } from './platforms/telegram/Post'
import { skins } from './platforms/telegram/skins'
import css from './platforms/telegram/skins/preview.css?inline'
import { type SkinId, skinProperties } from './platforms/telegram/skins/tokens'
import type { MessageSlots } from './platforms/telegram/slots'
import { Wallpaper } from './platforms/telegram/wallpaper/Wallpaper'
import wallpaperCss from './platforms/telegram/wallpaper/wallpaper.css?inline'

/** The look's stylesheet and the chat background's, as TelegramPreview loads them. */
const frameCss = css + wallpaperCss

/** A bot's message shows no views (a channel's counter); the rest is the preview's default. */
const messageOptions: PreviewOptions = { ...defaultPreviewOptions, views: false }

/**
 * One bot message in a look and theme, in its own shadow root (PRV-01): xWriter's Telegram
 * preview (platforms/telegram/TelegramPreview.tsx) drawing an xDesign message (adapt.ts) as a
 * bot's message in a private chat, the bubble and its inline keyboard over the look's
 * wallpaper, without the chat's top bar. The chat area is `width` wide, else the look's own
 * width but at most `maxWidth`. The private chat around it is TelegramChat (PRV-02). The slots
 * draw the text, the media and the inline keyboard in place of the read-only ones (M4).
 */
export function TelegramMessage({
  message,
  design,
  lang,
  skin,
  theme,
  date,
  varText,
  mediaUrl,
  width,
  maxWidth,
  slots,
}: {
  message: BotMessage
  design: MessageDesign
  skin: SkinId
  theme: PreviewTheme
  width?: number | undefined
  maxWidth?: number | undefined
  slots?: MessageSlots | undefined
} & AdaptOptions) {
  const tokens = skins[skin]
  const frameWidth = width ?? (maxWidth === undefined ? undefined : Math.min(tokens.frameWidth, maxWidth))
  // Without the top bar the list starts at the look's own gap, as it does under a bar in the chat.
  const properties = useMemo(
    () => ({
      ...skinProperties(tokens, theme, frameWidth ?? tokens.frameWidth),
      '--tg-list-top': `${String(tokens.list.top)}px`,
    }),
    [tokens, theme, frameWidth],
  )
  // The time in the info row: the given one, else when the message was first drawn.
  const [shownAt] = useState(() => new Date().toISOString())
  const post = useMemo(
    () => adaptMessage(message, design, { lang, date: date ?? shownAt, varText, mediaUrl }),
    [message, design, lang, date, shownAt, varText, mediaUrl],
  )
  return (
    <PreviewFrame css={frameCss} properties={properties}>
      <Wallpaper look={skin} theme={theme}>
        <TelegramPost post={post} skin={skin} theme={theme} options={messageOptions} width={frameWidth} slots={slots} />
      </Wallpaper>
    </PreviewFrame>
  )
}
