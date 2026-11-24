# 08. Telegram reference (private chats, no Mini Apps)

The Telegram facts xDesign is built on: every designable element and the Bot API it maps to, the
limits the checks use, and what is excluded. Planned from the Bot API as known on 2026-11-23;
**checked by TG-00 on 2026-11-23 against Bot API 10.5 (2026-11-22)**: the corrections and new
features are in section 7, and the full research with sources is
`.dev/s1/research/telegram.md`, which TG-01 turns into the catalog
(`packages/spec/src/telegram/`), where every row carries its source URL and the Bot API version
it was checked against. TG-REFRESH (stage 2) checks them again before the stage 2 release.

## 1. Elements and their Bot API mapping

| xDesign element | Bot API | Stage |
|---|---|---|
| Text message | `sendMessage` (`text`, `entities` or `parse_mode`, `link_preview_options`) | 1 |
| Photo, video, GIF, audio, voice, round video, file, sticker | `sendPhoto`, `sendVideo`, `sendAnimation`, `sendAudio`, `sendVoice`, `sendVideoNote`, `sendDocument`, `sendSticker` | 1 |
| Caption above media, media spoiler | `show_caption_above_media`, `has_spoiler` | 1 |
| Album | `sendMediaGroup` (no reply markup) | 1 |
| Location (and live location), venue, contact | `sendLocation` (`live_period`), `sendVenue`, `sendContact` | 1 |
| Silent, protected | `disable_notification`, `protect_content` | 1 |
| Message effect | `message_effect_id` (private chats only) | 1 |
| "typing..." and other chat actions | `sendChatAction` | 1 |
| Inline keyboard | `InlineKeyboardMarkup`, `InlineKeyboardButton` (`callback_data`, `url`, `copy_text`, `login_url`, `pay`) | 1 (pay: 2) |
| Button look and icon | `style` (`primary`, `success`, `danger`), `icon_custom_emoji_id` (Bot API 9.4) on inline and reply buttons | 1 |
| Bottom keyboard | `ReplyKeyboardMarkup` (`is_persistent`, `resize_keyboard`, `one_time_keyboard`, `input_field_placeholder`), `KeyboardButton` (`request_contact`, `request_location`, `request_users`, `request_chat`, `request_poll`) | 1 |
| Remove keyboard, force reply | `ReplyKeyboardRemove`, `ForceReply` (`input_field_placeholder`) | 1 |
| Click answer, toast, alert | `answerCallbackQuery` (`text`, `show_alert`) | 1 |
| Edit this message | `editMessageText`, `editMessageCaption`, `editMessageMedia`, `editMessageReplyMarkup` | 1 |
| Delete this one and send new | `deleteMessage` then `send*` | 1 |
| Commands menu | `setMyCommands` per `language_code` (scope: all private chats) | 1 |
| Menu button | `setChatMenuButton` (`commands` or `default`; `web_app` excluded) | 1 |
| Bot name, about, description | `setMyName`, `setMyShortDescription`, `setMyDescription` per `language_code` | 1 |
| Profile photo | Set by the owner in BotFather (or the Bot API method for the bot's photo if TG-00 finds one current) | 1 |
| Start links | `/start <payload>` from `t.me/<bot>?start=<payload>` | 1 |
| Questions | Waiting for the next `message` of a type (`text`, `contact`, `location`, `photo`, ...) | 1 |
| Users and chats picked | `users_shared`, `chat_shared` service messages | 1 |
| Poll, quiz | `sendPoll` (`type`, `is_anonymous`, `allows_multiple_answers`, `correct_option_id`, `explanation`, `open_period`) | 2 |
| Dice | `sendDice` | 2 |
| Paid media | `sendPaidMedia` (Stars), if TG-00 confirms private chats | 2 |
| Invoices (Stars and cards) | `sendInvoice` (`currency` `XTR` for Stars, `prices`, `subscription_period`, shipping fields), `answerShippingQuery`, `answerPreCheckoutQuery`, `successful_payment`, `refundStarPayment`, `refunded_payment` | 2 |
| Gifts | `getAvailableGifts`, `sendGift` | 2 |
| Bot sets a reaction | `setMessageReaction` | 2 |
| Pin, unpin | `pinChatMessage`, `unpinChatMessage` | 2 |
| User blocks or restarts the bot | `my_chat_member` (status `kicked` or `member`) | 2 |
| Broadcasts, reminders | Bot-initiated `send*` (rate limits apply; `allow_paid_broadcast` for high volume) | 2 |

## 2. Two items of the owner's list Telegram may not allow (found while planning)

1. **Checklists**: `sendChecklist` takes a `business_connection_id`; checklists are sent only on
   behalf of a connected business account. Business bots are out of scope (01 section 4.3), so
   a normal bot cannot send a checklist to a user. **Planned: dropped from the design kinds
   unless TG-00 finds that normal bots can send them; open question Q-26 to the owner.**
2. **"The user reacts to a bot message"**: the `message_reaction` update needs the bot to be an
   administrator of the chat, which a bot cannot be in a private chat; developers report that no
   reaction updates arrive in private chats. **Planned: the start point "User reacts" is built
   only if TG-00 confirms Telegram delivers it in private chats; open question Q-27.** The bot
   setting its own reaction on the user's message (`setMessageReaction`) stays.

## 3. Limits the checks use (to verify in TG-00)

| Item | Limit as planned |
|---|---|
| Message text | 1 to 4096 characters after entity parsing |
| Caption | 0 to 1024 characters after entity parsing |
| `callback_data` | 1 to 64 bytes (builders' suggested value is the ID name) |
| Popup text (`answerCallbackQuery`) | 0 to 200 characters |
| Copy text | 1 to 256 characters |
| Inline keyboard | at most 8 buttons per row and 100 buttons in all (observed limits, not in the docs) |
| Reply keyboard | to verify (rows, buttons per row) |
| Input field placeholder | 1 to 64 characters |
| Album | 2 to 10 items; photos and videos may mix; documents only with documents; audio only with audio |
| Bot name | 0 to 64 characters |
| Short description ("about") | 0 to 120 characters |
| Description | 0 to 512 characters |
| Command | 1 to 32 characters: lower-case Latin letters, digits, underscores |
| Command description | 1 to 256 characters |
| Start payload | up to 64 characters: `A-Z`, `a-z`, `0-9`, `_`, `-` |
| Pick users (`request_users`) | 1 to 10 users |
| Poll question / option / explanation | 1 to 300 / 1 to 100 / 0 to 200 characters; 2 to 12 options; `open_period` 5 to 600 seconds |
| Dice | 🎲 🎯 🎳 1 to 6; 🏀 ⚽ 1 to 5; 🎰 1 to 64 |
| Invoice title / description / payload | 1 to 32 / 1 to 255 characters / 1 to 128 bytes |
| Stars subscription | period exactly 30 days; price limit to verify |
| Uploads by bots | photos up to 10 MB, other files up to 50 MB; photo width plus height at most 10000, ratio at most 20 |
| Live location period | 60 to 86400 seconds, or "until stopped" |
| Chat action | shown up to 5 seconds or until the next message |
| Deleting a message | only within 48 hours of sending |
| Message effects | the free effects (🔥 👍 👎 ❤️ 🎉 💩) with their IDs; effects work only in private chats |
| Button `style` | shown by Telegram apps released after 2026-02-09; older apps show the default look |
| Custom emoji | in texts only for bots with an extra username bought on Fragment; for button icons the conditions of Bot API 9.4 (to verify) |
| Login link | the domain must be linked to the bot in BotFather (`/setdomain`) |
| Digital goods | must be sold in Stars (`XTR`); cards only for physical goods and services outside the app stores' rules |

The bottom keyboard limits are kept as 8 buttons per row and 100 in all, assumed equal to the
inline ones and unverified. The catalog (`packages/spec/src/telegram/limits.ts`) has every limit
with its source.

## 4. What "Edit this message" can and cannot do

| From \ To | Text | Photo, video, GIF, audio, file | Album | Sticker, location, venue, contact, dice, poll |
|---|---|---|---|---|
| Text | edit text and buttons | not possible: new message | not possible | not possible |
| Photo, video, GIF, audio, file | not possible | edit media, caption and buttons (`editMessageMedia`) | not possible | not possible |
| Album | not possible | not possible (one item can be edited) | not possible | not possible |
| Sticker, location, ... | not possible | not possible | not possible | only the buttons; live location by `editMessageLiveLocation` |

When "Edit this message" is impossible the check E05 says so and offers "Send a new message".
Try it and the export follow the design as drawn; the builders' guide says to fall back to
sending a new message only if the designer chose that.

## 5. Excluded (D-11)

- Mini Apps: `web_app` buttons, the Web App menu button, `answerWebAppQuery`, prepared inline
  messages, home screen shortcuts, emoji status and everything only a Mini App can do.
- Inline mode: `switch_inline_query`, `switch_inline_query_current_chat`,
  `switch_inline_query_chosen_chat`, inline results, `answerInlineQuery`.
- Groups, supergroups, forum topics, channels: their admin methods, join requests, chat member
  management, posting to channels, suggested posts.
- Business bots (connected business accounts), including checklists (section 2) and stories.
- Games (`callback_game`, `sendGame`).

## 6. Stage 2 check rules (as built)

E20 poll and quiz limits (question, options, explanation, closing, users adding options); E21
quiz without a correct option; E22 paid media Stars range, items and their kinds (MSG-02); E23
invoice limits and the pay button first in the first row (and only on invoices); E24 Stars for
digital goods (an invoice without physical goods), and no card fields in Stars; E25 subscription
only in Stars, every 30 days, 1 to 10000 Stars (PAY-01); E26 gift text limit (128 characters)
(EVT-01); E27 an anonymous poll or quiz that saves the vote (MSG-03); E28 rich message limits
(blocks, characters, media and their kinds, table columns, heading sizes, buttons inside)
(RICH-01); E29 an action or event Telegram cannot do and E30 sending after the user blocked the
bot (EVT-01); W20 broadcast without an audience or a time; W21 a wait longer than an hour (the
developer stores it); I20 refunds (and refund updates) only for Stars payments; I21 broadcasts
follow Telegram's rates (EVT-01). The codes are numbered in merge order.

## 7. TG-00 results (2026-11-23, Bot API 10.5)

xDesign targets **Bot API 10.5** (D-35). Corrections to sections 1 to 4 (the catalog has the
final values and sources):

1. Poll options 1 to 12 (not 2 to 12); `open_period` and `close_date` up to 2628000 seconds;
   quizzes take several correct options (`correct_option_ids`) and `allows_multiple_answers`.
2. `subscription_period` (30 days, 1 to 10000 Stars) exists only on `createInvoiceLink`: a
   subscription is offered through an invoice link button, not `sendInvoice`.
3. Custom emoji in texts and as button icons also work in messages a bot sends to private chats
   when the bot's owner has Telegram Premium (besides the Fragment username rule).
4. Dice messages in private chats can be deleted only after more than 24 hours; bots can delete
   incoming messages in private chats.
5. **Editing**: a text message can be edited into media with `editMessageMedia`, and an album
   item into a photo, live photo or video; section 4's table is replaced by the catalog's edit
   matrix (check E05 follows the catalog).
6. The bot's profile photo is set with `setMyProfilePhoto` and removed with
   `removeMyProfilePhoto` (bot setup's photo maps to them).
7. The free message effect IDs are not in the official docs (taken from public bot code; the
   heart effect has two reported IDs: the catalog marks it unverified).
8. Inline and reply keyboard size limits are not documented anywhere official: the catalog
   keeps them as observed limits.
9. `callback_query_mode` (10.5) can make a callback carry `inline_message_id` instead of
   `message`: HOW-TO-READ.md tells builders not to assume `callback_query.message`.
10. Checklists are business-only (`sendChecklist` needs `business_connection_id`) and
    `message_reaction` is not documented for private chats: both dropped (Q-26, Q-27, D-36).
11. Only messages sent without reply markup or with an inline keyboard can be edited
    (api#updating-messages): a message sent with a bottom keyboard, `ReplyKeyboardRemove` or
    `ForceReply` cannot be edited (the catalog's `EDIT_FACTS`).

New private-chat features since 9.4 and where they go:

| Feature | Bot API | Stage |
|---|---|---|
| Live photos (`sendLivePhoto`, in albums, editable, paid media) | 10.0 | 1: content kind "Live photo" |
| Disabled buttons (`InlineKeyboardButton.disabled`) | 10.3 | 1: "Disabled (does nothing)" on an inline button |
| `force_reply` inside inline and reply keyboards | 10.3 | 1: keyboard option "Open the reply field" |
| `date_time` entity | 9.5 | 1: text format "Date and time" |
| Poll additions (several correct answers, revoting, shuffle, users adding options, results hidden until closed, description, media in questions and options) | 9.6, 10.0 | 2: with polls and quizzes |
| Message drafts and streaming (`sendMessageDraft`, `sendRichMessageDraft`, `can_stop`) | 9.5 to 10.3 | 2: message option "Write it out like a draft" (RICH-01, `draft`); "Let the user stop it" (can_stop), "Keep what was written" (keep_on_stop) and the arrow "If the user stops it" (stopped_message_generation) (RICH-02, catalog `DRAFT_STOP`) |
| Rich messages (`sendRichMessage`: blocks, tables, lists, details, buttons inside) | 10.1 to 10.3 | 2: content kind "Rich message" (RICH-01): `rich` with paragraph, footer, heading, code, quote, list, table, details, divider, media (voice notes 10.2, files 10.3) and buttons blocks; catalog `telegram/rich.ts`; buttons inside and a media block's file edited under the phone (RICH-02) |
| Stars subscription state (`BotSubscriptionUpdated`: canceled, active, failed) | 10.2 | 2: start point "Subscription changed" (EVT-01) |

Out of scope: widgets (10.4), guest mode, bot-to-bot messages, managed bots, communities,
ephemeral messages (groups), join request queries, topics in private chats (kept unforbidden in
the model for later), business bots.

## As built (M1)

**TG-01** (dfa201c).

Code: Catalog: `packages/spec/src/telegram/` with `version.ts`, `messages.ts`, `buttons.ts`,
`keyboards.ts`, `entities.ts`, `media.ts`, `limits.ts`, `edit.ts`, `effects.ts`, `chatActions.ts`,
`bot.ts` and `index.ts`; exported as the namespace `telegram` from `packages/spec/src/index.ts`;
Check: `packages/spec/scripts/catalog-check.ts` and `packages/spec/scripts/tsconfig.json`; the
`catalog-check` script of `packages/spec/package.json` runs it with `node`; the root `tsconfig.json`
references the scripts project, so `make typecheck` checks it. `make catalog-check` and `make
sanity` run it through the existing Makefile target.

- Every row has `id`, `source` (https; on core.telegram.org with an anchor), `botApi` ('10.5'),
  `verified`, an optional `note`, and `since` where the feature is newer than Bot API 9.4.
  `version.ts` holds `BOT_API = '10.5'`, `BOT_API_DATE = '2026-11-22'`, `BOT_API_CHANGELOG` and the
  row types. `CATALOG` in `index.ts` names the 22 tables the check reads.
- Tables: `MESSAGE_KINDS` (20 kinds with label, method, caption, buttons `any`/`inline`/`none`,
  spoiler, caption above media, effect, stage) and `DICE`; `BUTTON_KINDS` (inline callback, url,
  copy_text, login_url, pay, disabled; reply text, request_contact, request_location, request_users,
  request_chat, request_poll; each with its Bot API field, sub-fields, limit ids, URL schemes and
  the editor's "When pressed" name), `LOOKS` (style or none, color, label), `BUTTON_RULES`;
  `KEYBOARD_TYPES` (inline, reply, removeReply "Remove the bottom keyboard", forceReply "Force a
  reply"), `KEYBOARD_OPTIONS` (with the editor's names, `force_reply` "Open the reply field" on
  inline and reply keyboards), `KEYBOARD_SIZE_LIMITS`; `ENTITIES` (12 types with Telegram HTML tag,
  rich text mark and label) and `ENTITY_RULES`; `UPLOAD_LIMITS`, `MEDIA_FORMATS`, `ALBUM_GROUPS`,
  `MEDIA_RULES`; `LIMITS`; `EDIT_METHODS`, `EDIT_RULES`, `EDIT_MATRIX`, `EDIT_FACTS`; `EFFECTS`,
  `EFFECT_RULES`; `CHAT_ACTIONS`; `BOT_METHODS`, `COMMAND_SCOPES`, `MENU_BUTTON_TYPES`.
- Lookups: `limit(id)` (typed ids; returns the row with its literal values), `messageKind(id)`,
  `chatAction(id)`, `editRule(from, to)`, `canEditAlbumItem(from, to)`, `albumGroup(kind)`. Types:
  `ContentKind`, `ButtonKind`, `Look`, `KeyboardType`, `EntityType`, `LimitId`, `EditMethod`,
  `EffectId`, `ChatAction`; the ids match SPEC-01's model enums.
- `LIMITS` is one id space: the rows of `limits.ts` plus the keyboard sizes of `keyboards.ts` and
  the upload sizes of `media.ts`. Beyond the plan's list it also has: commands per list (100), quiz
  explanation line feeds (2), poll description (1024), paid media Stars (1 to 25000), items (1 to
  10) and payload (0 to 128 bytes), gift text (0 to 128), live period "until stopped" (0x7FFFFFFF),
  chat rate (1 per second), broadcast rate (about 30 per second), paid broadcast rate (1000 per
  second), button text in a row of two or more (30, check W08, unverified), uploads by URL (5 MB
  photos, 20 MB other, 1 MB voice), photo sides and ratio, live photo video (10 MB, 10 seconds),
  round video length (60 seconds), thumbnails (200 kB, 320 pixels).
- Edit matrix, rules in order (first match): text into text and rich message into rich message with
  editMessageText; text and rich message into each other (unverified); text or rich message into
  photo, live photo, video, GIF, audio or file with editMessageMedia; those six into themselves
  (everything changes) and into each other (unverified); those six into text (not possible,
  unverified); an album only item by item, within its album group (photos, live photos and videos
  mix; audio and files only with their own kind); voice: caption and buttons only; paid media:
  caption and buttons only (unverified); location, poll, quiz, round video, sticker, venue, contact,
  dice, invoice: buttons only (a live location also moves and stops); every other pair: not
  possible.
- A fact TG-00 did not list: "it is currently only possible to edit messages without reply_markup or
  with inline keyboards" (api#updating-messages). A message sent with a bottom keyboard, a keyboard
  removal or a forced reply cannot be edited at all (`EDIT_FACTS` editableMarkup); check E05 needs
  it.
- Chat action labels: "typing...", "sending a photo...", "recording a video...", "sending a
  video...", "recording a voice message...", "sending a voice message...", "sending a file...",
  "choosing a sticker...", "finding a location...", "recording a round video...", "sending a round
  video...". Stage 2 kind labels: "Poll", "Quiz", "Dice", "Paid media", "Rich message", "Invoice".
  Entity labels: "Bold", "Italic", "Underline", "Strikethrough", "Spoiler", "Code", "Code block",
  "Quote", "Expandable quote", "Link", "Custom emoji", "Date and time".
- catalog-check prints one line per problem, "<TABLE> <row id>: <problem>", for: no id, duplicate id
  in its table, no source, a source that is not a valid URL, not https, or on core.telegram.org
  without an anchor, no Bot API version or one not like "10.5", and an unverified row without a
  note. Sources on other hosts (GitHub code of public bots) need no anchor.

## As built (M7)

**MSG-02** (42ccafc).

Code:

- Catalog: `POLL_FIELDS`, `PAID_MEDIA_KINDS`, `paidMediaKind`:
  `packages/spec/src/telegram/polls.ts`, listed in `CATALOG`
  (`packages/spec/src/telegram/index.ts`).

As built:

- Catalog: `telegram/polls.ts` has `POLL_FIELDS` (the sendPoll parameters a design maps to, each
  with its model field or null, its kinds and `since`: allows_revoting, shuffle_options,
  allow_adding_options, hide_results_until_closes, correct_option_ids and description 9.6; media,
  explanation_media and option media 10.0; members_only and country_codes left out as channel-only)
  and `PAID_MEDIA_KINDS` (photo, video, live photo since 10.0) with `paidMediaKind(kind)`. The
  limits were TG-01's already. 24 tables, 233 rows.

**RICH-01** (e736ff2).

Code:

- Catalog: `packages/spec/src/telegram/rich.ts` (`RICH_BLOCKS`, `RICH_MEDIA_KINDS`, `richMediaKind`,
  `DRAFT_METHODS`, `draftMethod`), nine limit rows in `telegram/limits.ts` (richText, richBlocks,
  richNesting, richMedia, richTableColumns, richButtons, richHeadingSize, draftText, draftLife), the
  kind row's id `richMessage` renamed `rich` in `messages.ts` and `edit.ts`, the tables in
  `telegram/index.ts`.

As built:

- Catalog: `telegram/rich.ts` has `RICH_BLOCKS` (the 24 InputRichBlock types with the model's block
  or null: math, anchor, pull quote, collage, slideshow, map and thinking are not offered),
  `RICH_MEDIA_KINDS` (photo, video, GIF, audio; voice note since 10.2 with `InputMediaVoiceNote`;
  file since 10.3, `InputRichBlockDocument`) and `DRAFT_METHODS` (sendMessageDraft 9.5 then
  sendMessage; sendRichMessageDraft 10.1 then sendRichMessage). Limits: 32768 characters, 500
  blocks, 16 levels, 50 media, 20 table columns (api#rich-message-limits), 1 to 8 buttons in a row
  (InputRichBlockButtons), heading size 1 to 6, draft text 0 to 4096, a draft lives 30 seconds. The
  kind row's catalog id is `rich` (was `richMessage`), matching the model. 27 tables.

**RICH-02** (3f93124).

Code:

- Catalog: `DRAFT_STOP` (can_stop, keep_on_stop, stopped_message_generation with their editor words)
  and `draftStopLabel` in `telegram/rich.ts`, listed in `CATALOG` (`telegram/index.ts`).

As built:

- Catalog: `DRAFT_STOP` (can_stop and keep_on_stop of sendMessageDraft and sendRichMessageDraft, the
  update stopped_message_generation; Bot API 10.3) with the editor's words.

**PAY-01** (872f8a6).

Code:

- Catalog: `INVOICE_FIELDS`, `PAYMENT_EVENTS`, `PAYMENT_RULES`, `STARS_CURRENCY`, `isStars`,
  `isCardCurrency`, `currencyDigits`, `priceText`, `subscriptionDays`:
  `packages/spec/src/telegram/payments.ts`, listed in `CATALOG`; limit `preCheckoutAnswer` in
  `telegram/limits.ts`.

As built:

- Catalog `telegram/payments.ts`: `INVOICE_FIELDS` (the sendInvoice parameters with their model
  field, Stars or cards; `subscription_period` only on createInvoiceLink), `PAYMENT_EVENTS`
  (shipping_query, answerShippingQuery, pre_checkout_query, answerPreCheckoutQuery,
  successful_payment, refunded_payment, refundStarPayment, createInvoiceLink,
  editUserStarSubscription), `PAYMENT_RULES` (Stars for digital goods, one price in Stars, card
  fields ignored in Stars, pay button first, subscriptions only by link, smallest unit, refunds of
  Stars only); limit `preCheckoutAnswer` (10 seconds). `priceText` writes "⭐️50" or "4.50 USD" (ISO
  4217 digits; currencies.json has the final word). 27 tables.

## As built (M8)

**EVT-01** (5e3303b).

Code:

- Catalog: `ACTION_METHODS`, `EVENT_UPDATES`, `EVENT_RULES`, `REACTION_EMOJI`, `reactionEmoji()`:
  `packages/spec/src/telegram/events.ts`, listed in `CATALOG`; limit `keptWait` in
  `telegram/limits.ts`. 30 tables.

As built:

- Catalog `telegram/events.ts`: `ACTION_METHODS` (setMessageReaction, pinChatMessage,
  unpinChatMessage, deleteMessage, getAvailableGifts, sendGift, sendChatAction, refundStarPayment
  with the kind each serves), `EVENT_UPDATES` (my_chat_member kicked, my_chat_member member,
  subscription since 10.2), `EVENT_RULES` (one reaction from the list, the reaction list, no pin
  notification in private chats, the gift's kept formats, gifts paid from the bot's balance, no
  sending after a block (unverified), broadcast rates, broadcasts only to users who started the bot
  (unverified), waits kept by the bot (unverified)), `REACTION_EMOJI` (the 73 of ReactionTypeEmoji)
  and `reactionEmoji()` (drops U+FE0F); limit `keptWait` (1 hour, unverified: xDesign's line for
  W21).

## As built (M11)

**TG-REFRESH** (research, no catalog change).

The research is `.dev/s2/research/tg-refresh.md` (fetched 2026-11-23 from core.telegram.org: bots/api,
bots/api-changelog, bots/features, bots/payments-stars, bots/payments, bots/faq; checked against
`packages/spec/src/telegram/`, 233 rows in 24 tables, `make catalog-check` passes).

- Current Bot API version: **Bot API 10.5, released 2026-11-22**
  (https://core.telegram.org/bots/api-changelog#november-22-2026), the version the catalog is
  built against (`BOT_API = '10.5'`, `BOT_API_DATE = '2026-11-22'`). No change after 10.5: the
  changelog's newest entry is 10.5, and the API page header reads 10.5.
- Catalog rows whose fact changed: none (0 rows). Every anchor used by `apiDoc`, `featuresDoc`,
  `starsDoc`, `changelogDoc` and `faqDoc` (and every literal core.telegram.org URL) exists on the
  fetched page. Values compared with the docs and equal: text 1-4096 and caption 0-1024;
  callback_data 1-64 bytes; popup text 0-200; copy_text 1-256; input placeholder 1-64;
  `max_quantity` 1-10; command 1-32 and description 1-256; at most 100 commands; bot name 0-64,
  description 0-512, short description 0-120; start parameter 1-64 (A-Z a-z 0-9 _ -); album 2-10
  items; live period 60-86400 or 0x7FFFFFFF; poll question 1-300, options 1-12 with text 1-100,
  explanation 0-200 with at most 2 line feeds, description 0-1024, `open_period` 5-2628000,
  `close_date` 5 to 2628000 seconds ahead; invoice title 1-32, description 1-255, payload 1-128
  bytes; `subscription_period` always 2592000 and price at most 10000 Stars, only on
  `createInvoiceLink`; paid media 1-25000 Stars, up to 10 items, payload 0-128 bytes; gift text 0-128;
  `deleteMessage` 48 hours, dice in a private chat only after 24 hours, bots can delete incoming
  messages in private chats; chat action 5 seconds; dice 1-6 for the dice, darts, bowling, 1-5 for
  basketball and football, 1-64 for the slot machine; rates 1 per second per chat, about 30 per
  second broadcast, 1000 per second paid at 0.1 Stars; inline and reply button `style` is "danger",
  "success" or "primary".
- One fact the catalog already flags and that is still split: the paid broadcast balance. API: at
  least 10,000 Stars (api#paid-broadcasts). FAQ: at least 100,000 Stars and 100,000 monthly active
  users (faq#how-can-i-message-all-of-my-bots-subscribers-at-once). The `paidBroadcastRate` note
  ("differs between api and faq") is still right.
- Facts the stage 2 tasks rely on, confirmed:
  - Poll and quiz limits and the 9.6 options: question 1-300 (custom emoji entities only), 1-12
    options (min lowered from 2 to 1 in 10.0), option text 1-100, `type` regular or quiz,
    `is_anonymous` default true, `allows_multiple_answers` (quizzes too since 9.6),
    `allows_revoting` (default false for quizzes, true for polls), `shuffle_options`,
    `allow_adding_options` (not for anonymous polls and quizzes), `hide_results_until_closes`,
    `correct_option_ids` (monotonically increasing 0-based, required for quizzes), explanation 0-200
    characters with at most 2 line feeds, description 0-1024, `open_period` 5-2628000 and
    `close_date`, `media` and `explanation_media` (10.0), `is_closed`. `members_only` and
    `country_codes` are channel only (api#sendpoll, api-changelog#april-3-2026 for 9.6,
    #may-8-2026 for 10.0).
  - Dice: emoji dice, darts, bowling, basketball, football, slot machine (default dice); values
    1-6, 1-6, 1-6, 1-5, 1-5, 1-64 (api#senddice).
  - Paid media: `star_count` 1-25000, up to 10 items, mixed photo, video, live photo (10.0),
    `payload` 0-128 bytes, caption 0-1024, `show_caption_above_media`; Stars go to the bot's balance
    outside channels (api#sendpaidmedia).
  - Invoices: `currency` "XTR" with an empty `provider_token` for Stars; exactly one `prices` item
    for Stars; tips, `need_*`, `send_*_to_provider`, `is_flexible` (shipping) are ignored for Stars,
    so shipping and `answerShippingQuery` only apply to provider (non Stars) payments;
    `answerPreCheckoutQuery` must answer within 10 seconds; reply markup of an invoice: if empty one
    "Pay total price" button, otherwise the first button must be a Pay button (api#sendinvoice).
    Refunds: `refundStarPayment(user_id, telegram_payment_charge_id)`; `editUserStarSubscription`
    cancels or re-enables a subscription extension; subscription state updates
    `BotSubscriptionUpdated` with state "canceled", "active" or "failed" (10.2). The TON currency in
    the docs appears only in channel post and gift records (suggested posts, `StarTransaction`), not
    in invoices.
  - `sendGift`: `user_id` or `chat_id`, `gift_id` (from `getAvailableGifts`), `pay_for_upgrade`,
    `text` 0-128 with `text_parse_mode` or `text_entities` (only bold, italic, underline,
    strikethrough, spoiler, custom_emoji and date_time kept); the gift cannot be converted to Stars
    by the receiver; limited gifts cannot go to channels. The cost is paid from the bot's Stars
    balance (api#sendgift).
  - `setMessageReaction` in private chats is still not documented: the method text does not name
    chat types ("bots can set up to one reaction per message", no paid reactions); the
    `message_reaction` update needs the bot to be an administrator in the chat, so a private chat
    bot cannot receive reaction updates. TG-00's decision (dropped, Q-26, D-36) stands. 10.0 added
    `deleteMessageReaction` and `deleteAllMessageReactions` (chat management, not private chats).
  - Pin and unpin are confirmed for private chats: all non-service messages can be pinned and all
    messages unpinned with no rights; notifications are always off in private chats;
    `unpinChatMessage` without `message_id` unpins the most recent pin; `unpinAllChatMessages` needs
    no rights.
  - `my_chat_member`: "For private chats, this update is received only when the bot is blocked or
    unblocked by the user" (new status "kicked" = blocked, "member" = unblocked). There is no update
    for a restart: a restart is the user sending `/start` again.
  - `sendRichMessage` (10.1, 10.2, 10.3): `rich_message` is an `InputRichMessage` with exactly one
    of `html`, `markdown`, `blocks` (plus `media` for tg://photo?id= style links, `is_rtl`,
    `skip_entity_detection`); `message_effect_id` for private chats; buttons inside via
    `RichMessageButton` (style "danger", "success", "primary" or "link"; "link" only for callback
    buttons); callback queries from rich messages are answered with `answerCallbackQuery`; editable
    with `editMessageText` and `rich_message`.
  - `sendMessageDraft` and `sendRichMessageDraft`: private chats only; `draft_id` non-zero (the same
    id animates, another id replaces); the draft is a temporary 30-second preview and the bot must
    then send the complete message with `sendMessage` or `sendRichMessage`; `sendMessageDraft` text
    0-4096 (empty shows a "Thinking..." placeholder, 10.0); 10.3 added `can_stop` (a stop button; the
    bot gets the update `stopped_message_generation`, class `MessageGenerationStopped`) and
    `keep_on_stop`. RICH-02 built both.
- New for a private-chat bot and not modelled in the catalog (one line each; the research found
  none of these names in `packages/spec/src` and `docs/plan`; see R-278):
  - `setMySettings` (10.5, in `buttons.ts` and the how-to-read text only): privacy mode, forum topic
    mode in private chats, `has_topic_sidebar`, `callback_query_mode` (the callback may carry
    `inline_message_id`, already noted in section 7).
  - `https://t.me/botinvite/<bot_username>` (10.5): the owner can invite up to 10 users at once to
    the private chat; the bot gets `WriteAccessAllowed.inviter`. Not modelled (start points).
  - Entity types `ton_address` and `bank_card_number` (10.4): detected automatically in texts; the
    catalog's 12 entity types do not list them (a bot can pass them, no formatting effect to
    design; `skip_entity_detection` of `InputRichMessage` switches automatic detection off).
  - Poll media kinds beyond photo and video: sticker, location, venue (10.0) and link
    (`InputMediaLink`, 10.1) as poll and option media (`media`, `explanation_media`, `option_media`
    rows are `model: null`).
  - Bot-side `message_reaction` limits: `can_react_to_messages` (10.0) is a group permission only.
  - Out of scope, already excluded or group only: widgets (`sendWidget`, 10.4), guest mode (10.0),
    ephemeral messages (10.2, 10.3), communities (10.2), join request queries (10.1), managed bots
    (9.6), TON wallet cards (10.4), chat share themes (10.4), bot-to-bot messages (10.0).
- The research also listed `keep_on_stop` with `stopped_message_generation`, `InputMediaVoiceNote`
  and `InputRichBlockDocument` as not modelled; RICH-01 and RICH-02 built them after it was written.
