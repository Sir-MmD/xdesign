// The phone's look (docs/plan/04 section 4.1, Q-19, Q-28): one of the five Telegram apps and Light
// or Dark, chosen in the top bar and remembered per person in this browser (localStorage, which a
// private window or a blocked site may refuse: then the choice lasts until the page closes).
import { type PreviewTheme, type SkinId, telegramLooks, telegramThemes } from '@xdesign/preview'
import { createContext, useContext, useSyncExternalStore } from 'react'

export interface Look {
  skin: SkinId
  theme: PreviewTheme
}

const firstLook: Look = { skin: 'android', theme: 'light' }

function readLook(key: string): Look {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<Look> | null
    return {
      skin: telegramLooks.find((look) => look.id === saved?.skin)?.id ?? firstLook.skin,
      theme: telegramThemes.find((theme) => theme.id === saved?.theme)?.id ?? firstLook.theme,
    }
  } catch {
    return firstLook
  }
}

export class LookStore {
  private look: Look
  private readonly key: string
  private readonly listeners = new Set<() => void>()

  constructor(userId: string) {
    this.key = `xdesign-look-${userId}`
    this.look = readLook(this.key)
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  get = (): Look => this.look

  set(patch: Partial<Look>): void {
    this.look = { ...this.look, ...patch }
    try {
      localStorage.setItem(this.key, JSON.stringify(this.look))
    } catch {
      // Not kept in this browser; the choice still holds while the editor is open.
    }
    for (const listener of this.listeners) listener()
  }
}

export const LookContext = createContext<LookStore | null>(null)

/** The phone's look and the function that changes it. */
export function useLook(): [Look, (patch: Partial<Look>) => void] {
  const store = useContext(LookContext)
  if (!store) throw new Error('useLook needs the editor (src/editor/Editor.tsx)')
  const look = useSyncExternalStore(store.subscribe, store.get)
  return [
    look,
    (patch) => {
      store.set(patch)
    },
  ]
}
