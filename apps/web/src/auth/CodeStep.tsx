import { ArrowLeftIcon, KeyRoundIcon, ShieldCheckIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { CountdownTimer } from '@/components/CountdownTimer'
import { FormProblem, TextField } from '@/components/forms'
import { Button } from '@/components/ui/button'

// The code step of signing in (docs/plan/17 section 7), copied from xWriter's
// features/auth/TotpStep.tsx: a 6-digit code from the authenticator app that is sent as soon as
// the sixth digit is typed, or one recovery code instead. The step ends with the sign-in step of
// the server (5 minutes).

/** The second factor of the code step: a code from the app or one recovery code. */
export type SecondFactor = { code: string } | { recoveryCode: string }

export interface CodeStepProps {
  /** When the sign-in step ends (milliseconds since the epoch). */
  expiresAt: number
  /** One recovery code instead of a code from the app; the page titles the step after it. */
  useRecovery: boolean
  onUseRecoveryChange: (useRecovery: boolean) => void
  /** The last answer's problem ("Wrong code. 4 attempts left."), above Verify. */
  problem: string | undefined
  /** Sends the code; rejects when the server refuses it. */
  onSubmit: (factor: SecondFactor) => Promise<void>
  onError: (failure: unknown) => void
  /** The step ended before a code was accepted. */
  onExpired: () => void
  /** Back to the password. */
  onBack: () => void
}

export function CodeStep({
  expiresAt,
  useRecovery,
  onUseRecoveryChange,
  problem,
  onSubmit,
  onError,
  onExpired,
  onBack,
}: CodeStepProps) {
  const [code, setCode] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [pending, setPending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // The input of the chosen method has the focus: at the start, after switching methods, and
  // whenever it takes input again (after a wrong code). A disabled input cannot take the focus,
  // so this runs after the render that enables it.
  useEffect(() => {
    if (!pending) inputRef.current?.focus()
  }, [pending, useRecovery])

  const send = async (factor: SecondFactor) => {
    if (pending) return
    setPending(true)
    try {
      await onSubmit(factor)
    } catch (failure) {
      onError(failure)
      setCode('')
      setRecoveryCode('')
      setPending(false)
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (pending) return
        const recovery = recoveryCode.trim()
        // Verify without a whole code only points at the field.
        if (useRecovery ? recovery === '' : code.length !== 6) {
          inputRef.current?.focus()
          return
        }
        void send(useRecovery ? { recoveryCode: recovery } : { code })
      }}
    >
      {useRecovery ? (
        <TextField
          key="recovery"
          ref={inputRef}
          label="Recovery code"
          description="One of the recovery codes you saved when you turned on two-factor authentication. Each code works once."
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
      ) : (
        <TextField
          key="code"
          ref={inputRef}
          label="6-digit code"
          description="Open your authenticator app and enter the code it shows for xDesign."
          // One-time codes stay left to right and monospaced in every language.
          dir="ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          className="h-(--control-h-lg) font-mono text-title-3 tracking-[0.34em]"
          value={code}
          disabled={pending}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, '').slice(0, 6)
            setCode(digits)
            // The code goes out with its sixth digit.
            if (digits.length === 6) void send({ code: digits })
          }}
        />
      )}
      <FormProblem message={problem} />
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={pending}
        pending={pending}
        pendingLabel="Checking..."
      >
        Verify
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            onUseRecoveryChange(!useRecovery)
            setCode('')
            setRecoveryCode('')
          }}
        >
          {useRecovery ? <ShieldCheckIcon aria-hidden /> : <KeyRoundIcon aria-hidden />}
          {useRecovery ? 'Use a code from the app' : 'Use a recovery code'}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onBack}>
          <ArrowLeftIcon aria-hidden className="rtl:-scale-x-100" />
          Back
        </Button>
      </div>
      <p className="text-footnote text-fg-2">
        This step ends in <CountdownTimer until={expiresAt} onExpire={onExpired} className="font-sans" />.
      </p>
    </form>
  )
}
