// Comments (commentRoutes of @xdesign/api; docs/plan/05 section 6, stage 2): the threads of a
// design with their replies and "@name" mentions, edit and delete, "Resolve" and "Reopen", "mark
// read", and the unread comments of the bell and the cards. After every change the open editors
// of the design get `commentsChanged` and reload them.
import { routes, type CommentAnchor, type commentAuthor, type commentThread, type unreadDesign } from '@xdesign/api'
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, ne, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { nanoid } from 'nanoid'
import type { z } from 'zod'

import { audit } from '../audit.ts'
import { getDesignRole } from '../auth/context.ts'
import { getDb } from '../db/index.ts'
import { commentReads, comments, designMembers, designs, users } from '../db/schema.ts'
import { ApiError } from '../errors.ts'
import { sendToDesign } from '../live/server.ts'
import { addRoute, type Register } from '../route.ts'

type Thread = z.output<typeof commentThread>
type Author = z.output<typeof commentAuthor>
type UnreadDesign = z.output<typeof unreadDesign>
type CommentRow = typeof comments.$inferSelect

const commentNotFound = 'This comment was not found.'

// How many of the newest unread comments the bell lists.
const bellSize = 50

// Who resolved a thread, beside its comments' authors (users).
const resolver = alias(users, 'resolver')

// The design of a route. The route helper lets the site owner through without a role, so a
// missing design answers 404 here, and so does one in Trash (as src/routes/designs.ts).
function checkDesign(designId: string): void {
  const row = getDb().select({ deletedAt: designs.deletedAt }).from(designs).where(eq(designs.id, designId)).get()
  if (!row) {
    throw new ApiError('not_found', 'This design was not found.')
  }
  if (row.deletedAt !== null) {
    throw new ApiError('not_found', 'This design is in Trash.')
  }
}

function findComment(designId: string, commentId: string): CommentRow {
  const row = getDb()
    .select()
    .from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.designId, designId)))
    .get()
  if (!row) {
    throw new ApiError('not_found', commentNotFound)
  }
  return row
}

// The mentioned people who have a role on the design, each once; anyone else (removed from the
// design meanwhile) is left out.
function mentionsOf(designId: string, userIds: string[]): string[] {
  return [...new Set(userIds)].filter((userId) => getDesignRole(userId, designId) !== null)
}

function authorOf(row: {
  authorId: string | null
  authorName: string | null
  authorColor: string | null
}): Author | null {
  return row.authorId === null ? null : { id: row.authorId, name: row.authorName ?? '', color: row.authorColor ?? '' }
}

// The names of the people still on the site, by ID.
function namesOf(userIds: string[]): Map<string, string> {
  const unique = [...new Set(userIds)]
  if (unique.length === 0) {
    return new Map()
  }
  const rows = getDb().select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, unique)).all()
  return new Map(rows.map((row) => [row.id, row.name]))
}

// The threads of the design (or the one thread), newest first, each with its comments oldest
// first. The Claude link's design.md lists the open ones (src/claude/export.ts).
export function readThreads(designId: string, threadId?: string): Thread[] {
  const rows = getDb()
    .select({
      id: comments.id,
      threadId: comments.threadId,
      anchor: comments.anchor,
      authorId: comments.authorId,
      authorName: users.name,
      authorColor: users.color,
      body: comments.body,
      mentions: comments.mentions,
      createdAt: comments.createdAt,
      editedAt: comments.editedAt,
      resolvedAt: comments.resolvedAt,
      resolvedBy: comments.resolvedBy,
      resolvedByName: resolver.name,
    })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.authorId))
    .leftJoin(resolver, eq(resolver.id, comments.resolvedBy))
    .where(and(eq(comments.designId, designId), threadId === undefined ? undefined : eq(comments.threadId, threadId)))
    .orderBy(asc(comments.createdAt), asc(comments.id))
    .all()
  const names = namesOf(rows.flatMap((row) => row.mentions))
  const toComment = (row: (typeof rows)[number]) => ({
    id: row.id,
    author: authorOf(row),
    body: row.body,
    mentions: row.mentions.flatMap((userId) => {
      const name = names.get(userId)
      return name === undefined ? [] : [{ id: userId, name }]
    }),
    createdAt: row.createdAt,
    editedAt: row.editedAt,
  })
  // The first comments make the threads, then the replies join them (a reply may share its
  // thread's millisecond).
  const threads = new Map<string, Thread>()
  for (const row of rows) {
    if (row.id === row.threadId && row.anchor !== null) {
      threads.set(row.id, {
        id: row.id,
        // Written only from startThread's checked body.
        anchor: row.anchor as CommentAnchor,
        resolvedAt: row.resolvedAt,
        resolvedBy: row.resolvedBy === null ? null : { id: row.resolvedBy, name: row.resolvedByName ?? '' },
        comments: [toComment(row)],
      })
    }
  }
  for (const row of rows) {
    if (row.id !== row.threadId) {
      threads.get(row.threadId)?.comments.push(toComment(row))
    }
  }
  return [...threads.values()].reverse()
}

function readThread(designId: string, threadId: string): Thread {
  const [thread] = readThreads(designId, threadId)
  if (!thread) {
    throw new ApiError('not_found', commentNotFound)
  }
  return thread
}

// Open editors of the design reload the comments.
function changed(designId: string): void {
  sendToDesign(designId, { type: 'commentsChanged' })
}

export const register: Register = (app) => {
  addRoute(app, routes.comments, ({ user, params }) => {
    checkDesign(params.id)
    const read = getDb()
      .select({ lastReadAt: commentReads.lastReadAt })
      .from(commentReads)
      .where(and(eq(commentReads.userId, user.id), eq(commentReads.designId, params.id)))
      .get()
    return { threads: readThreads(params.id), lastReadAt: read?.lastReadAt ?? null }
  })

  // "Comment" on a step, a button, a text or a spot on the map.
  addRoute(app, routes.startThread, ({ user, params, body }) => {
    checkDesign(params.id)
    const id = nanoid()
    getDb()
      .insert(comments)
      .values({
        id,
        designId: params.id,
        threadId: id,
        anchor: body.anchor,
        authorId: user.id,
        body: body.body,
        mentions: mentionsOf(params.id, body.mentions),
        createdAt: Date.now(),
      })
      .run()
    audit('comment_added', { userId: user.id, designId: params.id, detail: { threadId: id } })
    changed(params.id)
    return { thread: readThread(params.id, id) }
  })

  // A reply goes to the thread of the comment, also of a resolved one (it stays resolved).
  addRoute(app, routes.replyToThread, ({ user, params, body }) => {
    checkDesign(params.id)
    const { threadId } = findComment(params.id, params.commentId)
    const id = nanoid()
    getDb()
      .insert(comments)
      .values({
        id,
        designId: params.id,
        threadId,
        authorId: user.id,
        body: body.body,
        mentions: mentionsOf(params.id, body.mentions),
        createdAt: Date.now(),
      })
      .run()
    audit('comment_added', { userId: user.id, designId: params.id, detail: { threadId, commentId: id } })
    changed(params.id)
    return { thread: readThread(params.id, threadId) }
  })

  // Only the author edits a comment; the same text and mentions change nothing.
  addRoute(app, routes.editComment, ({ user, params, body }) => {
    checkDesign(params.id)
    const row = findComment(params.id, params.commentId)
    if (row.authorId !== user.id) {
      throw new ApiError('no_access', 'Only its author can edit a comment.')
    }
    const mentions = mentionsOf(params.id, body.mentions)
    if (body.body !== row.body || mentions.join() !== row.mentions.join()) {
      getDb()
        .update(comments)
        .set({ body: body.body, mentions, editedAt: Date.now() })
        .where(eq(comments.id, row.id))
        .run()
      changed(params.id)
    }
    return { thread: readThread(params.id, row.threadId) }
  })

  // The author or the design owner (also the site owner); the first comment takes its thread's
  // replies with it.
  addRoute(app, routes.deleteComment, ({ user, params, role }) => {
    checkDesign(params.id)
    const row = findComment(params.id, params.commentId)
    if (row.authorId !== user.id && role !== 'owner') {
      throw new ApiError('no_access', 'Only its author or the design owner can delete a comment.')
    }
    getDb()
      .delete(comments)
      .where(row.id === row.threadId ? eq(comments.threadId, row.id) : eq(comments.id, row.id))
      .run()
    changed(params.id)
    return { ok: true as const }
  })

  // "Resolve" and "Reopen" act on the thread of the comment; again changes nothing.
  addRoute(app, routes.resolveThread, ({ user, params }) => {
    checkDesign(params.id)
    const { threadId } = findComment(params.id, params.commentId)
    const first = findComment(params.id, threadId)
    if (first.resolvedAt === null) {
      getDb()
        .update(comments)
        .set({ resolvedAt: Date.now(), resolvedBy: user.id })
        .where(eq(comments.id, threadId))
        .run()
      audit('comment_resolved', { userId: user.id, designId: params.id, detail: { threadId } })
      changed(params.id)
    }
    return { thread: readThread(params.id, threadId) }
  })

  addRoute(app, routes.reopenThread, ({ params }) => {
    checkDesign(params.id)
    const { threadId } = findComment(params.id, params.commentId)
    const first = findComment(params.id, threadId)
    if (first.resolvedAt !== null) {
      getDb().update(comments).set({ resolvedAt: null, resolvedBy: null }).where(eq(comments.id, threadId)).run()
      changed(params.id)
    }
    return { thread: readThread(params.id, threadId) }
  })

  // Every comment written up to now is read; only the person's own counts change, so no notice.
  addRoute(app, routes.markCommentsRead, ({ user, params }) => {
    checkDesign(params.id)
    const now = Date.now()
    getDb()
      .insert(commentReads)
      .values({ userId: user.id, designId: params.id, lastReadAt: now })
      .onConflictDoUpdate({ target: [commentReads.userId, commentReads.designId], set: { lastReadAt: now } })
      .run()
    return { ok: true as const }
  })

  // Unread: comments by others written after the person last marked the design read (every one
  // when never), in the designs they can open (as "All" of the Designs page), newest first.
  addRoute(app, routes.unreadComments, ({ user }) => {
    const rows = getDb()
      .select({
        id: comments.id,
        threadId: comments.threadId,
        designId: designs.id,
        designName: designs.name,
        authorId: comments.authorId,
        authorName: users.name,
        authorColor: users.color,
        body: comments.body,
        mentions: comments.mentions,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .innerJoin(designs, eq(designs.id, comments.designId))
      .leftJoin(users, eq(users.id, comments.authorId))
      .leftJoin(designMembers, and(eq(designMembers.designId, designs.id), eq(designMembers.userId, user.id)))
      .leftJoin(commentReads, and(eq(commentReads.designId, designs.id), eq(commentReads.userId, user.id)))
      .where(
        and(
          isNull(designs.deletedAt),
          user.isSiteOwner ? undefined : or(eq(designs.ownerId, user.id), isNotNull(designMembers.userId)),
          or(isNull(comments.authorId), ne(comments.authorId, user.id)),
          or(isNull(commentReads.lastReadAt), gt(comments.createdAt, commentReads.lastReadAt)),
        ),
      )
      .orderBy(desc(comments.createdAt), desc(comments.id))
      .all()
    const byDesign = new Map<string, UnreadDesign>()
    for (const row of rows) {
      const mentioned = row.mentions.includes(user.id) ? 1 : 0
      const entry = byDesign.get(row.designId)
      if (entry) {
        entry.unread += 1
        entry.mentions += mentioned
      } else {
        byDesign.set(row.designId, {
          id: row.designId,
          name: row.designName,
          unread: 1,
          mentions: mentioned,
          lastAt: row.createdAt,
        })
      }
    }
    const newest = rows.slice(0, bellSize).map((row) => ({
      id: row.id,
      threadId: row.threadId,
      design: { id: row.designId, name: row.designName },
      author: authorOf(row),
      body: row.body,
      createdAt: row.createdAt,
      mentionsYou: row.mentions.includes(user.id),
    }))
    return { designs: [...byDesign.values()], comments: newest }
  })
}
