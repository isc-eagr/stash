import { CriterionOption, ModifierCriterionOption } from "./criterion";
import { CriterionType } from "../types";
import {
  PerformerMarkersCriterionBase,
  performerMarkersDefaultModifier,
  performerMarkersModifierOptions,
} from "./performer-markers";

export const PerformerMarkersExcludeCriterionOption: ModifierCriterionOption =
  new ModifierCriterionOption({
    messageID: "performer_markers_exclude",
    type: "performer_markers_exclude" as CriterionType,
    modifierOptions: performerMarkersModifierOptions,
    defaultModifier: performerMarkersDefaultModifier,
    makeCriterion: () => new PerformerMarkersExcludeCriterion(),
  });

/**
 * PerformerMarkersExcludeCriterion - A criterion for filtering performers by excluding markers.
 */
export class PerformerMarkersExcludeCriterion extends PerformerMarkersCriterionBase {
  protected readonly inputKey = "exclude";

  constructor(option?: CriterionOption) {
    super(option ?? PerformerMarkersExcludeCriterionOption);
  }
}
