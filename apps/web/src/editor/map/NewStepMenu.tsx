import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { KIND_ICONS, NEW_STEP_HERE, type NewStep } from './kinds'

/**
 * "New step here" (04 section 4.3): the menu where an arrow was dropped on empty space, at
 * `at` (pixels in the map pane); a pick creates the step there and connects the arrow to it.
 */
export function NewStepMenu({
  at,
  onPick,
  onClose,
}: {
  at: { left: number; top: number } | null
  onPick: (item: NewStep) => void
  onClose: () => void
}) {
  return (
    <DropdownMenu
      open={at !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DropdownMenuTrigger
        nativeButton={false}
        render={
          <span
            aria-hidden
            style={{ left: at?.left ?? 0, top: at?.top ?? 0 }}
            className="pointer-events-none absolute size-0"
          />
        }
      />
      <DropdownMenuContent className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>New step here</DropdownMenuLabel>
          {NEW_STEP_HERE.map((item) => {
            const Icon = KIND_ICONS[item.kind]
            return (
              <DropdownMenuItem
                key={item.kind}
                onClick={() => {
                  onPick(item)
                }}
              >
                <Icon aria-hidden />
                {item.label}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
