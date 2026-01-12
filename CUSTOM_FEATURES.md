# Custom Features Documentation

This document describes all custom features and modifications added on top of the official Stash v0.30.0 release. Future AI agents handling merge conflicts should use this as a reference to understand what needs to be preserved.

---

## Table of Contents

1. [Scene Marker Performers (Top/Bottom Roles)](#1-scene-marker-performers-topbottom-roles)
2. [Role Tag IDs Configuration](#2-role-tag-ids-configuration)
3. [Scene Role Indicators (Top/Bottom/Oral/Solo/Facial)](#3-scene-role-indicators)
4. [Custom Statistics Dashboard](#4-custom-statistics-dashboard)
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
26. [(Any) Performer Count for Scene Marker Filters](#26-any-performer-count-for-scene-marker-filters)

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
- **Top/Bottom counts**: Displayed on performer cards showing breakdown by role
- **Category icons**: Gay icon (sex), Mouth icon (oral), Hand icon (solo), Goatee icon (facial)
- **Scene card overlays**: Icons indicating what types of markers a scene has

### Files Modified
- `ui/v2.5/src/components/Performers/PerformerCard.tsx`:
  - Role-based scene count popovers
  - Category strip with top/bottom breakdown

- `ui/v2.5/src/components/Performers/PerformerDetails/PerformerCategoryStrip.tsx`:
  - Marker-based category buttons with counts

- `ui/v2.5/src/components/Scenes/SceneCard.tsx`:
  - Scene card overlays showing marker categories

---

## 4. Custom Statistics Dashboard

### Overview
A comprehensive statistics page showing scene categorization counts, performer ethnicity breakdowns, orgasm tracking, and more.

### File
**NEW:** `ui/v2.5/src/components/CustomStats.tsx`

### Features
- Scene counts by category (sex, oral, solo, facial)
- Performer ethnicity distribution with 5-star breakdown
- Orgasm events by year (includes orgasm tag and all its subtags/descendants)
- Top/Bottom performer counts (strict and lenient)
- Facial given/received counts

### Orgasm & Facial Counting Logic
The `sceneOrgasmCount` and `sceneFacialCount` resolvers use the following logic:
- **Subtag Support**: Markers are counted if their primary tag OR any secondary tag is the target tag (e.g., "orgasm") or any of its descendants/subtags
- **Top-based Counting**: For each matching marker, the count is the number of "top" performers assigned to that marker
- **Minimum Count**: If a marker has no tops assigned, it counts as 1
- **Example**: A marker with 2 orgasm subtags but 1 top = counts as 1. A marker with 1 subtag but 3 tops = counts as 3.

### GraphQL Queries (Custom)
**File:** `graphql/schema/types/stats.graphql`
```graphql
extend type Query {
  performerEthnicityCounts: [PerformerEthnicityCount!]!
  performerEthnicityFiveStarCounts: [PerformerEthnicityCount!]!
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
- Shows current count vs initial (progress bar)
- Persisted in UI configuration

---

## 6. Advanced Scene Filtering

### Overview
Multiple new filter criteria for scenes.

### New Filter Criteria

#### 6.1 Scene Marker Tags Filter (Enhanced)
**Files:**
- `ui/v2.5/src/components/List/Filters/SceneMarkerTagsFilter.tsx` - NEW
- `ui/v2.5/src/models/list-filter/criteria/tags.ts` - `SceneMarkerTagsCriterion` class
- `graphql/schema/types/filters.graphql` - `SceneMarkerTagGroupInput` type
- `pkg/models/filter.go` - `SceneMarkerTagGroupInput` struct
- `pkg/sqlite/criterion_handlers.go` - `joinedSceneMarkerTagsHandler` function

Allows filtering scenes by their marker tags with **role-specific performer attributes**:
- `EQUALS`: Groups of tags where each group requires all tags present in a single marker
- `INCLUDES`: Any scene with markers having any of the specified tags

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

> **Note:** The `performer_scene_tags` feature has been fully removed. Use Scene Marker Tags Filter instead.

#### 6.2 Performer Country Filter (for Scenes)
**File:** `ui/v2.5/src/components/List/Filters/PerformerCountryFilter.tsx` - NEW

#### 6.4 Performer Ethnicity Filter (for Scenes)
**File:** `ui/v2.5/src/components/List/Filters/PerformerEthnicityFilter.tsx` - NEW

#### 6.5 Performer Rating Filter (for Scenes)
**File:** `ui/v2.5/src/components/List/Filters/PerformerRatingFilter.tsx` - NEW

#### 6.6 Custom Filters
**Overview:** Radio-button based filters with predefined complex filter options for both scenes and performers.

**Purpose:** Provide quick access to commonly-used complex filtering scenarios without requiring multiple filter configurations.

**Files:**
- `graphql/schema/types/filters.graphql` - Added `custom_filters: String` to both `SceneFilterType` and `PerformerFilterType`
- `pkg/models/scene.go` - Added `CustomFilters` field to `SceneFilterType` struct
- `pkg/models/performer.go` - Added `CustomFilters` field to `PerformerFilterType` struct
- `pkg/sqlite/scene_filter.go` - `customFiltersCriterionHandler` for scenes
- `pkg/sqlite/performer_filter.go` - `customFiltersCriterionHandler` for performers
- `ui/v2.5/src/models/list-filter/types.ts` - Added `"custom_filters"` to `CriterionType`
- `ui/v2.5/src/models/list-filter/criteria/custom-filters.ts` - NEW: Criterion classes for custom filters
- `ui/v2.5/src/models/list-filter/scenes.ts` - Added `SceneCustomFiltersCriterionOption`
- `ui/v2.5/src/models/list-filter/performers.ts` - Added `PerformerCustomFiltersCriterionOption`
- `ui/v2.5/src/components/List/Filters/OptionFilter.tsx` - Enhanced with translated labels for custom_filters
- `ui/v2.5/src/locales/en-GB.json` - Base translation strings for all filter options
- `ui/v2.5/src/locales/en-US.json` - US English override translations

**Scene Custom Filters:**
- **Multiple Orgasms:** Scenes where any performer has 2+ orgasm markers as "top" (same as legacy filter)
- **Versatile Scenes:** Scenes where ALL performers have at least one sexTagId marker as "top" AND at least one as "bottom"

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
- **Facial Scenes** (goatee icon): Scenes with facial tags
- **Unique Performers** (user-plus icon): Count of distinct performers

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

### Custom Assets Added
- `ui/v2.5/src/assets/gay.svg` - Gay/sex scene icon
- `ui/v2.5/src/assets/mouth.svg` - Oral scene icon
- `ui/v2.5/src/assets/goatee.svg` - Facial scene icon
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
ui/v2.5/src/components/CustomStats.tsx
ui/v2.5/src/components/TaskProgress.tsx
ui/v2.5/src/components/List/Filters/PerformerCountryFilter.tsx
ui/v2.5/src/components/List/Filters/PerformerEthnicityFilter.tsx
ui/v2.5/src/components/List/Filters/PerformerRatingFilter.tsx
ui/v2.5/src/components/List/Filters/SceneMarkerTagsFilter.tsx
ui/v2.5/src/components/Studios/StudioDetails/StudioCategoryStrip.tsx

# Frontend - Assets
ui/v2.5/src/assets/gay.svg
ui/v2.5/src/assets/goatee.svg
ui/v2.5/src/assets/mouth.svg
ui/v2.5/src/assets/straight.svg

# Frontend - Filter Criteria
ui/v2.5/src/models/list-filter/criteria/ethnicity.ts

# Frontend - GraphQL Queries
ui/v2.5/src/core/queries/performerEthnicities.graphql
ui/v2.5/src/core/queries/performerEthnicityCounts.graphql
ui/v2.5/src/core/queries/performerEthnicityFiveStarCounts.graphql
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
   - Custom SVG imports (gay.svg, mouth.svg, goatee.svg, straight.svg)
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

### Files Created
- `ui/v2.5/src/components/ScenePlayer/multi-segment-loop.ts` - VideoJS plugin for multi-segment looping
- `ui/v2.5/src/components/ScenePlayer/MultiSegmentLoopControls.tsx` - React component for segment management UI
- `ui/v2.5/src/@types/videojs-multi-segment-loop.d.ts` - TypeScript type declarations

### Files Modified
- `ui/v2.5/src/components/ScenePlayer/ScenePlayer.tsx` - Integration of plugin and controls
- `ui/v2.5/src/components/ScenePlayer/styles.scss` - Styles for controls and timeline markers
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
- Persistent pending marker when setting start point
- Segment list with jump-to-segment functionality
- Total duration calculation for all segments

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

The queue persists across page navigations using localStorage.

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
- `ui/v2.5/src/components/Scenes/SceneDetails/SceneMarkerForm.tsx` - Two separate performer dropdowns with arrow icons: Top (↑ blue) and Bottom (↓ red)
- `ui/v2.5/src/components/Scenes/SceneDetails/PrimaryTags.tsx` - Displays top/bottom performers with color-coded badges and icons
- `ui/v2.5/src/components/Scenes/MarkerPlaylistPlayer.tsx` - Shows top/bottom performers with icons in the playlist player
- `ui/v2.5/src/models/list-filter/criteria/tags.ts` - Extended `SceneMarkerTagsCriterion` with `extendedGroups` supporting performer attributes
- `ui/v2.5/src/components/List/Filters/SceneMarkerTagsFilter.tsx` - Enhanced filter UI with performer, country, ethnicity, and rating selection per group
- `ui/v2.5/src/models/list-filter/scene-markers.ts` - Added marker performer filter criterion options
- `ui/v2.5/src/components/Performers/PerformerDetails/PerformerMarkersPanel.tsx` - NEW: Performer details panel reusing the Markers list, filtered by markers directly assigned to the performer
- `ui/v2.5/src/components/Performers/PerformerDetails/Performer.tsx` - Added a "Markers" tab to performer details and marker count query
- `ui/v2.5/src/locales/en-GB.json` - Added translations for top_performers, bottom_performers

### Features
- **Top/Bottom Distinction**: Each marker performer can be tagged as either top (giving) or bottom (receiving)
- Select one or more performers from the scene's performers when creating/editing a marker
- UI shows arrow-up (↑ blue) icon for tops and arrow-down (↓ red) icon for bottoms
- Performers are displayed with role indicators in:
  - Scene marker form (editing)
  - PrimaryTags panel (scene details Markers tab)
  - MarkerPlaylistPlayer (playing markers)
- **Scene Marker Tags Filter (on Scenes)**: Now supports separate role-specific attribute blocks for top, bottom, and both-roles (performer appearing in BOTH roles). Each block can specify performer IDs, ethnicities, countries, and rating. This supersedes the retired `performer_scene_tags` filter.
- **Marker Performer Filters (on Markers page)**: New filters to find markers by their assigned performers (both roles):
  - Marker Performers - Filter by specific performers assigned to markers
  - Marker Performer Country - Filter by country of marker performers
  - Marker Performer Ethnicity - Filter by ethnicity of marker performers
  - Marker Performer Rating - Filter by rating of marker performers
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
Adds two new statistics to the Custom Stats page: estimated liters (from orgasms) and total penis meters (sum of performer penis lengths).

### GraphQL Schema Extensions
**File:** `graphql/schema/types/stats.graphql`
```graphql
extend type Query {
  estimatedLiters: Float!
  totalPenisMeters: Float!
}
```

### Backend Implementation
**File:** `internal/api/resolver.go`
- `EstimatedLiters` resolver: Uses `SceneOrgasmCount` (which counts tops on orgasm markers, including subtags) and multiplies by 3ml (0.003L)
- `TotalPenisMeters` resolver: Sums performer penis lengths (defaulting to 17cm when null), converts to meters

### Frontend Files
- `ui/v2.5/src/components/CustomStats.tsx` - Added display for estimated liters and total penis meters with formatted output

### Features
- **Estimated Liters**: Calculates total orgasms (based on tops per orgasm marker, including subtags) × 3ml converted to liters, displayed with 2 decimal places
- **Total Penis Meters**: Sums all performer penis lengths (uses 17cm default), displays in meters with 🍆 emoji

---

## 17. Performer Studios Tab

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
Adds a Performers list filter criterion for the count of *profile images* (the default performer image plus any additional performer images).

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
- `ui/v2.5/src/components/Performers/PerformerDetails/PerformerCategoryStrip.tsx` - Added partner count badges section:
  - Only shown when NOT in scene context (when sceneId is not provided)
  - Uses person icon (faUser) combined with arrow icons to indicate top/bottom
  - Smaller font size and styling to distinguish from scene count badges
  - Category icons (gay/mouth/goatee) shown with reduced opacity (0.7)
  - Green badges for "topped" counts, blue badges for "bottomed for" counts

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

input ConvertSceneToReleaseInput {
  source_scene_id: ID!
  target_scene_id: ID!
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
- `pkg/models/model_scene_release.go` - SceneRelease model definition
- `pkg/sqlite/scene_release.go` - SQLite repository for scene releases
- `internal/api/resolver_model_scene_release.go` - GraphQL resolvers for SceneRelease type
- `internal/api/resolver_mutation_scene_release.go` - Mutation resolvers (create, update, destroy, convert)

### Frontend Files
- `ui/v2.5/src/components/Scenes/SceneDetails/SceneReleasesPanel.tsx` - Main UI panel for managing releases
- `ui/v2.5/src/components/Scenes/SceneDetails/SceneSelectorDialog.tsx` - Dialog for selecting a scene to convert to release
- `ui/v2.5/graphql/data/scene-release.graphql` - GraphQL fragment for SceneRelease data
- `ui/v2.5/graphql/mutations/scene-release.graphql` - GraphQL mutations
- `ui/v2.5/src/core/StashService.ts` - React hooks for mutations

### Features
1. **Create Release**: Add a new release with custom metadata to any scene
2. **Edit Release**: Modify release metadata, cover image, files, and galleries
3. **Delete Release**: Remove a release from a scene
4. **Convert Scene to Release**: Take an existing scene and convert it into a release of another scene, preserving all metadata
5. **Playback Selection**: Mark a release for playback to switch the scene player to that release's files
6. **Color-coded Metadata Comparison**: Release metadata (duration, fps, resolution) is color-coded compared to the main scene (green=better, red=worse, white=same)
7. **Clickable Gallery Links**: Gallery associations link directly to the gallery page

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

## 26. (Any) Performer Count for Scene Marker Filters

### Overview
Allows filtering scene markers by a minimum count of "any" top or bottom performers, rather than requiring specific performers. For example: "Show markers with at least 3 tops" without specifying which performers.

### Use Cases
- Find markers with gangbang scenarios (e.g., 3+ tops)
- Find MMF or FFM markers by performer count
- Filter by performer density without knowing specific performers

### GraphQL Schema Changes
**File:** `graphql/schema/types/filters.graphql`
```graphql
input SceneMarkerTagGroupInput {
  ...
  top_any_count: Int        # Minimum number of any top performers
  bottom_any_count: Int     # Minimum number of any bottom performers
}
```

### Backend Changes
**File:** `pkg/models/filter.go`
- Added `TopAnyCount *int` and `BottomAnyCount *int` to `SceneMarkerTagGroupInput` struct

**File:** `pkg/sqlite/criterion_handlers.go`
- Updated `joinedSceneMarkerTagsHandler` to generate SQL for counting performers by role
- SQL pattern: `(SELECT COUNT(DISTINCT performer_id) FROM scene_marker_performers WHERE scene_marker_id = sm.id AND role = 'top/bottom') >= N`

### Frontend Criterion Changes
**File:** `ui/v2.5/src/models/list-filter/criteria/scene-markers.ts`
- Added `top_any_count` and `bottom_any_count` to `ISceneMarkersGroup` interface

**File:** `ui/v2.5/src/models/list-filter/criteria/scene-markers-exclude.ts`
- Added `top_any_count` and `bottom_any_count` to `ISceneMarkersExcludeGroup` interface

**File:** `ui/v2.5/src/models/list-filter/criteria/marker-top.ts`
- Added `any_count` to `IMarkerTopFilter` interface

**File:** `ui/v2.5/src/models/list-filter/criteria/marker-bottom.ts`
- Added `any_count` to `IMarkerBottomFilter` interface

**File:** `ui/v2.5/src/models/list-filter/filter.ts`
- Updated `MarkerTopData` and `GroupExtended` types to include any_count fields
- Updated aggregation logic to map any_count to GraphQL input

### Frontend UI Changes
**File:** `ui/v2.5/src/components/List/Filters/SceneMarkersFilter.tsx`
- Added "(Any) Performer Count" number input for top and bottom columns
- Disabled when specific performers are selected

**File:** `ui/v2.5/src/components/List/Filters/SceneMarkersExcludeFilter.tsx`
- Same changes as SceneMarkersFilter.tsx

**File:** `ui/v2.5/src/components/List/Filters/MarkerTopFilter.tsx`
- Added "(Any) Performer Count" number input

**File:** `ui/v2.5/src/components/List/Filters/MarkerBottomFilter.tsx`
- Same changes as MarkerTopFilter.tsx

### i18n Strings
**File:** `ui/v2.5/src/locales/en-US.json`
- `any_performer_count`: "(Any) Performer Count"
- `any_performer_count_placeholder`: "e.g. 2 means at least 2"
- `any_performer_count_help`: "Minimum number of (any) top performers on this marker"
- `bottom_any_performer_count_help`: "Minimum number of (any) bottom performers on this marker"

### Behavior
- The (Any) count field is disabled when specific performers are selected
- Count of 0 means no minimum (field is ignored)
- Counts are additive with other filter criteria (AND logic)
- Works in both include and exclude marker filter modes

---

*Last Updated: January 2026*
*Base Version: Stash v0.30.0*