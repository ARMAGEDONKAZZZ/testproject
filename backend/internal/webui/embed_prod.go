//go:build webui

// Package webui embeds the built frontend (frontend/dist) into the api
// binary so a single Render service can serve both the API and the SPA —
// see backend/Dockerfile's "frontend build" stage, which copies the Vite
// build output into internal/webui/dist before `go build -tags webui`.
//
// This file only compiles with the "webui" build tag. Without it (plain
// `go build`/`go run`, as used for local dev throughout this project),
// DistFS reports "not embedded" and the server simply skips serving a
// frontend — local dev is unaffected and doesn't need frontend/dist to
// exist. That split exists because //go:embed requires the embedded
// directory to exist at compile time; forcing that on every local build
// would break `go run ./cmd/api` for anyone who hasn't run the frontend
// build first.
package webui

import (
	"embed"
	"io/fs"
)

//go:embed all:dist
var distFS embed.FS

// DistFS returns the embedded frontend build, rooted at its own index.html
// (i.e. with the "dist/" prefix stripped).
func DistFS() (fs.FS, bool) {
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		return nil, false
	}
	return sub, true
}
