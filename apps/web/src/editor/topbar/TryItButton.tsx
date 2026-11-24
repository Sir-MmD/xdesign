import { PlayIcon, SquareIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { useDesign, useLang } from '../context'
import { useTry, useTryStore } from '../try/store'

/**
 * "Try it" (04 section 8): turns the phone into the bot's chat driven by the Try it engine
 * (try/TryPhone.tsx); while trying it reads "Stop trying". Every role can try.
 */
export function TryItButton() {
  const design = useDesign()
  const lang = useLang()
  const store = useTryStore()
  const open = useTry((session) => session.open)
  return (
    <Button
      variant={open ? 'default' : 'outline'}
      size="sm"
      aria-pressed={open}
      onClick={() => {
        if (open) store.stop()
        else store.open(design, lang)
      }}
    >
      {open ? <SquareIcon aria-hidden data-icon="inline-start" /> : <PlayIcon aria-hidden data-icon="inline-start" />}
      {open ? 'Stop trying' : 'Try it'}
    </Button>
  )
}
