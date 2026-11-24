import { Link } from '@tanstack/react-router'
import { ChevronLeftIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { RenameDesignDialog } from '@/designs/RenameDesignDialog'

/**
 * "< Designs" and the design's name (04 section 4.1); the design owner (and the site owner)
 * clicks the name to rename it with WEB-02's dialog. The name is the document's, so a rename by
 * someone else shows at once.
 */
export function DesignName({ id, name, canRename }: { id: string; name: string; canRename: boolean }) {
  const [renaming, setRenaming] = useState<{ id: string; name: string }>()
  return (
    <div className="flex min-w-0 items-center gap-1">
      <Link
        to="/"
        className="flex h-(--control-h-sm) shrink-0 items-center gap-0.5 rounded-md ps-1 pe-2 text-callout font-semibold text-fg-2 transition-colors duration-(--dur-fast) ease-(--ease) hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-solid"
      >
        <ChevronLeftIcon aria-hidden className="size-4" />
        Designs
      </Link>
      <h1 className="flex min-w-0 text-headline">
        {canRename ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-w-0 text-headline text-foreground"
                  onClick={() => {
                    setRenaming({ id, name })
                  }}
                />
              }
            >
              <span dir="auto" className="truncate">
                {name}
              </span>
              <span className="sr-only">: Rename</span>
            </TooltipTrigger>
            <TooltipContent>Rename</TooltipContent>
          </Tooltip>
        ) : (
          <span dir="auto" className="min-w-0 truncate px-2">
            {name}
          </span>
        )}
      </h1>
      <RenameDesignDialog
        design={renaming}
        onOpenChange={(open) => {
          if (!open) setRenaming(undefined)
        }}
      />
    </div>
  )
}
