# Stash coding instructions

Work in small, complete changes. Keep responses concise and conversational, mostly English with natural Mexican Spanish (mijo, ese, wey); avoid "holmes" and "carnal". Mention a clear follow-up improvement in a separate final section only when one is evident.

## Code and documentation

- This is a custom fork of upstream Stash. Follow [CUSTOM_CODE_CONVENTIONS.md](CUSTOM_CODE_CONVENTIONS.md) when editing code: put standalone Go/TypeScript additions in `_custom.go`/`_custom.ts`, GraphQL extensions in `_custom.graphql`, and mark changes inside upstream files with `CUSTOM` comments. New React components may use normal filenames.
- In JSX, `{/* CUSTOM */}` belongs between children, never inside an opening tag after props; use a line comment for prop edits. JSON cannot contain comments.
- Put custom database migrations in separate SQL files at the repo root, outside the upstream migration system.
- Keep UI copy short. Add explanatory text only when it prevents a likely mistake.
- Document independently user-visible custom features in [CUSTOM_FEATURES.md](CUSTOM_FEATURES.md): overview, changed files, tests, schema changes, and config dependencies. Fold styling, copy, performance, refactors, and tests for existing features into their parent entry. Remove an entry when upstream replaces the feature.

## Verification

Always run a relevant compile/check before finishing and fix errors caused by the change. Use the narrowest check that covers the change; do not run production/release builds unless requested. Add focused tests for every new feature at the layer where its behavior can regress.

| Change | Minimum checks |
| --- | --- |
| Docs only | `git diff --check`; Prettier on touched Markdown |
| Go | `go build ./cmd/stash`; add focused tests for behavior changes |
| GraphQL/schema/generated | `mingw32-make generate` on Windows (`make generate` elsewhere), then `go build ./...` for generated/shared-package changes or `go build ./cmd/stash` for resolver/query-only changes; check generated UI types when touched |
| Simple UI styling/copy | Targeted Prettier and applicable Stylelint/ESLint; `git diff --check` |
| Ordinary TS/TSX | Targeted ESLint and Prettier; `cd ui/v2.5 && npm.cmd run check` when types, imports, props, hooks, or generated UI types change |
| Bundle-risk UI (Vite/config/deps, routing, lazy loading, shared infrastructure, substantial refactor) | Ordinary UI checks plus `cd ui/v2.5 && npm.cmd run build` |

On Windows, use `npm.cmd` if PowerShell blocks `npm`. If `mingw32-make validate-ui-quick` fails with `-n was unexpected at this time`, run direct `npm.cmd` lint/format commands. Follow an explicit request to skip validation.

## Where to work

- Backend entrypoint: `cmd/stash/main.go`; GraphQL schema: `graphql/schema/**`; resolvers and generated bindings: `internal/api/`; query/filter code: `pkg/scene`, `pkg/gallery`, `pkg/image`, `pkg/sqlite`.
- UI: `ui/v2.5`; UI GraphQL operations: `ui/v2.5/graphql/`; custom navigation: `ui/v2.5/src/utils/navigation_custom.ts`.
- GraphQL generation updates backend and UI bindings. Include generated diffs when committing or opening a PR.

## Dev environment for testing

- The installed app usually owns port 9999 and uses the production database. Test against the dev backend on another port instead: run `go run ../cmd/stash --port 9998` from `.local` with `STASH_CONFIG_FILE=config.yml` (testing database), and start Vite with `VITE_APP_PLATFORM_PORT=9998`. `.claude/launch.json` has both configurations. Confirm the UI's GraphQL requests go to 9998 before testing.
- Always bring the dev environment down when you finish testing: stop every dev backend and Vite server you started, then confirm their ports are free and no `go run` build of `stash` is still running. Do this even when the check fails or the task is interrupted.

## Upstream merges and production

- Upstream is the main version; reapply custom code on top when resolving conflicts. After an upstream merge, run `make generate`, `go build ./...`, and `make ui-start` to catch UI parse/runtime errors; review `CUSTOM_FEATURES.md`.
- Start the installed application only when directly requested. Run `C:\Stash\stash.exe` and `C:\Amt\Stash\stash.exe` directly, without extra arguments.
- Deploy to production only when directly requested by the main developer. Run `C:\Code\stash\deploy_prod_custom.bat` directly, without extra arguments.
