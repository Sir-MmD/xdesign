# 03. The design model and the export format

What a bot design is made of, how it is stored for live editing (Yjs), the plain model every
reader uses, ID names, texts, the checks, and the exact export format `spec.json` version 1.
All of it lives in `packages/spec` and runs in the browser and on the server (D-02).

## 1. Overview

A **design** is one bot. It has:

- **languages**: a list (at least one) and a default; codes as Telegram sends them in
  `language_code` (IETF tags such as `en`, `fa`, `pt-br`);
- **bot setup**: name, about, description, profile photo, menu button (section 2.9);
- **steps**: the boxes on the map (section 2.2), each with a kind; arrows are fields of their
  source (D-08);
- **buttons**: inline and bottom-keyboard buttons, referenced by the steps' keyboards;
- **texts**: rich texts per language (TipTap documents) and plain texts per language;
- **variables**: saved answers, remembered values, developer outputs and built-ins;
- **test switches**: facts about the user only the developer knows ("User is admin"), used by
  "If" boxes and set in Try it;
- **parts**: reusable button rows and texts;
- **media**: uploaded files and placeholders.

Stage 2 adds step kinds and fields marked **(S2)**; the format version stays 1 because every
stage 2 addition is optional and new (section 6.6).

## 2. The plain model

TypeScript types derived from Zod schemas in `packages/spec/src/model/`. Every ID is a random
nanoid; every step and button also has an **ID name** (section 4).

### 2.1 Design

```ts
type Design = {
  formatVersion: 1
  id: string; name: string
  languages: { default: Lang; list: Lang[] }        // default is in list
  bot: BotSetup
  steps: Record<StepId, Step>
  buttons: Record<ButtonId, Button>
  variables: Record<VarId, Variable>
  switches: Record<SwitchId, TestSwitch>
  parts: Record<PartId, Part>
  media: Record<MediaId, MediaItem>
  ignoredChecks?: string[]                   // "Ignore here" keys (section 8)
}
type LangText = Partial<Record<Lang, string>>         // plain text per language
type RichText = Partial<Record<Lang, RichDoc>>       // TipTap JSON per language (section 5)
```

### 2.2 Steps

Common fields of every step:

```ts
type StepBase = {
  id: StepId; idName: string; title: string          // title: the name on the map box
  x: number; y: number                               // map position
  note?: string                                      // designer's note for the developer
  frame?: FrameId                                    // the section frame it sits in (map only)
}
```

| Kind | What it is | Fields | Arrows out |
|---|---|---|---|
| `start` | A start point. | `trigger` (section 2.3) | `next` |
| `message` | The bot sends something. | `content` (2.4), `keyboard` (2.5), `options` (2.7) | `next` (optional "then" without a click), every button's target, `onStop` ("If the user stops it": the update `stopped_message_generation`, while the message is written out like a draft with a stop button) |
| `question` | The bot asks and waits for an answer. | `prompt` (content, keyboard, options as a message), `expects`, `checks`, `saveTo`, `wrongAnswer`, `cancel` (2.8) | `next` (valid answer), `wrongAnswer.afterMaxTries`, `cancel.goTo`, prompt buttons |
| `if` | Choose a way by conditions. | `cases: { id, label, when: Condition, goTo }[]`, `otherwise` (2.10) | each case's `goTo`, `otherwise` |
| `remember` | Set, clear or change variables. | `actions: RememberAction[]` | `next` |
| `wait` | Wait before going on. | `amount`, `unit` (seconds, minutes, hours, days), `ifUserActs`: `cancel` (default) or `keep`, `stopWhen?: Condition` (a reminder, with `cancel`) | `next` |
| `devStep` | A job only the developer can do. | `description` (multi-line plain text), `uses: VarId[]`, `sets: VarId[]`, `outcomes: { id, label, goTo }[]` (at least one, default "Done") | each outcome's `goTo` |
| `goTo` | Jump to a step elsewhere on the map (keeps the map tidy). | `target` | `target` |
| `end` | The conversation ends here; the next message goes to the fallback start point. | none | none |
| `note` | A sticky note on the map for the team; no arrows; exported in `design.md` only. | `text`, `color` | none |
| `frame` | A named section of the map ("Shop", "Support"); steps inside belong to it. | `width`, `height`, `color` | none |
| `invoice` (S2) | A payment request (section 7.1). | `invoice`, `keyboard`, `options`, `checkout?` (7.1) | `next` ("Paid") |
| `action` (S2) | A Telegram action without a message: set a reaction, pin or unpin, delete a message, send a gift, show a chat action, refund a payment. | `action` (7.3) | `next` |

A target is a `StepId`, or the special target `back` ("the message step the user came from").
Every arrow is optional in the model (a new box has none yet); the checks report missing ones.
Steps, buttons, variables, switches and parts also have `idNameFixed?: boolean`, true once the ID
name was edited by hand or exported.

### 2.3 Start points

```ts
type Trigger =
  | { type: 'command'; command: string; inMenu: boolean; menuDescription: LangText }
  | { type: 'startLink'; payload: string; match: 'exact' | 'prefix'; saveRestTo?: VarId }
  | { type: 'fallback'; accepts: 'any' | 'text' | 'media' }   // anything the bot does not expect
  // S2:
  | { type: 'paymentDone'; invoice?: StepId }  // successful_payment the invoice's "Paid" does not take (a subscription paid again)
  | { type: 'refunded'; invoice?: StepId }     // refunded_payment
  | { type: 'subscriptionChanged'; invoice?: StepId; state?: 'canceled' | 'active' | 'failed' } // subscription (Bot API 10.2)
  | { type: 'userBlocks' } | { type: 'userRestarts' }          // my_chat_member: kicked, member
  | { type: 'broadcast'; audience: Condition | 'everyone'; when: string } // bot writes first; when in words
```

- Every design has exactly one `/start` start point, created with the design and not deletable.
- Commands appear in the bot's commands menu in the order of Bot setup when `inMenu`.
- `startLink` with `prefix` and `saveRestTo` covers referral links (`?start=ref_123` saves `123`).
- Pressing a bottom-keyboard text button is not a start point: it is the button's own target
  (section 2.5), valid while that keyboard is shown.
- No "User reacts" start point (D-36). After "User blocks the bot" the bot cannot send anything
  until the user restarts it (check E30).

### 2.4 Message content

```ts
type Content =
  | { type: 'text'; text: RichTextRef }
  | { type: 'photo' | 'livePhoto' | 'video' | 'animation'; media: MediaSlot; caption?: RichTextRef
      spoiler?: boolean; captionAbove?: boolean }
  | { type: 'audio'; media: MediaSlot; caption?: RichTextRef; title?: string; performer?: string }
  | { type: 'voice' | 'document'; media: MediaSlot; caption?: RichTextRef }
  | { type: 'videoNote' | 'sticker'; media: MediaSlot }          // no caption in Telegram
  | { type: 'album'; items: { media: MediaSlot; caption?: RichTextRef; spoiler?: boolean }[] }
  | { type: 'location'; latitude: number; longitude: number; livePeriodSec?: number }
  | { type: 'venue'; latitude: number; longitude: number; title: string; address: string }
  | { type: 'contact'; phone: string; firstName: string; lastName?: string }
  // S2:
  | { type: 'poll'; question: RichTextRef; options: LangText[]; anonymous: boolean; multiple: boolean
      revote?: boolean; shuffle?: boolean; hideResults?: boolean; addOptions?: boolean
      closeAfterSec?: number; closeAt?: number; saveTo?: VarId }
  | { type: 'quiz'; question: RichTextRef; options: LangText[]; correct: number[]
      explanation?: RichTextRef; anonymous: boolean; multiple: boolean; revote?: boolean
      shuffle?: boolean; hideResults?: boolean; closeAfterSec?: number; closeAt?: number
      saveTo?: VarId }
  | { type: 'dice'; emoji: '🎲' | '🎯' | '🏀' | '⚽' | '🎳' | '🎰'; saveTo?: VarId }
  | { type: 'paidMedia'; items: { media: MediaSlot }[]; stars: number; caption?: RichTextRef
      captionAbove?: boolean }
  | { type: 'rich'; blocks: RichMessageBlock[]; rtl?: boolean }
type MediaSlot = { media: MediaId } | { placeholder: { description: string } }
```

```ts
type RichMessageBlock =
  | { type: 'paragraph' | 'footer'; text: RichTextRef }
  | { type: 'heading'; text: RichTextRef; size: number }            // 1 (largest) to 6
  | { type: 'code'; text: RichTextRef; language?: string }
  | { type: 'quote'; text: RichTextRef; credit?: RichTextRef; expandable?: boolean }
  | { type: 'list'; ordered: boolean; items: { text: RichTextRef; checked?: boolean }[] }
  | { type: 'table'; rows: { cells: { text: RichTextRef; header?: boolean }[] }[]; caption?: RichTextRef
      bordered?: boolean; striped?: boolean; compact?: boolean }
  | { type: 'details'; summary: RichTextRef; text: RichTextRef; open?: boolean }
  | { type: 'divider' }
  | { type: 'media'; media: MediaSlot; caption?: RichTextRef; spoiler?: boolean }
  | { type: 'buttons'; ids: ButtonId[]; align?: 'left' | 'center' | 'right' }
```

A rich message's blocks are one level deep; a media block is sent by its file's kind; a `buttons`
block is a row of the design's inline buttons inside the message. `saveTo` keeps the vote (a
poll's option text in the default language, a quiz's right or wrong as yes or no; not on an
anonymous poll) or the value rolled, for an If. There is no checklist (D-36).

Albums hold 2 to 10 items: photos and videos mixed, or only documents, or only audio (08).

### 2.5 Buttons and keyboards

```ts
type Keyboard =
  | { type: 'inline'; rows: Row[]; openReplyField?: boolean }  // force_reply in the markup (10.3)
  | { type: 'reply'; rows: Row[]; oneTime: boolean; persistent: boolean; resize: boolean
      placeholder?: LangText; openReplyField?: boolean }
  | { type: 'removeReply' }
  | { type: 'forceReply'; placeholder?: LangText }
  | null
type Row = { type: 'buttons'; ids: ButtonId[] } | { type: 'part'; part: PartId }

type Look = 'default' | 'primary' | 'success' | 'danger'      // D-10
type ButtonBase = { id: ButtonId; idName: string; label: LangText; look: Look
                    icon?: { customEmojiId: string; fallback: string } }
// inline buttons also have disabled?: boolean (Bot API 10.3: shown, does nothing)

type InlineButton = ButtonBase & { place: 'inline'; action:
  | { type: 'goTo'; target: StepId | 'back' | 'stay'; show: 'edit' | 'new' | 'replace'
      popup?: { kind: 'toast' | 'alert'; text: LangText }; remember?: RememberAction[] }
  | { type: 'url'; url: string }                               // may contain {variables}
  | { type: 'copyText'; text: LangText }
  | { type: 'loginUrl'; url: string; requestWriteAccess: boolean }
  | { type: 'pay' } }                                          // S2, the first button of an invoice only

type ReplyButton = ButtonBase & { place: 'reply'; action:
  | { type: 'text'; goTo?: StepId | 'back'; remember?: RememberAction[] }
  | { type: 'sharePhone'; goTo?: StepId; saveTo?: VarId }
  | { type: 'shareLocation'; goTo?: StepId; saveTo?: VarId }
  | { type: 'pickUsers'; max: number; bots?: boolean; premium?: boolean
      askName: boolean; askUsername: boolean; askPhoto: boolean; goTo?: StepId; saveTo?: VarId }
  | { type: 'pickChat'; channel: boolean; forum?: boolean; hasUsername?: boolean
      userIsOwner?: boolean; botIsMember?: boolean
      askTitle: boolean; askUsername: boolean; askPhoto: boolean; goTo?: StepId; saveTo?: VarId }
  | { type: 'createPoll'; pollType: 'any' | 'regular' | 'quiz'; goTo?: StepId; saveTo?: VarId } }
```

- `show`: `edit` (default, D-12) edits the clicked message into the target step;
  `new` sends the target as a new message and leaves the clicked one; `replace` deletes the
  clicked message and sends the target. `stay` keeps the message (a popup alone, or with
  `remember`, or both).
- `back` goes to the message step the user was on before this one (the developer keeps a short
  history per user).
- Excluded on purpose (D-11): `web_app`, `switch_inline_query*`, `callback_game`.

### 2.6 Variables and test switches

```ts
type Variable = { id: VarId; idName: string; label: string
  type: 'text' | 'number' | 'yesNo' | 'phone' | 'location' | 'file' | 'users' | 'chat' | 'poll'
  source: 'question' | 'remember' | 'devStep' | 'button' | 'startLink' | 'builtin'
  description?: string; testValue?: string | number | boolean }
type TestSwitch = { id: SwitchId; idName: string; label: string   // "User is admin"
  type: 'yesNo' | 'choice'; options?: string[]; testValue: boolean | string
  description?: string }                                          // how the developer knows it
```

Built-in variables (always there, not deletable): `first_name`, `last_name`, `username`,
`user_id`, `language`, `is_premium`. Built-in switch: the tester's language (from Try it's
language picker).

### 2.7 Message options

```ts
type Options = {
  silent?: boolean                  // disable_notification
  protect?: boolean                 // protect_content: no forwarding or saving
  linkPreview?: { off: boolean; url?: string; size: 'auto' | 'small' | 'large'; above: boolean }
  effect?: string                   // message effect ID from the catalog (08)
  chatAction?: { action: ChatAction; seconds: number }   // "typing..." before sending
  delaySec?: number                 // wait before sending (no other step needed)
  draft?: boolean                   // "Write it out like a draft": sendMessageDraft or sendRichMessageDraft first; text and rich messages
  draftStop?: boolean               // "Let the user stop it": can_stop (Bot API 10.3); message steps
  draftKeep?: boolean               // "Keep what was written": keep_on_stop
}
```

### 2.8 Questions

```ts
type Question = StepBase & { kind: 'question'
  prompt: { content: Content; keyboard: Keyboard; options: Options }
  expects: 'text' | 'number' | 'email' | 'phone' | 'location' | 'photo' | 'video' | 'file'
         | 'voice' | 'audio' | 'any'
  checks: { minLength?: number; maxLength?: number; min?: number; max?: number
            wholeNumber?: boolean; pattern?: 'email' | 'url' | 'phone' | 'date'
            maxFileMb?: number; fileTypes?: string[] }
  saveTo: VarId
  wrongAnswer: { message: RichTextRef; maxTries?: number; afterMaxTries?: StepId }
  cancel?: { words: LangText; goTo: StepId }       // e.g. "Cancel", "انصراف"
  next: StepId }
```

`phone` accepts a shared contact (from a "Share phone" button) or typed digits; `location`
accepts a shared location or venue. A prompt's inline buttons ("Skip") have their own targets.

### 2.9 Bot setup

```ts
type BotSetup = {
  name: LangText                    // up to 64 characters
  about: LangText                   // short description, up to 120
  description: LangText             // "What can this bot do?", up to 512
  photo?: MediaSlot
  username?: string                // without the @, for start links in the docs; t.me/yourbot without it
  menuButton: 'commands' | 'default'
  commandOrder: StepId[]            // start points of type command, in menu order
}
```

### 2.10 Conditions and remember actions

```ts
type Condition = { all: Item[] } | { any: Item[] }
type Item =
  | { var: VarId; op: 'isSet' | 'isEmpty' | 'equals' | 'notEquals' | 'contains' | 'startsWith'
      | 'gt' | 'gte' | 'lt' | 'lte'; value?: Value }
  | { switch: SwitchId; is: boolean | string }
  | { language: Lang[] }                               // the user's language is one of
  | { memberOf: string }                               // @channel or a chat the bot is in
  | { hasPaid: StepId } | { subscribed: StepId }       // S2, an invoice step
type RememberAction = { var: VarId; op: 'set' | 'clear' | 'add' | 'subtract' | 'append'
                        value?: Value }
```

`type Value = string | number | boolean | { var: VarId }`: a variable is written `{ var }` so it is
never taken for typed text.

In the interface every item reads as a plain sentence: "If [saved answer: age] [is at least]
[18]", "If [User is admin] [yes]", "If the user [is a member of] [@mychannel]".

### 2.11 Parts and media

```ts
type Part = { id: PartId; idName: string; name: string } & (
  | { kind: 'rows'; place: 'inline' | 'reply'; rows: ButtonId[][] }
  | { kind: 'text'; text: RichTextRef } )
type MediaItem = { id: MediaId; serverId: string; kind: MediaKind; name: string; mime: string
                   bytes: number; width?: number; height?: number; durationMs?: number }
```

A row part is placed in a keyboard as a `{ type: 'part' }` row; its buttons are the same buttons
everywhere (one target, one label). A text part is an inline node in a rich text. "Detach"
copies the part's buttons or text into the step and removes the reference.

## 3. The Yjs document

One `Y.Doc` per design (`design:<id>`), layout version in `meta.layout` (starts at 1).

```
meta       Y.Map   layout: number, id: string, name: string, languages: Y.Array<string>, defaultLanguage: string, ignoredChecks: Y.Array<string>, copiedTexts: Y.Map<string> (the Texts tab's copies)
bot        Y.Map   name/about/description: Y.Map<lang, string>, photo, menuButton,
                   commandOrder: Y.Array<string>
steps      Y.Map<StepId, Y.Map>       kind, idName, title, x, y, note, frame, kind fields;
                                       nested objects as Y.Map, lists as Y.Array
buttons    Y.Map<ButtonId, Y.Map>     place, idName, label: Y.Map<lang,string>, look, icon, action
texts      Y.Map<TextId, Y.Map<lang, Y.XmlFragment>>    rich texts (TipTap fragments)
variables  Y.Map<VarId, Y.Map>
switches   Y.Map<SwitchId, Y.Map>
parts      Y.Map<PartId, Y.Map>
media      Y.Map<MediaId, Y.Map>
```

`copiedTexts` keys a copied text by its place and language (`text.<textId>:<lang>`,
`bot.<field>:<lang>`, `button.<buttonId>.<field>:<lang>`, `step.<stepId>.<field>:<lang>`) with a
fingerprint of the words copied; the text counts as not translated while its words match. `tidy`, a
new copy and removing a language drop stale keys. The export leaves them out.

A rich text field of a step or part holds its text ID; `texts[id]` holds a fragment per language
of the design (a new text and a new language create them at once, so two people never create the
same fragment). A keyboard row always holds at least one button.

Rules (all in `packages/spec/src/ydoc/`):

1. Writers never touch Yjs directly: typed accessors (`steps.add(kind, at)`, `buttons.setLook`,
   `keyboard.moveButton`, `texts.fragment(textId, lang)`) wrap each change in one transaction
   with the person's origin, so undo groups it.
2. Deleting a step clears every arrow into it (buttons, steps, cases, outcomes) in the same
   transaction; deleting a button removes it from every row; deleting a part asks first and
   detaches its uses.
3. Plain texts (labels, names) are last-writer-wins strings per language; rich texts are
   `Y.XmlFragment`s so two people can type in the same text.
4. `tidy()` removes orphans (texts and buttons no step or part uses) and runs once when an
   editor opens a design, with origin `tidy` (not undoable).
5. `migrate(doc)` brings an older layout up to date; the first editor that opens the design
   runs it; readers on an old layout read through the migration in memory.
6. `readDesign(doc)` builds the plain model; `watchDesign(doc, cb)` keeps it current per changed
   step (02 section 9). Checks, Try it, the phone and export read only the plain model.
7. New design: `/start` start point, an empty "Main menu" message step it points to, the
   default language from the creator's choice (English unless chosen).

## 4. ID names (D-20)

- `snake_case`, `[a-z][a-z0-9_]{0,47}`, unique in the design across steps, buttons, variables,
  switches and parts.
- Made from the title or label in the default language: lower case, Latin transliteration
  (Persian, Arabic, Cyrillic and Greek tables in `packages/spec/src/names/`), spaces and
  punctuation to `_`; buttons get `btn_`, variables keep the bare name; empty or taken names
  get `_2`, `_3`; nothing usable gives `step_<n>` or `btn_<n>`. `back` and `stay` are never ID
  names (they are the special targets): a step titled "Back" gets `back_2`.
- Changing a title does not change the ID name once it was edited by hand or exported; before
  that it follows the title.
- In texts a variable chip shows as `{idName}`.

## 5. Texts

### 5.1 Rich text schema

TipTap and ProseMirror schema limited to what Telegram renders (`packages/spec/src/text/`):

- Blocks: `paragraph`, `codeBlock` (attr `language`, plain text only), `blockquote` (attr
  `expandable`, paragraphs only).
- Inline: text, `hardBreak`, `variable` (atom, attr `var`), `customEmoji` (atom, attrs `id`,
  `fallback`), `part` (atom, attr `part`, text parts only).
- Marks: `bold`, `italic`, `underline`, `strike`, `spoiler`, `code`, `link` (attr `href`),
  `dateTime` (attrs `unix`, `format`; Telegram's `date_time` entity, Bot API 9.5).

Pasting from other apps keeps only these; everything else becomes plain text.

### 5.2 Conversion to Telegram

`toTelegram(doc, opts)` (one language's document; `opts` gives a variable's ID name, a text
part's document and a custom emoji's fallback) gives three equal forms:

- `text`: the plain text with every variable written as `{idName}`;
- `entities`: Telegram `MessageEntity` objects (type, offset, length, url, language,
  custom_emoji_id) with offsets and lengths in UTF-16 code units, as the Bot API counts;
- `html`: Telegram HTML (`<b>`, `<i>`, `<u>`, `<s>`, `<tg-spoiler>`, `<code>`,
  `<pre><code class="language-x">`, `<blockquote>`, `<blockquote expandable>`, `<a href>`,
  `<tg-emoji emoji-id>`), with `&`, `<`, `>` escaped;
- plus `variables`: `{ var, offset, length }` for each placeholder in `text`.

Paragraphs are joined by `\n`, empty paragraphs keep their line. Lengths for checks count the
plain text after entity parsing, with each variable counted at its test value's length (or 10
characters when it has none), and are shown next to the limit.

`fromTelegram({ text, entities, variables })` and `fromTelegramHtml(html)` turn a Telegram text
back into a rich document (import, paste): a `\n` under marks is a hard break, any other ends a
paragraph; other entity types, and a code block inside a quote, become plain text or code; `{name}`
becomes a variable when the name is a known variable, or exactly at the given `variables` places.
The result is in normal form (`normalizeRichDoc`), and `fromTelegram(toTelegram(doc))` equals
`normalizeRichDoc(doc)` for every document without a part node (a part comes back as its text).
`measure(doc, opts)` gives the length for the checks and the editor's counter.

## 6. The export format: `spec.json` version 1

### 6.1 Principles

1. Self-contained: everything a builder needs, resolved: buttons inline in their keyboards,
   parts expanded (and also listed), texts in all three forms, targets by ID name.
2. Stable: ID names never change between exports unless a person changed them.
3. Exact Telegram meaning: each step and click names the Bot API method and parameters it maps
   to (`telegram` blocks), so a builder never guesses.
4. Versioned: `format` and `formatVersion`; a JSON Schema (`bot-spec.schema.json`) is in every
   export and in the repository (drift-checked by `make sanity`).

### 6.2 Top level

```json
{
  "format": "xdesign.bot-spec",
  "formatVersion": 1,
  "exportedAt": "2026-11-23T10:00:00Z",
  "exportedBy": "xDesign 1.0.0",
  "design": { "id": "Vx8...", "name": "Coffee shop bot", "docVersion": 412, "versionName": null },
  "telegram": { "botApi": "9.4", "chats": "private" },
  "languages": { "default": "en", "all": ["en", "fa"], "rightToLeft": ["fa"] },
  "bot": { },
  "startPoints": [ ],
  "steps": [ ],
  "parts": [ ],
  "variables": [ ],
  "testSwitches": [ ],
  "media": [ ],
  "checks": [ ],
  "notes": [ ],
  "sections": [ ]
}
```

`sections` lists the section frames (`id`, `title`, `x`, `y`, `width`, `height`, `color`, and the
boxes inside as `steps`). Every box has `id` (its ID name), `title`, `section` (its frame's title
or null), `note` and `x`, `y` (an import lays out boxes without them). Arrows and references are
null when there are none; other optional fields are left out as in the model. A reference that
names nothing keeps the design's ID. Collections are in ID name order.

### 6.3 A message step

```json
{
  "id": "main_menu",
  "kind": "message",
  "title": "Main menu",
  "section": "Start",
  "note": "Show the user's name if we know it.",
  "message": {
    "type": "text",
    "text": {
      "en": { "text": "Hello {first_name}! What would you like?",
              "entities": [ { "type": "bold", "offset": 6, "length": 12 } ],
              "html": "Hello <b>{first_name}</b>! What would you like?",
              "variables": [ { "var": "first_name", "offset": 6, "length": 12 } ] },
      "fa": { "text": "سلام {first_name}! چه میل دارید؟", "entities": [], "html": "...",
              "variables": [ { "var": "first_name", "offset": 5, "length": 12 } ] }
    }
  },
  "keyboard": {
    "type": "inline",
    "rows": [
      [ { "id": "btn_menu", "label": { "en": "Menu", "fa": "منو" }, "look": "primary",
          "icon": null,
          "does": { "type": "goTo", "target": "coffee_list", "show": "edit", "popup": null,
                    "remember": [] },
          "telegram": { "button": "callback_data", "suggestedCallbackData": "btn_menu",
                        "style": "primary",
                        "onClick": [ "answerCallbackQuery", "editMessageText" ] } },
        { "id": "btn_cart", "label": { "en": "Cart", "fa": "سبد" }, "look": "default",
          "does": { "type": "goTo", "target": "cart", "show": "edit",
                    "popup": { "kind": "toast", "text": { "en": "Opening your cart" } } },
          "telegram": { "button": "callback_data", "suggestedCallbackData": "btn_cart",
                        "onClick": [ "answerCallbackQuery(text)", "editMessageText" ] } } ],
      { "part": "back_row", "buttons": [ [ { "id": "btn_help", "...": "..." } ] ] }
    ]
  },
  "options": { "silent": false, "protect": false, "linkPreview": null, "effect": null,
               "chatAction": { "action": "typing", "seconds": 1 }, "delaySec": 0 },
  "next": null,
  "telegram": { "method": "sendMessage", "parseMode": "HTML or entities",
                "replyMarkup": "InlineKeyboardMarkup" },
  "cameFrom": [ "start", "btn_back" ]
}
```

`cameFrom` lists every start point, step and button with an arrow into this step (for readers).
Each language of a text also has `rich`, the TipTap document with variable and part nodes by ID
name; an import uses it, or reads `text`, `entities` and `variables` without it. In `onClick`, an
edit Telegram cannot make becomes the send of a new message, and `editMessage*` or `send*` stands
for a step known only when the bot runs. A bottom button's `telegram` has `update`, the update a
press sends. The buttons of a part are listed in `parts` without `telegram`.

As built (RICH-02): `onStop` (a step, `back` or null) on a message that can be stopped, and
`telegram.draftStop` `{ can_stop: true, keep_on_stop, update: "stopped_message_generation" }`.

### 6.4 Other kinds

- `question`: `prompt` (as a message), `expects`, `checks`, `saveTo`, `wrongAnswer`
  (`message`, `maxTries`, `afterMaxTries`), `cancel`, `next`, and `telegram` (`method` of the
  prompt; `waitsFor`: the update type such as `message.text` or `message.contact`).
- `if`: `cases` with `when` as structured items **and** as one plain sentence (`"say"`), and
  `otherwise`.
- `remember`, `wait`, `devStep`, `goTo`, `end`: their fields, every target by ID name;
  `devStep.description` verbatim.
- `start`: in `startPoints`, with `trigger` and `telegram` (`/start` with or without payload,
  the command, or the update type for stage 2 events).
- `note` and `frame`: `notes` (text, attached steps) and `section` on each step.

### 6.5 Media, checks

- `media`: `{ "id", "kind", "file": "media/<idName or hash>.<ext>", "name", "mime", "bytes",
  "width", "height", "durationMs" }` (`id` is the file name without its extension, `name` the
  uploaded file name), or `{ "id", "kind", "placeholder": "product photo" }` (`id` from where it
  is used: `<step>_media`, `<step>_media_<n>`, `bot_photo`; `kind` null for an album item).
- `checks`: `{ "level": "error" | "warning" | "info", "code": "E05", "where": "main_menu",
  "button": "btn_menu", "language": "fa", "message": "Plain-words text" }`, the full list at
  export time (D-19).

### 6.6 Versioning rules

- Adding optional fields or new kinds keeps `formatVersion` 1 (readers ignore what they do not
  know); stage 2 adds only such things.
- Renaming, removing or changing the meaning of a field makes `formatVersion` 2, with an import
  migration from 1; `HOW-TO-READ.md` names the differences.

## 7. Stage 2 model additions

### 7.1 Invoices

`invoice` step: `invoice: { title: LangText (1 to 32); description: LangText (1 to 255); photo?: MediaSlot; currency: string ('XTR' for Stars, or a card currency code); prices: { label: LangText; amount: number }[] (smallest unit, one line for Stars); subscription?: { periodDays: 30 } (Stars only); physical?: { needName, needPhone, needEmail, needAddress, flexibleShipping: boolean; shippingOptions: { id; title: LangText; amount: number }[] }; payload?: string (default the ID name) }`, `keyboard` (inline, its first button the pay button; null: Telegram's own), `options`, `checkout?: { description: string; refuse: LangText }` (the pre-checkout check: OK, or refuse with the message; left out: always OK) and `next` ("Paid"). Without `physical` the invoice sells digital goods, which Telegram sells only in Stars (08). A subscription is sent as an invoice link (createInvoiceLink). The `paymentDone` and `refunded` start points take later events.

### 7.2 New message kinds

`poll`, `quiz`, `dice` and `paidMedia` as in section 2.4 (no checklist, D-36), with their Try it behavior (04 section 8) and checks E20 to E22 (section 8), and `rich` (a rich message, RICH-01) as in section 2.4, with check E28.

### 7.3 Actions

```ts
type Action =
  | { type: 'react'; emoji: string; onStep?: StepId | 'userMessage'; big?: boolean }
  | { type: 'pin'; step?: StepId } | { type: 'unpin'; step?: StepId }   // unpin without step: the newest pinned
  | { type: 'delete'; step?: StepId }
  | { type: 'gift'; giftDescription: string; text?: RichTextRef; payForUpgrade?: boolean }
  | { type: 'chatAction'; action: ChatAction }
  | { type: 'refund'; invoice?: StepId }
```

An action acts on the message the named step sent the user last (a reaction may take the user's
last message). A pin has no "silent": Telegram never notifies about pins in private chats. A
reminder is a `wait` with `stopWhen` (section 2.2).

## 8. The checks (D-19)

Pure function `check(design, opts?): Issue[]` in `packages/spec/src/checks/`, one file per rule
group (texts and lengths, keyboards and buttons, flow and arrows, languages, variables, bot
setup, Telegram notes); each rule has a code, a level and a plain-words message naming the step
title and the button text; limits come only from the Telegram catalog (08), never from numbers
in the rule code. `Issue = { code, level, stepId?, buttonId?, language?, message, ignorable,
ignored? }`, sorted by level, then map order. "Ignore here" stores
`<code>:<stepId>[:<buttonId>][:<language>]` in `design.ignoredChecks`; ignored issues stay in
the list with `ignored: true`; errors are never ignorable. Stage 1 rules:

| Code | Level | Rule |
|---|---|---|
| E01 | error | Message text longer than Telegram's text limit (per language). |
| E02 | error | Caption longer than the caption limit. |
| E03 | error | More buttons in a row or in a keyboard than Telegram allows. |
| E04 | error | Album with fewer than 2 or more than 10 items, mixed kinds Telegram refuses, or buttons on an album. |
| E05 | error | "Edit this message" where Telegram cannot edit: the catalog's edit matrix (a text can become media; media cannot become text; an album only item by item; a sticker, location, venue, contact or round video only its buttons; a voice only its caption and buttons), a clicked message sent with a bottom keyboard, a keyboard removal or a forced reply, or a shown message that has one of those (an edit sets inline buttons only); the check offers "Send a new message". |
| E06 | error | Copy-text longer than its limit; popup text longer than its limit. |
| E07 | error | Link that is not `http`, `https` or `tg`; login link that is not `https`. |
| E08 | error | Command not matching Telegram's rules, or used twice. |
| E09 | error | Start link payload not matching Telegram's rules. |
| E10 | error | Bot name, about, description or command description too long. |
| E11 | error | Question with nowhere to go after a valid answer. |
| E12 | error | Button text empty in the default language. |
| W01 | warning | Step nobody can reach (no arrow in, not a start point). |
| W02 | warning | Button, case, outcome or "then" that goes nowhere yet. |
| W03 | warning | Missing translation (text, label, caption, popup, placeholder) in a design language. |
| W04 | warning | Variable used but never set, or set but never used. |
| W05 | warning | Question without a wrong-answer message. |
| W06 | warning | "If" without "otherwise". |
| W07 | warning | Developer step without a description. |
| W08 | warning | Button text longer than about 30 characters in a row of two or more (Telegram cuts it on phones). |
| W09 | warning | Message effect on a message shown by editing (effects play only on new messages). |
| W10 | warning | Message step with no buttons, no "then" and no keyboard that is not an end: the user can only type. |
| W11 | warning | Custom emoji (in text or as a button icon): they work only for bots with an extra username bought on Fragment, or in messages to private chats when the bot's owner has Telegram Premium (08). |
| I01 | info | Placeholder media still in the design. |
| I02 | info | Button looks show only in Telegram versions from February 2026 on. |
| I03 | info | "Delete this one and send a new one" and "Delete a message" work only within Telegram's time limit for deleting (08); a dice message in a private chat only after its waiting time (08, stage 2). |
| I04 | info | Chat action longer than Telegram shows it at once (the developer repeats it). |
| E20 | error | Poll or quiz outside Telegram's limits: question (1 to 300), 1 to 12 options (1 to 100 each), explanation (0 to 200, at most 2 line breaks), open period 5 to 2628000 seconds, not both an open period and a close date, users adding options to an anonymous poll. |
| E21 | error | Quiz without a right option, or with a right option it does not have. |
| E22 | error | Paid media outside 1 to 25000 Stars, without 1 to 10 items, or with items other than photos, videos and live photos. |
| E23 | error | Invoice outside Telegram's limits: title (1 to 32), description (1 to 255), payload (1 to 128 bytes), currency, prices (at least one, one in Stars, whole amounts, a total above nothing), labels and shipping options, flexible shipping without options, the refusal message; a keyboard that is not inline or does not start with its pay button, a second pay button, a pay button outside an invoice. |
| E24 | error | Digital goods in a card currency (Telegram sells them only in Stars); physical goods in Stars that ask for a name, phone, email, address or shipping (Telegram ignores them). |
| E25 | error | Subscription not in Stars, not every 30 days, or outside 1 to 10000 Stars. |
| E26 | error | Gift text longer than 128 characters. |
| E27 | error | An anonymous poll or quiz that saves the vote: Telegram does not tell the bot who voted. |
| E28 | error | Rich message outside Telegram's limits: at least one block, at most 500 blocks, 32768 characters, 50 media (photos, videos, GIFs, audio, voice notes and files only), 20 table columns, heading sizes 1 to 6, 1 to 8 buttons in a row inside (inline buttons only), lists and tables not empty. |
| E29 | error | Action or event Telegram cannot do: a reaction that is not one of its reaction emoji; a reaction, pin, unpin or delete on a step that sends no message; "Subscription changed" for an invoice that is not a subscription. |
| E30 | error | A message, question, invoice or chat action after "User blocks the bot": Telegram refuses them until the user restarts the bot. |
| W20 | warning | Broadcast that does not say who gets it (a condition without items) or when it is sent. |
| W21 | warning | Wait longer than an hour: the bot keeps it itself, so the developer stores it to survive a restart. |
| I20 | info | Refund or "Refund" start point of an invoice paid by card: bots refund only Stars payments. |
| I21 | info | Broadcasts follow Telegram's rates: about 30 messages per second, 1000 with paid broadcasts. |

The stage 2 rules are the codes E20 on, W20 on and I20 on; 08 section 6 lists them as built.

## As built (M1)

**SPEC-01** (a3846dc).

Code: IDs, ID names and languages: `packages/spec/src/model/ids.ts`; Rich and plain texts:
`packages/spec/src/model/texts.ts` (`LangText`, `RichText`, `RichTextRef`); Steps:
`packages/spec/src/model/steps.ts` (`StepBase`, one schema per kind, `StepSchema`); question fields
in `packages/spec/src/model/question.ts`; Start triggers: `packages/spec/src/model/triggers.ts`;
Content and media slots: `packages/spec/src/model/content.ts`; Keyboards and buttons:
`packages/spec/src/model/buttons.ts`; Message options: `packages/spec/src/model/options.ts`;
Conditions and remember actions: `packages/spec/src/model/conditions.ts`; Variables and test
switches: `packages/spec/src/model/variables.ts`; Parts and media items:
`packages/spec/src/model/parts.ts`; Bot setup: `packages/spec/src/model/bot.ts`; The design and
`validateDesign`: `packages/spec/src/model/design.ts`; Rich text schema, `RICH_NODES`, `RICH_MARKS`,
`plainText`: `packages/spec/src/text/schema.ts`; ID names and transliteration:
`packages/spec/src/names/id-name.ts`, `packages/spec/src/names/transliterate.ts`; Exports: one block
at the end of `packages/spec/src/index.ts` (`export *` of each file above).

- Every schema is `XSchema` with `type X = z.infer<typeof XSchema>`. Unions: steps on `kind`;
  content, triggers, keyboards, rows, inline and reply actions, rich nodes and marks on `type`;
  buttons on `place`; parts on `kind`. Content members that share fields share one member (`type:
  'photo' | 'livePhoto' | 'video' | 'animation'`). Condition items, conditions (`all` or `any`),
  values and media slots are plain unions (no common field).
- Step members are `StartStep`, `MessageStep`, `QuestionStep`, `IfStep` (cases `IfCase`),
  `RememberStep`, `WaitStep`, `DevStep` (outcomes `Outcome`), `GoToStep`, `EndStep`, `NoteStep`,
  `FrameStep`. The question's own fields are `QuestionFieldsSchema` (with `Prompt`, `Expects`,
  `AnswerChecks` for its `checks`, `WrongAnswer`, `Cancel`); steps.ts adds `StepBase` to them.
- Every arrow is optional: `next`, `otherwise`, case and outcome `goTo`, the goTo step's `target`,
  `wrongAnswer.afterMaxTries`, `cancel.goTo` and every button's target. Arrows the plan does not
  type (`next` of start, message, remember and wait; case and outcome `goTo`; `otherwise`; `target`)
  take a `Target`: a step ID or `back`. The question's `next`, `afterMaxTries`, `cancel.goTo` and
  the share and pick buttons' `goTo` take a step ID only, as written; the inline goTo action takes a
  step ID, `back` or `stay`.
- IDs are plain string types (`StepId`, `ButtonId`, `VarId`, `SwitchId`, `PartId`, `MediaId`,
  `TextId`, `FrameId`), checked as 1 to 64 of A to Z, a to z, 0 to 9, `_` and `-` (nanoids in the
  app, readable IDs in fixtures). A step ID is never `back` or `stay`. Case and outcome IDs use the
  same form. A language is a lower case IETF tag (`en`, `fa`, `pt-br`).
- Steps, buttons, variables, switches and parts have `idNameFixed?: boolean`: true once the ID name
  was edited by hand or exported; until then it follows the title, label or name.
- A value in a condition item or a remember action is `string | number | boolean | { var: VarId }`
  (a variable is `{ var }`, so it is never taken for typed text; booleans for yes/no variables).
- Rich texts in the model are `RichTextRef = { id: TextId; doc: RichText }` with `RichText =
  Partial<Record<Lang, RichDoc>>`; plain texts are `LangText = Partial<Record<Lang, string>>`.
- Rich text schema: a doc holds paragraphs, code blocks and quotes; a quote holds paragraphs only; a
  code block holds text without marks and has `attrs.language: string | null` (TipTap's default
  null). Inline nodes (text, hardBreak and the atoms variable, customEmoji, part) may carry marks.
  Attributes TipTap adds beyond the schema (a link's target, rel, class) are dropped when a document
  is parsed. `dateTime` has `attrs: { unix: number, format: string }`.
- `plainText(doc, varName, partText?)`: blocks and the paragraphs of a quote joined by `\n`, a hard
  break as `\n`, a variable as `{idName}` from `varName(varId)`, a custom emoji as its fallback, a
  text part as `partText(partId)` returns (empty without it).
- The schemas check the shape only, plus what every reader relies on: the language list is not
  empty, has no language twice and holds the default; each step, button, variable, switch, part and
  media item is stored under its own ID. Telegram's limits and counts (albums of 2 to 10 items, bot
  name 64, about 120, description 512, at least one outcome), references to missing steps or
  buttons, the single `/start` and unique ID names are left to the checks (SPEC-05).
- `validateDesign(x)` returns `{ ok: true, design }` or `{ ok: false, problems }`, each problem `{
  path, message }`: the path joined by dots (`steps.k3x.trigger.type`, empty for the whole value),
  the message in plain words ("is missing", "should be a number", "should be one of text, photo,
  ...", "should be one of the languages in the list").
- `toIdName(base, prefix, taken, fallback = prefix || 'step_')`: `taken` is a `ReadonlySet<string>`;
  lower case Latin (`toLatin`), every run of other characters to `_`, no `_` at either end, then the
  prefix; a name without a prefix that starts with a digit loses its leading digits; names are cut
  to 48 characters with the `_2` suffix included; nothing usable gives the fallback with the first
  free number from 1 (`step_1`, `btn_1`; variables may pass their own fallback). `isIdName(name)`
  and `ID_NAME_PATTERN` give the rule.
- `toLatin(text)` (names/transliterate.ts): one fixed Latin form per letter. Persian and Arabic give
  the consonant skeleton (`سلام` is `slam`): alef, alef with madda and ayn `a`, vav `v`, yeh `y`,
  heh and teh marbuta `h`, hamza, tatweel and the zero-width non-joiner nothing; letters both
  languages write take the Persian form (`ث` s, `ق` q); Persian and Arabic digits 0 to 9. Cyrillic:
  Russian forms plus Ukrainian and Serbian letters. Greek: one form per letter. A few Latin letters
  (`ß` ss, `æ` ae, `ø` o, `ı` i); any other letter loses its accents (`é` e, `ά` a).
- A command trigger stores the command without its slash (`start`). Chat actions keep Telegram's
  names (`typing`, `upload_photo`, ...). `MediaKind` is the content kind a file is sent as (photo,
  livePhoto, video, animation, audio, voice, document, videoNote, sticker). Note and frame colors
  are plain strings (the editor's palette decides); a frame's name is its step `title`.
- Built-in variables are ordinary variables with source `builtin`; their list is not data here
  (SPEC-04 creates them with a new design).

**SPEC-02** (444fc48).

Code: Marks as entities and marks in normal form (`MARK_ENTITY`, `normalMarks`, `markKey`):
`packages/spec/src/text/marks.ts`; The normal form of a rich document (`normalizeRichDoc`):
`packages/spec/src/text/normalize.ts`; `toTelegram` (text, entities, HTML, variables) and `measure`:
`packages/spec/src/text/to-telegram.ts`; `fromTelegram` and `fromTelegramHtml` (with a small HTML
tokenizer, no DOM): `packages/spec/src/text/from-telegram.ts`; Exports: one block at the end of
`packages/spec/src/index.ts` (`export *` of the four files).

- `toTelegram(doc, opts)` takes one language's document; `opts` is `{ varName(varId), part?(partId),
  emojiFallback?(emojiId) }` and the result is `{ text, entities, html, variables }`. Entities are
  sorted by offset, then by length (longest first), then outer before inner (quotes, code blocks,
  marks, custom emoji). Entity types and HTML tags come from the catalog: the HTML tags are read
  from its html column (`<pre>` alone without a language, `<tg-time unix>` without a format), and a
  mark's entity type is `MARK_ENTITY` (strike is `strikethrough`, link `text_link`, dateTime
  `date_time` with `unix_time` and `date_time_format`).
- A mark gives one entity over every run of adjacent nodes that carry it; entities never cross a
  paragraph or block boundary. Entities of length 0 are left out (an empty code block or quote
  writes only its line). Where marks overlap without one holding the other, the HTML closes the
  inner tag and opens it again.
- A text part is written where its node is, under the node's marks; a part placed inside itself
  writes nothing; a quote inside a part placed in a quote is written as its paragraphs; the part's
  marks stop at a code block inside it. A custom emoji uses its own fallback, then `emojiFallback`,
  and writes nothing without one.
- `measure(doc, { testValue?, part?, emojiFallback? })` is the length of the plain text with each
  variable at its test value's length (`String(value)`), or 10 when it has none, in UTF-16 code
  units.
- `fromTelegram({ text, entities?, variables? }, { variable?(idName) })` and `fromTelegramHtml(html,
  opts)`: with `variables` (as toTelegram gives them) exactly those places become variables;
  without, a `{name}` placeholder becomes a variable when `variable(name)` knows it. A `\n` that no
  mark covers ends a paragraph, one under marks is a hard break with those marks; quotes and code
  blocks are blocks (a single `\n` joins them to their neighbours); a code block inside a quote
  becomes code; other entity types (mention, url, hashtag, ...) become plain text. The HTML reader
  also takes Telegram's other spellings (strong, em, ins, strike, del, `span class="tg-spoiler"`),
  numeric character references and `&lt;`, `&gt;`, `&amp;`, `&quot;`; unknown tags keep their text.
- Normal form (`normalizeRichDoc`): marks in the schema's order, one of each type (the first), left
  out when there are none; adjacent texts with equal marks merged; empty texts and custom emoji
  without a fallback dropped; a line break without marks (a hard break or a `\n` in a text) starts a
  new paragraph, one with marks stays a hard break; code blocks have `attrs: { language }` (null
  when empty) and one text node, quotes `attrs: { expandable }` (true or false); an empty code block
  or quote and a document without blocks become an empty paragraph. `fromTelegram(toTelegram(doc))`
  equals `normalizeRichDoc(doc)` for every document without a part node, and fromTelegram always
  returns the normal form.

**SPEC-03** (3f51548).

Code: `SpecSchema` (Zod) with every part and its type, and `specJsonSchema()`:
`packages/spec/src/export/schema.ts`; `toSpec(design, options)`:
`packages/spec/src/export/to-spec.ts`; The `telegram` blocks of steps, start points and buttons
(send method, parse mode, reply markup, `waitsFor`, start updates, button field, callback data,
style, icon, click calls by `show` and the edit matrix): `packages/spec/src/export/telegram.ts`;
`fromSpec(spec)` with the migration table `SPEC_MIGRATIONS` (empty):
`packages/spec/src/export/from-spec.ts`; variable and part references of rich documents renamed both
ways: `packages/spec/src/export/rich.ts`; `sameDesign(a, b)` and `designDifference(a, b)`:
`packages/spec/src/export/compare.ts`; JSON Schema: `packages/spec/scripts/gen-schema.ts`, the
Makefile target `gen-schema` in `GEN_STEPS`, the output
`packages/spec/schema/bot-spec.v1.schema.json` in `GEN_OUTPUTS`, and `packages/spec/schema/` in
`.prettierignore` (generated); Exports: one block at the end of `packages/spec/src/index.ts`.
`plainMessage` of `packages/spec/src/model/design.ts` is now exported, so fromSpec words its
problems as validateDesign does.

- Top level as 6.2 plus `sections`. `telegram.botApi` is the catalog's `BOT_API` (10.5).
  `languages.all` is the design's list, or with `options.languages` only those plus the default;
  `rightToLeft` by the primary subtag (ar, arc, ckb, dv, fa, he, ps, sd, ug, ur, yi).
  `design.versionName` comes from the optional `versionName` option (null without it).
- Every box (start point, step, note, section) has `id` (its ID name), `title`, `section` (the title
  of its frame, or null), `note` (or null) and `x`, `y` (optional on import: boxes without them are
  laid out 8 to a row, 320 by 240 apart). Start points and steps add `cameFrom`: start points and
  steps in ID name order, then buttons.
- Every collection is listed in ID name order; uploaded files by their path in the zip.
- Arrows and references (`next`, `target`, `otherwise`, `goTo`, `afterMaxTries`, a bottom button's
  `saveTo`, `saveRestTo`), `icon`, `popup`, `cancel`, `bot.photo`, `section` and `note` are null
  when the design has none. Every other optional field is left out when the design has none, as in
  the model: `options` is the model's object as it is, `remember` is written only when set.
- References are ID names. One that names nothing in the design keeps the design's own ID, and the
  import keeps it as it is (the checks report it). `back` and `stay` are written as they are.
- A text is, per language, `{ text, entities, html, variables, rich }`: `variables[].var` is an ID
  name, `rich` the TipTap document with variable and part nodes holding ID names. A text part is
  expanded in the three Telegram forms and stays a part node in `rich`. Plain texts (labels, popups,
  names, descriptions) are `{ "<lang>": "..." }`.
- `message` (and a question's `prompt.message`) is the model's content, with each text or caption as
  above and each file as the `id` of its entry in `media`.
- Keyboard rows are lists of buttons; a placed row part is `{ part, buttons }` with its rows
  expanded. A button is `{ id, label, look, icon, disabled?, does, telegram }`; `does` is the
  model's action with targets by ID name (inline: goTo, url, copyText, loginUrl; bottom: text,
  sharePhone, shareLocation, pickUsers, pickChat, createPoll), so inline or bottom follows from
  `does.type`.
- `parts` are `{ id, kind: "rows", name, place, rows }` with whole buttons but no `telegram` (it
  depends on the message the part is placed in), or `{ id, kind: "text", name, text }`.
- A button's `telegram`: `button` is the catalog's Bot API field (callback_data, url, copy_text,
  login_url, disabled, text, request_contact, request_location, request_users, request_chat,
  request_poll); `suggestedCallbackData` (callback buttons) is the ID name; `style` is left out for
  the default look; `icon_custom_emoji_id`; `onClick` on callback buttons; `update` on bottom
  buttons, the update a press sends (message.text, message.contact, message.location,
  message.users_shared, message.chat_shared, message.poll).
- `onClick` starts with `answerCallbackQuery`, `answerCallbackQuery(text)` for a toast or
  `answerCallbackQuery(text, show_alert)` for an alert; nothing follows for `stay`, no target or an
  End. `show: "new"` adds the send method of the step shown, `"replace"` `deleteMessage` and the
  send method, `"edit"` the edit matrix's method from the clicked message's kind to the shown one:
  `editMessageText`, `editMessageMedia`, `editMessageCaption` (the same kind and file, or a voice),
  `editMessageReplyMarkup` (kinds that change only their buttons, with the same content). Where
  Telegram cannot edit (the matrix says no, a caption-only or buttons-only kind gets another file,
  or the shown step has a bottom keyboard, a keyboard removal or a forced reply) the press sends the
  step as a new message. The step shown is followed through Go to and Remember boxes; when it is
  known only when the bot runs (back, an If, a wait, a developer step) the entry is `editMessage*`
  or `send*`.
- A step's `telegram` is `{ method, parseMode, replyMarkup }`: the catalog's method of the content
  kind; `parseMode` "HTML" when the message has a text or caption, else null (the other way is
  `text` with `entities`); `replyMarkup` the catalog's object of the keyboard type, or null. A
  question adds `waitsFor`: message.text (text, number, email), message.contact and message.text
  (phone), message.location and message.venue (location), message.photo, message.video,
  message.document, message.voice, message.audio, or message (any). A start point's is `{ update,
  command, payload, match }`: a command is message.text with `/<command>`; a start link `/start`
  with its payload and exact or prefix; anything else message, message.text or the eight media
  fields.
- If cases are `{ label, when, say, goTo }`; `say` reads like "age is at least 18 and the user's
  language is fa or en" (texts quoted, yes or no, variables and switches by ID name; "always" and
  "never" for empty lists). Case, outcome and text IDs are not exported.
- `bot` is name, about, description, photo, menuButton, `commandOrder` (start points by ID name) and
  `commands`: the commands in the menu, in order, each with its command, description per language
  and start point.
- `media`: an uploaded file is `{ id, kind, file, name, mime, bytes, width?, height?, durationMs?
  }`, its `id` the file name of `mediaFile` without the extension and `name` the uploaded file name;
  a placeholder is `{ id, kind, placeholder }` with `id` from where it is used (`<step>_media`,
  `<step>_media_<n>` for an album item, `bot_photo`) and `kind` null for an album item.
- `checks` are written as passed, with IDs in `where` and `button` turned into ID names.
- `notes` are `{ id, title, section, note, x, y, text, color, steps }`, `steps` being the steps of
  the note's section; `sections` are `{ id, title, section, note, x, y, width, height, color, steps
  }` with every box inside.
- `fromSpec(input)` gives `{ ok: true, design, files }` (`files`: the zip path of each uploaded file
  by its new media ID; `serverId` is empty until the importer uploads it) or `{ ok: false, problems
  }` as validateDesign gives them. Problems: a newer format version ("is 2, newer than this xDesign
  reads (1)"), an older one without a migration, the schema's in plain words, an ID name used twice
  across steps, buttons, variables, switches and parts, a box named `back` or `stay`, a media id
  used twice; the design it builds is checked with validateDesign too. Every ID name of the import
  is fixed (`idNameFixed: true`).
- `sameDesign(a, b)` compares by ID name, every reference turned into the ID name it points at and
  media items by their fields; it leaves out the design ID, text, case and outcome IDs,
  `idNameFixed` and `serverId`, and takes a field set to undefined as missing. `designDifference(a,
  b)` gives the first path that differs (`steps.main_menu.content.text.en`), or null.
- The JSON Schema is `z.toJSONSchema(SpecSchema)` in input mode with named `$defs` (Ref, Target,
  IdName, LangText, RichText, LangRichText, RichDoc, Entity, Message, Keyboard, Button,
  RememberAction, Condition, Options, Step); it allows fields it does not know.

**SPEC-04** (8497a89).

Code: Layout, Yjs to plain conversion, ID name helpers, `newId()`:
`packages/spec/src/ydoc/layout.ts`; Rich text in Yjs, y-tiptap 3.3.0's encoding (`fragmentToDoc`,
`docToFragment`): `packages/spec/src/ydoc/rich.ts`; Where the document refers to steps, buttons,
texts and media (arrows, button rows, rich text fields, plain texts, media slots, command order):
`packages/spec/src/ydoc/refs.ts`; Accessors, one module per area: `ydoc/steps.ts`, `ydoc/buttons.ts`
(buttons and keyboards), `ydoc/texts.ts`, `ydoc/variables.ts` (variables and switches),
`ydoc/parts.ts`, `ydoc/media.ts`, `ydoc/bot.ts`, `ydoc/languages.ts`; all of them bound to a doc and
an origin: `ydoc/edits.ts` (`designEdits(doc, origin)`); `readDesign` and `watchDesign`:
`packages/spec/src/ydoc/read.ts`; `newDesignDoc`, `docFromDesign`, `encodeDoc`, `decodeDoc`,
`BUILTIN_VARIABLES`: `packages/spec/src/ydoc/new.ts`; `tidy`: `packages/spec/src/ydoc/tidy.ts`;
`migrate`, `layoutOf`, `migratedView`: `packages/spec/src/ydoc/migrate.ts`; Exports: one block at
the end of `packages/spec/src/index.ts` (layout.ts and rich.ts by name, the other files whole).

- `meta` also holds `id` and `name` (the design's ID and name), so `readDesign(doc)` gives the whole
  `Design` and `docFromDesign` then `readDesign` gives the same model. `newDesignDoc({ id?, name,
  defaultLanguage?, languages? })`: `id` is the server's `designs.id` (a fresh nanoid without it),
  the default language is English unless chosen and comes first in the list.
- A rich text field (a message's text and captions, a question's prompt and wrong answer message, a
  text part's text) holds its text ID as a string; `texts[id]` is a `Y.Map` with a `Y.XmlFragment`
  per language. A new text gets a fragment for every language of the design, and adding a language
  adds one to every text. A fragment with no content is left out of the plain `RichText`.
- Fragments are written and read exactly as `@tiptap/y-tiptap` 3.3.0 does: a `Y.XmlElement` per node
  named after it with its non-null attributes, adjacent text nodes in one `Y.XmlText` with a
  formatting attribute per mark holding the mark's attributes (`{}` without any), `<name>--<hash>`
  mark keys read as `<name>`. Marks on hard breaks, variables, emoji and parts are not kept
  (y-tiptap does not store them either). Reading keeps only the attributes the schema knows (link
  `href`, dateTime `unix` and `format`, codeBlock `language`, blockquote `expandable`, variable
  `var`, customEmoji `id` and `fallback`, part `part`); node names outside the schema keep all
  theirs.
- `designEdits(doc, origin)` gives `steps`, `buttons`, `keyboard`, `texts`, `variables`, `switches`,
  `parts`, `media`, `bot`, `languages`; every method is one transaction with the origin. A refused
  change returns false (or undefined for one that returns an ID) and changes nothing.
- `steps.add(kind, at, fields?, title?)`: a fresh nanoid, the palette's title ("Message",
  "Question", "If", "Remember", "Wait", "Developer step", "Go to", "End", "Note", "Section"; a start
  point's from its trigger: `/command`, "Start link", "Anything else"), the ID name from it,
  defaults per kind (a question gets a new "Answer" variable as `saveTo`, an If one case "Yes", a
  developer step the outcome "Done", wait 1 minute, a note yellow, a section gray 640 by 400).
  `steps.set(id, fields)` replaces fields; a `RichTextRef` whose ID the document does not have yet
  is added with its documents, an existing one keeps its fragments; texts and buttons the step no
  longer uses are deleted. `steps.move(positions)` moves several steps in one change.
  `steps.connect(from, target)` draws or clears an arrow (`next`, `otherwise`, `target`,
  `afterMaxTries`, `cancel`, a case or an outcome). `steps.setTitle` and `setIdName` (ID names
  follow titles until fixed, everywhere).
- `steps.remove(ids)` clears every arrow into the steps (step arrows, cases, outcomes,
  `wrongAnswer.afterMaxTries`, `cancel.goTo`, button targets), takes steps out of a deleted frame,
  updates `bot.commandOrder` and deletes the steps' own buttons and texts. The last `/start` stays
  (also `set` refuses to change its trigger).
- `steps.duplicate(id, at)` copies a step (same title, fields and arrows out; new texts, own
  buttons, case and outcome IDs; `/start` refused); `steps.move(positions, frames)` also puts steps
  into a section or takes them out (null) in the same change.
- `map.paste(clip, at, frameAt)` pastes copied steps (`copySteps`, `readClip`) in one change;
  `map.arrange(boxes)` writes every box's place and section size in one change.
- Keyboards: a row always holds a button. `keyboard.addRow` adds a row with its first button,
  `addButton` adds to a row (the row after the last is a new one), `moveButton` moves within or
  between rows, `moveRow`, `removeRow` (deletes its buttons; a part row only stops using the part),
  `usePart`, `setType` (inline, bottom keyboard, remove keyboard, force reply or none; the old
  buttons are deleted), `setOptions`. A row emptied by a move or a button deletion is removed. These
  work on a step's keyboard (a question's prompt keyboard) or a row part (`{ step }` or `{ part }`).
- A new inline button goes to a step and shows it by editing; a new bottom button sends its text;
  look `default`; the label in the default language; ID name `btn_...`. `buttons.setLabel`,
  `setLook`, `setIcon`, `setDisabled`, `setAction` (must fit inline or bottom), `setTarget`
  (`target` of goTo, `goTo` of bottom actions), `setIdName`, `remove` (out of every row).
- `texts.fragment(textId, lang)` returns the fragment (creating it), `texts.setRich` writes a
  document into one, `texts.setPlain(at, lang, value)` sets any plain text ('' clears it): the bot's
  name, about and description, a button's label, popup and copied text, a command's menu text, a
  keyboard's input hint, a question's cancel words.
- `languages.add`, `remove` (its fragments and plain texts are deleted; not the default),
  `setDefault`.
- Parts: `addRows`, `addText`, `fromButtons(stepId, name)`, `rename`, `setIdName`,
  `detach(stepId, partId)`, `remove(id)`. `fromButtons` moves the button rows of a step's keyboard
  into a new row part (the same buttons) placed where the first of them was; rows that place a part
  stay. Detaching turns part rows into rows of new copies of the part's buttons and part nodes into the
  part's text in that language (the default one when empty there), its paragraphs joined by hard
  breaks. `remove` detaches every use, then deletes the part with its buttons and text.
- `media.remove` turns the slots that used the file into placeholders described by its file name.
  `bot.setMenuButton`, `setPhoto`, `moveCommand`; `bot.commandOrder` follows the command start
  points by itself (new ones at the end, gone ones out).
- `checks.ignore(issue)` (refused for errors) and `checks.stopIgnoring(issue)` keep the "Ignore
  here" keys (`issueKey`) in `meta.ignoredChecks`; `readDesign` gives them as `ignoredChecks` and
  `docFromDesign` writes them.
- Variables and switches: `add`, `set`, `setIdName`, `remove`; built-in variables refuse all three;
  variables fall back to `var_<n>`, switches to `switch_<n>`, parts to `part_<n>`.
- `readDesign(doc)` checks the model with `validateDesign` in development builds (Vite's
  `import.meta.env.DEV`; Node unless `NODE_ENV` is `production`) and throws with the first five
  problems. `watchDesign(doc, cb)` calls `cb` at once and after each transaction that changed the
  design, and returns the function that stops it; only changed steps, buttons, variables, switches,
  parts and media (and steps or parts whose texts changed) are read again, the others and unchanged
  collections keep their objects. Start it after the first sync (an empty document does not
  validate).
- `tidy` uses origin `tidy` (`TIDY_ORIGIN`), `migrate` origin `migrate` (`MIGRATE_ORIGIN`). A
  document without `meta.layout` counts as current; a newer layout throws. Readers of an older
  layout read a migrated copy in memory (`migratedView`).
- New design: `/start` is a command start point `start` (not in the commands menu), title "/start",
  ID name `start`, at x 0; "Main menu" has ID name `main_menu` and an empty text, at x 320; both at
  y 0; menu button `default`; bot name, about and description empty. Built-in variables (ID names
  fixed): `first_name` "First name" (text), `last_name` "Last name" (text), `username` "Username"
  (text), `user_id` "User ID" (number), `language` "Language" (text), `is_premium` "Premium user"
  (yes or no), each with a short description.

**SPEC-05** (ef42042).

Code: Issue type, rule codes with levels (`CHECK_LEVELS`), `issueKey`:
`packages/spec/src/checks/issues.ts`; The indexes built once per check (steps in map order, keyboard
rows with row parts placed, the steps that show each button, arrows into each step, variable uses
and sets, the messages an arrow shows, lengths through `measure`):
`packages/spec/src/checks/context.ts`; Texts and lengths (E01, E02, E06, W08):
`packages/spec/src/checks/texts.ts`; Keyboards and buttons (E03, E04, E05, E07, E12):
`packages/spec/src/checks/keyboards.ts`; Flow and arrows (E11, W01, W02, W05, W06, W07, W10):
`packages/spec/src/checks/flow.ts`; Languages (W03): `packages/spec/src/checks/languages.ts`;
Variables (W04): `packages/spec/src/checks/variables.ts`; Bot setup (E08, E09, E10):
`packages/spec/src/checks/bot.ts`; Telegram notes (W09, W11, I01, I02, I03, I04):
`packages/spec/src/checks/notes.ts`; `check(design, opts?)`, sorting and ignoring:
`packages/spec/src/checks/check.ts`; `ignoredChecks?: string[]` on `DesignSchema`:
`packages/spec/src/model/design.ts`; Exports: one block at the end of `packages/spec/src/index.ts`
(`export *` of issues.ts and check.ts).

- `check(design, opts?)` returns `Issue[]`: `{ code, level, stepId?, buttonId?, language?, message,
  ignorable, ignored? }`. `opts.ignored` (keys) replaces `design.ignoredChecks` when given. Issues
  are sorted by level (error, warning, info), then bot setup issues (no step) first, then the steps
  in map order (x, then y; equal places keep the design's order), then the rule order of the table;
  issues of one rule on one place keep the order they were found in.
- `issueKey(issue)` is `<code>:<stepId>[:<buttonId>][:<language>]`; an issue without a step (the bot
  photo of I01) has an empty step part (`I01:`). An ignorable issue whose key is in the list gets
  `ignored: true` and stays in the list; errors have `ignorable: false` and are never marked.
- One key is one issue: W02 lists every case, outcome and "then" of a step that goes nowhere in one
  issue; W03 is one issue per step and language (and per button and language); W04 one per step,
  naming every variable it is the first to use or set.
- Issues about a button itself (E06, E07, E12, W02, W03, W11 icons, I03) are reported once per
  button, at the first step in map order that shows it; E03, E05, W08 and I02 belong to the step
  whose keyboard has the button. Buttons no step shows are not checked.
- Lengths: rich texts with `measure` (variables at their test value or 10 characters, text parts
  placed); labels, popups and copy texts with `measure` on a one-paragraph document where `{idName}`
  of a known variable is a variable; bot name, about, description and command descriptions by their
  plain length.
- E05 follows the button's target through If, Remember, Wait, developer and go-to boxes to the
  messages and questions it shows first, and reports the first problem: the clicked message was sent
  with a bottom keyboard, a keyboard removal or a forced reply (`EDIT_FACTS` editableMarkup); the
  shown message has one of those (an edit sets an inline keyboard only, inlineKeyboardOnly); the
  edit matrix does not allow the pair (a text into a photo is allowed); the matrix allows only the
  caption or the buttons and the file or content differs; an album only item by item. The message
  ends 'Use "Send a new message" instead.'; the panel offers that fix from the code E05 and the
  button ID (no fix field). `back` targets are not followed.
- E04: fewer or more items than `albumItems`, an item whose kind is in no album group (GIF, voice,
  round video, sticker), items of two album groups, or a keyboard on an album (its kind takes no
  reply_markup). Placeholder items have no kind and are left out of the kind checks.
- E07 checks link and login buttons against the catalog's schemes; an empty URL is W02 (goes nowhere
  yet) and a URL that starts with a variable is not checked.
- E08 checks each command against the `command` limit's length and pattern and reports every command
  start point after the first with the same command; E09 checks a start link's payload (for prefix
  links, the prefix) against `startPayload`; E10 covers the menu descriptions of commands shown in
  the menu.
- W01 is for every step kind except start, note and frame; an arrow from a step into itself does not
  count. W02 covers start, Remember, Wait and go-to steps without "then" or target, cases, outcomes,
  a message "then" to a deleted step, and buttons (go-to without a target, an empty link, a bottom
  keyboard button without a target); a bottom keyboard button shown only on questions is the answer
  and gets no W02; disabled buttons are skipped. Arrows to deleted steps go nowhere.
- W03: a message text is needed in every design language, the default included (Telegram refuses an
  empty message); captions, wrong answer messages, placeholders and popups only where the default
  language has them; button texts in every other language (E12 covers the default).
- W04: uses are variables in texts (parts included), conditions, remember values, developer step
  uses and `{idName}` in labels, popups, copy texts and links; sets are question answers, remember
  actions, developer step sets, bottom keyboard buttons' `saveTo` and start link `saveRestTo`.
  Built-in variables are skipped. A step that uses or sets a deleted variable gets W04 too.
- W05 skips questions that expect any answer. W10 is for a message without "then", without buttons
  and with no keyboard or an empty one (a keyboard removal or a forced reply count as a keyboard).
- W09 reports the message with the effect, naming the first button that shows it by editing. W11 is
  one issue per step with a custom emoji in any of its texts (text parts included) and one per
  button with an icon; its words are the catalog's customEmoji rule. I02 is one issue per step
  naming its buttons whose look sets a style, with the catalog's styleShownByNewApps rule. I03 is
  for inline buttons shown by "Delete this one and send a new one", with the catalog's deleteWindow.
  I04 compares the chat action's seconds with chatActionDuration.

**SPEC-06** (ac7d484).

Code: Fixture helpers (ID names as the editor makes them, built-in variables, `byId`, rich texts
from plain lines with `{name}` variables): `packages/spec/fixtures/build.ts`; The example design
"Coffee shop" (bot "Hazel Coffee" / "کافه فندق", 49 steps, English and Persian):
`packages/spec/fixtures/coffee-shop.ts` (`coffeeShop`); The generated 300-step design:
`packages/spec/fixtures/big.ts` (`big`); `make spec-check`: `packages/spec/scripts/spec-check.ts`,
the package script `spec-check` (`node scripts/spec-check.ts`); the fixtures are in the spec
package's tsconfig (`include: ["src", "fixtures"]`); its output `packages/spec/fixtures/out/` is in
the root `.gitignore`; `back` and `stay` reserved as ID names: `RESERVED_ID_NAMES` in
`packages/spec/src/names/id-name.ts`, used by `takenIdNames` (`packages/spec/src/ydoc/layout.ts`)
and by `newDesignDoc` (`packages/spec/src/ydoc/new.ts`), the only toIdName callers outside it.

- The coffee shop has `/start` and `/help` (both in the commands menu, descriptions in both
  languages), a start link `promo` (prefix, the rest saved as `promo_code`) and a fallback; an If on
  a test switch "User is admin" and the language; the main menu with inline buttons in all four
  looks, a custom emoji icon, a disabled button, a link (with `{user_id}`), a copy text, a login
  link, clicks shown by edit, new and replace, a toast and an alert (with remember actions, target
  `stay`); a question for a number (checks, wrong answer, tries) followed by an If on its answer; a
  question for a phone with a bottom "Share phone" button and the cancel word "Cancel" / "انصراف"; a
  question with a forced reply; a message with a bottom keyboard of every button kind (hint text,
  one-time, "Open the reply field"); keyboard removals; a Remember box, a Wait, two developer steps
  (one with two outcomes, one with a note), a Go to a step, a Go to titled "Back" with target `back`
  (ID name `back_2`), an End; a note and the sections "Shop" and "Our café"; the row part "Back and
  menu" on three messages and the text part "Signature" in two texts; the café tour as a chain of a
  photo, live photo, video, GIF, audio, voice, round video, file, sticker, album, location, venue
  and contact, all media placeholders; every message option; and an "About us" text with every mark
  (dateTime included), a quote, an expandable quote, a code block, a link, a variable and a custom
  emoji.
- The fixtures are plain `Design` objects built in code with readable IDs (`menu`, `b-coffee`,
  `var-cups`); ID names come from titles, labels and names through `toIdName` in creation order,
  with `back`, `stay` and the built-in names taken, as the editor makes them.
- The 300-step design grows a tree breadth first from `/start`: a question at every step number
  ending in 4, an If on the last question's answer at every one ending in 7, otherwise a menu
  message with three inline buttons; the arrows still open at 300 steps go to the first menu.
- `make spec-check` runs, per fixture: `validateDesign`; `check` (the counts per level; the coffee
  shop must have no errors and its warnings are printed); `toSpec` with the issues as `checks` (a
  bot setup issue has `where: ""`), written as JSON and read back, then validated with
  `z.fromJSONSchema` of `schema/bot-spec.v1.schema.json`; `fromSpec` of that JSON compared with
  `designDifference`; `docFromDesign`, every step's title set again with `designEdits(doc,
  'spec-check').steps.setTitle`, then `readDesign`, compared the same way. Both comparisons put
  every rich text in normal form (`normalizeRichDoc`) on both sides first. On the 300-step design it
  times `check` and `toSpec` (the best of 5 runs, after the first runs above) and fails over 100 ms
  and 300 ms (now about 5 ms each). It writes `packages/spec/fixtures/out/coffee-shop.spec.json`.
  Output: one line per passing fixture (the coffee shop's warnings indented below it), `<fixture>:
  <step> failed: <details>` otherwise (the first differing path, or up to five schema problems), and
  a last line `spec-check: 2 fixtures passed`.
- The coffee shop's checks today: 0 errors, 2 warnings (W11 for the custom emoji icon and the custom
  emoji in "About us"), 19 good to know (I01 placeholders, I02 looks, I03 replace). No round trip
  failed: no fix was needed in SPEC-02 to SPEC-05's code.

## As built (M4)

**MSG-01** (385bb3a).

Code: `sendTelegram` and `waitsFor` are exported from `packages/spec/src/index.ts`; the message a
step sends (a message's own fields or a question's prompt), read and written:
`apps/web/src/editor/phone/message.ts` (`shownOf`, `setShown`, `latestStep`, `updateContent`,
`useUpdateContent`).

- `sendTelegram` and `waitsFor` are exported from packages/spec: "Telegram details" shows the
  export's own `telegram` block, not a second reading of the catalog.
- A question's prompt is written whole through `steps.set`: SPEC-04 has no prompt accessor; its
  keyboard keeps its button IDs and its texts their IDs, so nothing is deleted.
- The message effect is stored as its message_effect_id, and a catalog ID is read too: the export's
  `effect` is message_effect_id (the builders' guide), and imported designs may carry either.

**START-01** (03993bf).

Code: `username?` in `BotSetupSchema` (`packages/spec/src/model/bot.ts`) and `bot.setUsername`
(`ydoc/bot.ts`); `steps.set` makes a start point's title follow its trigger (`ydoc/steps.ts`);
`bot.username` in spec.json (`export/schema.ts`, `to-spec.ts`, `from-spec.ts`, the generated
`schema/bot-spec.v1.schema.json`), in design.md's start links and Bot setup
(`markdown/to-markdown.ts`) and in HOW-TO-READ.md's start link row (`docs/HOW-TO-READ.md`,
`how-to-read.gen.ts`).

- The bot username lives in the design (`bot.username`, optional, stored without the @, also in
  spec.json and design.md): start links in the form, the export's design.md and HOW-TO-READ all name
  the bot, and an optional field keeps format version 1.
- A start point's title (and its ID name until fixed) follows its trigger while it is the one the
  trigger gave it, inside `steps.set`: a command typed as "help" turns "Command" into "/help", and
  one transaction keeps the title, the ID name and the trigger together for undo.

**LANG-01** (8e24885, c1b4a03).

Code: `copiedTexts` in the model (`packages/spec/src/model/design.ts`) and `meta.copiedTexts` in Yjs
(`ydoc/read.ts`, `ydoc/new.ts`); `TextAt`, `textKey`, `textFingerprint`, `isCopiedText`,
`pruneCopied` and `texts.copyDefault` in `ydoc/texts.ts` (`setPlain` drops its text's mark);
`languages.remove` and `tidy` drop stale marks; `variableSteps(design)` in `checks/check.ts`.

- The copies are listed in `meta.copiedTexts`, a key per text and language with a fingerprint of the
  words copied; a text shows as copied only while its words still match. TipTap writes rich texts
  straight into their fragments (the phone, the popover, another person), so no accessor sees every
  edit, and comparing the words ends the mark however the text changes.
- Stale marks are dropped by `tidy`, by the next copy and by removing a language, and `setPlain`
  drops its own.
- The copied marks stay out of the export: spec.json describes the bot, and a copy is the designers'
  working state.
- Built-in variables show no test value: SPEC-04's accessors refuse to change them.

**PARTS-01** (7587284).

Code: `parts.fromButtons(stepId, name)` in `packages/spec/src/ydoc/parts.ts`; BTN-01's
`phone/keyboard/KeyboardRows.tsx` takes `at` (a step or a part, SPEC-04's `KeyboardAt`).

- "Make a part from its buttons" is a spec accessor, `parts.fromButtons`, that moves the box's own
  button rows into the new part: the buttons keep their IDs, texts and arrows in one transaction,
  and the web app never writes Yjs.
- A part made from a box takes the box's own rows only; rows that already place a part stay in the
  keyboard, because parts do not nest (a row part's rows hold button IDs).
- A text part placed in another text part is listed in "Uses" without "Detach": SPEC-04's `detach`
  works on a step; deleting the part still writes its text there.

## As built (M5)

**TRY-01** (3c56378).

Code: State and API types: `packages/spec/src/sim/types.ts` (`SimState`, `Sim`, chat entries,
keyboards, delay, choice, path, test user); The engine: `packages/spec/src/sim/engine.ts`
(`createSim`, `defaultSimUser`, `simStartPoints`, the run loop and every action); Texts for the
tester: `packages/spec/src/sim/texts.ts` (language fallback, variables, text parts, content, inline
and bottom keyboards); Variables, "If" conditions and remember actions:
`packages/spec/src/sim/values.ts`; Question answers, checks, cancel words and test values:
`packages/spec/src/sim/answers.ts` (`SIM_TEST_VALUES`); Exports: `packages/spec/src/sim/index.ts`,
one block at the end of `packages/spec/src/index.ts`.

- `createSim(design, testUser)` returns `{ initial, start, pressInline, pressReply, sendText,
  sendMedia, sharePhone, shareLocation, pickUsers, pickChat, createPoll, choose, skipWait,
  dismissPopup }`. Each action takes the state first and returns a new state, or the same object
  when it does not apply (a button no longer shown, a disabled button, anything but `choose` while
  an "If" or a developer step waits for a choice). `defaultSimUser(design)` gives the default
  language and every switch's test value. `simStartPoints(design)` lists the "Start from" picker:
  /start, the other commands, the start links as `/start <payload>`, then "A message the bot does
  not expect".
- The test user is `{ language, switches, builtins }`, the built-ins by ID name (`first_name`,
  `last_name`, `username`, `user_id`, `is_premium`); the `language` built-in takes the test
  language. Built-ins seed `vars` at the start, else their test value.
- `vars` holds the values set while trying (null once cleared). A variable is read from `vars`, else
  its test value. In "If" a variable with neither is empty, except one a developer step sets, which
  cannot be decided; a variable used as the compared value with neither cannot be decided either.
- An "If" takes the first true case. When a case before it cannot be decided, the card offers only
  the ways still possible: the undecided cases, then the first true case or "Otherwise". "Is a
  member of @chat" is decided by a yes/no test switch whose label names the chat ("Member of
  @shop"), else asked.
- Choice cards carry their text in `prompt`: "Which way?", "The developer does: <description>. What
  happened?" (a developer step without outcomes offers "Done"), "Waiting 2 hours" with the option
  "Skip the wait".
- A message or a question's prompt with `delaySec` or `chatAction` is held back as `delay`
  (`seconds` of nothing, then `chatAction` for its seconds, then the message): the UI waits and
  calls `skipWait()`, or calls it at once for "Skip waits". `skipWait()` also skips a wait step. Any
  tester action first sends a held-back message.
- A wait with `ifUserActs: cancel` is dropped when the tester acts; with `keep` it comes back after
  the action, unless that action opened another choice (then it is dropped and logged).
- The loop guard counts the steps since the tester last acted: sending a held-back message and
  skipping a wait do not reset it; choosing a way or an outcome does.
- Edit follows the design as drawn (08 section 4): the clicked message's entry keeps its ID and
  takes the new step, content and inline keyboard with `edited: true`; a reply keyboard on an edited
  message still applies. `replace` marks the clicked entry `deleted` and appends. Only the first
  message of a run uses the button's `show`; the ones after it are new.
- Bottom keyboard: a reply keyboard stays until `removeReply` or another reply keyboard; a one-time
  keyboard gets `collapsed: true` once used. `forceReply` and `openReplyField` open a force reply on
  that message, which the next user message answers (`replyTo`). The placeholder is the force
  reply's, else the keyboard's.
- What a sent message does, in order: a typed command starts its start point (`/start ref_123` the
  exact start link, else the longest prefix, else /start); a bottom-keyboard button (pressed, or its
  label typed) with a target goes there after its remember actions or saveTo; then the waiting
  question takes it; then the fallback start point whose `accepts` fits; else "Nothing happens
  next". A button with remember or saveTo and no target does not fall to the fallback.
- Answers: `text` and `any` take text with the length and pattern checks (length in code points);
  `number` takes a number (Persian and Arabic digits too) with min, max and whole number; `email`,
  `phone` (typed digits or a shared contact) and `location` (a shared location) as named; the file
  kinds take a test file of that kind, which always meets `maxFileMb` and `fileTypes` (named
  `test_<kind>.<first file type>`). Cancel words match in any language, comma separated, ignoring
  case. A wrong answer adds the wrong-answer message, counts the try and at `maxTries` goes to
  `afterMaxTries`.
- Test values (`SIM_TEST_VALUES`): phone +12025550100, location 48.8584, 2.2945, user ID 1000001,
  chat ID -1001000000001, poll "Test poll". A share or pick button's `saveTo` gets the phone,
  "latitude, longitude", the ID or the poll question. The share and pick actions take an optional
  button ID; without one they send from the attachment menu.
- The back history holds the message and question steps shown; `back` goes to the last message step
  before the current one, past questions.
- A waiting question is dropped when a run goes elsewhere (a button with a target, a command); a
  `stay` button keeps it.
- A message without "Then" and without buttons logs "Nothing happens next"; with buttons it waits.
- Inline url, login and copy buttons only log what they do ("Opened the link ...", "Copied ...").
- Texts: a rich text takes the tester's language, else the default, else an empty document. Variable
  nodes become text nodes with their marks (yes/no as "yes" or "no", unknown as `{idName}`, empty
  values drop out). A text part's blocks are expanded inline, joined by line breaks, with the part
  node's marks added (code blocks get a code mark). Plain texts (labels, popups, URLs, placeholders)
  fill `{idName}`.

**CHK-01** (8df89ba, e7d3b57).

Code: Yjs: `packages/spec/src/ydoc/checks.ts` (`checkEdits`: `checks.ignore(issue)`,
`checks.stopIgnoring(issue)` on `meta.ignoredChecks`), `edits.checks` in
`packages/spec/src/ydoc/edits.ts`, the read in `readHeader` of `packages/spec/src/ydoc/read.ts`
(readDesign and watchDesign), the write in `docFromDesign` (`packages/spec/src/ydoc/new.ts`), the
export line in `packages/spec/src/index.ts`.

- Yjs: `meta.ignoredChecks` is a Y.Array of `issueKey` keys; `readDesign` gives them as
  `ignoredChecks` (duplicates dropped, left out when empty), `docFromDesign` writes them. design.md
  marks the ignored issues (EXP-01's "(ignored here)"); spec.json's `checks` carry `ignored: true`
  for them (e7d3b57).

**CHK-01 follow-up** (e7d3b57).

- `SpecCheckSchema` has an optional `ignored` boolean (`packages/spec/src/export/schema.ts`,
  `to-spec.ts`, the generated `schema/bot-spec.v1.schema.json`): spec.json's `checks` carry
  `ignored: true` for a warning or good-to-know marked "Ignore here", and HOW-TO-READ says so (build
  as designed). The format stays version 1.

## As built (M7)

**MSG-02** (42ccafc).

Code:

- Model: `poll`, `quiz`, `dice`, `paidMedia` content kinds and `DiceEmoji`:
  `packages/spec/src/model/content.ts`.
- Yjs: rich text, plain text and option walkers (`pollOf`): `packages/spec/src/ydoc/refs.ts`; option
  texts as a `PlainTextAt`: `packages/spec/src/ydoc/texts.ts` (no layout change, LAYOUT stays 1).
- Checks: E20, E21, E22 in `packages/spec/src/checks/content.ts` (codes in `issues.ts`, run from
  `check.ts`); question, explanation and options in `context.ts`, `texts.ts`, `languages.ts`,
  `keyboards.ts` (E05 for paid media), `notes.ts` (I03 for dice).
- Export: `packages/spec/src/export/schema.ts`, `to-spec.ts`, `from-spec.ts`, `telegram.ts`
  (`params`); JSON Schema `packages/spec/schema/bot-spec.v1.schema.json`; readable doc
  `packages/spec/src/markdown/to-markdown.ts`; guide `packages/spec/docs/HOW-TO-READ.md` (and its
  generated module).
- Try it: `packages/spec/src/sim/types.ts`, `texts.ts`, `engine.ts` (`vote`, `pay`, dice roll).
- Fixture: Favorite roast, Coffee quiz, Lucky roll, Secret recipe in
  `packages/spec/fixtures/coffee-shop.ts`.

As built:

- Content: `poll` and `quiz` share `question` (rich text), `options` (plain texts per language),
  `anonymous`, `multiple`, and the optional `revote`, `shuffle`, `hideResults` (Bot API 9.6; left
  out: Telegram's default), `closeAfterSec` (open_period) and `closeAt` (close_date, a Unix time). A
  poll also has the optional `addOptions` (users add options); a quiz has `correct: number[]`
  (0-based indexes of the right options, several since Bot API 9.6) and an optional `explanation`
  (rich text). `dice` has `emoji` (🎲 🎯 🏀 ⚽ 🎳 🎰). `paidMedia` has `items: { media: MediaSlot }[]`
  (objects like an album's items), `stars`, an optional `caption` and `captionAbove`. No checklist
  (D-36).
- Yjs: no new layout. Options are a Y.Array of Y.Map per language, `correct` a Y.Array of numbers,
  the question and explanation text IDs in `texts`. The walkers know the new fields: rich texts
  (question, explanation, paid media caption), plain texts (each option, so removing a language
  clears them) and media slots (paid media items, as album items). `PlainTextAt` has `{ step, field:
  'option', option: index }` (copiedTexts key `step.<id>.option.<n>:<lang>`); options are added,
  moved and removed with the whole content through `steps.set`.
- Checks: E20: a question empty in the default language or over 300 characters in a language, fewer
  than 1 or more than 12 options, an option empty in the default language or over 100 characters, an
  explanation over 200 characters or with more than 2 line breaks, closing both after a time and at
  a date, an open period that is not a whole number from 5 to 2628000 seconds, users adding options
  to an anonymous poll. E21: a quiz with no right option, or with right options past its last
  option. E22: Stars not a whole number from 1 to 25000, fewer than 1 or more than 10 items, items
  of a kind paid media does not take (photos, videos and live photos only). W03 also reports a
  question or option missing in a language (both needed in every language) and a missing explanation
  where the default language has one; E01 and E02 leave questions and explanations to E20; variables
  in option texts count as uses (W04); E05 lets paid media change only its caption and buttons (same
  items and price); I03 on a dice message says Telegram deletes it only after 24 hours.
- Export: `message` holds the new kinds as the model has them, texts as rich texts (question,
  explanation, caption), options as plain texts, paid media items as `{ media }` (placeholders
  `<step>_media_<n>` with kind null). A step's `telegram` gains the optional `params`, by Bot API
  name: polls and quizzes `type` (`regular` or `quiz`), `is_anonymous`, `allows_multiple_answers`,
  `allows_revoting`, `shuffle_options`, `allow_adding_options`, `hide_results_until_closes`,
  `correct_option_ids` (sorted), `open_period`, `close_date`; dice `emoji`; paid media `star_count`,
  `show_caption_above_media` (fields the design leaves out are left out). `parseMode` is "HTML" for
  polls and quizzes. fromSpec reads them back.
- design.md: "Poll with 3 options", "Dice 🎲", "Paid media of 2 items"; a poll's settings in words,
  the question per language, the options as a table per language (a quiz adds "Right answer"), the
  explanation; dice and paid media in a line; "Then: goes to ... once the user votes" for polls and
  quizzes; "Paid media item" in the media list.
- HOW-TO-READ.md: rows "Poll, quiz", "Quiz answer and explanation", "Dice", "Paid media" (send the
  step's ID name as `payload` to get `purchased_paid_media`); section 5 "Polls and quizzes": the
  `next` arrow runs once the user votes (`poll_answer`, or a `poll` update for an anonymous poll);
  section 6: polls, quizzes and dice change only their buttons, paid media its caption and buttons.
- Try it: a poll or quiz message with "Then" stops ("<step> waits for a vote") and goes on after the
  tester's first vote (`vote(state, entryId, options)`); a vote is refused when it does not fit (no
  option, an index out of range, several without `multiple`) and a second one unless revoting is
  allowed (`revote`, else Telegram's default: polls yes, quizzes no). A quiz answered wrong shows
  its explanation as a toast. A dice rolls when shown: the test user's `dice` value when it fits the
  emoji, else a random one ("The 🎲 rolled 4"). Paid media shows with `paid: false` until `pay(state,
  entryId)` ("Paid 50 Stars (test): the paid media is unlocked"). `SimBotEntry` has `vote?`, `dice?`
  and `paid?`; `SimContent` gives a poll's or quiz's options as texts in the tester's language.
- Fixture: the Coffee shop's "Call us" has a "Coffee fun" button to Favorite roast (poll, not
  anonymous, shuffled, open a day), then Coffee quiz (quiz with an explanation), Lucky roll (🎲),
  Secret recipe (paid media, two placeholders, 50 Stars, a Main menu button); the café section is
  taller.

**MSG-03** (3a9dbc4).

Code:

- Saving a vote or a roll (lead decision): `saveTo` in `packages/spec/src/model/content.ts`; checks
  `checks/context.ts` (sets the variable), `checks/content.ts` and `issues.ts` (E27); export
  `export/schema.ts`, `to-spec.ts`, `from-spec.ts`, `telegram.ts` (`telegram.saveFrom`),
  `markdown/to-markdown.ts`, `docs/HOW-TO-READ.md` (and its generated module), JSON Schema
  `schema/bot-spec.v1.schema.json`; engine `sim/engine.ts` (`saveVote`, the roll in `show`).

As built: a poll saves the chosen option's text in the default language (several joined with ", "), a
quiz yes when the answer is right, else no, a dice the number rolled. E27: an anonymous poll or quiz
that saves the vote ("... does not tell the bot who voted. Turn off anonymous voting or stop saving
the vote."). The export writes `saveTo` (the variable's ID name) in the message and
`telegram.saveFrom`: `poll_answer.option_ids` or `result.dice.value`; design.md says "Saves the vote
as" or "Saves the roll as". The editor side is in 04 (As built (M7)).

**RICH-01** (e736ff2).

Code:

- Model: content kind `rich` with `RichMessageBlock` (paragraph, footer, heading, code, quote, list,
  table, details, divider, media, buttons) in `packages/spec/src/model/content.ts`; message option
  `draft` in `model/options.ts`.
- Yjs walkers: block texts, media blocks and button blocks in `packages/spec/src/ydoc/refs.ts`; copy
  and paste of the buttons inside in `ydoc/map.ts`.
- Checks: E28 in `packages/spec/src/checks/content.ts` (code in `issues.ts`); block text slots,
  `blockTexts`, `richRows`, rich media in `mediaSlots` in `checks/context.ts`; `texts.ts` leaves
  block texts to E28; `flow.ts` counts the buttons inside for W10.
- Export: `export/schema.ts` (`SpecRichBlockSchema`, the content schema moved below the buttons,
  `telegram.draftMethod`), `to-spec.ts`, `from-spec.ts`, `telegram.ts` (`is_rtl`, the draft method,
  `Shown.options`); JSON Schema `schema/bot-spec.v1.schema.json`; design.md
  `markdown/to-markdown.ts`; HOW-TO-READ.md (and its generated module).
- Try it engine: `sim/types.ts` (`SimRichBlock`), `sim/texts.ts` (`simBlock`), `sim/engine.ts` (a
  press on a button inside), `sim/index.ts`.

As built:

- Content: `{ type: 'rich'; blocks: RichMessageBlock[]; rtl?: boolean }`. A block is one of:
  `paragraph` and `footer` (`text`), `heading` (`text`, `size` 1 to 6), `code` (`text`,
  `language?`), `quote` (`text`, `credit?`, `expandable?`), `list` (`ordered`, `items: { text;
  checked? }[]`, `checked` gives an item a checkbox), `table` (`rows: { cells: { text; header? }[]
  }[]`, `caption?`, `bordered?`, `striped?`, `compact?`), `details` (`summary`, `text`, `open?`),
  `divider`, `media` (`media: MediaSlot`, `caption?`, `spoiler?`; the file's kind picks photo,
  video, GIF, audio, voice note or file), `buttons` (`ids` of inline buttons of the design,
  `align?`). Every text is a rich text in the texts map. Blocks are one level deep: a quote, a
  details block, a list item and a table cell hold one text each (sent as a paragraph inside).
- Message option `draft` ("Write it out like a draft"): text and rich messages only; the editor
  offers it there and a kind change to another kind drops it.
- Checks: E28 (error): a rich message without blocks, over 500 blocks (list items and the paragraph
  in each, table rows, the paragraph in a quote or details block counted), over 32768 characters in
  a language (all its texts together), over 50 media, media of a kind it does not take (live photos,
  round videos, stickers), a table over 20 columns or without cells, a list without items, a heading
  size outside 1 to 6, a button row inside with fewer than 1 or more than 8 buttons or with bottom
  keyboard buttons. W03 reports a block's text missing in a language ("block 2"); E01 leaves block
  texts to E28; variables in block texts count as uses; the buttons inside count for W10 and for the
  button checks, flows and arrows like a keyboard's.
- Export: `message` holds the blocks as the model has them, each text as a rich text, a media
  block's file as `media` (placeholders `<step>_media_<n>`, n the block's number), a button block's
  buttons in full (`buttons`, with their `telegram` block). `telegram.method` is sendRichMessage,
  `parseMode` "HTML", `params.is_rtl` when right to left; `telegram.draftMethod` is sendMessageDraft
  or sendRichMessageDraft when the message is written out like a draft. fromSpec reads them back.
- design.md: "Rich message of 4 blocks"; each block as "Block 2: Heading, size 2" with its texts per
  language, a list's items, a table per language, a details block's title and text, a media block's
  file, a button row's buttons table; the option "written out like a draft first"; "Rich message
  media" in the media list.
- HOW-TO-READ.md: rows "Rich message" (the InputRichBlock mapping and the limits), "Buttons inside a
  rich message" and "Write it out like a draft" (same non-zero draft_id, then the complete message
  within 30 seconds); section 6: a rich message into a rich message with editMessageText and
  rich_message.
- Try it: a rich message is one message; its texts resolve like a text's; a press on a button inside
  goes through the engine like a keyboard press (`pressInline`). A message written out like a draft
  (text or rich) appears as it is written over 1.5 seconds (a text's characters without formatting,
  a rich message's blocks one by one), then whole; "Skip waits" shows it at once.

**RICH-02** (3f93124).

Code:

- Model: `options.draftStop` (can_stop) and `options.draftKeep` (keep_on_stop) in
  `packages/spec/src/model/options.ts`; the message step's `onStop` with `draftStops` and
  `stopTarget` in `model/steps.ts`.
- Accessors: `KeyboardAt` `{ rich: stepId }` (the button rows inside a rich message) in
  `ydoc/buttons.ts`; the arrow `onStop` in `ydoc/steps.ts` (`connect`), `ydoc/refs.ts`
  (`forEachArrow`) and `ydoc/map.ts` (paste); Duplicate copies a rich message's buttons inside
  (`ydoc/steps.ts`).
- Checks, export, design.md: the stop arrow in `checks/context.ts` (`stepTargets`),
  `export/to-spec.ts`, `from-spec.ts`, `schema.ts` (`onStop`, `telegram.draftStop`), `telegram.ts`,
  `compare.ts`, `markdown/map.ts`, `markdown/to-markdown.ts`; HOW-TO-READ row "Stopping a draft";
  the JSON Schema.
- Try it engine: `sim/types.ts` (`SimWriting`, `SimState.writing`, `SimBotEntry.stopped`,
  `Sim.stopDraft`), `sim/engine.ts` (`written`, `stopDraft`, `goesOn`, `applyKeyboard`).

As built:

- Try it: a press on a button inside a rich message works like an inline keyboard's
  (`ChatPresses.inside(row, line, button)`, the line counted among the message's button rows).
- Drafts: options `draftStop` ("Let the user stop it", can_stop) and `draftKeep` ("Keep what was
  written", keep_on_stop), the message step's arrow `onStop` ("If the user stops it", the update
  stopped_message_generation). A message can be stopped only as a message step with a text or rich
  message written out like a draft (`draftStops`); `onStop` counts only then. In Options under
  "Write it out like a draft" (message steps): "Let the user stop it", then "Keep what was written"
  and "If the user stops it" (a step picker, "Go on to another step when the user stops it.").
  Turning the draft or its stop off, or a kind without a draft method, clears them and the arrow.
  The message box gets the dot "If the user stops it".
- Export: `onStop` on a message step that can be stopped (null without an arrow),
  `telegram.draftStop` `{ can_stop: true, keep_on_stop, update: "stopped_message_generation" }`, the
  options `draftStop` and `draftKeep`. design.md: "the user can stop the draft (`can_stop`), which
  then stays a while (`keep_on_stop`)" among the options, "**If the user stops it:** goes to ...
  once `stopped_message_generation` arrives (instead of sending the complete message).", and the
  map's arrow "If the user stops it". HOW-TO-READ: the row "Stopping a draft" (can_stop and
  keep_on_stop with every draft, stopped_message_generation in allowed_updates, no complete message,
  then `onStop`; a kept draft still disappears after a while).
- Try it: a draft with a stop button shows without its keyboard while it is written, with a "Stop"
  card over the chat; once written it goes out whole (its keyboard, then "Then"). "Stop" leaves what
  was written with "Keep what was written" (its buttons do nothing), else removes it, and goes to
  "If the user stops it". It always comes as a new message. Any other action of the tester first
  sends it whole; "Skip waits" sends it at once. While any draft is written its keyboard is hidden.

**PAY-01** (872f8a6).

Code:

- Model: the invoice step (`InvoiceStep`) and the action step with the refund (`ActionStep`):
  `packages/spec/src/model/steps.ts`; the invoice's fields (`Invoice`, `Price`, `ShippingOption`,
  `Physical`, `Checkout`): `packages/spec/src/model/invoice.ts`; `Action`:
  `packages/spec/src/model/actions.ts`; the pay button (`{ type: 'pay' }`): `model/buttons.ts`;
  start points `paymentDone` and `refunded`: `model/triggers.ts`; conditions `hasPaid` and
  `subscribed`: `model/conditions.ts`.
- Yjs: new invoice and action steps (`newFields`, with the pay button), titles "Invoice", "Action",
  "Payment done", "Refund": `packages/spec/src/ydoc/steps.ts`; invoice texts as `PlainTextAt`:
  `ydoc/texts.ts`; walkers (plain texts, the invoice photo, clearing invoice references when a step
  is deleted): `ydoc/refs.ts`; copy and paste: `ydoc/map.ts`; keyboard type of an invoice:
  `ydoc/buttons.ts`. No layout change, LAYOUT stays 1.
- Checks: E23, E24, E25 in `packages/spec/src/checks/payments.ts` (codes in `issues.ts`, run from
  `check.ts`); `ButtonStep` (a sending step or an invoice) in `context.ts`, used by `keyboards.ts`
  (E03, E05 with the invoice kind of the edit matrix), `notes.ts`, `texts.ts` (W08); `flow.ts` (W02
  "paid" and a refund without invoice, W07 for the pre-checkout check); `languages.ts` (W03 for
  invoice texts).
- Export: `packages/spec/src/export/schema.ts` (`SpecInvoiceStep`, `SpecActionStep`, `Invoice`
  definition, pay action, payment triggers, `hasPaid` and `subscribed` items), `to-spec.ts`,
  `from-spec.ts`, `compare.ts`, `telegram.ts` (`invoiceTelegram`, start point updates, pay button,
  clicks into an invoice); JSON Schema `packages/spec/schema/bot-spec.v1.schema.json`; readable doc
  `packages/spec/src/markdown/to-markdown.ts`, `map.ts`, `say.ts`; guide
  `packages/spec/docs/HOW-TO-READ.md` (and its generated module).
- Try it: `packages/spec/src/sim/types.ts` (`SimInvoice`, `SimShippingOption`, `SimPayment`,
  `SimPayments`, choice kind `checkout`), `texts.ts` (`simInvoice`), `values.ts` (`hasPaid`,
  `subscribed`), `engine.ts` (`pay`, `cancelPayment`, the refund).
- Fixture: `/shop`, Club member?, Club card, Coffee club (Stars subscription), Hazel beans (card,
  physical, flexible shipping, pre-checkout check), Refund the club, and the start points Club
  renewed and Club refunded in `packages/spec/fixtures/coffee-shop.ts`.

As built:

- Step `invoice`: `invoice` (`title` and `description` as plain texts per language, `photo?` a media
  slot, `currency` `XTR` or a card code, `prices: { label: LangText; amount }[]` in the smallest
  unit, `subscription?: { periodDays }`, `physical?: { needName, needPhone, needEmail, needAddress,
  flexibleShipping, shippingOptions: { id, title: LangText, amount }[] }`, `payload?`: left out, the
  ID name), `keyboard` (inline or null: Telegram's own pay button), `options`, `checkout?: {
  description, refuse: LangText }` (left out: always ok), `next` (the "Paid" arrow). The plan's
  title and description sit under `invoice` because `title` is the box's name; "digital or physical"
  is whether `physical` is set (physical goods or a service outside the app stores). A shipping
  option has one price, labeled with its title.
- Step `action` with `action: { type: 'refund'; invoice?: StepId }` and `next`; EVT-01 adds the
  other kinds to `ActionSchema`.
- Start points `paymentDone` and `refunded` with `invoice?` (left out: any invoice). "Payment done"
  takes the payments the invoice's "Paid" arrow does not: a subscription paid again, or the first
  payment of an invoice without "Paid".
- Conditions `{ hasPaid: StepId }` (paid and not refunded) and `{ subscribed: StepId }`. Deleting an
  invoice clears the `invoice` of start points and refunds and removes the If items about it; a
  paste drops the items whose invoice is neither pasted nor in the design.
- A new invoice has one price of 1 Star and a pay button "Pay" (`btn_pay`) as its keyboard.
  `PlainTextAt` adds `invoiceTitle`, `invoiceDescription`, `refuse`, `{ field: 'price', price }` and
  `{ field: 'shipping', option }` (copiedTexts keys `step.<id>.price.<n>:<lang>`,
  `step.<id>.shipping.<n>:<lang>`).
- Checks: E23: title or description empty in the default language or too long (32, 255), payload
  outside 1 to 128 bytes, a currency that is neither XTR nor three capital letters, no price, more
  than one price line in Stars, an amount that is not whole, a total of nothing, a price label,
  shipping option title or refusal message empty in the default language, flexible shipping without
  options, a keyboard that is not inline, a first button that is not the pay button, a second pay
  button, a pay button on anything but an invoice. E24: digital goods in a card currency; physical
  goods in Stars that ask for a name, phone, email, address or flexible shipping (Telegram ignores
  them). E25: a subscription not in Stars, not every 30 days, or outside 1 to 10000 Stars. W02: an
  invoice without "Paid" that no "Payment done" start point takes; a refund without an invoice. W07:
  a pre-checkout check without a description. W03: invoice texts missing in a language. E05 knows
  invoices (the edit matrix: only their buttons change; nothing is edited into an invoice).
- Export: `steps[]` of kind `invoice` with `invoice` (the `Invoice` definition: plain texts, `photo`
  a media id, `payload` always written, shipping options with the id `<step>_shipping_<n>`),
  `keyboard`, `options`, `checkout` (null: always ok), `next`, and `telegram` with `method`
  (`sendInvoice`, or `createInvoiceLink` for a subscription), `params` (`currency`, the `need_*`
  fields and `is_flexible` for physical goods by card, `subscription_period`) and `payment` (the
  updates and answers in order). Kind `action` with `action: { type: 'refund', invoice }` and
  `telegram.method` `refundStarPayment`. Triggers `paymentDone` and `refunded` with `invoice` (null:
  any), updates `message.successful_payment` and `message.refunded_payment`. The pay button is
  `does.type: "pay"` (field `pay`). fromSpec drops a payload equal to the ID name.
- design.md: "An invoice: asks the user to pay ⭐️250 ...", the titles and descriptions per language,
  currency, digital or physical, photo, subscription, payload, the price lines, what the payment
  sheet asks for, the shipping options, Telegram's own pay button when there is no keyboard, the
  pre-checkout check with "OK" and "Refuse", "Paid"; the refund in a line; the payment start points
  in words; "the user has paid ..." and "the user's subscription ... is active" in If sentences;
  invoices are trapezoids and actions parallelograms on the map.
- HOW-TO-READ.md: rows "Invoice", "Pay button", "Shipping", "Pre-checkout check", "Paid", "Start
  points Payment done, Refund", "Refund", "Has paid, is subscribed"; section 5 "Invoices"; section
  6: an invoice changes only its buttons and nothing is edited into one.
- Try it: an invoice shows as a new message (`SimInvoice` content: texts in the tester's language,
  price lines, total, what the sheet asks, shipping options) and waits; with no keyboard it gets
  Telegram's own pay button ("Pay ⭐️250"). Its pay button opens the payment sheet (`state.payment`);
  `pay(state, entryId, shippingId?)` is "Pay (test)" (a shipping option is needed with flexible
  shipping), `cancelPayment` is "Cancel". With a pre-checkout check a card asks "The developer
  checks: ... What happened?" with "OK" and "Refuse"; "Refuse" shows the refusal message as an
  alert; "OK" (or no check) marks the invoice paid ("Paid 10.80 USD (test) ..."), records it in
  `state.payments`, and runs "Paid", else a matching "Payment done" start point. The refund marks
  the payment refunded. `hasPaid` and `subscribed` read `state.payments` (a test user starts with
  nothing paid). The payment start points are in "Start from" and send no user message.

## As built (M8)

**EVT-01** (5e3303b).

Code:

- Model: the action kinds react, pin, unpin, delete, gift and chat action beside PAY-01's refund:
  `packages/spec/src/model/actions.ts`; start points `subscriptionChanged`, `userBlocks`,
  `userRestarts`, `broadcast` and `SubscriptionStateSchema`: `model/triggers.ts`; the reminder's
  `stopWhen` on Wait: `model/steps.ts`.
- Yjs: titles "Subscription changed", "User blocks the bot", "User restarts the bot", "Broadcast"
  (`ydoc/steps.ts`); the gift's rich text in `forEachRichSlot`, deleting a step clears an action's
  `step` and `onStep` and drops `hasPaid`/`subscribed` items from reminders and audiences too
  (`conditionMaps`, `clearArrowsInto`): `ydoc/refs.ts`; paste maps `step`, `onStep` (`userMessage`
  kept) and cleans reminder and audience conditions: `ydoc/map.ts`. No layout change, LAYOUT stays
  1.
- Checks: E26, E29, E30, W20, W21, I20, I21 and the gift text's W03 in
  `packages/spec/src/checks/events.ts` (codes in `issues.ts`, run from `check.ts`); W02 for actions
  without their message and W07 for a gift without a description in `flow.ts`; `conditionsOf` and
  `stepTargets` exported, variables used in reminders, audiences and gift texts counted in
  `context.ts`.
- Export: `packages/spec/src/export/schema.ts` (new triggers, `telegram.status`, `stopWhen`, the
  action kinds, action `telegram.params`), `to-spec.ts`, `from-spec.ts`, `compare.ts`, `telegram.ts`
  (`startTelegram` cases, `actionTelegram`); JSON Schema
  `packages/spec/schema/bot-spec.v1.schema.json`; design.md
  `packages/spec/src/markdown/to-markdown.ts`; guide `packages/spec/docs/HOW-TO-READ.md` (and its
  generated module).
- Try it: `packages/spec/src/sim/types.ts` (`SimGift`, `SimReaction`, `blocked`, `pinned`, the wait
  choice's `stopWhen`, `blockBot`, `restartBot`), `sim/engine.ts`, `sim/index.ts`.
- Fixture: Like the feedback, Club renewal failed, Beans in the cart with Remind in 1 hour and Still
  want the beans?, New roast news (switch "Wants news") with Pin, Unpin and Delete the news, User
  left, User came back with Typing and Welcome gift in `packages/spec/fixtures/coffee-shop.ts`;
  "Club member?" now sends non-members to Beans in the cart.
- `packages/spec/src/index.ts`: `actionTelegram` and `conditionsOf` appended.

As built:

- Action step kinds: `{ type: 'react'; emoji; onStep?: StepId | 'userMessage'; big? }`, `{ type:
  'pin'; step? }`, `{ type: 'unpin'; step? }` (left out: the newest pinned message), `{ type:
  'delete'; step? }`, `{ type: 'gift'; giftDescription; text?: RichTextRef; payForUpgrade? }`, `{
  type: 'chatAction'; action: ChatAction }`, `{ type: 'refund'; invoice? }`. A step an action names
  is a message, question or invoice; the action acts on the message that step sent this user last.
  No "silent" on pin. A new action is still PAY-01's refund.
- Start points: `{ type: 'subscriptionChanged'; invoice?; state?: 'canceled' | 'active' | 'failed'
  }` (the update `subscription`, Bot API 10.2; left out: any invoice, any state), `{ type:
  'userBlocks' }`, `{ type: 'userRestarts' }` (my_chat_member, status kicked or member), `{ type:
  'broadcast'; audience: 'everyone' | Condition; when: string }` (`when` in words; the developer
  schedules it). No "User reacts" (D-36). Titles: "Subscription changed", "User blocks the bot",
  "User restarts the bot", "Broadcast".
- Reminder: Wait's optional `stopWhen: Condition`, used with `ifUserActs: 'cancel'` ("Stop
  waiting"): the wait is dropped only once the condition holds, checked each time the user does
  something and when the time is up; without it "Stop waiting" drops the wait at any action as
  before.
- Checks: E26 a gift text over 128 characters in a language; E29 a reaction that is not one of
  Telegram's reaction emoji, a reaction, pin, unpin or delete on a step that sends no message,
  "Subscription changed" for an invoice that is not a subscription; E30 a message, question, invoice
  or chat action reached after "User blocks the bot" (through logic boxes and other actions); W20 a
  broadcast whose audience condition has no items or whose `when` is empty; W21 a wait longer than
  an hour; I20 a refund action or "Refund" start point of an invoice paid by card; I21 on every
  broadcast (about 30 messages per second, 1000 with paid broadcasts); W02 a reaction, pin or delete
  without its message; W07 a gift without a description; W03 a gift text missing in a language where
  the default has one. Variables in reminders, audiences and gift texts count as uses (W04).
- Export: triggers as the model has them (`invoice`, `state` null when left out; the audience as a
  `Condition` with ID names), start point `telegram.update` `["subscription"]`, `["my_chat_member"]`
  or `[]` for a broadcast, with the new optional `telegram.status` (`kicked`, `member`, or the
  subscription state); Wait's optional `stopWhen`; action kinds with `step`, `onStep`
  (`"userMessage"` or an ID name) and `invoice` as ID names (null: none yet), the gift text as a
  text in every language; action `telegram.method` from `ACTION_METHODS` and `telegram.params` by
  Bot API name: `reaction` (`[{ type: "emoji", emoji }]`) and `is_big`, `pay_for_upgrade`, `action`.
- design.md: the new start points in words ("The user blocks the bot (`my_chat_member`, status
  `kicked`)...", "The bot writes first to the users for whom test switch wants_news is yes ... When:
  ..."); actions "An action: pins a message (`pinChatMessage`), then goes on." with the logic
  ("reacts with 👍 to the user's last message", "pins the message New roast (new_roast) sent last",
  "unpins the newest pinned message"), the gift's description, upgrade and text per language; a
  reminder's sentence; test switches used by audiences and reminders listed.
- HOW-TO-READ.md: the step kinds `invoice` and `action`; rows "Start point Subscription changed",
  "Start points User blocks the bot, User restarts the bot", "Broadcast", "Reaction", "Pin, unpin",
  "Delete", "Gift", "Chat action"; per-user state keeps each step's newest `message_id`, the user's
  own and whether they blocked the bot; section 5 paragraphs on reminders, actions and event start
  points (they drop a waiting question, like a command); checklist line on broadcast rates and
  blocked users.
- Try it: an action reacts (`reaction` on the entry), pins and unpins (`state.pinned`, entry IDs in
  the order pinned; unpin without a step takes the pinned message sent last), deletes (the entry
  `deleted`), sends a gift (a bot entry of content `gift`), shows a chat action (a log line) or
  refunds; nothing to act on is a log line. `blockBot(state)` ("User blocks the bot") sets `blocked`
  and runs the "User blocks the bot" start point; while blocked, messages, questions, invoices and
  chat actions are not delivered (the run stops with "... is not delivered: the user blocked the
  bot") and every tester action but `restartBot`, choices, skipping waits and event start points is
  refused. `restartBot(state)` ("User restarts the bot") clears `blocked` and runs that start point.
  "Time passes" is `skipWait`. A reminder comes back after a tester action unless its conditions
  hold ("The reminder stopped waiting: its conditions hold"), and skipping it stops instead of going
  on when they hold. A broadcast from "Start from" skips a test user its audience does not take; one
  it cannot decide gets it. The new start points are in "Start from" after the payment ones and send
  no user message.
