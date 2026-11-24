import { useStore } from '@xyflow/react'

import { usePresence } from '../context'

/**
 * Other people's pointers on the map (05 section 4, item 2): an arrow in their color with their
 * name, placed from the map coordinates they publish, so it points at the same spot whatever each
 * person's view. A child of React Flow, above the boxes, letting every click through.
 */
export function PeerCursors() {
  const peers = usePresence()
  const [tx, ty, zoom] = useStore((state) => state.transform)
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-5 overflow-hidden">
      {peers.map((peer) =>
        peer.cursor ? (
          <div
            key={peer.clientId}
            style={{
              transform: `translate(${String(peer.cursor.x * zoom + tx)}px, ${String(peer.cursor.y * zoom + ty)}px)`,
            }}
            className="absolute top-0 left-0 transition-transform duration-100 ease-linear"
          >
            <svg viewBox="0 0 16 16" className="size-4 drop-shadow-sm" style={{ color: peer.user.color }}>
              <path
                d="M2 1.5 2 13.5 5.4 10.3 7.6 15 9.8 14 7.6 9.4 12.4 9.4Z"
                fill="currentColor"
                stroke="white"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
            <span
              style={{ backgroundColor: peer.user.color }}
              className="ms-3.5 block max-w-40 truncate rounded-full px-2 py-0.5 text-caption font-semibold whitespace-nowrap text-white"
            >
              {peer.user.name}
            </span>
          </div>
        ) : null,
      )}
    </div>
  )
}
