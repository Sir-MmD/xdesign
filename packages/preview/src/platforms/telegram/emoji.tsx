import { useEffect, useState } from 'react'

interface EmojiIndex {
  folder: string
  index: Readonly<Record<string, string>>
}

let cache: EmojiIndex | undefined
let loading: Promise<EmojiIndex> | undefined

/** Loads the emoji index once (it comes with the preview's chunk). */
function loadIndex(): Promise<EmojiIndex> {
  loading ??= import('virtual:emoji-index').then((m) => {
    cache = { folder: m.folder, index: m.default }
    return cache
  })
  return loading
}

/** The index key of an emoji: its code points in hex without U+FE0F. */
function key(text: string): string {
  const parts: string[] = []
  for (const ch of text) {
    const cp = ch.codePointAt(0)
    if (cp !== undefined && cp !== 0xfe0f) parts.push(cp.toString(16))
  }
  return parts.join('-')
}

/**
 * An emoji drawn with Apple's 64 px image, like Web A, Desktop and Android (10 section
 * 8.11); until the index has loaded, or for an emoji without an image, the text itself.
 */
export function Emoji({ text }: { text: string }) {
  const [state, setState] = useState(cache)
  useEffect(() => {
    if (!state) void loadIndex().then(setState)
  }, [state])
  const name = state?.index[key(text)]
  if (!state || !name) return <span className="tg-emoji text">{text}</span>
  return <img className="tg-emoji" src={`${state.folder}/${name}.png`} alt={text} draggable={false} />
}
