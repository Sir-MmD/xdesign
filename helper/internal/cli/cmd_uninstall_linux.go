package cli

import (
	"flag"

	"github.com/Sir-MmD/xdesign/helper/internal/install"
)

const uninstallUsage = `Usage: sudo xdesign --uninstall [flags]

Removes xDesign from this server (docs/plan/07-server-install-update.md section 7). It asks
first: "Keep the data" or "Remove everything", and offers a backup.

Keep the data: the program, its services and the firewall rules the installer made are
removed. /etc/xdesign and /var/lib/xdesign (the database, the media, the backups and the certificates) stay with the
xdesign user, so sudo ./xdesign --install picks everything up again later.

Remove everything: the data, the settings and the xdesign user are deleted too, after a
final backup in /root/xdesign-final-<time>/ when you want one. The SELinux settings the
installer made are undone only when you say so.

Flags:
  --keep-data          keep the data, without the question
  --remove-everything  remove everything, without the question
  --backup             make a backup first, without the question
  --no-backup          make no backup first
  --undo-selinux       also undo the SELinux settings the installer made
  --yes                ask nothing (needs --keep-data or --remove-everything; a backup is
                       made unless --no-backup)
  --json               progress as JSON lines on standard error, one result object on
                       standard output (needs --yes)
  --dry-run            show what would be removed; change nothing
  --no-color           no colors (also NO_COLOR=1)
  --log FILE           log file (default /var/log/xdesign-install.log)
`

// uninstallAsAdministrator reports false on Linux: sudo runs the uninstall in a terminal.
func uninstallAsAdministrator(*Env, []string) (code int, ok bool) {
	return 0, false
}

// uninstallSystemFlags adds the flags only Linux has: --undo-selinux.
func uninstallSystemFlags(fs *flag.FlagSet, o *install.UninstallOptions) {
	fs.BoolVar(&o.UndoSELinux, "undo-selinux", false, "")
}
