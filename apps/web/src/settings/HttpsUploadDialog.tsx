import { useQueryClient } from '@tanstack/react-query'
import { type HttpsView, routes } from '@xdesign/api'
import { CircleAlertIcon, CircleCheckIcon, FileUpIcon, InfoIcon, TriangleAlertIcon } from 'lucide-react'
import { useId, useRef, useState } from 'react'

import { apiKey, call, isApiError } from '@/api/client'
import { TextField } from '@/components/forms'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useConfirmItsYou } from '@/components/useConfirmItsYou'
import { formatDate } from '@/lib/time'
import { cn } from '@/lib/utils'
import { covers, issuerName, message, withView } from '@/settings/httpsFacts'

// The Upload window of Settings > HTTPS (docs/plan/18 section 7.3), xmtp-panel's
// (web/src/components/UploadCertDialog.tsx) with a second tab: "Paste or load file" sends the
// full chain and its key as PEM text (a text area with "Load file..." and a dropped file, a key
// pasted into the certificate's field taken from there); "Files on this server" chooses the file
// method with the paths. The answer shows what was stored, what was left out of the bundle, and
// whether the certificate is self-signed or misses the site's domain.

type Tab = 'paste' | 'files'

/** The PEM blocks in a text, by kind (a combined file holds both). */
function pemBlocks(text: string): { certs: string[]; keys: string[] } {
  const certs: string[] = []
  const keys: string[] = []
  for (const block of text.matchAll(/-----BEGIN ([A-Z0-9 ]+)-----[\s\S]*?-----END \1-----/g)) {
    if (block[1] === 'CERTIFICATE') certs.push(block[0])
    else if (block[1]?.endsWith('PRIVATE KEY')) keys.push(block[0])
  }
  return { certs, keys }
}

/** A file larger than this is no PEM certificate or key. */
const maxFileBytes = 256 * 1024

/** Why the helper left a certificate of the bundle out (its DroppedRoot, DroppedUnrelated and DroppedSuperseded). */
const leftOutReasons: Readonly<Record<string, string>> = {
  root: 'a root certificate: browsers carry their own',
  unrelated: "not part of this certificate's chain, and sending it would link that site to this one",
  superseded: 'another certificate for the same key, older or not valid now',
}

/** What the window stored, for its answer. */
interface Stored {
  view: HttpsView
  /** An earlier upload was replaced. */
  replaced: boolean
}

// "Files on this server": the examples and the hint per system (18 section 8.4). certbot has no
// Windows release, so the Windows hint names no program. The Windows folder is the helper's
// (certs.ExampleDir).
const filesHelp = {
  linux: {
    cert: '/etc/letsencrypt/live/design.example.com/fullchain.pem',
    key: '/etc/letsencrypt/live/design.example.com/privkey.pem',
    description:
      'The xdesign user must be able to read both files. xDesign reads them again every minute, so a renewal by certbot is picked up.',
  },
  windows: {
    cert: 'C:\\Certificates\\design.example.com\\fullchain.pem',
    key: 'C:\\Certificates\\design.example.com\\privkey.pem',
    description:
      'The xDesign service must be able to read both files. xDesign reads them again every minute, so a renewal is picked up.',
  },
}

export function HttpsUploadDialog({
  open,
  onOpenChange,
  view,
  system,
  domain,
  replace,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  view: HttpsView
  /** The server's system: "Files on this server" shows Windows paths on Windows. */
  system: 'linux' | 'windows'
  /** The site's domain, which the answer says the certificate does not cover. */
  domain: string | undefined
  /** "Replace": the uploaded certificate is replaced. */
  replace: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {/* Mounted only while open, so each opening starts afresh. */}
        <UploadForm
          view={view}
          system={system}
          domain={domain}
          replace={replace}
          onDone={() => {
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function UploadForm({
  view,
  system,
  domain,
  replace,
  onDone,
}: {
  view: HttpsView
  system: 'linux' | 'windows'
  domain: string | undefined
  replace: boolean
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const confirm = useConfirmItsYou()
  const [tab, setTab] = useState<Tab>(!replace && view.method === 'file' ? 'files' : 'paste')
  const [certPem, setCertPem] = useState('')
  const [keyPem, setKeyPem] = useState('')
  const [certFile, setCertFile] = useState(view.certFile ?? '')
  const [keyFile, setKeyFile] = useState(view.keyFile ?? '')
  const [sending, setSending] = useState(false)
  const [refusal, setRefusal] = useState<string>()
  const [stored, setStored] = useState<Stored>()

  // A key pasted into the certificate's field is sent as the key, never as part of the certificate.
  const pasted = pemBlocks(certPem)
  const finalCert = pasted.certs.length > 0 ? pasted.certs.join('\n') : certPem
  const finalKey = keyPem.trim() !== '' ? keyPem : (pasted.keys[0] ?? '')
  const keyFromCert = keyPem.trim() === '' && pasted.keys.length > 0

  // A loaded file's blocks go where they belong: certificates to the certificate, a key to the
  // key (a combined file fills both; the other field only when it is empty).
  const place = (text: string, into: 'cert' | 'key'): string => {
    const { certs, keys } = pemBlocks(text)
    if (certs.length === 0 && keys.length === 0) {
      return 'It holds no PEM block. A .pfx, .p12 or .der file is binary: convert it to PEM first (for example with openssl).'
    }
    if (certs.length > 0 && (into === 'cert' || certPem.trim() === '')) setCertPem(certs.join('\n'))
    const key = keys[0]
    if (key !== undefined && (into === 'key' || keyPem.trim() === '')) setKeyPem(key)
    return ''
  }

  const missing =
    tab === 'paste'
      ? finalCert.trim() === '' || finalKey.trim() === ''
      : certFile.trim() === '' || keyFile.trim() === ''

  const store = async () => {
    // Whether an earlier upload is replaced, from the method before this one.
    const replaced = tab === 'paste' && view.method === 'uploaded'
    setSending(true)
    setRefusal(undefined)
    try {
      const next =
        tab === 'paste'
          ? await call(routes.pasteCertificate, { body: { certificate: finalCert, privateKey: finalKey } })
          : await call(routes.chooseHttps, { body: { method: 'file', certFile, keyFile } })
      queryClient.setQueryData(apiKey(routes.https), withView(next))
      setStored({ view: next, replaced })
    } catch (error) {
      // An ended "Confirm it's you" asks again; any other refusal shows here.
      if (isApiError(error) && error.code === 'confirm_needed') throw error
      setRefusal(message(error))
    } finally {
      setSending(false)
    }
  }

  const submitLabel = tab === 'files' ? 'Use these files' : 'Upload certificate'
  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (missing || sending) return
        void confirm.ask({ action: 'Changing HTTPS', submitLabel, reuse: true, run: store })
      }}
    >
      <DialogHeader>
        <DialogTitle>{replace ? 'Replace the certificate' : 'Upload a certificate'}</DialogTitle>
        <DialogDescription>
          A certificate you got elsewhere, with its private key. xDesign serves it and does not renew it.
        </DialogDescription>
      </DialogHeader>
      {stored ? (
        <StoredAnswer stored={stored} domain={domain} />
      ) : (
        <Tabs
          value={tab}
          onValueChange={(value: Tab) => {
            setTab(value)
            setRefusal(undefined)
          }}
        >
          <TabsList aria-label="How">
            <TabsTrigger value="paste">Paste or load file</TabsTrigger>
            <TabsTrigger value="files">Files on this server</TabsTrigger>
          </TabsList>
          <TabsContent value="paste" className="flex flex-col gap-4 pt-1">
            <PemInput
              label="Certificate (PEM, full chain)"
              placeholder={'-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'}
              hint="The certificate followed by its intermediates, in any order. Paste the text, drop a file on the field, or load one."
              value={certPem}
              onChange={setCertPem}
              onFileText={(text) => place(text, 'cert')}
              accept=".pem,.crt,.cer,.cert,.txt"
              busy={sending}
            />
            <PemInput
              label="Private key (PEM)"
              placeholder={
                keyFromCert
                  ? 'Taken from the certificate field'
                  : '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'
              }
              hint="Unencrypted (no passphrase)."
              value={keyPem}
              onChange={setKeyPem}
              onFileText={(text) => place(text, 'key')}
              accept=".key,.pem,.txt"
              busy={sending}
            />
          </TabsContent>
          <TabsContent value="files" className="flex flex-col gap-4 pt-1">
            <TextField
              label="Certificate chain (full chain)"
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              placeholder={filesHelp[system].cert}
              value={certFile}
              onChange={(event) => {
                setCertFile(event.target.value)
              }}
            />
            <TextField
              label="Private key"
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              placeholder={filesHelp[system].key}
              description={filesHelp[system].description}
              value={keyFile}
              onChange={(event) => {
                setKeyFile(event.target.value)
              }}
            />
          </TabsContent>
        </Tabs>
      )}
      {refusal ? (
        <Alert variant="destructive" role="alert">
          <CircleAlertIcon aria-hidden />
          <AlertTitle className="font-semibold">The certificate was not stored</AlertTitle>
          <AlertDescription className="[overflow-wrap:anywhere]">{refusal}</AlertDescription>
        </Alert>
      ) : null}
      <DialogFooter>
        {stored ? (
          <Button type="button" onClick={onDone}>
            Done
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" disabled={sending} onClick={onDone}>
              Cancel
            </Button>
            <Button type="submit" disabled={missing || sending} pending={sending}>
              {submitLabel}
            </Button>
          </>
        )}
      </DialogFooter>
      {confirm.dialog}
    </form>
  )
}

/** What was stored, in xmtp-panel's words, with what was left out and the warnings. */
function StoredAnswer({ stored, domain }: { stored: Stored; domain: string | undefined }) {
  const { view, replaced } = stored
  const certificate = view.certificate
  const names = certificate.names ?? view.names
  const leftOut = view.leftOut ?? []
  return (
    <div className="flex flex-col gap-3">
      <Alert variant="ok" role="status">
        <CircleCheckIcon aria-hidden />
        <AlertTitle className="font-semibold">
          {replaced ? 'Certificate stored, replacing the earlier upload' : 'Certificate stored'}
        </AlertTitle>
        <AlertDescription className="grid gap-1 [overflow-wrap:anywhere]">
          {names.length > 0 ? (
            <p>
              Covers{' '}
              <span dir="ltr" className="font-mono">
                {names.join(', ')}
              </span>
              .
            </p>
          ) : null}
          {certificate.notAfter != null ? (
            <p>
              Issued by {certificate.issuer ? issuerName(certificate.issuer) : 'an unknown issuer'}, expires{' '}
              {formatDate(certificate.notAfter)}.
            </p>
          ) : null}
        </AlertDescription>
      </Alert>
      {leftOut.length > 0 ? (
        <Alert>
          <InfoIcon aria-hidden />
          <AlertTitle className="font-semibold">
            {leftOut.length === 1
              ? 'One certificate of the bundle was left out'
              : `${String(leftOut.length)} certificates of the bundle were left out`}
          </AlertTitle>
          <AlertDescription className="grid gap-1">
            <p>
              Only the certificate and the chain of its issuers are kept, since the site sends them in every handshake.
            </p>
            <ul className="flex list-disc flex-col gap-0.5 ps-4">
              {leftOut.map((dropped, index) => (
                <li key={`${dropped.subject}-${String(index)}`}>
                  <span dir="ltr" className="font-mono [overflow-wrap:anywhere]">
                    {dropped.subject}
                  </span>
                  : {leftOutReasons[dropped.reason] ?? dropped.reason}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
      {certificate.selfSigned ? (
        <Alert variant="warn">
          <TriangleAlertIcon aria-hidden />
          <AlertTitle className="font-semibold">Self-signed</AlertTitle>
          <AlertDescription>
            Browsers do not trust a self-signed certificate, so visitors to the site see a warning.
          </AlertDescription>
        </Alert>
      ) : null}
      {domain !== undefined && !covers(names, domain) ? (
        <Alert variant="warn">
          <TriangleAlertIcon aria-hidden />
          <AlertTitle className="font-semibold [overflow-wrap:anywhere]">It does not cover {domain}</AlertTitle>
          <AlertDescription>
            The certificate was stored, but it names neither{' '}
            <span dir="ltr" className="font-mono">
              {domain}
            </span>{' '}
            nor a wildcard covering it, so browsers warn on the site.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}

/**
 * A PEM text area with "Load file..." and a dropped file, xmtp-panel's. `onFileText` takes a
 * file's text and returns why it was not used ("" when it was).
 */
function PemInput({
  label,
  placeholder,
  hint,
  value,
  onChange,
  onFileText,
  accept,
  busy,
}: {
  label: string
  placeholder: string
  hint: string
  value: string
  onChange: (value: string) => void
  onFileText: (text: string) => string
  accept: string
  busy: boolean
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [fileError, setFileError] = useState('')
  const [dragging, setDragging] = useState(false)

  const load = async (file: File | null | undefined) => {
    if (!file) return
    if (file.size > maxFileBytes) {
      setFileError(`${file.name} is too large to be a PEM certificate or key.`)
      return
    }
    let text: string
    try {
      text = await file.text()
    } catch {
      setFileError(`${file.name} could not be read.`)
      return
    }
    const problem = onFileText(text)
    setFileError(problem ? `${file.name}: ${problem}` : '')
  }

  const invalid = fileError !== ''
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea
        id={id}
        dir="ltr"
        rows={5}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={`${id}-description${invalid ? ` ${id}-error` : ''}`}
        className={cn(
          'max-h-56 min-h-[104px] resize-y font-mono text-footnote',
          dragging && !invalid && 'border-focus',
        )}
        value={value}
        onChange={(event) => {
          setFileError('')
          onChange(event.target.value)
        }}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('Files')) {
            event.preventDefault()
            setDragging(true)
          }
        }}
        onDragLeave={() => {
          setDragging(false)
        }}
        onDrop={(event) => {
          const file = event.dataTransfer.files[0]
          if (!file) return
          event.preventDefault()
          setDragging(false)
          void load(file)
        }}
      />
      <input
        ref={input}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          void load(event.target.files?.[0])
          event.target.value = ''
        }}
      />
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => {
            input.current?.click()
          }}
        >
          <FileUpIcon aria-hidden />
          Load file...
        </Button>
      </div>
      <FieldDescription id={`${id}-description`}>{hint}</FieldDescription>
      <FieldError id={`${id}-error`}>{fileError || undefined}</FieldError>
    </Field>
  )
}
