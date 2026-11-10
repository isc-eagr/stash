# Upgrading the fork to a new upstream release

This is the runbook for moving the fork onto a new official Stash tag. It was written while moving from v0.31.1 to v0.32.0; the release log at the end records the decisions made for each upgrade.

## Branch model

Each release gets its own long-lived branch named after the upstream tag: `local-develop-<version>`. The new branch starts at the tag and takes every custom change from the previous branch in one merge, so upstream history stays the base and custom work sits on top.

## Steps

1. **Fetch the tag and check it is the official one.**

   ```bash
   git fetch upstream --tags
   git ls-remote upstream refs/tags/v0.32.0
   git rev-parse v0.32.0^{commit}
   ```

   Both hashes must match. Check that the previous tag is an ancestor (`git merge-base <old-tag> <new-tag>` returns the old tag).

2. **Read the release notes** in `ui/v2.5/src/docs/en/Changelog/v<version>.md` and list every upstream feature that touches a custom area. Use `CUSTOM_FEATURES.md` to find the custom side.

3. **Create the branch from the tag and merge the previous branch without committing.**

   ```bash
   git switch -c local-develop-0.32.0 v0.32.0
   git merge --no-commit --no-ff local-develop-0.31.1
   git checkout --conflict=diff3 -- $(git diff --name-only --diff-filter=U)
   ```

   `ours` is upstream and `theirs` is the fork. The diff3 view shows the common base, which tells you what each side actually changed. The developer commits the merge.

4. **Resolve conflicts.** For each file, compare the size of the two sides (`git diff <old-tag> <old-branch> --numstat -- <file>` against `git diff <old-tag> <new-tag> --numstat -- <file>`):
   - Small custom diff, large upstream rewrite: take upstream's file and reapply the custom diff by hand.
   - Large custom diff, small upstream change: keep the custom side and reapply upstream's change.
   - Otherwise resolve hunk by hunk.

   Rules:
   - **Upstream added something the fork already had:** keep upstream's version and remove the custom one. Fold in only the parts upstream lacks (for example release O's, performer scope, sortable headers), with `CUSTOM` markers.
   - **Unrelated custom features:** keep them working on top of upstream's new APIs.
   - **Auto-merged code can still be wrong.** Look past the conflict hunks: a merge can keep a custom function body under an upstream signature, or keep both a renamed and an old parameter.
   - **Generated files** (`internal/api/generated_*.go`, `ui/v2.5/src/core/generated-graphql.ts`, `pnpm-lock.yaml`): take upstream's and regenerate. Mocks in `pkg/models/mocks` are partly hand-written (`*_custom.go`); resolve them to upstream and add custom mock methods in a `_custom.go` file. Running mockery over the whole folder duplicates the custom mocks.

5. **Regenerate and build the backend.**

   ```bash
   go generate ./cmd/stash
   go build ./...
   go test -count=1 ./...
   go test -count=1 -tags "sqlite_stat4 sqlite_math_functions integration" ./...
   ```

   The integration run needs the same SQLite tags as `make it`; without `sqlite_math_functions` the random sorts fail with `no such function: mod`.

6. **Install UI dependencies and regenerate UI types** (the UI uses pnpm since v0.32.0).

   ```bash
   cd ui/v2.5
   pnpm install
   pnpm run gqlgen
   pnpm run check
   pnpm run lint
   pnpm run format-check
   pnpm run test:custom
   pnpm run build
   ```

   On Windows with `core.autocrlf=true`, `format-check` reports files that git checked out with CRLF line endings. Those are not real problems; the files are LF in the repository.

7. **Test in the app** on the dev backend (port 9998) and Vite, following "Dev environment for testing" in `Agents.md`. A new release usually adds numbered migrations, which upgrade the database on first start. Run against a copy of the testing database (a scratch `config.yml` whose `database:` points at the copy) so the real testing database is only migrated with the developer's OK. Check every screen that the release notes or the conflicts touched, then stop the servers and confirm the ports are free.

8. **Update the docs:** the base version in `CUSTOM_FEATURES.md`, any feature entry whose behavior changed, `Agents.md`/`CLAUDE.md` if tooling changed, and the release log below.

## Release log

### v0.31.1 to v0.32.0

Merge: 71 conflicted files. Upstream also replaced ESLint and Prettier with Biome, moved scripts to pnpm, and upgraded React 17 to 18, TypeScript 4.8 to 5.9, Vite 5 to 7, and Stylelint 15 to 17.

Redundant features (upstream kept, custom removed or folded in):

- **Studios List view.** Upstream's `StudioListTable` is the base. The fork adds sortable headers, the temporary active-sort column, and the custom metric columns. Custom columns that duplicated upstream's (scene, image, gallery, O, and child studio counts) were removed. Counts come from the batched `studio_list_stats`, which gained `scene_count_all`, `performer_count_all`, `o_counter_all`, and `scene_marker_count`.
- **Studio O count sort.** The custom `o_count` sort was removed in favor of upstream's `o_counter` / `o_counter_all`, which now add O's on releases credited to the studio. Saved Studio filters sorted by the old `o_count` key must be re-saved with "O Count".
- **Sub-studio counts on cards and lists.** Cards and the List view follow upstream's "Include sub-studio content" setting. `StudioListStats.o_counter` is now direct-only, like upstream's; `o_counter_all` includes sub-studios.
- **Pagination footer clicks** (upstream #6895) replaced the custom `pointer-events` change.
- **Autoplay during source fallback** (upstream #7016) replaced the custom `playbackRequested` tracking in the source selector. The custom paused-state handling for manual stream changes stays.
- **Scene refresh after edits** uses upstream's `onRefreshScene` instead of the custom `onRefetch` prop.

Upstream features wired into custom code:

- Production Date: performer age sort and the scene card age metric use production date first, then the effective date; the Scene Tagger save preview includes it; Scene Details shows it with the descriptive fields.
- Studio `o_counter(depth:)`: the resolver keeps the custom `performer_id` argument and calls `OCountByStudioIDCustom` for performer scope and release O's.
- Marker preview duration settings: the custom simple-marker preview skip wraps upstream's new preview call.
- New locale strings use the fork's vocabulary ("vato", "movie").

Also fixed while testing: the custom `SceneStore.FindByGalleryID` returned an empty slice instead of nil, which failed upstream's integration test; the scene player's marker setup no longer throws when a player is disposed before it is ready; and `semanticPalette_custom.scss` no longer uses the Sass `if()` function deprecated by the newer Sass.

Tooling fixes in custom code: React 18 `children` typing, Biome lint fixes (forEach callbacks, ESLint comments converted to `biome-ignore` with reasons), Biome formatting, a Stylelint 17 suppression for theme focus selectors, and test loader updates for React 18 package exports and extensionless `lodash-es` imports.
