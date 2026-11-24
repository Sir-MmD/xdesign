// The shape of a Telegram look's chat background (29 section 8.4, TGP-02): the default
// theme's four-colour gradient with Telegram's pattern, drawn and placed the way each app
// does it, from the research sheets' section 7 (.dev/upd29/tg/<look>.md). Each look has its
// own settings file (web.ts, webk.ts, desktop.ts, android.ts, ios.ts), so each look's coder
// changes only its own; wallpapers.ts lists them.
import type { FillFilter, GradientBitmap } from './gradient'

/** The looks, keyed as the preview stores them: `web` is Web A (D-6271). */
export type WallpaperLook = 'web' | 'webk' | 'desktop' | 'android' | 'ios'

/** A rectangle in CSS px. */
export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

/** The fill of the parts drawn from the wallpaper (iOS, Android). */
export interface WallpaperFill {
  /** The colour filter over the gradient (without the pattern). */
  filter: FillFilter
  /** A colour ("#rrggbb") laid over the filtered gradient at `alpha`, or null. */
  tint: { color: string; alpha: number } | null
}

/** A look's background in one theme. */
export interface WallpaperPaint {
  /** The colour under everything: under the gradient, black under a dark pattern, or the plain colour of an app that draws one. */
  base: string
  /** The four colours in the app's order, or null where the app draws only the base colour. */
  colors: readonly [string, string, string, string] | null
  /**
   * The pattern: black shapes blended soft-light over the gradient at `opacity` (the light
   * themes), or the gradient seen only through the shapes, at `opacity`, over the base (the
   * dark ones); null where the app draws none.
   */
  pattern: { blend: 'soft-light' | 'mask'; opacity: number } | null
  /** The fill of the parts that take it (WallpaperSettings.fillParts), or null. */
  fill: WallpaperFill | null
}

export interface WallpaperSettings {
  /** The bitmap the app computes the gradient into. */
  bitmap: GradientBitmap
  /**
   * The screen the app lays the wallpaper out on: a browser window for the web looks (its
   * width, and the centre of the chat column the preview shows), else the chat area, as wide
   * as the preview. `height` is the reference height; the last message sits `bottomInset`
   * above the screen's bottom (the composer or the bottom bar under it).
   */
  screen: { width?: number; frameCentre?: number; height: number; bottomInset: number }
  /** Where the bitmap lies on a screen of w x h (it is stretched over that rectangle). */
  gradientRect: (w: number, h: number) => Rect
  /** One tile of the pattern on a screen of w x h; the others repeat it in both directions. */
  patternTile: (w: number, h: number) => Rect
  /**
   * The parts that take the wallpaper's fill, as a CSS selector inside the chat (empty for
   * none). Each gets `--tg-wp-fill` (a background: the tint over the filtered gradient,
   * placed where the chat's own gradient is) and `--tg-wp-fill-color` (the colour at its
   * centre), measured again whenever the chat changes.
   */
  fillParts: string
  light: WallpaperPaint
  dark: WallpaperPaint
}

/** The pattern's width over its height (every app's pattern is 1440 x 2960). */
export const patternRatio = 1440 / 2960

/** The whole w x h screen. */
export function wholeScreen(w: number, h: number): Rect {
  return { left: 0, top: 0, width: w, height: h }
}

/** A tile as tall as `height`, centred on (cx, cy). */
export function centredTile(height: number, cx: number, cy: number): Rect {
  const width = height * patternRatio
  return { left: cx - width / 2, top: cy - height / 2, width, height }
}

/** The pattern once, covering the w x h screen and centred (Android, iOS). */
export function coverTile(w: number, h: number): Rect {
  const height = Math.max(h, w / patternRatio)
  return centredTile(height, w / 2, h / 2)
}

/** Android's luma weights for the saturation (ColorMatrix.setSaturation). */
export const androidLuma = [0.213, 0.715, 0.072] as const

/** iOS's luma weights for the saturation (SoftwareGradientBackground.swift:44-46). */
export const iosLuma = [0.3086, 0.6094, 0.082] as const
