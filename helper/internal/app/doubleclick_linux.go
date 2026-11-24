package app

import (
	"context"
	"io"
)

// doubleClicked reports false on Linux: xdesign with no arguments shows its usage.
func doubleClicked(context.Context, io.Writer, io.Writer) (int, bool) {
	return 0, false
}
