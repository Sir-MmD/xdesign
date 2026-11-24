// The checks of one open design (docs/plan/04 section 9, 02 section 9): one run for the whole
// editor, so the top bar's count, the Checks panel and the map's badges read the same issues.
// A change runs SPEC-05's `check` again once the design has stayed the same for 200 ms; a design
// of more than 100 steps is checked in a web worker (worker.ts) and the main thread only posts
// it. "Ignore here" and "Stop ignoring" show at once: each change marks the last issues again
// with the design's keys, before the next run.
import { check, type Design, type Issue, issueKey } from '@xdesign/spec'

import type { LiveDesign } from '../live'
import type { CheckReply, CheckRequest } from './worker'

const WAIT_MS = 200
const WORKER_ABOVE = 100

export class ChecksRunner {
  private readonly live: LiveDesign
  private issues: Issue[] = []
  private readonly listeners = new Set<() => void>()
  /** The live document's last design and its number (one more at each change). */
  private design: Design | undefined
  private version = 0
  /** The number of the design the issues were found in. */
  private shown = 0
  /** The number of the design the worker is checking; the next one waits for its reply. */
  private asked: number | undefined
  private worker: Worker | undefined
  /** The worker could not start or failed: the checks run here. */
  private noWorker = false
  private timer: ReturnType<typeof setTimeout> | undefined
  private unwatch: (() => void) | undefined

  constructor(live: LiveDesign) {
    this.live = live
    // A small design has its issues from the first render on.
    const { design } = live.getState()
    if (design !== undefined && !this.big(design)) {
      this.design = design
      this.version = 1
      this.shown = 1
      this.issues = check(design)
    }
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    if (this.listeners.size === 1) this.start()
    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) this.stop()
    }
  }

  /** Every issue, ignored ones included (marked `ignored`); the same array until they change. */
  get = (): Issue[] => this.issues

  private start(): void {
    this.unwatch = this.live.subscribe(this.changed)
    this.see()
    this.run()
  }

  private stop(): void {
    this.unwatch?.()
    this.unwatch = undefined
    clearTimeout(this.timer)
    this.timer = undefined
    // A check the worker did not finish runs again at the next start.
    this.worker?.terminate()
    this.worker = undefined
    this.asked = undefined
  }

  /** Takes the live document's design when it is a new one; false when it is the same. */
  private see(): boolean {
    const { design } = this.live.getState()
    if (design === undefined || design === this.design) return false
    this.design = design
    this.version++
    return true
  }

  private changed = (): void => {
    if (!this.see()) return
    this.publish(this.issues)
    clearTimeout(this.timer)
    this.timer = setTimeout(this.run, WAIT_MS)
  }

  private run = (): void => {
    this.timer = undefined
    const { design, version } = this
    if (design === undefined || version === this.shown || version === this.asked) return
    if (this.noWorker || !this.big(design)) {
      this.shown = version
      this.publish(check(design))
      return
    }
    if (this.asked !== undefined) return
    this.asked = version
    this.worker ??= this.startWorker()
    const request: CheckRequest = { id: version, design }
    this.worker.postMessage(request)
  }

  private replied = ({ data }: MessageEvent<CheckReply>): void => {
    if (data.id !== this.asked) return
    this.asked = undefined
    // Newer than the issues shown, unless a design made small meanwhile was checked here.
    if (data.id > this.shown) {
      this.shown = data.id
      this.publish(data.issues)
    }
    // The design changed while the worker ran: its turn now, unless its wait is still on.
    if (this.timer === undefined) this.run()
  }

  private failed = (): void => {
    this.worker?.terminate()
    this.worker = undefined
    this.asked = undefined
    this.noWorker = true
    if (this.timer === undefined) this.run()
  }

  private startWorker(): Worker {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = this.replied
    worker.onerror = this.failed
    return worker
  }

  private big(design: Design): boolean {
    return Object.keys(design.steps).length > WORKER_ABOVE
  }

  // The issues marked with the design's "Ignore here" keys; listeners hear only of a change.
  private publish(found: Issue[]): void {
    const next = marked(found, new Set(this.design?.ignoredChecks))
    if (sameIssues(next, this.issues)) return
    this.issues = next
    for (const listener of this.listeners) listener()
  }
}

// The issues with `ignored` as the keys say (errors never); the same array when none differs.
function marked(issues: Issue[], keys: ReadonlySet<string>): Issue[] {
  const wrong = (issue: Issue) => (issue.ignorable && keys.has(issueKey(issue))) !== (issue.ignored === true)
  if (!issues.some(wrong)) return issues
  return issues.map((issue) => {
    if (!wrong(issue)) return issue
    const copy: Issue = { ...issue, ignored: true }
    if (issue.ignored === true) delete copy.ignored
    return copy
  })
}

function sameIssues(a: readonly Issue[], b: readonly Issue[]): boolean {
  return (
    a === b ||
    (a.length === b.length &&
      a.every((issue, index) => {
        const other = b[index]
        return (
          other !== undefined &&
          issue.code === other.code &&
          issue.stepId === other.stepId &&
          issue.buttonId === other.buttonId &&
          issue.language === other.language &&
          issue.message === other.message &&
          issue.ignored === other.ignored
        )
      }))
  )
}
