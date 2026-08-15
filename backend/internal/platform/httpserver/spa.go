package httpserver

import (
	"bytes"
	"io/fs"
	"net/http"
	"strings"
	"time"
)

// NewSPAHandler serves an embedded frontend build (see internal/webui) with
// client-side-routing fallback: any request path that doesn't match a real
// file on disk gets index.html instead of a 404, so a hard refresh or
// direct link on a React Router route (e.g. /self-education) still loads
// the app instead of erroring — the same behavior a Render Rewrite Rule
// would give a separately-hosted static site, done in-process instead.
//
// index.html is served via http.ServeContent rather than by handing the
// request to http.FileServer with a rewritten path: net/http's FileServer
// has a special case that 301-redirects any request whose path ends in
// "index.html" to the containing directory (its own anti-duplicate-URL
// behavior), which would turn every client-side route into a redirect back
// to "/" instead of actually serving the app shell there.
func NewSPAHandler(fsys fs.FS) http.Handler {
	fileServer := http.FileServer(http.FS(fsys))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path != "" {
			if _, err := fs.Stat(fsys, path); err == nil {
				fileServer.ServeHTTP(w, r)
				return
			}
		}

		index, err := fs.ReadFile(fsys, "index.html")
		if err != nil {
			http.NotFound(w, r)
			return
		}
		http.ServeContent(w, r, "index.html", time.Time{}, bytes.NewReader(index))
	})
}
