import { CopyButton } from '@/components/CopyButton'
import { Input } from '@/components/ui/input'

/**
 * A link or key the server shows only once (a view-only or Claude link, an API key): the
 * link in a read-only field that selects itself, and "Copy".
 */
export function ShownLink({ link, label }: { link: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Input
        readOnly
        value={link}
        dir="ltr"
        aria-label={label}
        className="text-footnote"
        onFocus={(event) => {
          event.currentTarget.select()
        }}
      />
      <CopyButton value={link} showLabel />
    </div>
  )
}
