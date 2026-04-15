import { CriterionModifier } from "src/core/generated-graphql";
import {
  ModifierCriterionOption,
  NumberCriterion,
} from "src/models/list-filter/criteria/criterion";

export const ProfileImageCountCriterionOption: ModifierCriterionOption = new ModifierCriterionOption({
  messageID: "profile_image_count",
  type: "profile_image_count",
  modifierOptions: [
    CriterionModifier.Equals,
    CriterionModifier.NotEquals,
    CriterionModifier.GreaterThan,
    CriterionModifier.GreaterThanEquals,
    CriterionModifier.LessThan,
    CriterionModifier.LessThanEquals,
  ],
  defaultModifier: CriterionModifier.GreaterThan,
  inputType: "number",
  makeCriterion: () => new NumberCriterion(ProfileImageCountCriterionOption),
});
