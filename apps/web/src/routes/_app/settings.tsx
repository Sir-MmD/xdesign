import { zodResolver } from '@hookform/resolvers/zod'
import { keepPreviousData, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { pageNumber, routes, type SiteSettings, siteSettings } from '@xdesign/api'
import { HistoryIcon } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { apiKey, isApiError, useApi, useApiMutation } from '@/api/client'
import { requireRoute, requireSiteOwner } from '@/app/session'
import { EmptyState } from '@/components/EmptyState'
import { FormProblem, TextField } from '@/components/forms'
import { PagerBar } from '@/components/Pager'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { revealTop, usePageInRange, usePager } from '@/components/usePager'
import { formatDateTime } from '@/lib/time'
import { cn } from '@/lib/utils'
import { activityText, activityWho } from '@/settings/activityText'
import { AddressCard } from '@/settings/AddressCard'
import { ClaudeCard } from '@/settings/ClaudeCard'
import { HttpsCard } from '@/settings/HttpsCard'

// Settings (docs/plan/04 section 1, 05 section 9), for the site owner only: the site name and the
// upload limit, the site's port and path (settings/AddressCard.tsx) and HTTPS (settings/
// HttpsCard.tsx), both through the server helper, (MCP-01b) Claude connections (settings/
// ClaudeCard.tsx), and Activity, the list of sign-ins, invites, role changes, deletes and restores
// with filters by person and design and (ACT-01) the pager under it; its open page is the page's
// `page` search, so a reload or a link keeps it.
const searchSchema = z.object({
  page: pageNumber.optional().catch(undefined),
})

export const Route = createFileRoute('/_app/settings')({
  validateSearch: searchSchema,
  beforeLoad: async ({ context, location }) => {
    await requireSiteOwner(context.queryClient, location.href)
    await requireRoute(context.queryClient, 'updateSettings')
  },
  component: Settings,
})

function Settings() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="text-title-2 font-bold">Settings</h1>
      <SiteCard />
      <AddressCard />
      <HttpsCard />
      <ClaudeCard />
      <Activity />
    </div>
  )
}

function SiteCard() {
  const settings = useApi(routes.settings)
  return (
    <Card>
      <CardContent>
        {settings.isPending ? (
          <div role="status" aria-label="Loading the settings" className="flex flex-col gap-3">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : settings.isError ? (
          <FormProblem message={settings.error.message} />
        ) : (
          <SiteForm values={settings.data} />
        )}
      </CardContent>
    </Card>
  )
}

/** The site name (the top bar, the sign-in and invite pages) and the upload limit per file in MB. */
function SiteForm({ values }: { values: SiteSettings }) {
  const queryClient = useQueryClient()
  const [problem, setProblem] = useState<string>()
  const update = useApiMutation(routes.updateSettings)
  const form = useForm({ resolver: zodResolver(siteSettings), defaultValues: values })
  const { errors, isSubmitting, isDirty } = form.formState

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        void form.handleSubmit(async (body) => {
          setProblem(undefined)
          try {
            const saved = await update.mutateAsync({ body })
            queryClient.setQueryData(apiKey(routes.settings), saved)
            void queryClient.invalidateQueries({ queryKey: [routes.site.key] })
            form.reset(saved)
            toast.success('Settings saved.')
          } catch (error) {
            setProblem(isApiError(error) || error instanceof Error ? error.message : String(error))
          }
        })(event)
      }}
    >
      <TextField label="Site name" autoComplete="off" error={errors.siteName?.message} {...form.register('siteName')} />
      <TextField
        label="Upload limit (MB)"
        type="number"
        inputMode="numeric"
        min={1}
        max={2000}
        className="max-w-40"
        description="The largest file a member can upload."
        error={errors.uploadLimitMb?.message}
        {...form.register('uploadLimitMb', { valueAsNumber: true })}
      />
      <FormProblem message={problem} />
      <Button type="submit" className="self-start" disabled={!isDirty || isSubmitting} pending={isSubmitting}>
        Save
      </Button>
    </form>
  )
}

// The filters' "everyone" and "every design": an empty value, never an ID.
const anyone = ''

/**
 * Activity: newest first, filtered by person and design, a page at a time with the pager under it
 * (ACT-01): 10, 25, 50 or 100 rows per page (25 to start, kept in this browser); a change of a
 * filter goes back to page 1, and a page past the end opens the last page.
 */
function Activity() {
  const personId = useId()
  const designId = useId()
  const [user, setUser] = useState(anyone)
  const [design, setDesign] = useState(anyone)
  const members = useApi(routes.members)
  const designs = useApi(routes.designs, { query: { filter: 'all' } })
  const filter = { user: user === anyone ? undefined : user, design: design === anyone ? undefined : design }
  const pager = usePager({ id: 'activity', resetKey: `${user}/${design}` })
  const activity = useApi(
    routes.activity,
    { query: { ...filter, page: pager.page, size: pager.size } },
    { placeholderData: keepPreviousData },
  )
  const entries = activity.data?.entries ?? []
  const total = activity.data?.total
  usePageInRange(pager, total)
  const listTop = useRef<HTMLUListElement>(null)
  const people = [
    { value: anyone, label: 'Everyone' },
    ...(members.data?.members ?? []).map((member) => ({ value: member.id, label: member.name })),
  ]
  const designItems = [
    { value: anyone, label: 'All designs' },
    ...(designs.data?.designs ?? []).map((item) => ({ value: item.id, label: item.name })),
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Activity</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor={personId} className="text-subhead font-semibold">
              Person
            </label>
            <Select
              items={people}
              value={user}
              onValueChange={(value) => {
                setUser(value ?? anyone)
              }}
            >
              <SelectTrigger id={personId} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {people.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor={designId} className="text-subhead font-semibold">
              Design
            </label>
            <Select
              items={designItems}
              value={design}
              onValueChange={(value) => {
                setDesign(value ?? anyone)
              }}
            >
              <SelectTrigger id={designId} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {designItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* A page past the end of a list that has rows moves to the last page: it loads meanwhile. */}
        {activity.isPending || (entries.length === 0 && (total ?? 0) > 0) ? (
          <div role="status" aria-label="Loading the activity" className="flex flex-col gap-2">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : activity.isError ? (
          <FormProblem message={activity.error.message} />
        ) : entries.length === 0 ? (
          <EmptyState icon={HistoryIcon} title="Nothing here yet." />
        ) : (
          <ul
            ref={listTop}
            aria-busy={activity.isPlaceholderData}
            className={cn(
              'flex flex-col divide-y rounded-xl border transition-opacity',
              activity.isPlaceholderData && 'opacity-60',
            )}
          >
            {entries.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-0.5 px-4 py-2.5">
                <span dir="auto" className="text-callout break-words">
                  {activityText(entry)}
                </span>
                <span className="text-footnote text-fg-3">
                  {activityWho(entry)}
                  {entry.design ? (
                    <>
                      {' · '}
                      <span dir="auto">{entry.design.name ?? 'A deleted design'}</span>
                    </>
                  ) : null}
                  {' · '}
                  <time dateTime={new Date(entry.at).toISOString()}>{formatDateTime(entry.at)}</time>
                </span>
              </li>
            ))}
          </ul>
        )}
        {entries.length === 0 || total === undefined ? null : (
          <PagerBar
            pager={pager}
            total={total}
            aria-label="Activity"
            onPageOpened={() => {
              revealTop(listTop.current)
            }}
          />
        )}
      </CardContent>
    </Card>
  )
}
