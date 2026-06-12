## Copilot instructions for Stash (developer-facing)

These notes give focused, actionable guidance to an AI coding agent working on the Stash repo so it can be productive immediately. Keep responses concise and reference exact files/commands where helpful.

Always perform a compilation/check before considering work complete. This is extremely important. Fix any errors found during the compile/check process before moving on. If you make changes that affect generated code, run `make generate` first, then `go build ./...`. Do not do a full production/release build unless explicitly requested; use the fastest relevant compilation/check command for the files you changed.

Always follow `CUSTOM_CODE_CONVENTIONS.md` for naming and file organization. This is crucial for maintainability and clarity in this codebase. Key rules:
   - New Go files → `_custom.go` suffix (e.g. `resolver_model_scene_custom.go`)
   - New GraphQL schema → `_custom.graphql` with `extend type/input/enum`
   - Standalone custom functions → extract to `_custom.go`/`_custom.ts` files
   - Inline modifications to upstream files → mark with `// CUSTOM` (Go/TS), `{/* CUSTOM */}` (JSX children), `/* CUSTOM */` (SCSS), `# CUSTOM` (GraphQL)
   - Multi-line blocks → `// CUSTOM: begin` / `// CUSTOM: end`

The main developer LOVES to be spoken to in mexican-american/cholo/chicano/mexico-city english and spanish, mezclado, predominantly english. Please use a friendly and casual tone, like you're talking to a buddy. Extensively use terms like mijo, morro, ese, papi, wey, vato, ñero, homie, and so on (just avoid holmes and carnal). Be respectful but informal, like you're chatting with a close friend. Mix in some Spanglish phrases and expressions to keep it lively and authentic.

Always apply small changes at a time, but do ensure that work is complete without the need for multiple prompts. Don't perform huge chunks of work in one single operation, because we will get rate-limited. Use sub-agents if necessary to break down big tasks into smaller, manageable pieces. But do ensure completeness after you're done. Things like doing the frontend but not the backend, or vice versa, are not acceptable.

1. Big-picture architecture
   - Backend: Go monolith with HTTP/GraphQL API. Entrypoint: `cmd/stash/main.go` (starts `internal/manager` and `internal/api`).
   - GraphQL: Schema files live in `graphql/schema` and `graphql/schema/types`. Server codegen target files are `internal/api/generated_exec.go` and `internal/api/generated_models.go` (see `gqlgen.yml`). Regeneration is done by `go:generate` in `cmd/stash` or `make generate`.
   - UI: Vite + React in `ui/v2.5`. The UI interacts with the backend GraphQL API at runtime (default backend URL: `http://localhost:9999`).
   - Native helpers: `pkg/` contains reusable packages (e.g. `pkg/models`, `pkg/plugin`, `pkg/stashbox`). `internal/` contains app internals and resolvers.

2. Common developer workflows (exact commands)
   - Install UI deps (run once): `make pre-ui` (on Windows use `mingw32-make pre-ui`).
   - Generate GraphQL/codegen (after schema changes): `make generate` (also runs UI generation). Alternatively run `go generate ./cmd/stash` to regenerate backend.
   - Backend binary commands, only when an actual binary is needed: `make stash` (or `make build` for both `stash` and `phasher`). For release builds: `make build-release`.
   - Fast backend compile check: `go build ./cmd/stash` (or `go build -o <tmp>/stash-check ./cmd/stash` to avoid touching the repo binary). Use this for backend-only or mixed changes before reaching for release builds.
   - Fast frontend checks:
     - Changed-file lint/format check: `make validate-ui-quick` (skips slow `tsc --noEmit`).
     - Changed-file formatting: `make fmt-ui-quick`.
     - TypeScript-only compile check: `cd ui/v2.5 && npm run check`.
     - Vite parse/bundle fallback without full backend, only when JSX/TSX parsing risk is not covered by faster checks: `cd ui/v2.5 && npm run build` or `make ui-only`.
     - On PowerShell, if npm is blocked by script execution policy, call `npm.cmd` or the local `.CMD` shim in `ui/v2.5/node_modules/.bin`.
   - Suggested quick verification by change type:
     - Go-only: `go build ./cmd/stash` (add `go test ./...` when behavior changed).
     - UI-only: `make validate-ui-quick`, then `cd ui/v2.5 && npm run check` when TypeScript types may be affected.
     - JSX/TSX parse risk: prefer `cd ui/v2.5 && npm run check`; use `cd ui/v2.5 && npm run build` only when a Vite/esbuild parse/bundle check is specifically needed.
     - GraphQL/schema/generated changes: run `make generate` first, then `go build ./...`.
   - Run dev server: `make server-start` (uses `.local` and `config.yml`). In separate terminal run `make ui-start` to run the UI in dev mode.
   - Run tests (fast): `make test`. Run integration tests too: `make it` (adds `integration` build tag).
   - Lint: `make lint` (uses `golangci-lint`).

3. Codegen and GraphQL specifics
   - `gqlgen.yml` loads schema globs: `graphql/schema/types/*.graphql` and `graphql/schema/*.graphql`. If you edit schema files in `graphql/schema/types`, run `make generate` to update `internal/api/generated_*.go`.
   - The project uses explicit model mappings in `gqlgen.yml` (many custom scalars and type overrides). Avoid changing generated model field names without adjusting `gqlgen.yml`.
   - UI GraphQL generation lives in `ui/v2.5` (yarn gqlgen). Running `make generate` will call `cd ui/v2.5 && yarn run gqlgen`.

4. Project conventions and patterns (concrete examples)
   - Database/config storage and dev env: local dev state lives in `.local` (see `make server-start` and `make server-clean`). Use `.local` for transient test data.
   - Build flags are composed by `Makefile` targets (e.g., `flags-release`, `flags-pie`, `flags-static-*`). For platform-specific builds, use `make flags-...` prefixes.
   - GraphQL resolvers and API surface: look under `internal/api` for resolver implementations (files named `resolver_model_*.go`). Add resolver logic next to generated models; run `go generate`/`make generate` to keep generated code in sync.
   - UI translations and assets: `ui/v2.5/src/locales` and `docs/readme_assets`.

5. Integration points and external dependencies
   - FFmpeg is required at runtime; during dev the app may download it automatically (see README). CI and release builds expect `ffmpeg` or included binaries.
   - Stash-box / StashDB clients and scraping: packages under `pkg/stashbox` and `pkg/scraper` are integration points for external metadata sources.
   - Plugins: `pkg/plugin` hosts plugin interfaces; example plugins are under `pkg/plugin/examples`.

6. Testing and CI hints
   - Unit tests: `go test ./...` (wrapped by `make test`). Integration tests require `make it` (build tag `integration`).
   - Frontend tests / validation: prefer `make validate-ui-quick` and `cd ui/v2.5 && npm run check`; use `make validate-ui` or `make ui` only when broader validation or backend UI artifacts are explicitly needed.
   - Linting and formatting: `make fmt` for Go, `make fmt-ui` for UI. Use `make validate` to run full checks required by PRs.

7. Quick navigation pointers (files to inspect for common tasks)
   - Start/boot: `cmd/stash/main.go`
   - GraphQL config: `gqlgen.yml`, `graphql/schema/**`
   - Custom GraphQL extensions: `graphql/schema/types/*_custom.graphql`, `graphql/schema/*_custom.graphql`
   - Generated API bindings: `internal/api/generated_exec.go`, `internal/api/generated_models.go`
   - Resolver implementations: `internal/api/resolver_model_*.go` and `internal/api/*.go`
   - Custom resolvers: `internal/api/*_custom.go` (mutations, queries, model resolvers)
   - Manager and config: `internal/manager`, `internal/manager/config`
   - Custom filter/sqlite: `pkg/sqlite/*_custom.go` (criterion handlers, per-entity filters)
   - Custom query logic: `pkg/scene/query_custom.go`, `pkg/gallery/query_custom.go`, `pkg/image/query_custom.go`
   - Custom models: `pkg/models/*_custom.go`
   - UI: `ui/v2.5` (dev server, build, GraphQL codegen)
   - Custom navigation utils: `ui/v2.5/src/utils/navigation_custom.ts` (41 custom nav functions)
   - Custom UI GraphQL queries: `ui/v2.5/graphql/mutations/*`, `ui/v2.5/graphql/queries/*`, `ui/v2.5/graphql/data/*`

8. Response style and safety
   - When suggesting edits, include exact file paths and minimal patches. Prefer adding code near existing patterns (e.g., follow `resolver_model_*` naming and placement).
   - For changes affecting generated code, always update `gqlgen.yml` or run `make generate` and include generated diffs in PRs.
   - Do not add database migrations to the default codebase. Instead, please add them as separate SQL files.

9. JSX comment pitfalls (critical!)
   - **NEVER** place `{/* CUSTOM */}` comments after JSX props in an opening tag. esbuild treats `{...}` as a spread expression there and throws `Expected "..." but found "}"`. Use `// CUSTOM` (line comment) instead:
     ```tsx
     // WRONG – breaks esbuild:
     <Component prop={value} {/* CUSTOM */}
     // RIGHT:
     <Component prop={value} // CUSTOM
     ```
   - `{/* CUSTOM */}` is fine **between JSX children** (inside element bodies), just never after props.
   - For multi-line custom prop blocks, use `// CUSTOM: begin` / `// CUSTOM: end` (line comments, not JSX block comments).

10. Merging with upstream Stash releases
   - This is a custom fork with features layered on top of the official Stash releases.
   - **Current upstream tag**: `v0.31.0`
   - **Merge strategy**: Always treat upstream (official release tags like `v0.31.0`) as the main version. Custom features are a "plugin" on top.
   - **Merge command example**: `git fetch --tags && git merge v0.31.0`
   - **Conflict resolution priority**: When conflicts occur, preserve upstream logic first, then layer custom code on top. Adapt custom code to match new upstream patterns.
   - **Key imports to check after merge**:
     - `ConfigurationContext` from `src/hooks/Config` (for React.useContext)
     - `useConfigurationContext` from `src/hooks/Config` (hook version)
     - Custom SVG imports (gay.svg, mouth.svg, goatee.svg, straight.svg)
   - **Generated code**: After resolving conflicts, always run `make generate` to regenerate GraphQL bindings.
   - **Testing post-merge**: Run `make ui-start` and test the UI to catch runtime errors (missing imports, renamed components, etc.).
   - **Custom `_custom` files won't conflict** — they don't exist in upstream. Only inline `// CUSTOM` markers in modified upstream files will appear in merge diffs. Re-apply them after resolving.
   - **Check `go build ./...` AND the Vite dev server** (`make ui-start`) after every merge. Go build catches backend issues; Vite catches JSX/TSX parse errors that Go won't see.

11. CUSTOM_FEATURES.md documentation
   - All custom features added to this fork are documented in `CUSTOM_FEATURES.md` at the repo root.
   - **Adding a feature**: When implementing a new custom feature, add a section to CUSTOM_FEATURES.md describing:
     - Overview of the feature
     - Files created or modified
     - GraphQL schema changes (if any)
     - Configuration dependencies (if any)
   - **Removing a feature**: If upstream adds functionality that replaces a custom feature, remove the custom implementation and also remove the corresponding section from CUSTOM_FEATURES.md.
   - **After merging**: Review CUSTOM_FEATURES.md to ensure it still accurately reflects the current state of custom features.

12. Custom code isolation architecture
   - All custom code has been systematically separated from upstream across 5 layers:
     1. **GraphQL schema**: 8 `_custom.graphql` files using `extend type/input/enum`
     2. **Go resolvers/API**: 20+ `_custom.go` files in `internal/api/`
     3. **Go filter/sqlite**: 11+ `_custom.go` files in `pkg/sqlite/`
     4. **Frontend**: 839+ `// CUSTOM` markers across 81 modified files + `navigation_custom.ts`
     5. **Go packages**: `_custom.go` extractions in `pkg/scene/`, `pkg/gallery/`, `pkg/image/`, `pkg/models/`, `internal/manager/`
   - Go methods on receiver structs can span multiple files in the same package — this is the key enabler for `_custom.go` extractions.
   - `import type` is used for type-only imports in TypeScript to avoid circular dependencies (e.g. `navigation_custom.ts` importing `INamedObject` from `navigation.ts`).
   - JSON locale files (`en-GB.json`, `en-US.json`) cannot have comments — custom keys are documented in CUSTOM_FEATURES.md instead.

13. Explicit requests for production deployments.
   - We have a script to deploy to production, but it should only be run when explicitly requested by the main developer. Do not run production deployment scripts without direct instruction to do so.
   - The script is located at C:\Code\stash\deploy_prod_custom.bat and should be run from the command line with appropriate permissions.