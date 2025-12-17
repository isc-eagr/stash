import { StringCriterion, ModifierCriterionOption } from "./criterion";
import { CriterionModifier } from "src/core/generated-graphql";

export class EthnicityCriterion extends StringCriterion {}

export const EthnicityCriterionOption: ModifierCriterionOption = new ModifierCriterionOption({
  messageID: "performer_ethnicity",
  type: "performer_ethnicity",
  modifierOptions: [
    CriterionModifier.Equals,
    CriterionModifier.NotEquals,
    CriterionModifier.Includes,
    CriterionModifier.IncludesAll,
  ],
  defaultModifier: CriterionModifier.Equals,
  inputType: "text",
  makeCriterion: (o) => new EthnicityCriterion(o as unknown as ModifierCriterionOption),
});
