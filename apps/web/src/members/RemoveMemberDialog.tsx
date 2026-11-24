import { useQueryClient } from '@tanstack/react-query'
import { routes } from '@xdesign/api'
import { useId, useState } from 'react'

import { call } from '@/api/client'
import { useMe } from '@/app/session'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useLast } from '@/lib/useLast'
import { designCount, type Member } from '@/members/member'

/**
 * "Remove" of a member (docs/plan/05 section 1): asks first; a member who owns designs is removed
 * only with "Move their designs to: <member>" (an enabled member, the site owner first).
 */
export function RemoveMemberDialog({
  target,
  members,
  onOpenChange,
}: {
  /** The member to remove; the dialog is open while it is set. */
  target: Member | undefined
  members: readonly Member[]
  onOpenChange: (open: boolean) => void
}) {
  const me = useMe()
  const queryClient = useQueryClient()
  const shown = useLast(target)
  const [moveTo, setMoveTo] = useState(me.id)
  const moveId = useId()
  const others = members.filter((other) => other.id !== shown?.id && other.disabledAt === null)
  const items = others.map((other) => ({ value: other.id, label: other.name }))
  const owned = shown?.designCount ?? 0

  return (
    <ConfirmDialog
      open={target !== undefined}
      onOpenChange={(open) => {
        if (open) return
        onOpenChange(false)
        setMoveTo(me.id)
      }}
      title={`Remove ${shown?.name ?? ''}?`}
      description={
        owned > 0
          ? `They own ${designCount(owned)}, which go to the member you pick.`
          : 'They can no longer sign in. This cannot be undone.'
      }
      confirmLabel="Remove"
      onConfirm={async () => {
        if (!shown) return
        await call(routes.removeMember, {
          params: { userId: shown.id },
          body: owned > 0 ? { moveDesignsTo: moveTo } : {},
        })
        void queryClient.invalidateQueries({ queryKey: [routes.members.key] })
        void queryClient.invalidateQueries({ queryKey: [routes.designs.key] })
      }}
    >
      {owned > 0 ? (
        <Field>
          <FieldLabel htmlFor={moveId}>Move their designs to</FieldLabel>
          <Select
            items={items}
            value={moveTo}
            onValueChange={(value) => {
              if (value !== null) setMoveTo(value)
            }}
          >
            <SelectTrigger id={moveId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}
    </ConfirmDialog>
  )
}
