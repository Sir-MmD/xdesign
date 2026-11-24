import { cn } from '@/lib/utils'

/** Up to two letters for a name: the first letters of its first and last words ("Sara Ahmadi" is "SA"). */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const first = words[0]
  if (first === undefined) return '?'
  const last = words.length > 1 ? words[words.length - 1] : undefined
  const letter = (word: string) => Array.from(word)[0] ?? ''
  return (letter(first) + (last === undefined ? '' : letter(last))).toUpperCase()
}

/**
 * A person's round avatar: their initials in white on their color (the account page's palette,
 * lib/colors.ts, every one 4.5:1 or more with white). Decorative: the name is said next to it or
 * by the control around it.
 */
export function PersonAvatar({
  name,
  color,
  size = 'md',
  className,
}: {
  name: string
  color: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  return (
    <span
      aria-hidden
      style={{ backgroundColor: color }}
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full font-semibold text-white select-none',
        size === 'sm' && 'size-6 text-caption',
        size === 'md' && 'size-8 text-footnote',
        size === 'lg' && 'size-12 text-callout',
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
