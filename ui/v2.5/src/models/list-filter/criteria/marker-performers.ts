import { CriterionModifier, IntCriterionInput, UnnamedPerformerCriterionInput } from "src/core/generated-graphql";
import {
  Criterion,
  CriterionOption,
} from "./criterion";
import { ILabeledId } from "../types";
import { IntlShape } from "react-intl";
import { IUnnamedPerformer, isUnnamedPerformerId } from "./unnamed-performer";

// Rating criterion for backwards compatibility
export interface IMarkerRatingCriterion {
  modifier: CriterionModifier;
  value: number;
  value2?: number;
}

// Value type for the marker performers criterion
export interface IMarkerPerformersValue {
  tag_ids: ILabeledId[]; // Tags for filtering markers
  include_subtags: boolean; // Include child tags (-1 depth when true)
  performer_mode: "AND" | "OR"; // AND = top AND bottom must match, OR = top OR bottom can match
  top_performer_ids: ILabeledId[];
  top_any_count: number; // Minimum number of ANY top performers required
  // Legacy fields for compatibility - will be migrated to unnamed_performers
  top_ethnicities: string[];
  top_countries: string[];
  top_rating: IMarkerRatingCriterion | null;
  bottom_performer_ids: ILabeledId[];
  bottom_any_count: number; // Minimum number of ANY bottom performers required
  // Legacy fields for compatibility - will be migrated to unnamed_performers
  bottom_ethnicities: string[];
  bottom_countries: string[];
  bottom_rating: IMarkerRatingCriterion | null;
  // Unnamed performers defined within this filter (the new way)
  unnamed_performers: IUnnamedPerformer[];
}

// Simplified: No modifier options exposed to UI - always use EQUALS for the scene_marker_tags filter
const modifierOptions = [
  CriterionModifier.Equals,
];

const defaultModifier = CriterionModifier.Equals;

export class MarkerPerformersCriterion extends Criterion {
  public modifier: CriterionModifier = defaultModifier;
  public value: IMarkerPerformersValue = {
    tag_ids: [],
    include_subtags: false,
    performer_mode: "AND",
    top_performer_ids: [],
    top_any_count: 0,
    top_ethnicities: [],
    top_countries: [],
    top_rating: null,
    bottom_performer_ids: [],
    bottom_any_count: 0,
    bottom_ethnicities: [],
    bottom_countries: [],
    bottom_rating: null,
    unnamed_performers: [],
  };

  constructor(option?: CriterionOption) {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    super(option ?? MarkerPerformersCriterionOption);
  }

  protected cloneValues() {
    this.value = {
      tag_ids: this.value.tag_ids.map((t) => ({ ...t })),
      include_subtags: this.value.include_subtags,
      performer_mode: this.value.performer_mode,
      top_performer_ids: this.value.top_performer_ids.map((p) => ({ ...p })),
      top_any_count: this.value.top_any_count,
      top_ethnicities: [...(this.value.top_ethnicities ?? [])],
      top_countries: [...(this.value.top_countries ?? [])],
      top_rating: this.value.top_rating ? { ...this.value.top_rating } : null,
      bottom_performer_ids: this.value.bottom_performer_ids.map((p) => ({
        ...p,
      })),
      bottom_any_count: this.value.bottom_any_count,
      bottom_ethnicities: [...(this.value.bottom_ethnicities ?? [])],
      bottom_countries: [...(this.value.bottom_countries ?? [])],
      bottom_rating: this.value.bottom_rating ? { ...this.value.bottom_rating } : null,
      unnamed_performers: (this.value.unnamed_performers ?? []).map((up) => ({
        ...up,
        ethnicities: [...up.ethnicities],
        countries: [...up.countries],
        rating: up.rating ? { ...up.rating } : null,
      })),
    };
  }

  public getLabel(intl: IntlShape): string {
    const criterion = intl.formatMessage({
      id: this.criterionOption.messageID,
    });

    const parts: string[] = [];
    if (this.value.tag_ids.length > 0) {
      const tagNames = this.value.tag_ids.map((t) => t.label).join(", ");
      const subtagsSuffix = this.value.include_subtags ? " (+subs)" : "";
      parts.push(`Tags: ${tagNames}${subtagsSuffix}`);
    }
    if (this.value.top_performer_ids.length > 0) {
      const topNames = this.value.top_performer_ids
        .map((p) => p.label)
        .join(", ");
      parts.push(`Top: ${topNames}`);
    }
    if (this.value.bottom_performer_ids.length > 0) {
      const bottomNames = this.value.bottom_performer_ids
        .map((p) => p.label)
        .join(", ");
      parts.push(`Bottom: ${bottomNames}`);
    }

    const valueString = parts.length > 0 ? parts.join(" + ") : "...";

    return `${criterion}: ${valueString}`;
  }

  public toQueryParams(): Record<string, unknown> {
    return {
      type: this.criterionOption.type,
      modifier: this.modifier,
      tag_ids: (this.value.tag_ids ?? []).map((t) => ({
        id: t.id,
        label: t.label,
      })),
      include_subtags: this.value.include_subtags,
      performer_mode: this.value.performer_mode,
      top_performer_ids: (this.value.top_performer_ids ?? []).map((p) => ({
        id: p.id,
        label: p.label,
      })),
      bottom_performer_ids: (this.value.bottom_performer_ids ?? []).map((p) => ({
        id: p.id,
        label: p.label,
      })),
      unnamed_performers: (this.value.unnamed_performers ?? []).map((up) => ({
        id: up.id,
        label: up.label,
        letter: up.letter,
        ethnicities: up.ethnicities,
        countries: up.countries,
        rating: up.rating,
      })),
    };
  }

  public fromDecodedParams(params: Record<string, unknown>): void {
    const raw = params as {
      modifier?: CriterionModifier;
      tag_ids?: Array<{ id: string; label: string }>;
      include_subtags?: boolean;
      performer_mode?: "AND" | "OR";
      top_performer_ids?: Array<{ id: string; label: string }>;
      bottom_performer_ids?: Array<{ id: string; label: string }>;
      unnamed_performers?: IUnnamedPerformer[];
    };

    if (raw.modifier) this.modifier = raw.modifier;
    if (raw.tag_ids) {
      this.value.tag_ids = raw.tag_ids.map((t) => ({
        id: t.id,
        label: t.label,
      }));
    }
    if (raw.include_subtags !== undefined)
      this.value.include_subtags = raw.include_subtags;
    if (raw.performer_mode)
      this.value.performer_mode = raw.performer_mode;
    if (raw.top_performer_ids) {
      this.value.top_performer_ids = raw.top_performer_ids.map((p) => ({
        id: p.id,
        label: p.label,
      }));
    }
    if (raw.bottom_performer_ids) {
      this.value.bottom_performer_ids = raw.bottom_performer_ids.map((p) => ({
        id: p.id,
        label: p.label,
      }));
    }
    if (raw.unnamed_performers) {
      this.value.unnamed_performers = raw.unnamed_performers.map((up) => ({
        id: up.id,
        label: up.label,
        letter: up.letter,
        ethnicities: up.ethnicities ?? [],
        countries: up.countries ?? [],
        rating: up.rating ?? null,
      }));
    }
  }

  public applyToCriterionInput(input: Record<string, unknown>): void {
    // Build a scene_marker_tags group with performer attributes
    // Logic:
    // - Tags: marker must have ALL specified tags (primary or secondary)
    // - If include_subtags is checked, also match any subtag of the specified tags
    // - Top performers: ALL named performers must be tops on the marker
    // - Bottom performers: ALL named performers must be bottoms on the marker
    // - Unnamed performers: Each represents a DISTINCT performer slot matching the criteria
    // - If same unnamed performer is in both top and bottom, they must be both roles on the marker
    // - PerformerMode: AND = both top AND bottom must match, OR = top OR bottom can match

    const group: Record<string, unknown> = {
      tag_ids: this.value.tag_ids.map((t) => t.id),
    };

    // Add performer mode (AND or OR)
    group.performer_mode = this.value.performer_mode;

    // Add depth for subtags if enabled
    if (this.value.include_subtags) {
      group.depth = -1; // -1 means all descendants
    }

    // Separate named and unnamed performers
    const topNamed = (this.value.top_performer_ids ?? []).filter(p => !isUnnamedPerformerId(p.id));
    const topUnnamed = (this.value.top_performer_ids ?? []).filter(p => isUnnamedPerformerId(p.id));
    const bottomNamed = (this.value.bottom_performer_ids ?? []).filter(p => !isUnnamedPerformerId(p.id));
    const bottomUnnamed = (this.value.bottom_performer_ids ?? []).filter(p => isUnnamedPerformerId(p.id));

    // In AND mode: if a performer is in both top and bottom, they must be both roles on the marker
    // In OR mode: don't use both_roles - keep them in both lists so the OR logic can match either role
    const isOrMode = this.value.performer_mode === "OR";

    // Find named performers that are in BOTH top and bottom (both_roles) - only for AND mode
    const bothRolesNamedIds = new Set<string>();
    if (!isOrMode) {
      for (const tp of topNamed) {
        if (bottomNamed.some(bp => bp.id === tp.id)) {
          bothRolesNamedIds.add(tp.id);
        }
      }
    }

    // Find unnamed performers that are in BOTH top and bottom (both_roles) - only for AND mode
    const bothRolesUnnamedIds = new Set<string>();
    if (!isOrMode) {
      for (const tp of topUnnamed) {
        if (bottomUnnamed.some(bp => bp.id === tp.id)) {
          bothRolesUnnamedIds.add(tp.id);
        }
      }
    }

    // Get the actual unnamed performer definitions
    const getUnnamedDef = (id: string) => 
      (this.value.unnamed_performers ?? []).find(up => up.id === id);

    // Build unnamed performer criterion arrays
    const topUnnamedPerformers: UnnamedPerformerCriterionInput[] = [];
    const bottomUnnamedPerformers: UnnamedPerformerCriterionInput[] = [];
    const bothRolesUnnamedPerformers: UnnamedPerformerCriterionInput[] = [];

    // Add both-roles unnamed performers
    for (const id of bothRolesUnnamedIds) {
      const def = getUnnamedDef(id);
      if (def) {
        bothRolesUnnamedPerformers.push({
          id: def.id, // Include ID for correlation across marker groups
          ethnicities: def.ethnicities.length > 0 ? def.ethnicities : undefined,
          countries: def.countries.length > 0 ? def.countries : undefined,
          rating: def.rating ?? undefined,
        });
      }
    }

    // Add top-only unnamed performers (not in both_roles)
    for (const tp of topUnnamed) {
      if (!bothRolesUnnamedIds.has(tp.id)) {
        const def = getUnnamedDef(tp.id);
        if (def) {
          topUnnamedPerformers.push({
            id: def.id,
            ethnicities: def.ethnicities.length > 0 ? def.ethnicities : undefined,
            countries: def.countries.length > 0 ? def.countries : undefined,
            rating: def.rating ?? undefined,
          });
        }
      }
    }

    // Add bottom-only unnamed performers (not in both_roles)
    for (const bp of bottomUnnamed) {
      if (!bothRolesUnnamedIds.has(bp.id)) {
        const def = getUnnamedDef(bp.id);
        if (def) {
          bottomUnnamedPerformers.push({
            id: def.id,
            ethnicities: def.ethnicities.length > 0 ? def.ethnicities : undefined,
            countries: def.countries.length > 0 ? def.countries : undefined,
            rating: def.rating ?? undefined,
          });
        }
      }
    }

    // Named performer IDs - separate both_roles from individual top/bottom
    const topOnlyNamed = topNamed.filter(p => !bothRolesNamedIds.has(p.id));
    const bottomOnlyNamed = bottomNamed.filter(p => !bothRolesNamedIds.has(p.id));
    const bothRolesNamed = topNamed.filter(p => bothRolesNamedIds.has(p.id));

    if (topOnlyNamed.length > 0) {
      group.top_performer_ids = topOnlyNamed.map((p) => p.id);
    }
    if (bottomOnlyNamed.length > 0) {
      group.bottom_performer_ids = bottomOnlyNamed.map((p) => p.id);
    }
    if (bothRolesNamed.length > 0) {
      group.both_roles_performer_ids = bothRolesNamed.map((p) => p.id);
    }

    // Add unnamed performer slots
    if (topUnnamedPerformers.length > 0) {
      group.top_unnamed_performers = topUnnamedPerformers;
    }
    if (bottomUnnamedPerformers.length > 0) {
      group.bottom_unnamed_performers = bottomUnnamedPerformers;
    }
    if (bothRolesUnnamedPerformers.length > 0) {
      group.both_roles_unnamed_performers = bothRolesUnnamedPerformers;
    }

    // Output to temporary key for aggregation by filter.ts
    if (!input._sceneMarkerIncludeCriteria) {
      input._sceneMarkerIncludeCriteria = [];
    }
    (input._sceneMarkerIncludeCriteria as Array<typeof group>).push(group);
  }

  public applyToSavedCriterion(input: Record<string, unknown>): void {
    // Preserve full performer objects with labels for restoration
    input[this.criterionOption.type] = {
      tag_ids: this.value.tag_ids.map((t) => ({
        id: t.id,
        label: t.label,
      })),
      include_subtags: this.value.include_subtags,
      performer_mode: this.value.performer_mode,
      top_performer_ids: this.value.top_performer_ids.map((p) => ({
        id: p.id,
        label: p.label,
      })),
      bottom_performer_ids: this.value.bottom_performer_ids.map((p) => ({
        id: p.id,
        label: p.label,
      })),
      unnamed_performers: this.value.unnamed_performers.map((up) => ({
        id: up.id,
        label: up.label,
        letter: up.letter,
        ethnicities: up.ethnicities,
        countries: up.countries,
        rating: up.rating,
      })),
      modifier: this.modifier,
    };
  }

  public setFromSavedCriterion(savedCriterion: Record<string, unknown>): void {
    // savedCriterion is already the criterion data, not a wrapper object
    const data = savedCriterion as {
      tag_ids?: Array<{ id: string; label: string }>;
      include_subtags?: boolean;
      performer_mode?: "AND" | "OR";
      top_performer_ids?: Array<{ id: string; label: string }>;
      bottom_performer_ids?: Array<{ id: string; label: string }>;
      unnamed_performers?: IUnnamedPerformer[];
      modifier?: CriterionModifier;
    };

    if (!data) return;

    if (data.modifier) this.modifier = data.modifier;
    if (data.tag_ids) {
      this.value.tag_ids = data.tag_ids.map((t) => ({
        id: t.id,
        label: t.label,
      }));
    }
    if (data.include_subtags !== undefined)
      this.value.include_subtags = data.include_subtags;
    if (data.performer_mode)
      this.value.performer_mode = data.performer_mode;
    if (data.top_performer_ids) {
      this.value.top_performer_ids = data.top_performer_ids.map((p) => ({
        id: p.id,
        label: p.label,
      }));
    }
    if (data.bottom_performer_ids) {
      this.value.bottom_performer_ids = data.bottom_performer_ids.map((p) => ({
        id: p.id,
        label: p.label,
      }));
    }
    if (data.unnamed_performers) {
      this.value.unnamed_performers = data.unnamed_performers.map((up) => ({
        id: up.id,
        label: up.label,
        letter: up.letter,
        ethnicities: up.ethnicities ?? [],
        countries: up.countries ?? [],
        rating: up.rating ?? null,
      }));
    }
  }
}

export const MarkerPerformersCriterionOption: CriterionOption =
  new CriterionOption({
    messageID: "marker_performers",
    type: "marker_performers",
    makeCriterion: () => new MarkerPerformersCriterion(),
  });

// Also export modifierOptions for use in CriterionEditor
export const markerPerformersModifierOptions = modifierOptions;
