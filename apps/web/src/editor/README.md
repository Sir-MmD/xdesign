# The editor (`/d/<id>`)

EDIT-01's frame (docs/plan/04 section 4, 02 section 4). The route is
`src/routes/_editor/d.$id.tsx` under its own signed-in layout `src/routes/_editor.tsx` (no site
top bar); the address keeps the tab (`?tab=setup`, `?tab=texts`).

## What every part can use

- `useDesign()` (`context.ts`): the plain `Design`, a new object after each change; unchanged
  steps, buttons and other items keep their objects, so `useMemo` on one step is cheap.
- `useEditor()` (`context.ts`): `edits` (SPEC-04's `designEdits` with the person's origin: every
  change goes through them), `undoManager` (this person's changes only), `readOnly` (Commenter,
  Viewer, a read-only connection, under 900 pixels, a refused change), `role`, `designId` and
  `live` (the document, `origin`, awareness and connection state, `live.ts`).
- `useSelection(pick)` and `useSelectionStore()` (`selection.ts`): the selected `step`,
  `button`, `text` and `lang`; `set({ step })` selects, `reveal(step, button?)` selects and asks
  the map to bring it into view (`reveal` counts up).
- `useLang()` (`context.ts`): the language the phone and the map show.
- `useLook()` (`look.ts`): the phone's look and theme.
- `usePresence()` and `usePublishCursor()` (`context.ts`): the other people's tabs (`Peer`:
  user, step, button, text, cursor) and this person's map cursor.
- `useChecks()` and `useCheckCount()` (`checks.ts`): SPEC-05's issues of the live design, one
  run per design for every reader (`checks/runner.ts`: 200 ms after the last change, in
  `checks/worker.ts` above 100 steps); "Ignore here" through `edits.checks`.
- `ViewOnlyContext` is true below the top bar while read-only: the design system's switches,
  selects, toggle groups and comboboxes turn themselves off.
- `shortcuts.ts`: the "Keyboard shortcuts" list and undo and redo (keys in a field are left to it).
- `useDraft(value)` (`useDraft.ts`): a field written through the accessors at each change, which
  keeps the person's own text while it has the focus.

## Where each task builds

- MAP-01 (built): `map/MapPane.tsx` (React Flow over the design: nodes from `map/nodes.ts`,
  arrows from their sources in `map/arrows.ts`, the dots' handle IDs and `setArrow`), one box
  renderer per kind in `map/boxes/` (shared pieces in `boxes/Box.tsx`), the box menu
  `map/BoxMenu.tsx`, "New step here" `map/NewStepMenu.tsx`, the palette `palette/PalettePane.tsx`
  (adds through `map/addStep.ts`). `Editor.tsx` wraps the Map tab in `ReactFlowProvider`, so the
  palette and later the map's tools reach the view with `useReactFlow()`.
- MAP-02 (built): every box renders through `map/BoxOverlay.tsx` (`OverlaidBox`: other people's
  selections in their color with a name tag, the checks' red and amber dots), so box files need
  nothing for it; `map/PeerCursors.tsx` (others' pointers), `map/MapTools.tsx` (minimap, zoom,
  "Fit", "Auto-arrange" with `map/arrange.ts`, ELK in its worker), `map/MapSearch.tsx` with
  `map/search.ts`, the map's keys in `map/keys.ts` (Delete, copy and paste events, Ctrl+D, F,
  Ctrl+F, Esc, arrows), the clipboard in `map/clipboard.ts` on SPEC's `copySteps`, `readClip` and
  `edits.map.paste` / `edits.map.arrange` (`packages/spec/src/ydoc/map.ts`). `map/actions.ts`
  gives boxes `targets`, `copy`, `duplicate` and `paste` (the box menu acts on the selection).
- LOGIC-01 and START-01: their boxes in `map/boxes/` (one file per kind); new dots go in
  `exitsOf` (`map/arrows.ts`), so arrows, "New step here" and Delete know them.
- PERF-01 (built): a box renders again only when React Flow gives it other props: `map/nodes.ts`
  keeps the node of a step that did not change and `OverlaidBox` is memoized. A box reads the
  rest of the design (names, parts, other steps, the language shown) with `useShown`
  (`map/shown.ts`), never with `useDesign` or `useLang`, which would render every box again at
  each change. Dots are measured again once per frame (`useRemeasure` in `boxes/Box.tsx`); the
  box menu, its note dialog and the checks' tooltip are made the first time they open.
- MAP-10 (built): `map/lines.ts` is the one place for the lit lines (`linesOf`, the lines of some
  steps; `lightLines`, those of the selected boxes, the picked ones and the hovered dot's, with the
  boxes kept at full strength and the outlined target) and a line's label (`arrowLabel`); it builds
  the edges (`arrowEdges`, one edge object per arrow and state). Boxes get `xd-lit` and `xd-aimed`
  on the node's `className` (React Flow's wrapper, not the box's props) and the map `xd-fade`;
  `map.css` draws them, so a selection or a hover renders no box. The hovered dot is read on the
  map, not in the boxes (`lineAt`: a handle, `data-exit`, `data-button`).
- MAP-11 (built): in "Short tags" `farLines` (`map/lines.ts`) picks the far lines once per change
  of the design, the measured sizes or the Lines switch (`map/linesView.ts`, `mapLines` of
  `PATCH /api/me`); `arrowEdges` draws a far line that is not lit as one `tag` edge per row of its
  box (`map/TagEdge.tsx`, in React Flow's label layer, so the tags are no box's props). A box's
  "<N> come here" (`map/ComeHere.tsx`) is read with `useComeHere` (`map/shown.ts`): only the
  boxes whose number changed render again. Jumps go through `jump` of `map/actions.ts`, which
  keeps the place for "Back" (`MapPane.tsx`).
- TXT-01 (built): `phone/text/` fills the `text` slot (`useTextSlot`) and draws the counter under
  the phone (`TextCounter`). The editor publishes `text` while focused, writes other people's
  carets in the awareness field `caret` (`cursor` stays the map's), adds `ySyncPluginKey` to
  `undoManager.trackedOrigins` and sends its own Ctrl+Z to `undoManager`. Keys typed in the text
  stop at it; the phone is a shadow root, so `inField(event)` (`shortcuts.ts`) reads the first
  element of the event's composed path, not its target (the phone's host). Its schema
  (`phone/text/schema.ts`) serves any other TipTap text (PARTS-01, LANG-01).
- MSG-01 (built): `phone/media/` fills the `media` slot (`BubbleMedia`, also read-only: the
  cards of files, places and contacts), `phone/KindRow.tsx` above the phone,
  `phone/options/OptionsSection.tsx` and `phone/TelegramDetails.tsx` under it. A message step's
  own content and options and a question's prompt are one shape: `phone/message.ts` reads it
  (`shownOf`) and writes it (`setShown`; `useUpdateContent` writes the content as the document
  has it now, for work that ends later). `phone/NumberInput.tsx` is a number field that keeps
  the typed text until it reads as a number in range.
- BTN-01 (built): `phone/keyboard/` fills the `keyboard` and `replyKeyboard` slots
  (`useKeyboardSlots`): the inline keyboard and the bar under the bubble (`InlineKeyboard.tsx`,
  "+ Inline buttons", "+ Bottom keyboard", "More"), the bottom keyboard's panel
  (`ReplyKeyboard.tsx`), both drawn by `KeyboardRows.tsx` with the look's classes and the
  preview's `TelegramButtonFace`, dragged with dnd-kit. The selected button
  (`useSelection((s) => s.button)`, also set by a click on a pill of the map) opens its popover
  (`ButtonPopover.tsx`) beside it on the phone. `fields.tsx` has the popover's pieces (a text per
  language, a step picker with "Back" and "Stay here", a variable picker with "None" and "+ New
  variable"); "Also remember" is LOGIC-01's `RememberLines` (`forms/RememberForm.tsx`);
  `keyboard.css` is adopted into the phone's shadow root.
- LOGIC-01 (built): `forms/`, one file per form: `LogicForm.tsx` fills the phone pane for a
  logic step (`isLogicStep`, `forms/logic.ts`), `QuestionForm.tsx` sits under a question's
  phone. Shared pieces: `forms/fields.tsx` (`FormSection`, `Field`, `TitleField`,
  `TargetSelect`, `ColorField`, `OptionalNumber`), `forms/VariableSelect.tsx` (a variable with
  "+ New variable", a list of them), `forms/ValueInput.tsx` (a value typed as text, `{name}` for
  a variable).
- START-01 (built): a start point's form in the phone pane (`forms/start/StartForm.tsx`, one
  branch in `phone/PhonePane.tsx`), its box `map/boxes/StartBox.tsx`, and Bot setup:
  `tabs/BotSetupTab.tsx` with its parts in `bot/` (`CommandList`, `BotPhoto`, `BotPreviews`).
  `forms/start/rules.ts` holds the command and start link rules (the catalog's), `/start`
  (`isTheStart`) and the full link; `forms/start/fields.tsx` a plain text per language with its
  counter (`PlainTextField`) and `SwitchRow`. MSG-01's `MediaSource` takes `uploadAs` (the
  profile photo goes up as `botPhoto`).
- LANG-01 (built): `tabs/TextsTab.tsx` with `texts/` (the rows by step in map order, plain cells
  written at each change through `useDraft.ts`, rich cells in TXT-01's editor in a popover,
  `SlotTextEditor`); "Languages..." in `topbar/LanguageSwitch.tsx` opens `topbar/LanguagesDialog.tsx`;
  `variables/` holds the Variables and Test switches panel, whose two palette entries
  (`VariablesEntries`) the palette places.
- PARTS-01 (built): `parts/`. The palette's "PARTS" is `parts/PartsGroup.tsx` (the list with
  uses from `parts/uses.ts`, "+ Part", palette drags typed by `PART_DRAG`); the part editor is a
  non-modal sheet (`parts/PartEditor.tsx`) with its small phone (`parts/PartPhone.tsx`: BTN-01's
  `KeyboardRows` on `{ part }` or TXT-01's `PhoneText` on the part's text). `useOpenPart()`
  (`parts/store.ts`, one store per open design) opens it from anywhere. Drops: `usePartDrop`
  (`parts/drop.ts`) on BTN-01's keyboards, `dropTextPart` in TXT-01's `handleDrop`; the box menu
  gets `parts/MakePartItem.tsx`.
- CHK-01 (built): `topbar/ChecksButton.tsx` opens `checks/ChecksPanel.tsx` (the lines by level,
  "Ignored", the language filter; a line's click closes it, sets the line's language and calls
  `reveal(step, button)` on the Map tab, or opens Bot setup); `checks.ts` with
  `checks/runner.ts` and `checks/worker.ts` (02 section 9); SPEC's `edits.checks.ignore` and
  `stopIgnoring` keep the keys in `meta.ignoredChecks` (`packages/spec/src/ydoc/checks.ts`).
- TRY-02 (built): `try/`. `try/store.ts` keeps the session (`TryStore` in `TryContext`: open,
  the test user, the engine's states for "Step back", "Skip waits"; `useTry(pick)`, `useSim()`
  for TRY-01's `createSim` over the live design). `try/TryPhone.tsx` takes the phone pane's place
  while trying (Editor.tsx): PRV-02's `TelegramChat` with `presses` (the preview's `ChatPresses`:
  inline and bottom buttons, commands, the input field and its buttons) and `bottom` (the
  engine's bottom keyboard), the cards over the chat, the delays' timers; `try/chat.ts` turns a
  state into the chat's entries. `try/TestUserPanel.tsx` beside the phone from 1280 pixels, in a
  sheet below. The map's highlight layer is `try/path.ts` (`PathMark.tsx` in `OverlaidBox`,
  `useTaken` in `ArrowEdge`); "Try it" and "Stop trying" in `topbar/TryItButton.tsx`; Ctrl+Enter
  and Esc in `try/keys.ts`, listed in `shortcuts.ts`.
- EXP-02 (the lead wires it): `topbar/ExportButton.tsx` and "Print" in `topbar/MoreMenu.tsx`.
- HIST-02 (built): `history/`. `history/store.ts` keeps the History panel, the version viewed and
  the open dialog, one store per open design (`historyOf(live)`, `useHistory(pick)`); while a
  version is viewed, `Editor.tsx` gives `DesignContext` its plain design and makes the editor
  read-only, so every pane shows it. `history/History.tsx` draws the panel
  (`history/HistoryPanel.tsx`), "Name this version", "Compare with now"
  (`history/CompareDialog.tsx` on `history/compare.ts`), "Restore this version", a version's
  export, rename and delete; `history/VersionBanner.tsx` is the banner under the top bar. The
  export dialog's "Version" is `src/export/VersionField.tsx`. LIVE's `versionRestored` clears the
  person's undo history (`live.ts`), counts `restores` (the panes start again, the list refreshes).
- VIEW-01 (built): the page of a view-only link, `src/view/ViewPage.tsx` (route
  `src/routes/v.$token.tsx`), is this editor read-only: `EditorFrame` (exported from
  `Editor.tsx`, with the top bar passed as `bar` and the look's key as `lookKey`) as a Viewer on
  the Map tab, `LiveDesign` opened with `{ viewToken }`, and the top bar's `LanguageSwitch`,
  `LookSwitch`, `TryItButton` and `ExportButton` (given the link's `docVersion`, so the export
  dialog reads no header). Every media address comes from `mediaUrl` (`src/api/media.ts`), which
  adds the link's token while its page is open.
- CMT-02 (built): `comments/`. `comments/store.ts` keeps comment mode, the panel, the new
  thread's anchor and the thread to show (`CommentStore`, `useEditor().comments`: `start(anchor)`,
  `show(threadId)`), reads the threads (`useThreads`, again at each `commentsChanged`, counted in
  `LiveState.commentsChanged`) and numbers the open ones (`usePins`). `comments/CommentsPanel.tsx`
  is the right sheet (opened by "..." > "Comments", a pin, the bell or comment mode; it marks the
  design read); `comments/CommentInput.tsx` the text with the "@" list of the design's members.
  Pins: `comments/Pins.tsx` (`BoxPins` in `OverlaidBox` through the overlay context, `MapSpotPins`
  in the map's viewport, `PhonePins` over the phone, which find the bubble and the buttons in the
  preview's shadow root: `data-button` on BTN-01's buttons, the row and place on the preview's).
  Comment mode's clicks: `onNodeClick` and `onPaneClick` in `map/MapPane.tsx` (a pill's
  `data-button`), a click capture in `phone/PhonePane.tsx` (the phone is read-only then);
  `comments/anchors.ts` makes the anchors and says them in words. "Comment" and the bell in the
  top bar (`topbar/CommentButton.tsx`, `src/comments/CommentsBell.tsx`), C and Esc in
  `comments/keys.ts`, "Comment" in the box menu; the bell's link is the route's `comment` search.
- MSG-03 (built): stage 2's kinds. `phone/kinds.ts` offers "Poll", "Quiz", "Dice" and "Paid
  media" to message steps (a question's prompt keeps stage 1's); the preview draws them
  (`packages/preview`: `Poll.tsx`, `skins/poll.css`, `PollTokens` and `PaidTokens`). A poll's
  question is the `text` slot (TXT-01's editor without the toolbar), its options the `option`
  slot (`phone/poll/OptionField.tsx`); `phone/KindSection.tsx` under the counter holds the kind's
  settings (`phone/poll/PollSection.tsx` for polls and quizzes, the dice's emoji, paid media's
  Stars); paid media's items use MSG-01's `AlbumEditor` through the media slot. Try it votes
  (`ChatPresses.vote`), unlocks paid media through a payment card (`ChatPresses.unlock`, "Pay
  (test)") and takes a "Dice value" in the test user panel.
- RICH-01 and RICH-02 (built): a rich message's blocks under the phone
  (`phone/rich/RichSection.tsx`): a button row's buttons open BTN-01's `ButtonPopover` there
  (added through `edits.keyboard` at `{ rich: step }`), a media block takes MSG-01's
  `MediaSource`; the map draws the buttons inside as pills before the keyboard's (`richRowsOf`,
  `shownRowsOf` in `map/arrows.ts`). "Write it out like a draft" with "Let the user stop it",
  "Keep what was written" and "If the user stops it" (`onStop`, a dot in `exitsOf`) in
  `phone/options/OptionsSection.tsx`. Try it presses the buttons inside (`ChatPresses.inside`);
  a draft with a stop button is the engine's `writing`, with a "Stop" card over the chat.
- CL-03 (built): "Refresh pictures for Claude" in `topbar/MoreMenu.tsx` makes the default
  language's pictures of the live document (now, also while a version is open) in the phone's
  look and sends them to the picture cache (`src/export/pictureCache.ts`, also used by the
  export dialog and the Designs cards).
- PAY-02 (built): invoices. "Invoice" and "Action" in the palette's ADD, "+ Payment done" and
  "+ Refund" in its start points (`map/kinds.ts`). An invoice is a `SendingStep` (`map/arrows.ts`
  `isSending`): its box (`map/boxes/InvoiceBox.tsx`) has its pills and "Paid"; the phone pane
  draws its card (`phone/invoice.ts` `invoiceMessage`, `InvoicePhone` in `phone/PhonePane.tsx`)
  with BTN-01's keyboard slot (`InvoiceKeyboard` in `phone/keyboard/InlineKeyboard.tsx`: Telegram's
  own pay button and "+ Inline buttons" while it has none) and `forms/InvoiceForm.tsx` under it.
  A subscription's pay button draws as a link (`payAsLink` in `phone/keyboard/model.ts`). The
  popover offers "Pay" on invoices only. `forms/InvoiceSelect.tsx` picks an invoice for the
  refund (`forms/ActionForm.tsx`, a logic form), the payment start points (`forms/start/
  StartForm.tsx`) and "has paid" or "is subscribed to" (`forms/ConditionRow.tsx`). The preview
  draws the card (`Post.tsx`, `skins/invoice.css`, `InvoiceTokens`) and the payment sheet
  (`PaymentSheet` in `Chat.tsx`, `ChatOptions.payment`, `ChatPresses.pay` and `cancelPayment`);
  Try it builds the sheet from the engine's `payment` (`paymentSheet` in `try/chat.ts`).
- EVT-02 (built): events. The palette's start points end with "+ Subscription changed", "+ User
  blocks the bot", "+ User restarts the bot" and "+ Broadcast" (`map/kinds.ts`). The Action form
  (`forms/ActionForm.tsx`) picks the kind in "Does" and shows its fields; a gift's card is a small
  phone with its text written in place (`forms/GiftBubble.tsx`, TXT-01's `PhoneText` with `gift`:
  `TextToolbar` without code, link, quote and code block). `forms/ConditionList.tsx` is the
  condition editor of an If case, a reminder (`forms/WaitForm.tsx`, "Only once these hold") and a
  broadcast's audience (`forms/start/StartForm.tsx`). The preview draws the bot's reaction on a
  message (`ChatEntry.reaction`), the pinned message bar (`ChatOptions.pinned`), a gift's card
  (content `gift`, `GiftRow` in `Post.tsx`) and Restart once blocked (`ChatOptions.blocked`,
  `ComposerPress` `restart`), from `EventTokens` (`skins/tokens.ts`, `skins/events.css`). Try it's
  "Events" menu and the chat action in the top bar are in `try/TryPhone.tsx`.

## Connection (LIVE-01's protocol)

`live.ts` opens `design:<id>` on `/live` with the y-indexeddb copy `xdesign-<designId>-<userId>`
(people who can edit only; others have it cleared). `useDesignDoc.ts` turns its state into the
save state, sends the person to Designs on lost access ("You no longer have access to this
design.") or to the sign-in page when the session ended, and reads the role again after
`role_changed`. `Banners.tsx` shows "xDesign was updated. Reload to use the new version.", "The
server is busy. Trying again..." and "This design is too big to save more changes.". A view
link's page opens `/live?view=<token>` without a local copy; the server makes it read-only, gives
it no presence of anyone and closes it with "This link no longer works. Ask the person who sent it
for a new one." once the link is revoked or expires.
