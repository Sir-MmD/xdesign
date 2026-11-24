import { useMemo, useState } from 'react'
import { adaptChat, type ChatDesign, type ChatEntry, type ChatOptions } from './adapt'
import { PreviewFrame } from './core/PreviewFrame'
import { defaultPreviewOptions, type PreviewOptions, type PreviewTheme } from './core/types'
import { ChatScreen } from './platforms/telegram/Chat'
import './platforms/telegram/fonts'
import { skins } from './platforms/telegram/skins'
import css from './platforms/telegram/skins/preview.css?inline'
import { type SkinId, skinProperties } from './platforms/telegram/skins/tokens'
import type { ChatPresses, ChatSlots } from './platforms/telegram/slots'
import { Wallpaper } from './platforms/telegram/wallpaper/Wallpaper'
import wallpaperCss from './platforms/telegram/wallpaper/wallpaper.css?inline'

/** The look's stylesheet and the chat background's, as TelegramMessage loads them. */
const frameCss = css + wallpaperCss

/**
 * A bot's messages show no views (a channel's counter) but the bot's own reaction (Try it,
 * EVT-02: a message has one only when an action set it); the rest is the preview's default.
 */
const chatOptions: PreviewOptions = { ...defaultPreviewOptions, views: false, reactions: true }

/** What every chat frame takes: the design in a language, the look and theme, and the frame's size. */
export interface ChatFrameProps extends Omit<ChatOptions, 'date'> {
  design: ChatDesign
  skin: SkinId
  theme: PreviewTheme
  /** The time of entries without their own (ISO); when the chat was first drawn by default. */
  date?: string | undefined
  /** The screen's width, else the look's own but at most `maxWidth`; its height, else the look's own. */
  width?: number | undefined
  maxWidth?: number | undefined
  height?: number | undefined
}

/**
 * A whole private chat with the bot in a look and theme, in its own shadow root (PRV-02, 04
 * sections 4.4 and 8): the top bar with the bot's name, photo and "bot" (or `action`, "typing"),
 * the wallpaper with the entries (the bot's messages as TelegramMessage draws them, the user's in
 * outgoing bubbles, service lines), the input field with the menu button and the placeholder, the
 * bottom keyboard the entries leave, a callback answer's toast or alert (`onPopupClose` is its
 * button), an invoice's payment sheet (`payment`, PAY-02), the pinned message bar (`pinned`) and Restart
 * once the user blocked the bot (`blocked`, EVT-02). Without entries it is the empty chat (EmptyChat). The slots draw the last bot
 * message's text, media and inline keyboard and the bottom keyboard in place of the read-only ones
 * (M4); without them everything is read-only. `presses` make the chat act (Try it, TRY-02).
 */
export function TelegramChat({
  entries,
  design,
  skin,
  theme,
  date,
  width,
  maxWidth,
  height,
  slots,
  presses,
  onPopupClose,
  ...options
}: ChatFrameProps & {
  entries: readonly ChatEntry[]
  slots?: ChatSlots | undefined
  presses?: ChatPresses | undefined
  onPopupClose?: (() => void) | undefined
}) {
  const tokens = skins[skin]
  const frameWidth = width ?? (maxWidth === undefined ? tokens.frameWidth : Math.min(tokens.frameWidth, maxWidth))
  const properties = useMemo(
    () => ({
      ...skinProperties(tokens, theme, frameWidth),
      ...(height === undefined ? {} : { '--tg-chat-height': `${String(height)}px` }),
    }),
    [tokens, theme, frameWidth, height],
  )
  // The time of entries without their own: the given one, else when the chat was first drawn.
  const [shownAt] = useState(() => new Date().toISOString())
  const { lang, varText, mediaUrl, action, popup, draft, commandsOpen, bottom, payment, pinned, blocked } = options
  const chat = useMemo(
    () =>
      adaptChat(entries, design, {
        lang,
        date: date ?? shownAt,
        varText,
        mediaUrl,
        action,
        popup,
        draft,
        commandsOpen,
        bottom,
        payment,
        pinned,
        blocked,
      }),
    [
      entries,
      design,
      lang,
      date,
      shownAt,
      varText,
      mediaUrl,
      action,
      popup,
      draft,
      commandsOpen,
      bottom,
      payment,
      pinned,
      blocked,
    ],
  )
  return (
    <PreviewFrame css={frameCss} properties={properties}>
      <Wallpaper look={skin} theme={theme} screen>
        <ChatScreen
          chat={chat}
          skin={tokens}
          theme={theme}
          options={chatOptions}
          width={frameWidth}
          slots={slots}
          presses={presses}
          onPopupClose={onPopupClose}
        />
      </Wallpaper>
    </PreviewFrame>
  )
}

const noEntries: readonly ChatEntry[] = []

/**
 * The empty chat with the bot (04 section 7, Bot setup's preview): the card "What can this bot
 * do?" with the bot's description, and the Start button in the input field's place.
 */
export function EmptyChat(
  props: Omit<
    ChatFrameProps,
    'action' | 'popup' | 'draft' | 'commandsOpen' | 'bottom' | 'payment' | 'pinned' | 'blocked'
  >,
) {
  return <TelegramChat {...props} entries={noEntries} />
}

/**
 * The commands menu as Telegram shows it above the input field (04 section 7, Bot setup's
 * preview): the command start points shown in the menu, in order, each with its menu text, over
 * the chat's wallpaper and the input field with its menu button.
 */
export function CommandsMenu(
  props: Omit<
    ChatFrameProps,
    'action' | 'popup' | 'draft' | 'commandsOpen' | 'bottom' | 'payment' | 'pinned' | 'blocked'
  >,
) {
  return <TelegramChat {...props} entries={noEntries} commandsOpen />
}
