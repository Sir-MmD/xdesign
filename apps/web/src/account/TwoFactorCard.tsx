import { useQueryClient } from '@tanstack/react-query'
import { routes } from '@xdesign/api'
import { ShieldCheckIcon, ShieldOffIcon } from 'lucide-react'
import { type ReactNode, useRef, useState } from 'react'
import { toast } from 'sonner'

import { RecoveryCodesDialog } from '@/account/RecoveryCodesDialog'
import { fewRecoveryCodes, localDeadline, recoveryCodesLeft, setupMs } from '@/account/twoFactor'
import { type TwoFactorSetup, TwoFactorSetupDialog } from '@/account/TwoFactorSetupDialog'
import { call } from '@/api/client'
import { useMe } from '@/app/session'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { forgetConfirmation, useConfirmItsYou } from '@/components/useConfirmItsYou'
import { cn } from '@/lib/utils'

// The account page's "Two-factor authentication" (docs/plan/17 section 7, from xWriter's
// features/panel-settings/security/TwoFactorCard.tsx): turn it on with the QR code and a code
// from the app, turn it off, and make new recovery codes. Every action asks "Confirm it's you"
// first; turning on and off signs out the person's other sessions.

/** One thing of the card: what it is, a line about it, a note that stays in sight, its button. */
function ActionRow({
  title,
  description,
  note,
  children,
}: {
  title: string
  description?: string
  note?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-1 basis-60 flex-col gap-0.5">
        <h3 className="text-callout font-semibold">{title}</h3>
        {description ? <p className="text-subhead text-fg-2">{description}</p> : null}
        {note ? <p className="text-footnote text-fg-3">{note}</p> : null}
      </div>
      {children}
    </div>
  )
}

export function TwoFactorCard() {
  const me = useMe()
  const queryClient = useQueryClient()
  const confirm = useConfirmItsYou()
  const [setup, setSetup] = useState<TwoFactorSetup>()
  const [codes, setCodes] = useState<string[]>()
  // The setup and recovery code dialogs open from "Confirm it's you", so Base UI has no
  // control to return focus to when they close: it goes to the card's first button.
  const actions = useRef<HTMLButtonElement>(null)

  // The session's answer has the state and the codes left; the sessions list lost the others.
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [routes.me.key] }),
      queryClient.invalidateQueries({ queryKey: [routes.sessions.key] }),
    ])

  const turnOn = () => {
    void confirm.ask({
      action: 'Turning on two-factor authentication',
      submitLabel: 'Continue',
      run: async () => {
        const made = await call(routes.twoFactorSetup)
        setSetup({ ...made, expiresAt: localDeadline(made.expiresAt, setupMs) })
      },
    })
  }

  const turnOff = () => {
    void confirm.ask({
      action: 'Turning off two-factor authentication',
      description:
        'Turning off two-factor authentication needs your password and a code from your authenticator app, or a recovery code. Your other sessions will be signed out.',
      submitLabel: 'Turn off',
      run: async () => {
        await call(routes.twoFactorOff)
        toast.success('Two-factor authentication is off. Other sessions were signed out.')
        void refresh()
      },
    })
  }

  const newCodes = () => {
    void confirm.ask({
      action: 'Creating new recovery codes',
      description:
        'Creating new recovery codes needs your password and a code from your authenticator app, or a recovery code. The old codes stop working at once.',
      submitLabel: 'Create codes',
      run: async () => {
        const made = await call(routes.newRecoveryCodes)
        setCodes(made.recoveryCodes)
        void refresh()
      },
    })
  }

  const left = me.recoveryCodesLeft
  const few = left <= fewRecoveryCodes
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Two-factor authentication</h2>
        </CardTitle>
        <CardDescription>
          A code from an authenticator app on your phone, asked at every sign-in after the password.
        </CardDescription>
        <CardAction>
          <Badge variant="pill" tone={me.twoFactor ? 'ok' : 'off'}>
            {me.twoFactor ? 'On' : 'Off'}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {me.twoFactor ? (
          <>
            <ActionRow
              title="Recovery codes"
              note={
                <span className={cn(few && 'font-medium text-warn')}>
                  {recoveryCodesLeft(left)}
                  {few ? ' Create new ones so you do not get locked out.' : null}
                </span>
              }
            >
              <Button ref={actions} variant="outline" onClick={newCodes}>
                New recovery codes
              </Button>
            </ActionRow>
            <ActionRow
              title="Turn off two-factor authentication"
              description="The password alone then opens xDesign. Your other sessions are signed out."
            >
              <Button variant="outline" onClick={turnOff}>
                <ShieldOffIcon aria-hidden />
                Turn off
              </Button>
            </ActionRow>
          </>
        ) : (
          <ActionRow
            title="Two-factor authentication is off"
            description="Turning it on signs out your other sessions."
            note="Without it, the password alone opens xDesign."
          >
            <Button ref={actions} onClick={turnOn}>
              <ShieldCheckIcon aria-hidden />
              Turn on
            </Button>
          </ActionRow>
        )}
        {confirm.dialog}
        <TwoFactorSetupDialog
          setup={setup}
          finalFocus={actions}
          onCancel={() => {
            setSetup(undefined)
          }}
          onTurnedOn={(recoveryCodes) => {
            setSetup(undefined)
            setCodes(recoveryCodes)
            // The server closed this session's "Confirm it's you" window: the code is asked now.
            forgetConfirmation()
            toast.success('Two-factor authentication is on. Other sessions were signed out.')
            void refresh()
          }}
        />
        <RecoveryCodesDialog
          codes={codes}
          finalFocus={actions}
          onDone={() => {
            setCodes(undefined)
          }}
        />
      </CardContent>
    </Card>
  )
}
