// The design's checks (docs/plan/04 section 9, SPEC-05's `check`) for the top bar's count, the
// Checks panel and the map's badges: one run per open design (checks/runner.ts), 200 ms after the
// last change, in a web worker above 100 steps, so typing stays quick on a large design.
import type { Issue } from '@xdesign/spec'
import { useMemo, useSyncExternalStore } from 'react'

import { ChecksRunner } from './checks/runner'
import { useEditor } from './context'
import type { LiveDesign } from './live'

const runners = new WeakMap<LiveDesign, ChecksRunner>()

/** Every issue of the design, ignored ones included (marked `ignored`). */
export function useChecks(): Issue[] {
  const { live } = useEditor()
  let runner = runners.get(live)
  if (!runner) {
    runner = new ChecksRunner(live)
    runners.set(live, runner)
  }
  return useSyncExternalStore(runner.subscribe, runner.get)
}

/** The count the "Checks" button shows: errors and warnings that are not ignored. */
export function useCheckCount(): { errors: number; warnings: number } {
  const issues = useChecks()
  return useMemo(() => {
    let errors = 0
    let warnings = 0
    for (const issue of issues) {
      if (issue.ignored) continue
      if (issue.level === 'error') errors++
      else if (issue.level === 'warning') warnings++
    }
    return { errors, warnings }
  }, [issues])
}
