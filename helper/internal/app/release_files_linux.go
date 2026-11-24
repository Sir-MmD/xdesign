package app

// releaseSelf is the copy of this file in a release folder (07 section 1).
const releaseSelf = "xdesign"

// selfExe is the running file as the kernel sees it, also when its file was replaced or
// removed since it started.
const selfExe = "/proc/self/exe"

// selfPath returns the running file, selfExe.
func selfPath() (string, error) {
	return selfExe, nil
}
