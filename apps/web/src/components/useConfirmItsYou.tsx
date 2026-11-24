import { routes } from '@xdesign/api'
import { type ReactNode, useState } from 'react'
import { toast } from 'sonner'

import { call, isApiError } from '@/api/client'
import { useMe } from '@/app/session'
import { ConfirmItsYouDialog } from '@/components/ConfirmItsYouDialog'
import { type Proof, proofWords } from '@/components/confirmProof'

// "Confirm it's you" around a risky action (docs/plan/07 sections 5.4 and 6.2, 17 section 7): the
// dialog asks for the password (and a code with two-factor sign-in on), POST /api/auth/confirm
// opens the server's 5-minute window, then the action runs. The window is remembered here as
// well, so an action that may use it (a download, an upload, an HTTPS change) runs at once while
// it is open; the others ask every time.

// The server's window is 5 minutes from the confirmation; this tab counts a little less.
const windowMs = 5 * 60 * 1000 - 30 * 1000
let confirmedUntil = 0

/** POST /api/auth/confirm with the proof; the window then holds for this tab too. */
export async function confirmItsYou(proof: Proof): Promise<void> {
  await call(routes.confirm, { body: proof })
  confirmedUntil = Date.now() + windowMs
}

/**
 * The server answered confirm_needed to an action that ran on its own (an upload), or closed
 * the window (turning on two-factor sign-in): ask next time.
 */
export function forgetConfirmation(): void {
  confirmedUntil = 0
}

export interface ConfirmRequest {
  /** What is about to happen, for example "Restoring a backup". */
  action: string
  description?: ReactNode
  submitLabel?: string
  /** Runs without the dialog while a confirmation of the last 5 minutes holds. */
  reuse?: boolean
  /** The action; its failure shows in the dialog, or as a toast when it ran without one. */
  run: () => Promise<unknown>
}

export function useConfirmItsYou() {
  const { twoFactor } = useMe()
  const [request, setRequest] = useState<ConfirmRequest>()
  const [open, setOpen] = useState(false)

  const show = (next: ConfirmRequest) => {
    setRequest(next)
    setOpen(true)
  }

  /** Runs the action after "Confirm it's you", or at once when `reuse` and the window holds. */
  const ask = async (next: ConfirmRequest): Promise<void> => {
    if (next.reuse && Date.now() < confirmedUntil) {
      try {
        await next.run()
        return
      } catch (error) {
        // The server's window closed first: ask after all.
        if (!(isApiError(error) && error.code === 'confirm_needed')) {
          toast.error(error instanceof Error ? error.message : String(error))
          return
        }
        confirmedUntil = 0
      }
    }
    show(next)
  }

  const dialog = request ? (
    <ConfirmItsYouDialog
      open={open}
      onOpenChange={setOpen}
      action={request.action}
      description={request.description}
      submitLabel={request.submitLabel}
      onConfirm={async (proof) => {
        await confirmItsYou(proof)
        await request.run()
      }}
    />
  ) : null

  // What the dialog asks for, for a description's last sentence: "It needs your password."
  return { ask, dialog, needs: proofWords(twoFactor) }
}
