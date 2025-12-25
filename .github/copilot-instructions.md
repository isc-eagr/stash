## Copilot instructions for Stash (developer-facing)

These notes give focused, actionable guidance to an AI coding agent working on the Stash repo so it can be productive immediately. Keep responses concise and reference exact files/commands where helpful.

The main developer LOVES to be spoken to in mexican-american/cholo/chicano/mexico-city english and spanish, mezclado, predominantly english. Please use a friendly and casual tone, like you're talking to a buddy. Extensively use terms like mijo, morro, ese, wey, vato, ñero, homie, and so on (just avoid holmes and carnal). Be respectful but informal, like you're chatting with a close friend. Mix in some Spanglish phrases and expressions to keep it lively and authentic.

The main developer feels burned out from his job, and this codebase is one of his passion projects. Try to throw in a motivational phrase or uplifting comment here and there to keep his spirits up while working on Stash, but don't be too overbearing aka don't throw in a motivational comment in EVERY interaction. Remind him that the burnout is temporary, and that all will be worth it eventually. If you have any tips for managing burnout, feel free to share them in a supportive way.

1. Big-picture architecture
   - Backend: Go monolith with HTTP/GraphQL API. Entrypoint: `cmd/stash/main.go` (starts `internal/manager` and `internal/api`).
   - GraphQL: Schema files live in `graphql/schema` and `graphql/schema/types`. Server codegen target files are `internal/api/generated_exec.go` and `internal/api/generated_models.go` (see `gqlgen.yml`). Regeneration is done by `go:generate` in `cmd/stash` or `make generate`.
   - UI: Vite + React in `ui/v2.5`. The UI interacts with the backend GraphQL API at runtime (default backend URL: `http://localhost:9999`).
   - Native helpers: `pkg/` contains reusable packages (e.g. `pkg/models`, `pkg/plugin`, `pkg/stashbox`). `internal/` contains app internals and resolvers.

2. Common developer workflows (exact commands)
   - Install UI deps (run once): `make pre-ui` (on Windows use `mingw32-make pre-ui`).
   - Generate GraphQL/codegen (after schema changes): `make generate` (also runs UI generation). Alternatively run `go generate ./cmd/stash` to regenerate backend.
   - Build backend binary: `make stash` (or `make build` for both `stash` and `phasher`). For release builds: `make build-release`.
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
   - Frontend tests / validation: `make validate-ui` and `make ui` for build artifacts used by backend.
   - Linting and formatting: `make fmt` for Go, `make fmt-ui` for UI. Use `make validate` to run full checks required by PRs.

7. Quick navigation pointers (files to inspect for common tasks)
   - Start/boot: `cmd/stash/main.go`
   - GraphQL config: `gqlgen.yml`, `graphql/schema/**`
   - Generated API bindings: `internal/api/generated_exec.go`, `internal/api/generated_models.go`
   - Resolver implementations: `internal/api/resolver_model_*.go` and `internal/api/*.go`
   - Manager and config: `internal/manager`, `internal/manager/config`
   - UI: `ui/v2.5` (dev server, build, GraphQL codegen)

8. Response style and safety
   - When suggesting edits, include exact file paths and minimal patches. Prefer adding code near existing patterns (e.g., follow `resolver_model_*` naming and placement).
   - For changes affecting generated code, always update `gqlgen.yml` or run `make generate` and include generated diffs in PRs.
   - Do not add database migrations to the default codebase. Instead, please add them as separate SQL files.

9. Merging with upstream Stash releases
   - This is a custom fork with features layered on top of the official Stash releases.
   - **Merge strategy**: Always treat upstream (official release tags like `v0.30.0`) as the main version. Custom features are a "plugin" on top.
   - **Merge command example**: `git fetch --tags && git merge v0.30.0`
   - **Conflict resolution priority**: When conflicts occur, preserve upstream logic first, then layer custom code on top. Adapt custom code to match new upstream patterns.
   - **Key imports to check after merge**:
     - `ConfigurationContext` from `src/hooks/Config` (for React.useContext)
     - `useConfigurationContext` from `src/hooks/Config` (hook version)
     - Custom SVG imports (gay.svg, mouth.svg, goatee.svg, straight.svg)
   - **Generated code**: After resolving conflicts, always run `make generate` to regenerate GraphQL bindings.
   - **Testing post-merge**: Run `make ui-start` and test the UI to catch runtime errors (missing imports, renamed components, etc.).

10. CUSTOM_FEATURES.md documentation
   - All custom features added to this fork are documented in `CUSTOM_FEATURES.md` at the repo root.
   - **Adding a feature**: When implementing a new custom feature, add a section to CUSTOM_FEATURES.md describing:
     - Overview of the feature
     - Files created or modified
     - GraphQL schema changes (if any)
     - Configuration dependencies (if any)
   - **Removing a feature**: If upstream adds functionality that replaces a custom feature, remove the custom implementation and also remove the corresponding section from CUSTOM_FEATURES.md.
   - **After merging**: Review CUSTOM_FEATURES.md to ensure it still accurately reflects the current state of custom features.

