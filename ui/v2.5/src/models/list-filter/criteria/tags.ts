import { CriterionModifier } from "src/core/generated-graphql";
import {
  ModifierCriterionOption,
  IHierarchicalLabeledIdCriterion,
  Criterion,
  CriterionOption,
} from "./criterion";
import { IntlShape } from "react-intl";
import { CriterionType } from "../types";

const defaultModifierOptions = [
  CriterionModifier.IncludesAll,
  CriterionModifier.Includes,
  CriterionModifier.Equals,
  CriterionModifier.IsNull,
  CriterionModifier.NotNull,
];

const withoutEqualsModifierOptions = [
  CriterionModifier.IncludesAll,
  CriterionModifier.Includes,
  CriterionModifier.IsNull,
  CriterionModifier.NotNull,
];

const defaultModifier = CriterionModifier.IncludesAll;
const inputType = "tags";

class BaseTagsCriterionOption extends ModifierCriterionOption {
  constructor(
    messageID: string,
    type: CriterionType,
    modifierOptions: CriterionModifier[]
  ) {
    super({
      messageID,
      type,
      modifierOptions,
      defaultModifier,
      inputType,
      makeCriterion: () => new TagsCriterion(this),
    });
  }
}

export const TagsCriterionOption = new BaseTagsCriterionOption(
  "tags",
  "tags",
  defaultModifierOptions
);

export const SceneTagsCriterionOption = new BaseTagsCriterionOption(
  "scene_tags",
  "scene_tags",
  defaultModifierOptions
);

export const PerformerTagsCriterionOption = new BaseTagsCriterionOption(
  "performer_tags",
  "performer_tags",
  withoutEqualsModifierOptions
);

export const PerformerSceneTagsCriterionOption = new BaseTagsCriterionOption(
  "performer_scene_tags",
  "performer_scene_tags",
  withoutEqualsModifierOptions
);

// Criterion option for the compact performer+tag pair input
export const PerformerSceneTagPairCriterionOption = new CriterionOption({
  messageID: "performer_scene_tag_pair",
  type: "performer_scene_tag_pair",
  hidden: true,
  makeCriterion: () => new PerformerSceneTagsPairCriterion("", ""),
});

export const SceneMarkerTagsCriterionOption = new BaseTagsCriterionOption(
  "scene_marker_tags",
  "scene_marker_tags",
  withoutEqualsModifierOptions
);

// TODO - this requires using a nested studios_filter which needs to be added separately
// export const StudioTagsCriterionOption = new BaseTagsCriterionOption(
//   "studio_tags",
//   "studio_tags",
//   withoutEqualsModifierOptions
// );

export const ParentTagsCriterionOption = new BaseTagsCriterionOption(
  "parent_tags",
  "parents",
  withoutEqualsModifierOptions
);

export const ChildTagsCriterionOption = new BaseTagsCriterionOption(
  "sub_tags",
  "children",
  withoutEqualsModifierOptions
);

export class TagsCriterion extends IHierarchicalLabeledIdCriterion {}

// Top-level variant for the Performers page: applies performer_scene_tags directly on performer filter
class PerformerSceneTagsInPerformerFilterCriterion extends TagsCriterion {
  public applyToCriterionInput(input: Record<string, unknown>): void {
    input["performer_scene_tags"] = this.toCriterionInput();
  }
}

// Criterion option exposed on /performers, using the same label as /scenes
class PerformerSceneTagsInPerformerFilterOptionCls extends ModifierCriterionOption {
  constructor() {
    super({
      messageID: "performer_scene_tags",
      type: "performer_scene_tags",
      inputType: "tags",
      modifierOptions: withoutEqualsModifierOptions,
      defaultModifier,
      makeCriterion: () => new PerformerSceneTagsInPerformerFilterCriterion(this),
    });
  }
}

export const PerformerSceneTagsInPerformerFilterOption =
  new PerformerSceneTagsInPerformerFilterOptionCls();

// A lightweight criterion used to encode a performer+tag pair for the
// performer_scene_tags criterion. This emits a value object of the form
// { performerId, tagId } which the backend can interpret to filter scenes
// by the performer/tag combination without requiring a separate performers
// criterion.
export class PerformerSceneTagsPairCriterion extends Criterion {
  private _performerId: string;
  private _tagId: string;

  constructor(performerId: string, tagId: string) {
    super(PerformerSceneTagPairCriterionOption);
    this._performerId = performerId;
    this._tagId = tagId;
  }

  public getLabel(_intl: IntlShape): string {
    return "";
  }

  public toQueryParams(): Record<string, unknown> {
    return {
      type: this.criterionOption.type,
      modifier: CriterionModifier.IncludesAll,
      value: { performer_id: this._performerId, tag_id: this._tagId },
    };
  }

  public fromDecodedParams(i: Record<string, unknown>): void {
    try {
      const v = (i as any).value || i;
      this._performerId = v.performer_id ?? v.performerId ?? this._performerId;
      this._tagId = v.tag_id ?? v.tagId ?? this._tagId;
    } catch (e) {
      // ignore
    }
  }

  public applyToCriterionInput(input: Record<string, unknown>): void {
    input[this.criterionOption.type] = {
      performer_id: this._performerId,
      tag_id: this._tagId,
    };
  }

  public applyToSavedCriterion(input: Record<string, unknown>): void {
    input[this.criterionOption.type] = {
      value: { performer_id: this._performerId, tag_id: this._tagId },
      modifier: CriterionModifier.IncludesAll,
    };
  }

  public setFromSavedCriterion(criterion: unknown): void {
    this.fromDecodedParams(criterion as Record<string, unknown>);
  }
}

