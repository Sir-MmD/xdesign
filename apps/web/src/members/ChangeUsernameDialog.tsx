import { useQueryClient } from '@tanstack/react-query'
import { routes, usernameHint } from '@xdesign/api'
import { useState } from 'react'

import { call, isApiError } from '@/api/client'
import { useMe } from '@/app/session'
import { FormProblem, TextField } from '@/components/forms'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useLast } from '@/lib/useLast'
import type { Member } from '@/members/member'

/**
 * "Change username" of a member (USER-02, docs/plan/18 section 3.4, Q-71): their password stays
 * and nobody is signed out, so no "Confirm it's you". The site owner's own row has it too.
 */
export function ChangeUsernameDialog({
  target,
  onOpenChange,
}: {
  /** The member whose username changes; the dialog is open while it is set. */
  target: Member | undefined
  onOpenChange: (open: boolean) => void
}) {
  const shown = useLast(target)
  return (
    <Dialog open={target !== undefined} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Mounted only while open, so each opening starts from the member's username. */}
        {shown ? (
          <ChangeUsernameForm
            member={shown}
            onDone={() => {
              onOpenChange(false)
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function ChangeUsernameForm({ member, onDone }: { member: Member; onDone: () => void }) {
  const me = useMe()
  const queryClient = useQueryClient()
  const [username, setUsername] = useState(member.username)
  const [error, setError] = useState<string>()
  const [problem, setProblem] = useState<string>()
  const [sending, setSending] = useState(false)

  const submit = async () => {
    const checked = routes.changeUsername.body.safeParse({ username })
    if (!checked.success) {
      setError(checked.error.issues[0]?.message)
      return
    }
    setError(undefined)
    setProblem(undefined)
    setSending(true)
    try {
      await call(routes.changeUsername, { params: { userId: member.id }, body: checked.data })
      void queryClient.invalidateQueries({ queryKey: [routes.members.key] })
      // The site owner's own: the top bar's person menu shows it.
      if (member.id === me.id) void queryClient.invalidateQueries({ queryKey: [routes.me.key] })
      onDone()
    } catch (failure) {
      // A username in use shows under the field.
      if (isApiError(failure) && failure.code === 'conflict') setError(failure.message)
      else setProblem(isApiError(failure) || failure instanceof Error ? failure.message : String(failure))
    } finally {
      setSending(false)
    }
  }

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (!sending) void submit()
      }}
    >
      <DialogHeader>
        <DialogTitle>Change the username of {member.name}</DialogTitle>
        <DialogDescription>They sign in with the new username from now on; their password stays.</DialogDescription>
      </DialogHeader>
      <TextField
        label="Username"
        dir="ltr"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={username}
        error={error}
        description={usernameHint}
        disabled={sending}
        onChange={(event) => {
          setUsername(event.target.value)
        }}
      />
      <FormProblem message={problem} />
      <DialogFooter>
        <Button type="button" variant="outline" disabled={sending} onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={sending} pending={sending}>
          Change
        </Button>
      </DialogFooter>
    </form>
  )
}
