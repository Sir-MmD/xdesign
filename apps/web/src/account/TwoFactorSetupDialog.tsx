import { type RouteResponse, routes } from '@xdesign/api'
import { type RefObject, useId, useState } from 'react'
import QRCode from 'react-qr-code'

import { groupSecret } from '@/account/twoFactor'
import { useApiMutation } from '@/api/client'
import { CopyButton } from '@/components/CopyButton'
import { CountdownTimer } from '@/components/CountdownTimer'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Copied from xWriter's features/panel-settings/security/TwoFactorSetupDialog.tsx.

/** The answer of POST /api/me/two-factor/setup: the key, its otpauth address and its end. */
export type TwoFactorSetup = RouteResponse<typeof routes.twoFactorSetup>

export interface TwoFactorSetupDialogProps {
  setup: TwoFactorSetup | undefined
  /** Two-factor sign-in is on; the server sent the recovery codes. */
  onTurnedOn: (recoveryCodes: string[]) => void
  onCancel: () => void
  /**
   * Where focus goes when the dialog closes (its first tabbable element): the dialog opens
   * from "Confirm it's you", whose controls are gone by then.
   */
  finalFocus?: RefObject<HTMLElement | null>
}

/**
 * Turning on two-factor sign-in after "Confirm it's you" (docs/plan/17 section 7): the first step
 * shows the QR code drawn in the browser from the otpauth address and the key, the second asks
 * for a code from the app, which turns it on. The setup ends after 15 minutes.
 */
export function TwoFactorSetupDialog({ setup, onTurnedOn, onCancel, finalFocus }: TwoFactorSetupDialogProps) {
  return (
    <AlertDialog
      open={setup !== undefined}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <AlertDialogContent className="sm:max-w-md" finalFocus={finalFocus}>
        {setup ? <SetupSteps key={setup.key} setup={setup} onTurnedOn={onTurnedOn} onCancel={onCancel} /> : null}
      </AlertDialogContent>
    </AlertDialog>
  )
}

function SetupSteps({
  setup,
  onTurnedOn,
  onCancel,
}: Required<Omit<TwoFactorSetupDialogProps, 'setup' | 'finalFocus'>> & { setup: TwoFactorSetup }) {
  const ids = useId()
  const [step, setStep] = useState<'scan' | 'confirm'>('scan')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [expired, setExpired] = useState(false)
  const turnOn = useApiMutation(routes.twoFactorOn)

  const confirm = async () => {
    setError(undefined)
    try {
      const { recoveryCodes } = await turnOn.mutateAsync({ body: { code } })
      onTurnedOn(recoveryCodes)
    } catch (failure) {
      // "The code does not match. ...", or the setup is gone: the server's words.
      setCode('')
      setError(failure instanceof Error ? failure.message : String(failure))
    }
  }

  const expiry = (
    <p className="text-footnote text-fg-2">
      Finish within{' '}
      <CountdownTimer
        until={setup.expiresAt}
        onExpire={() => {
          setExpired(true)
        }}
      />
      .
    </p>
  )

  if (step === 'scan') {
    return (
      <>
        <AlertDialogHeader>
          <AlertDialogTitle>Scan the QR code</AlertDialogTitle>
          <AlertDialogDescription>
            In your authenticator app (for example Google Authenticator, Microsoft Authenticator, 2FAS or Aegis), add an
            account and scan this code.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex justify-center">
          {/* White around the code in both themes, so phone cameras read it. */}
          <div className="rounded-lg bg-white p-3">
            <QRCode value={setup.uri} size={176} level="M" title="QR code for the authenticator app" />
          </div>
        </div>
        <div className="grid gap-1.5">
          <p className="text-subhead text-fg-2">Can&apos;t scan it? Type this key into the app instead:</p>
          <div className="flex items-center gap-1 rounded-lg border bg-surface-2 py-1 ps-3 pe-1">
            <code dir="ltr" className="min-w-0 flex-1 font-mono text-callout break-all">
              {groupSecret(setup.key)}
            </code>
            <CopyButton value={setup.key} label="Copy key" />
          </div>
        </div>
        {expiry}
        <AlertDialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={expired}
            onClick={() => {
              setStep('confirm')
            }}
          >
            Next
          </Button>
        </AlertDialogFooter>
      </>
    )
  }

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (code.length === 6 && !turnOn.isPending && !expired) void confirm()
      }}
    >
      <AlertDialogHeader>
        <AlertDialogTitle>Enter the code from the app</AlertDialogTitle>
        <AlertDialogDescription>
          The app now shows a 6-digit code for xDesign. Enter it to turn on two-factor authentication.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div className="grid gap-2">
        <Label htmlFor={`${ids}-code`}>6-digit code</Label>
        <Input
          id={`${ids}-code`}
          dir="ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          className="w-36 font-mono text-body tracking-widest"
          value={code}
          disabled={turnOn.isPending || expired}
          onChange={(event) => {
            setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
          }}
        />
      </div>
      {error ? (
        <p role="alert" className="text-footnote text-error">
          {error}
        </p>
      ) : null}
      {expiry}
      <AlertDialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={turnOn.isPending}
          onClick={() => {
            setError(undefined)
            setStep('scan')
          }}
        >
          Back
        </Button>
        <Button
          type="submit"
          disabled={code.length !== 6 || turnOn.isPending || expired}
          pending={turnOn.isPending}
          pendingLabel="Checking..."
        >
          Turn on
        </Button>
      </AlertDialogFooter>
    </form>
  )
}
