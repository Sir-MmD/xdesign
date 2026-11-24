import { CircleAlertIcon, InfoIcon, TriangleAlertIcon } from 'lucide-react'

import { type ApiError } from '@/api/client'
import { CopyButton } from '@/components/CopyButton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

// Pieces of Settings > HTTPS and Maintenance, the pages of the Go helper's control socket.

/**
 * Why a helper's answer is missing: "The server helper is not running (development)." as a note
 * in `make dev`, any other failure as a problem.
 */
export function HelperProblem({ error }: { error: ApiError }) {
  if (error.code === 'no_helper') {
    return (
      <Alert role="status">
        <InfoIcon aria-hidden />
        <AlertTitle className="font-semibold">{error.message}</AlertTitle>
      </Alert>
    )
  }
  return (
    <Alert variant="destructive">
      <CircleAlertIcon aria-hidden />
      <AlertTitle className="font-semibold">{error.message}</AlertTitle>
    </Alert>
  )
}

export function Loading({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-2">
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  )
}

/** A command or a path to copy, in a mono line with "Copy". */
export function CodeLine({ code, label }: { code: string; label: string }) {
  return (
    <span className="flex min-w-0 items-start gap-1">
      <code dir="ltr" className="min-w-0 rounded-md bg-surface-2 px-2 py-1 font-mono text-footnote break-all">
        {code}
      </code>
      <CopyButton value={code} label={label} className="shrink-0" />
    </span>
  )
}

/** The helper has not taken a request after 2 minutes: its path unit picks requests up. */
export function NotTakenNotice() {
  return (
    <Alert variant="warn" role="status">
      <TriangleAlertIcon aria-hidden />
      <AlertTitle>The server has not taken the request yet</AlertTitle>
      <AlertDescription className="grid gap-1.5">
        <p>The maintenance helper on the server carries out requests. Check it with:</p>
        <CodeLine code="systemctl status xdesign-maintenance.path" label="Copy the command" />
      </AlertDescription>
    </Alert>
  )
}
