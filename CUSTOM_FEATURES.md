# Custom Features Documentation

This document is the user-facing inventory of capabilities added on top of the official Stash **v0.31.0** release. It is intentionally organized by product feature, not by commit or implementation change. Refinements to an existing custom feature (for example, chart layout, query batching, or a new test) belong in that feature's notes and are not separate features here.

All custom code follows [`CUSTOM_CODE_CONVENTIONS.md`](CUSTOM_CODE_CONVENTIONS.md): standalone custom helpers and schema use the `_custom` suffix where applicable, schema extensions use `extend` blocks, and inline changes carry `CUSTOM` markers.

## Table of Contents

1. [Marker performers and role-aware marker workflow](#1-marker-performers-and-role-aware-marker-workflow)
2. [Role-tag configuration and activity classification](#2-role-tag-configuration-and-activity-classification)
3. [Advanced scene, marker, and performer filtering](#3-advanced-scene-marker-and-performer-filtering)
4. [Statistics dashboards](#4-statistics-dashboards)
5. [Task Progress Tracker](#5-task-progress-tracker)
6. [Studio metrics and performer Studios](#6-studio-metrics-and-performer-studios)
7. [Performer cards, partners, and images](#7-performer-cards-partners-and-images)
8. [Scene cards and Scene Insights](#8-scene-cards-and-scene-insights)
9. [Multi-segment loops and marker playlists](#9-multi-segment-loops-and-marker-playlists)
10. [Unified multi-panel viewers](#10-unified-multi-panel-viewers)
11. [Scene Releases and Effective Date](#11-scene-releases-and-effective-date)
12. [Marker preview source-quality generation](#12-marker-preview-source-quality-generation)
13. [Persisted Rating Advisor and metallic card styles](#13-persisted-rating-advisor-and-metallic-card-styles)
14. [Scene marker navigation and editing](#14-scene-marker-navigation-and-editing)
15. [GEVI Latest](#15-gevi-latest)
16. [Themes, custom settings, and UI vocabulary](#16-themes-custom-settings-and-ui-vocabulary)
17. [Mobile production deploy workflow](#17-mobile-production-deploy-workflow)
18. [Mobile Remote O Recording](#18-mobile-remote-o-recording)
19. [Scene Tagger save preview](#19-scene-tagger-save-preview)
20. [Merge and maintenance guidance](#20-merge-and-maintenance-guidance)

---

## 1. Marker performers and role-aware marker workflow

### Overview

Scene markers can be associated with performers in explicit **Top** (giving) and **Bottom** (receiving) roles. This replaces the old scene-level performer-tag workaround and makes marker-level participation queryable and editable. The same role model is used by scene details, performer cards, marker playback, partner views, and filters.

### User-visible behavior

- Marker create/edit forms provide separate Top and Bottom performer selectors with role-colored indicators (blue Top, green Bottom).
- In the marker New/Edit panel, the Primary Tag and Tags selectors keep the Create Tag option, and creating a tag requires clicking that option.
- Scene marker cards, the chronological marker panel, marker playback, and marker viewers show the assigned performers and role.
- Performer details include a Markers tab containing only markers linked directly to that performer.
- The Partners tab groups co-performers by Sex, Oral, and Facial role, with shared timed-marker duration for Sex/Oral pairs and deduplicated partner portraits.
- Performer cards expose role scene counts and unique-partner counts. Lazy card statistics are loaded in one page-level request so the initial list fragment stays small.
- Marker performer associations support full create/update/delete behavior through `top_performer_ids` and `bottom_performer_ids`. The deprecated `SceneMarker.performers` field, the legacy marker `performer_ids` input, `Performer.scene_marker_roles`, and `performerTagSceneCounts` were removed as unused.

### Storage and API

- `scene_marker_performers` stores `(scene_marker_id, performer_id, role)` with foreign keys and role indexes. The standalone SQL references are `scene_marker_performers.sql` and `scene_marker_performers_top_bottom.sql`.
- `SceneMarker.top_performers`, `SceneMarker.bottom_performers`, marker performer filters, performer role counts, partner counts, and `PerformerRoleStats` are exposed through custom GraphQL extensions.
- Role-aware scene-marker context queries use flattened tag ancestry and are batched by visible scene/marker IDs to avoid per-card queries.

### Key files

- `graphql/schema/types/scene-marker_custom.graphql`, `performer_custom.graphql`, and `filters_custom.graphql`
- `pkg/models/scene_marker.go`, `pkg/sqlite/scene_marker.go`, `pkg/sqlite/scene_marker_filter.go`
- `internal/api/resolver_model_scene_marker.go`, `resolver_model_performer.go`, and `resolver_query_find_performer_custom.go`
- `ui/v2.5/src/components/Scenes/SceneDetails/SceneMarkerForm.tsx`, `PrimaryTags.tsx`, and `SceneMarkerCard.tsx`
- `ui/v2.5/src/components/Performers/PerformerDetails/PerformerCategoryStrip.tsx`, `PerformerAppearsWithByRolePanel.tsx`, and `performerRoleStats_custom.ts`

### Tests

Focused coverage includes role CRUD, top/bottom count semantics, partner de-duplication, shared-duration merging, batched role statistics, and role-color consistency (`performer_partner_duration_custom_test.go`, `roleColors_custom.test.ts`, and related performer tests).

---

## 2. Role-tag configuration and activity classification

### Overview

Settings > Custom provides configurable tag IDs for the role and event families used by the custom UI: Sex, Oral, Solo, Facial, Orgasm, Feet, Really Hot, GOAT, 2nd Camera, and OStats exclusions. Descendant tags are resolved recursively wherever a family is used; primary and secondary marker tags are handled according to the feature consuming them.

### Behavior

- Sex, Oral, Solo, and Facial families drive marker classification, scene types, card icons, activity percentages, stats, and filters.
- Orgasm and Facial event counts are weighted once per assigned Top performer, with a minimum of one when a marker has no Top assignment.
- Really Hot and GOAT qualifiers can be descendants and can also arrive as secondary tags.
- A configured 2nd Camera family is excluded from orgasm/facial statistics and category strips, while remaining available to normal marker browsing and playback. The Scenes-page orgasm marker filter can also exclude it at marker level.
- Role colors and semantic categories are centralized in `roleColors_custom.ts` and shared by cards, filters, timelines, and stats.

### Key files

- `ui/v2.5/src/components/Settings/SettingsCustomPanel.tsx` and `SettingsInterfacePanel/SettingsInterfacePanel.tsx`
- `ui/v2.5/src/core/config.ts`
- `pkg/sqlite/role_tag_provider.go`, `pkg/scene/query_custom.go`, and `internal/api/resolver_custom.go`
- `graphql/schema/types/config_custom.graphql` and `filters_custom.graphql`

---

## 3. Advanced scene, marker, and performer filtering

### Overview

The fork adds marker-aware and role-aware criteria to the Scenes, Markers, Performers, Studios, Galleries, Images, and Groups catalogs. Filter editors serialize these criteria into GraphQL inputs; SQLite handlers perform the matching with recursive tag CTEs and `EXISTS` predicates.

### Marker and role criteria

- Scene Markers, Scene Markers: Exclude, and Marker Match (the Markers-page criterion, `marker_performers`) share one configuration model: tags (all required, optionally with sub-tags) plus vatos, each with an explicit role — Top, Bottom, Both (top and bottom on the same marker), or Any role. Named and unnamed vatos follow identical role rules. Groups saved with the old Either · OR toggle are migrated on load: a vato listed as both top and bottom becomes Any role, and everything else becomes AND. The GraphQL group input adds `either_performer_ids` and `either_unnamed_performers`; `performer_mode: "OR"` remains for internal drilldown links. The deprecated group fields `performer_countries`, `performer_ethnicities`, and `performer_rating`, and the never-applied `*_ethnicity_counts`/`*_country_counts` inputs, were removed.
- Explicit overlap groups require marker ranges to overlap. Directed tag inheritance is separate: an equal-or-longer source marker contributes tags only when its intersection covers at least 50% of the receiving marker. A wider marker never inherits from a narrower marker inside it.
- The Markers page has a Marker Match criterion, a Has Roles criterion (Top/Bottom checkboxes), a Studio criterion with hierarchical child-studio matching, and a unified include/exclude Performer Markers criterion.
- All marker configurations are built by one SQL builder, `pkg/sqlite/scene_marker_group_sql_custom.go`, used by the Scenes handler (`criterion_handlers_custom.go`) and the Markers handler (`scene_marker_filter_custom.go`). Every configuration must match a different marker. Each unnamed vato letter binds to one person, different letters bind to different people, and an unnamed vato is never one of the named vatos. Empty configurations are ignored. Marker Match with one configuration returns each matching marker unless a shorter overlapping marker matches the same tags and vatos; with several it returns the shortest of the overlapping matches. A single tag family skips redundant inheritance checks. Circular Oral reuses a bound, cycle-safe tag family (`scene_marker_filter_optimization_custom.go`), and Studio descendants use the studio `id` column. Tests: `scene_marker_filter_optimization_custom_test.go` (in-memory, including different-marker, distinct-vato, either-role, and shorter-marker cases), `scene_marker_configuration_custom_test.go` and `scene_marker_identity_custom_test.go` (integration), and the opt-in read-only `scene_marker_audit_custom_test.go`. See `docs/custom_marker_filter_audit_custom.md` for earlier measurements.
- Unnamed vatos (Vato A, Vato B, …) can be defined by ethnicity, country, rating, and Rating Advisor criteria. Reusing a letter requires the same actual person across the referenced roles/configurations.
- The shared editor (`MarkerFilterEditor.tsx`, `markerFilterEditor_custom.ts`, `markerFilterEditor_custom.scss`) numbers markers (Marker 1, 2, …) so they cannot be confused with vato letters, shows a plain-language summary (↑ top, ↓ bottom, ↑↓ both, no arrow for any role) in the modal, the filter summary, and the filter chip, and gives each unnamed vato a coloured letter badge. The Vatos section lists every vato in the marker with a role picker, edit, and remove; new vatos default to Any role, and a vato created from a marker is added to it. Apply drops empty markers and unused unnamed vatos and is disabled when nothing is left. Shared model helpers are in `ui/v2.5/src/models/list-filter/criteria/marker-group_custom.ts`; `markerFilterEditor_custom.test.ts` covers roles, legacy migration, summaries, pruning, draft isolation, rating criteria, and URL/saved-filter persistence. Cancel preserves the original filter.

### Scene and performer criteria

- Scene Type classifies Sex, Oral, Solo, and Facial scenes using configured tag families. Sex/Oral/Solo are mutually exclusive on Scenes; Facial is independently combinable. Performer selections use marker-level participation.
- Performer Markers filters (include and exclude) match marker participation, role, partner attributes, and tag ancestry. The unused `PerformerFilterType` inputs `marker_tags` (deprecated), `performer_marker_tags`, and `performer_marker_partners`, and the `partners.any_non_sex_bottomed/topped` metrics, were removed. Custom radio filters include Versatile Scenes, Circular Oral, Strict/Lenient Tops, and Strict/Lenient Bottoms.
- Performer country, ethnicity, rating, and profile-image-count criteria use database-backed values. Inclusive numeric operators (`>=`, `<=`) are available across numeric/date/duration controls.
- Custom criteria are highlighted in the filter picker so fork-only filters are easy to identify.
- Scene Activity/Quality percentage filters batch selected interval metrics over local candidates and preserve rounded comparisons, count queries, and nested logic. Scene Type and custom role filters use parameterized, cycle-safe tag-family sets; single-match Scene Marker groups stop early. Scene Performer Rating keeps ANY branches independent and enforces ALL for inclusive comparisons. See `docs/custom_scene_filter_audit_custom.md` for the audit and measured results. No schema, migration, or configuration changes.

### Key files

- `graphql/schema/types/filters_custom.graphql`, `pkg/models/filter.go`, and the `pkg/sqlite/*filter*_custom.go` handlers
- `ui/v2.5/src/models/list-filter/criteria/{scene-markers,marker-performers,performer-markers,unnamed-performer,scene-type,has-roles,custom-filters}_custom.ts`
- `ui/v2.5/src/components/List/Filters/{SceneMarkersFilter,SceneMarkersExcludeFilter,MarkerPerformersFilter,PerformerMarkersFilter,SceneTypeFilter,HasRolesFilter}.tsx`
- `ui/v2.5/src/models/list-filter/custom-filter-options_custom.ts` and `EditFilterDialog.tsx`

### Tests

SQLite and UI tests cover the 50% overlap boundary, exclusion behavior, role matching, unnamed-performer identity, tag ancestry, scene-type precedence, Has Roles combinations, profile-image counts, and custom-filter serialization. The scene-filter optimization tests additionally cover numeric operators, grouped/direct percentage aliases, AND/OR/NOT, counts/pagination/sorts, HAVING boundaries, cyclic ancestry, and performer-rating composition. The optional read-only filter audit compares original and optimized matching IDs.

---

## 4. Statistics dashboards

### Overview

The custom statistics experience is split into hidden, focused destinations instead of the retired `/customstats` page. Shared navigation links to `/scenestats`, `/vatostats`, `/ostats`, and the `/stats/playground` hub; Scene, Vato, and O Stats can also be embedded in Studio detail tabs with an optional child-studio scope.

### Shared date range and charts

- Every stats page has a **Dates** filter (All time, Last 30/90 days, Last 12 months, This year, Last year, Custom). It lives in the URL (`statsRange`, `statsFrom`, `statsTo`, `statsDateField`), survives refresh/back, and carries across the stats navigation links and O Stats drilldowns. Relative presets resolve to local calendar days.
- Scene and Vato Stats can filter by **Release date** (effective date), **Date added**, or **O date**. O date keeps scenes with an O in the range and also limits O counts to that range. O Stats always filters by O date. The old "(past year)" podium options were removed in favor of the range.
- The date range narrows the shared `selected_scenes` scope, so studio scope, date range, totals, Activity & Ratings, Activity Matrix, Rating Advisor, and vato aggregates always agree. With a date range, Vato Stats lists only vatos with scenes in range.
- All three pages render the shared `StatsBarChart`: total and percent per bar, tooltips, "Sort by count" for ordered distributions, "Show all" for long charts, and Unknown badges. Charts where one item lands in several bars (ethnicity, country, roles, ages, marker tags, top vatos) mark the total with `*` and explain the overlap.
- Year, month, and day charts are zero-filled, so empty periods show as zero bars instead of disappearing.

### Scene Stats (`/scenestats`)

- **Top Scenes** are ranked image cards (five initially; Show more adds ten) with a **Rank by** metric: O Count, Rating, Duration, File Size, Most Recent O, Vato Count, and Facial Count. O Count ties go to the scene that reached its count most recently.
- Charts cover vato ethnicity/country/count, O Count, release year/month/day, facial status/count, Really Hot Facial count, scene type, duration buckets, resolution, and metallic rating (including a set-but-unqualified `None` bucket).
- Average scene length, average scenes per vato, the Sex/Oral/Solo/Facial category cards, and the vato-count cards (1, Standard 2, Threesome 3, Group 4+) follow chart filters and the release drilldown. Nut, facial, and time totals, Activity & Ratings, and Activity Matrix share the exact chart/release cohort; filter chips stay visible in every section. Event cards say “View markers” and explain that each assigned top counts as an event (minimum one), while the linked list counts markers and can include second-camera repeats omitted from the total. Marker links keep the scene cohort.
- Role families (Sex, Oral, Solo, Facial, Really Hot) include every descendant tag: the backend rolls descendant marker tags up to the configured family tag. Category cards are router links whose scene searches include sub-tags.
- Activity Type and Quality donuts, Rating Advisor averages, and the Outstanding Activity Matrix are available globally and for Studio-scoped Scene Stats. Sex, Oral, and Solo partition 100% of classified activity duration; unclassified Other time is shown only as a raw duration in a scene's Stats tab.
- Chart selections open scoped list drilldowns; URL-backed state restores Studio scope, filters, podium metric, list visibility, selected section, date range, and child-studio mode on refresh/back navigation.

### Vato Stats (`/vatostats`)

- Five Vato summary cards (Total Vatos, Meters of Pito, Total Nuts, Total Nut Time, and Estimated Liters) follow the page title, ahead of ranked vato image cards (titled "Best … pitos (By …)", six initially; Show more adds twelve, with a **Rank by** metric), Rating Advisor averages, and charts for ethnicity, age at scene, rating, metallic rating, height, country, hair, eyes, circumcision, penis size, O Count, Total Scenes, Sex/Oral Top and Bottom scenes, and Facials Given/Received. Every total follows the selected vato cohort. Nut/time totals count events in the matching vatos’ scenes; criteria use the exact selected vatos, including zero-scene profiles and excluding unselected co-stars. The estimate cards remain visible; their hover tooltips show measured/assumed counts with the 17 cm fallback and the Total Nuts × 3 mL formula. Unscoped Vato Stats includes zero-scene vatos so Total Scenes can show its zero bucket.
- O Count ties go to the vato who reached his count most recently (`most_recent_o_date` is a UTC timestamp for this). The ranked cards and the paged vato list share one ranking.
- **Age at Scene** counts distinct vatos who did at least one scene at each age; Unknown counts vatos with any scene whose age cannot be calculated.
- Solo-only and one-scene vatos are retained; unknown values appear as counters rather than zero-value bars.
- Role cards are replaced by clickable **By Role Strictness** (Pure Tops, Lenient Tops, Pure Bottoms, Lenient Bottoms, Solo Only) and **By Role** (Sex/Oral/Facial Tops and Bottoms, Solo) charts. Pure roles include sex and/or oral with no opposite sex/oral role; lenient roles require exclusively one sex role plus the opposite oral role. Facials do not affect strictness. Solo Only requires every scene in the current scope to be solo; Solo includes any solo appearance. Role bars count distinct vatos, retain zero counts, and follow the current scope and chart filters. Classification and drilldown predicates share `vatoStatsRoles_custom.ts`.

### O Stats (`/ostats`)

- **Latest** shows the five newest recorded O events above the summary, with scene seek links, dates, ordinal chips, and associated marker tags. **View All** opens `/ostats/timeline`, a newest-first timeline with 25 events per page and Previous/Next links. Both preserve Dates and the studio tree; changing Dates resets the timeline to page one. Before this entry, full-library O history had no route; existing date/entity drilldowns remain available.
- Summary cards show Total O's, Most O's in a day, and Longest period without an O. Records use local calendar days (matching the date charts) and the dry spell runs to today or the end of the date range. The daily records and By Studio breakdown are global-only and omitted from the embedded Studio view.
- **O Calendar** is a GitHub-style heatmap for a chosen calendar year (Jan 1 to Dec 31) with total, active days, best day, and longest streak. Days before reliable tracking (2024-03-08) are hatched; each active day links to its timeline. The heatmap uses its own year, not the page date range.
- **Top Scenes** and **Top Vatos** follow the summary cards as large ranked image cards with O count and share. All stats rankings start with five scenes or six vatos; Show more adds ten scenes or twelve vatos. Each opens its O timeline. Ties go to whoever reached the count most recently. `sceneOCountsByScene`/`sceneOCountsByPerformer` return screenshot and portrait URLs. **By Scene Rating** and **By Metallic Tier** sum O's by the scene's rating bucket and metallic tier (including override tags and GOAT/bonus), with drilldowns at `/ostats/rating/:bucket` and `/ostats/tier/:tier`.
- Hidden O-date timelines and drilldowns by year/month/day, activity type, marker tag, vato ethnicity/country/age, Studio, and scene effective release year. Newest-first event timelines show associated marker tags, per-scene ordinal chips, scene/vato links, and optional exact O screenshots generated from video timestamps. Scene timelines show title, studio, and cast once above the events; each event retains its seek link. Mixed-scene timelines retain row identity. Reliable-date filtering starts at 2024-03-08 for date charts only.
- Studio details add O Stats beside Vato Stats. Every aggregate and drilldown filters to that studio, follows the Include child studios switch, and keeps the scope and date range while navigating.

### Insight Stats (Playground tab)

- Scans the library in bounded pages and compares saved Scene Insight chips with temporary in-memory thresholds. Current/preview chip counts link to exact Scene ID snapshots, and chip-family drilldowns retain their evidence and combinations. Activity quality combinations group Outstanding Sex and Oral shares into 20-point ranges; Fucking / eating pito splits use 10-point ranges.
- Insight Stats is the fourth `/stats/playground` tab rather than a standalone destination. Its threshold changes never persist; the scan is cached in IndexedDB for 12 hours and obsolete worker calculations are cancelled. The scene scan and cache are shared with the other Playground tabs, including the extra fields needed by their filters and tooltips.

### Implementation and schema

- Compact set-based resolvers live in `internal/api/scene_stats_*_custom.go`, `vato_stats_*_custom.go`, `activity_stats_custom.go`, `stats_marker_counts_custom.go`, and `o_stats_aggregates_custom.go`. `stats_date_range_custom.go` validates `StatsDateRangeInput` and builds the release/added/O-date predicates used by `activityStatsSceneScopeCustom` and `sceneOStatsScopeCustom`.
- UI pages and shared panels are under `ui/v2.5/src/components/{SceneStats,VatoStats,OStats,InsightStats}` ; the shared chart and date filter are `StatsBarChart_custom.tsx`, `statsBarChart_custom.scss`, `StatsDateRangeFilter_custom.tsx`, `StatsTopCards_custom.tsx` + `statsTopCards_custom.scss` (ranked cards with the rating star), `hooks/useStatsDateRange_custom.ts`, and `utils/{statsDateRange,statsBarChart,sceneMetallicRating}_custom.ts`.
- Custom GraphQL types and queries are in `graphql/schema/types/stats_custom.graphql`, `scene_custom.graphql`, and `ui/v2.5/graphql/queries/stats_custom.graphql`.
- Chart cohorts: `StatsCohortInput` in `graphql/schema/types/stats_cohort_custom.graphql` adds optional `cohort` arguments to activity/matrix/rating and event count/time queries. `internal/api/stats_cohort_custom.go` validates IDs, preserves empty selections, and combines them with studio/date scope using bound JSON arrays. UI changes live in SceneStats, VatoStats, and OStats, including `sceneStatsSummary_custom.ts`, `sceneStatsActivityMatrixData_custom.ts`, `vatoStatsStudioScope_custom.ts`, and `oStatsTimelinePresentation_custom.ts`. No database migration or new configuration dependency.
- Latest/full O history: `graphql/schema/types/o_stats_timeline_custom.graphql` adds `SceneOEventPage` and `sceneOEvents(page, per_page, studio_id, depth, date_range)`. `internal/api/o_stats_timeline_custom.go` counts and pages events in one read transaction, caps page sizes at 100, and clamps pages past the end. Operations are in `ui/v2.5/graphql/queries/o_stats_timeline_custom.graphql`; `OStatsTimeline_custom.tsx` shares event rendering with existing drilldowns, and `oStatsTimelinePaging_custom.ts` preserves pagination URLs. The explicit route lives in `App.tsx`; ranked card batch sizes are shared through `utils/statsTopPaging_custom.ts`. No migration or configuration dependency.
- Schema changes: added `StatsDateField`, `StatsDateRangeInput`, a `date_range` argument on every scene/vato/O stats query, `sceneOCalendarDayCounts`, `sceneOCountsByScene`, `sceneOCountsByPerformer`, `sceneOEventsByScenes`, and `SceneStatsScene.performer_ids`. Removed the past-year fields (`o_counter_past_year`, `is_past_year`, `is_release_past_year`, `performer_count_past_year`, `scene_o_count_past_year`), `SceneStatsResult.unique_performer_count`, the unused `performersFacial*/Sex*/Oral*/Strict*/Lenient*/SoloOnly/OneScene` counts, `performerEthnicityFiveStarCounts`, `performerEthnicityCounts`, `performerEthnicityTierCounts`, `SceneStatsScene.date`, `SceneStatsResult.count`, `estimatedLiters`, and `totalPenisMeters` (Vato Stats computes its summary from the loaded vato rows).

### Tests

`internal/api/stats_cohort_custom_test.go` covers empty/large cohorts, studio/date intersections, event units, and exact rating membership. `ui/v2.5/tests/informationPresentation_custom.test.ts` covers presets, direct empty-media navigation, active-sort values, timeline identity, and scoped marker links; `vatoStatsStudioScope_custom.test.ts` verifies estimate assumptions.

`internal/api/o_stats_timeline_custom_test.go` covers stable page boundaries, undated/orphan events, pre-tracking events, studio trees, date ranges, empty results, and page limits. `ui/v2.5/tests/statsPagination_custom.test.ts` covers ranking batch sizes, timeline URL scope, invalid pages, Latest placement, and route reachability. `vatoStatsSummary_custom.test.ts` verifies the five visible summary cards and ranking options.

Go and UI tests cover scope construction (including Studio O Stats), date range parsing and release/added/O-date scopes, O-date-limited O counts, local-day O records and calendar counts, per-scene/per-vato O counts, descendant role-tag roll-up, interval merging, marker weighting, chart buckets/Unknown handling, zero-filled date series, the calendar grid and streaks, rating/tier O buckets, O's per scene, distinct-vato age buckets, Activity Matrix aggregation, O event ordering/navigation, objective activity icon summaries and zero suppression, quality/split percentage ranges, chip-preview worker cancellation/cache reuse, Playground tab routing, and exact Scene/Vato snapshot filters.

---

## 5. Task Progress Tracker

### Overview

Tag-based task tracking records daily completions and incoming work for scenes, markers, images, galleries, performers, studios, and groups. Trackers support selectable scopes, active/paused/completed/archived lifecycle states, fixed batches, ordering, details/edit dialogs, and persisted history.

### Behavior

- Removing a direct tag or deleting a tagged item records completion; adding the tag records incoming work. Marker primary/secondary tag updates are atomic and deduplicated.
- Overall Progress tracks organized scenes. New scenes and organized-to-unorganized reversals are incoming work; unorganized-to-organized changes are completions. Deleting a scene recalculates snapshots without inventing completion events.
- History uses America/Mexico_City dates. The chart preserves zero-activity calendar days, defaults to full-width completed bars with a cumulative completed line and optional Incoming bars, and provides paginated daily activity and fixed-batch remaining-item links. Its organized hover tooltip shows the selected point's completed or remaining percentage plus the percentage-point progress made during that day, week, or month.
- Paused trackers continue recording; archived trackers freeze activity and resume with a fresh baseline. Version checks reject stale edits, and restoring a deletion preserves baseline membership.
- Each card has a compact single-line, browser-local Items-per-day finish planner with immediate date calculation. Observed estimates require three complete days, use net progress, and exclude today's partial activity. Overall Progress instead persists its Items-per-day goal in the database, edited from its Details dialog.
- Trackers and Overall Progress persist an optional Goal per day. Their cards and details show Today, This week, and This month completed/goal progress alongside the signed change in total completion percentage since the previous day, week, or month closed; trackers without a daily goal show the raw completed totals in green. Weekly periods start Monday, and current weekly/monthly targets count only elapsed calendar dates. History charts switch between daily, weekly, and monthly aggregation and color completed bars by the applicable period goal.
- Goal changes are effective on the current reporting date. Effective-dated goal history preserves prior daily colors and rolls old and new daily targets into their corresponding weekly/monthly periods instead of retroactively applying the latest goal.
- Details shows completed, remaining, and percentage summary cards above the shared history chart. Fixed-batch completed counts use the current baseline.
- The main progress page includes a browser-local Timer Countdown modal. A duration in minutes starts a real-time countdown with pause/resume and final stop controls. After reaching zero it tracks overtime from `00:00`; Stop freezes the timer and displays total active time taken, with no restart action available in that modal. The large display transitions from green through light green, yellow, orange, and red as the percentage remaining crosses 80%, 60%, 40%, and 20%.
- Milestones group any non-deleted trackers other than Overall. Each milestone has a required name, optional target date, independent effective-dated daily goal, and members that may also belong to other milestones. The Milestones tab shows one selected milestone with summed counts, full member history, goals (Today/This week/This month boxes also show the completed-items change against yesterday or the same elapsed days of the previous week/month), forecasts, 25/50/75/100% checkpoint badges with the date each was first reached, the history chart, completed/total items by type, and a per-tracker contribution table. The table shows completed items, an overall percentage bar, and items completed and percentage points gained today, this week, and this month, with each percentage column showing its change (as a %) against the matching previous period; it defaults to sorting by this week's gain, badges the tracker with the most completions this week, and dims trackers with no completions in the last 30 days. When incoming work makes net pace non-positive, the estimated finish uses completion pace and says it assumes no new items arrive. Selection has a direct URL and is remembered in the browser; the finish planner is browser-local per milestone. Overlapping items count once per tracker. Changing membership recalculates history, and deleting a milestone leaves its trackers untouched.
- The Reports tab shows weekly, monthly, and yearly reports with Previous/Current/Next navigation and direct date, month, and year selectors bounded by the first recorded activity. An Overview for Organized scenes or any tracker or milestone shows tiles for items completed, progress advanced, goal days met, and active days, each compared with the previous period (the same elapsed days while a period is still running). Below the tiles, weeks show daily bars colored by goal state, months a Monday-first calendar heat grid, and years a contribution heatmap plus monthly bars. Heat shades scale against the day's goal when one is set (meeting it is the darkest shade), otherwise against the busiest day shown. Trackers and milestones with completed items have separate tables sorted by period completions, with cumulative completed items, goal days met, actual/goal with a goal-colored bar, signed percentage change, and each row's share of the section's completions, with goal days met, actual completions, and percentage change each compared against the previous period; active trackers and milestones with no completions are listed under a collapsed idle line. Current periods count elapsed days only. Task Progress dates and date pickers display `dd/mm/yyyy`.

### Key files and schema

- `graphql/schema/types/task_progress_tracker_custom.graphql` and `schema_custom.graphql`
- `internal/api/resolver_task_progress_tracker_custom.go`, `resolver_task_progress_history_custom.go`
- `pkg/models/task_progress_tracker_custom.go`, `pkg/sqlite/task_progress_*_custom.go`, and entity-store hooks
- Trackers and milestones expose `completed_item_counts` (completed items per type: completion events for backlog trackers, completed members for fixed batches).
- `task_progress_tracker_history.up.sql`, `task_progress_overall_history.up.sql`, `task_progress_tracker_goal_per_day.up.sql`, `task_progress_goal_history.up.sql`
- `ui/v2.5/src/components/TaskProgress*`, `TaskProgressTimerCountdown_custom.tsx`, and `taskProgressTimer_custom.ts`; `ui/v2.5/graphql/{data,queries,mutations}/task_progress_tracker_custom.graphql`
- Milestone models, store, resolvers, and schema use `_custom` files; `task_progress_milestones.up.sql` documents the standalone schema. UI components and GraphQL operations use `task_progress_milestone_custom` files. Milestones load through `findTaskProgressMilestones`; the unused single `taskProgressMilestone(id)` query was removed.

### Tests

Coverage includes bootstrap/retrofit, CRUD/order/versioning, fixed membership, lifecycle recording, tag and deletion events, Overall Progress transitions and goal persistence, effective-dated daily goals, weekly/monthly aggregation, date boundaries and period percentage changes, forecasts, goal states, card/modal rendering, visible-data rules, and Timer Countdown duration/formatting, pause/overtime/stop timing, and color thresholds.
Milestone tests cover persistence, membership, summed counts and history, completed counts by type, daily goals, target pace, checkpoints, per-tracker period contributions and previous-period comparisons, the 30-day idle rule, and URL selection. Report tests cover calendar boundaries, activity-bounded period navigation, previous-period comparison windows, effective-dated goals, elapsed current periods, active days, daily/monthly series, Monday-first week grids, heat levels, totals, and percentage changes.

---

## 6. Studio metrics and performer Studios

### Studio category metrics

Studio cards and detail pages expose Sex, Oral, Solo, Facial, and Unique Performer counts. The Facial button on studio cards and the detail page shows the Facial Count. It uses the Scene Stats "Total Facials" rule: each facial marker (with subtags) counts once per top vato, with a minimum of one, and 2nd-camera markers are left out. In a performer's Studios tab it shows that performer's facials in the studio (`studio_performer_role_stats.facial_marker_count`). The button opens the Markers page filtered by studio, facial tag, and performer when scoped (`makeStudioMarkersUrl`). That page still lists 2nd-camera markers and lists each marker once, so it can show more or fewer rows than the count. Sources: `Studio.facial_count(depth)` on the detail page and `StudioListStats.facial_count` on cards. Both Studio and Performer lists have a Facial Count sort (`facial_count`), separate from Facial Scene Count; Studio List mode also offers it as a column. The Performer sort counts markers where the vato is top or bottom. Shared SQL: `pkg/sqlite/facial_count_custom.go`; test: `pkg/sqlite/facial_count_custom_test.go`. The detail strip no longer repeats the activity/quality percentage rows, which the header insights already show. Studio lists can sort by those categories, Standard/Really Hot facial markers, metallic scene tiers, O Count, and other custom aggregates. Active non-default sorts show an emerald value in the existing card control or a compact metric strip; default and Random sorts remain quiet. Counts honor configured role tags, child-studio depth, and performer scope.

The studio list uses a page-level `studio_list_stats` query for batched counts, recursive O totals, role counts, and activity/quality percentages. This avoids one aggregate query per card. Detail pages use the batched `studio_role_counts` and `studio_performer_role_stats` fields; the old per-field Studio role counts (`sex_scene_count(depth, performer_id)` and its 20 siblings) were removed.

Custom Studio quality filters and sorts batch interval calculations over matching studios. Role scene-count sorts use indexed existence checks; missing role configuration and release-only markers no longer break their ordering or exclusions. The [custom Studio SQL audit](docs/custom_studio_filter_sort_audit_custom.md) records measurements and scope. Regression tests cover scalar equivalence, boolean filter composition, pagination, interval overlap, rounding, tag configuration, and release-only markers. No schema, migration, or configuration changes are required; existing role-tag settings remain in effect.

### Studio list table

Studios have a List display mode (`disp=1`) that shows studio metrics as columns. By default it shows the logo, name, rating, scene count, duration, Sex/Oral/Solo %, the four metallic tiers, No Metallic, and the average performer, overall, solo, standard, threesome, and group scene ratings. The column picker adds the other sortable metrics except Latest Scene and the rating-criteria averages. Average Overall Scene Rating (also a Studio sort) matches the Rating Advisor's overall scene average: it averages scenes that fall in the solo, standard, threesome, or group section. Clicking a column header sorts by that metric; clicking it again flips the direction. Names start ascending and metrics start descending. When the active sort's column is hidden, the table adds it on the right, highlighted, without saving it. The No Metallic Scene Count (rated scenes below Bronze; unrated scenes are excluded) is also a Studio sort.

Page-payload metrics come from `studio_list_stats`. Metrics that are only computed on the backend come from `FindStudiosResultType.studio_list_metrics(metrics:)`, which reuses the Studio sort SQL expressions for the visible columns in one query. `ListTable` accepts optional `sortBy`/`onSort`/`extraColumns` props (shared helpers in `listTableSort_custom.ts`), and the card badge and table share `SortMetricValueCustom`. Saved columns use the `studios` key in `ui.tableColumns`. The sticky pagination footer lets clicks through outside its buttons so list tables' horizontal scrollbars stay draggable. No migration or new configuration is required.

### Studio header insights

Studio detail headers repeat the Scene Stats Activity Type and Quality boxes in the space to the right of the studio details. Below them are Rating Advisor averages: Overall, Solo, Standard, Threesome, and Group scene ratings plus the average Vato rating, each with its rated count. Scope follows the "Include sub-studio content" UI setting when the studio has child studios. Activity comes from the existing `studio_activity_stats` fields in the studio payload, and ratings come from the existing `FindStudioRatingAdvisorStats` query. Each part hides when it has no data, and the whole block is hidden while editing. Key files: `ui/v2.5/src/components/Studios/StudioDetails/{StudioHeaderInsights.tsx,studioHeaderInsights_custom.ts}`, a `CUSTOM` hook in `Studio.tsx`, and styles in `Studios/styles.scss`. Test: `ui/v2.5/tests/studioHeaderInsights_custom.test.ts`. No schema, migration, or configuration changes.

### Performer Studios tab

Performer details have a Studios tab showing only Studios represented in that performer's scenes. The list keeps the basic scene count but hides studio-wide category totals when performer-filtered, preventing misleading unscoped numbers. Studio detail pages also expose Scene Stats and Vato Stats tabs described in section 4.

### Key files

- `ui/v2.5/src/components/Studios/{StudioCard,StudioList,StudioCardGrid,StudioListTable,StudioSortMetricStrip_custom}.tsx`, `StudioListTable.scss`, `studioSortMetric_custom.ts`
- `ui/v2.5/src/components/List/ListTable.tsx` (CUSTOM sort hooks), `ui/v2.5/src/components/Shared/SortMetricBadge_custom.tsx`
- Tests: `ui/v2.5/tests/studioSortMetric_custom.test.ts`, `internal/api/studio_list_stats_custom_test.go`, `pkg/sqlite/studio_sort_metric_custom_test.go`
- `ui/v2.5/src/components/Performers/PerformerDetails/PerformerStudiosPanel.tsx`
- `internal/api/studio_list_stats_custom.go`, `pkg/sqlite/studio_sort_metric_custom.go`, `studio_facial_marker_sort_custom.go`
- `pkg/sqlite/studio_activity_query_custom.go`, `studio_role_sort_custom.go`, their `_custom_test.go` files, and `studio_audit_custom_test.go`; hooks in `studio.go` and `studio_filter.go`
- `graphql/schema/types/studio_custom.graphql` and `ui/v2.5/graphql/queries/studio.graphql`

---

## 7. Performer cards, partners, and images

### Cards, partners, and scene context

- Performer cards show role-aware scene counts, partner counts, activity-time metrics, and lazy-loaded role statistics. Partner badges use a person icon plus Top/Bottom direction so they are distinct from scene counts.
- Empty performer media tabs move into **More…**; direct URLs and shortcuts still open them. Empty versatility rows are suppressed. The catalog table defaults to Image, Name, Rating, Scenes, Unique Sex Partners, and Unique Oral Partners, with Browse/Metrics presets that preserve saved choices until selected. Headers toggle sorting and show a hidden active-sort metric temporarily; values reuse card definitions and batched role/backend metrics. Files: `Performers/{PerformerList,PerformerListTable}.tsx`, `performerTableColumns_custom.ts`, `performerSortMetric_custom.ts`, and `PerformerDetails/{Performer,PerformerVersatility_custom}.tsx`. No schema/config changes for these controls. Tests: `informationPresentation_custom.test.ts` and `listTableSort_custom.test.ts`.
- Performer detail **Stats** opens with **Versatility by Time**: stacked Overall, Sex, and Oral versatility bars computed from top vs bottom role time instead of partners (Overall adds Sex and Oral seconds), labeled Topped / Bottomed for, Fucked / Got fucked for, Got his pito sucked / Sucked pito for. They sit in a 40rem column and share the header bars' font sizes (`performer-versatility--detail`).
- **Detailed Scene Stats** (scene Stats tab) uses left-aligned tabs: **Performer Explorer** shows every vato side by side (at most four per row) with his scene-local Versatility by Time bars below him, and hovering a portrait shows it large within the screen; **Partner Interactions** keeps the clickable vato ribbon and partner table; then Interaction Matrix and Activity Matrix. The dialog is read-only: it has no loop tray, and its partner rows, lanes, and matrix cells are not selectable.
- **Compact vato portraits with hover:** the scene Markers tab activity tiles (and the marker dock), the Detailed Scene Stats Partner Interactions ribbon and partner table, the Interaction Matrix and Outstanding Activity Matrix headers, and the Vato Overview drawer's In This Scene grid use small portraits; hovering one (tapping on touch screens) shows it large beside it, opening toward the side with more room and staying inside the screen. Shared component: `Shared/VatoPortraitHover_custom.tsx` (with a `HoverPopover` fix so the show timer uses the latest placement); test: `tests/vatoPortraitHover_custom.test.ts`.
- The performer header shows vertically stacked **Versatility by Partners** bars for Sex, Oral, and Facial beside the details (the Activity Time cell was dropped there and from the scene Vato Overview drawer; the times live on the detail page), labeled with the spicy role copy (Fucked / Got fucked by, Got his pito sucked by / Sucked … pitos, Put mecos on … faces / Took mecos from): a marker on a green (bottom) to blue (top) track plus a label from Exclusive bottom through Versatile to Exclusive top, colored darker the more one-sided the vato is. Every full versatility bar shows the bottom percentage in green on the left and the top percentage in blue on the right (they add up to 100); card strips put the percentages in the tooltip. The share is how many unique partners he topped vs bottomed for in that activity, the same counts as the header role strip; a partner he did both with counts on both sides. The scene Vato Overview drawer shows the same full Versatility bars below the details, and hides the player's record-O button while the drawer is on screen (including its closing slide). Performer cards replace the Sex/Oral/Facial role columns with one-line strips (icon, bottom partner count, marker, top partner count, full wording in the tooltip); The Sex/Oral/Facial/Solo scene counts plus orgasm and feet icons sit below as the same icon strip the detail page uses. Facial counts unique partners like Sex/Oral; the card Oral strip links include scenes that also have sex, matching its partner counts; icons are white on normal cards, and metallic card themes keep the green/blue counts. The detail page and scene Vato Overview strip show only those icon counts (no partner-count or Top/Bottom arrow rows); scene-context cards use the same strips counting only partners in that scene (no all-scenes links; with 3+ vatos, hovering a count shows the partner portraits), skip a strip with no scene partners such as a self-facial, and show the scene's partner, facial, orgasm, and feet counts in the icon strip below. The scene card performer-count popover uses the same scene-only strips. Helpers and tests: `versatilityScale_custom.ts`, `PerformerCardVersatility_custom.tsx`, `tests/{vatoStatsMetrics,performerCardVersatility}_custom.test.ts`.
- The scene performer overview drawer opens from scene-detail cards and marker portraits, loads the full performer record on demand, shows role/activity metrics and scene-local partners, and supports new-tab links, backdrop, X, and Escape dismissal. Scene cards use the same configured performer card skin and show a small rating pill below the portrait. In the drawer, the role strip (sex, oral, facial, solo, orgasm, feet) sits in one line under the portrait; beside it are the vato's name, tags, and linked catalog rows (Scenes, Groups, Images, Galleries, O Count to the vato's O Stats page, Partners, Studios) with the app's count icons, hiding any row with nothing in it. The vato and scene-average ratings share one bar, details show label and value inline, and scrolling past the profile swaps the toolbar title for the vato's thumbnail and name (click to scroll back up). Scene-context performer cards drop the sex/oral/facial icons and the tag/scenes/O-count popover strip, since the versatility bars and this drawer already show them.
- The Partners tab uses role-colored headings, deduplicated partner portraits, and merged shared Sex/Oral marker duration. Partners-tab cards intentionally omit the favorite control; normal performer cards retain it.

### Multiple performer images

Performers can have additional profile images. On the performer detail page users can upload, delete, browse, and set any additional image as the default; duplicate uploads for one performer are rejected. The default `performers.image_blob` remains compatible with upstream consumers. A Profile Image Count criterion counts the default image plus additional images and supports inclusive comparisons.

### Player image overlays

The scene player can display up to two performer-library images over the video. Images are selected from scene performers, then dragged, resized, hidden, and restored in normal or fullscreen playback. Overlay state is intentionally session-local.

### Key files

- `ui/v2.5/src/components/Performers/PerformerDetails/{PerformerImageManager,PerformerActivityTime,PerformerStatsPanel,PerformerVersatility_custom}.tsx` and `ui/v2.5/src/components/Scenes/{styles.scss,SceneDetails/SceneStatsPanel.tsx}` (Versatility by Time in the Performer Explorer)
- `ui/v2.5/src/components/Scenes/SceneDetails/ScenePerformerOverviewPanel_custom.tsx`
- `ui/v2.5/src/components/ScenePlayer/{PerformerImageSelectModal,PerformerImageOverlay}.tsx`
- `pkg/models/model_performer_image_custom.go`, `pkg/sqlite/performer_image_custom.go`, `internal/api/resolver_model_performer_image_custom.go`
- `ui/v2.5/src/models/list-filter/criteria/profile-image-count.ts`

### Tests

Tests cover image CRUD/default behavior and duplicate handling, profile-image counting, role/activity cards, horizontal-stat-bar boundaries, scene drawer fields and links, partner duration merging, and overlay selection/interaction behavior.

---

## 8. Scene cards and Scene Insights

### Scene card metrics

Scene cards and details show role-aware performer strips, independent Activity Type coverage percentages, and partitioned Quality percentages. Sex, Oral, and Solo percentages each use the union of classified activity time as their denominator and are rounded independently, so overlapping markers can make their percentages total more than 100%; Other is shown only as a duration in Activity Type stats. Same-category intervals are merged and cross-category activity is retained in each category. Quality partitions runtime into Outstanding, Standard, Unclassified, and Unusable: every timed non-Sex/Oral/Solo marker counts as Outstanding across its full interval, including portions that overlap activity and portions outside activity; activity markers retain their existing GOAT and quality-tag rules. Negative-marker time remains Unusable. Standard covers remaining classified activity, while Unclassified covers the remaining runtime. Qualifying GOAT marker descendants use the same Royal Sapphire styling as rating cards. Activity boxes show each nonzero Sex, Oral, or Solo share and duration with an icon, plus its Outstanding share and duration; the copy is numeric-only while accessible labels identify each metric. Matching quality boxes show the nonzero Outstanding, Standard, Unclassified, and Unusable shares and durations with their icons. Icons use one neutral color on un-tiered cards, and tiered cards use the matching metallic ring color. Activity boxes appear below the release date on cards and directly below the title on scene details; card popovers follow Scene Insights. The former activity summary insight chips, scene-type title icon, and old qualitative activity-quality chips and thresholds have been removed.

### Scene list table

The Scenes List view (`disp=1`) has sortable column headers with the same behavior as the Studio table: click to sort, click again to flip, and a hidden active-sort column shows temporarily on the right. Title, Path, Studio, and Code start ascending; other columns start descending. By default it shows the cover, title, date, rating, duration, Vato Count, and O Count; Studio, Vatos, Tags, Movies, and Galleries are in the column picker. The picker adds every Activity Type and Quality percentage plus Orgasm Count, Orgasm Count (Really Hot), Facial Count, and Facial Count (Really Hot). The four count columns are also Scene sorts. A marker counts when its primary or secondary tags include the configured Orgasm or Facial tag or a subtag, and the Really Hot variants also need the Really Hot tag on that marker. The backend counts markers once in a sort-only CTE; the columns count from the loaded scene markers. The Date column sorts by effective date. Column values reuse the scene sort metric definitions, so each column shows what its sort orders by; activity percentages show 0% for zero-duration categories.

### Scene Insights

Scene cards and scene details expose a typed, evidence-backed insight strip with a complete hover popup. It can report GOAT and common Outstanding Activity tags, one combined Orgasm/Facial event chip, repeated or simultaneous orgasms, activity quality, Mexican or Royal-Sapphire lineup context, role rarity, interactions, and stored Rating Advisor warnings. The Scene contains chip includes Orgasm and Facial subtags even when their markers also contribute to GOAT or event reports; the configured Orgasm, Facial, Really Hot, and GOAT tags are excluded from that chip. The combined chip summarizes the total, facial and regular counts, and GOAT/Really Hot counts; its event popover shows every counted event with quality pills. Facial events show top portraits in blue and bottom portraits in green, while regular orgasms show only the top performer without a role outline. Insight Stats uses one Orgasm and Facial reports family with descending total, regular, facial, GOAT, and Really Hot event-count breakdowns. The hover stays open as the pointer enters the popup; event cards use a responsive column grid and the popup scrolls within the available viewport space. A configurable visible-chip limit keeps the card compact; the popup retains every visible candidate and its evidence. The Lackluster, Few Highlights, Everybody Nuts, standalone Feet, and Lots of filler insight families and their related thresholds are retired from scene cards, settings, and Insight Stats. Feet remains available through ordinary tag reports and the activity matrix. Quality combinations and Fucking / eating pito splits are retained for Insight Stats as bounded percentage ranges rather than separate card chips.

Rules worth knowing: the event report only repeats the total and says "regular" when facials and ordinary orgasms are mixed, and gets a gold accent when it has a GOAT event. Simultaneous orgasms also count separate Orgasm markers that overlap or start within 5 seconds. Interaction patterns ignore 2nd Camera markers, need each direction to cover at least 5% of the runtime (untimed markers count by presence), and describe only the vatos in the sex/oral action, naming sidelined cast members in the tooltip. Rare roles count Sex/Oral subtags and secondary tags in the current scene, and a role seen in only one history scene shows as "Only time X gives dick" (or takes dick, gets his pito sucked, sucks pito) at any threshold. Tags marked only without an end time use count wording ("Rimming ×2"). Only chips whose tags appear as Activity Matrix rows open it (table icon). Optional chips fill every free slot up to the visible limit, the plus appears whenever a chip is hidden, and cards hold the strip until performer role stats load so it does not reflow. Chip tones use distinct hues: gold is reserved for GOAT, events are pearl, and lineup chips are sky blue. Activity/Quality boxes and the Orgasm/Facial count columns use the same flattened tag ancestry as insights, so grandchild tags agree everywhere.

The Outstanding Activity Matrix is available from a scene, vato, global Scene Stats, or Studio Scene Stats. It merges intervals, shows duration and marker counts by tag and performer, supports direct/sub-tag roll-up, and links to the matching tag-marker view. GOAT evidence remains separate and higher priority. Scene cards use batched performer history and marker context so insights do not issue one query per card.

### Key files

- `ui/v2.5/src/components/Scenes/SceneCard.tsx`, `sceneActivityMetricsData_custom.ts`, and `SceneCardInsights_custom.tsx`
- `ui/v2.5/src/components/Scenes/sceneCardInsightSelection_custom.ts`, `sceneCardInsightTypes_custom.ts`, `sceneCardInsightPerformerRules_custom.ts`; `ui/v2.5/src/components/Performers/{performerRoleStats_custom.ts,performerRolePartnerLabels_custom.ts}` (role-stats loading state and Only-time wording); Insight Stats catalog and cache version in `ui/v2.5/src/components/InsightStats/`
- `ui/v2.5/src/components/Scenes/OutstandingActivityMatrix_custom.tsx` and `sceneCardInsightsData_custom.ts`
- `ui/v2.5/src/components/SceneStats/SceneStatsActivityMatrix_custom.tsx`
- `internal/api/scene_stats_activity_matrix_custom.go`, `pkg/sqlite/scene_marker_tag_ancestors_custom.go`
- List table: `ui/v2.5/src/components/Scenes/{SceneList,SceneListTable}.tsx` (CUSTOM hooks), `sceneListTableColumns_custom.tsx`, `sceneSortMetric_custom.ts`; `ui/v2.5/src/components/List/{listTableSort_custom.ts,ListTable_custom.scss}`; `pkg/sqlite/scene_marker_count_sort_custom.go` with its hook in `scene.go`

### Tests

List table coverage: `pkg/sqlite/scene_marker_count_sort_custom_test.go`, `ui/v2.5/tests/listTableSort_custom.test.ts`, and the marker-count cases in `ui/v2.5/tests/sceneActivityMetricsData_custom.test.ts`. Coverage also includes candidate selection/priority, GOAT and event precedence, per-facial role portraits, tag ancestry, interval merging, Activity Matrix totals, vato attribution, retired chip-family removal, quality boundaries, and seven-chip rendering, free-slot selection and the plus control, matrix-row chip opening, simultaneous orgasms across markers, interaction evidence and 2nd Camera exclusion, sidelined cast members, Only-time and subtag rare roles, untimed tag wording, the GOAT event accent, and deep-ancestry metric counts.

---

## 9. Multi-segment loops and marker playlists

### Multi-segment loops

The scene player supports unlimited A-B segments that play in order and repeat. Playback-rate-aware boundary timers and merged negative-marker ranges prevent early transitions and skip an entire overlapping undesirable range.

- **Player menu:** one loop button in the control bar (its badge counts saved presets) opens a menu with the loop switch, Mark start/end, previous/next segment, preset quick-load, and Edit segments. The menu lives inside the player, so it works in fullscreen; Edit segments leaves fullscreen and opens the Loop tab.
- **Loop tab:** the scene page tab next to Skip edits the current owner's loop. Segments can be added from the player, selected markers, or the scene Stats tab (Activity Type, Quality, and the Sex/Oral/Solo Quality boxes, which add that activity's Outstanding or Standard spans), then reordered, repeated alone, edited with ±1s or current-time boundaries, individually/bulk deleted, kept as a subset, and cleared. Timestamps seek like the Markers tab and show milliseconds when present.
- **Presets:** saved per scene or release, including segment titles. Overwriting a preset, loading over different segments, deleting a preset, and clearing all segments ask for confirmation.
- **Playback rules:** a seek into another segment plays that segment; a seek into a gap while playing returns to the current segment, while paused scrubbing is left alone. Deleting segments keeps the playing segment, turning the loop on keeps the segment under the playhead (or starts at the next one), and repeating one segment turns the loop on. Turning the loop off ends single-segment and remote-subset modes.
- **Setting:** `configuration.ui.showMultiSegmentLoopControls` (default on) shows the player button and Loop tab. The multi-panel scene viewer uses the same menu and opens the editor in a dialog.

### Marker playlist player

The Markers page can queue markers from multiple searches and open a sequential cross-scene player. The player double-buffers the next source, reuses the current source for markers on the same scene or release, shows generated marker screenshots, advances/replays/loops, exposes normal/fullscreen O recording, and keeps the active item visible. Release markers stream their own file, attribute O events to their release, and open the parent scene with that release selected. Saved playlists persist marker IDs and order with a custom name and can be loaded or deleted later (playlists are not edited in place, so `findMarkerPlaylist` and `markerPlaylistUpdate` were removed).

### Key files

- `ui/v2.5/src/components/ScenePlayer/multi-segment-loop.ts` (plugin; state is published through `subscribe`/`getSnapshot`), `multiSegmentLoopState_custom.ts`, `playbackBoundary_custom.ts`, and `multiSegmentSelection_custom.ts`
- `ui/v2.5/src/components/ScenePlayer/useMultiSegmentLoop_custom.ts`, `useMultiSegmentLoopPresets_custom.ts`, `multiSegmentLoopSettings_custom.ts`, `MultiSegmentLoopMenu.tsx`, `MultiSegmentLoopEditor.tsx`, `MultiSegmentLoopConfirm.tsx`, and `multiSegmentLoop_custom.scss`
- `ui/v2.5/src/components/Scenes/SceneDetails/SceneLoopPanel.tsx`, with hooks in `Scene.tsx`, `ScenePlayer.tsx`, and `MultiVideoViewer.tsx`
- Presets: `scene_loop_presets.up.sql`, `pkg/sqlite/scene_loop_preset_custom.go`, and `internal/api/resolver_scene_loop_preset_custom.go`; `MultiSegmentLoopSegment` and its input have an optional `title` stored in the existing segments JSON (no migration)
- `ui/v2.5/src/components/Scenes/MarkerPlaylistPlayer.tsx`, `MarkerQueueIndicator.tsx`, `markerPlaylistPreload_custom.ts`, and `markerPlaylistORecord_custom.ts`
- `ui/v2.5/src/hooks/MarkerQueue.tsx`
- `graphql/schema/types/marker-playlist_custom.graphql`, `marker_playlists.up.sql`, and `internal/api/resolver_{query,mutation}_marker_playlist_custom.go`

### Tests

Tests cover segment selection/bulk actions, exact boundary timing, negative-range merging, cross-scene preload selection, queue lifecycle, saved-playlist CRUD, fullscreen O confirmation, and active-marker timestamp validation. `ui/v2.5/tests/multiSegmentLoop_custom.test.ts` drives the real plugin through snapshot updates, removal during playback, seeks into segments and gaps (in browser event order), enabling mid-scene, single-segment repeat, and the setting default; Go tests cover preset title normalization, API output, and legacy segment JSON.

---

## 10. Unified multi-panel viewers

The fork provides one viewer surface for selected Images, Markers, and Scenes. Items are read from `ids` URL parameters and rendered as independent draggable/resizable panels on a dark canvas. Panels support close/hide, fullscreen, and reflow controls; scene/marker panels use the custom video controls and marker timelines. Image panels preserve aspect ratio and use a minimum size. Marker and scene queues are in-memory and clear when leaving their catalog.

### Key files

- `ui/v2.5/src/components/Viewers/UnifiedViewer.tsx` and `ui/v2.5/src/components/Scenes/MultiVideoViewer.tsx`
- `ui/v2.5/src/components/Images/DraggableImageOverlay_custom.tsx`, `ImageQueueIndicator.tsx`
- `ui/v2.5/src/components/Scenes/SceneViewerQueueIndicator.tsx`, `MarkerViewer.scss`, and `SceneViewerQueue.tsx`
- Routes: `/images/viewer`, `/scenes/markers/viewer`, and `/scenes/viewer`

---

## 11. Scene Releases and Effective Date

### Scene detail presentation

Details omits Studio Code and maintenance dates. Created At/Updated At appear at the bottom of Edit; Studio Code stays editable there. Details, Markers, Skip, Loop (when enabled), Releases, Stats, and Edit remain direct tabs. Gallery (when populated), File Info, Queue, Movies, Filters, and History live in More, retaining pane state and shortcuts. Files: `ui/v2.5/src/components/Scenes/SceneDetails/{Scene,SceneDetailPanel,SceneEditPanel}.tsx`. No schema/config changes; checked in the dev UI and UI type/lint/build checks.

### Scene Releases

A scene can contain alternate releases with independent metadata, Studio, cover, files, galleries, streams, and playback order. Release-owned data includes ratings and advisor rows, cast, tags, groups, Stash IDs, custom fields, markers, negative ranges, loop presets, playback position, and play/O history. Users can create/edit/delete releases, convert a scene to a release or a release back to a scene, add files by path or existing file ID, remove files with an optional filesystem deletion confirmation, choose the playback release, and compare release media metadata with the main scene. Scenes can be filtered by release count.

Release marker and skip-range editors write through owner-scoped mutations, and loop presets saved from the Loop tab belong to the selected release. A release with no file shows an empty media state instead of playing its parent. The playback context resets when its owner or primary file changes.

Conversions preserve source metadata and activity in one transaction, keep parent-scene data separate, and accept a persisted request ID for safe retries. The obsolete `transfer_o_history`/`transfer_markers` conversion flags were removed. File moves within a scene family preserve one primary file and prevent silent cross-family ownership. Release playback and history edits write activity to the release, and library-wide totals include release events once. The player loads the release primary file's captions, funscript, preview, sprite, and heatmap through release-owned routes when those assets exist. While a release plays, the Markers and Skip tabs show its own seekable ranges instead of the parent's editable ranges. Release summaries use compact covers and action menus; the editor supports explicit field clearing and warns before discarding a draft. Existing incomplete releases retain only data that was actually stored.

Storage uses `scene_releases`, `scene_release_files`, `scene_release_galleries`, and the normalized tables in `scene_releases_metadata_v2.up.sql`. The separate activity and rating upgrades preserve existing IDs and references; `scene_releases_planner_stats.up.sql` restores SQLite statistics after their table rebuilds so performer counts remain fast. Upgrade order, preflight, backup, and rollback steps are in `SCENE_RELEASES_UPGRADE_custom.md`; these SQL files are applied manually outside upstream migrations. The API is defined in `scene-release_custom.graphql` and implemented by `pkg/sqlite/scene_release*_custom.go` and `internal/api/resolver_*scene_release*_custom.go`. The UI lives in `SceneReleasesPanel.tsx` and `SceneSelectorDialog.tsx`. Focused SQLite tests cover metadata round trips, markers, skip ranges, loop presets, covers, file ownership, activity attribution, advisor ratings, retry records, effective-date nulls, and gallery symmetry. UI tests cover owner selection, media isolation, conversion counts, and marker seeking.

### Effective Date

`Scene.effective_date` is the earliest non-null date among the scene and all releases. It is displayed in cards/detail/list/tagger views, can be filtered and sorted, and is used for performer-age and release-year calculations. Null release dates are ignored; a scene with no dated release falls back to its own date.

---

## 12. Marker preview source-quality generation

Settings can request source-width marker video/WebP previews instead of the default 640px output. Generation probes existing artifacts and regenerates only files produced under the opposite quality mode. A separate setting trusts existing quality and skips that probe.

Simple primary-only Sex/Oral/Solo markers, plus a configurable skip-tag list, can omit video/WebP previews while still generating screenshots. Settings > Custom provides a cleanup action for already-generated simple-marker previews. The behavior is wired through the Generate task and does not affect screenshots.

### Key files

- `pkg/scene/generate/generator.go` and `marker_preview.go`
- `internal/manager/task_generate_markers_custom.go`, `task_generate.go`
- `graphql/schema/types/{config,metadata}_custom.graphql`
- `ui/v2.5/src/components/Settings/SettingsSystemPanel.tsx`, `SettingsCustomPanel.tsx`

---

## 13. Persisted Rating Advisor and metallic card styles

### Rating Advisor

Scene and performer detail pages provide weighted Rating Advisor questionnaires whose raw answers are validated and persisted server-side. Recalculation derives canonical weighted values and updates `rating100`. Scene mode has standard (2–3 vatos), solo, and 4+-performer group rubrics; performers have their own rubric. Advisor averages and Studio average sorts still report Standard (2 vatos) and Threesome (3 vatos) separately, both scored with the standard rubric. The group rubric gives Top Lineup Attractiveness and Energy / Coordination 30 points each, uses Uneven at Energy / Coordination level 1, Good at level 2, and a +5 Attractive Bottom lineup bonus. The standalone `group_scene_rating_30_30.up.sql` script recalculates saved group criteria and scene ratings after this weight change. GOAT elements support +5/+10/+15/+20 contributions, and a progressive O-count bonus is applied without making the O control editable. Cast/marker/O-history changes recalculate affected advisor ratings; mode changes reset incompatible rows while preserving manual ratings.

Answers can be cleared, Reset Advisor removes advisor rows, and manual overall ratings relinquish advisor ownership. Legacy rows are normalized or removed by the provided repair scripts. Rating Criteria filters/sorts and Studio average criteria use the same rubric definitions.

### Metallic card styles and filtering

Scene, performer, image, gallery, group, and Studio cards support configurable Bronze, Silver, Gold, and Royal Sapphire thresholds with `premium` or `classic` visual themes. Override tags take precedence; scenes with persisted GOAT Advisor bonuses or configured GOAT marker descendants are Royal Sapphire even without a qualifying numeric rating. A shared `metallic_rating` filter matches the final card tier across catalogs. Premium animation respects reduced-motion and pauses off-screen.

### Key files and configuration

- `ui/v2.5/src/components/Shared/RatingAdvisor_custom.tsx`, `ratingAdvisorScales_custom.ts`, and `ratingCardStyles_custom.ts`
- `ui/v2.5/src/components/Shared/ratingCardStyles_custom.scss`, `ratingCardMotion_custom.ts`
- `internal/api/rating_*_custom.go`, `pkg/sqlite/rating_*_custom.go`, `pkg/sqlite/metallic_rating_filter_custom.go`
- `graphql/schema/types/{rating,filters,stats}_custom.graphql`
- `configuration.ui.ratingCardTheme`, `ratingCardThresholds`, `ratingCardOverrideTagIds`, and `roleTagIds.goatTagId`

### Tests

Tests cover rubric scales and mode boundaries, GOAT values, progressive O bonuses, reset/ownership behavior, legacy normalization, filter/sort predicates, metallic precedence, reduced-motion visibility, and unrated/None chart buckets.

---

## 14. Scene marker navigation and editing

### Chronological marker panel

Scene details provide a unified chronological Markers tab with Activity Type and Highlights lanes. Sections cover Oral, Sex, Solo, Orgasm, Facial, and Other Highlights; markers with the same activity and Top/Bottom configuration are grouped. Direct, secondary, overlap-inherited, and parent tags have distinct badge treatments, and a directed 50% overlap rule drives inherited tags. Scene-local tag/Top/Bottom searches, visible/full-scene selection, sticky toolbars, loop insertion, and marker-card hover context are built into the panel. The upstream grouped layout remains available through the Custom Settings `showOfficialSceneMarkerLayout` toggle.

At desktop widths (1200px and above), the Markers tab offers Sidebar / Below player placement. The optional full-width dock keeps the player size unchanged and places performer portraits beside the activity and highlight lanes. Switching placement preserves selections, filters, and edit drafts; narrower screens use the sidebar. Placement is saved locally in `stash.sceneMarkerPlacement` and defaults to Sidebar. This is a presentation-only change with no schema or backend configuration changes.

### Timing and editing actions

- Start and end timestamps in scene markers are clickable and seek the player. Marker duration is shown in view and edit modes; the Skip tab shows unique negative-marker time with overlapping ranges merged and bounded to video duration.
- Tag detail Scenes and the global Markers catalog show the summed duration of the active tag/marker result, honoring the Include Sub-Tag Content setting and ignoring open or backwards ranges.
- Scene marker and negative-marker forms warn about gaps/overlaps of three seconds or less in their relevant lanes. Coverage in an unrelated lane does not suppress a lane-local gap warning. One-millisecond gaps are treated as closed, and actions can adjust the current or adjacent marker (including a fix-both action).
- Marker forms support Duplicate, In-Between, and Save & Add Next Marker/Negative Marker actions. Adjacent drafts use a one-millisecond boundary, retain the appropriate marker setup, and validate finite non-negative ranges.
- Player scrubber/timeline markers can focus the corresponding marker pill or group once, with latest-click-wins scrolling and a transient fuchsia focus ring. Marker timeline tags and hover cards reuse role, overlap, and Royal Sapphire semantics.
- The scene marker scrubber hover card offers Send Marker to Loop beside its start/end seek controls. It inserts the same full marker range as the Markers panel's Add to Loop action, including the panel's fallback for markers without an end time.
- The marker edit form can split its marker around the exact full range of another bounded marker selected from the player scrubber, leaving that selected range as a gap. Marker mutations update the active scene cache immediately, deduplicate stale marker references, and defer grouped-list refreshes so multi-step splits do not race intermediate snapshots.
- The scene page can hide the overview/header block so the active tab uses the full vertical space. The circular scene-page O control shares the playlist player's exact timestamp recording and fullscreen-safe confirmation.

### Key files and tests

- `ui/v2.5/src/components/Scenes/SceneDetails/SceneMarkersChronologicalPanel.tsx`, `SceneMarkersPanel.tsx`, `SceneNegativeMarkersPanel.tsx`
- `ui/v2.5/src/components/Scenes/SceneDetails/sceneMarkerChronology*_custom.ts`, `sceneMarkerGapWarning_custom.ts`, `sceneMarkerSequentialActions_custom.ts`
- `ui/v2.5/src/components/Scenes/SceneDetails/SceneMarkerDock_custom.{tsx,scss}`, `sceneMarkerDockPlacement_custom.ts`; `ui/v2.5/tests/sceneMarkerDock_custom.test.ts` covers placement, persistence/storage failures, scroll-parent selection, and moving the panel without replacing its subtree.
- `ui/v2.5/src/components/ScenePlayer/sceneMarkerTimeline*_custom.ts`, `scenePlayerORecord_custom.ts`
- `pkg/scene/marker_query_custom.go`, `pkg/sqlite/scene_marker_tag_overlap_custom.go`

Focused tests cover grouping/search, overlap inheritance, parent/secondary tag rendering, selection state, gap fixes, duration totals, timestamp seeking, duplicate/in-between drafts, sequential actions, and O recording.

---

## 15. GEVI Latest

`/gevi-latest` is a custom page for the latest Gay Erotic Video Index scenes and vatos. A separate `/gevi-latest-data` endpoint fetches and caches the source lists and local card images, upgrades scene cards to the larger episode screenshot when available, quietly omits missing images, and prunes cached items older than two years. The page is linked from the navbar utility icons.

Implementation: `internal/gevi/latest_custom.go`, `internal/api/routes_gevi_latest_custom.go`, and `ui/v2.5/src/components/GEVILatest/GEVILatest_custom.{tsx,scss}`. Tests cover source parsing, detail-image selection, cache merging/pruning, local image cleanup, and 404 omission.

---

## 16. Themes, custom settings, and UI vocabulary

### Custom Settings

Settings > Custom consolidates fork-only controls: role tags, multi-segment loops, marker preview skip lists, rating-card theme/thresholds/override tags, O screenshot generation, OStats exclusions, and the application theme. Generic upstream settings remain in their normal tabs.

### Black Steel and loading overlay

The selectable `masculine-black` (Black Steel) theme applies a near-black canvas, graphite/gunmetal surfaces, copper accents, hard control radii, readable inputs/chips/portals, and scoped modal/popover/table/pagination styles. Semantic role, status, and rating colors are preserved. Ordinary full-size loading indicators become a fixed dimming/blur overlay with a status card; local/button/table loaders remain inline. Both theme and overlay honor reduced-motion preferences.

### UI vocabulary

English UI labels use Vato/Vatos in performer-facing copy while backend, GraphQL, routes, plugin APIs, and database identifiers remain `performer` for compatibility.

New vatos default to Male when their creation input omits gender. The shared SQLite performer creation path applies the default across UI, dropdown, import, and metadata creation while preserving any explicit gender. The behavior is implemented in `pkg/sqlite/performer_custom.go` and covered by `pkg/sqlite/performer_custom_test.go`; it adds no GraphQL schema or configuration dependencies.

Key files: `ui/v2.5/src/components/Settings/SettingsCustomPanel.tsx`, `ui/v2.5/src/components/ApplicationTheme_custom.tsx`, `ui/v2.5/src/styles/applicationTheme_custom.scss`, `ui/v2.5/src/components/Shared/LoadingIndicator.tsx`, `loadingIndicator_custom.ts`, `loadingIndicator_custom.scss`, and the English locale files. Tests cover theme fallback/class switching, overlay behavior, and vocabulary fallbacks.

---

## 17. Mobile production deploy workflow

`deploy_prod_custom.bat` provides a one-command Windows deployment flow for mobile/Codex sessions. It builds the release binary, stops the two local production instances, backs up each executable, copies the new `stash.exe`, restarts both instances hidden with redirected logs, and removes temporary deploy artifacts after success. `-SkipBuild` and `-SkipStart` are supported.

Implementation: `deploy_prod_custom.bat` and `scripts/deploy_prod_custom.ps1`.

---

## 18. Mobile Remote O Recording

The `/remote/o` page pairs a phone with the active browser player through a one-use, five-minute QR code and records an O against the player’s current scene and timestamp. The phone remembers the pairing locally; scene changes, reloads, and Stash restarts do not require rescanning.

When multi-segment looping is on, tap segment buttons to loop only those segments in their existing order. “Deselect all” restores normal looping without changing segments or saved presets. Selection is temporary and clears when the loop is disabled or replaced; stale scene/configuration commands are rejected. Successful remote O recording shows “O recorded” inside the main player for one second, including fullscreen.

Loop control adds `RemoteLoopControls.tsx`, `remoteLoopSelection_custom.ts`, `remote_loop_selection_custom.go`, and `remoteToast_custom.ts`, with changes to `RemoteO.tsx`, `useRemotePlayer_custom.ts`, `Scene.tsx`, and `multi-segment-loop.ts`. The custom GraphQL schema adds loop state and a selection mutation; no database or configuration changes are needed. Focused tests in `remote_loop_selection_custom_test.go` and `remoteLoopSelection_custom.test.ts` cover selection delivery, stale/invalid requests, subset order, reset behavior, and fullscreen toast lifetime.

The server freezes the latest player-reported timestamp when the first tap is accepted. New command IDs must arrive within 30 seconds, but an accepted tap remains available for same-ID/same-timestamp redelivery for 24 hours while the same player session and scene remain active. This includes transient delivery and player-side recording failures, while the receipt keeps database and rating updates exactly-once. Paused playback is valid; buffering, seeking, unloaded video, stale sessions, mismatched scenes, and competing browser owners are rejected. Pending taps survive a phone-page reload in session storage, while a definitive expired/invalid/stale-session rejection clears the dead saved tap so the phone can record again. Pairing respects normal authentication and reverse-proxy prefixes.

Implementation: `internal/api/remote_playback_custom.go`, `resolver_remote_playback_custom.go`, `ui/v2.5/src/components/RemoteO/*`, and player integrations in `ScenePlayer.tsx`/`MarkerPlaylistPlayer.tsx`. GraphQL state/command/receipt queries, mutations, and subscriptions are in `remote-playback_custom.graphql`; the phone polls `remotePlaybackState`, so the unused state subscription was removed. Tests cover pairing/session ownership, validation, same-ID/same-timestamp command redelivery, replay/restart safety, subscriptions, and exactly-once recording.

---

## 19. Scene Tagger save preview

Scene Tagger groups each local scene with its scraped matches in a bordered card. Selecting a match shows a live **Changes on Save** comparison with Local now/After Save columns, Added/Removed/Changed labels, changed-value emphasis, optional unchanged-field disclosure, cover previews, and unresolved-performer status.

Preview and Save share one update builder. Null remote fields keep local values unless the user checks Clear on Save; clear selections are scoped to the current result and excluded fields cannot be cleared. Performer/URL/tag merging, Studio replacement, organized state, source-specific Stash IDs, and cover replacement follow Tagger settings. Timestamp/order-only differences are ignored, and small screens can scroll the comparison.

Implementation: `ui/v2.5/src/components/Tagger/scenes/{SceneSavePreview.tsx,sceneSavePreview_custom.ts,sceneSavePreview_custom.scss}`, `StashSearchResult.tsx`, and `TaggerScene.tsx`. Tests cover update building, exclusions, merges, clears/undo, unresolved performers, cover states, and rendered comparison states. No new GraphQL schema or configuration is required.

---

## 20. Scene Rating Playground

The Stats navigation includes **Playground** at `/stats/playground`, with four tabs: **Scene Explorer**, **Scene Tiers**, **Vato Tiers**, and **Insight Stats**. Scene Explorer is a scene-discovery scatter graph with four quadrants. Select either axis from the scene Rating Advisor criteria or Scene Overall Rating, choose Standard, Solo, or Group, and adjust the dividing values. Scene types follow advisor mode rules (four-plus performers take group priority; single performers or solo-only activity use the solo rubric). Insight Stats retains its chip-threshold comparison and drilldowns here; it no longer hosts metallic-tier previews.

Combined filters cover Scene Type (Solo, Oral, Sex), Vato Ethnicity, Vato Country, Vato Count, Metallic Rating, facial status, and the presence or absence of Rating Advisor bonuses and penalties. Scene Type uses the same configured activity markers and priority as Scene Stats (Sex, then Oral, then Solo), including descendant tags; the Rating Mode filter chooses the advisor rubric. Ordinary values within one filter use OR; separate filters and selected adjustments use AND. Metallic tiers respect configured thresholds, tag overrides, and Royal Sapphire bonuses/GOAT markers. Facial and Really Hot tags must occur on the same marker for a really hot facial.

With **Spread points** enabled, up to three randomly selected scenes represent each shared coordinate, capped at 250 sampled scenes overall. **Shuffle scenes** draws fresh discoveries without reloading the library; the sample stays stable while hovering. Spread points defaults on and slightly offsets discrete advisor scores to soften the grid. Placement tries stable alternate offsets and omits dots that cannot maintain 14 pixels of separation, adapting to smaller screens. Shown and omitted counts describe the final layout; hovering or keyboard navigation reaches each displayed scene independently. Offsets stay inside the original quadrant and axis bounds and never change tooltip values, filtering, or overall-rating coordinates. Turn spreading off to restore exact positions and one scene per shared coordinate. Hover or pin a point for its thumbnail, title/link, studio, date, duration, cast, axis scores, and overall rating. Missing or invalid scores are excluded and counted separately; zero scores remain valid and ratings above 100 expand the axis. Library data loads in cancellable, bounded pages with progress and retryable errors.

Scene data reuses Insight Stats' existing IndexedDB snapshot, 12-hour expiry, URL key, and paginated query. The common scan adds ethnicity, scene-preview details, and weighted rating adjustments; opening either page populates the same cache for both. Insight Stats retains its configuration-keyed calculation in that snapshot, and an older calculation cannot overwrite a newer scan. **Reload scenes** bypasses and replaces the shared snapshot. Older snapshots without the expanded fields are refreshed once, and the obsolete separate Playground database is retired. Expired, failed, or cancelled scans are never treated as fresh data, and unavailable browser storage falls back to normal loading. Filter additions, removals, and clearing immediately recompute and redraw a fresh sample without a network request; Playground does not cache filters or plotted results.

**Scene Tiers** uses the shared scene scan to compare saved metallic tiers with a temporary Scene threshold draft. It starts with all rating modes and Scene Type grouping, with Standard/Solo/Group mode choices and the same combined scene filters as Scene Explorer. Studio grouping uses studio IDs to keep identically named studios separate. Filters select the saved/current cohort, so threshold edits only change its projected tier allocation. Five summary cards, row distributions, tier cells, and totals show saved current and recalculated projected counts/percentages; each value opens an exact current or projected Scene ID snapshot. Reloading scenes refreshes the shared scan, while changing filters, grouping, sorting, or draft thresholds recomputes locally.

**Vato Tiers** replaces the tier-by-ethnicity table in Vato Stats (including studio dashboards). Ethnicity and Country multi-select filters combine with AND across fields and OR within each field; rows can be grouped by either dimension. Age is intentionally deferred. Five summary cards appear in order: Royal Sapphire, Gold, Silver, Bronze, and No Tier; each shows saved current and temporary projected counts/percentages, while its track reflects the projected distribution. The table presents the same current/projected comparison for every row, tier cell, and total. Current values link directly to `/performers` with the matching visible Metallic Rating, Ethnicity, and Country filters; projected values open exact in-memory Vato ID snapshots. Active filters remain part of every destination. Unknown and comma-separated Country/Ethnicity values are handled by the performer filter so drilldowns match the displayed counts, and country codes display as country names. The tab loads on first use and retains its filters when switching tabs. Bounded performer queries use the existing server metallic-rating filter, preserving configured thresholds and override-tag precedence, including vatos without scenes. No Tier includes only rated vatos below Bronze, never unrated vatos; no scene scan is required for tier data. Reload vatos refreshes its in-memory data independently from the scene cache. Errors and cancelled/incomplete scans never display partial totals.

- Tier files: `ui/v2.5/src/components/Playground/{PlaygroundSceneTiers.tsx,sceneTiersData_custom.ts,PlaygroundVatoTiers.tsx,VatoTiers.scss,vatoTiersData_custom.ts,useVatoTiers_custom.ts,RatingTierThresholds.tsx}`; removed the old table and its auxiliary request from `ui/v2.5/src/components/VatoStats/VatoStats.tsx` and its styles from `VatoStats.scss`.
- Tier tests: `ui/v2.5/tests/vatoTiers_custom.test.ts` covers combined filters, missing values, normalized countries, group/tier totals including No Tier, card order, direct filtered-list URLs, schema validation, pagination, changed-library and incomplete-response failures, cancellation, and rendered populated/loading/error/empty states. `pkg/sqlite/performer_ethnicity_filter_custom_test.go` covers visible Country/Ethnicity drilldown selection semantics, including unknown values.

- Created: `ui/v2.5/src/components/Playground/{Playground.tsx,Playground.scss,PlaygroundChart.tsx,playgroundData_custom.ts,playgroundCatalog_custom.ts,playgroundChart_custom.ts,usePlaygroundScenes_custom.ts}` and `ui/v2.5/src/components/Shared/statsSceneData_custom.ts`.
- Modified: `ui/v2.5/src/App.tsx`, `ui/v2.5/src/components/StatsLinks_custom.tsx`, and `ui/v2.5/src/components/statsPage_custom.scss` for the route and navigation; `ui/v2.5/src/components/InsightStats/{insightStatsCache_custom.ts,insightStatsQuery_custom.ts,insightStatsWorker_custom.ts}` for the shared scan.
- Tests: `ui/v2.5/tests/playground_custom.test.ts` covers scene modes, combined filters and immediate filter updates, missing/zero scores, scales, metallic overrides, facial marker relationships, random coordinate sampling, and chart hit testing. `playgroundQuery_custom.test.ts` validates the shared request against the actual GraphQL schema and covers pagination, changing libraries, errors, and cancellation. `playgroundCache_custom.test.ts` covers shared-field compatibility, 12-hour expiry, old-snapshot replacement, manual refresh, installation isolation, storage failures, and cancellation. `insightStatsWorker_custom.test.ts` verifies reuse in both directions, shared refresh, legacy-cache cleanup, and protection against obsolete calculation writes.
- GraphQL schema changes: none; uses existing scene, performer, marker, and rating score fields.
- Configuration dependencies: existing `configuration.ui.roleTagIds`, `ratingCardThresholds`, and `ratingCardOverrideTagIds`. Facial filtering requires the Facial role tag; distinguishing really hot facials also requires the Really Hot role tag.

---

## 21. Merge and maintenance guidance

When merging a newer upstream Stash release:

1. Treat upstream as the base and layer these capabilities on top.
2. Preserve inline `// CUSTOM` blocks and all `_custom` files; adapt them to upstream APIs rather than replacing upstream behavior.
3. After schema changes or conflict resolution, run `make generate` (Windows: `mingw32-make generate`).
4. Run the narrowest relevant checks: `go build ./cmd/stash`, targeted UI lint/Prettier, `npm.cmd run check` for TypeScript changes, and `git diff --check`. Use `go build ./...` or a full UI build only when the changed surface requires it.

### Intentionally not standalone entries

The following are implementation refinements or parts of the features above, so they are not presented as new features:

- presentation-only chart/layout changes;
- Task Progress finish estimates and Overall Progress presentation;
- Studio/catalog active-sort badges and batched list queries;
- marker/scene mutation performance work and test-suite validation;
- one-off control, label, and copy adjustments.

### Shared configuration paths

- `configuration.ui.roleTagIds` (Sex, Oral, Solo, Facial, Orgasm, Feet, Really Hot, GOAT, 2nd Camera, and OStats exclusions)
- `configuration.ui.showMultiSegmentLoopControls`
- `configuration.ui.showOfficialSceneMarkerLayout`
- `configuration.ui.ratingCardTheme`, `ratingCardThresholds`, and `ratingCardOverrideTagIds`
- `configuration.ui.sceneCardInsightThresholds`
- `configuration.ui.applicationTheme`
- `configuration.ui.simpleMarkerPreviewExcludedTagIds`

---

_Last updated: 2026-09-30_
_Base version: Stash v0.31.0_
