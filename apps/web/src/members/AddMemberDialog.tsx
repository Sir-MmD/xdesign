import { useQueryClient } from '@tanstack/react-query'
import { routes, usernameHint } from '@xdesign/api'
import { useState } from 'react'
import { toast } from 'sonner'

import { call, isApiError } from '@/api/client'
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
import { useConfirmItsYou } from '@/components/useConfirmItsYou'
import { PasswordField } from '@/members/PasswordField'

/**
 * "Add member" (USER-02, docs/plan/18 section 3.4): a username, a name and a password with
 * "Generate", the eye and "Copy"; "Add member" after "Confirm it's you". The account works at
 * once and never expires; the site owner gives the person the username and password.
 */
export function AddMemberDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Mounted only while open, so each opening starts from an empty form. */}
        <AddMemberForm
          onDone={() => {
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function AddMemberForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient()
  const confirm = useConfirmItsYou()
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ username?: string; name?: string; password?: string }>({})
  const [problem, setProblem] = useState<string>()
  const [sending, setSending] = useState(false)

  const submit = () => {
    const checked = routes.addMember.body.safeParse({ username, name, password })
    if (!checked.success) {
      const message = (field: string) => checked.error.issues.find((issue) => issue.path[0] === field)?.message
      setErrors({ username: message('username'), name: message('name'), password: message('password') })
      return
    }
    setErrors({})
    const add = async () => {
      setSending(true)
      setProblem(undefined)
      try {
        const { member } = await call(routes.addMember, { body: checked.data })
        toast.success(`Added ${member.name}.`)
        void queryClient.invalidateQueries({ queryKey: [routes.members.key] })
        onDone()
      } catch (error) {
        // An ended "Confirm it's you" asks again; a username in use shows under its field and any
        // other refusal ("This password is too common.") above the buttons.
        if (isApiError(error) && error.code === 'confirm_needed') throw error
        if (isApiError(error) && error.code === 'conflict') setErrors({ username: error.message })
        else setProblem(isApiError(error) || error instanceof Error ? error.message : String(error))
      } finally {
        setSending(false)
      }
    }
    void confirm.ask({ action: 'Adding a member', submitLabel: 'Add member', run: add })
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
          <DialogTitle>Add member</DialogTitle>
          <DialogDescription>They sign in with this username and password. Give them both yourself.</DialogDescription>
        </DialogHeader>
        <TextField
          label="Username"
          dir="ltr"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={username}
          error={errors.username}
          description={usernameHint}
          disabled={sending}
          onChange={(event) => {
            setUsername(event.target.value)
          }}
        />
        <TextField
          label="Name"
          autoComplete="off"
          value={name}
          error={errors.name}
          disabled={sending}
          onChange={(event) => {
            setName(event.target.value)
          }}
        />
        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          disabled={sending}
        />
        <FormProblem message={problem} />
        <DialogFooter>
          <Button type="button" variant="outline" disabled={sending} onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={sending} pending={sending}>
            Add member
          </Button>
        </DialogFooter>
      </form>
      {/* Outside the form: the confirmation's own form submits only itself. */}
      {confirm.dialog}
    </>
  )
}
