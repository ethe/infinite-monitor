# Changelog

All notable changes to Infinite Monitor are documented here.

## Unreleased

### Added

- Infinite canvas dashboard replacing the fixed grid layout — pan, zoom, and freely position widgets ([#18](https://github.com/homanp/infinite-monitor/pull/18))
- Interactive minimap showing widget positions and current viewport ([#19](https://github.com/homanp/infinite-monitor/pull/19))
- Portable dashboard templates bundled as static JSON files ([#20](https://github.com/homanp/infinite-monitor/pull/20))
- Auto fit-to-view after applying a template ([#20](https://github.com/homanp/infinite-monitor/pull/20))
- `deps.json` support in widget bootstrap to install extra packages for template widgets ([#20](https://github.com/homanp/infinite-monitor/pull/20))
- BYOK (Bring Your Own Key) model selection with 12 providers and 35+ models ([#17](https://github.com/homanp/infinite-monitor/pull/17))
- Inline model picker and GitHub star button in the UI ([#17](https://github.com/homanp/infinite-monitor/pull/17))
- Vitest unit test suite with CI test job
- Cursor BugBot CI workflow to auto-review new pull requests
- GitHub CI workflows (lint, typecheck, test), issue templates, and PR template ([#10](https://github.com/homanp/infinite-monitor/pull/10))
- Pre-commit hooks via lint-staged ([#10](https://github.com/homanp/infinite-monitor/pull/10))

### Changed

- Consolidated 9 agent tools down to 6 using bash-tool
- Updated README tool list to reflect the 6-tool architecture

### Fixed

- Canvas zoom-to-cursor by removing 200 k px margin trick that broke coordinate math at non-1× zoom levels ([#19](https://github.com/homanp/infinite-monitor/pull/19))
- Canvas panning using `data-canvas-bg`/`data-widget` attributes instead of strict target check ([#19](https://github.com/homanp/infinite-monitor/pull/19))
- Stale closure in wheel handler by reading viewport from ref ([#19](https://github.com/homanp/infinite-monitor/pull/19))
- Dot-grid background now drawn via CSS `background-position` ([#19](https://github.com/homanp/infinite-monitor/pull/19))
- Manually arranged canvas layouts saved per template (Crypto Trader, World Conflicts, Prediction Markets) ([#20](https://github.com/homanp/infinite-monitor/pull/20))
- Skip non-`src` files in bootstrap to prevent cascade failure ([#20](https://github.com/homanp/infinite-monitor/pull/20))
- Zustand hydration pattern restored for SSR compatibility
- Lint and type errors resolved for CI compliance
- CI lockfile compatibility across platforms (Node 20 with `npm install`)

## 0.1.0 — 2026-03-14

Initial open-source release.

### Added

- AI-powered widget builder — describe a widget in plain English and an agent writes, builds, and deploys it live
- Chat sidebar for creating and iterating on widgets with file upload support (drag-and-drop)
- Docker + Vite widget runtime replacing the original Vercel Sandbox approach
- Single container architecture serving all widgets
- SQLite persistence via Drizzle ORM
- Multi-dashboard support with sync and picker
- Dashboard template gallery on empty state
- Sandboxed bash tool for widget agents
- Thinking blocks and planning indicator in chat UX
- Static noise overlay shown while widgets rebuild
- README, MIT license, and `.env.example` for open-source release
- Demo GIF in README

### Fixed

- Widget file persistence, container stability, and dashboard-aware agents
- Proper cleanup of widget files from disk when container stops
- Dashboard and widget deletion from both client and server
- Config-based template registry instead of fragile name matching
- Native dependency handling for just-bash in Next.js config
- Sandbox root prefix stripping from file paths

### Changed

- Replaced Vercel Sandbox with Docker + Vite for widget isolation
- UI polish: thin scrollbars, reasoning block height, grid bottom padding
