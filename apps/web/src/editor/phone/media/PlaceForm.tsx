import type { Content, StepId } from '@xdesign/spec'
import { useId, useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { useUpdateContent } from '../message'
import { NumberInput } from '../NumberInput'
import { placeFromLink } from './mapLink'

type PlaceContent = Extract<Content, { type: 'location' | 'venue' }>

/**
 * A location's or a venue's fields (04 section 5.4): latitude and longitude, typed or taken from
 * a pasted Google, Apple or OpenStreetMap link; a venue's name and address.
 */
export function PlaceForm({ stepId, content }: { stepId: StepId; content: PlaceContent }) {
  const update = useUpdateContent(stepId)
  const ids = { latitude: useId(), longitude: useId(), link: useId(), title: useId(), address: useId() }
  const [link, setLink] = useState('')
  const linkFound = link.trim() === '' ? undefined : placeFromLink(link) !== undefined
  const setPlace = (place: { latitude?: number; longitude?: number }) => {
    update((now) => (now.type === 'location' || now.type === 'venue' ? { ...now, ...place } : undefined))
  }
  const setVenue = (fields: { title?: string; address?: string }) => {
    update((now) => (now.type === 'venue' ? { ...now, ...fields } : undefined))
  }

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor={ids.latitude}>Latitude</Label>
          <NumberInput
            id={ids.latitude}
            value={content.latitude}
            min={-90}
            max={90}
            onCommit={(latitude) => {
              setPlace({ latitude })
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={ids.longitude}>Longitude</Label>
          <NumberInput
            id={ids.longitude}
            value={content.longitude}
            min={-180}
            max={180}
            onCommit={(longitude) => {
              setPlace({ longitude })
            }}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={ids.link}>Paste a map link</Label>
        <Input
          id={ids.link}
          value={link}
          dir="ltr"
          placeholder="Google Maps, Apple Maps or OpenStreetMap"
          aria-invalid={linkFound === false}
          onChange={(event) => {
            const text = event.target.value
            setLink(text)
            const place = placeFromLink(text)
            if (place) setPlace(place)
          }}
        />
        {linkFound === true ? (
          <p className="text-footnote text-fg-2">The coordinates are taken from the link.</p>
        ) : linkFound === false ? (
          <p className="text-footnote text-error">
            This link has no coordinates. Open it, then copy the address from the browser.
          </p>
        ) : null}
      </div>
      {content.type === 'venue' ? (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor={ids.title}>Name</Label>
            <Input
              id={ids.title}
              value={content.title}
              onChange={(event) => {
                setVenue({ title: event.target.value })
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={ids.address}>Address</Label>
            <Input
              id={ids.address}
              value={content.address}
              onChange={(event) => {
                setVenue({ address: event.target.value })
              }}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
