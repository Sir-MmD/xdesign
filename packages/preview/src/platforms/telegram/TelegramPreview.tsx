import { useMemo } from 'react'
import { PreviewFrame } from '../../core/PreviewFrame'
import type { PreviewOptions, PreviewTheme } from '../../core/types'
import './fonts'
import type { TgPreviewPost } from './model'
import { TelegramPost } from './Post'
import { skins } from './skins'
import css from './skins/preview.css?inline'
import { type SkinId, skinProperties } from './skins/tokens'
import { Wallpaper } from './wallpaper/Wallpaper'
import wallpaperCss from './wallpaper/wallpaper.css?inline'

/** The look's stylesheet and the chat background's (29 section 8.4, TGP-02). */
const frameCss = css + wallpaperCss

/**
 * A Telegram post in a look and theme, in its own shadow root. The chat area is `width`
 * wide, else the look's own width (Web 760, iOS 393 and so on) but at most `maxWidth`.
 * xWriter's option "Direction of each line" (the list of the lines' directions under the
 * post, 20 section 4.3.7) is a part of xWriter's panel and is not ported (PRV-01).
 */
export function TelegramPreview({
  post,
  skin,
  theme,
  options,
  width,
  maxWidth,
}: {
  post: TgPreviewPost
  skin: string
  theme: PreviewTheme
  options: PreviewOptions
  width?: number | undefined
  maxWidth?: number | undefined
}) {
  const tokens = skins[skin as SkinId]
  const frameWidth = width ?? (maxWidth === undefined ? undefined : Math.min(tokens.frameWidth, maxWidth))
  const properties = useMemo(
    () => skinProperties(tokens, theme, frameWidth ?? tokens.frameWidth),
    [tokens, theme, frameWidth],
  )
  return (
    <PreviewFrame css={frameCss} properties={properties} data-testid="telegram-preview">
      <Wallpaper look={skin} theme={theme}>
        <TelegramPost post={post} skin={skin} theme={theme} options={options} width={frameWidth} />
      </Wallpaper>
    </PreviewFrame>
  )
}
