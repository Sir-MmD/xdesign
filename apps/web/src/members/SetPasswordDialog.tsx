import { routes } from '@xdesign/api'
import { useState } from 'react'
import { toast } from 'sonner'

import { call, isApiError } from '@/api/client'
import { FormProblem } from '@/components/forms'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useConfirmItsYou } from '@/components/useConfirmItsYou'
import { useLast } from '@/lib/useLast'
import type { Member } from '@/members/member'
import { PasswordField } from '@/members/PasswordField'

/**
 * "Set password" of a member (USER-02, docs/plan/18 section 3.4): "New password" with
 * "Generate", the eye and "Copy"; "Set password" after "Confirm it's you". They keep it (Q-56),
 * are signed out everywhere and sign in with it from now on.
 */
export function SetPasswordDialog({
  target,
  onOpenChange,
}: {
  /** The member whose password is set; the dialog is open while it is set. */
  target: Member | undefined
  onOpenChange: (open: boolean) => void
}) {
  const shown = useLast(target)
  return (
    <Dialog open={target !== undefined} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Mounted only while open, so each opening starts from an empty field. */}
        {shown ? (
          <SetPasswordForm
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

function SetPasswordForm({ member, onDone }: { member: Member; onDone: () => void }) {
  const confirm = useConfirmItsYou()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [problem, setProblem] = useState<string>()
  const [sending, setSending] = useState(false)
  const name = member.name

  const submit = () => {
    const checked = routes.setMemberPassword.body.safeParse({ password })
    if (!checked.success) {
      setError(checked.error.issues[0]?.message)
      return
    }
    setError(undefined)
    const set = async () => {
      setSending(true)
      setProblem(undefined)
      try {
        await call(routes.setMemberPassword, { params: { userId: member.id }, body: checked.data })
        toast.success(`Set the password of ${name}.`)
        onDone()
      } catch (failure) {
        // An ended "Confirm it's you" asks again; any other refusal ("This password is too
        // common.") shows above the buttons.
        if (isApiError(failure) && failure.code === 'confirm_needed') throw failure
        setProblem(isApiError(failure) || failure instanceof Error ? failure.message : String(failure))
      } finally {
        setSending(false)
      }
    }
    void confirm.ask({ action: 'Setting a password', submitLabel: 'Set password', run: set })
  }

  return (
    <>
      <form
        noValidate
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (!sending) submit()
        }}
      >
        <DialogHeader>
          <DialogTitle>Set the password of {name}</DialogTitle>
          <DialogDescription>
            {name} is signed out everywhere and signs in with the new password from now on.
          </DialogDescription>
        </DialogHeader>
        <PasswordField label="New password" value={password} onChange={setPassword} error={error} disabled={sending} />
        <FormProblem message={problem} />
        <DialogFooter>
          <Button type="button" variant="outline" disabled={sending} onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={sending} pending={sending}>
            Set password
          </Button>
        </DialogFooter>
      </form>
      {/* Outside the form: the confirmation's own form submits only itself. */}
      {confirm.dialog}
    </>
  )
}
