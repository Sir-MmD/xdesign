import type { InvoiceStep, StepId } from '@xdesign/spec'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { useDesign } from '../context'
import type { Item } from './logic'

const ANY = 'any'

/**
 * An invoice of the design by its title (PAY-02): a refund's, a payment start point's ("Any
 * invoice" with `any`) or an If sentence's; `subscriptions` lists only invoices with a
 * subscription. An invoice no longer in the design shows as "Deleted invoice".
 */
export function InvoiceSelect({
  value,
  onChange,
  any,
  subscriptions = false,
  className,
  ...label
}: {
  value: StepId | undefined
  onChange: (invoice: StepId | undefined) => void
  any?: string
  subscriptions?: boolean
  className?: string
  'aria-label'?: string
  'aria-labelledby'?: string
}) {
  const design = useDesign()
  const invoices = Object.values(design.steps)
    .filter((step): step is InvoiceStep => step.kind === 'invoice')
    .filter((step) => !subscriptions || step.invoice.subscription !== undefined || step.id === value)
    .sort((a, b) => (a.title || a.idName).localeCompare(b.title || b.idName))
  const items: Item[] = [
    ...(any === undefined ? [] : [{ value: ANY, label: any }]),
    ...invoices.map((step) => ({ value: step.id, label: step.title || step.idName })),
  ]
  if (value !== undefined && !items.some((item) => item.value === value)) {
    items.push({ value, label: 'Deleted invoice' })
  }
  return (
    <Select<string>
      items={items}
      value={value ?? (any === undefined ? null : ANY)}
      onValueChange={(next) => {
        if (next === null || next === value) return
        onChange(next === ANY ? undefined : next)
      }}
    >
      <SelectTrigger size="sm" className={className ?? 'w-full'} {...label}>
        <SelectValue placeholder={invoices.length === 0 ? 'No invoice yet' : 'Choose an invoice'} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            <span className="truncate" dir="auto">
              {item.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
