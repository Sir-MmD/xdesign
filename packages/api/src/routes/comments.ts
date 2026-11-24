// Comments (docs/plan/05 section 6, stage 2): the threads of a design on a step, a button, a text
// or a spot on the map, replies, "@name" mentions, "Resolve" and "Reopen", and the unread
// comments of the bell and the cards. Commenter and above write, Viewer reads.
import { z } from 'zod'

import { id, ok, person, time } from '../common.ts'
import { defineRoute } from '../route.ts'
import { languageCode } from './designs.ts'

// An ID inside the design document (a step, a button): any short URL-safe string, as IdSchema of
// @xdesign/spec.
const docId = z.string().regex(/^[\w-]{1,64}$/, 'Not a valid id.')

// What the anchor was called when the thread started: a thread stays when its step or button is
// deleted, shown "on a deleted step" with this title.
const anchorTitle = z.string().max(200)

// What a thread is on: a step, a button of a step, a step's text in one language, or a free spot
// on the map (map coordinates).
export const commentAnchor = z.discriminatedUnion('on', [
  z.object({ on: z.literal('step'), stepId: docId, title: anchorTitle }),
  z.object({ on: z.literal('button'), stepId: docId, buttonId: docId, title: anchorTitle, label: anchorTitle }),
  z.object({ on: z.literal('text'), stepId: docId, lang: languageCode, title: anchorTitle }),
  z.object({ on: z.literal('map'), x: z.number(), y: z.number() }),
])
export type CommentAnchor = z.output<typeof commentAnchor>

export const commentText = z.string().trim().min(1, 'Write a comment.').max(5000, 'Use at most 5000 characters.')

// The author of a comment with their avatar's color.
export const commentAuthor = z.object({ id, name: z.string(), color: z.string() })

export const comment = z.object({
  id,
  // Null once the person is removed from the site; the comment stays.
  author: commentAuthor.nullable(),
  body: z.string(),
  // The people mentioned with "@name" who are still on the site.
  mentions: z.array(person),
  createdAt: time,
  editedAt: time.nullable(),
})

export const commentThread = z.object({
  // The ID of its first comment.
  id,
  anchor: commentAnchor,
  resolvedAt: time.nullable(),
  // Null while open, and once the person is removed from the site.
  resolvedBy: person.nullable(),
  // The first comment, then the replies, oldest first.
  comments: z.array(comment),
})

// A design with comments the person has not read: by others, after their last "mark read".
export const unreadDesign = z.object({
  id,
  name: z.string(),
  unread: z.number().int(),
  // How many of them mention the person.
  mentions: z.number().int(),
  // When the newest one was written.
  lastAt: time,
})

// An unread comment in the bell.
export const unreadComment = z.object({
  id,
  threadId: id,
  design: z.object({ id, name: z.string() }),
  author: commentAuthor.nullable(),
  body: z.string(),
  createdAt: time,
  mentionsYou: z.boolean(),
})

const designParams = z.object({ id })
const commentParams = z.object({ id, commentId: id })

// A comment as written: its text and the IDs of the people picked from the "@" list (people with
// access to the design; others are left out).
const commentInput = {
  body: commentText,
  mentions: z.array(id).max(50).default([]),
}

export const commentRoutes = {
  // The Comments panel and the pins: every thread of the design, newest first, and when the person
  // last marked them read (null: never).
  comments: defineRoute({
    key: 'comments',
    method: 'GET',
    path: '/api/designs/:id/comments',
    params: designParams,
    response: z.object({ threads: z.array(commentThread), lastReadAt: time.nullable() }),
    auth: { design: 'viewer' },
  }),
  // "Comment": a new thread on an anchor.
  startThread: defineRoute({
    key: 'startThread',
    method: 'POST',
    path: '/api/designs/:id/comments',
    params: designParams,
    body: z.object({ anchor: commentAnchor, ...commentInput }),
    response: z.object({ thread: commentThread }),
    auth: { design: 'commenter' },
  }),
  // A reply to the thread of the comment.
  replyToThread: defineRoute({
    key: 'replyToThread',
    method: 'POST',
    path: '/api/designs/:id/comments/:commentId/replies',
    params: commentParams,
    body: z.object(commentInput),
    response: z.object({ thread: commentThread }),
    auth: { design: 'commenter' },
  }),
  // Only its author edits a comment.
  editComment: defineRoute({
    key: 'editComment',
    method: 'PATCH',
    path: '/api/designs/:id/comments/:commentId',
    params: commentParams,
    body: z.object(commentInput),
    response: z.object({ thread: commentThread }),
    auth: { design: 'commenter' },
  }),
  // Its author or the design owner; deleting the first comment deletes the thread with its
  // replies.
  deleteComment: defineRoute({
    key: 'deleteComment',
    method: 'DELETE',
    path: '/api/designs/:id/comments/:commentId',
    params: commentParams,
    response: ok,
    auth: { design: 'commenter' },
  }),
  // "Resolve" the thread of the comment.
  resolveThread: defineRoute({
    key: 'resolveThread',
    method: 'POST',
    path: '/api/designs/:id/comments/:commentId/resolve',
    params: commentParams,
    response: z.object({ thread: commentThread }),
    auth: { design: 'commenter' },
  }),
  // "Reopen" the thread of the comment.
  reopenThread: defineRoute({
    key: 'reopenThread',
    method: 'POST',
    path: '/api/designs/:id/comments/:commentId/reopen',
    params: commentParams,
    response: z.object({ thread: commentThread }),
    auth: { design: 'commenter' },
  }),
  // The person has read every comment of the design up to now.
  markCommentsRead: defineRoute({
    key: 'markCommentsRead',
    method: 'POST',
    path: '/api/designs/:id/comments/read',
    params: designParams,
    response: ok,
    auth: { design: 'viewer' },
  }),
  // The bell and the cards: the designs the person can open with unread comments, newest first,
  // and the 50 newest unread comments.
  unreadComments: defineRoute({
    key: 'unreadComments',
    method: 'GET',
    path: '/api/comments/unread',
    response: z.object({ designs: z.array(unreadDesign), comments: z.array(unreadComment) }),
    auth: 'member',
  }),
}
