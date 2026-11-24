package platform

import (
	"crypto/sha1" //nolint:gosec // G505: Windows names a service's account by this hash; nothing secret
	"encoding/binary"
	"errors"
	"fmt"
	"io/fs"
	"strings"
	"unicode/utf16"
	"unsafe"

	"golang.org/x/sys/windows"
)

// ServiceSID returns the security identifier of the virtual account a service named name
// runs as (NT SERVICE\<name>): S-1-5-80- and the SHA-1 of the name in capitals (UTF-16LE)
// read as five little-endian numbers. Windows computes it the same way, so folders can be
// given to the account before its service exists (S-1-5-80-2098923330-2051758124-
// 151170182-548055611-3226271214 for xdesign).
func ServiceSID(name string) string {
	units := utf16.Encode([]rune(strings.ToUpper(name)))
	b := make([]byte, 2*len(units))
	for i, u := range units {
		binary.LittleEndian.PutUint16(b[2*i:], u)
	}
	sum := sha1.Sum(b) //nolint:gosec // G401: see the import
	parts := []string{"S-1-5-80"}
	for i := 0; i < len(sum); i += 4 {
		parts = append(parts, fmt.Sprint(binary.LittleEndian.Uint32(sum[i:])))
	}
	return strings.Join(parts, "-")
}

// MakeFolder creates the folder path with the owner and the protected DACL (D:P) of the
// security descriptor sddl in one call (CreateDirectory), so it never exists without
// them; a DACL that takes entries from the folder above is set with SetSecurity instead.
// Its parent must exist; a folder that exists is an error with fs.ErrExist.
func MakeFolder(path, sddl string) error {
	sd, err := windows.SecurityDescriptorFromString(sddl)
	if err != nil {
		return &fs.PathError{Op: "mkdir", Path: path, Err: err}
	}
	p, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return &fs.PathError{Op: "mkdir", Path: path, Err: err}
	}
	sa := windows.SecurityAttributes{SecurityDescriptor: sd}
	sa.Length = uint32(unsafe.Sizeof(sa))
	if err := windows.CreateDirectory(p, &sa); err != nil {
		if errors.Is(err, windows.ERROR_ALREADY_EXISTS) {
			err = fs.ErrExist
		}
		return &fs.PathError{Op: "mkdir", Path: path, Err: err}
	}
	return nil
}

// SetSecurity gives path the owner and the DACL of the security descriptor sddl: a
// protected DACL (D:P) keeps nothing of the folder above, another one adds what that
// folder passes on. Windows passes the inheritable entries on to everything below path.
func SetSecurity(path, sddl string) error {
	sd, err := windows.SecurityDescriptorFromString(sddl)
	if err != nil {
		return &fs.PathError{Op: "SetNamedSecurityInfo", Path: path, Err: err}
	}
	owner, _, err := sd.Owner()
	if err != nil {
		return &fs.PathError{Op: "SetNamedSecurityInfo", Path: path, Err: err}
	}
	dacl, _, err := sd.DACL()
	if err != nil {
		return &fs.PathError{Op: "SetNamedSecurityInfo", Path: path, Err: err}
	}
	control, _, err := sd.Control()
	if err != nil {
		return &fs.PathError{Op: "SetNamedSecurityInfo", Path: path, Err: err}
	}
	info := windows.SECURITY_INFORMATION(windows.OWNER_SECURITY_INFORMATION | windows.DACL_SECURITY_INFORMATION)
	if control&windows.SE_DACL_PROTECTED != 0 {
		info |= windows.PROTECTED_DACL_SECURITY_INFORMATION
	} else {
		info |= windows.UNPROTECTED_DACL_SECURITY_INFORMATION
	}
	if err := windows.SetNamedSecurityInfo(path, windows.SE_FILE_OBJECT, info, owner, nil, dacl, nil); err != nil {
		return &fs.PathError{Op: "SetNamedSecurityInfo", Path: path, Err: err}
	}
	return nil
}

// SecurityMatches reports whether path has the owner of sddl, its DACL's protection and
// exactly its DACL's entries, in their order; the entries path inherits from its folder
// are not compared.
func SecurityMatches(path, sddl string) (bool, error) {
	want, err := windows.SecurityDescriptorFromString(sddl)
	if err != nil {
		return false, &fs.PathError{Op: "GetNamedSecurityInfo", Path: path, Err: err}
	}
	have, err := windows.GetNamedSecurityInfo(path, windows.SE_FILE_OBJECT,
		windows.OWNER_SECURITY_INFORMATION|windows.DACL_SECURITY_INFORMATION)
	if err != nil {
		return false, &fs.PathError{Op: "GetNamedSecurityInfo", Path: path, Err: err}
	}
	wantText, err := securityText(want)
	if err != nil {
		return false, &fs.PathError{Op: "GetNamedSecurityInfo", Path: path, Err: err}
	}
	haveText, err := securityText(have)
	if err != nil {
		return false, &fs.PathError{Op: "GetNamedSecurityInfo", Path: path, Err: err}
	}
	return haveText == wantText, nil
}

// SetServiceSecurity gives the open service h the DACL of the security descriptor sddl:
// who may query, start, stop or change the service (SetSecurityInfo).
func SetServiceSecurity(h windows.Handle, sddl string) error {
	sd, err := windows.SecurityDescriptorFromString(sddl)
	if err != nil {
		return fmt.Errorf("the service's permissions: %w", err)
	}
	dacl, _, err := sd.DACL()
	if err != nil {
		return fmt.Errorf("the service's permissions: %w", err)
	}
	if err := windows.SetSecurityInfo(h, windows.SE_SERVICE, windows.DACL_SECURITY_INFORMATION, nil, nil, dacl, nil); err != nil {
		return fmt.Errorf("set the service's permissions: %w", err)
	}
	return nil
}

// ServiceSecurityMatches reports whether the open service h has exactly the DACL entries of
// the security descriptor sddl, in their order.
func ServiceSecurityMatches(h windows.Handle, sddl string) (bool, error) {
	want, err := windows.SecurityDescriptorFromString(sddl)
	if err != nil {
		return false, fmt.Errorf("the service's permissions: %w", err)
	}
	have, err := windows.GetSecurityInfo(h, windows.SE_SERVICE, windows.DACL_SECURITY_INFORMATION)
	if err != nil {
		return false, fmt.Errorf("read the service's permissions: %w", err)
	}
	wantText, err := securityText(want)
	if err != nil {
		return false, fmt.Errorf("the service's permissions: %w", err)
	}
	haveText, err := securityText(have)
	if err != nil {
		return false, fmt.Errorf("the service's permissions: %w", err)
	}
	return haveText == wantText, nil
}

// securityText describes the owner of sd, whether its DACL is protected and the DACL's
// own entries (type, flags, rights and account), for SecurityMatches.
func securityText(sd *windows.SECURITY_DESCRIPTOR) (string, error) {
	owner, _, err := sd.Owner()
	if err != nil {
		return "", fmt.Errorf("the owner: %w", err)
	}
	control, _, err := sd.Control()
	if err != nil {
		return "", fmt.Errorf("the control flags: %w", err)
	}
	dacl, _, err := sd.DACL()
	if err != nil {
		return "", fmt.Errorf("the DACL: %w", err)
	}
	var b strings.Builder
	if owner != nil {
		b.WriteString(owner.String())
	}
	fmt.Fprintf(&b, " protected=%t", control&windows.SE_DACL_PROTECTED != 0)
	if dacl == nil {
		return b.String(), nil
	}
	for i := range uint32(dacl.AceCount) {
		var ace *windows.ACCESS_ALLOWED_ACE
		if err := windows.GetAce(dacl, i, &ace); err != nil {
			return "", fmt.Errorf("entry %d of the DACL: %w", i, err)
		}
		if ace.Header.AceFlags&windows.INHERITED_ACE != 0 {
			continue
		}
		// The account follows the entry's mask in both entry types the installer writes.
		sid := (*windows.SID)(unsafe.Pointer(&ace.SidStart)) //nolint:gosec // G103: the SID is stored in the entry from SidStart on
		fmt.Fprintf(&b, " (%d;%#x;%#x;%s)", ace.Header.AceType, ace.Header.AceFlags, ace.Mask, sid.String())
	}
	return b.String(), nil
}
