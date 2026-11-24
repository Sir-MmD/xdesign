package unpack

import (
	"fmt"
	"strings"
	"unicode"
	"unicode/utf8"
)

// Reason says why a file was refused.
type Reason int

// The reasons for a refusal. Error.Error() has a sentence of its own for each.
const (
	// ReasonNotUpdate is a file that is none of the formats an update comes in, or a
	// compressed file that holds neither a program nor a tar archive.
	ReasonNotUpdate Reason = iota + 1
	// ReasonUnsupported is a rar, 7z or bzip2 file.
	ReasonUnsupported
	// ReasonEncrypted is a file, or an entry of it, that a password protects.
	ReasonEncrypted
	// ReasonMultiVolume is one part of an archive in several files.
	ReasonMultiVolume
	// ReasonReleaseFolder is a release folder packed again: its files may have lost their
	// modes, and the signed SHA256SUMS covers only the release archive and the program.
	ReasonReleaseFolder
	// ReasonNothing is a container with no xdesign file.
	ReasonNothing
	// ReasonSeveral is a container with several updates, none of them the one for this
	// server (Error.Names lists them).
	ReasonSeveral
	// ReasonRepacked is an update packed more than once.
	ReasonRepacked
	// ReasonTooLarge is a file that asks for more than a limit allows: too large a
	// payload, too many entries, too much to read, too large a dictionary or window.
	ReasonTooLarge
	// ReasonDamaged is a file that cannot be read: it is broken or cut short, it holds a
	// link, a device or a path that leaves its folder, or it is compressed in a way xDesign
	// cannot read.
	ReasonDamaged
)

// Error is the refusal of a file that cannot be used as an update. Error() is a sentence
// the owner can read ("This zip holds no xdesign file."). Failures
// that are not the file's fault (a full disk, a cancelled context) are plain errors.
type Error struct {
	// Reason says why the file was refused.
	Reason Reason
	// Format names the packed file as the owner knows it ("zip", "tar.xz", "rar"); empty
	// when the file's format is not known or does not matter.
	Format string
	// Names lists the updates of a ReasonSeveral refusal, up to six.
	Names []string

	msg string
	err error
}

// Error implements error.
func (e *Error) Error() string { return e.msg }

// Unwrap returns the error of the library that found the file damaged, if any.
func (e *Error) Unwrap() error { return e.err }

// singleFile names the formats that pack one file and no folder.
func singleFile(name string) bool {
	return name == "gzip" || name == "xz" || name == "zstd"
}

// thisFile starts a sentence about the packed file called name: "This zip", "This xz file".
func thisFile(name string) string {
	switch {
	case name == "":
		return "This file"
	case singleFile(name):
		return "This " + name + " file"
	}
	return "This " + name
}

// printable makes a name from a file fit for a sentence.
func printable(s string) string {
	s = strings.ToValidUTF8(s, "?")
	s = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return '?'
		}
		return r
	}, s)
	if len(s) > 100 {
		s = s[:100]
		for !utf8.ValidString(s) {
			s = s[:len(s)-1]
		}
		s += "..."
	}
	return s
}

// sizeWords writes a size for a sentence: "512 MiB", "4 GiB".
func sizeWords(n int64) string {
	const mib, gib = 1 << 20, 1 << 30
	if n >= gib && n%gib == 0 {
		return fmt.Sprintf("%d GiB", n/gib)
	}
	return fmt.Sprintf("%d MiB", (n+mib-1)/mib)
}

func refusal(reason Reason, format, msg string) *Error {
	return &Error{Reason: reason, Format: format, msg: msg}
}

func notUpdate() error {
	return refusal(ReasonNotUpdate, "", "This is not an xdesign file, or a zip, tar, tar.gz, tar.xz or tar.zst file "+
		"that holds one.")
}

// notHolding refuses a gzip, xz or zstd file whose content is neither a program nor a tar archive.
func notHolding(name string) error {
	return refusal(ReasonNotUpdate, name, thisFile(name)+" does not hold an xdesign file or a tar archive of one.")
}

func unsupported(f Format) error {
	return refusal(ReasonUnsupported, f.String(), f.String()+" files are not supported: pack the update as zip, tar.xz or tar.zst.")
}

func encrypted(name string) error {
	return refusal(ReasonEncrypted, name, thisFile(name)+" is password-protected. xDesign can't open it.")
}

func multiVolume(name string) error {
	return refusal(ReasonMultiVolume, name, thisFile(name)+" is one part of an archive in several files. Pack the update into one file.")
}

func releaseFolder(name string) error {
	// A release's tar.gz holds only the program, and a zip of that tar.gz is packed twice:
	// only the program may be inside another file.
	return refusal(ReasonReleaseFolder, name, thisFile(name)+" holds a release folder, not the program. "+
		"Upload the xdesign file or its xdesign-<version>-linux-<arch>.tar.gz; the xdesign file may also be inside a "+name+".")
}

func nothing(name string) error {
	return refusal(ReasonNothing, name, thisFile(name)+" holds no xdesign file.")
}

func several(name string, names []string, arch string) error {
	if len(names) > 6 {
		names = names[:6]
	}
	listed := make([]string, len(names))
	for i, n := range names {
		listed[i] = printable(n)
	}
	pick := "the one you want to install"
	if arch != "" {
		pick = "the one for this server (" + arch + ")"
	}
	e := refusal(ReasonSeveral, name, thisFile(name)+" holds several updates ("+strings.Join(listed, ", ")+"). Pack only "+pick+".")
	e.Names = listed
	return e
}

func repacked() error {
	return refusal(ReasonRepacked, "", "This file is packed more than once. Pack the update once.")
}

func damaged(name string, err error) error {
	e := refusal(ReasonDamaged, name, thisFile(name)+" is damaged or cut short ("+printable(err.Error())+").")
	e.err = err
	return e
}

func tooMany(name string, limit int) error {
	return refusal(ReasonTooLarge, name, fmt.Sprintf("%s holds more than %d files, which no update does.", thisFile(name), limit))
}

func scanTooLarge(name string, limit int64) error {
	return refusal(ReasonTooLarge, name, thisFile(name)+" unpacks to more than "+sizeWords(limit)+", which no update does.")
}

// payloadTooLarge refuses a payload above limit: the file itself when name is empty, else a
// file in the packed file called name. size is what it declares, -1 when it outgrew the
// limit while being copied.
func payloadTooLarge(name string, size, limit int64) error {
	var msg string
	switch {
	case size < 0 && singleFile(name):
		msg = thisFile(name) + " unpacks to more than " + sizeWords(limit) + ". An xdesign file has less."
	case size < 0:
		msg = thisFile(name) + " holds a file that unpacks to more than " + sizeWords(limit) +
			". An xdesign file has less."
	case name == "":
		msg = "This file is " + sizeWords(size) + ", more than an xdesign file has (" +
			sizeWords(limit) + " at most)."
	default:
		msg = thisFile(name) + " holds a file of " + sizeWords(size) + ", more than an xdesign file has (" +
			sizeWords(limit) + " at most)."
	}
	return refusal(ReasonTooLarge, name, msg)
}

func windowTooLarge(name string, limit int64) error {
	return refusal(ReasonTooLarge, name, thisFile(name)+" needs a window of more than "+sizeWords(limit)+
		" to unpack. Pack it again without --long or --ultra.")
}

// dictionaryTooLarge refuses an xz file that asks for a dictionary larger than
// limit; size is what it asks for, 0 when the library does not say.
func dictionaryTooLarge(name string, size, limit int64) error {
	msg := thisFile(name) + " needs a larger dictionary to unpack than xDesign takes (" + sizeWords(limit) + ")."
	if size > 0 {
		msg = thisFile(name) + " needs a dictionary of " + sizeWords(size) + " to unpack, more than xDesign takes (" +
			sizeWords(limit) + ")."
	}
	msg += " Pack it again with a smaller dictionary"
	if strings.HasSuffix(name, "xz") {
		msg += " (xz -9 uses 64 MiB)"
	}
	return refusal(ReasonTooLarge, name, msg+".")
}

func badName(name, raw string) error {
	return refusal(ReasonDamaged, name, thisFile(name)+" holds the path \""+printable(raw)+"\", which an update never has.")
}

func notRegular(name, raw string) error {
	return refusal(ReasonDamaged, name, thisFile(name)+" holds \""+printable(raw)+"\", a link or a special file, which an update never has.")
}

func badFilter(name string) error {
	return refusal(ReasonDamaged, name, thisFile(name)+" is packed with a filter xDesign can't undo. Pack it again with plain xz "+
		"(without --x86 or the like).")
}

func badMethod(name string) error {
	return refusal(ReasonDamaged, name, thisFile(name)+" is packed in a way xDesign can't read. Make it again with the usual deflate method.")
}
