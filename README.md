# Infinite Monitor

An AI-powered dashboard builder. Describe the widget you want in plain English and an AI agent writes, builds, and deploys it in real time.

Each widget is a full React app — with its own dependencies, API calls, charts, maps, and interactive UI — running in an isolated iframe. Drag, resize, and organize them into dashboards for any domain: cybersecurity, OSINT, trading, prediction markets, or anything you can describe.

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
- An [Anthropic API key](https://console.anthropic.com/)
- [Make](https://www.gnu.org/software/make/) (pre-installed on macOS/Linux)

### Setup

```bash
git clone https://github.com/homanp/infinite-monitor.git
cd infinite-monitor
```

Create `.env.local`:

```
ANTHROPIC_API_KEY=your-api-key-here
```

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
│ SQLite  │  │ Docker   │  │ Anthropic API   │
│ (state) │  │ (builds) │  │ (Claude)        │
│         │  │          │  │                 │
│ widgets │  │ vite     │  │ code generation │
│ layouts │  │ serve    │  │ web search      │
│ files   │  │ dist/    │  │ reasoning       │
└─────────┘  └──────────┘  └─────────────────┘
```

**Client** — Next.js 16 + React 19. Zustand store persisted to localStorage. Widgets rendered as iframes on an infinite canvas with pan, zoom, and grid-snapped placement.

**Server** — Next.js API routes. AI chat uses Vercel AI SDK with Claude. Widget files stored in SQLite via Drizzle ORM. CORS proxy for widget API calls.

**Widget Runtime** — A single Docker container running `serve`. The agent writes files, Vite builds them, and the built output is served as static HTML. A Docker volume persists builds across container restarts.

**Widget Template** — Each widget gets React 18, Tailwind CSS, Recharts, MapLibre GL, Framer Motion, date-fns, Lucide icons, and all shadcn/ui components out of the box.

## Features

**Multiple dashboards** — Create separate dashboards for different domains. Switch between them instantly.

**Dashboard-aware agents** — Each widget's AI agent can see what other widgets exist on the same dashboard and read their source code, so it builds complementary components instead of duplicating work.

**Sandboxed bash** — The agent has a `just-bash` sandboxed shell for data processing, prototyping, and quick calculations without touching your system.

**Live web search** — The agent searches the web for API documentation, data sources, and implementation patterns while building.

**CORS proxy** — Widgets can fetch any external API through the built-in proxy at `/api/proxy?url=...`.

**Infinite canvas** — Pan, zoom, and place widgets anywhere on an unbounded grid. Drag widgets by their title bar, resize from the corner handle. Widgets snap to grid cells.

**Persistent builds** — Widget builds are stored on a Docker volume. Container restarts don't lose your built widgets.

**Stale build recovery** — If a build gets stuck for over 2 minutes, the system automatically retries instead of requiring a server restart.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16, React 19, TypeScript |
| AI | Anthropic Claude (via Vercel AI SDK), `just-bash` |
| Styling | Tailwind CSS 4, shadcn/ui, Geist Mono |
| State | Zustand (persisted to localStorage) |
| Database | SQLite via Drizzle ORM |
| Container | Docker (Vite + serve) |
| Canvas | Custom infinite canvas (pan/zoom/grid-snap) |
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
│   ├── chat-sidebar.tsx   # AI chat panel
│   ├── dashboard-grid.tsx # Dashboard orchestrator
│   ├── infinite-canvas.tsx # Pan/zoom infinite canvas
│   ├── draggable-widget.tsx # Grid-snapped drag & resize
│   ├── zoom-controls.tsx  # Canvas zoom UI
│   ├── widget-card.tsx    # Widget iframe container
│   └── dashboard-picker.tsx
├── db/                    # SQLite schema + queries
├── lib/
│   ├── widget-runner.ts   # Docker build orchestration
│   └── sync-db.ts         # Client sync utilities
└── store/
    └── widget-store.ts    # Zustand state
docker/
└── widget-base/           # Widget runtime Docker image
    ├── Dockerfile
    └── template/          # Vite + React + Tailwind base
```

## Contributing

Contributions are welcome. Some areas that need work:

- **Templates** — Pre-built dashboard templates that users can start from
- **Widget marketplace** — Share and import widgets between users
- **Deployment** — Publish widgets to Vercel/Cloudflare for permanent hosting
- **Collaboration** — Real-time multi-user dashboard editing
- **More AI providers** — Support for OpenAI, Google, local models

## License

MIT
