package install

import (
	"net/http"

	"github.com/Sir-MmD/xdesign/helper/internal/controlclient"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// controlName names the control channel in the plan of a dry run.
const controlName = "the control server of " + platform.ControlFile

// controlClient is the client of the control server: its loopback address and secret
// are in control.json while xdesign serve runs (docs/plan/18-third-owner-list-
// 2026-11-23.md section 8.2).
func controlClient() (*http.Client, error) {
	return controlclient.New(platform.ControlFile)
}
