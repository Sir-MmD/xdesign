// Live editing on the server (docs/plan/02 section 4, 05 section 4): Hocuspocus on the app's own
// HTTP server at `/live`, one document `design:<id>` per design. Access is checked per document
// and again when it changes (src/live/access.ts). A document is loaded from design_docs and saved
// debounced (src/live/docs.ts); it stays loaded for 5 minutes after its last connection closed,
// at most 200 at a time, and changes that would take it above 20 MB are refused. Version history
// (HIST-01) makes a version when the last editor leaves and restores versions as one change.
// Claude's design edits (MCP-02a) reach an open document the same way (editDesignAs).
import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'

import { Server, type Connection, type Document, type Hocuspocus } from '@hocuspocus/server'
import { encodeDoc } from '@xdesign/spec'
import type { FastifyInstance } from 'fastify'
import * as Y from 'yjs'

import { onUserAccessChanged } from '../auth/events.ts'
import { siteOrigins } from '../auth/http.ts'
import { emptyPageResponse } from '../basePath.ts'
import type { Config } from '../config.ts'
import { addVersionOf, versionOnLeave } from '../designs/versions.ts'
import { fromFront, notFromFrontResponse } from '../front.ts'
import { log } from '../log.ts'
import { version } from '../version.ts'
import { admit, contextOf, LiveRefusal, recheck, upgradeRefusal, type LiveContext } from './access.ts'
import { designIdOf, docNameOf, loadDoc, saveDoc } from './docs.ts'
import { restoreUpdate } from './revert.ts'

import { hidePresenceFromViews } from './view.ts'

// The live path under the base path (`<base>live`); Vite's dev proxy and the helper's front pass
// its upgrades through. A base path has only letters, digits, - and _ between its slashes: nothing
// a RegExp reads as special.
function livePathOf(basePath: string): RegExp {
  return new RegExp(`^${basePath}live/?(?:\\?|$)`)
}

// A save waits for 2 seconds without changes, at most 10 seconds after the first unsaved one.
const debounceMs = 2000
const maxDebounceMs = 10 * 1000
// A document stays loaded this long after its last connection closed, so a reload or a
// reconnect finds it in memory; the sweep runs every sweepMs.
const idleMs = 5 * 60 * 1000
const sweepMs = 30 * 1000
const maxDocuments = 200
// Changes that would take a document's state above maxBytes are refused, and so is an import of a
// bigger design (src/routes/designs.ts); from warnBytes the server logs a warning.
export const maxBytes = 20 * 1024 * 1024
const warnBytes = 10 * 1024 * 1024

// A JSON message to everyone in a design, sent as Hocuspocus's stateless message. Stage 2 adds
// "comments changed" and "a version was restored".
export type LiveMessage =
  | { type: 'serverVersion'; version: string }
  // A comment was added, edited, deleted, resolved or reopened: open editors reload the comments.
  | { type: 'commentsChanged' }

  // HIST-01: a version was restored; open editors refresh the History panel.
  | { type: 'versionRestored' }

interface Loaded {
  // When its last connection closed; null while someone has it open.
  idleSince: number | null
  // An upper bound of its state's size: the last saved or measured size plus the messages
  // applied since.
  bytes: number
  // Logged once as over warnBytes.
  warned: boolean
}

let live: Server<LiveContext> | null = null
// The loaded documents by name.
const loaded = new Map<string, Loaded>()
// Documents this module unloads; Hocuspocus's own unloading when the last connection closes is
// refused (beforeUnloadDocument), so documents stay for idleMs.
const releasing = new Set<string>()
// The upgraded sockets, destroyed when the app closes.
const sockets = new Set<Duplex>()
let closing = false

// Hocuspocus awaits each hook; ours run synchronously (better-sqlite3), a throw rejects.
function hook<T>(run: (data: T) => unknown): (data: T) => Promise<unknown> {
  return (data) =>
    new Promise((resolve) => {
      resolve(run(data))
    })
}

function noteSize(documentName: string, entry: Loaded, bytes: number): void {
  entry.bytes = bytes
  if (bytes >= warnBytes && !entry.warned) {
    entry.warned = true
    log.warn({ designId: designIdOf(documentName), bytes }, 'a live document is over 10 MB')
  }
}

// Refuses a message that could take the document above maxBytes; the estimate is measured again
// before refusing. The writer's connection then closes with "too_big".
function guardSize(documentName: string, document: Y.Doc, bytes: number, userId: string | null): void {
  const entry = loaded.get(documentName)
  if (!entry) {
    return
  }
  if (entry.bytes + bytes > maxBytes) {
    noteSize(documentName, entry, encodeDoc(document).byteLength)
    if (entry.bytes + bytes > maxBytes) {
      log.warn(
        { designId: designIdOf(documentName), userId, bytes: entry.bytes },
        'a live change over 20 MB was refused',
      )
      throw new LiveRefusal('too_big')
    }
  }
  entry.bytes += bytes
}

async function release(instance: Hocuspocus, document: Document): Promise<void> {
  releasing.add(document.name)
  try {
    await instance.unloadDocument(document)
  } finally {
    releasing.delete(document.name)
  }
}

function idleTime(document: Document): number {
  return loaded.get(document.name)?.idleSince ?? Date.now()
}

// Before a document loads: unloads the documents idle longest until it fits under maxDocuments,
// or refuses it with "busy" when every loaded one is open.
async function makeRoom(instance: Hocuspocus): Promise<void> {
  const idle = [...instance.documents.values()]
    .filter((document) => document.getConnectionsCount() === 0)
    .sort((a, b) => idleTime(a) - idleTime(b))
  for (const document of idle) {
    if (instance.documents.size + instance.loadingDocuments.size <= maxDocuments) {
      break
    }
    await release(instance, document)
  }
  if (instance.documents.size + instance.loadingDocuments.size > maxDocuments) {
    throw new LiveRefusal('busy')
  }
}

// Every sweepMs: checks each connection's access again (a password reset from the command line
// ends sessions without an event here) and unloads the documents idle for idleMs.
async function sweep(instance: Hocuspocus): Promise<void> {
  const now = Date.now()
  for (const document of [...instance.documents.values()]) {
    for (const connection of document.getConnections()) {
      recheck(connection)
    }
    const entry = loaded.get(document.name)
    if (!entry || document.getConnectionsCount() > 0) {
      continue
    }
    entry.idleSince ??= now
    if (now - entry.idleSince >= idleMs) {
      await release(instance, document)
    }
  }
}

// Hocuspocus's name for a document's debounced save.
function storeId(document: Document): string {
  return `onStoreDocument-${document.name}`
}

// Runs the document's pending save now and waits until no save is running.
async function flush(instance: Hocuspocus, document: Document): Promise<void> {
  if (instance.debouncer.isDebounced(storeId(document))) {
    await instance.debouncer.executeNow(storeId(document))
  }
  await document.saveMutex.waitForUnlock()
}

// HIST-01: once no connection that may write is left, their changes are saved now and an
// automatic version is made when the design changed since its last version (not while the server
// closes: the database closes next).
async function afterEditorsLeft(instance: Hocuspocus, document: Document): Promise<void> {
  const designId = designIdOf(document.name)
  if (designId === null || document.getConnections().some((connection) => !connection.readOnly)) {
    return
  }
  try {
    await flush(instance, document)
    if (!closing) {
      versionOnLeave(designId)
    }
  } catch (error) {
    log.error({ err: error, designId }, 'the version after the last editor left was not made')
  }
}

function connectionsOf(instance: Hocuspocus, userId: string, designId: string | undefined): Connection[] {
  const documents =
    designId === undefined ? [...instance.documents.values()] : [instance.documents.get(docNameOf(designId))]
  return documents
    .flatMap((document) => document?.getConnections() ?? [])
    .filter((connection) => contextOf(connection).userId === userId)
}

function createServer(): Server<LiveContext> {
  return new Server<LiveContext>({
    quiet: true,
    stopOnSignals: false,
    debounce: debounceMs,
    maxDebounce: maxDebounceMs,
    // A single message bigger than any allowed document closes the socket before it is read.
    websocketOptions: { maxPayload: maxBytes + 1024 * 1024 },

    onAuthenticate: hook(({ requestHeaders, requestParameters, documentName, connectionConfig }) => {
      const { context, readOnly } = admit(requestHeaders, requestParameters, documentName)
      connectionConfig.readOnly = readOnly
      return context
    }),

    // The server's version, for the editor's reload banner.
    connected: hook(({ connection, documentName }) => {
      const entry = loaded.get(documentName)
      if (entry) {
        entry.idleSince = null
      }
      const message: LiveMessage = { type: 'serverVersion', version }
      connection.sendStateless(JSON.stringify(message))
    }),

    onLoadDocument: async ({ instance, documentName }) => {
      await makeRoom(instance)
      const designId = designIdOf(documentName)
      const stored = designId === null ? null : loadDoc(designId)
      if (!stored) {
        throw new LiveRefusal('no_access')
      }
      const entry: Loaded = { idleSince: null, bytes: 0, warned: false }
      loaded.set(documentName, entry)
      noteSize(documentName, entry, stored.bytes)
      return stored.doc
    },

    // Read-only connections' changes are dropped by Hocuspocus; only writers count.
    beforeHandleMessage: hook(({ connection, documentName, document, update }) => {
      if (!connection.readOnly) {
        guardSize(documentName, document, update.byteLength, contextOf(connection).userId)
      }
    }),

    // VIEW-01: a view link's connection is nobody; its presence reaches the others empty.
    beforeHandleAwareness: hook(({ context, states }) => {
      if (context?.viewLinkId) {
        for (const clientId of states.keys()) {
          states.set(clientId, {})
        }
      }
    }),

    onStoreDocument: hook(({ documentName, document, lastContext }) => {
      const designId = designIdOf(documentName)
      const entry = loaded.get(documentName)
      if (designId !== null) {
        const bytes = saveDoc(designId, document, (lastContext as Partial<LiveContext>).userId ?? undefined)
        if (entry) {
          noteSize(documentName, entry, bytes)
        }
      }
    }),

    onDisconnect: async ({ instance, document, documentName, clientsCount }) => {
      const entry = loaded.get(documentName)
      if (entry && clientsCount === 0) {
        entry.idleSince = Date.now()
      }
      await afterEditorsLeft(instance, document)
    },

    beforeUnloadDocument: hook(({ documentName }) => {
      if (!closing && !releasing.has(documentName)) {
        throw new LiveRefusal('kept')
      }
    }),

    afterUnloadDocument: hook(({ documentName }) => {
      loaded.delete(documentName)
    }),
  })
}

// Saves every document and closes every connection before the database closes; the editors keep
// their changes in the browser and connect again to the next start.
async function closeLive(instance: Hocuspocus): Promise<void> {
  closing = true
  instance.closeConnections()
  instance.flushPendingStores()
  for (const socket of sockets) {
    socket.destroy()
  }
  await Promise.all([...instance.documents.values()].map((document) => document.saveMutex.waitForUnlock()))
}

// Attaches live editing to the app's HTTP server: the upgrades of `<base>live` (any other upgrade
// gets the empty page of src/basePath.ts), the access listener, the sweep, and the shutdown before
// the database closes.
export function attachLive(app: FastifyInstance, config: Config): void {
  const server = createServer()
  live = server
  const instance = server.hocuspocus
  const origins = siteOrigins(config)
  const livePath = livePathOf(config.basePath)
  hidePresenceFromViews(instance)

  app.server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    // The HTTP server no longer listens for errors on an upgraded socket.
    socket.on('error', () => {
      socket.destroy()
    })
    // On Windows only the helper's front may reach the app (src/front.ts).
    if (!fromFront(request, config.proxySecret)) {
      socket.end(notFromFrontResponse)
      return
    }
    if (!livePath.test(request.url ?? '')) {
      socket.end(emptyPageResponse)
      return
    }
    let refusal: string | null
    try {
      refusal = upgradeRefusal(request.headers, request.url, origins)
    } catch (error) {
      log.error({ err: error, url: request.url }, 'a live upgrade failed')
      refusal = '500 Internal Server Error'
    }
    if (refusal !== null || closing) {
      socket.end(`HTTP/1.1 ${refusal ?? '503 Service Unavailable'}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
      return
    }
    sockets.add(socket)
    socket.once('close', () => {
      sockets.delete(socket)
    })
    // Hocuspocus's own HTTP server never listens: its upgrade handler only takes the socket over.
    server.httpServer.emit('upgrade', request, socket, head)
  })

  const stopListening = onUserAccessChanged((change) => {
    for (const connection of connectionsOf(instance, change.userId, change.designId)) {
      recheck(connection)
    }
  })

  const timer = setInterval(() => {
    sweep(instance).catch((error: unknown) => {
      log.error({ err: error }, 'the live sweep failed')
    })
  }, sweepMs)
  timer.unref()

  app.addHook('preClose', async () => {
    clearInterval(timer)
    stopListening()
    await closeLive(instance)
  })
}

// VIEW-01: checks every connection of a design again (a revoked view link closes its pages).
export function recheckDesign(designId: string): void {
  for (const connection of live?.hocuspocus.documents.get(docNameOf(designId))?.getConnections() ?? []) {
    recheck(connection)
  }
}

// Sends a message to everyone who has the design open.
export function sendToDesign(designId: string, message: LiveMessage): void {
  live?.hocuspocus.documents.get(docNameOf(designId))?.broadcastStateless(JSON.stringify(message))
}

// AUTH-02's rename writes meta.name into the stored document; an open document (or one still
// loading) gets it too, or its next save would bring the old name back.
export function renameLiveDesign(designId: string, name: string, userId: string): void {
  if (!live) {
    return
  }
  const rename = (document: Y.Doc): void => {
    const meta = document.getMap('meta')
    if (meta.get('name') !== name) {
      // Saved like an edit by the person who renamed it.
      document.transact(
        () => {
          meta.set('name', name)
        },
        { source: 'local', context: { userId } },
      )
    }
  }
  const documentName = docNameOf(designId)
  const document = live.hocuspocus.documents.get(documentName)
  if (document) {
    rename(document)
  }
  live.hocuspocus.loadingDocuments.get(documentName)?.then(rename, () => undefined)
}

// HIST-01: saves an open document's pending changes now, so the stored state is the design as it
// is ("Name this version").
export async function flushLiveDesign(designId: string): Promise<void> {
  const instance = live?.hocuspocus
  const document = instance?.documents.get(docNameOf(designId))
  if (instance && document) {
    await flush(instance, document)
  }
}

// The loaded document of a design once it is neither loading nor unloading, or null.
async function settledDocument(instance: Hocuspocus, documentName: string): Promise<Document | null> {
  for (;;) {
    const busy = instance.loadingDocuments.get(documentName) ?? instance.unloadingDocuments.get(documentName)
    if (!busy) {
      return instance.documents.get(documentName) ?? null
    }
    await busy.catch(() => undefined)
  }
}

// What a restore brings back (HIST-01).
export interface Restore {
  // The version's state, and its name for the restore's own version.
  state: Uint8Array
  versionName: string | null
  // The design's name now, which the restored document keeps.
  designName: string
  userId: string
}

// The design is not loaded: the same change on the stored document, all synchronous, so no load
// starts meanwhile.
function restoreStored(designId: string, restore: Restore): string | null {
  const stored = loadDoc(designId)
  if (!stored) {
    throw new Error('The design has no document.')
  }
  const { update, bytes } = restoreUpdate(stored.doc, restore.state, restore.designName)
  if (bytes > maxBytes) {
    return null
  }
  const before = addVersionOf(designId, stored.doc, 'before_restore', null, restore.userId)
  Y.applyUpdate(stored.doc, update)
  saveDoc(designId, stored.doc, restore.userId)
  addVersionOf(designId, stored.doc, 'restore', restore.versionName, restore.userId)
  return before
}

// "Restore this version" (docs/plan/05 section 7 item 5): a "Before restore" version of now, then
// the version's content as one Yjs change by the person, on the open document when the design is
// loaded (Hocuspocus sends it to everyone and it is saved at once), else on the stored one; then a
// restore version of the result. Being a change, it merges with offline copies and can be undone
// by restoring "Before restore". Returns the "Before restore" version's ID, or null when the
// result would be over maxBytes.
export async function restoreLiveDesign(designId: string, restore: Restore): Promise<string | null> {
  const instance = live?.hocuspocus
  const documentName = docNameOf(designId)
  let document = instance ? await settledDocument(instance, documentName) : null
  if (instance && document) {
    // Saved first, so the "Before restore" version's doc_version is its state's; then looked up
    // again, as the document may have gone meanwhile.
    await flush(instance, document)
    document = await settledDocument(instance, documentName)
  }
  if (!instance || !document) {
    return restoreStored(designId, restore)
  }
  const { update, bytes } = restoreUpdate(document, restore.state, restore.designName)
  if (bytes > maxBytes) {
    return null
  }
  const before = addVersionOf(designId, document, 'before_restore', null, restore.userId)
  Y.applyUpdate(document, update, { source: 'local', context: { userId: restore.userId } })
  const entry = loaded.get(documentName)
  if (entry) {
    noteSize(documentName, entry, bytes)
  }
  await flush(instance, document)
  addVersionOf(designId, document, 'restore', restore.versionName, restore.userId)
  return before
}

// Runs `change` on a document; true when it changed something.
function changes<T>(doc: Y.Doc, change: (doc: Y.Doc) => T): { value: T; changed: boolean } {
  let updates = 0
  doc.on('update', () => {
    updates++
  })
  const value = change(doc)
  return { value, changed: updates > 0 }
}

// The design is not loaded: the change on the stored document, all synchronous, so no load starts
// meanwhile; saved only when it changed something.
function editStored<T>(designId: string, userId: string, change: (doc: Y.Doc) => T): { value: T } | null {
  const stored = loadDoc(designId)
  if (!stored) {
    throw new Error('The design has no document.')
  }
  const { value, changed } = changes(stored.doc, change)
  if (changed) {
    if (encodeDoc(stored.doc).byteLength > maxBytes) {
      return null
    }
    saveDoc(designId, stored.doc, userId)
    versionOnLeave(designId)
  }
  return { value }
}

// MCP-02a: a change by a person from outside the editor (Claude's design edits, docs/plan/17
// section 13.3). `change` edits a copy of the design's document synchronously (a throw changes
// nothing); the difference is then one Yjs change by the person, on the open document when the
// design is loaded (Hocuspocus sends it to everyone at once, it is saved now and refused over
// maxBytes as an editor's message is), else on the stored one. Versions follow as for an editor
// who leaves after the change. Returns what `change` returned, or null when the change would take
// the design over maxBytes.
export async function editDesignAs<T>(
  designId: string,
  userId: string,
  change: (doc: Y.Doc) => T,
): Promise<{ value: T } | null> {
  const instance = live?.hocuspocus
  const documentName = docNameOf(designId)
  const document = instance ? await settledDocument(instance, documentName) : null
  if (!instance || !document) {
    return editStored(designId, userId, change)
  }
  const copy = new Y.Doc()
  Y.applyUpdate(copy, Y.encodeStateAsUpdate(document))
  const { value, changed } = changes(copy, change)
  if (!changed) {
    return { value }
  }
  const update = Y.encodeStateAsUpdate(copy, Y.encodeStateVector(document))
  try {
    guardSize(documentName, document, update.byteLength, userId)
  } catch (error) {
    if (error instanceof LiveRefusal) {
      return null
    }
    throw error
  }
  Y.applyUpdate(document, update, { source: 'local', context: { userId } })
  await flush(instance, document)
  await afterEditorsLeft(instance, document)
  return { value }
}
