// Follows a request of the root helper (an update, a rollback, a restore, a domain or address
// change, an uninstall; docs/plan/07 section 6.2): GET /api/maintenance every 2 seconds says whether it waits,
// the step it is at and, at the end, its result. While xDesign restarts the calls fail: the
// request is `down` then, and `wentDown` stays once it was.
import { useQuery } from '@tanstack/react-query'
import { type MaintenanceProgress, type MaintenanceResult, type RouteResponse, routes } from '@xdesign/api'
import { useEffect, useState } from 'react'

import { apiQuery, type ApiError, isApiError } from '@/api/client'

const pollMs = 2000
// A request the helper has not taken after this long gets the notice about its units.
const takeMs = 2 * 60 * 1000

export interface Followed {
  /** The helper has not taken the request yet. */
  waiting: boolean
  /** It waits longer than 2 minutes: the maintenance helper may be off. */
  notTaken: boolean
  progress: MaintenanceProgress | undefined
  result: MaintenanceResult | undefined
  /** xDesign does not answer now (it restarts). */
  down: boolean
  /** xDesign stopped answering at least once since the request. */
  wentDown: boolean
}

/** Queries of the helper's routes: a helper that does not run answers the same again. */
export function helperRetry(failures: number, error: ApiError): boolean {
  return failures < 2 && error.code !== 'no_helper' && !(error.status >= 400 && error.status < 500)
}

export function useFollow(id: string | undefined): Followed {
  const [now, setNow] = useState(0)
  const [wentDown, setWentDown] = useState(false)
  const status = useQuery({
    ...apiQuery(routes.maintenance),
    enabled: id !== undefined,
    refetchInterval: (query) => (query.state.data?.last?.id === id ? false : pollMs),
    refetchIntervalInBackground: true,
    retry: false,
  })
  const data = status.data
  // The parts of the answer about this request.
  const mine = <T extends { id: string }>(part: T | null | undefined) =>
    part && id !== undefined && part.id === id ? part : undefined
  const result = mine(data?.last)
  // A signed-out answer is not a restart; the session's handler takes over.
  const down = status.isError && !(isApiError(status.error) && status.error.status === 401) && !result
  if (down && !wentDown) setWentDown(true)
  const pending = !result && !down ? mine(data?.pending) : undefined
  const waiting = pending !== undefined
  useEffect(() => {
    if (!waiting) return
    const timer = setInterval(() => {
      setNow(Date.now())
    }, pollMs)
    return () => {
      clearInterval(timer)
    }
  }, [waiting])
  const requestedAt = pending?.requestedAt
  return {
    waiting,
    notTaken: waiting && typeof requestedAt === 'number' && now - requestedAt > takeMs,
    progress: result ? undefined : mine(data?.progress),
    result,
    down,
    wentDown,
  }
}

/** A request of Maintenance this tab follows: an update, a rollback, a restore or an uninstall. */
export interface Run {
  id: string
  kind: 'update' | 'rollback' | 'restore' | 'uninstall'
  /** The version that ran when it started, and the one it goes to (the backup's name for a restore). */
  from: string
  to: string
  /** An uninstall's choice: "Keep the data" or "Remove everything". */
  keepData?: boolean
}

type Status = RouteResponse<typeof routes.maintenance>

/** The request the server works on when the page opens (started in another tab, or before a reload). */
export function adoptRun(status: Status): Run | undefined {
  const request = status.pending ?? undefined
  const progress = status.progress ?? undefined
  const id = progress?.id ?? request?.id
  const kind = progress?.kind ?? request?.kind
  if (id === undefined || (kind !== 'update' && kind !== 'rollback' && kind !== 'restore' && kind !== 'uninstall')) {
    return undefined
  }
  const to = request?.rollback?.to ?? request?.restore?.backup ?? ''
  return { id, kind, from: status.running.version, to, keepData: request?.uninstall?.keepData }
}

/** "Backing up the site... 41%": the helper's step with its percent. */
export function progressLine(progress: MaintenanceProgress): string {
  const percent = progress.percent === undefined ? '' : ` ${String(progress.percent)}%`
  const detail = progress.detail ? ` (${progress.detail})` : ''
  return `${progress.title}...${percent}${detail}`
}
