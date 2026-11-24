// The platform-neutral part of the preview (docs/plan/10-frontend.md section 8.2): a
// platform registers a definition with its skins and renderer; the pane and the frame
// know nothing else about it.
import type { ComponentType } from 'react'

export type PreviewTheme = 'light' | 'dark'

/** The options of the preview toolbar (10 section 8.13). */
export interface PreviewOptions {
  /** Sample reactions under the post. */
  reactions: boolean
  /** The comments bar of a channel with a discussion group. */
  comments: boolean
  /** The time format: each look's own (Web 24-hour, the apps 12-hour as with an
   * English system language), or one for all. */
  timeFormat: 'auto' | '12' | '24'
  /** The view counter in the info row. */
  views: boolean
  /** A list under the post with the direction of each line, its marks and the lines that would flip (20 section 4.3.7). */
  direction: boolean
  /** The invisible direction marks drawn as thin ticks in the text (20 section 4.3.7). */
  marks: boolean
}

export const defaultPreviewOptions: PreviewOptions = {
  reactions: false,
  comments: false,
  timeFormat: 'auto',
  views: true,
  direction: false,
  marks: false,
}

export interface PreviewSkin {
  id: string
  label: string
}

/** What a platform gives the preview (FR-PL-02: X or Instagram plug in the same way). */
export interface PlatformPreviewDefinition<P> {
  id: string
  label: string
  skins: readonly PreviewSkin[]
  defaultSkin: string
  /** The options of the toolbar's menu this look uses (X: the time only); all of them when omitted (Telegram). */
  controls?: readonly (keyof PreviewOptions)[]
  /** The look draws its own length against the limit ("212 / 280"), so the pane does not repeat it. */
  countInside?: boolean
  /** width: the chat area's width; maxWidth: at most this wide, else the look's own width
   * (a phone look keeps its phone's width in a wider pane). */
  Renderer: ComponentType<{
    post: P
    skin: string
    theme: PreviewTheme
    options: PreviewOptions
    width?: number | undefined
    maxWidth?: number | undefined
  }>
}
