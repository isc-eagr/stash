# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@Agents.md

The imported file holds the shared project instructions (tone, custom-code conventions, verification table, deploy rules); keep editing it there so Codex and Claude stay in sync. The sections below add commands and architecture that it doesn't cover.

## Commands

On Windows use `mingw32-make` in place of `make`, and `npm.cmd` if PowerShell blocks `npm`.

- Install UI deps (once): `make pre-ui`
- Regenerate GraphQL bindings (backend + UI): `make generate`. Backend only: `go generate ./cmd/stash`.
- Fast backend compile check: `go build ./cmd/stash`. Use `go build -o <tmp>/stash-check ./cmd/stash` to avoid touching a repo binary.
- Backend tests: `make test` (`go test ./...`); integration: `make it` (adds the `integration` tag). Single test: `go test ./pkg/sqlite -run TestName`.
- Backend lint: `make lint` (golangci-lint).
- Dev servers: `make server-start` (uses `.local` and `config.yml`; `make server-clean` wipes it), then `make ui-start` in another terminal (Vite, talks to the backend at `http://localhost:9999`). When the installed app already holds 9999, use the `stash-dev-backend-9998` and `stash-dev-ui-9998` entries in `.claude/launch.json`. Always stop every dev server you started once testing is done and confirm the ports are free (see "Dev environment for testing" in `Agents.md`).
- UI quick checks (from `ui/v2.5`): `make validate-ui-quick` / `make fmt-ui-quick` (changed files only, skips tsc), `npm run check` (`tsc --noEmit`), `npm run lint`, `npm run format-check`.
- Custom UI tests (from `ui/v2.5`): `npm run test:custom`. It runs every `tests/*.test.ts` through `tests/runCustomTests_custom.ts` with a custom loader. To run one file, import it the same way the runner does with `node --no-warnings --loader ./tests/customTestLoader_custom.mjs <file>`.

## Architecture

Go monolith serving a GraphQL API and the built React UI. Entry point `cmd/stash/main.go` starts `internal/manager` (long-running services, jobs, config) and `internal/api` (HTTP + resolvers). `pkg/` holds reusable domain packages (`pkg/scene`, `pkg/gallery`, `pkg/image`, `pkg/sqlite`, `pkg/models`, ...); `internal/` holds app wiring.

- **GraphQL flow:** schema in `graphql/schema/{,types/}*.graphql` -> gqlgen (`gqlgen.yml`, with many explicit model/scalar mappings) -> `internal/api/generated_*.go`, and UI operations in `ui/v2.5/graphql/` -> generated UI types. Editing schema or UI operations requires `make generate`. Resolvers live in `internal/api/resolver_*.go`.
- **Data layer:** SQLite via `pkg/sqlite`. Domain packages define filters and queries; `pkg/sqlite` implements them, so a new filter or sort usually touches the filter type in `pkg/models`, the criterion handlers, and a UI criterion.
- **Custom database changes:** custom SQL migrations (`*.up.sql` at the repo root) are deliberately outside upstream's numbered migrations in `pkg/sqlite/migrations` (`appSchemaVersion` in `pkg/sqlite/database.go`). Do not add custom tables there.
- **Custom-code layering:** large custom features (scene releases, progress trackers, markers, insights, ratings) are mostly split into `*_custom.go` / `*_custom.ts` / `*_custom.graphql` files next to the upstream code they extend, with small `CUSTOM`-marked hooks in upstream files. When tracing a feature, start from its entry in `CUSTOM_FEATURES.md`; it lists changed files, tests, and schema changes.
- **UI:** Vite + React + Apollo in `ui/v2.5/src`, translations in `ui/v2.5/src/locales`. Custom navigation helpers live in `ui/v2.5/src/utils/navigation_custom.ts`.
- **Runtime dependency:** ffmpeg is required; stash-box and scrapers (`pkg/stashbox`, `pkg/scraper`) and plugins (`pkg/plugin`) are the external integration points.

## Workflow notes

- Keep changes small per step, but finish both backend and frontend of a feature so nothing is left half-wired.
