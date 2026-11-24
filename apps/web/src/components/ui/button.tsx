import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'
import { LoaderCircleIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/*
 * The buttons of the design system (17 section 4.6, the mockups' .x-btn; docs/plan/35-owner-list-2026-11-04.md
 * section 12.2, APL-01): --control-h high (36 px, 44 on phones; small 32 and 36, extra small 24 and 28, large 44 and
 * 48), radius 10, the label in the callout style (subhead when small, body when large). A press shows at once, on
 * pointer-down: the button shrinks to --press (97%) on the quick spring and its colors deepen, and it springs back from
 * wherever it is when let go (it only changes color under Reduced and Off, where --press is 1). Nothing lifts on hover,
 * which would move the button under the pointer. Small sizes keep a 44 px hit area on phones (`x-target`). The 2 px
 * focus outline in --focus.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 touch-manipulation items-center justify-center border bg-clip-padding font-semibold whitespace-nowrap transition-[color,background-color,border-color,scale,filter,opacity] duration-(--dur-fast) ease-(--ease) select-none [-webkit-tap-highlight-color:transparent] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus focus-visible:outline-solid active:scale-(--press) disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-invalid:border-error [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // The brand fill. Hover and a press darken it in Light, where white text on a lighter
        // blue would drop below 4.5:1, and brighten it in Dark, where the text is dark (UI-27).
        default:
          'border-brand-strong bg-brand-strong text-on-brand hover:brightness-[.92] active:brightness-[.86] dark:hover:brightness-[1.07] dark:active:brightness-[1.14]',
        // outline and secondary are the design system's secondary button: surface-2 with a
        // hairline, tinted blue on hover, while pressed (a phone has no hover) and while its
        // menu is open.
        outline:
          'border-border bg-surface-2 text-fg-2 hover:border-brand hover:bg-brand-weak hover:text-brand active:border-brand active:bg-brand-weak active:text-brand aria-expanded:border-brand aria-expanded:bg-brand-weak aria-expanded:text-brand',
        secondary:
          'border-border bg-surface-2 text-fg-2 hover:border-brand hover:bg-brand-weak hover:text-brand active:border-brand active:bg-brand-weak active:text-brand aria-expanded:border-brand aria-expanded:bg-brand-weak aria-expanded:text-brand',
        soft: 'border-brand bg-brand-weak text-brand hover:border-brand-strong hover:bg-brand-strong hover:text-on-brand active:border-brand-strong active:bg-brand-strong active:text-on-brand',
        ghost:
          'border-transparent bg-transparent text-fg-2 hover:bg-surface-2 hover:text-foreground active:bg-surface-press active:text-foreground aria-expanded:bg-surface-2 aria-expanded:text-foreground',
        destructive:
          'border-transparent bg-error-weak text-error hover:border-error hover:bg-error hover:text-on-status active:border-error active:bg-error active:text-on-status',
        // A text link dims while pressed instead of shrinking.
        link: 'border-transparent text-brand underline-offset-4 hover:underline active:scale-100 active:opacity-70',
      },
      size: {
        default:
          'h-(--control-h) gap-2 rounded-lg px-4 text-callout has-data-[icon=inline-end]:pe-3 has-data-[icon=inline-start]:ps-3',
        xs: "x-target h-(--control-h-xs) gap-1 rounded-sm px-2 text-footnote has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "x-target h-(--control-h-sm) gap-1.5 rounded-md px-3 text-subhead has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2 [&_svg:not([class*='size-'])]:size-[15px]",
        lg: 'h-(--control-h-lg) gap-2 rounded-xl px-5 text-body has-data-[icon=inline-end]:pe-4 has-data-[icon=inline-start]:ps-4',
        icon: 'size-(--control-h) rounded-lg',
        'icon-xs': "x-target size-(--control-h-xs) rounded-sm [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': "x-target size-(--control-h-sm) rounded-md [&_svg:not([class*='size-'])]:size-[15px]",
        'icon-lg': 'size-(--control-h-lg) rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

/**
 * `pending` keeps the button's size while its action runs (docs/plan/32-owner-list-2026-10-26.md section 18.2, MOT-02):
 * the label stays in its place, unseen, and a spinner turns over it in the same box, so nothing beside or under the
 * button moves; `pendingLabel` ("Saving...") is what a screen reader hears meanwhile, and the button is aria-busy.
 * Whether it can be pressed meanwhile stays `disabled`'s. A button that is never pending leaves both out.
 */
function Button({
  className,
  variant = 'default',
  size = 'default',
  pending,
  pendingLabel,
  children,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & { pending?: boolean | undefined; pendingLabel?: string | undefined }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      aria-busy={pending === true || undefined}
      className={cn(buttonVariants({ variant, size, className }), pending !== undefined && 'relative')}
      {...props}
    >
      {pending === undefined ? (
        children
      ) : (
        <>
          <span
            aria-hidden={(pending && pendingLabel !== undefined) || undefined}
            className={cn('inline-flex items-center justify-center gap-[inherit]', pending && 'opacity-0')}
          >
            {children}
          </span>
          {pending ? (
            <>
              <LoaderCircleIcon
                aria-hidden
                className="absolute inset-0 m-auto animate-spin motion-reduce:animate-none"
              />
              {pendingLabel === undefined ? null : <span className="sr-only">{pendingLabel}</span>}
            </>
          ) : null}
        </>
      )}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
