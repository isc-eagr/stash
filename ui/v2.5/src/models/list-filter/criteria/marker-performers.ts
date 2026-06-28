import {
  CriterionModifier,
  UnnamedPerformerCriterionInput,
} from "src/core/generated-graphql";
import { Criterion, CriterionOption } from "./criterion";
import { ILabeledId } from "../types";
import { IntlShape } from "react-intl";
import { ratingCriteriaValueToCriterionInput } from "./rating-criteria_custom";
import {
  cloneUnnamedPerformer,
  IUnnamedPerformer,
  isUnnamedPerformerId,
} from "./unnamed-performer";

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
  require_overlap: boolean; // Legacy query/saved-filter value; multi-row marker configs overlap automatically.
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
  groups?: IMarkerPerformersGroup[];
}

export interface IMarkerPerformersGroup {
  groupId: string;
  tag_ids: ILabeledId[];
  include_subtags: boolean;
  require_overlap: boolean;
  performer_mode: "AND" | "OR";
  top_performer_ids: ILabeledId[];
  top_any_count: number;
  top_ethnicities: string[];
  top_countries: string[];
  top_rating: IMarkerRatingCriterion | null;
  bottom_performer_ids: ILabeledId[];
  bottom_any_count: number;
  bottom_ethnicities: string[];
  bottom_countries: string[];
  bottom_rating: IMarkerRatingCriterion | null;
}

// Simplified: No modifier options exposed to UI - always use EQUALS for the scene_marker_tags filter
const modifierOptions = [CriterionModifier.Equals];

const defaultModifier = CriterionModifier.Equals;

function createEmptyMarkerGroup(groupId: string): IMarkerPerformersGroup {
  return {
    groupId,
    tag_ids: [],
    include_subtags: false,
    require_overlap: false,
    performer_mode: "OR",
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
  };
}

function getNextMarkerGroupId(groups: IMarkerPerformersGroup[]): string {
  const usedIds = new Set(groups.map((g) => g.groupId));
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (const letter of alphabet) {
    if (!usedIds.has(letter)) return letter;
  }
  return `${groups.length + 1}`;
}

export class MarkerPerformersCriterion extends Criterion {
  public modifier: CriterionModifier = defaultModifier;
  public value: IMarkerPerformersValue = {
    tag_ids: [],
    include_subtags: false,
    require_overlap: false,
    performer_mode: "OR",
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
      require_overlap: this.value.require_overlap,
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
      bottom_rating: this.value.bottom_rating
        ? { ...this.value.bottom_rating }
        : null,
      unnamed_performers: (this.value.unnamed_performers ?? []).map(
        cloneUnnamedPerformer
      ),
      groups: this.value.groups?.map((g) => ({
        groupId: g.groupId,
        tag_ids: g.tag_ids.map((t) => ({ ...t })),
        include_subtags: g.include_subtags,
        require_overlap: g.require_overlap,
        performer_mode: g.performer_mode,
        top_performer_ids: g.top_performer_ids.map((p) => ({ ...p })),
        top_any_count: g.top_any_count,
        top_ethnicities: [...(g.top_ethnicities ?? [])],
        top_countries: [...(g.top_countries ?? [])],
        top_rating: g.top_rating ? { ...g.top_rating } : null,
        bottom_performer_ids: g.bottom_performer_ids.map((p) => ({ ...p })),
        bottom_any_count: g.bottom_any_count,
        bottom_ethnicities: [...(g.bottom_ethnicities ?? [])],
        bottom_countries: [...(g.bottom_countries ?? [])],
        bottom_rating: g.bottom_rating ? { ...g.bottom_rating } : null,
      })),
    };
  }

  public getGroups(): IMarkerPerformersGroup[] {
    if (this.value.groups && this.value.groups.length > 0) {
      return this.value.groups;
    }

    return [
      {
        groupId: "A",
        tag_ids: this.value.tag_ids,
        include_subtags: this.value.include_subtags,
        require_overlap: this.value.require_overlap,
        performer_mode: this.value.performer_mode,
        top_performer_ids: this.value.top_performer_ids,
        top_any_count: this.value.top_any_count,
        top_ethnicities: this.value.top_ethnicities,
        top_countries: this.value.top_countries,
        top_rating: this.value.top_rating,
        bottom_performer_ids: this.value.bottom_performer_ids,
        bottom_any_count: this.value.bottom_any_count,
        bottom_ethnicities: this.value.bottom_ethnicities,
        bottom_countries: this.value.bottom_countries,
        bottom_rating: this.value.bottom_rating,
      },
    ];
  }

  public ensureGroups(): void {
    if (!this.value.groups || this.value.groups.length === 0) {
      this.value.groups = this.getGroups();
    }
  }

  public addGroup(): string {
    this.ensureGroups();
    const groupId = getNextMarkerGroupId(this.value.groups ?? []);
    this.value.groups = [
      ...(this.value.groups ?? []),
      createEmptyMarkerGroup(groupId),
    ];
    return groupId;
  }

  public removeGroup(groupId: string): void {
    this.ensureGroups();
    this.value.groups = (this.value.groups ?? []).filter(
      (g) => g.groupId !== groupId
    );
    if (this.value.groups.length === 0) {
      this.value.groups = [createEmptyMarkerGroup("A")];
    }
  }

  public updateGroup(
    groupId: string,
    updates: Partial<Omit<IMarkerPerformersGroup, "groupId">>
  ): void {
    this.ensureGroups();
    this.value.groups = (this.value.groups ?? []).map((g) =>
      g.groupId === groupId ? { ...g, ...updates } : g
    );
  }

  public getLabel(intl: IntlShape): string {
    const criterion = intl.formatMessage({
      id: this.criterionOption.messageID,
    });

    const groups = this.getGroups();
    const parts: string[] = [];
    const useOverlapGroups = groups.length > 1;
    for (const group of groups) {
      const groupParts: string[] = [];
      if (group.tag_ids.length > 0) {
        const tagNames = group.tag_ids.map((t) => t.label).join(", ");
        const subtagsSuffix = group.include_subtags ? " (+subs)" : "";
        groupParts.push(`Tags: ${tagNames}${subtagsSuffix}`);
      }
      if (group.top_performer_ids.length > 0) {
        const topNames = group.top_performer_ids.map((p) => p.label).join(", ");
        groupParts.push(`Top: ${topNames}`);
      }
      if (group.bottom_performer_ids.length > 0) {
        const bottomNames = group.bottom_performer_ids
          .map((p) => p.label)
          .join(", ");
        groupParts.push(`Bottom: ${bottomNames}`);
      }
      const overlapSuffix = useOverlapGroups ? " overlaps" : "";
      parts.push(
        `${group.groupId}${overlapSuffix}: ${groupParts.join(" + ") || "..."}`
      );
    }

    const valueString = parts.length > 0 ? parts.join(" + ") : "...";

    return `${criterion}: ${valueString}`;
  }

  public toQueryParams(): Record<string, unknown> {
    const groups = this.getGroups();
    return {
      type: this.criterionOption.type,
      modifier: this.modifier,
      tag_ids: (this.value.tag_ids ?? []).map((t) => ({
        id: t.id,
        label: t.label,
      })),
      include_subtags: this.value.include_subtags,
      require_overlap: this.value.require_overlap,
      performer_mode: this.value.performer_mode,
      top_performer_ids: (this.value.top_performer_ids ?? []).map((p) => ({
        id: p.id,
        label: p.label,
      })),
      bottom_performer_ids: (this.value.bottom_performer_ids ?? []).map(
        (p) => ({
          id: p.id,
          label: p.label,
        })
      ),
      unnamed_performers: (this.value.unnamed_performers ?? []).map((up) => ({
        id: up.id,
        label: up.label,
        letter: up.letter,
        ethnicities: up.ethnicities,
        countries: up.countries,
        rating: up.rating,
        rating_criteria: up.rating_criteria,
      })),
      groups: groups.map((g) => ({
        groupId: g.groupId,
        tag_ids: g.tag_ids.map((t) => ({ id: t.id, label: t.label })),
        include_subtags: g.include_subtags,
        require_overlap: g.require_overlap,
        performer_mode: g.performer_mode,
        top_performer_ids: g.top_performer_ids.map((p) => ({
          id: p.id,
          label: p.label,
        })),
        bottom_performer_ids: g.bottom_performer_ids.map((p) => ({
          id: p.id,
          label: p.label,
        })),
      })),
    };
  }

  public fromDecodedParams(params: Record<string, unknown>): void {
    const raw = params as {
      modifier?: CriterionModifier;
      tag_ids?: Array<{ id: string; label: string }>;
      include_subtags?: boolean;
      require_overlap?: boolean;
      performer_mode?: "AND" | "OR";
      top_performer_ids?: Array<{ id: string; label: string }>;
      bottom_performer_ids?: Array<{ id: string; label: string }>;
      unnamed_performers?: IUnnamedPerformer[];
      groups?: Array<{
        groupId: string;
        tag_ids: Array<{ id: string; label: string }>;
        include_subtags?: boolean;
        require_overlap?: boolean;
        performer_mode?: "AND" | "OR";
        top_performer_ids?: Array<{ id: string; label: string }>;
        bottom_performer_ids?: Array<{ id: string; label: string }>;
      }>;
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
    if (raw.require_overlap !== undefined)
      this.value.require_overlap = raw.require_overlap;
    if (raw.performer_mode) this.value.performer_mode = raw.performer_mode;
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
      this.value.unnamed_performers = raw.unnamed_performers.map(
        cloneUnnamedPerformer
      );
    }
    if (raw.groups) {
      this.value.groups = raw.groups.map((g) => ({
        ...createEmptyMarkerGroup(g.groupId),
        tag_ids: g.tag_ids.map((t) => ({ id: t.id, label: t.label })),
        include_subtags: g.include_subtags ?? false,
        require_overlap: g.require_overlap ?? false,
        performer_mode: g.performer_mode ?? "OR",
        top_performer_ids: (g.top_performer_ids ?? []).map((p) => ({
          id: p.id,
          label: p.label,
        })),
        bottom_performer_ids: (g.bottom_performer_ids ?? []).map((p) => ({
          id: p.id,
          label: p.label,
        })),
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

    const getUnnamedDef = (id: string) =>
      (this.value.unnamed_performers ?? []).find((up) => up.id === id);

    const buildGraphQLGroup = (markerGroup: IMarkerPerformersGroup) => {
      const group: Record<string, unknown> = {
        tag_ids: markerGroup.tag_ids.map((t) => t.id),
        performer_mode: markerGroup.performer_mode,
      };

      if (markerGroup.include_subtags) {
        group.depth = -1;
      }

      const topNamed = (markerGroup.top_performer_ids ?? []).filter(
        (p) => !isUnnamedPerformerId(p.id)
      );
      const topUnnamed = (markerGroup.top_performer_ids ?? []).filter((p) =>
        isUnnamedPerformerId(p.id)
      );
      const bottomNamed = (markerGroup.bottom_performer_ids ?? []).filter(
        (p) => !isUnnamedPerformerId(p.id)
      );
      const bottomUnnamed = (markerGroup.bottom_performer_ids ?? []).filter(
        (p) => isUnnamedPerformerId(p.id)
      );

      const bothRolesNamedIds = new Set<string>();
      if (markerGroup.performer_mode === "AND") {
        for (const tp of topNamed) {
          if (bottomNamed.some((bp) => bp.id === tp.id)) {
            bothRolesNamedIds.add(tp.id);
          }
        }
      }

      const bothRolesUnnamedIds = new Set<string>();
      for (const tp of topUnnamed) {
        if (bottomUnnamed.some((bp) => bp.id === tp.id)) {
          bothRolesUnnamedIds.add(tp.id);
        }
      }

      const topUnnamedPerformers: UnnamedPerformerCriterionInput[] = [];
      const bottomUnnamedPerformers: UnnamedPerformerCriterionInput[] = [];
      const bothRolesUnnamedPerformers: UnnamedPerformerCriterionInput[] = [];

      for (const id of bothRolesUnnamedIds) {
        const def = getUnnamedDef(id);
        if (def) {
          bothRolesUnnamedPerformers.push({
            id: def.id,
            ethnicities:
              def.ethnicities.length > 0 ? def.ethnicities : undefined,
            countries: def.countries.length > 0 ? def.countries : undefined,
            rating: def.rating ?? undefined,
            rating_criteria: ratingCriteriaValueToCriterionInput(
              def.rating_criteria
            ),
          });
        }
      }

      for (const tp of topUnnamed) {
        if (!bothRolesUnnamedIds.has(tp.id)) {
          const def = getUnnamedDef(tp.id);
          if (def) {
            topUnnamedPerformers.push({
              id: def.id,
              ethnicities:
                def.ethnicities.length > 0 ? def.ethnicities : undefined,
              countries: def.countries.length > 0 ? def.countries : undefined,
              rating: def.rating ?? undefined,
              rating_criteria: ratingCriteriaValueToCriterionInput(
                def.rating_criteria
              ),
            });
          }
        }
      }

      for (const bp of bottomUnnamed) {
        if (!bothRolesUnnamedIds.has(bp.id)) {
          const def = getUnnamedDef(bp.id);
          if (def) {
            bottomUnnamedPerformers.push({
              id: def.id,
              ethnicities:
                def.ethnicities.length > 0 ? def.ethnicities : undefined,
              countries: def.countries.length > 0 ? def.countries : undefined,
              rating: def.rating ?? undefined,
              rating_criteria: ratingCriteriaValueToCriterionInput(
                def.rating_criteria
              ),
            });
          }
        }
      }

      const topOnlyNamed = topNamed.filter((p) => !bothRolesNamedIds.has(p.id));
      const bottomOnlyNamed = bottomNamed.filter(
        (p) => !bothRolesNamedIds.has(p.id)
      );
      const bothRolesNamed = topNamed.filter((p) =>
        bothRolesNamedIds.has(p.id)
      );

      if (topOnlyNamed.length > 0) {
        group.top_performer_ids = topOnlyNamed.map((p) => p.id);
      }
      if (bottomOnlyNamed.length > 0) {
        group.bottom_performer_ids = bottomOnlyNamed.map((p) => p.id);
      }
      if (bothRolesNamed.length > 0) {
        group.both_roles_performer_ids = bothRolesNamed.map((p) => p.id);
      }

      if (topUnnamedPerformers.length > 0) {
        group.top_unnamed_performers = topUnnamedPerformers;
      }
      if (bottomUnnamedPerformers.length > 0) {
        group.bottom_unnamed_performers = bottomUnnamedPerformers;
      }
      if (bothRolesUnnamedPerformers.length > 0) {
        group.both_roles_unnamed_performers = bothRolesUnnamedPerformers;
      }

      return group;
    };

    const markerGroups = this.getGroups();
    const useOverlapGroups = markerGroups.length > 1;

    for (const markerGroup of markerGroups) {
      const group = buildGraphQLGroup(markerGroup);
      const targetKey = useOverlapGroups
        ? "_sceneMarkerOverlapCriteria"
        : "_sceneMarkerIncludeCriteria";
      if (!input[targetKey]) {
        input[targetKey] = [];
      }
      (input[targetKey] as Array<typeof group>).push(group);
    }
  }

  public applyToSavedCriterion(input: Record<string, unknown>): void {
    // Preserve full performer objects with labels for restoration
    input[this.criterionOption.type] = {
      tag_ids: this.value.tag_ids.map((t) => ({
        id: t.id,
        label: t.label,
      })),
      include_subtags: this.value.include_subtags,
      require_overlap: this.value.require_overlap,
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
        rating_criteria: up.rating_criteria,
      })),
      groups: this.getGroups().map((g) => ({
        groupId: g.groupId,
        tag_ids: g.tag_ids.map((t) => ({ id: t.id, label: t.label })),
        include_subtags: g.include_subtags,
        require_overlap: g.require_overlap,
        performer_mode: g.performer_mode,
        top_performer_ids: g.top_performer_ids.map((p) => ({
          id: p.id,
          label: p.label,
        })),
        bottom_performer_ids: g.bottom_performer_ids.map((p) => ({
          id: p.id,
          label: p.label,
        })),
      })),
      modifier: this.modifier,
    };
  }

  public setFromSavedCriterion(savedCriterion: Record<string, unknown>): void {
    // savedCriterion is already the criterion data, not a wrapper object
    const data = savedCriterion as {
      tag_ids?: Array<{ id: string; label: string }>;
      include_subtags?: boolean;
      require_overlap?: boolean;
      performer_mode?: "AND" | "OR";
      top_performer_ids?: Array<{ id: string; label: string }>;
      bottom_performer_ids?: Array<{ id: string; label: string }>;
      unnamed_performers?: IUnnamedPerformer[];
      groups?: Array<{
        groupId: string;
        tag_ids: Array<{ id: string; label: string }>;
        include_subtags?: boolean;
        require_overlap?: boolean;
        performer_mode?: "AND" | "OR";
        top_performer_ids?: Array<{ id: string; label: string }>;
        bottom_performer_ids?: Array<{ id: string; label: string }>;
      }>;
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
    if (data.require_overlap !== undefined)
      this.value.require_overlap = data.require_overlap;
    if (data.performer_mode) this.value.performer_mode = data.performer_mode;
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
      this.value.unnamed_performers = data.unnamed_performers.map(
        cloneUnnamedPerformer
      );
    }
    if (data.groups) {
      this.value.groups = data.groups.map((g) => ({
        ...createEmptyMarkerGroup(g.groupId),
        tag_ids: g.tag_ids.map((t) => ({ id: t.id, label: t.label })),
        include_subtags: g.include_subtags ?? false,
        require_overlap: g.require_overlap ?? false,
        performer_mode: g.performer_mode ?? "OR",
        top_performer_ids: (g.top_performer_ids ?? []).map((p) => ({
          id: p.id,
          label: p.label,
        })),
        bottom_performer_ids: (g.bottom_performer_ids ?? []).map((p) => ({
          id: p.id,
          label: p.label,
        })),
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
