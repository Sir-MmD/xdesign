// Registers the Telegram preview (docs/plan/10-frontend.md section 8.2): its five looks, Web A,
// Web K, Desktop, Android and iOS, Web A by default (docs/plan/29-owner-list-2026-10-22.md
// section 8.5).
import { registerPlatform } from '../../core/registry'
import type { TgPreviewPost } from './model'
import { skinIds, skins } from './skins'
import { TelegramPreview } from './TelegramPreview'

export const telegramPreview = {
  id: 'telegram',
  label: 'Telegram',
  skins: skinIds.map((id) => ({ id, label: skins[id].label })),
  defaultSkin: 'web',
  Renderer: TelegramPreview,
}

registerPlatform<TgPreviewPost>(telegramPreview)
