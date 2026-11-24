//go:build payload

package payload

import _ "embed" // for the go:embed directive

// payloadFile is the payload of the CPU, copied here by build.sh before go build -tags payload.
//
//go:embed payload.tar.zst
var payloadFile []byte

// embedded returns the payload of this release build.
func embedded() []byte {
	return payloadFile
}
