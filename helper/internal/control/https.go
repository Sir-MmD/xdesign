package control

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/Sir-MmD/xdesign/helper/internal/ssl"
)

// Limits of the HTTPS requests.
const (
	// maxChoiceBody bounds PUT /https: names, a token and two paths.
	maxChoiceBody = 16 << 10
	// maxUploadBody bounds POST /https/certificate: a chain of at most 64 KiB and a key
	// of at most 16 KiB as JSON strings.
	maxUploadBody = 192 << 10
)

// maxDomainBody bounds PUT /https/domain.
const maxDomainBody = 1 << 10

// HTTPS is the HTTPS manager (internal/ssl.Manager) of the site and of `serve --dev`.
type HTTPS interface {
	// View returns what Settings > HTTPS shows.
	View() ssl.View
	// Choose puts a method in use; the error is a *ssl.RequestError.
	Choose(c ssl.Choice) (ssl.View, error)
	// Upload puts a pasted certificate in use; the error is a *ssl.RequestError.
	Upload(certPEM, keyPEM []byte) (ssl.View, error)
	// IssueNow is "Try now"; the error is a *ssl.RequestError.
	IssueNow() (ssl.View, error)
}

// uploadBody is the body of POST /https/certificate: the certificate chain and its
// private key as PEM text, pasted or read from the files the owner chose.
type uploadBody struct {
	Certificate string `json:"certificate"`
	PrivateKey  string `json:"private_key"`
}

func httpsRoutes(opts Options) []route {
	return []route{
		{pattern: "GET /https", handler: func(w http.ResponseWriter, _ *http.Request) {
			writeView(w, opts, opts.HTTPS.View(), nil)
		}},
		// The domain (section 4.4: a domain added later): the root helper writes
		// config.toml, keeping the port, and restarts xDesign; GET /maintenance follows it.
		{pattern: "PUT /https/domain", handler: func(w http.ResponseWriter, r *http.Request) {
			if opts.Maintenance == nil {
				writeError(w, http.StatusNotFound, noMaintenanceText)
				return
			}
			var body struct {
				Domain string `json:"domain"`
			}
			if !readJSON(w, r, maxDomainBody, &body) {
				return
			}
			req, err := opts.Maintenance.StartDomain(r.Context(), body.Domain)
			if err != nil {
				writeMaintenanceError(w, err)
				return
			}
			writeJSON(w, http.StatusAccepted, req)
		}},
		{pattern: "PUT /https", handler: func(w http.ResponseWriter, r *http.Request) {
			var c ssl.Choice
			if !readJSON(w, r, maxChoiceBody, &c) {
				return
			}
			v, err := opts.HTTPS.Choose(c)
			writeView(w, opts, v, err)
		}},
		{pattern: "POST /https/certificate", handler: func(w http.ResponseWriter, r *http.Request) {
			var body uploadBody
			if !readJSON(w, r, maxUploadBody, &body) {
				return
			}
			v, err := opts.HTTPS.Upload([]byte(body.Certificate), []byte(body.PrivateKey))
			writeView(w, opts, v, err)
		}},
		{pattern: "POST /https/issue", handler: func(w http.ResponseWriter, _ *http.Request) {
			v, err := opts.HTTPS.IssueNow()
			writeView(w, opts, v, err)
		}},
	}
}

// writeView answers the view with the mode, or err in plain words: 400 for a wrong
// request, 409 for one that cannot run now, 500 for a failure of the helper.
func writeView(w http.ResponseWriter, opts Options, v ssl.View, err error) {
	if err != nil {
		if rerr, ok := errors.AsType[*ssl.RequestError](err); ok {
			status := http.StatusBadRequest
			if rerr.Conflict {
				status = http.StatusConflict
			}
			writeError(w, status, rerr.Message)
			return
		}
		writeError(w, http.StatusInternalServerError, "The change could not be saved: "+err.Error())
		return
	}
	v.Mode = opts.Mode
	writeJSON(w, http.StatusOK, v)
}

// readJSON decodes the request's JSON body of at most limit bytes into v, refusing
// unknown fields, and answers 400 when it cannot.
func readJSON(w http.ResponseWriter, r *http.Request, limit int64, v any) bool {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, limit))
	dec.DisallowUnknownFields()
	err := dec.Decode(v)
	if err == nil && dec.More() {
		err = errors.New("more than one JSON value")
	}
	if err == nil {
		return true
	}
	msg := "The request is not valid JSON: " + err.Error() + "."
	switch {
	case errors.Is(err, io.EOF):
		msg = "The request has no body: send the fields as JSON."
	case isTooLarge(err):
		msg = fmt.Sprintf("The request is larger than %d KiB.", limit>>10)
	}
	writeError(w, http.StatusBadRequest, msg)
	return false
}

func isTooLarge(err error) bool {
	_, ok := errors.AsType[*http.MaxBytesError](err)
	return ok
}
