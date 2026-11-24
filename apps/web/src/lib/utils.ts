import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * The panel's text styles (styles/app.css, docs/plan/35-owner-list-2026-11-04.md section 12.2, APL-01). tailwind-merge
 * takes an unknown `text-*` class for a color, so without this list `cn('text-body', 'text-fg-2')` would drop the size.
 */
const textStyles = [
  'caption-2',
  'caption',
  'footnote',
  'subhead',
  'callout',
  'body',
  'headline',
  'title-3',
  'title-2',
  'title-1',
  'large-title',
]

const twMerge = extendTailwindMerge({ extend: { theme: { text: textStyles } } })

/**
 * Joins class names and resolves conflicting Tailwind classes (the last one wins).
 * shadcn CLI 4.21 generates `export { cn } from "cn"` (a new package that is not part of
 * the pinned stack, docs/plan/06-tech-stack.md); this is the classic equivalent built on
 * clsx and tailwind-merge, which are pinned.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
