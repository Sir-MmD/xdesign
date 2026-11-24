package install

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"maps"
	"slices"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// StatePath is the installer state file, root:root 0644.
const StatePath = platform.StatePath

// Installation states in [State].Status.
const (
	// StateInstalling means an installation started and has not finished; the next
	// run continues it.
	StateInstalling = "installing"
	// StateInstalled means the last installation, update or repair finished.
	StateInstalled = "installed"
	// StateUninstalled means xdesign --uninstall removed the program and kept the
	// data; the installer then treats the data as existing.
	StateUninstalled = "uninstalled"
)

// History actions in [HistoryEntry].Action.
const (
	ActionInstall   = "install"
	ActionRepair    = "repair"
	ActionUpdate    = "update"
	ActionRollback  = "rollback"
	ActionUninstall = "uninstall"
	// ActionSetPort and ActionSetPath move the site to another port or web base path
	// (address.go); the entry's Change says from what to what.
	ActionSetPort = "set-port"
	ActionSetPath = "set-path"
)

// Results of a failed run in [HistoryEntry].Result.
const (
	// ResultRolledBack: the update failed and xDesign went back to the version it
	// came from, or a set-port or set-path failed and xDesign went back to the settings
	// from before.
	ResultRolledBack = "rolled_back"
	// ResultFailed: the run failed. An update or a rollback that failed after it stopped
	// xDesign and could not go back left xDesign stopped; every other run that failed (an
	// installation, a repair, an update before it stopped xDesign, a rollback that started
	// the release that ran before again, an uninstall) left things as its failed step
	// found them.
	ResultFailed = "failed"
)

// State is the content of install.json: what the installer did, so later runs, the
// updater and the uninstaller only touch what xDesign created.
type State struct {
	Status         string         `json:"status"`
	CurrentVersion string         `json:"current_version"`
	History        []HistoryEntry `json:"history"`
	OS             StateOS        `json:"os"`
	SELinux        StateSELinux   `json:"selinux"`
	// HTTPS and Firewall record what the installer set up for HTTPS and the firewall
	// (https.go, firewall.go), so the uninstaller (uninstall.go) undoes only that.
	HTTPS    StateHTTPS    `json:"https"`
	Firewall StateFirewall `json:"firewall"`
	// Services are the Windows services the installer made (services_windows.go), so the
	// uninstaller removes them; Linux finds its units in /etc/systemd/system instead.
	Services []string `json:"services,omitempty"`
	// AppsEntry is the entry in Windows' list of installed apps that the installer wrote
	// (apps_windows.go: HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\xDesign),
	// which the uninstaller removes; left out on Linux.
	AppsEntry string `json:"apps_entry,omitempty"`
	// LastStep is the ID of the step an unfinished installation ("status":
	// "installing") ran last, so the next run says where it stopped; WriteState leaves it
	// out of every other status.
	LastStep string `json:"last_step,omitempty"`

	// extra keeps top-level keys this version does not know, so a file that was rolled
	// back does not drop what a newer one recorded.
	extra map[string]json.RawMessage
}

// HistoryEntry is one installation, update, rollback, repair, uninstall, set-port or
// set-path, done or failed.
type HistoryEntry struct {
	// At is the time in RFC 3339 UTC.
	At      string `json:"at"`
	Action  string `json:"action"`
	From    string `json:"from,omitempty"`
	Version string `json:"version"`
	Backup  string `json:"backup,omitempty"`
	// Change is what a set-port or set-path changed: "port 34567 to 40000".
	Change string `json:"change,omitempty"`
	// Result is empty when the action succeeded, otherwise ResultRolledBack or
	// ResultFailed.
	Result string `json:"result,omitempty"`
	// Family is the family of the system the run ran on (distro.go: "debian" or "rhel"),
	// and Steps are the times of its steps in the order they ran, so later releases can
	// tune the expected times of weights.go from real runs.
	Family string     `json:"family,omitempty"`
	Steps  []StepTime `json:"steps,omitempty"`
}

// StepTime is the time one step of a run took, against the time weights.go expects it to
// take when it does its work on the run's family.
type StepTime struct {
	// ID is the step's ID ("program-files"); Status is how it ended: "done", "skipped" or
	// "failed".
	ID     string `json:"id"`
	Status string `json:"status"`
	// ExpectedMS is the expected time and TookMS the real one, in milliseconds.
	ExpectedMS int64 `json:"expected_ms"`
	TookMS     int64 `json:"took_ms"`
	// Title is the step's words as the run showed them ("Program files").
	Title string `json:"title,omitempty"`
}

// withTimes returns e with the family and the step times of the run's plan; a nil plan (a
// dry run) leaves them out.
func (e HistoryEntry) withTimes(p *Plan) HistoryEntry {
	e.Family, e.Steps = p.Times()
	return e
}

// Installs reports whether e put its version in place: an installation, a repair, an
// update or a rollback that did not fail (not an uninstall, a set-port or a set-path).
func (e HistoryEntry) Installs() bool {
	return e.Result == "" && slices.Contains([]string{ActionInstall, ActionRepair, ActionUpdate, ActionRollback}, e.Action)
}

// appendHistory adds e, the entry of a run that failed, to the history of install.json as
// the file has it now: the failed run changes nothing else in the
// file, as before it recorded itself. Without install.json (a removal deleted it) it does
// nothing.
func appendHistory(fsys host.FS, e HistoryEntry) error {
	st, found, err := ReadState(fsys)
	if err != nil || !found {
		return err
	}
	st.History = append(st.History, e)
	return WriteState(fsys, st)
}

// StateOS records the operating system of the installation.
type StateOS struct {
	ID        string `json:"id"`
	VersionID string `json:"version_id"`
	Arch      string `json:"arch"`
}

// StateSELinux records SELinux handling (system.go, selinux.go).
type StateSELinux struct {
	Enabled       bool `json:"enabled"`
	ChconFallback bool `json:"chcon_fallback"`
	// PortsAdded are the TCP ports the installer labeled http_port_t with semanage port -a,
	// PortsModified those it moved there from another type with semanage port -m.
	PortsAdded    []int `json:"http_ports_added,omitempty"`
	PortsModified []int `json:"http_ports_modified,omitempty"`
}

// StateHTTPS records the HTTPS the installer set up (docs/plan/07-server-install-
// update.md section 4).
type StateHTTPS struct {
	// Port80 reports that xDesign opens port 80 for Let's Encrypt's challenges (port 80
	// was free), so its unit keeps CAP_NET_BIND_SERVICE.
	Port80 bool `json:"port_80,omitempty"`
	// StateFile is the HTTPS manager's state file the installer wrote with the first
	// method.
	StateFile string `json:"state_file,omitempty"`
}

// StateFirewall records the ports the installer opened (firewall.go), so the uninstaller
// removes only rules xDesign created.
type StateFirewall struct {
	// Tool is ufw, firewalld or windows-firewall; empty when no port was opened.
	Tool  string `json:"tool,omitempty"`
	Ports []int  `json:"ports,omitempty"`
}

// stateAlias has the fields of State without its methods, for the JSON encoder.
type stateAlias State

// UnmarshalJSON reads install.json, keeping unknown top-level keys.
func (s *State) UnmarshalJSON(data []byte) error {
	var all map[string]json.RawMessage
	if err := json.Unmarshal(data, &all); err != nil {
		return fmt.Errorf("read install.json: %w", err)
	}
	var a stateAlias
	if err := json.Unmarshal(data, &a); err != nil {
		return fmt.Errorf("read install.json: %w", err)
	}
	*s = State(a)
	for _, k := range knownStateKeys() {
		delete(all, k)
	}
	if len(all) > 0 {
		s.extra = all
	}
	return nil
}

// MarshalJSON writes install.json with the unknown keys that were read.
func (s *State) MarshalJSON() ([]byte, error) {
	a := stateAlias(*s)
	if a.History == nil {
		a.History = []HistoryEntry{}
	}
	known, err := json.Marshal(a)
	if err != nil || len(s.extra) == 0 {
		return known, wrapJSON(err)
	}
	var all map[string]json.RawMessage
	if err := json.Unmarshal(known, &all); err != nil {
		return nil, wrapJSON(err)
	}
	maps.Copy(all, s.extra)
	// Keep the order of the known keys, then the others sorted.
	var b bytes.Buffer
	b.WriteByte('{')
	keys := knownStateKeys()
	for _, k := range slices.Sorted(maps.Keys(s.extra)) {
		if !slices.Contains(keys, k) {
			keys = append(keys, k)
		}
	}
	first := true
	for _, k := range keys {
		value, ok := all[k]
		if !ok {
			continue // a known key left out when empty (last_step)
		}
		if !first {
			b.WriteByte(',')
		}
		first = false
		name, err := json.Marshal(k)
		if err != nil {
			return nil, wrapJSON(err)
		}
		b.Write(name)
		b.WriteByte(':')
		b.Write(value)
	}
	b.WriteByte('}')
	return b.Bytes(), nil
}

func wrapJSON(err error) error {
	if err != nil {
		return fmt.Errorf("write install.json: %w", err)
	}
	return nil
}

func knownStateKeys() []string {
	return []string{
		"status", "current_version", "history", "os", "selinux", "https", "firewall", "services", "apps_entry", "last_step",
	}
}

// ReadState reads install.json. found is false when the file does not exist.
func ReadState(fsys host.FS) (st State, found bool, err error) {
	data, err := fsys.ReadFile(StatePath)
	if errors.Is(err, fs.ErrNotExist) {
		return State{}, false, nil
	}
	if err != nil {
		return State{}, false, fmt.Errorf("read %s: %w", StatePath, err)
	}
	if err := json.Unmarshal(data, &st); err != nil {
		return State{}, false, fmt.Errorf("%s is damaged (%w); move it away and run the installer again", StatePath, err)
	}
	return st, true, nil
}

// WriteState writes install.json atomically, root:root 0644. The folder /etc/xdesign
// is created root:root 0750 when it does not exist yet (makeConfigDir); step 3 gives it
// its group. The step an unfinished installation stopped in is kept only while the
// status is "installing".
func WriteState(fsys host.FS, st State) error {
	if st.Status != StateInstalling {
		st.LastStep = ""
	}
	data, err := json.MarshalIndent(&st, "", "  ")
	if err != nil {
		return fmt.Errorf("write %s: %w", StatePath, err)
	}
	if _, err := fsys.Stat(etcDir); errors.Is(err, fs.ErrNotExist) {
		if err := makeConfigDir(fsys); err != nil {
			return fmt.Errorf("write %s: %w", StatePath, err)
		}
	}
	if err := fsys.WriteFile(StatePath, append(data, '\n'), 0o644, host.Root()); err != nil {
		return fmt.Errorf("write %s: %w", StatePath, err)
	}
	return nil
}
