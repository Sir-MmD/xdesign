import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { PreviewTheme } from '../../../core/types'
import { artProperties } from '../art/icons'
import { bitmapUrl, filterPixels, parseHex, renderGradient, type Rgb, sampleBitmap } from './gradient'
import type { Rect, WallpaperFill, WallpaperLook, WallpaperSettings } from './settings'
import { wallpaperLook, wallpapers } from './wallpapers'

/** A computed bitmap and its PNG data URL (null where the browser has no 2D canvas). */
interface Bitmap {
  pixels: Uint8ClampedArray
  url: string | null
}

/** A look's gradient and the fill computed from it, in one theme. */
interface Images {
  gradient: Bitmap | null
  fill: Bitmap | null
}

const computed = new Map<string, Images>()

/** The bitmaps of a look in a theme, computed once per page (they never change). */
function imagesOf(look: WallpaperLook, theme: PreviewTheme): Images {
  const key = `${look}:${theme}`
  let images = computed.get(key)
  if (!images) {
    const settings = wallpapers[look]
    const paint = theme === 'dark' ? settings.dark : settings.light
    const { width, height } = settings.bitmap
    const pixels = paint.colors ? renderGradient(paint.colors, settings.bitmap) : null
    const fill = pixels && paint.fill ? filterPixels(pixels, paint.fill.filter) : null
    images = {
      gradient: pixels ? { pixels, url: bitmapUrl(pixels, width, height) } : null,
      fill: fill ? { pixels: fill, url: bitmapUrl(fill, width, height) } : null,
    }
    computed.set(key, images)
  }
  return images
}

/** Where the gradient and one pattern tile lie over the chat, in its CSS px. */
interface Layout {
  gradient: Rect
  tile: Rect
}

/**
 * Lays the look's screen over a chat of w x h: the chat is the screen's chat column (the web
 * looks) or as wide as the screen, and its last message sits where the app's does, just
 * above the composer. A chat taller than the screen gets a taller screen for the gradient;
 * the pattern keeps the reference screen's scale and repeats. A whole chat screen with its
 * input field (`whole`, the private chat: PRV-02) has nothing under it.
 */
function layoutOf(settings: WallpaperSettings, w: number, h: number, whole: boolean): Layout {
  const { screen } = settings
  const width = Math.max(screen.width ?? w, w)
  const left = screen.frameCentre === undefined ? 0 : Math.min(Math.max(screen.frameCentre - w / 2, 0), width - w)
  const bottom = h + (whole ? 0 : screen.bottomInset)
  const height = Math.max(screen.height, bottom)
  const move = (r: Rect, top: number): Rect => ({
    left: r.left - left,
    top: r.top + top,
    width: r.width,
    height: r.height,
  })
  return {
    gradient: move(settings.gradientRect(width, height), bottom - height),
    tile: move(settings.patternTile(width, screen.height), bottom - screen.height),
  }
}

const px = (n: number) => `${String(Math.round(n * 100) / 100)}px`

/** A colour as CSS. */
const rgb = ([r, g, b]: Rgb) => `rgb(${String(Math.round(r))}, ${String(Math.round(g))}, ${String(Math.round(b))})`

/** The fill's tint laid over a colour. */
function tinted(color: Rgb, tint: WallpaperFill['tint']): Rgb {
  if (!tint) return color
  const [r, g, b] = parseHex(tint.color)
  const a = tint.alpha
  return [r * a + color[0] * (1 - a), g * a + color[1] * (1 - a), b * a + color[2] * (1 - a)]
}

/**
 * The fill of a part drawn from the wallpaper: --tg-wp-fill, a background with the tint over
 * the filtered gradient placed where the chat's own gradient is, so the part shows the piece of
 * it under itself; and --tg-wp-fill-color, the fill at the part's centre (for an SVG fill or a
 * border). `box` is the chat's rectangle on the page and `scale` its zoom there.
 */
function partFill(
  box: DOMRect,
  scale: number,
  part: HTMLElement | SVGElement,
  layout: Layout,
  fill: Bitmap,
  look: WallpaperSettings,
  spec: WallpaperFill,
): string[] {
  const r = part.getBoundingClientRect()
  const x = (r.left - box.left) / scale
  const y = (r.top - box.top) / scale
  const g = layout.gradient
  const centre = sampleBitmap(
    fill.pixels,
    look.bitmap.width,
    look.bitmap.height,
    (x + r.width / scale / 2 - g.left) / g.width,
    (y + r.height / scale / 2 - g.top) / g.height,
  )
  const color = rgb(tinted(centre, spec.tint))
  let background = color
  if (fill.url) {
    const image = `url("${fill.url}") ${px(g.left - x)} ${px(g.top - y)} / ${px(g.width)} ${px(g.height)} no-repeat border-box`
    if (spec.tint) {
      const [tr, tg, tb] = parseHex(spec.tint.color)
      const tint = `rgba(${String(tr)}, ${String(tg)}, ${String(tb)}, ${String(spec.tint.alpha)})`
      background = `linear-gradient(${tint}, ${tint}), ${image}`
    } else {
      background = image
    }
  }
  return [background, color]
}

/** The two custom properties partFill gives, in its order. */
const fillProperties = ['--tg-wp-fill', '--tg-wp-fill-color'] as const

/**
 * The chat background of the Telegram preview (29 section 8.4, TGP-02): Telegram's
 * four-colour gradient with its pattern, computed, placed and blended the way the look's app
 * does it (wallpapers.ts), behind the chat it wraps; replaces the gradient that only
 * approximated the default wallpaper. It also hands the chat the look's icons (art/icons.ts,
 * as --tg-art-* custom properties) and gives the parts the look draws from the wallpaper
 * (WallpaperSettings.fillParts) their fill, measured again whenever the chat changes. `screen`:
 * the chat is a whole screen with its input field (the private chat, PRV-02).
 */
export function Wallpaper({
  look,
  theme,
  screen = false,
  children,
}: {
  look: string
  theme: PreviewTheme
  screen?: boolean
  children: ReactNode
}) {
  const id = wallpaperLook(look)
  const settings = wallpapers[id]
  const paint = theme === 'dark' ? settings.dark : settings.light
  const images = imagesOf(id, theme)
  const host = useRef<HTMLDivElement | null>(null)
  const observer = useRef<ResizeObserver | undefined>(undefined)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  // The chat's size, before the first paint and whenever it changes.
  const ref = useCallback((node: HTMLDivElement | null) => {
    observer.current?.disconnect()
    observer.current = undefined
    host.current = node
    if (!node) return
    const measure = () => {
      const w = node.offsetWidth
      const h = node.offsetHeight
      setSize((previous) => (previous?.w === w && previous.h === h ? previous : { w, h }))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    observer.current = new ResizeObserver(measure)
    observer.current.observe(node)
  }, [])
  useEffect(
    () => () => {
      observer.current?.disconnect()
    },
    [],
  )
  const layout = useMemo(() => (size ? layoutOf(settings, size.w, size.h, screen) : null), [settings, size, screen])

  // The parts drawn from the wallpaper, painted again when the chat's content changes: also
  // when only a style moves a part (the share button's place under reactions), every rectangle
  // read before any write so the chat is laid out once, and a property written only when its
  // value changes, so the observer's round ends after the parts' own new styles (RVW-29c).
  useLayoutEffect(() => {
    const node = host.current
    const fill = images.fill
    const spec = paint.fill
    if (!node || !layout || !fill || !spec || !settings.fillParts) return undefined
    const painted = new Map<HTMLElement | SVGElement, string[]>()
    let frame = 0
    const paintAll = () => {
      frame = 0
      const box = node.getBoundingClientRect()
      const scale = node.offsetWidth > 0 ? box.width / node.offsetWidth : 1
      const fills = Array.from(node.querySelectorAll<HTMLElement | SVGElement>(settings.fillParts), (part) => ({
        part,
        values: partFill(box, scale, part, layout, fill, settings, spec),
      }))
      for (const { part, values } of fills) {
        const before = painted.get(part)
        fillProperties.forEach((name, i) => {
          const value = values[i] ?? ''
          if (before?.[i] !== value) part.style.setProperty(name, value)
        })
        painted.set(part, values)
      }
    }
    const later = () => {
      if (!frame) frame = requestAnimationFrame(paintAll)
    }
    paintAll()
    const changes = new MutationObserver(later)
    changes.observe(node, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    })
    const fonts = 'fonts' in document ? document.fonts : undefined
    fonts?.addEventListener('loadingdone', later)
    return () => {
      cancelAnimationFrame(frame)
      changes.disconnect()
      fonts?.removeEventListener('loadingdone', later)
      for (const part of painted.keys()) {
        for (const name of fillProperties) part.style.removeProperty(name)
      }
    }
  }, [images, layout, paint, settings])

  const art = useMemo(() => artProperties(id, theme), [id, theme])
  const layers = {
    backgroundColor: paint.base,
    '--tg-wp-gradient': images.gradient?.url ? `url("${images.gradient.url}")` : 'none',
    '--tg-wp-gradient-position': layout ? `${px(layout.gradient.left)} ${px(layout.gradient.top)}` : '0 0',
    '--tg-wp-gradient-size': layout ? `${px(layout.gradient.width)} ${px(layout.gradient.height)}` : '100% 100%',
    '--tg-wp-tile-position': layout ? `${px(layout.tile.left)} ${px(layout.tile.top)}` : '50% 100%',
    '--tg-wp-tile-size': layout ? `${px(layout.tile.width)} ${px(layout.tile.height)}` : 'auto 100%',
    '--tg-wp-pattern-opacity': String(paint.pattern?.opacity ?? 0),
  } as CSSProperties
  return (
    <div ref={ref} className="tg-wallpaper" style={art}>
      <div className="tg-wallpaper-layers" style={layers} aria-hidden>
        {paint.colors ? <div className="tg-wallpaper-gradient" data-blend={paint.pattern?.blend} /> : null}
        {paint.colors && paint.pattern?.blend === 'soft-light' ? <div className="tg-wallpaper-pattern" /> : null}
      </div>
      {children}
    </div>
  )
}
