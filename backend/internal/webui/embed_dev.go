//go:build !webui

package webui

import "io/fs"

// DistFS is the local-dev/no-tag stub: no frontend build is embedded, so
// cmd/api skips mounting the SPA handler entirely and the API behaves
// exactly as it did before this package existed.
func DistFS() (fs.FS, bool) {
	return nil, false
}
