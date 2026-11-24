// Telegram's seven peer colors (red, orange, violet, green, cyan, blue, pink): the avatar
// gradient and the channel's color in light and dark themes. Each look has its palette
// (SkinTokens.peer, docs/plan/29-owner-list-2026-10-22.md section 8.6, TGP-02: Desktop's
// colors differ from the web's). The default palette: Desktop's names from historyPeerNameFg
// (green #4fad2d light and #85de85 dark measured in the owner's screenshots); the gradients
// from the apps' avatar backgrounds.
import type { PreviewTheme } from '../../core/types'

/** A peer color: the avatar's gradient (top, bottom) and the channel's color, in each theme. */
export interface PeerColor {
  avatar: { light: readonly [string, string]; dark: readonly [string, string] }
  /** The channel's name in the bubble, and the quotes, code and other parts a look tints with it. */
  tint: { light: string; dark: string }
}

/** A look's seven peer colors, by Telegram's index (0 red to 6 pink). */
export type PeerPalette = readonly PeerColor[]

/** The same avatar gradient in both themes. */
function gradient(top: string, bottom: string): PeerColor['avatar'] {
  return { light: [top, bottom], dark: [top, bottom] }
}

const blue: PeerColor = { avatar: gradient('#5caffa', '#408acf'), tint: { light: '#168acd', dark: '#79c6ff' } }

export const defaultPeerPalette: PeerPalette = [
  { avatar: gradient('#ff845e', '#d45246'), tint: { light: '#c03d33', dark: '#ff8e86' } },
  { avatar: gradient('#febb5b', '#f68136'), tint: { light: '#ce671b', dark: '#efab5e' } },
  { avatar: gradient('#b694f9', '#6c61df'), tint: { light: '#8544d6', dark: '#b8a2ff' } },
  { avatar: gradient('#9ad164', '#46ba43'), tint: { light: '#4fad2d', dark: '#85de85' } },
  { avatar: gradient('#53edd6', '#28c9b7'), tint: { light: '#2996ad', dark: '#62d4e3' } },
  blue,
  { avatar: gradient('#ff8aac', '#d95574'), tint: { light: '#cd4073', dark: '#ff86b6' } },
]

/** The color index of a channel: its own, else one derived from the title. */
export function peerColorIndex(channel: { title: string; color?: number | undefined }): number {
  if (channel.color !== undefined && channel.color >= 0) return channel.color % 7
  let h = 0
  for (const ch of channel.title) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0
  return h % 7
}

/** A palette's color at an index (blue when the palette has none there). */
export function peerColor(palette: PeerPalette, index: number): PeerColor {
  return palette[index] ?? palette[5] ?? blue
}

/** The avatar's background: its gradient from top to bottom. */
export function avatarBackground(color: PeerColor, theme: PreviewTheme): string {
  const [top, bottom] = color.avatar[theme]
  return `linear-gradient(180deg, ${top}, ${bottom})`
}
