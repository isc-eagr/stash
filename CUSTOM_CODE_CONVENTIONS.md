# Custom code conventions

Stash is a fork of upstream Stash. Keep upstream code recognizable and isolate custom additions so future merges can preserve upstream changes first.

## Files

| Change | Placement |
| --- | --- |
| New Go functions or types | A `_custom.go` file in the same package (for example, `pkg/scene/query_custom.go`) |
| Standalone TypeScript utilities | A `_custom.ts` file |
| New React page or component with no upstream counterpart | Its own file; `_custom` suffix is optional |
| New GraphQL fields or types | A `_custom.graphql` file using `extend type`, `extend input`, or `extend enum` |
| Custom database migration | A standalone `.sql` file at the repository root, outside the upstream migration system |

Go methods may be defined in a separate `_custom.go` file from their receiver type. Prefer extraction for standalone code; retain only necessary hookups and changes to upstream functions inline.

## Inline markers

Mark every custom change inside an upstream file:

| File | Single-line marker | Multi-line block |
| --- | --- | --- |
| Go, TypeScript, JavaScript | `// CUSTOM` | `// CUSTOM: begin` / `// CUSTOM: end` |
| JSX children | `{/* CUSTOM */}` | `{/* CUSTOM: begin */}` / `{/* CUSTOM: end */}` |
| SCSS/CSS | `/* CUSTOM */` | `/* CUSTOM: begin */` / `/* CUSTOM: end */` |
| GraphQL | `# CUSTOM` | `# CUSTOM: begin` / `# CUSTOM: end` |

For an import or changed function signature, put a short `// CUSTOM` comment on the affected line. In JSX opening tags, never place `{/* CUSTOM */}` after props: esbuild parses it as an invalid spread. Use a line comment for prop changes; reserve JSX block comments for children. JSON cannot contain comments, so document custom locale keys in `CUSTOM_FEATURES.md`.

## Merging upstream

Merge the new official tag, resolve conflicts by preserving upstream behavior first, then reapply custom code and markers. `_custom` files and GraphQL extensions usually avoid direct conflicts but still need compatibility checks. After resolving, run generation and the checks in [Agents.md](Agents.md), then review `CUSTOM_FEATURES.md`.
