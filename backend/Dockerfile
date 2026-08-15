# syntax=docker/dockerfile:1

# --- build stage -------------------------------------------------------
FROM golang:1.25-alpine AS build

WORKDIR /src

# Cache module downloads separately from source changes.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# CGO_ENABLED=0: pgx is pure Go, so a fully static binary works on any
# base image (no libc dependency to match between build/runtime stages).
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api
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

ENTRYPOINT ["./api"]
