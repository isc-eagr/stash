import { CriterionModifier } from "src/core/generated-graphql";
import { Criterion, CriterionOption } from "./criterion";
import { ILabeledId, CriterionType } from "../types";
import { IntlShape } from "react-intl";
import { RatingCriterion } from "./tags";
import { IUnnamedPerformer, isUnnamedPerformerId } from "./unnamed-performer";

// Generate a simple alphanumeric group ID (A, B, C, ...)
let groupIdCounter = 0;
export function generateSceneMarkersExcludeGroupId(): string {
  const id = String.fromCharCode(65 + (groupIdCounter % 26)); // A-Z
  groupIdCounter++;
  return id;
}

export function resetSceneMarkersExcludeGroupIdCounter(): void {
  groupIdCounter = 0;
}

/**
 * A single marker configuration within the criterion.
 * Each group represents one marker pattern to exclude in a scene.
 */
export interface ISceneMarkersExcludeGroup {
  groupId: string;
  // Tags
  tag_ids: ILabeledId[];
  depth: number; // 0 = no sub-tags, -1 = all sub-tags
  // Top performer criteria (can include unnamed performer IDs)
  top_performer_ids: ILabeledId[];
  // Bottom performer criteria (can include unnamed performer IDs)
  bottom_performer_ids: ILabeledId[];
}

/**
 * The value for SceneMarkersExcludeCriterion - contains multiple marker groups.
 * Unnamed performers are defined at the top level and can be shared across groups.
 */
export interface ISceneMarkersExcludeValue {
  groups: ISceneMarkersExcludeGroup[];
  // Unnamed performers defined at criterion level, shareable across groups
  unnamed_performers: IUnnamedPerformer[];
}

// Default empty group
function createEmptyGroup(groupId: string): ISceneMarkersExcludeGroup {
  return {
    groupId,
    tag_ids: [],
    depth: 0,
    top_performer_ids: [],
    bottom_performer_ids: [],
  };
}

const modifierOptions = [
  CriterionModifier.IncludesAll,
  CriterionModifier.Includes,
];

const defaultModifier = CriterionModifier.IncludesAll;

/**
 * SceneMarkersExcludeCriterion - A criterion for filtering scenes by excluding markers.
 * Supports multiple marker groups, each with tags and top/bottom performer criteria.
 * The modifier controls performer mode: INCLUDES_ALL = AND, INCLUDES = OR
 */
export class SceneMarkersExcludeCriterion extends Criterion {
  public modifier: CriterionModifier = defaultModifier;
  public value: ISceneMarkersExcludeValue = {
    groups: [],
    unnamed_performers: [],
  };

  constructor(option?: CriterionOption) {
    super(option ?? SceneMarkersExcludeCriterionOption);
  }

  protected cloneValues() {
    this.value = {
      groups: this.value.groups.map((g) => ({
        groupId: g.groupId,
        tag_ids: g.tag_ids.map((t) => ({ ...t })),
        depth: g.depth,
        top_performer_ids: g.top_performer_ids.map((p) => ({ ...p })),
        bottom_performer_ids: g.bottom_performer_ids.map((p) => ({ ...p })),
      })),
      unnamed_performers: (this.value.unnamed_performers ?? []).map((up) => ({
        ...up,
        ethnicities: [...up.ethnicities],
        countries: [...up.countries],
        rating: up.rating ? { ...up.rating } : null,
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
    const groupId = generateSceneMarkersExcludeGroupId();
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
  public getGroup(groupId: string): ISceneMarkersExcludeGroup | undefined {
    return this.value.groups.find((g) => g.groupId === groupId);
  }

  /**
   * Update a group's properties.
   */
  public updateGroup(
    groupId: string,
    updates: Partial<Omit<ISceneMarkersExcludeGroup, "groupId">>
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
      if (g.top_performer_ids.length > 0) {
        parts.push("Top: ...");
      }
      if (g.bottom_performer_ids.length > 0) {
        parts.push("Bottom: ...");
      }
      return `${g.groupId}: ${parts.join(" + ") || "..."}`;
    });

    const modeLabel =
      this.modifier === CriterionModifier.IncludesAll ? "AND" : "OR";
    return `${criterion} (${modeLabel}): ${groupLabels.join(" | ")}`;
  }

  public isValid(): boolean {
    // Need at least one group with some criteria, or unnamed performers
    return (
      (this.value.unnamed_performers ?? []).length > 0 ||
      this.value.groups.some(
        (g) =>
          g.tag_ids.length > 0 ||
          g.top_performer_ids.length > 0 ||
          g.bottom_performer_ids.length > 0
      )
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
        bottom_performer_ids: g.bottom_performer_ids.map((p) => ({
          id: p.id,
          label: p.label,
        })),
      })),
      // Unnamed performers at criterion level for sharing across groups
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
      groups?: Array<{
        groupId: string;
        tag_ids: Array<{ id: string; label: string }>;
        depth: number;
        top_performer_ids: Array<{ id: string; label: string }>;
        bottom_performer_ids: Array<{ id: string; label: string }>;
      }>;
      unnamed_performers?: IUnnamedPerformer[];
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
        bottom_performer_ids: g.bottom_performer_ids.map((p) => ({
          id: p.id,
          label: p.label,
        })),
      }));
      // Update counter to avoid ID collisions
      const maxChar = Math.max(
        ...this.value.groups.map((grp) => grp.groupId.charCodeAt(0)),
        64
      );
      groupIdCounter = maxChar - 64;
    }
    // Load unnamed performers at criterion level
    if (raw.unnamed_performers) {
      this.value.unnamed_performers = raw.unnamed_performers.map((up) => ({
        ...up,
        ethnicities: [...up.ethnicities],
        countries: [...up.countries],
        rating: up.rating ? { ...up.rating } : null,
      }));
    }
  }

  public applyToCriterionInput(input: Record<string, unknown>): void {
    // Performer mode: INCLUDES = OR, INCLUDES_ALL = AND
    const performerMode =
      this.modifier === CriterionModifier.Includes ? "OR" : "AND";

    // Use NOT_EQUALS modifier for excluding matching markers
    const sceneMarkerTagsModifier = CriterionModifier.NotEquals;

    // Helper to get unnamed performer definition by ID
    const getUnnamedDef = (id: string) =>
      (this.value.unnamed_performers ?? []).find((up) => up.id === id);

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

      // Separate named and unnamed performers
      const topNamed = g.top_performer_ids.filter(
        (p) => !isUnnamedPerformerId(p.id)
      );
      const topUnnamed = g.top_performer_ids.filter((p) =>
        isUnnamedPerformerId(p.id)
      );
      const bottomNamed = g.bottom_performer_ids.filter(
        (p) => !isUnnamedPerformerId(p.id)
      );
      const bottomUnnamed = g.bottom_performer_ids.filter((p) =>
        isUnnamedPerformerId(p.id)
      );

      // Find NAMED performers that are in BOTH top and bottom (both_roles)
      // ONLY in AND mode - in OR mode, same performer in both means "top OR bottom"
      const bothRolesNamedIds = new Set<string>();
      if (performerMode === "AND") {
        for (const tp of topNamed) {
          if (bottomNamed.some((bp) => bp.id === tp.id)) {
            bothRolesNamedIds.add(tp.id);
          }
        }
      }

      // Find unnamed performers that are in BOTH top and bottom (both_roles)
      // ONLY in AND mode - in OR mode, same performer in both means "top OR bottom"
      const bothRolesUnnamedIds = new Set<string>();
      if (performerMode === "AND") {
        for (const tp of topUnnamed) {
          if (bottomUnnamed.some((bp) => bp.id === tp.id)) {
            bothRolesUnnamedIds.add(tp.id);
          }
        }
      }

      // Build unnamed performer criterion arrays
      // Include the unnamed performer ID so the backend can correlate
      // the same unnamed performer across different marker groups
      const topUnnamedPerformers: Array<{
        id: string;
        ethnicities?: string[];
        countries?: string[];
        rating?: RatingCriterion;
      }> = [];
      const bottomUnnamedPerformers: Array<{
        id: string;
        ethnicities?: string[];
        countries?: string[];
        rating?: RatingCriterion;
      }> = [];
      const bothRolesUnnamedPerformers: Array<{
        id: string;
        ethnicities?: string[];
        countries?: string[];
        rating?: RatingCriterion;
      }> = [];

      // Add both-roles unnamed performers
      for (const id of bothRolesUnnamedIds) {
        const def = getUnnamedDef(id);
        if (def) {
          bothRolesUnnamedPerformers.push({
            id: def.id,
            ethnicities:
              def.ethnicities.length > 0 ? def.ethnicities : undefined,
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
              ethnicities:
                def.ethnicities.length > 0 ? def.ethnicities : undefined,
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
              ethnicities:
                def.ethnicities.length > 0 ? def.ethnicities : undefined,
              countries: def.countries.length > 0 ? def.countries : undefined,
              rating: def.rating ?? undefined,
            });
          }
        }
      }

      // Named performer IDs - separate both_roles from individual top/bottom
      const topOnlyNamed = topNamed.filter((p) => !bothRolesNamedIds.has(p.id));
      const bottomOnlyNamed = bottomNamed.filter((p) => !bothRolesNamedIds.has(p.id));
      const bothRolesNamed = topNamed.filter((p) => bothRolesNamedIds.has(p.id));

      if (topOnlyNamed.length > 0) {
        group.top_performer_ids = topOnlyNamed.map((p) => p.id);
      }
      if (bottomOnlyNamed.length > 0) {
        group.bottom_performer_ids = bottomOnlyNamed.map((p) => p.id);
      }
      if (bothRolesNamed.length > 0) {
        group.both_roles_performer_ids = bothRolesNamed.map((p) => p.id);
      }

      // Unnamed performers
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
    });

    // Store in temporary key for later aggregation
    if (!input._sceneMarkerExcludeCriteria) {
      input._sceneMarkerExcludeCriteria = [];
    }
    // Also store the modifier for proper aggregation
    if (!input._sceneMarkerExcludeModifier) {
      input._sceneMarkerExcludeModifier = this.modifier;
    }
    (input._sceneMarkerExcludeCriteria as typeof groups_extended).push(
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
        bottom_performer_ids: g.bottom_performer_ids.map((p) => ({
          id: p.id,
          label: p.label,
        })),
      })),
      // Unnamed performers at criterion level
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

  public setFromSavedCriterion(savedCriterion: Record<string, unknown>): void {
    const data = savedCriterion[this.criterionOption.type] as {
      modifier?: CriterionModifier;
      groups?: Array<{
        groupId: string;
        tag_ids: Array<{ id: string; label: string }>;
        depth: number;
        top_performer_ids: Array<{ id: string; label: string }>;
        bottom_performer_ids: Array<{ id: string; label: string }>;
      }>;
      unnamed_performers?: IUnnamedPerformer[];
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
        bottom_performer_ids: g.bottom_performer_ids.map((p) => ({
          id: p.id,
          label: p.label,
        })),
      }));
      // Update counter to avoid ID collisions
      const maxChar = Math.max(
        ...this.value.groups.map((grp) => grp.groupId.charCodeAt(0)),
        64
      );
      groupIdCounter = maxChar - 64;
    }
    // Load unnamed performers at criterion level
    if (data.unnamed_performers) {
      this.value.unnamed_performers = data.unnamed_performers.map((up) => ({
        ...up,
        ethnicities: [...up.ethnicities],
        countries: [...up.countries],
        rating: up.rating ? { ...up.rating } : null,
      }));
    }
  }
}

export const SceneMarkersExcludeCriterionOption: CriterionOption =
  new CriterionOption({
    messageID: "scene_markers_exclude",
    type: "scene_markers_exclude" as CriterionType,
    makeCriterion: () => new SceneMarkersExcludeCriterion(),
  });

// Export modifierOptions for use in CriterionEditor
export const sceneMarkersExcludeModifierOptions = modifierOptions;
