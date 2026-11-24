import { keepPreviousData, useQueryClient } from '@tanstack/react-query'
import { type DesignRole, type designMember, routes } from '@xdesign/api'
import { useId, useState } from 'react'
import { toast } from 'sonner'
import type { z } from 'zod'

import { useApi, useApiMutation } from '@/api/client'
import { useMe } from '@/app/session'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormProblem } from '@/components/forms'
import { PersonAvatar } from '@/components/PersonAvatar'
import { Button } from '@/components/ui/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ClaudeLinksSection } from '@/designs/ClaudeLinksSection'
import { type MemberRole, memberRoles, roleNames } from '@/designs/roles'
import { ViewLinksSection } from '@/designs/ViewLinksSection'
import { useDebounced } from '@/lib/useDebounced'
import { useLast } from '@/lib/useLast'

type Person = z.output<typeof designMember>
interface Found {
  id: string
  name: string
  username: string
}

const memberRoleItems = memberRoles.map((role) => ({ value: role, label: roleNames[role] }))
// The site owner may also make a member the design owner (05 section 2, "Transfer ownership").
const siteOwnerRoleItems = [...memberRoleItems, { value: 'owner' as const, label: roleNames.owner }]

function failed(error: { message: string }) {
  toast.error(error.message)
}

/**
 * The "Share" dialog of a design (docs/plan/05 section 3), for the design owner and the site
 * owner, from the Designs page and the editor's top bar: "People with access" (the design owner
 * as "Owner", each member with their role as a drop-down and "Remove"), "Add people" (members by
 * name or username, a role, "Add") and "Not on the site yet? Ask the site owner to add them."
 * Changes take effect at once. The site owner's drop-down also has "Owner", which hands the design
 * over after a confirmation (the old design owner becomes an Editor). Then "View-only link"
 * (ViewLinksSection.tsx, VIEW-01) and "Claude link" (ClaudeLinksSection.tsx, CL-03).
 */
export function ShareDialog({
  design,
  onOpenChange,
}: {
  /** The design to share; the dialog is open while it is set. */
  design: { id: string; name: string } | undefined
  onOpenChange: (open: boolean) => void
}) {
  const shown = useLast(design)
  return (
    <Dialog open={design !== undefined} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {shown ? <ShareBody key={shown.id} design={shown} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function ShareBody({ design }: { design: { id: string; name: string } }) {
  const me = useMe()
  const queryClient = useQueryClient()
  const list = useApi(routes.designMembers, { params: { id: design.id } })
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: [routes.designMembers.key] })
    void queryClient.invalidateQueries({ queryKey: [routes.designs.key] })
  }
  const setRole = useApiMutation(routes.setDesignMember, { onSuccess: refresh, onError: failed })
  const remove = useApiMutation(routes.removeDesignMember, { onSuccess: refresh, onError: failed })
  const transfer = useApiMutation(routes.transferDesign)
  const [newOwner, setNewOwner] = useState<Person>()
  const peopleId = useId()
  const members = list.data?.members ?? []
  const owner = members.find((person) => person.role === 'owner')
  const roleItems = me.isSiteOwner ? siteOwnerRoleItems : memberRoleItems

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          Share <span dir="auto">{design.name}</span>
        </DialogTitle>
      </DialogHeader>
      <section aria-labelledby={peopleId} className="flex flex-col gap-2">
        <h3 id={peopleId} className="text-callout font-semibold">
          People with access
        </h3>
        {list.isPending ? (
          <div role="status" aria-label="Loading the people with access" className="flex flex-col gap-2">
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        ) : list.isError ? (
          <FormProblem message={list.error.message} />
        ) : (
          <ul className="flex flex-col divide-y rounded-xl border">
            {members.map((person) => {
              const busy =
                (setRole.isPending && setRole.variables.params.userId === person.id) ||
                (remove.isPending && remove.variables.params.userId === person.id)
              return (
                <li key={person.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
                  <PersonAvatar name={person.name} color={person.color} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-callout font-semibold">
                      {person.name}
                      {person.id === me.id ? <span className="font-normal text-fg-3"> (you)</span> : null}
                    </span>
                    <span className="truncate text-footnote text-fg-3">@{person.username}</span>
                  </div>
                  {person.role === 'owner' ? (
                    <span className="px-2 text-subhead text-fg-2">{roleNames.owner}</span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Select<DesignRole>
                        items={roleItems}
                        value={person.role}
                        disabled={busy}
                        onValueChange={(role) => {
                          if (role === 'owner') setNewOwner(person)
                          else if (role !== null && role !== person.role) {
                            setRole.mutate({ params: { id: design.id, userId: person.id }, body: { role } })
                          }
                        }}
                      >
                        <SelectTrigger size="sm" aria-label={`Role of ${person.name}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roleItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          remove.mutate({ params: { id: design.id, userId: person.id } })
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
      <AddPeople designId={design.id} taken={members} onAdded={refresh} />
      <p className="text-footnote text-fg-3">Not on the site yet? Ask the site owner to add them.</p>
      <ViewLinksSection designId={design.id} />
      <ClaudeLinksSection designId={design.id} />
      <ConfirmDialog
        open={newOwner !== undefined}
        onOpenChange={(open) => {
          if (!open) setNewOwner(undefined)
        }}
        title={`Make ${newOwner?.name ?? ''} the design owner?`}
        description={owner ? `${owner.name} becomes an Editor.` : undefined}
        confirmLabel="Make owner"
        destructive={false}
        onConfirm={async () => {
          if (!newOwner) return
          await transfer.mutateAsync({ params: { id: design.id }, body: { userId: newOwner.id } })
          await refresh()
        }}
      />
    </>
  )
}

/** "Add people": a member found by name or username, a role ("Editor" first), "Add". */
function AddPeople({
  designId,
  taken,
  onAdded,
}: {
  designId: string
  /** The people with access already, left out of the list. */
  taken: readonly { id: string }[]
  onAdded: () => Promise<void>
}) {
  const headingId = useId()
  const [query, setQuery] = useState('')
  const [person, setPerson] = useState<Found | null>(null)
  const [role, setRole] = useState<MemberRole>('editor')
  const words = useDebounced(query.trim())
  const search = useApi(routes.searchMembers, { query: { q: words } }, { placeholderData: keepPreviousData })
  const found = (search.data?.members ?? []).filter((member) => !taken.some((other) => other.id === member.id))
  const add = useApiMutation(routes.setDesignMember, {
    onSuccess: async () => {
      setPerson(null)
      setQuery('')
      await onAdded()
    },
    onError: failed,
  })

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className="text-callout font-semibold">
        Add people
      </h3>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (person && !add.isPending) add.mutate({ params: { id: designId, userId: person.id }, body: { role } })
        }}
      >
        <Combobox<Found>
          items={found}
          filter={null}
          value={person}
          onValueChange={setPerson}
          inputValue={query}
          onInputValueChange={(text) => {
            setQuery(text)
            if (person && text !== person.name) setPerson(null)
          }}
          itemToStringLabel={(member) => member.name}
          itemToStringValue={(member) => member.id}
          isItemEqualToValue={(a, b) => a.id === b.id}
        >
          <ComboboxInput
            className="min-w-48 flex-1"
            placeholder="Name or username"
            aria-label="Search members by name or username"
            showTrigger={false}
          />
          <ComboboxContent>
            <ComboboxEmpty>No member matches.</ComboboxEmpty>
            <ComboboxList>
              {(member: Found) => (
                <ComboboxItem key={member.id} value={member}>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{member.name}</span>
                    <span className="truncate text-footnote text-fg-3">@{member.username}</span>
                  </span>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        <Select
          items={memberRoleItems}
          value={role}
          onValueChange={(next) => {
            if (next !== null) setRole(next)
          }}
        >
          <SelectTrigger aria-label="Role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {memberRoleItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" disabled={!person || add.isPending} pending={add.isPending}>
          Add
        </Button>
      </form>
    </section>
  )
}
