# Custom Studio filter and sort SQL audit

## Scope

This audit covers custom Studio list filters and sort options only. Upstream options, card statistics, and detail-page queries are outside its scope. The audit was performed without subagents and without modifying the application database or deploying the application.

The read-only library comparison exercised 36 custom sort keys and 13 representative filter inputs, both unscoped and constrained by a studio name. Sort comparisons checked every returned ID in order across 114 studios, not just the first page. Filter comparisons checked matching IDs and ordering. This is not an exhaustive benchmark of all filter combinations.

## Changes

- Other, Outstanding, Standard, and Unclassified percentage queries now materialize shared scene durations and marker ranges over candidate studios. Interval unions and exclusions are aggregated once per scene and studio instead of repeating correlated interval subqueries for each studio.
- Percentage filters collect direct and grouped criteria lazily. Their candidate scope includes local AND predicates but excludes sibling boolean branches and HAVING predicates, preserving nested AND/OR/NOT behavior. Sort-only aggregates are not evaluated for total counts.
- Sex, Oral, Solo, and Facial scene-count sorts use scene-correlated marker existence checks. Oral and Solo exclusions no longer scan a global scene-ID exclusion list. A release-only marker with a NULL scene ID cannot suppress otherwise eligible scene counts through SQL NOT IN semantics.
- Unconfigured count sorts use a constant expression instead of bare ORDER BY 0, which SQLite interprets as an invalid column position.
- Scoped Standard and Outstanding filters no longer exceed SQLite's parser stack on the tested library. Their original scoped queries failed, so equivalent results were verified by applying the name predicate to the original unscoped results.

Existing semantics remain intact: direct studio ownership, configured tag roles, existing descendant-tag limits for role counts, secondary-tag matching where previously supported, clipped and merged intervals, meaningful-scene denominators, studio-level clamping, rounded percentage filtering, sort direction, and name/ID tie-breakers. No schema changes, indexes, migrations, new configuration, or dependencies were added.

## Measurements

Representative warm SQL timings from the same local library, in milliseconds. These measure SQL execution, not full-page latency; timings vary with cache and library contents.

| Custom operation                  | Before | After |
| --------------------------------- | -----: | ----: |
| Standard percentage sort          | 1392.6 |  78.9 |
| Outstanding percentage sort       |  553.3 |  76.9 |
| Unclassified percentage sort      |  297.5 |  74.6 |
| Other percentage sort             |   52.7 |  29.2 |
| Standard percentage filter        | 1371.5 |  81.0 |
| Outstanding percentage filter     |  507.2 |  75.7 |
| Unclassified percentage filter    |  296.7 |  72.6 |
| Other percentage filter           |   55.8 |  29.6 |
| Sex scene-count sort              |   67.3 |  19.1 |
| Oral scene-count sort             |   91.6 |  24.9 |
| Solo scene-count sort             |  143.5 |  28.6 |
| Facial scene-count sort           |   77.5 |  19.4 |
| Name-scoped Oral scene-count sort |   64.0 |   3.2 |
| Name-scoped Solo scene-count sort |  121.5 |   2.9 |

The audited custom Rating Advisor dimensions, average ratings, metallic tiers, facial marker variants, unique performers, O Count, and Sex/Oral/Solo percentage expressions were left unchanged. Their measured costs did not justify another rewrite in this change. Unusable percentage batching was slightly slower than its existing scalar expression, so it also retains the scalar path.

## Files and verification

- `pkg/sqlite/studio_activity_query_custom.go`: scoped quality aggregation and custom percentage filter handler.
- `pkg/sqlite/studio_role_sort_custom.go`, `studio_custom.go`, and `studio_sort_metric_custom.go`: role scene-count expressions and safe constant ordering.
- `pkg/sqlite/studio.go` and `studio_filter.go`: CUSTOM-marked query hooks.
- `pkg/sqlite/studio_activity_query_custom_test.go`: raw-value and order equivalence against the original scalar SQL, both directions, configuration variants, pagination, count plans, rounding, operators, aliases, and boolean composition.
- `pkg/sqlite/studio_role_sort_custom_test.go`: primary/secondary/descendant tags, duplicate markers, exclusion precedence, empty studios, release-only markers, and missing configuration.
- `pkg/sqlite/studio_audit_custom_test.go`: optional read-only SQL capture and library comparison. Ordinary test runs skip this harness unless `STASH_STUDIO_AUDIT_DB` is supplied; `STASH_STUDIO_AUDIT_TAG_IDS` selects tag configuration, `STASH_STUDIO_AUDIT_CAPTURE` writes a baseline, and `STASH_STUDIO_AUDIT_BASELINE` enables comparison.

Verification completed: full read-only library comparison, `go test ./pkg/sqlite -count=1`, and `go build ./cmd/stash`. No frontend or GraphQL changes were needed.
