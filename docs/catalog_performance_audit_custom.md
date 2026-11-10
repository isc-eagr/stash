# Catalog performance pass — 2026-09-24

Reviewed scenes list, scene detail, performers list, performer detail, Scene Stats,
and Vato Stats. Implemented the focused improvements below without schema changes
or database migrations. Existing exact performer marker totals remain intact.

## Measurement scope

Read-only GraphQL requests used the running instance at `localhost:9999`.
SQL comparisons used its database in SQLite read-only mode. Sorting and Apollo
benchmarks ran locally against the returned library data. These are individual
request/processing measurements, not end-to-end browser load times. Cache warmth
and concurrent machine load affect the numbers.

| Main request                                | Observed time | Decoded JSON size |
| ------------------------------------------- | ------------- | ----------------- |
| Scenes list, 40 items, supplied random seed | 195–298 ms    | 115 KB            |
| Scene detail, scene 8831                    | 42–79 ms      | 57 KB             |
| Performers list, 40 items                   | 266–574 ms    | 71 KB             |
| Performer profile, performer 1477           | 26–86 ms      | 1.8 KB            |
| Scene Stats, about 29,179 scenes            | 904–2,251 ms  | 6.8 MB            |
| Vato Stats, about 7,400 performers          | 391–891 ms    | 4.5 MB            |

Sizes above are decoded response sizes, not compressed network transfer sizes.
The running instance still serves the previous build; backend changes were
compiled and tested separately without starting or deploying the check binary.

## Changes by screen

| Area             | Finding and implemented change                                                                                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scenes list      | Retained the preceding IDs-only descendant-tag lookup and preview-observer cleanup. The shared performer-role hook now queries directly and deduplicates/sorts IDs, so equivalent performer sets reuse the same Apollo entry instead of depending on array order or effect-driven loading. |
| Scene detail     | Unopened tabs now defer mounting, including their queries and expensive marker/stat rendering. Tabs retain their state after first use. The video-filter panel remains mounted because it also applies player styles. The performer overview uses a count-only studio query.               |
| Performers list  | The activity-stat SQL starts from indexed marker IDs assigned to the performer, rather than checking membership against every eligible activity marker. This also benefits performer data embedded in scene detail. The shared role-query improvement applies here too.                    |
| Performer detail | Studio and marker tab badges fetch only counts. One top-OR-bottom marker query replaces two full-record queries and counts a marker only once when the performer has both roles. Activity-stat SQL also benefits this screen.                                                              |
| Scene Stats      | Ranking reuses one locale comparator and computes each metric once per row. Overview rankings/charts and its auxiliary totals query are deferred when another stats section is selected. The existing compact response and normalization bypass remain in place.                           |
| Vato Stats       | Uses the same efficient ranking helper. The aggregate snapshot now uses compact transport keys and bypasses Apollo, matching Scene Stats. All dashboard values remain available. Revisiting fetches a fresh snapshot.                                                                      |

The marker-list resolver also skips its full filtered-duration calculation when
the GraphQL request does not select `duration`. Marker lists that display duration
still request and receive it.

## Measured improvements and correctness checks

- **Activity SQL:** approximately 77 ms → 3 ms for 40 performers with many marker
  assignments. Old and new queries returned exactly the same 476 rows. The query
  plan uses the existing performer/role/marker index; no new index is required.
- **Dashboard sorting:** an initial comparator benchmark measured Scene Stats at
  700 ms → 16 ms and Vato Stats at 115 ms → 5 ms. A later check of the implemented
  ranking helper under heavier machine load measured 2,684 ms → 38 ms and
  305 ms → 8 ms, respectively. Complete sorted outputs matched the old logic.
- **Vato Stats cache processing:** an isolated Apollo query benchmark with the
  same response measured approximately 479 ms with cache-first versus 1 ms with
  no-cache. Network and server work are excluded from this comparison.
- **Studio badge query:** a sample performer lookup dropped from approximately
  346 ms with a complete studio record to 55 ms with only its count. The returned
  count was identical. The focused query returns 36 bytes instead of 1,524 bytes
  in that sample.
- **Marker badge correctness:** performer 77 has 18 top/bottom assignments across
  17 distinct markers. The new query returns 17, matching the marker list.
- `facial_marker_top_count`, `facial_marker_bottom_count`, and `feet_marker_count`
  remain in the detail/card queries and exact-count mapping. Their regression test
  passes.

## Validation

- `go build -o .local/stash-check.exe ./cmd/stash`
- `go test ./internal/api ./pkg/scene`
- TypeScript compile check and targeted ESLint/Prettier checks
- Focused ranking, compact Scene Stats data, Vato Stats roles/studio scope, and
  exact performer marker-count tests: 10 passing tests
- New SQL regression fixture covers both-role deduplication, performer scoping,
  activity-tag selection, secondary-tag exclusion, and invalid intervals
- New count queries executed successfully against the running GraphQL API
- `git diff --check`

## Further opportunities

The remaining large cost is the dashboards' full-library snapshot. Moving chart
aggregation and filtered rankings to the server could reduce decoded payloads and
client memory further, but must preserve every drill-down/filter combination.
Simply deleting fields or limiting rows would make statistics incomplete.

The performer activity resolver still issues one indexed query per performer.
Its measured cost is now small for a 40-card page. A request-scoped batch loader is
a reasonable next step if profiling larger page sizes shows it becoming material.

## Studio and marker follow-up

The subsequent [studio, marker and dashboard audit](studios_markers_performance_audit_custom.md)
records additional implemented fixes, payload reductions, tab-level findings and
remaining opportunities. No production deployment has been performed.
