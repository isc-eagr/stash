import { CriterionModifier } from "src/core/generated-graphql";
import { Criterion, CriterionOption } from "./criterion";
import { ILabeledId } from "../types";
import { IntlShape } from "react-intl";
import { cloneUnnamedPerformer, IUnnamedPerformer } from "./unnamed-performer";
import {
  copyLabeledIdsCustom,
  markerCriterionSentenceCustom,
  markerGroupRoleInputCustom,
  nextMarkerGroupIdCustom,
  nonEmptyMarkerGroupsCustom,
  normalizeMarkerGroupRolesCustom,
} from "./marker-group_custom";

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
  either_performer_ids: ILabeledId[];
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
    either_performer_ids: [],
  };
}

type MarkerPerformersGroupRawCustom = {
  groupId: string;
  tag_ids: Array<{ id: string; label: string }>;
  include_subtags?: boolean;
  require_overlap?: boolean;
  performer_mode?: "AND" | "OR";
  top_performer_ids?: Array<{ id: string; label: string }>;
  bottom_performer_ids?: Array<{ id: string; label: string }>;
  either_performer_ids?: Array<{ id: string; label: string }>;
};

function decodeMarkerGroupCustom(
  g: MarkerPerformersGroupRawCustom
): IMarkerPerformersGroup {
  return normalizeMarkerGroupRolesCustom({
    ...createEmptyMarkerGroup(g.groupId),
    tag_ids: copyLabeledIdsCustom(g.tag_ids),
    include_subtags: g.include_subtags ?? false,
    require_overlap: g.require_overlap ?? false,
    // Groups saved before explicit roles defaulted to OR.
    performer_mode: g.performer_mode ?? "OR",
    top_performer_ids: copyLabeledIdsCustom(g.top_performer_ids),
    bottom_performer_ids: copyLabeledIdsCustom(g.bottom_performer_ids),
    either_performer_ids: copyLabeledIdsCustom(g.either_performer_ids),
  });
}

function encodeMarkerGroupCustom(g: IMarkerPerformersGroup) {
  return {
    groupId: g.groupId,
    tag_ids: copyLabeledIdsCustom(g.tag_ids),
    include_subtags: g.include_subtags,
    require_overlap: g.require_overlap,
    performer_mode: g.performer_mode,
    top_performer_ids: copyLabeledIdsCustom(g.top_performer_ids),
    bottom_performer_ids: copyLabeledIdsCustom(g.bottom_performer_ids),
    either_performer_ids: copyLabeledIdsCustom(g.either_performer_ids),
  };
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
        either_performer_ids: copyLabeledIdsCustom(g.either_performer_ids),
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
        either_performer_ids: [],
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
    const groupId = nextMarkerGroupIdCustom(this.value.groups ?? []);
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
      this.value.groups = [createEmptyMarkerGroup("1")];
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
    const sentence = markerCriterionSentenceCustom(
      this.getGroups(),
      this.value.unnamed_performers ?? [],
      "while"
    );
    return `${criterion}: ${sentence || "..."}`;
  }

  public isValid(): boolean {
    return nonEmptyMarkerGroupsCustom(this.getGroups()).length > 0;
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
      groups: groups.map(encodeMarkerGroupCustom),
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
      groups?: MarkerPerformersGroupRawCustom[];
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
      this.value.groups = raw.groups.map(decodeMarkerGroupCustom);
    }
  }

  public applyToCriterionInput(input: Record<string, unknown>): void {
    // Tags must all be on the marker (sub-tags when include_subtags is set);
    // vatos follow their roles. Several configurations must overlap.
    const unnamed = this.value.unnamed_performers ?? [];
    const markerGroups = nonEmptyMarkerGroupsCustom(this.getGroups());
    const targetKey =
      markerGroups.length > 1
        ? "_sceneMarkerOverlapCriteria"
        : "_sceneMarkerIncludeCriteria";
    for (const markerGroup of markerGroups) {
      const group: Record<string, unknown> = {
        tag_ids: markerGroup.tag_ids.map((t) => t.id),
        ...markerGroupRoleInputCustom(markerGroup, unnamed),
      };
      if (markerGroup.include_subtags) {
        group.depth = -1;
      }
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
      groups: this.getGroups().map(encodeMarkerGroupCustom),
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
      groups?: MarkerPerformersGroupRawCustom[];
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
      this.value.groups = data.groups.map(decodeMarkerGroupCustom);
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
