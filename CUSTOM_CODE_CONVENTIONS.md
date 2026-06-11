# Custom Code Conventions

This document describes the naming conventions and code organization patterns used to isolate custom features from the upstream Stash codebase. All AI agents and developers working on this fork **must** follow these conventions.

## Upstream Reference

- **Upstream tag**: `v0.31.0` — this is the source of truth for unmodified upstream code.
- **Branch**: `local-develop-0.31.0` — the working branch with custom features layered on top.
- **Any deviation** from the upstream tag **must** be considered a customization and marked accordingly.

---

## 1. File Naming: `_custom` Suffix

### New Go files

When adding entirely new Go source files, name them with a `_custom` suffix before the extension:

```
pkg/models/model_scene_release_custom.go      # new model
pkg/scene/query_custom.go                      # extracted custom functions
internal/api/resolver_model_scene_release_custom.go  # new resolver
pkg/sqlite/scene_release_custom.go             # new sqlite layer
```

### Extracted Go files

When upstream functions are heavily extended or new functions are added alongside upstream ones, **extract** the custom code into a `_custom.go` file in the same package:

```
pkg/scene/query.go          # upstream (restored to v0.31.0 + minimal CUSTOM markers)
pkg/scene/query_custom.go   # 17 extracted custom functions
```

Go allows methods on receiver structs to span multiple files in the same package, making this split seamless.

### New TypeScript/React files

Standalone custom utility modules use the `_custom` suffix:

```
ui/v2.5/src/utils/navigation_custom.ts   # 41 custom navigation functions
```

Entirely new React components and pages are placed in their own directories/files and are inherently custom (no upstream counterpart), so they don't need the suffix.

### GraphQL schema files

Custom schema extensions live in `_custom.graphql` files:

```
graphql/schema/types/scene-marker_custom.graphql
graphql/schema/types/performer_custom.graphql
graphql/schema/scene-release_custom.graphql
```

These use GraphQL's `extend type`, `extend input`, and `extend enum` syntax to add fields without modifying upstream schema files.

### SQL migration files

Custom migrations are standalone `.sql` files at the repo root (not in the upstream migration system):

```
scene_releases.up.sql
performer_additional_images.up.sql
scene_loop_presets.up.sql
scene_negative_markers.up.sql
```

---

## 2. Inline Comment Markers: `// CUSTOM`

When custom code must live inside an upstream file (e.g., modifications to existing functions, hookups in config structs, import additions), use `// CUSTOM` comment markers.

### Go

```go
// Single line addition
SceneReleaseRepository models.SceneReleaseReaderWriter // CUSTOM

// Multi-line block
// CUSTOM: begin
func (qb *SceneStore) CountByStudioIDAndPerformerID(ctx context.Context, studioID int, performerID int) (int, error) {
    // ...
}
// CUSTOM: end

// Modified upstream function
func CountByStudioID(ctx context.Context, studioID int, performerID *string) (int, error) { // CUSTOM: added performerID parameter
```

### TypeScript / JavaScript

```typescript
// Single line
import { customFunction } from "./custom_module"; // CUSTOM

// Block
// CUSTOM: begin
const customComponent = React.lazy(() => import("./CustomPage"));
// CUSTOM: end
```

### JSX / TSX (inside JSX expressions)

```tsx
{/* CUSTOM */}
<CustomComponent />

{/* CUSTOM: begin */}
<div className="custom-section">
  <CustomWidget />
</div>
{/* CUSTOM: end */}
```

### SCSS / CSS

```scss
/* CUSTOM */
.custom-class { color: red; }

/* CUSTOM: begin */
.custom-section {
  display: flex;
  // ...
}
/* CUSTOM: end */
```

### GraphQL (schema and query files)

```graphql
# CUSTOM
effective_date: String

# CUSTOM: begin
scene_loop_presets: [SceneLoopPreset!]!
scene_negative_markers: [SceneNegativeMarker!]!
# CUSTOM: end
```

### JSON

JSON does not support comments. Custom keys in locale files (e.g., `en-GB.json`, `en-US.json`) are documented in `CUSTOM_FEATURES.md` but cannot be marked inline.

---

## 3. Decision Guide: Extract vs. Mark Inline

| Scenario | Action |
|----------|--------|
| Entirely new standalone functions (Go) | Extract to `_custom.go` |
| New standalone utility functions (TS) | Extract to `_custom.ts` |
| New GraphQL types/fields | New `_custom.graphql` with `extend` |
| Modified upstream function signature | Inline `// CUSTOM` marker |
| Added import in upstream file | Inline `// CUSTOM` at end of import |
| New route/component hookup in App.tsx | Inline `// CUSTOM` markers |
| New React component/page (no upstream) | New file, no suffix needed |
| Added field to upstream struct | Inline `// CUSTOM` marker |

---

## 4. Merge Strategy with Upstream

When merging a new upstream release:

1. `git fetch --tags && git merge <new-tag>`
2. **`_custom` files**: Will NOT conflict (they don't exist in upstream). Verify they still compile.
3. **Inline `// CUSTOM` markers**: Will appear in merge conflicts. Resolve by preserving upstream logic first, then re-applying custom lines with markers.
4. **`extend` GraphQL**: Will NOT conflict. Verify schema still validates.
5. After resolving conflicts, run `make generate` then `go build ./...`.
6. Review `CUSTOM_FEATURES.md` to ensure accuracy.

---

## 5. Fast Compilation and Validation Checks

Use these quicker checks during development instead of defaulting to full production or release builds every time. Agents should complete the relevant compilation/check, not a full production/release build, unless explicitly requested.

- **Backend compile check:** `go build ./cmd/stash`
  - Use `go build -o <tmp>/stash-check ./cmd/stash` if you want to avoid touching the repo binary.
  - If Git VCS stamping fails in a local checkout, use `go build -buildvcs=false ./cmd/stash` for a fast compile sanity check.
- **Frontend changed-file check:** `make validate-ui-quick`
  - Runs lint/style/format checks only on changed UI files and intentionally skips slow `tsc --noEmit`.
- **Frontend changed-file formatting:** `make fmt-ui-quick`
- **TypeScript compile check:** `cd ui/v2.5 && npm run check`
- **Vite parse/bundle fallback:** `cd ui/v2.5 && npm run build` or `make ui-only`
  - Use this only when JSX/TSX parsing risk is not covered by faster checks.
- **Generated-code changes:** run `make generate` first, then `go build ./...`.
- **PowerShell npm note:** if `npm` is blocked by script execution policy, call `npm.cmd` or the local `.CMD` shim in `ui/v2.5/node_modules/.bin`.

These are fast checks, not replacements for broader tests when behavior or generated code changes.

---

## 6. File Inventory Summary

### Extracted `_custom` files (Phase 1-5)

**GraphQL Schema (8 files):**
- `graphql/schema/types/scene-marker_custom.graphql`
- `graphql/schema/types/performer_custom.graphql`
- `graphql/schema/types/scene_custom.graphql`
- `graphql/schema/types/studio_custom.graphql`
- `graphql/schema/types/filters_custom.graphql`
- `graphql/schema/types/tag_custom.graphql`
- `graphql/schema/scene-release_custom.graphql`
- `graphql/schema/schema_custom.graphql`

**Go Resolvers / API (20 files):**
- `internal/api/resolver_model_scene_release_custom.go`
- `internal/api/resolver_model_scene_marker_custom.go`
- `internal/api/resolver_model_performer_custom.go`
- `internal/api/resolver_model_performer_image_custom.go`
- `internal/api/resolver_model_scene_custom.go`
- `internal/api/resolver_model_studio_custom.go`
- `internal/api/resolver_model_tag_custom.go`
- `internal/api/resolver_mutation_scene_release_custom.go`
- `internal/api/resolver_mutation_scene_custom.go`
- `internal/api/resolver_mutation_scene_marker_custom.go`
- `internal/api/resolver_query_scene_release_custom.go`
- `internal/api/resolver_query_stats_custom.go`
- `internal/api/resolver_query_ethnicity_custom.go`
- `internal/api/resolver_query_find_scene_marker_playlist_custom.go`
- `internal/api/resolver_query_find_performer_co_performers_custom.go`
- `internal/api/custom_fields.go` (new file, inherently custom)
- Plus others in `internal/api/` with `_custom` suffix

**Go Filter / SQLite (11+ files):**
- `pkg/sqlite/criterion_handlers_custom.go`
- `pkg/sqlite/scene_filter_custom.go`
- `pkg/sqlite/performer_filter_custom.go`
- `pkg/sqlite/scene_marker_filter_custom.go`
- `pkg/sqlite/gallery_filter_custom.go`
- `pkg/sqlite/image_filter_custom.go`
- `pkg/sqlite/studio_custom.go`
- `pkg/sqlite/scene_release_custom.go`
- `pkg/sqlite/scene_loop_preset_custom.go`
- `pkg/sqlite/scene_negative_marker_custom.go`
- Plus table/migration files

**Go Models (6 files):**
- `pkg/models/model_performer_image_custom.go`
- `pkg/models/model_scene_release_custom.go`
- `pkg/models/scene_loop_preset_custom.go`
- `pkg/models/scene_negative_marker_custom.go`
- `pkg/models/mocks/SceneLoopPresetReaderWriter_custom.go`
- `pkg/models/mocks/SceneNegativeMarkerReaderWriter_custom.go`

**Go Query/Service (4 files):**
- `pkg/scene/query_custom.go`
- `pkg/gallery/query_custom.go`
- `pkg/image/query_custom.go`
- `internal/manager/scene_custom.go`

**Frontend (1 extraction):**
- `ui/v2.5/src/utils/navigation_custom.ts`

### Files with inline `// CUSTOM` markers

839+ markers across 81 modified frontend files, 50 markers across 10 frontend GraphQL files, and markers in ~30 Go backend files. See conversation history for detailed per-file counts.
