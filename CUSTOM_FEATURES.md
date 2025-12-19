# Custom Features Documentation

This document describes all custom features and modifications added on top of the official Stash v0.30.0 release. Future AI agents handling merge conflicts should use this as a reference to understand what needs to be preserved.

---

## Table of Contents

1. [Performer Scene Tags System](#1-performer-scene-tags-system)
2. [Scene Tag Aliases Configuration](#2-scene-tag-aliases-configuration)
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

---

## 1. Performer Scene Tags System

### Overview
A new tagging system that allows tagging performers with tags *within the context of a specific scene*. This is different from global performer tags - performer_scene_tags are scene-specific.

### Database Schema
**File:** `performer_scene_tags.sql`
```sql
CREATE TABLE `performer_scene_tags` (
  `performer_id` integer NOT NULL,
  `scene_id` integer NOT NULL,
  `tag_id` integer NOT NULL,
  foreign key(`performer_id`) references `performers`(`id`) on delete CASCADE,
  foreign key(`scene_id`) references `scenes`(`id`) on delete CASCADE,
  foreign key(`tag_id`) references `tags`(`id`) on delete CASCADE
);
```

### GraphQL Schema Extensions
**File:** `graphql/schema/types/performer.graphql`
- Added `scene_tags(scene_id: ID!): [Tag!]!` resolver on `Performer` type

**File:** `graphql/schema/types/filters.graphql`
- Added `performer_scene_tags: HierarchicalMultiCriterionInput` to `PerformerFilterType`
- Added `PerformerSceneTagsWithAttrsCriterionInput` complex filter type
- Added `PerformerSceneTagGroupInput` for grouped filtering

### Backend Files
- `internal/api/resolver_model_performer.go` - SceneTags resolver
- `internal/api/resolver_mutation_performer.go` - Mutation to update performer scene tags
- `pkg/sqlite/performer.go` - Database operations for performer_scene_tags
- `pkg/sqlite/scene_filter.go` - Scene filtering by performer_scene_tags
- `pkg/sqlite/performer_filter.go` - Performer filtering by performer_scene_tags
- `pkg/models/performer.go` - Model definitions

### Frontend Files
- `ui/v2.5/src/components/Performers/PerformerDetails/performerSceneTagsPanel.tsx` - NEW: Panel showing performer's scene-scoped tags
- `ui/v2.5/src/models/list-filter/criteria/performer-scene-tags-with-attrs.ts` - NEW: Complex criterion class
- `ui/v2.5/src/components/List/Filters/PerformerSceneTagsWithAttrsFilter.tsx` - NEW: Filter UI component

---

## 2. Scene Tag Aliases Configuration

### Overview
Configurable aliases for role-based tags (top, bottom, oraltop, oralbottom, solo, facialgiven, facialreceived, selffacial). These are used throughout the app for role detection and scene categorization.

### Configuration Storage
Stored in UI config under `configuration.ui.sceneTagAliases`:
```typescript
{
  top: "top",           // Default tag name for "top" role
  bottom: "bottom",     // Default tag name for "bottom" role
  oraltop: "oraltop",   // Default tag name for "oral top" role
  oralbottom: "oralbottom", // Default tag name for "oral bottom" role
  solo: "solo",         // Default tag name for "solo" scenes
  facialgiven: "facialgiven",   // Tag for performers who gave facials
  facialreceived: "facialreceived", // Tag for performers who received facials
  selffacial: "selffacial"  // Tag for self-facial scenes
}
```

### Files Modified
- `ui/v2.5/src/components/Settings/SettingsInterfacePanel/SettingsInterfacePanel.tsx` - Configuration UI
- Multiple components read from `configuration.ui.sceneTagAliases` to detect roles

---

## 3. Scene Role Indicators

### Overview
Visual indicators on performer cards showing their role in a scene (Top/Bottom) based on their scene-scoped tags.

### Features
- **Top Badge**: Green pill badge with up-arrow icon
- **Bottom Badge**: Blue pill badge with down-arrow icon
- **Fallback Logic**: If no explicit top/bottom tags, uses oral tags as fallback (unless scene already has explicit top/bottom)

### Files Modified
- `ui/v2.5/src/components/Performers/PerformerCard.tsx`:
  - `maybeRenderTopBottomRoleBadges()` function in `PerformerCardOverlays`
  - `getSceneRoleFlags()` helper function
  - `sceneHasExplicitTopBottom` prop for fallback suppression

- `ui/v2.5/src/components/Scenes/SceneDetails/SceneDetailPanel.tsx`:
  - Computes `sceneHasExplicitTopBottom` flag for the scene
  - Passes flag to performer cards

---

## 4. Custom Statistics Dashboard

### Overview
A comprehensive statistics page showing scene categorization counts, performer ethnicity breakdowns, orgasm tracking, and more.

### File
**NEW:** `ui/v2.5/src/components/CustomStats.tsx`

### Features
- Scene counts by category (sex, oral, solo, facial)
- Performer ethnicity distribution with 5-star breakdown
- Orgasm events by year
- Top/Bottom performer counts (strict and lenient)
- Facial given/received counts

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

#### 6.1 Scene Marker Tags Filter
**Files:**
- `ui/v2.5/src/components/List/Filters/SceneMarkerTagsFilter.tsx` - NEW
- `ui/v2.5/src/models/list-filter/criteria/tags.ts` - `SceneMarkerTagsCriterion` class

Allows filtering scenes by their marker tags with grouped semantics:
- `EQUALS`: Groups of tags where each group requires all tags present in a single marker
- `INCLUDES`: Any scene with markers having any of the specified tags

#### 6.2 Performer Scene Tags with Attributes Filter
**Files:**
- `ui/v2.5/src/components/List/Filters/PerformerSceneTagsWithAttrsFilter.tsx` - NEW
- `ui/v2.5/src/models/list-filter/criteria/performer-scene-tags-with-attrs.ts` - NEW

Complex filter allowing:
- Filter by performer scene tags
- Optional: filter by performer country (ISO code)
- Optional: filter by performer ethnicity
- Optional: filter by performer rating
- Multiple groups with AND/OR logic

#### 6.3 Performer Country Filter (for Scenes)
**File:** `ui/v2.5/src/components/List/Filters/PerformerCountryFilter.tsx` - NEW

#### 6.4 Performer Ethnicity Filter (for Scenes)
**File:** `ui/v2.5/src/components/List/Filters/PerformerEthnicityFilter.tsx` - NEW

#### 6.5 Performer Rating Filter (for Scenes)
**File:** `ui/v2.5/src/components/List/Filters/PerformerRatingFilter.tsx` - NEW

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
- Scene count links filtered by performer_scene_tags when in performer context

---

## 11. New GraphQL Queries and Types

### Stats Queries
See Section 4 for full list.

### Filter Types
**File:** `graphql/schema/types/filters.graphql`

```graphql
input PerformerSceneTagGroupInput {
  tag_ids: [ID!]!
  performer_country: String
  performer_ethnicity: String
  performer_rating: IntCriterionInput
}

input PerformerSceneTagsWithAttrsCriterionInput {
  groups: [PerformerSceneTagGroupInput!]!
  match_any: Boolean
}

input SceneFilterType {
  ...
  performer_ethnicity: StringCriterionInput
  performer_country: StringCriterionInput
  performer_rating: IntCriterionInput
  performer_rating_all: Boolean
  scene_marker_tags: SceneMarkerTagsCriterionInput
  performer_scene_tags_with_attrs: PerformerSceneTagsWithAttrsCriterionInput
}
```

---

## 12. File Inventory

### New Files Added
```
.github/copilot-instructions.md          # AI agent instructions
performer_scene_tags.sql                  # Database schema

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
ui/v2.5/src/components/List/Filters/PerformerSceneTagsWithAttrsFilter.tsx
ui/v2.5/src/components/List/Filters/SceneMarkerTagsFilter.tsx
ui/v2.5/src/components/Performers/PerformerDetails/performerSceneTagsPanel.tsx
ui/v2.5/src/components/Studios/StudioDetails/StudioCategoryStrip.tsx

# Frontend - Assets
ui/v2.5/src/assets/gay.svg
ui/v2.5/src/assets/goatee.svg
ui/v2.5/src/assets/mouth.svg
ui/v2.5/src/assets/straight.svg

# Frontend - Filter Criteria
ui/v2.5/src/models/list-filter/criteria/ethnicity.ts
ui/v2.5/src/models/list-filter/criteria/performer-scene-tags-with-attrs.ts

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

### Usage
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

### Files Modified
- `ui/v2.5/src/components/Scenes/Scenes.tsx` - Added route for `/scenes/markers/player`
- `ui/v2.5/src/components/Scenes/SceneMarkerList.tsx` - Added "Play Selected" operation button
- `ui/v2.5/src/locales/en-GB.json` - Locale strings for `marker_playlist` section

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

### URL Parameters
- `/scenes/markers/player?ids=1,2,3` - Comma-separated list of marker IDs to play

---

*Last Updated: December 18, 2025*
*Base Version: Stash v0.30.0*
