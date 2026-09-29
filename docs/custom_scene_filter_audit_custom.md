# Custom scene filter audit

Audited September 27, 2026. Scope is the fork's added Scene filters, identified against upstream v0.31.0. Upstream filter implementations were excluded. Changes are local and have not been deployed.

## Changes

### Activity and Quality percentages

Previously, every scene-filter handler built all eight large scalar percentage expressions, even with no percentage selected. Selected filters repeatedly merged intervals and looked up duration per scene. Adding another condition to Standard or Outstanding could also produce SQLite `parser stack overflow` errors.

Scene percentage filters now build only selected metrics and reuse the batched interval calculation used by the custom scene sorts. Local non-percentage conditions narrow the candidates first. Direct API fields and grouped Activity/Quality fields use the same implementation; multiple constraints on one category share its calculation.

The existing semantics remain: whole-number rounding, strict activity tags, interval merging, clipping rules, zero-duration handling, and all numeric operators. Metric joins remain active in count queries. Each metric subquery owns its aliases so nested AND/OR/NOT filters and percentage sorts can coexist. HAVING clauses do not restrict a metric's candidate set, because the repository combines HAVING branches separately from WHERE branches.

### Scene Type, Versatile Scenes, and Circular Oral

Tag-family matching now produces matching marker IDs once using primary and secondary tag indexes. When other local criteria narrow the scene set, marker work is restricted to that set. Recursive tag traversal deduplicates ancestry paths and terminates on cycles. Tag IDs are bound parameters instead of interpolated SQL.

Versatile Scenes aggregates Top/Bottom participation once per scene performer, then checks that every assigned scene performer has both roles. Circular Oral checks both roles for every performer assigned to the same qualifying marker. Empty performer sets still do not qualify; marker-only performers do not change the Versatile requirement.

Scene Type keeps its existing Sex/Oral/Solo exclusions, independent Facial criterion, and AND combination of selected types. Primary and secondary tags, descendants, missing configuration, and nullable orphan marker scene IDs retain their matching behavior.

### Scene Markers

Removed the unconditional outer marker join from custom marker predicates that already use self-contained subqueries. This avoids multiplying outer rows by marker count. The existing null/not-null checks retain the joins they require.

Single-match marker groups now use EXISTS and stop at the first match. Repeated identical groups still count distinct markers and enforce their original multiplicity. Effective tags, overlap inheritance, exclusions, unnamed performer identities, and role conditions are unchanged.

### Performer Rating on Scenes

ANY matching now uses an independent scene-ID set, avoiding duplicate outer rows and shared performer aliases. This also fixes two composition bugs: an OR branch can include a scene without performers, and two rating conditions can be satisfied by different performers when each requests ANY.

ALL matching with `>=` or `<=` now actually checks every performer. Previously these two operators fell through to ANY matching. Null ratings and performerless scenes fail these ALL numeric comparisons, consistent with the existing strict `>` and `<` operators.

## Measurements

Read-only SQL comparisons used the existing 29,179-scene library, within one transaction snapshot. The 56 audit cases cover 28 inputs, both library-wide and with an ID restriction selecting 688 candidate scenes. These are representative query timings, not browser-load measurements or guaranteed latency. Cache state and concurrent work affect timings.

Representative library-wide results from the comparison runs:

| Custom filter                        | Original | Optimized |
| ------------------------------------ | -------: | --------: |
| Standard percentage > 50             | 1,715 ms |    104 ms |
| Outstanding percentage > 50          |   643 ms |     96 ms |
| Unclassified percentage > 50         |   589 ms |    131 ms |
| Sex percentage > 50                  |   204 ms |     52 ms |
| Oral percentage > 50                 |   189 ms |     53 ms |
| Solo percentage > 50                 |   210 ms |     72 ms |
| Legacy Other percentage > 50         |   203 ms |     83 ms |
| Unusable percentage > 50             |    66 ms |     36 ms |
| Scene Type: Sex                      |    27 ms |      7 ms |
| Scene Type: Oral                     |    30 ms |     10 ms |
| Scene Type: Solo                     |    31 ms |     10 ms |
| Scene Type: Facial                   |    26 ms |      7 ms |
| Circular Oral                        |    39 ms |     10 ms |
| Scene Markers: one tag group         |    85 ms |     66 ms |
| Scene Markers: tag + Top requirement |    91 ms |     70 ms |

All audit cases preserved their original matching IDs. The original scoped Standard/Outstanding queries could not execute because of parser overflow; their expected results came from the original unscoped predicate followed by the equivalent ID restriction in Go. The optimized scoped queries executed normally. Separate fixtures verify the intentional Performer Rating corrections.

Very narrow searches can still show a few milliseconds of set-building overhead. Candidate scoping prevents full-library interval or marker-role aggregation for those searches. Search text and ancestor filter branches are not pushed into every metric subquery; further work here would need to preserve OR/NOT semantics carefully.

## Reviewed without a query rewrite

- **Release Count:** existing count handling; approximately 7 ms in the representative library-wide case.
- **Effective Date:** existing indexed release-date lookups; approximately 12–13 ms. Preserves null and earliest-date behavior.
- **Metallic Rating:** existing threshold, tag, marker, and bonus rules; approximately 42–44 ms. No clear bottleneck demonstrated by the tested input.
- **Rating Criteria / bonus / penalty filters:** keyed score lookups; approximately 10 ms for the sampled bonus criterion. Presence and numeric semantics remain unchanged.
- **Has Marker Performers:** indexed existence checks; approximately 15–16 ms.
- **Performer Country / Ethnicity:** scene-local performer checks; approximately 14–17 ms for the sampled inputs. Existing expansion and matching rules remain unchanged.
- **Insight scene IDs:** retains its single JSON-bound ID list, including the distinction between no filter and an empty matching set.

## Validation and files

- `pkg/sqlite/scene_activity_filter_custom.go` and its tests: 480 numeric/grouped/nested cases plus combined metrics, parameter binding, counts, pagination, sorting, and HAVING/OR coverage.
- `pkg/sqlite/scene_activity_sort_custom.go`: shared batched metric calculation; existing scalar-versus-batched value and ordering tests still pass.
- `pkg/sqlite/scene_filter_custom.go`, `scene_filter_tag_family_custom.go`, and `scene_filter_optimization_custom_test.go`: classification, role matching, cyclic/diamond ancestry, parameter binding, null checks, and Performer Rating regressions.
- `pkg/sqlite/criterion_handlers_custom.go` and `scene_marker_multiplicity_custom.go`: join removal and early-exit marker matching.
- `pkg/sqlite/scene_filter.go`: custom handler wiring and ordering only.
- `pkg/sqlite/scene_filter_audit_custom_test.go`: optional read-only baseline/equivalence audit. Set `STASH_SORT_AUDIT_DB` and `STASH_SORT_AUDIT_TAG_IDS`; use `STASH_FILTER_AUDIT_CAPTURE` to save query SQL and `STASH_FILTER_AUDIT_BASELINE` to compare an earlier capture. Sample scene-type inputs use this library's configured tag IDs.

Checks: `go test ./pkg/sqlite ./pkg/scene ./internal/api`, focused existing marker integration tests for shared identities/ancestor tags/50% overlap/direct includes-all behavior, and `go build -o .local/stash-check.exe ./cmd/stash`.

No GraphQL/UI changes, schema changes, database migrations, or new configuration are needed. No production build, application restart, or deployment was performed; the installed instances will use these changes after deployment.
