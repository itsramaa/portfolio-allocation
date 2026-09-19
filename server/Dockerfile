# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM golang:1.25-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -o /out/portfolio-api ./cmd/api

# ─── Stage 2: Run ────────────────────────────────────────────────────────────
FROM alpine:3.22

RUN apk add --no-cache ca-certificates

WORKDIR /app
COPY --from=builder /out/portfolio-api ./portfolio-api

EXPOSE 3001

CMD ["./portfolio-api"]
