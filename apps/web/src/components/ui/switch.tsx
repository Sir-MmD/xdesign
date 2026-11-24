import { Switch as SwitchPrimitive } from '@base-ui/react/switch'
import { useViewOnly } from '@/components/viewOnly'
import { cn } from '@/lib/utils'

/*
 * The design system's switch (17 section 4.6, the mockups' .x-switch): a 36 x 20 track in
 * the control color (3:1), the brand fill when on, a surface thumb; on phones 44 x 24 with a
 * hit area of at least 44 px (docs/plan/35-owner-list-2026-11-04.md section 12.2). The thumb
 * (--thumb wide) slides on the quick spring, so a switch flipped again turns back from where
 * it is, and stretches 4 px toward the middle while pressed. The transparent border becomes
 * visible in forced colors, so the track keeps its outline there (4.8); there the fills turn
 * into system colors (Highlight when on, a CanvasText thumb), or on and off would look the
 * same once the browser drops the backgrounds.
 */
function Switch({
  className,
  size = 'default',
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: 'sm' | 'default'
}) {
  const viewOnly = useViewOnly()
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        'peer group/switch relative inline-flex h-[calc(var(--thumb)+4px)] w-[calc(var(--thumb)*2+4px)] shrink-0 touch-manipulation items-center rounded-full border border-transparent p-px transition-colors duration-(--dur-fast) ease-(--ease) outline-none [--thumb:16px] [-webkit-tap-highlight-color:transparent] group-has-[:focus-visible]/field-label:outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus focus-visible:outline-solid aria-invalid:ring-1 aria-invalid:ring-error data-[size=sm]:[--thumb:12px] max-[760px]:[--thumb:20px] max-[760px]:after:-inset-y-3 max-[760px]:data-[size=sm]:[--thumb:16px] forced-colors:border-[CanvasText] forced-colors:forced-color-adjust-none data-checked:bg-brand-strong forced-colors:data-checked:border-[Highlight] forced-colors:data-checked:bg-[Highlight] data-unchecked:bg-control forced-colors:data-unchecked:bg-[Canvas] data-disabled:cursor-not-allowed data-disabled:opacity-50',
        className,
      )}
      {...props}
      {...(viewOnly ? { disabled: true } : {})}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-(--thumb) rounded-full bg-surface shadow-(--shadow-sm) ring-0 transition-[translate,width] duration-(--dur-fast) ease-(--ease) group-active/switch:w-[calc(var(--thumb)+4px)] forced-colors:bg-[CanvasText] forced-colors:forced-color-adjust-none data-checked:translate-x-(--thumb) group-active/switch:data-checked:translate-x-[calc(var(--thumb)-4px)] rtl:data-checked:-translate-x-(--thumb) rtl:group-active/switch:data-checked:-translate-x-[calc(var(--thumb)-4px)] forced-colors:data-checked:bg-[HighlightText] data-unchecked:translate-x-0"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
