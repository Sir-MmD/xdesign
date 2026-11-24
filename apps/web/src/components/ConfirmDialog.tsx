import { type ReactNode, useId, useState } from 'react'

import { isApiError } from '@/api/client'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Copied from xWriter's web/src/components/ConfirmDialog.tsx (its section numbers are xWriter's
// plan), without the test IDs; a failure shows the server's message.

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  /** The action, for example "Delete account". */
  confirmLabel: string
  cancelLabel?: string
  /** Red confirm button (the default); false for actions that are not destructive. */
  destructive?: boolean
  /**
   * The exact text the owner types before the action is enabled, for example the account's
   * label for a deletion (10 section 5).
   */
  confirmText?: string
  /** Keeps the confirm button disabled, for example until an option in `children` is checked. */
  confirmDisabled?: boolean
  /**
   * Runs the action. While it runs the buttons are disabled; when it succeeds the dialog
   * closes; when it fails the message is shown in the dialog.
   */
  onConfirm: () => unknown
  /** More content between the text and the buttons, for example an option checkbox. */
  children?: ReactNode
}

/**
 * Confirmation for destructive actions (10 section 5), optionally asking to type a name.
 * The dialog stays open with the error when the action fails.
 */
export function ConfirmDialog({ open, onOpenChange, ...props }: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        {/* Mounted only while open, so the typed text and errors start fresh each time. */}
        <ConfirmBody
          {...props}
          onDone={() => {
            onOpenChange(false)
          }}
        />
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ConfirmBody({
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = true,
  confirmText,
  confirmDisabled = false,
  onConfirm,
  children,
  onDone,
}: Omit<ConfirmDialogProps, 'open' | 'onOpenChange'> & { onDone: () => void }) {
  const [typed, setTyped] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const inputId = useId()
  const matches = (confirmText === undefined || typed.trim() === confirmText) && !confirmDisabled

  const confirm = async () => {
    setPending(true)
    setError(undefined)
    try {
      await onConfirm()
      onDone()
    } catch (failure) {
      setError(isApiError(failure) || failure instanceof Error ? failure.message : String(failure))
      setPending(false)
    }
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (matches && !pending) void confirm()
      }}
    >
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
      </AlertDialogHeader>
      {children}
      {confirmText !== undefined ? (
        <div className="grid gap-2">
          <Label htmlFor={inputId}>
            Type <span className="font-semibold break-all">{confirmText}</span> to confirm
          </Label>
          <Input
            id={inputId}
            value={typed}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
              setTyped(event.target.value)
            }}
          />
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
        <Button
          type="submit"
          variant={destructive ? 'destructive' : 'default'}
          disabled={!matches || pending}
          pending={pending}
          pendingLabel="Working..."
        >
          {confirmLabel}
        </Button>
      </AlertDialogFooter>
    </form>
  )
}
