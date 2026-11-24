// The approximation of Telegram's automatic links (docs/plan/10-frontend.md section 8.5):
// URLs and emails with linkify-it, plus @usernames, #hashtags and $CASHTAGS. Telegram
// marks them on its server after sending; small differences are fine.
import { LinkifyIt } from 'linkify-it'
import type { AutoLinkKind } from './entities'

export interface AutoLink {
  start: number
  end: number
  kind: AutoLinkKind
  href: string
}

/**
 * Common top-level domains besides linkify-it's defaults (com, org, net, info and the
 * other old ones, plus every two-letter country code such as ir, io or ai). Telegram links
 * a bare domain of any real top-level domain (tehran.ir/news, example.app); these are
 * the ones posts use most, so the preview needs no list of all 1,500.
 */
const commonTlds = [
  'academy',
  'agency',
  'app',
  'art',
  'blog',
  'bot',
  'business',
  'cafe',
  'center',
  'chat',
  'city',
  'click',
  'cloud',
  'club',
  'codes',
  'community',
  'company',
  'design',
  'dev',
  'digital',
  'email',
  'events',
  'finance',
  'fun',
  'games',
  'global',
  'group',
  'guru',
  'health',
  'host',
  'life',
  'link',
  'live',
  'love',
  'ltd',
  'media',
  'mobi',
  'money',
  'network',
  'news',
  'one',
  'online',
  'page',
  'photo',
  'press',
  'run',
  'school',
  'site',
  'social',
  'software',
  'solutions',
  'space',
  'store',
  'studio',
  'support',
  'team',
  'tech',
  'technology',
  'today',
  'tools',
  'top',
  'travel',
  'video',
  'vip',
  'website',
  'wiki',
  'work',
  'world',
  'xyz',
  'zone',
]

// linkify-it 6 leaves fuzzy links (a domain without http://) off by default.
const linkify = new LinkifyIt({ fuzzyLink: true }).tlds(commonTlds, true)

/** Characters that may not come right before a mention, hashtag or cashtag. */
const wordBefore = /[\p{L}\p{N}_]$/u

linkify.add('@', {
  validate(text, pos) {
    const m = /^[A-Za-z][A-Za-z0-9_]{3,31}/.exec(text.slice(pos))
    if (!m || wordBefore.test(text.slice(0, pos - 1))) return 0
    return m[0].length
  },
})

linkify.add('#', {
  validate(text, pos) {
    const m = /^[\p{L}\p{N}_]+/u.exec(text.slice(pos))
    if (!m || /^\p{N}+$/u.test(m[0]) || wordBefore.test(text.slice(0, pos - 1))) return 0
    return m[0].length
  },
})

linkify.add('$', {
  validate(text, pos) {
    const m = /^[A-Z]{3,8}(?![A-Za-z0-9_])/.exec(text.slice(pos))
    if (!m || wordBefore.test(text.slice(0, pos - 1))) return 0
    return m[0].length
  },
})

/** The automatic links of a text, in order. */
export function findAutoLinks(text: string): AutoLink[] {
  return (linkify.match(text) ?? []).map((m) => {
    let kind: AutoLinkKind = 'url'
    if (m.schema === '@') kind = 'mention'
    else if (m.schema === '#') kind = 'hashtag'
    else if (m.schema === '$') kind = 'cashtag'
    else if (m.schema === 'mailto:' || (m.schema === '' && m.url.startsWith('mailto:'))) kind = 'email'
    return { start: m.index, end: m.lastIndex, kind, href: m.url }
  })
}
