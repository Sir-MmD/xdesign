import type { ComponentProps } from 'react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * A button whose action a later task brings (Designs' "Import" until EXP-02): off, with the
 * reason ("Comes with export") as its tooltip and in its name. The tooltip hangs on a wrapper,
 * as an off button takes no pointer or focus.
 */
export function LaterButton({ reason, children, ...props }: ComponentProps<typeof Button> & { reason: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="inline-flex rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus focus-visible:outline-solid" />
        }
        // A wrapper that is not a button still takes the keyboard's focus, for the tooltip.
        tabIndex={0}
      >
        <Button {...props} disabled>
          {children}
          <span className="sr-only">: {reason}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  )
}
