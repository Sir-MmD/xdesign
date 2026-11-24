// View-only links on the live connection (VIEW-01, docs/plan/05 section 8): a link's page opens
// `/live?view=<token>` and sees its one design live, read-only and as nobody. Every awareness
// message (presence) its socket gets is emptied, so the people in the design stay unnamed while
// the messages still keep the provider's connection alive; its own awareness reaches the others
// emptied too (server.ts, beforeHandleAwareness).
import type { Hocuspocus } from '@hocuspocus/server'

// Hocuspocus's message type of an awareness update.
const awarenessType = 1

// The token of a view link's socket (`/live?view=<token>`), or null for a person's.
export function viewTokenOf(url: string | undefined): string | null {
  const query = url?.split('?')[1]
  return query === undefined ? null : new URLSearchParams(query).get('view')
}

// lib0's variable-length unsigned integer at `at` (7 bits a byte, low bits first): its value and
// where the next field starts; null when the message ends first.
function readUint(bytes: Uint8Array, at: number): [number, number] | null {
  let value = 0
  let factor = 1
  for (let i = at; i < bytes.length; i++) {
    const byte = bytes[i] ?? 0
    value += (byte & 0x7f) * factor
    if (byte < 0x80) {
      return [value, i + 1]
    }
    factor *= 128
  }
  return null
}

// An awareness message for the same document with an update that lists no clients; any other
// message as it is. A message starts with its address (a string: its length, then its bytes) and
// its type.
function withoutPresence(data: Uint8Array): Uint8Array {
  const address = readUint(data, 0)
  const type = address && readUint(data, address[1] + address[0])
  if (!type || type[0] !== awarenessType) {
    return data
  }
  const empty = new Uint8Array(type[1] + 2)
  empty.set(data.subarray(0, type[1]))
  // The update's length (1 byte), then its number of clients (0).
  empty[type[1]] = 1
  empty[type[1] + 1] = 0
  return empty
}

// Wraps Hocuspocus's handleConnection once: the socket of a view link sends no presence.
export function hidePresenceFromViews(instance: Hocuspocus): void {
  const handle = instance.handleConnection.bind(instance)
  instance.handleConnection = (incoming, request, context) => {
    if (viewTokenOf(request.url) !== null) {
      const send = incoming.send.bind(incoming)
      incoming.send = (data: Parameters<typeof send>[0]) => {
        send(data instanceof Uint8Array ? withoutPresence(data) : data)
      }
    }
    return handle(incoming, request, context)
  }
}
