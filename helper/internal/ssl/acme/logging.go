package acme

import (
	"context"
	"log/slog"
	"slices"
	"strings"

	ssl "github.com/Sir-MmD/xdesign/helper/internal/ssl/domain"
)

// legoHandler is the slog handler of lego's process-wide logger. It renders each record
// as one line, redacts it (Redact: tokens, keys and URLs' query strings), hands
// the lines of level info and above to the order that runs, and writes every line to the
// engine's logger at debug level.
type legoHandler struct {
	e     *Engine
	attrs []slog.Attr
	group string
}

// Enabled takes every record: the order's sink and the debug log filter for themselves.
func (h *legoHandler) Enabled(context.Context, slog.Level) bool { return true }

// Handle renders r and passes it on.
func (h *legoHandler) Handle(ctx context.Context, r slog.Record) error {
	var b strings.Builder
	b.WriteString(r.Message)
	for _, a := range h.attrs {
		appendAttr(&b, h.group, a)
	}
	r.Attrs(func(a slog.Attr) bool {
		appendAttr(&b, h.group, a)
		return true
	})
	text := Redact(b.String())
	if r.Level >= slog.LevelInfo {
		if f := h.e.sink.Load(); f != nil {
			(*f)(levelOf(r.Level), text)
		}
	}
	h.e.log.LogAttrs(ctx, slog.LevelDebug, "lego", slog.String("lego_level", r.Level.String()), slog.String("text", text))
	return nil
}

// WithAttrs returns a handler that adds as to every record.
func (h *legoHandler) WithAttrs(as []slog.Attr) slog.Handler {
	return &legoHandler{e: h.e, attrs: append(slices.Clone(h.attrs), as...), group: h.group}
}

// WithGroup returns a handler that puts the attributes after it under name.
func (h *legoHandler) WithGroup(name string) slog.Handler {
	if name == "" {
		return h
	}
	group := name
	if h.group != "" {
		group = h.group + "." + name
	}
	return &legoHandler{e: h.e, attrs: h.attrs, group: group}
}

// appendAttr writes a as " key=value" to b, groups flattened into dotted keys.
func appendAttr(b *strings.Builder, group string, a slog.Attr) {
	v := a.Value.Resolve()
	if v.Kind() == slog.KindGroup {
		inner := group
		if a.Key != "" {
			inner = strings.Trim(group+"."+a.Key, ".")
		}
		for _, ga := range v.Group() {
			appendAttr(b, inner, ga)
		}
		return
	}
	if a.Key == "" {
		return
	}
	b.WriteByte(' ')
	if group != "" {
		b.WriteString(group)
		b.WriteByte('.')
	}
	b.WriteString(a.Key)
	b.WriteByte('=')
	b.WriteString(v.String())
}

// levelOf maps a slog level to the level of a log entry.
func levelOf(l slog.Level) ssl.LogLevel {
	switch {
	case l >= slog.LevelError:
		return ssl.LogError
	case l >= slog.LevelWarn:
		return ssl.LogWarning
	default:
		return ssl.LogInfo
	}
}
