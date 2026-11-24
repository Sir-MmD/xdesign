import { createFileRoute } from '@tanstack/react-router'
import { type PreviewTheme, type SkinId, telegramLooks } from '@xdesign/preview'
import { z } from 'zod'

import { signedInGuard } from '@/app/session'
import { defaultLook } from '@/export/pictures'
import { PrintPage } from '@/export/PrintPage'

// The printable page of a design (docs/plan/06 section 5), outside the signed-in shell and the
// editor, with the signed-in pages' guard. The editor's "Print" passes its phone look as `look`
// and `theme`, the look the pictures are made in.
const searchSchema = z.object({
  look: z
    .custom<SkinId>((value) => telegramLooks.some((look) => look.id === value))
    .optional()
    .catch(undefined),
  theme: z
    .custom<PreviewTheme>((value) => value === 'light' || value === 'dark')
    .optional()
    .catch(undefined),
})

export const Route = createFileRoute('/d/$id_/print')({
  validateSearch: searchSchema,
  beforeLoad: signedInGuard,
  component: Print,
})

function Print() {
  const { id } = Route.useParams()
  const search = Route.useSearch()
  const skin = search.look ?? defaultLook.skin
  const theme = search.theme ?? defaultLook.theme
  return <PrintPage designId={id} look={{ skin, theme }} />
}
