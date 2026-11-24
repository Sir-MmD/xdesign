// The starter template "Shop with Stars" (TPL-01, docs/plan/04 section 15): a shop of two digital
// products paid in Telegram Stars, each with its product page, invoice and download after paying;
// "My purchases" (an If on what the user has paid), the help text, and /paysupport, which
// Telegram asks of every bot that takes payments, with a question and a developer step.
import type { Content, Design, Step, TextId, Variable } from '../../src/index.ts'
import { builtinVariables, byId, sayer } from '../build.ts'
import { goTo, inlineKeyboard, placeholder, row, templateKit } from './kit.ts'

const { buttons, variable, inline, box } = templateKit()

const variables: Variable[] = [
  ...builtinVariables(),
  variable('var-problem', 'Payment problem', 'text', 'question', 'I paid but got no download link.'),
]

const say = sayer(variables)
const text = (id: TextId, en: string, fa: string): Content => ({ type: 'text', text: say(id, { en, fa }) })

const steps: Step[] = [
  // Start points.
  {
    ...box('start', '/start', 0, 0),
    kind: 'start',
    trigger: {
      type: 'command',
      command: 'start',
      inMenu: true,
      menuDescription: { en: 'Open the shop', fa: 'باز کردن فروشگاه' },
    },
    next: 'shop',
  },
  {
    ...box('help', '/help', 0, 3),
    kind: 'start',
    trigger: {
      type: 'command',
      command: 'help',
      inMenu: true,
      menuDescription: { en: 'How buying works', fa: 'راهنمای خرید' },
    },
    next: 'how-to-buy',
  },
  {
    ...box('paysupport', '/paysupport', 0, 4),
    kind: 'start',
    trigger: {
      type: 'command',
      command: 'paysupport',
      inMenu: true,
      menuDescription: { en: 'Help with a payment', fa: 'کمک درباره پرداخت' },
    },
    next: 'ask-problem',
  },

  // The shop and its two products, each with its invoice and its download.
  {
    ...box('shop', 'Shop', 1, 0),
    kind: 'message',
    content: text(
      't-shop',
      'Hi {first_name}! 👋\nWelcome to our shop. Pick a product to see it; you pay with Telegram Stars ⭐️.',
      'سلام {first_name}! 👋\nبه فروشگاه ما خوش آمدید. محصولی را انتخاب کنید تا آن را ببینید؛ پرداخت با استارز تلگرام ⭐️ است.',
    ),
    keyboard: inlineKeyboard(
      row(inline('b-guide', '📘 Starter guide', '📘 راهنمای شروع', goTo('guide', 'replace'))),
      row(inline('b-pack', '🎨 Wallpaper pack', '🎨 بسته والپیپر', goTo('pack', 'replace'))),
      row(inline('b-purchases', '🛍 My purchases', '🛍 خریدهای من', goTo('purchases', 'new'))),
    ),
    options: {},
  },
  {
    ...box('guide', 'Starter guide', 2, 0),
    kind: 'message',
    content: {
      type: 'photo',
      media: placeholder('The cover of the starter guide'),
      caption: say('t-guide', {
        en: '📘 Starter guide\nA 40-page PDF that takes you from the first idea to a finished project.\nPrice: ⭐️50',
        fa: '📘 راهنمای شروع\nیک PDF چهل‌صفحه‌ای که شما را از اولین ایده تا یک پروژه تمام‌شده می‌برد.\nقیمت: ⭐️۵۰',
      }),
    },
    keyboard: inlineKeyboard(
      row(inline('b-guide-buy', 'Buy for ⭐️50', 'خرید با ⭐️۵۰', goTo('guide-invoice', 'new'), { look: 'primary' })),
      row(inline('b-guide-back', '⬅️ Back', '⬅️ بازگشت', goTo('shop', 'replace'))),
    ),
    options: {},
  },
  {
    ...box('guide-invoice', 'Guide invoice', 3, 0),
    kind: 'invoice',
    invoice: {
      title: { en: 'Starter guide', fa: 'راهنمای شروع' },
      description: {
        en: 'A 40-page PDF guide, yours to keep. The download link comes right after paying.',
        fa: 'راهنمای PDF چهل‌صفحه‌ای که برای همیشه مال شماست. لینک دانلود بلافاصله بعد از پرداخت می‌آید.',
      },
      currency: 'XTR',
      prices: [{ label: { en: 'Starter guide', fa: 'راهنمای شروع' }, amount: 50 }],
    },
    keyboard: inlineKeyboard(
      row(inline('b-guide-pay', 'Pay ⭐️50', 'پرداخت ⭐️۵۰', { type: 'pay' }, { look: 'success' })),
    ),
    options: {},
    next: 'guide-paid',
  },
  {
    ...box('guide-paid', 'Your guide', 4, 0),
    kind: 'message',
    content: text(
      't-guide-paid',
      '📘 Your starter guide\nThank you for buying it! Download it with the button below. It also stays under My purchases.',
      '📘 راهنمای شروع شما\nسپاس از خریدتان! آن را با دکمه زیر دانلود کنید. همیشه در «خریدهای من» هم هست.',
    ),
    keyboard: inlineKeyboard(
      row(
        inline('b-guide-download', '⬇️ Download the guide', '⬇️ دانلود راهنما', {
          type: 'url',
          url: 'https://example.com/downloads/starter-guide.pdf',
        }),
      ),
      row(inline('b-guide-shop', '🏠 Back to the shop', '🏠 بازگشت به فروشگاه', goTo('shop', 'new'))),
    ),
    options: {},
  },
  {
    ...box('pack', 'Wallpaper pack', 2, 1),
    kind: 'message',
    content: {
      type: 'photo',
      media: placeholder('Four of the wallpapers side by side'),
      caption: say('t-pack', {
        en: '🎨 Wallpaper pack\nTwenty wallpapers for phone and desktop, in full resolution.\nPrice: ⭐️120',
        fa: '🎨 بسته والپیپر\nبیست والپیپر برای گوشی و رایانه، با کیفیت کامل.\nقیمت: ⭐️۱۲۰',
      }),
    },
    keyboard: inlineKeyboard(
      row(inline('b-pack-buy', 'Buy for ⭐️120', 'خرید با ⭐️۱۲۰', goTo('pack-invoice', 'new'), { look: 'primary' })),
      row(inline('b-pack-back', '⬅️ Back', '⬅️ بازگشت', goTo('shop', 'replace'))),
    ),
    options: {},
  },
  {
    ...box('pack-invoice', 'Pack invoice', 3, 1),
    kind: 'invoice',
    invoice: {
      title: { en: 'Wallpaper pack', fa: 'بسته والپیپر' },
      description: {
        en: 'Twenty wallpapers for phone and desktop in one ZIP file. The download link comes right after paying.',
        fa: 'بیست والپیپر برای گوشی و رایانه در یک فایل ZIP. لینک دانلود بلافاصله بعد از پرداخت می‌آید.',
      },
      currency: 'XTR',
      prices: [{ label: { en: 'Wallpaper pack', fa: 'بسته والپیپر' }, amount: 120 }],
    },
    keyboard: inlineKeyboard(
      row(inline('b-pack-pay', 'Pay ⭐️120', 'پرداخت ⭐️۱۲۰', { type: 'pay' }, { look: 'success' })),
    ),
    options: {},
    next: 'pack-paid',
  },
  {
    ...box('pack-paid', 'Your wallpapers', 4, 1),
    kind: 'message',
    content: text(
      't-pack-paid',
      '🎨 Your wallpaper pack\nThank you for buying it! Download it with the button below. It also stays under My purchases.',
      '🎨 بسته والپیپر شما\nسپاس از خریدتان! آن را با دکمه زیر دانلود کنید. همیشه در «خریدهای من» هم هست.',
    ),
    keyboard: inlineKeyboard(
      row(
        inline('b-pack-download', '⬇️ Download the pack', '⬇️ دانلود بسته', {
          type: 'url',
          url: 'https://example.com/downloads/wallpapers.zip',
        }),
      ),
      row(inline('b-pack-shop', '🏠 Back to the shop', '🏠 بازگشت به فروشگاه', goTo('shop', 'new'))),
    ),
    options: {},
  },

  // My purchases: what the user has paid for (and was not refunded).
  {
    ...box('purchases', 'My purchases', 2, 2),
    kind: 'if',
    cases: [
      {
        id: 'both',
        label: 'Bought both',
        when: { all: [{ hasPaid: 'guide-invoice' }, { hasPaid: 'pack-invoice' }] },
        goTo: 'all-purchases',
      },
      { id: 'guide', label: 'Bought the guide', when: { all: [{ hasPaid: 'guide-invoice' }] }, goTo: 'guide-paid' },
      { id: 'pack', label: 'Bought the pack', when: { all: [{ hasPaid: 'pack-invoice' }] }, goTo: 'pack-paid' },
    ],
    otherwise: 'no-purchases',
  },
  {
    ...box('all-purchases', 'All purchases', 3, 2),
    kind: 'message',
    content: text(
      't-all-purchases',
      '🛍 Your purchases\nThank you for buying both! Download them again any time.',
      '🛍 خریدهای شما\nسپاس که هر دو را خریدید! هر وقت خواستید دوباره دانلودشان کنید.',
    ),
    keyboard: inlineKeyboard(
      row(
        inline('b-all-guide', '📘 Starter guide', '📘 راهنمای شروع', {
          type: 'url',
          url: 'https://example.com/downloads/starter-guide.pdf',
        }),
      ),
      row(
        inline('b-all-pack', '🎨 Wallpaper pack', '🎨 بسته والپیپر', {
          type: 'url',
          url: 'https://example.com/downloads/wallpapers.zip',
        }),
      ),
      row(inline('b-all-shop', '🏠 Back to the shop', '🏠 بازگشت به فروشگاه', goTo('shop', 'new'))),
    ),
    options: {},
  },
  {
    ...box('no-purchases', 'No purchases yet', 3, 3),
    kind: 'message',
    content: text(
      't-no-purchases',
      'You have not bought anything yet. Have a look at the shop!',
      'هنوز چیزی نخریده‌اید. سری به فروشگاه بزنید!',
    ),
    keyboard: inlineKeyboard(
      row(inline('b-none-shop', '🏠 Open the shop', '🏠 باز کردن فروشگاه', goTo('shop', 'new'))),
    ),
    options: {},
  },

  // Help, and help with a payment.
  {
    ...box('how-to-buy', 'How to buy', 1, 3),
    kind: 'message',
    content: text(
      't-how-to-buy',
      'How buying works:\n1. Tap a product in the shop.\n2. Tap Buy, then Pay, and confirm in the window Telegram opens.\n' +
        '3. Your download comes right away and stays under My purchases.\nA problem with a payment? Send /paysupport.',
      'خرید چطور انجام می‌شود:\n۱. در فروشگاه روی یک محصول بزنید.\n۲. «خرید» و بعد «پرداخت» را بزنید و در پنجره‌ای که تلگرام باز می‌کند تأیید کنید.\n' +
        '۳. لینک دانلود همان لحظه می‌آید و در «خریدهای من» می‌ماند.\nمشکلی در پرداخت دارید؟ /paysupport را بفرستید.',
    ),
    keyboard: inlineKeyboard(
      row(inline('b-help-shop', '🏠 Open the shop', '🏠 باز کردن فروشگاه', goTo('shop', 'new'))),
    ),
    options: {},
  },
  {
    ...box('ask-problem', 'What went wrong?', 1, 4),
    kind: 'question',
    prompt: {
      content: text(
        't-ask-problem',
        'Sorry about the trouble! Tell us what went wrong with your payment, and we will answer you here within a day.',
        'بابت مشکل متأسفیم! بگویید در پرداخت چه اشکالی پیش آمد تا ظرف یک روز همین‌جا پاسختان را بدهیم.',
      ),
      keyboard: { type: 'forceReply', placeholder: { en: 'What happened?', fa: 'چه اتفاقی افتاد؟' } },
      options: {},
    },
    expects: 'text',
    checks: { minLength: 5, maxLength: 1000 },
    saveTo: 'var-problem',
    wrongAnswer: {
      message: say('t-ask-problem-wrong', {
        en: 'Please tell us in a few words what happened.',
        fa: 'لطفاً در چند کلمه بگویید چه اتفاقی افتاد.',
      }),
      maxTries: 3,
      afterMaxTries: 'shop',
    },
    next: 'send-problem',
  },
  {
    ...box('send-problem', 'Send to the owner', 2, 4),
    kind: 'devStep',
    description:
      "Send the user's message, name and Telegram ID to the shop owner's chat.\n" +
      'The owner answers the user and, when needed, gives the Stars back (refundStarPayment).',
    uses: ['var-problem'],
    sets: [],
    outcomes: [{ id: 'sent', label: 'Sent', goTo: 'problem-sent' }],
  },
  {
    ...box('problem-sent', 'We got it', 3, 4),
    kind: 'message',
    content: text(
      't-problem-sent',
      'Thanks, we got your message! We will answer you here soon.',
      'ممنون، پیامتان رسید! به‌زودی همین‌جا جوابتان را می‌دهیم.',
    ),
    keyboard: inlineKeyboard(
      row(inline('b-sent-shop', '🏠 Back to the shop', '🏠 بازگشت به فروشگاه', goTo('shop', 'new'))),
    ),
    options: {},
  },
]

export const shopTemplate: Design = {
  formatVersion: 1,
  id: 'template-shop',
  name: 'Shop with Stars',
  languages: { default: 'en', list: ['en', 'fa'] },
  bot: {
    name: { en: 'My Shop', fa: 'فروشگاه من' },
    about: { en: 'Digital products for Telegram Stars.', fa: 'محصولات دیجیتال با استارز تلگرام.' },
    description: {
      en: 'Hi! I sell digital products for Telegram Stars.\nPick one, pay in Telegram and get your download right away.',
      fa: 'سلام! من محصولات دیجیتال را با استارز تلگرام می‌فروشم.\nیکی را انتخاب کنید، در تلگرام پرداخت کنید و فایل را همان لحظه بگیرید.',
    },
    menuButton: 'commands',
    commandOrder: ['start', 'help', 'paysupport'],
  },
  steps: byId(steps),
  buttons: byId(buttons),
  variables: byId(variables),
  switches: {},
  parts: {},
  media: {},
}
