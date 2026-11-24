import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { routes } from '@xdesign/api'
import {
  AtSignIcon,
  BanIcon,
  CircleCheckIcon,
  EllipsisIcon,
  KeyRoundIcon,
  SearchIcon,
  ShieldOffIcon,
  UserMinusIcon,
  UserPlusIcon,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { call, useApi, useApiMutation } from '@/api/client'
import { requireRoute, requireSiteOwner, useMe } from '@/app/session'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { FormProblem } from '@/components/forms'
import { PersonAvatar } from '@/components/PersonAvatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ListGroup, ListGroupItem, ListGroupLabel, ListGroupRows } from '@/components/ui/grouped-list'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Skeleton } from '@/components/ui/skeleton'
import { useConfirmItsYou } from '@/components/useConfirmItsYou'
import { formatDateTime, timeAgo } from '@/lib/time'
import { useLast } from '@/lib/useLast'
import { AddMemberDialog } from '@/members/AddMemberDialog'
import { ChangeUsernameDialog } from '@/members/ChangeUsernameDialog'
import { designCount, type Member } from '@/members/member'
import { RemoveMemberDialog } from '@/members/RemoveMemberDialog'
import { SetPasswordDialog } from '@/members/SetPasswordDialog'

// Members (docs/plan/05 section 1), for the site owner only: the members with their "@username"
// (USER-01a, 18 section 3.4), last seen, designs and disabled state, each with (USER-02) "Set
// password" and "Change username", "Disable" or "Enable", (TFA-02, 17 section 7) "Turn off
// two-factor authentication" while it is on, and "Remove"; the site owner's own row has "Change
// username" and "Change your password on the Account page". (USER-02) "Add member" and the search
// by name or username. Invites and password reset links are gone (USER-01a).
export const Route = createFileRoute('/_app/members')({
  beforeLoad: async ({ context, location }) => {
    await requireSiteOwner(context.queryClient, location.href)
    await requireRoute(context.queryClient, 'members')
  },
  component: Members,
})

function Members() {
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="me-auto text-title-2 font-bold">Members</h1>
        <Button
          onClick={() => {
            setAdding(true)
          }}
        >
          <UserPlusIcon aria-hidden />
          Add member
        </Button>
      </div>
      <InputGroup className="min-[760px]:max-w-sm">
        <InputGroupInput
          type="search"
          value={text}
          maxLength={100}
          placeholder="Name or username"
          aria-label="Search members by name or username"
          onChange={(event) => {
            setText(event.target.value)
          }}
        />
        <InputGroupAddon>
          <SearchIcon aria-hidden />
        </InputGroupAddon>
      </InputGroup>
      <MemberList words={text.trim().toLocaleLowerCase()} />
      <AddMemberDialog open={adding} onOpenChange={setAdding} />
    </div>
  )
}

// The page has every member: the search filters them here, by name or username as the Share
// dialog's search does (a typed "@" before the username too).
function matches(member: Member, words: string): boolean {
  return member.name.toLocaleLowerCase().includes(words) || member.username.includes(words.replace(/^@/, ''))
}

function failed(error: { message: string }) {
  toast.error(error.message)
}

function Loading({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-2">
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  )
}

function MemberList({ words }: { words: string }) {
  const me = useMe()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const list = useApi(routes.members)
  const members = list.data?.members ?? []
  const found = words === '' ? members : members.filter((member) => matches(member, words))
  const refresh = () => queryClient.invalidateQueries({ queryKey: [routes.members.key] })
  const [settingPassword, setSettingPassword] = useState<Member>()
  const [renaming, setRenaming] = useState<Member>()
  const [disabling, setDisabling] = useState<Member>()
  const [removing, setRemoving] = useState<Member>()
  const shownDisabling = useLast(disabling)
  const enable = useApiMutation(routes.updateMember, { onSuccess: refresh, onError: failed })
  const confirm = useConfirmItsYou()

  // For a member who lost their phone; every session of theirs ends.
  const resetTwoFactor = (member: Member) => {
    const name = member.name
    void confirm.ask({
      action: `Turning off two-factor authentication for ${name}`,
      description: `${name} loses their authenticator app and recovery codes and is signed out everywhere. They can turn it on again on their Account page. This needs ${confirm.needs}.`,
      submitLabel: 'Turn it off',
      run: async () => {
        await call(routes.resetTwoFactor, { params: { userId: member.id } })
        toast.success(`Two-factor authentication is off for ${name}. They were signed out everywhere.`)
        void refresh()
      },
    })
  }

  return (
    <ListGroup aria-labelledby="members-label">
      <ListGroupLabel id="members-label" render={<h2 />}>
        Members
      </ListGroupLabel>
      {list.isPending ? (
        <Loading label="Loading the members" />
      ) : list.isError ? (
        <FormProblem message={list.error.message} />
      ) : found.length === 0 ? (
        <EmptyState icon={SearchIcon} title="No member matches." />
      ) : (
        <ListGroupRows>
          {found.map((member) => {
            const disabled = member.disabledAt !== null
            return (
              <ListGroupItem key={member.id} className="items-start py-3">
                <PersonAvatar name={member.name} color={member.color} className={disabled ? 'opacity-50' : undefined} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate font-semibold">
                      {member.name}
                      {member.id === me.id ? <span className="font-normal text-fg-3"> (you)</span> : null}
                    </span>
                    {member.isSiteOwner ? <Badge variant="secondary">Site owner</Badge> : null}
                    {disabled ? (
                      <Badge variant="pill" tone="off">
                        Disabled
                      </Badge>
                    ) : null}
                  </div>
                  <span className="truncate text-subhead text-fg-2">@{member.username}</span>
                  <span className="text-footnote text-fg-3">
                    {member.lastSeenAt === null ? (
                      'Not seen yet'
                    ) : (
                      <time
                        dateTime={new Date(member.lastSeenAt).toISOString()}
                        title={formatDateTime(member.lastSeenAt)}
                      >
                        Last seen {timeAgo(member.lastSeenAt)}
                      </time>
                    )}
                    {' · '}
                    {member.designCount === 0 ? 'No designs' : designCount(member.designCount)}
                  </span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="ghost" size="icon-sm" aria-label={`Menu of ${member.name}`} />}
                  >
                    <EllipsisIcon aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72">
                    {member.id === me.id ? (
                      <DropdownMenuItem
                        onClick={() => {
                          void navigate({ to: '/account' })
                        }}
                      >
                        <KeyRoundIcon aria-hidden />
                        Change your password on the Account page
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() => {
                          setSettingPassword(member)
                        }}
                      >
                        <KeyRoundIcon aria-hidden />
                        Set password
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => {
                        setRenaming(member)
                      }}
                    >
                      <AtSignIcon aria-hidden />
                      Change username
                    </DropdownMenuItem>
                    {member.isSiteOwner ? null : (
                      <>
                        {disabled ? (
                          <DropdownMenuItem
                            onClick={() => {
                              enable.mutate({ params: { userId: member.id }, body: { disabled: false } })
                            }}
                          >
                            <CircleCheckIcon aria-hidden />
                            Enable
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => {
                              setDisabling(member)
                            }}
                          >
                            <BanIcon aria-hidden />
                            Disable
                          </DropdownMenuItem>
                        )}
                        {member.twoFactor ? (
                          <DropdownMenuItem
                            onClick={() => {
                              resetTwoFactor(member)
                            }}
                          >
                            <ShieldOffIcon aria-hidden />
                            Turn off two-factor authentication
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => {
                            setRemoving(member)
                          }}
                        >
                          <UserMinusIcon aria-hidden />
                          Remove
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </ListGroupItem>
            )
          })}
        </ListGroupRows>
      )}
      <ConfirmDialog
        open={disabling !== undefined}
        onOpenChange={(open) => {
          if (!open) setDisabling(undefined)
        }}
        title={`Disable ${shownDisabling?.name ?? ''}?`}
        description="Their sessions and live connections end at once. Their designs stay and keep their sharing; Enable restores access."
        confirmLabel="Disable"
        onConfirm={async () => {
          if (!disabling) return
          await call(routes.updateMember, { params: { userId: disabling.id }, body: { disabled: true } })
          await refresh()
        }}
      />
      {confirm.dialog}
      <SetPasswordDialog
        target={settingPassword}
        onOpenChange={(open) => {
          if (!open) setSettingPassword(undefined)
        }}
      />
      <ChangeUsernameDialog
        target={renaming}
        onOpenChange={(open) => {
          if (!open) setRenaming(undefined)
        }}
      />
      <RemoveMemberDialog
        target={removing}
        members={members}
        onOpenChange={(open) => {
          if (!open) setRemoving(undefined)
        }}
      />
    </ListGroup>
  )
}
