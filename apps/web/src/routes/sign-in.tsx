import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { routes, type User } from '@xdesign/api'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { fewRecoveryCodes, localDeadline, recoveryCodesLeft, signInStepMs } from '@/account/twoFactor'
import { apiQuery, call, isApiError } from '@/api/client'
import { requireRoute, safeNextPath } from '@/app/session'
import { AuthCard, AuthFrame } from '@/auth/AuthFrame'
import { CodeStep } from '@/auth/CodeStep'
import { FormProblem, TextField } from '@/components/forms'
import { Button } from '@/components/ui/button'

// The sign-in page (docs/plan/04 section 2, 18 section 3.3): username, password, "Sign in". `next`
// is the page to come back to, checked with safeNextPath before use. The server answers a wrong
// username or password with "Username or password is wrong." and too many tries with "Too many
// tries. Wait 15 minutes or ask the site owner to set a new password."; the form shows its
// message. With two-factor sign-in on (17 section 7, from xWriter's features/auth/LoginPage.tsx),
// the password opens the code step: a code from the app or a recovery code, 5 tries in 5 minutes;
// when the server ends the step (step_expired), the password is asked again. The desktop app has
// no sign-in (DESK-03): there the page goes to Designs.
const searchSchema = z.object({
  next: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/sign-in')({
  validateSearch: searchSchema,
  beforeLoad: async ({ context }) => {
    await requireRoute(context.queryClient, 'signIn')
  },
  component: SignIn,
})

/** The code step: the server's token for it, when it ends, and which kind of code is typed. */
interface Step {
  challenge: string
  expiresAt: number
  recovery: boolean
}

/** The title and lead of each step. */
const greetings = {
  password: { title: 'Sign in', lead: undefined },
  code: { title: 'Enter your code', lead: 'Two-factor authentication is on for your account.' },
  recovery: { title: 'Use a recovery code', lead: 'For when your authenticator app is not at hand.' },
} as const

const stepExpired = 'The sign-in step expired. Enter your password again.'

/** The toast after signing in with a recovery code: the codes left, a warning at 3 or fewer. */
function showCodesLeft(left: number) {
  const description = 'Create new ones on your Account page.'
  if (left <= 0) toast.warning('That was your last recovery code.', { description })
  else if (left <= fewRecoveryCodes) toast.warning(recoveryCodesLeft(left), { description })
  else toast(recoveryCodesLeft(left))
}

function SignIn() {
  const { next } = Route.useSearch()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [problem, setProblem] = useState<string>()
  const [step, setStep] = useState<Step>()
  // Back from the code step: the username stays and the password field has the focus.
  const [back, setBack] = useState(false)
  const form = useForm({
    resolver: zodResolver(routes.signIn.body),
    defaultValues: { username: '', password: '' },
  })
  const { errors, isSubmitting } = form.formState

  const finish = async (user: User) => {
    // Only a server signs in: the desktop app has no sign-in.
    queryClient.setQueryData(apiQuery(routes.me).queryKey, { user, mode: 'server', desktop: null })
    await router.navigate({ href: safeNextPath(next) ?? '/', replace: true })
  }

  /** Back to the password, with what happened (the step expired) when there is something to say. */
  const toPassword = (message?: string) => {
    form.resetField('password')
    setProblem(message)
    setBack(true)
    setStep(undefined)
  }

  const greeting = greetings[step === undefined ? 'password' : step.recovery ? 'recovery' : 'code']

  return (
    <AuthFrame>
      <AuthCard title={greeting.title} lead={greeting.lead} titleId="sign-in-title">
        {step ? (
          <CodeStep
            key={step.challenge}
            expiresAt={step.expiresAt}
            useRecovery={step.recovery}
            onUseRecoveryChange={(recovery) => {
              setProblem(undefined)
              setStep({ ...step, recovery })
            }}
            problem={problem}
            onSubmit={async (factor) => {
              setProblem(undefined)
              const { user } = await call(routes.signInCode, { body: { challenge: step.challenge, ...factor } })
              if ('recoveryCode' in factor) showCodesLeft(user.recoveryCodesLeft)
              await finish(user)
            }}
            onError={(failure) => {
              // A wrong code stays on the step; step_expired asks for the password again.
              if (isApiError(failure) && failure.code === 'step_expired') toPassword(failure.message)
              else setProblem(isApiError(failure) ? failure.message : String(failure))
            }}
            onExpired={() => {
              toPassword(stepExpired)
            }}
            onBack={() => {
              toPassword()
            }}
          />
        ) : (
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              void form.handleSubmit(async (body) => {
                setProblem(undefined)
                try {
                  const answer = await call(routes.signIn, { body })
                  if ('challenge' in answer) {
                    setStep({
                      challenge: answer.challenge,
                      expiresAt: localDeadline(answer.expiresAt, signInStepMs),
                      recovery: false,
                    })
                    return
                  }
                  await finish(answer.user)
                } catch (error) {
                  setProblem(isApiError(error) ? error.message : String(error))
                  form.resetField('password')
                  form.setFocus('password')
                }
              })(event)
            }}
          >
            <TextField
              label="Username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus={!back}
              error={errors.username?.message}
              {...form.register('username')}
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              autoFocus={back}
              error={errors.password?.message}
              {...form.register('password')}
            />
            <FormProblem message={problem} />
            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting} pending={isSubmitting}>
              Sign in
            </Button>
          </form>
        )}
      </AuthCard>
    </AuthFrame>
  )
}
