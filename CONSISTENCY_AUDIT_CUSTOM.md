# App consistency audit

Audit date: October 21, 2026. Source snapshot: the current working tree, including existing uncommitted work.

## Result

24 findings: **2 high**, **16 medium**, **6 low**. The highest priorities are conflicting activity percentages and inconsistent handling of failed deletions. The main sources of visible drift are copied metric definitions, hardcoded labels, and separate color palettes for the same concepts.

The findings below record the original audit snapshot. Implementation follow-up: items **01–08 and 10–23** were selected and addressed; **09 and 24** remain outside the requested scope. The selected rules and canonical colors are documented in [UI_PALETTE_CUSTOM.md](docs/UI_PALETTE_CUSTOM.md), with implementation and regression coverage folded into [CUSTOM_FEATURES.md](CUSTOM_FEATURES.md). Historical line references below describe the original findings and may have moved.

| Priority | Meaning                                                                       | Findings         |
| -------- | ----------------------------------------------------------------------------- | ---------------- |
| High     | Conflicting numeric results or action outcomes                                | 01–02            |
| Medium   | Visible differences in meaning, language, colors, or interaction              | 03–14, 16–18, 24 |
| Low      | Redundant definitions or presentation differences with lower immediate impact | 15, 19–23        |

## Follow-up implementation

| Items     | Result                                                                                                                                                                                   |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01, 20    | Shared interval calculations and union activity time; overlapping types use independent bars.                                                                                            |
| 02, 17    | Failed deletion retains selection/dialog for retry; themed confirmations share idle/busy dismissal rules and support fullscreen.                                                         |
| 03        | Exclusive Regular / Really Hot / GOAT counts in scene and studio quality sorts, with GOAT taking priority.                                                                               |
| 04–05     | Zero counts stay known; demographic placeholders share normalization and Unknown filtering. Valid titles named Unknown remain intact.                                                    |
| 06–08     | Vato/Movies vocabulary, No Tier, and Mamando Rifle align across the affected screens.                                                                                                    |
| 10–11     | App-locale date/number display and the shared localized country catalog.                                                                                                                 |
| 12–16, 23 | Documented semantic palettes, dedicated role variants, neutral/gold/sapphire event quality, static glows, shared metallic legends and goal colors, and theme-aware stats surfaces/radii. |
| 18–19     | Every ranking view is URL-backed; shared chart headings retain explicit zero totals.                                                                                                     |
| 21–22     | Shared metallic tier classification/SQL rules and one percentage filter editor.                                                                                                          |

Items 09 and 24 were not selected. Existing API names, saved configuration, and legacy URL keys remain compatible. The original audit below is retained for context.

### Follow-up verification

- Passed `npm.cmd run test:custom`: 171 custom TypeScript test files, including 234 Node test cases.
- Passed UI type checking, targeted ESLint/Stylelint, formatting, and `git diff --check`.
- Passed the development-mode UI bundle check, including legacy output, and `go build ./cmd/stash` (output kept under ignored `.local`).
- Passed focused SQLite/API regressions for quality precedence, shared metallic fixtures/filters, missing-value SQL, and activity/event statistics.
- Passed the isolated Edge fixture `tests/consistency_custom.browser.mjs`: both themes, semantic badge/chart/player-overlay colors, static glows, explicit zero totals, Cancel/Escape, busy dismissal protection, read-only Close, fullscreen confirmations, and ranking refresh/back.
- Palette regression checks each documented token/color pair and at least 4.5:1 contrast for segment text. No development servers, live database walkthrough, migration, or deployment was needed.

## Original audit scope and limits

Indexed 906 TypeScript/TSX files and 78 SCSS files under the UI source directory, excluding generated GraphQL bindings. Traced representative catalog, detail, player, statistics, settings, tagging, and task-progress flows; inspected English locale catalogs and the Go queries behind the disputed metrics. This does not mean every file received a line-by-line review.

The stylesheet census found 954 hex literals across 53 files, with 373 distinct hex spellings. These include intentional gradients, white/black aliases, and theme variants; they are a maintenance indicator, not 373 defects.

Findings below distinguish source-confirmed differences from consolidation opportunities. No browser walkthrough, screenshot comparison, accessibility certification, production access, database mutation, or full application build was performed. Responsive layout, computed CSS overrides beyond the narrow badge check, and plugin-injected UI need a separate visual pass. No development servers were started.

## Findings

### 01 · High · Activity percentages change their denominator

**Where:** Scenes > Scene Detail > Insights; Studios > Studio Detail; Scene Stats > Activity & Ratings and summary cards.

Activity types can overlap. Detail screens calculate each type against the union of classified activity time. Scene Stats instead uses a split bar whose default total is the sum of all category durations; its summary cards also divide by that sum. With 60 seconds of simultaneous sex and oral activity, the detail calculation produces **100% sex and 100% oral**, while the dashboard calculation produces **50% and 50%** and a 120-second combined total.

**Recommendation:** define “activity time” as the union everywhere. Use independent bars for overlapping categories and expose that denominator explicitly. Keep a 100% split only for genuinely exclusive categories such as quality time. If a sum of category durations is useful, give it a different name.

Evidence: [overlap-aware percentages](C:/Code/stash/ui/v2.5/src/components/Shared/activityTypePercentages_custom.ts:52), [dashboard split](C:/Code/stash/ui/v2.5/src/components/SceneStats/SceneStatsInsights_custom.tsx:67), [split denominator](C:/Code/stash/ui/v2.5/src/components/StatsCharts_custom.tsx:225), [summary denominator](C:/Code/stash/ui/v2.5/src/components/SceneStats/SceneStats.tsx:1327), [server denominator](C:/Code/stash/internal/api/activity_stats_custom.go:567). Confirmed with source-level calculations; no live scene was modified.

### 02 · High · Failed deletions clear selection on some lists

**Where:** Vatos, Studios, Tags, Images, and Galleries > select items > Delete, compared with Scenes and Markers.

The shared entity dialog and the image/gallery dialogs call the completion callback with `true` after catching an error. The list then clears selection and refreshes as though deletion succeeded. Scene and marker dialogs pass `false` on failure. An error toast appears in both cases, but recovery behavior differs.

**Recommendation:** share the mutation outcome handling: report success only after success, retain selection on failure, and apply one policy for whether the dialog stays open. Preserve file-deletion options in the specialized dialogs.

Evidence: [entity delete](C:/Code/stash/ui/v2.5/src/components/Shared/DeleteEntityDialog.tsx:58), [image delete](C:/Code/stash/ui/v2.5/src/components/Images/DeleteImagesDialog.tsx:59), [gallery delete](C:/Code/stash/ui/v2.5/src/components/Galleries/DeleteGalleriesDialog.tsx:59), [scene delete](C:/Code/stash/ui/v2.5/src/components/Scenes/DeleteScenesDialog.tsx:65), [selection clearing](C:/Code/stash/ui/v2.5/src/components/List/util.ts:586). Confirmed by tracing error branches and their caller.

### 03 · Medium · Facial quality has two classification systems

**Where:** Studios > sort by Facial Count (Standard/Really Hot), compared with Facial Stats > Quality.

Studio “Standard” means facial markers without the Really Hot tag. It does not exclude GOAT. Facial Stats uses exclusive Regular / Really Hot / GOAT buckets, with GOAT taking priority. A GOAT facial without Really Hot therefore counts as Standard in one view and GOAT in the other; a marker carrying both qualifiers counts as Really Hot in the studio metric and GOAT in Facial Stats.

**Recommendation:** use the same three quality buckets throughout, or rename the studio pair to explicitly inclusive categories. Simply replacing “Standard” with “Regular” would conceal the counting difference.

Evidence: [studio split](C:/Code/stash/pkg/sqlite/studio_facial_marker_sort_custom.go:15), [event quality precedence](C:/Code/stash/internal/api/marker_event_stats_custom.go:294), [studio labels](C:/Code/stash/ui/v2.5/src/locales/en-GB.json:1656).

### 04 · Medium · “Unknown” includes known zero counts

**Where:** Scene Stats > O Count / Vato Count, compared with Vato Stats metric charts.

Scene Stats places zero O records and zero vatos in “Unknown.” Vato Stats drops zero values from several metric charts and retains an explicit zero bar for Total Scenes. The same absence can therefore appear as Unknown, disappear, or become 0 depending on the chart. For personal O records, “no records” and “date/value unknown” have different meanings.

**Recommendation:** distinguish **0 / No records**, **Not assessed**, and **Unknown** where the data supports that distinction. Specify each chart's population and zero policy. Do not infer that a scene has been assessed merely because a count is zero.

Evidence: [unknown rules](C:/Code/stash/ui/v2.5/src/components/SceneStats/sceneStatsUnknownFilters_custom.ts:39), [positive-only buckets](C:/Code/stash/ui/v2.5/src/components/SceneStats/sceneStatsChartBuckets_custom.ts:3), [Vato zero policy](C:/Code/stash/ui/v2.5/src/components/VatoStats/VatoStats.tsx:682), [existing zero expectations](C:/Code/stash/ui/v2.5/tests/sceneStatsUnknownFilters_custom.test.ts:31). This behavior is explicitly tested today; changing it is a product-semantic change.

### 05 · Medium · Missing demographic values are normalized differently

**Where:** Scene Stats, Vato Stats, Nut Stats, Facial Stats, and O Stats > country/ethnicity charts.

Scene Stats treats empty text and `<nil>` as missing but keeps the literal string `null` as a real category. Vato Stats and marker-event statistics also reject `null`. O Stats identifies its demographic unknown buckets using the display text “Unknown.” These independent rules can show a spurious category or change which records enter the Unknown filter.

**Recommendation:** normalize missing values once and carry a stable missing-value key separately from the displayed label. Keep scene-level and vato-level population differences explicit.

Evidence: [Scene normalization](C:/Code/stash/ui/v2.5/src/components/SceneStats/SceneStats.tsx:269), [Vato normalization](C:/Code/stash/ui/v2.5/src/components/VatoStats/VatoStats.tsx:539), [event normalization](C:/Code/stash/ui/v2.5/src/components/MarkerEventStats/markerEventStatsData_custom.ts:274), [O unknown label](C:/Code/stash/ui/v2.5/src/components/OStats/OStats.tsx:430). An isolated execution of the source functions confirmed the `null` disagreement.

### 06 · Medium · Entity names bypass the app's vocabulary

**Where:** filters, scraping/tagging, Scene Detail > Releases / Insights, O Stats, studio rating summaries, and Task Progress.

The established English labels are Vatos and Movies. Remaining copy includes “Performer Rating Criteria,” “By Performer Age,” “Top performers,” “Performer Explorer,” and “Update Performer.” Task Progress separately defines “Performers” and “Groups,” so links to the same entities use different names there. Technical identifiers such as `/performers` and GraphQL `group` are compatible implementation names, not UI-copy defects.

**Recommendation:** use the existing entity message IDs everywhere, including tooltips, errors, placeholders, and task item labels. No API or database rename is needed.

Evidence: [documented Vato standard](C:/Code/stash/CUSTOM_FEATURES.md:599), [navigation vocabulary](C:/Code/stash/ui/v2.5/src/components/MainNavbar.tsx:63), [remaining locale labels](C:/Code/stash/ui/v2.5/src/locales/en-GB.json:1609), [O Stats title](C:/Code/stash/ui/v2.5/src/components/OStats/OStats.tsx:1218), [release labels](C:/Code/stash/ui/v2.5/src/components/Scenes/SceneDetails/SceneReleaseMarkers_custom.tsx:392), [task item labels](C:/Code/stash/ui/v2.5/src/components/TaskProgress/progressView_custom.ts:20), [tagger action](C:/Code/stash/ui/v2.5/src/components/Tagger/performers/StashSearchResult.tsx:109).

### 07 · Medium · The same metallic bucket is “None” or “No Tier”

**Where:** Scene/O statistics, Playground > Scene/Vato Tiers, and list filters > Metallic Rating.

The `none` bucket is “None” in statistics and “No Tier” in Playground and filters. It means a rated item below Bronze, not an unrated item. “None” makes that distinction harder to see.

**Recommendation:** use **No Tier** consistently and reserve **Unrated** for a missing numeric rating without a qualifying override. Keep a short explanation in the filter tooltip.

Evidence: [statistics label](C:/Code/stash/ui/v2.5/src/utils/metallicRatingChart_custom.ts:18), [Playground label](C:/Code/stash/ui/v2.5/src/components/Playground/ratingTiersData_custom.ts:8), [filter label](C:/Code/stash/ui/v2.5/src/models/list-filter/criteria/metallic-rating_custom.ts:59). Confirmed by executing the actual bucket helpers.

### 08 · Medium · Oral activity has competing names

**Where:** Scene Stats summary versus Scene Detail > Insights and studio activity charts.

The oral-duration metric is “Sucking Pito Time” in Scene Stats and “Eating pito” in the shared activity presentation. Sex/Oral/Solo also serve as scene-type labels. The scene-type/category distinction can be useful, but two different phrases for the same duration metric add unnecessary vocabulary.

**Recommendation:** reuse one activity label map; append “Time” only where context requires it. Retain explicit role wording such as Sucking / Getting sucked when the metric actually distinguishes roles.

Evidence: [summary wording](C:/Code/stash/ui/v2.5/src/components/SceneStats/SceneStats.tsx:1324), [activity labels](C:/Code/stash/ui/v2.5/src/components/Scenes/sceneActivityMetricsData_custom.ts:37), [copied aggregate labels](C:/Code/stash/ui/v2.5/src/components/Shared/ActivityStatsCharts_custom.tsx:29), [scene-type labels](C:/Code/stash/ui/v2.5/src/components/Studios/studioSceneTypes_custom.ts:1).

### 09 · Medium · UI copy uses three translation approaches

**Where:** app-wide, especially custom statistics and Task Progress.

Most upstream UI uses stable locale message IDs. Statistics frequently embeds English directly. Task Progress generates IDs from English phrases under `task_progress_v2` and falls back to those phrases; neither English locale contains that namespace. Copy edits therefore change the generated ID, and entity labels bypass existing translations. This also explains part of finding 06.

**Recommendation:** extend the existing locale catalogs with stable IDs. Reuse existing action/entity terms first. Keep display labels out of lookup keys and business-rule comparisons.

Evidence: [application locale loading](C:/Code/stash/ui/v2.5/src/App.tsx:192), [generated phrase IDs](C:/Code/stash/ui/v2.5/src/components/TaskProgress/progressView_custom.ts:94), [hardcoded stats navigation](C:/Code/stash/ui/v2.5/src/components/StatsLinks_custom.tsx:27), [hardcoded date controls](C:/Code/stash/ui/v2.5/src/components/StatsDateRangeFilter_custom.tsx:38).

### 10 · Medium · Dates and numbers follow different locale settings

**Where:** catalog/detail dates, Task Progress, statistics rankings, and O timelines.

Shared date displays honor the app's locale. Task Progress hardcodes DD/MM/YYYY. Statistics and O timelines often use browser-default `toLocaleString()` / `toLocaleDateString()`; task percentages also use `toFixed()` with a literal decimal point. Selecting an app language different from the browser can mix date order, month language, and decimal separators on one screen.

**Recommendation:** use the app's locale for display formatting. Keep separate handling for calendar dates and timestamp instants so standardization does not shift dates across time zones. Allow documented precision differences between compact cards and detailed reports.

Evidence: [shared dates](C:/Code/stash/ui/v2.5/src/components/Shared/Date.tsx:6), [fixed task date](C:/Code/stash/ui/v2.5/src/components/taskProgress_custom.ts:419), [browser-locale O date](C:/Code/stash/ui/v2.5/src/components/OStats/OStatsTimeline_custom.tsx:28), [task percent formatting](C:/Code/stash/ui/v2.5/src/components/TaskProgress/TaskProgressAtAGlance.tsx:36), [mixed shared metric formatting](C:/Code/stash/ui/v2.5/src/components/Shared/SortMetricBadge_custom.tsx:44).

### 11 · Medium · Country names use different suppliers and languages

**Where:** country selectors and vato details versus statistics country charts.

Selectors/details use the shared country catalog with the app's locale. Statistics uses `Intl.DisplayNames(["en"])` regardless of that setting. For a Spanish app locale, Mexico can consequently appear as México in one view and Mexico in another. Independent suppliers may also choose different English country names.

**Recommendation:** use the shared country lookup for display, retaining the ISO code as the filter key. Preserve free-text legacy country values rather than silently inventing codes.

Evidence: [statistics country names](C:/Code/stash/ui/v2.5/src/utils/statsCountry_custom.ts:1), [localized shared label](C:/Code/stash/ui/v2.5/src/components/Shared/CountryLabel.tsx:13), [shared country lookup](C:/Code/stash/ui/v2.5/src/utils/country.ts:4).

### 12 · Medium · Top and Bottom have multiple actual colors

**Where:** role filter badges, scene/vato role strips, partner portraits, and charts.

The shared role map says Top `#17a2b8` and Bottom `#28a745`, but Bottom badges use Bootstrap's `success` variant, which this app compiles to `#0f9960`. Some scene role/portrait styles still use `#5bc0de` / `#5cb85c`. Statistics copies the role hex values again instead of importing the role map.

**Recommendation:** give Top and Bottom dedicated semantic color tokens used by badges, charts, text, and borders. Keep generic success/info statuses separate. Derive lighter borders/text variants from the same role token where contrast requires them.

Evidence: [role map](C:/Code/stash/ui/v2.5/src/utils/roleColors_custom.ts:1), [theme success](C:/Code/stash/ui/v2.5/src/styles/_theme.scss:5), [role badge](C:/Code/stash/ui/v2.5/src/components/List/FilterTags.tsx:378), [older portrait shades](C:/Code/stash/ui/v2.5/src/components/Scenes/styles.scss:3235), [copied chart role palette](C:/Code/stash/ui/v2.5/src/utils/statsChartColors_custom.ts:27). Narrow Sass compilation confirmed `.badge-success` resolves to `#0f9960`.

### 13 · Medium · Activity and quality colors change on Scene Stats

**Where:** scene/studio activity charts versus Scene Stats > Activity & Ratings.

Shared activity colors are orange for sex, teal for oral, purple for solo; quality uses gold for Outstanding, green for Standard, gray for Unclassified, and red for Unusable. Scene Stats substitutes copper/steel/brown: oral becomes light gray, solo becomes brown, and Unusable loses its red association.

**Recommendation:** preserve semantic colors across screens. Use the decorative stats palette for categories without an established meaning, not for named activity/quality states.

Evidence: [shared activity colors](C:/Code/stash/ui/v2.5/src/components/Shared/activityColors_custom.ts:3), [dashboard substitutions](C:/Code/stash/ui/v2.5/src/components/SceneStats/SceneStatsInsights_custom.tsx:67), [shared scene presentation](C:/Code/stash/ui/v2.5/src/components/Scenes/SceneActivityMetrics_custom.tsx:176).

### 14 · Medium · Really Hot means gold, orange, or red

**Where:** Scene Detail > player facial overlay; scene-card nut/facial report; Nut/Facial Stats.

The player renders a gold facial icon for Really Hot. Scene-card report icons use ember orange (`#ff7a45`). Statistics uses red (`#e0453a`), while GOAT is gold. Gold therefore represents two quality levels depending on location. Settings even describes the older gold Really Hot behavior.

**Recommendation:** use one quality palette, preferably Regular neutral / Really Hot ember-red / GOAT gold, including player overlays, report icons, legends, and settings descriptions.

Evidence: [gold Really Hot overlay](C:/Code/stash/ui/v2.5/src/components/ScenePlayer/ScenePlayer.tsx:1834), [overlay styling](C:/Code/stash/ui/v2.5/src/components/ScenePlayer/styles.scss:953), [orange report icon](C:/Code/stash/ui/v2.5/src/components/Scenes/styles.scss:511), [stats quality colors](C:/Code/stash/ui/v2.5/src/utils/statsChartColors_custom.ts:34), [settings description](C:/Code/stash/ui/v2.5/src/locales/en-GB.json:679).

### 15 · Low · Metallic tier palettes are maintained independently

**Where:** Playground tier charts and Scene/O Stats metallic charts.

Royal Sapphire is `#95b4ff` in Playground and `#5b8def` in statistics; Gold is `#f2cd70` versus `#d4a93a`. Silver/Bronze/No Tier have separate values too. The hue families remain recognizable, so this is lower impact than the quality conflict above.

**Recommendation:** share tier metadata: key, label, ordering, and base color. Derive explicit contrast variants for different backgrounds; keep premium/classic card gradients as intentional variants.

Evidence: [Playground palette](C:/Code/stash/ui/v2.5/src/components/Playground/ratingTiersData_custom.ts:8), [stats palette](C:/Code/stash/ui/v2.5/src/utils/statsChartColors_custom.ts:18).

### 16 · Medium · Statistics retains Black Steel surfaces in the default theme

**Where:** Settings > Custom > Application Theme, then statistics screens.

The statistics tokens fall back to Black Steel colors even when that theme is not selected. The rest of the default app uses its blue-gray palette. Statistics also uses 12–18px panel radii while Black Steel's ordinary cards/controls generally use 2px. These are confirmed styling differences; whether statistics should have its own visual identity is a design choice.

**Recommendation:** make shared surface/text/border tokens follow the selected app theme. Choose a small radius scale for controls, cards, panels, and pills, with deliberate exceptions rather than per-screen values.

Evidence: [stats fallbacks](C:/Code/stash/ui/v2.5/src/components/statsBarChart_custom.scss:1), [stats panel radii](C:/Code/stash/ui/v2.5/src/components/statsCharts_custom.scss:77), [Black Steel card radius](C:/Code/stash/ui/v2.5/src/styles/applicationTheme_custom.scss:143), [default palette](C:/Code/stash/ui/v2.5/src/styles/_theme.scss:3). A full rendered theme comparison remains outstanding.

### 17 · Medium · Confirmation and dismissal behavior changes by feature

**Where:** list deletion, playlist deletion, Rating Advisor reset, Task Progress milestone deletion, and tracker details.

Some actions use the app's modal shell; others use browser-native `window.confirm`, which cannot follow the app theme or action-label vocabulary. The shared modal disables Escape by default and has no header close button by default; tracker details uses a Bootstrap modal with a header close button and default keyboard behavior.

**Recommendation:** define separate shared policies for confirmations and read-only detail dialogs. Use app-themed confirmations with explicit verbs, consistent Cancel placement, and deliberate dismissal/busy rules. Do not force a destructive confirmation and a detail viewer to share identical dismissal behavior.

Evidence: [shared modal defaults](C:/Code/stash/ui/v2.5/src/components/Shared/Modal.tsx:48), [playlist confirmation](C:/Code/stash/ui/v2.5/src/components/Scenes/MarkerPlaylistPlayer.tsx:1132), [advisor reset](C:/Code/stash/ui/v2.5/src/components/Shared/RatingAdvisor_custom.tsx:1203), [milestone deletion](C:/Code/stash/ui/v2.5/src/components/TaskProgress/TaskProgressMilestoneForm.tsx:217), [tracker details modal](C:/Code/stash/ui/v2.5/src/components/TaskProgress/TaskProgressTrackerModal.tsx:42).

### 18 · Medium · Cards/Table state survives navigation on only some stats pages

**Where:** top rankings in Scene, Vato, O, Nut, and Facial Stats.

Scene/Vato Stats put the Cards/Table choice in their URL-backed view state. O Stats and Nut/Facial ranking sections leave that choice in the ranking component's local state, so it resets when the component remounts. Identical controls therefore have different reload/back-link behavior.

**Recommendation:** choose one persistence policy for equivalent ranking controls and use it across all stats pages. URL state is already available for shareable views.

Evidence: [Scene controlled view](C:/Code/stash/ui/v2.5/src/components/SceneStats/SceneStats.tsx:1588), [Vato controlled view](C:/Code/stash/ui/v2.5/src/components/VatoStats/VatoStats.tsx:1347), [O rankings](C:/Code/stash/ui/v2.5/src/components/OStats/OStats.tsx:1075), [Nut/Facial rankings](C:/Code/stash/ui/v2.5/src/components/MarkerEventStats/MarkerEventStats.tsx:314), [local fallback state](C:/Code/stash/ui/v2.5/src/components/StatsTopCards_custom.tsx:62).

### 19 · Low · Chart headings are copied and already differ on empty data

**Where:** statistics column/ranked charts versus split/diverging charts.

Two heading implementations render the same title, total, note, actions, and Unknown badge. The column/ranked version hides its total when the dataset is empty; the shared heading always renders the total. Future formatting or accessibility fixes must be applied twice.

**Recommendation:** extract one heading with an explicit empty-total policy and optional sort actions.

Evidence: [inline heading](C:/Code/stash/ui/v2.5/src/components/StatsBarChart_custom.tsx:346), [shared heading](C:/Code/stash/ui/v2.5/src/components/StatsCharts_custom.tsx:34).

### 20 · Low · Scene activity interval calculations are duplicated

**Where:** scene cards and Scene Detail > Insights.

The card metric calculator and detail panel separately implement interval merging, subtraction, intersection, clamping, activity totals, and quality totals. They already share some classification helpers, but a rule correction still requires changing two pipelines. The current duplication is confirmed; this finding does not assert another numeric defect beyond finding 01.

**Recommendation:** calculate a shared scene activity result once, then adapt it into compact card rows or detail rows with marker/loop metadata. Keep per-vato and global time populations separate.

Evidence: [card intervals](C:/Code/stash/ui/v2.5/src/components/Scenes/sceneActivityMetricsData_custom.ts:171), [detail intervals](C:/Code/stash/ui/v2.5/src/components/Scenes/SceneDetails/SceneStatsPanel.tsx:141), [detail aggregation](C:/Code/stash/ui/v2.5/src/components/Scenes/SceneDetails/SceneStatsPanel.tsx:306).

### 21 · Low · Metallic rules have multiple owners

**Where:** catalog card borders, statistics, Playground, list filters, and server tier totals.

Card styling and statistics independently apply tier thresholds and override precedence. Go filters and resolver totals also define separate threshold structs, defaults, configuration readers, and tier SQL. Playground reuses the card classifier, which is a good existing example. The current default thresholds agree; duplication alone is not evidence that normal inputs produce different tiers.

**Recommendation:** return a semantic tier from one UI classifier and map it to presentation classes. Share the Go configuration/rule helpers where package boundaries permit. Use the same fixture cases across UI and Go for threshold edges, override precedence, GOAT descendants, bonuses, unrated, and No Tier.

Evidence: [card classifier](C:/Code/stash/ui/v2.5/src/utils/ratingCardStyles_custom.ts:178), [stats classifier](C:/Code/stash/ui/v2.5/src/utils/sceneMetallicRating_custom.ts:24), [Go filter rules](C:/Code/stash/pkg/sqlite/metallic_rating_filter_custom.go:49), [Go resolver rules](C:/Code/stash/internal/api/resolver_custom.go:43), [Playground reuse](C:/Code/stash/ui/v2.5/src/components/Playground/ratingTiersData_custom.ts:75).

### 22 · Low · Activity and quality percentage editors duplicate their controls

**Where:** list filters > Activity Type and Quality Type.

Both editors implement the same greater/less selector, numeric parsing, empty-value handling, percentage suffix, sizing, criterion cloning, and row rendering. Their real differences are the metric keys, labels, and help text.

**Recommendation:** use one percentage-row/editor component configured by those differences. Keep each criterion's meaning and serialization explicit.

Evidence: [activity editor](C:/Code/stash/ui/v2.5/src/components/List/Filters/ActivityTypeFilter_custom.tsx:19), [quality editor](C:/Code/stash/ui/v2.5/src/components/List/Filters/QualityTypeFilter_custom.tsx:20).

### 23 · Low · Task Progress repeats its goal-state palette

**Where:** Task Progress > period cards, tracker details, and activity reports.

The red/orange/yellow/green/sapphire values are repeated in two page-style blocks and again in report styles. They currently agree, but updating a goal color requires several coordinated edits.

**Recommendation:** define the five goal-state tokens once and let the different bars/charts consume them. Keep this palette distinct from role, quality, and metallic-rating semantics.

Evidence: [first goal palette](C:/Code/stash/ui/v2.5/src/components/TaskProgress/taskProgressPage_custom.scss:217), [second copy](C:/Code/stash/ui/v2.5/src/components/TaskProgress/taskProgressPage_custom.scss:436), [report palette](C:/Code/stash/ui/v2.5/src/components/TaskProgress/taskProgressActivity_custom.scss:40).

### 24 · Medium · Equivalent internal links use different navigation mechanisms

**Where:** Studio Detail > facial/unique-vato counts versus shared scene-type bars and stats links.

Studio count buttons navigate with ordinary `href` attributes, while equivalent filter links use the router's `Link`. The former performs a document navigation; the latter keeps the app mounted. This changes loading, transient state retention, and back-navigation experience for similar-looking in-app links.

**Recommendation:** use router-aware links/buttons for app routes. Reserve ordinary document navigation for downloads, external sites, and intentional reloads. Review filter URL construction separately before consolidating it, since existing saved URLs must remain readable.

Evidence: [studio count links](C:/Code/stash/ui/v2.5/src/components/Studios/StudioDetails/StudioExtraCounts.tsx:42), [router-aware scene counts](C:/Code/stash/ui/v2.5/src/components/Shared/SceneTypesBar_custom.tsx:133), [router-aware stats links](C:/Code/stash/ui/v2.5/src/components/StatsLinks_custom.tsx:74).

## Suggested standards

These standards informed the follow-up implementation; the palette document records the final chosen wording and colors.

| Concept          | Consistent rule                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| Entities         | Vato/Vatos; Movie/Movies in English UI. Preserve technical IDs and routes.                                     |
| Personal records | O / O records for the user's recorded events.                                                                  |
| Scene events     | Nut / Facial for on-screen marker events.                                                                      |
| Event quality    | Regular / Really Hot / GOAT; exclusive highest-quality precedence.                                             |
| Time quality     | Outstanding / Standard / Unclassified / Unusable; keep separate from event quality.                            |
| Metallic rating  | No Tier / Bronze / Silver / Gold / Royal Sapphire; Unrated remains separate.                                   |
| Missing data     | Distinct policies for zero records, unassessed content, and unknown values. Stable keys independent of labels. |
| Colors           | Shared semantic tokens for roles, activities, quality, tiers, and status; theme-aware surface tokens.          |
| Formatting       | App locale; explicit precision by context; separate calendar dates from timestamps.                            |
| Actions          | One success/failure contract; app-themed confirmations; consistent internal navigation.                        |

## Preserve these distinctions

- **O records and scene nuts are different events.** Their existing separate dashboards and icons are useful.
- **GOAT event quality and Royal Sapphire card promotion are different meanings.** Both now use the selected sapphire hue while retaining separate classification rules.
- **Task Progress Alpha Sapphire and rating Royal Sapphire belong to different scales.** Their thresholds and names need not be merged.
- **Activity percentages may legitimately exceed 100% in total.** Overlap is meaningful; forcing them into a partition causes finding 01.
- **Scene types, activity duration, unique partners, and role duration have different populations.** Shared styling must not erase those differences.
- **The shared Rating Strip, StatsPage, date-range controls, role map, loading indicator, and URL view-state helpers already provide useful foundations.** Extend these rather than adding competing systems.

## Implementation order and verification

| Batch | Work                                                                        | Verification that matters                                                                                           |
| ----- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1     | Fix activity denominators and failed-delete outcomes (01–02).               | Overlapping marker fixture shown on both screens; rejected deletion retains selection and never reports applied.    |
| 2     | Agree metric semantics, then align quality/zero/missing rules (03–05, 07).  | Same GOAT/Really Hot fixtures, zero records, literal placeholders, unrated and below-Bronze cases across consumers. |
| 3     | Align visible vocabulary, locale formatting, and country names (06, 08–11). | English entity-copy sweep; app locale differing from browser locale; fuzzy dates and midnight timestamps.           |
| 4     | Consolidate semantic palettes and theme surfaces (12–16, 23).               | Render badges, borders, legends, overlays, and charts together in both themes; verify contrast and reduced motion.  |
| 5     | Align confirmations, view persistence, and navigation (17–18, 24).          | Escape/backdrop/busy behavior by dialog type; refresh/back/deep-link behavior; no unexpected document reloads.      |
| 6     | Remove redundant implementations (19–22).                                   | Preserve fixture outputs before and after extraction; remove superseded private code and imports.                   |

Follow the fork's custom-file/marker conventions and keep each batch independently reviewable. Update existing CUSTOM_FEATURES entries for the affected features instead of creating a feature entry per cosmetic fix. Do not rename persisted configuration, GraphQL fields, URL keys, or plugin-facing APIs just to match UI wording.

## Verification performed

- Passed seven existing focused TypeScript test files: activity percentages, role colors, country names, metallic chart buckets, Scene Stats unknown filters, scene activity metrics, and statistics view state. This is a targeted check, not the full UI suite.
- Executed source-level reproductions for the overlapping 100%/100% versus 50%/50% calculations, zero-O Unknown classification, `None`/`No Tier` naming, and literal `null` normalization.
- Compiled the narrow theme stylesheet with its normal import root; verified success badges use `#0f9960` and info badges use `#17a2b8`.
- Checked Markdown formatting, local evidence links/line bounds, and whitespace for this audit document.

The checks above describe the original audit. Follow-up implementation and its verification are recorded in CUSTOM_FEATURES.md; no deployment was requested.
