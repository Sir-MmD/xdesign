// The width and height of an uploaded image, read from its header: PNG, GIF and WebP from the
// first bytes, JPEG from its frame header further in. Video and audio take the browser's numbers.
import type { FileHandle } from 'node:fs/promises'

import type { FileType } from './detect.ts'

export interface ImageSize {
  width: number
  height: number
}

function sides(width: number, height: number): ImageSize | null {
  return width > 0 && height > 0 ? { width, height } : null
}

// The canvas of an extended WebP (VP8X), or the frame of a lossless (VP8L) or lossy (VP8) one.
function webpSize(head: Buffer): ImageSize | null {
  if (head.length < 30) {
    return null
  }
  switch (head.toString('latin1', 12, 16)) {
    case 'VP8X':
      return sides(1 + head.readUIntLE(24, 3), 1 + head.readUIntLE(27, 3))
    case 'VP8L': {
      const bits = head.readUInt32LE(21)
      return sides(1 + (bits & 0x3fff), 1 + ((bits >>> 14) & 0x3fff))
    }
    case 'VP8 ':
      return sides(head.readUInt16LE(26) & 0x3fff, head.readUInt16LE(28) & 0x3fff)
    default:
      return null
  }
}

// The start of frame markers SOF0 to SOF15, without DHT, JPG and DAC.
function isFrameMarker(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
}

// The Exif orientation of an APP1 segment's data, 1 without one.
function exifOrientation(data: Buffer): number {
  if (data.toString('latin1', 0, 6) !== 'Exif\0\0') {
    return 1
  }
  const tiff = data.subarray(6)
  const little = tiff.toString('latin1', 0, 2) === 'II'
  const read16 = (at: number) => (little ? tiff.readUInt16LE(at) : tiff.readUInt16BE(at))
  try {
    const ifd = little ? tiff.readUInt32LE(4) : tiff.readUInt32BE(4)
    const count = read16(ifd)
    for (let i = 0; i < count; i++) {
      const entry = ifd + 2 + i * 12
      if (read16(entry) === 0x0112) {
        return read16(entry + 8)
      }
    }
  } catch {
    // An entry past the end of the segment: no orientation.
  }
  return 1
}

// Walks the JPEG's segments to its frame header. An Exif orientation of 5 to 8 turns the picture a
// quarter, so the sides are swapped, as phones and browsers show it.
async function jpegSize(file: FileHandle): Promise<ImageSize | null> {
  const header = Buffer.alloc(9)
  let offset = 2
  let orientation = 1
  // A bound for damaged files.
  for (let segment = 0; segment < 500; segment++) {
    const { bytesRead } = await file.read(header, 0, header.length, offset)
    if (bytesRead < 4 || header.readUInt8(0) !== 0xff) {
      return null
    }
    const marker = header.readUInt8(1)
    // A fill byte before a marker.
    if (marker === 0xff) {
      offset += 1
      continue
    }
    // Markers without a length: TEM, RST0 to RST7 and SOI.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      offset += 2
      continue
    }
    // The end of the image or the scan, with no frame header before.
    const length = header.readUInt16BE(2)
    if (marker === 0xd9 || marker === 0xda || length < 2) {
      return null
    }
    if (isFrameMarker(marker)) {
      if (bytesRead < header.length) {
        return null
      }
      const height = header.readUInt16BE(5)
      const width = header.readUInt16BE(7)
      return orientation >= 5 && orientation <= 8 ? sides(height, width) : sides(width, height)
    }
    if (marker === 0xe1 && orientation === 1) {
      const data = Buffer.alloc(length - 2)
      await file.read(data, 0, data.length, offset + 4)
      orientation = exifOrientation(data)
    }
    offset += 2 + length
  }
  return null
}

// The sides of a JPEG, PNG, WebP or GIF; null for other types and unreadable headers. `head` is
// the start of the file (detect.ts headBytes).
export async function readImageSize(file: FileHandle, type: FileType, head: Buffer): Promise<ImageSize | null> {
  switch (type) {
    case 'image/png':
      return head.length >= 24 ? sides(head.readUInt32BE(16), head.readUInt32BE(20)) : null
    case 'image/gif':
      return head.length >= 10 ? sides(head.readUInt16LE(6), head.readUInt16LE(8)) : null
    case 'image/webp':
      return webpSize(head)
    case 'image/jpeg':
      return jpegSize(file)
    default:
      return null
  }
}
