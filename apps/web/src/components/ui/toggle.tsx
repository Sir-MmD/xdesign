import { Toggle as TogglePrimitive } from '@base-ui/react/toggle'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/*
 * A toggle of the design system (17 section 4.6). `default` is a choice of the segmented
 * control (the mockups' .x-seg, its track drawn by ToggleGroup): the chosen one on the
 * surface in brand. `outline` is a filter chip (.x-chip with aria-pressed): surface-2, and
 * brand-weak with a brand border when on. A choice that does not apply reads in the third
 * ink on the track and has no hover; `data-[disabled]` comes after aria-pressed with the same
 * specificity, so it also wins over "chosen". A choice is 8 px lower than the controls around
 * it (its track's padding and border make up the rest), so a segmented control stands as high
 * as a button: 36 px, 44 on phones, where each choice keeps a 44 px hit area (`x-target`). A
 * press shrinks it to --press on the quick spring (docs/plan/35-owner-list-2026-11-04.md
 * section 12.2, APL-01).
 */
const toggleVariants = cva(
  "group/toggle x-target inline-flex touch-manipulation items-center justify-center gap-1.5 border border-transparent font-semibold whitespace-nowrap text-fg-2 transition-[color,background-color,border-color,box-shadow,scale] duration-(--dur-fast) ease-(--ease) outline-none [-webkit-tap-highlight-color:transparent] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus focus-visible:outline-solid active:scale-(--press) disabled:pointer-events-none aria-invalid:border-error aria-pressed:bg-surface aria-pressed:text-brand aria-pressed:shadow-[0_0_0_1px_var(--border),var(--shadow-sm)] data-[disabled]:pointer-events-none data-[disabled]:bg-transparent data-[disabled]:text-fg-3 data-[disabled]:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[15px]",
  {
    variants: {
      variant: {
        default: 'rounded-[7px] bg-transparent',
        outline:
          'rounded-full bg-surface-2 hover:border-brand hover:text-brand active:border-brand active:text-brand aria-pressed:border-brand aria-pressed:bg-brand-weak aria-pressed:shadow-none',
      },
      size: {
        default:
          'h-[calc(var(--control-h)-8px)] min-w-[calc(var(--control-h)-8px)] px-3 text-subhead has-data-[icon=inline-end]:pe-2.5 has-data-[icon=inline-start]:ps-2.5',
        sm: 'h-[calc(var(--control-h-sm)-8px)] min-w-[calc(var(--control-h-sm)-8px)] px-2 text-caption has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2',
        lg: 'h-[calc(var(--control-h-lg)-8px)] min-w-[calc(var(--control-h-lg)-8px)] px-4 text-callout has-data-[icon=inline-end]:pe-3 has-data-[icon=inline-start]:ps-3',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Toggle({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return <TogglePrimitive data-slot="toggle" className={cn(toggleVariants({ variant, size, className }))} {...props} />
}

export { Toggle, toggleVariants }
