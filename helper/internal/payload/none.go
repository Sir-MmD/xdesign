//go:build !payload

package payload

// embedded returns no payload: a build without the tag payload is a development build.
func embedded() []byte {
	return nil
}
