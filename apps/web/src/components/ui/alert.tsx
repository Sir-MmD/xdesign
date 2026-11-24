import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/*
 * A notice of the design system (17 section 4.6, the mockups' .x-notice): the weak tint of
 * its status with the text in the status color and a 2 px start border, the subhead style
 * with 12 x 16 px around it (docs/plan/35-owner-list-2026-11-04.md section 12.2). `default`
 * is info.
 */
const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-lg border-0 border-s-2 px-4 py-3 text-start text-subhead has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pe-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'border-info bg-info-weak text-info',
        destructive: 'border-error bg-error-weak text-error',
        ok: 'border-ok bg-ok-weak text-ok',
        warn: 'border-warn bg-warn-weak text-warn',
        off: 'border-off bg-off-weak text-off',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Alert({ className, variant, ...props }: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-title"
      className={cn('font-bold group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3', className)}
      {...props}
    />
  )
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        'text-subhead text-balance md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-2',
        className,
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="alert-action" className={cn('absolute end-2 top-2', className)} {...props} />
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
