import { useQueryClient } from '@tanstack/react-query'
import { routes } from '@xdesign/api'
import { ShieldCheckIcon } from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'

import { isApiError } from '@/api/client'
import { useMe } from '@/app/session'
import { type Proof, proofWords } from '@/components/confirmProof'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Copied from xWriter's web/src/components/ConfirmItsYouDialog.tsx (its section numbers are
// xWriter's plan). A risky action (HTTPS, backups, updates, two-factor sign-in) asks for the
// password, and with two-factor sign-in on (docs/plan/17 section 7) also a code from the
// authenticator app or one recovery code; POST /api/auth/confirm then opens a 5-minute window on
// the server (useConfirmItsYou.tsx).

export interface ConfirmItsYouDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** What is about to happen, for example "Restoring a backup". */
  action: string
  description?: ReactNode
  /** Between the text and the password, for example an option checkbox. */
  children?: ReactNode
  /**
   * Confirms with the proof, then runs the action. It resolves when the action succeeded;
   * a rejection shows its message in the dialog ("The password is wrong.").
   */
  onConfirm: (proof: Proof) => Promise<unknown>
  submitLabel?: string
}

/**
 * "Confirm it's you" (10 section 5, 11 section 3.7): the current password, plus a 6-digit code
 * or a recovery code when two-factor sign-in is on, for every sensitive action. The values live
 * only in this dialog's state and are gone when it closes. Wrong passwords and codes count
 * against the sign-in limit of the person's username.
 */
export function ConfirmItsYouDialog({ open, onOpenChange, ...props }: ConfirmItsYouDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        {/* Mounted only while open: closing the dialog forgets the password and code. */}
        <ReauthForm
          {...props}
          onDone={() => {
            onOpenChange(false)
          }}
        />
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ReauthForm({
  action,
  description,
  children,
  onConfirm,
  submitLabel = 'Confirm',
  onDone,
}: Omit<ConfirmItsYouDialogProps, 'open' | 'onOpenChange'> & { onDone: () => void }) {
  const ids = useId()
  const queryClient = useQueryClient()
  const { twoFactor } = useMe()
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [useRecovery, setUseRecovery] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const secondFactorMissing = twoFactor && (useRecovery ? recoveryCode.trim() === '' : code.length !== 6)
  const ready = password !== '' && !secondFactorMissing && !pending

  const submit = async () => {
    const proof: Proof = { password }
    if (twoFactor) {
      if (useRecovery) proof.recoveryCode = recoveryCode.trim()
      else proof.code = code
    }
    setPending(true)
    setError(undefined)
    try {
      await onConfirm(proof)
      onDone()
    } catch (failure) {
      setError(isApiError(failure) || failure instanceof Error ? failure.message : String(failure))
      // A code works once: another try needs the next one.
      setCode('')
      setRecoveryCode('')
      setPending(false)
    } finally {
      // A recovery code may be used up: the Account page shows how many are left.
      if (proof.recoveryCode !== undefined) void queryClient.invalidateQueries({ queryKey: [routes.me.key] })
    }
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (ready) void submit()
      }}
    >
      <AlertDialogHeader>
        <AlertDialogMedia>
          <ShieldCheckIcon aria-hidden />
        </AlertDialogMedia>
        <AlertDialogTitle>Confirm it&apos;s you</AlertDialogTitle>
        <AlertDialogDescription>{description ?? `${action} needs ${proofWords(twoFactor)}.`}</AlertDialogDescription>
      </AlertDialogHeader>
      {children}
      <div className="grid gap-2">
        <Label htmlFor={`${ids}-password`}>Current password</Label>
        {/*
         * No autoFocus: the dialog focuses its first field itself, and an autoFocus during
         * the dialog's first render made it forget the control that opened it, so Escape and
         * Cancel left the focus on the page's body instead of that control (UI-27).
         */}
        <Input
          id={`${ids}-password`}
          type="password"
          autoComplete="current-password"
          value={password}
          disabled={pending}
          onChange={(event) => {
            setPassword(event.target.value)
          }}
        />
      </div>
      {twoFactor ? (
        useRecovery ? (
          <div className="grid gap-2">
            <Label htmlFor={`${ids}-recovery`}>Recovery code</Label>
            <Input
              id={`${ids}-recovery`}
              dir="ltr"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className="font-mono"
              value={recoveryCode}
              disabled={pending}
              onChange={(event) => {
                setRecoveryCode(event.target.value)
              }}
            />
            <Button
              type="button"
              variant="link"
              className="h-auto justify-self-start p-0"
              onClick={() => {
                setUseRecovery(false)
                setRecoveryCode('')
              }}
            >
              Use a code from the app instead
            </Button>
          </div>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor={`${ids}-code`}>6-digit code</Label>
            <Input
              id={`${ids}-code`}
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="w-32 font-mono tracking-widest"
              value={code}
              disabled={pending}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
              }}
            />
            <Button
              type="button"
              variant="link"
              className="h-auto justify-self-start p-0"
              onClick={() => {
                setUseRecovery(true)
                setCode('')
              }}
            >
              Use a recovery code
            </Button>
          </div>
        )
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
        <Button type="submit" disabled={!ready} pending={pending} pendingLabel="Checking...">
          {submitLabel}
        </Button>
      </AlertDialogFooter>
    </form>
  )
}
