# Studios, Markers and dashboard performance audit

Date: 2026-09-25. Work performed without subagents.

## Scope and measurement limits

Reviewed the studio list, studio detail/header, and all nine content tabs:
Scenes, Galleries, Images, Vatos, Groups, Child Studios, Scene Stats, Vato Stats,
and O Stats. Also reviewed the main Markers query and its card-context query.

Read-only measurements used the existing instance at `http://localhost:9999`.
The database was opened read-only for SQL comparisons. No database migrations,
app restarts, or production deployments were performed. API timings below are
from the running, previous build. SQL comparisons and regression tests verify
the changes separately; these are not post-deployment page-load measurements.
JSON sizes are decoded response sizes, not compressed network transfer sizes.

## Findings and implemented changes

### Markers

The duration total was loading and sorting every matching marker, even though
it only needed one number. Repeated duration-only API requests took about
404–412 ms, while IDs/count for the 40-marker page took 6–12 ms after warm-up.
The complete marker query took about 449–455 ms after warm-up (about 1 second
on the initial request). The separate batched scene-context query took 11 ms.

`pkg/sqlite/scene_marker_duration_custom.go` now calculates duration directly in
SQL using the same marker filter and search logic as the list. A distinct-ID
subquery prevents relationship joins from inflating the total. Invalid or
missing end times contribute zero; pagination and sorting do not affect totals.
The equivalent read-only SQL aggregate took about 7 ms on this library.

`pkg/scene/marker_query_custom.go` selects that aggregate when supported by the
store, with a portable fallback. The resolver now passes its text-search filter:
previously the duration ignored the search text. Count-only requests still skip
duration entirely. Explicit marker-ID requests retain their existing behavior.

### Studios list and Child Studios tab

The list's batched role query combined marker tags across the entire library
before narrowing to the requested studios. Both marker-tag branches now restrict
scenes to the requested studio IDs first. In a 40-studio SQL comparison this
portion fell from roughly 73–75 ms to 36–37 ms, returning exactly the same rows.

The complete studio-list API query measured roughly 570 ms warm and 1.3 seconds
on its initial request. A parent studio with 11 children returned its children
query in about 604 ms. These totals include other aggregates that still cost
more than the role query alone; the change does not eliminate all list latency.

### Studio detail/header and scoped role statistics

Several studio helpers loaded global marker results and discarded markers from
other studios in Go. The queries now include the already-resolved scene scope.
This covers role counts, co-performer counts, and exact marker counts. Scene IDs
are consumed directly from the query result instead of hydrating full scenes.
Count helpers also sort by ID instead of performing unnecessary title sorting.

The existing role/tag logic is retained, including descendant tags, secondary
tags, sex/oral/solo precedence, co-performer role direction, second-camera
exclusions, and scene deduplication. The separate global performer fields
`facial_marker_top_count`, `facial_marker_bottom_count`, and `feet_marker_count`
are not removed or replaced with scene counts.

The studio detail API measured about 433 ms for a sampled studio and 511 ms for
a parent studio before these backend changes were deployed.

### Vatos tab

Every performer card requested `studio_performer_activity_stats` even though
the card did not use that field. Cards now use a focused query containing all
of their displayed role counts and other badges. Studio cards shown elsewhere
still use the full query because those cards display activity statistics.

The focused query was successfully exercised against the running API. This
removes unused work but does not yet batch all studio-performer requests into
one request or one set of aggregate SQL queries.

### Scenes, Galleries, Images and Groups tabs

The tabs already mount on demand and unmount when left, so unopened tabs do not
load every content list at once. Representative scoped queries measured:

| Tab             | API time |
| --------------- | -------: |
| Scenes          | 67–79 ms |
| Galleries       |    70 ms |
| Images          |    49 ms |
| Vatos main list |   231 ms |
| Groups          |   386 ms |

Vatos' per-card scoped requests are additional to its main list time.

The shared studio filter hook is now stable across unrelated renders. A separate
correctness bug was fixed: changing the child-studio toggle did not update the
depth of an existing/saved studio criterion. It now updates that depth and clears
contradictory excluded studios. This benefits all content tabs using the hook.

### Scene Stats and Vato Stats, including their studio tabs

These are the dashboards referred to by “full-library payloads.” The top-level
pages load a library snapshot to calculate interactive charts, filters and
rankings. Studio tabs use scoped snapshots instead.

Vato Stats now uses compact transport aliases and bypasses Apollo for the large
snapshot, following the existing Scene Stats approach. Only the expanded data
is retained in component state; the raw compact object graph is released after
conversion. Scope changes/unmount cancel the request, and aborted responses
cannot overwrite the current result. Small auxiliary queries still use Apollo.

All 7,401 performer rows and every requested field matched between the original
and compact queries. The 621-row studio-scoped snapshot also matched exactly.
No image, rating, role count, demographic, age bucket, filter input or summary
value was dropped.

| Snapshot                   |  Before |   After | Reduction |
| -------------------------- | ------: | ------: | --------: |
| Vato Stats, full library   | 4.51 MB | 2.08 MB |       54% |
| Vato Stats, sampled studio |  386 KB |  179 KB |       53% |
| Scene Stats, 29,179 scenes | 6.77 MB | 6.31 MB |        7% |

Scene Stats no longer requests a duplicate raw scene date. The effective date
already includes the scene date. A backend fallback preserves the old client's
behavior for legacy empty effective dates; two such rows were found in this
library. Other scene fields matched across the old and compact queries. Deploy
the backend and frontend changes together to retain this fallback.

The earlier pass's ranking optimizations and deferred overview-only computations
remain in place. Compact aliases reduce JSON overhead; they do not make the
underlying full-library aggregate SQL smaller.

### O Stats tab

The studio O Stats view already skips irrelevant global summaries and uses
small scoped aggregates. Its eight measured requests took roughly 3–12 ms each.
No additional rewrite was justified by those timings.

## Verification

- `go test ./internal/api ./pkg/scene ./pkg/sqlite` passed.
- `go build ./...` passed; no production/release build or startup was performed.
- Regression coverage checks filtered duration, text search, pagination,
  duplicate tag joins, invalid intervals, studio scope, role precedence,
  ID-only scene lookup, and effective-date fallback.
- Frontend coverage checks compact data expansion, unknown/null values, studio
  child toggles, ranking, Vato role charts and studio scope.
- TypeScript compilation and targeted ESLint checks passed. All 15 focused
  frontend checks passed, including preservation of exact performer marker counts.
- Targeted Prettier and `git diff --check` passed.

## Remaining suggestions

1. Batch studio-performer role statistics across the visible performer page.
   Each card still has a scoped request, and its backend role calculation still
   performs multiple queries. The current changes narrow their work but do not
   replace that architecture.
2. Fetch only the selected direct/descendant header aggregates, or reuse results
   when the two scopes are identical. Studio detail currently asks for both.
3. Investigate a covering index for studio image O-counter sums if studio-list
   latency remains noticeable. That aggregate alone measured about 110 ms in
   the sampled list. Any index migration should be a standalone SQL file and
   benchmarked before applying it.
4. For a larger dashboard redesign, move chart aggregation and filtered ranking
   to the server. The snapshots are still complete-library inputs; preserving
   every interactive filter and drill-down requires more than limiting rows.
