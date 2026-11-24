// The site's theme (docs/plan/17 section 8, THEME-01), from xWriter's panel (web/src/app/theme.ts): Light or Dark,
// applied as the `dark` class on <html> (styles/app.css). The person's choice is none (the site follows the system's
// Light or Dark, also while the page is open), light or dark: the top bar's sun and moon button sets it and saves it
// for the person (`theme` of `PATCH /api/me`), and the signed-in layouts apply the saved one once the session arrives
// (useSavedTheme), so it follows the person to every device. This browser keeps the last choice (localStorage, which
// a private window or a blocked site may refuse), so the first paint has the right colors before the session arrives
// and the pages without a person (sign-in, invite, reset, view-only links) use it too; other tabs follow a change.
// main.tsx imports this module first, so the class is set before React renders, without an inline script (the
// Content Security Policy stays strict). The phone in the editor and Try it have a Light and Dark switch of their own
// (docs/plan/04 section 4.1), and the printable page keeps its paper colors.
import type { SiteTheme } from '@xdesign/api'
import { useLayoutEffect, useSyncExternalStore } from 'react'

export type PanelTheme = 'light' | 'dark'

/** The person's choice: null follows the system. */
export type ThemeChoice = SiteTheme | null

export const darkSchemeQuery = '(prefers-color-scheme: dark)'

const storageKey = 'xdesign-theme'
const query = window.matchMedia(darkSchemeQuery)
const listeners = new Set<() => void>()

function readChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(storageKey)
    return saved === 'light' || saved === 'dark' ? saved : null
  } catch {
    return null
  }
}

let choice = readChoice()

function current(): PanelTheme {
  return choice ?? (query.matches ? 'dark' : 'light')
}

function apply() {
  document.documentElement.classList.toggle('dark', current() === 'dark')
  for (const listener of listeners) listener()
}

query.addEventListener('change', apply)
window.addEventListener('storage', (event) => {
  if (event.key !== storageKey) return
  choice = readChoice()
  apply()
})
apply()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The person's choice on this page right now. */
export function themeChoice(): ThemeChoice {
  return choice
}

/** Shows a choice at once and keeps it in this browser for the next first paint. */
export function setThemeChoice(next: ThemeChoice): void {
  try {
    if (next === null) localStorage.removeItem(storageKey)
    else localStorage.setItem(storageKey, next)
  } catch {
    // Not kept in this browser; the person's saved choice still comes with the session.
  }
  if (next === choice) return
  choice = next
  apply()
}

/**
 * Applies the person's saved choice (`theme` of the session's `user`) when it arrives and when it changes, before the
 * browser paints; undefined (no session yet) keeps the browser's.
 */
export function useSavedTheme(saved: ThemeChoice | undefined): void {
  useLayoutEffect(() => {
    if (saved !== undefined) setThemeChoice(saved)
  }, [saved])
}

/** The theme the site shows; re-renders when the choice or the system setting changes. */
export function usePanelTheme(): PanelTheme {
  return useSyncExternalStore(subscribe, current)
}

/** Whether the site shows the dark theme right now. */
export function useIsDarkTheme(): boolean {
  return usePanelTheme() === 'dark'
}
