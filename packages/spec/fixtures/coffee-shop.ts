// The example design (SPEC-06, docs/plan/14-milestones.md M1): "Coffee shop", the bot of a café in
// English and Persian that uses every stage 1 step kind, content kind, button action, keyboard,
// logic box and start point, with a section of the café's tour and one of the shop; stage 2 adds
// polls, payments, the events and every kind of action. Media are placeholders, so no files are
// needed. make spec-check validates it, runs its checks (no errors)
// and its export and import round trips, and writes its spec.json to fixtures/out/.
import type {
  Button,
  ButtonId,
  Design,
  FrameId,
  InlineAction,
  InlineButton,
  Keyboard,
  MediaSlot,
  Paragraph,
  PartId,
  ReplyAction,
  RichBlock,
  RichInline,
  RichMark,
  RichTextRef,
  Row,
  RowsPart,
  Step,
  StepId,
  TestSwitch,
  TextId,
  TextPart,
  Variable,
} from '../src/index.ts'
import { builtinVariables, byId, idNames, sayer } from './build.ts'

const idName = idNames()

// Variables and the test switch.

const variable = (
  id: string,
  label: string,
  type: Variable['type'],
  source: Variable['source'],
  testValue?: string | number,
): Variable => ({
  id,
  idName: idName(label, '', 'var_'),
  label,
  type,
  source,
  ...(testValue !== undefined && { testValue }),
})

const variables: Variable[] = [
  ...builtinVariables(),
  variable('var-promo', 'Promo code', 'text', 'startLink', 'SUMMER'),
  variable('var-drink', 'Favorite drink', 'text', 'button', 'Latte'),
  variable('var-cups', 'Cups', 'number', 'question', 2),
  variable('var-phone', 'Phone', 'phone', 'question', '+989121234567'),
  variable('var-order', 'Order ID', 'text', 'devStep', 'A-1042'),
  variable('var-points', 'Loyalty points', 'number', 'remember', 12),
  variable('var-last-order', 'Last order', 'text', 'remember', 'A-1042'),
  variable('var-feedback', 'Feedback', 'text', 'question', 'More oat milk, please!'),
  variable('var-location', 'Delivery location', 'location', 'button'),
  variable('var-friend', 'Invited friend', 'users', 'button'),
  variable('var-group', 'Office group', 'chat', 'button'),
  variable('var-poll', 'Drink poll', 'poll', 'button'),
]
const varId = (name: string): string => variables.find((item) => item.idName === name)?.id ?? name

const isAdmin: TestSwitch = {
  id: 'sw-admin',
  idName: idName('User is admin', '', 'switch_'),
  label: 'User is admin',
  type: 'yesNo',
  testValue: false,
  description: "The developer checks the user's Telegram ID against the café's staff list.",
}
const wantsNews: TestSwitch = {
  id: 'sw-news',
  idName: idName('Wants news', '', 'switch_'),
  label: 'Wants news',
  type: 'yesNo',
  testValue: true,
  description: 'The user asked the barista for news of new roasts; the developer keeps that list.',
}

// Texts: plain lines with {variables}, and the marks and nodes of the formatted ones.

const say = sayer(variables)
const t = (text: string, ...marks: RichMark[]): RichInline =>
  marks.length > 0 ? { type: 'text', text, marks } : { type: 'text', text }
const bold: RichMark = { type: 'bold' }
const italic: RichMark = { type: 'italic' }
const underline: RichMark = { type: 'underline' }
const strike: RichMark = { type: 'strike' }
const spoiler: RichMark = { type: 'spoiler' }
const mono: RichMark = { type: 'code' }
const link = (href: string): RichMark => ({ type: 'link', attrs: { href } })
const dateTime = (unix: number, format: string): RichMark => ({ type: 'dateTime', attrs: { unix, format } })
const varNode = (name: string): RichInline => ({ type: 'variable', attrs: { var: varId(name) } })
const emojiNode = (id: string, fallback: string): RichInline => ({ type: 'customEmoji', attrs: { id, fallback } })
const partNode = (part: PartId): RichInline => ({ type: 'part', attrs: { part } })
const p = (...content: RichInline[]): Paragraph => ({ type: 'paragraph', content })
const quote = (expandable: boolean, ...lines: string[]): RichBlock => ({
  type: 'blockquote',
  attrs: { expandable },
  content: lines.map((line) => p(t(line))),
})
const codeBlock = (text: string): RichBlock => ({
  type: 'codeBlock',
  attrs: { language: null },
  content: [{ type: 'text', text }],
})
const rich = (id: TextId, en: RichBlock[], fa: RichBlock[]): RichTextRef => ({
  id,
  doc: { en: { type: 'doc', content: en }, fa: { type: 'doc', content: fa } },
})

// A custom emoji of a coffee cup (its ID as Telegram gives it) and its fallback.
const CUP_EMOJI = '5368324170671202286'
// Friday 1 January 2027, 18:00 UTC.
const TASTING = 1798826400

// Parts: the row of "Back" and "Main menu" placed on three messages, and the café's signature.

const buttons: Button[] = []
const inline = (
  id: ButtonId,
  en: string,
  fa: string,
  action: InlineAction,
  more: Partial<Pick<InlineButton, 'look' | 'icon' | 'disabled'>> = {},
): ButtonId => {
  buttons.push({ id, idName: idName(en, 'btn_'), label: { en, fa }, look: 'default', place: 'inline', action, ...more })
  return id
}
const bottom = (id: ButtonId, en: string, fa: string, action: ReplyAction): ButtonId => {
  buttons.push({ id, idName: idName(en, 'btn_'), label: { en, fa }, look: 'default', place: 'reply', action })
  return id
}
const goTo = (
  target: Extract<InlineAction, { type: 'goTo' }>['target'],
  show: 'edit' | 'new' | 'replace',
  more: Omit<Extract<InlineAction, { type: 'goTo' }>, 'type' | 'target' | 'show'> = {},
): InlineAction => ({ type: 'goTo', ...(target !== undefined && { target }), show, ...more })
const row = (...ids: ButtonId[]): Row => ({ type: 'buttons', ids })
const partRow = (part: PartId): Row => ({ type: 'part', part })
const inlineKeyboard = (...rows: Row[]): Keyboard => ({ type: 'inline', rows })
const placeholder = (description: string): MediaSlot => ({ placeholder: { description } })

const nav: RowsPart = {
  id: 'nav',
  idName: idName('Back and menu', '', 'part_'),
  name: 'Back and menu',
  kind: 'rows',
  place: 'inline',
  rows: [
    [
      inline('b-nav-back', '⬅️ Back', '⬅️ بازگشت', goTo('back', 'edit')),
      inline('b-nav-menu', '🏠 Main menu', '🏠 منوی اصلی', goTo('menu', 'replace')),
    ],
  ],
}
const signature: TextPart = {
  id: 'signature',
  idName: idName('Signature', '', 'part_'),
  name: 'Signature',
  kind: 'text',
  text: say('t-signature', {
    en: 'Hazel Coffee · 12 Maple Street · @hazelcoffee',
    fa: 'کافه فندق · خیابان افرا، پلاک ۱۲ · @hazelcoffee',
  }),
}

// The steps, left to right and top to bottom on the map; the shop and the café's tour are sections.

const box = (id: StepId, title: string, col: number, row: number, frame?: FrameId) => ({
  id,
  idName: idName(title),
  title,
  x: col * 320,
  y: row * 240,
  ...(frame !== undefined && { frame }),
})
const SHOP = 'shop'
const CAFE = 'cafe'

const steps: Step[] = [
  // Start points.
  {
    ...box('start', '/start', 0, 0),
    kind: 'start',
    trigger: {
      type: 'command',
      command: 'start',
      inMenu: true,
      menuDescription: { en: 'Open the main menu', fa: 'باز کردن منوی اصلی' },
    },
    next: 'who',
  },
  {
    ...box('help', '/help', 0, 3),
    kind: 'start',
    trigger: {
      type: 'command',
      command: 'help',
      inMenu: true,
      menuDescription: { en: 'What this bot can do', fa: 'این ربات چه کارهایی می‌کند' },
    },
    next: 'help-text',
  },
  {
    ...box('promo', 'Promo link', 0, 4),
    kind: 'start',
    // t.me/hazelcoffeebot?start=promoSUMMER saves SUMMER as the promo code.
    trigger: { type: 'startLink', payload: 'promo', match: 'prefix', saveRestTo: 'var-promo' },
    next: 'promo-welcome',
  },
  {
    ...box('fallback', 'Anything else', 0, 5),
    kind: 'start',
    trigger: { type: 'fallback', accepts: 'any' },
    next: 'sorry',
  },

  // Who is it: the staff, Persian speakers, everyone else.
  {
    ...box('who', 'Who is it?', 1, 0),
    kind: 'if',
    cases: [
      { id: 'admin', label: 'Admin', when: { any: [{ switch: 'sw-admin', is: true }] }, goTo: 'admin' },
      { id: 'persian', label: 'Persian speaker', when: { all: [{ language: ['fa'] }] }, goTo: 'tea' },
    ],
    otherwise: 'menu',
  },
  {
    ...box('admin', 'Admin tools', 1, 1),
    kind: 'message',
    content: {
      type: 'text',
      text: say('t-admin', {
        en: "Admin tools 🔧\nToday's orders and the stock list are in the café dashboard.",
        fa: 'ابزارهای مدیر 🔧\nسفارش‌های امروز و فهرست موجودی در داشبورد کافه است.',
      }),
    },
    keyboard: null,
    options: {},
    next: 'menu',
  },
  {
    ...box('tea', 'Persian tea', 1, 2),
    kind: 'message',
    content: {
      type: 'text',
      text: say('t-tea', {
        en: 'Good news: we also brew Persian tea with cardamom. Ask the barista!',
        fa: 'خبر خوب: چای ایرانی با هل هم دم می‌کنیم. از باریستا بخواهید!',
      }),
    },
    keyboard: null,
    options: {},
    next: 'menu',
  },
  {
    ...box('menu', 'Main menu', 2, 0),
    kind: 'message',
    content: {
      type: 'text',
      text: say('t-menu', {
        en: 'Hi {first_name}! ☕\nWelcome to Hazel Coffee. What would you like today?',
        fa: 'سلام {first_name}! ☕\nبه کافه فندق خوش آمدید. امروز چه میل دارید؟',
      }),
    },
    keyboard: inlineKeyboard(
      row(
        inline(
          'b-coffee',
          'Coffee list',
          'فهرست قهوه‌ها',
          goTo('coffees', 'edit', {
            popup: { kind: 'toast', text: { en: 'Opening the coffee list', fa: 'در حال باز کردن فهرست قهوه‌ها' } },
          }),
          { look: 'primary' },
        ),
        inline('b-special', "Today's special", 'پیشنهاد امروز', goTo('special', 'new'), {
          look: 'success',
          icon: { customEmojiId: '5370869711888194012', fallback: '⭐' },
        }),
      ),
      row(
        inline('b-hours', 'Opening hours', 'ساعت کاری', goTo('hours', 'replace')),
        inline(
          'b-clear',
          'Clear my order',
          'پاک کردن سفارش',
          goTo('stay', 'edit', {
            popup: { kind: 'alert', text: { en: 'Your order was cleared.', fa: 'سفارش شما پاک شد.' } },
            remember: [
              { var: 'var-drink', op: 'clear' },
              { var: 'var-cups', op: 'clear' },
            ],
          }),
          { look: 'danger' },
        ),
      ),
      row(
        inline('b-site', 'Our website', 'وب‌سایت ما', { type: 'url', url: 'https://hazel.coffee/?ref={user_id}' }),
        inline('b-code', 'Copy promo code', 'کپی کد تخفیف', {
          type: 'copyText',
          text: { en: 'HAZEL10', fa: 'HAZEL10' },
        }),
      ),
      row(
        inline('b-club', 'Loyalty club', 'باشگاه مشتریان', {
          type: 'loginUrl',
          url: 'https://hazel.coffee/login',
          requestWriteAccess: true,
        }),
        inline('b-gift', 'Gift cards (soon)', 'کارت هدیه (به‌زودی)', goTo(undefined, 'edit'), { disabled: true }),
      ),
      row(
        inline('b-about', 'About us', 'درباره ما', goTo('about', 'edit')),
        inline('b-feedback', 'Feedback', 'نظر شما', goTo('feedback', 'new')),
      ),
    ),
    options: {},
  },

  // The shop: the coffee list, the order and its questions, the till and the pickup.
  {
    ...box('coffees', 'Coffee list', 3, 0, SHOP),
    kind: 'message',
    content: {
      type: 'text',
      text: say('t-coffees', {
        en: 'Our coffees today:\nEspresso, 2.50\nLatte, 3.20\nCappuccino, 3.00',
        fa: 'قهوه‌های امروز ما:\nاسپرسو، ۲٫۵۰\nلاته، ۳٫۲۰\nکاپوچینو، ۳٫۰۰',
      }),
    },
    keyboard: inlineKeyboard(
      row(
        inline(
          'b-espresso',
          'Espresso',
          'اسپرسو',
          goTo('cups', 'edit', { remember: [{ var: 'var-drink', op: 'set', value: 'Espresso' }] }),
        ),
        inline(
          'b-latte',
          'Latte',
          'لاته',
          goTo('cups', 'edit', { remember: [{ var: 'var-drink', op: 'set', value: 'Latte' }] }),
        ),
        inline(
          'b-cappuccino',
          'Cappuccino',
          'کاپوچینو',
          goTo('cups', 'edit', { remember: [{ var: 'var-drink', op: 'set', value: 'Cappuccino' }] }),
        ),
      ),
      partRow('nav'),
    ),
    options: {},
  },
  {
    ...box('tip', 'Prices', 3, 1, SHOP),
    kind: 'note',
    text: "Prices come from the café's till. The developer updates the coffee list every morning.",
    color: 'yellow',
  },
  {
    ...box('cups', 'How many cups?', 4, 0, SHOP),
    kind: 'question',
    prompt: {
      content: {
        type: 'text',
        text: say('t-cups', {
          en: 'How many cups of {favorite_drink} would you like?',
          fa: 'چند فنجان {favorite_drink} میل دارید؟',
        }),
      },
      keyboard: null,
      options: {},
    },
    expects: 'number',
    checks: { min: 1, max: 20, wholeNumber: true },
    saveTo: 'var-cups',
    wrongAnswer: {
      message: say('t-cups-wrong', {
        en: 'Please send a whole number from 1 to 20.',
        fa: 'لطفاً یک عدد صحیح از ۱ تا ۲۰ بفرستید.',
      }),
      maxTries: 3,
      afterMaxTries: 'menu',
    },
    next: 'big',
  },
  {
    ...box('special', 'Daily special', 4, 1, SHOP),
    kind: 'message',
    content: {
      type: 'photo',
      media: placeholder('Caramel latte with whipped cream, seen from above'),
      caption: say('t-special', {
        en: "Today's special: caramel latte, 3.50 instead of 4.20!",
        fa: 'پیشنهاد امروز: لاته کاراملی، ۳٫۵۰ به جای ۴٫۲۰!',
      }),
    },
    keyboard: inlineKeyboard(
      row(
        inline(
          'b-order-special',
          'Order one',
          'سفارش می‌دهم',
          goTo('cups', 'new', { remember: [{ var: 'var-drink', op: 'set', value: 'Caramel latte' }] }),
          { look: 'primary' },
        ),
        inline('b-special-back', 'Back', 'بازگشت', goTo('back', 'replace')),
      ),
    ),
    // The party effect 🎉 of the catalog.
    options: { effect: '5046509860389126442' },
  },
  {
    ...box('big', 'Big order?', 5, 0, SHOP),
    kind: 'if',
    cases: [
      {
        id: 'many',
        label: '10 cups or more',
        when: { all: [{ var: 'var-cups', op: 'gte', value: 10 }] },
        goTo: 'ahead',
      },
    ],
    otherwise: 'phone',
  },
  {
    ...box('ahead', 'Order ahead', 5, 1, SHOP),
    kind: 'message',
    content: {
      type: 'text',
      text: say('t-ahead', {
        en: 'For 10 cups or more we need a little time. We will call you to agree on the pickup time.',
        fa: 'برای ۱۰ فنجان یا بیشتر کمی زمان لازم داریم. برای هماهنگی زمان تحویل با شما تماس می‌گیریم.',
      }),
    },
    keyboard: null,
    options: {},
    next: 'phone',
  },
  {
    ...box('phone', 'Phone number', 6, 0, SHOP),
    kind: 'question',
    prompt: {
      content: {
        type: 'text',
        text: say('t-phone', {
          en: 'Please share your phone number, so the barista can call you when your order is ready.',
          fa: 'لطفاً شماره تلفنتان را بفرستید تا وقتی سفارشتان آماده شد باریستا با شما تماس بگیرد.',
        }),
      },
      keyboard: {
        type: 'reply',
        rows: [
          row(bottom('b-share-phone', '📱 Share phone', '📱 ارسال شماره تلفن', { type: 'sharePhone' })),
          row(bottom('b-cancel', 'Cancel', 'انصراف', { type: 'text' })),
        ],
        oneTime: true,
        persistent: false,
        resize: true,
        placeholder: { en: 'Or type your number', fa: 'یا شماره را بنویسید' },
      },
      options: {},
    },
    expects: 'phone',
    checks: { pattern: 'phone' },
    saveTo: 'var-phone',
    wrongAnswer: {
      message: say('t-phone-wrong', {
        en: 'That does not look like a phone number. Please try again.',
        fa: 'این شماره تلفن به نظر درست نیست. لطفاً دوباره امتحان کنید.',
      }),
    },
    cancel: { words: { en: 'Cancel', fa: 'انصراف' }, goTo: 'menu' },
    next: 'order',
  },
  {
    ...box('order', 'Place the order', 7, 0, SHOP),
    note: 'The till has an API; ask Maryam, the owner, for the key.',
    kind: 'devStep',
    description:
      "Send the order (drink, cups, phone and promo code) to the café's till and get the order number back.\n" +
      'When the till does not answer, the café is closed: take that way.',
    uses: ['var-drink', 'var-cups', 'var-phone', 'var-promo'],
    sets: ['var-order'],
    outcomes: [
      { id: 'placed', label: 'Order placed', goTo: 'placed' },
      { id: 'closed', label: 'Café is closed', goTo: 'closed' },
    ],
  },
  {
    ...box('placed', 'Order placed', 8, 0, SHOP),
    kind: 'message',
    content: {
      type: 'text',
      text: say('t-placed', {
        en: 'Thank you! Your order number is {order_id}.\n{cups} × {favorite_drink}. We will call {phone} when it is ready.',
        fa: 'سپاس! شماره سفارش شما {order_id} است.\n{cups} × {favorite_drink}. وقتی آماده شد با {phone} تماس می‌گیریم.',
      }),
    },
    keyboard: { type: 'removeReply' },
    options: {},
    next: 'points',
  },
  {
    ...box('closed', 'Café is closed', 8, 1, SHOP),
    kind: 'message',
    content: {
      type: 'text',
      text: say('t-closed', {
        en: 'Sorry, the café is closed right now, so we could not take your order.',
        fa: 'متأسفیم، کافه الان بسته است و نتوانستیم سفارشتان را بگیریم.',
      }),
    },
    keyboard: { type: 'removeReply' },
    options: {},
    next: 'to-hours',
  },
  {
    ...box('points', 'Add loyalty points', 9, 0, SHOP),
    kind: 'remember',
    actions: [
      { var: 'var-points', op: 'add', value: { var: 'var-cups' } },
      { var: 'var-last-order', op: 'set', value: { var: 'var-order' } },
    ],
    next: 'wait',
  },
  { ...box('to-hours', 'Go to opening hours', 9, 1, SHOP), kind: 'goTo', target: 'hours' },
  {
    ...box('wait', 'Wait 10 minutes', 10, 0, SHOP),
    kind: 'wait',
    amount: 10,
    unit: 'minutes',
    ifUserActs: 'keep',
    next: 'ready',
  },
  {
    ...box('hours', 'Opening hours', 10, 1, SHOP),
    kind: 'message',
    content: {
      type: 'text',
      text: rich(
        't-hours',
        [
          p(t('Opening hours', bold)),
          p(t('Monday to Friday: 7:00 to 19:00')),
          p(t('Saturday and Sunday: 8:00 to 17:00')),
          p(partNode('signature')),
        ],
        [
          p(t('ساعت کاری', bold)),
          p(t('دوشنبه تا جمعه: ۷:۰۰ تا ۱۹:۰۰')),
          p(t('شنبه و یکشنبه: ۸:۰۰ تا ۱۷:۰۰')),
          p(partNode('signature')),
        ],
      ),
    },
    keyboard: inlineKeyboard(partRow('nav')),
    options: {},
  },
  {
    ...box('ready', 'Order ready', 11, 0, SHOP),
    kind: 'message',
    content: {
      type: 'text',
      text: say('t-ready', {
        en: '☕ Order {last_order} is ready! Pick it up at the counter.\nYou now have {loyalty_points} loyalty points.',
        fa: '☕ سفارش {last_order} آماده است! از پیشخوان تحویل بگیرید.\nاکنون {loyalty_points} امتیاز وفاداری دارید.',
      }),
    },
    keyboard: null,
    options: {},
    next: 'end',
  },
  { ...box('end', 'End', 12, 0, SHOP), kind: 'end' },
  {
    ...box(SHOP, 'Shop', 3, 0),
    x: 940,
    y: -40,
    kind: 'frame',
    width: 3200,
    height: 520,
    color: 'blue',
  },

  // Help, contact and feedback.
  {
    ...box('help-text', 'What I can do', 1, 3),
    kind: 'message',
    content: {
      type: 'text',
      text: say('t-help', {
        en: 'Here is what I can do:\n/start opens the main menu\n/help shows this message\nTap Contact us to send us your phone or your location.',
        fa: 'کارهایی که می‌توانم انجام دهم:\n/start منوی اصلی را باز می‌کند\n/help همین پیام را نشان می‌دهد\nبرای فرستادن شماره یا موقعیتتان، «تماس با ما» را بزنید.',
      }),
    },
    keyboard: inlineKeyboard(
      row(inline('b-contact', 'Contact us', 'تماس با ما', goTo('reach', 'new'))),
      partRow('nav'),
    ),
    options: {},
  },
  {
    ...box('reach', 'Contact us', 2, 3),
    kind: 'message',
    content: {
      type: 'text',
      text: say('t-reach', {
        en: 'How would you like to reach us? Use the buttons below.',
        fa: 'چطور می‌خواهید با ما در تماس باشید؟ از دکمه‌های پایین استفاده کنید.',
      }),
    },
    keyboard: {
      type: 'reply',
      rows: [
        row(
          bottom('b-send-phone', '📱 Send my phone', '📱 ارسال شماره من', {
            type: 'sharePhone',
            goTo: 'shared',
            saveTo: 'var-phone',
          }),
          bottom('b-send-location', '📍 Send my location', '📍 ارسال موقعیت من', {
            type: 'shareLocation',
            goTo: 'shared',
            saveTo: 'var-location',
          }),
        ),
        row(
          bottom('b-friend', '👥 Invite a friend', '👥 دعوت از دوست', {
            type: 'pickUsers',
            max: 1,
            bots: false,
            askName: true,
            askUsername: true,
            askPhoto: false,
            goTo: 'shared',
            saveTo: 'var-friend',
          }),
          bottom('b-group', '💬 Pick a group', '💬 انتخاب گروه', {
            type: 'pickChat',
            channel: false,
            botIsMember: true,
            askTitle: true,
            askUsername: false,
            askPhoto: false,
            goTo: 'shared',
            saveTo: 'var-group',
          }),
        ),
        row(
          bottom('b-poll', '📊 Create a poll', '📊 ساخت نظرسنجی', {
            type: 'createPoll',
            pollType: 'regular',
            goTo: 'shared',
            saveTo: 'var-poll',
          }),
          bottom('b-reach-menu', 'Main menu', 'منوی اصلی', { type: 'text', goTo: 'menu' }),
        ),
      ],
      oneTime: true,
      persistent: false,
      resize: true,
      placeholder: { en: 'Choose how to reach us', fa: 'روش تماس را انتخاب کنید' },
      openReplyField: true,
    },
    options: {},
  },
  {
    ...box('feedback', 'Your feedback', 2, 4),
    kind: 'question',
    prompt: {
      content: {
        type: 'text',
        text: say('t-feedback', {
          en: 'What can we do better? Write us a few words.',
          fa: 'چه کاری را بهتر انجام دهیم؟ چند کلمه برایمان بنویسید.',
        }),
      },
      keyboard: { type: 'forceReply', placeholder: { en: 'Your feedback', fa: 'نظر شما' } },
      options: {},
    },
    expects: 'text',
    checks: { minLength: 3, maxLength: 500 },
    saveTo: 'var-feedback',
    wrongAnswer: {
      message: say('t-feedback-wrong', {
        en: 'Please write at least a few words.',
        fa: 'لطفاً دست‌کم چند کلمه بنویسید.',
      }),
      maxTries: 2,
      afterMaxTries: 'menu',
    },
    next: 'feedback-like',
  },
  // Stage 2: the bot likes the feedback before thanking.
  {
    ...box('feedback-like', 'Like the feedback', 3, 5),
    kind: 'action',
    action: { type: 'react', emoji: '👍', onStep: 'userMessage' },
    next: 'thanks',
  },
  {
    ...box('go-back', 'Back', 2, 5),
    kind: 'goTo',
    target: 'back',
  },
  {
    ...box('shared', 'Thanks for sharing', 3, 3),
    kind: 'message',
    content: {
      type: 'text',
      text: say('t-shared', {
        en: 'Thanks, we got it! Someone from the café will get back to you soon.',
        fa: 'ممنون، دریافت شد! به‌زودی یکی از همکاران کافه با شما تماس می‌گیرد.',
      }),
    },
    keyboard: { type: 'removeReply' },
    options: {},
    next: 'team',
  },
  {
    ...box('thanks', 'Thanks for the feedback', 3, 4),
    kind: 'message',
    content: {
      type: 'text',
      text: say('t-thanks', {
        en: 'Thank you! We read every message, and yours too:\n{feedback}',
        fa: 'سپاس! همه پیام‌ها را می‌خوانیم، پیام شما را هم:\n{feedback}',
      }),
    },
    keyboard: null,
    options: {},
    next: 'end',
  },
  {
    ...box('team', 'Send to the team', 4, 3),
    kind: 'devStep',
    description:
      "Post what the user shared (a phone, a location, a friend, a group or a poll) to the café team's chat.",
    uses: ['var-phone', 'var-location', 'var-friend', 'var-group', 'var-poll'],
    sets: [],
    outcomes: [{ id: 'done', label: 'Done', goTo: 'menu' }],
  },
  {
    ...box('promo-welcome', 'Promo welcome', 1, 4),
    kind: 'message',
    content: {
      type: 'text',
      text: say('t-promo', {
        en: 'Welcome to Hazel Coffee! 🎉\nYour code {promo_code} gives you 10% off your first order.',
        fa: 'به کافه فندق خوش آمدید! 🎉\nکد {promo_code} برای اولین سفارشتان ۱۰٪ تخفیف دارد.',
      }),
    },
    keyboard: inlineKeyboard(
      row(inline('b-see-menu', 'See the coffee list', 'دیدن فهرست قهوه‌ها', goTo('coffees', 'edit'))),
    ),
    options: {},
  },
  {
    ...box('sorry', 'Not understood', 1, 5),
    kind: 'message',
    content: {
      type: 'text',
      text: say('t-sorry', {
        en: 'Sorry, I did not get that. Let us go back to where you were.',
        fa: 'ببخشید، متوجه نشدم. برگردیم به جایی که بودید.',
      }),
    },
    keyboard: null,
    options: {},
    next: 'go-back',
  },

  // The café: about us with every format, then a tour through every kind of message.
  {
    ...box('about', 'About us', 2, 6, CAFE),
    kind: 'message',
    content: {
      type: 'text',
      text: rich(
        't-about',
        [
          p(
            t('Hazel Coffee', bold),
            t(' has served '),
            t('fresh', italic),
            t(', '),
            t('locally roasted', underline),
            t(' coffee since 2015. '),
            t('Instant coffee', strike),
            t('? Never! '),
            t('Ask for the secret menu.', spoiler),
          ),
          p(
            t('Next tasting: '),
            t('Friday at 18:00', dateTime(TASTING, 'wDt')),
            t('. Show the code '),
            t('HAZEL10', mono),
            t(' for 10% off, or read '),
            t('our story', link('https://hazel.coffee/story')),
            t('.'),
          ),
          p(t('See you soon, '), varNode('first_name'), t('! '), emojiNode(CUP_EMOJI, '☕')),
          quote(false, '"The best flat white in town." A regular since 2016'),
          quote(
            true,
            'Our beans come from small farms in Ethiopia and Colombia.',
            'We roast them every Monday at the back of the café, so they are never more than a week old.',
          ),
          codeBlock('Wi-Fi: Hazel-Guest\nPassword: flatwhite2026'),
          p(partNode('signature')),
        ],
        [
          p(
            t('کافه فندق', bold),
            t(' از سال ۲۰۱۵ قهوه‌ی '),
            t('تازه', italic),
            t(' و '),
            t('برشته‌شده در محل', underline),
            t(' سرو می‌کند. '),
            t('قهوه فوری', strike),
            t('؟ هرگز! '),
            t('منوی مخفی را از ما بخواهید.', spoiler),
          ),
          p(
            t('جلسه‌ی چشیدن بعدی: '),
            t('جمعه ساعت ۱۸', dateTime(TASTING, 'wDt')),
            t('. کد '),
            t('HAZEL10', mono),
            t(' را نشان دهید و ۱۰٪ تخفیف بگیرید، یا '),
            t('داستان ما', link('https://hazel.coffee/fa/story')),
            t(' را بخوانید.'),
          ),
          p(t('به امید دیدار، '), varNode('first_name'), t('! '), emojiNode(CUP_EMOJI, '☕')),
          quote(false, '«بهترین فلت وایت شهر.» یکی از مشتری‌های همیشگی از سال ۲۰۱۶'),
          quote(
            true,
            'دانه‌های قهوه‌ی ما از مزرعه‌های کوچک اتیوپی و کلمبیا می‌آیند.',
            'هر دوشنبه آن‌ها را پشت کافه برشته می‌کنیم، پس هیچ‌وقت بیشتر از یک هفته از برشته شدنشان نمی‌گذرد.',
          ),
          codeBlock('Wi-Fi: Hazel-Guest\nPassword: flatwhite2026'),
          p(partNode('signature')),
        ],
      ),
    },
    keyboard: inlineKeyboard(
      row(inline('b-tour', 'Take the tour', 'گشتی در کافه', goTo('photo', 'new'), { look: 'primary' })),
      row(inline('b-about-menu', 'Main menu', 'منوی اصلی', goTo('menu', 'edit'))),
    ),
    options: { linkPreview: { off: false, url: 'https://hazel.coffee/story', size: 'large', above: true } },
  },
  {
    ...box('contact', 'Call us', 2, 7, CAFE),
    kind: 'message',
    content: { type: 'contact', phone: '+982188776655', firstName: 'Hazel Coffee', lastName: 'Counter' },
    keyboard: inlineKeyboard(
      row(inline('b-call-fun', 'Coffee fun', 'سرگرمی قهوه‌ای', goTo('roast-poll', 'new'))),
      row(inline('b-call-menu', 'Back to the menu', 'بازگشت به منو', goTo('menu', 'replace'))),
    ),
    options: {},
  },
  {
    ...box('photo', 'Café photo', 3, 6, CAFE),
    kind: 'message',
    content: {
      type: 'photo',
      media: placeholder("The café's front window in the morning"),
      caption: say('t-photo', { en: 'This is us, on Maple Street.', fa: 'این‌جا ماییم، در خیابان افرا.' }),
      captionAbove: true,
    },
    keyboard: null,
    options: { chatAction: { action: 'upload_photo', seconds: 2 } },
    next: 'live',
  },
  {
    ...box('venue', 'Café address', 3, 7, CAFE),
    kind: 'message',
    content: {
      type: 'venue',
      latitude: 35.7006,
      longitude: 51.4013,
      title: 'Hazel Coffee',
      address: '12 Maple Street, Tehran',
    },
    keyboard: null,
    options: {},
    next: 'contact',
  },
  {
    ...box('live', 'Live photo', 4, 6, CAFE),
    kind: 'message',
    content: {
      type: 'livePhoto',
      media: placeholder('Steam rising from a fresh cup, as a live photo'),
      caption: say('t-live', { en: 'Fresh from the machine.', fa: 'تازه از دستگاه.' }),
      spoiler: true,
    },
    keyboard: null,
    options: {},
    next: 'video',
  },
  {
    ...box('location', 'Where we are', 4, 7, CAFE),
    kind: 'message',
    content: { type: 'location', latitude: 35.7006, longitude: 51.4013 },
    keyboard: null,
    options: {},
    next: 'venue',
  },
  {
    ...box('video', 'Latte art video', 5, 6, CAFE),
    kind: 'message',
    content: {
      type: 'video',
      media: placeholder('Latte art, 15 seconds'),
      caption: say('t-video', { en: 'Sara draws a tulip in milk foam.', fa: 'سارا با فوم شیر یک لاله می‌کشد.' }),
    },
    keyboard: null,
    options: { protect: true, chatAction: { action: 'upload_video', seconds: 3 } },
    next: 'gif',
  },
  {
    ...box('album', 'Gallery', 5, 7, CAFE),
    kind: 'message',
    content: {
      type: 'album',
      items: [
        {
          media: placeholder('The espresso bar with the big red machine'),
          caption: say('t-album', { en: 'Our espresso bar', fa: 'بار اسپرسوی ما' }),
        },
        { media: placeholder('Window seats in the afternoon sun') },
        { media: placeholder('Bags of beans in the roastery'), spoiler: true },
      ],
    },
    keyboard: null,
    options: {},
    next: 'location',
  },
  {
    ...box('gif', 'Barista GIF', 6, 6, CAFE),
    kind: 'message',
    content: {
      type: 'animation',
      media: placeholder('A barista spinning a cup, looped'),
      caption: say('t-gif', { en: 'Our baristas have fun too.', fa: 'باریستاهای ما هم خوش می‌گذرانند.' }),
    },
    keyboard: null,
    options: {},
    next: 'audio',
  },
  {
    ...box('sticker', 'Thank you sticker', 6, 7, CAFE),
    kind: 'message',
    content: { type: 'sticker', media: placeholder('A smiling coffee cup sticker') },
    keyboard: null,
    options: {},
    next: 'album',
  },
  {
    ...box('audio', 'Café playlist', 7, 6, CAFE),
    kind: 'message',
    content: {
      type: 'audio',
      media: placeholder('A song from the café playlist'),
      caption: say('t-audio', { en: 'What we play in the morning.', fa: 'آنچه صبح‌ها پخش می‌کنیم.' }),
      title: 'Morning Beans',
      performer: 'The Hazel Trio',
    },
    keyboard: null,
    options: {},
    next: 'voice',
  },
  {
    ...box('file', 'Full menu', 7, 7, CAFE),
    kind: 'message',
    content: {
      type: 'document',
      media: placeholder('The full menu with prices, as a PDF'),
      caption: say('t-file', { en: 'Our full menu with prices.', fa: 'منوی کامل ما با قیمت‌ها.' }),
    },
    keyboard: null,
    options: { silent: true },
    next: 'sticker',
  },
  {
    ...box('voice', 'Hello from the owner', 8, 6, CAFE),
    kind: 'message',
    content: {
      type: 'voice',
      media: placeholder('A voice message from Maryam, the owner'),
      caption: say('t-voice', { en: 'A hello from Maryam, the owner.', fa: 'سلامی از مریم، صاحب کافه.' }),
    },
    keyboard: null,
    options: { chatAction: { action: 'record_voice', seconds: 3 }, delaySec: 2 },
    next: 'round',
  },
  {
    ...box('round', 'Team video', 8, 7, CAFE),
    kind: 'message',
    content: { type: 'videoNote', media: placeholder('A round video of the team waving') },
    keyboard: null,
    options: {},
    next: 'file',
  },
  // Stage 2 kinds: a poll, a quiz, a dice and paid media, one after the other.
  {
    ...box('roast-poll', 'Favorite roast', 2, 8, CAFE),
    kind: 'message',
    content: {
      type: 'poll',
      question: say('t-roast-poll', { en: 'Which roast do you like best?', fa: 'کدام برشته را بیشتر دوست دارید؟' }),
      options: [
        { en: 'Light', fa: 'روشن' },
        { en: 'Medium', fa: 'متوسط' },
        { en: 'Dark', fa: 'تیره' },
      ],
      anonymous: false,
      multiple: false,
      shuffle: true,
      closeAfterSec: 86400,
    },
    keyboard: null,
    options: {},
    next: 'coffee-quiz',
  },
  {
    ...box('coffee-quiz', 'Coffee quiz', 3, 8, CAFE),
    kind: 'message',
    content: {
      type: 'quiz',
      question: say('t-coffee-quiz', { en: 'Where was coffee first found?', fa: 'قهوه اول کجا پیدا شد؟' }),
      options: [
        { en: 'Ethiopia', fa: 'اتیوپی' },
        { en: 'Brazil', fa: 'برزیل' },
        { en: 'Italy', fa: 'ایتالیا' },
      ],
      correct: [0],
      explanation: say('t-coffee-quiz-why', {
        en: 'The story says a goat herder in Ethiopia found it.',
        fa: 'می‌گویند چوپانی در اتیوپی آن را پیدا کرد.',
      }),
      anonymous: true,
      multiple: false,
    },
    keyboard: null,
    options: {},
    next: 'lucky-roll',
  },
  {
    ...box('lucky-roll', 'Lucky roll', 4, 8, CAFE),
    kind: 'message',
    content: { type: 'dice', emoji: '🎲' },
    keyboard: null,
    options: {},
    next: 'recipe',
  },
  {
    ...box('recipe', 'Secret recipe', 5, 8, CAFE),
    kind: 'message',
    content: {
      type: 'paidMedia',
      items: [
        { media: placeholder('Our cold brew recipe card') },
        { media: placeholder('Sara making the cold brew, 30 seconds') },
      ],
      stars: 50,
      caption: say('t-recipe', { en: 'Our secret cold brew, step by step.', fa: 'کلد برو مخفی ما، قدم به قدم.' }),
    },
    keyboard: inlineKeyboard(row(inline('b-recipe-menu', 'Main menu', 'منوی اصلی', goTo('menu', 'replace')))),
    options: {},
  },

  // Payments (stage 2): /shop sends beans by card to non-members, the Coffee club in Stars to bean
  // buyers, and the club card to members, who can leave with a refund.
  {
    ...box('shop-start', '/shop', 0, 10),
    kind: 'start',
    trigger: {
      type: 'command',
      command: 'shop',
      inMenu: true,
      menuDescription: { en: 'Beans and the Coffee club', fa: 'دانه قهوه و باشگاه قهوه' },
    },
    next: 'shop-who',
  },
  {
    ...box('club-renewed-start', 'Club renewed', 0, 11),
    kind: 'start',
    trigger: { type: 'paymentDone', invoice: 'club' },
    next: 'club-renewed',
  },
  {
    ...box('club-refunded-start', 'Club refunded', 0, 12),
    kind: 'start',
    trigger: { type: 'refunded', invoice: 'club' },
    next: 'club-refund-note',
  },
  {
    ...box('shop-who', 'Club member?', 1, 10),
    kind: 'if',
    cases: [
      { id: 'member', label: 'Member', when: { all: [{ subscribed: 'club' }] }, goTo: 'club-card' },
      { id: 'buyer', label: 'Bought beans', when: { all: [{ hasPaid: 'beans' }] }, goTo: 'club' },
    ],
    otherwise: 'beans-cart',
  },
  {
    ...box('club-renewed', 'Club renewed', 1, 11),
    kind: 'message',
    content: {
      type: 'text',
      text: say('t-club-renewed', {
        en: 'Your Coffee club is renewed for 30 more days. ☕',
        fa: 'باشگاه قهوه شما برای ۳۰ روز دیگر تمدید شد. ☕',
      }),
    },
    keyboard: inlineKeyboard(row(inline('b-renewed-menu', 'Open the menu', 'باز کردن منو', goTo('menu', 'edit')))),
    options: {},
  },
  {
    ...box('club-refund-note', 'Club refund', 1, 12),
    kind: 'message',
    content: {
      type: 'text',
      text: say('t-club-refund', {
        en: 'Your Coffee club payment was refunded.',
        fa: 'پرداخت باشگاه قهوه شما برگردانده شد.',
      }),
    },
    keyboard: inlineKeyboard(row(inline('b-refund-menu', 'Back to the menu', 'بازگشت به منو', goTo('menu', 'edit')))),
    options: {},
  },
  {
    ...box('club-card', 'Club card', 2, 10),
    kind: 'message',
    content: {
      type: 'text',
      text: say('t-club-card', {
        en: 'You are in the Coffee club ☕\nShow this message at the counter for your free coffee.',
        fa: 'شما عضو باشگاه قهوه هستید ☕\nبرای قهوه رایگان این پیام را به صندوق نشان دهید.',
      }),
    },
    keyboard: inlineKeyboard(
      row(inline('b-club-beans', 'Buy beans', 'خرید دانه قهوه', goTo('beans', 'new'))),
      row(
        inline('b-club-leave', 'Leave and refund', 'لغو و بازپرداخت', goTo('club-leave', 'edit'), { look: 'danger' }),
      ),
    ),
    options: {},
  },
  {
    ...box('club', 'Coffee club', 2, 11),
    kind: 'invoice',
    invoice: {
      title: { en: 'Coffee club', fa: 'باشگاه قهوه' },
      description: {
        en: 'One free coffee a week and 10% off beans, renewed every 30 days.',
        fa: 'هر هفته یک قهوه رایگان و ۱۰٪ تخفیف دانه قهوه، با تمدید هر ۳۰ روز.',
      },
      currency: 'XTR',
      prices: [{ label: { en: 'Coffee club, 30 days', fa: 'باشگاه قهوه، ۳۰ روز' }, amount: 250 }],
      subscription: { periodDays: 30 },
    },
    // Telegram's own pay button ("Pay ⭐️250").
    keyboard: null,
    options: {},
    next: 'club-welcome',
  },
  {
    ...box('beans', 'Hazel beans', 2, 12),
    kind: 'invoice',
    invoice: {
      title: { en: 'Hazel beans, 250 g', fa: 'دانه قهوه فندق، ۲۵۰ گرم' },
      description: {
        en: 'Our house roast, ground or whole, sent to your door.',
        fa: 'رست مخصوص ما، آسیاب‌شده یا دانه کامل، تا در خانه شما.',
      },
      photo: placeholder('A bag of Hazel beans'),
      currency: 'USD',
      prices: [
        { label: { en: 'Beans, 250 g', fa: 'دانه قهوه، ۲۵۰ گرم' }, amount: 1200 },
        { label: { en: 'Club discount', fa: 'تخفیف باشگاه' }, amount: -120 },
      ],
      physical: {
        needName: true,
        needPhone: true,
        needEmail: false,
        needAddress: true,
        flexibleShipping: true,
        shippingOptions: [
          { id: 'ship-post', title: { en: 'Post, 3 to 5 days', fa: 'پست، ۳ تا ۵ روز' }, amount: 450 },
          { id: 'ship-courier', title: { en: 'Courier, same day', fa: 'پیک، همان روز' }, amount: 900 },
        ],
      },
      payload: 'beans_250',
    },
    keyboard: inlineKeyboard(
      row(inline('b-beans-pay', 'Pay', 'پرداخت', { type: 'pay' }, { look: 'success' })),
      row(inline('b-beans-menu', 'Main menu', 'منوی اصلی', goTo('menu', 'new'))),
    ),
    options: {},
    checkout: {
      description: 'Check that the beans are still in stock and the address is one we ship to.',
      refuse: { en: 'Sorry, these beans just sold out.', fa: 'متأسفیم، این دانه قهوه همین حالا تمام شد.' },
    },
    next: 'beans-thanks',
  },
  {
    ...box('club-leave', 'Refund the club', 3, 10),
    kind: 'action',
    action: { type: 'refund', invoice: 'club' },
    next: 'club-left',
  },
  {
    ...box('club-welcome', 'Welcome to the club', 3, 11),
    kind: 'message',
    content: {
      type: 'text',
      text: say('t-club-welcome', {
        en: 'Welcome to the Coffee club, {first_name}! ☕',
        fa: '{first_name}، به باشگاه قهوه خوش آمدید! ☕',
      }),
    },
    keyboard: inlineKeyboard(
      row(inline('b-welcome-card', 'My club card', 'کارت باشگاه من', goTo('club-card', 'edit'))),
    ),
    options: {},
  },
  {
    ...box('beans-thanks', 'Beans on the way', 3, 12),
    kind: 'message',
    content: {
      type: 'text',
      text: say('t-beans-thanks', {
        en: 'Thank you! Your beans are on their way.',
        fa: 'سپاسگزاریم! دانه‌های قهوه شما در راه است.',
      }),
    },
    keyboard: null,
    options: {},
    next: 'menu',
  },
  {
    ...box('club-left', 'Left the club', 4, 10),
    kind: 'message',
    content: {
      type: 'text',
      text: say('t-club-left', {
        en: 'You left the Coffee club. Your Stars are on their way back.',
        fa: 'از باشگاه قهوه خارج شدید. ستاره‌های شما در راه بازگشت است.',
      }),
    },
    keyboard: inlineKeyboard(row(inline('b-left-menu', 'Main menu', 'منوی اصلی', goTo('menu', 'edit')))),
    options: {},
  },

  // Events (stage 2): a reminder for beans left in the cart, a failed club renewal, a broadcast of
  // the new roast to the users who want news (pinned, then unpinned and deleted on request), the
  // user blocking the bot and coming back to a gift.
  {
    ...box('club-failed-start', 'Club renewal failed', 0, 13),
    kind: 'start',
    trigger: { type: 'subscriptionChanged', invoice: 'club', state: 'failed' },
    next: 'club-failed',
  },
  {
    ...box('club-failed', 'Club not renewed', 1, 13),
    kind: 'message',
    content: {
      type: 'text',
      text: say('t-club-failed', {
        en: 'We could not renew your Coffee club: there were not enough Stars. Top up to keep your free coffee.',
        fa: 'نتوانستیم باشگاه قهوه شما را تمدید کنیم: ستاره کافی نبود. برای قهوه رایگان، حسابتان را شارژ کنید.',
      }),
    },
    keyboard: inlineKeyboard(row(inline('b-failed-menu', 'Main menu', 'منوی اصلی', goTo('menu', 'edit')))),
    options: {},
  },
  {
    ...box('beans-cart', 'Beans in the cart', 2, 13),
    kind: 'message',
    content: {
      type: 'text',
      text: say('t-beans-cart', {
        en: 'Hazel beans, 250 g, are in your cart. Pay when you are ready.',
        fa: 'دانه قهوه فندق، ۲۵۰ گرم، در سبد شماست. هر وقت آماده بودید پرداخت کنید.',
      }),
    },
    keyboard: inlineKeyboard(row(inline('b-cart-pay', 'Pay for the beans', 'پرداخت دانه قهوه', goTo('beans', 'new')))),
    options: {},
    next: 'beans-reminder',
  },
  {
    ...box('beans-reminder', 'Remind in 1 hour', 3, 13),
    kind: 'wait',
    amount: 1,
    unit: 'hours',
    ifUserActs: 'cancel',
    stopWhen: { all: [{ hasPaid: 'beans' }] },
    next: 'beans-nudge',
  },
  {
    ...box('beans-nudge', 'Still want the beans?', 4, 13),
    kind: 'message',
    content: {
      type: 'text',
      text: say('t-beans-nudge', {
        en: 'Still want your Hazel beans, {first_name}? They are waiting in your cart.',
        fa: '{first_name}، هنوز دانه قهوه فندق را می‌خواهید؟ در سبدتان منتظر است.',
      }),
    },
    keyboard: inlineKeyboard(row(inline('b-nudge-pay', 'Pay now', 'همین حالا پرداخت', goTo('beans', 'new')))),
    options: {},
  },
  {
    ...box('news-start', 'New roast news', 0, 14),
    kind: 'start',
    trigger: {
      type: 'broadcast',
      audience: { all: [{ switch: 'sw-news', is: true }] },
      when: "Every Monday at 9:00, when the week's new roast arrives",
    },
    next: 'news',
  },
  {
    ...box('news', 'New roast', 1, 14),
    kind: 'message',
    content: {
      type: 'text',
      text: say('t-news', {
        en: "This week's roast: Ethiopia Yirgacheffe, bright and floral. Come and taste it!",
        fa: 'رست این هفته: اتیوپی یرگاچفه، روشن و گل‌دار. بیایید و بچشید!',
      }),
    },
    keyboard: inlineKeyboard(
      row(inline('b-news-menu', 'Main menu', 'منوی اصلی', goTo('menu', 'new'))),
      row(inline('b-news-hide', 'Hide this news', 'پنهان کردن این خبر', goTo('news-unpin', 'new'))),
    ),
    options: {},
    next: 'news-pin',
  },
  {
    ...box('news-pin', 'Pin the news', 2, 14),
    kind: 'action',
    action: { type: 'pin', step: 'news' },
    next: 'end',
  },
  {
    ...box('news-unpin', 'Unpin the news', 3, 14),
    kind: 'action',
    action: { type: 'unpin', step: 'news' },
    next: 'news-delete',
  },
  {
    ...box('news-delete', 'Delete the news', 4, 14),
    kind: 'action',
    action: { type: 'delete', step: 'news' },
    next: 'menu',
  },
  {
    ...box('gone-start', 'User left', 0, 15),
    kind: 'start',
    trigger: { type: 'userBlocks' },
    next: 'gone',
  },
  {
    ...box('gone', 'Mark as gone', 1, 15),
    kind: 'devStep',
    description: "Mark the user as gone in the café's customer list, so broadcasts skip them.",
    uses: [],
    sets: [],
    outcomes: [{ id: 'done', label: 'Done', goTo: 'end' }],
  },
  {
    ...box('back-start', 'User came back', 0, 16),
    kind: 'start',
    trigger: { type: 'userRestarts' },
    next: 'welcome-back',
  },
  {
    ...box('welcome-back', 'Welcome back', 1, 16),
    kind: 'message',
    content: {
      type: 'text',
      text: say('t-welcome-back', {
        en: 'Welcome back, {first_name}! We missed you. ☕',
        fa: '{first_name}، خوش برگشتید! دلمان برایتان تنگ شده بود. ☕',
      }),
    },
    keyboard: null,
    options: {},
    next: 'welcome-typing',
  },
  {
    ...box('welcome-typing', 'Typing', 2, 16),
    kind: 'action',
    action: { type: 'chatAction', action: 'typing' },
    next: 'welcome-gift',
  },
  {
    ...box('welcome-gift', 'Welcome gift', 3, 16),
    kind: 'action',
    action: {
      type: 'gift',
      giftDescription: 'The coffee cup gift (15 Stars), or the cheapest gift getAvailableGifts lists',
      text: say('t-welcome-gift', { en: 'A coffee on us. Welcome back!', fa: 'یک قهوه مهمان ما. خوش برگشتید!' }),
    },
    next: 'menu',
  },
  {
    ...box(CAFE, 'Our café', 2, 6),
    x: 620,
    y: 1400,
    kind: 'frame',
    width: 2240,
    height: 760,
    color: 'green',
  },
]

export const coffeeShop: Design = {
  formatVersion: 1,
  id: 'coffee-shop',
  name: 'Coffee shop',
  languages: { default: 'en', list: ['en', 'fa'] },
  bot: {
    name: { en: 'Hazel Coffee', fa: 'کافه فندق' },
    about: {
      en: "Order coffee, see today's special and find our café on Maple Street.",
      fa: 'قهوه سفارش دهید، پیشنهاد امروز را ببینید و کافه ما را در خیابان افرا پیدا کنید.',
    },
    description: {
      en: 'Hi! I am the bot of Hazel Coffee.\nI can show you our coffees, take your order, tell you when it is ready and show you the way to the café.',
      fa: 'سلام! من ربات کافه فندق هستم.\nمی‌توانم قهوه‌هایمان را نشانتان دهم، سفارشتان را بگیرم، آماده شدنش را خبر بدهم و راه کافه را نشانتان دهم.',
    },
    photo: placeholder('The café logo: a hazelnut in a coffee cup'),
    menuButton: 'commands',
    commandOrder: ['start', 'help', 'shop-start'],
  },
  steps: byId(steps),
  buttons: byId(buttons),
  variables: byId(variables),
  switches: byId([isAdmin, wantsNews]),
  parts: byId([nav, signature]),
  media: {},
}
