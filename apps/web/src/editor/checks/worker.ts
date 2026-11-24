// The checks' web worker (docs/plan/02 section 9): SPEC-05's `check` on the plain design that
// runner.ts posts for a design of more than 100 steps, so the page stays quick while it runs.
import { check, type Design, type Issue } from '@xdesign/spec'

export type CheckRequest = { id: number; design: Design }
export type CheckReply = { id: number; issues: Issue[] }

self.onmessage = (event: MessageEvent<CheckRequest>) => {
  const { id, design } = event.data
  const reply: CheckReply = { id, issues: check(design) }
  self.postMessage(reply)
}
