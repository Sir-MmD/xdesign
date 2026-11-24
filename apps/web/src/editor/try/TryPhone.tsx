import { type ChatPresses, type ChatSlots, TelegramChat, type TgChatAction } from '@xdesign/preview'
import {
  type Design,
  type SimBottomKeyboard,
  type SimChoice,
  type SimDelay,
  type SimMediaKind,
  type SimState,
  simStartPoints,
  type StartStep,
  telegram,
} from '@xdesign/spec'
import {
  ChevronDownIcon,
  FastForwardIcon,
  PlayIcon,
  RotateCcwIcon,
  SquareIcon,
  Undo2Icon,
  UserRoundIcon,
  ZapIcon,
} from 'lucide-react'
import { createElement, type ReactNode, useCallback, useEffect, useEffectEvent, useMemo, useState } from 'react'

import { mediaUrl } from '@/api/media'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Toggle } from '@/components/ui/toggle'
import { ViewOnlyContext } from '@/components/viewOnly'

import { useDesign } from '../context'
import { useLook } from '../look'
import { shownOf } from '../phone/message'
import { BubbleMedia } from '../phone/media/BubbleMedia'
import { chatActionOf, paymentSheet, pressedInline, pressedInside, tryChat, type Writing } from './chat'
import { usePanelBeside, useSim, useTry, useTryStore } from './store'
import { TestUserPanel } from './TestUserPanel'

/**
 * The phone in Try it (04 section 8): the bot's chat as the Telegram app shows it in the chosen
 * look, driven by TRY-01's engine. Above it "Start from", "Step back", "Restart", "Skip waits",
 * "Test user" (when the panel is not beside the phone) and "Stop trying"; over the chat the start
 * picker, the choice cards ("Which way?", a developer step's outcomes, "Waiting 2 hours" with
 * "Skip the wait"), a draft's "Stop" while it is written (RICH-02), the attachment menu and what a
 * waiting question takes ("Send a test photo"); in the chat an invoice's payment sheet (PAY-02);
 * under it what happened. "Events" fires what the user or time does meanwhile: "User blocks the
 * bot" (Restart in the input field's place until "User restarts the bot"), "Time passes", the
 * broadcasts and subscription changes (EVT-02). Works at phone width (04 section 13) and for every
 * role.
 */
export function TryPhone() {
  const design = useDesign()
  const store = useTryStore()
  const sim = useSim()
  const [look] = useLook()
  const state = useTry((session) => session.history.at(-1))
  const before = useTry((session) => session.history.at(-2))
  const skipWaits = useTry((session) => session.skipWaits)
  const lang = useTry((session) => session.user?.language) ?? design.languages.default
  const beside = usePanelBeside()
  const [panelOpen, setPanelOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [commandsOpen, setCommandsOpen] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)
  // The bottom keyboard folded or shown by its button in the input field, for the keyboard it was pressed for.
  const [flipped, setFlipped] = useState<SimBottomKeyboard | null>(null)
  // The paid media whose price button was pressed: the payment card asks "Pay (test)" or "Cancel".
  const [paying, setPaying] = useState<string | null>(null)
  const points = useMemo(() => simStartPoints(design), [design])
  const events = useMemo(() => eventStarts(design), [design])
  const mediaUrl = useMediaUrl(design)

  /** Runs a tester's action on the state shown now; the result goes on the history. */
  const act = (run: (now: SimState) => SimState) => {
    const now = store.now()
    if (now) store.push(run(now))
    setAttachOpen(false)
    setCommandsOpen(false)
  }
  const start = (step: string) => {
    store.restart(sim, step)
    setAttachOpen(false)
    setCommandsOpen(false)
  }
  const send = () => {
    if (draft.trim() === '') return
    act((now) => sim.sendText(now, draft))
    setDraft('')
  }

  const action = useWaits(state?.delay ?? null, skipWaits, () => {
    const now = store.now()
    if (now?.delay) store.replace(sim.skipWait(now))
  })
  const shownAction = useShownAction(state, design)
  const dismiss = () => {
    const now = store.now()
    if (now?.popup) store.replace(sim.dismissPopup(now))
  }
  useToast(state?.popup?.kind === 'toast' ? state.popup : null, dismiss)

  const keyboard = state?.bottomKeyboard ?? null
  const flip = keyboard !== null && flipped === keyboard
  const keyboardOpen = keyboard ? (keyboard.collapsed ? flip : !flip) : false
  // A draft with a stop button is the engine's `writing`: once written, the engine sends it whole.
  const writing = useWriting(state, skipWaits, () => {
    const now = store.now()
    if (now?.writing) store.replace(sim.skipWait(now))
  })
  const chat = useMemo(
    () => (state ? tryChat(state, design, lang, keyboardOpen, writing) : undefined),
    [state, design, lang, keyboardOpen, writing],
  )
  // An invoice's payment sheet while it is open (PAY-02).
  const payment = useMemo(() => (state ? paymentSheet(state, mediaUrl) : undefined), [state, mediaUrl])

  // The media that the preview draws no picture for (a file, a place, a contact): MSG-01's cards.
  const slots = useMemo<ChatSlots | undefined>(() => {
    if (!chat) return undefined
    return {
      each: (key) => {
        const entry = chat.rows[Number(key)]
        const step = entry ? design.steps[entry.step] : undefined
        if (!entry || (step?.kind !== 'message' && step?.kind !== 'question')) return undefined
        if (entry.content.type === 'text' || shownOf(step).content.type !== entry.content.type) return undefined
        return { media: (shown) => createElement(BubbleMedia, { step, shown, readOnly: true }) }
      },
    }
  }, [chat, design.steps])

  const presses: ChatPresses = {
    inline: (row, line, place) => {
      const pressed = chat && pressedInline(chat, row, line, place)
      if (pressed) act((now) => sim.pressInline(now, pressed.entryId, pressed.buttonId))
    },
    inside: (row, line, place) => {
      const pressed = chat && pressedInside(chat, row, line, place)
      if (pressed) act((now) => sim.pressInline(now, pressed.entryId, pressed.buttonId))
    },
    vote: (row, options) => {
      const entry = chat?.rows[Number(row)]
      if (entry) act((now) => sim.vote(now, entry.id, options))
    },
    unlock: (row) => {
      const entry = chat?.rows[Number(row)]
      if (entry) setPaying(entry.id)
    },
    pay: (shipping) => {
      const entryId = store.now()?.payment?.entryId
      if (entryId !== undefined) act((now) => sim.pay(now, entryId, shipping))
    },
    cancelPayment: () => {
      act((now) => sim.cancelPayment(now))
    },
    reply: (line, place) => {
      const button = keyboard?.rows[line]?.[place]
      if (button) act((now) => sim.pressReply(now, button.id))
    },
    command: (command) => {
      act((now) => sim.sendText(now, `/${command}`))
    },
    composer: (part) => {
      switch (part) {
        case 'menu':
          setCommandsOpen((open) => !open)
          setAttachOpen(false)
          break
        case 'attach':
          setAttachOpen((open) => !open)
          setCommandsOpen(false)
          break
        case 'keyboard':
          setFlipped(flip ? null : keyboard)
          break
        case 'send':
          send()
          break
        case 'start': {
          const first = points.find((point) => point.label === '/start') ?? points[0]
          if (first) start(first.step)
          break
        }
        case 'restart':
          act((now) => sim.restartBot(now))
          break
      }
    },
    field: { value: draft, onChange: setDraft, onEnter: send },
  }

  // The phone takes the pane's room, as on the editing phone (PhonePane.tsx), less the strip for what happened.
  const [box, setBox] = useState<{ width: number; height: number }>()
  const measure = useCallback((element: HTMLDivElement) => {
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { width, height } = entry.contentRect
      setBox({ width: Math.floor(width) - 2 * phonePadding, height: Math.floor(height) - 2 * phonePadding - logRoom })
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [])

  if (!state || !chat) return null
  const said = state.log.slice(before?.log.length ?? 0)
  const empty = state.chat.length === 0 && !state.delay && !state.choice
  const question = state.question ? design.steps[state.question.step] : undefined
  const expects = question?.kind === 'question' ? question.expects : undefined

  const unpaid = paying === null ? undefined : state.chat.find((item) => item.id === paying)
  let card: ReactNode = null
  if (unpaid?.from === 'bot' && unpaid.paid === false && unpaid.content.type === 'paidMedia') {
    const entryId = unpaid.id
    card = (
      <PayCard
        stars={unpaid.content.stars}
        onPay={() => {
          setPaying(null)
          act((now) => sim.pay(now, entryId))
        }}
        onCancel={() => {
          setPaying(null)
        }}
      />
    )
  } else if (state.writing && writing?.entryId === state.writing.entryId) {
    // The draft's stop button (can_stop, RICH-02): what was written so far stays when it keeps.
    const { part } = writing
    card = (
      <Card label="Stop">
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => {
            act((now) => sim.stopDraft(now, part))
          }}
        >
          <SquareIcon aria-hidden data-icon="inline-start" />
          Stop
        </Button>
      </Card>
    )
  } else if (state.choice) {
    const { choice } = state
    card = (
      <ChoiceCard
        choice={choice}
        onChoose={(option) => {
          act((now) => sim.choose(now, option))
        }}
      />
    )
  } else if (attachOpen) {
    card = (
      <AttachCard
        onMedia={(kind) => {
          act((now) => sim.sendMedia(now, kind))
        }}
        onPhone={() => {
          act((now) => sim.sharePhone(now))
        }}
        onLocation={() => {
          act((now) => sim.shareLocation(now))
        }}
        onClose={() => {
          setAttachOpen(false)
        }}
      />
    )
  } else if (empty) {
    card = <StartCard points={points} onStart={start} />
  } else if (expects && expects in quickActions) {
    const quick = quickActions[expects as keyof typeof quickActions]
    card = (
      <Card>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            act((now) =>
              quick.kind === 'phone'
                ? sim.sharePhone(now)
                : quick.kind === 'location'
                  ? sim.shareLocation(now)
                  : sim.sendMedia(now, quick.kind),
            )
          }}
        >
          {quick.label}
        </Button>
      </Card>
    )
  }

  return (
    <ViewOnlyContext value={false}>
      <section aria-label="Try it" className="flex h-full min-h-0 flex-col">
        <div className="flex flex-wrap items-center gap-1.5 border-b bg-surface px-3 py-2">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <PlayIcon aria-hidden data-icon="inline-start" />
              Start from
              <ChevronDownIcon aria-hidden data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Start from</DropdownMenuLabel>
              {points.map((point) => (
                <DropdownMenuItem
                  key={point.step}
                  onClick={() => {
                    start(point.step)
                  }}
                >
                  <span dir="auto" className="truncate">
                    {point.label}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <ZapIcon aria-hidden data-icon="inline-start" />
              Events
              <ChevronDownIcon aria-hidden data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Events</DropdownMenuLabel>
              <DropdownMenuItem
                disabled={state.blocked}
                onClick={() => {
                  act((now) => sim.blockBot(now))
                }}
              >
                User blocks the bot
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!state.blocked}
                onClick={() => {
                  act((now) => sim.restartBot(now))
                }}
              >
                User restarts the bot
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!state.delay && state.choice?.kind !== 'wait'}
                onClick={() => {
                  act((now) => sim.skipWait(now))
                }}
              >
                Time passes
              </DropdownMenuItem>
              {events.length > 0 ? <DropdownMenuSeparator /> : null}
              {events.map((event) => (
                <DropdownMenuItem
                  key={event.id}
                  onClick={() => {
                    act((now) => sim.start(now, { step: event.id }))
                  }}
                >
                  <span dir="auto" className="truncate">
                    {event.title || event.idName}
                  </span>
                  <DropdownMenuShortcut>{EVENT_WORDS[event.trigger.type]}</DropdownMenuShortcut>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="sm"
            disabled={!before}
            onClick={() => {
              store.back()
            }}
          >
            <Undo2Icon aria-hidden data-icon="inline-start" />
            Step back
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              store.restart(sim)
              setDraft('')
            }}
          >
            <RotateCcwIcon aria-hidden data-icon="inline-start" />
            Restart
          </Button>
          <Toggle
            size="sm"
            pressed={skipWaits}
            onPressedChange={(pressed) => {
              store.setSkipWaits(pressed)
            }}
          >
            <FastForwardIcon aria-hidden data-icon="inline-start" />
            Skip waits
          </Toggle>
          {beside ? null : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPanelOpen(true)
              }}
            >
              <UserRoundIcon aria-hidden data-icon="inline-start" />
              Test user
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="ms-auto"
            onClick={() => {
              store.stop()
            }}
          >
            <SquareIcon aria-hidden data-icon="inline-start" />
            Stop trying
          </Button>
        </div>
        <div ref={measure} className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex justify-center overflow-hidden p-4">
            {box ? (
              <div className="relative max-w-full">
                <TelegramChat
                  entries={chat.entries}
                  design={chat.design}
                  lang={lang}
                  skin={look.skin}
                  theme={look.theme}
                  maxWidth={box.width}
                  height={Math.max(box.height, minPhoneHeight)}
                  action={action ?? shownAction}
                  popup={state.popup ? { kind: state.popup.kind, text: { [lang]: state.popup.text } } : undefined}
                  onPopupClose={dismiss}
                  payment={payment}
                  pinned={chat.pinned}
                  blocked={state.blocked}
                  commandsOpen={commandsOpen}
                  bottom={chat.bottom}
                  slots={slots}
                  presses={presses}
                  mediaUrl={mediaUrl}
                />
                {card ? <div className="absolute inset-x-3 top-16 z-10">{card}</div> : null}
              </div>
            ) : null}
          </div>
          <ul aria-live="polite" className="flex flex-col gap-0.5 px-4 pb-4 text-center text-footnote text-fg-3">
            {said.map((line, index) => (
              <li key={index} dir="auto">
                {line}
              </li>
            ))}
          </ul>
        </div>
        {beside ? null : (
          <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
            <SheetContent side="right" className="w-80 overflow-y-auto p-0">
              <SheetTitle className="sr-only">Test user</SheetTitle>
              <TestUserPanel />
            </SheetContent>
          </Sheet>
        )}
      </section>
    </ViewOnlyContext>
  )
}

// The events a tester fires on the chat as it is: the broadcasts, then the subscription changes, by title.
function eventStarts(design: Design): StartStep[] {
  const order = (step: StartStep) => (step.trigger.type === 'broadcast' ? 0 : 1)
  return Object.values(design.steps)
    .filter(
      (step): step is StartStep =>
        step.kind === 'start' && (step.trigger.type === 'broadcast' || step.trigger.type === 'subscriptionChanged'),
    )
    .sort((a, b) => order(a) - order(b) || (a.title || a.idName).localeCompare(b.title || b.idName))
}

const EVENT_WORDS: Partial<Record<StartStep['trigger']['type'], string>> = {
  broadcast: 'Broadcast',
  subscriptionChanged: 'Subscription',
}

/**
 * A chat action step ("Show a chat action", EVT-02) in the top bar: the newest step that ran
 * shows one, with no message or button since, for 5 seconds at most (Telegram's limit), or
 * until the bot's next message.
 */
function useShownAction(state: SimState | undefined, design: Design): TgChatAction | undefined {
  const shown = state ? lastChatAction(state, design) : undefined
  const [over, setOver] = useState<SimState>()
  useEffect(() => {
    if (!shown || !state) return
    const timer = window.setTimeout(() => {
      setOver(state)
    }, chatActionMs)
    return () => {
      window.clearTimeout(timer)
    }
  }, [state, shown])
  return shown && over !== state ? shown : undefined
}

const chatActionMs = telegram.limit('chatActionDuration').max * 1000

// The chat action of the newest step run, unless a message (a gift too), a button or a new start
// came after it.
function lastChatAction(state: SimState, design: Design): TgChatAction | undefined {
  if (state.blocked) return undefined
  for (const item of [...state.path].reverse()) {
    if (item.type === 'button') return undefined
    const step = design.steps[item.id]
    if (!step || step.kind === 'start' || step.kind === 'message' || step.kind === 'question') return undefined
    if (step.kind === 'invoice' || (step.kind === 'action' && step.action.type === 'gift')) return undefined
    if (step.kind === 'action' && step.action.type === 'chatAction') return chatActionOf(step.action.action)
  }
  return undefined
}

// The phone's room in the pane, in pixels: its padding (p-4), the strip under it for what
// happened, its least height.
const phonePadding = 16
const logRoom = 48
const minPhoneHeight = 360

// What a waiting question takes that cannot be typed: its one button over the chat.
const quickActions = {
  photo: { kind: 'photo', label: 'Send a test photo' },
  video: { kind: 'video', label: 'Send a test video' },
  file: { kind: 'file', label: 'Send a test file' },
  voice: { kind: 'voice', label: 'Send a test voice message' },
  audio: { kind: 'audio', label: 'Send a test audio file' },
  phone: { kind: 'phone', label: 'Share the test phone number' },
  location: { kind: 'location', label: 'Share the test location' },
} as const

function Card({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-col gap-2 rounded-xl border bg-surface p-3 text-callout shadow-(--shadow-sm)"
    >
      {children}
    </div>
  )
}

/** "Start from": /start, the other commands, the start links with their payload, the fallback. */
function StartCard({
  points,
  onStart,
}: {
  points: readonly { step: string; label: string }[]
  onStart: (step: string) => void
}) {
  return (
    <Card label="Start from">
      <p className="font-semibold">Start from</p>
      {points.length === 0 ? (
        <p className="text-footnote text-fg-3">No start point yet</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {points.map((point) => (
            <Button
              key={point.step}
              variant="outline"
              size="sm"
              className="justify-start"
              onClick={() => {
                onStart(point.step)
              }}
            >
              <span dir="auto" className="truncate">
                {point.label}
              </span>
            </Button>
          ))}
        </div>
      )}
    </Card>
  )
}

/** Telegram's payment for paid media, mocked: its price, "Pay (test)" unlocks it, "Cancel" closes the card (MSG-03). */
function PayCard({ stars, onPay, onCancel }: { stars: number; onPay: () => void; onCancel: () => void }) {
  const label = `Unlock for ⭐ ${String(stars)}`
  return (
    <Card label={label}>
      <p className="font-semibold">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" onClick={onPay}>
          Pay (test)
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  )
}

/** What the engine cannot decide alone: "Which way?", a developer step's outcomes, a wait. */
function ChoiceCard({ choice, onChoose }: { choice: SimChoice; onChoose: (option: string) => void }) {
  return (
    <Card label={choice.prompt}>
      <p dir="auto" className="font-semibold">
        {choice.prompt}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {choice.options.map((option) => (
          <Button
            key={option.id}
            variant={choice.kind === 'wait' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              onChoose(option.id)
            }}
          >
            <span dir="auto" className="truncate">
              {option.label}
            </span>
          </Button>
        ))}
      </div>
    </Card>
  )
}

const mediaItems: readonly { kind: SimMediaKind; label: string }[] = [
  { kind: 'photo', label: 'Send a test photo' },
  { kind: 'video', label: 'Send a test video' },
  { kind: 'file', label: 'Send a test file' },
  { kind: 'voice', label: 'Send a test voice message' },
  { kind: 'audio', label: 'Send a test audio file' },
]

/** The attachment menu (the input field's clip): a test file of each kind, the test phone number or location. */
function AttachCard({
  onMedia,
  onPhone,
  onLocation,
  onClose,
}: {
  onMedia: (kind: SimMediaKind) => void
  onPhone: () => void
  onLocation: () => void
  onClose: () => void
}) {
  return (
    <Card label="Attach">
      <div className="flex flex-col gap-1.5">
        {mediaItems.map((item) => (
          <Button
            key={item.kind}
            variant="outline"
            size="sm"
            className="justify-start"
            onClick={() => {
              onMedia(item.kind)
            }}
          >
            {item.label}
          </Button>
        ))}
        <Button variant="outline" size="sm" className="justify-start" onClick={onPhone}>
          Share the test phone number
        </Button>
        <Button variant="outline" size="sm" className="justify-start" onClick={onLocation}>
          Share the test location
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Card>
  )
}

// How long a message written out like a draft takes to appear, and how often it grows.
const writeMs = 1500
const writeStepMs = 50

/**
 * "Write it out like a draft" (RICH-01): the newest bot message with the option, a text or rich
 * message not written yet, appears as it is written (sendMessageDraft's animation), then whole;
 * with "Skip waits" at once. A draft with a stop button is the engine's `writing` (RICH-02), which
 * `onWritten` sends whole once written. Returns the message being written and its written part.
 */
function useWriting(state: SimState | undefined, skipWaits: boolean, onWritten: () => void): Writing | undefined {
  const last = state?.chat.at(-1)
  const target =
    state?.writing?.entryId ??
    (last?.from === 'bot' &&
    !last.edited &&
    !last.deleted &&
    last.stopped === undefined &&
    last.options.draft === true &&
    (last.content.type === 'text' || last.content.type === 'rich')
      ? last.id
      : undefined)
  const stoppable = target !== undefined && state?.writing?.entryId === target
  const [written, setWritten] = useState<ReadonlySet<string>>(() => new Set())
  const [part, setPart] = useState<{ entryId: string; part: number }>()
  const over = useEffectEvent(onWritten)
  useEffect(() => {
    if (target === undefined) return
    if (written.has(target)) {
      // Written (or an entry's ID used again after "Step back"): a draft with a stop button goes out whole.
      if (stoppable) over()
      return
    }
    const done = () => {
      setPart(undefined)
      setWritten((before) => new Set(before).add(target))
    }
    if (skipWaits) {
      const timer = window.setTimeout(done, 0)
      return () => {
        window.clearTimeout(timer)
      }
    }
    const start = Date.now()
    const timer = window.setInterval(() => {
      const now = Math.min(1, (Date.now() - start) / writeMs)
      if (now < 1) setPart({ entryId: target, part: now })
      else {
        window.clearInterval(timer)
        done()
      }
    }, writeStepMs)
    return () => {
      window.clearInterval(timer)
    }
  }, [target, written, skipWaits, stoppable])
  if (target === undefined || written.has(target) || skipWaits) return undefined
  return part?.entryId === target ? part : { entryId: target, part: 0 }
}

/**
 * The time a held-back message takes (TRY-01's `delay`): its seconds of nothing, then its chat
 * action in the top bar for its seconds, then `onOver` sends it; with "Skip waits" at once.
 * Returns the chat action shown now.
 */
function useWaits(delay: SimDelay | null, skipWaits: boolean, onOver: () => void): TgChatAction | undefined {
  const [acting, setActing] = useState<{ delay: SimDelay; action: TgChatAction }>()
  const over = useEffectEvent(onOver)
  useEffect(() => {
    if (!delay) return
    if (skipWaits) {
      over()
      return
    }
    let timer = window.setTimeout(() => {
      const { chatAction } = delay
      if (!chatAction) {
        over()
        return
      }
      setActing({ delay, action: chatActionOf(chatAction.action) })
      timer = window.setTimeout(over, Math.max(0, chatAction.seconds) * 1000)
    }, delay.seconds * 1000)
    return () => {
      window.clearTimeout(timer)
    }
  }, [delay, skipWaits])
  return acting?.delay === delay ? acting.action : undefined
}

/** A toast goes after a few seconds, as in the Telegram apps. */
function useToast(popup: SimState['popup'], onGone: () => void): void {
  const gone = useEffectEvent(onGone)
  useEffect(() => {
    if (!popup) return
    const timer = window.setTimeout(gone, toastMs)
    return () => {
      window.clearTimeout(timer)
    }
  }, [popup])
}

const toastMs = 2500

/** The picture of an uploaded image for the chat, as on the editing phone (PhonePane.tsx). */
function useMediaUrl(design: Design): (id: string) => string | undefined {
  const { media } = design
  return useCallback(
    (id: string) => {
      const item = media[id]
      if (!item?.mime.startsWith('image/')) return undefined
      return mediaUrl(item.serverId)
    },
    [media],
  )
}
