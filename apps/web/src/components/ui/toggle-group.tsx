'use client'

import * as React from 'react'
import { Toggle as TogglePrimitive } from '@base-ui/react/toggle'
import { ToggleGroup as ToggleGroupPrimitive } from '@base-ui/react/toggle-group'
import { type VariantProps } from 'class-variance-authority'
import { useViewOnly } from '@/components/viewOnly'
import { cn } from '@/lib/utils'

import { toggleVariants } from '@/components/ui/toggle'

/*
 * With `spacing={0}` the group is the design system's segmented control (17 section 4.6,
 * the mockups' .x-seg): a surface-2 track whose choices all take the segmented look,
 * whatever their variant. With a spacing the choices stand apart in their own variant, for
 * example as filter chips (`outline`).
 */
const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & {
    spacing?: number
    orientation?: 'horizontal' | 'vertical'
  }
>({
  size: 'default',
  variant: 'default',
  spacing: 2,
  orientation: 'horizontal',
})

function ToggleGroup({
  className,
  variant,
  size,
  spacing = 2,
  orientation = 'horizontal',
  children,
  ...props
}: ToggleGroupPrimitive.Props &
  VariantProps<typeof toggleVariants> & {
    spacing?: number
    orientation?: 'horizontal' | 'vertical'
  }) {
  const viewOnly = useViewOnly()
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      data-spacing={spacing}
      data-orientation={orientation}
      // Not --gap: that name is the design token for the space between tiles.
      style={{ '--toggle-gap': spacing } as React.CSSProperties}
      className={cn(
        'group/toggle-group flex w-fit max-w-full flex-row items-center gap-[--spacing(var(--toggle-gap))] rounded-lg data-[spacing=0]:gap-0.5 data-[spacing=0]:border data-[spacing=0]:bg-surface-2 data-[spacing=0]:p-[3px] data-vertical:flex-col data-vertical:items-stretch',
        className,
      )}
      {...props}
      {...(viewOnly ? { disabled: true } : {})}
    >
      <ToggleGroupContext.Provider value={{ variant, size, spacing, orientation }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  )
}

function ToggleGroupItem({
  className,
  children,
  variant = 'default',
  size = 'default',
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext)
  const segmented = context.spacing === 0

  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      data-variant={context.variant || variant}
      data-size={context.size || size}
      data-spacing={context.spacing}
      className={cn(
        'shrink-0 focus:z-10 focus-visible:z-10',
        toggleVariants({
          variant: segmented ? 'default' : context.variant || variant,
          size: context.size || size,
        }),
        className,
      )}
      {...props}
    >
      {children}
    </TogglePrimitive>
  )
}

export { ToggleGroup, ToggleGroupItem }
