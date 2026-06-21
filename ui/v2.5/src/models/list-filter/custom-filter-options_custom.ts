// CUSTOM: Custom filter option helpers for the Stash fork
import type { CriterionType } from "./types";

const customCriterionTypes = new Set<CriterionType>([
  "activity_type",
  "custom_filters",
  "effective_date",
  "ethnicity",
  "exclude_marker_tags",
  "has_end_time",
  "has_marker_performers",
  "has_roles",
  "marker_bottom",
  "marker_length",
  "marker_performers",
  "marker_tags",
  "marker_tags_with_performers",
  "marker_top",
  "metallic_rating",
  "partners",
  "performer_country",
  "performer_ethnicity",
  "performer_marker_partners",
  "performer_marker_tags",
  "performer_markers",
  "performer_rating",
  "profile_image_count",
  "rating_criteria",
  "release_count",
  "scene_director",
  "scene_marker_tags",
  "scene_markers",
  "scene_markers_exclude",
  "scene_performer_count",
  "scene_type",
  "sex_activity_percent",
  "sex_bottom_activity_percent",
  "sex_top_activity_percent",
  "oral_activity_percent",
  "oral_bottom_activity_percent",
  "oral_top_activity_percent",
  "solo_activity_percent",
]);

export function isCustomFilterCriterion(type: CriterionType): boolean {
  return customCriterionTypes.has(type);
}
