FROM golang:1.23-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o meridian .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o meridian-worker ./cmd/worker

# ── Final image ──────────────────────────────────────────────────────────────
FROM alpine:3.20

RUN apk add --no-cache ca-certificates curl

WORKDIR /app

COPY --from=builder /app/meridian .
COPY --from=builder /app/meridian-worker .

RUN addgroup -g 10001 meridian && adduser -D -u 10001 -G meridian meridian && mkdir -p config data/sources && chown -R meridian:meridian /app
USER 10001

EXPOSE 8000

CMD ["./meridian"]
