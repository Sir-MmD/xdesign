// A design's button as the look draws it inside an inline or a bottom keyboard button (BTN-01,
// docs/plan/04 section 5.3): the editor draws the button itself (`.tg-kb-button` or
// `.tg-rk-button` with its look's class) with its own handlers, and this inside it, so the
// keyboard keeps the look while it is edited (Q-28). It must be drawn inside a chat, whose look
// gives the marks' art.
import { useContext } from 'react'

import { keyboardButton, type MessageButton, replyButton } from './adapt'
import { KeyboardButtonFace, ReplyButtonFace } from './platforms/telegram/Keyboard'
import { SkinContext } from './platforms/telegram/skinContext'
import type { SkinIcons } from './platforms/telegram/skins/tokens'

// Without a look the marks draw xWriter's own icons.
const noArt: SkinIcons = {
  views: null,
  share: null,
  comments: null,
  commentsArrow: null,
  link: null,
  copy: null,
  quote: null,
  quoteExpand: null,
  codeCopy: null,
  play: null,
  back: null,
  menu: null,
}

/** A button's icon, text (with the look's emoji) and, inline, the mark of what it does, in a language. */
export function TelegramButtonFace({
  button,
  lang,
  fallback,
}: {
  button: MessageButton
  lang: string
  /** The design's default language, for a label not written in `lang`. */
  fallback: string
}) {
  const skin = useContext(SkinContext)
  return button.place === 'inline' ? (
    <KeyboardButtonFace button={keyboardButton(button, lang, fallback)} icons={skin?.icons ?? noArt} />
  ) : (
    <ReplyButtonFace button={replyButton(button, lang, fallback)} />
  )
}
