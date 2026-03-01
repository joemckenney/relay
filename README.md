# Relay

A local AI model gateway that wraps Ollama with an OpenAI-compatible API. Provides a unified interface for accessing multiple model tiers with streaming, tool calling, and authentication.

## Features

- **OpenAI-compatible API** — drop-in replacement for `/v1/chat/completions`
- **Model tiers** — abstract aliases (small/medium/large) mapped to Ollama models
- **Streaming** — SSE streaming with OpenAI wire format
- **Tool calling** — function definitions with `auto`, `none`, `required`, or specific tool choice
- **Authentication** — optional API key with local bypass for development
- **Auto-generated SDK** — TypeScript client generated from the OpenAPI spec via Fern
- **OpenAPI docs** — served at `/openapi` from the running application

## Quick start

```bash
cp .env.example .env    # configure models, port, auth
bun install
bun run dev             # starts on http://localhost:4000
```

Requires [Bun](https://bun.sh) and a running [Ollama](https://ollama.com) instance.

## Configuration

Environment variables (see `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Server port |
| `HOST` | `0.0.0.0` | Server host |
| `NODE_ENV` | `development` | Node environment |
| `OLLAMA_BASE_URL` | `http://localhost:11434/v1` | Ollama API endpoint |
| `MODEL_SMALL` | `qwen2.5:7b` | Small tier model |
| `MODEL_MEDIUM` | `qwen2.5:32b` | Medium tier model |
| `MODEL_LARGE` | `qwen2.5:72b` | Large tier model |
| `API_KEY` | *(empty)* | API key for Bearer auth (empty disables auth) |
| `LOCAL_BYPASS` | `true` | Skip auth for localhost requests |

## API

| Method | Path | Description |
|---|---|---|
| `POST` | `/v1/chat/completions` | Chat completion (streaming and non-streaming) |
| `GET` | `/v1/models` | List available models |
| `GET` | `/v1/models/tiers` | Get tier-to-model mappings |
| `GET` | `/v1/config` | Relay configuration |
| `GET` | `/health` | Health check |
| `GET` | `/openapi` | Interactive API docs |

### Example

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "small",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }'
```

Use a tier alias (`small`, `medium`, `large`) or an explicit Ollama model name as the `model` field.

## Scripts

```bash
bun run dev              # watch mode
bun run build            # compile to dist/
bun run start            # run built output

bun test                 # all tests
bun run test:unit        # unit tests
bun run test:integration # integration tests (requires running server)
bun run test:e2e         # e2e tests (requires running server + Ollama)

bun run check            # lint + format check
bun run lint             # autofix lint issues
bun run format           # autoformat

bun run generate:spec    # regenerate OpenAPI spec from running app
bun run generate:sdk     # regenerate TypeScript SDK via Fern
```

## Project structure

```
src/
├── index.ts             # entry point
├── app.ts               # Elysia app, routes, middleware
├── config.ts            # environment config
├── generate-spec.ts     # OpenAPI spec extraction
├── providers/           # Ollama client and model resolution
├── middleware/           # auth
└── routes/
    ├── health.ts
    └── v1/
        ├── chat.ts      # /v1/chat/completions
        ├── models.ts    # /v1/models
        └── config.ts    # /v1/config

tests/
├── unit/                # config and provider logic
├── integration/         # SDK client against running server
└── e2e/                 # full chat completions with Ollama

sdk/typescript/          # auto-generated TypeScript client
spec/openapi.json        # generated OpenAPI 3.0 spec
systemd/relay.service    # systemd unit file
```

## Deployment

A systemd unit file is included at `systemd/relay.service` for running Relay as a service alongside Ollama.
