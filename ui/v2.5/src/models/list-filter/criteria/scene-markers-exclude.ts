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
 * A single marker configuration within the criterion.
 * Each group represents one marker pattern to exclude in a scene.
 */
export type ISceneMarkersExcludeGroup = ISceneMarkerGroupCustom;

/**
 * The value for SceneMarkersExcludeCriterion - contains multiple marker groups.
 * Unnamed performers are defined at the top level and can be shared across groups.
 */
export interface ISceneMarkersExcludeValue {
  groups: ISceneMarkersExcludeGroup[];
  // Unnamed performers defined at criterion level, shareable across groups
  unnamed_performers: IUnnamedPerformer[];
}

interface ISceneMarkersExcludeRaw {
  modifier?: CriterionModifier;
  groups?: Parameters<typeof decodeSceneMarkerGroupCustom>[0][];
  unnamed_performers?: IUnnamedPerformer[];
}

// Simplified: Always use EQUALS modifier
const modifierOptions = [CriterionModifier.Equals];

const defaultModifier = CriterionModifier.Equals;

/**
 * SceneMarkersExcludeCriterion - A criterion for filtering scenes by excluding
 * markers. A scene is hidden when any configuration matches one of its markers.
 */
export class SceneMarkersExcludeCriterion extends Criterion {
  public modifier: CriterionModifier = defaultModifier;
  public value: ISceneMarkersExcludeValue = {
    groups: [],
    unnamed_performers: [],
  };

  constructor(option?: CriterionOption) {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    super(option ?? SceneMarkersExcludeCriterionOption);
  }

  protected cloneValues() {
    this.value = {
      groups: this.value.groups.map(encodeSceneMarkerGroupCustom),
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
    const sentence = markerCriterionSentenceCustom(
      this.value.groups,
      this.value.unnamed_performers ?? [],
      "or"
    );
    return `${criterion}: ${sentence || intl.formatMessage({ id: "none" })}`;
  }

  public isValid(): boolean {
    return nonEmptyMarkerGroupsCustom(this.value.groups).length > 0;
  }

  private encode() {
    return {
      groups: this.value.groups.map(encodeSceneMarkerGroupCustom),
      unnamed_performers: encodeMarkerUnnamedCustom(
        this.value.unnamed_performers
      ),
    };
  }

  private decode(raw: ISceneMarkersExcludeRaw | undefined) {
    if (!raw) return;
    if (raw.modifier) this.modifier = raw.modifier;
    if (raw.groups) {
      this.value.groups = raw.groups.map(decodeSceneMarkerGroupCustom);
    }
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
    this.decode(params as ISceneMarkersExcludeRaw);
  }

  public applyToCriterionInput(input: Record<string, unknown>): void {
    const unnamed = this.value.unnamed_performers ?? [];
    const groups_extended = nonEmptyMarkerGroupsCustom(this.value.groups).map(
      (g) => sceneMarkerGroupInputCustom(g, unnamed)
    );

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
      ...this.encode(),
    };
  }

  public setFromSavedCriterion(savedCriterion: Record<string, unknown>): void {
    this.decode(savedCriterion as ISceneMarkersExcludeRaw);
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
