import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/*
 * Badges of the design system (17 section 4.6): the neutral labels (`secondary` is the
 * mockups' .x-chip look, `outline` its outlined chip), the status pill (.x-pill: weak tint,
 * status text, a 6 px dot), the count badge (.x-badge: a solid status fill) and the field
 * tag of a label (.x-tag: "Required", "Optional"). `tone` colors the pill, count and tag.
 */
const badgeVariants = cva(
  'group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden border border-transparent whitespace-nowrap transition-colors duration-(--dur-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus focus-visible:outline-solid [&>svg]:pointer-events-none [&>svg]:size-3!',
  {
    variants: {
      variant: {
        default:
          'h-[22px] rounded-full bg-brand-strong px-2.5 text-caption-2 font-semibold text-on-brand [a]:hover:brightness-[.92]',
        secondary:
          'h-[22px] rounded-full bg-surface-2 px-2.5 text-caption-2 font-semibold text-fg-2 [a]:hover:text-brand',
        destructive: 'h-[22px] rounded-full bg-error-weak px-2.5 text-caption-2 font-semibold text-error',
        outline:
          'h-[22px] rounded-full border-border-strong px-2.5 text-caption-2 font-semibold text-fg-2 [a]:hover:border-brand [a]:hover:text-brand',
        ghost: 'h-[22px] rounded-full px-2.5 text-caption-2 font-semibold text-fg-2 hover:bg-surface-2',
        link: 'h-[22px] px-0 text-caption-2 font-semibold text-brand underline-offset-4 hover:underline',
        pill: "h-[22px] gap-1.5 rounded-full ps-2 pe-2.5 text-caption-2 font-semibold before:size-1.5 before:shrink-0 before:rounded-full before:bg-current before:content-['']",
        count:
          'h-[18px] min-w-[18px] rounded-full px-[5px] text-caption-2 leading-none font-bold shadow-[0_0_0_2px_var(--surface)]',
        tag: 'rounded-[4px] px-1.5 py-px text-caption-2 leading-[1.45] font-bold tracking-[.04em] uppercase',
      },
      tone: {
        ok: '',
        info: '',
        warn: '',
        error: '',
        off: '',
        brand: '',
      },
    },
    compoundVariants: [
      { variant: ['pill', 'tag'], tone: 'ok', className: 'bg-ok-weak text-ok' },
      { variant: ['pill', 'tag'], tone: 'info', className: 'bg-info-weak text-info' },
      { variant: ['pill', 'tag'], tone: 'warn', className: 'bg-warn-weak text-warn' },
      { variant: ['pill', 'tag'], tone: 'error', className: 'bg-error-weak text-error' },
      { variant: 'pill', tone: 'off', className: 'bg-off-weak text-off' },
      // A plain tag ("Optional", "Locked on edit") reads in the third ink, a little darker
      // than the off status.
      { variant: 'tag', tone: 'off', className: 'bg-off-weak text-fg-3' },
      { variant: ['pill', 'tag'], tone: 'brand', className: 'bg-brand-weak text-brand' },
      { variant: 'count', tone: 'ok', className: 'bg-ok text-on-status' },
      { variant: 'count', tone: 'info', className: 'bg-info text-on-status' },
      { variant: 'count', tone: 'warn', className: 'bg-warn text-on-status' },
      { variant: 'count', tone: 'error', className: 'bg-error text-on-status' },
      { variant: 'count', tone: 'off', className: 'bg-off text-on-status' },
      { variant: 'count', tone: 'brand', className: 'bg-brand-strong text-on-brand' },
    ],
    defaultVariants: {
      variant: 'default',
    },
  },
)

type BadgeVariantProps = VariantProps<typeof badgeVariants>

/** A count badge is red until told otherwise; a pill and a tag are plain. */
function defaultTone(variant: BadgeVariantProps['variant']): NonNullable<BadgeVariantProps['tone']> {
  return variant === 'count' ? 'error' : 'off'
}

function Badge({
  className,
  variant = 'default',
  tone,
  render,
  ...props
}: useRender.ComponentProps<'span'> & BadgeVariantProps) {
  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>(
      {
        className: cn(badgeVariants({ variant, tone: tone ?? defaultTone(variant) }), className),
      },
      props,
    ),
    render,
    state: {
      slot: 'badge',
      variant,
    },
  })
}

export { Badge, badgeVariants }
