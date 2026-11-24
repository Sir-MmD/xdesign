// The private chat with a bot (PRV-02, docs/plan/04-editor.md sections 4.4, 7 and 8): the bot's
// top bar, the messages (the bot's drawn as PostRow draws a post, the user's in outgoing
// bubbles), service lines, the input field with the menu button, the bottom keyboard, the
// commands menu, a callback answer's toast and alert, an invoice's payment sheet (PAY-02), and the
// empty chat. xWriter has no private
// chat: each part is built from the look's tokens (SkinTokens.chat and the chat colors) and drawn
// by skins/chat.css, with a look's own rules in skins/<look>.css; the buttons only look like the
// apps' ones, and only the alert's button acts (onPopupClose), unless Try it gives ChatPresses.
import { type CSSProperties, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PreviewOptions, PreviewTheme } from '../../core/types'
import { Emoji } from './emoji'
import { buildSegments, plainSegments } from './entities'
import { ReplyButtonFace } from './Keyboard'
import { MarksContext } from './marksContext'
import type { TgChat, TgCommand, TgPaymentSheet, TgPopup, TgReplyKeyboard } from './model'
import { Segments } from './parts'
import { avatarBackground, peerColor, peerColorIndex } from './peerColors'
import { ChatHeader, PostRow } from './Post'
import { SkinContext } from './skinContext'
import { chatActionLabel } from './skins/labels'
import { type ComposerPart, listTop, peerProperties, type SkinTokens } from './skins/tokens'
import { type ChatPresses, type ChatSlots, type ComposerPress, drawn, pressProps } from './slots'
import { formatTime } from './time'

/** xWriter-style icons of the input field (the looks have no art for it yet, calibrate: O-02). */
function SmileIcon() {
  return (
    <svg className="tg-composer-icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19zm0 17.3a7.8 7.8 0 1 1 0-15.6 7.8 7.8 0 0 1 0 15.6zM9 10.8a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6zm6 0a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6zm-3 6.4c2 0 3.8-1.2 4.5-3H7.5c.7 1.8 2.5 3 4.5 3z" />
    </svg>
  )
}

function AttachIcon() {
  return (
    <svg className="tg-composer-icon stroke" viewBox="0 0 24 24" aria-hidden>
      <path d="M17 7.5 9.6 14.9a1.9 1.9 0 0 0 2.7 2.7l7.4-7.5a3.8 3.8 0 0 0-5.4-5.4l-7.7 7.8a5.7 5.7 0 0 0 8.1 8.1l5.5-5.6" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg className="tg-composer-icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 14.6a3.4 3.4 0 0 0 3.4-3.4V5.6a3.4 3.4 0 0 0-6.8 0v5.6a3.4 3.4 0 0 0 3.4 3.4zm6-3.5a.9.9 0 0 0-1.8 0 4.2 4.2 0 0 1-8.4 0 .9.9 0 0 0-1.8 0 6 6 0 0 0 5.1 5.9v2.4H8.8a.9.9 0 0 0 0 1.8h6.4a.9.9 0 0 0 0-1.8h-2.3V17a6 6 0 0 0 5.1-5.9z" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg className="tg-composer-icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M3.4 20.4 21.6 12 3.4 3.6 3.3 10l12.7 2-12.7 2z" />
    </svg>
  )
}

/** The commands icon of Telegram's default menu button: a slash in a rounded square. */
function CommandsIcon() {
  return (
    <svg className="tg-composer-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fillRule="evenodd"
        d="M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zm8.3 3.6L8.2 17.1l1.5.8 6.1-10.5z"
      />
    </svg>
  )
}

/** The bottom keyboard's button: the bot's keyboard (a grid) while it is hidden, the system keyboard while it shows. */
function KeyboardIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="tg-composer-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fillRule="evenodd"
        d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm1 3v2h2V8zm4 0v2h2V8zm4 0v2h2V8zm4 0v2h2V8zM5 11.5v2h2v-2zm4 0v2h2v-2zm4 0v2h2v-2zm4 0v2h2v-2zM8 15v1.6h8V15z"
      />
    </svg>
  ) : (
    <svg className="tg-composer-icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M5 4h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm9 0h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM5 13h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1zm9 0h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z" />
    </svg>
  )
}

/** The lines before the menu button's label. */
function MenuLinesIcon() {
  return (
    <svg className="tg-menu-icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M5 7h14M5 12h14M5 17h14" />
    </svg>
  )
}

/** The two checkmarks of a message the bot has read (bots read at once). */
function Checks() {
  return (
    <svg className="tg-checks" viewBox="0 0 15 10" aria-hidden>
      <path d="M1 5.4 3.8 8.2 9.6 1.8M6.4 7.6l.7.6 5.8-6.4" />
    </svg>
  )
}

/** The info row of the user's message: its time and checkmarks, at the bubble's corner like a post's (Meta.tsx). */
function OutMeta({ time }: { time: string }) {
  return (
    <span className="tg-meta out" aria-hidden>
      <span className="tg-meta-time">{time}</span>
      <Checks />
    </span>
  )
}

/**
 * The user's message: the incoming bubble mirrored (chat.css), so each look's tail and its own
 * rules for it draw on the right, in the outgoing colors, with the text's links and emoji, the
 * room for the info row at the end of its last line, and the time with the checkmarks. The bot's
 * reaction sits under the text, the info row's room at the end of its row (EVT-02).
 */
function OutgoingRow({
  text,
  time,
  skin,
  tail,
  reaction,
}: {
  text: string
  time: string
  skin: SkinTokens
  tail: boolean
  reaction?: string | undefined
}) {
  const segments = useMemo(() => buildSegments(text, []), [text])
  const shape = tail ? skin.tail : null
  const spacer = (
    <span className="tg-meta-spacer" aria-hidden>
      <OutMeta time={time} />
    </span>
  )
  return (
    <div className="tg-row out">
      <div className="tg-bubble-wrap">
        {shape ? (
          <svg className="tg-tail" viewBox={shape.viewBox} preserveAspectRatio="none" aria-hidden>
            <path d={shape.path} />
          </svg>
        ) : null}
        <div className={shape ? 'tg-bubble has-tail' : 'tg-bubble'}>
          <div className="tg-body">
            <div className={reaction === undefined ? 'tg-text' : 'tg-text before-footer'}>
              <Segments nodes={segments} />
              {reaction === undefined ? spacer : null}
            </div>
            {reaction === undefined ? null : (
              <div className="tg-reactions">
                <span className="tg-reaction">
                  <Emoji text={reaction} />
                </span>
                {spacer}
              </div>
            )}
            <OutMeta time={time} />
          </div>
        </div>
      </div>
    </div>
  )
}

/** The pin of the pinned message bar's end (xWriter-style, calibrate: O-02). */
function PinIcon() {
  return (
    <svg className="tg-pinned-icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M15.6 3.3a1 1 0 0 1 1.4 0l3.7 3.7a1 1 0 0 1 0 1.4l-1.2 1.2a1 1 0 0 1-1.1.2l-2.6 2.6.3 3.3a1 1 0 0 1-.3.8l-1 1a1 1 0 0 1-1.4 0l-2.9-2.9-4.4 4.4a.8.8 0 0 1-1.1-1.1l4.4-4.4-2.9-2.9a1 1 0 0 1 0-1.4l1-1a1 1 0 0 1 .8-.3l3.3.3 2.6-2.6a1 1 0 0 1 .2-1.1z" />
    </svg>
  )
}

/**
 * The pinned message bar under the top bar (EVT-02): the accent line, "Pinned Message" and the
 * message's first line, and the pin at its end (EventTokens.pinned, calibrate: O-02).
 */
function PinnedBar({ text, skin }: { text: string; skin: SkinTokens }) {
  const line = text.split('\n').find((part) => part.trim() !== '') ?? ''
  const segments = useMemo(() => plainSegments(line), [line])
  return (
    <div className="tg-pinned">
      <div className="tg-pinned-body">
        <span className="tg-pinned-title">{skin.events.pinned.title}</span>
        <span className="tg-pinned-text" dir="auto">
          <Segments nodes={segments} />
        </span>
      </div>
      <PinIcon />
    </div>
  )
}

/** The top bar's status: "bot", or what the bot is doing with the look's dots (ChatTokens.status). */
function status(chat: TgChat, skin: SkinTokens) {
  if (chat.action === undefined) return skin.chat.status.bot
  const label = chatActionLabel(chat.action)
  const dots = (
    <span className="tg-typing-dots" aria-hidden>
      <span />
      <span />
      <span />
    </span>
  )
  switch (skin.chat.status.dots) {
    case 'text':
      return `${label}...`
    case 'before':
      return (
        <>
          {dots}
          {label}
        </>
      )
    case 'after':
      return (
        <>
          {label}
          {dots}
        </>
      )
  }
}

/**
 * The input field in the look's order of parts (ChatTokens.composer.parts): the menu button
 * ("Menu" for the commands menu button, the commands icon for Telegram's default), the emoji and
 * attach buttons, the field with its placeholder or the draft, the bottom keyboard's button
 * (while the user can hide or show the keyboard: not for a persistent one that shows), and the
 * microphone, or send with a draft, in the field or in a round button beside it (Web A, Web K).
 * With `presses` its buttons act and the field takes typed text.
 */
function Composer({ chat, skin, presses }: { chat: TgChat; skin: SkinTokens; presses: ChatPresses | undefined }) {
  const { composer, menuButton } = skin.chat
  const field = presses?.field
  const draft = field ? field.value : (chat.draft ?? '')
  const keyboard = chat.replyKeyboard
  const sendIcon = draft ? <SendIcon /> : <MicIcon />
  const press = (part: ComposerPress) => {
    const onPress = presses?.composer
    return pressProps(
      onPress &&
        (() => {
          onPress(part)
        }),
    )
  }
  const placeholder = chat.placeholder ?? composer.placeholder
  const part = (name: ComposerPart) => {
    switch (name) {
      case 'menu':
        if (chat.menu === 'commands')
          return (
            <span key={name} className="tg-menu-button" {...press('menu')}>
              <MenuLinesIcon />
              {menuButton.label}
            </span>
          )
        if (chat.menu === 'default')
          return (
            <span key={name} className="tg-composer-button commands" {...press('menu')}>
              <CommandsIcon />
            </span>
          )
        return null
      case 'emoji':
        return (
          <span key={name} className="tg-composer-button">
            <SmileIcon />
          </span>
        )
      case 'attach':
        return (
          <span key={name} className="tg-composer-button" {...press('attach')}>
            <AttachIcon />
          </span>
        )
      case 'field':
        return (
          <span key={name} className="tg-composer-field">
            {field ? (
              <input
                className="tg-composer-input"
                value={field.value}
                placeholder={placeholder}
                aria-label={placeholder}
                enterKeyHint="send"
                onChange={(event) => {
                  field.onChange(event.target.value)
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
                  event.preventDefault()
                  field.onEnter()
                }}
              />
            ) : draft ? (
              <span className="tg-composer-draft">
                <Segments nodes={plainSegments(draft)} />
              </span>
            ) : (
              placeholder
            )}
          </span>
        )
      case 'keyboard':
        return keyboard && !(keyboard.persistent && keyboard.open) ? (
          <span key={name} className="tg-composer-button" {...press('keyboard')}>
            <KeyboardIcon open={keyboard.open} />
          </span>
        ) : null
      case 'send':
        return (
          <span key={name} className={draft ? 'tg-composer-button send' : 'tg-composer-button'} {...press('send')}>
            {sendIcon}
          </span>
        )
    }
  }
  return (
    <div className="tg-composer-row">
      <div className={composer.float ? 'tg-composer floating' : 'tg-composer'}>{composer.parts.map(part)}</div>
      {composer.send === null ? null : (
        <span className={draft ? 'tg-send-button send' : 'tg-send-button'} {...press('send')}>
          {sendIcon}
        </span>
      )}
    </div>
  )
}

/**
 * The bottom keyboard (ReplyKeyboardMarkup): its rows of buttons, the buttons of a row sharing its
 * width, in their colors (Bot API 9.4) with their premium emoji's fallback; resized, as tall as
 * its buttons, else the system keyboard's height with its rows stretched to fill it. `onPress`
 * makes its buttons act.
 */
function ReplyKeyboardPanel({
  keyboard,
  onPress,
}: {
  keyboard: TgReplyKeyboard
  onPress: ((line: number, button: number) => void) | undefined
}) {
  return (
    <div
      className={keyboard.resize ? 'tg-reply-keyboard resized' : 'tg-reply-keyboard'}
      role="group"
      aria-label="Bottom keyboard"
    >
      {keyboard.rows.map((row, i) => (
        <div key={i} className="tg-rk-row">
          {row.map((button, j) => (
            <span
              key={j}
              className={button.style && button.style !== 'none' ? `tg-rk-button ${button.style}` : 'tg-rk-button'}
              {...pressProps(
                onPress &&
                  (() => {
                    onPress(i, j)
                  }),
              )}
            >
              <ReplyButtonFace button={button} />
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

/** The commands menu over the input field: each command with its description, in the look's order, the bot's picture before them where the app draws it. */
function CommandsList({
  commands,
  skin,
  avatar,
  onCommand,
}: {
  commands: readonly TgCommand[]
  skin: SkinTokens
  avatar: { url: string | undefined; background: string; initial: string }
  onCommand: ((command: string) => void) | undefined
}) {
  const { commandFirst, avatar: size } = skin.chat.commands
  return (
    <div className="tg-commands" role="list" aria-label="Commands">
      {commands.map((c) => (
        <div
          key={c.command}
          className="tg-command"
          role="listitem"
          {...pressProps(
            onCommand &&
              (() => {
                onCommand(c.command)
              }),
          )}
        >
          {size > 0 ? (
            <span className="tg-command-avatar" style={{ background: avatar.background }}>
              {avatar.url ? <img src={avatar.url} alt="" /> : avatar.initial}
            </span>
          ) : null}
          <span className="tg-command-text">
            <span className="tg-command-main">{commandFirst ? `/${c.command}` : c.description}</span>
            <span className="tg-command-sub">{commandFirst ? c.description : `/${c.command}`}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

/** A callback answer's toast, at the look's place (ChatTokens.toast). */
function Toast({ popup, skin }: { popup: TgPopup; skin: SkinTokens }) {
  return (
    <div className={`tg-toast ${skin.chat.toast.place}`} role="status">
      {popup.text}
    </div>
  )
}

/** A callback answer's alert over the shaded chat: the bot's name where the app writes it, the text, and its button. */
function Alert({
  popup,
  title,
  skin,
  onClose,
}: {
  popup: TgPopup
  title: string
  skin: SkinTokens
  onClose: (() => void) | undefined
}) {
  const { alert } = skin.chat
  return (
    <div className="tg-alert-scrim">
      <div className="tg-alert" role="alertdialog" aria-label={title}>
        {alert.title ? <div className="tg-alert-title">{title}</div> : null}
        <div className="tg-alert-text">{popup.text}</div>
        <div className="tg-alert-buttons">
          <button type="button" className="tg-alert-button" onClick={onClose}>
            {alert.button}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * An invoice's payment sheet over the shaded chat, mocked for Try it (PAY-02) in the look's sheet
 * style (InvoiceTokens.sheet, the alert's colors): the look's heading ("Checkout", or "Confirm Your
 * Purchase" in Stars), the invoice's photo, title and description, the price lines and the total
 * (with the shipping option chosen), what it asks for, the shipping options of flexible shipping
 * (the first chosen), and "Pay (test)" and "Cancel".
 */
function PaymentSheet({
  sheet,
  skin,
  presses,
}: {
  sheet: TgPaymentSheet
  skin: SkinTokens
  presses: ChatPresses | undefined
}) {
  const [chosen, setChosen] = useState<string | undefined>(sheet.shipping?.[0]?.id)
  const option = sheet.shipping?.find((item) => item.id === chosen)
  const words = skin.invoice.sheet
  const heading = sheet.stars ? words.starsTitle : words.title
  return (
    <div className="tg-sheet-scrim">
      <div className="tg-sheet" role="dialog" aria-label={heading}>
        <div className="tg-sheet-heading">{heading}</div>
        <div className="tg-sheet-item">
          {sheet.photoUrl ? <img className="tg-sheet-photo" src={sheet.photoUrl} alt="" /> : null}
          <div className="tg-sheet-about">
            <div className="tg-sheet-title" dir="auto">
              <Segments nodes={plainSegments(sheet.title)} />
            </div>
            {sheet.description === '' ? null : (
              <div className="tg-sheet-text" dir="auto">
                <Segments nodes={plainSegments(sheet.description)} />
              </div>
            )}
          </div>
        </div>
        <div className="tg-sheet-lines">
          {sheet.lines.map((line, i) => (
            <div key={i} className="tg-sheet-line">
              <span dir="auto">{line.label}</span>
              <span>{line.price}</span>
            </div>
          ))}
          {option ? (
            <div className="tg-sheet-line">
              <span dir="auto">{option.title}</span>
              <span>{option.price}</span>
            </div>
          ) : null}
          <div className="tg-sheet-line total">
            <span>{words.total}</span>
            <span>
              {option?.total ?? sheet.total}
              {sheet.every ? ` ${sheet.every}` : ''}
            </span>
          </div>
        </div>
        {sheet.asks.length > 0 ? (
          <div className="tg-sheet-asks">
            {sheet.asks.map((ask) => (
              <div key={ask} className="tg-sheet-ask">
                {ask}
              </div>
            ))}
          </div>
        ) : null}
        {sheet.shipping && sheet.shipping.length > 0 ? (
          <div className="tg-sheet-shipping" role="radiogroup" aria-label={words.shipping}>
            <div className="tg-sheet-label">{words.shipping}</div>
            {sheet.shipping.map((item) => (
              <span
                key={item.id}
                className="tg-sheet-option"
                role="radio"
                aria-checked={item.id === chosen}
                tabIndex={0}
                onClick={() => {
                  setChosen(item.id)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setChosen(item.id)
                  }
                }}
              >
                <span className="tg-sheet-radio" aria-hidden />
                <span className="tg-sheet-option-title" dir="auto">
                  {item.title}
                </span>
                <span>{item.price}</span>
              </span>
            ))}
          </div>
        ) : null}
        <div className="tg-sheet-buttons">
          <button
            type="button"
            className="tg-sheet-pay"
            onClick={() => {
              presses?.pay?.(option?.id)
            }}
          >
            Pay (test)
          </button>
          <button
            type="button"
            className="tg-sheet-cancel"
            onClick={() => {
              presses?.cancelPayment?.()
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * A private chat with a bot in one look and theme (PRV-02): the top bar with the bot's name, its
 * picture or letters and "bot" (or what it is doing), the wallpaper's list of rows ending at the
 * last one (bot messages as PostRow draws them, the tail only under the last of a sender's
 * messages; the user's; service lines), and the input field with the bottom keyboard over the
 * chat or under the field, the commands menu above it, a callback answer's popup and an invoice's
 * payment sheet (PAY-02). The empty
 * chat shows the card with the bot's description in the list and the Start button in the input
 * field's place. The slots go to the last bot message (with `each`, to every one) and to the
 * bottom keyboard (slots.ts, M4); `presses` make the buttons, the commands and the field act.
 */
export function ChatScreen({
  chat,
  skin,
  theme,
  options,
  width,
  slots,
  presses,
  onPopupClose,
}: {
  chat: TgChat
  skin: SkinTokens
  theme: PreviewTheme
  options: PreviewOptions
  width?: number | undefined
  slots?: ChatSlots | undefined
  presses?: ChatPresses | undefined
  onPopupClose?: (() => void) | undefined
}) {
  const frameWidth = width ?? skin.frameWidth
  const peer = peerColor(skin.peer.palette, peerColorIndex(chat.bot))
  // The pinned message bar takes room at the list's top (EVT-02).
  const pinned = chat.pinned !== undefined
  const chatStyle = useMemo(
    () =>
      ({
        ...peerProperties(skin, theme, peer),
        ...(pinned ? { '--tg-list-top': `${String(listTop(skin, true))}px` } : {}),
      }) as CSSProperties,
    [skin, theme, peer, pinned],
  )
  const avatar = {
    url: chat.bot.avatarUrl,
    background: avatarBackground(peer, theme),
    initial: skin.header.initials(chat.bot.title),
  }
  // The list shows its end, as the app opens a chat at its last message.
  const list = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const node = list.current
    if (node) node.scrollTop = node.scrollHeight
  }, [chat])
  let lastBot = -1
  chat.rows.forEach((row, i) => {
    if (row.kind === 'bot') lastBot = i
  })
  const keyboard = chat.replyKeyboard
  const shownKeyboard = keyboard?.open ? <ReplyKeyboardPanel keyboard={keyboard} onPress={presses?.reply} /> : null
  const inline = presses?.inline
  const keyboardNode = slots?.replyKeyboard ? slots.replyKeyboard(shownKeyboard) : shownKeyboard
  const over = skin.chat.replyKeyboard.over
  const keyboardPlace = drawn(keyboardNode) ? (
    <div className={over ? 'tg-rk-place over' : 'tg-rk-place'}>{keyboardNode}</div>
  ) : null
  const float = skin.chat.composer.float !== null
  const start = skin.chat.start
  const popup = chat.popup
  const toast = popup?.kind === 'toast' ? <Toast popup={popup} skin={skin} /> : null
  return (
    <MarksContext.Provider value={options.marks}>
      <SkinContext.Provider value={skin}>
        <div className="tg-chat screen" dir="ltr" data-skin={skin.id} data-theme={theme} style={chatStyle}>
          <ChatHeader
            channel={{ title: chat.bot.title, ...(chat.bot.avatarUrl ? { avatarUrl: chat.bot.avatarUrl } : {}) }}
            skin={skin}
            avatar={avatar.background}
            status={status(chat, skin)}
            typing={chat.action !== undefined}
          />
          {skin.header.fade > 0 ? <div className="tg-header-fade" /> : null}
          {chat.pinned === undefined ? null : <PinnedBar text={chat.pinned} skin={skin} />}
          <div className="tg-list" ref={list}>
            {chat.empty ? (
              <div className="tg-empty">
                <div className="tg-empty-card">
                  <div className="tg-empty-title">{skin.chat.empty.title}</div>
                  <Segments nodes={buildSegments(chat.empty.description, [])} />
                </div>
              </div>
            ) : (
              <div className="tg-rows">
                {chat.rows.map((row, i) => {
                  const tail = chat.rows[i + 1]?.kind !== row.kind
                  switch (row.kind) {
                    case 'bot':
                      return (
                        <PostRow
                          key={row.key}
                          post={row.post}
                          skin={skin}
                          options={options}
                          width={frameWidth}
                          tail={tail}
                          slots={slots?.each ? slots.each(row.key) : i === lastBot ? slots : undefined}
                          onButton={
                            inline &&
                            ((line, button) => {
                              inline(row.key, line, button)
                            })
                          }
                          onInside={
                            presses?.inside &&
                            ((line, button) => {
                              presses.inside?.(row.key, line, button)
                            })
                          }
                          onVote={
                            presses?.vote &&
                            ((options) => {
                              presses.vote?.(row.key, options)
                            })
                          }
                          onUnlock={
                            presses?.unlock &&
                            (() => {
                              presses.unlock?.(row.key)
                            })
                          }
                        />
                      )
                    case 'user':
                      return (
                        <OutgoingRow
                          key={row.key}
                          text={row.text}
                          time={formatTime(row.date, skin, options, row.timeZone)}
                          skin={skin}
                          tail={tail}
                          reaction={row.reaction}
                        />
                      )
                    case 'service':
                      return (
                        <div key={row.key} className="tg-service">
                          <span className="tg-service-text">{row.text}</span>
                        </div>
                      )
                  }
                })}
              </div>
            )}
          </div>
          <div className={float ? 'tg-composer-area floating' : 'tg-composer-area'}>
            {chat.commands ? (
              <CommandsList commands={chat.commands} skin={skin} avatar={avatar} onCommand={presses?.command} />
            ) : null}
            {skin.chat.toast.place === 'bottom' ? toast : null}
            {over ? keyboardPlace : null}
            {chat.empty || chat.blocked ? (
              <div className="tg-start">
                <span
                  className={start.filled ? 'tg-start-button filled' : 'tg-start-button'}
                  {...pressProps(
                    presses?.composer &&
                      (() => {
                        presses.composer?.(chat.blocked ? 'restart' : 'start')
                      }),
                  )}
                >
                  {chat.blocked ? skin.events.restart : start.label}
                </span>
              </div>
            ) : (
              <Composer chat={chat} skin={skin} presses={presses} />
            )}
            {over ? null : keyboardPlace}
          </div>
          {skin.chat.toast.place === 'bottom' ? null : toast}
          {chat.payment ? (
            <PaymentSheet key={chat.payment.title} sheet={chat.payment} skin={skin} presses={presses} />
          ) : null}
          {popup?.kind === 'alert' ? (
            <Alert popup={popup} title={chat.bot.title} skin={skin} onClose={onPopupClose} />
          ) : null}
        </div>
      </SkinContext.Provider>
    </MarksContext.Provider>
  )
}
