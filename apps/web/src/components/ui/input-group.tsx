'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

/*
 * A field with an icon or text at the start and a unit or a button at the end (17 section
 * 4.6, the mockups' .x-control): the text field's border, focus ring and error colors drawn
 * on the group, the inner control without a frame of its own.
 */
function InputGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        'group/input-group relative flex h-(--control-h) w-full min-w-0 items-center rounded-md border border-control bg-surface transition-[border-color,box-shadow] duration-(--dur-fast) ease-(--ease) outline-none hover:border-fg-3 in-data-[slot=combobox-content]:focus-within:border-inherit in-data-[slot=combobox-content]:focus-within:shadow-none has-[[data-slot=input-group-control]:disabled]:border-border-strong has-[[data-slot=input-group-control]:disabled]:bg-surface-2 has-[[data-slot=input-group-control]:focus-visible]:border-focus has-[[data-slot=input-group-control]:focus-visible]:shadow-[0_0_0_1px_var(--focus),0_0_0_4px_var(--focus-halo)] has-[[data-slot][aria-invalid=true]]:border-error has-[[data-slot][aria-invalid=true]]:has-[[data-slot=input-group-control]:focus-visible]:shadow-[0_0_0_1px_var(--error),0_0_0_4px_var(--error-weak)] has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>textarea]:h-auto has-[>[data-align=block-end]]:[&>input]:pt-3 has-[>[data-align=block-start]]:[&>input]:pb-3 has-[>[data-align=inline-end]]:[&>input]:pe-1.5 has-[>[data-align=inline-start]]:[&>input]:ps-1.5',
        className,
      )}
      {...props}
    />
  )
}

const inputGroupAddonVariants = cva(
  "flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-subhead font-semibold text-fg-3 select-none group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-sm [&>svg:not([class*='size-'])]:size-4",
  {
    variants: {
      align: {
        'inline-start': 'order-first ps-3 has-[>button]:-ms-1 has-[>kbd]:-ms-0.5',
        'inline-end': 'order-last pe-3 has-[>button]:-me-1 has-[>kbd]:-me-0.5',
        'block-start':
          'order-first w-full justify-start px-3 pt-2 group-has-[>input]/input-group:pt-2 [.border-b]:pb-2',
        'block-end': 'order-last w-full justify-start px-3 pb-2 group-has-[>input]/input-group:pb-2 [.border-t]:pt-2',
      },
    },
    defaultVariants: {
      align: 'inline-start',
    },
  },
)

function InputGroupAddon({
  className,
  align = 'inline-start',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        // A click in a popup opened from the addon (the card look's emoji list) reaches it through React though the
        // popup is drawn elsewhere on the page: it is not the addon's, so the popup keeps the focus (28 section 12.3,
        // EMJ-07).
        if (!e.currentTarget.contains(e.target as Node)) {
          return
        }
        if ((e.target as HTMLElement).closest('button')) {
          return
        }
        e.currentTarget.parentElement?.querySelector('input')?.focus()
      }}
      {...props}
    />
  )
}

// The quiet button inside a field (.x-control-btn): the third ink, blue on hover.
const inputGroupButtonVariants = cva(
  'flex items-center gap-2 text-callout text-fg-3 shadow-none hover:bg-brand-weak hover:text-brand active:bg-brand-weak active:text-brand',
  {
    variants: {
      size: {
        xs: "h-7 gap-1 rounded-sm px-1.5 [&>svg:not([class*='size-'])]:size-3.5",
        sm: '',
        'icon-xs': 'size-7 rounded-sm p-0 has-[>svg]:p-0',
        'icon-sm': 'size-8 p-0 has-[>svg]:p-0',
      },
    },
    defaultVariants: {
      size: 'xs',
    },
  },
)

function InputGroupButton({
  className,
  type = 'button',
  variant = 'ghost',
  size = 'xs',
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'size' | 'type'> &
  VariantProps<typeof inputGroupButtonVariants> & {
    type?: 'button' | 'submit' | 'reset'
  }) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  )
}

function InputGroupText({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 text-subhead font-semibold text-fg-3 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  )
}

function InputGroupInput({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        'h-[calc(var(--control-h)-2px)] flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 read-only:bg-transparent focus-visible:shadow-none disabled:bg-transparent aria-invalid:focus-visible:shadow-none',
        className,
      )}
      {...props}
    />
  )
}

function InputGroupTextarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(
        'flex-1 resize-none rounded-none border-0 bg-transparent py-2 shadow-none ring-0 read-only:bg-transparent focus-visible:shadow-none disabled:bg-transparent aria-invalid:focus-visible:shadow-none',
        className,
      )}
      {...props}
    />
  )
}

export { InputGroup, InputGroupAddon, InputGroupButton, InputGroupText, InputGroupInput, InputGroupTextarea }
