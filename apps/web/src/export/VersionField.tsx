import { TextField } from '@/components/forms'
import { FieldLegend, FieldSet } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { type DesignVersion, versionLabel } from '@/editor/history/versions'
import { formatDateTime } from '@/lib/time'

/** The "Version" choice for the design as it is now. */
export const NOW = 'now'

/**
 * The export dialog's "Version" (06 section 1, stage 2): "Now" or a version from history (HIST-02),
 * and for "Now" the optional "Name this version", which makes a named version of now (Editors).
 */
export function VersionField({
  versions,
  value,
  onValueChange,
  canName,
  name,
  onNameChange,
  nameError,
  disabled,
}: {
  versions: readonly DesignVersion[]
  value: string
  onValueChange: (value: string) => void
  canName: boolean
  name: string
  onNameChange: (name: string) => void
  nameError: string | undefined
  disabled: boolean
}) {
  const items = [
    { value: NOW, label: 'Now' },
    ...versions.map((version) => ({
      value: version.id,
      label: `${versionLabel(version)}, ${formatDateTime(version.createdAt)}`,
    })),
  ]
  return (
    <FieldSet disabled={disabled}>
      <FieldLegend variant="label">Version</FieldLegend>
      <Select<string>
        items={items}
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          if (next !== null) onValueChange(next)
        }}
      >
        <SelectTrigger className="w-full" aria-label="Version">
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
      {value === NOW && canName ? (
        <TextField
          label="Name this version"
          description="Optional: makes a named version of the design as it is now."
          autoComplete="off"
          placeholder="Sent to developer"
          value={name}
          error={nameError}
          onChange={(event) => {
            onNameChange(event.target.value)
          }}
        />
      ) : null}
    </FieldSet>
  )
}
