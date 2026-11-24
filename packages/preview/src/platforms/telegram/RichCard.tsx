import { useMemo } from 'react'
import { PreviewFrame } from '../../core/PreviewFrame'
import type { PreviewTheme } from '../../core/types'
import { artProperties } from './art/icons'
import './fonts'
import type { PreviewMedia, PreviewRich } from './model'
import { RichContent } from './RichContent'
import { SkinContext } from './skinContext'
import { skins } from './skins'
import css from './skins/preview.css?inline'
import { type SkinId, skinProperties } from './skins/tokens'

/**
 * A rich message alone, drawn as the preview's bubble draws it but without the chat around
 * it: a rich source post in a reader's Feed and Browse (docs/plan/28-owner-list-2026-10-20.md
 * section 14.6, RCH-04b), in a look and theme, in its own shadow root. As wide as `width`, at
 * most as wide as the look's widest bubble. data-skin and data-theme scope the look's own
 * stylesheet, and the look's art reaches it as the --tg-art-* custom properties the chat gets
 * from its wallpaper (docs/plan/29-owner-list-2026-10-22.md sections 8.4 and 8.6).
 */
export function TelegramRichCard({
  rich,
  media,
  skin,
  theme,
  width,
  'data-testid': testId,
}: {
  rich: PreviewRich
  /** The post's media, which the pictures between paragraphs name by position from 1. */
  media: readonly PreviewMedia[]
  skin: string
  theme: PreviewTheme
  width?: number | undefined
  'data-testid'?: string
}) {
  const tokens = skins[skin as SkinId]
  const widest = tokens.bubbleMaxWidth(tokens.frameWidth)
  const cardWidth = width !== undefined && width > 0 ? Math.min(width, widest) : widest
  const properties = useMemo(
    () => ({ ...skinProperties(tokens, theme, cardWidth), ...artProperties(tokens.id, theme) }),
    [tokens, theme, cardWidth],
  )
  return (
    <PreviewFrame css={css} properties={properties} data-testid={testId}>
      <SkinContext.Provider value={tokens}>
        <div className="tg-card" data-skin={tokens.id} data-theme={theme}>
          <div className="tg-rich" dir={rich.rtl ? 'rtl' : 'ltr'}>
            <RichContent rich={rich} media={media} />
          </div>
        </div>
      </SkinContext.Provider>
    </PreviewFrame>
  )
}
