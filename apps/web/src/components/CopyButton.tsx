import { CheckIcon, CopyIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { copyText } from '@/lib/clipboard'
import { cn } from '@/lib/utils'

// Copied from xWriter's web/src/components/CopyButton.tsx without the test ID.

export interface CopyButtonProps {
  value: string
  /** The accessible name, for example "Copy request ID". */
  label?: string
  /** Show the label next to the icon instead of only as the accessible name. */
  showLabel?: boolean
  /** Off, for example while there is nothing to copy yet. */
  disabled?: boolean
  className?: string
}

/** Copies a value to the clipboard and confirms with a check mark for 2 seconds (10 section 5). */
export function CopyButton({ value, label = 'Copy', showLabel, disabled, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => {
      setCopied(false)
    }, 2000)
    return () => {
      clearTimeout(timer)
    }
  }, [copied])

  const copy = async () => {
    if (await copyText(value)) setCopied(true)
    else toast.error('Copying failed. Select the text and copy it by hand.')
  }

  const Icon = copied ? CheckIcon : CopyIcon
  return (
    <Button
      type="button"
      variant="ghost"
      size={showLabel ? 'sm' : 'icon-sm'}
      aria-label={showLabel ? undefined : label}
      disabled={disabled}
      data-copied={copied || undefined}
      className={cn('shrink-0', className)}
      onClick={() => {
        void copy()
      }}
    >
      <Icon aria-hidden />
      {showLabel ? (copied ? 'Copied' : label) : null}
      <span className="sr-only" aria-live="polite">
        {copied ? 'Copied' : ''}
      </span>
    </Button>
  )
}
