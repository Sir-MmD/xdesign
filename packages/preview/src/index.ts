// The Telegram phone (docs/plan/04-editor.md section 4.4, D-04): xWriter's Telegram preview,
// ported as it is (PRV-01). One bot message in a look and theme, and the private chat around it
// built from the same skins (PRV-02): the whole chat, the empty chat and the commands menu, their
// input adapters and editable slots; the five looks in xWriter's order and the two themes with
// their labels.
import type { PreviewTheme } from './core/types'
import { skinIds, skins } from './platforms/telegram/skins'
import type { SkinId } from './platforms/telegram/skins/tokens'

export { TelegramMessage } from './TelegramMessage'
export { CommandsMenu, EmptyChat, TelegramChat } from './TelegramChat'
export type { ChatFrameProps } from './TelegramChat'
export { adaptChat, adaptMessage, menuCommands, placeholderPicture } from './adapt'
export { Blockquote as TelegramQuote, Pre as TelegramCodeBlock } from './platforms/telegram/parts'
export { TelegramButtonFace } from './ButtonFace'
export type * from './adapt'
export type { PreviewTheme } from './core/types'
export type { SkinId } from './platforms/telegram/skins/tokens'
export type {
  ReplyButton,
  TgChat,
  TgChatAction,
  TgChatRow,
  TgCommand,
  TgPaymentSheet,
  TgPopup,
  TgPreviewPost,
  TgReplyKeyboard,
} from './platforms/telegram/model'
export type { ChatPresses, ChatSlots, ComposerPress, MessageSlots, Slot } from './platforms/telegram/slots'

/** The five looks in xWriter's order: Web A, Web K, Desktop, Android, iOS. */
export const telegramLooks: readonly { id: SkinId; label: string }[] = skinIds.map((id) => ({
  id,
  label: skins[id].label,
}))

/** The two themes with the phone look switch's labels (04 section 4.1): Light, Dark. */
export const telegramThemes: readonly { id: PreviewTheme; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]
