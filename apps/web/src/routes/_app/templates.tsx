import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { routes } from '@xdesign/api'
import { LayoutTemplateIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { call, useApi, useApiMutation } from '@/api/client'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { FormProblem } from '@/components/forms'
import { Skeleton } from '@/components/ui/skeleton'
import { TemplateCard, type TemplateData } from '@/designs/TemplateCard'
import { useLast } from '@/lib/useLast'

// The template gallery (docs/plan/04 section 15, TPL-01): the built-in starter templates, then
// the site's own (saved with "Save as template" from a design's menu), each a card with its
// picture, description and "Use this template", which makes a new design of the person's and
// opens it in the editor.
export const Route = createFileRoute('/_app/templates')({
  component: Templates,
})

const gridClass = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

function Templates() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const list = useApi(routes.templates)
  const [usingId, setUsingId] = useState<string>()
  const [removing, setRemoving] = useState<TemplateData>()
  const shownRemoving = useLast(removing)
  const use = useApiMutation(routes.useTemplate, {
    onSuccess: async ({ design }) => {
      void queryClient.invalidateQueries({ queryKey: [routes.designs.key] })
      await navigate({ to: '/d/$id', params: { id: design.id } })
    },
    onError: (error) => {
      toast.error(error.message)
    },
    onSettled: () => {
      setUsingId(undefined)
    },
  })
  const templates = list.data?.templates ?? []
  const builtIn = templates.filter((template) => template.builtIn)
  const own = templates.filter((template) => !template.builtIn)

  const cards = (items: TemplateData[], label: string) => (
    <ul aria-label={label} className={gridClass}>
      {items.map((template) => (
        <li key={template.id} className="flex flex-col *:flex-1">
          <TemplateCard
            template={template}
            using={usingId === template.id}
            onUse={(chosen) => {
              if (use.isPending) return
              setUsingId(chosen.id)
              use.mutate({ params: { id: chosen.id } })
            }}
            onRemove={setRemoving}
          />
        </li>
      ))}
    </ul>
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-title-2 font-bold">Templates</h1>
        <p className="text-callout text-fg-2">Start a new design from a template; it becomes yours to change.</p>
      </div>
      {list.isPending ? (
        <div role="status" aria-label="Loading the templates" className={gridClass}>
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : list.isError ? (
        <FormProblem message={list.error.message} />
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-title-3 font-semibold">Starter templates</h2>
            {cards(builtIn, 'Starter templates')}
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="text-title-3 font-semibold">This site's templates</h2>
            {own.length === 0 ? (
              <EmptyState
                icon={LayoutTemplateIcon}
                title="No templates of this site yet."
                description='Choose "Save as template" in the menu of a design you own.'
              />
            ) : (
              cards(own, "This site's templates")
            )}
          </section>
        </>
      )}
      <ConfirmDialog
        open={removing !== undefined}
        onOpenChange={(open) => {
          if (!open) setRemoving(undefined)
        }}
        title={`Remove the template ${shownRemoving?.name ?? ''}?`}
        description="Designs made from it stay. This cannot be undone."
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!removing) return
          await call(routes.deleteTemplate, { params: { id: removing.id } })
          await queryClient.invalidateQueries({ queryKey: [routes.templates.key] })
        }}
      />
    </div>
  )
}
