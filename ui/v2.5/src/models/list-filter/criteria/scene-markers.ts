import { CriterionModifier } from "src/core/generated-graphql";
import { Criterion, CriterionOption } from "./criterion";
import { ILabeledId, CriterionType } from "../types";
import { IntlShape } from "react-intl";
import { RatingCriterion } from "./tags";

// Generate a simple alphanumeric group ID (A, B, C, ...)
let groupIdCounter = 0;
export function generateSceneMarkersGroupId(): string {
  const id = String.fromCharCode(65 + (groupIdCounter % 26)); // A-Z
  groupIdCounter++;
  return id;
}

export function resetSceneMarkersGroupIdCounter(): void {
  groupIdCounter = 0;
}

/**
 * A single marker configuration within the criterion.
 * Each group represents one marker pattern to find in a scene.
 */
export interface ISceneMarkersGroup {
  groupId: string;
  // Tags
  tag_ids: ILabeledId[];
  depth: number; // 0 = no sub-tags, -1 = all sub-tags
  // Top performer criteria
  top_performer_ids: ILabeledId[];
  top_any_count: number; // Minimum number of ANY top performers required
  top_ethnicities: string[];
  top_countries: string[];
  top_rating: RatingCriterion;
  // Bottom performer criteria
  bottom_performer_ids: ILabeledId[];
  bottom_any_count: number; // Minimum number of ANY bottom performers required
  bottom_ethnicities: string[];
  bottom_countries: string[];
  bottom_rating: RatingCriterion;
}

/**
 * The value for SceneMarkersCriterion - contains multiple marker groups.
 */
export interface ISceneMarkersValue {
  groups: ISceneMarkersGroup[];
}

// Default empty group
function createEmptyGroup(groupId: string): ISceneMarkersGroup {
  return {
    groupId,
    tag_ids: [],
    depth: 0,
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

const modifierOptions = [
  CriterionModifier.IncludesAll,
  CriterionModifier.Includes,
];

const defaultModifier = CriterionModifier.IncludesAll;

/**
 * SceneMarkersCriterion - A criterion for filtering scenes by their markers.
 * Supports multiple marker groups, each with tags and top/bottom performer criteria.
 * The modifier controls performer mode: INCLUDES_ALL = AND, INCLUDES = OR
 */
export class SceneMarkersCriterion extends Criterion {
  public modifier: CriterionModifier = defaultModifier;
  public value: ISceneMarkersValue = {
    groups: [],
  };

  constructor(option?: CriterionOption) {
    super(option ?? SceneMarkersCriterionOption);
  }

  protected cloneValues() {
    this.value = {
      groups: this.value.groups.map((g) => ({
        groupId: g.groupId,
        tag_ids: g.tag_ids.map((t) => ({ ...t })),
        depth: g.depth,
        top_performer_ids: g.top_performer_ids.map((p) => ({ ...p })),
        top_any_count: g.top_any_count,
        top_ethnicities: [...g.top_ethnicities],
        top_countries: [...g.top_countries],
        top_rating: g.top_rating ? { ...g.top_rating } : null,
        bottom_performer_ids: g.bottom_performer_ids.map((p) => ({ ...p })),
        bottom_any_count: g.bottom_any_count,
        bottom_ethnicities: [...g.bottom_ethnicities],
        bottom_countries: [...g.bottom_countries],
        bottom_rating: g.bottom_rating ? { ...g.bottom_rating } : null,
      })),
    };
  }

  public getId(): string {
    return this.criterionOption.type;
  }

  /**
   * Add a new group and return its ID.
   */
  public addGroup(): string {
    const groupId = generateSceneMarkersGroupId();
    this.value.groups.push(createEmptyGroup(groupId));
    return groupId;
  }

  /**
   * Remove a group by its ID.
   */
  public removeGroup(groupId: string): void {
    this.value.groups = this.value.groups.filter((g) => g.groupId !== groupId);
  }

  /**
   * Get a group by its ID.
   */
  public getGroup(groupId: string): ISceneMarkersGroup | undefined {
    return this.value.groups.find((g) => g.groupId === groupId);
  }

  /**
   * Update a group's properties.
   */
  public updateGroup(
    groupId: string,
    updates: Partial<Omit<ISceneMarkersGroup, "groupId">>
  ): void {
    const group = this.getGroup(groupId);
    if (group) {
      Object.assign(group, updates);
    }
  }

  public getLabel(intl: IntlShape): string {
    const criterion = intl.formatMessage({
      id: this.criterionOption.messageID,
    });

    if (this.value.groups.length === 0) {
      return `${criterion}: ${intl.formatMessage({ id: "none" })}`;
    }

    // Build a summary of groups
    const groupLabels = this.value.groups.map((g) => {
      const parts: string[] = [];
      if (g.tag_ids.length > 0) {
        parts.push(g.tag_ids.map((t) => t.label).join(", "));
      }
      if (g.top_performer_ids.length > 0 || g.top_any_count > 0 || g.top_ethnicities.length > 0) {
        parts.push("Top: ...");
      }
      if (g.bottom_performer_ids.length > 0 || g.bottom_any_count > 0 || g.bottom_ethnicities.length > 0) {
        parts.push("Bottom: ...");
      }
      return `${g.groupId}: ${parts.join(" + ") || "..."}`;
    });

    const modeLabel =
      this.modifier === CriterionModifier.IncludesAll ? "AND" : "OR";
    return `${criterion} (${modeLabel}): ${groupLabels.join(" | ")}`;
  }

  public isValid(): boolean {
    // Need at least one group with some criteria
    return this.value.groups.some(
      (g) =>
        g.tag_ids.length > 0 ||
        g.top_performer_ids.length > 0 ||
        g.top_any_count > 0 ||
        g.top_ethnicities.length > 0 ||
        g.top_countries.length > 0 ||
        g.top_rating !== null ||
        g.bottom_performer_ids.length > 0 ||
        g.bottom_any_count > 0 ||
        g.bottom_ethnicities.length > 0 ||
        g.bottom_countries.length > 0 ||
        g.bottom_rating !== null
    );
  }

  public toQueryParams(): Record<string, unknown> {
    return {
      type: this.criterionOption.type,
      modifier: this.modifier,
      groups: this.value.groups.map((g) => ({
        groupId: g.groupId,
        tag_ids: g.tag_ids.map((t) => ({ id: t.id, label: t.label })),
        depth: g.depth,
        top_performer_ids: g.top_performer_ids.map((p) => ({
          id: p.id,
          label: p.label,
        })),
        top_any_count: g.top_any_count,
        top_ethnicities: g.top_ethnicities,
        top_countries: g.top_countries,
        top_rating: g.top_rating,
        bottom_performer_ids: g.bottom_performer_ids.map((p) => ({
          id: p.id,
          label: p.label,
        })),
        bottom_any_count: g.bottom_any_count,
        bottom_ethnicities: g.bottom_ethnicities,
        bottom_countries: g.bottom_countries,
        bottom_rating: g.bottom_rating,
      })),
    };
  }

  public fromDecodedParams(params: Record<string, unknown>): void {
    const raw = params as {
      modifier?: CriterionModifier;
      groups?: Array<{
        groupId: string;
        tag_ids: Array<{ id: string; label: string }>;
        depth: number;
        top_performer_ids: Array<{ id: string; label: string }>;
        top_any_count: number;
        top_ethnicities: string[];
        top_countries: string[];
        top_rating: RatingCriterion;
        bottom_performer_ids: Array<{ id: string; label: string }>;
        bottom_any_count: number;
        bottom_ethnicities: string[];
        bottom_countries: string[];
        bottom_rating: RatingCriterion;
      }>;
    };

    if (raw.modifier) this.modifier = raw.modifier;
    if (raw.groups) {
      this.value.groups = raw.groups.map((g) => ({
        groupId: g.groupId,
        tag_ids: g.tag_ids.map((t) => ({ id: t.id, label: t.label })),
        depth: g.depth,
        top_performer_ids: g.top_performer_ids.map((p) => ({
          id: p.id,
          label: p.label,
        })),
        top_any_count: g.top_any_count ?? 0,
        top_ethnicities: g.top_ethnicities,
        top_countries: g.top_countries,
        top_rating: g.top_rating,
        bottom_performer_ids: g.bottom_performer_ids.map((p) => ({
          id: p.id,
          label: p.label,
        })),
        bottom_any_count: g.bottom_any_count ?? 0,
        bottom_ethnicities: g.bottom_ethnicities,
        bottom_countries: g.bottom_countries,
        bottom_rating: g.bottom_rating,
      }));
      // Update counter to avoid ID collisions
      const maxChar = Math.max(
        ...this.value.groups.map((g) => g.groupId.charCodeAt(0)),
        64
      );
      groupIdCounter = maxChar - 64;
    }
  }

  public applyToCriterionInput(input: Record<string, unknown>): void {
    // Performer mode: INCLUDES = OR, INCLUDES_ALL = AND
    const performerMode =
      this.modifier === CriterionModifier.Includes ? "OR" : "AND";

    // Use EQUALS modifier for including matching markers
    const sceneMarkerTagsModifier = CriterionModifier.Equals;

    // Build groups_extended from our groups
    const groups_extended = this.value.groups.map((g) => {
      const group: Record<string, unknown> = {
        tag_ids: g.tag_ids.map((t) => t.id),
        performer_mode: performerMode,
      };

      // Depth
      if (g.depth !== 0) {
        group.depth = g.depth;
      }

      // Top performer attributes
      if (g.top_performer_ids.length > 0) {
        group.top_performer_ids = g.top_performer_ids.map((p) => p.id);
      }
      if (g.top_any_count > 0) {
        group.top_any_count = g.top_any_count;
      }
      if (g.top_ethnicities.length > 0) {
        group.top_ethnicities = g.top_ethnicities;
      }
      if (g.top_countries.length > 0) {
        group.top_countries = g.top_countries;
      }
      if (g.top_rating) {
        group.top_rating = g.top_rating;
      }

      // Bottom performer attributes
      if (g.bottom_performer_ids.length > 0) {
        group.bottom_performer_ids = g.bottom_performer_ids.map((p) => p.id);
      }
      if (g.bottom_any_count > 0) {
        group.bottom_any_count = g.bottom_any_count;
      }
      if (g.bottom_ethnicities.length > 0) {
        group.bottom_ethnicities = g.bottom_ethnicities;
      }
      if (g.bottom_countries.length > 0) {
        group.bottom_countries = g.bottom_countries;
      }
      if (g.bottom_rating) {
        group.bottom_rating = g.bottom_rating;
      }

      return group;
    });

    // Store in temporary key for later aggregation
    if (!input._sceneMarkerIncludeCriteria) {
      input._sceneMarkerIncludeCriteria = [];
    }
    (input._sceneMarkerIncludeCriteria as typeof groups_extended).push(
      ...groups_extended
    );
  }

  public applyToSavedCriterion(input: Record<string, unknown>): void {
    input[this.criterionOption.type] = {
      modifier: this.modifier,
      groups: this.value.groups.map((g) => ({
        groupId: g.groupId,
        tag_ids: g.tag_ids.map((t) => ({ id: t.id, label: t.label })),
        depth: g.depth,
        top_performer_ids: g.top_performer_ids.map((p) => ({
          id: p.id,
          label: p.label,
        })),
        top_any_count: g.top_any_count,
        top_ethnicities: g.top_ethnicities,
        top_countries: g.top_countries,
        top_rating: g.top_rating,
        bottom_performer_ids: g.bottom_performer_ids.map((p) => ({
          id: p.id,
          label: p.label,
        })),
        bottom_any_count: g.bottom_any_count,
        bottom_ethnicities: g.bottom_ethnicities,
        bottom_countries: g.bottom_countries,
        bottom_rating: g.bottom_rating,
      })),
    };
  }

  public setFromSavedCriterion(savedCriterion: Record<string, unknown>): void {
    const data = savedCriterion[this.criterionOption.type] as {
      modifier?: CriterionModifier;
      groups?: Array<{
        groupId: string;
        tag_ids: Array<{ id: string; label: string }>;
        depth: number;
        top_performer_ids: Array<{ id: string; label: string }>;
        top_any_count: number;
        top_ethnicities: string[];
        top_countries: string[];
        top_rating: RatingCriterion;
        bottom_performer_ids: Array<{ id: string; label: string }>;
        bottom_any_count: number;
        bottom_ethnicities: string[];
        bottom_countries: string[];
        bottom_rating: RatingCriterion;
      }>;
    };

    if (!data) return;

    if (data.modifier) this.modifier = data.modifier;
    if (data.groups) {
      this.value.groups = data.groups.map((g) => ({
        groupId: g.groupId,
        tag_ids: g.tag_ids.map((t) => ({ id: t.id, label: t.label })),
        depth: g.depth,
        top_performer_ids: g.top_performer_ids.map((p) => ({
          id: p.id,
          label: p.label,
        })),
        top_any_count: g.top_any_count ?? 0,
        top_ethnicities: g.top_ethnicities,
        top_countries: g.top_countries,
        top_rating: g.top_rating,
        bottom_performer_ids: g.bottom_performer_ids.map((p) => ({
          id: p.id,
          label: p.label,
        })),
        bottom_any_count: g.bottom_any_count ?? 0,
        bottom_ethnicities: g.bottom_ethnicities,
        bottom_countries: g.bottom_countries,
        bottom_rating: g.bottom_rating,
      }));
      // Update counter to avoid ID collisions
      const maxChar = Math.max(
        ...this.value.groups.map((g) => g.groupId.charCodeAt(0)),
        64
      );
      groupIdCounter = maxChar - 64;
    }
  }
}

export const SceneMarkersCriterionOption: CriterionOption = new CriterionOption(
  {
    messageID: "scene_markers",
    type: "scene_markers" as CriterionType,
    makeCriterion: () => new SceneMarkersCriterion(),
  }
);

// Export modifierOptions for use in CriterionEditor
export const sceneMarkersModifierOptions = modifierOptions;
