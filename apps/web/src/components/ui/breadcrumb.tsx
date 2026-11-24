import * as React from 'react'
import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { cn } from '@/lib/utils'
import { MoreHorizontalIcon } from 'lucide-react'

// Breadcrumbs of the design system (17 section 4.6, the mockups' .x-crumbs): "/" between
// the items, the links in the second ink, the current page in the third.

function Breadcrumb({ className, ...props }: React.ComponentProps<'nav'>) {
  return <nav aria-label="breadcrumb" data-slot="breadcrumb" className={cn(className)} {...props} />
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<'ol'>) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn('flex flex-wrap items-center gap-1.5 text-subhead wrap-break-word text-fg-3', className)}
      {...props}
    />
  )
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li data-slot="breadcrumb-item" className={cn('inline-flex min-w-0 items-center gap-1.5', className)} {...props} />
  )
}

function BreadcrumbLink({ className, render, ...props }: useRender.ComponentProps<'a'>) {
  return useRender({
    defaultTagName: 'a',
    props: mergeProps<'a'>(
      {
        className: cn(
          'font-semibold text-fg-2 no-underline transition-colors duration-(--dur-fast) hover:text-brand hover:underline',
          className,
        ),
      },
      props,
    ),
    render,
    state: {
      slot: 'breadcrumb-link',
    },
  })
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn('font-normal text-fg-3', className)}
      {...props}
    />
  )
}

function BreadcrumbSeparator({ children, className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn('text-fg-3 [&>svg]:size-3.5 [&>svg]:rtl:-scale-x-100', className)}
      {...props}
    >
      {children ?? '/'}
    </li>
  )
}

function BreadcrumbEllipsis({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      className={cn('flex size-5 items-center justify-center [&>svg]:size-4', className)}
      {...props}
    >
      <MoreHorizontalIcon />
      <span className="sr-only">More</span>
    </span>
  )
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
}
