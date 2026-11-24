// Sample posts for the preview gallery and the comparison page (docs/plan/10-frontend.md
// sections 12.3 and 12.4): the reference posts of 12.4 plus a few edge cases. Text and
// entities are composed from parts, so the UTF-16 offsets are always right; pictures are
// generated SVGs (no binary files in the repository).
import type { Entity, InlineKeyboard, PreviewMedia, TgPreviewPost } from './model'

type Part = string | { entity: Omit<Entity, 'offset' | 'length'>; parts: Part[] }

/** Concatenates parts into a text and the entities of the tagged parts. */
function compose(...parts: Part[]): { text: string; entities: Entity[] } {
  let text = ''
  const entities: Entity[] = []
  const walk = (list: Part[]) => {
    for (const p of list) {
      if (typeof p === 'string') {
        text += p
        continue
      }
      const start = text.length
      walk(p.parts)
      entities.push({ ...p.entity, offset: start, length: text.length - start })
    }
  }
  walk(parts)
  return { text, entities }
}

const tag =
  (entity: Omit<Entity, 'offset' | 'length'>) =>
  (...parts: Part[]): Part => ({ entity, parts })
const b = tag({ type: 'bold' })
const i = tag({ type: 'italic' })
const u = tag({ type: 'underline' })
const s = tag({ type: 'strike' })
const spoiler = tag({ type: 'spoiler' })
const code = tag({ type: 'code' })
const link = (url: string) => tag({ type: 'text_link', url })
const date = (unix_time: number, date_format: string) =>
  tag({ type: 'formatted_date', unix_time, ...(date_format ? { date_format } : {}) })

/** When the page was opened, in seconds: the formatted dates of the samples are relative to it. */
const openedAt = Math.floor(Date.now() / 1000)
/** The text of a formatted date, for apps that cannot draw it: the time in UTC, "14:05". */
const dateText = (unix: number) => new Date(unix * 1000).toISOString().slice(11, 16)

/** A generated picture of the given size: a soft gradient with a few shapes. */
export function samplePicture(width: number, height: number, hue: number): string {
  const r = Math.min(width, height)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}" viewBox="0 0 ${String(width)} ${String(height)}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${String(hue)} 55% 78%)"/>` +
    `<stop offset="1" stop-color="hsl(${String(hue + 35)} 50% 42%)"/></linearGradient></defs>` +
    `<rect width="100%" height="100%" fill="url(#g)"/>` +
    `<circle cx="${String(width * 0.32)}" cy="${String(height * 0.36)}" r="${String(r * 0.16)}" fill="rgba(255,255,255,0.5)"/>` +
    `<rect x="${String(width * 0.5)}" y="${String(height * 0.55)}" width="${String(r * 0.34)}" height="${String(r * 0.22)}" rx="${String(r * 0.03)}" fill="rgba(0,0,0,0.18)"/></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function photo(width: number, height: number, hue: number): PreviewMedia {
  return { kind: 'photo', url: samplePicture(width, height, hue), width, height }
}

const channel = { title: 'CHANNEL_NAME', subscribers: 2, color: 3 }

/** The link of the sample proxy cards. */
const proxyLink = 'https://t.me/proxy?server=proxy.example.com&port=443&secret=0123456789abcdef0123456789abcdef'

/**
 * The buttons of a proxy card (19 section 7.3), as POST api/proxies/card-preview answers them:
 * Connect, green while the proxy is online; Copy and Share.
 */
function proxyButtons(online: boolean): InlineKeyboard {
  return [
    { buttons: [{ text: 'Connect', kind: 'url', style: online ? 'success' : 'none', url: proxyLink }] },
    {
      buttons: [
        { text: 'Copy', kind: 'copy', style: 'none', copy_text: proxyLink },
        {
          text: 'Share',
          kind: 'url',
          style: 'none',
          url: `https://t.me/share/url?url=${encodeURIComponent(proxyLink)}`,
        },
      ],
    },
  ]
}

function post(fields: Partial<TgPreviewPost> & { text: string; entities: Entity[] }): TgPreviewPost {
  return {
    asCaption: (fields.media?.length ?? 0) > 0,
    media: [],
    linkPreview: null,
    invertMedia: false,
    channel,
    views: 2,
    date: '2026-10-02T15:35:00Z',
    timeZone: 'UTC',
    reactions: [
      { emoji: '👍', count: 12 },
      { emoji: '🔥', count: 4 },
    ],
    comments: { count: 3 },
    length: fields.text.length,
    limit: (fields.media?.length ?? 0) > 0 ? 1024 : 4096,
    issues: [],
    language: 'en',
    rtl: false,
    ...fields,
  }
}

export interface Fixture {
  id: string
  label: string
  post: TgPreviewPost
}

export const fixtures: readonly Fixture[] = [
  {
    id: 'owner-photo',
    label: 'Photo with a three-paragraph caption (the owner reference post)',
    post: post({ ...compose('Header\n\nContext\n\nFooter'), media: [photo(1200, 1600, 30)] }),
  },
  {
    id: 'plain',
    label: 'Short plain English post',
    post: post(
      compose(
        'The new release is out today 🎉, with faster search and a simpler editor 🔍✨\n\n' +
          'Update from the app store or the website.',
      ),
    ),
  },
  {
    id: 'persian',
    label: 'Persian with an English start, numbers, a hashtag and a link',
    post: post({
      ...compose(
        'خبر تازه امروز منتشر شد و جزئیات آن در ادامه آمده است.\n',
        '‏Telegram نسخه 12 را با ویژگی‌های جدید عرضه کرد.\n',
        'بیش از 950 میلیون کاربر از این برنامه استفاده می‌کنند. #تلگرام\n',
        'بیشتر بخوانید: https://telegram.org/blog',
      ),
      language: 'fa',
      rtl: true,
    }),
  },
  {
    id: 'persian-caption',
    label: 'Photo with a Persian caption with a quote, ending in a short line',
    post: post({
      ...compose(
        b('خبر فوری'),
        '\n\n',
        'نسخه تازه برنامه امروز منتشر شد و جستجو در آن بسیار سریع‌تر از قبل است.\n',
        { entity: { type: 'blockquote' }, parts: ['به گفته سازندگان، نسخه بعدی تا پایان ماه می‌رسد.'] },
        '\nمنبع: وبلاگ رسمی',
      ),
      media: [photo(1600, 1067, 160)],
      language: 'fa',
      rtl: true,
    }),
  },
  {
    id: 'formatting',
    label: 'Every kind of formatting',
    post: post(
      compose(
        b('Bold'),
        ', ',
        i('italic'),
        ', ',
        u('underline'),
        ', ',
        s('strikethrough'),
        ', ',
        spoiler('a spoiler'),
        ', ',
        code('inline code'),
        ' and ',
        link('https://example.com')('a link'),
        '.\n',
        { entity: { type: 'pre', language: 'python' }, parts: ['def greet(name):\n    return f"Hello, {name}!"'] },
        '\n',
        { entity: { type: 'blockquote' }, parts: ['A short quote from someone.'] },
        '\n',
        {
          entity: { type: 'blockquote', collapsed: true },
          parts: [
            'An expandable quote.\nLine two of the quote.\nLine three of the quote.\n' +
              'Line four of the quote.\nLine five of the quote.\nLine six of the quote.',
          ],
        },
        '\nMentions like @telegram and #news are linked automatically.',
      ),
    ),
  },
  {
    id: 'code-blocks',
    label: 'Code blocks: one that opens the post, a language Web K does not know, and long code',
    post: post(
      compose(
        { entity: { type: 'pre', language: 'js' }, parts: ['const answer = 42\nconsole.log(answer)'] },
        '\nThe same in Go:\n',
        { entity: { type: 'pre', language: 'golang' }, parts: ['fmt.Println(42)'] },
        '\nAnd the settings, long enough for a smaller font and a copy bar on Android:\n',
        {
          entity: { type: 'pre', language: 'json' },
          parts: [
            '{\n  "name": "xWriter",\n  "posts": [1, 2, 3],\n  "schedule": "every day at 09:00",\n' +
              '  "channels": ["news", "deals"],\n  "enabled": true\n}',
          ],
        },
      ),
    ),
  },
  {
    id: 'quotes',
    label: 'Quotes: one that opens the post, a short one under a long line, a short expandable one and a Persian one',
    post: post(
      compose(
        { entity: { type: 'blockquote' }, parts: ['A quote that opens the post.'] },
        '\nA long line of text that runs across the whole bubble before the short quote under it.\n',
        { entity: { type: 'blockquote' }, parts: ['A short quote.'] },
        '\n',
        {
          entity: { type: 'blockquote', collapsed: true },
          parts: ['An expandable quote of two lines.\nIt is short, so it does not fold.'],
        },
        '\n',
        { entity: { type: 'blockquote' }, parts: ['این یک نقل قول فارسی است که از راست به چپ نوشته می‌شود.'] },
        '\nThe end.',
      ),
    ),
  },
  {
    id: 'formatted-dates',
    label: 'Formatted dates: a proxy card checked 3 minutes ago (counting up), then the other styles',
    post: post(
      compose(
        b('🇩🇪 Proxy #12'),
        '\n🟢 Online · checked ',
        date(openedAt - 180, 'r')(dateText(openedAt - 180)),
        '\n@TeleProxy\n\nLater today: ',
        date(openedAt + 7200, 'r')(dateText(openedAt + 7200)),
        '\nWeekday, time and long date: ',
        date(openedAt + 3 * 86_400, 'wDT')(dateText(openedAt + 3 * 86_400)),
        '\nShort date and time, last year: ',
        date(openedAt - 400 * 86_400, 'dt')(dateText(openedAt - 400 * 86_400)),
        '\nNo format, the text as it is: ',
        date(openedAt, '')('this evening'),
      ),
    ),
  },
  {
    id: 'proxy-card',
    label: 'An MTProto proxy card alone with its buttons: the green Connect, Copy and Share',
    post: post({
      ...compose(
        b('🇩🇪 Proxy #12'),
        '\n🟢 Online · checked ',
        date(openedAt - 180, 'r')(dateText(openedAt - 180)),
        '\n@TeleProxy',
      ),
      keyboard: proxyButtons(true),
    }),
  },
  {
    id: 'proxy-card-photo',
    label: 'A photo post ending in the card of an offline proxy: a plain Connect',
    post: post({
      ...compose(
        'The weekend update: faster servers in Frankfurt and a new one in Amsterdam.\n\n',
        b('🇳🇱 Proxy #7'),
        '\n🔴 Offline · checked ',
        date(openedAt - 600, 'r')(dateText(openedAt - 600)),
      ),
      media: [photo(1600, 1067, 250)],
      keyboard: proxyButtons(false),
    }),
  },
  {
    id: 'keyboard-styles',
    label: 'Inline buttons of every color and kind: success, danger, primary, a link and a bot button',
    post: post({
      ...compose('A post waits for your approval.'),
      keyboard: [
        {
          buttons: [
            { text: '✅ Approve', kind: 'callback', style: 'success' },
            { text: '❌ Reject', kind: 'callback', style: 'danger' },
          ],
        },
        {
          buttons: [
            { text: 'Open in the panel', kind: 'url', style: 'primary', url: 'https://panel.example.com/queue' },
          ],
        },
        {
          buttons: [
            { text: 'A button with a long label that does not fit', kind: 'url', url: 'https://example.com' },
            { text: 'Later', kind: 'callback' },
          ],
        },
      ],
    }),
  },
  {
    id: 'album',
    label: 'Album of three: wide, tall and square',
    post: post({
      ...compose('Three photos from the trip.'),
      media: [photo(1600, 900, 200), photo(900, 1600, 120), photo(1200, 1200, 0)],
    }),
  },
  {
    id: 'link-preview',
    label: 'Text with a large link preview',
    post: post({
      ...compose('Read the full announcement: https://telegram.org/blog'),
      linkPreview: {
        url: 'https://telegram.org/blog',
        siteName: 'Telegram',
        title: 'Telegram Blog',
        description: 'News and updates from the Telegram team.',
        photo: { url: samplePicture(1200, 630, 210), width: 1200, height: 630 },
        largePhoto: true,
      },
    }),
  },
  {
    id: 'photo-only',
    label: 'Photo without a caption',
    post: post({ ...compose(''), media: [photo(1600, 1067, 90)] }),
  },
]

export function findFixture(id: string | undefined): Fixture {
  return fixtures.find((f) => f.id === id) ?? (fixtures[0] as Fixture)
}
