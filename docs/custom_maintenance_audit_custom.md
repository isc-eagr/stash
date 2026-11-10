# Custom maintenance audit

Date: 2026-10-28. Scope: fork-owned code and documentation. Existing working-tree changes were preserved. No upstream code, GraphQL contracts, database schema, or production data was changed by this pass.

## Review

The pass searched custom Go/TypeScript declarations and their references, scanned 265 custom TypeScript/TSX files for duplicate function bodies, checked custom styles against production references, and reviewed legacy paths and existing custom test coverage. Dynamic CSS classes, framework-generated classes, database upgrades, and saved-data readers were retained when they still serve live behavior. TypeScript's extra unused-symbol checks identified upstream findings; those files were left alone.

This is an evidence-based cleanup, not a claim that every remaining branch is necessary or that every custom feature has exhaustive coverage. The earlier performance and information-design audits are dated snapshots, not current task lists.

## Fixed

| Finding                                                                                                                     | Change                                                                                                                                               | Regression coverage                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Activity/Quality percentages could use the longest secondary video while scene cards and Scene Detail use the primary video | Primary-file clipping and denominators across custom scene/studio filters, sorts, dashboards, studio card activity, and activity-time totals         | `TestActivityQualityUsesPrimaryFileCustom` asserts expected percentages for both scalar and batched scene/studio queries; `TestSceneStatsActivityTimeQueryCustom` includes a longer secondary video |
| Release history decrement removed the latest inserted row rather than the newest event                                      | Order deletions by event date, with row ID breaking ties; dated O's precede retroactive O's                                                          | `TestReleaseHistoryDecrementRemovesLatestDateCustom` covers manual older dates inserted later, play/O history, and retained retroactive O's                                                         |
| Seven interval union/duration implementations could drift                                                                   | Scene role strips, card insights, partner stats, negative-marker totals, loop selection, and playback boundaries reuse the existing interval utility | `activityIntervals_custom.test.ts` compares consumers, nested/duplicate/touching ranges, preserved inputs, and labelled loops split by overlapping skip ranges                                      |
| Nut and Feet navigation repeated the same full filter builder                                                               | Both public link names reuse the existing implementation                                                                                             | `performerEventNavigation_custom.test.ts` round-trips links through the real URL/filter parser and checks tag descendants and top-role scope                                                        |
| O timelines and Rating Advisor O previews duplicated timestamp formatting                                                   | Shared app-locale formatter                                                                                                                          | `appDateTime_custom.test.ts` covers locale changes and unreadable values                                                                                                                            |
| Task Progress imported goal decoding was immediately overwritten by the current tagged-item count                           | Removed dead goal/initial-value parsing, the unused stored tag name, and the redundant math dependency; preserved the tracker importer               | Existing import-decoding and fixed-goal tests                                                                                                                                                       |
| Unused statistics scope-note CSS                                                                                            | Removed its unreferenced rule                                                                                                                        | Targeted Stylelint; no visible behavior change                                                                                                                                                      |
| Scene-only O Stats fixtures lacked tables now assumed by production                                                         | Shared empty release-table fixture, with the related matches table in the Scene Stats fixture                                                        | Existing O Stats, date-range, cohort, rating-average, and vato aggregate tests now exercise the production queries                                                                                  |
| Documentation recommended manual SQL and absent rating repair scripts                                                       | Replaced those instructions with startup-bootstrap and canonical rubric behavior; marked historical audits explicitly                                | Markdown formatting and diff checks                                                                                                                                                                 |

## Verification

Passed:

- `npm.cmd run test:custom`: 175 test files, including 237 Node subtests; no failures.
- `npm.cmd run check`, targeted ESLint, Stylelint, and Prettier, and `git diff --check`.
- `npm.cmd run build`: modern and legacy UI bundles. Vite reported chunk-size warnings; this pass did not measure a bundle-size regression.
- `go test -p 2 ./pkg/sqlite ./internal/api ./internal/manager ./pkg/scene ./pkg/sitesync ./pkg/stashbox`.
- `go build -p 2 -o .local/stash-audit-check.exe ./cmd/stash`; the temporary executable was removed after verification.

On this Windows host GCC could not load inside the sandbox, so Go compilation and tests used the normal host compiler outside it. Existing diffs in upstream files were compared against the initial working-tree snapshot and remained unchanged.

No development servers or installed applications were started. No deployment was performed. Feature ownership, changed files, schema/configuration dependencies, and behavioral coverage remain documented under their existing entries in [CUSTOM_FEATURES.md](../CUSTOM_FEATURES.md).
