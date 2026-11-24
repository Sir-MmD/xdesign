package control

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/maintenance"
)

// Limits of the maintenance endpoints.
const (
	// uploadReadTime bounds the upload of a new xdesign file, and checkAnswerTime its check
	// and the answer.
	uploadReadTime  = time.Hour
	checkAnswerTime = 10 * time.Minute
	// maxSHA256Field bounds the typed SHA-256 of an upload (a sha256sum line).
	maxSHA256Field = 1 << 10
	// maxRequestBody bounds the JSON body of the update, rollback and uninstall requests.
	maxRequestBody = 4 << 10
)

// maintenanceRoutes are Maintenance > Update (docs/plan/07-server-install-update.md section
// 6.2): the helper's state and work, the kept releases, the upload and its check, "Install
// and restart" and "Roll back to <version>"; and Maintenance > Uninstall xDesign
// (docs/plan/19-uninstall-2026-11-24.md section 5). Refusals answer 400 (a wrong request),
// 409 (one that cannot run now) or 413 (too large) with {"error": "<plain words>"}.
func maintenanceRoutes(opts Options) []route {
	m := opts.Maintenance
	guarded := func(h func(w http.ResponseWriter, r *http.Request)) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			if m == nil {
				writeError(w, http.StatusNotFound, noMaintenanceText)
				return
			}
			h(w, r)
		}
	}
	return []route{
		{pattern: "GET /maintenance", handler: guarded(func(w http.ResponseWriter, _ *http.Request) {
			st, err := m.Status()
			if err != nil {
				writeMaintenanceError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, st)
		})},
		{pattern: "GET /maintenance/releases", handler: guarded(func(w http.ResponseWriter, _ *http.Request) {
			rels, err := m.Releases()
			if err != nil {
				writeMaintenanceError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, rels)
		})},
		{pattern: "POST /maintenance/uploads", handler: guarded(func(w http.ResponseWriter, r *http.Request) {
			uploadAndCheck(w, r, m)
		})},
		{pattern: "GET /maintenance/uploads/{id}", handler: guarded(func(w http.ResponseWriter, r *http.Request) {
			c, err := m.Check(r.PathValue("id"))
			if err != nil {
				writeMaintenanceError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, c)
		})},
		{pattern: "DELETE /maintenance/uploads/{id}", handler: guarded(func(w http.ResponseWriter, r *http.Request) {
			if err := m.DiscardCheck(r.PathValue("id")); err != nil {
				writeMaintenanceError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, map[string]string{"discarded": r.PathValue("id")})
		})},
		{pattern: "POST /maintenance/update", handler: guarded(func(w http.ResponseWriter, r *http.Request) {
			var in struct {
				UploadID string `json:"upload_id"`
			}
			if !readBody(w, r, &in) {
				return
			}
			req, err := m.StartUpdate(r.Context(), in.UploadID)
			if err != nil {
				writeMaintenanceError(w, err)
				return
			}
			writeJSON(w, http.StatusAccepted, req)
		})},
		{pattern: "POST /maintenance/rollback", handler: guarded(func(w http.ResponseWriter, r *http.Request) {
			var in struct {
				To          string `json:"to"`
				RestoreData bool   `json:"restore_data"`
			}
			if !readBody(w, r, &in) {
				return
			}
			req, err := m.StartRollback(r.Context(), in.To, in.RestoreData)
			if err != nil {
				writeMaintenanceError(w, err)
				return
			}
			writeJSON(w, http.StatusAccepted, req)
		})},
		{pattern: "POST /maintenance/uninstall", handler: guarded(func(w http.ResponseWriter, r *http.Request) {
			var in struct {
				// KeepData has no default: a missing choice must never remove everything.
				KeepData *bool `json:"keepData"`
			}
			if !readBody(w, r, &in) {
				return
			}
			if in.KeepData == nil {
				writeError(w, http.StatusBadRequest, "Choose Keep the data or Remove everything.")
				return
			}
			req, err := m.StartUninstall(r.Context(), *in.KeepData)
			if err != nil {
				writeMaintenanceError(w, err)
				return
			}
			writeJSON(w, http.StatusAccepted, req)
		})},
	}
}

// noMaintenanceText answers the maintenance endpoints of a helper without maintenance.
const noMaintenanceText = "This xdesign serve has no maintenance."

// uploadAndCheck is POST /maintenance/uploads: a multipart form with the new xdesign file
// (or a packed file that holds it), SHA256SUMS and SHA256SUMS.sig under "files" and an
// optional "sha256", streamed into maintenance/uploads/<id>/ and checked (xWriter's upload
// protocol). It answers the check, with "refusal" when the file cannot be installed.
func uploadAndCheck(w http.ResponseWriter, r *http.Request, m *maintenance.Updates) {
	rc := http.NewResponseController(w)
	_ = rc.SetReadDeadline(time.Now().Add(uploadReadTime)) // a writer without deadlines keeps the server's
	_ = rc.SetWriteDeadline(time.Now().Add(uploadReadTime + checkAnswerTime))
	mr, err := r.MultipartReader()
	if err != nil {
		writeError(w, http.StatusUnsupportedMediaType, "Send the new xdesign file as a multipart form.")
		return
	}
	up, err := m.BeginUpload(r.ContentLength)
	if err != nil {
		writeMaintenanceError(w, err)
		return
	}
	sha, err := readUpload(mr, up)
	if err != nil {
		up.Abort()
		writeMaintenanceError(w, err)
		return
	}
	_ = rc.SetReadDeadline(time.Time{})
	res, err := m.CheckUpload(r.Context(), up, sha)
	if err != nil {
		writeMaintenanceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

// readUpload reads the parts of the check form: the files go into the upload, the typed
// SHA-256 is returned.
func readUpload(mr *multipart.Reader, up *maintenance.Upload) (string, error) {
	sha := ""
	for {
		part, err := mr.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return "", &maintenance.RefusalError{Kind: maintenance.RefusedInvalid, Text: "The upload was cut off: " + err.Error()}
		}
		switch part.FormName() {
		case "sha256":
			data, err := io.ReadAll(io.LimitReader(part, maxSHA256Field+1))
			if err != nil || len(data) > maxSHA256Field {
				return "", &maintenance.RefusalError{Kind: maintenance.RefusedInvalid,
					Text: "Enter the 64 letters and digits sha256sum prints for the file."}
			}
			sha = string(data)
		case "files":
			if err := up.AddFile(part.FileName(), part); err != nil {
				return "", err
			}
		default:
			return "", &maintenance.RefusalError{Kind: maintenance.RefusedInvalid, Text: "Unknown field " + part.FormName() + "."}
		}
		_ = part.Close() // drained or read to its end
	}
	return sha, nil
}

// readBody decodes the JSON body of r into v strictly; it answers 400 and returns false
// when it cannot.
func readBody(w http.ResponseWriter, r *http.Request, v any) bool {
	data, err := io.ReadAll(io.LimitReader(r.Body, maxRequestBody+1))
	if err != nil || len(data) > maxRequestBody {
		writeError(w, http.StatusBadRequest, "The request body cannot be read.")
		return false
	}
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		writeError(w, http.StatusBadRequest, "The request body is not valid: "+err.Error())
		return false
	}
	return true
}

// writeMaintenanceError answers err: a refusal with its status and words, anything else
// with 500.
func writeMaintenanceError(w http.ResponseWriter, err error) {
	var refusal *maintenance.RefusalError
	if !errors.As(err, &refusal) {
		writeError(w, http.StatusInternalServerError, "The maintenance request failed: "+err.Error())
		return
	}
	status := http.StatusBadRequest
	switch refusal.Kind {
	case maintenance.RefusedInvalid:
	case maintenance.RefusedNotNow:
		status = http.StatusConflict
	case maintenance.RefusedTooLarge:
		status = http.StatusRequestEntityTooLarge
	}
	writeError(w, status, refusal.Text)
}
