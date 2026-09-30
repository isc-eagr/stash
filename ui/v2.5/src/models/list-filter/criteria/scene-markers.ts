import { CriterionModifier } from "src/core/generated-graphql";
import { Criterion, CriterionOption } from "./criterion";
import { CriterionType } from "../types";
import { IntlShape } from "react-intl";
import { cloneUnnamedPerformer, IUnnamedPerformer } from "./unnamed-performer";
import {
  createSceneMarkerGroupCustom,
  decodeSceneMarkerGroupCustom,
  encodeMarkerUnnamedCustom,
  encodeSceneMarkerGroupCustom,
  ISceneMarkerGroupCustom,
  markerCriterionSentenceCustom,
  nextMarkerGroupIdCustom,
  nonEmptyMarkerGroupsCustom,
  sceneMarkerGroupInputCustom,
} from "./marker-group_custom";

/**
 * A single marker configuration within the criterion. Each configuration
 * must match its own marker in the scene.
 */
export type ISceneMarkersGroup = ISceneMarkerGroupCustom;

/**
 * The value for SceneMarkersCriterion - contains multiple marker groups.
 * Unnamed performers are defined at the top level and can be shared across groups.
 */
export interface ISceneMarkersValue {
  groups: ISceneMarkersGroup[];
  require_overlap: boolean;
  // Unnamed performers defined at criterion level, shareable across groups
  unnamed_performers: IUnnamedPerformer[];
}

type AutoExcludeOnMarkerRule = {
  matchTagIdSet: Set<string>;
  excludeTagIdsOnMarker: string[];
};

interface ISceneMarkersRaw {
  modifier?: CriterionModifier;
  groups?: Parameters<typeof decodeSceneMarkerGroupCustom>[0][];
  unnamed_performers?: IUnnamedPerformer[];
  require_overlap?: boolean;
}

// Simplified: Always use EQUALS modifier
const modifierOptions = [CriterionModifier.Equals];

const defaultModifier = CriterionModifier.Equals;

/**
 * SceneMarkersCriterion - A criterion for filtering scenes by their markers.
 * Supports multiple marker configurations, each with tags and vatos in
 * explicit roles.
 */
export class SceneMarkersCriterion extends Criterion {
  public modifier: CriterionModifier = defaultModifier;
  public value: ISceneMarkersValue = {
    groups: [],
    require_overlap: false,
    unnamed_performers: [],
  };

  constructor(option?: CriterionOption) {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    super(option ?? SceneMarkersCriterionOption);
  }

  protected cloneValues() {
    this.value = {
      groups: this.value.groups.map(encodeSceneMarkerGroupCustom),
      require_overlap: this.value.require_overlap,
      unnamed_performers: (this.value.unnamed_performers ?? []).map(
        cloneUnnamedPerformer
      ),
    };
  }

  public getId(): string {
    return this.criterionOption.type;
  }

  /**
   * Add a new group and return its ID.
   */
  public addGroup(): string {
    const groupId = nextMarkerGroupIdCustom(this.value.groups);
    this.value.groups.push(createSceneMarkerGroupCustom(groupId));
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

  private useOverlap() {
    return (
      this.value.require_overlap &&
      nonEmptyMarkerGroupsCustom(this.value.groups).length > 1
    );
  }

  public getLabel(intl: IntlShape): string {
    const criterion = intl.formatMessage({
      id: this.criterionOption.messageID,
    });
    const sentence = markerCriterionSentenceCustom(
      this.value.groups,
      this.value.unnamed_performers ?? [],
      this.useOverlap() ? "while" : "and"
    );
    return `${criterion}: ${sentence || intl.formatMessage({ id: "none" })}`;
  }

  public isValid(): boolean {
    return nonEmptyMarkerGroupsCustom(this.value.groups).length > 0;
  }

  private encode() {
    return {
      groups: this.value.groups.map(encodeSceneMarkerGroupCustom),
      require_overlap: this.value.require_overlap,
      // Unnamed performers at criterion level for sharing across groups
      unnamed_performers: encodeMarkerUnnamedCustom(
        this.value.unnamed_performers
      ),
    };
  }

  private decode(raw: ISceneMarkersRaw | undefined) {
    if (!raw) return;
    if (raw.modifier) this.modifier = raw.modifier;
    if (raw.groups) {
      this.value.groups = raw.groups.map(decodeSceneMarkerGroupCustom);
    }
    this.value.require_overlap = raw.require_overlap ?? false;
    if (raw.unnamed_performers) {
      this.value.unnamed_performers = raw.unnamed_performers.map(
        cloneUnnamedPerformer
      );
    }
  }

  public toQueryParams(): Record<string, unknown> {
    return {
      type: this.criterionOption.type,
      modifier: this.modifier,
      ...this.encode(),
    };
  }

  public fromDecodedParams(params: Record<string, unknown>): void {
    this.decode(params as ISceneMarkersRaw);
  }

  public applyToCriterionInput(input: Record<string, unknown>): void {
    const autoExcludeRule = (
      this as unknown as {
        __autoExcludeOnMarkerRule?: AutoExcludeOnMarkerRule;
      }
    ).__autoExcludeOnMarkerRule;
    const unnamed = this.value.unnamed_performers ?? [];

    const groups_extended = nonEmptyMarkerGroupsCustom(this.value.groups).map(
      (g) => {
        const group = sceneMarkerGroupInputCustom(g, unnamed);
        if (
          autoExcludeRule?.matchTagIdSet?.size &&
          autoExcludeRule.excludeTagIdsOnMarker?.length &&
          g.tag_ids.some((t) => autoExcludeRule.matchTagIdSet.has(t.id))
        ) {
          group.exclude_tag_ids_on_marker =
            autoExcludeRule.excludeTagIdsOnMarker;
        }
        return group;
      }
    );

    const targetKey = this.useOverlap()
      ? "_sceneMarkerOverlapCriteria"
      : "_sceneMarkerIncludeCriteria";
    if (!input[targetKey]) {
      input[targetKey] = [];
    }
    (input[targetKey] as typeof groups_extended).push(...groups_extended);
  }

  public applyToSavedCriterion(input: Record<string, unknown>): void {
    input[this.criterionOption.type] = {
      modifier: this.modifier,
      ...this.encode(),
    };
  }

  public setFromSavedCriterion(savedCriterion: Record<string, unknown>): void {
    this.decode(savedCriterion as ISceneMarkersRaw);
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
