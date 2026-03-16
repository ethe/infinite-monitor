# Infinite Monitor

[![GitHub stars](https://img.shields.io/github/stars/homanp/infinite-monitor?style=social)](https://github.com/homanp/infinite-monitor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/homanp/infinite-monitor/actions/workflows/ci.yml/badge.svg)](https://github.com/homanp/infinite-monitor/actions/workflows/ci.yml)

An AI-powered dashboard builder. Describe the widget you want in plain English and an AI agent writes, builds, and deploys it in real time.

Each widget is a full React app — with its own dependencies, API calls, charts, maps, and interactive UI — running in an isolated iframe. Drag, resize, and organize them on an infinite canvas for any domain: cybersecurity, OSINT, trading, prediction markets, or anything you can describe.

<p align="center">
  <img src="assets/demo.gif" alt="Infinite Monitor" width="100%">
</p>

## How it works

1. Click **Add Widget** and describe what you want
2. An AI agent writes the React code, installs dependencies, and builds it inside a Docker container
3. The widget renders live in an iframe on your dashboard
4. Iterate by chatting — the agent rewrites and rebuilds in seconds

The agent has 6 tools at its disposal:

| Tool | What it does |
|------|-------------|
| `bash` | Run shell commands in a sandboxed environment (via [bash-tool](https://github.com/vercel-labs/bash-tool)) |
| `writeFile` | Write source files to the widget — writing `src/App.tsx` triggers a build |
| `readFile` | Read existing widget source files |
| `listDashboardWidgets` | See sibling widgets on the same dashboard |
| `readWidgetCode` | Read another widget's source code to match patterns |
| `web_search` | Search the web for APIs, docs, and data |

## Quick start

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Docker](https://www.docker.com/) running locally
- An API key from any [supported provider](#supported-providers) (Anthropic, OpenAI, Google, xAI, Mistral, and more)
- [Make](https://www.gnu.org/software/make/) (pre-installed on macOS/Linux)

### Setup

```bash
git clone https://github.com/homanp/infinite-monitor.git
cd infinite-monitor
```

Create `.env.local` with at least one provider key:

```bash
# Pick any provider — or add multiple
ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...
# GOOGLE_GENERATIVE_AI_API_KEY=...
```

See [`.env.example`](.env.example) for the full list of supported environment variables.

Bootstrap everything (install deps + build Docker image + start dev server):

```bash
make all
```

Or step by step:

```bash
make setup   # npm install + build widget-base Docker image
make dev     # start Next.js dev server
```

Open [http://localhost:3000](http://localhost:3000).

### Available make targets

| Command | Description |
|---------|-------------|
| `make setup` | Install npm deps + build Docker image (first-time) |
| `make docker` | Rebuild the widget runtime Docker image |
| `make dev` | Start the Next.js dev server |
| `make build` | Production build |
| `make start` | Start production server |
| `make test` | Run tests |
| `make lint` | Run linter |
| `make clean` | Remove build artifacts, Docker container, and volume |
| `make all` | Full bootstrap: setup + dev |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Next.js App                                            │
│  ┌──────────────────────┐  ┌─────────────────────────┐  │
│  │  Infinite Canvas     │  │  Chat Sidebar           │  │
│  │  (pan / zoom / grid) │  │  (AI conversation)      │  │
│  │                      │  │                          │  │
│  │  ┌──────┐ ┌──────┐   │  │  User: "build a chart"  │  │
│  │  │iframe│ │iframe│   │  │  Agent: writes code...   │  │
│  │  │  w1  │ │  w2  │   │  │  Agent: building...      │  │
│  │  └──────┘ └──────┘   │  │  ✓ Widget ready          │  │
│  └──────────────────────┘  └─────────────────────────┘  │
└──────────────────┬──────────────────────────────────────┘
                   │
     ┌─────────────┼─────────────────┐
     │             │                 │
     ▼             ▼                 ▼
┌─────────┐  ┌──────────┐  ┌─────────────────┐
│ SQLite  │  │ Docker   │  │ AI Providers    │
│ (state) │  │ (builds) │  │ (BYOK)          │
│         │  │          │  │                 │
│ widgets │  │ vite     │  │ Anthropic       │
│ layouts │  │ serve    │  │ OpenAI / Google  │
│ files   │  │ dist/    │  │ xAI / Mistral…  │
└─────────┘  └──────────┘  └─────────────────┘
```

**Client** — Next.js 16 + React 19. Zustand store persisted to localStorage. Widgets rendered as iframes on an infinite canvas with pan, zoom, minimap, and grid-snapped placement.

**Server** — Next.js API routes. AI chat uses Vercel AI SDK with any supported provider. Widget files stored in SQLite via Drizzle ORM. CORS proxy for widget API calls.

**Widget Runtime** — A single Docker container running `serve`. The agent writes files, Vite builds them, and the built output is served as static HTML. A Docker volume persists builds across container restarts.

**Widget Template** — Each widget gets React 18, Tailwind CSS, Recharts, MapLibre GL, Framer Motion, date-fns, Lucide icons, and all shadcn/ui components out of the box.

## Features

**Bring your own key** — Pick from 15 AI providers and 35+ models. Enter your API key in the UI or set it via environment variables. Switch models per conversation.

**Multiple dashboards** — Create separate dashboards for different domains. Switch between them instantly.

**Dashboard-aware agents** — Each widget's AI agent can see what other widgets exist on the same dashboard and read their source code, so it builds complementary components instead of duplicating work.

**Infinite canvas** — Pan, zoom, and place widgets anywhere on an unbounded grid. Drag widgets by their title bar, resize from the corner handle. Widgets snap to grid cells. A minimap shows your position across the canvas.

**Sandboxed bash** — The agent has a `just-bash` sandboxed shell for data processing, prototyping, and quick calculations without touching your system.

**Live web search** — The agent searches the web for API documentation, data sources, and implementation patterns while building.

**CORS proxy** — Widgets can fetch any external API through the built-in proxy at `/api/proxy?url=...`.

**Dashboard templates** — Start from pre-built templates for common domains or build from scratch.

**Persistent builds** — Widget builds are stored on a Docker volume. Container restarts don't lose your built widgets.

**Stale build recovery** — If a build gets stuck for over 2 minutes, the system automatically retries instead of requiring a server restart.

## Supported providers

Infinite Monitor supports BYOK (Bring Your Own Key) for 15 providers. Enter your key in the chat sidebar or set the environment variable.

| Provider | Environment Variable | Models |
|----------|---------------------|--------|
| Anthropic | `ANTHROPIC_API_KEY` | Claude Opus 4.6, Sonnet 4.6, Sonnet 4.5, Haiku 4.5 |
| OpenAI | `OPENAI_API_KEY` | GPT-5.4, GPT-5.4 Pro, GPT-5, GPT-5 Mini, GPT-4.1 |
| Google | `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini 3.1 Pro, Gemini 3 Flash, Gemini 2.5 Pro |
| xAI | `XAI_API_KEY` | Grok 4.20, Grok 4.1, Grok 4, Grok 3 |
| Mistral | `MISTRAL_API_KEY` | Mistral Large, Magistral Medium, Mistral Small |
| DeepSeek | `DEEPSEEK_API_KEY` | DeepSeek Chat, DeepSeek Reasoner |
| Groq | `GROQ_API_KEY` | Llama 4 Scout, Llama 3.3 70B, DeepSeek R1 Distill |
| Perplexity | `PERPLEXITY_API_KEY` | Sonar Pro, Sonar |
| Cohere | `COHERE_API_KEY` | Command A, Command R+ |
| Together AI | `TOGETHER_AI_API_KEY` | Llama 3.3 70B, Qwen 2.5 72B, DeepSeek V3 |
| Fireworks | `FIREWORKS_API_KEY` | Kimi K2, DeepSeek R1, Llama 3.3 70B |
| DeepInfra | `DEEPINFRA_API_KEY` | Llama 4 Maverick, Llama 3.3 70B |
| Cerebras | `CEREBRAS_API_KEY` | Llama 3.3 70B, Qwen 3 32B |
| Moonshot AI | `MOONSHOT_API_KEY` | Kimi K2.5, Kimi K2 Thinking |
| Alibaba | `ALIBABA_API_KEY` | Qwen3 Max, Qwen Plus |

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16, React 19, TypeScript |
| AI | Vercel AI SDK, 15 providers via BYOK |
| Styling | Tailwind CSS 4, shadcn/ui, Geist Mono |
| State | Zustand (persisted to localStorage) |
| Database | SQLite via Drizzle ORM |
| Container | Docker (Vite + serve) |
| Canvas | Custom infinite canvas (pan/zoom/minimap/grid-snap) |
| Charts | Recharts (in widgets) |
| Maps | MapLibre GL (in widgets) |

## Project structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/          # AI agent endpoint (streaming)
│   │   ├── proxy/         # CORS proxy for widget API calls
│   │   ├── sync/          # Client ↔ server state sync
│   │   ├── widget/[id]/   # Widget iframe proxy
│   │   └── widgets/       # Widget CRUD
│   └── page.tsx           # Dashboard page
├── components/
│   ├── ai-elements/       # Chat UI (messages, reasoning, code blocks)
│   ├── chat-sidebar.tsx   # AI chat panel + model selector
│   ├── dashboard-grid.tsx # Dashboard orchestrator
│   ├── infinite-canvas.tsx # Pan/zoom infinite canvas
│   ├── draggable-widget.tsx # Grid-snapped drag & resize
│   ├── zoom-controls.tsx  # Zoom buttons + minimap
│   ├── widget-card.tsx    # Widget iframe container
│   └── dashboard-picker.tsx
├── db/                    # SQLite schema + queries
├── lib/
│   ├── model-registry.ts  # Provider + model definitions
│   ├── create-model.ts    # AI SDK model factory
│   ├── widget-runner.ts   # Docker build orchestration
│   └── sync-db.ts         # Client sync utilities
└── store/
    ├── widget-store.ts    # Zustand widget/canvas state
    └── settings-store.ts  # API keys + model preferences
docker/
└── widget-base/           # Widget runtime Docker image
    ├── Dockerfile
    └── template/          # Vite + React + Tailwind base
```

## Security

**Local-first storage** — All API keys (AI providers and search providers) are stored in your browser's localStorage. They are sent to the Next.js server only for the duration of a request and are never persisted server-side or sent to any third party.

**Brin threat scanning** — Every external URL touched by the platform is scanned through [Brin](https://brin.sh) ([GitHub](https://github.com/superagent-ai/brin)), an open security API that scores domains and pages for threats. Brin runs in two places:

- **Web search tool** — When the AI agent searches the web, all result URLs are scanned before they are returned to the model. Results with a score below 30 are filtered out.
- **CORS proxy** — When widgets fetch external APIs through `/api/proxy`, the target URL is scanned before the request is forwarded. Requests to domains or pages scoring below 30 are blocked with a `403`.

Both layers use `tolerance=lenient` and automatically route to Brin's `/domain/` endpoint for apex URLs or `/page/` endpoint for URLs with a path. Scan results are cached in-memory for 5 minutes to avoid redundant lookups.

## Contributing

Contributions are welcome. Some areas that need work:

- **Templates** — More pre-built dashboard templates for different domains
- **Widget marketplace** — Share and import widgets between users
- **Deployment** — Publish widgets to Vercel/Cloudflare for permanent hosting
- **Collaboration** — Real-time multi-user dashboard editing
- **Mobile** — Responsive layout and touch gesture support

## License

MIT
