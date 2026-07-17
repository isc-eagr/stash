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
- `ui/v2.5/src/utils/statsDrilldown_custom.ts`
- `ui/v2.5/tests/sceneStatsSummary_custom.test.ts`
- `ui/v2.5/tests/statsDrilldown_custom.test.ts`
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

### Orgasm & Facial Counting Logic

The `sceneOrgasmCount` and `sceneFacialCount` resolvers use the following logic:

- **Subtag Support**: Markers are counted if their primary tag OR any secondary tag is the target tag (e.g., "orgasm") or any of its descendants/subtags
- **Top-based Counting**: Each matching marker counts once per assigned top performer, with a minimum count of 1 when no top is assigned
- **Search Difference Tooltip**: Total cards explain that their linked marker search counts marker rows rather than tops and includes 2nd-camera markers excluded from statistics, so the totals can differ
- **Vato Summary Consistency**: Sex/oral top and bottom cards count primary tags, secondary tags, and all descendants just like their performer-search drilldowns; Solo Only counts any assigned role

### GraphQL Queries (Custom)

**File:** `graphql/schema/types/stats.graphql`

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

A widget for tracking progress on tagging tasks. Users can define trackers linked to specific tags and monitor completion progress.

### File

**NEW:** `ui/v2.5/src/components/TaskProgress.tsx`

### Features

- Create/edit/delete progress trackers
- Each tracker has: name, initial count, linked tag
- Shows current tagged item count vs initial (progress bar)
- Linked tags count all directly tagged item types: scenes, scene markers, images, galleries, performers, studios, and groups
- Persisted in UI configuration

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
- `pkg/sqlite/scene_marker_tag_overlap_custom.go` - Shared overlap-aware marker tag SQL helpers
- `pkg/sqlite/performer_filter_custom.go`, `pkg/sqlite/performer_custom.go`, `pkg/sqlite/studio_custom.go` - Performer/studio marker tag filters and sorts reuse overlap-aware marker tag matching
- `pkg/sqlite/scene_marker_test.go` - Integration tests for overlap-aware scene include/exclude, marker-page filtering, overlap groups, and direct marker performer ownership
- `docs/scene_marker_filter_builder_poc.html` - Standalone proof-of-concept for a dedicated marker filter builder UI

Allows filtering scenes by their marker tags with **role-specific performer attributes**:

- `EQUALS`: Groups of tags where each group requires all tags present in a single marker, including effective tags from partially overlapping markers in the same scene/time range
- `INCLUDES`: Any scene with markers having any of the specified tags
- `Scene Markers: Exclude`: Exclusion groups use the same overlap-aware tag matching, so a scene can be excluded when a marker plus its overlapping markers collectively satisfy the group
- Marker-list results only return markers that directly have at least one requested tag; when multiple overlapping direct-tag markers satisfy the same tag-only group, the shortest marker wins
- Marker performer constraints are always evaluated against the marker itself. Overlapping markers can contribute effective tags, but they do not contribute top/bottom performer assignments.
- `overlap_groups`: Advanced direct marker requirements that must be satisfied by markers whose time ranges overlap. These groups reuse `SceneMarkerTagGroupInput`, including named and unnamed top/bottom/both-role performer criteria, so searches like "feet marker with unnamed top overlaps BJ marker with unnamed bottom" can be expressed without collapsing role assignments across markers. Reusing the same unnamed performer ID across overlap groups requires the same actual performer in each specified role. Marker-list overlap results return only the narrowest matched requirement marker.
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

Studios can now be sorted by their scene category counts (sex, oral, solo, facial). Both ascending and descending directions are supported.

**Backend Files:**

- `pkg/sqlite/role_tag_provider.go` - NEW: Configuration provider for role tag IDs
- `pkg/sqlite/studio.go` - Sort queries for marker-based counts

**Frontend Files:**

- `ui/v2.5/src/models/list-filter/studios.ts` - Sort options

**Manager Files:**

- `internal/manager/init.go` - Initialize role tag provider
- `internal/manager/manager.go` - Role tag provider implementation

**Translation Keys:**

- `ui/v2.5/src/locales/en-GB.json` - sex_scene_count, oral_scene_count, solo_scene_count, facial_scene_count

**New Sort Options:**

- `sex_scenes_count` - Sort by scenes with sex markers
- `oral_scenes_count` - Sort by scenes with oral markers (excludes sex)
- `solo_scenes_count` - Sort by scenes with solo markers (excludes sex/oral)
- `facial_scenes_count` - Sort by scenes with facial markers
- `unique_performers_count` - Sort by count of performers with only 1 scene (and it's for this studio)
- `o_count` - Sort by total O-count (sum of scene o_dates + image o_counter for the studio)

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
4. **Activity Duration Percentages**: Scene cards show a two-row runtime strip. The first row shows Sex, Oral, Solo, and Other percentages from configured primary role marker tags; same-category overlaps are merged, cross-category overlaps count toward each category, and Other represents runtime without a sex/oral/solo marker. The second row shows Outstanding, Standard, and Unusable: Outstanding is any timed marker that is not a configured sex/oral/solo primary marker, or a configured sex/oral/solo primary marker with secondary tags; Standard is unmarked runtime or plain configured sex/oral/solo marker runtime not overlapped by Outstanding; Unusable comes from negative/Skip marker ranges.

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
- `configuration.ui.taskProgressTrackers` (for TaskProgress component)
- `configuration.ui.showMultiSegmentLoopControls` (for multi-segment loop feature)

---

## 13. Multi-Segment Loop Controls

### Overview

An enhanced looping system for the scene player that allows you to define multiple A-B segments instead of just one. When loop is enabled, the player will play through all defined segments in order, then repeat from the first segment.

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
- `ui/v2.5/src/@types/videojs-multi-segment-loop.d.ts` - TypeScript type declarations
- `ui/v2.5/tests/multiSegmentSelection_custom.test.ts` - Bulk selection helper tests

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

### Test Cases Added

- `ui/v2.5/tests/multiSegmentSelection_custom.test.ts` - Verifies selected and unselected segment ID deletion lists for the bulk actions

### Configuration Dependencies

- `configuration.ui.showMultiSegmentLoopControls` - Boolean to enable the feature

---

## 14. Marker Playlist Player

### Overview

A dedicated player page that allows you to select multiple markers from the Markers page (`/scenes/markers`) and play them sequentially in a loop. This works across different scenes - the player automatically loads each scene's video and seeks to the marker position.

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
- Automatic advancement from one marker to the next
- Loop mode to continuously play all markers
- Previous/Next navigation controls
- Playlist sidebar with all markers listed
- Click any marker in the sidebar to jump to it
- Duration display for total playlist time
- "Now Playing" indicator showing current marker
- Displays marker-assigned performers (when present)

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

### Files Created

- `ui/v2.5/src/components/Scenes/MarkerViewer.tsx` - Main viewer component
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

### Files Created

- `ui/v2.5/src/components/Scenes/MultiVideoViewer.tsx` - Shared video panel viewer used by marker and scene viewers
- `ui/v2.5/src/components/Scenes/SceneViewer.tsx` - Scene data adapter for the shared viewer
- `ui/v2.5/src/components/Scenes/SceneViewerQueueIndicator.tsx` - Scenes toolbar queue controls
- `ui/v2.5/src/hooks/SceneViewerQueue.tsx` - In-memory scene viewer queue context

### Files Modified

- `ui/v2.5/src/App.tsx` - Added `SceneViewerQueueProvider`
- `ui/v2.5/src/components/Scenes/Scenes.tsx` - Added route for `/scenes/viewer`
- `ui/v2.5/src/components/Scenes/SceneList.tsx` - Added scene viewer queue controls to the scenes toolbar
- `ui/v2.5/src/components/Scenes/MarkerViewer.tsx` - Refactored to use the shared viewer component

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
- The Markers page tag matching treats a marker as having tags from partially overlapping markers in the same scene/time range, while preserving direct primary/secondary tag matching. Returned marker rows must directly have at least one requested tag, and overlapping matches collapse to the shortest qualifying marker.
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

Adds additional statistics used by the custom stats pages: estimated liters (from orgasms), total penis meters (sum of performer penis lengths), total orgasm time, and total facial time. Total Orgasm/Facial counts and time are displayed on `/scenestats`; estimated liters and total penis meters remain vato summary cards on `/vatostats`. O-date records and O marker-tag analytics are shown on the hidden `/ostats` page.

### GraphQL Schema Extensions

**File:** `graphql/schema/types/stats.graphql`

```graphql
extend type Query {
  estimatedLiters: Float!
  totalPenisMeters: Float!
  totalOrgasmTime: Float!
  totalFacialTime: Float!
  mostOsInDay: SceneODayStat
  longestPeriodWithoutO: SceneODrySpell
  sceneOCountsByTag: [SceneOCountByTag!]!
}
```

### Backend Implementation

**File:** `internal/api/resolver.go`

- `EstimatedLiters` resolver: Uses `SceneOrgasmCount` (one event per top on an orgasm marker, with a minimum of one) and multiplies by 3ml (0.003L)
- `TotalPenisMeters` resolver: Sums performer penis lengths (defaulting to 17cm when null), converts to meters
- `TotalOrgasmTime` resolver: Sums duration of all orgasm markers (uses end_seconds - seconds, or 20s default if no end time)
- `TotalFacialTime` resolver: Sums duration of all facial markers (uses end_seconds - seconds, or 20s default if no end time)
### Frontend Files

- `ui/v2.5/src/components/SceneStats/SceneStats.tsx` - Displays total orgasm/facial counts and total orgasm/facial time with marker drilldown links
- `ui/v2.5/src/components/VatoStats/VatoStats.tsx` - Displays estimated liters and total penis meters as vato summary cards

### Features

- **Estimated Liters**: Calculates total orgasms (one event per top on each matching marker, with a minimum of one) × 3ml converted to liters, displayed with 2 decimal places
- **Total Penis Meters**: Sums all performer penis lengths (uses 17cm default), displays in meters with 🍆 emoji
- **Total Orgasm Time**: Sum of all orgasm marker durations (end_seconds - seconds), using 20s default when no end timestamp
- **Total Facial Time**: Sum of all facial marker durations (end_seconds - seconds), using 20s default when no end timestamp
- **Clickable Total Orgasms**: Links to Markers page filtered by orgasm tag (using configured orgasmTagId)
- **Clickable Total Facials**: Links to Markers page filtered by facial tag (using configured facialTagId)

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

Replaced the complex unified `performer_markers` filter with two simpler, more intuitive filters for searching performers by their scene marker participation:

- **Marker Tags**: Filter by markers with specific tags and the performer's role
- **Marker Partners**: Filter by markers shared with partners having specific attributes

### Files Created/Modified

**New Criterion Files:**

- `ui/v2.5/src/models/list-filter/criteria/performer-marker-tags.ts` - Tag-based marker filter with role selection
- `ui/v2.5/src/models/list-filter/criteria/performer-marker-partners.ts` - Partner attribute-based marker filter

**New Filter Component Files:**

- `ui/v2.5/src/components/List/Filters/PerformerMarkerTagsFilter.tsx` - UI for marker tags filter
- `ui/v2.5/src/components/List/Filters/PerformerMarkerPartnersFilter.tsx` - UI for marker partners filter

**Modified Files:**

- `ui/v2.5/src/models/list-filter/performers.ts` - Replaced `PerformerMarkersCriterionOption` with two new options
- `ui/v2.5/src/models/list-filter/types.ts` - Added `performer_marker_tags` and `performer_marker_partners` to CriterionType
- `ui/v2.5/src/components/List/CriterionEditor.tsx` - Added filter renderers for new criterion types
- `graphql/schema/types/filters.graphql` - Added new input types: `PerformerMarkerTagsCriterionInput` and `PerformerMarkerPartnersCriterionInput`
- `internal/api/resolver_filter_performer.go` - Added no-op resolvers for new filter types

### Features

**Marker Tags Filter:**

- Select one or more tags using the standard tag selector
- Choose performer's role on markers: Top, Bottom, or Any (both)
- Supports standard tag filter modifiers: Includes All, Includes, Excludes, Is Null, Not Null
- Searches for performers who have markers matching the tag(s) and role configuration

**Marker Partners Filter:**

- Filter by partner's ethnicity (multi-select)
- Filter by partner's country (multi-select with flags)
- Filter by partner's rating (with range operators)
- Choose partner's role: Top, Bottom, or Any (both)
- Supports modifiers: Includes, Excludes
- Searches for performers who share markers with partners matching the specified criteria

### GraphQL Schema

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

### Migration Notes

The old `performer_markers` filter with its complex include/exclude conditions was replaced with these two simpler filters. The UI is more intuitive and each filter has a specific purpose:

- Use **Marker Tags** when you want to find performers based on what they did (the tags on their markers)
- Use **Marker Partners** when you want to find performers based on who they worked with

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

**File:** `graphql/schema/types/marker-playlist.graphql`

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

**File:** `graphql/schema/types/scene-release.graphql`

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

- `ui/v2.5/src/components/Images/ImageViewer.tsx` - Main viewer component

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

  - Added lazy-loaded `ImageViewer` component import
  - Added route: `<Route exact path="/images/viewer" component={ImageViewer} />`

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
- `ui/v2.5/src/components/List/Filters/PerformerSelectWithUnnamed.tsx` - Enhanced performer select that includes unnamed performers

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

### Overview

Adds a small calculator widget to each task progress tracker card (and the Overall Progress card) that estimates when the task will be completed based on a user-entered items-per-day rate. Not persisted — just an ephemeral in-page calculator.

### Behavior

- Each tracker card shows an "Items/day" input at the bottom when items remain
- When a value is entered, it displays: "Done by MM/DD/YYYY (X days) at Y/day"
- The Overall Progress card also includes the same widget for the total unorganized scene count

### Files Modified

- `ui/v2.5/src/components/TaskProgress.tsx` — Added `itemsPerDay` state map and `overallItemsPerDay` state; added completion estimate widget to each tracker card and the Overall Progress card

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

Adds a `metallic_rating` filter to scenes, performers, images, galleries, groups, and studios. The filter matches the final card style after configured tag overrides and rating thresholds are applied, and supports include/exclude modifiers for `bronze`, `silver`, `gold`, and `royal_sapphire` (displayed as Royal Sapphire).

### Files Modified

- `ui/v2.5/src/components/Scenes/SceneCard.tsx` - Uses shared rating card class helper for scene cards
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
- `pkg/sqlite/metallic_rating_filter_custom.go` - Shared backend metallic style filter predicate
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

---

## 37. Persisted Rating System

### Overview

Adds scene and performer rating system buttons next to the detail-page rating display. Each button opens a modal questionnaire with weighted criteria and live scoring. Selecting a criterion value persists that row to custom rating score tables, recalculates the overall `rating100`, and updates the scene/performer rating immediately.

Suggested tiers use the same configurable 100-based thresholds as the premium/classic card effects. Scene and performer thresholds are configured separately.

Both scene and performer advisor ratings also include a non-editable orgasm count bonus. For scenes, the bonus is calculated from `scenes_o_dates` as +1 rating point on the 3rd recorded orgasm, then +1 for each orgasm after that. For performers, the bonus is +1 rating point on the 3rd recorded orgasm, then +1 for every 2 orgasms after that.
When scene o-history is added, deleted, reset, or recorded with a video timestamp, the stored advisor rating is recalculated for that scene and any attached performers that already have persisted advisor scores.

### Scene Advisor

Uses a simplified weighted scene rubric designed for 100-based ratings:

- Top(s) attractiveness: six levels from 0-5, each raw point is worth 0.6, up to 3.0
- Bottom(s) attractiveness: six levels from 0-5, each raw point is worth 0.2, up to 1.0
- Energy / sex quality: six levels from 0-5, each raw point is worth 0.4, up to 2.0
- Orgasm / climax payoff: each raw point is worth 0.5, up to 2.0
- Usable factor: five levels from 0-4, each raw point is worth 0.5, up to 2.0. It captures how much of the scene works without skipping, accounting for dead setup, overly long interviews, weak positions, negative-marker stretches, strong angles, intensity, and consistently workable action independently from sex quality.

Solo scenes use a separate scene rubric when the scene is detected as solo by the same role-tag logic that renders the hand icon:

- Vato attractiveness: six levels from 0-5, each raw point is worth 1.0, up to 5.0
- Performance: five levels from 0-4, each raw point is worth 0.75, up to 3.0. The scale runs from visibly clocked-out or merely going through the motions through engaged, excited, and fully committed performance.
- Usability: five levels from 0-4, each raw point is worth 0.5, up to 2.0. This merges the former camera-angle dimension with the regular scene usability concept, including pacing and how much works without skipping.

Group scenes use a separate rubric when they have 4 or more distinct assigned performers. Group mode takes priority over solo/default mode; scenes with 3 performers keep the existing rubric:

- Top lineup attractiveness: six levels from 0-5, each raw point is worth 0.4, up to 2.0
- Energy / coordination: six levels from 0-5, each raw point is worth 0.8, up to 4.0. This merges the former energy/sex-quality and group-participation dimensions.
- Orgasm quality: each raw point is worth 0.5, up to 2.0
- Usability: five levels from 0-4, each raw point is worth 0.5, up to 2.0

Group scene bonus section:

- Attractive bottom (+1.0 when present)
- Group oral-only (+2.0 when manually selected)
- Theme / fantasy / uniform factor (+0.5 when present)
- God-tier orgasm (+1.0 when present)
- GOAT element (+2.0 when present)

When a cast edit crosses the 3/4-performer boundary, existing advisor rows are removed and the scene rating is set to 0. Manual scene ratings without advisor rows are preserved. The standalone group reset script applies the same reset to existing 4+ performer scenes that already have advisor data. The solo/group rubric migration converts existing solo attractiveness and camera-work values, promotes active solo Outstanding Performance bonuses to the highest main Performance level, merges persisted group energy/coordination answers, clears retired group standout answers, removes Unlikely Top only from 4+ performer group scenes, and adjusts affected stored scene ratings by the exact contribution delta.

The rating advisor uses a responsive box grid instead of one long control stack. Criteria are shown as at-a-glance cards with one accessible choice-button control, visible hover/focus descriptions, a real unrated state, completion progress, provisional scoring until every criterion is answered, and per-card autosave feedback. The selected choice alone uses a relative heat scale from neutral gray at zero through yellow and orange to red at the highest value, including shorter non-0-5 scales. Bonuses and penalties use compact accessible switches, while the recorded-orgasm bonus is a compact read-only row. The modal has one Close action, a header close button, Escape support, high-contrast unselected choices, and a calculation summary colored with the configured classic/premium rating tier theme. Rating hints and choice descriptions use shorter, casual language that matches the rest of the custom UI. Hovering or focusing the advisor rating button, or the painted rating star on scene and performer cards, opens a compact vertical rating summary. Each criterion uses the same gray-yellow-orange-red heat scale and a normalized bar length so relative strengths are immediately comparable, with its exact signed contribution to the final 0-100 rating shown beside the name; a zero answer leaves the bar completely empty. Active bonuses and the automatic orgasm-count bonus use green check icons; active penalties use red octagonal traffic signs with a white minus. These adjustment rows use popup-only one- or two-word labels, retain their signed final-rating contributions without changing advisor wording, and use a compact two-column layout. Card summaries fetch their advisor data lazily on first hover. Scene and performer card selection checkboxes sit in the lower-left corner so they remain separate from the rating star and its hover target.

Bonus section:

- Orgasm count bonus (+1 rating point on the 3rd recorded orgasm, then +1 for each orgasm after that; automatic and read-only)
- Theme / fantasy / uniform factor (+0.5 when present)
- Oral-only scene (+0.5 when present)
- God-tier orgasm bonus (+1.0 when present)
- GOAT element (+2.0 when present)
- Unlikely top (+0.5 when present)

Solo scene bonus section:

- Orgasm count bonus (+1 rating point on the 3rd recorded orgasm, then +1 for each orgasm after that; automatic and read-only)
- Orgasm bonus (+1.0 when present)
- Feet bonus (+1.0 when present)
- GOAT element (+2.0 when present)
- Theme / fantasy / uniform factor (+0.5 when present)

Penalty section:

- No orgasm (-2.0 when present)
- Production / visual quality (-1.0 when quality actively works against the scene)

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

- Orgasm count bonus (+1 rating point on the 3rd recorded orgasm, then +1 for every 2 orgasms after that; automatic and read-only)
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

Scenes and performers each expose one combined "Rating Criteria" filter. Inside that filter, numeric dimensions support `=`, `>=`, `<=`, and `BETWEEN`; bonus and penalty rows use presence checks for "has" or "does not have". The frontend serializes the selected rows into a shared `rating_criteria` GraphQL input.

The Scenes filter exposes regular, solo, and group criteria as distinct persisted keys. Regular scenes expose top/bottom attractiveness, 20-point energy/sex quality, orgasm quality, and the five-level 20-point Usable Factor. Solo scenes expose attractiveness, performance, and usability. Group scenes expose top-lineup attractiveness, merged energy/coordination, orgasm quality, and usability; attractive-bottom and group-oral-only are presence rows. Unlikely Top remains available only for regular scenes, while the retired Outstanding Performance and Large Group bonuses are not exposed.

Performer rating criteria include a feminine performer penalty, exposed both in the performer Rating Advisor and the performer Rating Criteria filter.

### Files Modified

- `ui/v2.5/src/components/Shared/RatingAdvisor_custom.tsx` - Shared rating modal, scoring definitions, persistence mutation, and button component
- `ui/v2.5/src/components/Shared/Modal.tsx` - Allows the rating advisor to opt into a header close button while preserving existing modal defaults
- `ui/v2.5/src/components/Shared/ratingAdvisor_custom.scss` - Advisor modal styling
- `ui/v2.5/graphql/data/performer.graphql` - Adds a list-only performer fragment so performer lists do not fetch detail-only rating scores and additional image rows
- `ui/v2.5/graphql/queries/performer.graphql` - Uses the list-only performer fragment for performer lists and keeps a full-data by-ID query for merge/detail workflows
- `ui/v2.5/src/core/StashService.ts` - Routes by-ID performer loads through the full-data query
- `ui/v2.5/src/components/Scenes/SceneDetails/Scene.tsx` - Scene detail advisor button
- `ui/v2.5/src/components/Scenes/SceneCard.tsx` - Lazy criteria tooltip on painted scene-card rating stars
- `ui/v2.5/src/components/Performers/PerformerDetails/Performer.tsx` - Performer detail advisor button
- `ui/v2.5/src/components/Performers/PerformerCard.tsx` - Lazy criteria tooltip on painted performer-card rating stars
- `ui/v2.5/src/components/Shared/Rating/RatingSystem.tsx` - Forces ratings to display as 0-100 values
- `ui/v2.5/src/components/Shared/Rating/RatingNumber.tsx` - Simplifies manual ratings to a plain 0-100 input
- `ui/v2.5/src/index.scss` - Imports advisor styling
- `ui/v2.5/src/components/List/styles.scss` - Adds layout for the combined rating criteria filter
- `graphql/schema/types/filters_custom.graphql` - Adds `rating_criteria` scene/performer filter input
- `pkg/models/scene.go`, `pkg/models/performer.go` - Adds rating criteria filter fields
- `pkg/sqlite/scene_filter.go`, `pkg/sqlite/performer_filter.go` - Hooks rating criteria filters into scene/performer queries
- `pkg/sqlite/rating_criteria_filter_custom_test.go` - Covers group key isolation plus numeric and presence filter operators
- `ui/v2.5/src/models/list-filter/scenes.ts`, `ui/v2.5/src/models/list-filter/performers.ts` - Registers rating criteria filter options
- `ui/v2.5/src/locales/en-GB.json`, `ui/v2.5/src/locales/en-US.json` - Adds rating criteria filter labels

### Files Added

- `ui/v2.5/src/components/Shared/groupSceneRating_custom.ts` - Group threshold, scoring weights, bonus values, persisted keys, and frontend mode selection
- `ui/v2.5/src/components/Shared/soloSceneRating_custom.ts` - Solo scoring weights, persisted keys, and base maximum
- `rating_scores.up.sql` - Standalone manual SQL script for generic persisted rating score tables
- `rating_orgasm_bonus_recalculate_custom.sql` - Standalone manual SQL script to recalculate existing persisted advisor ratings after orgasm bonus rule changes
- `rating_remove_performer_unlikely_top_bonus_custom.sql` - Standalone manual SQL script to remove performer-level Unlikely Top bonus rows and recalculate affected performers
- `rating_remove_standout_act_bonus_custom.sql` - Standalone manual SQL script to remove retired Standout Act bonus rows and subtract their stored contribution from affected ratings
- `rating_reset_advisor_scores_custom.sql` - Standalone manual SQL script to delete all persisted advisor dimension rows while preserving existing scene/performer ratings
- `rating_reset_group_scene_scores_custom.sql` - Resets existing 4+ performer scenes with advisor data to rating 0 and removes their old advisor rows
- `rating_reduce_god_tier_orgasm_bonus_custom.sql` - Reduces persisted scene God-tier bonuses from +20 to +10 and subtracts the same 10 points from affected scene ratings
- `rating_rebalance_scene_energy_usable_factor_custom.sql` - Reweights regular-scene Energy answers from 30 to 20 maximum points, removes retired Standout answers, and recalculates affected scene ratings
- `rating_increase_no_orgasm_penalty_custom.sql` - Increases active scene No orgasm penalties from -10 to -20 and subtracts the additional 10 points from affected scene ratings
- `rating_rebalance_solo_group_rubrics_custom.sql` - Converts persisted solo/group rubric rows, removes retired mode-specific values, and updates affected scene ratings by their exact score deltas
- `graphql/schema/types/rating_custom.graphql` - Rating score GraphQL types, mutation, and read-only orgasm-count query
- `internal/api/resolver_rating_score_custom.go` - Rating score query/mutation resolvers
- `internal/api/resolver_rating_score_custom_test.go` - Verifies the 4-performer threshold, group priority, and boundary-reset decisions
- `pkg/models/rating_score_custom.go` - Generic rating score model and repository interfaces
- `pkg/sqlite/rating_score_custom.go` - SQLite score store and rating recalculation logic
- `pkg/models/rating_criteria_filter_custom.go` - Generic rating criteria filter input models
- `pkg/sqlite/rating_criteria_filter_custom.go` - Shared SQLite predicates for criteria/bonus/penalty filters
- `ui/v2.5/src/models/list-filter/criteria/rating-criteria_custom.ts` - Frontend rating criteria filter criterion classes
- `ui/v2.5/src/components/List/Filters/RatingCriteriaFilter_custom.tsx` - Combined rating criteria filter editor
- `ui/v2.5/src/components/Shared/ratingAdvisorScales_custom.ts` - Shared helpers for simplified rating advisor scales
- `ui/v2.5/tests/ratingAdvisorScales_custom.test.ts` - Verifies simplified scales, point contributions, unrated state, intentional zero scores, and core completion
- `ui/v2.5/tests/groupSceneRating_custom.test.ts` - Verifies group mode priority, scoring totals, bonuses, and persisted filter keys
- `ui/v2.5/tests/soloSceneRating_custom.test.ts` - Verifies the solo 50/30/20 scoring total and persisted keys
- `pkg/sqlite/rating_rebalance_solo_group_custom_test.go` - Executes the standalone migration against representative solo, group, and regular-scene rows, including rerun safety and group-only bonus removal
- `ui/v2.5/src/components/Performers/performerTypes_custom.ts` - Shared performer list/card data type for the lean list query

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

Adds marker-duration stats for configured sex, oral, solo, other, outstanding, standard, and unusable activity percentages. The activity strip has two rows: Sex/Oral/Solo/Other and Outstanding/Standard/Unusable. Sex/oral/solo activity is based on markers whose primary tag exactly matches the configured role tag, even when the marker also has secondary tags. Same-category overlaps are merged, cross-category overlaps count toward each category, and activity Other is runtime without a sex/oral/solo marker. Outstanding is any timed marker that is not a configured sex/oral/solo primary marker, or a configured sex/oral/solo primary marker with secondary tags. Standard is unmarked runtime or plain configured sex/oral/solo runtime not overlapped by Outstanding, and negative marker/Skip ranges are merged into Unusable without double-counting overlaps.

Studio cards and studio detail pages show the two-row activity strip using the total selected scene length as 100%, including unmarked scenes so Standard can represent untagged runtime. Performer-scoped studio cards use performer-filtered activity stats for the strip, with Unusable calculated from negative marker ranges in scenes containing that performer. Performer detail pages include a Stats tab with an activity pie chart and a selected-activity top/bottom role split chart. Scene and studio detail pages include Stats tabs with separate Activity Type and Quality donut charts. The Scene Stats tab also shows a By Performer breakdown with per-activity top/bottom pie charts; chart-local checkboxes can add sex/oral/solo/other/outstanding/standard segments to the multi-segment loop while leaving Unusable read-only. One-millisecond Standard intervals are treated as closed gaps and are not added to the loop. Scene and studio list pages include a combined Activity Percentage filter plus individual sex/oral/solo/other/unusable percentage sort options; performer list pages retain marker-owned activity percentage filters and sorts only.

### Files Modified

- `graphql/schema/types/performer_custom.graphql` - Adds `PerformerActivityStats`
- `graphql/schema/types/studio_custom.graphql` - Adds `StudioActivityStats`
- `graphql/schema/types/filters_custom.graphql` - Adds activity percentage filters
- `internal/api/activity_stats_custom.go` - Duration stats resolvers and interval merge helpers
- `pkg/sqlite/activity_percent_filter_custom.go` - SQL activity percentage filter/sort expressions
- `pkg/sqlite/scene.go`, `pkg/sqlite/performer.go`, `pkg/sqlite/studio.go` - Activity percentage sort options
- `ui/v2.5/graphql/data/performer.graphql` - Fetches performer activity stats
- `ui/v2.5/graphql/data/studio.graphql` - Fetches studio activity stats
- `ui/v2.5/graphql/queries/studio.graphql` - Fetches performer-filtered studio activity stats
- `ui/v2.5/graphql/data/scene-slim.graphql` - Fetches negative marker timing for scene-card Unusable percentages
- `ui/v2.5/src/models/list-filter/scenes.ts`, `performers.ts`, `studios.ts` - Activity Percentage filter and sort options
- `ui/v2.5/src/models/list-filter/criteria/activity-type_custom.ts`, `ui/v2.5/src/components/List/Filters/ActivityTypeFilter_custom.tsx` - Combined activity percentage filter UI
- `ui/v2.5/src/components/Performers/PerformerCard.tsx` - Sort-specific activity percentage display
- `ui/v2.5/src/components/Shared/styles.scss` - Shared activity pie chart styling
- `ui/v2.5/src/components/Studios/StudioCard.tsx` - Studio card activity strip
- `ui/v2.5/src/components/Studios/StudioActivityMetricsStrip.tsx` - Shared studio activity strip component
- `ui/v2.5/src/components/Studios/styles.scss` - Studio activity strip styling
- `ui/v2.5/src/components/Scenes/styles.scss` - Stats tab pie chart layout
- `ui/v2.5/src/components/Studios/StudioDetails/Studio.tsx` - Studio Stats tab
- `ui/v2.5/src/components/Performers/PerformerDetails/Performer.tsx` - Performer Stats tab
- `ui/v2.5/src/components/Scenes/SceneDetails/Scene.tsx` - Scene Stats tab
- `ui/v2.5/src/components/Scenes/SceneDetails/SceneStatsPanel.tsx` - Uses shared loop segment helpers for selectable activity loop segments

### Files Added

- `ui/v2.5/src/components/Performers/PerformerDetails/PerformerStatsPanel.tsx`
- `ui/v2.5/src/components/Scenes/SceneDetails/SceneStatsPanel.tsx`
- `ui/v2.5/src/components/Scenes/SceneDetails/sceneStatsLoopSegments_custom.ts`
- `ui/v2.5/src/components/Shared/ActivityPieChart_custom.tsx`
- `ui/v2.5/src/components/Studios/StudioDetails/StudioStatsPanel.tsx`
- `ui/v2.5/src/components/Studios/StudioActivityMetricsStrip.tsx`
- `ui/v2.5/tests/sceneStatsLoopSegments_custom.test.ts`

### Test Cases

- `internal/api/activity_stats_custom_test.go` - Verifies merged interval duration, interval subtraction for exclusive quality metrics, activity Other runtime, and legacy Other runtime excluding overlapping sex/oral/solo or Unusable ranges
- `ui/v2.5/tests/sceneStatsLoopSegments_custom.test.ts` - Verifies one-millisecond closed gaps are not emitted as multi-segment loop segments

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

Adds a hidden `/ostats` page for scene O analytics. The page is intentionally not linked from the main UI; it is accessible by typing the URL, from tag-card O counters when a tag has timestamped O events, and from either control in a performer-card O counter for a vato drilldown in a new tab. The root page shows O-date record cards and clickable bar charts by O date year/month/day, marker tag, associated vato ethnicity, vato country, scene studio, vato age at the scene's effective release date, and scene effective release year. The Year/Month/Day navigation is only shown for the O-date chart path; country, studio, performer age, and scene release year stay in count-sorted horizontal, scrollable graphs. Every chart has an O-event timeline drilldown and a discrete Unknown chip when applicable. Country codes are displayed as readable country names across OStats, VatoStats, and SceneStats while their original values remain intact for filtering. The date charts only use reliable O dates from March 8, 2024 onward, while the other charts include every recorded O. Timeline rows show associated marker tags for each timestamped O event. The Generate task can also create exact static screenshots for O events that have a `video_timestamp`, and the timelines use those O screenshots when available.

### Files Modified

- `graphql/schema/types/stats_custom.graphql` - Adds month/day bucket plus tag/ethnicity/country/studio/performer-age/release-year/Unknown timeline GraphQL types and queries, including associated marker tags on O events
- `graphql/schema/types/metadata_custom.graphql` - Extends Generate metadata input/default options with `oScreenshots`
- `internal/api/resolver_custom.go` - Adds O stats period resolvers, compact aggregate queries, O date record resolvers, timestamped marker-tag counts, per-event associated marker tags, and tag/ethnicity/country/studio/performer-age/release-year/vato drilldowns for `/ostats`. The reliable-date cutoff is limited to O-date stats; all other O aggregates and drilldowns include every O record.
- `internal/api/routes_scene.go` - Registers the O screenshot route
- `internal/manager/task_generate.go` - Queues O screenshot generation from the Generate task
- `pkg/models/generate.go` - Stores the O screenshot Generate default flag
- `ui/v2.5/graphql/data/config.graphql` - Includes the O screenshot Generate default flag
- `ui/v2.5/src/App.tsx` - Adds the hidden `/ostats/:year?/:month?/:day?`, `/ostats/tag/:tagId`, `/ostats/ethnicity/:ethnicity`, `/ostats/country/:country`, `/ostats/studio/:studioId`, `/ostats/age/:performerAge`, `/ostats/release-year/:releaseYear`, `/ostats/unknown/:unknownCategory`, and `/ostats/vato/:performerId` routes
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
- `ui/v2.5/src/utils/statsCountry_custom.ts` - Converts ISO country codes to readable country labels without changing filter values
- `ui/v2.5/src/utils/oStatsNavigation_custom.ts` - Builds encoded OStats studio drilldown URLs for shared card actions
- `ui/v2.5/tests/oStatsNavigation_custom.test.ts` - Covers studio OStats drilldown URL construction and encoding
- `ui/v2.5/tests/statsCountry_custom.test.ts` - Covers country-code labels and passthrough values
- `internal/api/resolver_custom_test.go` - Date validation tests for O stats helpers

### Test Cases Added

- `TestSceneOStatsDate` - Covers valid dates, leap day, invalid months, and invalid day/month combinations
- `TestValidateSceneOStatsDate` - Covers accepted `YYYY-MM-DD` dates and rejected malformed/impossible dates
- `TestSceneOStatsPerformerID` - Covers accepted positive vato IDs and rejected invalid vato IDs
- `TestSceneOStatsStudioID` - Covers accepted positive studio IDs and rejected invalid studio IDs
- `TestSceneOStatsCountryFilter` - Covers trimmed and blank country drilldown values
- `TestSceneOStatsPerformerAge` - Covers accepted and rejected performer-age drilldown values
- `TestSceneOStatsReleaseYear` - Covers accepted and rejected release-year drilldown values
- `TestSceneOEventAssociatedTagsFromCandidates` - Covers deduping associated marker tags and preferring orgasm marker tags when available
- `TestGetOScreenshotPath` - Covers generated O screenshot path layout by scene hash and O row id
- `statsCountry_custom.test.ts` - Covers readable US/MX/GB country labels, existing full country names, Unknown, and blank values
- `oStatsNavigation_custom.test.ts` - Covers numeric studio IDs and URL-encoded studio drilldown paths

### GraphQL Schema Changes

- `GenerateMetadataInput.oScreenshots`
- `GenerateMetadataOptions.oScreenshots`
- `SceneOMonthCount`
- `SceneODayCount`
- `SceneOEvent.associated_tags`
- `sceneOMonthCounts(year: Int!)`
- `sceneODayCounts(year: Int!, month: Int!)`
- `sceneOEventsByDate(date: String!)`
- `sceneOEventsByTag(tagID: ID!)`
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

Adds a hidden `/vatostats` page focused on vato aggregate analytics. The page shows linked vato summary cards, preserving their drilldown links and including solo-only and one-scene vatos, a top-three podium for a selectable metric ordered left-to-right as gold, silver, and bronze, the moved Tier vatos by ethnicity table, plus coordinated vertical bar charts for ethnicity, exact scene age, rating buckets, metallic rating, height buckets, country, hair color, eye color, circumcision status, and rounded exact penis size. Clicking a bar drills into that category/value and refreshes the podium plus every chart from the filtered vato set; Back and Clear controls unwind the drill-down. Unknown values are shown as separate chart-header counters so a large Unknown population does not compress the visible bars.

### Files Modified

- `graphql/schema/types/stats_custom.graphql` - Adds `VatoStatsPerformer`, `VatoStatsAgeCount`, and `vatoStatsPerformers`.
- `internal/api/resolver_custom.go` - Adds the `vatoStatsPerformers` resolver, including scene O counts from `scenes_o_dates`, most recent O date, career span, scene counts, demographic fields, exact scene-age counts, metallic rating tier, image URLs, optimized batched sex/oral role scene counts, and facial role marker counts using primary or secondary facial tags and descendants. The initial aggregate pre-groups O records per scene and computes career span in the main performer-scene pass to avoid row multiplication and a duplicate association scan.
- `internal/api/resolver_custom_test.go` - Adds focused tests for exact scene-age helper behavior, Unknown cleanup, and ID-filter safety.
- `internal/api/vato_stats_query_custom_test.go` - Verifies that the optimized aggregate query counts each scene and O event once, finds the latest O date, computes career span, and preserves zero-O vatos.
- `ui/v2.5/src/App.tsx` - Adds the hidden `/vatostats` route.

### Files Added

- `ui/v2.5/src/components/VatoStats/VatoStats.tsx` - VatoStats page, moved linked summary stat cards, metric selector, podium, filtered performer list, drill-down state, and charts. Auxiliary summary/filter counts are deferred until the core vato dataset arrives, and only configured role tags are fetched.
- `ui/v2.5/src/components/VatoStats/VatoStats.scss` - Page-specific podium and chart styles.

### Test Cases Added

- `TestVatoStatsAgeRange` - Covers exact scene-age labels.
- `TestVatoStatsSetAgeCount` - Covers merging repeated scene-age counts.
- `TestVatoStatsPerformersQueryCustomAggregatesSceneOsAndCareerOnce` - Covers the pre-aggregated scene-O and single-pass career-span query.

### GraphQL Schema Changes

- `VatoStatsAgeCount`
- `VatoStatsPerformer`
- `vatoStatsPerformers`

### Configuration Dependencies

- Uses existing `roleTagIds` configuration for optimized sex top/bottom marker role counts.

---

## 45. Scene Stats Page

### Overview

Adds `/scenestats` and retires `/customstats`. SceneStats owns the old scene metrics from CustomStats while adding scene podium metrics and scene distribution charts. Release year charts drill down to month and day; day bars link to the Scenes page filtered by effective release date.

### Files Added

- `ui/v2.5/src/components/SceneStats/SceneStats.tsx`
- `ui/v2.5/src/components/SceneStats/SceneStats.scss`
- `ui/v2.5/src/components/SceneStats/sceneStatsDuration_custom.ts`
- `ui/v2.5/src/components/SceneStats/sceneStatsFacialCounts_custom.ts`
- `ui/v2.5/tests/sceneStatsDuration_custom.test.ts`
- `ui/v2.5/tests/sceneStatsFacialCounts_custom.test.ts`

### Files Modified

- `ui/v2.5/src/App.tsx` - Adds `/scenestats/:year?/:month?` and removes `/customstats`.
- `ui/v2.5/src/components/Stats.tsx` - Replaces the Custom Stats card with Scene Stats.
- `ui/v2.5/src/pluginApi.tsx` - Exposes SceneStats instead of CustomStats.
- `ui/v2.5/src/components/VatoStats/VatoStats.tsx` - Receives the Tier vatos by ethnicity table.
- `graphql/schema/types/stats_custom.graphql` - Adds compact `SceneStatsResult` data types and the `sceneStats` query.
- `internal/api/resolver_custom.go` - Adds a set-based compact SceneStats resolver that fetches per-scene scalar, performer, scene-tag, and marker-tag data without resolving full GraphQL relationships for every scene.
- `ui/v2.5/src/components/SceneStats/SceneStats.tsx` - Uses the compact SceneStats dataset and no longer fetches every scene file, performer object, marker object, tag object, or O-history list.
- `ui/v2.5/src/components/SceneStats/sceneStatsFacialCounts_custom.ts` - Supports compact marker tag-ID groups.

### Features

- Podium metrics: O Count, Rating, Duration, File Size, Most Recent O, Vato Count, Facial Count.
- Charts: By Vato Ethnicity, By Vato Country, By Vato Count, By Release Year/Month/Day, Has Facial, By Number of Facial, By Number of Really Hot Facial, Scene Type, By Length/Duration, By Resolution.
- Duration chart bucketing: 0-4 minutes is grouped together, 5-45 minutes remains individual, and durations after 45 minutes are grouped in five-minute buckets such as 46-50 and 51-55.
- Preserves the existing scene category metric button icons, colors, and links from the retired CustomStats page.
- Performance: SceneStats now uses a small number of set-based SQL queries and a compact payload. It avoids the previous `findScenes(per_page: -1)` request with deeply nested relationship fields, and it returns only the most recent O date needed for the Most Recent O metric rather than every O-history date.

### Test Cases Added

- `sceneStatsFacialCounts_custom.test.ts` verifies facial and really-hot facial counting from compact marker tag-ID groups, the original marker shape, and Facial Count podium ordering.

### GraphQL Schema Changes

- `SceneStatsMarkerTagGroup`
- `SceneStatsScene`
- `SceneStatsResult`
- `sceneStats`

### Configuration Dependencies

- Uses existing `configuration.ui.roleTagIds` for sex, oral, solo, facial, orgasm, and really-hot facial marker categorization.

---

## 46. Scene Marker Gap Warning

### Overview

Adds a warning to the scene marker and negative marker create/edit forms when the current start/end times would leave a 3-second-or-less unmarked gap or marker overlap next to the nearest relevant marker range. The warning identifies the preceding/following marker type, displays the gap/overlap length in milliseconds, can close the previous issue by moving the marker start to one millisecond after the previous marker ends, close the next issue by moving the marker end to one millisecond before the next marker starts, or close both when both sides qualify. Scene marker warnings can also close the previous/next issue by adjusting the adjacent marker instead, including a "Fix both on other marker" batch action when both adjacent markers are known. One-millisecond gaps are treated as already closed.

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

### GraphQL Schema Changes

- None.

### Configuration Dependencies

- Uses existing `configuration.ui.roleTagIds.sexTagId`, `oralTagId`, and `soloTagId` to split activity markers from highlight markers for gap calculations.

---

## 47. Scene Marker Chronological Tab Layout

### Overview

Replaces the visible scene detail Markers tab body with a custom chronological marker list by default while keeping the upstream primary-tag grouped layout available behind the Custom Settings "Show official scene marker layout" toggle. The custom layout now uses one unified section instead of separate Activity Type and Highlights subtabs. Activity Type remains the main grouping pattern: markers are grouped under Oral, Sex, Solo, Feet, Orgasm, then Facial section headers, and markers that share the same primary activity tag plus top/bottom performer configuration are combined into one group. Facial-tagged orgasm markers are assigned to Facial instead of the standard Orgasm section, including when the facial match comes from a child tag. Compact high-contrast section headers show coverage and duration without taking additional vertical space. Each group displays top performers first and bottom performers second as dominant 2:3 image blocks; blue Top borders/names and green Bottom borders/names remain the only role treatment, without image-overlay role chips.

Activity ranges and Highlights are rendered as separate, always-visible lanes below each performer group. The Activity and Highlight headers use arrow/star icons without repeating those icons on individual markers. Activity pills use a filled green range treatment, while Highlight pills use an outlined gold-accent treatment with a compact, natural-width marker title and timestamp, so the distinction does not depend on color alone. Highlight pills are duplicated into every matching activity context when a highlight is contained by or contributes to multiple activity groups, and unmatched highlights remain visible in an "Other Highlights" fallback bucket. Hovering a highlight pill shows the existing performer/tag-card presentation without the old highlight title header. GOAT-tagged markers and highlight hover cards use Royal Sapphire styling. Markers that contain the current player timestamp use the red playback treatment in both lanes, and scene player scrubber clicks perform a one-shot focus into the Markers tab with a distinct blue focus ring for the target pill. Compact bordered Edit actions remain prominent on every marker. Marker create/edit top and bottom performer dropdowns render large performer thumbnails while choosing, then keep the selected values as regular text pills.

Selection checkboxes follow the visible hierarchy: section selectors cover all displayed Activity and Highlight markers, multi-configuration sections expose a selector for each performer configuration, lanes select only their own marker type, and pills select individual markers or merged highlight segments. Parent selectors show an indeterminate state for partial selection and use larger hit areas. Distinct performer configurations remain separate, but their redundant Top/Bottom text labels are omitted because performer borders already communicate those roles. Exact duplicate configuration headers are omitted when a section contains only one performer configuration, so duration and selection metadata are not repeated.

Scene-card performer-count hover popovers reuse the performer/tag-card presentation. Each scene performer displays the union produced by running every scene marker through the same overlap/containment context calculation as the in-scene marker hover: top-role tags use blue chips and bottom-role tags use green chips. A tag remains in both colors when the performer has both roles across different markers, and scene performers without marker assignments remain visible with no chips.

Marker-card performer-count hovers now use that exact in-scene containment popup instead of the generic scene-performer popup. The card grid batches a slim scene-marker context lookup by visible scene IDs, so the popup and context tags remain complete across pagination without issuing one request per card. Marker-card overlap chips use the same containing-activity context calculation and remain gray; Sapphire card styling preserves these semantic tag colors and the blue/green performer-role chips instead of repainting them Sapphire.

The unified section has scene-local selectable search fields for tags, top performers, and bottom performers. Tag search uses a progressive chain of single-tag selectors: the first selector only lists tags present on the current scene's markers, each next selector only lists tags that can still match by sharing the same marker or by contributing to one shared overlap window with the previous selections, and the row layout wraps at three tag selectors per line. Tag searches match primary or secondary marker tags and reuse the overlap-aware behavior from the custom marker filters: a marker can satisfy multiple requested tags directly or through overlapping markers only when every selected tag participates in the same shared overlap window, and when multiple overlapping markers match the same tag search only the narrowest result is shown. Derived overlap ranges are only shown for multi-tag searches, not for single-tag performer narrowing. Selected tags also narrow the top/bottom performer options to performers associated with the tag-filtered markers.

The Create Marker, Add to Loop, and Open in Viewer toolbar sticks to the top of the marker-tab scroll area. The scene-tabs shell keeps the tab content as the single desktop scroll parent so the sticky positioning remains effective. Activity Type headers also stick directly below the measured toolbar, preserving context through long runs of performer configurations; each header is bounded by its own Activity Type section, so it hands off cleanly to the next header instead of accumulating. Bulk action labels include the selected count, and the status row distinguishes visible selections from markers hidden by active filters. Separate one-click actions select the visible results, select the full scene result set, or clear any partial selection. Opening the Viewer preserves selection because it is non-mutating; adding to the loop clears selection to prevent accidental duplicate insertion.

Marker rows and `/scenes/markers` marker cards display direct primary tags, direct secondary tags, context-overlap tags, and hierarchy-inferred parent tags with distinct badge colors. Parent tags are collapsed behind a small `+N` toggle by default, and they are also included in scene-local tag search options, so a marker tagged with a child tag can be searched by its parent tag. Duplicate tags only render once at the highest available tier: primary, then secondary, then overlap, then parent.

Scene detail pages also include an icon toggle beside the scene tabs that hides the scene overview/header block, allowing the active tab panel to use the full vertical space of the left column. The scene player scrubber marker tags and timeline marker tooltips use the same performer/tag-card hover presentation as the Markers tab pills. Timeline tooltips use the same containment-derived performer tags as the Markers tab, including one performer tile with both role colors when the same performer has top and bottom tags across overlapping markers. This applies to outstanding/highlight and Activity Type markers: a smaller fully-contained activity marker inherits the containing activity marker's tags and roles, while the larger marker does not inherit tags from a marker that covers only part of its range. Fullscreen player controls hide on idle even while paused. Clicking a scene player scrubber marker performs a one-shot focus into the Markers tab, so later filter/edit changes do not keep auto-scrolling back to that marker.

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
- `ui/v2.5/src/components/Scenes/SceneDetails/sceneMarkerChronologySearch_custom.ts`
- `ui/v2.5/src/components/Scenes/SceneDetails/sceneMarkerHoverPopover_custom.tsx`
- `ui/v2.5/src/components/Shared/ratingCardStyles_custom.scss`
- `ui/v2.5/src/core/generated-graphql.ts`
- `ui/v2.5/src/components/Scenes/SceneDetails/Scene.tsx`
- `ui/v2.5/src/components/Settings/SettingsCustomPanel.tsx`
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
- `ui/v2.5/src/components/Scenes/SceneCardPerformerPopover_custom.tsx`
- `ui/v2.5/src/components/Scenes/SceneCard.tsx`
- `ui/v2.5/src/components/Scenes/SceneDetails/sceneMarkerLayoutPreference_custom.ts`
- `ui/v2.5/src/components/Scenes/SceneDetails/sceneMarkerSelection_custom.ts`
- `ui/v2.5/scene_markers_panel_poc_custom.html`
- `ui/v2.5/tests/sceneMarkerActivityType_custom.test.ts`
- `ui/v2.5/tests/sceneMarkerChronologyLayout_custom.test.ts`
- `ui/v2.5/tests/sceneMarkerChronologySearch_custom.test.ts`
- `ui/v2.5/tests/sceneMarkerLayoutPreference_custom.test.ts`
- `ui/v2.5/tests/sceneMarkerTimelineHover_custom.test.ts`
- `ui/v2.5/tests/sceneMarkerSelection_custom.test.ts`

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
- Verifies filtered-out activity pills stay hidden while matching highlight pills still keep their group visible.
- Verifies unmatched highlight pills remain visible in the Other Highlights fallback bucket.
- Verifies GOAT-tagged highlight markers are detected for Royal Sapphire styling.
- Verifies displayed marker tag badges distinguish primary, secondary, overlap, and parent tags while deduping to the highest tier.
- Verifies displayed overlap tags are only inferred between markers from the same scene.
- Verifies marker-card context tags include only the containing activity context, matching performer hovers rather than arbitrary partial overlaps.
- Verifies single-tag performer filters do not create derived overlap ranges from nearby tag-only markers.
- Verifies activity type markers are limited to configured sex/oral/solo primary-only markers and secondary tags make them highlights.
- Verifies scene-card performer summaries union direct and overlap-computed marker tags independently for top and bottom roles, including the same tag appearing in both role colors.
- Verifies the unified chronological section includes configured feet, orgasm, and facial primary tags as section markers without changing strict Activity Type marker classification.
- Verifies facial-tagged orgasm markers are assigned to Facial instead of standard Orgasm, including child facial tags.
- Verifies unified chronological section markers are grouped Oral, Sex, Solo, Feet, Orgasm, Facial and chronological within each group.
- Verifies activity type markers with the same activity and top/bottom performer configuration are grouped together.
- Verifies single-tag scene-local searches include markers that match only through an overlapping marker tag.
- Verifies the official grouped marker layout only shows when its UI setting is explicitly enabled.
- Verifies outstanding timeline marker hovers inherit overlapping performer tags, mixed top/bottom roles share one performer tile, dual-role Activity Type markers share one tile, contained Activity Type markers inherit their containing marker's role tags, and the containing marker does not inherit from the smaller range.
- Verifies parent selection scopes report none, partial/indeterminate, and all-selected states while deduplicating repeated layout marker IDs.
- Verifies selection counts distinguish visible items from markers hidden by active scene-local filters.

### GraphQL Schema Changes

- None.

### Configuration Dependencies

- Uses existing `configuration.ui.roleTagIds.sexTagId`, `oralTagId`, and `soloTagId` to identify Activity Type markers.
- Uses existing `configuration.ui.roleTagIds.feetTagId`, `orgasmTagId`, and `facialTagId` to add non-activity sections to the unified chronological marker section.
- Uses `configuration.ui.showOfficialSceneMarkerLayout` to switch the scene Markers tab between the custom chronological layout and the upstream grouped layout.

---

## 48. GEVI Latest Page

### Overview

Adds `/gevi-latest`, a custom page showing the latest scenes and vatos from Gay Erotic Video Index, linked from the right-side utility icon group in the main navbar. The backend API is mounted separately at `/gevi-latest-data` so direct browser loads and refreshes of `/gevi-latest` render the React page instead of raw JSON. The backend fetches `https://gayeroticvideoindex.com/newe` for scenes and `https://gayeroticvideoindex.com/newp` for vatos, stores the results in a JSON cache under the configured Stash cache directory, downloads each card image into a local image cache, and prunes cached items older than two years. Scene entries fetch the individual episode detail page to use the larger `episode<ID>b.jpg` screenshot when present. Vato entries use the performer image from the main GEVI new-performers page.

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
