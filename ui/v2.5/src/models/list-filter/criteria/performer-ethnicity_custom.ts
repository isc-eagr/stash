import { CriterionModifier } from "src/core/generated-graphql";
import { EthnicityCriterion } from "./ethnicity";
import { ModifierCriterionOption } from "./criterion";

// CUSTOM: Database-backed ethnicity criterion used by the performer list.
export const PerformerListEthnicityCriterionOption =
  new ModifierCriterionOption({
    messageID: "ethnicity",
    type: "ethnicity",
    modifierOptions: [
      CriterionModifier.Equals,
      CriterionModifier.NotEquals,
      CriterionModifier.Includes,
      CriterionModifier.Excludes,
      CriterionModifier.IsNull,
      CriterionModifier.NotNull,
    ],
    defaultModifier: CriterionModifier.Equals,
    inputType: "text",
    makeCriterion: (option) =>
      new EthnicityCriterion(option as unknown as ModifierCriterionOption),
  });
