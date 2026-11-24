import { telegram } from '@xdesign/spec'
import { useId, useState } from 'react'

import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import { BotPhoto } from '../bot/BotPhoto'
import { type BotPreview, BotPreviews } from '../bot/BotPreviews'
import { CommandList } from '../bot/CommandList'
import { useDesign, useEditor } from '../context'
import { PlainTextField } from '../forms/start/fields'

// What the bot's texts set, in the catalog's words.
const sets = (id: string) => telegram.BOT_METHODS.find((method) => method.id === id)?.sets

/**
 * The "Bot setup" tab (04 section 7): "Bot username", the name, about and description in the
 * language shown with their counters, the profile photo, "Commands menu" and "Menu button"; the
 * previews beside them follow the part being edited. Everything goes into the design at once.
 */
export function BotSetupTab() {
  const [preview, setPreview] = useState<BotPreview>('empty')
  return (
    <div className="grid min-h-full min-[900px]:h-full min-[900px]:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)]">
      <div className="min-h-0 min-[900px]:overflow-y-auto">
        <div className="mx-auto grid max-w-2xl gap-8 p-6">
          <h2 className="text-title-3 font-bold">Bot setup</h2>
          <div
            className="grid gap-5"
            onFocus={() => {
              setPreview('empty')
            }}
          >
            <Profile />
          </div>
          <div
            className="grid gap-8"
            onFocus={() => {
              setPreview('commands')
            }}
          >
            <section aria-labelledby="commands-title" className="grid gap-3">
              <h3 id="commands-title" className="text-headline">
                Commands menu
              </h3>
              <CommandList />
            </section>
            <MenuButton />
          </div>
        </div>
      </div>
      <div className="h-[48rem] border-t bg-surface-2 min-[900px]:h-full min-[900px]:border-s min-[900px]:border-t-0">
        <BotPreviews shown={preview} onShown={setPreview} />
      </div>
    </div>
  )
}

function Profile() {
  const design = useDesign()
  const { edits, readOnly } = useEditor()
  const usernameId = useId()
  const { bot } = design
  return (
    <>
      <fieldset disabled={readOnly} className="grid min-w-0 gap-5">
        <Field>
          <FieldLabel htmlFor={usernameId}>Bot username</FieldLabel>
          <InputGroup>
            <InputGroupAddon>@</InputGroupAddon>
            <InputGroupInput
              id={usernameId}
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
              placeholder="yourbot"
              value={bot.username ?? ''}
              aria-describedby={`${usernameId}-description`}
              onChange={(event) => {
                edits.bot.setUsername(event.target.value.trim().replace(/^@+/, ''))
              }}
            />
          </InputGroup>
          <FieldDescription id={`${usernameId}-description`}>
            For start links in the docs only; optional.
          </FieldDescription>
        </Field>
        <PlainTextField at={{ bot: 'name' }} text={bot.name} label="Name" max={telegram.limit('botName').max} />
        <PlainTextField
          at={{ bot: 'about' }}
          text={bot.about}
          label="About"
          max={telegram.limit('botAbout').max}
          description={sets('setMyShortDescription')}
        />
        <PlainTextField
          at={{ bot: 'description' }}
          text={bot.description}
          label="Description"
          max={telegram.limit('botDescription').max}
          description={sets('setMyDescription')}
          multiline
        />
      </fieldset>
      <BotPhoto />
    </>
  )
}

/** "Menu button": the commands list, or Telegram's default. */
function MenuButton() {
  const design = useDesign()
  const { edits } = useEditor()
  const labelId = useId()
  return (
    <section aria-labelledby={labelId} className="grid gap-3">
      <h3 id={labelId} className="text-headline">
        Menu button
      </h3>
      <ToggleGroup
        aria-labelledby={labelId}
        spacing={0}
        value={[design.bot.menuButton]}
        onValueChange={([menuButton]) => {
          if (menuButton === 'commands' || menuButton === 'default') edits.bot.setMenuButton(menuButton)
        }}
      >
        <ToggleGroupItem value="commands">Commands list</ToggleGroupItem>
        <ToggleGroupItem value="default">Telegram default</ToggleGroupItem>
      </ToggleGroup>
    </section>
  )
}
