import { CriterionModifier } from "src/core/generated-graphql";
import {
  ModifierCriterionOption,
  NumberCriterion,
} from "src/models/list-filter/criteria/criterion";

export const ProfileImageCountCriterionOption = new ModifierCriterionOption({
  messageID: "profile_image_count",
  type: "profile_image_count",
  modifierOptions: [
    CriterionModifier.Equals,
    CriterionModifier.GreaterThanEquals,
    CriterionModifier.LessThanEquals,
  ],
  defaultModifier: CriterionModifier.Equals,
  inputType: "number",
  makeCriterion: () => new NumberCriterion(ProfileImageCountCriterionOption),
});
