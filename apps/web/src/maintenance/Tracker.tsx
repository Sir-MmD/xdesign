import { CheckIcon, LoaderCircleIcon, TriangleAlertIcon, XIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

// Copied from xWriter's web/src/features/panel-settings/update/Tracker.tsx (its section numbers
// are xWriter's plan), without the test IDs.

/** pending: not started; active: running now; done; failed; warn: ended, but wants a look. */
export type StepState = 'pending' | 'active' | 'done' | 'failed' | 'warn'

export interface TrackerStep {
  title: string
  state: StepState
  /** The step's line: what it does, how far it is, or how it ended. */
  line?: ReactNode
  /** Under the line, for example the upload's progress bar. */
  extra?: ReactNode
}

const stateWords: Readonly<Record<StepState, string>> = {
  pending: 'not started',
  active: 'in progress',
  done: 'done',
  failed: 'failed',
  warn: 'needs a look',
}

const markClasses: Readonly<Record<StepState, string>> = {
  pending: 'border-[1.5px] border-border-strong bg-card text-fg-3',
  active: 'bg-brand-weak text-brand',
  done: 'bg-ok-weak text-ok',
  failed: 'bg-error-weak text-error',
  warn: 'bg-warn-weak text-warn',
}

function Mark({ state, number }: { state: StepState; number: number }) {
  const Icon = state === 'done' ? CheckIcon : state === 'failed' ? XIcon : state === 'warn' ? TriangleAlertIcon : null
  return (
    <span
      aria-hidden
      className={cn(
        'z-[1] grid size-6 place-items-center rounded-full border-transparent text-caption-2 font-bold tabular-nums forced-colors:border',
        markClasses[state],
      )}
    >
      {state === 'active' ? (
        <LoaderCircleIcon className="size-3.5 animate-spin motion-reduce:animate-none" />
      ) : Icon ? (
        <Icon className="size-3.5 stroke-[2.6]" />
      ) : (
        number
      )}
    </span>
  )
}

/**
 * The steps of an install or a rollback (docs/plan/18-install-ssl-update.md section 7.3, in the timeline look of 17
 * section 4.6): a numbered mark on a rail per step, its title and its line. The running step is `aria-current`, and
 * each title tells its state to screen readers.
 */
export function Tracker({
  steps,
  label,
}: {
  steps: readonly TrackerStep[]
  /** What the steps do, for example "Installing xDesign 1.1.0". */ label: string
}) {
  return (
    <ol aria-label={label} className="m-0 flex list-none flex-col p-0">
      {steps.map((step, index) => (
        <li
          key={step.title}
          aria-current={step.state === 'active' ? 'step' : undefined}
          data-state={step.state}
          className={cn(
            "relative grid grid-cols-[24px_minmax(0,1fr)] gap-x-3 pb-4 before:absolute before:start-[11px] before:top-7 before:bottom-1 before:w-0.5 before:rounded-full before:content-[''] last:pb-0 last:before:hidden",
            step.state === 'done' ? 'before:bg-ok/45' : 'before:bg-border',
          )}
        >
          <Mark state={step.state} number={index + 1} />
          <div className="flex min-w-0 flex-col gap-0.5 pt-0.5">
            <span
              className={cn('text-callout font-semibold', step.state === 'pending' ? 'text-fg-2' : 'text-foreground')}
            >
              {step.title}
              <span className="sr-only">, {stateWords[step.state]}</span>
            </span>
            {step.line ? <span className="text-subhead [overflow-wrap:anywhere] text-fg-2">{step.line}</span> : null}
            {step.extra}
          </div>
        </li>
      ))}
    </ol>
  )
}

/** A thin bar for a percent, 0 to 100 (the upload, the helper's steps). */
export function ProgressBar({ value, label }: { value: number; label: string }) {
  const percent = Math.min(100, Math.max(0, value))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      className="mt-1.5 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-surface-2"
    >
      <div
        className="h-full rounded-full bg-brand transition-[width] duration-(--dur-fast) ease-(--ease)"
        style={{ width: `${String(percent)}%` }}
      />
    </div>
  )
}
