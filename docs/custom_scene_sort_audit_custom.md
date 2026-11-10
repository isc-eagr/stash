# Custom scene sort performance audit

Date: 2026-09-25.

## Scope

Compared the scene sort definitions against upstream `v0.31.0`. The custom UI
options are Effective Date, GOAT Element Bonus, Sex %, Oral %, Solo %,
Outstanding %, Standard %, Unclassified %, and Unusable %. The API also retains
the older Other % option; it is covered by the same fix.

Upstream options, including performer age, rating, counts, random, and file/media
sorts, were excluded. Their implementations were not changed.

## Findings and fixes

### Activity and quality percentages

The old sort expressions executed correlated interval-union calculations for
every matching scene. Sex/Oral/Solo repeatedly calculated the numerator again
inside the denominator. Quality expressions repeated unions, intersections,
video-duration lookups, and overlap-aware tag checks. Standard was the most
expensive: an initial IDs-only request against the running app took about nine
seconds.

`pkg/sqlite/scene_activity_sort_custom.go` now batches those calculations:

- Materialize the matching scene IDs once, preserving existing filters.
- Merge intervals in window passes partitioned by scene ID.
- Reuse each merged total in the numerator and denominator.
- Reuse maximum file durations and clipped quality intervals.
- Restrict expensive marker/tag checks to the selected scenes before evaluating
  them. This also improves filtered sorts rather than processing the whole
  library for a small result set.
- Use sort-only joins. Count and total queries do not evaluate the aggregates;
  regression tests check their query plans.

Existing formulas are preserved. This includes strict role-marker requirements,
raw versus clipped intervals, overlapping markers, negative coverage,
overlap-inherited GOAT/Orgasm/Really Hot tags, missing durations, zero
configuration values, and duplicate configured role IDs. No stored statistics,
filters, ratings or marker counts were changed.

### Effective Date

The old expression could repeat the same release-date minimum three times for
each scene. `pkg/sqlite/scene_effective_date_sort_custom.go` groups release dates
once and joins one row per scene. It preserves NULL handling, blank legacy dates,
the earliest scene/release date, direction, existing title tie ordering, and
pagination. Date filters and the upstream performer-age sort remain unchanged.

An isolated read-only SQL comparison measured approximately 56 ms before versus
37 ms after, with identical results.

### GOAT Element Bonus

The existing lookup uses the unique `(entity_type, entity_id, key)` index on
`rating_bonus_scores`. No missing index or obvious unnecessary work was found.
The implementation was retained.

## Measurements and result equivalence

A read-only transaction on the existing library compared the old scalar SQL
against the new SQL for every activity/quality sort, in both ASC and DESC order.
All metric values and the entire ordered ID sequences matched exactly for:

- The full library: 29,179 scenes.
- A studio-filtered subset: 1,304 scenes.

Final full-library SQL timings (ASC/DESC range):

| Sort           |         Before |      After |
| -------------- | -------------: | ---------: |
| Sex %          |     328–376 ms | 138–162 ms |
| Oral %         |     297–310 ms | 134–138 ms |
| Solo %         |     319–334 ms | 142–161 ms |
| Other %        |     411–425 ms | 204–300 ms |
| Outstanding %  | 1,375–1,886 ms | 215–268 ms |
| Standard %     | 1,995–2,378 ms | 181–278 ms |
| Unclassified % |     679–700 ms | 169–170 ms |
| Unusable %     |     161–171 ms | 106–132 ms |

The filtered Standard sort fell from 176–206 ms to 13–14 ms. Filtered
Outstanding fell from 66–82 ms to 16–20 ms, and Unclassified from 46–82 ms
to 13–15 ms. All other filtered sorts improved in the final comparison too.

These are SQL execution comparisons using the repository's SQLite driver, not
post-deployment browser page-load timings. Machine load and cache warmth affect
absolute timings. The existing app was not rebuilt, restarted or deployed.

## Validation

- Deterministic SQLite fixtures compare every percentage sort and direction
  against the previous expressions, including fractional/overlapping intervals,
  missing or duplicate tag settings, and recursive filters with bound parameters
  in WITH, JOIN, WHERE and HAVING clauses.
- Count query plans verify that sort aggregates are skipped.
- Effective-date fixtures compare both directions and pagination, including
  absent, multiple, NULL, empty and sentinel dates.
- An opt-in `TestSceneSortReadOnlyAuditCustom` reproduces the real-library
  comparison. It requires `STASH_SORT_AUDIT_DB` and a JSON
  `STASH_SORT_AUDIT_TAG_IDS` object matching that library's configuration, and
  always opens SQLite with `mode=ro`. It is skipped in normal test runs.
- `go test ./pkg/sqlite ./pkg/scene ./internal/api`.
- `go build ./...` and `git diff --check`.

No schema changes or database migrations are required.
