package release

import (
	"bufio"
	"bytes"
	"encoding/hex"
	"fmt"
	"slices"
	"strings"
)

// Files that come with a release (docs/plan/07-server-install-update.md section 2).
const (
	// SumsName lists the SHA-256 of every file of a version (the single files and their
	// tar.gz files), in sha256sum format.
	SumsName = "SHA256SUMS"
	// SigName is the optional signature of SHA256SUMS (ssh-keygen -Y sign).
	SigName = "SHA256SUMS.sig"
	// SigNamespace is the namespace of release signatures.
	SigNamespace = "xdesign-release"
)

// ManifestName is the checksum list at the top of xWriter's release archives (beside
// buildinfo.ReleaseFileName). An xDesign release is the single file, never such an archive;
// internal/unpack, copied from xWriter as it is, still tells that layout apart.
const ManifestName = "MANIFEST.sha256"

// maxSumsFileBytes bounds SHA256SUMS; the real one has a few hundred bytes.
const maxSumsFileBytes = 1 << 20

// ParseSums parses a SHA256SUMS file: "<sha256>  <file>" lines (or " *" before the
// file for binary mode). It returns the lower-case checksum of each file name.
func ParseSums(data []byte) (map[string]string, error) {
	if len(data) > maxSumsFileBytes {
		return nil, fmt.Errorf("%s is larger than %d bytes", SumsName, maxSumsFileBytes)
	}
	sums := map[string]string{}
	sc := bufio.NewScanner(bytes.NewReader(data))
	for n := 1; sc.Scan(); n++ {
		line := strings.TrimRight(sc.Text(), "\r")
		if line == "" {
			continue
		}
		if len(line) < 67 || (line[64:66] != "  " && line[64:66] != " *") {
			return nil, fmt.Errorf("%s: line %d is not \"<sha256>  <file>\"", SumsName, n)
		}
		sum := strings.ToLower(line[:64])
		if _, err := hex.DecodeString(sum); err != nil {
			return nil, fmt.Errorf("%s: line %d has no SHA-256", SumsName, n)
		}
		sums[line[66:]] = sum
	}
	if err := sc.Err(); err != nil {
		return nil, fmt.Errorf("read %s: %w", SumsName, err)
	}
	if len(sums) == 0 {
		return nil, fmt.Errorf("%s lists no files", SumsName)
	}
	return sums, nil
}

// MatchSum finds the line of SHA256SUMS (parsed by [ParseSums]) for a file called name
// whose SHA-256 is sum: the line of that name when its checksum matches, else any line
// with the same checksum, which is the same file saved under another name (the single
// file renamed to xdesign after the download). It returns the name of that line, ""
// when no line matches, and whether name has a line of its own.
func MatchSum(sums map[string]string, name, sum string) (line string, listed bool) {
	sum = strings.ToLower(sum)
	want, listed := sums[name]
	if listed && want == sum {
		return name, true
	}
	var names []string
	for n, s := range sums {
		if s == sum {
			names = append(names, n)
		}
	}
	if len(names) == 0 {
		return "", listed
	}
	slices.Sort(names)
	return names[0], listed
}

// ValidSHA256 reports whether s is 64 hexadecimal digits.
func ValidSHA256(s string) bool {
	if len(s) != 64 {
		return false
	}
	_, err := hex.DecodeString(s)
	return err == nil
}
