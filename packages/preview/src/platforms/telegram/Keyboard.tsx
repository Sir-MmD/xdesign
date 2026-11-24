// The inline keyboard of the Telegram preview (docs/plan/19-x-proxies-server-media.md
// section 7.9): a bot's buttons under a message. The buttons only look like the apps'
// ones; nothing happens when they are clicked, unless Try it gives `onPress`.
import { PremiumEmoji } from '../../lib/PremiumEmoji'

import { plainSegments } from './entities'
import type { InlineKeyboard, KeyboardButton, ReplyButton } from './model'
import { ArtIcon, CopyIcon, Segments } from './parts'
import type { SkinIcons } from './skins/tokens'
import { pressProps } from './slots'

/**
 * The mark in a button's top-right corner: an arrow for a link, two sheets for a copy button,
 * none for the bot; the look's art where it has some (SkinIcons.link and copy, 29 section 8.6).
 */
function ButtonMark({ kind, icons }: { kind: KeyboardButton['kind']; icons: SkinIcons }) {
  switch (kind) {
    case 'url':
      return (
        <ArtIcon src={icons.link} className="tg-kb-mark">
          <svg className="tg-kb-mark" viewBox="0 0 12 12" aria-hidden>
            <path d="M4.5 2.5h5v5M9.5 2.5l-7 7" />
          </svg>
        </ArtIcon>
      )
    case 'copy':
      return (
        <ArtIcon src={icons.copy} className="tg-kb-mark">
          <CopyIcon className="tg-kb-mark" />
        </ArtIcon>
      )
    case 'callback':
      return null
  }
}

/**
 * The rows of buttons under the bubble, as wide as it, the buttons of a row sharing its
 * width: a button without a style (or `none`) over the wallpaper like the apps' ones,
 * success green, primary blue and danger red; a link or a copy button has its mark in the
 * corner and what it opens or copies as its tooltip. The look's tokens (SkinTokens.keyboard)
 * give the sizes; Post.tsx takes away the bubble's tail (where the app does) and rounds the
 * corners around it. data-kind names what the button does, for a look's own stylesheet.
 */
export function Keyboard({
  rows,
  icons,
  onPress,
}: {
  rows: InlineKeyboard
  icons: SkinIcons
  onPress?: ((line: number, button: number) => void) | undefined
}) {
  return (
    <div className="tg-keyboard" role="group" aria-label="Buttons of the post">
      {rows.map((row, i) => (
        <div key={i} className="tg-kb-row">
          {row.buttons.map((button, j) => (
            <span
              key={j}
              className={button.style && button.style !== 'none' ? `tg-kb-button ${button.style}` : 'tg-kb-button'}
              data-kind={button.kind}
              title={button.kind === 'copy' ? button.copy_text : button.url}
              {...pressProps(
                onPress &&
                  (() => {
                    onPress(i, j)
                  }),
              )}
            >
              <KeyboardButtonFace button={button} icons={icons} />
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

/** A button's premium emoji, drawn as the emoji it stands for, before its text. */
function ButtonIcon({ icon, alt }: { icon: string | undefined; alt: string | undefined }) {
  return icon ? (
    <PremiumEmoji
      id={icon}
      alt={alt ?? ''}
      className="tg-premium-emoji tg-kb-icon"
      fallback={<Segments nodes={plainSegments(alt ?? '')} />}
    />
  ) : null
}

/**
 * What an inline button shows inside: its icon, its text with the look's emoji and the mark of
 * what it does. The editor's keyboard (BTN-01) draws its own buttons around it, so editing keeps
 * the look. The label takes its direction from its first letter, as the apps (17 section 11):
 * dir="auto" skips the emoji, which are images, so "🛒 خرید" draws right to left with the emoji
 * and the icon on the right; the mark stays in the corner where the look draws it.
 */
export function KeyboardButtonFace({ button, icons }: { button: KeyboardButton; icons: SkinIcons }) {
  return (
    <>
      <span className="tg-kb-text" dir="auto">
        <ButtonIcon icon={button.icon} alt={button.icon_alt} />
        <Segments nodes={plainSegments(button.text)} />
      </span>
      <ButtonMark kind={button.kind} icons={icons} />
    </>
  )
}

/**
 * What a bottom keyboard button shows inside: its icon and its text with the look's emoji, in the
 * direction of its first letter as an inline button's.
 */
export function ReplyButtonFace({ button }: { button: ReplyButton }) {
  return (
    <span className="tg-rk-text" dir="auto">
      <ButtonIcon icon={button.icon} alt={button.icon_alt} />
      <Segments nodes={plainSegments(button.text)} />
    </span>
  )
}
