import type { ReactNode } from 'react'

export interface PremiumEmojiProps {
  /** The emoji's Telegram document ID in decimal. */
  id: string
  /** The normal emoji it stands for: shown in its place, and its label. */
  alt: string
  /** What shows in its place; default the alt emoji. */
  fallback?: ReactNode
  className?: string
}

/**
 * A premium emoji (a custom emoji) in the preview: xWriter's PremiumEmoji
 * (web/src/features/emoji/PremiumEmoji.tsx) as it draws an emoji whose file it does not have.
 * xDesign never connects to Telegram, so it never has the file: the fallback (the normal emoji
 * the designer chose) always shows, with the same label.
 */
export function PremiumEmoji({ alt, fallback, className }: PremiumEmojiProps) {
  return (
    <span className={className} title={`Premium emoji ${alt}`}>
      {fallback ?? alt}
    </span>
  )
}
