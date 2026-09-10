# Custom Features Documentation

This document describes all custom features and modifications added on top of the official Stash v0.31.0 release. Future AI agents handling merge conflicts should use this as a reference to understand what needs to be preserved.

> **Code conventions:** All custom code follows the `_custom` naming and inline marker conventions described in [`CUSTOM_CODE_CONVENTIONS.md`](CUSTOM_CODE_CONVENTIONS.md).

---

## Table of Contents

1. [Scene Marker Performers (Top/Bottom Roles)](#1-scene-marker-performers-topbottom-roles)
2. [Role Tag IDs Configuration](#2-role-tag-ids-configuration)
3. [Scene Role Indicators (Top/Bottom/Oral/Solo/Facial)](#3-scene-role-indicators)
4. [Stats Pages](#4-stats-pages)
5. [Task Progress Tracker](#5-task-progress-tracker)
6. [Advanced Scene Filtering](#6-advanced-scene-filtering)
7. [Studio Category Buttons](#7-studio-category-buttons)
8. [Performer Card Enhancements](#8-performer-card-enhancements)
9. [Scene Card Enhancements](#9-scene-card-enhancements)
10. [Tag List Enhancements](#10-tag-list-enhancements)
11. [New GraphQL Queries and Types](#11-new-graphql-queries-and-types)
12. [File Inventory](#12-file-inventory)
13. [Multi-Segment Loop Controls](#13-multi-segment-loop-controls)
14. [Marker Playlist Player](#14-marker-playlist-player)
15. [Studio Filter for Markers](#15-studio-filter-for-markers)
16. [Extended Custom Statistics](#16-extended-custom-statistics)
17. [Performer Studios Tab](#17-performer-studios-tab)
18. [Marker Tags Filter for Performers](#18-marker-tags-filter-for-performers)
19. [Performer-Filtered Studio Cards](#19-performer-filtered-studio-cards)
20. [Performer Marker Filters](#20-performer-marker-filters)
21. [Multiple Performer Images](#21-multiple-performer-images)
22. [Performer Filter: Profile Image Count](#22-performer-filter-profile-image-count)
23. [Performer Partner Count Badges](#23-performer-partner-count-badges)
24. [Scene Releases](#24-scene-releases)
25. [Effective Date](#25-effective-date)
26. [Clickable Marker End Timestamps](#26-clickable-marker-end-timestamps)
27. [Performer Image Overlay on Video Player](#27-performer-image-overlay-on-video-player)
28. [Image Viewer](#28-image-viewer)
29. [Unnamed Performers in Marker Filters](#29-unnamed-performers-in-marker-filters)
30. [Has Roles Filter for Markers](#30-has-roles-filter-for-markers)
31. [Scene Type Filter](#31-scene-type-filter)
32. [2nd Camera Tag Exclusion](#32-2nd-camera-tag-exclusion)
33. [Marker Duration Display](#33-marker-duration-display)
34. [Task Progress Completion Estimate](#34-task-progress-completion-estimate)
35. [Marker Source-Quality Generation](#35-marker-source-quality-generation)
36. [Premium Rating Card Styles](#36-premium-rating-card-styles)
37. [Persisted Rating System](#37-persisted-rating-system)
38. [Mobile Production Deploy Workflow](#38-mobile-production-deploy-workflow)
39. [Activity Duration Stats](#39-activity-duration-stats)
40. [Custom Settings Tab](#40-custom-settings-tab)
41. [Custom Filter Name Highlighting](#41-custom-filter-name-highlighting)
42. [Hidden O Stats Timeline](#42-hidden-o-stats-timeline)
43. [Vato UI Vocabulary](#43-vato-ui-vocabulary)
44. [Vato Stats Page](#44-vato-stats-page)
45. [Scene Stats Page](#45-scene-stats-page)
46. [Scene Marker Gap Warning](#46-scene-marker-gap-warning)
47. [Scene Marker Chronological Tab Layout](#47-scene-marker-chronological-tab-layout)
48. [GEVI Latest Page](#48-gevi-latest-page)
49. [Black Steel Application Theme](#49-black-steel-application-theme)
50. [Cinematic Loading Overlay](#50-cinematic-loading-overlay)
51. [Negative Marker Create Parity](#51-negative-marker-create-parity)
52. [Scene Marker Duplicate and In-Between Actions](#52-scene-marker-duplicate-and-in-between-actions)
53. [Copy Scene Marker Timestamps From the Player Timeline](#53-copy-scene-marker-timestamps-from-the-player-timeline)
54. [Scene Card Marker Insights](#54-scene-card-marker-insights)
55. [Groups UI Labelled as Movies](#55-groups-ui-labelled-as-movies)
56. [Partners Tab Performer Cards Without Favorite Action](#56-partners-tab-performer-cards-without-favorite-action)
57. [Sequential Marker Actions](#sequential-marker-actions)

---

## 1. Scene Marker Performers (Top/Bottom Roles)

### Overview

An extension to scene markers that allows assigning performers as "top" or "bottom" for each marker. This replaces the old performer_scene_tags system with a more flexible marker-based approach.

### Database Schema

**File:** `scene_marker_performers_top_bottom.sql`

```sql
CREATE TABLE IF NOT EXISTS `scene_marker_performers` (
  `scene_marker_id` integer NOT NULL,
  `performer_id` integer NOT NULL,
  `role` TEXT NOT NULL DEFAULT 'top',  -- 'top' or 'bottom'
  PRIMARY KEY(`scene_marker_id`, `performer_id`, `role`),
  FOREIGN KEY(`scene_marker_id`) REFERENCES `scene_markers`(`id`) ON DELETE CASCADE,
  FOREIGN KEY(`performer_id`) REFERENCES `performers`(`id`) ON DELETE CASCADE
);
```

### GraphQL Schema Extensions

**File:** `graphql/schema/types/scene-marker.graphql`

- `MarkerPerformer` type with `performer` and `role` fields
- `GetPerformers` resolver on `SceneMarker` type

**File:** `graphql/schema/types/performer.graphql`

- Added top/bottom count fields: `sex_top_count`, `sex_bottom_count`, `oral_top_count`, `oral_bottom_count`, `facial_top_count`, `facial_bottom_count`
- `PerformerCoPerformersByRole` type for co-performer grouping by role
- `performerCoPerformersByRole(performer_id: ID!)` query

**File:** `graphql/schema/types/filters.graphql`

- `MarkerPerformersFilterInput` with `top_performer_ids`, `bottom_performer_ids`, `mode`, `modifier`
- `marker_performers` field in `SceneMarkerFilterType`

### Backend Files

- `internal/api/resolver_model_scene_marker.go` - GetPerformers resolver
- `internal/api/resolver_query_performer_coperfomers.go` - Co-performers by role query
- `pkg/sqlite/scene_marker.go` - Database operations for marker performers
- `pkg/sqlite/scene_marker_filter.go` - Filter by marker performers
- `pkg/models/scene_marker.go` - MarkerPerformer model

### Frontend Files

- `ui/v2.5/src/components/SceneMarkerPerformerEdit/SceneMarkerPerformerEdit.tsx` - Edit top/bottom assignments
- `ui/v2.5/graphql/queries/performer.graphql` - `PerformerCoPerformersByRole` query
- `ui/v2.5/src/components/Performers/PerformerDetails/PerformerAppearsWithByRolePanel.tsx` - "Partners" tab showing co-performers grouped by role category (sex/oral/facial) and position (topped/bottomed for). Performers are sorted alphabetically within each role section.

---

## 2. Role Tag IDs Configuration

### Overview

Configurable tag IDs for role categories (sex, oral, solo, facial). These are used for marker-based role detection and scene categorization. This replaces the old sceneTagAliases system.

### Configuration Storage

Stored in UI config under `configuration.ui.roleTagIds`:

```typescript
{
  sexTagId: "30",     // Tag ID for sex markers
  oralTagId: "31",    // Tag ID for oral markers
  soloTagId: "32",    // Tag ID for solo markers
  facialTagId: "33"   // Tag ID for facial markers
}
```

### Files Modified

- `ui/v2.5/src/components/Settings/SettingsInterfacePanel/SettingsInterfacePanel.tsx` - Configuration UI with TagIDSelect components
- `ui/v2.5/src/core/config.ts` - IUIConfig interface with roleTagIds type
- Multiple components read from `configuration.ui.roleTagIds` to get configured tag IDs

---

## 3. Scene Role Indicators

### Overview

Visual indicators on performer cards and scene cards showing role information based on marker assignments.

### Features

- **Role color convention**: Top is blue and Bottom is green across badges, filters, player/viewer overlays, hover tags, and stats charts.
- **Top/Bottom counts**: Displayed on performer cards showing breakdown by role
- **Scene-context role chips**: Performer cards inside a scene show sex/oral/facial role arrows and counts without duration percentages, keeping the chips compact and consistent with other performer cards.
- **Category icons**: Gay icon (sex), Mouth icon (oral), Hand icon (solo), Facial icon (facial)
- **Scene card overlays**: Icons indicating what types of markers a scene has

### Files Modified

- `ui/v2.5/src/components/Performers/PerformerCard.tsx`:

  - Role-based scene count popovers
  - Category strip with top/bottom breakdown
  - Passes scene marker intervals to the category strip only when rendered from a scene

- `ui/v2.5/src/components/Performers/PerformerDetails/PerformerCategoryStrip.tsx`:

  - Marker-based category buttons with counts
  - Scene-only sex/oral/facial role chips without duration percentages

- `ui/v2.5/src/utils/roleColors_custom.ts` - Central Top/Bottom color and Bootstrap variant mapping
- `ui/v2.5/tests/roleColors_custom.test.ts` - Verifies Top stays blue and Bottom stays green

- `ui/v2.5/src/components/Scenes/SceneCard.tsx`:

  - Scene card overlays showing marker categories
  - Added `top_performers` and `bottom_performers` to slim scene marker data for oral marker filtering

- `ui/v2.5/src/components/Scenes/SceneDetails/SceneDetailPanel.tsx`:

  - Supplies scene context and partner performer data to scene-context performer cards

- `ui/v2.5/src/components/Scenes/SceneDetails/Scene.tsx`:

  - Scene title icon based on marker categories with oral marker filtering

- `ui/v2.5/graphql/data/scene-slim.graphql`:
  - Added `top_performers { id }` and `bottom_performers { id }` to scene_markers fragment

---

## 4. Stats Pages

### Overview

Custom analytics are split into focused hidden pages instead of the retired `/customstats` page:

- `/scenestats` for scene podiums, scene-category metric buttons, orgasm/facial totals, release-date drilldowns, and scene distribution charts.
- `/vatostats` for vato podiums, vato summary cards, vato distribution charts, and the performer rating-tier ethnicity table.
- `/ostats` for tracked O timelines and O-specific drilldowns.

### Files

- `ui/v2.5/src/components/SceneStats/SceneStats.tsx`
- `ui/v2.5/src/components/SceneStats/SceneStats.scss`
- `ui/v2.5/src/components/SceneStats/sceneStatsSummary_custom.ts`
- `ui/v2.5/src/components/VatoStats/VatoStats.tsx`
- `ui/v2.5/src/components/VatoStats/VatoStats.scss`
- `ui/v2.5/src/components/Stats.tsx`
- `ui/v2.5/src/components/StatsPage_custom.tsx`
- `ui/v2.5/src/components/statsPage_custom.scss`
- `ui/v2.5/src/components/OStats/OStats.tsx`
- `ui/v2.5/src/components/OStats/OStats.scss`
- `ui/v2.5/src/components/StatsFilterBar_custom.tsx`
- `ui/v2.5/src/components/SceneStats/sceneStatsUnknownFilters_custom.ts`
- `ui/v2.5/src/hooks/useStatsViewState_custom.ts`
- `ui/v2.5/src/utils/statsViewState_custom.ts`
- `ui/v2.5/src/utils/statsDrilldown_custom.ts`
- `ui/v2.5/tests/sceneStatsSummary_custom.test.ts`
- `ui/v2.5/tests/statsDrilldown_custom.test.ts`
- `ui/v2.5/tests/statsViewState_custom.test.ts`
- `ui/v2.5/tests/sceneStatsUnknownFilters_custom.test.ts`
- `ui/v2.5/tests/oStatsInteraction_custom.test.ts`
- `internal/api/stats_marker_counts_custom.go`
- `internal/api/stats_marker_counts_custom_test.go`

### Features

- Scene counts by category (sex, oral, solo, facial) on `/scenestats`, with compact category tooltips
- Clickable icon counts split scenes into 1-vato, standard 2/3-vato, and 4+-vato group buckets using Performer Count filters
- Scene podium metrics by O Count, Rating, Duration, File Size, Most Recent O, Vato Count, and Facial Count
- Scene charts by vato ethnicity, vato country, vato count, release date, facial status/count, really-hot facial count, scene type, duration buckets, and resolution
- Performer ethnicity Bronze/Silver/Gold/Sapphire metallic rating-tier breakdown on `/vatostats`
- Orgasm/facial tracking totals on `/scenestats`
- Stats, OStats, SceneStats, and VatoStats share the main Stats page's full-width, borderless outer layout and consistently sized navigation cards.
- The shared navigation remains visible while Stats, SceneStats, or VatoStats loads, with a page-specific labeled spinner below it.
- SceneStats and VatoStats show explicit drilldown and overall totals after chart selections; OStats shows the selected O-event total for date and category drilldowns.
- OStats tag drilldowns fetch the selected tag directly so their titles display the tag name instead of its numeric ID.
- SceneStats and VatoStats filters are individually removable, with matching totals and clear/undo actions in a shared accessible filter bar.
- SceneStats and VatoStats persist studio scope, child-studio mode, filters, podium metric, and list visibility in the URL so refresh and browser history restore the view.
- Chart actions use native links for navigation and native buttons for filtering, with descriptive labels that distinguish filtering from opening matching records.

### Orgasm & Facial Counting Logic

The `sceneOrgasmCount` and `sceneFacialCount` resolvers use the following logic:

- **Subtag Support**: Markers are counted if their primary tag OR any secondary tag is the target tag (e.g., "orgasm") or any of its descendants/subtags
- **Top-based Counting**: Each matching marker counts once per assigned top performer, with a minimum count of 1 when no top is assigned
- **Search Difference Tooltip**: Total cards explain that their linked marker search counts marker rows rather than tops and includes 2nd-camera markers excluded from statistics, so the totals can differ
- **Vato Summary Consistency**: Sex/oral top and bottom cards count primary tags, secondary tags, and all descendants just like their performer-search drilldowns; Solo Only counts any assigned role

### GraphQL Queries (Custom)

**File:** `graphql/schema/types/stats_custom.graphql`

```graphql
extend type Query {
  performerEthnicityCounts: [PerformerEthnicityCount!]!
  performerEthnicityTierCounts: [PerformerEthnicityTierCount!]!
  sceneOYearCounts: [SceneOYearCount!]!
  sceneOrgasmCount: Int!
  sceneFacialCount: Int!
  performersFacialGivenCount: Int!
  performersFacialReceivedCount: Int!
  performersStrictTopCount: Int!
  performersStrictBottomCount: Int!
  performersLenientTopCount: Int!
  performersLenientBottomCount: Int!
  performersSoloOnlyCount: Int!
  performersOneSceneCount: Int!
}
```

---

## 5. Task Progress Tracker

### Overview

Tag-based task tracking with recorded daily completions and incoming work. Compact cards show counts, progress, an Items per day finish planner, and separate Details/Edit actions; the Details modal begins with number-only completed, remaining, and percentage summary cards, then contains the graph, links, and forecasts. Overall Progress measures organized scenes only and includes its own persisted history; its compact card also keeps the history graph behind a Details button.

### Behavior

- Removing a direct tag or deleting its tagged item records a completion; adding the tag records incoming work. Marker primary and secondary tags are deduplicated and updated atomically.
- Overall Progress records newly created scenes and organized-to-unorganized reversals as incoming work, and unorganized-to-organized changes as completions. Scene deletion only recalculates its total, organized, and remaining snapshots; it never records false completed work.
- Track scenes, markers, images, galleries, performers, studios, and groups, with a selectable scope. Child tags are excluded.
- Backlog mode includes incoming work. Fixed batches retain baseline membership and only reopen items belonging to that batch.
- Daily history uses America/Mexico_City dates. The chart shows completed/incoming bars, remaining or cumulative completions, a visually distinct seven-day average, baseline changes, and accessible daily data. View Daily Data lists only days with completed or incoming activity, while the chart retains zero-activity calendar days for an honest timeline. Clicking a day opens paginated activity; fixed batches have paginated remaining-item links. Item-type links only appear when their current count is non-zero.
- Active, paused, completed, and archived states are changed through the Status dropdown in Edit. Compact cards expose Details and Edit directly, plus arrow controls for reordering. Paused trackers keep recording. Archived trackers freeze activity and start a fresh baseline on resume. Restoring a deletion preserves its baseline and membership.
- Tracker edits use a version check to reject stale writes. Refreshes preserve visible data on errors and are manual after the initial page load (mutations also refetch their results).
- Existing trackers are activated and receive Started On **2026-09-07**, with an initial baseline and no invented historical completions. The retrofit runs once. New trackers record from creation; resetting scope/baseline preserves prior history.
- Each tracker card has a compact browser-local Items per day planner that recalculates the finish date immediately. Observed finish estimates use net progress over up to seven complete days, require three days, and exclude today's partial activity.
- Tracker Details shows completed, remaining, percentage complete, and percentage remaining as responsive top cards. Fixed-batch completed counts use the current baseline rather than historical activity events.

### Files

- `ui/v2.5/src/components/TaskProgress.tsx`, `TaskProgress/*`, `TaskProgressHistoryChart.tsx`, `TaskProgressHistoryChart.scss`, `taskProgress_custom.ts`
- `ui/v2.5/graphql/{data,queries,mutations}/task_progress_tracker_custom.graphql`
- `graphql/schema/types/task_progress_tracker_custom.graphql`, `graphql/schema/schema_custom.graphql`
- `internal/api/resolver_task_progress_tracker_custom.go`, `resolver_task_progress_history_custom.go`, and marker mutation integration
- `pkg/models/task_progress_tracker_custom.go` and its repository mock
- `pkg/scene/marker_import_custom.go`, `marker_import.go`, and `marker_import_custom_test.go`: atomic marker import tag updates
- `pkg/sqlite/task_progress_tracker_custom.go`, `task_progress_metrics_custom.go`, `task_progress_tracking_custom.go`, `task_progress_overall_custom.go`, `database_custom.go`, and entity store hooks
- `task_progress_tracker_history.up.sql`, `task_progress_overall_history.up.sql`

### Database and configuration

Startup automatically creates/updates the custom tracker, event, and fixed-membership tables and applies the one-time retrofit. No manual SQL execution is required. `task_progress_tracker_history.up.sql` is the standalone SQL reference; this feature does not enter the upstream migration chain. Legacy `configuration.ui.taskProgressTrackers` records are imported automatically and removed from that configuration after success. The obsolete persisted daily-rate column is removed automatically; planning rates are browser-local.

### GraphQL

- Queries: `findTaskProgressTrackers`, `taskProgressOverall`, `taskProgressEvents`, `taskProgressPendingItems`, `taskProgressPreview`
- Mutations: `taskProgressTrackerCreate`, `taskProgressTrackerUpdate`, `taskProgressTrackerDestroy`, `taskProgressTrackersReorder`
- Tracker fields include status, mode, version, scope, recording date, current/completed/incoming counts, item counts, and daily history. Update input supports `expected_version`.

### Tests

- `pkg/sqlite/database_bootstrap_custom_test.go`: fresh schema, existing tracker retrofit, repeat startup
- `pkg/sqlite/task_progress_tracker_custom_test.go`: CRUD, counts, order, history aggregation, fixed membership
- `pkg/sqlite/task_progress_tracking_custom_test.go`: tag changes, deletion, deduplication, lifecycle recording
- `pkg/sqlite/task_progress_overall_custom_test.go`: overall scene creation, organization reversals, deletion adjustments, and current-count recalculation
- `internal/api/resolver_task_progress_tracker_custom_test.go`: import, validation, baseline reset, stale edits, undo
- `ui/v2.5/tests/taskProgress_custom.test.ts`: history gaps, range boundaries, averages, cumulative counts, dates
- `ui/v2.5/tests/taskProgressOverall_custom.test.ts`: compact Overall card, Details modal placement, and shared history chart reuse
- `ui/v2.5/tests/taskProgressView_custom.test.ts`: Mexico City day boundaries, progress semantics, net forecasts
- `ui/v2.5/tests/taskProgressCard_custom.test.ts`: compact card rendering and graph omission
- `ui/v2.5/tests/taskProgressAtAGlance_custom.test.ts`: tracker summary labels, percentages, and fixed-batch baseline counts
- `ui/v2.5/tests/taskProgressTrackerModal_custom.test.ts`: status options and non-zero item-type visibility

---

## 6. Advanced Scene Filtering

### Overview

Multiple new filter criteria for scenes.

### New Filter Criteria

#### 6.1 Scene Marker Filters (Enhanced)

**Files:**

- `ui/v2.5/src/components/List/Filters/SceneMarkersFilter.tsx` - Scene marker filter builder used by the Scenes page
- `ui/v2.5/src/components/List/Filters/SceneMarkersExcludeFilter.tsx` - Scene marker exclusion filter builder used by the Scenes page
- `ui/v2.5/src/components/List/Filters/MarkerPerformersFilter.tsx` - Markers page filter builder
- `ui/v2.5/src/models/list-filter/criteria/scene-markers.ts` - Scene marker criterion model
- `ui/v2.5/src/models/list-filter/criteria/scene-markers-exclude.ts` - Scene marker exclusion criterion model
- `ui/v2.5/src/models/list-filter/criteria/marker-performers.ts` - Markers page criterion model
- `graphql/schema/types/filters.graphql` - `SceneMarkerTagGroupInput` type
- `pkg/models/filter.go` - `SceneMarkerTagGroupInput` struct
- `pkg/sqlite/criterion_handlers.go` - `joinedSceneMarkerTagsHandler` function
- `pkg/sqlite/scene_marker_tag_overlap_custom.go` - Shared directed 50%-overlap marker-tag inheritance SQL helpers
- `pkg/sqlite/performer_filter_custom.go`, `pkg/sqlite/performer_custom.go`, `pkg/sqlite/studio_custom.go` - Performer/studio marker tag filters and sorts reuse overlap-aware marker tag matching
- `pkg/sqlite/scene_marker_test.go` - Integration tests for overlap-aware scene include/exclude, marker-page filtering, overlap groups, and direct marker performer ownership
- `pkg/sqlite/scene_marker_tag_overlap_custom_test.go` - Integration coverage for the exact 50% inheritance boundary, below-threshold rejection, and the rule preventing wider markers from inheriting from narrower sources
- `docs/scene_marker_filter_builder_poc.html` - Standalone proof-of-concept for a dedicated marker filter builder UI

Allows filtering scenes by their marker tags with **role-specific performer attributes**:

- `EQUALS`: Groups of tags where each group requires all tags present in a single marker, including effective tags inherited from equal-or-longer source markers that overlap at least 50% of the receiving marker's duration
- `INCLUDES`: Any scene with markers having any of the specified tags
- `Scene Markers: Exclude`: Exclusion groups use the same directed 50%-overlap inheritance, so a scene can be excluded when a marker plus its inherited source tags collectively satisfy the group
- Marker-list results only return markers that directly have at least one requested tag; when multiple overlapping direct-tag markers satisfy the same tag-only group, the shortest marker wins
- Marker performer constraints are always evaluated against the marker itself. An equal-or-longer source marker meeting the 50% threshold can contribute effective tags, but it does not contribute top/bottom performer assignments.
- `overlap_groups`: Advanced direct marker requirements that must be satisfied by markers whose time ranges overlap. These explicit overlap searches retain any positive time intersection and are separate from directed tag inheritance. The groups reuse `SceneMarkerTagGroupInput`, including named and unnamed top/bottom/both-role performer criteria, so searches like "feet marker with unnamed top overlaps BJ marker with unnamed bottom" can be expressed without collapsing role assignments across markers. Reusing the same unnamed performer ID across overlap groups requires the same actual performer in each specified role. Marker-list overlap results return only the narrowest matched requirement marker.
- The Markers page `Markers` filter supports multiple marker rows inside one criterion; two or more rows are always treated as overlapping marker requirements so overlap searches can be expressed without adding duplicate sidebar criteria.

**Role-Specific Filtering:**
Each marker group supports separate top/bottom/both-roles attribute blocks:

- **Top** (↑): `top_performer_ids`, `top_ethnicities`, `top_countries`, `top_rating`
- **Bottom** (↓): `bottom_performer_ids`, `bottom_ethnicities`, `bottom_countries`, `bottom_rating`
- **Both Roles** (↕): `both_roles_performer_ids`, `both_roles_ethnicities`, `both_roles_countries`, `both_roles_rating`
  - "Both Roles" finds performers who appear in BOTH top AND bottom for the same marker type

**Use Cases:**

1. "Scenes where the top and bottom are both 5 stars" - Set top_rating >= 5 AND bottom_rating >= 5 with AND mode
2. "Scenes with facials by Colombian tops" - Set tag=facial, top_countries=CO
3. "Scenes where a performer is both top AND bottom for oral" - Set tag=oral, both_roles populated
4. "Scenes with 3+ facials" - Add 3 marker groups each with tag=facial using ALL modifier

**Performer Mode:**

- `OR`: Either top or bottom matches (default)
- `AND`: Both top and bottom must match their respective criteria

> **Note:** The `performer_scene_tags` feature has been fully removed. Use the current Scene Marker filters instead.

#### 6.2 Performer Country Filter (for Scenes)

**File:** `ui/v2.5/src/components/List/Filters/PerformerCountryFilter.tsx` - NEW

#### 6.4 Performer Ethnicity Filter (for Scenes)

**File:** `ui/v2.5/src/components/List/Filters/PerformerEthnicityFilter.tsx` - NEW

The Ethnicity filters on Vatos, Scenes, Galleries, and Images use the distinct,
non-empty ethnicity values currently stored on performers instead of free-text
entry. The Vatos filter supports multiple selected values and the same
Black/White/Latino expansion behavior as the related-entity filters.

**Additional files:**

- `ui/v2.5/src/models/list-filter/criteria/performer-ethnicity_custom.ts` - Adds the database-backed Vatos criterion
- `ui/v2.5/src/models/list-filter/performers.ts` - Replaces the generic Vatos ethnicity text criterion
- `pkg/sqlite/performer_filter.go`, `pkg/sqlite/performer_filter_custom.go` - Apply multi-value ethnicity selections to Vato queries
- `pkg/sqlite/performer_ethnicity_filter_custom_test.go` - Covers selected-value expansion, inclusion/exclusion, and missing ethnicity behavior

#### 6.5 Performer Rating Filter (for Scenes)

**File:** `ui/v2.5/src/components/List/Filters/PerformerRatingFilter.tsx` - NEW

#### 6.6 Custom Filters

**Overview:** Radio-button based filters with predefined complex filter options for both scenes and performers.

**Purpose:** Provide quick access to commonly-used complex filtering scenarios without requiring multiple filter configurations.

**Files:**

- `graphql/schema/types/filters.graphql` - Added `custom_filters: String` to both `SceneFilterType` and `PerformerFilterType`
- `pkg/models/scene.go` - Added `CustomFilters` field to `SceneFilterType` struct
- `pkg/models/performer.go` - Added `CustomFilters` field to `PerformerFilterType` struct
- `pkg/models/scene_marker.go` - Added `CustomSceneMarkerFilterInput` struct and `CustomFilters` field to `SceneMarkerFilterType`
- `pkg/sqlite/scene_filter.go` - `customFiltersCriterionHandler` for scenes
- `pkg/sqlite/performer_filter.go` - `customFiltersCriterionHandler` for performers
- `pkg/sqlite/scene_marker_filter.go` - `customFiltersCriterionHandler` for scene markers
- `ui/v2.5/src/models/list-filter/types.ts` - Added `"custom_filters"` to `CriterionType`
- `ui/v2.5/src/models/list-filter/criteria/custom-filters.ts` - NEW: Criterion classes for custom filters (Scene, Performer, and SceneMarker)
- `ui/v2.5/src/models/list-filter/scenes.ts` - Added `SceneCustomFiltersCriterionOption`
- `ui/v2.5/src/models/list-filter/scene-markers.ts` - Added `SceneMarkerCustomFiltersCriterionOption`
- `ui/v2.5/src/models/list-filter/performers.ts` - Added `PerformerCustomFiltersCriterionOption`
- `ui/v2.5/src/components/List/Filters/OptionFilter.tsx` - Enhanced with translated labels for custom_filters
- `ui/v2.5/src/locales/en-GB.json` - Base translation strings for all filter options
- `ui/v2.5/src/locales/en-US.json` - US English override translations

**Scene Custom Filters:**

- **Versatile Scenes:** Scenes where ALL performers have at least one sexTagId marker as "top" AND at least one as "bottom"
- **Circular Oral:** Scenes with a marker tagged with oralTagId (or a subtag) where ALL performers are both tops and bottoms on the same marker

**Scene Marker Custom Filters:**

- **Circular Oral:** Markers tagged with oralTagId (or a subtag) where ALL performers are both tops and bottoms on the same marker

**Performer Custom Filters:**

- **Strict Tops:** Performers with zero sexTagId/oralTagId/facialTagId markers as bottom, but at least one sexTagId as top
- **Lenient Tops:** Performers with at least one sexTagId as top, zero sexTagId as bottom, and at least one oralTagId or facialTagId as bottom
- **Strict Bottoms:** Performers with zero sexTagId/oralTagId/facialTagId markers as top, but at least one sexTagId as bottom
- **Lenient Bottoms:** Performers with at least one sexTagId as bottom, zero sexTagId as top, and at least one oralTagId or facialTagId as top

**How it works:**

1. Uses recursive CTEs to find tag families (Sex, Oral, Facial) including all descendant tags
2. Checks scene_marker_performers table for role assignments (top/bottom)
3. Applies complex EXISTS/NOT EXISTS conditions based on the selected filter

**UI Usage:**

- Filter appears in Scenes page under "Custom Filters" with radio button options
- Filter appears in Performers page under "Custom Filters" with radio button options
- Filter appears in Markers page (/scenes/markers) under "Custom Filters" with radio button options
- Only one option can be selected at a time

### Backend Filter Implementations

- `pkg/sqlite/scene_filter.go` - Scene filter handlers for all new criteria
- `pkg/sqlite/scene_marker_filter.go` - Scene marker filter handlers
- `pkg/sqlite/criterion_handlers.go` - Shared criterion handler utilities
- `graphql/schema/types/filters.graphql` - GraphQL filter input types

---

## 7. Studio Category Buttons

### Overview

Quick-access buttons on studio cards and detail pages showing scene counts by category.

### Files

- `ui/v2.5/src/components/Studios/StudioCard.tsx` - Category buttons on cards
- `ui/v2.5/src/components/Studios/StudioDetails/StudioCategoryStrip.tsx` - NEW: Strip for detail page
- `ui/v2.5/src/components/Studios/StudioDetails/Studio.tsx` - Integration

### Button Types

- **Sex Scenes** (gay icon): Scenes with top AND bottom performers
- **Oral Scenes** (mouth icon): Scenes with oral tags but no sex tags
- **Solo Scenes** (hand icon): Scenes with solo tag only
- **Facial Scenes** (facial icon): Scenes with facial tags
- **Unique Performers** (user-plus icon): Count of distinct performers

### Studio Sorting by Category Counts

**Added: February 2026**

Studios can now be sorted by their scene category counts (sex, oral, solo, facial), by Standard or Really Hot facial marker counts, and by Bronze, Silver, Gold, or Royal Sapphire scene counts. Both ascending and descending directions are supported. Every qualifying facial marker is counted, so multiple facial markers in one scene contribute multiple counts. A Really Hot facial marker matches both the configured Facial tag family and Really Hot qualifier tag family on that marker; Standard counts the remaining facial markers, so the two variants do not overlap. If no Really Hot qualifier is configured, all facial markers are Standard and the Really Hot count is zero. Metallic scene-count sorts use the configured scene rating thresholds and the same Bronze/Silver/Gold/Royal Sapphire/GOAT override-tag precedence as scene card styling.

Whenever a Studio list sort other than Name or Random is active, each card shows the active value in emerald. If that exact metric already has a visible card control (for example Rating, scene/image/gallery/tag/O counts, role-scene counts, unique-vato count, or subsidiary count), the existing control is highlighted and the separate strip is omitted to avoid duplication. Metrics without a visible card value retain the compact emerald-accented strip with the current label, direction, and value. Existing batched card values back counts and activity percentages; duration, size, latest-scene, Rating Advisor averages, and metallic scene counts fetch only the one active metric for the current page.

### Catalog Active-Sort Metric Badges

The same emerald active-sort treatment is shared by the Scenes, Vatos, Groups, Images, Markers, Galleries, and Tags grid catalogs. Each catalog suppresses it for its own default sort (Scene Date, Vato/Group/Tag Name, Image/Gallery Path, and Marker Title) and for both plain and seeded Random sorts. For other sorts, an exact value already visible on the card is highlighted in place—covering ratings, applicable dates/media specs, count controls, marker timing, and configured vato role badges—while non-card and aggregate values continue to use the compact label/value/direction strip. Scene activity/quality percentage sorts use that strip because interpreted scene insights replace the old seven-value percentage footer. Zero-count controls remain visible while their metric is active so every card still communicates its sorted value without a duplicate strip.

- `ui/v2.5/src/components/Shared/SortMetricBadge_custom.tsx`, `SortMetricBadge_custom.scss`, `sortMetric_custom.ts`, and `catalogCardSortHighlight_custom.ts` provide the common strip/highlight presentation, formatting, seeded-random normalization, and default-sort suppression.
- The catalog-specific `*SortMetric_custom.ts` files map each available sort to the corresponding scene, performer, group, image, gallery, marker, or tag card value.
- Catalog list/grid/card components pass the active sort and direction into grid cards, which select either the existing highlighted value or the fallback strip.
- `CatalogSortMetricValue` and the Group/Vato/Tag sort-metric queries provide one page-level lookup for the few aggregate values that are not part of the standard list fragments. Vato and Tag SQL expressions are reused from the validated catalog sorts themselves; subgroup order is scoped to the active parent group when available.
- `ui/v2.5/tests/catalogSortMetric_custom.test.ts` covers active/default/random selection and aggregate overrides; `catalogCardSortHighlight_custom.test.ts` covers the shared highlight predicate, Random suppression, and zero-value eligibility.
- `graphql/schema/types/catalog_sort_metric_custom.graphql`, `internal/api/catalog_sort_metric_custom.go`, and `pkg/sqlite/catalog_sort_metric_custom.go` define those batched GraphQL values and validated backend expressions.
- `ui/v2.5/tests/catalogSortMetric_custom.test.ts` covers per-catalog default suppression, representative values, aggregate overrides, and Random-sort suppression. `pkg/sqlite/catalog_sort_metric_custom_test.go` covers validated SQL-expression reuse and unknown-sort rejection, while `internal/api/catalog_sort_metric_custom_test.go` covers parent-scoped subgroup-order values.
- `pkg/sqlite/scene_marker_timestamp_custom.go` normalizes legacy zero marker timestamps to the marker's other timestamp (or the Unix epoch when both are unset), preserving the non-null GraphQL timestamp contract when marker cards request active-sort values. `pkg/sqlite/scene_marker_timestamp_custom_test.go` covers stored, fallback, and both-unset timestamps.
- No new configuration is required; Scene activity-percentage values reuse the existing configured role tag IDs.

**Backend Files:**

- `pkg/sqlite/role_tag_provider.go` - NEW: Configuration provider for role tag IDs
- `pkg/sqlite/studio.go` - Sort registration and queries for category scenes, facial markers, and metallic scene counts
- `pkg/sqlite/studio_facial_marker_sort_custom.go` - Standard/Really Hot facial marker classification and exact sort expressions
- `pkg/sqlite/studio_sort_metric_custom.go` - Metallic-tier scene expressions plus exact active-sort expressions for card display
- `internal/api/studio_list_stats_custom.go` - Adds the optional current sort value to the batched Studio card payload

**Frontend Files:**

- `ui/v2.5/src/models/list-filter/studios.ts` - Sort options
- `ui/v2.5/src/components/Studios/StudioSortMetricStrip_custom.tsx` and `studioSortMetric_custom.ts` - Current-sort label, direction, value selection, and formatting
- `ui/v2.5/src/components/Studios/StudioList.tsx`, `StudioCardGrid.tsx`, `StudioCard.tsx`, and `styles.scss` - Pass and render the active sort strip

**Manager Files:**

- `internal/manager/init.go` - Initialize role tag provider
- `internal/manager/manager.go` - Role tag provider implementation

**Translation Keys:**

- `ui/v2.5/src/locales/en-GB.json` and `en-US.json` - category, facial-variant, and metallic sort labels

**New Sort Options:**

- `sex_scenes_count` - Sort by scenes with sex markers
- `oral_scenes_count` - Sort by scenes with oral markers (excludes sex)
- `solo_scenes_count` - Sort by scenes with solo markers (excludes sex/oral)
- `facial_scenes_count` - Sort by scenes with facial markers
- `standard_facial_count` - Sort by individual Facial markers without the Really Hot qualifier
- `really_hot_facial_count` - Sort by individual markers matching both Facial and Really Hot tag families
- `royal_sapphire_scenes_count` - Sort by Royal Sapphire or GOAT scenes
- `gold_scenes_count` - Sort by Gold scenes
- `silver_scenes_count` - Sort by Silver scenes
- `bronze_scenes_count` - Sort by Bronze scenes
- `unique_performers_count` - Sort by count of performers with only 1 scene (and it's for this studio)
- `o_count` - Sort by total O-count (sum of scene o_dates + image o_counter for the studio)

**Tests:**

- `pkg/sqlite/studio_sort_metric_custom_test.go` - Executes metallic tier counting with rating thresholds, override tags, priority conflicts, and validates ascending/descending sort registration
- `pkg/sqlite/studio_facial_marker_sort_custom_test.go` - Verifies individual-marker counting, multiple markers per scene, non-overlapping Standard/Really Hot classification, same-marker semantics, descendant/secondary tags, missing-qualifier fallback, and ascending/descending sort registration
- `ui/v2.5/tests/studioSortMetric_custom.test.ts` - Verifies Name suppression, Random display, metallic/facial backend values, and existing batched count/percentage values

**Configuration Dependencies:**

- Settings → Interface → Role Tags → Facial tag
- Settings → Interface → Role Tags → Really Hot qualifier tag

### Studio O-Count Depth

**Updated: June 2026**

Studio `o_counter` now accepts `depth` and includes child studios when requested. Studio cards request `o_counter(depth: -1)` so parent studio cards and detail pages show the combined O-count for the parent and its substudios. Performer-scoped studio cards pass the same studio depth used by their other counts.

### Batched Studio List Statistics

**Updated: July 2026**

The studios list returns card counts, recursive O-counts, category counts, and activity-duration statistics in one page-level `studio_list_stats` payload. Grouped SQL queries calculate the requested studio IDs together, and marker-role queries are restricted to scenes from those studios instead of loading every matching marker and intersecting in Go once per card. Existing `Studio` aggregate fields remain available for detail pages, performer-scoped cards, and plugins.

The list also uses a dedicated `StudioListData` fragment. It keeps fields required for cards, bulk editing, and studio tagging while excluding full detail metadata and the expanded `SlimTagData` fragment.

**Files modified or added:**

- `graphql/schema/types/studio_custom.graphql` - Adds `StudioListStats` and `FindStudiosResultType.studio_list_stats`
- `internal/api/studio_list_stats_custom.go` - Batched basic counts, recursive O-counts, role counts, and activity stats
- `internal/api/resolver_query_find_studio.go` - Populates list stats only when requested
- `ui/v2.5/graphql/data/studio.graphql`, `ui/v2.5/graphql/queries/studio.graphql` - Lean studio-list and stats fragments
- `ui/v2.5/src/components/Studios/StudioList.tsx`, `StudioCardGrid.tsx`, `StudioCard.tsx` - Maps page-level stats to cards
- `ui/v2.5/src/components/Studios/EditStudiosDialog.tsx` and `ui/v2.5/src/components/Tagger/studios/*` - Use the lean list fragment without changing bulk-edit/tagger behavior

**Tests:**

- `internal/api/studio_list_stats_custom_test.go` - Verifies batched role-row mapping, activity aggregation, scene counts, and interval clamping

**Configuration dependencies:** Uses the existing UI role tag IDs for sex, oral, solo, and facial category calculations. No database migration or new configuration key is required.

### Studio GraphQL Extensions

**File:** `graphql/schema/types/studio.graphql`

```graphql
type Studio {
  ...
  sex_scene_count: Int
  oral_scene_count: Int
  solo_scene_count: Int
  facial_scene_count: Int
}
```

---

## 8. Performer Card Enhancements

### File

`ui/v2.5/src/components/Performers/PerformerCard.tsx`

### Features Added

1. **Inline Tag Editor**: Edit performer scene tags directly from the card
2. **Scene Tags Modal**: Modal dialog for editing scene-specific tags
3. **Role Badges**: Top/Bottom visual indicators (see Section 3)
4. **Tag Button**: Green tag icon showing scene tag count
5. **Orgasm/Splash Icon**: Shows when performer has orgasm markers as "top"

### Orgasm Splash Icon Feature

The performer card displays a splash icon in the role badge strip when the performer has orgasm markers where they are marked as "top".

**Scene Context (when viewing performers in a scene):**

- Shows splash icon if performer has at least one orgasm marker as top in that specific scene
- Shows count next to icon only if more than one orgasm marker
- No number shown for single orgasm marker

**Global Context (performers list, performer details):**

- Shows splash icon with total count of orgasm markers as top across all scenes
- Count always shown (since this is a cumulative total)
- No icon shown if performer has no orgasm markers as top

**Configuration:**

- Requires `orgasmTagId` to be set in Settings → Interface → Role Tags
- Uses `orgasm_top_count` GraphQL field for global counts
- Uses `orgasm_top_X` in `scene_marker_roles` for scene-specific counts

### Facial Counts in Scene Context

The performer card displays facial counts (top/bottom) when viewing performers in a scene context:

- Shows total facial count in the category icon container
- Shows top/bottom arrows with individual counts (e.g., "↑2 ↓1")
- Uses `facial_top_X` and `facial_bottom_X` in `scene_marker_roles` for scene-specific counts
- Matches the global context behavior but scoped to the current scene only

### Facial Marker Counts (Global Context)

**Added: February 2026**

For facial markers specifically, global context now shows **individual marker counts** instead of scene counts to match the granularity of scene context. This ensures that multiple facials by the same performer in the same scene are properly counted separately.

**GraphQL Schema Changes:**

- `graphql/schema/types/performer.graphql` - Added three new fields:
  - `facial_marker_count: Int!` - Total count of facial markers (not scenes)
  - `facial_marker_top_count: Int!` - Count of facial markers where performer is top
  - `facial_marker_bottom_count: Int!` - Count of facial markers where performer is bottom

**Backend Changes:**

- `internal/api/resolver_model_performer.go` - Added three new resolvers:
  - `FacialMarkerCount()` - Uses `CountMarkersByPerformerRole` instead of `CountScenesByPerformerMarkerRole`
  - `FacialMarkerTopCount()` - Uses `CountMarkersByPerformerRole` with "top" role
  - `FacialMarkerBottomCount()` - Uses `CountMarkersByPerformerRole` with "bottom" role
- These resolvers call `scene.CountMarkersByPerformerRole()` which counts individual markers rather than distinct scenes

**Frontend Changes:**

- `ui/v2.5/graphql/data/performer.graphql` - Added `facial_marker_count`, `facial_marker_top_count`, `facial_marker_bottom_count` to performer query
- `ui/v2.5/src/components/Performers/PerformerDetails/PerformerCategoryStrip.tsx` - Updated global context to use marker counts:
  - `facialCount` uses `p.facial_marker_count` (instead of `p.facial_scene_count`)
  - `topCount` uses `p.facial_marker_top_count` (instead of `p.facial_top_count`)
  - `bottomCount` uses `p.facial_marker_bottom_count` (instead of `p.facial_bottom_count`)

**Behavior:**

- Sex and oral counts remain scene-based in global context (showing scenes, not markers)
- Facial counts now show marker-based counts globally to match scene context precision
- Example: If a scene has 2 facials by the same performer to the same receiver, global context shows "2" instead of "1"

### Compact Scene Performer Cards

Scene-detail performer cards use a tighter layout than performer cards elsewhere:

- Removes the empty age row when the scene does not have a calculable performer age
- Removes the unused scene-role grid row and reduces the role area to the actual two top/bottom chip rows
- Keeps hidden top or bottom placeholders so role chips remain aligned across cards
- Reduces scene-only title, role-strip, divider, and card-bottom spacing

**Files modified:**

- `ui/v2.5/src/components/Performers/PerformerCard.tsx`
- `ui/v2.5/src/components/Scenes/styles.scss`

### Scene Vato Overview Panel

Scene performer cards plus performer portraits and names shown in scene-marker activity/highlight UI open a compact overview drawer from the right side of the viewport. The drawer loads the full performer record on demand and supports backdrop, X-button, and Escape-key dismissal. All drawer links open in a new tab, including the vato name, tags, role metrics, and partner portraits.

The panel includes the existing performer detail metadata and custom fields while intentionally omitting tattoos, piercings, and Stash IDs. It shows the performer rating and scene-average rating in collision-safe metric cards, the reusable sex/oral/solo/top/bottom role strip fitted beneath the performer name, catalog totals, an exact non-clickable Studios count, and an exact Partners count with lazy portrait previews on hover. Panel popovers render above the drawer layer, and the Partners popup measures its content and available viewport space so it flips above the trigger when it cannot fit below. Five always-visible activity-duration metrics reuse the performer Stats values: time fucking, getting fucked, getting his pito sucked, sucking pito, and jerking; top values are blue and bottom values are green. The same responsive Activity Time card component also fills the right side of the standard performer-page header, moving below the performer details on narrower screens. Activity Time appears after the general performer data and before the scene-specific interactions. The favorite/external/social action strip is intentionally omitted.

An **In This Scene** section at the bottom derives this vato's opposite-role partners from the current scene markers. It groups linked portraits under the same role-specific wording used by the performer Partners tab, deduplicates partners repeated across markers, and always orders populated groups as Sex Top, Oral Top, Sex Bottom, then Oral Bottom.

The performer **Partners** tab uses the same blue top and green bottom role-title treatments. Sex and oral partner cards also show the merged timed-marker duration the two vatos spent together in that exact role configuration, including a visible `0:00` when no timed interval is available; facial partner cards omit the duration strip. Overlapping timed markers in the same scene are merged so the total is not double-counted.

The performer detail label `penis_length` is displayed as **Verga** on both the full performer page and the scene overview drawer.

**Files created or modified:**

- `ui/v2.5/src/components/Scenes/SceneDetails/ScenePerformerOverviewPanel_custom.tsx` and `.scss` - Scene-scoped drawer state, full performer query, overview rendering, responsive slide-in layout, and safe-mode metadata parity
- `ui/v2.5/src/components/Performers/PerformerDetails/PerformerActivityTime.tsx`, `Performer.tsx`, and `ui/v2.5/src/components/Performers/styles.scss` - Shared activity cards and their responsive performer-header placement
- `ui/v2.5/src/utils/scenePerformerOverview_custom.ts` - Explicit overview field exclusions, primary-click behavior, activity metric mapping, and scene-only partner grouping/deduplication
- `ui/v2.5/src/components/Scenes/SceneDetails/Scene.tsx` and `SceneDetailPanel.tsx` - Scene provider and Details-tab performer-card wiring
- `ui/v2.5/src/components/Scenes/SceneDetails/sceneMarkerHoverPopover_custom.tsx` and `ui/v2.5/src/components/Scenes/SceneMarkerCard.tsx` - Marker portrait and performer-name drawer triggers
- `ui/v2.5/src/components/Performers/PerformerDetails/PerformerDetailsPanel.tsx`, `PerformerCategoryStrip.tsx`, and `ui/v2.5/src/components/Shared/TagLink.tsx` - Reusable field exclusions, role strip, and optional new-tab link behavior
- `ui/v2.5/src/components/Shared/HoverPopover.tsx` and `hoverPopoverPlacement_custom.ts` - Content-aware top/bottom placement for lazy popovers
- `ui/v2.5/src/components/Performers/PerformerCard.tsx` and `ui/v2.5/src/components/Shared/GridCard/GridCard.tsx` - Optional primary-link interception for scene performer cards
- `ui/v2.5/src/components/Performers/PerformerDetails/PerformerAppearsWithByRolePanel.tsx` and `PerformerAppearsWithByRolePanel_custom.scss` - Blue/green role headings and per-partner shared activity duration
- `internal/api/performer_partner_duration_custom.go`, `internal/api/resolver_query_find_performer_custom.go`, `graphql/schema/types/performer_custom.graphql`, and `ui/v2.5/graphql/queries/performer.graphql` - Merged role-duration calculation and GraphQL delivery
- `ui/v2.5/src/locales/en-GB.json` and `ui/v2.5/src/components/VatoStats/VatoStats.tsx` - Verga labels in performer details and Vato Stats

**Test cases:**

- `ui/v2.5/tests/scenePerformerOverviewFields_custom.test.ts` verifies the exact three-field exclusion contract, retention of the remaining performer metadata, plain-click versus modifier-click card behavior, deduplicated/sorted partner previews, fixed scene-interaction ordering, retention of zero-value activity durations, and viewport-aware popover flipping.
- `ui/v2.5/tests/performerActivityTime_custom.test.ts` verifies all five shared labels, roles, and formatted duration values, including zero durations.
- `ui/v2.5/tests/performerRolePartnerLabels_custom.test.ts` verifies that shared duration is enabled for sex and oral partner cards and disabled for facial partner cards.
- `internal/api/performer_partner_duration_custom_test.go` verifies unique shared-scene counts, same-scene interval merging, untimed zero-duration behavior, and opposite-role filtering.

GraphQL adds `duration_seconds` to `PerformerWithSceneCount`. No new configuration is required; duration calculation reuses the configured sex, oral, and facial role tags.

### Batched Lazy Role Stats (Performer Cards)

Performer list cards no longer request role and partner-count resolver fields in the initial `PerformerListData` fragment. The card grid renders the base cards first, then lazily requests all role stats for the visible performers through one batched GraphQL query.

**GraphQL Schema Changes:**

- `graphql/schema/types/performer_custom.graphql` - Added `PerformerRoleStats` and `performerRoleStats(performer_ids: [ID!]!)`

**Backend Changes:**

- `internal/api/resolver_query_find_performer_custom.go` - Added the `PerformerRoleStats` query resolver
- `pkg/scene/query_custom.go` - Added `GetPerformerRoleStatsBatch`, which calculates all card metrics for a page of performers from batched scene-marker queries and batched marker performer/tag fetches

**Frontend Changes:**

- `ui/v2.5/graphql/data/performer.graphql` - Removed role-count fields from the initial list fragment
- `ui/v2.5/src/components/Performers/performerRoleStats_custom.ts` - Shared lazy loader for `performerRoleStats`
- `ui/v2.5/src/components/Performers/PerformerCardGrid.tsx` and `PerformerRecommendationRow.tsx` - Lazy-load role stats for list and home page cards, then pass the results to existing card rendering
- `ui/v2.5/src/components/Performers/PerformerCard.tsx` - Accepts lazily loaded role stats without changing the rendered card layout

### Props Added

```typescript
interface IPerformerCardProps {
  ...
  sceneHasExplicitTopBottom?: boolean;  // Suppress fallback oral-based icons
  showTagButton?: boolean;              // Show compact tag button
  onOpenTagEditor?: (performer) => void; // Callback for tag editor
  showInlineTags?: boolean;             // Show inline tag strip
  showTagCounts?: boolean;              // Show counts next to tags
}
```

### Related Files

- `ui/v2.5/src/assets/splash.svg` - Orgasm splash icon
- `ui/v2.5/graphql/data/performer.graphql` - Added `orgasm_top_count` field
- `graphql/schema/types/performer.graphql` - Schema definition
- `internal/api/resolver_model_performer.go` - Go resolver (`OrgasmTopCount`)
- `pkg/scene/query.go` - Marker role extraction (`CountMarkersByPerformerRole` for counting actual markers)
- `ui/v2.5/src/core/config.ts` - Added `orgasmTagId` config option
- `ui/v2.5/src/components/Settings/SettingsInterfacePanel/SettingsInterfacePanel.tsx` - Settings UI
- `ui/v2.5/src/locales/en-GB.json` - Localization string
- `ui/v2.5/src/utils/navigation.ts` - Added `makePerformerOrgasmMarkersUrl` for clickable splash icon

---

## 9. Scene Card Enhancements

### File

`ui/v2.5/src/components/Scenes/SceneCard.tsx`

### Features Added

1. **Performer Scene Tags Button**: Green button showing aggregated performer scene tags for the scene
2. **Role Icons on Overlay**: Visual indicators for scene type (gay, oral, solo, facial)
3. **Gold Facial Icon (Really Hot Facial)**: Facial icon displays in gold when a scene has a marker tagged with BOTH the configured Facial tag AND the new Really Hot qualifier tag. White facial icon shows for plain facial markers; gold facial icon takes precedence when the really-hot combo is found. Configurable via Settings → Interface → Role Tags → "Really Hot qualifier tag". Applies to both the scene card overlay and the in-scene player overlay.
4. **Activity Duration Percentages**: The shared runtime calculation provides Sex, Oral, Solo, and Other percentages from configured primary role marker tags; same-category overlaps are merged, cross-category overlaps count toward each category, and Other represents runtime without a sex/oral/solo marker. It also provides Outstanding, Standard, and Unusable: Outstanding is any timed marker that is not a configured sex/oral/solo primary marker, or a configured sex/oral/solo primary marker with secondary tags; Standard is unmarked runtime or plain configured sex/oral/solo marker runtime not overlapped by Outstanding; Unusable comes from negative/Skip marker ranges. Scene details retain the two-row metric strip; scene cards use the compact interpreted insights documented in section 54 instead of repeating all seven percentages.

### Custom Assets Added

- `ui/v2.5/src/assets/gay.svg` - Gay/sex scene icon
- `ui/v2.5/src/assets/mouth.svg` - Oral scene icon
- `ui/v2.5/src/assets/facial.png` - Facial scene icon
- `ui/v2.5/src/assets/straight.svg` - Straight scene icon
- `ui/v2.5/src/assets/splash.svg` - Orgasm/splash scene icon

---

## 10. Tag List Enhancements

### Files

- `ui/v2.5/src/components/Tags/TagList.tsx`
- `ui/v2.5/src/components/Tags/TagCard.tsx`
- `ui/v2.5/src/components/Tags/TagCardGrid.tsx`

### Props Added

```typescript
interface ITagList {
  ...
  sceneCountOnly?: boolean;   // Only show scene count button
  onTags?: (tags) => void;    // Callback when tags load
  performerId?: string;       // Filter by performer context
  performerName?: string;     // Display name for criteria
}
```

### Features

- Performer-context aware tag lists
- Scene count links navigate to scene markers when in performer context
- The tag detail Scenes tab adds the exact summed duration of all timed markers matching the current tag to the existing scene-duration/filesize byline. It follows the existing Include Sub-Tag Content switch, using direct-only or recursive duration from `Tag.scene_marker_duration(depth:)`. The global `/scenes/markers` catalog shows the equivalent duration for its entire active filter beside the pagination count. Open-ended and backwards ranges contribute zero; valid marker lengths are summed rather than overlap-merged because they represent distinct marker occurrences.

### Marker Duration Files and Tests

- `graphql/schema/types/tag_custom.graphql`, `graphql/schema/types/scene-marker_custom.graphql`, `internal/api/resolver_model_tag_custom.go`, `internal/api/resolver_query_find_scene_marker.go`, and `pkg/scene/marker_query_custom.go` - Tag and filtered-marker GraphQL aggregates plus marker-length calculation.
- `ui/v2.5/graphql/queries/tag.graphql`, `scene-marker.graphql`, `ui/v2.5/src/components/Tags/TagDetails/TagScenesPanel.tsx`, `ui/v2.5/src/components/Scenes/SceneList.tsx`, and `SceneMarkerList.tsx` - Fetch and render tag marker time beside the existing Scenes totals and filtered marker time on the global Markers page.
- `pkg/scene/marker_query_custom_test.go` and `ui/v2.5/tests/markerDurationPlacement_custom.test.ts` - Cover valid/open-ended/backwards/nil marker inputs, unpaginated filtered aggregation, and both UI placements while guarding removal of the former Markers-tab box.

---

## 11. New GraphQL Queries and Types

### Stats Queries

See Section 4 for full list.

### Filter Types

**File:** `graphql/schema/types/filters.graphql`

```graphql
input SceneFilterType {
  ...
  performer_ethnicity: StringCriterionInput
  performer_country: StringCriterionInput
  performer_rating: IntCriterionInput
  performer_rating_all: Boolean
  scene_marker_tags: SceneMarkerTagsCriterionInput
}
```

---

## 12. File Inventory

### New Files Added

```
.github/copilot-instructions.md          # AI agent instructions

# Database Migration
migrate_performer_scene_tags_to_markers.sql  # Migration from old system
scene_marker_performers_top_bottom.sql       # Scene marker performers schema

# Backend
internal/api/resolver.go                  # Custom resolvers (933+ lines added)
pkg/sqlite/scene_marker_filter.go         # Scene marker filter logic
pkg/sqlite/table.go                       # Table definitions
pkg/scene/query.go                        # Scene query helpers
pkg/performer/query.go                    # Performer query helpers

# Frontend - Components
ui/v2.5/src/components/SceneStats/SceneStats.tsx
ui/v2.5/src/components/SceneStats/SceneStats.scss
ui/v2.5/src/components/TaskProgress.tsx
ui/v2.5/src/components/List/Filters/PerformerCountryFilter.tsx
ui/v2.5/src/components/List/Filters/PerformerEthnicityFilter.tsx
ui/v2.5/src/components/List/Filters/PerformerRatingFilter.tsx
ui/v2.5/src/components/List/Filters/SceneMarkersFilter.tsx
ui/v2.5/src/components/List/Filters/SceneMarkersExcludeFilter.tsx
ui/v2.5/src/components/List/Filters/MarkerPerformersFilter.tsx
ui/v2.5/src/components/Studios/StudioDetails/StudioCategoryStrip.tsx

# Frontend - Assets
ui/v2.5/src/assets/gay.svg
ui/v2.5/src/assets/facial.png
ui/v2.5/src/assets/mouth.svg
ui/v2.5/src/assets/straight.svg

# Frontend - Filter Criteria
ui/v2.5/src/models/list-filter/criteria/ethnicity.ts

# Frontend - GraphQL Queries
ui/v2.5/src/core/queries/performerEthnicities.graphql
ui/v2.5/src/core/queries/performerEthnicityCounts.graphql
ui/v2.5/src/core/queries/performerEthnicityTierCounts.graphql
```

### Heavily Modified Files (>100 lines changed)

```
graphql/schema/types/filters.graphql      (+87 lines)
graphql/schema/types/stats.graphql        (+45 lines)
internal/api/resolver_model_studio.go     (+201 lines)
pkg/sqlite/scene_filter.go                (+462 lines)
pkg/sqlite/scene_marker_filter.go         (+406 lines)
pkg/sqlite/criterion_handlers.go          (+188 lines)
pkg/sqlite/gallery_filter.go              (+199 lines)
pkg/sqlite/image_filter.go                (+200 lines)
ui/v2.5/src/components/Performers/PerformerCard.tsx  (+521 lines)
ui/v2.5/src/components/Scenes/SceneCard.tsx          (+276 lines)
ui/v2.5/src/components/Scenes/SceneDetails/Scene.tsx (+114 lines)
ui/v2.5/src/components/Studios/StudioCard.tsx        (+201 lines)
ui/v2.5/src/components/Tags/TagList.tsx              (+227 lines)
ui/v2.5/src/utils/navigation.ts                      (+560 lines)
ui/v2.5/src/models/list-filter/criteria/tags.ts      (+273 lines)
ui/v2.5/src/models/list-filter/criteria/criterion.ts (+118 lines)
ui/v2.5/src/components/Settings/SettingsInterfacePanel/SettingsInterfacePanel.tsx (+173 lines)
```

---

## Merge Conflict Resolution Guidelines

When merging with upstream Stash releases:

1. **Always preserve the upstream logic first** - treat upstream as the "main" version
2. **Layer custom features on top** - adjust custom code to match upstream patterns
3. **Key imports to preserve**:
   - `ConfigurationContext` from `src/hooks/Config` (for useContext usage)
   - `useConfigurationContext` from `src/hooks/Config` (hook version)
   - Custom image imports (gay.svg, mouth.svg, facial.png, straight.svg)
4. **Preserve custom props** on components (sceneHasExplicitTopBottom, showTagButton, etc.)
5. **Check filter criteria files** - often need merging of new criterion types
6. **GraphQL schema files** - merge carefully, add custom types after upstream types

---

## Configuration Dependencies

These configuration paths are used throughout the custom features:

- `configuration.ui.sceneTagAliases.top`
- `configuration.ui.sceneTagAliases.bottom`
- `configuration.ui.sceneTagAliases.oraltop`
- `configuration.ui.sceneTagAliases.oralbottom`
- `configuration.ui.sceneTagAliases.solo`
- `configuration.ui.sceneTagAliases.facialgiven`
- `configuration.ui.sceneTagAliases.facialreceived`
- `configuration.ui.sceneTagAliases.selffacial`
- `configuration.ui.showMultiSegmentLoopControls` (for multi-segment loop feature)
- `configuration.ui.enableSceneOHotkey` (defaults to enabled; controls the scene-page O shortcut)

---

## 13. Multi-Segment Loop Controls

### Overview

An enhanced looping system for the scene player that allows you to define multiple A-B segments instead of just one. When loop is enabled, the player will play through all defined segments in order, then repeat from the first segment. Multi-segment ends and negative-marker starts use playback-rate-aware one-shot boundary timers with `timeupdate` as a safety fallback, avoiding the old coarse event-only checks and 100 ms early loop transition. Overlapping or touching negative markers are merged before playback so the player seeks directly to the end of the complete undesirable range.

### Usage

1. Enable in Settings > Interface > Scene Player > "Show Multi-Segment Loop controls"
2. In the scene player, a controls panel appears below the video
3. Click "Add Segment" to mark a start point at current playback position
4. Click "Set End" to mark the end point and create the segment
5. Repeat to add more segments
6. Use "Loop On" to start playing through all segments in sequence
7. Segments can be reordered with up/down arrows, removed individually, or cleared entirely
8. From a scene's Markers tab (`/scenes/<id>` > Markers), select one or more markers and click "Add to Multi-Segment Loop" to append them as segments
9. In the multi-segment controls, select multiple segments with checkboxes to delete selected segments or keep only the selected segments

### Files Created

- `ui/v2.5/src/components/ScenePlayer/multi-segment-loop.ts` - VideoJS plugin for multi-segment looping
- `ui/v2.5/src/components/ScenePlayer/MultiSegmentLoopControls.tsx` - React component for segment management UI
- `ui/v2.5/src/components/ScenePlayer/multiSegmentSelection_custom.ts` - Bulk selection helper functions
- `ui/v2.5/src/components/ScenePlayer/playbackBoundary_custom.ts` - Shared precise boundary timing and negative-range helpers
- `ui/v2.5/src/@types/videojs-multi-segment-loop.d.ts` - TypeScript type declarations
- `ui/v2.5/tests/multiSegmentSelection_custom.test.ts` - Bulk selection helper tests
- `ui/v2.5/tests/playbackBoundary_custom.test.ts` - Boundary delay, tolerance, and merged-range tests

### Files Modified

- `ui/v2.5/src/components/ScenePlayer/ScenePlayer.tsx` - Integration of plugin and controls
- `ui/v2.5/src/components/ScenePlayer/styles.scss` - Styles for controls, bulk segment selection, and timeline markers
- `ui/v2.5/src/components/Settings/SettingsInterfacePanel/SettingsInterfacePanel.tsx` - Setting toggle
- `ui/v2.5/src/core/config.ts` - Config option type
- `ui/v2.5/src/locales/en-GB.json` - Locale strings
- `ui/v2.5/src/components/Scenes/SceneDetails/Scene.tsx` - Plumbs Multi-Segment Loop API to the Markers tab
- `ui/v2.5/src/components/Scenes/SceneDetails/SceneMarkersPanel.tsx` - Marker selection UI + "Add to Multi-Segment Loop" action
- `ui/v2.5/src/components/Scenes/SceneDetails/PrimaryTags.tsx` - Per-marker and per-card (tag) selection checkboxes

### Features

- Add unlimited segments with start/end times
- Visual markers on the player timeline showing segment positions
- Active segment highlighting during playback
- Reorder segments with drag-like up/down controls
- Select multiple segments and bulk-delete selected segments or delete everything except selected segments
- Persistent pending marker when setting start point
- Segment list with jump-to-segment functionality
- Total duration calculation for all segments
- Playback-rate-aware precise boundary scheduling for multi-segment ends and negative-marker starts
- Millisecond-scale rounding tolerance without the former 100 ms early cut
- Direct skipping across overlapping or adjacent negative-marker ranges

### Test Cases Added

- `ui/v2.5/tests/multiSegmentSelection_custom.test.ts` - Verifies selected and unselected segment ID deletion lists for the bulk actions
- `ui/v2.5/tests/playbackBoundary_custom.test.ts` - Verifies exact delay calculation at multiple playback rates, narrow clock-rounding tolerance, range merging, and end-exclusive negative ranges

### Configuration Dependencies

- `configuration.ui.showMultiSegmentLoopControls` - Boolean to enable the feature

---

## 14. Marker Playlist Player

### Overview

A dedicated player page that allows you to select multiple markers from the Markers page (`/scenes/markers`) and play them sequentially in a loop. This works across different scenes - the player automatically loads each scene's video and seeks to the marker position. A second hidden video slot preloads and seeks to the next marker that requires a scene change, then becomes active at the boundary to avoid paying source startup time between markers. Playlist items use generated marker screenshots (with the WebP preview as a fallback), and the active item scrolls into view as playback advances. Replay and O-record controls are visible in both normal and fullscreen playback; O records the active video's exact timestamp against the marker's scene and confirms success with a timestamped toast. The fullscreen confirmation renders inside the fullscreen player, and scene-page O actions use the same confirmation message.

### Marker Playback Queue

You can now build a queue of markers from different searches before playing them:

1. Go to the Markers page (`/scenes/markers`)
2. Enable selection mode and select markers
3. Click the **"Add to Queue"** button (appears when markers are selected)
4. Perform different searches and add more markers to the queue
5. The queue indicator shows the count of queued markers
6. Click the **Play** button on the queue indicator to play all queued markers
7. Click the **Clear** button to empty the queue

The queue is in-memory only and is cleared when leaving the marker list.

### Usage (Direct Play)

1. Go to the Markers page (`/scenes/markers`)
2. Enable selection mode by clicking the checkbox icon
3. Select the markers you want to include in your playlist
4. Click the "Play Selected" button (appears when markers are selected)
5. A new player page opens with all selected markers in a playlist
6. Markers play in order, automatically advancing to the next when one ends
7. Use the loop toggle to continuously loop through all markers
8. The playlist sidebar shows all markers with clickable entries to jump to any marker

### Files Created

- `ui/v2.5/src/components/Scenes/MarkerPlaylistPlayer.tsx` - Main React component for the playlist player
- `ui/v2.5/src/components/Scenes/MarkerPlaylistPlayer.scss` - Styles for the playlist player UI
- `ui/v2.5/src/components/Scenes/markerPlaylistPreload_custom.ts` - Source-change preload selection and matching helpers
- `ui/v2.5/src/components/Scenes/markerPlaylistLoop_custom.ts` - Single-marker loop toggle helper shared by the sidebar and fullscreen overlay
- `ui/v2.5/src/components/Scenes/markerPlaylistORecord_custom.ts` - Validates the active marker scene and exact video timestamp before recording an O
- `ui/v2.5/src/components/Scenes/oRecordToast_custom.ts` - Formats the shared scene and marker-player O-record confirmation
- `ui/v2.5/src/components/Scenes/SceneDetails/sceneOHotkeyPreference_custom.ts` - Resolves the persisted scene O shortcut preference with an enabled-by-default fallback
- `ui/v2.5/src/components/Scenes/markerPlaylistPresentation_custom.ts` - Screenshot selection and active-playlist-item scrolling helpers
- `ui/v2.5/src/components/Scenes/MarkerQueueIndicator.tsx` - Queue indicator component showing count and controls
- `ui/v2.5/src/hooks/MarkerQueue.tsx` - React context for managing the marker playback queue

### Files Modified

- `ui/v2.5/src/App.tsx` - Added `MarkerQueueProvider` to the provider hierarchy
- `ui/v2.5/src/components/Scenes/Scenes.tsx` - Added route for `/scenes/markers/player`
- `ui/v2.5/src/components/Scenes/SceneMarkerList.tsx` - Added "Add to Queue" and "Play Selected" operation buttons, integrated queue indicator
- `ui/v2.5/src/components/Scenes/styles.scss` - Styling for the queue indicator
- `ui/v2.5/src/locales/en-GB.json` - Locale strings for queue actions
- `ui/v2.5/src/locales/en-US.json` - Locale strings for queue actions

### Features

- Select any number of markers from the markers list
- Cross-scene playback - automatically loads the correct video for each marker
- Double-buffered cross-scene playback that warms and seeks the next required source in advance
- Same-scene markers reuse the active video, while preload selection skips ahead to the next actual source change
- Automatic advancement from one marker to the next
- Loop mode to continuously play all markers
- Previous/Next navigation controls
- Replay and O-record controls in both normal and fullscreen playback
- Fullscreen-visible O-record confirmation plus the same toast on scene-page O actions
- Custom Settings toggle to disable only the scene-page `O` keyboard shortcut
- Playlist sidebar with all markers listed
- Click any marker in the sidebar to jump to it
- Duration display for total playlist time
- "Now Playing" indicator showing current marker
- Displays marker-assigned performers (when present)

### Test Cases Added

- `ui/v2.5/tests/markerPlaylistPreload_custom.test.ts` - Verifies same-scene skipping, loop wraparound, non-looping behavior, single-marker loops, and exact warmed-marker matching
- `ui/v2.5/tests/markerPlaylistLoop_custom.test.ts` - Verifies enabling, disabling, and switching the single-marker loop target
- `ui/v2.5/tests/markerPlaylistORecord_custom.test.ts` - Verifies O records use the active marker scene and exact non-negative video time
- `ui/v2.5/tests/oRecordToast_custom.test.ts` - Verifies recorded-O confirmation messages
- `ui/v2.5/tests/sceneOHotkeyPreference_custom.test.ts` - Verifies the O shortcut stays enabled by default and respects the disable preference
- `ui/v2.5/tests/markerPlaylistPresentation_custom.test.ts` - Verifies generated screenshots take precedence over WebP previews and active items receive the correct visibility scroll behavior

### URL Parameters

- `/scenes/markers/player?ids=1,2,3` - Comma-separated list of marker IDs to play

---

## Marker Viewer

A multi-panel viewer for scene markers, accessible from the Markers page (`/scenes/markers`). Separate from the sequential marker playlist player, the viewer displays all queued markers **simultaneously** in independent, draggable and resizable video panels on a black canvas.

### Usage

1. Go to the Markers page (`/scenes/markers`)
2. Enable selection mode by clicking the checkbox icon
3. Select the markers you want to view
4. Click the **+** (Add to Queue) button in the queue toolbar to add them
5. Click the **grid icon** (Open Viewer, `faThLarge`) button to open the viewer in a new tab
6. All queued markers play simultaneously as floating video panels
7. Drag panels by their title bar to reposition them
8. Resize panels by dragging the bottom-right or top-left corner handles
9. Close individual panels with the **×** button in each title bar
10. Click the fullscreen button in the header to go fullscreen

### Supported Actions

- **Move** – drag the title bar
- **Resize** – drag the SE (bottom-right) or NW (top-left) resize handles
- **Close individual panel** – × button in title bar
- **Fullscreen** – header button

### Active Implementation

- `ui/v2.5/src/components/Viewers/UnifiedViewer.tsx` - Unified scene, marker, and image viewer used by the viewer routes
- `ui/v2.5/src/components/Scenes/MultiVideoViewer.tsx` - Shared multi-panel canvas used by the unified viewer
- `ui/v2.5/src/components/Scenes/MarkerViewer.scss` - Styles for the viewer

### Files Modified

- `ui/v2.5/src/components/Scenes/MarkerQueueIndicator.tsx` - Added "Open Viewer" (`faThLarge`) button
- `ui/v2.5/src/components/Scenes/Scenes.tsx` - Added route for `/scenes/markers/viewer`
- `ui/v2.5/src/locales/en-US.json` - Added `actions.open_viewer` locale string
- `ui/v2.5/src/locales/en-GB.json` - Added `actions.open_viewer` locale string

### URL Parameters

- `/scenes/markers/viewer?ids=1,2,3` - Comma-separated list of marker IDs to display

### Data Loading

The viewer reads marker IDs from the `ids` URL parameter and fetches marker data directly.

---

## Multi Scene Viewer

A multi-panel viewer for full scenes, accessible from the Scenes page (`/scenes`). It shares the marker viewer's video panel behavior: scenes open simultaneously as draggable, resizable, looping video panels on a black canvas with fullscreen and reflow controls. Scene panels use the same custom Video.js controls as the scene player, including source selection, seek controls, VTT thumbnails, captions, scene marker/negative marker/O timestamp timeline indicators, and multi-segment loop controls. Performer image overlay controls are intentionally excluded from this viewer.

### Usage

1. Go to the Scenes page (`/scenes`)
2. Select scenes
3. Click the **+** button in the viewer queue toolbar
4. Click the **grid icon** button to open `/scenes/viewer?ids=1,2,3`
5. Drag, resize, close, fullscreen, and reflow panels as in the marker viewer

### Active Implementation

- `ui/v2.5/src/components/Scenes/MultiVideoViewer.tsx` - Shared video panel viewer used by marker and scene viewers
- `ui/v2.5/src/components/Viewers/UnifiedViewer.tsx` - Scene data adapter and route target shared with marker and image viewing
- `ui/v2.5/src/components/Scenes/SceneViewerQueueIndicator.tsx` - Scenes toolbar queue controls
- `ui/v2.5/src/hooks/SceneViewerQueue.tsx` - In-memory scene viewer queue context

### Files Modified

- `ui/v2.5/src/App.tsx` - Added `SceneViewerQueueProvider`
- `ui/v2.5/src/components/Scenes/Scenes.tsx` - Added route for `/scenes/viewer`
- `ui/v2.5/src/components/Scenes/SceneList.tsx` - Added scene viewer queue controls to the scenes toolbar
- `ui/v2.5/src/components/Scenes/Scenes.tsx` - Routes scene and marker viewer URLs to the unified viewer

### Data Loading

The viewer reads scene IDs from the `ids` URL parameter and fetches scene data directly. No session storage is used.

---

## 15. Scene Marker Performers

### Overview

Adds the ability to associate one or more performers with individual scene markers, with **top/bottom distinction**. This allows tagging which performers are featured in specific moments/activities within a scene, and whether they are the top (giving) or bottom (receiving) in that activity.

### Database Schema

**File:** `scene_marker_performers.sql` (original standalone SQL at repo root)

**File:** `scene_marker_performers_top_bottom.sql` (migration for top/bottom)

```sql
-- New schema with role column
CREATE TABLE IF NOT EXISTS `scene_marker_performers` (
  `scene_marker_id` integer NOT NULL,
  `performer_id` integer NOT NULL,
  `role` text NOT NULL DEFAULT 'top' CHECK (`role` IN ('top', 'bottom')),
  FOREIGN KEY (`scene_marker_id`) REFERENCES `scene_markers` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`performer_id`) REFERENCES `performers` (`id`) ON DELETE CASCADE
);
CREATE UNIQUE INDEX `idx_scene_marker_performers_unique` ON `scene_marker_performers` (`scene_marker_id`, `performer_id`, `role`);
CREATE INDEX `idx_scene_marker_performers_performer` ON `scene_marker_performers` (`performer_id`);
CREATE INDEX `idx_scene_marker_performers_marker` ON `scene_marker_performers` (`scene_marker_id`);
CREATE INDEX `idx_scene_marker_performers_role` ON `scene_marker_performers` (`role`);
CREATE INDEX `idx_scene_marker_performers_performer_role` ON `scene_marker_performers` (`performer_id`, `role`);
```

### GraphQL Schema Extensions

**File:** `graphql/schema/types/scene-marker.graphql`

- Added `top_performers: [Performer!]!` resolver on `SceneMarker` type (performers in the top/giving role)
- Added `bottom_performers: [Performer!]!` resolver on `SceneMarker` type (performers in the bottom/receiving role)
- Deprecated `performers: [Performer!]!` (returns all performers regardless of role)
- Added `top_performer_ids: [ID!]` to `SceneMarkerCreateInput` and `SceneMarkerUpdateInput`
- Added `bottom_performer_ids: [ID!]` to `SceneMarkerCreateInput` and `SceneMarkerUpdateInput`
- Deprecated `performer_ids` (kept for backward compatibility, treated as top performers)

**File:** `graphql/schema/types/filters.graphql`

- Added `SceneMarkerTagGroupInput` input type for extended scene marker tag filtering with performer attributes
- Added `groups_extended: [SceneMarkerTagGroupInput!]` to `SceneMarkerTagsCriterionInput`
- Added `groups_extended_exclude: [SceneMarkerTagGroupInput!]` to `SceneMarkerTagsCriterionInput` for exclusion groups with full performer criteria
- Added `exclude_modifier: CriterionModifier` to `SceneMarkerTagsCriterionInput` for controlling exclusion logic (INCLUDES_ALL = all groups must match, INCLUDES = any match excludes)
- Added marker performer filters to `SceneMarkerFilterType`:
  - `marker_performers: MultiCriterionInput` - Filter by performers assigned directly to the marker (both top and bottom)
  - `marker_performer_ethnicity: StringCriterionInput` - Filter by marker performer ethnicity
  - `marker_performer_country: StringCriterionInput` - Filter by marker performer country
  - `marker_performer_rating: IntCriterionInput` - Filter by marker performer rating
  - `marker_performer_rating_all: Boolean` - Whether all marker performers must satisfy rating condition

### Backend Files

- `pkg/models/repository_scene_marker.go` - Added `UpdatePerformers`, `UpdateTopPerformers`, `UpdateBottomPerformers` methods to `SceneMarkerUpdater` interface
- `pkg/models/repository_performer.go` - Added `FindBySceneMarkerID`, `FindBySceneMarkerIDWithRole` methods to `PerformerFinder` interface
- `pkg/models/scene_marker.go` - Added `MarkerPerformers`, `MarkerPerformerEthnicity`, `MarkerPerformerCountry`, `MarkerPerformerRating`, `MarkerPerformerRatingAll` fields
- `pkg/models/filter.go` - Added `SceneMarkerTagGroupInput` struct with performer attributes
- `pkg/sqlite/scene_marker.go` - Implemented `UpdatePerformers`, `UpdateTopPerformers`, `UpdateBottomPerformers` with role column handling
- `pkg/sqlite/performer.go` - Implemented `FindBySceneMarkerID`, `FindBySceneMarkerIDWithRole` with goqu subquery and role filter
- `pkg/sqlite/scene_marker_filter.go` - Added handler methods for marker performer filters
- `pkg/sqlite/criterion_handlers.go` - Extended `joinedSceneMarkerTagsHandler` to support `GroupsExtended` with performer attributes
- `internal/api/resolver_model_scene_marker.go` - Added `Performers`, `TopPerformers`, `BottomPerformers` resolver methods
- `internal/api/resolver_mutation_scene.go` - Updated `SceneMarkerCreate` and `SceneMarkerUpdate` mutations for top/bottom

### Frontend Files

- `ui/v2.5/graphql/data/scene-marker.graphql` - Added `top_performers` and `bottom_performers` to SceneMarkerData fragment
- `ui/v2.5/src/components/Scenes/SceneDetails/SceneMarkerForm.tsx` - Two separate performer dropdowns with arrow icons: Top (↑ blue) and Bottom (↓ green)
- `ui/v2.5/src/components/Scenes/SceneDetails/PrimaryTags.tsx` - Displays top/bottom performers with color-coded badges and icons
- `ui/v2.5/src/components/Scenes/MarkerPlaylistPlayer.tsx` - Shows top/bottom performers with icons in the playlist player, including hover profile images in both normal and fullscreen modes
- `ui/v2.5/src/components/Scenes/MultiVideoViewer.tsx` - Shows marker/scene performer chips with hover profile images in the marker viewer
- `ui/v2.5/src/index.scss` - Shared larger performer image hover layout allowing three performers per row
- `ui/v2.5/src/models/list-filter/criteria/scene-markers.ts` - Scene marker criteria with grouped marker configs, overlap search, and performer attributes
- `ui/v2.5/src/models/list-filter/criteria/scene-markers-exclude.ts` - Scene marker exclusion criteria with the same grouped marker config model
- `ui/v2.5/src/models/list-filter/criteria/marker-performers.ts` - Markers page criteria with grouped marker configs, overlap search, and performer attributes
- `ui/v2.5/src/components/List/Filters/SceneMarkersFilter.tsx`, `SceneMarkersExcludeFilter.tsx`, `MarkerPerformersFilter.tsx` - Enhanced filter UIs with performer, country, ethnicity, rating, subtags, unnamed performers, and overlap controls
- `ui/v2.5/src/models/list-filter/scene-markers.ts` - Added marker performer filter criterion options
- `ui/v2.5/src/components/Performers/PerformerDetails/PerformerMarkersPanel.tsx` - NEW: Performer details panel reusing the Markers list, filtered by markers directly assigned to the performer
- `ui/v2.5/src/components/Performers/PerformerDetails/Performer.tsx` - Added a "Markers" tab to performer details and marker count query
- `ui/v2.5/src/locales/en-GB.json` - Added translations for top_performers, bottom_performers

### Features

- **Top/Bottom Distinction**: Each marker performer can be tagged as either top (giving) or bottom (receiving)
- Select one or more performers from the scene's performers when creating/editing a marker
- UI shows arrow-up (↑ blue) icon for tops and arrow-down (↓ green) icon for bottoms
- Performers are displayed with role indicators in:
  - Scene marker form (editing)
  - PrimaryTags panel (scene details Markers tab)
  - MarkerPlaylistPlayer (playing markers)
- Marker player and marker viewer role chips show larger performer profile images on hover and the marker player chips hide after idle in both normal and fullscreen modes
- **Scene Marker filters (on Scenes and Markers)**: Now support separate role-specific attribute blocks for top, bottom, and both-roles (performer appearing in BOTH roles). Each block can specify performer IDs, ethnicities, countries, and rating. This supersedes the retired `performer_scene_tags` filter.
- **Marker Performer Filters (on Markers page)**: New filters to find markers by their assigned performers (both roles):
  - Marker Performers - Filter by specific performers assigned to markers
  - Marker Performer Country - Filter by country of marker performers
  - Marker Performer Ethnicity - Filter by ethnicity of marker performers
  - Marker Performer Rating - Filter by rating of marker performers
- The Markers page tag matching treats a marker as inheriting tags from same-scene sources of equal or greater duration whose overlap covers at least 50% of the receiving marker's duration, while preserving direct primary/secondary tag matching. The calculation is directional: a shorter marker can inherit from a longer marker, but a wider marker never inherits from a narrower source inside it. Returned marker rows must directly have at least one requested tag, and overlapping matches collapse to the shortest qualifying marker.
- **Performer "Markers" Tab**: New performer details tab that shows only markers linked directly to the performer via `scene_marker_performers`
- Full CRUD support for marker performers with backward compatibility

---

## 16. Studio Filter for Markers

### Overview

Adds a Studio filter criterion to the Scene Markers filter page, allowing filtering of markers by the studio of their parent scene. Supports hierarchical studio matching (includes sub-studios).

### GraphQL Schema Extensions

**File:** `graphql/schema/types/scene-marker.graphql`

- Added `studios: HierarchicalMultiCriterionInput` to `SceneMarkerFilterType`

### Backend Files

- `pkg/models/scene_marker.go` - Added `Studios` field to `SceneMarkerFilterType` struct
- `pkg/sqlite/scene_marker_filter.go` - Added `studiosCriterionHandler` using hierarchical multi-criterion handler

### Frontend Files

- `ui/v2.5/src/models/list-filter/scene-markers.ts` - Added `StudiosCriterionOption` to scene markers filter criteria

### Features

- Filter markers by one or more studios
- Supports "includes all", "includes", "excludes" modifiers
- Hierarchical matching includes sub-studios of selected studios

---

## 17. Extended Custom Statistics

### Overview

Adds additional statistics used by the custom stats pages: estimated liters (from orgasms), total penis meters (sum of performer penis lengths), total orgasm time, total facial time, total fucking time, and total sucking pito time. The scene totals are displayed on `/scenestats`; estimated liters and total penis meters remain vato summary cards on `/vatostats`. O-date records and O marker-tag analytics are shown on the hidden `/ostats` page.

### GraphQL Schema Extensions

**File:** `graphql/schema/types/stats.graphql`

```graphql
extend type Query {
  estimatedLiters: Float!
  totalPenisMeters: Float!
  totalOrgasmTime: Float!
  totalFacialTime: Float!
  totalSexTime: Float!
  totalOralTime: Float!
  mostOsInDay: SceneODayStat
  longestPeriodWithoutO: SceneODrySpell
  sceneOCountsByTag: [SceneOCountByTag!]!
}
```

### Backend Implementation

**Files:** `internal/api/resolver_custom.go`, `internal/api/scene_stats_activity_time_custom.go`

- `EstimatedLiters` resolver: Uses `SceneOrgasmCount` (one event per top on an orgasm marker, with a minimum of one) and multiplies by 3ml (0.003L)
- `TotalPenisMeters` resolver: Sums performer penis lengths (defaulting to 17cm when null), converts to meters
- `TotalOrgasmTime` resolver: Sums duration of all orgasm markers (uses end_seconds - seconds, or 20s default if no end time)
- `TotalFacialTime` resolver: Sums duration of all facial markers (uses end_seconds - seconds, or 20s default if no end time)
- `TotalSexTime` resolver: Merges overlapping completed sex activity ranges per scene, clips them to video duration, and sums the resulting coverage without performer weighting
- `TotalOralTime` resolver: Merges overlapping completed oral activity ranges per scene, clips them to video duration, and sums the resulting coverage without performer weighting

### Frontend Files

- `ui/v2.5/src/components/SceneStats/SceneStats.tsx` - Displays total orgasm/facial counts and total orgasm/facial/sex/oral time; only the count cards have marker drilldown links
- `ui/v2.5/src/components/VatoStats/VatoStats.tsx` - Displays estimated liters and total penis meters as vato summary cards

### Features

- **Estimated Liters**: Calculates total orgasms (one event per top on each matching marker, with a minimum of one) × 3ml converted to liters, displayed with 2 decimal places
- **Total Penis Meters**: Sums all performer penis lengths (uses 17cm default), displays in meters with 🍆 emoji
- **Total Orgasm Time**: Sum of all orgasm marker durations (end_seconds - seconds), using 20s default when no end timestamp
- **Total Facial Time**: Sum of all facial marker durations (end_seconds - seconds), using 20s default when no end timestamp
- **Total Fucking Time**: Overlap-merged, video-bounded coverage of completed markers whose primary tag is the configured sex activity tag; markers without a valid end timestamp are excluded and performers do not multiply the duration
- **Total Sucking Pito Time**: Overlap-merged, video-bounded coverage of completed markers whose primary tag is the configured oral activity tag; markers without a valid end timestamp are excluded and performers do not multiply the duration
- **Clickable Total Orgasms**: Links to Markers page filtered by orgasm tag (using configured orgasmTagId)
- **Clickable Total Facials**: Links to Markers page filtered by facial tag (using configured facialTagId)

### Tests

- `internal/api/scene_stats_activity_time_custom_test.go` - Verifies sex/oral totals, completed-range validation, exact activity-tag matching, overlap merging, video-bound clipping, scene isolation, and performer-independent durations

---

## 18. Performer Studios Tab

### Overview

Adds a new "Studios" tab to the Performer detail page, showing all studios that the performer has scenes with.

### Files Created

- `ui/v2.5/src/components/Performers/PerformerDetails/PerformerStudiosPanel.tsx` - NEW: React component rendering StudioList with performer scene filter

### Files Modified

- `ui/v2.5/src/components/Performers/PerformerDetails/Performer.tsx` - Added "studios" to valid tabs array, imported PerformerStudiosPanel, added Studios tab rendering

### Features

- New tab on performer pages showing studios from their scenes
- Uses existing StudioList component with a filter hook for the performer's scenes
- Clicking on a studio navigates to the studio page

---

## 18. Marker Tags Filter for Performers

### Overview

Adds a new "Marker Tags" filter to the Performers page that allows filtering performers based on scene marker tags. This filter finds performers who have at least one scene marker with all the selected tags.

### GraphQL Schema Extensions

**File:** `graphql/schema/types/filters.graphql`

- Added `marker_tags: HierarchicalMultiCriterionInput` to `PerformerFilterType`

### Backend Files

- `pkg/models/performer.go` - Added `MarkerTags` field to `PerformerFilterType` struct
- `pkg/sqlite/performer_filter.go` - Added `markerTagsCriterionHandler` method implementing the SQL query logic

### Frontend Files

- `ui/v2.5/src/models/list-filter/criteria/tags.ts` - Added `MarkerTagsCriterionOption` criterion
- `ui/v2.5/src/models/list-filter/performers.ts` - Registered `MarkerTagsCriterionOption` in performer filter options
- `ui/v2.5/src/locales/en-GB.json` - Added "Marker Tags" translation

### Features

- Filter performers by scene marker tags using hierarchical tag matching
- Supports multiple filter modifiers:
  - **Includes All**: Performers with at least one marker containing all selected tags
  - **Includes**: Performers with at least one marker containing any of the selected tags
  - **Equals**: Performers with at least one marker containing exactly the selected tags (no more, no less)
  - **Excludes**: Performers without any markers containing the selected tags
  - **Is Null / Not Null**: Performers without/with any scene markers with tags
- Supports hierarchical tag matching (parent/child tag relationships)
- Query logic uses EXISTS subqueries joining performers → performers_scenes → scenes → scene_markers → scene_markers_tags

### Database Query Structure

The filter traverses the relationship:

```
performers
  → performers_scenes (join by performer_id)
    → scenes (join by scene_id)
      → scene_markers (join by scene_id)
        → scene_markers_tags (join by scene_marker_id)
```

Then checks if the marker has all/any/exactly the specified tags based on the modifier.

---

## 19. Performer-Filtered Studio Cards

### Overview

When viewing studios from a performer's Studios tab, the studio cards now hide category stat buttons (sex/oral/solo/facial/unique performers) since those stats represent studio-wide totals and are not filtered by the current performer.

### Files Modified

- `ui/v2.5/src/components/Studios/StudioCard.tsx` - Added `performerId` prop, conditionally hide category buttons when prop is present
- `ui/v2.5/src/components/Studios/StudioCardGrid.tsx` - Pass `performerId` prop through to cards
- `ui/v2.5/src/components/Studios/StudioList.tsx` - Accept and pass `performerId` prop
- `ui/v2.5/src/components/Performers/PerformerDetails/PerformerStudiosPanel.tsx` - Pass `performer.id` to StudioList
- `ui/v2.5/src/components/Scenes/SceneDetails/SceneMarkerForm.tsx` - Fixed localization key for marker performers select

### Features

- Category stat buttons (sex, oral, solo, facial, unique performers) are hidden when viewing from performer's studios tab
- Basic scene count button still displayed (links to studio scenes page)
- Prevents confusion from showing incorrect/unfiltered statistics
- Fixed missing localization for "Select Performers" placeholder in marker form

---

## 20. Performer Marker Filters

### Overview

Provides unified include and exclude filters for searching performers by scene-marker tags, performer role/attributes, and partner role/attributes.

### Files Created/Modified

**Criterion and component files:**

- `ui/v2.5/src/models/list-filter/criteria/performer-markers.ts`
- `ui/v2.5/src/models/list-filter/criteria/performer-markers-exclude.ts`
- `ui/v2.5/src/components/List/Filters/PerformerMarkersFilter.tsx`
- `ui/v2.5/src/components/List/Filters/PerformerMarkersExcludeFilter.tsx`

**Modified Files:**

- `ui/v2.5/src/models/list-filter/performers.ts` - Registers the unified include and exclude criteria
- `ui/v2.5/src/models/list-filter/types.ts` - Registers `performer_markers` and its exclude counterpart
- `ui/v2.5/src/components/List/CriterionEditor.tsx` - Renders both filter editors

### Features

- Select marker tags and hierarchy depth.
- Match the performer or partner by ID, ethnicity, country, rating, and top/bottom role.
- Use the include filter to require matching participation and the exclude filter to remove matching performers.

### GraphQL Schema

The earlier `PerformerMarkerTagsCriterionInput` and `PerformerMarkerPartnersCriterionInput` fields remain available for GraphQL compatibility, but the in-repo UI now uses the unified performer-marker criteria above.

```graphql
input PerformerMarkerTagsCriterionInput {
  "Tag IDs to match on markers"
  tag_ids: [ID!]!
  "Performer's role on the marker: 'top', 'bottom', or 'any' (default: 'any')"
  role: String
  "Depth for hierarchical tags"
  depth: Int
  "Modifier for the filter"
  modifier: CriterionModifier!
}

input PerformerMarkerPartnersCriterionInput {
  "Partner's ethnicities to filter by (OR match)"
  partner_ethnicities: [String!]
  "Partner's countries to filter by (OR match)"
  partner_countries: [String!]
  "Partner's rating criterion"
  partner_rating: IntCriterionInput
  "Partner's role: 'top', 'bottom', or 'any' (default: 'any')"
  partner_role: String
  "Modifier for the filter"
  modifier: CriterionModifier!
}
```

---

## 21. Marker Playlist Save/Load

### Overview

Allows users to save and load marker playlists for later viewing. When viewing a marker playlist, users can save the current configuration (marker IDs and order) with a custom name and reload it later.

### Database Schema

**File:** `marker_playlists.up.sql`

```sql
CREATE TABLE IF NOT EXISTS marker_playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  marker_ids TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_marker_playlists_name
  ON marker_playlists(name);
```

### GraphQL Schema Extensions

**File:** `graphql/schema/types/marker-playlist_custom.graphql`

```graphql
type MarkerPlaylist {
  id: ID!
  name: String!
  marker_ids: [ID!]!
  created_at: Time!
  updated_at: Time!
}

input MarkerPlaylistCreateInput {
  name: String!
  marker_ids: [ID!]!
}

input MarkerPlaylistUpdateInput {
  id: ID!
  name: String
  marker_ids: [ID!]
}
```

**File:** `graphql/schema/schema.graphql`

```graphql
# Query additions
findMarkerPlaylist(id: ID!): MarkerPlaylist
findMarkerPlaylists: [MarkerPlaylist!]!

# Mutation additions
markerPlaylistCreate(input: MarkerPlaylistCreateInput!): MarkerPlaylist!
markerPlaylistUpdate(input: MarkerPlaylistUpdateInput!): MarkerPlaylist!
markerPlaylistDestroy(id: ID!): Boolean!
```

### UI Components

**Files Modified:**

- `ui/v2.5/src/components/Scenes/MarkerPlaylistPlayer.tsx`
- `ui/v2.5/src/components/Scenes/MarkerPlaylistPlayer.scss`
- `ui/v2.5/src/core/StashService.ts`

**Features:**

- Save button in player header to save current playlist
- Load dropdown showing all saved playlists
- Delete button (✕) next to each saved playlist
- Modal for entering playlist name when saving
- Toast notifications for success/error states

### Usage

1. Navigate to marker playlist player (`/scenes/markers/player?ids=X,Y,Z`)
2. Click "Save" button in header
3. Enter a name for the playlist
4. Click "Load" dropdown to see all saved playlists
5. Click on a playlist name to load it
6. Click ✕ next to a playlist to delete it

---

## 21. Multiple Performer Images

### Overview

Allows performers to have multiple images in addition to their main image. Users can upload additional images, set any image as the default, and remove images. Only visible on the performer detail page with hover-activated controls.

### Database Schema

**Migration File:** `pkg/sqlite/migrations/76_performer_additional_images.up.sql`

```sql
CREATE TABLE `performer_images` (
    `id` integer NOT NULL PRIMARY KEY AUTOINCREMENT,
    `performer_id` integer NOT NULL,
    `image_blob` varchar(255) NOT NULL REFERENCES `blobs`(`checksum`),
    `position` integer NOT NULL DEFAULT 0,
    FOREIGN KEY (`performer_id`) REFERENCES `performers`(`id`) ON DELETE CASCADE
);
```

### GraphQL Schema Extensions

**Files Modified:**

- `graphql/schema/types/performer.graphql`
- `graphql/schema/schema.graphql`

**New Types:**

```graphql
type PerformerImage {
  id: ID!
  performer_id: ID!
  image_path: String!
  position: Int!
}

type Performer {
  # ... existing fields ...
  additional_images: [PerformerImage!]!
}
```

**New Mutations:**

```graphql
"Upload an additional image for a performer. Returns the new PerformerImage."
performerImageUpload(performer_id: ID!, image: String!): PerformerImage!

Notes:
- Duplicate uploads (same underlying blob checksum for the same performer) are rejected with a GraphQL error code `DUPLICATE_PERFORMER_IMAGE`. The UI continues uploading the remaining files and shows a summary of uploaded vs skipped duplicates.

"Delete an additional performer image by ID. Returns true if successful."
performerImageDelete(id: ID!): Boolean!

"Set an additional image as the default performer image. Returns the updated Performer."
performerImageSetDefault(id: ID!): Performer!
```

### Backend Implementation

**Files Created:**

- `pkg/models/model_performer_image.go` - PerformerImage model and interfaces
- `pkg/sqlite/performer_image.go` - Database operations for performer images

**Files Modified:**

- `pkg/sqlite/database.go` - Added PerformerImageStore initialization
- `pkg/models/repository.go` - Added PerformerImage and Blobs to Repository struct
- `internal/api/resolver_model_performer.go` - Added AdditionalImages resolver
- `internal/api/resolver_model_performer_image.go` - PerformerImage resolvers
- `internal/api/resolver_mutation_performer.go` - Image upload/delete/set-default mutations
- `internal/api/urlbuilders/performer.go` - Added PerformerImageURLBuilder
- `internal/api/routes_performer.go` - Added HTTP route for serving additional images
- `internal/api/server.go` - Wired up performer image dependencies
- `internal/api/resolver.go` - Added performerImageResolver
- `internal/api/routes_performer.go` - Added HTTP route for serving additional images
- `internal/api/server.go` - Wired up performer image dependencies

### UI Components

**Files Created:**

- `ui/v2.5/src/components/Performers/PerformerDetails/PerformerImageManager.tsx` - Image manager component with upload/delete/set-default controls
- `ui/v2.5/src/components/Performers/PerformerDetails/PerformerImageManager.scss` - Styles for image manager overlay controls

**Files Modified:**

- `ui/v2.5/src/components/Performers/PerformerDetails/Performer.tsx` - Integrated PerformerImageManager
- `ui/v2.5/graphql/data/performer.graphql` - Added additional_images field to PerformerData fragment

### Configuration Dependencies

None - uses existing blob storage system.

### Usage

1. Navigate to a performer detail page
2. Hover over the performer image to reveal buttons
3. Click "Upload Image" to add a new image (appears in carousel)
4. Click "Remove" to delete the currently displayed image
5. Click "Make Default" to set the current image as the main performer image
6. The main `performers.image_blob` field remains unchanged for backward compatibility
7. Additional images are stored separately in `performer_images` table

### Notes

- The default performer image (stored in `performers.image_blob`) continues to be displayed everywhere else in the app
- Additional images are only visible on the performer detail page
- When an additional image is set as default, the old default is moved to additional images
- Image controls are only visible on hover and only on the performer detail page

---

## 22. Performer Filter: Profile Image Count

### Overview

Adds a Performers list filter criterion for the count of _profile images_ (the default performer image plus any additional performer images).

This is intentionally separate from the existing `image_count` (which refers to “images the performer belongs to” via normal Stash relationships).

### Count Definition

For a performer row `performers.id`, the filter uses:

```
profile_image_count = (performers.image_blob IS NULL ? 0 : 1)
                    + COUNT(performer_images WHERE performer_id = performers.id)
```

### GraphQL Schema Extensions

**File Modified:** `graphql/schema/types/filters.graphql`

- Added `profile_image_count: IntCriterionInput` to `PerformerFilterType`

### Backend Implementation

**Files Modified:**

- `pkg/sqlite/performer_filter.go` - added `profileImageCountCriterionHandler`
- `pkg/models/performer.go` - added `ProfileImageCount` on `PerformerFilterType`

### Inclusive Comparator Support (>= / <=)

To support the requested inclusive comparisons, two new criterion modifiers were added:

- `GREATER_THAN_EQUALS` (>=)
- `LESS_THAN_EQUALS` (<=)

**Files Modified:**

- `graphql/schema/types/filters.graphql` - added the enum values
- `pkg/models/filter.go` - added new `CriterionModifier*Equals` constants + validation
- `pkg/sqlite/sql.go` - added `>=` and `<=` numeric where-clause generation

### UI Components

**Files Created:**

- `ui/v2.5/src/models/list-filter/criteria/profile-image-count.ts`

**Files Modified:**

- `ui/v2.5/src/models/list-filter/types.ts` - added `profile_image_count` criterion type
- `ui/v2.5/src/models/list-filter/performers.ts` - registered the criterion option
- `ui/v2.5/src/models/list-filter/criteria/criterion.ts` - added modifier label mappings
- `ui/v2.5/src/components/List/Filters/NumberFilter.tsx` - renders inputs for `>=` / `<=`
- `ui/v2.5/src/components/List/Filters/DateFilter.tsx`
- `ui/v2.5/src/components/List/Filters/TimestampFilter.tsx`
- `ui/v2.5/src/components/List/Filters/DurationFilter.tsx`
- `ui/v2.5/src/components/List/Filters/RatingFilter.tsx`
- `ui/v2.5/src/components/List/Filters/SidebarAgeFilter.tsx`
- `ui/v2.5/src/components/List/Filters/SidebarDurationFilter.tsx`
- `ui/v2.5/src/locales/en-GB.json` and `ui/v2.5/src/locales/en-US.json` - added label strings

---

## 23. Performer Partner Count Badges

### Overview

Adds partner count badges to performer cards and detail pages (outside scene context) showing the number of unique performers they've topped/bottomed for in each role category (sex, oral, facial). These appear as a second row below the existing scene count badges, with a person icon to differentiate them from scene counts.

### GraphQL Schema Extensions

**File Modified:** `graphql/schema/types/performer.graphql`

- Added `sex_with_top_count: Int!` - Count of unique performers this performer has topped sexually
- Added `sex_with_bottom_count: Int!` - Count of unique performers this performer has bottomed for sexually
- Added `oral_with_top_count: Int!` - Count of unique performers this performer has topped orally
- Added `oral_with_bottom_count: Int!` - Count of unique performers this performer has bottomed for orally
- Added `facial_with_top_count: Int!` - Count of unique performers this performer has given facials to
- Added `facial_with_bottom_count: Int!` - Count of unique performers this performer has received facials from

### Backend Implementation

**Files Modified:**

- `internal/api/resolver_model_performer.go` - Added six new resolver functions:
  - `SexWithTopCount()` - Queries co-performers where this performer was top in sex scenes
  - `SexWithBottomCount()` - Queries co-performers where this performer was bottom in sex scenes
  - `OralWithTopCount()` - Queries co-performers where this performer was top in oral scenes
  - `OralWithBottomCount()` - Queries co-performers where this performer was bottom in oral scenes
  - `FacialWithTopCount()` - Queries co-performers where this performer gave facials
  - `FacialWithBottomCount()` - Queries co-performers where this performer received facials
  - `getCoPerformersWithCounts()` - Helper method copied from queryResolver to get co-performer counts

### UI Components

**Files Modified:**

- `ui/v2.5/graphql/data/performer.graphql` - Added the six partner count fields to PerformerData fragment
- `graphql/schema/types/performer_custom.graphql` and `graphql/schema/types/studio_custom.graphql` - Added facial partner count fields to the batched `PerformerRoleStats` and `StudioPerformerRoleStats` payloads used by lazy-loaded performer cards
- `ui/v2.5/src/components/Performers/performerRoleStats_custom.ts` and `ui/v2.5/graphql/queries/studio.graphql` - Request facial partner counts for home/list/studio performer cards so top/bottom chips display vato counts instead of marker counts
- `ui/v2.5/src/components/Performers/PerformerDetails/PerformerCategoryStrip.tsx` - Added partner count badges section:
  - Only shown when NOT in scene context (when sceneId is not provided)
  - Uses person icon (faUser) combined with arrow icons to indicate top/bottom
  - Smaller font size and styling to distinguish from scene count badges
  - Category icons (gay/mouth/facial) shown with reduced opacity (0.7)
  - Blue badges for "topped" counts, green badges for "bottomed for" counts
  - Partner badge hover popovers use the shared larger performer image layout

### Display Logic

- **Scene context (sceneId provided)**: Shows only scene-specific role indicators (no partner counts)
- **Non-scene context (performer cards, detail page)**: Shows both scene count badges AND partner count badges
- Partner count badges are displayed in a separate row below the scene count badges
- Each badge shows: category icon + person icon + arrow (up/down) + count

### Configuration Dependencies

- Uses existing `configuration.ui.roleTagIds` for sex/oral/facial tag IDs
- No additional configuration needed

### Usage

Partner count badges appear on:

1. Performer cards in performer list view
2. Performer detail page category strip
3. Any other non-scene contexts where performer cards are shown

The badges do NOT appear:

- In scene performer cards (scene context)
- When viewing performers within a specific scene

### Visual Design

```
[Scene Counts Row]
🍆 42 (total) ↑30 ↓12    👄 28 ↑18 ↓10    💦 15 ↑10 ↓5

[Partner Counts Row - NEW]
🍆 👤↑ 8    🍆 👤↓ 5    👄 👤↑ 12    👄 👤↓ 6    💦 👤↑ 7    💦 👤↓ 3
```

Where:

- Top row = number of scenes in each category with top/bottom breakdown
- Bottom row = number of unique partners in each category with top/bottom breakdown
- 👤 = person icon to indicate these are partner counts, not scene counts

---

## 24. Scene Releases

### Overview

Scene Releases allow a single scene to have multiple alternate versions or releases from different studios. This is common when content is licensed across multiple platforms or studios - the same scene may be released on Studio A's site first, then later on Studio B's site with different metadata, cover art, or even re-encoded video files.

Each scene can have multiple releases, and each release can have:

- Its own title, code, details, director, URL, and date
- Its own studio association
- Its own cover image
- Its own video files
- Its own associated galleries
- A playback order for prioritizing which release to play

### Database Schema

**File:** `scene_releases.up.sql`

```sql
-- Main releases table - stores release metadata
CREATE TABLE IF NOT EXISTS `scene_releases` (
    `id` integer primary key autoincrement NOT NULL,
    `scene_id` integer NOT NULL,
    `title` varchar(255),
    `code` varchar(255),
    `details` text,
    `director` varchar(255),
    `url` varchar(255),
    `date` date,
    `date_precision` tinyint,
    `studio_id` integer,
    `cover_blob` varchar(255),
    `play_order` integer NOT NULL DEFAULT 0,
    `created_at` datetime NOT NULL,
    `updated_at` datetime NOT NULL,
    FOREIGN KEY(`scene_id`) REFERENCES `scenes`(`id`) ON DELETE CASCADE,
    FOREIGN KEY(`studio_id`) REFERENCES `studios`(`id`) ON DELETE SET NULL
);

-- Files associated with releases
CREATE TABLE IF NOT EXISTS `scene_release_files` (
    `release_id` integer NOT NULL,
    `file_id` integer NOT NULL,
    `primary` boolean NOT NULL DEFAULT 0,
    PRIMARY KEY(`release_id`, `file_id`),
    FOREIGN KEY(`release_id`) REFERENCES `scene_releases`(`id`) ON DELETE CASCADE,
    FOREIGN KEY(`file_id`) REFERENCES `files`(`id`) ON DELETE CASCADE
);

-- Galleries associated with releases
CREATE TABLE IF NOT EXISTS `scene_release_galleries` (
    `release_id` integer NOT NULL,
    `gallery_id` integer NOT NULL,
    PRIMARY KEY(`release_id`, `gallery_id`),
    FOREIGN KEY(`release_id`) REFERENCES `scene_releases`(`id`) ON DELETE CASCADE,
    FOREIGN KEY(`gallery_id`) REFERENCES `galleries`(`id`) ON DELETE CASCADE
);
```

### GraphQL Schema

**File:** `graphql/schema/types/scene-release_custom.graphql`

```graphql
type SceneRelease {
  id: ID!
  scene: Scene!
  title: String
  code: String
  details: String
  director: String
  url: String
  date: String
  studio: Studio
  paths: SceneReleasePaths!
  files: [VideoFile!]!
  galleries: [Gallery!]!
  streams: [SceneStreamEndpoint!]!
  play_order: Int!
  created_at: Time!
  updated_at: Time!
}

type SceneReleasePaths {
  screenshot: String
}

input SceneReleaseCreateInput {
  scene_id: ID!
  title: String
  code: String
  details: String
  director: String
  url: String
  date: String
  studio_id: ID
  cover_image: String
  gallery_ids: [ID!]
  file_ids: [ID!]
  play_order: Int
}

input SceneReleaseUpdateInput {
  id: ID!
  title: String
  code: String
  details: String
  director: String
  url: String
  date: String
  studio_id: ID
  cover_image: String
  gallery_ids: [ID!]
  file_ids: [ID!]
  play_order: Int
  primary_file_id: ID
}

input SceneReleaseDestroyInput {
  id: ID!
}

input SceneReleaseAddFileInput {
  release_id: ID!
  file_id: ID # Mutually exclusive with file_path
  file_path: String # Mutually exclusive with file_id - path to file in filesystem
}

input SceneReleaseRemoveFileInput {
  release_id: ID!
  file_id: ID!
  delete_from_filesystem: Boolean # If true, deletes the file from disk
}

input ConvertSceneToReleaseInput {
  source_scene_id: ID!
  target_scene_id: ID!
}

input ConvertReleaseToSceneInput {
  release_id: ID!
  transfer_o_history: Boolean
  transfer_markers: Boolean
}
```

**File:** `graphql/schema/types/scene.graphql` (additions)

```graphql
type Scene {
  # ... existing fields ...
  "Alternate releases of this scene (e.g., from different studios)"
  releases: [SceneRelease!]!
}
```

### Backend Files

- `pkg/models/model_scene_release.go` - SceneRelease model definition with SceneReleaseFileHandler interface including RemoveFileID method
- `pkg/sqlite/scene_release.go` - SQLite repository for scene releases including AddFileID and RemoveFileID
- `internal/api/resolver_model_scene_release.go` - GraphQL resolvers for SceneRelease type
- `internal/api/resolver_mutation_scene_release.go` - Mutation resolvers (create, update, destroy, convert, add file by ID or path, remove file with optional filesystem deletion)

### Frontend Files

- `ui/v2.5/src/components/Scenes/SceneDetails/SceneReleasesPanel.tsx` - Main UI panel for managing releases with file add/remove modals
- `ui/v2.5/src/components/Scenes/SceneDetails/SceneSelectorDialog.tsx` - Dialog for selecting a scene to convert to release
- `ui/v2.5/graphql/data/scene-release.graphql` - GraphQL fragment for SceneRelease data
- `ui/v2.5/graphql/mutations/scene-release.graphql` - GraphQL mutations
- `ui/v2.5/src/core/StashService.ts` - React hooks for mutations

### Features

1. **Create Release**: Add a new release with custom metadata to any scene
2. **Edit Release**: Modify release metadata, cover image, files, and galleries
3. **Delete Release**: Remove a release from a scene
4. **Convert Scene to Release**: Take an existing scene and convert it into a release of another scene, preserving all metadata. Options to transfer o-history and markers from source scene to target scene.
5. **Convert Release to Scene**: Convert a release back into a standalone scene, optionally transferring o-history and markers from the parent scene. Works even if the release has no files.
6. **Add File to Release**: Add a file to a release using two methods:
   - Browse for file using folder browser (with collapsible file navigation)
   - Select from parent scene's files
   - Note: File must already be scanned into the database
7. **Remove File from Release**: Remove a file from a release with two options:
   - Remove from release only (keeps file on disk)
   - Remove and DELETE from filesystem (permanent deletion with confirmation warning)
8. **Playback Selection**: Mark a release for playback to switch the scene player to that release's files
9. **Color-coded Metadata Comparison**: Release metadata (duration, fps, resolution) is color-coded compared to the main scene (green=better, red=worse, white=same)
10. **Clickable Gallery Links**: Gallery associations link directly to the gallery page
11. **Releases sorted by date**: Releases are displayed in ascending date order (earliest first)
12. **Instant image updates**: Cover images are reflected immediately after saving without page reload

### Filter Support

- `release_count: IntCriterionInput` - Filter scenes by number of releases

---

## 25. Effective Date

### Overview

Scenes can now have an "effective date" which is computed as the earliest date among the scene's own date and all release dates. This is useful when a scene was originally released on one date by one studio, but later re-released by another studio - the effective date shows when the scene was first available.

### GraphQL Schema Changes

**File:** `graphql/schema/types/scene.graphql`

```graphql
type Scene {
  # ... existing fields ...
  "The earliest date among the scene's own date and all release dates"
  effective_date: String
}
```

**File:** `graphql/schema/types/filters.graphql`

```graphql
input SceneFilterType {
  # ... existing filters ...
  "Filter by effective date (earliest date among scene date and release dates)"
  effective_date: DateCriterionInput
}
```

### Backend Files Modified

- `internal/api/resolver_model_scene.go` - Added `EffectiveDate` resolver that computes min(scene.date, release dates)
- `pkg/models/scene.go` - Added `EffectiveDate *DateCriterionInput` to SceneFilterType
- `pkg/sqlite/scene_filter.go` - Added `effectiveDateCriterionHandler` for filtering by effective date
- `pkg/sqlite/scene.go` - Added `effective_date` to sort options and updated `performer_age` sort to use effective_date

### Frontend Files Modified

- `ui/v2.5/graphql/data/scene.graphql` - Added effective_date to SceneData fragment
- `ui/v2.5/graphql/data/scene-slim.graphql` - Added effective_date to SlimSceneData fragment
- `ui/v2.5/src/components/Scenes/SceneCard.tsx` - Display effective_date on scene cards
- `ui/v2.5/src/components/Scenes/SceneDetails/Scene.tsx` - Display effective_date in scene header
- `ui/v2.5/src/components/Scenes/SceneDetails/SceneDetailPanel.tsx` - Use effective_date for performer age calculation
- `ui/v2.5/src/components/Scenes/SceneListTable.tsx` - Display effective_date in table
- `ui/v2.5/src/components/Scenes/SceneWallPanel.tsx` - Display effective_date in wall view
- `ui/v2.5/src/components/Tagger/scenes/TaggerScene.tsx` - Display effective_date in tagger
- `ui/v2.5/src/models/list-filter/scenes.ts` - Added effective_date filter and sort options
- `ui/v2.5/src/models/list-filter/types.ts` - Added effective_date to CriterionType
- `ui/v2.5/src/locales/en-GB.json` - Added translation for "Effective Date"

### Usage

- Scene cards, detail pages, and list views automatically display the effective date
- Filter scenes by effective date in the scene list filter panel
- Sort scenes by effective date in the sort dropdown
- Performer age calculations in scene context use effective date

### Behavior

- If a scene has no releases, effective_date equals scene.date
- If a scene has releases, effective_date is the minimum of scene.date and all release.date values
- Null dates are ignored in the minimum calculation
- Falls back to scene.date if it exists and releases have no dates

---

## 26. Clickable Marker End Timestamps

### Overview

In the Scene detail page's Markers tab, both the start and end timestamps of markers are now clickable. Clicking a timestamp will seek the video player to that position, making it easy to quickly navigate to either the beginning or end of any marker.

### Use Cases

- Quickly jump to the start or end of any marker
- Review marker boundaries without manual seeking
- Efficiently navigate through long scenes with multiple markers

### Frontend Changes

**File:** `ui/v2.5/src/components/Scenes/SceneDetails/PrimaryTags.tsx`

- Replaced static timestamp text with two clickable `<Button>` elements
- Start timestamp: Seeks to marker's start position (marker.seconds)
- End timestamp: Seeks to marker's end position (marker.end_seconds)
- Both buttons use the same `onClickMarker` callback with appropriate seconds value

### Behavior

- Clicking the start timestamp seeks to `marker.seconds`
- Clicking the end timestamp creates a modified marker object with `seconds` set to `end_seconds` and passes it to `onClickMarker`
- Visual styling matches the original timestamp display using `text-muted` class
- Buttons use minimal styling (`variant="link"`) for seamless integration

---

## 27. Performer Image Overlay on Video Player

### Overview

A new feature in the scene video player that allows overlaying up to 2 images on top of the video. Images are selected from the image library filtered by the scene's performers. Overlays are draggable, resizable, and can be hidden by clicking on them. Works in both normal and fullscreen modes.

### Use Cases

- Display performer reference images while watching a scene
- Compare performer appearances across different content
- Quick reference for performer identification during playback

### Frontend Changes

**New Files:**

- `ui/v2.5/src/components/ScenePlayer/PerformerImageSelectModal.tsx`

  - Modal component for browsing and selecting performer images
  - Uses `useFindImagesLazyQuery` with performer filter
  - Paginated grid display with 40 images per page
  - Allows selecting up to 2 images
  - Displays thumbnails in grid, confirms with full image URLs

- `ui/v2.5/src/components/ScenePlayer/PerformerImageOverlay.tsx`
  - Overlay component that renders selected images on the video
  - Uses `createPortal` for proper z-index handling in fullscreen
  - Draggable positioning with mouse events
  - Resizable with corner handle (maintains aspect ratio feel)
  - Click-to-hide functionality
  - Reports hidden count to parent for badge display

**Modified Files:**

- `ui/v2.5/src/components/ScenePlayer/ScenePlayer.tsx`

  - Added imports for new components
  - Added state: `showImageOverlayModal`, `selectedOverlayImages`, `hiddenOverlayCount`
  - Added useEffect to create control bar button (image icon SVG)
  - Added useEffect to update button badge when overlays are hidden
  - Added portal renders for modal and overlay components

- `ui/v2.5/src/components/ScenePlayer/styles.scss`
  - `.vjs-performer-image-overlay-btn` - Control bar button styling with badge
  - `.performer-image-select-backdrop` / `.performer-image-select-modal` - Modal styling
  - `.pis-*` classes - Modal header, content, grid, pagination, footer
  - `.performer-image-overlay` - Overlay styling with drag/resize handles

### Behavior

1. Click the image icon button in the video player control bar
2. Modal opens showing all images belonging to scene performers (paginated)
3. Select up to 2 images by clicking on thumbnails
4. Confirm selection - overlays appear on video
5. Drag overlays to reposition, use corner handle to resize
6. Click on an overlay to hide it (badge shows hidden count)
7. Reopen modal and confirm to show hidden overlays again
8. State resets on page reload (no persistence)

### Dependencies

- Uses existing `GQL.useFindImagesLazyQuery` for image querying
- Uses existing `CriterionModifier.Includes` for performer filtering
- Uses `createPortal` from React for fullscreen overlay support

---

## 28. Image Viewer

### Overview

A dedicated full-page image viewer allowing users to view and manipulate multiple images simultaneously from the Images page. Images can be dragged around the screen, resized, hidden, and arranged in any layout. Perfect for comparing images side-by-side, organizing visual collections, or doing detailed image review.

### Usage

1. Go to the Images page (`/images`)
2. Enable selection mode and select the images you want to view
3. Click the "View Selected" button (appears when images are selected)
4. A new viewer page opens with all selected images displayed
5. Images are initially positioned in a grid pattern (or centered if only one)
6. Drag images to reposition them anywhere on the screen
7. Click-and-drag the resize handle (bottom-right corner of each image) to resize
8. Click the close button (X) on an image to hide it
9. Use the fullscreen button to enter fullscreen mode
10. State is not persisted; clearing the browser or navigating away resets the viewer

### URL and Storage

- **Route:** `/images/viewer?ids=1,2,3` - Comma-separated image IDs
- **Data Loading:** The viewer reads image IDs from the `ids` URL parameter and fetches image data directly

### Frontend Files

**New Files:**

- `ui/v2.5/src/components/Viewers/UnifiedViewer.tsx` - Unified image, marker, and scene viewer
- `ui/v2.5/src/components/Images/DraggableImageOverlay_custom.tsx` - Shared draggable/resizable image overlay primitive

  - `DraggableImage` sub-component for individual draggable/resizable image overlays
  - Uses ref-based state management for drag/resize tracking
  - Fullscreen API support with proper event listener cleanup
  - Maintains aspect ratio when resizing images
  - Grid layout calculation for multiple images

- `ui/v2.5/src/components/Images/ImageQueueIndicator.tsx` - Queue indicator component

  - Displays count of images in queue badge
  - Shows "Play" button to open viewer
  - Shows "Clear" button to empty queue
  - Opens the viewer URL with queued image IDs

- `ui/v2.5/src/components/Images/ImageViewer.scss` - Viewer styles
  - `.image-viewer-container` - Main container styling
  - `.image-viewer-header` - Header with fullscreen button
  - `.image-viewer-overlay` - Individual image overlay styling
  - `.iv-close-btn` - Close button styling
  - `.iv-resize-handle` - Resize handle styling with drag cursor
  - `.image-viewer-empty` - Empty state messaging

**Modified Files:**

- `ui/v2.5/src/components/Images/Images.tsx`

  - Routes `/images/viewer` to the unified viewer

- `ui/v2.5/src/components/Images/ImageList.tsx`
  - Integrated `ImageQueueIndicator` component
  - Added "Add to Queue" and "View Selected" operation buttons
  - Clears the in-memory viewer queue when leaving the images page

### Features

#### Dragging

- Click anywhere on an image to drag it
- Dragging is disabled on the close button and resize handle
- Drag offset is tracked to prevent image jumping
- Mouse move/up listeners are attached only during drag

#### Resizing

- Click and drag the resize handle (bottom-right corner) to resize
- Maintains natural image aspect ratio (calculated on image load)
- Minimum size enforced at 80px
- Display height calculated as `width / aspectRatio`

#### Close/Hide

- Click the X button to hide an image (state set to `visible: false`)
- Hidden count is displayed in window title
- Removing all images shows empty state message

#### Fullscreen

- Fullscreen button in header (only shown when not in fullscreen)
- Uses Fullscreen API: `requestFullscreen()` / `exitFullscreen()`
- Listens to `fullscreenchange` event to track state
- Header auto-hides when entering fullscreen (layout handled by container)

#### Layout

**Grid Layout (Multiple Images):**

```
- Calculates imagesPerRow = ceil(sqrt(imageCount))
- Positions images in rows with 20px spacing
- First image: (20, 60)
- Subsequent images offset by (DEFAULT_SIZE + spacing) in x/y
- 60px top offset accounts for header
```

**Single Image:**

- Centers the image on screen
- Positioned at `((viewportWidth - 300) / 2, (viewportHeight - 300) / 2)`

### State Management

- **Images Array:** `IOverlayState[]` containing id, url, x, y, width, visible
- **Fullscreen State:** Tracked via `isFullscreen` boolean
- **Position Updates:** `updatePosition(id, x, y)` - Updates x,y coordinates
- **Size Updates:** `updateSize(id, width)` - Updates width (height recalculated from aspect ratio)
- **Visibility Updates:** `removeImage(id)` - Sets visible to false

### Data Flow

1. User selects images on Images page
2. Images are added to the in-memory viewer queue
3. User clicks "View Selected" → navigates to `/images/viewer?ids=1,2,3`
4. `ImageViewer` reads image IDs from URL params
5. `ImageViewer` fetches image data for those IDs
6. Images are positioned and rendered as draggable overlays
7. User manipulates images (drag/resize/hide)
8. On page unload or navigation, viewer state is lost (not persisted beyond session)

### Styling Constants

- `DEFAULT_SIZE: 300` - Default image width in pixels
- `MIN_SIZE: 80` - Minimum resizable width
- `spacing: 20` - Gap between grid-positioned images
- Header height offset: `60px`

### Performance Considerations

- Uses `useCallback` to memoize event handlers
- Mouse event listeners only attached during drag/resize operations
- Images are lazy-loaded with natural dimensions calculated on load
- React reconciliation minimized via ref-based position tracking

### Browser Compatibility

- Fullscreen API supported in modern browsers
- Fallback: fullscreen button disabled if `document.fullscreenElement` is unavailable
- Mouse/touch events use standard APIs compatible with all major browsers

---

## 29. Unnamed Performers in Marker Filters

### Overview

A feature that allows users to define "unnamed performers" (Performer A, Performer B, etc.) within filter contexts. These virtual performers are defined by criteria (ethnicity, country, rating, performer rating criteria) and can be selected in the Top/Bottom dropdowns of marker filters. This enables searches like:

- "Find markers where the same Black 5-star performer is both top AND bottom"
- "Find markers where Performer A (Mexican, 4-star) is top and Performer B (Black, 5-star) is also top"

### Use Cases

1. **Same performer in both roles**: When an unnamed performer is selected in BOTH top and bottom dropdowns, the backend uses `both_roles_*` criteria to ensure the SAME performer matching those criteria appears in both roles, including OR-mode marker configs.
2. **Different unnamed performers**: When different unnamed performers are in top vs bottom, each applies their own criteria independently
3. **Same performer across marker configs**: Reusing the same unnamed performer letter across overlapping marker configs requires the same actual performer in every referenced role.
3. **Mixed with named performers**: Unnamed performers can be combined with regular named performer selections

### Files Created

- `ui/v2.5/src/models/list-filter/criteria/unnamed-performer.ts` - Type definitions and utility functions for unnamed performers
- `ui/v2.5/src/components/List/Filters/UnnamedPerformerManager.tsx` - React component for managing unnamed performers (add/edit/delete)

### Files Modified

- `ui/v2.5/src/models/list-filter/criteria/marker-performers.ts` - Added `unnamed_performers` array to criterion value, updated all serialization/deserialization methods, enhanced `applyToCriterionInput` to translate unnamed performers to backend criteria
- `ui/v2.5/src/components/List/Filters/MarkerPerformersFilter.tsx` - Integrated UnnamedPerformersManager, added quick-select buttons for unnamed performers in Top/Bottom sections
- `ui/v2.5/src/models/list-filter/criteria/scene-markers.ts`, `ui/v2.5/src/models/list-filter/criteria/scene-markers-exclude.ts` - Added role-aware unnamed performer rating criteria serialization for scene include/exclude marker filters
- `ui/v2.5/src/components/List/Filters/SceneMarkersFilter.tsx`, `ui/v2.5/src/components/List/Filters/SceneMarkersExcludeFilter.tsx`, `ui/v2.5/src/components/List/Filters/MarkerPerformersFilter.tsx` - Prune unnamed performers when no active top/bottom role selection references them, allowing letters to be reused
- `ui/v2.5/src/components/List/Filters/UnnamedPerformerManager.tsx`, `ui/v2.5/src/components/List/Filters/SceneMarkersFilter.tsx`, `ui/v2.5/src/components/List/Filters/SceneMarkersExcludeFilter.tsx`, `ui/v2.5/src/components/List/Filters/MarkerPerformersFilter.tsx` - Show an unused-state hint for unnamed performers that are defined but not selected in any marker row
- `graphql/schema/types/filters_custom.graphql`, `pkg/models/filter.go`, `pkg/sqlite/criterion_handlers_custom.go` - Added `rating_criteria` to unnamed performer criteria and SQL matching against performer rating advisor scores
- `ui/v2.5/src/locales/en-US.json` - Added localization strings for unnamed performers

### Filters Implemented (3 of 5)

1. ✅ **Markers** (Markers page, `/scenes/markers`) - MarkerPerformersFilter
2. ⏳ **Scene Markers** (Scenes page, `/scenes`) - SceneMarkersFilter
3. ✅ **Scene Markers: Exclude** (Scenes page, `/scenes`) - SceneMarkersExcludeFilter (fixed via `groups_extended_exclude` field)
4. ⏳ **Markers** (Performers page, `/performers`) - PerformerMarkersFilter
5. ⏳ **Markers: Exclude** (Performers page, `/performers`) - PerformerMarkersExcludeFilter

### Backend Support

The backend already supports `both_roles_ethnicities`, `both_roles_countries`, and `both_roles_rating` fields in `SceneMarkerTagGroupInput`, which the unnamed performer feature leverages when the same unnamed performer is selected in both Top and Bottom.

### Data Structure

```typescript
interface IUnnamedPerformer {
  id: string; // e.g., "unnamed-A"
  label: string; // e.g., "Performer A"
  letter: string; // e.g., "A"
  ethnicities: string[];
  countries: string[];
  rating: IUnnamedPerformerRating | null;
  rating_criteria: IRatingCriteriaValue | null;
}
```

### Future Work

- Implement unnamed performers in remaining performer-page filters (follow pattern from MarkerPerformersFilter)
- Consider adding more criteria fields (age range, height, etc.)
- Persist unnamed performer definitions across filters for reuse

---

## 30. Has Roles Filter for Markers

### Overview

A new filter in the Markers page (`/scenes/markers`) called "Has Roles" that allows filtering markers based on whether they have performers assigned as tops and/or bottoms. This filter uses a simple 2-checkbox UI:

- **Has Tops**: When checked, filter for markers with at least one top performer
- **Has Bottoms**: When checked, filter for markers with at least one bottom performer

### Use Cases

1. **Both checked**: Find markers with at least 1 top AND at least 1 bottom
2. **Has Tops only**: Find markers with at least 1 top AND 0 bottoms
3. **Has Bottoms only**: Find markers with 0 tops AND at least 1 bottom
4. **None checked**: Find markers with 0 tops AND 0 bottoms

### GraphQL Schema Changes

**File:** `graphql/schema/types/filters.graphql`

```graphql
"Input for filtering markers by their performer roles (tops/bottoms)"
input HasRolesCriterionInput {
  "When true: has at least one top; when false: has no tops"
  has_tops: Boolean!
  "When true: has at least one bottom; when false: has no bottoms"
  has_bottoms: Boolean!
}
```

Added to `SceneMarkerFilterType`:

```graphql
has_roles: HasRolesCriterionInput
```

### Backend Files Modified

- `pkg/models/scene_marker.go` - Added `HasRolesCriterionInput` struct with two boolean fields and `HasRoles` field to `SceneMarkerFilterType`
- `pkg/sqlite/scene_marker_filter.go` - Added `hasRolesCriterionHandler` function with simple AND logic

### Frontend Files Created

- `ui/v2.5/src/models/list-filter/criteria/has-roles.ts` - Criterion class and option for the Has Roles filter
- `ui/v2.5/src/components/List/Filters/HasRolesFilter.tsx` - React component with 2-checkbox UI

### Frontend Files Modified

- `ui/v2.5/src/models/list-filter/types.ts` - Added `has_roles` to `CriterionType`
- `ui/v2.5/src/models/list-filter/scene-markers.ts` - Added `HasRolesCriterionOptionInstance` to criterion options
- `ui/v2.5/src/components/List/CriterionEditor.tsx` - Added rendering case for `HasRolesCriterion`
- `ui/v2.5/src/locales/en-US.json` - Added localization strings

### Filter Behavior

| Has Tops | Has Bottoms | Result                                            |
| -------- | ----------- | ------------------------------------------------- |
| ✓        | ✓           | Markers with at least 1 top AND at least 1 bottom |
| ✓        | ✗           | Markers with at least 1 top AND zero bottoms      |
| ✗        | ✓           | Markers with zero tops AND at least 1 bottom      |
| ✗        | ✗           | Markers with zero tops AND zero bottoms           |

---

## 31. Scene Type Filter

### Overview

A new "Scene Type" filter available on both the Scenes page and Performers page. Classifies scenes by their marker content into 4 types: Sex, Oral, Solo, and Facial. Tag hierarchy (subtags) and secondary tags are fully supported.

**Scene type definitions:**

- **Sex Scene**: Scene has at least one marker matching the configured sex tag (or subtag/secondary tag)
- **Oral Scene**: Scene has at least one oral marker AND zero sex markers
- **Solo Scene**: Scene has at least one solo marker AND zero sex or oral markers
- **Facial Scene**: Scene has at least one facial marker (independent of other types)

**Scenes page behavior:** Sex/Oral/Solo are mutually exclusive (radio buttons). Facial is an independent checkbox that can be combined with any of the other three.

**Performers page behavior:** All 4 types are independent checkboxes. Multiple selections use AND logic — performer must have marker-level participation (via `scene_marker_performers`) in at least one scene qualifying as each selected type.

### Configuration Dependencies

Requires `roleTagIds` to be configured in Settings > Interface:

- `sexTagId` — Tag ID for sex markers
- `oralTagId` — Tag ID for oral markers
- `soloTagId` — Tag ID for solo markers
- `facialTagId` — Tag ID for facial markers

### GraphQL Schema Changes

**New input type** in `graphql/schema/types/filters.graphql`:

```graphql
input SceneTypeFilterInput {
  types: [String!]!
  sex_tag_id: ID
  oral_tag_id: ID
  solo_tag_id: ID
  facial_tag_id: ID
}
```

**New fields:**

- `SceneFilterType.scene_type: SceneTypeFilterInput`
- `PerformerFilterType.scene_type: SceneTypeFilterInput`

### Files Created

- `ui/v2.5/src/models/list-filter/criteria/scene-type.ts` — Criterion classes for Scenes and Performers
- `ui/v2.5/src/components/List/Filters/SceneTypeFilter.tsx` — Filter UI components

### Files Modified

- `graphql/schema/types/filters.graphql` — Added `SceneTypeFilterInput` and fields on `SceneFilterType`/`PerformerFilterType`
- `pkg/models/scene.go` — Added `SceneTypeFilterInput` struct and `SceneType` field on `SceneFilterType`
- `pkg/models/performer.go` — Added `SceneType` field on `PerformerFilterType`
- `pkg/sqlite/scene_filter.go` — Added `sceneTypeCriterionHandler` with recursive CTE subquery logic
- `pkg/sqlite/performer_filter.go` — Added `sceneTypeCriterionHandler` with marker-level performer participation logic
- `ui/v2.5/src/models/list-filter/types.ts` — Added `"scene_type"` to `CriterionType` union
- `ui/v2.5/src/models/list-filter/scenes.ts` — Registered `SceneSceneTypeCriterionOption`
- `ui/v2.5/src/models/list-filter/performers.ts` — Registered `PerformerSceneTypeCriterionOption`
- `ui/v2.5/src/components/List/CriterionEditor.tsx` — Added dispatch for Scene/Performer scene type filters
- `ui/v2.5/src/locales/en-GB.json` — Added i18n entries
- `ui/v2.5/src/locales/en-US.json` — Added i18n entries

---

## 32. 2nd Camera Tag Exclusion

### Overview

Adds a configurable "2nd Camera" tag (`secondCameraTagId`) that marks orgasm/facial markers as duplicate camera angles. Markers tagged with this tag are **excluded** from counting in statistics and PerformerCategoryStrip calculations. On the main **Scenes** page, the **Scene Markers** filter ignores markers tagged `2ndcamera` when filtering by the configured orgasm tag (or any of its descendants).

### Configuration

- Added `secondCameraTagId` to the `roleTagIds` UI configuration (Settings → Interface → Role Tags)
- Works like other role tag IDs (sexTagId, oralTagId, etc.) — configurable via a tag picker dropdown

### Exclusion Behavior

Markers with the 2nd camera tag (or any of its descendants) are **excluded** from:

- **PerformerCategoryStrip** (both scene context and global context):
  - Orgasm top count
  - Facial top/bottom/unique counts
  - Facial marker partner counts
- **Scene/Vato Stats** (custom stats dashboards):
  - Total Orgasms (`sceneOrgasmCount`)
  - Total Orgasm Time (`totalOrgasmTime`)
  - Total Facials (`sceneFacialCount`)
  - Total Facial Time (`totalFacialTime`)
  - Estimated Liters (`estimatedLiters`, derived from orgasm count)

Markers with the 2nd camera tag are **included** (treated normally) in:

- General Markers page / user-created Markers filters
- Scene/marker browsing and playback

Markers with the 2nd camera tag are **excluded** from matching the configured orgasm tag in:

- Scenes page / Scene Markers filter (Scenes page only)

### Files Modified

- `ui/v2.5/src/core/config.ts` — Added `secondCameraTagId` to `roleTagIds` interface
- `ui/v2.5/src/locales/en-GB.json` — Added `"second_camera"` locale string under `role_tags`
- `ui/v2.5/src/components/Settings/SettingsInterfacePanel/SettingsInterfacePanel.tsx` — Added tag picker for 2nd Camera marker tag
- `ui/v2.5/src/models/list-filter/criteria/scene-markers.ts` — Added support for injecting marker-level exclude tags into the Scene Markers filter output
- `ui/v2.5/src/components/Scenes/SceneList.tsx` — Injects `exclude_tag_ids_on_marker` for orgasm Scene Markers filtering on the main Scenes page
- `graphql/schema/types/filters.graphql` — Added `exclude_tag_ids_on_marker` to `SceneMarkerTagGroupInput`
- `internal/api/resolver_model_performer.go` — Added `secondCameraTagID` to `getRoleTagIDs()` return values; updated all call sites; passed exclusion to facial/orgasm counting functions and `GetPerformerMarkerRolesForScene`
- `internal/api/resolver_model_studio.go` — Updated `getRoleTagIDs` call sites for new 7th return value
- `internal/api/resolver.go` — Added 2nd camera exclusion SQL CTE to `SceneOrgasmCount`, `SceneFacialCount`, `TotalOrgasmTime`, `TotalFacialTime`
- `pkg/models/filter.go` — Added `ExcludeTagIDsOnMarker` to `SceneMarkerTagGroupInput`
- `pkg/sqlite/criterion_handlers.go` — Implements marker-level exclude tags for Scene Marker Tag groups
- `pkg/scene/query.go` — Added `secondCameraTagID` parameter to `GetPerformerMarkerRolesForScene`; builds descendant tag set and skips orgasm/facial counting for 2nd camera markers; added optional `excludeTagIDs` variadic parameter to `CountMarkersByPerformerRoleWithSecondary`

---

## 33. Marker Duration Display

### Overview

Displays the calculated duration between a marker's start and end time in both view and edit modes. For example: `1:00 - 1:45 (45s)`. Makes it easy to see at a glance how long each marker segment is.

### View Mode

In the scene Markers tab (PrimaryTags card), when a marker has an end time, the duration is shown in parentheses after the time range.

### Edit Mode

In the marker edit form (SceneMarkerForm), a read-only "Duration" field appears below the end time field showing the full computed duration (e.g., `1:00 - 1:45 (45s)`).

### Files Modified

- `ui/v2.5/src/utils/text.ts` — Added `formatDurationRange()` utility function (formats seconds into human-readable `Xh Xm Xs` format)
- `ui/v2.5/src/components/Scenes/SceneDetails/PrimaryTags.tsx` — Added duration display after end timestamp in marker view
- `ui/v2.5/src/components/Scenes/SceneDetails/SceneMarkerForm.tsx` — Added computed read-only duration field in edit form

---

## 34. Task Progress Completion Estimate

Each tracker card provides a compact browser-local Items per day input beside its planned finish date. It recalculates the date immediately. Observed estimates use complete recording days and subtract incoming work from completions; paused trackers and growing backlogs have no observed finish date. See section 5 for files and tests.

The Overall Progress card retains a separate browser-local scenes-per-day plan calculated exclusively from unorganized scenes.

---

_Last Updated: March 2026_
_Base Version: Stash v0.30.0_

---

## 35. Marker Source-Quality Generation

### Overview

Adds a new system setting to control marker preview quality:

- `false` (default): marker video/webp previews are generated at low quality (640px width)
- `true`: marker video/webp previews are generated at original source quality (no width downscale)

When the setting is switched, generation detects markers that were created under the previous mode and regenerates only those mismatched marker files.

Adds a second system setting to skip that existing-file quality check:

- `false` (default): existing marker previews are probed for quality mismatches
- `true`: existing marker previews are trusted, so Generate only creates missing marker preview files unless overwrite is enabled

Marker generation also skips video/webp preview generation for markers whose only marker tag is the configured Sex, Oral, or Solo primary tag, or a tag selected in the custom simple-marker preview skip list. Marker screenshots still generate normally. Settings > Custom includes a cleanup action to delete already-generated video/webp previews for those simple markers without deleting marker screenshots.

### Configuration

**GraphQL Schema Files:**

- `graphql/schema/types/config_custom.graphql` - extends `ConfigGeneralInput` and `ConfigGeneralResult` with `markerPreviewSourceQuality` and `markerPreviewSkipQualityCheck`

**Backend Config Files:**

- `internal/manager/config/config_custom.go` - custom key + getter
- `internal/manager/config/config.go` - default value registration

### Backend Implementation

**Files Modified:**

- `pkg/scene/generate/generator.go`
  - Added `HighQualityMarkers` option to generation pipeline
- `pkg/scene/generate/marker_preview.go`
  - Applies width scaling only for low-quality mode
- `internal/manager/task_generate.go`
  - Passes marker quality mode and simple-marker cleanup options into generate tasks
- `internal/manager/task_generate_markers.go`
  - Integrates quality-mismatch checks into marker task requirements and generation flow
  - Skips marker video/webp generation for simple Sex/Oral/Solo/custom skip-list primary-tag-only markers while leaving screenshot generation intact

**File Created:**

- `graphql/schema/types/metadata_custom.graphql`
  - Extends `GenerateMetadataInput` with `deleteSimpleMarkerPreviews`
- `internal/manager/task_generate_markers_custom.go`
  - Detects quality mismatch by probing existing marker dimensions (webp/mp4)
  - Deletes mismatched marker artifacts before generation so only required files regenerate
  - Treats either source width or source height as valid in source-quality mode to handle rotation metadata materialized by ffmpeg
  - Reads `configuration.ui.simpleMarkerPreviewExcludedTagIds` as extra primary-only marker tags that skip video/webp preview generation
  - Deletes existing video/webp marker previews for simple Sex/Oral/Solo/custom skip-list primary-tag-only markers when requested

### API/Resolver Integration

**Files Modified:**

- `internal/api/resolver_mutation_configure.go`
  - Persists `markerPreviewSourceQuality` and `markerPreviewSkipQualityCheck` changes
- `internal/api/resolver_query_configuration.go`
  - Exposes `markerPreviewSourceQuality` and `markerPreviewSkipQualityCheck` in config query responses

### Frontend Integration

**Files Modified:**

- `ui/v2.5/src/components/Settings/SettingsSystemPanel.tsx`
  - Added toggle in Preview Generation section
- `ui/v2.5/src/components/Settings/SettingsCustomPanel.tsx`
  - Added cleanup action for deleting simple Sex/Oral/Solo/custom skip-list marker previews under Settings > Custom
  - Added a multi-tag picker for `simpleMarkerPreviewExcludedTagIds`
- `ui/v2.5/graphql/data/config.graphql`
  - Added field to config fragment
- `ui/v2.5/src/locales/en-GB.json`
  - Added UI strings for the new setting

### Behavior Notes

- Markers already generated in the currently selected mode are left untouched.
- Markers generated in the opposite mode are selectively regenerated.
- Screenshot markers are unaffected by this setting.

---

## 36. Premium Rating Card Styles

### Overview

Adds a configurable visual theme for Bronze, Silver, Gold, and Royal Sapphire scene, performer, image, gallery, group, and studio cards using 100-based ratings:

- `premium` (default): black card shell with radiant bronze/silver/gold/Royal Sapphire outline accents and one gently breathing tier-colored aura across the full card. The aura only animates opacity/transform, pauses off-screen, and replaces the heavier swipe, animated shadow, and animated text effects.
- `classic`: preserves the original metallic shimmer styles and adds a matching Royal Sapphire GOAT style

When the Black Steel application theme is active, premium cards use a raised graphite face with a restrained static double-tier metallic rim, directional inset bevel, and tight contact shadow. Scene activity percentages and their icons inherit the card's metallic tier color instead of the default white treatment. This keeps the tier silhouette and card metrics distinct from the near-black application canvas without adding animation or changing the premium appearance under the default application theme.

All rating-card motion is disabled when the browser requests reduced motion.

Rating-based card styling uses these thresholds:

- 60-72: Bronze
- 73-83: Silver
- 84-89: Gold
- 90-100: Royal Sapphire

Configured override tags can force Bronze, Silver, Gold, or Royal Sapphire styling independent of rating. The legacy GOAT tag remains a Royal Sapphire override. Overrides take precedence over rating-based thresholds.

Scenes also become Royal Sapphire regardless of rating when their persisted Rating Advisor bonuses include any GOAT element value (`+5`, `+10`, `+15`, or `+20`) or the God-tier orgasm bonus. This scene-only override takes precedence over lower-tier configured tags and is shared by scene cards, the live Rating Advisor summary, SceneStats metallic charts, scene metallic filters, and studio metallic scene counts/sorts. SceneStats metallic charts honor explicit tag and bonus overrides even when a scene has no numeric rating; only unrated scenes without an override remain in the Unknown bucket.

### Configuration

Stored in UI config:

```typescript
configuration.ui.ratingCardTheme = "premium" | "classic";
configuration.ui.ratingCardThresholds = {
  scene: {
    bronze: 60,
    silver: 73,
    gold: 84,
    royalSapphire: 90,
  },
  performer: {
    bronze: 60,
    silver: 73,
    gold: 84,
    royalSapphire: 90,
  },
};
configuration.ui.ratingCardOverrideTagIds = {
  bronzeTagId: "<tag id>",
  silverTagId: "<tag id>",
  goldTagId: "<tag id>",
  royalSapphireTagId: "<tag id>",
};
configuration.ui.roleTagIds.goatTagId = "<tag id>";
```

### Metallic Rating Filter

Adds a `metallic_rating` filter to scenes, performers, images, galleries, groups, and studios. The filter matches the final card style after configured tag overrides, scene Rating Advisor bonus overrides, and rating thresholds are applied, and supports include/exclude modifiers for `bronze`, `silver`, `gold`, and `royal_sapphire` (displayed as Royal Sapphire). Scene filtering also promotes scenes with a marker carrying the configured GOAT tag or one of its descendants, whether primary or secondary, to Royal Sapphire; that promotion takes precedence over every lower tier.

### Files Modified

- `ui/v2.5/src/components/Scenes/SceneCard.tsx` - Uses shared rating card class helper for scene cards
- `ui/v2.5/src/components/Shared/RatingAdvisor_custom.tsx` - Applies scene bonus overrides to the live tier summary
- `ui/v2.5/src/components/SceneStats/SceneStats.tsx` - Includes scene bonus overrides in metallic chart buckets
- `ui/v2.5/src/components/Scenes/SceneMarkerCard.tsx` - Uses the GOAT/Royal Sapphire override for marker cards
- `ui/v2.5/src/components/Performers/PerformerCard.tsx` - Uses shared rating card class helper for performer cards
- `ui/v2.5/src/components/Performers/PerformerDetails/PerformerAppearsWithByRolePanel.tsx` - Applies the same card style logic to co-performer cards
- `ui/v2.5/src/components/Images/ImageCard.tsx` - Uses shared rating card class helper for image cards
- `ui/v2.5/src/components/Galleries/GalleryCard.tsx` - Uses shared rating card class helper for gallery cards
- `ui/v2.5/src/components/Groups/GroupCard.tsx` - Uses shared rating card class helper for group cards
- `ui/v2.5/src/components/Studios/StudioCard.tsx` - Uses shared rating card class helper for studio cards
- `ui/v2.5/src/components/Settings/SettingsInterfacePanel/SettingsInterfacePanel.tsx` - Adds rating card theme, threshold, and override tag settings
- `ui/v2.5/src/core/config.ts` - Adds rating card theme, thresholds, and override tag UI config typing
- `graphql/schema/types/filters_custom.graphql` - Adds `metallic_rating` filter fields
- `graphql/schema/types/stats_custom.graphql` - Exposes the compact scene bonus-override flag used by SceneStats
- `internal/api/resolver_custom.go` - Populates the compact SceneStats bonus-override flag
- `pkg/sqlite/metallic_rating_filter_custom.go` - Shared backend metallic style filter predicate
- `pkg/sqlite/metallic_rating_filter_marker_custom_test.go` - Verifies GOAT-family marker promotion and mutually exclusive final scene tiers
- `pkg/sqlite/studio_sort_metric_custom.go` - Reuses scene bonus overrides in studio metallic counts and sorts
- `pkg/sqlite/*_filter.go` - Hooks metallic rating filters into scene, performer, image, gallery, group, and studio filters
- `ui/v2.5/src/models/list-filter/criteria/metallic-rating_custom.ts` - Frontend metallic rating criterion
- `ui/v2.5/src/models/list-filter/{scenes,performers,images,galleries,groups,studios}.ts` - Registers the metallic rating filter
- `ui/v2.5/src/index.scss` - Imports the custom rating card stylesheet
- `ui/v2.5/src/index.tsx` - Installs the shared visibility observer that pauses off-screen premium-card auras
- `ui/v2.5/src/locales/en-GB.json` - Adds UI strings for the theme selector and GOAT tag setting

### Files Added

- `ui/v2.5/src/utils/ratingCardStyles_custom.ts` - Shared class selection helper for rating tiers, configurable thresholds, and GOAT override
- `ui/v2.5/src/utils/ratingCardMotion_custom.ts` - Shared IntersectionObserver/MutationObserver controller for premium-card animation visibility
- `ui/v2.5/src/components/Shared/ratingCardStyles_custom.scss` - Premium/Royal Sapphire card shell styling
- `ui/v2.5/tests/ratingCardMotion_custom.test.ts` - Verifies only premium metallic-tier cards opt into visibility-controlled motion
- `ui/v2.5/tests/ratingCardSceneBonus_custom.test.ts` - Verifies all four GOAT values and the God-tier orgasm bonus force scene-only Royal Sapphire precedence
- `ui/v2.5/tests/metallicRatingChart_custom.test.ts` - Verifies unrated items retain explicit metallic override buckets while unrated items without an override remain unknown
- `pkg/sqlite/studio_sort_metric_custom_test.go` - Verifies persisted scene bonuses count as Royal Sapphire and beat lower-tier tag overrides
- `internal/api/scene_stats_past_year_custom_test.go` - Verifies the compact SceneStats query reports the scene bonus override

---

## 37. Persisted Rating System

### Overview

Adds scene and performer rating system buttons next to the detail-page rating display. Each button opens a modal questionnaire with weighted criteria and live scoring. Selecting a criterion value persists that row to custom rating score tables, recalculates the overall `rating100`, and updates the scene/performer rating immediately.

Suggested tiers use the same configurable 100-based thresholds as the premium/classic card effects. Scene and performer thresholds are configured separately.

Both scene and performer advisor ratings also include a non-editable progressive O Count bonus. Each qualifying O earns +1 at counts 3-5, +2 at 6-11, +3 at 12-23, +4 at 24-47, and one additional point whenever the count range doubles again. Scenes qualify on every O from the 3rd, while performers qualify every two Os at counts 3, 5, 7, 9, and so on. This makes later returns increasingly valuable without increasing the tier weight on every single count.
When scene o-history is added, deleted, reset, or recorded with a video timestamp, the stored advisor rating is recalculated for that scene and any attached performers that already have persisted advisor scores. Performer advisor ratings are also recalculated when scene casts change, including bulk edits, performer deletion, and performer/scene merges.

The server owns the canonical rubric. Score writes validate the entity's current scene/performer mode, section, key, and exact raw-value choice, then derive `weighted_value` instead of trusting the client. Recalculation likewise derives every contribution from canonical raw values. Invalid writes are rejected; legacy persisted values are normalized to the nearest current choice during recalculation. The five-level orgasm-payoff scale accepts 0 through 4. Level 0 means absent or actively bad/off-camera/off-putting orgasms; level 1 means present but weak, barely there, or unimpressive orgasms. Adding level 1 does not migrate or remap any existing scene rating answers. Every scene rubric accepts GOAT element raw values `0.5`, `1`, `1.5`, and `2`, contributing +5, +10, +15, or +20 to the stored 100-based rating. GOAT has no selectable zero choice: clearing/deleting the bonus represents zero, while any legacy stored zero row is treated as absent.

Individual answers can be cleared, and Reset advisor removes all advisor rows while preserving the current overall rating. Entering a manual overall rating also removes advisor rows so later lifecycle events cannot unexpectedly reclaim that rating. Zero-valued optional adjustments are deleted instead of persisted, while an intentional zero-valued core answer still counts as advisor ownership.

### Scene Advisor

Uses a simplified weighted scene rubric designed for 100-based ratings:

- Top(s) attractiveness: six levels from 0-5, each raw point is worth 0.6, up to 3.0
- Bottom(s) attractiveness: six levels from 0-5, each raw point is worth 0.2, up to 1.0
- Energy / sex quality: six levels from 0-5, each raw point is worth 0.4, up to 2.0
- Orgasm / climax payoff: five levels from 0-4, each raw point is worth 0.5, up to 2.0
- Usable factor: five levels from 0-4, each raw point is worth 0.5, up to 2.0. It captures how much of the scene works without skipping, accounting for dead setup, overly long interviews, weak positions, negative-marker stretches, strong angles, intensity, and consistently workable action independently from sex quality.

Solo scenes use a separate scene rubric whenever exactly one performer is assigned. The existing solo role-tag detection remains a fallback for under-four-performer scenes, while the cast count keeps the UI and backend aligned even when a scene has no solo marker:

- Vato attractiveness: six levels from 0-5, each raw point is worth 1.0, up to 5.0
- Performance: five levels from 0-4, each raw point is worth 0.75, up to 3.0. The scale runs from visibly clocked-out or merely going through the motions through engaged, excited, and fully committed performance.
- Usability: five levels from 0-4, each raw point is worth 0.5, up to 2.0. This merges the former camera-angle dimension with the regular scene usability concept, including pacing and how much works without skipping.

Group scenes use a separate rubric when they have 4 or more distinct assigned performers. Group mode takes priority over solo/default mode; scenes with 3 performers keep the existing rubric:

- Top lineup attractiveness: six levels from 0-5, each raw point is worth 0.4, up to 2.0
- Energy / coordination: six levels from 0-5, each raw point is worth 0.8, up to 4.0. This merges the former energy/sex-quality and group-participation dimensions.
- Orgasm quality: five levels from 0-4, each raw point is worth 0.5, up to 2.0
- Usability: five levels from 0-4, each raw point is worth 0.5, up to 2.0

Group scene bonus section:

- Attractive bottom (+1.0 when present)
- Group oral-only (+2.0 when manually selected)
- Uniform/setting factor (+0.5 when present)
- God-tier orgasm (+1.0 when present)
- GOAT element (selectable +0.5/+1.0/+1.5/+2.0, displayed as +5/+10/+15/+20)

When a cast edit crosses a default/solo/group boundary, including entering or leaving the exactly-one-performer solo mode, existing advisor rows are removed and the stored scene rating is cleared to SQL `NULL` (no rating). Marker create/update/delete/bulk operations apply the same policy when a scene changes between default and solo mode. Changing the configured sex/oral/solo role-tag IDs resets every score-owned scene advisor because the mode definition itself changed. Manual scene ratings without advisor rows are preserved during automatic mode changes. The scene Reset Advisor action always removes all criterion, bonus, and penalty rows and explicitly clears the scene to the no-rating state, including when no advisor rows remain; performer resets continue to preserve their current rating. The standalone group reset script applies the same reset to existing 4+ performer scenes that already have advisor data. The solo/group rubric migration converts existing solo attractiveness and camera-work values, promotes active solo Outstanding Performance bonuses to the highest main Performance level, merges persisted group energy/coordination answers, clears retired group standout answers, removes Unlikely Top only from 4+ performer group scenes, and adjusts affected stored scene ratings by the exact contribution delta. The one-performer repair script resets stale regular/group advisor data and ratings left behind by the old reset behavior without touching valid solo advisor rows. A separate normalization script converts legacy stored zero scene ratings to `NULL` without deleting advisor criteria.

Scene rating recalculation derives each contribution from the current criterion scale and clamped raw answer instead of trusting a persisted `weighted_value` from an older rubric. Mode-specific allowlists continue to exclude retired keys even if an obsolete row is inserted or restored. The retired-score cleanup script deletes the old `performerAppeal`, `cameraWork`, `groupParticipation`, `groupStandout`, `largeGroup`, `outstandingPerformance`, and `standoutAct` rows, normalizes legacy 0-10 Energy values to the current 0-5 scale, and recalculates affected stored scene ratings from current allowed keys.

The rating advisor uses a responsive box grid instead of one long control stack. Criteria are shown as at-a-glance cards with one accessible choice-button control, visible hover/focus descriptions, a real unrated state, completion progress, provisional scoring until every criterion is answered, per-card autosave feedback, per-answer Clear actions, and a whole-advisor reset action. The selected choice alone uses a relative heat scale from neutral gray at zero through yellow and orange to red at the highest value, including shorter non-0-5 scales. Bonuses and penalties use compact accessible switches, while the recorded-orgasm bonus is a compact read-only row. The modal distinguishes automatic-bonus loading and query errors from a true zero count, uses the authoritative score/rating returned by mutations, and calculates provisional ratings in the same clamp-then-bonus order as the backend. The modal has one Close action, a header close button, Escape support, high-contrast unselected choices, and a calculation summary colored with the configured classic/premium rating tier theme. Rating hints and choice descriptions use shorter, casual language that matches the rest of the custom UI. Hovering or focusing the advisor rating button, or the painted rating star on scene and performer cards, opens a compact vertical rating summary. Each criterion uses the same gray-yellow-orange-red heat scale and a normalized bar length so relative strengths are immediately comparable, with its exact signed contribution to the final 0-100 rating shown beside the name; a zero answer leaves the bar completely empty. Active bonuses and the automatic orgasm-count bonus use green check icons; active penalties use red octagonal traffic signs with a white minus. These adjustment rows use popup-only one- or two-word labels, retain their signed final-rating contributions without changing advisor wording, and use a compact two-column layout. Card summaries fetch their advisor data lazily on first hover. Scene and performer card selection checkboxes sit in the lower-left corner so they remain separate from the rating star and its hover target.

Bonus section:

- O Count bonus (every O from the 3rd earns its progressive tier weight: +1 at 3-5, +2 at 6-11, +3 at 12-23, with subsequent tier ranges doubling; automatic and read-only)
- Uniform/setting factor (+0.5 when present)
- Oral-only scene (+0.5 when present)
- God-tier orgasm bonus (+1.0 when present)
- GOAT element (selectable +5/+10/+15/+20)
- Unlikely top (+0.5 when present)

Solo scene bonus section:

- Orgasm count bonus (every O from the 3rd earns its progressive tier weight: +1 at 3-5, +2 at 6-11, +3 at 12-23, with subsequent tier ranges doubling; automatic and read-only)
- Orgasm bonus (+1.0 when present)
- Feet bonus (+1.0 when present)
- GOAT element (selectable +5/+10/+15/+20)
- Uniform/setting factor (+0.5 when present)

Penalty section:

- No orgasm (-2.0 when present)
- Production / visual quality (-1.0 when quality actively works against the scene)
- Extremely polished (-1.0 when heavy production, flaw-free presentation, fake moaning, or a manufactured aesthetic makes the scene feel artificial). This penalty is available in standard, solo, and group scene advisors.

Scene score conversion:

- 0.0-5.9: Plain
- 6.0-7.2: Bronze
- 7.3-8.3: Silver
- 8.4-8.9: Gold
- 9.0-10.0: Elite / Royal Sapphire

Bonus points can push the stored/displayed 0-100 rating above 100 when the weighted score exceeds 10.0.

### Performer Rating System

Uses a simplified weighted performer rubric designed for 100-based ratings:

- Face: six levels from 0-5, each raw point is worth 0.6, up to 3.0
- Body: six levels from 0-5, each raw point is worth 0.6, up to 3.0
- Sexual performance: six levels from 0-5, each raw point is worth 0.4, up to 2.0
- Ethnicity / racial appeal: each raw point is worth 1/3, up to 1.0
- Masculinity: each raw point is worth 1/3, up to 1.0

Bonus section:

- Orgasm count bonus (every two Os from the 3rd earns its progressive tier weight at counts 3, 5, 7, 9, and so on; tiers are +1 at 3-5, +2 at 6-11, +3 at 12-23, then continue doubling; automatic and read-only)
- Consistency (+0.5 when present)
- Dick (+0.5 when present)
- Tattoos (+0.5 when present)

Bonus points can push the stored/displayed 0-100 rating above 100 when the weighted score exceeds 10.0.

Performer score conversion:

- 0.0-5.9: Plain
- 6.0-7.2: Bronze
- 7.3-8.3: Silver
- 8.4-8.9: Gold
- 9.0-10.0: Elite / Royal Sapphire

### Rating Criteria Filters

Scenes and performers each expose one combined "Rating Criteria" filter. Inside that filter, numeric dimensions support `=`, `>=`, `<=`, and `BETWEEN`; bonus and penalty rows retain presence checks for "has" or "does not have". GOAT Element additionally exposes a numeric bonus-amount filter with +5/+10/+15/+20 choices, serialized through the shared `rating_criteria.bonus_values` GraphQL input so individual tiers and ranges can be selected without losing the existing presence filter.

The Scenes filter exposes regular, solo, and group criteria as distinct persisted keys. Regular scenes expose top/bottom attractiveness, 20-point energy/sex quality, the full five-level orgasm-quality scale (including Below average at level 1), and the five-level 20-point Usable Factor. Solo scenes expose attractiveness, performance, and usability. Group scenes expose top-lineup attractiveness, merged energy/coordination, the same five-level orgasm-quality scale, and usability; attractive-bottom and group-oral-only are presence rows. Extremely Polished is a shared presence penalty for all three scene rubrics. Unlikely Top remains available only for regular scenes, while the retired Outstanding Performance and Large Group bonuses are not exposed. Scene lists also expose a GOAT Element Bonus sort; scenes without an active GOAT bonus sort as zero, and cards show the active +0/+5/+10/+15/+20 sort value.

`rating_goat_tiers_review.up.sql` snapshots legacy `GOAT element` +20 rows, creates the case-insensitive `reviewGOAT` tag if needed, assigns it only to those legacy scenes, relabels their persisted answer as `GOAT +20`, and leaves raw/weighted values unchanged at `2`. The label change makes the script idempotent without catching GOAT choices made after the tiered feature is introduced.

After a score mutation, the advisor and its hover summary prefer the mutation response and freshly queried score rows over the scene or performer snapshot that originally opened them. This prevents a correctly persisted fractional choice such as GOAT +5 (`0.5`) from appearing to revert while the parent entity refetch is still catching up.

Rating score GraphQL IDs use the score's entity type, entity ID, section, and key rather than the numeric primary key from its section-specific SQLite table. Criterion, bonus, and penalty tables can independently issue the same numeric primary key; the composite API identity prevents Apollo from merging unrelated rows such as scene 29071's `payoff` criterion and `goatElement` bonus after a full page reload.

Performer rating criteria include a feminine performer penalty, exposed both in the performer Rating Advisor and the performer Rating Criteria filter.

Studios expose separate Rating Criteria (Studio Average) and Performer Rating Criteria (Studio Average) filters. Numeric scene criteria compare the average raw answer across the studio's scenes where that criterion is set; performer criteria average each distinct linked performer once, even when that performer appears in multiple studio scenes. Bonus and penalty presence rows match active adjustments on any related scene or distinct performer. Studio sorting exposes average raw-value sorts for every solo, standard, and group numeric criterion, plus Average Solo Scene Rating, Average Standard Scene Rating, Average Group Scene Rating, and Average Performer Rating using the same eligibility rules and stored-rating averages shown in Studio Stats. These aggregate predicates and correlated average sorts are only added when selected, so ordinary Studio list queries do not pay for Rating Advisor aggregation.

### Studio Rating Advisor Averages

The Studio detail Stats tab includes four Rating Advisor summaries for solo scenes, 2-3 performer sex scenes, 4+ performer group scenes, and the studio's distinct performers. The summary heading shows the overall stored scene-rating average across the three qualifying scene rubrics, and every section starts with its own stored scene- or performer-rating average. Each criterion uses the same normalized heat bar as the scene/performer rating popup and shows its average canonical rating-point contribution against that criterion's maximum (for example `18/30`) plus the number of entities contributing to that specific average. Missing criteria are excluded per bar, while an intentionally answered zero remains part of the average. Only scenes or performers with at least one criterion from the matching rubric qualify for a section.

Active persisted bonuses and penalties show counts of qualifying scenes or performers, and the automatic recorded-orgasm bonus is counted using the same three-orgasm activation threshold as the popup. Performer criteria and automatic orgasm bonuses remain global performer values, while studio membership comes from the studio's distinct scene performers. The existing Include Subsidiary Studio Content toggle controls whether direct child studios are included.

GraphQL adds `StudioRatingAdvisorStats`, section/criterion/adjustment payload types, and `Studio.studio_rating_advisor_stats(depth:)`. The resolver uses one set-based SQLite aggregate rather than loading full scene/performer cards or issuing one rating query per entity. `TestStudioRatingAdvisorStatsCustomAveragesOnlySetCriteria` executes the aggregate against representative direct/child studio data and covers overall/per-rubric ratings, partial criteria denominators, intentional zero answers, normalized fills, 2-3 performer classification, distinct performers, active adjustments, and the automatic orgasm-count bonus.

Studio card scene-count hovers reuse the Solo Criteria, Standard Criteria, and Group Criteria panels, while performer-count hovers reuse the Performers panel. These panels use the existing aggregate query lazily on first hover and share Apollo's per-studio cache, avoiding per-card Rating Advisor requests during list loading. Their measured popover containers stay within the viewport and scroll vertically when necessary. Both the Studio Stats page and the card/count hover completely omit zero-rated-scene Solo/Standard/Group criteria sections, displaying only the remaining panels side by side on wide screens before collapsing responsively. Studio rating-criteria filters and average sort labels use the same Solo/Standard/Group rubric terminology.

Performer detail Stats tabs reuse the same Solo Criteria, Standard Criteria, and Group Criteria panels, scoped to scenes where that performer appears. The shared performer rating tooltip also appends these scene panels, so the same averages are available from performer cards and the performer detail header. The performer aggregate and tooltip are lazy/cache-backed, and categories with no qualifying scenes are omitted completely.

The performer detail header also paints the overall Scene Average Rating beside the performer's own rating. It uses a blue star without a separate highlighted container and a concise "Scene Average Rating" hover tooltip. The Performers list adds a Scene Average Rating sort using the same Solo/Standard/Group eligibility rules; grid cards show the exact active average through the catalog sort-metric badge.

`TestStudioRatingAdvisorAverageSortExpressionsOrderByDisplayedAverages` executes all four Studio stored-rating sort expressions against representative solo, standard, group, and distinct-performer data.

`TestPerformerSceneAverageRatingExprCustomMatchesRatingAdvisorEligibility` executes the performer sort expression against qualifying Solo, Standard, and Group scenes, excludes scenes without a matching rubric, and verifies the computed averages.

### Files Modified

- `ui/v2.5/src/components/Shared/RatingAdvisor_custom.tsx` - Shared rating modal, scoring definitions, persistence mutation, and button component
- `ui/v2.5/src/components/Shared/ratingAdvisorScales_custom.ts` - Shared progressive O-count calculation used by modal previews and rating popovers
- `ui/v2.5/src/components/Shared/Modal.tsx` - Allows the rating advisor to opt into a header close button while preserving existing modal defaults
- `ui/v2.5/src/components/Shared/ratingAdvisor_custom.scss` - Advisor modal styling
- `ui/v2.5/graphql/data/performer.graphql` - Adds a list-only performer fragment so performer lists do not fetch detail-only rating scores and additional image rows
- `ui/v2.5/graphql/queries/performer.graphql` - Uses the list-only performer fragment for performer lists and keeps a full-data by-ID query for merge/detail workflows
- `ui/v2.5/src/core/StashService.ts` - Routes by-ID performer loads through the full-data query
- `ui/v2.5/src/components/Scenes/SceneDetails/Scene.tsx` - Scene detail advisor button
- `ui/v2.5/src/components/Scenes/SceneCard.tsx` - Lazy criteria tooltip on painted scene-card rating stars
- `ui/v2.5/src/components/Performers/PerformerDetails/Performer.tsx` - Performer detail advisor button and Scene Average Rating header metric
- `ui/v2.5/src/components/Performers/PerformerDetails/PerformerStatsPanel.tsx` - Performer-scoped scene Rating Advisor panels on the Stats tab
- `ui/v2.5/src/components/Performers/PerformerCard.tsx` - Lazy criteria tooltip on painted performer-card rating stars
- `ui/v2.5/src/components/Shared/Rating/RatingSystem.tsx` - Forces ratings to display as 0-100 values
- `ui/v2.5/src/components/Shared/Rating/RatingNumber.tsx` - Simplifies manual ratings to a plain 0-100 input
- `ui/v2.5/src/index.scss` - Imports advisor styling
- `ui/v2.5/src/components/List/styles.scss` - Adds layout for the combined rating criteria filter
- `graphql/schema/types/filters_custom.graphql` - Adds scene/performer rating criteria inputs, numeric bonus-value filters, and average studio scene/performer criteria filters
- `graphql/schema/types/rating_custom.graphql` - Adds canonical score persistence plus individual delete and whole-advisor reset mutations
- `internal/api/resolver_mutation_scene.go`, `internal/api/resolver_mutation_performer.go`, `internal/api/resolver_mutation_configure.go` - Keeps advisor ownership and dependent ratings synchronized across manual ratings, casts, markers, deletion, merges, and role-tag configuration changes
- `rating_scores.up.sql` - Rejects invalid entity types and orphan score rows, and removes score rows automatically when scenes or performers are deleted
- `pkg/models/scene.go`, `pkg/models/performer.go`, `pkg/models/studio.go` - Adds rating criteria filter fields
- `pkg/sqlite/scene.go`, `pkg/sqlite/scene_filter.go`, `pkg/sqlite/performer_filter.go`, `pkg/sqlite/studio_filter.go`, `pkg/sqlite/studio_rating_criteria_custom.go`, `pkg/sqlite/performer_scene_average_rating_sort_custom.go` - Hooks direct and average rating criteria filters into entity queries and provides scene GOAT, Studio, and performer-list stored-rating sorts
- `pkg/sqlite/rating_criteria_filter_custom_test.go` - Covers group key isolation plus numeric and presence filter operators
- `ui/v2.5/src/models/list-filter/scenes.ts`, `ui/v2.5/src/models/list-filter/performers.ts`, `ui/v2.5/src/models/list-filter/studios.ts` - Registers direct/average rating criteria filters plus scene GOAT, Studio, and performer Scene Average Rating sorts
- `ui/v2.5/src/locales/en-GB.json`, `ui/v2.5/src/locales/en-US.json` - Adds rating criteria filter labels
- `graphql/schema/types/studio_custom.graphql` - Adds Studio Rating Advisor aggregate payloads and the depth-aware Studio field
- `graphql/schema/types/stats_custom.graphql` - Adds the performer-scoped Rating Advisor aggregate query
- `ui/v2.5/graphql/queries/studio.graphql` - Adds the lazy Studio Rating Advisor Stats query and shared section fragment
- `ui/v2.5/graphql/queries/stats_custom.graphql` - Fetches performer-scoped scene Rating Advisor averages
- `ui/v2.5/src/components/Studios/StudioDetails/StudioStatsPanel.tsx` - Renders the four rating summaries below the activity charts
- `ui/v2.5/src/components/Studios/StudioCard.tsx` - Adds lazy scene/performer count average-panel hovers

### Files Added

- `ui/v2.5/src/components/Shared/groupSceneRating_custom.ts` - Group threshold, scoring weights, bonus values, persisted keys, and frontend mode selection
- `ui/v2.5/src/components/Shared/soloSceneRating_custom.ts` - Solo scoring weights, persisted keys, and base maximum
- `rating_scores.up.sql` - Standalone manual SQL script for generic persisted rating score tables
- `rating_goat_tiers_review.up.sql` - Idempotently creates `reviewGOAT`, tags legacy +20 GOAT scenes, preserves their values, and relabels them for the tiered UI
- `graphql/schema/types/rating_custom.graphql` - Rating score GraphQL types, mutation, and read-only orgasm-count query
- `internal/api/resolver_rating_score_custom.go` - Rating score query/mutation resolvers
- `internal/api/resolver_rating_score_custom_test.go` - Verifies ownership semantics, cast/mode/config resets, delete behavior, scene rating-zero resets, and performer rating-preserving resets
- `pkg/models/rating_score_custom.go` - Generic rating score model and repository interfaces
- `pkg/sqlite/rating_score_custom.go` - SQLite score store and rating recalculation logic
- `pkg/sqlite/rating_score_calculation_custom.go` - Canonical scene and performer rubrics, exact write validation, and contribution calculation that ignores client/persisted weights
- `pkg/sqlite/rating_score_calculation_custom_test.go` - Covers all five payoff choices (including unchanged contributions for existing values), invalid inputs, legacy normalization, canonical scene/performer contributions, retired-key exclusion, and progressive scene/performer O-count tier totals
- `pkg/sqlite/rating_scene_mode_custom_test.go` - Verifies that exactly one assigned performer selects the solo rubric independently of marker-derived mode hints
- `pkg/sqlite/rating_score_scripts_custom_test.go` - Verifies the persisted rating-score schema, entity lifecycle, and idempotent legacy GOAT tagging while preserving +20 values
- `pkg/sqlite/rating_score_identity_custom_test.go` - Verifies that section-table primary-key collisions produce distinct, stable GraphQL cache identities
- `pkg/models/rating_criteria_filter_custom.go` - Generic rating criteria filter input models
- `pkg/sqlite/rating_criteria_filter_custom.go` - Shared SQLite predicates for criteria/bonus/penalty filters
- `pkg/sqlite/scene_rating_sort_custom.go` - Sorts scenes by the stored GOAT bonus with missing values treated as zero
- `pkg/sqlite/scene_rating_sort_custom_test.go` - Verifies the GOAT bonus sort expression
- `pkg/sqlite/studio_rating_criteria_custom.go` - Opt-in average scene/distinct-performer Studio predicates and numeric criterion sorts
- `pkg/sqlite/studio_rating_criteria_custom_test.go` - Covers average clauses, adjustment presence, and distinct-performer de-duplication in SQLite
- `ui/v2.5/src/models/list-filter/criteria/rating-criteria_custom.ts` - Frontend rating criteria filter criterion classes
- `ui/v2.5/src/components/List/Filters/RatingCriteriaFilter_custom.tsx` - Combined rating criteria filter editor
- `ui/v2.5/src/components/Shared/ratingAdvisorScales_custom.ts` - Shared helpers for simplified rating advisor scales and progressive O-count tiers
- `ui/v2.5/tests/ratingAdvisorScales_custom.test.ts` - Verifies simplified scales, the four positive GOAT bonus tiers, legacy GOAT-zero absence, fresh-score precedence over stale entity snapshots, the five orgasm-quality labels/descriptions, progressive scene/performer O-count totals, point contributions, unrated state, intentional zero scores, and core completion
- `ui/v2.5/tests/ratingCriteriaFilter_custom.test.ts` - Verifies the standard/group Rating Criteria filters, all five orgasm-quality levels, and numeric GOAT bonus serialization
- `ui/v2.5/tests/groupSceneRating_custom.test.ts` - Verifies group mode priority, scoring totals, bonuses, and persisted filter keys
- `ui/v2.5/tests/soloSceneRating_custom.test.ts` - Verifies the solo 50/30/20 scoring total and persisted keys
- `ui/v2.5/src/components/Performers/performerTypes_custom.ts` - Shared performer list/card data type for the lean list query
- `internal/api/studio_rating_advisor_stats_custom.go` - Set-based studio rubric aggregate, per-criterion denominator handling, normalized bar averages, and adjustment counts
- `internal/api/studio_rating_advisor_stats_custom_test.go` - Focused SQLite aggregate coverage for direct/child studios, performer-scoped scene membership, partial advisor data, and level-1 orgasm-quality contributions/fill
- `ui/v2.5/src/components/Performers/PerformerSceneRatingAdvisor_custom.tsx` - Shared performer-scoped section rendering, Stats-tab query state, and header average metric
- `pkg/sqlite/performer_scene_average_rating_sort_custom_test.go` - Executes and verifies the performer Scene Average Rating sort expression and rubric eligibility
- `ui/v2.5/src/components/Studios/StudioDetails/StudioRatingAdvisorStats.tsx` - Four responsive popup-style Rating Advisor average sections
- `ui/v2.5/src/components/Studios/StudioDetails/StudioRatingAdvisorStats.scss` - Studio Rating Advisor section layout and responsive styling
- `ui/v2.5/src/components/Studios/StudioRatingAdvisorPopover_custom.tsx` - Lazy card-count hover wrapper reusing the Studio Stats sections

---

## 38. Mobile Production Deploy Workflow

### Overview

Adds a one-command Windows deploy flow for mobile Codex sessions. The wrapper builds the release binary, stops the two local production Stash instances, backs up each existing executable, copies the new `stash.exe`, and restarts both instances.

Restarted Stash processes are launched hidden with stdout/stderr redirected into each instance's `.deploy-logs` directory. This keeps mobile/agent shells from hanging after a successful deploy because the long-running Stash process is not holding the deploy command's output handles open.

After both production copies and any requested restarts succeed, the backup executables created in each `.deploy-backups` directory and the temporary repository-root `stash.exe` deploy artifact are removed so repeated deployments do not accumulate stale executables.

### Files Added

- `deploy_prod_custom.bat` - Batch entry point for easy execution from mobile/remote shells
- `scripts/deploy_prod_custom.ps1` - PowerShell deploy script with build, stop, backup, copy, and restart steps

### Usage

Run from the repository root:

```bat
deploy_prod_custom.bat
```

Optional flags:

```bat
deploy_prod_custom.bat -SkipBuild
deploy_prod_custom.bat -SkipStart
```

---

## 39. Activity Duration Stats

### Overview

Adds marker-duration stats for configured sex, oral, solo, other, outstanding, standard, and unusable activity percentages. The activity strip has two rows: Sex/Oral/Solo/Other and Outstanding/Standard/Unusable. Sex/oral/solo activity is based on markers whose primary tag exactly matches the configured role tag, even when the marker also has secondary tags. Same-category overlaps are merged, cross-category overlaps count toward each category, and activity Other is runtime without a sex/oral/solo marker. Outstanding is any timed marker that is not a configured sex/oral/solo primary marker, a configured sex/oral/solo primary marker with secondary tags, or any marker carrying the configured GOAT tag or one of its descendants. The GOAT override uses the same configurable marker-tag hierarchy definition as Royal Sapphire marker styling. Standard is unmarked runtime or plain configured sex/oral/solo runtime not overlapped by Outstanding, and negative marker/Skip ranges are merged into Unusable without double-counting overlaps.

Studio cards and the Studio detail Stats tab use the same meaningful-scene denominator: a scene contributes its runtime only when it contains at least one configured oral, solo, or sex primary marker with a valid in-bounds start/end range. Activity and quality values on Studio cards now live in a hover panel on the studio image instead of occupying card-footer rows. Performer-scoped studio cards retain their performer-filtered denominator, with Unusable calculated from negative marker ranges in scenes containing that performer. Performer detail pages include a Stats tab with an activity pie chart and a selected-activity top/bottom role split chart. Scene detail pages keep only zero-suppressed, partitioned Activity Type and Quality overview bars in the sidebar, with duration, percentage, loop selectors, and their own Add to Loop tray. Detailed Scene Stats is unavailable for solo scenes. For scenes with at least two performers, an extra-wide, scrollable modal contains the full Performer Explorer, Interaction Matrix, and sticky loop tray. The overview tray uses only Activity Type and Quality selections, while the detail tray uses only Performer Explorer and Interaction Matrix selections; adding or clearing from either tray never consumes the other scope. The Explorer uses a wrapping full-width performer selector whose active portrait expands in place, avoiding a duplicate focused-performer portrait. Activity & Roles and Partner Interactions each use the full modal width, with Partner Interactions shown only for group scenes containing at least three performers. Partner Interactions uses one row per partner with data-driven Overall, Sex, and Oral columns: empty activity columns are omitted, and Overall appears only when both Sex and Oral contain values. Each activity cell scales its total interaction track relative to that column's strongest partner and places independently selectable blue Topped and green Bottomed For lanes inside it; zero-time lanes stay empty. Total time/percentage and each non-zero role's time/pair-relative percentage are printed directly in the cell and repeated in the tooltip. The highest-time partner cell in each column receives a blue highlight, with exact ties highlighted together. Selected lanes receive a role-colored aura without check/minus glyphs, and an aggregate Overall lane remains visually neutral when only one of its underlying activities is selected. The partner-row selector selects every available direction across Sex and Oral, while either colored lane can send only that role and activity combination to the multi-segment loop. The alternate Interaction Matrix fills the available desktop modal width with large performer portraits and names below each row/column portrait. It is directional: blue row headers represent Top performers, green column headers represent Bottom performers, and opposite Top-to-Bottom directions occupy separate cells. Sex and Oral views show their selected activity, while Both shows one combined, overlap-merged duration and selects both categories for loop insertion. Populated cells contain only their loop checkbox and timestamp; the longest interaction in the selected view receives a blue highlight, with exact ties highlighted together. Empty activity views are omitted from the Matrix selector, and Both is offered only when Sex and Oral both contain interactions. The sticky selection tray keeps the deduplicated segment count, duration, Clear action, and Add to Loop action visible while navigating either view. Partner time comes from opposite-role performers on each timed marker, merges overlapping ranges for the same partner, and is normalized across that performer's partner-time for the activity. One-millisecond Standard intervals are treated as closed gaps and are not added to the loop. Scene and Studio lists expose separate combined Activity Percentage (Sex/Oral/Solo/Other) and Quality Percentage (Outstanding/Standard/Unusable) filters plus individual sorts for all seven percentages. Studio SQL uses the same meaningful-scene denominator as the card/detail aggregates. Performer list pages retain marker-owned activity percentage filters and sorts only.

Each pair percentage uses that performer's unioned, non-duplicated partner-interaction time as its denominator for Sex, Oral, or Overall. Simultaneous interactions retain their full duration in every affected pair numerator but appear only once in the denominator, so partner percentages may correctly sum above 100%.

When a performer has both Sex and Oral activity, Activity & Roles places an Overall card before the individual cards. Overall sums the two activity durations and their Top/Bottom durations, calculates role percentages against that combined total, and exposes combined whole-activity and role-specific loop selectors. It stays hidden when either activity is empty to avoid duplicating a single category. Parent activity percentages measure each performer's participation against the matching scene activity duration (Overall uses the combined scene Sex and Oral duration) rather than the full scene runtime. In scenes with at least three performers, each card prints that total scene activity duration above a clearly named Performer Sex, Oral, Solo, or Overall Participation metric so the percentage denominator remains visible. One- and two-performer scenes omit the redundant Overall, Sex, and Oral participation metrics while retaining their Top/Bottom role breakdowns and selectors; Solo participation remains available.

### Files Modified

- `graphql/schema/types/performer_custom.graphql` - Adds `PerformerActivityStats`
- `graphql/schema/types/studio_custom.graphql` - Adds `StudioActivityStats`
- `graphql/schema/types/filters_custom.graphql` - Adds activity and Scene/Studio quality percentage filters
- `internal/api/activity_stats_custom.go` - Duration stats resolvers and interval merge helpers
- `internal/api/studio_list_stats_custom.go` - Page-level Studio card quality aggregates
- `pkg/models/activity_percent_filter_custom.go` - Activity and quality percentage filter input models
- `pkg/sqlite/activity_percent_filter_custom.go` - SQL activity/quality percentage filter and sort expressions
- `pkg/sqlite/scene.go`, `pkg/sqlite/performer.go`, `pkg/sqlite/studio.go` - Activity percentage sort options
- `ui/v2.5/graphql/data/performer.graphql` - Fetches performer activity stats
- `ui/v2.5/graphql/data/studio.graphql` - Fetches studio activity stats
- `ui/v2.5/graphql/queries/studio.graphql` - Fetches performer-filtered studio activity stats
- `ui/v2.5/graphql/data/scene-slim.graphql` - Fetches negative marker timing for scene-card Unusable percentages
- `ui/v2.5/src/models/list-filter/scenes.ts`, `performers.ts`, `studios.ts` - Activity and Scene/Studio Quality Percentage filter/sort options
- `ui/v2.5/src/models/list-filter/criteria/activity-type_custom.ts`, `ui/v2.5/src/components/List/Filters/ActivityTypeFilter_custom.tsx` - Combined activity percentage filter UI
- `ui/v2.5/src/components/Performers/PerformerCard.tsx` - Sort-specific activity percentage display
- `ui/v2.5/src/components/Shared/styles.scss` - Shared activity pie chart styling
- `ui/v2.5/src/components/Shared/ActivityPieChart_custom.tsx` - Supports performer images in partner-slice tooltips and deterministic entity colors
- `ui/v2.5/src/components/Studios/StudioCard.tsx` - Studio image activity/quality hover panel
- `ui/v2.5/src/components/Studios/StudioActivityMetricsStrip.tsx` - Shared studio activity strip component
- `ui/v2.5/src/components/Studios/styles.scss` - Studio activity strip styling
- `ui/v2.5/src/components/Scenes/styles.scss` - Compact Stats overview, extra-wide detail modal, larger performer portraits, sticky loop tray, and responsive directional interaction matrix layout
- `ui/v2.5/src/components/Studios/StudioDetails/Studio.tsx` - Studio Stats tab
- `ui/v2.5/src/components/Performers/PerformerDetails/Performer.tsx` - Performer Stats tab
- `ui/v2.5/src/components/Scenes/SceneDetails/Scene.tsx` - Scene Stats tab
- `ui/v2.5/src/components/Scenes/SceneDetails/SceneStatsPanel.tsx` - Renders compact sidebar overview bars and their independently scoped loop tray, plus the focused performer explorer, simultaneous Overall/Sex/Oral partner lanes, directional Sex/Oral/Both matrix, and independently scoped sticky loop tray in a large detail modal
- `ui/v2.5/src/components/Scenes/sceneActivityMetricsData_custom.ts` - Shared Scene card/list activity and quality calculation

### Files Added

- `ui/v2.5/src/components/Performers/PerformerDetails/PerformerStatsPanel.tsx`
- `ui/v2.5/src/components/Scenes/SceneDetails/SceneStatsPanel.tsx`
- `ui/v2.5/src/components/Scenes/SceneDetails/sceneStatsLoopSegments_custom.ts`
- `ui/v2.5/src/components/Scenes/SceneDetails/sceneStatsPartnerInteractions_custom.ts`
- `ui/v2.5/src/components/Scenes/SceneDetails/sceneStatsPerformerActivity_custom.ts`
- `ui/v2.5/src/models/list-filter/criteria/quality-type_custom.ts`
- `ui/v2.5/src/components/List/Filters/QualityTypeFilter_custom.tsx`
- `ui/v2.5/src/components/Shared/ActivityPieChart_custom.tsx`
- `ui/v2.5/src/components/Shared/activityPieChartTooltip_custom.ts`
- `ui/v2.5/src/components/Studios/StudioDetails/StudioStatsPanel.tsx`
- `ui/v2.5/src/components/Studios/StudioActivityMetricsStrip.tsx`
- `ui/v2.5/tests/activityPieChartTooltip_custom.test.ts`
- `ui/v2.5/tests/sceneStatsLoopSegments_custom.test.ts`
- `ui/v2.5/tests/sceneStatsPartnerInteractions_custom.test.ts`
- `ui/v2.5/tests/sceneStatsPerformerActivity_custom.test.ts`

### Test Cases

- `internal/api/activity_stats_custom_test.go`, `internal/api/studio_list_stats_custom_test.go` - Verifies interval math, GOAT activity markers count as Outstanding, and card aggregates exclude scenes without valid timed role markers
- `pkg/sqlite/activity_percent_quality_filter_custom_test.go` - Verifies GOAT descendants count as Outstanding and Outstanding/Standard/Unusable SQL percentages are overlap-safe, mutually exclusive, and partition the full Scene runtime
- `ui/v2.5/tests/sceneActivityMetricsData_custom.test.ts` - Verifies configured GOAT descendants count as Outstanding in shared Scene metrics
- `ui/v2.5/tests/activityPieChartTooltip_custom.test.ts` - Verifies slice tooltips show names and percentages without durations, follow the cursor, and stay within viewport edges
- `ui/v2.5/tests/sceneStatsLoopSegments_custom.test.ts` - Verifies one-millisecond closed gaps are not emitted as multi-segment loop segments and that overview/detail loop actions exclude the other scope's selections
- `ui/v2.5/tests/sceneStatsPartnerInteractions_custom.test.ts` - Verifies opposite-role Sex/Oral/Overall partner distributions, max-relative partner bar scaling, per-pair Topped/Bottomed For splits, role-lane activity selection, partner images, simultaneous partners, overlap merging, canonical pair selection, distinct directional matrix cells, directional percentages, and combined Both-mode interval merging
- `ui/v2.5/tests/sceneStatsPerformerActivity_custom.test.ts` - Verifies Overall sums Sex and Oral totals and Top/Bottom metrics, derives role percentages from the combined duration, and stays hidden when either activity is empty

---

## 40. Custom Settings Tab

### Overview

Adds a dedicated Settings > Custom tab for fork-only configuration that is not part of upstream Stash. This keeps upstream settings pages cleaner and gives custom features a single configuration home.

### Settings Included

- Multi-segment loop controls toggle
- Simple marker preview skip-tag picker and cleanup action
- Marker preview source-quality and quality-check toggles
- Scene marker role tag IDs
- Premium/classic rating card theme, thresholds, and override tags
- Application-wide Stash dark/Black Steel visual theme

### Files Modified

- `ui/v2.5/src/components/Settings/Settings.tsx` - Adds the Custom tab route, nav item, and tab pane
- `ui/v2.5/src/components/Settings/SettingsInterfacePanel/SettingsInterfacePanel.tsx` - Removes fork-only settings now owned by the Custom tab
- `ui/v2.5/src/components/Settings/SettingsSystemPanel.tsx` - Removes fork-only system settings now owned by the Custom tab
- `ui/v2.5/src/locales/en-GB.json` - Adds the Custom settings category label

### Files Added

- `ui/v2.5/src/components/Settings/SettingsCustomPanel.tsx` - New consolidated custom settings page

---

## 41. Custom Filter Name Highlighting

### Overview

Custom filter criteria are highlighted in green in the Edit Filter picker so fork-only filters are easy to distinguish from upstream filters while scanning the list.

### Files Modified

- `ui/v2.5/src/components/List/EditFilterDialog.tsx` - Adds a custom criterion class to matching filter picker rows
- `ui/v2.5/src/components/List/styles.scss` - Styles custom filter names in green

### Files Added

- `ui/v2.5/src/models/list-filter/custom-filter-options_custom.ts` - Central list/helper for custom filter criterion types

### Test Cases Added

- No automated tests added; verified with targeted UI lint, Prettier, TypeScript compile, and whitespace checks.

### GraphQL Schema Changes

- None.

### Configuration Dependencies

- None.

---

## 42. Hidden O Stats Timeline

### Overview

Adds a hidden `/ostats` page for scene O analytics. The page is intentionally not linked from the main UI; it is accessible by typing the URL, from tag-card O counters when a tag has timestamped O events, and from either control in a performer-card O counter for a vato drilldown in a new tab. The root page shows O-date record cards and clickable bar charts by O date year/month/day, activity type, marker tag, associated vato ethnicity, vato country, scene studio, vato age at the scene's effective release date, and scene effective release year. The Activity Type chart contains only the configured Sex, Oral, and Solo marker tags; the Marker Tag chart excludes those three tags as well as tags hidden by the OStats exclusion setting. The Year/Month/Day navigation is only shown for the O-date chart path; country, studio, performer age, and scene release year stay in count-sorted horizontal, scrollable graphs. Every chart has an O-event timeline drilldown and a discrete Unknown chip when applicable. Country codes are displayed as readable country names across OStats, VatoStats, and SceneStats while their original values remain intact for filtering. The date charts only use reliable O dates from March 8, 2024 onward, while the other charts include every recorded O. Timelines are newest-first; each row shows associated marker tags and an ordinal chip such as `2nd O`, while the earliest dated O recorded for its scene shows the green `NEW` chip instead of a redundant `1st O`. Scene and vato links open newest-first `/ostats/scene/<scene id>` and `/ostats/vato/<performer id>` detail timelines; those detail timelines then link through to the actual scene at the O timestamp or performer page. The Generate task can also create exact static screenshots for O events that have a `video_timestamp`, and the timelines use those O screenshots when available.

### Files Modified

- `graphql/schema/types/stats_custom.graphql` - Adds month/day bucket plus tag/ethnicity/country/studio/performer-age/release-year/Unknown timeline GraphQL types and queries, including associated marker tags and per-scene ordinal numbers on O events
- `graphql/schema/types/metadata_custom.graphql` - Extends Generate metadata input/default options with `oScreenshots`
- `internal/api/resolver_custom.go` - Adds O stats period resolvers, compact aggregate queries, O date record resolvers, timestamped marker-tag counts, per-event associated marker tags and per-scene ordinal/first-for-scene flags, and tag/ethnicity/country/studio/performer-age/release-year/scene/vato drilldowns for `/ostats`. All timelines are newest-first. The reliable-date cutoff is limited to O-date stats; all other O aggregates and drilldowns include every O record.
- `internal/api/routes_scene.go` - Registers the O screenshot route
- `internal/manager/task_generate.go` - Queues O screenshot generation from the Generate task
- `pkg/models/generate.go` - Stores the O screenshot Generate default flag
- `ui/v2.5/graphql/data/config.graphql` - Includes the O screenshot Generate default flag
- `ui/v2.5/src/App.tsx` - Adds the hidden `/ostats/:year?/:month?/:day?`, `/ostats/tag/:tagId`, `/ostats/ethnicity/:ethnicity`, `/ostats/country/:country`, `/ostats/studio/:studioId`, `/ostats/age/:performerAge`, `/ostats/release-year/:releaseYear`, `/ostats/unknown/:unknownCategory`, `/ostats/scene/:sceneId`, and `/ostats/vato/:performerId` routes
- `ui/v2.5/src/components/Shared/PopoverCountButton.tsx` - Adds a compact O-count popover button type for tag cards
- `ui/v2.5/src/components/Tags/TagCard.tsx` - Shows an O-count card counter linked to `/ostats/tag/<tag id>` only when the tag has OStats events
- `ui/v2.5/src/components/Performers/PerformerCard.tsx` - Opens that vato's `/ostats/vato/<performer id>` timeline in a new tab from either performer-card O-counter control
- `ui/v2.5/src/components/Performers/PerformerDetails/Performer.tsx` - Opens that vato's O timeline in a new tab from either O-counter control on the performer detail page
- `ui/v2.5/src/components/Studios/StudioCard.tsx` - Opens that studio's `/ostats/studio/<studio id>` timeline in a new tab from either studio-card O-counter control everywhere the shared card is used
- `ui/v2.5/src/components/Settings/Tasks/GenerateOptions.tsx` - Adds the O screenshots checkbox
- `ui/v2.5/src/locales/en-GB.json` - Adds O screenshot Generate labels
- `ui/v2.5/src/locales/en-US.json` - Adds O screenshot Generate labels

### Files Added

- `internal/api/routes_scene_custom.go` - Serves generated O screenshots and validates the O row belongs to the scene
- `internal/manager/task_generate_o_screenshots_custom.go` - Finds timestamped O rows and generates exact screenshots
- `pkg/models/paths/paths_generated_custom.go` - Adds generated O screenshot path helpers
- `pkg/models/paths/paths_generated_custom_test.go` - Covers generated O screenshot paths
- `pkg/scene/generate/o_screenshot_custom.go` - Adds generator support for O screenshot output paths
- `ui/v2.5/src/components/OStats/OStats.tsx` - Hidden O stats chart and timeline page
- `ui/v2.5/src/components/OStats/OStats.scss` - Page-specific chart and timeline styles
- `ui/v2.5/src/components/OStats/oStatsEventPresentation_custom.ts` - Formats per-scene O ordinal labels
- `ui/v2.5/src/components/OStats/oStatsMarkerTagCharts_custom.ts` - Splits configured Sex, Oral, and Solo activity tags from all other visible O marker-tag counts
- `ui/v2.5/src/utils/statsCountry_custom.ts` - Converts ISO country codes to readable country labels without changing filter values
- `ui/v2.5/src/utils/oStatsNavigation_custom.ts` - Builds encoded OStats studio, scene, and vato drilldown URLs plus second-click entity URLs
- `ui/v2.5/tests/oStatsNavigation_custom.test.ts` - Covers OStats drilldown URL construction, encoding, and detail-to-entity navigation
- `ui/v2.5/tests/statsCountry_custom.test.ts` - Covers country-code labels and passthrough values
- `internal/api/resolver_custom_test.go` - Date validation tests for O stats helpers
- `internal/api/o_stats_events_custom_test.go` - Covers per-scene O ordinal selection and scene drilldown ID validation
- `ui/v2.5/tests/oStatsEventPresentation_custom.test.ts` - Covers ordinal suffixes for timeline chips
- `ui/v2.5/tests/oStatsMarkerTagCharts_custom.test.ts` - Covers activity-type partitioning and OStats marker-tag exclusions

### Test Cases Added

- `TestSceneOStatsDate` - Covers valid dates, leap day, invalid months, and invalid day/month combinations
- `TestValidateSceneOStatsDate` - Covers accepted `YYYY-MM-DD` dates and rejected malformed/impossible dates
- `TestSceneOStatsPerformerID` - Covers accepted positive vato IDs and rejected invalid vato IDs
- `TestSceneOStatsSceneID` - Covers accepted positive scene IDs and rejected invalid scene IDs
- `TestSceneOStatsStudioID` - Covers accepted positive studio IDs and rejected invalid studio IDs
- `TestSceneOStatsCountryFilter` - Covers trimmed and blank country drilldown values
- `TestSceneOStatsPerformerAge` - Covers accepted and rejected performer-age drilldown values
- `TestSceneOStatsReleaseYear` - Covers accepted and rejected release-year drilldown values
- `TestSceneOEventAssociatedTagsFromCandidates` - Covers deduping associated marker tags and preferring orgasm marker tags when available
- `TestSceneOEventOrdinalsQueryRanksEventsChronologicallyPerScene` - Covers ordinal ranking, timestamp tie-breaking, null-date exclusion, and per-scene isolation
- `TestGetOScreenshotPath` - Covers generated O screenshot path layout by scene hash and O row id
- `statsCountry_custom.test.ts` - Covers readable US/MX/GB country labels, existing full country names, Unknown, and blank values
- `oStatsNavigation_custom.test.ts` - Covers encoded studio/scene/vato drilldown paths and detail-to-entity scene timestamp/vato links

### GraphQL Schema Changes

- `GenerateMetadataInput.oScreenshots`
- `GenerateMetadataOptions.oScreenshots`
- `SceneOMonthCount`
- `SceneODayCount`
- `SceneOEvent.associated_tags`
- `SceneOEvent.is_first_for_scene`
- `SceneOEvent.scene_o_number`
- `sceneOMonthCounts(year: Int!)`
- `sceneODayCounts(year: Int!, month: Int!)`
- `sceneOEventsByDate(date: String!)`
- `sceneOEventsByTag(tagID: ID!)`
- `sceneOEventsByScene(sceneID: ID!)`
- `sceneOCountWithoutMarkerTags`
- `sceneOEventsWithoutMarkerTags`
- `sceneOEventsByPerformer(performerID: ID!)`
- `sceneOEventsByEthnicity(ethnicity: String!)`
- `sceneOCountsByCountry`
- `sceneOEventsByCountry(country: String!)`
- `SceneOCountByStudio`
- `SceneOCountsByStudio`
- `sceneOCountsByStudio`
- `sceneOEventsByStudio(studioID: ID!)`
- `sceneOEventsWithUnknownStudio`
- `sceneOCountsByPerformerAge`
- `sceneOEventsByPerformerAge(age: Int!)`
- `sceneOEventsWithUnknownPerformerAge`
- `sceneOCountsByReleaseYear`
- `sceneOEventsByReleaseYear(year: Int!)`
- `sceneOEventsWithUnknownReleaseYear`
- `sceneOUnreliableDateCount`
- `sceneOEventsBeforeTrackingStart`
- `mostOsInDay`
- `longestPeriodWithoutO`
- `sceneOCountsByTag`
- `sceneOCountsByEthnicity`

### Configuration Dependencies

- Uses the existing hard-coded reliable O-date cutoff: `sceneODateTrackingStart = "2024-03-08"`, only for the O date year/month/day charts, summaries, and date drilldowns. The Unknown year-chart control covers the excluded O records.
- Uses `roleTagIds.oStatsExcludedTagIds` to hide configured tags from the marker-tag bar chart.

---

## 43. Vato UI Vocabulary

### Overview

Renames the user-facing English UI vocabulary from Performer/Performers to Vato/Vatos while preserving the upstream backend, database, GraphQL, route, plugin API, and code identifiers that still use performer naming.

### Files Modified

- `ui/v2.5/src/locales/en-GB.json` - Base English translations for performer-facing UI labels.
- `ui/v2.5/src/locales/en-US.json` - US English overrides for custom performer-facing labels.
- `ui/v2.5/src/components/**` and `ui/v2.5/src/models/**` - Hard-coded fallback labels, tooltips, rating advisor text, stats headings, and fallback unnamed-performer labels that can appear when translations are missing.
- `ui/v2.5/src/utils/navigation.ts`, `ui/v2.5/src/utils/navigation_custom.ts`, and `ui/v2.5/src/core/performers.ts` - Visible fallback filter labels such as `Vato 123` when a performer name is unavailable.

### Test Cases Added

- No automated tests added; this is a UI vocabulary-only change. Verified with targeted UI lint, Prettier, TypeScript compile, backend compile, and whitespace checks.

### GraphQL Schema Changes

- None. Performer terminology remains unchanged in schema, generated types, routes, database tables, and API/plugin contracts.

### Configuration Dependencies

- None.

---

## 44. Vato Stats Page

### Overview

Adds a hidden `/vatostats` page focused on vato aggregate analytics. A clearable Studio selector can scope the dashboard to vatos with scenes from that Studio, with an Include child studios switch; all scene-derived counts, O totals, role metrics, age distributions, summary cards, tier rows, charts, podiums, Rating Advisor averages, and performer drilldown links honor the selected scope. The same reusable dashboard appears as the Studio detail `Vato Stats` tab at `/studios/:id/vatostats`, fixed to that Studio and governed by the detail page's Include child studio content switch. The page shows linked vato summary cards, preserving their drilldown links and including solo-only and one-scene vatos, a top-three podium for a selectable metric ordered left-to-right as gold, silver, and bronze, the moved Tier vatos by ethnicity table, performer Rating Advisor averages, plus coordinated vertical bar charts for ethnicity, exact scene age, rating buckets, metallic rating, height buckets, country, hair color, eye color, circumcision status, and rounded exact penis size. Rolling-year podium options include O Count from recorded O dates in the last year and Rating limited to performers created in the last year. The podium metric selector sits with the podium descriptor instead of in the page header. The Metallic Rating chart includes a None bar for explicitly set ratings that do not qualify for any configured metallic tier; null/unset ratings are excluded from None. Clicking a bar drills into that category/value and refreshes the podium plus every chart from the filtered vato set; Back and Clear controls unwind the drill-down. Unknown values are shown as separate chart-header counters so a large Unknown population does not compress the visible bars.

### Files Modified

- `graphql/schema/types/stats_custom.graphql` - Adds `VatoStatsPerformer`, `VatoStatsAgeCount`, and the optionally Studio-scoped `vatoStatsPerformers(studio_id, depth)` query.
- `internal/api/resolver_custom.go` - Adds the `vatoStatsPerformers` resolver, including optional Studio-tree scoping, scene O counts from `scenes_o_dates`, most recent O date, career span, scene counts, demographic fields, exact scene-age counts, metallic rating tier, image URLs, optimized batched sex/oral/solo role scene counts, and facial role marker counts using primary or secondary facial tags and descendants. The initial aggregate pre-groups O records per scene and computes career span in the main performer-scene pass to avoid row multiplication and a duplicate association scan; sex, oral, and facial roles are calculated together in one marker scan.
- `internal/api/resolver_custom_test.go` - Adds focused tests for exact scene-age helper behavior, Unknown cleanup, and ID-filter safety.
- `internal/api/vato_stats_query_custom_test.go` - Verifies that the optimized aggregate query counts each scene and O event once, finds the latest O date, computes career span, preserves zero-O vatos, classifies rolling-year O events and performer creation dates, and excludes unrelated Studios from a direct-Studio scope.
- `ui/v2.5/src/App.tsx` - Adds the hidden `/vatostats` route.
- `ui/v2.5/src/components/VatoStats/VatoStats.tsx` - Exposes the reusable dashboard with either its global Studio selector or a fixed Studio scope.
- `ui/v2.5/src/components/Studios/StudioDetails/Studio.tsx` - Renames the existing tab to Scene Stats and adds the Vato Stats tab.

### Files Added

- `ui/v2.5/src/components/VatoStats/VatoStats.tsx` - VatoStats page, moved linked summary stat cards, metric selector, podium, filtered performer list, drill-down state, and charts. Auxiliary summary/filter counts are deferred until the core vato dataset arrives, and only configured role tags are fetched.
- `ui/v2.5/src/components/VatoStats/VatoStats.scss` - Page-specific podium and chart styles.
- `ui/v2.5/src/components/VatoStats/VatoStatsRatingAdvisor_custom.tsx` - Lazy performer Rating Advisor section with optional Studio-tree scoping.
- `ui/v2.5/src/utils/metallicRatingChart_custom.ts` - Shared None/metallic chart bucket classification for SceneStats and VatoStats.
- `ui/v2.5/tests/metallicRatingChart_custom.test.ts` - Verifies set-but-unqualified ratings use None while null/unset ratings do not.
- `ui/v2.5/src/components/VatoStats/vatoStatsStudioScope_custom.ts` - Derives Studio-scoped summary, role, and tier aggregates from the compact vato rows.
- `ui/v2.5/src/components/StatsStudioSelector_custom.tsx` - Shared clearable Studio selector and child-Studio depth switch for SceneStats and VatoStats.
- `ui/v2.5/tests/vatoStatsStudioScope_custom.test.ts` - Verifies Studio-only summary, role, and tier calculations.
- `ui/v2.5/src/components/Studios/StudioDetails/StudioVatoStatsPanel.tsx` - Embeds VatoStats with the Studio detail scope and child-Studio depth selection.
- `internal/api/vato_stats_role_counts_custom.go` - Combines sex, oral, and facial role aggregation into one scoped marker query.

### Test Cases Added

- `TestVatoStatsAgeRange` - Covers exact scene-age labels.
- `TestVatoStatsSetAgeCount` - Covers merging repeated scene-age counts.
- `TestVatoStatsPerformersQueryCustomAggregatesSceneOsAndCareerOnce` - Covers the pre-aggregated scene-O and single-pass career-span query.
- `TestVatoStatsRoleCountsQueryCustomCombinesRoleMarkerScans` - Covers the combined role query, descendant tags, primary-versus-secondary tag semantics, facial de-duplication, and performer scoping.
- `metallicRatingChart_custom.test.ts` - Covers None, null/unset ratings, zero ratings, recognized tiers, and tag-override tiers without a stored rating.
- `vatoStatsStudioScope_custom.test.ts` - Covers direct versus child-Studio scope construction, scoped penis/O summaries, role classifications, solo-only and one-scene counts, and ethnicity/tier rows.

### GraphQL Schema Changes

- `VatoStatsAgeCount`
- `VatoStatsPerformer`
- `VatoStatsPerformer.solo_scene_count`
- `vatoStatsPerformers(studio_id, depth)`

### Configuration Dependencies

- Uses existing `roleTagIds` configuration for optimized sex top/bottom marker role counts.

---

## 45. Scene Stats Page

### Overview

Adds `/scenestats` and retires `/customstats`. SceneStats owns the old scene metrics from CustomStats while adding scene podium metrics and scene distribution charts. A clearable Studio selector can scope the global page to one Studio tree, while the same dashboard powers the Studio detail Scene Stats tab at `/studios/:id/stats`, where every dataset, summary, insight, and scene/marker drilldown is scoped to that Studio; both surfaces expose or honor an Include child studios switch. Both routes support release year/month drilldowns. The page separates the original dashboard into an Overview section and a lazy Activity & Ratings section containing Activity Type and Quality donuts plus Solo, Standard, and Group Rating Advisor averages. The podium metric selector sits directly above the podium instead of in the page header. The Metallic Rating chart includes a None bar for explicitly set ratings that do not qualify for a configured tier, without classifying null/unset ratings as None. Zero or absent vato/facial counts, zero or absent ordinary ratings, null metallic ratings, missing/invalid release parts, and scenes without a recognized sex/oral/solo type use each chart's Unknown counter instead of zero-value bars; a stored metallic rating of zero remains None. Release year charts drill down to month and day; day bars link to the Scenes page filtered by effective release date.

### Files Added

- `ui/v2.5/src/components/SceneStats/SceneStats.tsx`
- `ui/v2.5/src/components/SceneStats/SceneStats.scss`
- `ui/v2.5/src/components/SceneStats/sceneStatsDuration_custom.ts`
- `ui/v2.5/src/components/SceneStats/sceneStatsFacialCounts_custom.ts`
- `ui/v2.5/src/components/SceneStats/sceneStatsChartBuckets_custom.ts`
- `ui/v2.5/src/components/SceneStats/sceneStatsCompactData_custom.ts`
- `ui/v2.5/src/components/SceneStats/useSceneStatsCompactQuery_custom.ts`
- `ui/v2.5/src/components/SceneStats/SceneStatsInsights_custom.tsx`
- `ui/v2.5/src/components/Shared/ActivityStatsCharts_custom.tsx`
- `ui/v2.5/tests/sceneStatsDuration_custom.test.ts`
- `ui/v2.5/tests/sceneStatsFacialCounts_custom.test.ts`
- `ui/v2.5/tests/sceneStatsChartBuckets_custom.test.ts`
- `ui/v2.5/tests/sceneStatsCompactData_custom.test.ts`
- `ui/v2.5/src/utils/metallicRatingChart_custom.ts`
- `ui/v2.5/tests/metallicRatingChart_custom.test.ts`

### Files Modified

- `ui/v2.5/src/App.tsx` - Adds `/scenestats/:year?/:month?` and removes `/customstats`.
- `ui/v2.5/src/components/Stats.tsx` - Replaces the Custom Stats card with Scene Stats.
- `ui/v2.5/src/pluginApi.tsx` - Exposes SceneStats instead of CustomStats.
- `ui/v2.5/src/components/VatoStats/VatoStats.tsx` - Receives the Tier vatos by ethnicity table.
- `graphql/schema/types/stats_custom.graphql` - Adds compact `SceneStatsResult` data types and the `sceneStats` query.
- `internal/api/resolver_custom.go` - Adds a set-based compact SceneStats resolver that fetches per-scene scalar, performer, scene-tag, and marker-tag data without resolving full GraphQL relationships for every scene.
- `internal/api/activity_stats_custom.go`, `internal/api/studio_rating_advisor_stats_custom.go` - Add global activity/quality and Rating Advisor aggregates while retaining Studio-scoped behavior.
- `ui/v2.5/graphql/queries/stats_custom.graphql` - Adds lazy SceneStats insights and VatoStats performer-rating queries.
- `ui/v2.5/src/components/SceneStats/SceneStats.tsx` - Uses the compact SceneStats dataset and no longer fetches every scene file, performer object, marker object, tag object, or O-history list.
- `ui/v2.5/src/components/SceneStats/sceneStatsFacialCounts_custom.ts` - Supports compact marker tag-ID groups.
- `ui/v2.5/src/components/Studios/StudioDetails/StudioStatsPanel.tsx`, `Studio.tsx`, and `ui/v2.5/src/components/Studios/Studios.tsx` - Reuse SceneStats in the Studio tab and retain its release drilldown route.
- `internal/api/scene_stats_scope_custom.go` - Shares optional global/Studio-tree scene scoping across SceneStats resolvers.
- `internal/api/compression_custom.go` and `internal/api/server.go` - Preserve the default HTTP compression types and add gqlgen's `application/graphql-response+json` MIME type.
- `ui/v2.5/src/components/StatsStudioSelector_custom.tsx` and `statsPage_custom.scss` - Add the shared Studio selector and responsive layout used by both global dashboards.

### Features

- Podium metrics: O Count, Rating, Duration, File Size, Most Recent O, Vato Count, Facial Count, plus rolling-year O Count, Rating, Vato Count, and Facial Count. Rolling-year ratings include only scenes created in the last year; Vato Count ranks scenes whose effective release date is within the last year by their total performer count; Facial Count counts every facial in scenes whose effective release date is within the last year; and O Count uses recorded O dates in the last year.
- Charts: By Vato Ethnicity, By Vato Country, By Vato Count, By Release Year/Month/Day, Has Facial, By Number of Facial, By Number of Really Hot Facial, Scene Type, By Length/Duration, By Resolution.
- Duration chart bucketing: 0-4 minutes is grouped together, 5-45 minutes remains individual, and durations after 45 minutes are grouped in five-minute buckets such as 46-50 and 51-55.
- Preserves the existing scene category metric button icons, colors, and links from the retired CustomStats page.
- Performance: SceneStats now uses a small number of set-based SQL queries and a compact payload. It avoids the previous `findScenes(per_page: -1)` request with deeply nested relationship fields, returns only the most recent O date needed for the Most Recent O metric, scopes file/O aggregates before grouping, pre-aggregates Royal Sapphire bonus scenes once, and returns marker groups only for the configured dashboard tag families. The six marker count/duration totals are requested after the compact scene dataset arrives so they no longer block the first dashboard render. The large scene dataset uses short GraphQL response aliases plus a typed decoder and bypasses Apollo entity normalization; GraphQL JSON responses are gzip-eligible under their standards-based response MIME type.
- Global insights: Activity and Quality use the same meaningful-scene denominator and shared donut component as Studio Stats. Rating criteria include all three scene rubrics; global performer criteria intentionally appear in VatoStats.
- Studio SceneStats: all compact scene data, O/facial totals, activity durations, Activity & Quality charts, and Rating Advisor averages use the selected Studio scope. Studio-scoped category and marker links preserve that scope, including the child-Studio depth selection.

### Test Cases Added

- `sceneStatsFacialCounts_custom.test.ts` verifies facial and really-hot facial counting from compact marker tag-ID groups, the original marker shape, and Facial Count podium ordering.
- `sceneStatsPodiumEligibility_custom.test.ts` verifies that rolling-year Vato Count and Facial Count podiums exclude scenes released before the rolling year while rolling-year Rating retains scene-creation eligibility.
- `sceneStatsChartBuckets_custom.test.ts` verifies zero/null Unknown classification, metallic zero-versus-null behavior, activity-type precedence, the `9999` unknown-year sentinel, and invalid/missing month/day handling.
- `sceneStatsCompactData_custom.test.ts` verifies every compact response alias expands to the existing SceneStats dashboard model.
- `metallicRatingChart_custom.test.ts` verifies shared SceneStats/VatoStats metallic bucket labels and ordering, including the set-rating-only None bucket.
- `internal/api/scene_stats_activity_time_custom_test.go` verifies completed sex/oral marker duration totals, exclusion of missing/invalid ends, exact activity-tag separation, and performer-independent counting.
- `internal/api/activity_stats_custom_test.go` verifies global and Studio scene-scope construction.
- `internal/api/studio_rating_advisor_stats_custom_test.go` verifies global averages include scenes and performers without a Studio while Studio-scoped results remain isolated.
- `internal/api/scene_stats_past_year_custom_test.go` verifies rolling-year scene creation, effective release, and O eligibility, release-scoped performer counts, scoped base aggregates, pre-aggregated bonus lookup, and compact dashboard-tag marker rows.
- `internal/api/scene_stats_scope_custom_test.go` verifies global and recursive Studio scope SQL construction plus invalid-ID handling.
- `internal/api/stats_marker_counts_custom_test.go` verifies weighted SceneStats marker totals exclude unrelated Studios and honor the child-Studio depth selection.
- `internal/api/compression_custom_test.go` verifies both ordinary JSON and GraphQL response JSON are gzip-compressed without dropping the server's existing compression behavior.

### GraphQL Schema Changes

- `SceneStatsMarkerTagGroup`
- `SceneStatsScene`
- `SceneStatsResult`
- `sceneStats(studio_id, depth)`
- `sceneStatsActivity(studio_id, depth)`
- `globalRatingAdvisorStats(studio_id, depth)`
- `sceneOrgasmCount(studio_id, depth)` / `sceneFacialCount(studio_id, depth)`
- `totalOrgasmTime(studio_id, depth)` / `totalFacialTime(studio_id, depth)`
- `totalSexTime(studio_id, depth)` / `totalOralTime(studio_id, depth)`

### Configuration Dependencies

- Uses existing `configuration.ui.roleTagIds` for sex, oral, solo, facial, orgasm, and really-hot facial marker categorization.

---

## 46. Scene Marker Gap Warning

### Overview

Adds a warning to the scene marker and negative marker create/edit forms when the current start/end times would leave a 3-second-or-less unmarked gap or marker overlap next to the nearest relevant marker range. Tiny-gap warnings are suppressed when any other scene or negative marker covers the gap, regardless of marker lane. The warning identifies the preceding/following marker type, displays the gap/overlap length in milliseconds, can close the previous issue by moving the marker start to one millisecond after the previous marker ends, close the next issue by moving the marker end to one millisecond before the next marker starts, or close both when both sides qualify. Scene marker warnings can also close the previous/next issue by adjusting the adjacent marker instead, including a "Fix both on other marker" batch action when both adjacent markers are known. One-millisecond gaps are treated as already closed.

Markers are checked in separate lanes. Activity markers based on configured sex, oral, and solo `roleTagIds` warn about small gaps or overlaps with other activity markers and negative markers. Highlight markers warn about small gaps or overlaps with other highlight markers and negative markers. Negative markers warn about small gaps or overlaps with activity markers, highlight markers, and other negative markers. Descendant activity tags already present on loaded marker data are treated as activity markers.

### Files Modified

- `ui/v2.5/src/components/Scenes/SceneDetails/SceneMarkerForm.tsx` - Shows the warning and applies the close-gap actions for scene markers.
- `ui/v2.5/src/components/Scenes/SceneDetails/SceneNegativeMarkerForm.tsx` - Shows the warning and applies the close-gap actions for negative markers.
- `CUSTOM_FEATURES.md` - Documents the custom feature.

### Files Added

- `ui/v2.5/src/components/Scenes/SceneDetails/sceneMarkerGapWarning_custom.ts` - Gap detection helper.
- `ui/v2.5/tests/sceneMarkerGapWarning_custom.test.ts` - Focused helper tests.

### Test Cases Added

- Verifies next-gap closing sets end time to one millisecond before the next marker starts.
- Verifies previous-gap closing sets start time to one millisecond after the previous marker ends.
- Verifies previous and next overlaps of three seconds or less are warned and adjusted.
- Verifies warnings include the adjacent marker type.
- Verifies one-millisecond gaps do not produce warnings.
- Verifies activity markers warn against other activity markers and negative markers.
- Verifies activity and highlight markers do not warn against each other.
- Verifies negative markers warn against both activity markers and highlight markers.
- Verifies negative markers count as relevant coverage.
- Verifies editing a negative marker does not warn against its own saved range.
- Verifies gaps larger than three seconds are ignored.
- Verifies overlaps larger than three seconds are ignored.
- Verifies warnings expose both adjacent marker fixes for the batch other-marker action.
- Verifies tiny-gap warnings are suppressed when a marker from any lane covers the previous or next gap.

### GraphQL Schema Changes

- None.

### Configuration Dependencies

- Uses existing `configuration.ui.roleTagIds.sexTagId`, `oralTagId`, and `soloTagId` to split activity markers from highlight markers for gap calculations.

---

## 47. Scene Marker Chronological Tab Layout

### Overview

Replaces the visible scene detail Markers tab body with a custom chronological marker list by default while keeping the upstream primary-tag grouped layout available behind the Custom Settings "Show official scene marker layout" toggle. The custom layout now uses one unified section instead of separate Activity Type and Highlights subtabs. Activity Type remains the main grouping pattern: markers are grouped under Oral, Sex, Solo, Feet, Orgasm, then Facial section headers, and markers that share the same primary activity tag plus top/bottom performer configuration are combined into one group. Facial-tagged orgasm markers are assigned to Facial instead of the standard Orgasm section, including when the facial match comes from a child tag. Compact high-contrast section headers show coverage and duration without taking additional vertical space. Their full-width raised gradient and thin top accent keep them distinct while reserving the left-edge rail for currently playing markers. A compact unlabeled button row below the scene-local filters navigates to every visible section: Oral, Sex, Solo, Feet, Orgasm, Facial, and Other Highlights. The controls avoid router hash navigation without crowding the action toolbar. Each group displays top performers first and bottom performers second as dominant 2:3 image blocks; blue Top borders/names and green Bottom borders/names remain the only role treatment, without image-overlay role chips.

Activity ranges and Highlights are rendered as separate, always-visible lanes below each performer group. The Activity and Highlight headers use arrow/star icons without repeating those icons on individual markers. Activity pills use a filled green range treatment, while Highlight pills use an outlined gold-accent treatment with a compact, natural-width marker title and timestamp, so the distinction does not depend on color alone. Highlight pills are duplicated into every matching activity context when a highlight is contained by or contributes to multiple activity groups, except Feet, Orgasm, and Facial sections only show pills that directly carry that section's configured tag; an overlap-inherited tag alone does not place a pill in those three sections. Unmatched highlights remain visible in an "Other Highlights" fallback bucket. Hovering a highlight pill shows the existing performer/tag-card presentation without the old highlight title header. GOAT-tagged markers, highlight hover cards, thumbnail-scrubber marker tags, player-timeline dots/ranges, and their hover cards use persistent Royal Sapphire styling. Timeline dots and ranges mirror the marker panel with a near-black body, its exact thin one-pixel Royal Sapphire border, and a compact two-layer Sapphire glow instead of a metallic fill or animated aura. Markers that contain the current player timestamp use the red playback treatment in both lanes, and scene player scrubber clicks perform a one-shot focus into the Markers tab with a distinct animated fuchsia focus ring for the target pill. Compact bordered Edit actions remain prominent on every marker. Marker create/edit top and bottom performer dropdowns render large performer thumbnails while choosing, then keep the selected values as regular text pills. Primary and secondary tag dropdown options keep stable component identities while playback updates the current marker timestamp, preventing live playback rerenders from dropping option clicks.

Selection checkboxes follow the visible hierarchy: section selectors cover all displayed Activity and Highlight markers, multi-configuration sections expose a selector for each performer configuration, lanes select only their own marker type, and pills select individual markers or merged highlight segments. Parent selectors show an indeterminate state for partial selection and use larger hit areas. Distinct performer configurations remain separate, but their redundant Top/Bottom text labels are omitted because performer borders already communicate those roles. Exact duplicate configuration headers are omitted when a section contains only one performer configuration, so duration and selection metadata are not repeated.

Scene-card performer-count hover popovers reuse `PerformerCategoryStrip` beneath each portrait instead of repeating raw marker-tag pills. The scene-context strip is derived from the marker data already loaded by each scene card, including descendant role tags, top/bottom directions, unique partner counts and portraits, Facial/Orgasm/Feet counts, and 2nd Camera exclusions, so opening a card does not issue one role query per vato. The popup expands responsively to fit up to three wider performer tiles per row, and its six possible role columns remain centered without clipping their category icons or arrows. Scene performers without configured marker roles remain visible with no strip. On `/scenes`, every qualifying portrait applies the exact shared `/performers` card skin for its Bronze, Silver, Gold, or Royal Sapphire tier, including the configured theme, performer thresholds, and rating-override tags; no scene-only metallic palette is maintained. Each set rating appears in a tiny star-and-number pill below the portrait and above the name, keeping the score in normal layout flow instead of covering any part of the image. Both the portrait and performer name are direct links to that performer's detail page.

Marker-card performer-count hovers now use that exact in-scene inherited-tag popup instead of the generic scene-performer popup. The card grid batches a slim scene-marker context lookup by visible scene IDs, so the popup and context tags remain complete across pagination without issuing one request per card. Marker-card overlap chips use the same directed 50%-overlap context calculation and remain gray; Sapphire card styling preserves these semantic tag colors and the blue/green performer-role chips instead of repainting them Sapphire.

The unified section has scene-local selectable search fields for tags, top performers, and bottom performers. Tag search uses a progressive chain of single-tag selectors: the first selector only lists tags present on the current scene's markers, each next selector only lists tags that can still match by sharing the same marker or by contributing to one shared overlap window with the previous selections, and the row layout wraps at three tag selectors per line. Tag searches match primary or secondary marker tags and reuse the overlap-aware behavior from the custom marker filters: a marker can satisfy multiple requested tags directly or through overlapping markers only when every selected tag participates in the same shared overlap window, and when multiple overlapping markers match the same tag search only the narrowest result is shown. Derived overlap ranges are only shown for multi-tag searches, not for single-tag performer narrowing. Selected tags also narrow the top/bottom performer options to performers associated with the tag-filtered markers.

The Create Marker, Add to Loop, and Open in Viewer toolbar sticks to the top of the marker-tab scroll area. The scene-tabs shell keeps the tab content as the single desktop scroll parent so the sticky positioning remains effective. Activity Type headers also stick directly below the measured toolbar, preserving context through long runs of performer configurations; each header is bounded by its own Activity Type section, so it hands off cleanly to the next header instead of accumulating. Bulk action labels include the selected count, and the status row distinguishes visible selections from markers hidden by active filters. Separate one-click actions select the visible results, select the full scene result set, or clear any partial selection. Opening the Viewer preserves selection because it is non-mutating; adding to the loop clears selection to prevent accidental duplicate insertion.

Marker rows and `/scenes/markers` marker cards display direct primary tags, direct secondary tags, inherited overlap tags, and hierarchy-inferred parent tags with distinct badge colors. A source marker contributes inherited tags when it is at least as long as the receiving marker and their intersection covers at least 50% of the receiver's duration. This keeps inheritance one-way from wider to narrower markers and prevents a wider marker from absorbing tags from narrower markers inside it. Parent tags are collapsed behind a small `+N` toggle by default, and they are also included in scene-local tag search options, so a marker tagged with a child tag can be searched by its parent tag. Duplicate tags only render once at the highest available tier: primary, then secondary, then overlap, then parent.

Scene detail pages also include an icon toggle beside the scene tabs that hides the scene overview/header block, allowing the active tab panel to use the full vertical space of the left column. The scene player scrubber marker tags and timeline marker tooltips use the same performer/tag-card hover presentation as the Markers tab pills. Direct marker tags keep their solid blue Top and green Bottom pill treatments; tags contributed solely by a qualifying overlap source use the same role colors at a muted opacity with a fine dashed border. GOAT-tagged thumbnail-scrubber tags, player-timeline dots/ranges, and timeline hover cards reuse the persistent Royal Sapphire treatment from marker cards and panel pills. Timeline tooltips use the same 50%-overlap-derived performer tags as the Markers tab, including one performer tile with both role colors when the same performer has top and bottom tags across overlapping markers. This applies to outstanding/highlight and Activity Type markers: a marker inherits another marker's tags and roles when the source is at least as long and their intersection covers at least 50% of the receiver's duration. A shorter marker can therefore inherit from a longer source, while the wider marker cannot inherit from a narrower marker inside it. A circular O overlay in the upper-right of the video uses the same O-count icon as the marker playlist player and rest of the app, records today's scene O at the exact current playback timestamp, works in normal and fullscreen playback, and shows its confirmation inside the fullscreen element when needed. The O overlay becomes hidden after two seconds without cursor activity, including while paused, and returns with player activity. Fullscreen player controls hide on the same idle state even while paused. Clicking either a scene player timeline marker or a thumbnail-scrubber marker performs a one-shot focus into the Markers tab, so later filter/edit changes do not keep auto-scrolling back to that marker. Every click receives a distinct latest-wins request: repeated clicks on the same marker restart the focus, while newer clicks cancel older pending frames, smooth scrolling, glow timers, and glow animation state. The focused marker or its rendered Activity Type group glows fuchsia for 10 seconds, including current-playback and Royal Sapphire/GOAT-themed activity pills, keeping the transient interaction state distinct from the persistent sapphire tier. Marker focus scrolls only the tab content, keeping the scene tab rows visible when the panel is vertically expanded. Timeline markers, marker ranges, and thumbnail-scrubber tags gain a restrained blue hover aura without moving their position or hit targets. Hovered timeline ranges also receive a thin neutral contrast rim so adjacent ranges remain distinct regardless of their semantic color, while overlapping negative-marker ranges stay visibly red above the hover treatment.

### Files Modified

- `ui/v2.5/src/components/Scenes/SceneDetails/SceneMarkersPanel.tsx`
- `ui/v2.5/src/components/Scenes/SceneDetails/SceneMarkerForm.tsx`
- `ui/v2.5/src/components/ScenePlayer/ScenePlayer.tsx`
- `ui/v2.5/src/components/ScenePlayer/ScenePlayerScrubber.tsx`
- `ui/v2.5/src/components/ScenePlayer/markers.ts`
- `ui/v2.5/src/components/ScenePlayer/styles.scss`
- `ui/v2.5/src/components/Scenes/SceneMarkerCard.tsx`
- `ui/v2.5/src/components/Scenes/SceneMarkerCardGrid.tsx`
- `ui/v2.5/src/components/Scenes/SceneMarkerRecommendationRow.tsx`
- `ui/v2.5/src/components/Scenes/DeleteScenesDialog.tsx`
- `ui/v2.5/src/components/Scenes/SceneDetails/sceneMarkerChronologySearch_custom.ts`
- `ui/v2.5/src/components/Scenes/SceneDetails/sceneMarkerHoverPopover_custom.tsx`
- `ui/v2.5/src/components/Shared/ratingCardStyles_custom.scss`
- `ui/v2.5/src/styles/applicationTheme_custom.scss`
- `ui/v2.5/src/core/generated-graphql.ts`
- `ui/v2.5/src/components/Scenes/SceneDetails/Scene.tsx`
- `ui/v2.5/src/components/Settings/SettingsCustomPanel.tsx`
- `ui/v2.5/src/components/Tags/TagSelect.tsx`
- `ui/v2.5/src/core/config.ts`
- `ui/v2.5/src/components/Shared/HoverPopover.tsx`
- `ui/v2.5/graphql/data/scene-marker.graphql`
- `ui/v2.5/graphql/data/scene-slim.graphql`
- `ui/v2.5/src/locales/en-GB.json`
- `ui/v2.5/src/locales/en-US.json`
- `ui/v2.5/src/components/Scenes/styles.scss`
- `CUSTOM_FEATURES.md`

### Files Added

- `ui/v2.5/src/components/Scenes/SceneDetails/SceneMarkersChronologicalPanel.tsx`
- `ui/v2.5/src/components/Scenes/SceneDetails/sceneMarkerActivityType_custom.ts`
- `ui/v2.5/src/components/Scenes/SceneDetails/sceneMarkerChronologyLayout_custom.ts`
- `ui/v2.5/src/components/Scenes/SceneDetails/sceneMarkerChronologySearch_custom.ts`
- `ui/v2.5/src/components/Scenes/SceneDetails/sceneMarkerHoverPopover_custom.tsx`
- `ui/v2.5/src/components/Scenes/sceneMarkerCardContext_custom.ts`
- `ui/v2.5/graphql/data/scene-marker-context_custom.graphql`
- `ui/v2.5/graphql/queries/scene-marker-context_custom.graphql`
- `ui/v2.5/src/components/ScenePlayer/sceneMarkerTimelineHover_custom.ts`
- `ui/v2.5/src/components/ScenePlayer/sceneMarkerTimelineStyle_custom.ts`
- `ui/v2.5/src/components/ScenePlayer/scenePlayerORecord_custom.ts`
- `ui/v2.5/src/components/Scenes/SceneCardPerformerPopover_custom.tsx`
- `ui/v2.5/src/components/Scenes/sceneCardPerformerRoles_custom.ts`
- `ui/v2.5/src/components/Scenes/SceneCard.tsx`
- `ui/v2.5/src/components/Scenes/SceneDetails/sceneMarkerLayoutPreference_custom.ts`
- `ui/v2.5/src/components/Scenes/SceneDetails/sceneMarkerSelection_custom.ts`
- `ui/v2.5/src/components/Scenes/SceneDetails/sceneMarkerFocusScroll_custom.ts`
- `ui/v2.5/src/components/Scenes/SceneDetails/sceneMarkerSectionNavigation_custom.ts`
- `ui/v2.5/scene_markers_panel_poc_custom.html`
- `ui/v2.5/tests/sceneMarkerActivityType_custom.test.ts`
- `ui/v2.5/tests/sceneMarkerChronologyLayout_custom.test.ts`
- `ui/v2.5/tests/sceneMarkerChronologySearch_custom.test.ts`
- `ui/v2.5/tests/sceneMarkerLayoutPreference_custom.test.ts`
- `ui/v2.5/tests/sceneMarkerTimelineHover_custom.test.ts`
- `ui/v2.5/tests/sceneMarkerSelection_custom.test.ts`
- `ui/v2.5/tests/sceneMarkerFocusScroll_custom.test.ts`
- `ui/v2.5/tests/sceneMarkerSectionNavigation_custom.test.ts`
- `ui/v2.5/tests/sceneMarkerVisualStates_custom.test.ts`
- `ui/v2.5/tests/sceneMarkerTimelineStyle_custom.test.ts`
- `ui/v2.5/tests/scenePlayerORecord_custom.test.ts`
- `ui/v2.5/tests/sceneCardPerformerRatingHighlight_custom.test.ts`
- `ui/v2.5/tests/sceneCardPerformerRoles_custom.test.ts`
- `ui/v2.5/tests/tagSelectRendererIdentity_custom.test.ts`

### Test Cases Added

- Verifies direct multi-tag marker matches.
- Verifies overlapping single-tag markers keep the narrower matching marker.
- Verifies non-overlapping single-tag markers do not satisfy a multi-tag search.
- Verifies chained overlaps do not satisfy a multi-tag search unless all selected tags share one overlap window.
- Verifies top and bottom performer search fields match direct marker roles.
- Verifies selected parent tags match loaded child marker tags.
- Verifies scene tag options include direct marker tags and their parent tags.
- Verifies next tag options only include tags that keep an overlap/share match.
- Verifies performer options are derived from tag-filtered marker results.
- Verifies highlights contained by multiple activity contexts are duplicated into every matching group.
- Verifies Feet, Orgasm, and Facial sections omit highlights whose matching tag comes only from overlap context.
- Verifies filtered-out activity pills stay hidden while matching highlight pills still keep their group visible.
- Verifies unmatched highlight pills remain visible in the Other Highlights fallback bucket.
- Verifies GOAT-tagged highlight markers are detected for Royal Sapphire styling.
- Verifies displayed marker tag badges distinguish primary, secondary, overlap, and parent tags while deduping to the highest tier.
- Verifies displayed overlap tags are only inferred between markers from the same scene.
- Verifies marker-card context tags use directed 50%-overlap inheritance, including the exact boundary, below-threshold rejection, and the wider-marker prohibition against inheriting from narrower sources.
- Verifies single-tag performer filters do not create derived overlap ranges from nearby tag-only markers.
- Verifies activity type markers are limited to configured sex/oral/solo primary-only markers and secondary tags make them highlights.
- Verifies scene-card performer strips derive configured role families through flattened tag ancestry, preserve independent top/bottom directions and partner IDs, deduplicate partner counts, and exclude 2nd Camera descendants from Facial and Orgasm totals.
- Verifies scene-card performer portraits load rating/override-tag data, apply performer-specific thresholds and override precedence, reuse the shared premium/classic performer-card skins, and place a compact star-and-number rating below rather than over the portrait.
- Verifies each scene-card performer portrait and name links directly to that vato's detail page.
- Verifies marker hover data keeps direct role tags primary and identifies overlap-contributed role tags for the muted dashed treatment.
- Verifies the unified chronological section includes configured feet, orgasm, and facial primary tags as section markers without changing strict Activity Type marker classification.
- Verifies facial-tagged orgasm markers are assigned to Facial instead of standard Orgasm, including child facial tags.
- Verifies unified chronological section markers are grouped Oral, Sex, Solo, Feet, Orgasm, Facial and chronological within each group.
- Verifies activity type markers with the same activity and top/bottom performer configuration are grouped together.
- Verifies single-tag scene-local searches include markers that match only through an overlapping marker tag.
- Verifies the official grouped marker layout only shows when its UI setting is explicitly enabled.
- Verifies outstanding timeline marker hovers inherit qualifying performer tags, mixed top/bottom roles share one performer tile, dual-role Activity Type markers share one tile, a majority-overlapped Activity Type marker inherits the source marker's role tags, and the longer source does not inherit when that overlap covers less than half of its duration.
- Verifies parent selection scopes report none, partial/indeterminate, and all-selected states while deduplicating repeated layout marker IDs.
- Verifies selection counts distinguish visible items from markers hidden by active scene-local filters.
- Verifies desktop scrubber marker focus prefers an exact marker pill, falls back to its rendered Activity Type group when the individual pill is hidden, uses the scene tab scroll area, retains normal page scrolling in non-scrolling layouts, centers within the tab, clamps at its top boundary, and ignores stale completion from an older click so it cannot clear the latest request.
- Verifies the compact marker-section navigation includes every visible section (Oral, Sex, Solo, Feet, Orgasm, Facial, and Other Highlights), scrolls directly to stable in-panel target IDs without router hash navigation, and keeps section-header accents horizontal instead of reusing the current-playback left rail.
- Verifies scrubber marker tags receive the shared Royal Sapphire class and that the temporary clicked-marker aura uses fuchsia instead of the persistent Sapphire blue.
- Verifies GOAT tags, GOAT child tags, and the configured Royal Sapphire override tag apply the restrained Sapphire treatment to player-timeline dots/ranges and their hover cards while ordinary markers retain their semantic tag colors.
- Verifies primary and secondary marker tag selectors use module-scoped option renderers whose identities remain stable across playback-driven parent rerenders.
- Verifies the scene-player O overlay accepts finite non-negative timestamps, records the active scene and exact playback time, uses the shared O-count icon in the normal/fullscreen video surface, provides fullscreen-safe confirmation, and hides on the two-second idle state.

### GraphQL Schema Changes

- None.

### Configuration Dependencies

- Uses existing `configuration.ui.roleTagIds.sexTagId`, `oralTagId`, and `soloTagId` to identify Activity Type markers.
- Uses existing `configuration.ui.roleTagIds.feetTagId`, `orgasmTagId`, and `facialTagId` to add non-activity sections to the unified chronological marker section.
- Scene-card performer portraits reuse `configuration.ui.ratingCardTheme`, performer-specific `ratingCardThresholds`, `ratingCardOverrideTagIds`, and the configured GOAT tag for tier selection.
- Uses `configuration.ui.showOfficialSceneMarkerLayout` to switch the scene Markers tab between the custom chronological layout and the upstream grouped layout.

---

## 48. GEVI Latest Page

### Overview

Adds `/gevi-latest`, a custom page showing the latest scenes and vatos from Gay Erotic Video Index, linked from the right-side utility icon group in the main navbar. The backend API is mounted separately at `/gevi-latest-data` so direct browser loads and refreshes of `/gevi-latest` render the React page instead of raw JSON. The backend fetches `https://gayeroticvideoindex.com/newe` for scenes and `https://gayeroticvideoindex.com/newp` for vatos, stores the results in a JSON cache under the configured Stash cache directory, downloads each card image into a local image cache, and prunes cached items older than two years. Scene entries fetch the individual episode detail page to use the larger `episode<ID>b.jpg` screenshot when present. Vato entries use the performer image from the main GEVI new-performers page. A missing external image (HTTP 404) is quietly omitted from its card without treating the GEVI refresh as failed.

### Files Modified

- `internal/api/server.go`
- `internal/api/server_custom.go`
- `ui/v2.5/src/App.tsx`
- `ui/v2.5/src/components/MainNavbar.tsx`
- `ui/v2.5/src/components/Stats.tsx`
- `CUSTOM_FEATURES.md`

### Files Added

- `internal/gevi/latest_custom.go`
- `internal/gevi/latest_custom_test.go`
- `internal/api/routes_gevi_latest_custom.go`
- `ui/v2.5/src/components/GEVILatest/GEVILatest_custom.tsx`
- `ui/v2.5/src/components/GEVILatest/GEVILatest_custom.scss`

### Test Cases Added

- Verifies scene list parsing extracts episode ID, title, studio, thumbnail, and performers.
- Verifies performer list parsing uses the main-page performer image and source label.
- Verifies scene detail parsing uses the larger detail screenshot and release date.
- Verifies cache merging preserves first-seen timestamps and two-year pruning removes expired items.
- Verifies local image downloads are persisted and unreferenced cached image files are deleted.
- Verifies a 404 image download is silently omitted from the cached card.

### GraphQL Schema Changes

- None. The page uses the custom REST endpoint `/gevi-latest-data`.

### Configuration Dependencies

- Uses `config.GetCachePath()` for `gevi_latest_custom.json` and `gevi_latest_images_custom/`, falling back to `config.GetConfigPath()` if no cache path is configured.

---

## 49. Black Steel Application Theme

### Overview

Adds a selectable application-wide Black Steel theme under Settings > Custom. The upstream Stash dark palette remains the default, while Black Steel applies immediately after its persisted UI setting is updated and remains active across reloads.

### Visual Design

Black Steel uses a near-black canvas, matte-black and gunmetal surfaces, steel-toned text, hard two-pixel control radii, and restrained copper edge accents. Primary controls remain graphite instead of becoming solid copper, while active navigation, focus rings, selected filter operators, and compact state indicators use the accent sparingly. It covers the navbar, ordinary cards, detail headers, settings, high-contrast text fields, readable multi-select chips, React Select portals, dropdowns, modals, popovers, the Rating Advisor, tables, pagination, tags, scrollbars, hover states, keyboard focus rings, and padded home-page recommendation frames. Existing success, warning, danger, performer-role, rating heat, and premium/classic rating-card colors remain semantic and unchanged. Reduced-motion users do not receive the theme's small card-hover movement.

### Files Modified

- `ui/v2.5/src/App.tsx` - Mounts the document-level theme controller inside the configuration provider.
- `ui/v2.5/src/components/Settings/SettingsCustomPanel.tsx` - Adds the application theme selector.
- `ui/v2.5/src/core/config.ts` - Types the persisted `applicationTheme` UI setting.
- `ui/v2.5/src/index.scss` - Imports the scoped runtime theme after existing component styles.
- `ui/v2.5/src/locales/en-GB.json` - Adds selector labels and the Black Steel description.
- `CUSTOM_FEATURES.md` - Documents the feature and adds it to the Custom Settings inventory.

### Files Added

- `ui/v2.5/src/components/ApplicationTheme_custom.tsx` - Synchronizes the persisted theme to the document root so portalled UI is themed.
- `ui/v2.5/src/utils/applicationTheme_custom.ts` - Normalizes theme values and safely switches known document classes.
- `ui/v2.5/src/styles/applicationTheme_custom.scss` - Contains the scoped Black Steel palette and component overrides.
- `ui/v2.5/tests/applicationTheme_custom.test.ts` - Provides focused theme preference and class-switching tests.

### Test Cases Added

- Verifies a missing application theme uses the upstream Stash default.
- Verifies an unknown persisted value safely falls back to the default.
- Verifies the masculine-black setting is normalized and applies the Black Steel document class.
- Verifies returning to the default removes the Black Steel class.
- Verifies an invalid setting cannot leave a stale theme class behind.

### GraphQL Schema Changes

- None. UI configuration is already transported and persisted as a generic map.

### Configuration Dependencies

- Uses `configuration.ui.applicationTheme` with supported values `default` and `masculine-black`.

---

## 50. Cinematic Loading Overlay

### Overview

Promotes ordinary, full-size `LoadingIndicator` messages into a fixed viewport overlay inspired by the music-stats chart loader. The overlay dims and blurs the rendered application, blocks accidental interaction while work is in progress, and presents the existing spinner and message inside a shadowed status card. Inline, small, card-based, and explicitly message-free indicators remain local to buttons, fields, tables, taggers, and popovers.

The default Stash theme uses a cool-blue accent. Black Steel replaces that accent with its restrained copper palette and hardens the card radius to match the rest of the application theme. When more than one ordinary loader is mounted, only the first overlay is shown; another becomes visible automatically if the first unmounts while work remains.

### Files Modified

- `ui/v2.5/src/components/Shared/LoadingIndicator.tsx` - Portals ordinary loading messages to the document body while preserving compact variants.
- `ui/v2.5/src/index.scss` - Imports the custom loading-overlay styles after the upstream shared styles.
- `CUSTOM_FEATURES.md` - Documents the application-wide loading treatment.

### Files Added

- `ui/v2.5/src/components/Shared/loadingIndicator_custom.ts` - Centralizes the display-mode decision for full overlays versus compact loaders.
- `ui/v2.5/src/components/Shared/loadingIndicator_custom.scss` - Provides the blurred veil, shadowed loading card, theme accents, and reduced-motion behavior.
- `ui/v2.5/tests/loadingIndicator_custom.test.ts` - Covers the full-size and compact display modes.

### Test Cases Added

- Verifies an ordinary loading message uses the viewport overlay.
- Verifies inline loaders remain compact.
- Verifies small loaders remain local to their controls.
- Verifies card and popover loaders remain inside their container.
- Verifies explicitly message-free spinners remain local to their container.

### GraphQL Schema Changes

- None.

### Configuration Dependencies

- None. Black Steel styling is selected automatically from the existing document theme class.

---

## 51. Negative Marker Create Parity

### Overview

Brings the negative marker create/edit form's shared range-editing features in line with the regular scene marker form. New negative markers use an active A-B loop as their initial range, fall back to a valid ten-second range at the player position, and show the live calculated duration below the end time. The creatable title picker fetches distinct negative-marker names globally across all scenes while skipping the regular-marker title query entirely. It requests fresh global results whenever the form opens, ranks saved titles by use count, excludes blank names, preserves the first-used casing, and deduplicates case-insensitively so a saved name is selected instead of repeatedly offered as a new creation. Both marker title pickers retain stable option identities across form renders, so Arrow Up/Down focus stays on the intended result.

Gap and overlap warnings expose the complete action set on both forms: fix the previous or next issue on the marker being edited, fix either adjacent scene or negative marker instead, fix both issues on the current marker, or fix both adjacent markers when both are known.

### Files Modified

- `ui/v2.5/src/components/Scenes/SceneDetails/SceneNegativeMarkerForm.tsx` - Adds A-B initialization, title suggestions, live duration, and all adjacent-marker fix actions.
- `ui/v2.5/src/components/Scenes/SceneDetails/sceneMarkerGapWarning_custom.ts` - Exposes detailed adjacent-marker action metadata to the negative marker form.
- `ui/v2.5/src/components/Shared/Select.tsx` - Ranks and stabilizes shared marker-title suggestions so keyboard navigation does not reset, while supporting custom marker-type sources.
- `ui/v2.5/src/core/StashService.ts` - Requests regular marker titles ordered by saved-marker use count and fetches fresh global negative-marker names for negative-marker forms.
- `ui/v2.5/graphql/queries/misc.graphql` - Adds the global negative-marker name query used by the form.
- `graphql/schema/schema_custom.graphql` - Exposes global negative-marker names through the custom GraphQL query surface.
- `pkg/models/scene_negative_marker_custom.go` - Adds the global name lookup to the negative-marker repository contract.
- `pkg/models/mocks/SceneNegativeMarkerReaderWriter_custom.go` - Implements the new repository method in the negative-marker mock.
- `pkg/sqlite/scene_negative_marker_custom.go` - Loads distinct, non-blank names across every scene ranked by use count.
- `internal/api/resolver_scene_negative_marker_custom.go` - Resolves the global name query in a read transaction.
- `internal/api/generated_exec.go`, `ui/v2.5/src/core/generated-graphql.ts` - Regenerated GraphQL server and UI bindings.
- `ui/v2.5/tests/sceneMarkerGapWarning_custom.test.ts` - Verifies negative markers receive update metadata for adjacent scene and negative markers.
- `CUSTOM_FEATURES.md` - Documents negative marker form parity.

### Files Added

- `ui/v2.5/src/components/Scenes/SceneDetails/sceneNegativeMarkerForm_custom.ts` - Provides testable initial-range and duration helpers.
- `ui/v2.5/src/components/Shared/markerTitleSuggestions_custom.ts` - Merges and normalizes shared and negative-marker title suggestions.
- `pkg/sqlite/scene_negative_marker_custom_test.go` - Verifies the global negative-marker name query across scenes.
- `ui/v2.5/tests/sceneNegativeMarkerForm_custom.test.ts` - Covers player-position defaults, A-B loop initialization, edit preservation, valid fallback ranges, and duration calculation.

### Test Cases Added

- Verifies new negative markers default to ten seconds at the current player position.
- Verifies active A-B loop endpoints initialize a new negative marker.
- Verifies a loop without a usable end still creates a valid range.
- Verifies editing preserves the saved range regardless of the active loop.
- Verifies live duration calculation and invalid-range suppression.
- Verifies regular marker titles are ranked by use count, while saved negative-marker titles are deduplicated case-insensitively and are not offered as new Create options.
- Verifies global negative-marker names include multiple scenes, exclude blank names, deduplicate trimmed case variants, preserve first-used casing, and rank by use count.
- Verifies both adjacent-marker action payloads include the correct marker ID, kind, and boundary update.

### GraphQL Schema Changes

- Adds `Query.sceneNegativeMarkerNames: [String!]!` for distinct saved negative-marker names across all scenes.

### Configuration Dependencies

- Uses the existing scene player A-B loop state and `configuration.ui.roleTagIds` gap-warning categorization.

---

## 52. Scene Marker Duplicate and In-Between Actions

### Overview

Adds two actions on a dedicated row below Save and Cancel while editing an existing scene marker. **Duplicate Marker** opens a new-marker draft preloaded with every editable field from the saved original and leaves the original untouched. **Insert Marker In-Between** opens a bounded insert dialog with radio options for a regular marker, a negative marker, or an empty gap. Every mode requires start and end times strictly inside the original marker's millisecond bounds. Regular-marker mode shows the full marker form, negative-marker mode shows its title and range fields, and gap mode asks only for the range.

After a valid insertion, the original range becomes two markers that retain the original metadata: the original record ends one millisecond before the selected range starts, and a new right-side record starts one millisecond after the selected range ends while retaining the original end time. Regular and negative modes create their selected marker type inside that range; gap mode creates no middle record. If the split cannot finish, newly created marker or negative-marker records are rolled back and the editor remains open with the original unchanged.

### Files Modified

- `ui/v2.5/src/components/Scenes/SceneDetails/SceneMarkerForm.tsx` - Adds the three insert modes, conditional fields, second-row action buttons, bounds validation, split mutations, rollback handling, and duplicate form hydration.
- `ui/v2.5/src/core/StashService.ts` - Allows negative-marker title suggestions to stay skipped until negative-marker insert mode is selected.
- `CUSTOM_FEATURES.md` - Documents the scene marker actions.

### Files Added

- `ui/v2.5/src/components/Scenes/SceneDetails/sceneMarkerFormActions_custom.ts` - Provides insert-mode record selection, duplicate-draft mapping, millisecond bounds validation, and exact split-boundary calculations.
- `ui/v2.5/tests/sceneMarkerFormActions_custom.test.ts` - Covers all insert-mode outcomes, duplicate field preservation, bounded insert validation, required end times, and one-millisecond split math.

### Test Cases Added

- Verifies duplicate drafts preserve title, times, primary/additional tags, and top/bottom performers.
- Verifies regular and negative insert modes create the expected middle record type, while gap mode creates none.
- Verifies inserted marker times must be strictly inside both original bounds.
- Verifies inserted markers require an end time and open-ended originals cannot be split.
- Verifies `10:24.768` produces a left-side end of `10:24.767` and the right side begins exactly one millisecond after the inserted marker's end.

### GraphQL Schema Changes

- None. The flow composes the existing scene-marker and negative-marker create/update/destroy mutations.

### Configuration Dependencies

- None.

---

## 53. Copy Scene Marker Timestamps From the Player Timeline

### Overview

Adds a copy-from-marker action beside both time inputs in the regular and negative Create/Edit Marker forms. The action is the first button, before Select Current Timestamp and Jump To. Starting it from either Start time or End time puts the scene player into a one-shot timestamp selection mode while preserving the originating form and destination field. Hovering a regular or negative marker on either the video progress bar or thumbnail scrubber opens a stable picker showing only the marker tag and its full millisecond-precise range, with the Start and End timestamps as violet and yellow selectable chips inside that range. Both copy-mode and ordinary Video.js seek-bar popups are anchored at the cursor entry position instead of the center of a potentially long marker and remain fixed while the pointer moves onto them. Negative-marker hover takes exclusive ownership over any overlapping regular marker in both paths: the Video.js picker rejects lower-priority competing hover events, and the thumbnail scrubber gives the negative range a deterministic hit-test layer above regular marker tags. Only the negative picker remains open, and stale mouse-leave events cannot dismiss it. Selecting a chip copies that exact boundary into the launching field, exits copy mode, and keeps the originating marker form open. Outside copy mode, the timestamp chips appear beneath the existing performer/tag hover content on regular markers painted on the Video.js seek bar and inside the negative-marker popup, and seek playback directly to the selected boundary. Open-ended regular markers offer only their available start timestamp, and ordinary marker seeking/focus behavior remains unchanged outside copy mode. Marker-level selection avoids competing controls at adjacent boundaries, so markers separated by only one millisecond remain easy to use.

### Files Modified

- `ui/v2.5/src/components/Shared/DurationInput.tsx` - Adds the optional copy-from-marker button and active state in the current/copy/jump action order.
- `ui/v2.5/src/components/Shared/HoverPopover.tsx` - Supports fixed cursor-entry anchoring and exclusive sibling suppression for interactive scrubber pickers.
- `ui/v2.5/src/components/Scenes/SceneDetails/SceneMarkerForm.tsx` - Launches copy mode from the requested create/edit field, applies one-shot selections, and shows selection guidance.
- `ui/v2.5/src/components/Scenes/SceneDetails/SceneMarkersPanel.tsx` - Passes timestamp-copy state through the marker editor.
- `ui/v2.5/src/components/Scenes/SceneDetails/SceneNegativeMarkerForm.tsx` - Provides the same copy action, one-shot application, and guidance for negative-marker Start and End fields.
- `ui/v2.5/src/components/Scenes/SceneDetails/SceneNegativeMarkersPanel.tsx` - Passes timestamp-copy state through the negative-marker editor.
- `ui/v2.5/src/components/Scenes/SceneDetails/Scene.tsx` - Coordinates the sibling marker form and scene player while intercepting copy-mode marker clicks.
- `ui/v2.5/src/components/ScenePlayer/ScenePlayer.tsx` - Enables exact range endpoints during copy mode, including on mobile or when normal range markers are hidden.
- `ui/v2.5/src/components/ScenePlayer/ScenePlayerScrubber.tsx` - Opens the reusable exact-time picker from thumbnail scrubber markers during timestamp-copy mode.
- `ui/v2.5/src/components/ScenePlayer/markers.ts` - Adds the cursor-anchored copy picker and embeds direct-seek chips in the regular Video.js marker performer/tag hover card.
- `ui/v2.5/src/index.scss` - Imports the isolated timestamp-copy styles after the scene player stylesheet.
- `CUSTOM_FEATURES.md` - Documents marker timestamp copying.

### Files Added

- `ui/v2.5/src/components/ScenePlayer/sceneMarkerTimestampCopy_custom.ts` - Defines copy request/selection contracts and exact boundary resolution.
- `ui/v2.5/src/components/ScenePlayer/sceneMarkerTimestampCopy_custom.scss` - Styles active markers and the stable exact-time picker.
- `ui/v2.5/src/components/ScenePlayer/SceneMarkerTimestampCopyPopover_custom.tsx` - Renders the interactive exact-time picker in the thumbnail scrubber.
- `ui/v2.5/tests/sceneMarkerTimestampCopy_custom.test.ts` - Covers destination-field preservation and boundary selection.

### Test Cases Added

- Verifies a source start can be copied into the End time field that launched the request.
- Verifies a source end can be copied into the Start time field that launched the request.
- Verifies open-ended markers do not offer a nonexistent end timestamp.
- Verifies the picker exposes separate selectable options with exact seconds and omits End for open-ended markers.
- Verifies the reusable picker exposes the exact Start and End targets used by direct scrubber seeking.
- Verifies direct-seek chips are attached to normal Video.js marker hover cards while the thumbnail scrubber retains its performer/tag popup.
- Verifies normal seek-bar popups anchor at the cursor and negative markers retain ownership over overlapping regular markers.
- Verifies an End and the following Start remain distinct when separated by only one millisecond.
- Verifies a normalized negative-marker end can be copied into the launching field.
- Verifies the destination contract preserves a negative-marker form field instead of routing the value to a regular-marker editor.
- Verifies picker positioning centers on the cursor and remains clamped inside the timeline edge.
- Verifies a stale overlapping regular-marker leave cannot hide the negative marker that owns the active picker.
- Verifies overlapping Video.js and thumbnail-scrubber marker hit targets keep the negative timestamp picker stable instead of alternating with regular marker data.

### GraphQL Schema Changes

- None.

### Configuration Dependencies

- None. Copy mode temporarily shows range endpoints even when the normal range-marker display is disabled.

---

## 54. Scene Card Marker Insights

### Overview

Scene cards replace the description text and seven-value Activity/Quality percentage footer with up to seven compact marker-derived insight chips, reserving descriptions for the scene detail page. Shared fact helpers merge overlapping marker intervals once and format compact evidence consistently. Activity-quality insights use only the percentage of the activity that is outstanding and require at least 5% of the full scene as activity evidence, preventing tiny markers from making whole-scene quality claims. The four configurable levels are Good, Great, Amazing, and Near-perfect, and only the two strongest ordinary activity insights compete for card space. Their tooltip states the outstanding percentage and duration, for example `38% of oral is Outstanding (2:38)`. Leaning is evaluated only when both Sex and Oral each cover at least 5% of the scene; Solo does not create a misleading missing-Sex or missing-Oral claim. A leaning chip describes the minority activity as minimal, some, a good amount, or a lot of using configurable minority-share levels, and its tooltip shows both shares and durations, for example `50% sex (10:30) - 50% oral (10:30)`.

Role-assigned Sex and Oral markers form a directed performer-interaction graph from top to bottom. Any marker presence counts as evidence for an interaction direction; marker duration thresholds do not suppress versatility chips. For exactly two vatos, the strongest matching pattern is one of three mutually exclusive chips: `Fully Versatile Scene` when both vatos top and bottom in Sex and Oral, `Sexually Versatile` when both do so in Sex but not Oral, or `Orally Versatile` when both do so in Oral but not Sex; Fully always takes precedence. Scenes with three or more vatos retain the group patterns: `Round-Robin Scene`, `Oral Circle`, `Versatile Group`, `Balanced Orgy`, `Balanced Threesome`, `Traditional Scene`, or `One Vato Center Stage`. Balanced Orgy requires every vato to interact with at least half of the other vatos. More specific patterns take precedence.

Performer-history rarity adds `Rare instance of <vato> <action>` chips when the current marker role accounts for no more than the configured maximum share of that vato's history (20% by default) and the relevant history contains at least five scenes. Sex Top is compared only with Sex Bottom, and Oral Top only with Oral Bottom; mixed Sex/Oral scenes remain part of the appropriate independent role history. The action copy reuses the Partners-tab language: giving dick, taking dick, having his pito sucked, and sucking pito. Facial rarity remains disabled. Rare-role chips sort above broad Traditional/Versatile interaction-pattern chips.

Every direct non-activity, non-qualifier marker tag contributes to one Outstanding Activity matrix. Rows are tag names sorted by overlap-merged scene duration descending, with marker count and name as deterministic tie-breakers. Columns show every scene performer's picture and name plus a Scene-wide column when markers lack performer attribution. Each cell shows that tag's ordinary Outstanding and GOAT duration/count as separate lines; GOAT evidence uses a gold treatment, and a GOAT-only cell omits the ordinary Outstanding line. The Total cell also shows the tag's combined share of the full scene. The redundant Total column is omitted for a one-performer scene. Both top and bottom marker performers receive their corresponding cell evidence. Feet overrides the normal category exclusions and participates in every activity matrix, including when it occurs on a GOAT-qualified marker, while retaining its separate presence chip.

Scene insights split configured Outstanding Activity tags into two mandatory chips. Custom Settings supplies a multi-select for very common activity tags: the first chip applies the existing amount wording to the top two present tags from that configured family (`Some <tag>`, `Good amount of <tag>`, `Lots of <tag>`, or `<tag> as far as the eye can see`), while the second reports every other present matrix tag as `Scene contains <tags>`. Configured family matching includes tag descendants. Any activity tag already named by a GOAT chip is excluded from both Outstanding chips. The common chip selects its top two only after that exclusion, so the next-highest-duration common tag backfills a removed GOAT tag; either chip keeps a single remaining tag and disappears when none remain. Every GOAT chip opens the complete matrix. When both top common tags share a tier, the qualifier is emitted once around their joined names, such as `face and pito as far as the eye can see`. Both hover tooltips preserve per-tag scene percentage, duration, and marker count, and both chips open the complete matrix. The separate Feet presence chip is suppressed after a common-tag family is configured because Feet is already included in one of these two chips. An empty configuration preserves the original single top-two chip and separate Feet chip for existing installations. The scene Stats panel keeps its compact overview, while the same full table occupies a dedicated Activity Matrix tab inside Open Detailed Stats. GOAT chips continue to render separately with higher precedence. Their companion tags, including Feet, remain counted and visible in the matrix even though those named tags are suppressed from the Outstanding chips. Configured Orgasm and Facial families remain outside the matrix and aggregate by semantic event category and unique marker instead of raw tag ID, so Facial subclasses contribute to one count. Flattened ancestor IDs supplied by the backend make activity, event, qualifier, and GOAT matching recursive through arbitrary tag-hierarchy depth. Facial classification takes precedence when the configured Facial family descends from Orgasm.

Event-report totals follow the Scene Stats weighting rule: every Orgasm or Facial marker counts once per assigned top, with a minimum of one for a marker without tops. The GOAT and Really Hot subtotals use the same weight as the report headline.

Individual vato Stats tabs place the shared Activity Matrix below their Scene Rating Averages and scope both scene totals and marker evidence to that performer. Only markers where the vato is assigned as Top or Bottom contribute, and tag drilldowns preserve the same marker-performer filter.

The global `/scenestats` dashboard and studio `/studios/<id>/stats` dashboard share a third Activity Matrix tab beside Activity & Ratings. These scoped matrices use the same compact, total-only table component, merge overlapping tag intervals per scene, show duration and unique stored-marker counts, and sort by total duration descending. An `Include sub-tag content` switch defaults off and, when enabled, rolls descendant marker evidence into every eligible ancestor row without counting a marker twice in one row. In that mode, rows with reported descendants expose an accessible expand/collapse control and recursively reveal the sub-tag rows with their own rolled-up time and marker counts; direct mode stays flat. The switch is stored in the SceneStats URL. Visibly underlined tag links open the corresponding tag Markers tab, carry the same explicit direct/sub-tag mode, and preserve the studio/depth filter. Ordinary marker `tags` criteria—including `INCLUDES_ALL` and `EQUALS`—inspect direct marker tags only; inherited overlap matching is isolated to the dedicated `scene_marker_tags` filter structure used by the Markers filter. The selected SceneStats section is also stored in the URL so browser Back restores Activity Matrix instead of resetting to Overview. Tag links in performer-based matrices use the same clean underlined styling.

Countable event markers produce only two scene-wide report chips: an Orgasm report and a Facial report. The Orgasm report includes only configured Orgasm markers that are not also Facial markers; the Facial report includes the configured Facial family, including Facial descendants of Orgasm. Examples are `6 orgasms: 1 GOAT, 2 Really Hot` and `3 facials: 1 GOAT, 1 Really Hot`. Ordinary event markers remain in the total but receive no separate mention. Within each report, a GOAT marker supersedes its Really Hot qualifier, so it only contributes to the GOAT count. Configured 2nd Camera markers are excluded from both reports. Legacy Standard/Really Hot/GOAT Orgasm and Facial variant chips are not emitted. The preserved event-pattern chips are `Tyga Martinez nuts twice` (or `nuts N times`) and `2 vatos nut at the same time`; repeated-orgasm detection retains the configured Orgasm family behavior. `Everybody Nuts` generation is preserved in a commented block but intentionally disabled. Other GOAT tags retain their top-performer attribution and merge compatible non-event tags only within the same performer scope; even an identical descriptor never combines GOAT markers from different performers. Every other GOAT marker produces a separate GOAT insight for each direct named non-qualifier tag, including configured activity tags such as `BJ`; only a marker with no other named tag falls back to `GOAT moment`. Tag-derived labels preserve each tag's exact name and casing.

Negative evidence produces `No Orgasm` when configured role tags exist, the scene has at least one completed primary Sex, Oral, or Solo marker, and it has no countable Orgasm or Facial marker; 2nd Camera markers are excluded throughout. `No Orgasm` reserves a high-priority slot after mandatory event-report evidence so ordinary activity and contextual candidates cannot crowd it out. `Lackluster sex` and `Lackluster oral` remain contextual candidates but display immediately beside the positive Good/Great/Amazing/Near-perfect activity-quality report because they describe the same quality dimension. `Few highlights` and `Lots of filler` are considered only after the scene has at least one completed primary Sex, Oral, or Solo marker (excluding 2nd Camera), so unprocessed scenes do not receive either chip. `Few highlights` appears only when both conditions pass: outstanding merged episodes are no greater than the configured maximum and their merged duration is no greater than the configured percentage of the full scene. The default percentage maximum is 5%. `Lots of filler` appears when time without any marker exceeds its configured percentage; its tooltip uses the compact `<percent>% filler (<duration>)` form and can appear alongside `Lackluster`. Stored scene Rating Advisor criteria—not performer ratings—also produce role-attractiveness warnings: two- and three-vato scenes show `Ugly Top` or `Ugly Bottom` when the matching Top/Bottom Attractiveness raw value is 0, while group scenes with four or more vatos show `Ugly Tops` when Top Lineup Attractiveness is 0 or 1. Missing criteria do not trigger a warning. Every positive marker covers its interval regardless of tag; negative-marker intervals are added to filler even when they overlap positive markers.

Performer-lineup context adds `Mexican vato`, `Mexican vatos ×N`, or `All-Mexican` from normalized Mexico country metadata. It also adds `Favorite Vatos ×N` for performers whose card resolves to Royal Sapphire through the shared metallic-rating thresholds and override-tag precedence; it does not use the database favorite flag.

Candidate generation and selection are separate. A typed policy table defines lane, mandatory status, and display priority instead of deriving semantics from string key prefixes. The card and scene Details tab both show up to the configurable visible-chip limit (seven by default). When more candidates exist, a dedicated `+` control appears after the visible strip and opens a scroll-safe popup anchored to that control; when space below is limited, it opens above the trigger. The strip and its ordinary chips have no click action. The popup contains every generated candidate as the same horizontally flowing chips used inside a scene, without inline helper text. Individual chip evidence remains available on hover, while Outstanding Activity, Feet, and every GOAT chip retain their direct Activity Matrix action. The two event reports, `No Orgasm`, and leaning reserve their slots; repeated/simultaneous orgasm patterns fill the remaining automatic-event capacity, up to two activity-quality chips follow, and remaining space admits contextual chips. Final visual order starts with GOAT, then the consolidated Outstanding Activity chip, event reports, No Orgasm, repeated/simultaneous orgasm patterns, activity quality, lackluster Sex/Oral quality, leaning, rare role, interaction, negative rating, Favorite Vatos, Mexican lineup, filler, Few highlights, and remaining context; evidence score and label break ties within a kind. A dormant Everybody Nuts candidate type/policy is retained solely to make later restoration of the commented generation block straightforward.

### Files Added or Modified

- `ui/v2.5/src/components/Scenes/sceneCardInsightsData_custom.ts` - Rule orchestration, tag/event/GOAT classification, performer role-graph patterns, activity attribution, leaning/minority levels, quality leveling, and negative evidence.
- `ui/v2.5/src/components/Scenes/sceneCardInsightTypes_custom.ts`, `sceneCardInsightFacts_custom.ts`, and `sceneCardInsightSelection_custom.ts` - Shared insight contracts, interval/evidence facts, tooltip formatting, and the centralized typed selection policy.
- `ui/v2.5/src/components/Scenes/sceneCardInsightPerformerRules_custom.ts` and `ui/v2.5/src/utils/ratingCardStyles_custom.ts` - Mexican and Royal Sapphire lineup rules using the same exact metallic-card resolution as performer cards.
- `ui/v2.5/src/components/Scenes/SceneCardInsights_custom.tsx` - Reusable accessible seven-chip strip and complete hover popup for scene cards and scene Details.
- `ui/v2.5/src/components/Scenes/OutstandingActivityMatrix_custom.tsx` and `outstandingActivityMatrix_custom.scss` - Shared responsive table and insight modal with sticky tag rows and per-performer cells.
- `graphql/schema/types/stats_custom.graphql`, `internal/api/scene_stats_activity_matrix_custom.go`, and `ui/v2.5/graphql/queries/stats_custom.graphql` - Global, studio-scoped, and performer-scoped total-only Activity Matrix query and aggregation.
- `ui/v2.5/src/components/SceneStats/SceneStatsActivityMatrix_custom.tsx`, `sceneStatsActivityMatrixData_custom.ts`, `sceneStatsSection_custom.ts`, and `ui/v2.5/src/components/Performers/PerformerDetails/PerformerStatsPanel.tsx` - Shared SceneStats/studio/vato Activity Matrix UI, sub-tag roll-up control, scoped tag-marker links, deterministic row mapping, and URL-backed state restoration.
- `ui/v2.5/src/components/Tags/TagDetails/TagMarkersPanel.tsx`, `Tag.tsx`, and `tagMarkerNavigation_custom.ts` - Non-overlap-aware ordinary Tag Markers navigation and matrix-link direct/sub-tag mode restoration.
- `ui/v2.5/src/components/Scenes/SceneDetails/SceneStatsPanel.tsx` - Places the full Outstanding Activity matrix in its own Activity Matrix view inside Open Detailed Stats.
- `ui/v2.5/src/components/Scenes/SceneCard.tsx` and `styles.scss` - Card integration, insight presentation, and active activity-sort fallback badge behavior.
- `ui/v2.5/src/components/Scenes/SceneCardGrid.tsx`, `SceneRecommendationRow.tsx`, `ui/v2.5/src/components/Galleries/GalleryDetails/GalleryScenesPanel.tsx`, and `ui/v2.5/src/components/Scenes/SceneDetails/SceneDetailPanel.tsx` - Batch-load performer history for every scene-card surface and place the shared strip between Studio Code and Description on the scene Details tab.
- `graphql/schema/types/performer_custom.graphql`, `internal/api/resolver_query_find_performer_custom.go`, `pkg/scene/query_custom.go`, `pkg/sqlite/scene_performer_counts_custom.go`, and `ui/v2.5/src/components/Performers/performerRoleStats_custom.ts` - Batched total-scene and all-Oral-role history used by rarity decisions without per-card N+1 queries.
- `ui/v2.5/src/components/Performers/performerRolePartnerLabels_custom.ts` - Shared Partners-tab action wording for rarity labels.
- `graphql/schema/types/scene_custom.graphql`, `internal/api/resolver_model_scene_marker_tag_ancestors_custom.go`, and `pkg/sqlite/scene_marker_tag_ancestors_custom.go` - Scene-level flattened marker-tag ancestry GraphQL field and recursive SQLite lookup.
- `ui/v2.5/graphql/data/scene-slim.graphql` and generated GraphQL bindings - Supplies flattened marker-tag ancestry, performer country/rating evidence, and stored scene Rating Advisor criteria used by scene-card insight calculations.
- `ui/v2.5/src/core/config.ts`, `ui/v2.5/src/components/Settings/SettingsCustomPanel.tsx`, `ui/v2.5/src/components/Settings/Settings.tsx`, and `ui/v2.5/src/locales/en-GB.json`/`en-US.json` - Persisted UI configuration, actual painted example chips beside every numeric insight cutoff, and the Custom Settings tab placed at the bottom of the Settings navigation.
- `ui/v2.5/tests/sceneCardInsightsData_custom.test.ts` - Focused deterministic insight tests.
- `internal/api/scene_stats_activity_matrix_custom_test.go`, `ui/v2.5/tests/sceneStatsActivityMatrixData_custom.test.ts`, and `sceneStatsActivityMatrixPlacement_custom.test.ts` - Feet/GOAT aggregation, hierarchy, total-only mapping, vato scoping/navigation, placement, and duration-order coverage.
- `ui/v2.5/tests/sceneCardDescription_custom.test.ts` - Guards the card-only description removal.
- `ui/v2.5/tests/sceneCardInsightsTooltip_custom.test.ts` - Guards ref and event-prop forwarding for hoverable insight chips.
- `ui/v2.5/tests/sceneDetailsInsights_custom.test.ts` - Guards the shared strip's Details-tab placement and batched role-history hookup.

### Test Cases Added

- Verifies arbitrary non-activity tags sort by merged duration, retain Some/Good amount of/Lots of/as far as the eye can see at the configured boundaries, share equal-tier wording across the top two names, preserve legacy hover evidence, keep GOAT separate and higher-priority, include Feet, retain performer image paths, split ordinary Outstanding and GOAT matrix evidence, and aggregate total/per-performer duration plus marker counts in the complete matrix.
- Verifies GOAT-named tags are suppressed from common and uncommon Outstanding chips, the next-duration common tag backfills the open slot, one-tag chips remain grammatical, empty chips disappear, and GOAT becomes the matrix trigger when both chips disappear.
- Verifies overlapping marker ranges merge into one episode.
- Verifies GOAT fans out to every direct named non-qualifier tag, preserves configured activity names such as `BJ`, preserves exact casing, and falls back to a GOAT moment only without another named tag.
- Verifies the mutually exclusive aggregate Orgasm and Facial reports, Facial exclusion from the Orgasm total, GOAT-over-Really-Hot precedence, 2nd Camera exclusion, suppression of legacy event-variant chips, arbitrary-depth ancestor classification, GOAT performer merging and ordinary-tag suppression without cross-performer leakage, seven visible chips with the complete candidate set retained for hover, top-only highlight attribution, simultaneous/repeated orgasm chips, disabled Everybody Nuts generation, and same-performer tag consolidation only within the same amount level.
- `pkg/sqlite/scene_marker_tag_ancestors_custom_test.go` verifies that flattened marker-tag ancestry includes parent and grandparent levels.
- Verifies activity-quality levels using only outstanding activity percentage plus minimum whole-scene evidence, compact duration/marker tooltips, evidence-qualified Sex/Oral leaning and minority-activity levels, single-activity exclusion, configurable cutoffs, Few Highlights episode-and-percentage AND behavior, all-marker coverage, compact percentage/duration filler evidence, high-priority No Orgasm retention near the chip ceiling, scene-criteria-based Ugly Top/Ugly Bottom/Ugly Tops warnings, performer-rating exclusion, and the ordinary seven-chip maximum.
- Verifies the three mutually exclusive two-vato versatility patterns, direct versatile-tooltip wording, the retained 3+ vato group patterns including Versatile Group and Balanced Orgy, pattern precedence, minimum interaction evidence per direction, and suppression when a listed scene performer has no qualifying interaction.
- Verifies the inclusive 20% rarity boundary, five-scene minimum, independent Sex and Oral role denominators, Partners-tab action wording, priority above Traditional/Versatile interaction chips, Facial-to-all-scenes denominator, and complete candidate retention beyond the seven-chip strip.
- Verifies Mexican single/multiple/all-cast labels and Favorite Vatos exact Royal Sapphire numeric-threshold/override-tag precedence.
- Verifies scene cards do not render scene description text.
- Verifies scene insight chips forward tooltip refs and hover/focus event props.

### GraphQL Schema Changes

- Adds `Scene.scene_marker_tag_ancestors: [SceneMarkerTagAncestors!]!`, containing each direct marker tag ID and all of its recursive ancestor IDs. Both `SlimSceneData` and `SceneData` request the field for scene-card and scene-detail classification.
- Adds `scene_count`, `oral_role_top_count`, and `oral_role_bottom_count` to `PerformerRoleStats`; the Oral role fields intentionally include mixed Sex/Oral scenes for independent role-rarity ratios.

### Configuration Dependencies

- Uses the existing configured Sex, Oral, Solo, Orgasm, Facial, Really Hot, GOAT, and 2nd Camera tag IDs.
- `configuration.ui.sceneCardInsightThresholds` configures the visible-chip limit (default 7, bounded from 1 to 20), Good amount of/Lots of/as far as the eye can see tag-coverage levels, all four activity-quality levels, Rare instance maximum role share, Few Highlights maximum episodes and scene percentage, Filler total percentage, the three Lackluster Sex/Oral thresholds, the Balanced Scene tolerance, and the three leaning-scene minority levels. Defaults are 10/25/50% tag coverage, 20/40/60/80% activity quality, 20% maximum rare-role share, 1 outstanding episode and 5% highlight coverage, 20% filler, 30% negative / 35% Outstanding suppression / 85% non-Outstanding for Lackluster, a 10 percentage-point Sex/Oral balance tolerance, and 10%/25%/40% minority shares for some/a good amount/a lot of. The full-insights popover opens above its plus trigger when there is insufficient room below it.
- Favorite Vatos uses the existing performer Royal Sapphire threshold plus configured Gold/Ruby/Emerald/Sapphire/Royal Sapphire override tag IDs, with override tags taking precedence exactly as they do on performer cards.

## Negative Marker Total Time

The scene details Skip tab shows the total unique video time covered by its negative markers beside the Add button. Overlapping ranges are merged so the metric reflects actual playback time skipped rather than double-counting overlapping markers, and ranges are bounded to the scene's first video duration when available.

### Files

- `ui/v2.5/src/components/Scenes/SceneDetails/SceneNegativeMarkersPanel.tsx` - Renders the Skip-tab metric.
- `ui/v2.5/src/components/Scenes/SceneDetails/sceneNegativeMarkerDuration_custom.ts` - Calculates merged, video-bounded negative-marker coverage.
- `ui/v2.5/tests/sceneNegativeMarkerDuration_custom.test.ts` - Covers overlaps, invalid/out-of-bounds ranges, and scenes without a video duration.
- `ui/v2.5/tests/sceneNegativeMarkersPanel_custom.test.ts` - Guards the metric's placement above the Skip-tab marker list.

### GraphQL Schema Changes

- None.

### Configuration Dependencies

- None.

---

## 55. Groups UI Labelled as Movies

### Overview

The Groups entity is presented as “Movies” in the English UI. Internal GraphQL names, routes, IDs, component names, and backend structures remain unchanged.

### Files Modified

- `ui/v2.5/src/components/MainNavbar.tsx`
- `ui/v2.5/src/locales/en-GB.json`

### Tests

No behavior or data model changes; frontend formatting and type checks cover the modified UI surface.

---

## Marker Mutation Performance

### Overview

Regular and negative marker saves update the current scene's normalized Apollo cache immediately instead of blocking on the complete `FindScene` graph. Mounted marker groups and performer-role badges refresh through narrow, non-awaited operations. Performer marker roles are calculated for the whole scene in one backend batch, and GraphQL marker relationships share request-scoped loaders for scenes, tags, and top/bottom performers. Regular marker updates skip unchanged relationship rewrites and rating-mode scans. Marker gap warnings build sorted range indexes once per render and reuse them across every marker card.

### Files Added or Modified

- `graphql/schema/schema_custom.graphql`, `internal/api/resolver_query_scene_performer_marker_roles_custom.go`, `pkg/models/scene_performer_marker_roles_custom.go`, and `pkg/scene/performer_marker_roles_custom.go` - Add the scene-wide performer-role query and one-pass calculation.
- `internal/api/loaders/batch_loader_custom.go`, `scene_marker_relations_custom.go`, `dataloaders.go`, and the SceneMarker resolvers - Batch direct marker relationships for GraphQL requests.
- `internal/api/resolver_mutation_scene.go` - Avoids unchanged tag/performer writes and unnecessary scene-rating mode comparisons.
- `ui/v2.5/src/core/StashService.ts`, `sceneMarkerCache_custom.ts`, and both marker forms/panels - Apply scoped normalized cache updates and narrow background refreshes without synchronous full-cache garbage collection.
- `ui/v2.5/graphql/mutations/scene-marker.graphql` - Uses a direct marker mutation fragment that omits the recursively nested scene graph.
- `ui/v2.5/src/components/Performers/PerformerCard.tsx` - Shares one scene-wide marker-role operation across performer cards.
- `ui/v2.5/src/components/Scenes/SceneDetails/sceneMarkerGapWarning_custom.ts` and both marker panels - Reuse prepared warning indexes across all cards.

### Test Cases Added

- Verifies request batching and caching for custom marker relationship loaders.
- Verifies scene-wide role output and constant marker/tag/performer association query counts.
- Verifies unchanged relationship comparisons used by marker updates.
- Verifies normalized marker cache insertion/removal without duplicates.
- Verifies prepared warning results match the standalone calculation and do not reread every source marker per lookup.

### GraphQL Schema Changes

- Adds `scenePerformerMarkerRoles(scene_id: ID!): [ScenePerformerMarkerRoles!]!` with `performer_id` and `roles` fields.

### Configuration Dependencies

- Uses the existing configured Sex, Oral, Solo, Facial, Orgasm, Feet, and 2nd Camera role tag IDs.

---

## Scene Detail Mutation Performance

### Overview

Scene-detail mutations avoid work that is unrelated to the field being changed. The Organized toolbar action uses a three-field mutation response. Edit-tab saves submit only dirty values, return a metadata-only scene fragment, and suppress identical relationship sets before SQLite can delete and recreate joins. Scene cache invalidation is based on the changed relationship fields and defers global cache garbage collection.

Play and O history actions request count-only results while retaining backward-compatible full-history responses for GraphQL clients that select `history`. Count-only requests use `COUNT` instead of reading and allocating every date. The UI inserts or removes the known dates in normalized cache and keeps O video timestamps aligned. Resume-time and play-duration resets update only their scene fields. O mutations adjust scene and performer rating bonuses from one batched target/count query instead of reloading rating scores and O counts separately for every performer.

### Files Added or Modified

- `ui/v2.5/graphql/mutations/scene.graphql` and `scene-o-timestamp.graphql` - Add the lightweight Organized/edit response fragments and count-only History operations.
- `ui/v2.5/src/components/Scenes/SceneDetails/Scene.tsx`, `SceneEditPanel.tsx`, and `sceneEditInput_custom.ts` - Route Organized separately and submit only dirty edit fields.
- `ui/v2.5/src/core/StashService.ts` and `sceneHistoryCache_custom.ts` - Apply scoped invalidation and local, timestamp-aligned History updates without synchronous hot-path garbage collection.
- `internal/api/scene_update_relationships_custom.go` - Suppresses unchanged URL, performer, tag, gallery, group, and stash-ID relationship writes.
- `internal/api/history_mutation_selection_custom.go`, `pkg/models/history_mutation_custom.go`, and `pkg/sqlite/history_result_custom.go` - Preserve full-history compatibility while making count-only requests constant-payload operations.
- `pkg/models/rating_score_custom.go`, its mock, and `pkg/sqlite/rating_score_o_history_custom.go` - Batch O-rating adjustment targets and counts.

### Test Cases Added

- Verifies dirty scene-edit field selection, including nested relationship and custom-field values.
- Verifies locally inserted/deleted History dates remain sorted and paired with the correct O video timestamps.
- Guards lightweight Organized/edit/History GraphQL documents and absence of synchronous O-deletion cache GC.
- Verifies unchanged scene relationship suppression, count-only history context propagation, and O-rating bonus deltas.

### GraphQL Schema Changes

- None. Existing mutation contracts remain compatible; only UI operation selections were narrowed.

### Configuration Dependencies

- Uses the existing Rating Advisor score configuration when O-derived rating bonuses are active.

---

## Custom TypeScript Test Validation

### Overview

The custom TypeScript tests under `ui/v2.5/tests` run through `npm run test:custom` and are included in `npm run validate`. A test-only Node loader resolves the same `src/` aliases and extensionless TypeScript imports used by Vite, then transpiles TypeScript syntax without producing repository artifacts.

### Files Added or Modified

- `ui/v2.5/package.json` - Adds `test:custom` and includes it in UI validation.
- `ui/v2.5/tests/runCustomTests_custom.ts` - Discovers and imports every `*.test.ts` file in stable order.
- `ui/v2.5/tests/customTestLoader_custom.mjs` - Test-only TypeScript and module-resolution bridge.

### Test Cases Added

- The runner executes all existing custom TypeScript test files; the current suite registers 99 test cases across 54 files.

### GraphQL Schema Changes

- None.

### Configuration Dependencies

- Requires the existing UI development dependencies and Node.js 22 or newer.

---

## Insight Stats Threshold Playground

### Overview

The **Insight Stats** destination in the shared `/stats` navigation opens `/insightstats`. It scans all library scenes and compares saved chip thresholds with a temporary local preview. The table includes scene counts, library percentages, changes in scene counts and percentage points, zero-count chip types, and the engine's disabled/reserved kinds. Users can choose all qualifying chips (including overflow) or only chips visible on scene cards. A separate rating-tier playground provides independent scene and vato numeric threshold inputs for Bronze, Silver, Gold, and Royal Sapphire, with all four metallic inputs arranged on one line in each panel. Side-by-side Scene and Vato panels align each threshold set with its responsive table. Tiers descend from Royal Sapphire through Gold, Silver, Bronze, and No Metallic Tier. Each flat tier table presents Current Count, Projected Count, Current Percentage, Projected Percentage, and Numeric Rating columns, followed by the static source columns; projected values are highlighted green or red when they rise or fall. Percentages use only rated scenes or vatos. Current counts and percentages open an exact-ID Scenes or Vatos list snapshot, including source-specific cells that the regular Metallic Rating filter cannot express; projections stay unlinked. Separate spinner statuses identify chip and rating preview calculations. The final tier follows card/filter precedence: scene Rating Advisor Sapphire bonus, configured GOAT marker (including descendants), highest configured entity-tag override, then the numeric threshold. Vatos are deduplicated across the scanned cast.

The page reuses the card engine's candidates and selection rules, including performer role history, tag ancestry, Rating Advisor criteria, negative markers, and performer rating tiers. Percentages use only eligible scenes: scenes must have at least one activity type marker (a primary configured Sex, Oral, or Solo marker without secondary tags) with an end time. Each eligible scene counts once per row or combination; overlapping rows are not additive. Quality, balance, and interaction patterns each occupy one main row; their individual labels live in the drilldown. Tag drilldowns default to individual tags (one scene may count toward multiple tags), with a toggle retaining full combinations. Performer-specific candidates such as Rare Oral Top, repeated orgasms, Feet, and center-stage interactions are grouped by chip meaning rather than performer. GOAT combinations group across performer names. The first-column entries use the same card chip component and tones, with a tooltip describing each rule. Searchable, paginated drilldowns show observed chip combinations, up to three example scenes, and the relevant threshold controls.

All chip and rating threshold changes stay in component state and never save configuration. Separate reset actions restore the saved values. A background worker loads bounded pages through existing read-only GraphQL queries, retains the scan for subsequent simulations, and cancels obsolete calculations after newer input. IndexedDB caches the scan and saved-threshold baseline for 12 hours. Refresh bypasses the cache; leaving the page terminates the worker. Settings changes reevaluate the cached scan. Cache failures fall back to a fresh scan and are disclosed. Performer-by-tag matrices and full performer-stat queries are omitted: only the role counts needed by Rare Role are derived from the scanned markers, preserving backend tag ancestry and narrower-marker precedence. Intrinsic cast checks remain for interaction and lineup chips. Clicking a current or preview count opens all matching scenes using a removable chip snapshot filter, combined with normal filtering, sorting, and pagination. Match links are browser-local and expire after 12 hours; missing matches fail closed.

### Files Added or Modified

- `ui/v2.5/src/components/InsightStats/InsightStats.tsx`, `InsightStats.scss`, `InsightThresholdControl.tsx`, and `RatingThresholdControl.tsx` — page, responsive tables, drilldown, and temporary chip/rating controls.
- `ui/v2.5/src/components/InsightStats/insightStatsCatalog_custom.ts` — chip inventory and threshold descriptions.
- `ui/v2.5/src/components/InsightStats/insightStatsData_custom.ts` — scene-deduplicated counts, exact tier/source entity IDs, and combination comparison.
- `ui/v2.5/src/components/InsightStats/insightStatsQuery_custom.ts` — paginated scene reads, with incomplete-scan checks.
- `ui/v2.5/src/components/InsightStats/insightStatsWorker_custom.ts` and `useInsightStats_custom.ts` — background scan, cached baseline, debounced previews, stale-result protection, and worker cleanup.
- `ui/v2.5/src/components/Scenes/SceneDetails/sceneMarkerActivityType_custom.ts` — shared activity-type marker classification used by the stats eligibility rule.
- `ui/v2.5/src/components/Scenes/sceneCardInsightTypes_custom.ts` and `sceneCardInsightsData_custom.ts` — expose existing candidates, tier fields, and stable GOAT combination text for statistics without changing card eligibility or selection.
- `ui/v2.5/src/utils/ratingCardStyles_custom.ts` and `ui/v2.5/src/components/Scenes/SceneCard.tsx` — share configured GOAT-marker ancestry detection and promote matching scene cards to Royal Sapphire.
- `ui/v2.5/src/components/Scenes/sceneCardInsightPerformerRules_custom.ts` — relative runtime import for worker bundling. The worker is bundled inline as a blob to comply with Stash's existing Content Security Policy.
- `ui/v2.5/src/App.tsx`, `ui/v2.5/src/components/StatsLinks_custom.tsx`, and `statsPage_custom.scss` — route and four-destination stats navigation.

### Test Cases Added

- `ui/v2.5/tests/insightStats_custom.test.ts` — zero counts, complete threshold inventory, activity-marker eligibility and percentage denominators, GOAT deduplication, merged quality chips, engine/selection parity, local-only threshold changes and reset, exact mutually exclusive scene/vato rating-tier boundaries, rated-population totals, No Metallic Tier, source attribution, override precedence, rating-threshold previews, performer deduplication, rare-role boundaries, tag-combination changes, disappearing/new variants, cancellation, pagination, and query validation against the actual GraphQL schema.
- `ui/v2.5/tests/insightStatsPresentation_custom.test.ts` — verifies descending tiers, aligned side-by-side panels, separate actual/projected columns, exact-ID drilldowns, separate spinner states, rated percentages, the No Metallic Tier row, and readable component sizing.
- `ui/v2.5/tests/ratingCardSceneBonus_custom.test.ts` — verifies direct/descendant GOAT marker detection and Royal Sapphire precedence over lower-tier tag overrides.
- `ui/v2.5/tests/insightStatsWorker_custom.test.ts` — read-only snapshot reuse and suppression of obsolete preview results.
- `ui/v2.5/tests/insightStatsCoverage_custom.test.ts` covers tag splitting, entity-ID deduplication, family grouping, totals-only matrix parity, role-count derivation, cache expiry, and Scene/Vato snapshot links. `pkg/sqlite/scene_insight_filter_custom_test.go` and `performer_insight_filter_custom_test.go` verify absent, empty, matching, and large snapshot sets.
- `insightStatsCache_custom.ts` and `insightStatsRoles_custom.ts` implement persistence and minimal role counts. `src/utils/insightSceneLinks_custom.ts`, `src/models/list-filter/criteria/insight-chip_custom.ts`, `scenes.ts`, `performers.ts`, and `types.ts` implement removable exact-ID Scene and Vato filters.

### GraphQL Schema Changes

- Adds `SceneFilterType.insight_scene_ids: [ID!]` and `PerformerFilterType.insight_performer_ids: [ID!]` in `filters_custom.graphql`, mapped in the corresponding `pkg/models` filter types and applied by the SQLite scene/performer handlers. A single JSON SQL parameter handles large match sets. Backend and UI GraphQL bindings are regenerated; no migration is required.

### Configuration Dependencies

- Reads current `sceneCardInsightThresholds`, `roleTagIds` (including common activity and GOAT tags), `ratingCardThresholds`, and `ratingCardOverrideTagIds`. Preview controls change chip and scene/vato rating thresholds in memory; tag mappings remain those from the scan.

---

## 56. Partners Tab Performer Cards Without Favorite Action

### Overview

Performer cards shown on a performer’s Partners tab no longer display the favorite/heart control or issue favorite updates. Favorite controls remain available on performer cards elsewhere in the UI.

### Files Modified

- `ui/v2.5/src/components/Performers/PerformerDetails/PerformerAppearsWithByRolePanel.tsx`

### Tests

No data or backend behavior changes; the modified TypeScript surface is covered by the frontend lint, formatting, and type checks.

---

## Sequential Marker Actions

### Overview

The regular and negative scene-marker New/Edit dialogs include **Save & Add Next Marker** and **Save & Add Next Negative Marker** actions. Both actions require an end time, save the current marker first, and open a new draft whose start is exactly one millisecond after the saved marker's end.

The next regular marker retains the current title, primary tag, secondary tags, and top/bottom performer assignments while clearing its end time. The next negative marker opens with a blank name and a valid ten-second default range. Its name suggestions use existing negative-marker names. From the Negative Markers panel, the regular action switches to the Markers tab and opens the regular editor at the adjacent timestamp. The two actions also remain available when a regular-marker dialog continues into its inline negative-marker draft. Both actions are available from new markers and existing-marker edits, and remain disabled until the current marker has an end time.

### Files Added or Modified

- `ui/v2.5/src/components/Scenes/SceneDetails/sceneMarkerSequentialActions_custom.ts` - One-millisecond start calculation, draft creation, and cross-panel create requests.
- `ui/v2.5/src/components/Scenes/SceneDetails/SceneMarkerForm.tsx`, `SceneNegativeMarkerForm.tsx`, `SceneMarkersPanel.tsx`, `SceneNegativeMarkersPanel.tsx`, and `Scene.tsx` - Save-and-add actions and the adjacent regular-marker editor handoff.
- `ui/v2.5/src/components/Scenes/SceneDetails/sceneNegativeMarkerForm_custom.ts` and `ui/v2.5/tests/sceneNegativeMarkerForm_custom.test.ts` - Valid adjacent negative-marker range creation and focused coverage.
- `ui/v2.5/tests/sceneMarkerSequentialActions_custom.test.ts` - Focused boundary, retained marker setup, and clean negative-marker draft coverage.

### GraphQL Schema Changes

None. The actions use the existing regular and negative scene-marker mutations.

### Configuration Dependencies

None.

---

## Mobile Remote O Recording

### Overview

The `/remote/o` page records an O against a paired browser's current scene and video position. On a scene, open **File Info** and choose **Pair phone for O**, enter the server address reachable from the phone, and scan the QR code. Codes expire after five minutes and work once. The phone remembers the browser in local storage; subsequent scene changes, player reloads, and Stash restarts do not require rescanning. Clearing browser storage or forgetting the pairing requires a new scan. Pairing identifies the player and does not bypass normal Stash authentication.

The phone shows the active scene, playback status, timestamp, and a large O button. The player samples its own time when the command arrives, so accuracy is subject to network delay. Successful recording returns a timestamped receipt. Paused playback is supported; buffering, seeking, unloaded video, stale connections, and mismatched scenes/sessions are rejected. Scene players and the marker playlist both participate; multiple tabs/panels sharing a browser identity cannot simultaneously own the remote. Disable remote control in the other tab/panel using its pairing dialog to change ownership.

Each scene/source activation uses a fresh session. State expires after five seconds without a heartbeat. Each tap has a unique command ID; concurrent retries reuse a receipt and only one O is written. Commands expire after 30 seconds and their IDs/receipts are retained in memory for 24 hours. A server identity embedded in each command prevents an unconfirmed pre-restart tap from being replayed as a new O. Pending taps survive a phone-page reload in session storage. If confirmation is unavailable, retry the same tap, or check O history before explicitly starting another. After a server crash, history is authoritative for an interrupted write.

### Files Added or Modified

- `internal/api/remote_playback_custom.go` — session ownership, expiring one-use pairing, command delivery, and receipt registry.
- `internal/api/resolver_remote_playback_custom.go` — GraphQL handlers and serialized recording transaction.
- `internal/api/resolver_mutation_scene_custom.go` — shared O write/rating adjustment and finite non-negative timestamp validation.
- `graphql/schema/schema_custom.graphql` and `ui/v2.5/graphql/remote-playback_custom.graphql` — remote queries, mutations, subscriptions, and generated bindings.
- `ui/v2.5/src/components/RemoteO/RemoteO.tsx`, `RemotePairing.tsx`, `remotePlayback_custom.ts`, and `useRemotePlayer_custom.ts` — mobile remote, QR pairing, validation, and active-player bridge.
- `ui/v2.5/src/components/ScenePlayer/ScenePlayer.tsx`, `ui/v2.5/src/components/Scenes/MarkerPlaylistPlayer.tsx`, and `ui/v2.5/src/App.tsx` — player integrations and route.
- `ui/login/login.html` — preserves the pairing fragment through login without adding the code to the credentials POST.
- `ui/v2.5/package.json` and `pnpm-lock.yaml` — pinned `qrcode.react` dependency; QR generation happens locally.

### Test Cases Added

- `internal/api/remote_playback_custom_test.go` — one-use/expired pairing, competing and stale sessions, invalid positions, unavailable players, command/receipt replay, restart rejection, canceled subscriptions, and simultaneous retries producing exactly one O and rating adjustment.
- `ui/v2.5/tests/remotePlayback_custom.test.ts` — scene/session matching, paused/buffering behavior, invalid timestamps, prefixed pairing URLs, saved pending requests, and execution of the login handler to verify fragment preservation without token disclosure in the POST body.

### GraphQL Schema Changes

Adds remote playback state, request, command, and receipt types; state query; update/disconnect/request/record/pairing mutations; and state/command/result subscriptions. Backend and frontend bindings are regenerated. No database migration is required.

### Configuration Dependencies

The phone and playback browser must reach the same Stash instance. Use the existing login when authentication is enabled, and a phone-reachable address including the correct port. A reverse-proxy path prefix is preserved. Local browser storage holds the remembered identity/address; the pairing code is carried in the URL fragment. External players are not integrated; casting accuracy depends on the active browser player's reported timestamp. Device-to-device behavior still requires a live smoke test after deployment.

---

## Compact Low-Cardinality Stats Charts

### Overview

Scene Stats and Vato Stats keep high-cardinality and time-series charts full width while placing stable charts with only a few categories into responsive multi-column grids. Scene Stats keeps the related Has Facial, By Number of Facial, and By Number of Really Hot Facial charts together in a three-column row, while Metallic Rating, Scene Type, and Resolution use the compact grid; Vato Stats compacts Metallic Rating and Circumcised. Compact chart bars flex to the panel width and collapse back to one column on smaller screens. Overflowing strips stay left-aligned so the first bar remains reachable while scrolling through the full data set.

### Files Added or Modified

- `ui/v2.5/src/components/SceneStats/SceneStats.tsx` and `SceneStats.scss` — separate stable charts into a compact responsive grid and let their bars use the available panel width.
- `ui/v2.5/src/components/VatoStats/VatoStats.tsx` and `VatoStats.scss` — separate stable Metallic Rating and Circumcised charts into the compact grid with the same responsive bar sizing.

### Test Cases Added

- `ui/v2.5/tests/statsChartLayout_custom.test.ts` — verifies both pages keep the selected stable charts in compact grids and flex their bars into the available panel width.
- No data or backend behavior changes; the modified TypeScript and SCSS surfaces are covered by the frontend formatting, lint, and type checks.

### GraphQL Schema Changes

- None.

### Configuration Dependencies

- None.


---

## Scene Tagger Copper Styling and Save Preview

### Overview

Scene Tagger groups each local scene and its scraped matches inside one bordered card. The Black Steel theme uses steel surfaces and copper borders to connect the rows and emphasize the selected match. The local-details disclosure now has a text label and expanded state.

The selected result shows a live Changes on Save comparison above Save, with Local now and After Save columns, explicit Added/Removed/Changed labels, highlighted changed values, and collapsible unchanged fields. It covers title, studio code, date, director, details, studio, performers, tags, URLs, Stash IDs, and organized state. Selected cover replacements show both images. Helper text is limited to concise change counts and an unmatched-performer status; cover replacement still depends on a valid download, and image equality is not assumed. Unresolved performer matches are identified as excluded from the save.

Preview and Save share the same update builder, preserving null remote fields by default, field exclusions, performer/URL merging, current tag selections, and source-specific Stash ID replacement. Entity comparisons use local IDs and resolve display names through existing select queries. Stash ID order and refresh timestamps do not count as metadata changes. Small screens can scroll the comparison horizontally.

When title, details, date, studio code, or director has a local value but the scraped field is null or missing, the main comparison shows Remote empty and Kept locally. Each such row has an unchecked Clear on Save checkbox; selecting it previews Removed and sends an explicit null on Save. Unchecking restores the local value. Excluded fields cannot be cleared, and clear selections belong only to the current scraped result. The header counts actual changes separately from informational kept values.

### Files Added or Modified

- `ui/v2.5/src/components/Tagger/scenes/sceneSavePreview_custom.ts` — shared update builder and field comparison logic.
- `ui/v2.5/src/components/Tagger/scenes/SceneSavePreview.tsx` — comparison, entity names, cover preview, and unchanged-field disclosure.
- `ui/v2.5/src/components/Tagger/scenes/sceneSavePreview_custom.scss` — grouped scene/result styling and responsive comparison.
- `ui/v2.5/src/components/Tagger/scenes/StashSearchResult.tsx` — shared save input, preview integration, and Save below the comparison.
- `ui/v2.5/src/components/Tagger/scenes/TaggerScene.tsx` — grouping class and accessible local-details disclosure.

### Test Cases Added

- `ui/v2.5/tests/sceneSavePreview_custom.test.ts` — exclusions, absent and empty scraped values, performer and URL deduplication, unresolved performers, tag merge/overwrite/clear selections, studio replacement, organized state, source-specific Stash IDs, timestamp/order equality, informational remote-empty rows, opt-in clearing and undo for all five scalar fields, exclusion precedence, stale clear selections with incoming values, both-empty fields, and rendered comparison/cover/unchanged/checkbox states.

### GraphQL Schema Changes

- None. Uses existing entity select queries.

### Configuration Dependencies

- Respects Tagger's existing cover, tags, tag-operation, performer-gender, and mark-organized settings. Copper colors apply under the existing masculine-black application theme, with fallback styling for the default theme. No new configuration or backend changes.
