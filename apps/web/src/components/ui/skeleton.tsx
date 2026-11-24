import { cn } from '@/lib/utils'

/*
 * A placeholder while something loads (17 section 4.6, the mockups' .x-skel): surface-2
 * with a shine that sweeps across (docs/plan/32-owner-list-2026-10-26.md section 18.2),
 * still under Reduced and Off and in a hidden tab (the panel's motion level, MOT-01).
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'relative overflow-hidden rounded-sm bg-surface-2 after:absolute after:inset-0 after:animate-[x-shimmer_1.4s_ease-in-out_infinite] after:bg-linear-to-r after:from-transparent after:via-(--skel-shine) after:to-transparent motion-reduce:after:hidden rtl:after:[animation-direction:reverse]',
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
