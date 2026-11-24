# 04. The website and the editor

Every page, what it shows and its main texts. Texts in quotes are the exact interface texts
(English only, D-18). Accounts and roles are 05; export and Claude link 06; Maintenance 07.

## 1. Pages

| Path | Page | Who |
|---|---|---|
| `/sign-in` | Sign in | everyone |
| `/invite/<token>` | Accept an invite: name, password | invited person |
| `/reset/<token>` | Set a new password | person with a reset link |
| `/` | Designs | members |
| `/d/<id>` | The editor (map, phone, panels) | anyone with a role on the design |
| `/d/<id>/bot` | Bot setup (a tab of the editor) | same |
| `/d/<id>/texts` | Translations table (a tab of the editor) | same |
| `/d/<id>/print` | The readable doc as a printable page | same |
| `/members` | Members and invites | site owner |
| `/settings` | Settings (site name, upload limit, site address, HTTPS, Claude connections, activity) | site owner |
| `/maintenance` | Backups, update, going back | site owner |
| `/account` | Name, password, color, two-factor authentication, sessions; (S2) API keys, (MCP-03b) in the card "Claude" with Connected apps | members |
| `/allow-app` | (MCP-03b) "Allow <app> to use xDesign as <name>?" for the Claude app and claude.ai, alone in the sign-in page's card | members |
| `/templates` | (S2) Template gallery | members |
| `/v/<token>` | (S2) View-only link: map, phone, Try it | anyone with the link |

The top bar on every signed-in page: the site name, "Designs", for the site owner "Members",
"Settings", "Maintenance", then the person's avatar menu ("Account", "Sign out"). Under 760 pixels
wide the top bar's links take a second row that scrolls sideways. The top bar's sun and moon
button, left of the comments' bell, switches the site between Light and Dark; until a person
presses it the site follows the system's Light or Dark (17 section 8).

## 2. Sign in and accounts

- **Sign in**: email, password, "Sign in". Wrong either: "Email or password is wrong." After too
  many tries: "Too many tries. Wait 15 minutes or ask the owner to reset your password." With
  two-factor sign-in on, then "Enter your code" (17 section 7).
- **Invite**: "You are invited to <site name>." Name, email (pre-filled if the owner typed one),
  password twice, "Create my account". Used or expired: "This invite link was used or has
  expired. Ask the owner for a new one."
- **Reset**: "Set a new password for <email>." Password twice, "Save password".
- **Account**: name, email (only the owner changes emails), color (used for cursors), "Change
  password" (current and new), "Two-factor authentication" (17 section 7), "Sessions" (device,
  last used, "Sign out" each, "Sign out everywhere else"); (S2) "API keys" (06 section 7.2), in
  (MCP-03b) the card "Claude" with "Connected apps" (17 section 13.6). (MCP-01b) Each key has the
  "Ask first" switch; only the site owner changes it, others see "Only the site owner can turn
  this off."

## 3. Designs page

- Header: "Designs", search box ("Search designs"), "New design", (S2) "New from template",
  "Import".
- Filter chips: "All", "Mine", "Shared with me", "Trash" (owner of the site sees "All" as every
  design on the server, with the design owner's name).
- Each design card: name, a small picture of its map, design owner, "Edited <time> by <name>",
  the avatars of people in it now, the person's role. Menu: "Open", "Rename", "Duplicate",
  "Share" (design owner), "Export", "Delete" (design owner; to Trash, kept 30 days),
  in Trash "Restore" and "Delete forever".
- **New design**: name, the default language (searchable list, English preselected) and more
  languages, each language with its flag before its name (16 section 3); "Create" opens the editor with `/start` and an empty "Main menu".
- As built: the chip is kept in the address (`/?filter=trash`); "Delete" asks first ("Delete "<name>"?", "It moves to Trash for 30 days. The people it is shared with
  lose it until it is restored.", "Delete" and "Cancel"), then moves to Trash with "Undo" in its
  toast (17 section 9); the site owner sees "Site owner" as their role on someone else's
  design.
- (S2) "New from template" opens the gallery `/templates`; New design has "Start from a template";
  a card's menu has "Save as template" (design owner and site owner).

## 4. The editor

```
+--------------------------------------------------------------------------------------------+
| < Designs  Coffee shop bot   Map | Bot setup | Texts     (AB)(MK)  Saved   EN v  Android Light v |
|                                        [Checks 3]  [Try it]  [Share]  [Export]  [...]      |
+---------+--------------------------------------------------------+-------------------------+
| ADD     |                                                        |  PHONE                  |
| Message |   [/start]--->[Main menu]------>[Coffee list]          |  +-------------------+  |
| Question|                   |  \              |                  |  | Coffee Shop  bot  |  |
| If      |                   v   \             v                  |  |                   |  |
| Remember|               [Help]  [Cart]    [Pick size]            |  |  Hello Ali!       |  |
| Wait    |                                                        |  |  What would you   |  |
| Dev step|   (click a box to edit it, drag from a button's dot    |  |  like?            |  |
| Go to   |    to draw where it goes)                              |  | [ Menu ] [ Cart ] |  |
| End     |                                                        |  | [   Help       ]  |  |
| Note    |                                        [minimap] [- +] |  +-------------------+  |
| Section |                                                        |  Options v  Telegram v  |
| PARTS   |                                                        |                         |
+---------+--------------------------------------------------------+-------------------------+
```

### 4.1 Top bar
- "< Designs", the design name (click to rename), tabs "Map", "Bot setup", "Texts".
- Avatars of the people in the design now (hover: name and what they edit; click: jump to it).
- Save state: "Saved", "Saving...", "Offline, your changes are kept on this computer",
  "Read only" (Viewer, Commenter), "Reconnecting...".
- Language switch (the design's languages; shows the phone and the map in that language).
- Phone look switch: "Web A", "Web K", "Desktop", "Android", "iOS" (xWriter's order) and
  "Light", "Dark" (Q-19, Q-28).
- "Checks" with the count of errors and warnings (section 9), "Try it" (section 8), (S2) "Comment" and the bell, "Share"
  (05 section 4), "Export" (06), menu "...": "Duplicate design", "Print", "Keyboard
  shortcuts", (S2) "History", "Comments". (Import is on the Designs page: it makes a new design.)
- As built: the tab is kept in the address (`?tab=setup`, `?tab=texts`); the language switch shows
  the language code; the look starts at "Android" and "Light"; "Share" shows for the design owner
  and the site owner.

### 4.2 Palette (left)
- "ADD": Message, Question, If, Remember, Wait, Developer step, Go to, End, Note, Section;
  (S2) Invoice, Action. Click to add at the center of the view, or drag onto the map; the new
  step is selected and its editor opens.
- "Start points": "+ Command", "+ Start link", "+ Anything else (fallback)"; (S2) "+ Payment
  done", "+ Refund", "+ Subscription changed", "+ User blocks the bot", "+ User restarts the bot",
  "+ Broadcast" (no "+ User reacts", D-36).
- "PARTS": the design's parts (section 12), drag onto a phone keyboard or into a text.
- As built: a click adds the step centered in the view, a drop centered on the pointer; a step that
  lands in a section belongs to it.
- As built (PAY-02): ADD ends with Invoice and Action; Start points end with "+ Payment done" and
  "+ Refund".
- As built (EVT-02): Start points end with "+ Subscription changed", "+ User blocks the bot", "+ User
  restarts the bot" and "+ Broadcast" (no "+ User reacts", D-36); "Action" is one item whose kind is
  chosen in its form.

### 4.3 The map
- Each step is a box: an icon for its kind, the title, and a small summary: for messages the
  first line of the text and its buttons as small pills in their looks (each pill has a dot to
  drag an arrow from); for logic boxes their outcomes as labeled dots ("Yes", "Otherwise",
  "Found", "Not found", "Valid answer", "Wrong 3 times", "Cancel").
- Arrows: from a dot to a box; the arrow's label shows "Edit", "New" or "Replace" for button
  clicks and a small bell for a popup. Drop an arrow on empty space: a menu "New step here"
  (Message, Question, If, ...) creates it and connects it.
- Select: click; several: shift-click or drag a box around them. Move: drag. Delete: the Delete
  key or the box menu, which says what arrows into it will be cleared.
- Box menu: "Edit", "Duplicate", "Copy", "Make a part from its buttons", "Add a note",
  "Delete"; (S2) "Comment".
- Sections: frames with a title and color; steps dragged into them belong to them.
- Bottom right: minimap, zoom, "Fit", "Auto-arrange" (ELK, left to right, keeps sections
  together; undoable).
- Search (Ctrl+F): finds steps, buttons and texts in any language; Enter jumps to the next.
- Badges: a red dot for errors and an amber dot for warnings on a box; hover lists them.
- Presence: other people's cursors with their names, and their color around the box they edit.
- Copy and paste works between designs (the clipboard keeps steps, buttons, texts and parts).
- As built: boxes are 240 pixels wide; an arrow dropped anywhere on a box goes into it; start
  points, notes and sections take no arrows; a section is moved by its title bar and lets clicks
  through elsewhere; Delete with boxes selected deletes only the boxes, with no box selected it
  clears the selected arrows; a duplicate lands 40 pixels down and right with the same title and its
  own texts and buttons.
- As built (MAP-02): copy (Ctrl+C or the box menu) puts the steps with their buttons, texts, parts,
  variables, test switches and media on the clipboard (`application/x-xdesign` and the same JSON as
  text); paste (Ctrl+V) centers them on the pointer with new IDs and ID names, keeps the arrows
  between them and to steps the design has, uses the design's variables by ID or ID name, adds
  missing parts, turns another design's files into placeholders and keeps the design's languages;
  Duplicate and Ctrl+D paste a copy 40 pixels down and right; the box menu acts on the whole
  selection when its box is selected; "Add a note" edits the designer's note for the developer;
  arrow keys move the selected boxes 10 pixels (Shift 50); search finds titles, ID names, notes,
  buttons and texts in every language in map order; Auto-arrange lays out sections as boxes around
  their steps and resizes them; badges skip ignored and good-to-know issues.
- As built (RICH-02): a message box shows a rich message's buttons inside as pills before its
  keyboard's, and the dot "If the user stops it" while the message can be stopped.
- As built (MAP-10): selecting a step draws its lines in and out bold in the brand color, each with
  a label at its middle (the button's text or the outcome's name, up to 24 characters, with the
  click mode and the bell) on a pill of the map's background, and fades every other box and line to
  30% (sections and the boxes at the other ends stay); hovering a dot or a button's pill draws its
  one line that way and outlines its target, hovering a line shows its label; a line picked with a
  click is lit without the fade.
- As built (MAP-11): in "Short tags" (the default of the switch "Lines: Short tags | All lines",
  last in the map's tools, saved as `users.map_lines`) a line into a step in another section, into
  a step with 5 or more lines in, or more than 1,600 map pixels long is a tag right of its box at
  its row (an arrow and the target's title, 20 characters) unless it is lit; a click jumps to the
  target as search does and "Back" returns, up to 10 places, until the person moves the map; a box
  with lines in drawn as tags shows "<N> come here", which lists them under "Comes here from" and
  jumps to their steps.

### 4.4 The phone pane (right)
- **Live view**: shows the selected step exactly as the Telegram app shows it (xWriter's
  preview, D-04), updated as anyone types or changes it: the bot's name and photo in the header, the message bubble with
  its media, text and inline keyboard, the bottom keyboard under the input field, and the input
  field's placeholder.
- For a message or question step it is **editable** (section 5). For logic steps the pane shows
  the step's form (section 6), with a small phone where the user sees something.
- Under the phone: "Options" (section 5.5) and "Telegram details" (a fold-out with the Bot API
  method and fields this step maps to, read-only, for the curious).
- As built: "Telegram details" lists the method, the fields the message sets (with the file's name
  or the placeholder) and a question's awaited updates.
- Viewer and Commenter: the same pane, not editable.

## 5. Editing a message on the phone

### 5.1 Kind
- A row above the bubble: the content kind ("Text", "Photo", "Video", "GIF", "Audio", "Voice",
  "Round video", "File", "Sticker", "Album", "Location", "Venue", "Contact"; (S2) "Poll",
  "Quiz", "Dice", "Paid media", "Rich message"; no checklist, D-36). Changing it keeps the text as the caption when the
  new kind has one; a kind without captions asks "The text will be removed. Change anyway?".
- As built: a select at the top of the phone pane in this order: Text, Photo, Live photo, Video,
  GIF, Audio, Voice, Round video, File, Sticker, Album, Location, Venue, Contact. It asks only when
  the text has words; a kind with captions always gets one (the old text, else an empty one); the
  file stays when it was uploaded for the new kind, else the slot becomes a placeholder named after
  it.
- As built (MSG-03): the select ends with Poll, Quiz, Dice and Paid media for message steps (a
  question's prompt keeps stage 1's kinds). A poll or quiz keeps the text as its question, and its
  options and settings between the two. Under the phone's counter the kind's settings: a poll's or
  quiz's options in order (right answers, move up, move down, remove, "Add an option"), "Anonymous
  voting", "Multiple answers", "Users can change their vote", "Shuffle the options", "Users can add
  options", "Hide the results until the poll closes", "Close after (seconds)", a quiz's
  "Explanation" and "Save the vote as"; a dice's "Emoji" and "Save the roll as"; paid media's "Price
  in Stars", "Caption above the media" and its items from the bubble. The question and the options
  are written in the bubble.
- As built (RICH-01): the select ends with Rich message. Under the phone, "Rich message": the blocks
  in order with move up, move down and remove, each text in a bubble with TXT-01's editor; a
  heading's "Size", a quote's "Expandable", a list's items and "Numbered", a table's cells ("Add a
  row", "Add a column", "Remove the last row", "Remove the last column", "First row is a header",
  "Borders"), a details block's "Title" and "Shown open"; "Add a block" and "Right to left".
- As built (RICH-02): "Add a block" offers "Buttons" (a row of inline buttons inside the message,
  each with BTN-01's popover, "+" up to 8); a media block takes "Upload a file", "Use a placeholder"
  or "Use a file already in this design", and "Hide under a spoiler".

### 5.2 Text
- Click the text in the bubble and type. A small toolbar appears over the selection: bold,
  italic, underline, strikethrough, spoiler, code, link, quote, code block; "{ } Insert" for a
  variable (saved answers, remembered values, built-ins, "+ New variable"); "Custom emoji"
  (ID and a fallback emoji); "Part" (text parts).
- Right to left: each paragraph follows its own direction (like Telegram).
- A counter under the phone: "812 / 4096" (or "/ 1024" for captions) for the language shown, counted
  as the checks count it, red over the limit.
- In another language with no translation yet the bubble shows the default text greyed with
  "Not translated: click to write the <language> text".
- Two people typing in the same text both see each other's caret with their name.
- As built: code blocks and quotes are drawn as the look draws them; a spoiler shows its text while
  the text has the focus; an expandable quote stays open while editing; the toolbar's tools open
  their forms in the toolbar ("Link", "Date and time", "{ } Insert" with "+ New variable", "Custom
  emoji", "Part"); "Expandable quote" shows inside a quote; plain text with Telegram HTML or known
  `{name}` placeholders is pasted through SPEC-02's converters.

### 5.3 Buttons and keyboards
- Below the bubble: "+ Inline buttons" or "+ Bottom keyboard" (one of them, as in Telegram), and
  "More": "Remove the bottom keyboard", "Force a reply".
- Inline keyboard: each button shown in its look; "+" at the end of a row adds a button, "+ row"
  under the last row adds a row; drag buttons to reorder within and between rows.
- Click a button: its popover:
  - "Text" (per language; emoji allowed), "Look": four swatches "Default", "Blue", "Green",
    "Red" (Telegram's names in small type: primary, success, danger), "Icon": "None" or "Custom
    emoji" (ID and fallback emoji).
  - "When pressed": "Go to a step" (pick from a list or "draw on the map"; "Back", "Stay
    here"), "Open a link", "Copy text", "Log in on a website"; (S2) "Pay" on invoices.
  - For "Go to a step": "Show it by": "Editing this message" (default), "Sending a new
    message", "Deleting this one and sending a new one"; "Popup": "None", "Small toast",
    "Alert window" with its text; "Also remember" (optional remember actions).
  - "Delete button".
- Bottom keyboard: the same rows; each button: text, look, icon, "When pressed": "Sends its
  text" (with "Goes to"), "Share phone number", "Share location", "Pick users", "Pick a group or
  channel", "Create a poll", each with its options and "Save it as" (a variable); keyboard
  options: "Hide after one press" (one-time), "Always shown" (persistent), "Fit to buttons"
  (resize), "Hint in the input field".
- Drag a row part from the palette onto the keyboard to use it; a used part shows a dashed
  outline and its name; its menu: "Edit the part", "Detach".
- As built: the keyboards are drawn in the look's own classes, the editor's marks over them: "+"
  beside a row's last button while the pointer is over the keyboard, "+ row" as a dashed bar, both
  gone at the catalog's limits with a tip; a new button is "Button", its popover open with the text
  chosen. The popover opens beside the button and follows the selected button (a click on a pill on
  the map selects it too); "Draw on the map" brings the step into view; the keyboard's last button
  takes the keyboard with it. "More" has, without buttons, "Remove the bottom keyboard" and "Force a
  reply" (with "Hint in the input field"), for a bottom keyboard its four options, and for both
  keyboards "Open the reply field". A row part's menu has "Edit the part" (PARTS-01) and "Detach". Every button's label
  takes its direction from its first letter, as Telegram's apps (17 section 11): "🛒 خرید" draws right
  to left with the emoji and the custom emoji icon on the right, while the mark of a link or copy
  button stays where the look draws it.

### 5.4 Media
- Click the media area: "Upload a file" (drop or pick; checks type and size), "Use a
  placeholder" (description, for example "photo of the product"), "Use a file already in this
  design". Placeholders show as a grey box with the description.
- Album: thumbnails in a row; drag to reorder; "+" adds; each item its caption and spoiler.
- Location and venue: latitude and longitude fields with a "Paste a map link" helper (Google,
  Apple, OpenStreetMap link to coordinates; no map tiles are loaded); the bubble shows a plain
  map card.
- As built: a click on the media opens its editor beside the phone; the upload shows its progress
  and the server's message; "Use a file already in this design" lists files of the same kind; "Add a
  caption" for a media message or an album without one. Album: drag or Space and the arrow keys to
  reorder, "Remove this item" down to 2; the caption the bubble shows is written in the bubble. The
  bubble draws files, sounds and voice messages as rows, round videos as circles, stickers, a plain
  map card (coordinates; a venue's name and address) and a contact card; "Paste a map link" also
  reads a typed "latitude, longitude".

### 5.5 Options (under the phone)
- "Silent (no sound)", "Protect (no forwarding or saving)", "Link preview": "Automatic", "Off",
  "Use this link", "Small", "Large", "Show above the text"; "Message effect" (the six Telegram
  effects with their emoji); "Before sending": "Show typing..." (or "sending a photo..." and the
  other chat actions) for N seconds, "Wait N seconds"; "Then" (go on to another step without a
  click: draw on the map or pick).
- As built: also "Caption above the media" and "Hide under a spoiler" for photos, live photos,
  videos and GIFs; "Link preview" only for a text; "Before sending" takes 1 to 60 seconds each;
  "Then" lists the steps by title (not start points, notes, sections or the step itself). The pane
  scrolls to the options under the phone.
- As built (RICH-01): "Write it out like a draft" on text and rich messages.
- As built (RICH-02): under "Write it out like a draft" on a message step, "Let the user stop it",
  then "Keep what was written" and "If the user stops it" (Go on to another step when the user stops
  it.).

## 6. Logic step forms

- **Question**: the prompt message is edited on the phone like a message; the form under it:
  "Expects": Text, Number, Email, Phone number, Location, Photo, Video, File, Voice, Audio,
  Anything; checks for that kind ("At least / at most N characters", "Between A and B", "Whole
  number", "Max file size", "File types"); "Save the answer as" (variable); "Wrong answer":
  message (rich text), "Try at most N times", "Then go to"; "Cancel word" per language and
  "Goes to". Dots on the map: "Valid answer", "Wrong N times", "Cancel".
- **If**: a list of cases, each "Case name" and its conditions as sentences: "[saved answer]
  [is at least] [18]", "[User is admin] [is yes]", "[The user's language] [is] [Persian]", "[The
  user] [is a member of] [@channel]"; "all of these" or "any of these"; "+ Case"; "Otherwise".
- **Remember**: lines "[Set] [cart_count] [to] [0]", "[Add] [1] [to] [cart_count]", "[Clear]
  [coupon]", "[Append] [{answer}] [to] [notes]".
- **Wait**: "Wait [2] [hours]"; "If the user does something before the time is up": "Stop
  waiting" (default) or "Still go on".
- **Developer step**: "What the developer does" (multi-line), "Uses" (variables), "Gives back"
  (variables, "+ New variable"), "Outcomes" (named, at least one; "Done" by default).
- **Go to**: the target step. **End**: no fields ("The conversation ends. The next message goes
  to 'Anything else'.").
- **Start points**: Command: "/command" (lower case letters, digits, `_`), "Show in the commands
  menu", "Menu text" per language; Start link: "Link text after ?start=", "Exactly" or "Starts
  with", "Save the rest as"; the full link is shown with a "Copy" button using the design's
  bot username if set in Bot setup, else `t.me/yourbot`; Anything else: "Text only", "Media
  only", "Anything".
- As built: a command's field lower-cases what is typed and shows the catalog's rule; "Save the rest
  as" shows for "Starts with" only and "Exactly" clears it; the full link is
  `https://t.me/<username>?start=<text>`; a start point's title follows its trigger while it is the
  one the trigger gave it ("/help").
- **Note**: text and color. **Section**: title and color.
- As built: every logic form, and a question's, starts with "Title" (the box's name). A step's
  arrows (a case, "Otherwise", an outcome, "Then") can also be chosen in its form. A value in a
  condition or a Remember line is typed: a number, yes or no, a text, or `{name}` for a variable.
  "Cancel word" is in the language the top bar shows. A condition's first select also has "+
  Switch", which makes a yes or no test switch. A question that expects another kind of answer keeps
  only that kind's checks, and its answer variable takes that kind's type.
- As built (PAY-02): an invoice shows its card on the phone with its buttons edited in place
  (Telegram's own pay button and "+ Inline buttons" while it has none; "Pay" in the popover on
  invoices only) and its form under it: Invoice (Title, Invoice title, Description, Photo), Price
  (Telegram Stars or Card with its code, the price lines, "+ Price line", the total, "Subscription
  (every 30 days)" with its line on the invoice link), Physical goods (what the sheet asks for,
  flexible shipping and its options), Pre-checkout check (what the developer checks, OK and Refuse
  with its message), Paid (Goes to, Payload, Silent, Protect). A subscription shows as a message with
  its link buttons. The Action form has Refund (the invoice) and Then; a payment start point has
  Invoice ("Any invoice"); a condition says "[The user] [has paid] [invoice]" or "[is subscribed to]
  [invoice]".
- As built (EVT-02): the Action form has "Does" (Set a reaction, Pin a message, Unpin a message,
  Delete a message, Send a gift, Show a chat action, Refund a payment) and the kind's fields: a
  reaction's Emoji (Telegram's reaction emoji), On (the user's last message or a step's message) and
  Big animation; the Message of a pin, an unpin (or the newest pinned message) or a delete; a gift's
  card with its text written in place (only the formatting a gift keeps, "0 / 128"), Which gift (in
  words) and Also pay for the upgrade; a chat action's Show. Subscription changed has Invoice and
  Change (Any change, Canceled, Turned back on, Could not be paid); User blocks the bot and User
  restarts the bot say what they take; Broadcast has Who gets it (Everyone, or Some users with
  conditions) and When (in words). Wait: under "Stop waiting", "Only once these hold" makes a
  reminder with conditions as in If.

## 7. Bot setup tab

- "Bot username" (for start links in the docs only; optional), "Name", "About" (short
  description), "Description" (shown in an empty chat), profile photo, each per language with
  counters ("12 / 64", "80 / 120", "300 / 512").
- "Commands menu": the command start points in order (drag to reorder), each with its menu
  text per language and "Show in menu"; "+ Command" creates a start point.
- "Menu button": "Commands list" or "Telegram default".
- Previews: the empty chat screen ("What can this bot do?" with the description and the Start
  button), the commands menu as Telegram shows it, the profile page.
- As built: the texts edit the language chosen in the top bar; the previews are "Empty chat" and
  "Commands menu" (the profile page waits for the preview), chosen by a switch or by where the focus
  is; "+ Command" adds a command shown in the menu under the other start points; the photo is a JPEG
  or an MP4 (`botPhoto`).

## 8. Try it

- "Try it" turns the phone into a full Telegram chat screen in the chosen look (wallpaper,
  header, bubbles, keyboards, input field, popups exactly as in the Telegram app) and dims the
  editing tools; the look and theme switches stay available; "Stop trying" returns.
- Start: a picker "Start from": "/start", any command, any start link (with the payload), "A
  message the bot does not expect"; (S2) events.
- Test user panel (beside the phone): "Language" (the design's languages), every test switch
  ("User is admin: yes/no", "Has paid: yes/no", ...), built-in values (first name, username),
  "Reset".
- The chat behaves like Telegram: bot messages appear (with the typing indicator and delays,
  speedable: "Skip waits"), inline buttons act as designed (edit, new, replace, popups as
  Telegram's toast or alert), the bottom keyboard appears, the input field takes typed answers
  for questions (checks and wrong-answer messages included), share buttons offer a test phone
  number or location, file questions take "Send a test photo/file".
- "If": decided by the test switches and variables; when it cannot be decided, a small card
  asks "Which way?" with the cases. "Developer step": a card "The developer does: <description>.
  What happened?" with its outcomes. "Wait": a card "Waiting 2 hours" with "Skip the wait".
- The path lights up on the map; "Step back" undoes the last action; "Restart"; the right side
  lists variables with their current values.
- (S2) polls and quizzes can be answered, dice roll a random value, invoices show Telegram's
  payment sheet mock with "Pay (test)" and "Cancel", events can be fired from a menu ("User blocks
  the bot", "User restarts the bot", "Time passes").
- As built (MSG-02, engine): a poll or quiz with "Then" waits for the tester's vote and goes on after
  it; a quiz answered wrong shows its explanation as a toast; a dice rolls the test user's value,
  else a random one; paid media is locked until "Pay (test)".
- As built (PAY-01, engine): an invoice's pay button opens the payment sheet; "Pay (test)" (with a
  shipping option for flexible shipping) runs the pre-checkout check as a card with "OK" and
  "Refuse", then "Paid" or a "Payment done" start point; "Cancel" closes it; a refund gives the
  payment back; "has paid" and "is subscribed" follow what was paid while trying.
- As built (MSG-03): an option press votes (several answers: picks, then "Vote"), the results show
  the tester's vote and a quiz's right and wrong options; paid media's price button opens "Unlock for
  ⭐ N" with "Pay (test)" and "Cancel"; the test user panel has "Dice value" ("Random" when empty).
- As built (RICH-01): a message written out like a draft appears as it is written (1.5 seconds), then
  whole; "Skip waits" shows it at once.
- As built (RICH-02): a press on a button inside a rich message works like an inline keyboard's. A
  draft with a stop button is written with a "Stop" card over the chat: Stop keeps what was written
  ("Keep what was written") or removes it, and goes to "If the user stops it"; otherwise the message
  goes out whole.
- As built (PAY-02): the pay button opens the payment sheet over the chat in the look's colors:
  Checkout (Confirm Your Purchase in Stars), the invoice, its price lines and Total, what it asks
  for, Shipping Method with the options (the first chosen), "Pay (test)" and "Cancel".
- As built (EVT-01, engine): actions react, pin, unpin, delete, send a gift or show a chat action in
  the chat; "User blocks the bot" runs its start point and nothing reaches the user until "User
  restarts the bot"; "Time passes" skips the wait; a reminder stops once its conditions hold; a
  broadcast skips a test user outside its audience.
- As built (EVT-02): "Events" beside "Start from": "User blocks the bot" (Restart in the input
  field's place until pressed), "User restarts the bot", "Time passes", the broadcasts and
  subscription changes, fired on the chat as it is. The bot's reaction shows on its message, a pinned
  message in the bar under the top bar, a gift as its card, a chat action step in the top bar for 5
  seconds.
- The engine (`createSim` in `packages/spec`) is a pure state machine: every action returns a new
  state, so "Step back" is the previous state. When an "If" cannot be decided, the card offers only
  the ways still possible; "is a member of @channel" is decided by a yes/no test switch whose label
  names the chat. A message with a delay or a chat action waits for the phone's timer (or "Skip
  waits"). At most 100 steps run without the tester acting; then Try it stops with "Stopped: the
  steps go round in a loop".
- As built: "Try it" turns into "Stop trying" while trying; above the phone "Start from", "Step
  back", "Restart", "Skip waits", "Test user" (a sheet under 1280 pixels) and "Stop trying"; the
  empty chat shows "Start from" as a card and its Start button starts from /start. The chat's
  buttons, commands menu and input field act as drawn by the look; the clip offers "Send a test
  photo", "Send a test video", "Send a test file", "Send a test voice message", "Send a test audio
  file", "Share the test phone number" and "Share the test location", and a question that expects
  one of them shows its button over the chat. A delay waits, then shows the chat action, then the
  message. What each action did shows in small lines under the phone. The palette is dimmed;
  Ctrl+Enter runs from the selected step, also one that is not a start point.

## 9. Checks panel

- "Checks" opens a side list grouped by level: "Errors" (Telegram cannot do this), "Warnings",
  "Good to know". Each line: the step and button, the language, the message; click jumps to it
  and selects it. Filter by language. A check can be marked "Ignore here" (stored in the design,
  listed in the export as ignored, never for errors).
- As built (CHK-01): "Checks" opens a sheet on the right with "Errors" (the note "Telegram cannot do
  this"), "Warnings" and "Good to know", each with its count, then "Ignored" greyed with "Stop
  ignoring"; "No problems found" when empty. A line shows the step's title ("Bot setup" for the
  bot's own texts and photo), the button's text, the language code and the message. A click closes
  the sheet, shows the Map in the line's language and selects the step and the button; a line
  without a step opens Bot setup. "Ignore here" and "Stop ignoring" are for people who can edit and
  undo with Ctrl+Z. The filter ("All languages" or one language) shows with two or more languages.
  The checks run once per open design for the count, the panel and the map's dots, 200 ms after the
  last change, in a web worker above 100 steps.

## 10. Texts tab (translations)

- A table: rows are every text in the design (message texts, captions, button labels, popups,
  placeholders, wrong-answer messages, bot setup texts), grouped by step; columns are the
  languages; cells editable (rich texts open the same small editor); "Only missing" filter;
  counters per language ("fa: 12 missing").
- "Copy the default language into empty cells" for a quick start (marked as not translated
  until edited).
- As built: groups "Bot setup", then each step with texts in map order, then each part (a row part's
  buttons only there); a missing cell follows the checks' W03 and says "Missing"; a copied text
  shows in italics until its words change and counts as missing; rich cells open the phone's editor
  in a bubble in a popover; 100 rows, then "Show more". "Languages..." (in the language switch and
  on this tab) lists the languages with "Default" and "Remove" ("Remove Persian? Its texts in this
  design are deleted.") and "Add a language".

## 11. Variables and test switches

- A panel from the palette "Variables": built-ins (read-only), saved answers, remembered values,
  developer outputs; each with ID name, label, type, where it is set and used (click to jump),
  test value; "+ Variable".
- "Test switches": label, type (yes/no or choice), test value, "How the developer knows it"
  (text); "+ Switch".
- As built: one panel with the tabs "Variables" and "Test switches", from the palette's two entries;
  "Set in" and "Used in" list the steps as the checks count them and a click selects the step on the
  map; "+ Variable" offers "Remembered value" or "Developer output"; switches list the If steps that
  use them; deleting one that a step uses asks first.

## 12. Parts

- "PARTS" in the palette: each part with its name and kind ("Buttons" or "Text"), uses count;
  "+ Part" (from a box's buttons, or empty); click opens the part editor (a small phone with just
  the rows or the text); editing changes every use at once; "Uses" lists where it is used.
- As built: each part shows its kind and uses ("Buttons, 3 uses"); "+ Part" offers "Inline buttons",
  "Bottom keyboard", "Text" and "From the selected box's buttons", and the box menu's "Make a part
  from its buttons" moves the box's own rows into the part in their place; a row part dragged onto a
  keyboard on the phone lands in front of the row under the pointer (a message without buttons gets
  the part's keyboard), a text part dragged into a text lands where it is dropped. The part editor
  is a sheet on the right with "Name", "ID name", the small phone (a row part's rows without a
  bubble, a text part in a bubble), "Uses" (a click selects the step on the map; "Detach" beside
  each step) and "Delete part", which asks "Delete <name>? Its <n> uses get their own copy." while
  the part is used.

## 13. Phones and small screens

- Under 900 pixels wide the editor shows the map or the phone (switch at the bottom) and is
  read-only with a note "Editing works on a computer screen"; Try it and (S2) comments work.
- Designs, Account and Sign in pages work at phone width.

## 14. Keyboard shortcuts

Ctrl+Z undo, Ctrl+Shift+Z or Ctrl+Y redo, Ctrl+C / Ctrl+V copy and paste steps, Ctrl+D
duplicate, Delete delete, Ctrl+F search, F fit, Ctrl+Enter Try it from the selected step,
Esc close a popover or leave Try it, arrow keys nudge selected boxes, C comment mode (S2).

As built: the dialog also lists "Shift+click or Shift+drag" to select several boxes; Shift with an
arrow key moves 50 pixels.

## 15. Stage 2 additions to the editor

- **Comments** (05 section 6): a "Comment" mode (C) to click on a box or a button and write;
  pins on the map and the phone; a "Comments" panel with "Open" and "Resolved", threads,
  replies, "Resolve", "Reopen"; a bell in the top bar with unread counts and "@name" mentions.
  As built (CMT-02): "Comment" in the top bar and C turn comment mode on (Commenter and above; Esc
  leaves it); a click on a box, a button's pill or the empty map, or on the phone's bubble (its text
  in the language shown) or a button opens the "Comments" panel with a new thread there; the phone
  is read-only in comment mode. "..." > "Comments" and a pin open the panel. Pins (numbered open
  threads) show for everyone: down a box's left edge, at a map spot, on the phone's bubble and
  buttons. The panel's "Open" and "Resolved" list threads newest first with "Reply", "Resolve",
  "Reopen", "Edit" and "Delete" in a comment's menu; a thread's place selects its step or button on
  the Map. Opening the panel marks the design read. The bell is in the site's and the editor's top
  bars; the Designs cards show the unread count.
- **History** (05 section 7): a panel listing versions ("Automatic", named ones in bold, who
  and when); click opens the version read-only in the editor with a banner "You are looking at
  <name or time>. Restore this version / Compare with now / Back to now"; "Name this version";
  "Compare" lists added, removed and changed steps with old and new texts side by side.
  As built: "History" and (Editors) "Name this version" are in the "..." menu; the panel's rows show
  the kind ("Automatic", the name in bold, "Before restore", "Restored"), who and how long ago, and
  a menu with "Export", "Rename" and "Delete" for named versions (Editors rename, the design owner
  deletes). A version opens in the editor itself: every tab and Try it show it read-only under the
  banner. "Restore this version" asks first; afterwards every open editor shows "This design was
  restored to an earlier version.", forgets its undo history and starts its panes again. "Compare
  with now" lists "Added", "Removed" and "Changed" steps in map order with the version's texts
  beside now's, "Other changes" for anything else in a step, and "Also changed" for Bot setup,
  languages, variables, test switches and parts; moving a box is not a change.
- **View-only link** page `/v/<token>`: the map (no editing tools), the phone, Try it, the look
  and language switches, "Export"; no account needed, no comments.
- **Templates gallery** `/templates`: built-in starter templates ("Shop with Stars", "Support desk",
  "Quiz", "Sign-up form", English and Persian) and the server's own; each with a picture,
  description and "Use this template" (a new design of the person's, opened in the editor); a
  design's menu (Designs and the editor's "...") "Save as template" saves a copy with a name and
  description; the person who saved it and the site owner can remove it.

## As built (M2)

**WEB-01** (614ed73, f7f797c, b6d8b1d).

Code: Design system: `apps/web/src/components/ui/` (the 28 components of the brief, copied from
xWriter's `web/src/components/ui/`), with their helpers under the same names: `src/lib/utils.ts`
(`cn`), `src/lib/useMediaQuery.ts`, `src/lib/useSheetDrag.ts`, `src/components/viewOnly.ts`,
`src/components/plainText.ts`, `src/components/HelpTip.tsx`, `src/components/InfoTip.tsx`; Tokens
and motion: `src/styles/app.css` (xWriter's tokens, Light and Dark, the type scale, springs,
sonner's look), `src/styles/components.css` (the design system's motion), `src/styles/variants.css`
(shadcn's data-* variants), `src/styles/index.css` (the entry); `src/app/theme.ts` (the `dark`
class), `src/app/motion.ts` (`data-motion`); API client: `src/api/client.ts` (`call`, `ApiError`,
`onSignedOut`, `apiKey`, `apiQuery`, `useApi`, `useApiMutation`); Session: `src/app/session.ts`
(`requireMember`, `requireSiteOwner`, `watchSessionEnd`, `safeNextPath`, `SessionContext`, `useMe`);
Shell: `src/app/AppShell.tsx` (top bar, avatar menu, content area), `src/routes/__root.tsx` (the
toaster), `src/routes/_app.tsx` (the signed-in layout), `src/main.tsx` (CSPProvider,
TooltipProvider, query defaults); Pages: `src/routes/sign-in.tsx`, `src/routes/invite.$token.tsx`,
`src/routes/reset.$token.tsx`, `src/routes/_app/account.tsx`; placeholders
`src/routes/_app/index.tsx` (Designs), `members.tsx`, `settings.tsx`, `maintenance.tsx` with
`src/components/ComingPage.tsx`; Pieces: `src/auth/AuthFrame.tsx` (the frame and card of the public
pages), `src/components/forms.tsx` (`TextField`, `FormProblem`), `src/components/PersonAvatar.tsx`,
`src/lib/colors.ts` (the 10 colors), `src/lib/devices.ts` (device names, "3 hours ago"); Config:
`apps/web/vite.config.ts` (the `@` alias, sonner's style injection removed in builds),
`apps/web/tsconfig.app.json` (`paths`), `apps/web/package.json` (@fontsource-variable/noto-sans and
vazirmatn 5.3.0, already in the store), `eslint.config.js` (fast refresh rule off for
`components/ui`, as in xWriter); Sanity runner: `tools/sanity/sanity.sh` writes each "$" of a
changed file name as `\$$` in `CHANGED_FILES`, so make and the recipe's shell both pass
`invite.$token.tsx` on unchanged (make had expanded `$t` and the lint step failed on
"invite.oken.tsx").

- The web app imports with `@/` (`@/components/ui/button`), as xWriter's panel does, so its
  components copy unchanged. The design system keeps xWriter's file and export names and comments
  (their section numbers are xWriter's plan); changes: `field.tsx` lost the search anchor
  (`findKey`, `data-find`), `sonner.tsx` names the CSP instead of a nonce.
- Theme: Light or Dark as the system says, followed live, until the person presses the top bar's sun
  and moon button (THEME-01: saved as `users.theme`, kept in the browser for the first paint; the
  phone keeps its own). Motion: `data-motion` on `<html>` is `reduced` where the device asks for less motion and
  `off` while the tab is hidden, as in xWriter, without its Animations setting.
- Styles: xWriter's tokens without its brand names and xWriter-only tokens (chart, outcome,
  calendar, avatar hue, rail and sidebar tokens, the bottom bar, the live dot, route transitions,
  the Home strip). shadcn's variants are a copied file (`variants.css`), not the shadcn package;
  tw-animate-css is not needed (no component uses it).
- CSP: Base UI runs under `CSPProvider disableStyleElements` and sonner's injected `<style>` is
  removed at build (xWriter's Vite plugin), so `style-src 'self'` holds; sonner's CSS is part of
  app.css.
- Routes: the signed-in pages live under the pathless layout `routes/_app.tsx`; Designs is
  `routes/_app/index.tsx` (was `routes/index.tsx`). `/members`, `/settings`, `/maintenance` send
  members who are not the site owner to `/`.
- Client: `call(route, { params, query, body }, { signal })` fills `:name` path parameters, sends
  JSON, checks the answer with the route's response schema and throws `ApiError { status, code,
  message }`; any error code string is accepted, so codes AUTH-01 adds (`bad_origin`,
  `confirm_needed`) keep their message. No server: status 0, code `network_error`. Query keys are
  `[route.key, input ?? null]`; invalidate a route with `{ queryKey: [routes.x.key] }`. Queries
  retry twice on network or 5xx failures only; stale after 30 s.
- Session end: a 401 `not_signed_in` from a route that is not public, once the tab knew the session,
  shows the server's message ("Sign in to continue.") as a toast, goes to `/sign-in?next=<page>` and
  clears the query cache. Without a known session the layout's guard redirects quietly. `GET
  /api/me` refetches when the tab gets the focus again (after 30 s), so an ended session shows up
  there too.
- Top bar: from 760 px one row (site name, links, avatar); under 760 px the links take a second row
  that scrolls sideways. The avatar menu shows the name and email above "Account" and "Sign out".
  The toaster is in the root route (bottom end from 760 px, top on phones), so the public pages have
  toasts too.
- Sign in: after success the page goes to `next` (checked to be a path of the site) or `/`. Invite:
  any 4xx refusal of the link (except 429) shows "This invite link was used or has expired. Ask the
  owner for a new one."; after "Create my account" the member is signed in and goes to `/`. Reset:
  after "Save password" the page goes to the sign-in page with a toast.
- Account: "Save" for the name; a color is saved when picked; the email is read only (with "Only the
  site owner changes emails." for members); "Change password" with "Current password" and "New
  password"; "Sessions" lists this device first ("This device", no button), the others with "Last
  used <time>" and "Sign out"; "Sign out everywhere else" is off when there is no other session.
- Texts the plan does not write: "Name saved.", "Password changed.", "Password saved. Sign in with
  it.", "Used for your cursor.", "Only the site owner changes emails.", "The two passwords are not
  the same.", "Password again", "Current password", "New password", "This device", "Last used
  <time>", "Unknown device", "Skip to content", the placeholders "Comes with WEB-02." (Designs,
  Members), "Comes with WEB-02 and WEB-03." (Settings), "Comes with WEB-03." (Maintenance), the
  titles "Invite" and "Reset" over a link that does not open, and the client's "The server could not
  be reached. Check your connection and try again.", "Something went wrong on the server. Try
  again.", "The server sent an answer this page does not understand. Reload the page."

**WEB-02** (c9e6d17, d3c42e9).

Code: Designs: `apps/web/src/routes/_app/index.tsx` (header, "Search designs", the chips as the
page's `filter` search, the grid, empty lists, the menu's actions), `src/designs/DesignCard.tsx`,
`src/designs/NewDesignDialog.tsx`, `src/designs/RenameDesignDialog.tsx`, `src/designs/roles.ts`
(role names); Share dialog: `src/designs/ShareDialog.tsx`, `ShareDialog({ design, onOpenChange })`
(open while `design` is set), for the Designs page and EDIT-01's top bar; Editor placeholder:
`src/routes/_app/d.$id.tsx` (the design's name and "The editor comes next."), the one file EDIT-01
replaces; Members: `src/routes/_app/members.tsx`, `src/members/InviteDialog.tsx`,
`src/members/RemoveMemberDialog.tsx`, `src/members/ShownLink.tsx` (a link shown once with "Copy"),
`src/members/member.ts`; Settings: `src/routes/_app/settings.tsx` (site name, upload limit, the
HTTPS placeholder, Activity), `src/settings/activityText.ts` (each audit action in words);
Languages: `src/lib/languages.ts` (132 languages from xWriter's `internal/lang/languages.json`, CLDR
48.2, with lower-case codes, English and native names, `rtl`, other names; `findLanguage`,
`languageName`, `searchLanguages`), `src/components/LanguagePicker.tsx` (`LanguagePicker`,
`RtlBadge`) for LANG-01 too; Copied from xWriter's web app: `src/components/ConfirmDialog.tsx`,
`src/components/CopyButton.tsx`, `src/components/EmptyState.tsx`, `src/lib/clipboard.ts` (without
test IDs); Pieces: `src/components/LaterButton.tsx` (an off button with its reason as tooltip),
`src/lib/time.ts` (`timeAgo` moved here from `lib/devices.ts`, now in the browser's locale;
`formatDate`, `formatDateTime`), `src/lib/useDebounced.ts`, `src/lib/useLast.ts`;
`src/app/AppShell.tsx`'s "Designs" link stays active with a filter in the address.

- Designs: the header has "Designs", "Import" (off, tooltip "Comes with export") and "New design";
  under it "Search designs" (sent 250 ms after typing stops, at most 100 characters) and the chips
  "All", "Mine", "Shared with me", "Trash", which scroll sideways on phones. The chip is kept in the
  address (`/?filter=trash`, none for All); the search is not. While a new list loads the old cards
  stay, dimmed.
- Cards: a neutral tile where the map's picture comes later, the name (the whole card opens
  `/d/<id>`), the design owner's name with the person's role ("Owner", "Editor", "Commenter",
  "Viewer"; "Site owner" on someone else's design for the site owner), "Edited <time> by <name>" (in
  Trash "Deleted <time>"), and "<n> steps · <languages in English>". The menu: "Open", "Rename"
  (design owner and site owner), "Duplicate", "Share" (design owner and site owner), "Export" (off,
  "Comes with export"), "Delete" (design owner and site owner); in Trash "Restore" and "Delete
  forever".
- Delete asks first (17 section 9), then moves the design to Trash with the toast "Moved <name> to
  Trash." and "Undo" (restores it); "Restore" toasts "Restored <name>."; "Duplicate" toasts "Made <name> (copy).";
  "Delete forever" asks "Delete <name> forever?" with "This cannot be undone." and "Delete forever".
- New design: "Name", "Default language" (English preselected) and "More languages" (chips with a
  remove button and "Add a language"), each language from a searchable list with its English name,
  its own name, its code and "RTL" for right-to-left ones (search by English or native name, code or
  other name such as "Farsi"); "Create" makes it and opens `/d/<id>`. Until EDIT-01, `/d/<id>` shows
  the design's name, "The editor comes next." and "Back to Designs" in the shell.
- Share: title "Share <name>"; "People with access" lists the design owner as "Owner", then each
  member with a role drop-down and "Remove" (both take effect at once); "Add people" searches
  members by name or email ("Name or email", up to 20, those with access left out), a role ("Editor"
  first) and "Add"; then "Not on the site yet? Ask the owner to invite them." For the site owner the
  drop-down also has "Owner": "Make <name> the design owner?" with "<owner> becomes an Editor." and
  "Make owner" (transfer).
- Members: "Invite someone" at the top; "Members" lists each person with avatar, name ("(you)",
  "Site owner", "Disabled"), email, "Last seen <time>" or "Not seen yet", and "<n> designs" or "No
  designs"; the menu (not on the site owner): "Make a password reset link" (off for a disabled
  member) shows the link once with "Copy" ("Send this link to <name>. It works once, for 24 hours,
  and is shown only now. All their sessions end when they set the new password."), "Disable" asks
  "Disable <name>?" ("Their sessions and live connections end at once. Their designs stay and keep
  their sharing; Enable restores access."), "Enable" runs at once, "Turn off two-factor authentication" (only while it is on, 17 section 7),
  "Remove" asks "Remove <name>?"
  and, when they own designs, "Move their designs to" (enabled members, the site owner preselected).
- Invites: "Invite someone" has "Note (optional)" (placeholder "Sara, designer") and "Email
  (optional)" ("The invite page fills it in."), "Create invite link", then the link once with "Copy"
  ("Send this link to the person. It works once, for 7 days, and is shown only now.") and "Done".
  "Invites" lists the waiting ones: the note (or email), "Waiting", "Made <time> · Valid until
  <date>", "Revoke" (at once). Used, expired and revoked invites are not listed.
- Settings: "Site name" and "Upload limit (MB)" ("The largest file a member can upload.") with
  "Save" ("Settings saved."; the top bar's name follows); "HTTPS" with "Comes with the server
  helper."; "Activity" with "Person" ("Everyone" or a member) and "Design" ("All designs" or a
  design not in Trash), each row the action in words, then who, the design and the date and time;
  under the list the pager (18 section 6, ACT-01): "Rows per page" (10, 25, 50 or 100; 25 to
  start, kept in this browser), "Rows 26 to 50 of 312", "Previous", the page numbers with the open
  one marked and "Next" (only the arrows under 640 pixels wide); the open page is the address's
  ?page=, a filter or size change goes back to page 1, and a page past the end opens the last page.
- Activity words: "Signed in", "Failed sign-in as <email>" (" (disabled)"), "Became the site owner",
  "Made an invite for <note or email>", "Revoked an invite for ...", "Joined with an invite", "Made
  a password reset link for <name>", "Set a new password with a reset link", "Got a new password
  from the server", "Changed their password", "Disabled <name>", "Enabled <name>", "Removed <name>"
  (" and moved their designs to <name>"), "Created the design", "Renamed the design from <a> to
  <b>", "Duplicated <name>", "Moved the design to Trash", "Restored the design from Trash", "Deleted
  <name> forever" (" after 30 days in Trash"), "Made <name> the design owner instead of <name>",
  "Shared the design with <name> as <role>", "Changed the role of <name> from <role> to <role>",
  "Removed <name> from the design"; an unknown action shows its code. Who: the name, "A removed
  member", "Someone" (a failed sign-in with an unknown email) or "The site" (Trash's job); a gone
  design is "A deleted design".
- Times: "just now", then the browser locale's relative words ("5 minutes ago", "yesterday"), a date
  from 30 days back; a time's tooltip and the Activity list show the date and time in the browser's
  locale. Account's sessions use the same words.
- Other texts the plan does not write: "Menu of <name>", "Role of <name>", "Search members by name
  or username", "No member matches.", "Name or username" (the Members page's search), "Show the
  password" (the eye of the password fields), "Username saved.", "Choose a language", "Search by name or code", "Search
  languages", "No language matches.", "Remove <language>", "No design matches.", "Trash is empty.",
  "Deleted designs stay here for 30 days.", "Nothing is shared with you yet.", "No designs yet.",
  "No invites are waiting.", "Nothing here yet.", "Invite link", "Password reset link", "The link
  works once, for 7 days.", "They own <n> designs, which go to the member you pick.", "They can no
  longer sign in. This cannot be undone.", and the copied components' "Copy", "Copied", "Copying
  failed. Select the text and copy it by hand.", "Working...".

## As built (M3)

**PRV-01** (b6224e5, 98267b7).

Code: The port: `packages/preview/src/core/` (`types.ts`, `registry.ts`, `PreviewFrame.tsx`) and
`packages/preview/src/platforms/telegram/` (skins and tokens, entities, emoji, fonts, bidi, media,
albums, keyboards, wallpapers, art, rich messages, fixtures), copied from xWriter's
`web/src/preview/` with the fonts, the art and their `NOTICE.md` and license files; Local copies of
xWriter helpers: `packages/preview/src/lib/useNow.ts`, `packages/preview/src/lib/PremiumEmoji.tsx`;
Vite module types in `packages/preview/src/env.d.ts`; Input adapter: `packages/preview/src/adapt.ts`
(`adaptMessage`, `placeholderPicture` and the input shapes); One bot message:
`packages/preview/src/TelegramMessage.tsx`; exports in `packages/preview/src/index.ts`
(`TelegramMessage`, `adaptMessage`, `placeholderPicture`, `telegramLooks`, the input types,
`SkinId`, `PreviewTheme`, `TgPreviewPost`); Emoji images: `apps/web/scripts/emoji-plugin.ts` (the
virtual module `virtual:emoji-index`), registered in `apps/web/vite.config.ts` and typechecked
through `apps/web/tsconfig.node.json`.

- Copied as they are: `core/types.ts`, `core/registry.ts`, `core/PreviewFrame.tsx` and all of
  `platforms/telegram/` except `DirectionLines.tsx`. Left out: xWriter's panel parts
  `core/PreviewPane.tsx` (the toolbar), `core/usePreviewPrefs.ts` (its stored choices) and
  `platforms/telegram/DirectionLines.tsx` (the "Direction of each line" list), which use xWriter's
  shadcn components, storage and Tailwind theme; and the other platforms (X, YouTube, Instagram,
  Facebook, TikTok, social).
- Changes to the copied files, and nothing else: imports made relative; the `node_modules` path of
  `fonts/fonts.css` one folder shorter; `TelegramPreview.tsx` without the direction list; `model.ts`
  adds `bot` on the post (a bot's message in a private chat: no top bar, no channel name in the
  bubble on Desktop, no share button) and `icon_alt` on a keyboard button (the icon's fallback
  emoji); `Post.tsx` and `Keyboard.tsx` read them. Skins, tokens, CSS, fonts, emoji, wallpapers,
  album layouts, tails, marks and keyboards are xWriter's.
- xWriter's keyboard already draws the colored looks in every skin (Bot API 9.4 `style`: success
  green, primary blue, danger red), so no tokens were added: the adapter maps look `default` to
  `none` and `primary`, `success`, `danger` as they are.
- Button marks: `url` and `loginUrl` buttons have the link arrow, `copyText` the copy mark, `goTo`
  none; the link or the copied text is the tooltip. A button's icon (a custom emoji) shows its
  fallback emoji before the label; a custom emoji in the text shows its fallback emoji underlined
  with dashes. Both are xWriter's look for a premium emoji whose file it does not have
  (`lib/PremiumEmoji.tsx` always draws that, with the label "Premium emoji <emoji>").
- `adaptMessage(message, design, { lang, date?, varText?, mediaUrl? })` returns xWriter's
  `TgPreviewPost`. Text: a local walk of the rich document (until SPEC-02's `toTelegram`): blocks
  joined by `\n`, marks to entities (a run of nodes with the same mark is one entity), code block to
  `pre` with its language, quote to `blockquote` (collapsed when expandable), custom emoji to
  `custom_emoji`, `dateTime` to `formatted_date`, a variable as `{idName}` (or what `varText`
  gives), a text part's text in its place; a text missing in the language shows the default
  language's. Media: photo and live photo as photos, video and GIF as videos and GIFs, an album's
  photos and videos with its first caption; a placeholder, or a file without a `mediaUrl`, is a grey
  box with its description or file name (1280 x 720 when the size is unknown). Audio, voice, file,
  round video, sticker, location, venue and contact show their caption only. Inline keyboard: rows
  and row parts in order; a bottom keyboard is not drawn here.
- The input shapes in `adapt.ts` copy the parts of SPEC-01's model the adapter reads (a
  `MessageStep` or a `Prompt`, and a `Design`, fit them as they are); `packages/preview` does not
  depend on `packages/spec`.
- `TelegramMessage({ message, design, lang, skin, theme, date?, varText?, mediaUrl?, width?,
  maxWidth? })`: the bubble with its inline keyboard over the look's wallpaper, in its own shadow
  root, without the top bar and without views; the list starts at the look's own top gap
  (`list.top`). `telegramLooks`: `{ id, label }` in xWriter's order Web A, Web K, Desktop, Android,
  iOS.
- The emoji plugin serves the 64 px Apple PNGs in development and writes them (about 3,800 files, 20
  MB) to `assets/emoji-16.0.0/` only in a build that loads the preview; the preview loads them from
  under Vite's base (`/assets/...`).

**PRV-02** (e5ed931).

Code: Chat tokens: `ChatTokens` (`SkinTokens.chat`) and the chat colors in `SkinColors`, written as
custom properties by `chatProperties`, in `packages/preview/src/platforms/telegram/skins/tokens.ts`;
the values for Web A, Web K, Desktop, Android and iOS, light and dark, in `skins/web.ts`,
`skins/webk.ts`, `skins/desktop.ts`, `skins/android.ts`, `skins/ios.ts`, every group marked
`calibrate: O-02`; Chat stylesheet: `packages/preview/src/platforms/telegram/skins/chat.css`
(imported by `skins/preview.css`); each look's own chat rules at the end of `skins/web.css`,
`webk.css`, `desktop.css`, `android.css`, `ios.css`; The chat screen:
`packages/preview/src/platforms/telegram/Chat.tsx` (`ChatScreen`: bot top bar, rows, outgoing
bubbles, service lines, input field, bottom keyboard, commands menu, toast, alert, empty chat, Start
button); Message row and header: `platforms/telegram/Post.tsx` split into `TelegramPost` and
`PostRow` (one row, with `tail` and the slots); `ChatHeader` exported with a `status` and `typing`;
Slots: `platforms/telegram/slots.ts` (`Slot`, `MessageSlots`, `ChatSlots`); `TelegramMessage` takes
`slots` too; Chat model: `TgChat`, `TgChatRow`, `TgChatAction`, `TgReplyKeyboard`, `ReplyButton`,
`TgPopup`, `TgCommand` in `platforms/telegram/model.ts`; `chatActionLabel` in `skins/labels.ts`;
Input adapter: `adaptChat`, `menuCommands`, `ChatDesign`, `ChatEntry`, `ChatOptions` in
`packages/preview/src/adapt.ts` (reply keyboards, force reply and reply buttons added to the input
shapes); Frames: `packages/preview/src/TelegramChat.tsx` (`TelegramChat`, `EmptyChat`,
`CommandsMenu`, `ChatFrameProps`); exports and `telegramThemes` in `packages/preview/src/index.ts`;
Wallpaper: `Wallpaper` takes `screen` (a whole screen with its input field: nothing under it);
`wallpaper/android.ts` and `wallpaper/ios.ts` give the wallpaper's fill to service lines and the
empty chat's card, and iOS no longer to the user's bubbles.

- `TelegramChat({ entries, design, lang, skin, theme, action?, popup?, onPopupClose?, draft?,
  slots?, date?, varText?, mediaUrl?, width?, maxWidth?, height? })`: a whole private chat screen in
  a shadow root, as tall as the look's screen (Web A, Web K and Desktop 900, Android 829, iOS 852)
  unless `height` is given. `entries` are `{ type: 'bot', message }`, `{ type: 'user', text }` and
  `{ type: 'service', text }` (a date line such as "Today" is an entry the caller adds), each with
  an optional time.
- The top bar is the look's own bar (PRV-01's) with the bot's name, its photo (an uploaded
  `bot.photo` through `mediaUrl`) or the look's letters, and "bot" under it; `action` writes
  "typing", "sending photo", "sending video", "recording voice message", "sending file", "choosing
  location", "recording video message" or "choosing a sticker" in the look's typing color, with
  animated dots after it (Web A, Web K, Desktop), before it (iOS) or as "..." (Android).
- Bot messages are PRV-01's bubbles (`PostRow`); a message the same sender's next one follows has no
  tail, as in the apps. The user's messages are the incoming bubble mirrored (so each look's own
  tail rules draw on the right) in the outgoing colors, with links and emoji, the time and two
  checkmarks (bots read at once).
- The bottom keyboard follows the entries as Telegram keeps it: a bot's reply keyboard stays until a
  later one replaces or removes it (an inline keyboard leaves it), a one-time keyboard hides behind
  the keyboard button once the user answers, its placeholder shows in the input field, and a force
  reply's placeholder lasts until the user answers. Not resized, the panel takes the system
  keyboard's height and its rows stretch; resized, it is as tall as its buttons. A persistent
  keyboard that shows has no hide button in the input field; any other has the keyboard button. Web
  A and Web K draw it as a panel over the chat above the input field, the apps under the field in
  the system keyboard's place. Buttons take their looks and icons (the icon's fallback emoji, as
  PRV-01's inline buttons).
- The input field is each look's: a floating plate with a round button beside it (Web A, Web K), a
  bar with a line over it (Desktop, "Write a message..."), a glass island (Android) or a glass field
  (iOS), its parts in the app's order. The menu button is "Menu" when the design's menu button is
  "Commands list" and the commands icon when it is "Telegram default", and none while no command
  shows in the menu. The microphone shows on an empty field and send with a `draft`, as the apps do.
- A callback answer: a toast (Web A and iOS under the top bar, Desktop in the middle, Web K and
  Android above the input field) or an alert over the shaded chat with the bot's name as its title
  (not on Desktop) and "OK"; `onPopupClose` is the alert's button.
- `EmptyChat`: the chat without entries, the card "What can this bot do?" with the bot's description
  in the middle and the Start button in the input field's place (in capitals except on iOS, a filled
  button on iOS). `CommandsMenu`: the commands menu open above the input field over an empty chat,
  the command start points with "Show in menu" in Bot setup's order, each with its menu text (Web A,
  Web K with the bot's picture; the command before its description on Web A, Desktop and iOS, after
  it on Web K and Android).
- Slots (`slots.ts`): `Slot = (shown: ReactNode) => ReactNode` gets the read-only drawing (null
  where there is none) and returns what shows in its place. `TelegramChat` gives `text`, `media` and
  `keyboard` to its last bot message and `replyKeyboard` to the bottom keyboard; `TelegramMessage`
  takes `text`, `media` and `keyboard`. A text slot also draws where the message has no text yet,
  and a message with a text slot is never drawn as big emoji.
- `telegramThemes`: `{ id, label }` for "Light" and "Dark" beside `telegramLooks`.
- The input field's icons are xWriter-style SVGs drawn in the look's colors: the ported art has none
  for them.

**EDIT-01** (43ad623, 219a140).

Code: Route and layout: `apps/web/src/routes/_editor.tsx` (the editor's signed-in layout with
`_app`'s guard, no site top bar), `src/routes/_editor/d.$id.tsx` (`/d/$id` with the `tab` search);
WEB-02's placeholder `src/routes/_app/d.$id.tsx` is gone; Opening a design:
`src/editor/useDesignDoc.ts` (`useDesignDoc`: header and role, save state, lost access, ended
session, role changes) on `src/editor/live.ts` (`LiveDesign`: the Y.Doc, y-indexeddb, the Hocuspocus
provider, awareness, undo manager, LIVE-01's reasons, `watchDesign`); Shared hooks:
`src/editor/context.ts` (`useDesign`, `useEditor`, `usePresence`, `usePublishCursor`, `useLang`),
`src/editor/selection.ts` (`SelectionStore`, `useSelection`, `useSelectionStore`),
`src/editor/look.ts` (`useLook`), `src/editor/checks.ts` (`useChecks`, `useCheckCount`),
`src/editor/shortcuts.ts` (the shortcut list, `useUndoKeys`); Layout: `src/editor/Editor.tsx` (the
waiting frame, the providers, the three panes, the narrow map or phone), `src/editor/Banners.tsx`
(the connection's notices); Top bar: `src/editor/topbar/`, one file per piece: `TopBar`,
`DesignName`, `EditorTabs`, `PresenceAvatars`, `SaveStateText`, `LanguageSwitch`, `LookSwitch`,
`ChecksButton`, `TryItButton`, `ShareButton`, `ExportButton`, `MoreMenu`; Panes and tabs:
`src/editor/palette/PalettePane.tsx`, `src/editor/map/MapPane.tsx` (a step list until MAP-01),
`src/editor/phone/PhonePane.tsx` with `phone/slots.ts`, `src/editor/tabs/BotSetupTab.tsx`,
`src/editor/tabs/TextsTab.tsx`; Extension points for MAP-01, MAP-02, TXT-01, MSG-01, BTN-01,
LOGIC-01, START-01, LANG-01, CHK-01, TRY-02 and EXP-02: `src/editor/README.md`; Spec:
`designUndoManager(doc, origin)` in `packages/spec/src/ydoc/edits.ts`, `hasDesign(doc)` in
`packages/spec/src/ydoc/read.ts`; Web version: `apps/web/src/app/version.ts` (`webVersion`), stamped
by `apps/web/vite.config.ts` from `XD_RELEASE_VERSION` (the variable build.sh already passes to
`make build`), `0.0.0-dev` otherwise.

- `/d/<id>` has its own pathless layout `_editor` (the same guard as `_app`) and fills the window:
  the top bar, the connection's notices, then the tab. The tab is the page's `tab` search
  (`?tab=setup`, `?tab=texts`, none for the Map).
- Opening: `GET /api/designs/:id` first; once the role is known the document opens. People who can
  edit keep the y-indexeddb copy `xdesign-<designId>-<userId>`; Commenter and Viewer keep none (an
  old one is cleared). The editor shows the design as soon as the local copy or the server brings
  it; before that, "< Designs", the name, the save state and a placeholder. After the first sync
  with the server, a read-write connection runs `migrate` and `tidy` once.
- Save state: "Read only" (Commenter, Viewer, a read-only connection), else "Offline, your changes
  are kept on this computer" (the browser is offline, or a change was refused), else
  "Reconnecting..." (the connection dropped or the first one failed), else "Saving..." (changes the
  server has not acknowledged yet, shown until 0.6 s after the last acknowledgement), else "Saved".
  Nothing shows while the first connection opens.
- LIVE-01's reasons: `no_access`, or the close reason "You no longer have access to this design.",
  sends the editor to Designs with that sentence as a toast; `not_signed_in` asks `GET /api/me`
  again, whose 401 goes to the sign-in page with "Sign in to continue." (a session that is still
  there connects again); `busy` shows "The server is busy. Trying again..." and tries again after 5
  seconds; `too_big` stops the connection, shows "This design is too big to save more changes." and
  turns the editor read-only; `role_changed` turns it read-only at once, reads the role again and
  the new connection's scope decides. A socket that stays down also asks `GET /api/me` (at most
  every 30 seconds), so a session that ended shows. A `serverVersion` other than the web build's, or
  a document with a newer layout, shows "xDesign was updated. Reload to use the new version." with
  "Reload".
- Presence: each tab publishes `user` (id, name, color), `step` and `button` (its selection), `text`
  and `cursor` (null until TXT-01 and MAP-02 publish them). The top bar shows one avatar per other
  person (up to 5, then "+n"); hover shows the name and "Editing <step title>"; a click selects that
  step and asks the map to bring it into view.
- Undo: a `Y.UndoManager` over every area of the document that tracks only the tab's own origin;
  Ctrl+Z undoes, Ctrl+Shift+Z and Ctrl+Y redo (Cmd on a Mac), outside text fields and not while
  read-only.
- Selection: one store with `step`, `button`, `text`, `lang` and a `reveal` counter (an avatar's
  click, later a check's line); a step someone deletes is unselected.
- Top bar: "< Designs"; the name (the design owner and the site owner click it to rename with
  WEB-02's dialog, tooltip "Rename"; it is the document's name, so a rename shows at once); "Map",
  "Bot setup", "Texts"; the avatars; the save state; the language switch (the code, such as "EN",
  with each language's English and native name, the default one marked " · Default"); the look
  switch ("Android Light" at first, remembered per person in localStorage); "Checks" with the count
  of errors and warnings that are not ignored (off, "Comes with CHK-01."); "Try it" (off, "Comes
  with TRY-02."); "Share" (design owner and site owner); "Export" (off, "Comes with EXP-02."); "..."
  with "Duplicate design" (toast "Made <name>." with "Open"), "Print" (off, "Comes with EXP-02.")
  and "Keyboard shortcuts" (a dialog: "Ctrl+Z" Undo, "Ctrl+Shift+Z or Ctrl+Y" Redo). The bar wraps
  on narrow windows.
- From 900 pixels the Map tab has the palette (only while not read-only; "Comes with MAP-01."), the
  map (until MAP-01 a list of the steps in map order with "The map comes with MAP-01. Until then,
  pick a step here.", other people's selections as dots in their colors) and the phone: the selected
  message step, or a question's prompt, in PRV-02's `TelegramChat` sized to the pane, in the chosen
  look and language, uploaded images from `/api/media/<id>`; any other step or none shows "Select a
  step to see it here". Under 900 pixels: the map or the phone with "Map" and "Phone" at the bottom
  under "Editing works on a computer screen", read-only. Read-only also sets `ViewOnlyContext`, so
  the design system's switches, selects, toggle groups and comboboxes turn themselves off.
- "Bot setup" shows "Comes with START-01.", "Texts" shows "Comes with LANG-01.".

**MAP-01** (372cc40).

Code: The map: `apps/web/src/editor/map/MapPane.tsx` (React Flow over the plain design: changes,
drag end, drawing arrows, "New step here", palette drops, the Delete key, `reveal`), `map/map.css`
(React Flow's stylesheet with the site's tokens, dots, sections); Boxes from steps: `map/nodes.ts`
(`buildNodes`, `frameOf`, `frameAt`, `newSize`); one renderer per kind in `map/boxes/` (`StartBox`,
`MessageBox`, `QuestionBox`, `IfBox`, `RememberBox`, `WaitBox`, `DevStepBox`, `GoToBox`, `EndBox`,
`NoteBox`, `FrameBox`), shared pieces in `map/boxes/Box.tsx` (`BoxShell`, `Summary`, `Exits`,
`ContentSummary`, `ButtonRows`), `map/boxes/index.ts` (`boxTypes`); Arrows from their sources:
`map/arrows.ts` (`deriveArrows`, `exitsOf`, `rowsOf`, `buttonTarget`, handle IDs, `setArrow`), drawn
by `map/ArrowEdge.tsx`; Menus: `map/BoxMenu.tsx` (Edit, Duplicate, Delete), `map/NewStepMenu.tsx`;
Adding steps: `map/addStep.ts` (`addStep`, `useAddStep`), `map/kinds.ts` (icons, "ADD", "Start
points", "New step here" kinds, `isSlashStart`); Selection beyond one step: `map/picks.ts`;
sections' resize callback: `map/actions.ts`; note and section colors: `map/colors.ts`; Palette:
`apps/web/src/editor/palette/PalettePane.tsx`; Frame: `apps/web/src/editor/Editor.tsx` wraps the Map
tab in `ReactFlowProvider`; `shortcuts.ts` lists Delete and `inField(event)` reads the composed
path; `README.md` says where MAP-02, LOGIC-01 and START-01 build; Spec: `steps.duplicate(id, at)`
and `steps.move(positions, frames)` in `packages/spec/src/ydoc/steps.ts`.

- Boxes are 240 pixels wide (notes 200, sections their own size); a box shows the kind's icon, the
  title and, for people who can edit, a "..." button (on hover or while selected) for the box menu.
  Summaries: a message or question shows the first non-empty line of its text in the language shown
  (else the default language), variables as `{name}`, or the kind ("Photo") with the first line of
  the caption, an album's item count, a venue's title, a contact's name; "No text yet" when empty.
  Start points say the trigger as design.md does ("The user opens the bot or sends /start", "The
  command /help, in the commands menu", "The start link ?start=promo", "A start link that starts
  with ?start=ref_", "Anything else the user sends"). Remember shows its first action as a sentence
  ("Set ... to 0 and 2 more", "Nothing to remember yet"), Wait "Wait 2 hours", a developer step the
  first line of its description, Go to "Go to <title>" ("Nowhere yet"), End "The conversation
  ends.", a note its text on paper of its color ("Empty note").
- Dots: every box but start points, notes and sections has the dot arrows come in on (left of the
  title); an arrow dropped anywhere on such a box goes into it. Messages and questions show their
  buttons as pills in their looks (default, primary blue, success green, danger red), the blue in
  Telegram's button blue (17 section 10); a pill's icon and label take their direction from the
  label's first letter (17 section 11), row by row
  with row parts placed, each button that can go to a step with a dot on its right edge (a link, a
  copy text and a login link show a mark instead; a target back shows a back mark; a popup that
  stays a bell). Labeled dots on the right edge: "Then" (messages), "Valid answer", "Wrong N times"
  ("Wrong answer" until the number of tries is set) and "Cancel" (questions), each case ("Yes") and
  "Otherwise" (If), each outcome ("Done"); start points, Remember and Wait have one dot out, Go to
  one dot for its target.
- Arrows: drawn from the design on every change (button targets, `next`, cases, `otherwise`,
  outcomes, a question's three, a Go to's target, dashed); an arrow to `back` or to a missing step
  is not drawn. A button arrow's label says "Edit", "New" or "Replace" with a bell when it has a
  popup. A part's button shows a dot and an arrow in every message that uses the part; pointing it
  changes the part's button everywhere.
- Drawing: from a dot to a box sets that source; dropped on empty space (also inside a section), the
  menu "New step here" (Message, Question, If, Remember, Wait, Developer step, Go to, End) creates
  the step with its dot at the drop point and connects it; the new step is selected. Selecting an
  arrow and pressing Delete (or Backspace) clears its source.
- Delete (or Backspace, while the map or nothing has the focus): the selected boxes go with
  `steps.remove`'s cascades (the arrows into them cleared, their buttons and texts deleted, a
  section's steps leave it); `/start` stays. With no box selected, the selected arrows are cleared.
  The box menu's "Delete" says "Clears the arrow(s) from Main menu (Help) and /start (Then)." (the
  first three and "N more" past four), "No arrows go into it.", or for `/start` "/start cannot be
  deleted" (off). "Duplicate" (off for `/start`) puts a copy 40 pixels down and right, selected: the
  same title and arrows out, a fresh ID name, copies of its texts and its own buttons (row parts
  stay the part), new case and outcome IDs, the same answer variable. "Edit" selects the step.
- Moving: a drag writes every moved box at its end in one change (`steps.move`), a section's steps
  with it; a step whose center lands in a section joins it (the smallest one), dragged out it
  leaves, in the same change. Sections: a frame of their color (gray, yellow, orange, red, pink,
  purple, blue, green; new ones gray, notes yellow) with the title on a bar; moved by the bar,
  resized by their edges and corners while selected (at least 240 by 160), the new size written at
  the end; the rest of a section lets clicks through to the map.
- Selection: a click selects the step in the editor's selection (the phone shows it); Shift, Ctrl or
  Cmd click adds boxes and Shift drag draws a box around several (the last one picked is the
  editor's step); a click on the map clears it. A step selected elsewhere (the phone, an avatar, a
  new step) is selected alone on the map; `reveal` centers it (zoom at least 0.8).
- Palette: "ADD" (Message, Question, If, Remember, Wait, Developer step, Go to, End, Note, Section)
  and "Start points" ("+ Command", "+ Start link", "+ Anything else (fallback)") by click (centered
  in the view) or drag (centered on the drop); a step that lands in a section belongs to it; the new
  step is selected. "PARTS" shows "Comes with PARTS-01.". A new command is "Command" with an empty
  command, a start link exact with an empty payload, the fallback "Anything".
- The view opens fitted to the design (zoom at most 1), zooms from 0.1 to 2, pans by dragging the
  map; dots on the background. Read-only: boxes can be selected (the phone shows them), nothing can
  be dragged, drawn, resized or deleted, no box menu.
- Keyboard shortcuts lists "Delete": "Delete the selected steps or arrows". The editor's key
  listeners read the first element of the key press's composed path, so a field inside the phone (a
  shadow root) keeps its keys.

**MAP-02** (3a828b1).

Code: Copy and paste in the document: `packages/spec/src/ydoc/map.ts` (`copySteps(design, ids)`,
`readClip(text)`, `CLIP_TYPE`, `Clip`, `edits.map.paste(clip, at, frameAt)`,
`edits.map.arrange(boxes)`), wired in `ydoc/edits.ts` and `src/index.ts`; The clipboard on the page:
`apps/web/src/editor/map/clipboard.ts` (`putClip`, `takeClip`, `copyClip` for the box menu); The
map's keys: `apps/web/src/editor/map/keys.ts` (`useMapKeys`: Delete, Ctrl+C and Ctrl+V through the
copy and paste events, Ctrl+D, F, Ctrl+F, Esc, arrow keys); the list in
`apps/web/src/editor/shortcuts.ts`; Search: `apps/web/src/editor/map/search.ts` (`findInDesign`),
`apps/web/src/editor/map/MapSearch.tsx`; Minimap, zoom, "Fit", "Auto-arrange":
`apps/web/src/editor/map/MapTools.tsx`, `apps/web/src/editor/map/arrange.ts` (`arrangeBoxes`, elkjs
in its own worker script), styles in `map/map.css`; Presence:
`apps/web/src/editor/map/PeerCursors.tsx` (others' pointers), the pointer published from
`map/MapPane.tsx`; `usePublishCursor` in `editor/context.ts` now returns a stable function; Outlines
and badges over every box: `apps/web/src/editor/map/BoxOverlay.tsx` (`OverlaidBox` wraps each kind's
renderer), fed by `OverlayContext` in `map/actions.ts` and `OverlayProvider` in `map/MapPane.tsx`;
Box menu: `apps/web/src/editor/map/BoxMenu.tsx` ("Copy", "Add a note", the selection's "Duplicate",
"Copy" and "Delete" with the summed text); `map/actions.ts` gives `targets`, `copy`, `duplicate`,
`paste`; `map/MapPane.tsx`: the tools as children of React Flow, the arrow keys and drag end through
one `writeMoves`, React Flow's own arrow-key moves off (`disableKeyboardA11y`);
`apps/web/src/editor/README.md` says what is where.

- Copy (Ctrl+C, or "Copy" in the box menu) puts the selected steps on the clipboard as JSON under
  `application/x-xdesign` with the same JSON as plain text: the steps as the model has them (a
  section brings its steps; `/start` stays behind), the buttons of their keyboards, the row and text
  parts they use with their buttons, the variables, test switches and media they refer to, the
  languages and the design's ID. It works on a plain HTTP address too (the copy and paste events,
  not the Clipboard API). Ctrl+C with text selected on the page copies the text.
- Paste (Ctrl+V while the map or nothing has the focus) centers the steps on the pointer, else on
  the view's center, in one change: new step, text, button, case and outcome IDs, ID names made
  unique; arrows between pasted steps follow them, arrows to steps this design has stay, others are
  cleared; the design's variables and test switches are used when it has them (same ID, else same ID
  name), else they are added; parts the design lacks are added with their buttons and text; a file
  from another design becomes a placeholder with its file name; texts keep the design's languages
  (others are dropped; the clip's default language stands in for the design's default when the clip
  has no text in it). A pasted step lands in the section under its box. The pasted steps are
  selected.
- Duplicate (Ctrl+D, or "Duplicate" in the box menu) is copy and paste in place, 40 pixels down and
  right: one step or the whole selection, with the arrows between them kept.
- The box menu on a box that is one of several selected acts on all of them: "Duplicate", "Copy",
  and "Delete", whose line says "Deletes 3 steps. Clears the arrows from Main menu (Help) and /start
  (Then)." (arrows between the deleted boxes are not counted) or "Deletes 3 steps. No arrows go into
  them.".
- "Add a note" (not on sticky notes) opens "Note for the developer" with a text field, "Cancel" and
  "Save": the step's `note`, shown in design.md as "Designer's note"; with a note the item says
  "Edit the note"; an empty note clears it.
- Arrow keys move the selected boxes 10 pixels (with Shift 50), a section with its steps, written
  like a drag (a step moved into or out of a section joins or leaves it); presses close together
  undo as one.
- Search: Ctrl+F (outside a text field, anywhere on the Map tab) or the magnifier opens a field at
  the top right ("Steps, buttons and texts"): it finds steps by title, ID name, designer's note,
  command, start link, case and outcome names, a note's text, a developer step's description and
  cancel words; buttons by their text and ID name; and the texts of messages and questions
  (captions, wrong answer messages), in every language, without case. Matches are in map order (left
  to right, then top to bottom), a step's buttons after it; Enter selects the next one and brings it
  into view, Shift+Enter the one before, the arrows too; the field says "1 of 5", "5 matches" or "No
  matches"; Esc closes it.
- Bottom right: the minimap (drag or scroll it to move the view), then a row with search, zoom out,
  the zoom in percent, zoom in, "Fit" (also the F key) and "Auto-arrange" (not for read-only).
- Auto-arrange: ELK's layered layout left to right, run by elkjs' own worker script; each section is
  laid out as a box around its steps (it grows or shrinks to fit them), each dot is a port at its
  place so arrows leave in order, steps go in map order; the arranged design keeps its top left
  corner, all places and section sizes are written in one change (one Ctrl+Z), and the view fits the
  design after. If it fails: the toast "Auto-arrange did not work. Try again.".
- Presence: each person publishes their pointer over the map (map coordinates, at most every 60 ms,
  null when it leaves the map or the Map tab); others see an arrow in their color with their name,
  at the same spot of the design whatever their view. A box someone else has selected gets a frame
  in their color with their name above it (several people: one tag each, the frame in the first
  one's color).
- Badges: a red dot for errors and an amber dot for warnings (not the ignored ones, not
  good-to-know) at a box's top right corner; hover lists the messages.
- Keyboard shortcuts dialog: "Ctrl+Z" Undo, "Ctrl+Shift+Z or Ctrl+Y" Redo, "Ctrl+C / Ctrl+V" Copy
  and paste steps, also into another design, "Ctrl+D" Duplicate the selected steps, "Delete" Delete
  the selected steps or arrows, "Ctrl+F" Search steps, buttons and texts, "F" Fit the map in view,
  "Esc" Close a popover or the search, "Arrow keys" Nudge the selected boxes (with Shift, further),
  "Shift+click or Shift+drag" Select several boxes.

## As built (M4)

**TXT-01** (56ec686).

Code: The text slot: `apps/web/src/editor/phone/text/textSlot.ts` (`useTextSlot`), used by
`phone/slots.ts`; the step's text or caption: `phone/text/stepText.ts`; The editor in the bubble:
`phone/text/PhoneText.tsx` (`PhoneText`: "Not translated" or the TipTap editor bound to
`edits.texts.fragment(textId, lang)` with Collaboration, the carets, the shared undo, the Telegram
paste and the presence); The schema: `phone/text/schema.ts` (`richExtensions`: SPEC-01's nodes and
marks, the spoiler, dateTime, expandable quote, variable, customEmoji and part, the info row's
room); Node views: `phone/text/views.tsx` (code blocks and quotes drawn by the preview's own
components, variable and part chips); The look inside the shadow root: `phone/text/editor.css`,
adopted into the preview's shadow root; The toolbar: `phone/text/TextToolbar.tsx`; The counter:
`phone/text/TextCounter.tsx`, under the phone in `phone/PhonePane.tsx`; Preview: `TelegramCodeBlock`
and `TelegramQuote` exported (`packages/preview/src/index.ts`, `parts.tsx`'s `Pre` and `Blockquote`,
the quote with `held`); Presence: `LiveDesign.setPresence` keeps fields others write in the
awareness (`apps/web/src/editor/live.ts`); the editor README's TXT-01 entry says how it is built.

- For people who can edit, the text of the selected message (a media message's caption, an album's
  first caption, a question's prompt) is a TipTap editor in the bubble; Commenter, Viewer and narrow
  screens see the preview's drawing (no editor). A media message without a caption, and locations,
  venues, contacts, round videos and stickers, keep the read-only drawing.
- The editor draws with the preview's classes inside its shadow root: paragraphs with `dir="auto"`,
  code blocks and quotes through the preview's own components (the look's header, copy mark, sizes
  and quote marks), the info row's room copied to the end of the last paragraph. A spoiler shows the
  bubble's dots, and its text while the editor has the focus; an expandable quote stays open while
  editing; a date shows its text in the link color; variables and parts are chips in the link color
  (`{idName}`, the part's text).
- The toolbar shows while the text or the toolbar has the focus, over the selection or the caret
  (under it near the top of the window): "Bold", "Italic", "Underline", "Strikethrough", "Spoiler",
  "Code", "Link", "Quote", "Expandable quote" (inside a quote), "Code block", "Date and time" (a
  date and time and a format: "Date and time", "Date", "Long date", "Time", "Weekday, date and
  time", "Relative time", "The text, as a link"; without a selection it writes the date as text), "{
  } Insert" (the variables in "Saved answers", "Remembered values", "Developer outputs",
  "Built-ins", then "+ New variable" with a name), "Custom emoji" (the ID, digits only, and the
  fallback emoji), "Part" (the text parts, or "No text parts yet"). A tool that needs words opens
  its form in the toolbar; Escape goes back to the text.
- Paste: HTML from other apps keeps only the schema's nodes and marks (the rest becomes plain text);
  plain text with Telegram HTML tags goes through `fromTelegramHtml`, plain text with a known
  `{name}` through `fromTelegram`, so the variables become chips; in a code block everything pastes
  as text.
- The counter "812 / 4096" (or "/ 1024" for a caption) sits under the phone, not under the bubble,
  because the bubble clips what is drawn outside it; it counts the language shown (0 for one without
  its text), as the checks do (test values, parts written in), and turns red over the limit.
- "Not translated": in a language other than the default one, a text with no document there shows
  "Not translated: click to write the <language> text" over the default text, greyed; a click (or
  Enter) opens the editor on that language's fragment, created when missing, with the caret at the
  end. The default language with an empty text shows the editor.
- Two people in the same text see each other's caret and selection in their colors, with the name
  over the caret. The caret's place is the awareness field `caret`, not `cursor` (the map pointer).
- Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y in the text use the person's one undo history (the map's too);
  keys typed in the text never reach the window's shortcuts.

**BTN-01** (d6bdf21).

Code: The slots: `apps/web/src/editor/phone/keyboard/keyboardSlots.ts` (`useKeyboardSlots`), used by
`phone/slots.ts` (`keyboard` always, `replyKeyboard` while the step has a bottom keyboard); Under
the bubble: `phone/keyboard/InlineKeyboard.tsx` (`InlineKeyboardSlot`: the inline rows, then the bar
"+ Inline buttons", "+ Bottom keyboard", the active "Remove the bottom keyboard" or "Force a reply",
and "More"); The bottom keyboard: `phone/keyboard/ReplyKeyboard.tsx` (`ReplyKeyboardSlot`: the
panel); The rows of both: `phone/keyboard/KeyboardRows.tsx` (the look's classes, dnd-kit dragging
within and between rows and onto "+ row", "+" at a row's end, the limits' tips, row parts with their
outline, name and menu, the selected button's popover); The button popover:
`phone/keyboard/ButtonPopover.tsx`; its pieces `phone/keyboard/fields.tsx` (`FormRow`, `LangInputs`,
`Choice`, `SwitchRow`, `Pick`, `TargetPicker`, `VariablePicker`); keyboard words and limits from the
catalog `phone/keyboard/model.ts`; The phone's look for editing: `phone/keyboard/keyboard.css`,
adopted into the preview's shadow root by `phone/keyboard/sheet.ts`; Preview: `TelegramButtonFace`
(`packages/preview/src/ButtonFace.tsx`, exported from `index.ts`): a design button's icon, text with
the look's emoji and inline mark; `KeyboardButtonFace` and `ReplyButtonFace` in
`platforms/telegram/Keyboard.tsx`, used by the read-only keyboard and the chat's bottom keyboard
too; `keyboardButton` and `replyButton` exported from `adapt.ts`; Shared with LOGIC-01:
`RememberLines` exported from `apps/web/src/editor/forms/RememberForm.tsx` (the Remember form and a
button's "Also remember"); Map: a click on a button's pill selects that button
(`map/boxes/Box.tsx`), so its popover opens on the phone; `apps/web/src/editor/README.md`: the
BTN-01 entry says how it is built.

- The keyboards on the phone are the preview's own drawing: the editor draws `.tg-kb-button` and
  `.tg-rk-button` in the look's classes with the preview's `TelegramButtonFace` inside, so editing
  keeps the look (Q-28); a dashed "+" shows beside a row's last button (inside it on the bottom
  keyboard, which fills the screen) while the pointer is over the keyboard, "+ row" is a dashed bar
  under the last row (inside the bottom keyboard's panel). A new button is "Button" in the default
  language, and its popover opens with the text chosen whole. At 8 buttons in a row or 100 in a
  keyboard (the catalog's observed limits) the "+" gives way to an "i" whose tip says "A row holds
  at most 8 buttons." or "A keyboard holds at most 100 buttons."; "+ row" says the second.
- Dragging (from 4 pixels of movement) moves a button within its row or into another row (the rows
  make room at once), or onto "+ row" for a row of its own; a row left empty goes. Row parts take no
  drops.
- The popover opens to the left of the selected button, beside the phone: "Text" (a field per
  language, the language's code before it when there are several, the default text greyed in an
  empty one), "Look" (four swatches "Default", "Blue", "Green", "Red" with "primary", "success",
  "danger" under them), "Icon" ("None" or "Custom emoji" with "Custom emoji ID", digits only, and
  "Fallback emoji"), "Disabled (does nothing)" (inline), "When pressed" (the catalog's words).
  Inline "Go to a step": "Goes to" ("Nowhere yet", "Back", "Stay here", the steps that take arrows
  in map order) with "Draw on the map" (closes the popover, brings the step into view and says "Drag
  from the button's dot on the map to a step."), "Show it by" (not for "Stay here"), "Popup"
  ("None", "Small toast", "Alert window" with "Popup text" per language), "Also remember" (the
  Remember form's lines and "+ Action"). "Open a link" and "Log in on a website": "Link", the second
  with "Ask to let the bot message them"; "Copy text": "Text to copy" per language. Bottom buttons:
  "Sends its text" with "Goes to" ("Back" too) and "Also remember"; "Pick users": "Users at most" (1
  to 10), "Bots" and "Premium users" ("Any", "Only ...", "No ..."), "Ask for" "Name", "Username",
  "Photo"; "Pick a group or channel": "Pick" ("A group", "A channel"), "Forum" (groups), "Username"
  ("Any", "Has one", "Has none"), "The user owns it", "The bot is in it", "Ask for" "Title",
  "Username", "Photo"; "Create a poll": "Poll type" ("Any", "Regular", "Quiz"); every action but
  "Sends its text" has "Goes to" and "Save it as" ("None", the variables of its type, "+ New
  variable" set by a button). "Delete button" deletes it; the keyboard's last button takes the
  keyboard with it. Escape or a click elsewhere closes the popover and unselects the button.
- The bar under the bubble shows "+ Inline buttons" and "+ Bottom keyboard" while the message has no
  buttons (each makes the keyboard with its first button); with "Remove the bottom keyboard" or
  "Force a reply" set, that name as a chip that opens "More". "More": without buttons, "Remove the
  bottom keyboard" and "Force a reply" as switches (a forced reply with "Hint in the input field");
  a bottom keyboard: "Hide after one press", "Always shown", "Fit to buttons", "Hint in the input
  field"; both keyboards: "Open the reply field".
- A row part: its rows in a dashed outline in the link color with its name on the outline; the name,
  or a click on its buttons, opens its menu: "Edit the part" (off, "Comes with PARTS-01.") and
  "Detach".
- A click on a button's pill on the map selects the button: the phone opens its popover.

**MSG-01** (385bb3a).

Code: Kind row: `apps/web/src/editor/phone/KindRow.tsx`; the kinds and what a kind change keeps:
`phone/kinds.ts`; The message a step sends (a message's own fields or a question's prompt), read and
written: `phone/message.ts` (`shownOf`, `setShown`, `latestStep`, `updateContent`,
`useUpdateContent`); Media slot: `phone/slots.ts` (the `media` slot, also read-only),
`phone/media/BubbleMedia.tsx` (the drawing made clickable, the popover editors),
`phone/media/BubbleCards.tsx` (file, sound, voice, round video, sticker, map and contact cards, an
album of files); Where a file comes from: `phone/media/MediaSource.tsx` ("Upload a file", "Use a
placeholder", "Use a file already in this design"), `phone/media/upload.ts` (the browser's probe,
the multipart upload with progress), `phone/media/files.ts`, `phone/media/FileThumb.tsx`; Album:
`phone/media/AlbumEditor.tsx` (dnd-kit sortable thumbnails, "+", the item's file, spoiler and
caption); Location, venue and contact: `phone/media/PlaceForm.tsx`, `phone/media/mapLink.ts`,
`phone/media/ContactForm.tsx`; Options under the phone: `phone/options/OptionsSection.tsx`; the
number field: `phone/NumberInput.tsx`; Telegram details: `phone/TelegramDetails.tsx`,
`phone/details.ts`; `sendTelegram` and `waitsFor` exported from `packages/spec/src/index.ts`;
Layout: `phone/PhonePane.tsx` (`StepPhone`: kind row, phone, TXT-01's counter, Options, Telegram
details); the editor README's MSG-01 entry.

- The kind is a select at the top of the phone pane with the catalog's labels in this order: "Text",
  "Photo", "Live photo", "Video", "GIF", "Audio", "Voice", "Round video", "File", "Sticker",
  "Album", "Location", "Venue", "Contact". A new kind keeps the text as its text or caption (an
  album: the first item's caption); a kind with captions always gets one (the old text, else an
  empty one), so the text editor shows in the bubble. A kind without captions asks "The text will be
  removed. Change anyway?" ("Change", "Cancel") only when the text has words. The file stays when it
  was uploaded for the new kind, else the slot becomes a placeholder named after the file; a
  placeholder stays; a location and a venue keep their coordinates; a new album has the old file
  (when an album takes it) and a placeholder; spoiler and caption above stay between photo, live
  photo, video and GIF.
- A click on the media in the bubble (or Enter on it) opens its editor in a popover left of the
  phone, titled with the kind. The preview's own drawing is not wrapped: a hidden marker before it
  finds the element. Commenter, Viewer and narrow screens see the same drawings without the popover.
- One file: the file now ("IMG_1234.jpg, 2.1 MB"); "Upload a file" with a dashed drop area, "Drop a
  file here, or" and "Choose a file" (the picker offers the kind's types), then a progress bar with
  "Uploading... 45%" and "Stop", or the server's plain message ("This file is bigger than 20 MB.",
  "This type of file cannot be used here. Use JPEG, PNG or WebP."); "Use a placeholder" with "For
  example: photo of the product" (a placeholder's description is edited live, else "Use" turns the
  slot into one); "Use a file already in this design" lists the design's files of the same kind with
  a thumbnail, name and size ("No files of this kind in the design yet."). "Add a caption" shows for
  a media message without a caption. An upload sends the kind and the browser's width, height and
  duration (5 seconds at most to read them), adds the file to the design once per server file and
  kind, and puts it in place when it ends, also after the popover closed, into the message as it is
  then.
- The bubble draws what the preview has no picture for: a file, a sound or a voice message as a row
  (a round icon in the link color, the name or the audio's title, the size, or the performer and
  length); a round video as a 200 pixel circle (its first frame); a sticker at 160 pixels (WebP as a
  picture, WebM playing, TGS and placeholders as a grey square); placeholders in the preview's grey
  with their description (or the kind's name); a location as a 260 by 140 plain map card (a drawn
  grid, a red pin, the coordinates to 5 decimals), a venue with its name and address under it; a
  contact with its initials on a round picture, the name and the phone number; an album of sounds or
  files as a row per item.
- Album: the items as thumbnails in a row with their numbers (a picture, an icon, a grey box for a
  placeholder); drag to reorder (or Space, the arrow keys, Space); a click chooses an item; "+"
  ("Add an item") adds a placeholder, off at 10; under the row "Item 2 of 4", the item's file (the
  kinds of the album's group, set by the other items: "This album holds photos and videos. Use a
  photo or a video." or "This album holds sounds. Use an audio file."), "Hide under a spoiler",
  "Caption" (read-only; "Write it in the bubble." for the caption the bubble shows; "Add a caption"
  for an album without one) and "Remove this item" (off at 2).
- Location and venue: "Latitude" (-90 to 90) and "Longitude" (-180 to 180), "Paste a map link"
  (Google Maps: the place's "!3d!4d" pin, then q, query, ll, center, destination or daddr, then
  "/@lat,lng"; Apple Maps: ll, q, sll, coordinate, daddr; OpenStreetMap: mlat and mlon, then
  "#map=zoom/lat/lng"; typed "lat, lng" too) with "The coordinates are taken from the link." or
  "This link has no coordinates. Open it, then copy the address from the browser."; a venue's "Name"
  and "Address". Contact: "Phone number", "First name", "Last name".
- Options (under the phone and TXT-01's counter; the phone keeps the pane's height less a 64 pixel
  strip, and the pane scrolls to them): "Silent (no sound)", "Protect (no forwarding or saving)",
  for photo, live photo, video and GIF "Caption above the media" and "Hide under a spoiler"; for a
  text "Link preview" ("Automatic", "Off", "Use this link" with its address, "Small" or "Large" or
  neither, "Show above the text"; Automatic with neither size and not above stores nothing);
  "Message effect" ("None" and the catalog's six emoji, stored as the message_effect_id); "Before
  sending": "Show" with the catalog's chat actions ("typing...", "sending a photo...", ...; the one
  that fits the kind first) "for N seconds", and "Wait N seconds" (each a switch and 1 to 60 whole
  seconds; 3 and 2 at first); for a message step "Then" ("Go on to another step without a click.":
  "None" and every step but start points, notes, sections and itself, by title). Read-only, every
  option is off.
- "Telegram details" (closed at first): `wait` and `sendChatAction` when set, `method` (`sendPhoto`,
  `sendMediaGroup`, ...), the file field with the file's name or the placeholder, `text` or
  `caption`, `latitude`, `longitude`, `title`, `address`, `phone_number`, `first_name`, `last_name`,
  `performer`, `parse_mode`, `has_spoiler`, `show_caption_above_media`, `disable_notification`,
  `protect_content`, `link_preview_options`, `message_effect_id` (with its emoji), `reply_markup`,
  and a question's `waits for` (the updates of its answer).

**LOGIC-01** (3508f2a).

Code: The phone pane for a logic step: `apps/web/src/editor/forms/LogicForm.tsx` (the kind's icon
and name, "Title", the kind's form), `forms/logic.ts` (`isLogicStep`, the kinds' names, the steps an
arrow can go to, the variable groups), one branch of `phone/PhonePane.tsx`; Question:
`forms/QuestionForm.tsx` under the prompt's phone (one line in `StepPhone`),
`forms/AnswerChecks.tsx`, `forms/question.ts` ("Expects", the checks of each kind, the answer
variable's type), `forms/WrongAnswerBubble.tsx` (the wrong answer message in a small phone with
TXT-01's editor); If: `forms/IfForm.tsx`, the condition sentences in `forms/ConditionRow.tsx`;
Remember, Wait, Developer step, Go to, End, Note, Section: `forms/RememberForm.tsx`,
`forms/WaitForm.tsx`, `forms/DevStepForm.tsx`, `forms/GoToForm.tsx`, `forms/EndForm.tsx`,
`forms/NoteForm.tsx`, `forms/SectionForm.tsx`; Shared pieces: `forms/fields.tsx` (`FormSection`,
`Field`, `TitleField`, `TargetSelect`, `ColorField`, `OptionalNumber`), `forms/VariableSelect.tsx`
(a variable with "+ New variable", a list of variables, `NewName`), `forms/ValueInput.tsx` and
`forms/values.ts` (values typed as text, `{name}` for a variable); Boxes:
`map/boxes/QuestionBox.tsx`, `IfBox.tsx`, `RememberBox.tsx`, `WaitBox.tsx`, `DevStepBox.tsx` (and
the comment of `GoToBox.tsx`); The editor README's LOGIC-01 entry.

- A selected logic step fills the phone pane: the kind's icon and name on a strip, then "Title" (the
  box's name; the ID name follows it until fixed), then the kind's fields. A question shows "Title",
  "Expects", its checks and "Save the answer as", then "Wrong answer" and "Cancel", under its phone
  and the counter, before "Options". A start point shows START-01's form in the same branch of
  `phone/PhonePane.tsx`. Read-only, every field is off and the add, remove and move buttons are
  gone.
- Question: "Expects" (Text, Number, Email, Phone number, Location, Photo, Video, File, Voice,
  Audio, Anything). Checks: "At least N characters" and "At most N characters" (Text, Anything);
  "Between A and B" and "Whole number" (Number); "Max file size N MB" (Photo, Video, Voice, Audio,
  File); "File types" ("pdf, docx", kept as endings without dots in lower case) (File); none for
  Email, Phone number and Location. An empty field is no check. Another kind keeps only its own
  checks, and the question's own answer variable (a saved answer) takes the kind's type (number,
  phone, location, file, else text). "Save the answer as": the variables but built-ins, by ID name
  in their groups, and "+ New variable" (a name typed in place; a saved answer of the kind's type).
  "Wrong answer": the message in a small phone in the chosen look and language, written in its
  bubble with TXT-01's editor; "Try at most N times" (empty: no limit); "Then go to". "Cancel":
  "Cancel word" in the language shown (its name beside the label when the design has several
  languages; "Several words: put commas between them."; the default language's words as the
  placeholder), "Goes to".
- Every arrow of a form's step has a select: "Goes to" (a case, "Otherwise", an outcome, the cancel
  words), "Then go to" (wrong answers), "Go to", and "Then" (Remember, Wait). It lists "None" and
  every step that takes arrows but the step itself, by title with the ID name; "Back to the message
  the user came from" shows only while it is the target.
- If: a section per case titled with its name ("Case 2" when unnamed) with "Move up", "Move down"
  and "Delete this case"; "Case name"; "all of these" or "any of these"; the conditions as
  sentences, each with "Remove this condition"; "+ Condition" (the first saved answer "equals");
  under them "If ..." from EXP-01's sayCondition ("If always" while empty); "Goes to". "+ Case" adds
  an unnamed case. "Otherwise" has "Goes to" ("When no case holds.").
- A condition's first select lists the variables in their groups (closed it says "saved answer
  age"), "Test switches" by label, "The user's language", "The user", and "+ Switch" (a name typed
  in place makes a yes or no test switch, tested "is yes"). Then a variable has its comparison in
  EXP-01's words ("is set", "is empty", "equals", "does not equal", "contains", "starts with", "is
  greater than", "is at least", "is less than", "is at most") and a value (none for "is set" and "is
  empty", "yes" or "no" for a yes or no variable); a switch "is yes" or "is no", or "is <choice>";
  the language "is" and a chip per language of the design (several may be on); the user "is a member
  of" and "@channel".
- Values are typed: a number for the comparisons and for Add and Subtract (Persian and Arabic digits
  too; a field without a number is marked and changes nothing), "yes" or "no" for a yes or no
  variable, `{name}` for the variable of that ID name, else the text; an empty field is no value.
- Remember: lines "[Set] [var] to [value]", "[Add] [value] to [var]", "[Subtract] [value] from
  [var]", "[Clear] [var]", "[Append] [value] to [var]", each with "Remove this line" ("Nothing to
  remember yet" without any); the variable select has every variable but built-ins and "+ New
  variable" (a remembered value; a number for Add and Subtract); "+ Action" adds "Set" with the
  first such variable, or asks for a new one's name when there is none; "Then".
- Wait: "Wait [N] [seconds, minutes, hours or days]" (1 to 9999 whole; "hour" for 1); "If the user
  does something before the time is up": "Stop waiting" or "Still go on"; "Then".
- Developer step: "What the developer does" (several lines); "Uses" (any variable) and "Gives back"
  (not built-ins, with "+ New variable", a developer output) as chips with a remove mark and a
  select "Add a variable"; "Outcomes": a card per outcome with its name ("Outcome N" when empty),
  "Remove this outcome" (off for the last one) and "Goes to"; "+ Outcome".
- Go to: "Go to". End: "The conversation ends. The next message goes to 'Anything else'." Note:
  "Text" (several lines) and "Color"; Section: "Color" (its title is "Title"). The colors are the
  map's eight as round swatches.
- Boxes: a question adds "Number, saved as age" under its prompt; an If box shows each case's name
  over its condition in words, then "Otherwise"; Remember its first three lines as sentences and
  "and N more", with a labeled "Then" dot; Wait a labeled "Then" dot, and "Still goes on if the user
  does something" when it does not stop waiting; a developer step "Gives back ..." under its first
  line. No new dots: MAP-01's `exitsOf` already had every one.

**START-01** (03993bf).

Code: Start point forms in the phone pane: `apps/web/src/editor/forms/start/StartForm.tsx` (command,
start link, anything else, `/start`), shown by one branch in `phone/PhonePane.tsx`; Their rules and
pieces: `forms/start/rules.ts` (the catalog's command and payload rules, `isTheStart`,
`sameCommand`, the full start link, where "+ Command" puts a box), `forms/start/fields.tsx`
(`PlainTextField` with its counter, `PrefixedField`, `SwitchRow`), `forms/start/SaveRestAs.tsx`
("Save the rest as" with "+ New variable"); The start box: `map/boxes/StartBox.tsx` (the trigger in
a few words, a menu mark); Bot setup: `tabs/BotSetupTab.tsx` (layout, "Bot username", name, about,
description, "Menu button"), `bot/CommandList.tsx` (dnd-kit list, "+ Command"), `bot/BotPhoto.tsx`
(MSG-01's picker in a popover), `bot/BotPreviews.tsx` (EmptyChat and CommandsMenu); MSG-01's picker:
`phone/media/MediaSource.tsx` takes `uploadAs` (sends that upload kind, offers only files it takes),
`phone/media/upload.ts` knows `botPhoto` (`acceptFor`, `sendMedia`, `takesFile`); Spec: `username?`
in `BotSetupSchema` (`packages/spec/src/model/bot.ts`) and `bot.setUsername` (`ydoc/bot.ts`);
`steps.set` makes a start point's title follow its trigger (`ydoc/steps.ts`); `bot.username` in
spec.json (`export/schema.ts`, `to-spec.ts`, `from-spec.ts`, the generated
`schema/bot-spec.v1.schema.json`), in design.md's start links and Bot setup
(`markdown/to-markdown.ts`) and in HOW-TO-READ.md's start link row (`docs/HOW-TO-READ.md`,
`how-to-read.gen.ts`); The editor README's START-01 entry.

- Selecting a start point shows its form in the right pane under its title. `/start` shows "Every
  chat starts here" and no fields. A command: "Command" with "/" before the field (typed text is
  lower-cased, a leading slash dropped), the catalog's rule under it ("1 to 32 characters. Only
  lowercase English letters, digits and underscores.", red when broken) and "Another start point has
  the command /help." when another has it; "Show in the commands menu"; "Menu text" in the language
  shown with "8 / 256". A start link: "Link text after ?start=" with "?start=" before the field and
  the catalog's rule; "Exactly" or "Starts with"; for "Starts with" "Save the rest as" ("None", the
  design's text variables but the built-ins, "+ New variable" with a name, source `startLink`); the
  full link `https://t.me/<username or yourbot>?start=<text>` with "Copy" (also read-only). Anything
  else: "Text only", "Media only", "Anything".
- A start point's title (and its ID name until fixed) follows its trigger while it is the one the
  trigger gave it: a command typed as "help" turns "Command" into "/help".
- Start boxes say: "Every chat starts here" (`/start`), "/help" with a list mark when it shows in
  the menu ("No command yet"), "Start link: promo" or "Start link: ref_..." for "Starts with" ("No
  link text yet"), "Anything else the user sends", "Any other text the user sends", "Any other
  photo, video or file the user sends".
- Bot setup: the form on the left (scrolls), the previews on the right (from 900 pixels; under the
  form below that). "Bot username" with "@" before it and "For start links in the docs only;
  optional." (stored without the @). "Name", "About" and "Description" in the language shown (with
  the language's name in the label when the design has several; the default language's text as the
  placeholder), each with its counter ("12 / 64", "80 / 120", "300 / 512", red over); About and
  Description carry the catalog's words of what they set. "Profile photo": the file's thumbnail and
  "IMG.jpg, 2.1 MB" (or the placeholder's words, or "No photo"), "Add a photo" or "Change" opening
  MSG-01's picker ("Upload a file" for a JPEG or an MP4, "Use a placeholder", "Use a file already in
  this design" with only JPEG and MP4 files), and "Remove".
- "Commands menu": every command start point (`/start` too) in Bot setup's order, each a row with a
  drag handle (also Space, the arrow keys, Space), the command field ("/start" as plain text), "Show
  in menu" and the menu text in the language shown with "/ 256"; a broken or repeated command shows
  its problem under the row. "+ Command" adds a command start point shown in the menu, 160 pixels
  under the lowest start point on the map, and puts the focus in its command field. "Menu button":
  "Commands list" or "Telegram default".
- Previews: "Empty chat" or "Commands menu" (a switch over the phone, also chosen by where the focus
  is: the profile fields show the empty chat, the commands and the menu button the menu), in the
  chosen look and language, live, with the bot's name and photo (a JPEG; an MP4 or a placeholder
  shows the look's letters) in the top bar.
- Read-only: every field off, no "+ Command", no photo buttons, no dragging; "Copy" still works.

**LANG-01** (8e24885, c1b4a03).

Code: Languages: `apps/web/src/editor/topbar/LanguagesDialog.tsx`, opened by "Languages..." in
`src/editor/topbar/LanguageSwitch.tsx` and on the Texts tab; Texts tab:
`src/editor/tabs/TextsTab.tsx` (counters, "Only missing", the copy, the table in pages of 100),
`src/editor/texts/rows.ts` (`textGroups`, `cellState`), `src/editor/texts/PlainCell.tsx`,
`src/editor/texts/RichCell.tsx` (TXT-01's editor in a popover, in a bubble of the phone's look);
TXT-01's editor for another bubble: `SlotTextEditor` in `src/editor/phone/text/PhoneText.tsx`;
Fields bound to the live design: `src/editor/useDraft.ts` (`useDraft`), listed in the editor README;
Variables and test switches: `src/editor/variables/VariablesPanel.tsx` (`VariablesEntries`, the
palette's two entries; `VariablesPanel`, the sheet), `src/editor/variables/VariablesList.tsx`,
`src/editor/variables/SwitchesList.tsx`, `src/editor/variables/fields.tsx` (`LiveField`,
`IdNameField`, `StepPlaces`); Spec: `copiedTexts` in the model (`packages/spec/src/model/design.ts`)
and `meta.copiedTexts` in Yjs (`ydoc/read.ts`, `ydoc/new.ts`); `TextAt`, `textKey`,
`textFingerprint`, `isCopiedText`, `pruneCopied` and `texts.copyDefault` in `ydoc/texts.ts`
(`setPlain` drops its text's mark); `languages.remove` and `tidy` drop stale marks;
`variableSteps(design)` in `checks/check.ts`.

- "Languages..." ends the top bar's language switch (people who can edit; the switch now also marks
  right-to-left languages "RTL") and is a button on the Texts tab. The "Languages" dialog lists each
  language with its English name, code, "RTL" and its own name; the default one has the mark
  "Default", each other one the buttons "Default" (makes it the default) and "Remove" ("Remove
  Persian?", "Its texts in this design are deleted.", "Remove"); under the list "Add a language" is
  WEB-02's searchable list without the design's languages; "Done". Every change is undoable with
  Ctrl+Z.
- Texts tab: "Texts", one counter per language other than the default ("fa: 12 missing"; the default
  language's only when it misses texts), "Only missing" (also for Commenter and Viewer), then for
  people who can edit "Copy the default language into empty cells" and "Languages...". The table has
  "Text" (what it is) and a column per language (English name, code, "Default", "RTL"). Groups: "Bot
  setup" (Name, About, Description), then each step that has texts in map order (a command's "Menu
  text"; a message's or question's "Text" or "Caption", "Caption of item 2" in an album; its own
  buttons: "Button", `Popup of "<text>"`, `Copy text of "<text>"`; "Hint in the input field"; a
  question's "Wrong answer message" and "Cancel word"), then each part (`Part "<name>"`: its text or
  its buttons). Buttons of a row part show under the part only.
- Cells: a plain text is a field written at each change (Enter leaves it; Shift+Enter starts a new
  line in the description, popups and texts to copy); a rich text shows its words (variables as
  `{name}`, text parts written in) and a click opens TXT-01's editor (toolbar, carets, the one undo
  history) in a popover, in a bubble of the phone's look and theme, with "Done". Read-only, the
  cells show the words.
- Missing, as the checks' W03 has it: a message text and a button's text in every language, the
  others where the default language has them; such a cell is tinted and says "Missing". A copied
  text shows in italics with the tooltip "Copied from <default language>, not translated until
  edited" and counts as missing until its words change, however they are changed (the table, the
  phone, another person).
- "Copy the default language into empty cells" fills every empty cell of the other languages where
  the default language has the text, as one undoable change, and says "Copied the default language
  into <n> empty cells."; it is off when nothing is left to copy.
- 100 rows at first; "Show more" adds 100, with "<shown> of <total> texts" under it. With "Only
  missing" and nothing missing: "Every text is translated."
- The palette's "Variables" and "Test switches" (`VariablesEntries`, for MAP-01's palette) open one
  panel on the right with the tabs "Variables" and "Test switches". Variables are listed under
  "Built-ins" (label, `{id_name}`, type, description and "Used in"; read-only), "Saved answers"
  (questions and bottom buttons), "Remembered values" (Remember steps and start links) and
  "Developer outputs"; each of the others has "Label", "Type" ("Text", "Number", "Yes or no", "Phone
  number", "Location", "File", "Users", "Group or channel", "Poll"; a new type clears the test
  value), "ID name", "Test value" (a switch for yes or no, a number for numbers, a text for the
  rest), "Set in" and "Used in" (the steps in map order as the checks count them, or "Nowhere yet";
  a click closes the panel and selects the step on the map) and a delete button, which asks "Delete
  <label>?" ("<n> steps still set or use it; the checks will list them.") only while a step does. "+
  Variable" offers "Remembered value" or "Developer output" and adds "New variable" (Text) with the
  caret in its label. An empty group says "None yet".
- Test switches: each with "Label", "Type" ("Yes or no", "A choice"), "ID name", "Test value" (a
  switch, or one of the options; "No options yet"), "Options, one per line" for a choice (the test
  value stays one of them), "How the developer knows it", "Used in" (the If steps) and delete (asks
  while an If step uses it); "+ Switch" adds "New switch" (yes or no, test value No).
- An ID name is written at each change while it is valid and free; otherwise the field says "Use a
  to z, 0 to 9 and _, starting with a letter." or "This ID name is taken." and the design keeps the
  old one.
- Other texts the plan does not write: "Missing", "Every text is translated.", "Show more", "<shown>
  of <total> texts", "Done", "Make <language> the default language", "Remove <language>", "None
  yet", "Nowhere yet", "Set in", "Used in", "Remembered value", "Developer output", "New variable",
  "New switch", "A choice", "No options yet", "Options, one per line", "Delete <label>", and the
  toast above.

**PARTS-01** (7587284).

Code: The palette's "PARTS": `apps/web/src/editor/parts/PartsGroup.tsx` (the list, "+ Part", the
drags), placed by `palette/PalettePane.tsx`; where each part is used: `parts/uses.ts` (`partUses`,
`usesWords`, `kindWords`); Making parts: `parts/make.ts` (`useMakePart`, `hasOwnButtons`); the box
menu's item `parts/MakePartItem.tsx`, placed in MAP-02's `map/BoxMenu.tsx`; spec:
`parts.fromButtons(stepId, name)` in `packages/spec/src/ydoc/parts.ts`; The part editor:
`parts/PartEditor.tsx` (the sheet: name, ID name, phone, "Uses", "Delete part"), its small phone
`parts/PartPhone.tsx` with `parts/part.css`; opened from anywhere through `parts/store.ts`
(`useOpenPart`, `usePartEditor`, one store per open design; `PART_DRAG`, the drag types); Drops:
`parts/drop.ts` (`usePartDrop` on BTN-01's `phone/keyboard/InlineKeyboard.tsx` and
`phone/keyboard/ReplyKeyboard.tsx`, `dropTextPart` as `handleDrop` in TXT-01's
`phone/text/PhoneText.tsx`); the drop outline in `phone/keyboard/keyboard.css`; BTN-01's hooks:
`phone/keyboard/KeyboardRows.tsx` takes `at` (a step or a part, SPEC-04's `KeyboardAt`) and the
bottom keyboard's drop, and its row part menu's "Edit the part" opens the editor;
`phone/keyboard/ButtonPopover.tsx` works without a step (a part's button); TXT-01's hook: the
toolbar's "Part" list leaves out the part being edited (`phone/text/TextToolbar.tsx`);
`apps/web/src/editor/README.md`: the PARTS-01 entry says how it is built.

- "PARTS" in the palette lists the parts by name, each with an icon for inline buttons, a bottom
  keyboard or a text, and under the name its kind and uses ("Buttons, 3 uses", "Text, no uses"). A
  click opens the part editor. Dragging a row part onto a message's keyboard on the phone (the
  inline keyboard with the bar under the bubble, or the bottom keyboard's panel) shows a dashed
  outline and places the part in front of the row under the pointer; a message without buttons gets
  the part's kind of keyboard. An inline part does not drop on a bottom keyboard or the other way
  round, nor on "Remove the bottom keyboard" or "Force a reply", nor a second time in one keyboard.
  Dragging a text part into a text on the phone puts its chip where it is dropped (not in a code
  block, not into its own text).
- "+ Part" opens a menu: "Inline buttons", "Bottom keyboard" and "Text" make an empty part named
  "New part"; "From the selected box's buttons" (off unless the selected step has buttons of its
  own) does what the box menu's "Make a part from its buttons" does for its box (messages and
  questions, off without buttons of their own): the box's own button rows move into a new row part
  named after the box ("Main menu buttons"), the same buttons with their texts and arrows, placed
  where the first of those rows was; rows that already place a part stay. The new part's editor
  opens with its name field focused.
- The part editor is a sheet on the right: the part's name as its title with a line on what it is
  ("Buttons under a message. Editing them changes every use at once.", "Buttons of a bottom
  keyboard. Editing them changes every use at once.", "A text. Editing it changes every use at
  once."), "Name" and "ID name" (written at each change; the ID name follows the name until edited),
  the small phone in the chosen look, theme and language, "Uses" and "Delete part". A row part shows
  its rows alone, without a bubble: inline rows in the chat, bottom rows in the bottom keyboard's
  place, edited as on the phone ("+", "+ row", dragging, the button popover without "Draw on the
  map"; deleting the last button leaves the part empty with "+ row"). A text part shows its text in
  a bot's bubble with TXT-01's editor (the toolbar, "Not translated", the carets, the one undo
  history). A click on the map closes the sheet.
- "Uses": the steps in map order, each a button that closes the editor and selects the step on the
  map, with "Detach" beside it; then the text parts that place the part, each opening that part's
  editor; "Nowhere yet" without uses.
- "Delete part" asks "Delete <name>?" with "Its <n> uses get their own copy." ("Its 1 use gets its
  own copy.") and "Delete part" while the part is used, and deletes at once otherwise (Ctrl+Z brings
  it back).
- A row part's menu on the phone: "Edit the part" opens its editor.
- Other texts the plan does not write: "Inline buttons", "Bottom keyboard", "Text", "From the
  selected box's buttons", "New part", "<box title> buttons" ("Buttons" for a box without a title),
  "No uses", "1 use", "<n> uses", the editor's three lines above, "Nowhere yet", "Its 1 use gets its
  own copy.".

## As built (M5)

TRY-01 (the Try it engine) is in 03 As built (M5); the screen on it follows.

**TRY-02** (c082020).

Code: The session: `apps/web/src/editor/try/store.ts` (`TryStore` in `TryContext`: open, the test
user, the engine's states, "Skip waits"; `useTry`, `useSim`, `usePanelBeside`), provided and placed
by `apps/web/src/editor/Editor.tsx`; The phone in Try it: `try/TryPhone.tsx` (toolbar,
`TelegramChat` with presses, the start picker, choice cards, attachment menu, a question's quick
action, delay and toast timers, what happened under the phone); the state as chat entries:
`try/chat.ts`; The test user panel: `try/TestUserPanel.tsx` (Language, test switches, First name,
Username, Reset, Variables with their values); The map's highlight layer: `try/path.ts` (the path's
steps and arrows, `useTaken` in `map/ArrowEdge.tsx`) and `try/PathMark.tsx` (the ring, in
`OverlaidBox` of `map/BoxOverlay.tsx`); "Try it" and "Stop trying": `topbar/TryItButton.tsx`;
Ctrl+Enter and Esc: `try/keys.ts`, listed in `shortcuts.ts`; Preview: `ChatPresses`, `ComposerPress`
and `pressProps` (`packages/preview/src/platforms/telegram/slots.ts`), presses in `Chat.tsx`,
`Keyboard.tsx`, `Post.tsx` (`onButton`), `ChatSlots.each`, `ChatOptions.bottom` (`adapt.ts`), the
input field's and pressable parts' rules (`skins/chat.css`); Spec: `start` runs from any step
(`packages/spec/src/sim/engine.ts`, `SimStartEntry` in `types.ts`); `apps/web/src/editor/README.md`:
the TRY-02 entry.

- "Try it" in the top bar (every role, also under 900 pixels) opens the Map tab with the phone as
  the bot's chat in the chosen look and theme (the look switch stays on); the button then reads
  "Stop trying". Another tab, "Stop trying", the top bar button or Esc ends it; the test user is
  kept for the next try. The palette is dimmed and inert while trying; the map stays as it is and
  shows the path.
- Above the phone: "Start from" (a menu: /start, the commands, the start links as "/start
  <payload>", "A message the bot does not expect"), "Step back", "Restart" (the empty chat with the
  start picker), "Skip waits" (a toggle), "Test user" (under 1280 pixels, opens the panel as a
  sheet) and "Stop trying". The empty chat shows the card "Start from" with the same list over the
  chat; the chat's Start button starts from /start. Under the phone, in small grey lines, what the
  last action did ("Showed Main menu by editing the message", "Nothing happens next").
- The chat is PRV-02's `TelegramChat`: inline buttons on every message act (edit in place, new,
  replace, toast and alert as the look draws them; a toast goes after 2.5 seconds; the alert's "OK"
  closes it), the bottom keyboard as the engine keeps it (its button in the input field folds or
  shows it), the menu button opens the commands menu whose commands send "/command", the input field
  takes typed text (Enter or send), the clip opens the attachment card: "Send a test photo", "Send a
  test video", "Send a test file", "Send a test voice message", "Send a test audio file", "Share the
  test phone number", "Share the test location", "Cancel". A question that expects a file, a phone
  number or a location shows its one button over the chat ("Send a test photo", "Share the test
  phone number", ...). Share and pick buttons of the bottom keyboard send the engine's test values
  at once.
- The user's messages show as text: a test file as its kind's emoji and name ("🖼️ test_photo.jpg"),
  a contact as "📞 +12025550100", a location as "📍 48.8584, 2.2945", a user, group, channel or poll
  likewise, the fallback start as "A message the bot does not expect".
- A message held back by its delay waits its seconds, then shows its chat action in the top bar
  ("typing", "sending photo") for its seconds, then appears; "Skip waits" sends it at once. A wait
  step stays a card with "Skip the wait".
- Choice cards sit over the top of the chat: the engine's prompt ("Which way?", "The developer does:
  <description>. What happened?", "Waiting 2 hours") with one button per option.
- Test user panel (a column beside the phone from 1280 pixels): "Test user" with "Reset", "Language"
  (the design's languages), each test switch (a yes/no switch with "yes" or "no", a choice as a
  select), "First name" and "Username" (the variable's test value as the placeholder); "Variables":
  every variable's ID name with its value in this try, the test value greyed, "empty" for none. A
  switch and the language apply from the next step; a built-in value at once.
- The map: the steps the try went through get a ring in the brand color, the last step a stronger
  one; the arrows taken (a button's to its step, a step's own to the next) are drawn thicker in the
  brand color.
- Ctrl+Enter (Cmd+Enter) opens Try it and runs from the selected step (a start point as if the user
  started it, any other step without a user message), or the empty chat with none selected; outside
  a field.
- Step back drops the last tester action; a delay that ends and a toast that goes change the shown
  state without a new step.

**CHK-01** (8df89ba, e7d3b57).

Code: The Checks panel: `apps/web/src/editor/checks/ChecksPanel.tsx` (the sheet, the groups, the
lines, the language filter, "Ignore here" and "Stop ignoring"), opened by
`apps/web/src/editor/topbar/ChecksButton.tsx` (now a real button with its count); One run of the
checks per open design: `apps/web/src/editor/checks/runner.ts` (`ChecksRunner`: the 200 ms wait, the
worker above 100 steps, the instant marks of "Ignore here"), `apps/web/src/editor/checks/worker.ts`
(`check` in a web worker), `apps/web/src/editor/checks.ts` (`useChecks` and `useCheckCount` read the
runner, so the top bar's count, the panel and MAP-02's badges share one result);
`apps/web/src/editor/README.md`: the CHK-01 line and the `useChecks` line.

- "Checks" opens a sheet on the right (at the bottom on a phone) titled "Checks": "Errors" with the
  note "Telegram cannot do this", "Warnings", "Good to know", each with its count and shown only
  when it has lines, then "Ignored" (warnings and good-to-know lines of any level, greyed, with
  "Stop ignoring"). With nothing to list: "No problems found" (with a language chosen: "Nothing in
  <language>").
- A line: a dot in the level's color, the step's title (its ID name when it has none; "Bot setup"
  for the bot's name, about, description and photo), "›" and the button's text in the shown language
  (its ID name when empty), the language code at the end (its name on hover), and the message. Lines
  keep the order of `check` (level, then map order).
- A line's click closes the sheet, shows the Map tab, switches the shown language to the line's
  language when it has one, and selects the step and the button (`reveal(step, button)`: the map
  centers it, the phone outlines the button); a line without a step opens Bot setup. Lines of a step
  deleted since the last run are hidden.
- "Ignore here" on warnings and good-to-know lines and "Stop ignoring" on ignored ones, only for
  people who can edit; each is one change of the person (Ctrl+Z undoes it), and the line moves at
  once.
- The language filter ("All languages" or one language) shows when the design has two or more
  languages; a language shows only the lines of that language.
- The checks run once per open design for every reader, 200 ms after the last change (02 section 9 says the same); a design of more than 100 steps is posted as the plain
  model to a web worker, one design at a time (a newer one waits for the reply and goes next). A
  small design has its issues at the first render.


## As built (M9)

**CMT-02** (a44706a).

Code: Comment mode, the panel's state, the threads and the pins' numbers:
`apps/web/src/editor/comments/store.ts` (`CommentStore` as `useEditor().comments`, `useThreads`,
`usePins`, `useCommentsLive`), C and Esc in `comments/keys.ts`, "Comment" in the top bar
(`topbar/CommentButton.tsx`) and the box menu (`map/BoxMenu.tsx`); Anchors from clicks and in words:
`comments/anchors.ts`; the map's clicks in `map/MapPane.tsx` (`onNodeClick`, `onPaneClick`, a pill's
`data-button` in `map/boxes/Box.tsx`), the phone's in `phone/PhonePane.tsx` (a click capture, the
phone read-only in comment mode); Pins: `comments/Pins.tsx` (`BoxPins` through the map's overlay
context in `map/actions.ts` and `map/BoxOverlay.tsx`, `MapSpotPins`, `PhonePins` over the preview's
shadow root; `data-button` on BTN-01's buttons in `phone/keyboard/KeyboardRows.tsx`); The Comments
panel: `comments/CommentsPanel.tsx` (opened from "..." > "Comments" in `topbar/MoreMenu.tsx`, a pin,
the bell, comment mode), the text with the "@" list: `comments/CommentInput.tsx`; The bell:
`apps/web/src/comments/CommentsBell.tsx` and `comments/unread.ts`, in `app/AppShell.tsx` and
`editor/topbar/TopBar.tsx`; the editor route's `comment` search (`routes/_editor/d.$id.tsx`,
`Editor.tsx`); Designs cards: the unread count on the card's tile (`designs/DesignCard.tsx`,
`routes/_app/index.tsx`); Live: `commentsChanged` counted in `LiveState` (`editor/live.ts`); the
threads and the bell are read again at each one. Comment mode ("Comment" in the top bar, or C; Esc
or C again leaves it) is for Commenter and above; a Viewer has no button and no key but reads the
panel and sees the pins. In comment mode a click on a box starts a thread on its step, on a button's
pill on that button, on the empty map on that spot (map coordinates); on the phone a click on the
bubble starts one on the step's text in the language shown, on a button on that button. The phone is
drawn read-only while comment mode is on (no text editor, no button popover). The box menu has
"Comment" (people who can edit). A new thread is written at the top of the Comments panel (the right
sheet, like Checks): the place in words, the text, "Cancel" and "Comment". The panel's tabs "Open"
and "Resolved" list the threads newest first; each shows its pin number (open ones), its place, its
comments (author, time, "(edited)", the "@name" mentions marked), "Resolved by <name>" once
resolved, then "Reply" and "Resolve" or "Reopen" (Commenter and above). A comment's menu has "Edit"
(its author) and "Delete" (its author and the design owner); deleting the first comment asks "Delete
this thread?" ("Its replies are deleted too."), a reply "Delete this comment?". The place's click,
when its step is still there, closes the panel and selects the step or button on the Map (in the
text's language) through `reveal`; a thread on a deleted step shows "On a deleted step: <title>", on
a deleted button "on a deleted button: <label>", on the map "On the map". "@" in a comment's text
lists the design's people with access (`GET /api/designs/:id/members`, the person left out) whose
name has a word starting with what follows it; arrows and Enter or Tab pick, Esc closes the list;
the comment sends the IDs of the picked people whose "@name" is still in the text. Ctrl+Enter sends.
Pins: numbered dots (the oldest open thread is 1, numbers follow the open threads only) down the
left edge of a box for the threads on its step, its buttons and its texts; on the map at a spot's
coordinates; on the phone at the bubble's top right corner (threads on the step and on its text in
the language shown) and at each button's. A pin's click opens the panel on its thread. The bell
(site top bar and editor top bar) shows the count of unread comments (marked "@" in red when some
mention the person) and lists the 50 newest, each with its author, design, time, text and "Mentions
you"; a click opens the design with the panel on the thread (the editor route's `comment` search,
removed from the address once shown). It is read every minute, when the window gets the focus, and
in an open editor at each `commentsChanged` notice. Opening the Comments panel marks the design's
comments read (`POST /api/designs/:id/comments/read`), again at each new reading while it stays
open; opening the editor alone does not. The Designs cards show the person's unread count of the
design on the card's picture tile (with "@" when some mention them), from the bell's answer. The
page of a view-only link (VIEW-01) has no comments: the threads are not read there (no pins, no
panel), its export dialog has no "Include open comments" and exports none (`LiveDesign.viewToken`,
now public, tells the page). Left open: map spots: a thread's place on the map does not move the
view to the spot (only steps and buttons are revealed); no "new since you last read" marks inside
the panel (the bell lists the unread comments).

**HIST-02** (4b782b2).

Code: History store, one per open design: `apps/web/src/editor/history/store.ts` (`historyOf(live)`,
`useHistory`, `useHistoryStore`: the panel, the version viewed, the open dialog); Versions as shown
and read: `apps/web/src/editor/history/versions.ts` (`versionLabel`, `versionTitle`,
`versionDesign`, `readVersion`); History panel (right sheet):
`apps/web/src/editor/history/HistoryPanel.tsx`; "History" and "Name this version" in
`apps/web/src/editor/topbar/MoreMenu.tsx`; Viewing a version: `apps/web/src/editor/Editor.tsx` gives
`DesignContext` the version's plain design and turns the editor read-only; the banner
`apps/web/src/editor/history/VersionBanner.tsx` (uses `Banner`, now exported from `Banners.tsx`);
Compare: `apps/web/src/editor/history/compare.ts` (`compareDesigns`) and
`apps/web/src/editor/history/CompareDialog.tsx`; Dialogs (name, rename, delete, restore, a version's
export) and the reaction to a restore: `apps/web/src/editor/history/History.tsx`; Live notice:
`apps/web/src/editor/live.ts` (`versionRestored`: `restores` counter, undo history cleared, newer
layout check); `Editor.tsx` remounts the panes on it. The "..." menu has "History" (everyone) and
"Name this version" (Editors). The History panel lists the versions newest first: "Automatic", a
named version's name in bold, "Before restore", "Restored" (`Restored "<name>"` when the restored
version had a name); under each, who made it and how long ago (the date and time on hover). "Name
this version" sits at the top for Editors; with no versions the panel says "No versions yet" ("A
version is made every 10 minutes while people edit, and when the last editor leaves."). A click
opens the version ("Opening..." while it loads): the map, the phone, the Texts and Bot setup tabs
and Try it show the version's design, read-only, under the banner "You are looking at <name or
time>." (the name of a named version, else its date and time) with "Restore this version" (Editors),
"Compare with now" and "Back to now". Each version's "..." has "Export", and for a named version
"Rename" (Editors, dialog "Rename version") and "Delete" (the design owner, asks first: `Delete
"<name>"?`, "The version is deleted for everyone. The design does not change."). "Name this version"
opens a dialog with "Name" (placeholder "Sent to developer") and "Save", then says `Named this
version "<name>".`. "Restore this version" asks "Restore this version?" ("The design goes back to
<name or time> for everyone. Now is kept as "Before restore", so you can go back to it.",
"Restore"), then goes back to now. Every open editor (and a view link's page) then shows "This
design was restored to an earlier version.", forgets the person's undo history, starts its panes
again (open text editors bind to the restored texts, the map fits the view) and refreshes the
History panel; a tab whose build is older than the restored layout gets the reload banner. "Compare
with now" ("<name or time> on the left, now on the right.") lists "Added", "Removed" and "Changed"
steps with counts, in map order; each step shows its texts (title, note, text or captions, poll
question and options, a question's wrong answer, a developer step's description, its buttons' texts)
with the version's words beside now's; an added or removed step shows its texts in the language
shown, a changed step every text that differs in every language (with a language tag when the design
has several); "Other changes" marks a step whose settings, arrows, files or button targets changed;
moving or resizing a box is not a change; "Also changed: Bot setup, Languages, Variables, Test
switches, Parts" closes the list; "No changes" when nothing differs. Opening a dialog from the
History panel closes the panel and it opens again after. The export dialog's "Version" is in 06 As
built (M9). Left open: Compare is between a version and now only (05 section 7 also mentions two
versions, which the panel does not offer yet); "Print" in the "..." menu prints now even while a
version is open; the Claude link's `?version=<name or id>` is CL-01's.

**VIEW-01** (266c663, 1b6c83b, 4b494e0).

Code: Page: `apps/web/src/routes/v.$token.tsx` and `apps/web/src/view/ViewPage.tsx` (header, live
document, top bar, "This link no longer works." card); `apps/web/src/api/media.ts` (`mediaUrl`, the
token of the open view page) used by every media address (phone, Try it, Bot setup previews, export,
pictures); Share dialog: `apps/web/src/designs/ViewLinksSection.tsx` under "Add people" in
`ShareDialog.tsx`; Made reusable: `EditorFrame` is exported from `apps/web/src/editor/Editor.tsx`
and takes the top bar as `bar` and the look's key as `lookKey` (it used `useMe()`); `LiveDesign`
takes an opener (`{ userId }` or `{ viewToken }`); `ExportButton` and `ExportDialog` take a known
`docVersion` (no header query without a session); `NarrowPanes` shows "Editing works on a computer
screen" only to people who can edit. The Share dialog's "View-only link" section has an expiry
choice ("1 day", "7 days", "30 days", "Never expires", the last by default) and "Create link", which
shows the link once with "Copy" and "The link is shown only now."; below it the links that still
work, newest first, each with "Made <time ago>", "Valid until <date>" or "Never expires", "Last used
<time ago>" or "Not used yet", and "Revoke". Revoked and expired links are not listed. A page whose
socket stays down asks the link again every 30 seconds and shows the sentence once it is refused.
The page is the editor read-only on the Map tab: the design's name and its design owner's name,
"Read only", the language and look switches, "Try it" and "Export" (no tabs, Checks, Share, palette,
presence or "..."). The look is remembered in the browser under `view`. The links' routes and the
live connection are in 05 and 02 As built (M9).

## As built (M7)

**MSG-03** (3a9dbc4).

Code:

- Kind row: "Poll", "Quiz", "Dice", "Paid media" for message steps, what a kind change keeps:
  `apps/web/src/editor/phone/kinds.ts`, `phone/KindRow.tsx`.
- Preview parts: the poll and quiz bubble `packages/preview/src/platforms/telegram/Poll.tsx`, its
  stylesheet `skins/poll.css`; dice and paid media in `Post.tsx` and `Album.tsx`; `PollTokens`,
  `PollLabels`, `PaidTokens`, `dice` in `skins/tokens.ts` with each look's values in `skins/web.ts`,
  `webk.ts`, `desktop.ts`, `android.ts`, `ios.ts` (calibrate: O-02); words in `skins/labels.ts`;
  `TgPoll` and the post's `poll`, `dice`, `paid` in `model.ts`; the `option` slot and the `vote` and
  `unlock` presses in `slots.ts`, `Chat.tsx`; the input shapes and `BotMessage.sent` in `adapt.ts`.
- Editing: the question in the `text` slot without the toolbar (`phone/text/stepText.ts`,
  `textSlot.ts`, `PhoneText.tsx`, `TextCounter.tsx`), the options in place
  (`phone/poll/OptionField.tsx`, `phone/slots.ts`), the settings under the counter
  (`phone/KindSection.tsx`, `phone/poll/PollSection.tsx`), paid media's items
  (`phone/media/AlbumEditor.tsx`, `BubbleMedia.tsx`), "Save the vote as" and "Save the roll as"
  (`phone/keyboard/fields.tsx` `VariablePicker` takes a `source`).
- Try it: votes, the payment card and the dice value: `apps/web/src/editor/try/chat.ts`,
  `TryPhone.tsx`, `TestUserPanel.tsx`.
- `apps/web/src/editor/README.md`: the MSG-03 entry.

As built:

- Kind row: a message step's select ends with "Poll", "Quiz", "Dice", "Paid media" (no "Checklist",
  D-36); a question's prompt offers stage 1's kinds only. Changing to a poll or quiz keeps the text
  as the question (no question asked); between poll and quiz the options and settings stay (a quiz's
  right options where they still fit; a new quiz marks the first option right); from a poll to a
  kind with a text or caption the question becomes it.
- The phone draws a poll or quiz in the widest bubble: the question (only its custom emoji, as
  Telegram keeps them), the type line ("Anonymous Poll", "Public Poll", "Anonymous Quiz", "Quiz";
  iOS writes "No Votes" and "Nobody answered yet"), each option with its round mark (rounded square
  with several answers) and a line under it, and the footer ("No votes", "No answers", or "Vote" for
  several answers) with the time at its end. On the editor's phone a quiz's right options show their
  mark filled with a check in the right color. A dice is its emoji's still frame (Apple's image) 160
  pixels big without a bubble, with the time on the look's pill. Paid media is its pictures blurred
  under the price button "Unlock for ⭐ 50" in the look's pill colors over media.
- Editing on the phone: the question is written in the bubble with TXT-01's editor without its
  toolbar (the counter reads "/ 300"); each option is written in place in the language shown (a
  language without it shows the default language's text as the placeholder). Under the counter,
  "Poll" or "Quiz": "Options" (the options in order with "Right" for a quiz, move up, move down,
  remove; 1 to 12) and "Add an option" (a move or removal rewrites the right answers in the same
  change), "Anonymous voting", "Multiple answers", "Users can change their vote" (Telegram's default
  left out), "Shuffle the options", "Users can add options" (a poll), "Hide the results until the
  poll closes", "Close after (seconds)" ("Empty: the poll stays open."), a quiz's "Explanation"
  ("Add an explanation", then the text in a bubble of the look with TXT-01's editor, "Remove the
  explanation"), and "Save the vote as". "Dice": "Emoji" (🎲 🎯 🏀 ⚽ 🎳 🎰) and "Save the roll as". "Paid
  media": "Price in Stars" (1 to 25000), "Caption above the media", "Add a caption"; a click on the
  media opens MSG-01's album editor for its items (1 to 10 photos, videos and live photos, "Paid
  media holds photos and videos. Use a photo or a video.").
- "Save the vote as" and "Save the roll as": "None", the variables of the type (text for a poll,
  yes/no for a quiz, number for a dice) and "+ New variable" (a variable set like a question's
  answer). A poll saves the chosen option's text in the default language (several joined with ", "),
  a quiz yes when the answer is right, else no, a dice the number rolled. E27: an anonymous poll or
  quiz that saves the vote ("... does not tell the bot who voted. Turn off anonymous voting or stop
  saving the vote."). The export writes `saveTo` (the variable's ID name) in the message and
  `telegram.saveFrom`: `poll_answer.option_ids` or `result.dice.value`; design.md says "Saves the
  vote as" or "Saves the roll as".
- Try it: a press on an option votes (with several answers presses pick the options and "Vote"
  votes); then each option shows its share (100% or 0%), its bar and the chosen option's tick, a
  quiz its right options in green and a chosen wrong one in red with a cross, the footer "1 vote",
  "1 answer" or "View Results" (a public poll). The price button of paid media opens a card "Unlock
  for ⭐ 50" with "Pay (test)" (the media shows unblurred) and "Cancel". The test user panel has
  "Dice value" ("Random" when empty) when the design has a dice; the roll, the vote and what was
  saved show in the lines under the phone ("Saved the vote to ...", "Saved the roll to ...").

**RICH-01** (e736ff2).

Code:

- Phone: `packages/preview/src/adapt.ts` (`RichMessageBlockIn`, `adaptRich`),
  `platforms/telegram/model.ts` (block kind `buttons`), `RichContent.tsx` (`Buttons`),
  `richBlocks.ts` (`wideRich`), `skins/preview.css` (`.tg-rich-buttons`).
- Editor: "Rich message" in the kind row and what a kind change keeps
  (`apps/web/src/editor/phone/kinds.ts`, `KindRow.tsx` drops `draft` on a kind without a draft
  method), the blocks under the phone (`phone/rich/RichSection.tsx`, wired in
  `phone/KindSection.tsx`), `BubbleText` (the quiz explanation's bubble made general) in
  `phone/poll/PollSection.tsx`, `phone/text/stepText.ts`, "Write it out like a draft" in
  `phone/options/OptionsSection.tsx`.
- Try it: rich messages, their buttons inside and the draft's written part in
  `apps/web/src/editor/try/chat.ts`; the writing animation (`useWriting`) in `try/TryPhone.tsx`.

As built:

- Phone: the bubble is PRV-01's rich bubble (`RichContent`): each block's texts become ranges of one
  text, a code block gets its pre entity, a quote its blockquote entity (expandable when set), a
  list its items, a table its rows and header cells, a details block its title and text (open when
  set), a media block its file as the post's media, a heading sizes 4 to 6 drawn as 3; a button row
  inside is drawn with the look's inline buttons (calibrate: O-02). A rich message takes the widest
  bubble when it has a table, media or buttons.
- Editing: the kind row ends with "Rich message"; a change to it keeps the text as the first
  paragraph and a file that fits as a media block after it; from it the first text block becomes the
  text or caption and the first media block's file the file. Under the phone, "Rich message": the
  blocks in order ("1. Heading") with move up, move down and remove (at least one stays), each text
  written in a bubble of the look with TXT-01's editor; a heading's "Size" (1 to 6, "1 is the
  largest."), a quote's "Expandable", a list's items ("Add an item", remove) and "Numbered", a
  table's cells in a grid ("Add a row", "Add a column", "Remove the last row", "Remove the last
  column", "First row is a header", "Borders"), a details block's "Title" ("Always shown; a tap
  opens the text under it.") and text and "Shown open"; "Add a block" (Paragraph, Heading, List,
  Table, Details, Quote, Code block, Media, Divider, Footer) and "Right to left". "Options" has
  "Write it out like a draft" on text and rich messages.

**RICH-02** (3f93124).

Code:

- Phone: `ChatPresses.inside` in `packages/preview/src/platforms/telegram/slots.ts`, through
  `Chat.tsx` and `Post.tsx` (`onInside`) to `RichContent.tsx` (`onButton`).
- Editor: `apps/web/src/editor/phone/rich/RichSection.tsx` ("Buttons" in "Add a block",
  `RichButtons` with BTN-01's `ButtonPopover`, a media block's `MediaSource` and "Hide under a
  spoiler"); `map/arrows.ts` (`richRowsOf`, `shownRowsOf`, the `onStop` dot), `map/boxes/Box.tsx`,
  `map/search.ts`, `history/compare.ts`; `phone/options/OptionsSection.tsx` (`DraftStop`,
  `TargetField`); `phone/KindRow.tsx`; the editor's README.
- Try it: `try/chat.ts` (`pressedInside`, a stopped draft's written part, no keyboard while a draft
  is written), `try/TryPhone.tsx` (`presses.inside`, the "Stop" card, `useWriting` sending the
  engine's draft once written).

As built:

- Button rows inside a rich message: "Add a block" offers "Buttons", a row with one new inline
  button whose BTN-01 popover opens (text, look, icon, "Disabled (does nothing)", "When pressed"
  with "Goes to", a link, a text to copy or a login link, "Delete button"). Under the phone the row
  shows its buttons; a click opens the popover beside the button (a click on its pill on the map
  too); "+" adds a button up to 8 ("A row holds at most 8 buttons."); deleting the row's last button
  removes the row. The map's box shows the buttons inside as pills before the keyboard's, each with
  its dot; arrows, the map search, "Compare with now" and Duplicate (which copies them) treat them
  like a keyboard's. The accessors `edits.keyboard.addRow`, `addButton` and `moveButton` take `{
  rich: stepId }`: the message's blocks are the rows and a new row is a `buttons` block.
- A media block: MSG-01's "Upload a file", "Use a placeholder" and "Use a file already in this
  design" for photos, videos, GIFs, audio, voice messages and files ("A rich message takes photos,
  videos, GIFs, audio, voice messages and files." for another file), and "Hide under a spoiler".

**PAY-02** (ff511f3, 4083d28).

Code:

- Palette: "Invoice" and "Action" in ADD, "+ Payment done" and "+ Refund" in Start points:
  `apps/web/src/editor/map/kinds.ts`.
- Map: the invoice box (title in the language shown, total, pills, "Paid"):
  `map/boxes/InvoiceBox.tsx`; the action box ("Refund Club card"): `map/boxes/ActionBox.tsx`;
  payment start points name their invoice: `map/boxes/StartBox.tsx`; an invoice is a sending step
  (`SendingStep`, `isSending`, its buttons' arrows): `map/arrows.ts`.
- Phone: the invoice's card with its buttons edited in place and its form under it:
  `phone/PhonePane.tsx` (`InvoicePhone`), `phone/invoice.ts`, `phone/keyboard/InlineKeyboard.tsx`
  (`InvoiceKeyboard`), `phone/keyboard/keyboardSlots.ts`, `phone/keyboard/model.ts` (`payAsLink`),
  `phone/keyboard/KeyboardRows.tsx`.
- Invoice form: `forms/InvoiceForm.tsx`; the invoice picker: `forms/InvoiceSelect.tsx`;
  `forms/start/fields.tsx` (`PlainTextField` without a counter when it has no limit).
- Pay button kind in the button popover (invoices only): `phone/keyboard/ButtonPopover.tsx`.
- Refund action form: `forms/ActionForm.tsx`, `forms/logic.ts`, `forms/LogicForm.tsx`.
- Payment start points' "Invoice": `forms/start/StartForm.tsx`.
- "has paid" and "is subscribed to" in the condition picker: `forms/ConditionRow.tsx`.
- Texts tab rows for invoices: `texts/rows.ts`.
- Preview: the invoice content and Telegram's own pay button (`adapt.ts`), the card
  (`platforms/telegram/Post.tsx`, `skins/invoice.css`), `TgInvoice` and `TgPaymentSheet`
  (`model.ts`), the payment sheet (`Chat.tsx` `PaymentSheet`, `ChatOptions.payment`,
  `ChatPresses.pay` and `cancelPayment` in `slots.ts`, `TelegramChat.tsx`), `InvoiceTokens`
  (`skins/tokens.ts`, each look's values in `web.ts`, `webk.ts`, `desktop.ts`, `android.ts`,
  `ios.ts`, calibrate: O-02), `sheetLabels` (`skins/labels.ts`).
- Try it: the invoice card and the payment sheet from the engine's `payment`: `try/chat.ts`
  (`paymentSheet`), `try/TryPhone.tsx`.
- `apps/web/src/editor/README.md`: the PAY-02 entry.

As built:

- Palette: ADD ends with "Invoice" and "Action"; Start points end with "+ Payment done" and "+
  Refund". "New step here" offers both kinds too.
- Map: an invoice box shows its title in the language shown with its total ("Coffee club · ⭐️250
  every 30 days"), its buttons as pills (a dot on each button that goes to a step) and the dot
  "Paid". An action box shows "Refund Club card" ("Refund: no invoice yet" while none is chosen) and
  "Then". A payment start point says "A payment of Club card arrives" or "A payment of any invoice
  is refunded".
- Phone: an invoice shows its card as the user sees it in every look: the title (bold), the
  description, then the photo with the price in the pill over it ("⭐️50 INVOICE"), or the price on
  its own line without a photo. Its buttons are edited in place as a message's (BTN-01); without
  buttons the phone shows Telegram's own pay button ("Pay ⭐️50", "Pay 4.50 USD") with "+ Inline
  buttons", which starts the keyboard with a pay button "Pay". There is no bottom keyboard and no
  "More" for invoices. A subscription is drawn as Telegram receives it: a message with the title in
  bold over the description (and the photo), its pay buttons drawn as link buttons.
- The invoice form under the phone: "Invoice" ("Title", "Invoice title" and "Description" in the
  language shown with their counters, "Photo" with MSG-01's picker and "Remove"); "Price" ("Telegram
  Stars" or "Card" with "Currency code", the price lines with a label in the language shown, an
  amount in the currency's units and remove, "+ Price line" (one line in Stars), the total,
  "Subscription (every 30 days)" in Stars with the line "Telegram takes subscriptions only through
  an invoice link: the bot sends a message with the link in a URL button in place of the pay
  button."); "Physical goods" ("Physical goods, or a service outside the app stores", "Ask for the
  name", "Ask for the phone number", "Ask for the email", "Ask for the shipping address", "Flexible
  shipping (the price depends on the address)" with its options, a title and a price each, "+
  Shipping option"); "Pre-checkout check" ("Check before Telegram takes the money", "What the
  developer checks", the outcomes OK and Refuse in words, "Refuse message"); "Paid" ("Goes to",
  "Payload" with the ID name as its placeholder, "Silent (no sound)", "Protect (no forwarding or
  saving)"). Switching to a card currency turns the subscription off.
- The button popover's "When pressed" has "Pay" on an invoice's inline buttons only.
- The Action form: "Title", "Refund" (the invoice, "Gives back the user's Stars payment of this
  invoice.") and "Then".
- A payment start point's form: "Invoice" ("Any invoice" or one of the design's invoices) with what
  it takes in a line.
- The condition picker: after "The user", "is a member of" [@channel], "has paid" [invoice] or "is
  subscribed to" [an invoice with a subscription].
- The Texts tab lists an invoice's title, description, price lines, shipping options, refusal
  message and buttons.
- Try it: the invoice shows as its card (a subscription as its message); its pay button opens the
  payment sheet over the chat in the look's colors: "Checkout" ("Confirm Your Purchase" in Stars),
  the photo, title and description, the price lines, the chosen shipping option, "Total" (with
  "every 30 days" for a subscription), what it asks for, "Shipping Method" with the options (the
  first chosen) for flexible shipping, "Pay (test)" and "Cancel". Then PAY-01's engine: the
  pre-checkout card "The developer checks: ... What happened?" with "OK" and "Refuse", "Paid" or a
  "Payment done" start point.

## As built (M8)

**EVT-02** (722766b).

Code:

- Palette: "+ Subscription changed", "+ User blocks the bot", "+ User restarts the bot", "+
  Broadcast" after PAY-02's payment start points: `apps/web/src/editor/map/kinds.ts`.
- Action form: "Does" (the kind) and each kind's fields: `apps/web/src/editor/forms/ActionForm.tsx`;
  the gift's card on a small phone with its text written in place and its counter:
  `forms/GiftBubble.tsx`; TXT-01's editor with only a gift's formatting: `phone/text/PhoneText.tsx`
  (`gift`), `phone/text/TextToolbar.tsx`.
- Action box ("React 👍 to the user's message", "Pin New roast", "Send a gift: ...", "Show
  "typing...""): `map/boxes/ActionBox.tsx`.
- Start point forms for Subscription changed, User blocks the bot, User restarts the bot and
  Broadcast: `forms/start/StartForm.tsx`; their box words (a broadcast's audience and "When"):
  `map/boxes/StartBox.tsx`.
- Wait's reminder ("Only once these hold" under "Stop waiting"): `forms/WaitForm.tsx`,
  `map/boxes/WaitBox.tsx`; the condition editor shared by If, the reminder and the broadcast:
  `forms/ConditionList.tsx` (taken out of `forms/IfForm.tsx`).
- Texts tab: a gift's text: `texts/rows.ts`.
- Preview: the bot's reaction on a bot or user message (`ChatEntry.reaction`, `adapt.ts`;
  `OutgoingRow` in `platforms/telegram/Chat.tsx`; no count in `Post.tsx`), the pinned message bar
  (`ChatOptions.pinned`, `TgChat.pinned`, `PinnedBar` in `Chat.tsx`, `listTop` in
  `skins/tokens.ts`), the gift's card (content `gift`, `TgPreviewPost.gift`, `GiftRow` in
  `Post.tsx`), Restart while blocked (`ChatOptions.blocked`, `TgChat.blocked`, `ComposerPress`
  `restart` in `slots.ts`), `EventTokens` (`skins/tokens.ts`, each look's values in `web.ts`,
  `webk.ts`, `desktop.ts`, `android.ts`, `ios.ts`, calibrate: O-02), `eventLabels`
  (`skins/labels.ts`), `skins/events.css`; `TelegramChat.tsx` passes `pinned` and `blocked`.
- Try it: the "Events" menu, Restart, the chat action step in the top bar: `try/TryPhone.tsx`;
  reactions, the gift's card and the pinned message's words: `try/chat.ts`.
- `apps/web/src/editor/README.md`: the EVT-02 entry.

As built:

- Palette: Start points end with "+ Payment done", "+ Refund", "+ Subscription changed", "+ User
  blocks the bot", "+ User restarts the bot", "+ Broadcast" (no "+ User reacts", D-36). "Action"
  stays one item: its kind is chosen in the form; a new action is a refund.
- The Action form: "Title", "Does" ("Set a reaction", "Pin a message", "Unpin a message", "Delete a
  message", "Send a gift", "Show a chat action", "Refund a payment"), the kind's fields, "Then". A
  reaction: "Emoji" (Telegram's reaction emoji in a grid), "On" ("The user's last message" or a
  message, question or invoice step: the message it sent the user last), "Big animation". Pin, unpin
  and delete: "Message" (an unpin also "The newest pinned message"), with what it does in a line (no
  notification for a pin, 48 hours for a delete). A gift: its card as the chat shows it with the
  text written in place (bold, italic, underline, strikethrough, spoiler, date and time, custom
  emoji, variables and parts only) and its counter "0 / 128", "Which gift" in words ("In words: the
  developer picks it from Telegram's gifts. It is paid from the bot's Stars."), "Also pay for the
  upgrade". A chat action: "Show" with the catalog's chat actions. Changing the kind keeps the
  message between a reaction, a pin, an unpin and a delete.
- The action box says what it does: "React 👍 to the user's message", "Pin New roast", "Unpin the
  newest pinned message", "Delete New roast", "Send a gift: A teddy bear", "Show "typing..."",
  "Refund Club card" (muted while its message, gift or invoice is missing).
- Start point forms: Subscription changed has "Invoice" ("Any invoice" or an invoice with a
  subscription) and "Change" ("Any change", "Canceled", "Turned back on", "Could not be paid"); User
  blocks the bot and User restarts the bot say what they take in a line; Broadcast has "Who gets it"
  ("Everyone" or "Some users" with the conditions, "Only users who started the bot and did not block
  it.") and "When" in words ("In words: the developer schedules it."). Their boxes: "A subscription
  of Club card could not be paid", "The user blocks the bot", "The bot writes first to everyone"
  with "When: Every Monday at 9:00".
- Wait: under "Stop waiting", the switch "Only once these hold" makes a reminder: its conditions as
  in If ("all of these" or "any of these", "+ Condition", "Stops waiting once ..."); without it
  "Anything the user does stops the wait."; "Still go on" clears the conditions. The box adds "Stops
  once <conditions>".
- The phone (every look, calibrate: O-02): the bot's reaction is a pill with its emoji under the
  text of the bot's message or the user's; the pinned message bar under the top bar ("Pinned
  Message" in the accent color over the message's first line, a pin at its end; floating under a
  floating top bar); a gift is a card in the middle of the chat (🎁 with "Which gift" under it, "Gift
  from <bot>", the text, "View"); a chat action step shows in the top bar ("typing...") for 5
  seconds or until the next message.
- Try it: "Events" beside "Start from": "User blocks the bot" (the chat shows Restart in the input
  field's place; pressing it is "User restarts the bot"), "User restarts the bot", "Time passes"
  (while a wait or a delay holds), then the design's broadcasts and subscription changes by title,
  each fired on the chat as it is ("Start from" starts again). "Step back" undoes each.
- The Texts tab lists a gift's text ("Gift text").

## As built (M11)

**TPL-01** (69e7182).

Code:

- Web: the gallery `apps/web/src/routes/_app/templates.tsx`, its card
  `src/designs/TemplateCard.tsx`, the dialog `src/designs/SaveTemplateDialog.tsx`; "New from
  template" on Designs (`src/routes/_app/index.tsx`), "Start from a template" in New design
  (`src/designs/NewDesignDialog.tsx`), "Save as template" in a card's menu
  (`src/designs/DesignCard.tsx`) and the editor's "..." (`src/editor/topbar/MoreMenu.tsx`); the
  Activity words (`src/settings/activityText.ts`); `src/routeTree.gen.ts`.

As built:

- Gallery `/templates`: "Templates" with "Start a new design from a template; it becomes yours to
  change."; "Starter templates", then "This site's templates" (empty: "No templates of this site
  yet." with "Choose "Save as template" in the menu of a design you own."). Each card: a tile with
  the template's icon (a bag, a life buoy, a brain, a clipboard; the design icon for the server's
  own), the name, "Starter template" or "Saved by <name> <time>", the description, "<n> steps ·
  <languages>", and "Use this template"; the server's own have a menu with "Remove" for the person
  who saved it and the site owner ("Remove the template <name>?", "Designs made from it stay. This
  cannot be undone.", "Remove").
- Designs: "New from template" (a link to `/templates`) between "Import" and "New design"; New
  design's dialog has "Start from a template" beside "Cancel". A card's menu (design owner and site
  owner) and the editor's "..." (role owner) have "Save as template": the dialog "Save as template",
  "A copy of the design as it is now goes to Templates, where every member can start a design from
  it.", "Name" (the design's), "Description" (placeholder "What the template is for"), "Save as
  template"; then the toast "Saved <name> as a template." with "Templates".

## As built (M13)

- Settings > "Claude connections" (MCP-01b): every person's keys with the person, "Last used",
  "Can't show questions" with "Ask in the chat again", the "Ask first" switch and "Revoke"; "No
  API keys yet." without any. History names the key of a version made through Claude: "<person>
  via Claude Code key "<name>"".
