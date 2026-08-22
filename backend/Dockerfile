# syntax=docker/dockerfile:1
#
# Build context for this Dockerfile must be the MONOREPO ROOT (not
# backend/), because it builds both frontend/ and backend/ and copies the
# frontend build into the Go binary via go:embed — see
# backend/internal/webui. On Render: Dockerfile Path = "backend/Dockerfile",
# Docker Build Context Directory = "." (repo root).

# --- frontend build stage -----------------------------------------------
FROM node:20-alpine AS frontend-build

WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
# frontend/vite.config.ts and tsconfig.app.json alias "board-view" to
# ../board-view/src (a sibling package, see board-view/) — only the source
# is needed here, board-view has zero runtime deps of its own.
COPY board-view/src /src/board-view/src
RUN npm run build

# --- go build stage -------------------------------------------------------
FROM golang:1.25-alpine AS build

WORKDIR /src

# Cache module downloads separately from source changes.
COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ .
# internal/webui's //go:embed directive (only active with -tags webui)
# reads from this exact path at compile time.
COPY --from=frontend-build /src/frontend/dist ./internal/webui/dist

# CGO_ENABLED=0: pgx is pure Go, so a fully static binary works on any
# base image (no libc dependency to match between build/runtime stages).
# -tags webui: pulls in internal/webui/embed_prod.go, embedding the
# frontend build into the binary — see that file for why this is opt-in
# rather than the default (keeps `go run ./cmd/api` working for local dev
# without a frontend build present).
RUN CGO_ENABLED=0 GOOS=linux go build -tags webui -trimpath -ldflags="-s -w" -o /out/api ./cmd/api
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/migrate ./cmd/migrate

# --- runtime stage -------------------------------------------------------
FROM alpine:3.20 AS runtime

# ca-certificates: outbound TLS (Postgres sslmode=require, SMTP, etc).
RUN apk add --no-cache ca-certificates && \
    addgroup -S app && adduser -S app -G app

WORKDIR /app

COPY --from=build /out/api /out/migrate ./
# internal/generation and cmd/migrate both read these by relative path
# ("fixtures/puzzles.json", "migrations") from the process's working
# directory — see internal/generation/deps.go and cmd/migrate/main.go.
COPY --from=build /src/fixtures ./fixtures
COPY --from=build /src/migrations ./migrations

USER app

# Render's Docker services default to internal port 10000; HTTP_PORT is
# this app's own env var (see internal/platform/config/config.go), not
# Render's $PORT — set HTTP_PORT=10000 in the Render dashboard to match
# (or override this default if you map a different port there).
ENV HTTP_PORT=10000
EXPOSE 10000

# Run pending migrations before serving on every container start. Render's
# free-tier services don't expose a Shell tab, so a manual `./migrate` step
# isn't reliably available — this makes new migrations self-apply on deploy
# instead. db.Migrate (see internal/platform/db/migrate.go) tracks applied
# filenames in schema_migrations and skips ones already run, so this is safe
# to execute on every boot, not just the first.
ENTRYPOINT ["sh", "-c", "./migrate && exec ./api"]
