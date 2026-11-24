// The texts a Telegram app words its own way (docs/plan/29-owner-list-2026-10-22.md section 8.6,
// TGP-02): the top bar's subscriber count and the comments bar's label; a poll's words and paid
// media's price button (MSG-03). These are the
// preview's texts of 10 section 8.9; a look whose app writes them otherwise ("12 Comments",
// "12 345 subscribers") gives its own functions in its tokens.
import type { TgChatAction } from '../model'
import type { PollLabels } from './tokens'

/** "12,345 subscribers", "1 subscriber", or "channel" when the count is unknown. */
export function subscribersLabel(count: number | undefined): string {
  if (count === undefined) return 'channel'
  return `${new Intl.NumberFormat('en-US').format(count)} ${count === 1 ? 'subscriber' : 'subscribers'}`
}

/** "Leave a comment", "1 comment", "12 comments". */
export function commentsLabel(count: number): string {
  return count > 0 ? `${String(count)} ${count === 1 ? 'comment' : 'comments'}` : 'Leave a comment'
}

/** What the bot is doing in the private chat's top bar ("typing", "sending photo"), without the dots each look draws its way (ChatTokens.status, PRV-02). */
export function chatActionLabel(action: TgChatAction): string {
  switch (action) {
    case 'typing':
      return 'typing'
    case 'photo':
      return 'sending photo'
    case 'video':
      return 'sending video'
    case 'voice':
      return 'recording voice message'
    case 'file':
      return 'sending file'
    case 'location':
      return 'choosing location'
    case 'videoNote':
      return 'recording video message'
    case 'sticker':
      return 'choosing a sticker'
  }
}

const count = (n: number, one: string, many: string) =>
  `${new Intl.NumberFormat('en-US').format(n)} ${n === 1 ? one : many}`

/** A poll's words as Web A, Web K, Desktop and Android write them (calibrate: O-02); iOS changes a few. */
export const pollLabels: PollLabels = {
  anonymous: 'Anonymous Poll',
  public: 'Public Poll',
  anonymousQuiz: 'Anonymous Quiz',
  quiz: 'Quiz',
  noVotes: 'No votes',
  noAnswers: 'No answers',
  votes: (n) => count(n, 'vote', 'votes'),
  answers: (n) => count(n, 'answer', 'answers'),
  vote: 'Vote',
  results: 'View Results',
}

/** The payment sheet's words in every look (PAY-02, calibrate: O-02): Telegram's own headings. */
export const sheetLabels = {
  title: 'Checkout',
  starsTitle: 'Confirm Your Purchase',
  total: 'Total',
  shipping: 'Shipping Method',
}

/** The pinned message bar's title and a gift card's (EVT-02, calibrate: O-02): Telegram's own words. */
export const eventLabels = {
  pinned: 'Pinned Message',
  gift: (bot: string) => `Gift from ${bot}`,
  view: 'View',
  restart: 'Restart',
}

/** Paid media's price button: "Unlock for ⭐ 50". */
export function unlockLabel(stars: number): string {
  return `Unlock for ⭐ ${new Intl.NumberFormat('en-US').format(stars)}`
}
