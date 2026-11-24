// The chat backgrounds of the five Telegram looks (29 section 8.4, TGP-02).
import { androidWallpaper } from './android'
import { desktopWallpaper } from './desktop'
import { iosWallpaper } from './ios'
import type { WallpaperLook, WallpaperSettings } from './settings'
import { webWallpaper } from './web'
import { webkWallpaper } from './webk'

export const wallpapers: Readonly<Record<WallpaperLook, WallpaperSettings>> = {
  web: webWallpaper,
  webk: webkWallpaper,
  desktop: desktopWallpaper,
  android: androidWallpaper,
  ios: iosWallpaper,
}

/** The look of a stored value, Web A for an unknown one. */
export function wallpaperLook(look: string): WallpaperLook {
  return look in wallpapers ? (look as WallpaperLook) : 'web'
}
