import { type PreviewTheme, type SkinId, telegramLooks, telegramThemes } from '@xdesign/preview'
import { ChevronDownIcon, SmartphoneIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { useLook } from '../look'

/**
 * The phone look switch (04 section 4.1, Q-19, Q-28): "Web A", "Web K", "Desktop", "Android", "iOS"
 * in xWriter's order, then "Light" and "Dark"; remembered per person in this browser.
 */
export function LookSwitch() {
  const [look, setLook] = useLook()
  const skin = telegramLooks.find((item) => item.id === look.skin)?.label ?? look.skin
  const theme = telegramThemes.find((item) => item.id === look.theme)?.label ?? look.theme
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" aria-label={`Phone look: ${skin}, ${theme}`} />}>
        <SmartphoneIcon aria-hidden data-icon="inline-start" />
        {skin} {theme}
        <ChevronDownIcon aria-hidden data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuRadioGroup
          value={look.skin}
          onValueChange={(value: SkinId) => {
            setLook({ skin: value })
          }}
        >
          {telegramLooks.map((item) => (
            <DropdownMenuRadioItem key={item.id} value={item.id}>
              {item.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={look.theme}
          onValueChange={(value: PreviewTheme) => {
            setLook({ theme: value })
          }}
        >
          {telegramThemes.map((item) => (
            <DropdownMenuRadioItem key={item.id} value={item.id}>
              {item.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
