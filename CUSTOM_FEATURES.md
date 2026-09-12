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
- Scene marker cards, the chronological marker panel, marker playback, and marker viewers show the assigned performers and role.
- Performer details include a Markers tab containing only markers linked directly to that performer.
- The Partners tab groups co-performers by Sex, Oral, and Facial role, with shared timed-marker duration for Sex/Oral pairs and deduplicated partner portraits.
- Performer cards expose role scene counts and unique-partner counts. Lazy card statistics are loaded in one page-level request so the initial list fragment stays small.
- Marker performer associations support full create/update/delete behavior and retain compatibility with the legacy `performer_ids` input.

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

- Scene marker include/exclude filters support groups of tags, primary/secondary tags, Top/Bottom/Both-role performer IDs, performer country, ethnicity, rating, and `INCLUDES`/`INCLUDES_ALL`/`EQUALS` semantics.
- Explicit overlap groups require marker ranges to overlap. Directed tag inheritance is separate: an equal-or-longer source marker contributes tags only when its intersection covers at least 50% of the receiving marker. A wider marker never inherits from a narrower marker inside it.
- The Markers page has a Marker Performers criterion, a Has Roles criterion (Top/Bottom checkboxes), a Studio criterion with hierarchical child-studio matching, and a unified include/exclude Performer Markers criterion.
- Unnamed performers (Performer A, Performer B, …) can be defined by ethnicity, country, rating, and Rating Advisor criteria. Reusing a letter requires the same actual performer across the referenced roles/configurations.

### Scene and performer criteria

- Scene Type classifies Sex, Oral, Solo, and Facial scenes using configured tag families. Sex/Oral/Solo are mutually exclusive on Scenes; Facial is independently combinable. Performer selections use marker-level participation.
- Performer Marker Tags and Performer Markers filters match marker participation, role, partner attributes, and tag ancestry. Custom radio filters include Versatile Scenes, Circular Oral, Strict/Lenient Tops, and Strict/Lenient Bottoms.
- Performer country, ethnicity, rating, and profile-image-count criteria use database-backed values. Inclusive numeric operators (`>=`, `<=`) are available across numeric/date/duration controls.
- Custom criteria are highlighted in the filter picker so fork-only filters are easy to identify.

### Key files

- `graphql/schema/types/filters_custom.graphql`, `pkg/models/filter.go`, and the `pkg/sqlite/*filter*_custom.go` handlers
- `ui/v2.5/src/models/list-filter/criteria/{scene-markers,marker-performers,performer-markers,unnamed-performer,scene-type,has-roles,custom-filters}_custom.ts`
- `ui/v2.5/src/components/List/Filters/{SceneMarkersFilter,SceneMarkersExcludeFilter,MarkerPerformersFilter,PerformerMarkersFilter,SceneTypeFilter,HasRolesFilter}.tsx`
- `ui/v2.5/src/models/list-filter/custom-filter-options_custom.ts` and `EditFilterDialog.tsx`

### Tests

SQLite and UI tests cover the 50% overlap boundary, exclusion behavior, role matching, unnamed-performer identity, tag ancestry, scene-type precedence, Has Roles combinations, profile-image counts, and custom-filter serialization.

---

## 4. Statistics dashboards

### Overview

The custom statistics experience is split into hidden, focused destinations instead of the retired `/customstats` page. Shared navigation links to `/scenestats`, `/vatostats`, `/ostats`, and the `/stats/playground` hub; Scene and Vato Stats can also be embedded in Studio detail tabs with a recursive child-studio scope.

### Scene Stats (`/scenestats`)

- Scene podiums cover O Count, Rating, Duration, File Size, Most Recent O, Vato Count, and Facial Count, including rolling-year variants.
- Charts cover vato ethnicity/country/count, release year/month/day, facial status/count, Really Hot Facial count, scene type, duration buckets, resolution, and metallic rating (including a set-but-unqualified `None` bucket).
- Activity Type and Quality donuts, orgasm/facial totals, total orgasm/facial/sex/oral time, Rating Advisor averages, and the Outstanding Activity Matrix are available globally and for Studio-scoped Scene Stats.
- Chart selections open scoped list drilldowns; URL-backed state restores Studio scope, filters, podium metric, list visibility, selected section, and child-studio mode on refresh/back navigation.

### Vato Stats (`/vatostats`)

- Vato summary cards, top-three podiums, Rating Advisor averages, and charts for ethnicity, scene age, rating, metallic rating, height, country, hair, eyes, circumcision, and penis size.
- Studio scope and Include child studios apply to every aggregate and drilldown. Rolling-year O Count and performer-creation Rating use their documented date windows.
- Solo-only and one-scene vatos are retained; unknown values appear as counters rather than zero-value bars.

### O Stats (`/ostats`)

- Hidden O-date timelines and drilldowns by year/month/day, activity type, marker tag, vato ethnicity/country/age, Studio, and scene effective release year.
- Newest-first event timelines show associated marker tags, per-scene ordinal chips, scene/vato links, and optional exact O screenshots generated from video timestamps. Reliable-date filtering starts at 2024-03-08 for date charts only.

### Insight Stats (Playground tab)

- Scans the library in bounded pages and compares saved Scene Insight chips with temporary in-memory thresholds. Current/preview chip counts link to exact Scene ID snapshots, and chip-family drilldowns retain their evidence and combinations.
- Insight Stats is the fourth `/stats/playground` tab rather than a standalone destination. Its threshold changes never persist; the scan is cached in IndexedDB for 12 hours and obsolete worker calculations are cancelled. The scene scan and cache are shared with the other Playground tabs, including the extra fields needed by their filters and tooltips.

### Implementation and schema

- Compact set-based resolvers live in `internal/api/scene_stats_*_custom.go`, `vato_stats_*_custom.go`, `activity_stats_custom.go`, and `stats_marker_counts_custom.go`.
- UI pages and shared panels are under `ui/v2.5/src/components/{SceneStats,VatoStats,OStats,InsightStats}`; shared scope, charts, and drilldown helpers live beside them.
- Custom GraphQL types and queries are in `graphql/schema/types/stats_custom.graphql`, `scene_custom.graphql`, and `ui/v2.5/graphql/queries/stats_custom.graphql`.

### Tests

Go and UI tests cover scope construction, interval merging, marker weighting, rolling-year eligibility, chart buckets/Unknown handling, Activity Matrix aggregation, O event ordering/navigation, chip-preview worker cancellation/cache reuse, Playground tab routing, and exact Scene/Vato snapshot filters.

---

## 5. Task Progress Tracker

### Overview

Tag-based task tracking records daily completions and incoming work for scenes, markers, images, galleries, performers, studios, and groups. Trackers support selectable scopes, active/paused/completed/archived lifecycle states, fixed batches, ordering, details/edit dialogs, and persisted history.

### Behavior

- Removing a direct tag or deleting a tagged item records completion; adding the tag records incoming work. Marker primary/secondary tag updates are atomic and deduplicated.
- Overall Progress tracks organized scenes. New scenes and organized-to-unorganized reversals are incoming work; unorganized-to-organized changes are completions. Deleting a scene recalculates snapshots without inventing completion events.
- History uses America/Mexico_City dates. The chart preserves zero-activity calendar days, shows completed/incoming bars and a seven-day average, and provides paginated daily activity and fixed-batch remaining-item links.
- Paused trackers continue recording; archived trackers freeze activity and resume with a fresh baseline. Version checks reject stale edits, and restoring a deletion preserves baseline membership.
- Each card has a browser-local Items-per-day planner with immediate finish-date calculation. Observed estimates require three complete days, use net progress, and exclude today's partial activity. The Overall Progress card has its own scenes-per-day plan.
- Trackers can also persist an optional Goal per day. Active tracker cards show red/yellow/green/gold daily status icons for zero/below/met/exceeded progress, including the completed/goal count; completed history bars use the same colors. Paused, completed, archived, and goal-less trackers retain the original presentation.
- Details shows completed, remaining, and percentage summary cards above the shared history chart. Fixed-batch completed counts use the current baseline.

### Key files and schema

- `graphql/schema/types/task_progress_tracker_custom.graphql` and `schema_custom.graphql`
- `internal/api/resolver_task_progress_tracker_custom.go`, `resolver_task_progress_history_custom.go`
- `pkg/models/task_progress_tracker_custom.go`, `pkg/sqlite/task_progress_*_custom.go`, and entity-store hooks
- `task_progress_tracker_history.up.sql`, `task_progress_overall_history.up.sql`, `task_progress_tracker_goal_per_day.up.sql`
- `ui/v2.5/src/components/TaskProgress*` and `ui/v2.5/graphql/{data,queries,mutations}/task_progress_tracker_custom.graphql`

### Tests

Coverage includes bootstrap/retrofit, CRUD/order/versioning, fixed membership, lifecycle recording, tag and deletion events, Overall Progress transitions, history aggregation, date boundaries, forecasts, daily-goal states, card/modal rendering, and visible-data rules.

---

## 6. Studio metrics and performer Studios

### Studio category metrics

Studio cards and detail pages expose Sex, Oral, Solo, Facial, and Unique Performer counts. Studio lists can sort by those categories, Standard/Really Hot facial markers, metallic scene tiers, O Count, and other custom aggregates. Active non-default sorts show an emerald value in the existing card control or a compact metric strip; default and Random sorts remain quiet. Counts honor configured role tags, child-studio depth, and performer scope.

The studio list uses a page-level `studio_list_stats` query for batched counts, recursive O totals, role counts, and activity/quality percentages. This avoids one aggregate query per card while preserving the existing detail-page fields.

### Performer Studios tab

Performer details have a Studios tab showing only Studios represented in that performer's scenes. The list keeps the basic scene count but hides studio-wide category totals when performer-filtered, preventing misleading unscoped numbers. Studio detail pages also expose Scene Stats and Vato Stats tabs described in section 4.

### Key files

- `ui/v2.5/src/components/Studios/{StudioCard,StudioList,StudioCardGrid,StudioSortMetricStrip_custom}.tsx`
- `ui/v2.5/src/components/Performers/PerformerDetails/PerformerStudiosPanel.tsx`
- `internal/api/studio_list_stats_custom.go`, `pkg/sqlite/studio_sort_metric_custom.go`, `studio_facial_marker_sort_custom.go`
- `graphql/schema/types/studio_custom.graphql` and `ui/v2.5/graphql/queries/studio.graphql`

---

## 7. Performer cards, partners, and images

### Cards, partners, and scene context

- Performer cards show role-aware scene counts, partner counts, activity-time metrics, and lazy-loaded role statistics. Partner badges use a person icon plus Top/Bottom direction so they are distinct from scene counts.
- The scene performer overview drawer opens from scene-detail cards and marker portraits, loads the full performer record on demand, shows role/activity metrics and scene-local partners, and supports new-tab links, backdrop, X, and Escape dismissal. Scene cards use the same configured performer card skin and show a small rating pill below the portrait.
- The Partners tab uses role-colored headings, deduplicated partner portraits, and merged shared Sex/Oral marker duration. Partners-tab cards intentionally omit the favorite control; normal performer cards retain it.

### Multiple performer images

Performers can have additional profile images. On the performer detail page users can upload, delete, browse, and set any additional image as the default; duplicate uploads for one performer are rejected. The default `performers.image_blob` remains compatible with upstream consumers. A Profile Image Count criterion counts the default image plus additional images and supports inclusive comparisons.

### Player image overlays

The scene player can display up to two performer-library images over the video. Images are selected from scene performers, then dragged, resized, hidden, and restored in normal or fullscreen playback. Overlay state is intentionally session-local.

### Key files

- `ui/v2.5/src/components/Performers/PerformerDetails/{PerformerImageManager,PerformerActivityTime}.tsx`
- `ui/v2.5/src/components/Scenes/SceneDetails/ScenePerformerOverviewPanel_custom.tsx`
- `ui/v2.5/src/components/ScenePlayer/{PerformerImageSelectModal,PerformerImageOverlay}.tsx`
- `pkg/models/model_performer_image_custom.go`, `pkg/sqlite/performer_image_custom.go`, `internal/api/resolver_model_performer_image_custom.go`
- `ui/v2.5/src/models/list-filter/criteria/profile-image-count.ts`

### Tests

Tests cover image CRUD/default behavior and duplicate handling, profile-image counting, role/activity cards, scene drawer fields and links, partner duration merging, and overlay selection/interaction behavior.

---

## 8. Scene cards and Scene Insights

### Scene card metrics

Scene cards and scene details show configurable Sex/Oral/Solo/Facial icons, Really Hot facial precedence, role-aware performer strips, and partitioned Activity Type/Quality percentages. Same-category intervals are merged; cross-category activity is retained in each category; Quality partitions runtime into Outstanding, Standard, and Unusable. GOAT marker descendants count as Outstanding and use the same Royal Sapphire styling as rating cards.

### Scene Insights

Scene cards and scene details expose a typed, evidence-backed insight strip with a complete hover popup. It can report GOAT and common Outstanding Activity tags, event reports for Orgasm/Facial, repeated or simultaneous orgasms, activity quality, filler/highlights, Mexican or Royal-Sapphire lineup context, role rarity, interactions, and stored Rating Advisor warnings. A configurable visible-chip limit keeps the card compact; the popup retains every candidate and its evidence.

The Outstanding Activity Matrix is available from a scene, vato, global Scene Stats, or Studio Scene Stats. It merges intervals, shows duration and marker counts by tag and performer, supports direct/sub-tag roll-up, and links to the matching tag-marker view. GOAT evidence remains separate and higher priority. Scene cards use batched performer history and marker context so insights do not issue one query per card.

### Key files

- `ui/v2.5/src/components/Scenes/SceneCard.tsx`, `sceneActivityMetricsData_custom.ts`, and `SceneCardInsights_custom.tsx`
- `ui/v2.5/src/components/Scenes/OutstandingActivityMatrix_custom.tsx` and `sceneCardInsightsData_custom.ts`
- `ui/v2.5/src/components/SceneStats/SceneStatsActivityMatrix_custom.tsx`
- `internal/api/scene_stats_activity_matrix_custom.go`, `pkg/sqlite/scene_marker_tag_ancestors_custom.go`

### Tests

Coverage includes candidate selection/priority, GOAT and event precedence, tag ancestry, interval merging, Activity Matrix totals, vato attribution, quality/filler boundaries, and seven-chip rendering.

---

## 9. Multi-segment loops and marker playlists

### Multi-segment loops

The scene player supports unlimited A-B segments that play in order and repeat. Segments can be added from the player or selected markers, reordered, individually/bulk deleted, retained as a subset, and cleared. Playback-rate-aware boundary timers and merged negative-marker ranges prevent early transitions and skip an entire overlapping undesirable range. The feature is enabled by `configuration.ui.showMultiSegmentLoopControls`.

### Marker playlist player

The Markers page can queue markers from multiple searches and open a sequential cross-scene player. The player double-buffers the next source, reuses the current source for same-scene markers, shows generated marker screenshots, advances/replays/loops, exposes normal/fullscreen O recording, and keeps the active item visible. Saved playlists persist marker IDs and order with a custom name and can be loaded or deleted later.

### Key files

- `ui/v2.5/src/components/ScenePlayer/multi-segment-loop.ts`, `MultiSegmentLoopControls.tsx`, and `playbackBoundary_custom.ts`
- `ui/v2.5/src/components/Scenes/MarkerPlaylistPlayer.tsx`, `MarkerQueueIndicator.tsx`, `markerPlaylistPreload_custom.ts`, and `markerPlaylistORecord_custom.ts`
- `ui/v2.5/src/hooks/MarkerQueue.tsx`
- `graphql/schema/types/marker-playlist_custom.graphql`, `marker_playlists.up.sql`, and `internal/api/resolver_{query,mutation}_marker_playlist_custom.go`

### Tests

Tests cover segment selection/bulk actions, exact boundary timing, negative-range merging, cross-scene preload selection, queue lifecycle, saved-playlist CRUD, fullscreen O confirmation, and active-marker timestamp validation.

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

### Scene Releases

A scene can contain alternate releases with independent metadata, Studio, cover, files, galleries, streams, and playback order. Users can create/edit/delete releases, convert a scene to a release or a release back to a scene, add files by path or existing file ID, remove files with an optional filesystem deletion confirmation, choose the playback release, and compare release media metadata with the main scene. Scenes can be filtered by release count.

Storage uses `scene_releases`, `scene_release_files`, and `scene_release_galleries`; the API is defined in `scene-release_custom.graphql` and implemented by `pkg/sqlite/scene_release_custom.go` and `internal/api/resolver_*scene_release*_custom.go`. The UI lives in `SceneReleasesPanel.tsx` and `SceneSelectorDialog.tsx`.

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

Scene and performer detail pages provide weighted Rating Advisor questionnaires whose raw answers are validated and persisted server-side. Recalculation derives canonical weighted values and updates `rating100`. Scene mode has standard, solo, and 4+-performer group rubrics; performers have their own rubric. The group rubric uses Uneven at Energy / Coordination level 1, Good at level 2, and a +5 Attractive Bottom lineup bonus. GOAT elements support +5/+10/+15/+20 contributions, and a progressive O-count bonus is applied without making the O control editable. Cast/marker/O-history changes recalculate affected advisor ratings; mode changes reset incompatible rows while preserving manual ratings.

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

Settings > Custom consolidates fork-only controls: role tags, multi-segment loops, marker preview quality/skip lists, rating-card theme/thresholds/override tags, O screenshot generation, OStats exclusions, and the application theme. Generic upstream settings remain in their normal tabs.

### Black Steel and loading overlay

The selectable `masculine-black` (Black Steel) theme applies a near-black canvas, graphite/gunmetal surfaces, copper accents, hard control radii, readable inputs/chips/portals, and scoped modal/popover/table/pagination styles. Semantic role, status, and rating colors are preserved. Ordinary full-size loading indicators become a fixed dimming/blur overlay with a status card; local/button/table loaders remain inline. Both theme and overlay honor reduced-motion preferences.

### UI vocabulary

English UI labels use Vato/Vatos in performer-facing copy while backend, GraphQL, routes, plugin APIs, and database identifiers remain `performer` for compatibility.

Key files: `ui/v2.5/src/components/Settings/SettingsCustomPanel.tsx`, `ui/v2.5/src/components/ApplicationTheme_custom.tsx`, `ui/v2.5/src/styles/applicationTheme_custom.scss`, `ui/v2.5/src/components/Shared/LoadingIndicator.tsx`, `loadingIndicator_custom.ts`, `loadingIndicator_custom.scss`, and the English locale files. Tests cover theme fallback/class switching, overlay behavior, and vocabulary fallbacks.

---

## 17. Mobile production deploy workflow

`deploy_prod_custom.bat` provides a one-command Windows deployment flow for mobile/Codex sessions. It builds the release binary, stops the two local production instances, backs up each executable, copies the new `stash.exe`, restarts both instances hidden with redirected logs, and removes temporary deploy artifacts after success. `-SkipBuild` and `-SkipStart` are supported.

Implementation: `deploy_prod_custom.bat` and `scripts/deploy_prod_custom.ps1`.

---

## 18. Mobile Remote O Recording

The `/remote/o` page pairs a phone with the active browser player through a one-use, five-minute QR code and records an O against the player’s current scene and timestamp. The phone remembers the pairing locally; scene changes, reloads, and Stash restarts do not require rescanning.

The player samples its own time when a command arrives. Paused playback is valid; buffering, seeking, unloaded video, stale sessions, mismatched scenes, and competing browser owners are rejected. Each tap has a command ID and receipt so retries are idempotent and write at most one O/rating adjustment. Commands expire after 30 seconds; pending taps survive a phone-page reload in session storage. Pairing respects normal authentication and reverse-proxy prefixes.

Implementation: `internal/api/remote_playback_custom.go`, `resolver_remote_playback_custom.go`, `ui/v2.5/src/components/RemoteO/*`, and player integrations in `ScenePlayer.tsx`/`MarkerPlaylistPlayer.tsx`. GraphQL state/command/receipt queries, mutations, and subscriptions are in `remote-playback_custom.graphql`. Tests cover pairing/session ownership, validation, replay/restart safety, subscriptions, and exactly-once recording.

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
- `configuration.ui.markerPreviewSourceQuality`, `markerPreviewSkipQualityCheck`, and `simpleMarkerPreviewExcludedTagIds`

---

_Last updated: 2026-09-09_
_Base version: Stash v0.31.0_
