import { createFileRoute } from '@tanstack/react-router'
import { routes } from '@xdesign/api'
import { useState } from 'react'

import { useApi } from '@/api/client'
import { requireRoute, requireSiteOwner } from '@/app/session'
import { BackupsCard } from '@/maintenance/BackupsCard'
import { adoptRun, helperRetry, type Run } from '@/maintenance/follow'
import { GoBackCard } from '@/maintenance/GoBackCard'
import { StatusCard } from '@/maintenance/StatusCard'
import { UninstallCard } from '@/maintenance/UninstallCard'
import { UpdateCard } from '@/maintenance/UpdateCard'

// Maintenance (docs/plan/07 sections 5, 6.2 and 8), for the site owner only, through the Go
// helper's control socket: this server's version and status, Backups, Update, Go back and
// (docs/plan/19 section 4) Uninstall xDesign. The page follows one request of the maintenance
// helper at a time (an update, a rollback, a restore or an uninstall), the one it started or the
// one the server works on when the page opens.
export const Route = createFileRoute('/_app/maintenance')({
  beforeLoad: async ({ context, location }) => {
    await requireSiteOwner(context.queryClient, location.href)
    await requireRoute(context.queryClient, 'maintenance')
  },
  component: Maintenance,
})

function Maintenance() {
  // While the server works on a request the page does not follow, its state is read every 5 seconds.
  const status = useApi(routes.maintenance, undefined, {
    retry: helperRetry,
    refetchInterval: (query) => (query.state.data?.pending || query.state.data?.progress ? 5000 : false),
  })
  const [run, setRun] = useState<Run>()
  const [adopted, setAdopted] = useState(false)
  const data = status.data
  if (data && !adopted) {
    setAdopted(true)
    const found = adoptRun(data)
    if (found) setRun(found)
  }
  // An uninstall stays busy after its result, as the site stops next.
  const ended = run !== undefined && run.kind !== 'uninstall' && data?.last?.id === run.id
  const busy = (run !== undefined && !ended) || Boolean(data?.pending) || Boolean(data?.progress)
  const ready = data?.helper.state === 'ready'
  const done = () => {
    setRun(undefined)
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="text-title-2 font-bold">Maintenance</h1>
      <StatusCard last={data?.last} followedId={run?.id} />
      <BackupsCard
        ready={ready}
        busy={busy}
        run={run?.kind === 'restore' ? run : undefined}
        onStart={setRun}
        onDone={done}
      />
      <UpdateCard
        helper={data?.helper}
        helperError={status.error}
        busy={busy}
        run={run?.kind === 'update' ? run : undefined}
        onStart={setRun}
        onDone={done}
      />
      <GoBackCard
        ready={ready}
        busy={busy}
        run={run?.kind === 'rollback' ? run : undefined}
        onStart={setRun}
        onDone={done}
      />
      <UninstallCard
        ready={ready}
        busy={busy}
        run={run?.kind === 'uninstall' ? run : undefined}
        onStart={setRun}
        onDone={done}
      />
    </div>
  )
}
