import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { apiKeyName, personName, routes, type User, username, usernameHint } from '@xdesign/api'
import { CheckIcon, KeyRoundIcon, MonitorIcon, SmartphoneIcon, TriangleAlertIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { askFirstOwnerOnly, useRefreshConnections } from '@/account/askFirst'
import { AskFirstSwitch } from '@/account/AskFirstSwitch'
import { ConnectedApps } from '@/account/ConnectedApps'
import { TwoFactorCard } from '@/account/TwoFactorCard'
import { isApiError, useApi, useApiMutation } from '@/api/client'
import { desktopPorts, hasRoute, inDesktopApp, setMeUser, useMe } from '@/app/session'
import { FormProblem, TextField } from '@/components/forms'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldDescription, FieldLegend, FieldSet } from '@/components/ui/field'
import {
  ListGroup,
  ListGroupFooter,
  ListGroupItem,
  ListGroupMedia,
  ListGroupRows,
  ListGroupText,
} from '@/components/ui/grouped-list'
import { Skeleton } from '@/components/ui/skeleton'
import { siteUrl } from '@/lib/base'
import { personColors } from '@/lib/colors'
import { deviceName } from '@/lib/devices'
import { timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'
import { CodeLine } from '@/maintenance/parts'
import { ShownLink } from '@/members/ShownLink'

// The account page (docs/plan/04 section 2): name, (USER-01a, 18 section 3.5) the username, shown
// read-only (only the site owner changes usernames; USER-02, the site owner's own is a field with
// "Save"), color (used for cursors), "Change password"
// (current and new), (TFA-02) "Two-factor authentication" (17 section 7,
// account/TwoFactorCard.tsx), "Sessions" (device, last used, "Sign out" each, "Sign out
// everywhere else") and (S2, CL-03) "API keys" for the MCP connector (06 section 7.2), in
// (MCP-03b, 17 section 13.6) the card "Claude" with "Connected apps". The desktop app (DESK-03, 18
// sections 9.4 and 9.6) shows the name, the color and the card "Claude" with its API keys only,
// its command naming the app's address on this PC.
export const Route = createFileRoute('/_app/account')({
  component: Account,
})

function errorText(error: unknown): string {
  return isApiError(error) || error instanceof Error ? error.message : String(error)
}

/** Puts the person's new name or color into the session's answer, so the shell shows it at once. */
function useSetMe() {
  const queryClient = useQueryClient()
  return (user: User) => {
    setMeUser(queryClient, user)
  }
}

function Account() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-title-2 font-bold">Account</h1>
      <Profile />
      {hasRoute('changePassword') ? <ChangePassword /> : null}
      {hasRoute('twoFactorSetup') ? <TwoFactorCard /> : null}
      {hasRoute('sessions') ? <Sessions /> : null}
      <Claude />
    </div>
  )
}

const nameSchema = z.object({ name: personName })

function Profile() {
  const me = useMe()
  const setMe = useSetMe()
  const [problem, setProblem] = useState<string>()
  const update = useApiMutation(routes.updateMe)
  const form = useForm({ resolver: zodResolver(nameSchema), defaultValues: { name: me.name } })
  const { errors, isSubmitting, isDirty } = form.formState

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            void form.handleSubmit(async (body) => {
              setProblem(undefined)
              try {
                const { user } = await update.mutateAsync({ body })
                setMe(user)
                form.reset({ name: user.name })
                toast.success('Name saved.')
              } catch (error) {
                setProblem(errorText(error))
              }
            })(event)
          }}
        >
          <TextField label="Name" autoComplete="name" error={errors.name?.message} {...form.register('name')} />
          <FormProblem message={problem} />
          <Button type="submit" className="self-start" disabled={!isDirty || isSubmitting} pending={isSubmitting}>
            Save
          </Button>
        </form>
        {inDesktopApp() ? null : me.isSiteOwner ? (
          <UsernameForm />
        ) : (
          <TextField
            label="Username"
            value={me.username}
            readOnly
            description="Only the site owner changes usernames."
          />
        )}
        <ColorPicker />
      </CardContent>
    </Card>
  )
}

const usernameSchema = z.object({ username })

/** USER-02 (18 section 3.5): the site owner's own username, saved with PATCH /api/me. */
function UsernameForm() {
  const me = useMe()
  const setMe = useSetMe()
  const queryClient = useQueryClient()
  const [problem, setProblem] = useState<string>()
  const update = useApiMutation(routes.updateMe)
  const form = useForm({ resolver: zodResolver(usernameSchema), defaultValues: { username: me.username } })
  const { errors, isSubmitting, isDirty } = form.formState

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        void form.handleSubmit(async (body) => {
          setProblem(undefined)
          try {
            const { user } = await update.mutateAsync({ body })
            setMe(user)
            form.reset({ username: user.username })
            toast.success('Username saved.')
            void queryClient.invalidateQueries({ queryKey: [routes.members.key] })
          } catch (error) {
            // A username in use shows under the field.
            if (isApiError(error) && error.code === 'conflict') form.setError('username', { message: error.message })
            else setProblem(errorText(error))
          }
        })(event)
      }}
    >
      <TextField
        label="Username"
        dir="ltr"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        description={usernameHint}
        error={errors.username?.message}
        {...form.register('username')}
      />
      <FormProblem message={problem} />
      <Button type="submit" className="self-start" disabled={!isDirty || isSubmitting} pending={isSubmitting}>
        Save
      </Button>
    </form>
  )
}

/** The person's color, one of ten; a choice is saved at once. */
function ColorPicker() {
  const me = useMe()
  const setMe = useSetMe()
  const update = useApiMutation(routes.updateMe, {
    onSuccess: ({ user }) => {
      setMe(user)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
  // The color being saved shows as chosen right away.
  const chosen = update.isPending ? update.variables.body.color : me.color

  return (
    <FieldSet>
      <FieldLegend variant="label" className="mb-0">
        Color
      </FieldLegend>
      <FieldDescription className="-mt-2">Used for your cursor.</FieldDescription>
      <div className="flex flex-wrap gap-2.5">
        {personColors.map((color) => {
          const selected = chosen?.toLowerCase() === color.value
          return (
            <label
              key={color.value}
              title={color.name}
              style={{ backgroundColor: color.value }}
              className={cn(
                'relative grid size-9 cursor-pointer place-items-center rounded-full transition-[scale] duration-(--dur-fast) ease-(--ease) active:scale-(--press) has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-solid',
                selected && 'ring-2 ring-foreground ring-offset-2 ring-offset-card',
              )}
            >
              <input
                type="radio"
                name="person-color"
                value={color.value}
                checked={selected}
                aria-label={color.name}
                className="sr-only"
                onChange={() => {
                  update.mutate({ body: { color: color.value } })
                }}
              />
              {selected ? <CheckIcon aria-hidden className="size-4 text-white" /> : null}
            </label>
          )
        })}
      </div>
    </FieldSet>
  )
}

function ChangePassword() {
  const me = useMe()
  const [problem, setProblem] = useState<string>()
  const queryClient = useQueryClient()
  const change = useApiMutation(routes.changePassword)
  const form = useForm({
    resolver: zodResolver(routes.changePassword.body),
    defaultValues: { current: '', next: '' },
  })
  const { errors, isSubmitting } = form.formState

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Change password</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            void form.handleSubmit(async (body) => {
              setProblem(undefined)
              try {
                await change.mutateAsync({ body })
                form.reset()
                toast.success('Password changed.')
                void queryClient.invalidateQueries({ queryKey: [routes.sessions.key] })
              } catch (error) {
                setProblem(errorText(error))
              }
            })(event)
          }}
        >
          {/* For the browser's password manager: whose password this is. */}
          <input type="text" autoComplete="username" value={me.username} readOnly hidden />
          <TextField
            label="Current password"
            type="password"
            autoComplete="current-password"
            error={errors.current?.message}
            {...form.register('current')}
          />
          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            error={errors.next?.message}
            {...form.register('next')}
          />
          <FormProblem message={problem} />
          <Button type="submit" className="self-start" disabled={isSubmitting} pending={isSubmitting}>
            Change password
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function Sessions() {
  const queryClient = useQueryClient()
  const list = useApi(routes.sessions)
  const refresh = () => queryClient.invalidateQueries({ queryKey: [routes.sessions.key] })
  const failed = (error: { message: string }) => {
    toast.error(error.message)
  }
  const end = useApiMutation(routes.endSession, { onSuccess: refresh, onError: failed })
  const endOthers = useApiMutation(routes.signOutOthers, { onSuccess: refresh, onError: failed })
  const sessions = [...(list.data?.sessions ?? [])].sort(
    (a, b) => Number(b.current) - Number(a.current) || b.lastUsedAt - a.lastUsedAt,
  )
  const others = sessions.filter((session) => !session.current).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Sessions</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {list.isPending ? (
          <div role="status" aria-label="Loading the sessions" className="flex flex-col gap-2">
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        ) : list.isError ? (
          <FormProblem message={list.error.message} />
        ) : (
          <ListGroup>
            <ListGroupRows>
              {sessions.map((session) => {
                const device = deviceName(session.userAgent)
                const phone = /\b(?:Android|iOS)$/.test(device)
                const ending = end.isPending && end.variables.params.sessionId === session.id
                return (
                  <ListGroupItem key={session.id}>
                    <ListGroupMedia className="bg-surface-2 text-fg-2">
                      {phone ? <SmartphoneIcon aria-hidden /> : <MonitorIcon aria-hidden />}
                    </ListGroupMedia>
                    <ListGroupText
                      className="min-w-0 flex-1"
                      title={device}
                      description={session.current ? 'This device' : `Last used ${timeAgo(session.lastUsedAt)}`}
                    />
                    {session.current ? null : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={ending}
                        pending={ending}
                        onClick={() => {
                          end.mutate({ params: { sessionId: session.id } })
                        }}
                      >
                        Sign out
                      </Button>
                    )}
                  </ListGroupItem>
                )
              })}
            </ListGroupRows>
          </ListGroup>
        )}
        <Button
          variant="outline"
          className="self-start"
          disabled={others === 0 || endOthers.isPending}
          pending={endOthers.isPending}
          onClick={() => {
            endOthers.mutate()
          }}
        >
          Sign out everywhere else
        </Button>
      </CardContent>
    </Card>
  )
}

/**
 * The card "Claude" (17 section 13.6): what Claude can do as the person, then "API keys" and
 * (MCP-03b) "Connected apps" (account/ConnectedApps.tsx).
 */
function Claude() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Claude</h2>
        </CardTitle>
        <CardDescription>
          Claude can do everything you can do in xDesign, as you. Actions that cannot be undone ask you first.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <ApiKeys />
        {hasRoute('claudeApps') ? <ConnectedApps /> : null}
      </CardContent>
    </Card>
  )
}

const keySchema = z.object({ name: apiKeyName })

/**
 * "API keys" (06 section 7.2): "Create key" with a name, the key shown once with "Copy"; the keys
 * that work with their last use, (MCP-01b, 17 section 13.6) their "Ask first" switch, which only
 * the site owner changes, and "Revoke"; then how to connect: the `claude mcp add` command for
 * Claude Code (with the key just made, else `<key>`) and a note for other MCP clients. In the
 * desktop app (DESK-03, 18 section 9.6) the address is `http://127.0.0.1:<port>/mcp` with the port
 * of this start, and when it is not the one the app prefers, a notice says to add it again.
 */
function ApiKeys() {
  const me = useMe()
  const headingId = useId()
  const ownerOnlyId = useId()
  const list = useApi(routes.apiKeys)
  const refresh = useRefreshConnections()
  const [problem, setProblem] = useState<string>()
  // The key just made, shown until the page closes or it is revoked.
  const [made, setMade] = useState<{ id: string; secret: string }>()
  const create = useApiMutation(routes.createApiKey)
  const revoke = useApiMutation(routes.revokeApiKey, {
    onSuccess: (_answer, { params }) => {
      if (made?.id === params.keyId) setMade(undefined)
      void refresh()
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
  const form = useForm({ resolver: zodResolver(keySchema), defaultValues: { name: '' } })
  const { errors, isSubmitting } = form.formState
  const keys = list.data?.keys ?? []
  const ports = desktopPorts()
  const mcpUrl = ports ? `http://127.0.0.1:${String(ports.port)}/mcp` : siteUrl('/mcp')
  const bearer = `Authorization: Bearer ${made?.secret ?? '<key>'}`

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h3 id={headingId} className="text-callout font-semibold">
        API keys
      </h3>
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          void form.handleSubmit(async (body) => {
            setProblem(undefined)
            try {
              const { key, secret } = await create.mutateAsync({ body })
              setMade({ id: key.id, secret })
              form.reset()
              void refresh()
            } catch (error) {
              setProblem(errorText(error))
            }
          })(event)
        }}
      >
        <TextField
          label="Name"
          placeholder="Claude Code on my laptop"
          autoComplete="off"
          error={errors.name?.message}
          {...form.register('name')}
        />
        <FormProblem message={problem} />
        <Button type="submit" className="self-start" disabled={isSubmitting} pending={isSubmitting}>
          Create key
        </Button>
      </form>
      {made ? (
        <div className="flex flex-col gap-1">
          <ShownLink link={made.secret} label="API key" />
          <p className="text-footnote text-fg-3">The key is shown only now.</p>
        </div>
      ) : null}
      {list.isPending ? (
        <div role="status" aria-label="Loading the API keys">
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      ) : list.isError ? (
        <FormProblem message={list.error.message} />
      ) : keys.length === 0 ? null : (
        <ListGroup>
          <ListGroupRows>
            {keys.map((key) => {
              const busy = revoke.isPending && revoke.variables.params.keyId === key.id
              return (
                <ListGroupItem key={key.id}>
                  <ListGroupMedia className="bg-surface-2 text-fg-2">
                    <KeyRoundIcon aria-hidden />
                  </ListGroupMedia>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-1">
                    <ListGroupText
                      title={<span dir="auto">{key.name}</span>}
                      description={
                        key.lastUsedAt === null
                          ? `Made ${timeAgo(key.createdAt)} · Not used yet`
                          : `Made ${timeAgo(key.createdAt)} · Last used ${timeAgo(key.lastUsedAt)}`
                      }
                    />
                    <AskFirstSwitch
                      kind="key"
                      id={key.id}
                      name={key.name}
                      askFirst={key.askFirst}
                      owner={me.isSiteOwner}
                      describedBy={ownerOnlyId}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    pending={busy}
                    onClick={() => {
                      revoke.mutate({ params: { keyId: key.id } })
                    }}
                  >
                    Revoke
                  </Button>
                </ListGroupItem>
              )
            })}
          </ListGroupRows>
          {me.isSiteOwner ? null : <ListGroupFooter id={ownerOnlyId}>{askFirstOwnerOnly}</ListGroupFooter>}
        </ListGroup>
      )}
      <div className="flex flex-col gap-1.5">
        <p className="text-subhead text-fg-2">In Claude Code run:</p>
        <CodeLine
          code={`claude mcp add --transport http xdesign ${mcpUrl} --header "${bearer}"`}
          label="Copy the command"
        />
        <p className="text-footnote text-fg-3">
          Other MCP clients: add the server <code className="font-mono break-all">{mcpUrl}</code> (Streamable HTTP) with
          the header <code className="font-mono break-all">{bearer}</code>.
        </p>
      </div>
      {ports && ports.port !== ports.preferredPort ? (
        <Alert variant="warn" role="note">
          <TriangleAlertIcon aria-hidden />
          <AlertDescription>
            {`xDesign uses port ${String(ports.port)} this time, so Claude Code's saved address does not work. Add it again with the command above.`}
          </AlertDescription>
        </Alert>
      ) : null}
    </section>
  )
}
