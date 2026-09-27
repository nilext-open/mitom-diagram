# mitom-daemon

Local backend for Mitom Diagram, written in Go with only the standard library. It stores diagrams on disk,
exposes them over a small REST API and can serve the built web client.

```
mitom-daemon [flags]
  -addr           listen address                    (env MITOM_ADDR, default 127.0.0.1:7420)
  -data           diagram storage directory         (env MITOM_DATA_DIR, default <user config dir>/mitom-diagram/diagrams)
  -web            built web client to serve         (env MITOM_WEB_DIR, optional)
  -allowed-hosts  Host header allowlist, * disables (env MITOM_ALLOWED_HOSTS, default localhost,127.0.0.1,::1)
```

## Storage

Each diagram is stored as `<id>.json` and written atomically (temp file + rename). The daemon treats `content`
as opaque JSON, so new diagram kinds only need client changes. `kind` is validated against an allowlist in
`internal/api/api.go`; it currently accepts `database` and `architecture`.

## API

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Status and version |
| GET | `/api/diagrams` | List summaries, most recently updated first |
| POST | `/api/diagrams` | Create `{name, kind, content}` |
| GET | `/api/diagrams/{id}` | Get one diagram |
| PUT | `/api/diagrams/{id}` | Replace `{name, kind, content}` |
| DELETE | `/api/diagrams/{id}` | Delete |

## Security notes

The daemon has no authentication and binds to loopback by default.

- Writes require `Content-Type: application/json`, which blocks cross-site form / `text/plain` CSRF.
- The `Host` header is checked against an allowlist, which blocks DNS rebinding.
- Other local processes and users on the same machine can still call the API.

Do not expose it on a network interface without adding authentication (see *Open decisions* in the root README).

## Development

```bash
go vet ./... && go test ./...
go build -o bin/mitom-daemon .
```
