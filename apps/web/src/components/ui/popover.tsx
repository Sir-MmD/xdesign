import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { cn } from '@/lib/utils'

// A popover in the menu look of the design system (17 section 4.6, the mockups' .x-menu), with the menus' motion
// (`x-pop` of styles/components.css, docs/plan/32-owner-list-2026-10-26.md section 18.2, MOT-01).
function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  className,
  align = 'center',
  alignOffset = 0,
  side = 'bottom',
  sideOffset = 4,
  collisionAvoidance,
  anchor,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    'align' | 'alignOffset' | 'side' | 'sideOffset' | 'collisionAvoidance' | 'anchor'
  >) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        collisionAvoidance={collisionAvoidance}
        anchor={anchor}
        className="isolate z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            'x-pop z-50 max-h-(--available-height) w-72 origin-(--transform-origin) overflow-y-auto rounded-xl border border-border-strong bg-popover p-4 text-callout text-popover-foreground shadow-(--shadow-lg) outline-hidden',
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={cn('text-callout font-semibold', className)}
      {...props}
    />
  )
}

// The popover's text, which screen readers announce as the description of the box (InfoTip, UI-28).
function PopoverDescription({ className, ...props }: PopoverPrimitive.Description.Props) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn('text-subhead text-fg-2', className)}
      {...props}
    />
  )
}

export { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger }
