# Custom Markers-page filter audit

Date: 2026-09-28. Performed without subagents.

## Scope

Only custom additions on `/scenes/markers` were audited: Marker Performers
(tags, roles, named/unnamed performers, overlap groups and shared identities),
Has Roles, Has End Time, Marker Length, Scene Performer Count, Studio,
Scene Director, Circular Oral, and custom country/ethnicity/rating predicates.

The sort option list and `setSceneMarkerSort` implementation match the local
`upstream/develop` reference. The custom `sceneMarkerSortMetric_custom.ts`
only supplies displayed card values. There are no custom SQL sort expressions
in this checkout; upstream filters and sorts were excluded from this audit.

The library was opened with SQLite `mode=ro`. Comparisons execute captured
original SQL and the changed SQL within the same read transaction and compare
all matching marker IDs. No indexes, migrations, app restarts, production builds
or deployments were performed. Timings measure SQL plus ID scanning, not
GraphQL requests or page loads.

## Changes

### Single-tag matching

The custom tag predicate requires a direct match before testing effective tags.
For one selected tag (including one descendant family), that direct match
already satisfies the effective-tag requirement. Removed the redundant
inheritance checks on both the candidate and its narrower competitors.
Narrowest-marker selection remains active. Multi-tag inheritance is unchanged.

### Shared identities across overlap groups

The shared-person subquery previously started at the entire performers table
for each candidate marker combination. It now starts with participants on the
first required marker and joins their performer records. All existing role and
attribute predicates still apply, including Both roles and exclusions.

### Circular Oral

Resolve the recursive tag family once in a shared CTE, bind the root tag ID,
and use `UNION` to deduplicate ancestry paths and terminate cycles. Missing
roles are checked with indexed `NOT EXISTS` probes by marker/person/role.
Every assigned person must still have both roles, and empty markers fail.

### Studio descendants

Found a correctness failure while measuring the custom Studio filter:
nonzero depth generated `studios.child_id`, which does not exist. The hierarchy
now follows `studios.parent_id` to `studios.id`. Tests cover direct studios,
one child level, all descendants, and descendant exclusions.

## Measurements

Ranges below are from three repeated comparisons on the existing library.

| Custom predicate                           |   Original |  Optimized | Result                           |
| ------------------------------------------ | ---------: | ---------: | -------------------------------- |
| One direct tag, whole library              |   45-47 ms |   22-23 ms | Same 12,581 IDs; about 2x faster |
| Shared overlap identity, scene IDs <= 1000 |   90-96 ms |   18-19 ms | Same 9 IDs; about 5x faster      |
| Circular Oral, whole library               |   17-20 ms |      16 ms | Same 44 IDs; modest improvement  |
| Circular Oral, scene IDs <= 1000           | 3.8-3.9 ms | 3.6-3.9 ms | Same 1 ID                        |

Single-family descendant matching measured about 30-32 ms with either query;
two-tag matching remained about 49-58 ms. The scoped overlap sample is not a
whole-library timing. Other sampled custom predicates took roughly 3-39 ms
depending on scope and result size and did not justify additional rewrites.
Studio descendants could not be compared to the broken original SQL; fixture
expectations verify the corrected result instead.

## Verification

- `go test ./pkg/sqlite -count=1`.
- `go build ./cmd/stash`.
- Focused fixtures cover IDs, counts, duration totals, primary/secondary tags,
  tag inheritance, exclusions, named and shared unnamed participants, Both
  roles, performer attributes, studio depth, and cyclic/diamond ancestry.
- A dense-overlap fixture compares the optimized single-tag predicate with
  the original SQL for both direct and descendant selection, including equal
  lengths, absent ends, invalid intervals, duplicate tags, and pagination.
- The optional `TestSceneMarkerReadOnlyAuditCustom` captures original SQL with
  `STASH_MARKER_AUDIT_DB` and `STASH_MARKER_AUDIT_CAPTURE`, then compares it using
  `STASH_MARKER_AUDIT_BASELINE`. Normal tests do not access the library.
- Targeted Markdown Prettier and `git diff --check`.

No GraphQL, database schema, configuration, or frontend changes are required.
