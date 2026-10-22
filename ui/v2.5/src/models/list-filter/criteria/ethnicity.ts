import { StringCriterion, ModifierCriterionOption } from "./criterion";
import { CriterionModifier } from "src/core/generated-graphql";

// Selector tokens the performer filter resolves on the server. Exact turns off
// the search-only Black/White/Latino expansion for report drilldowns.
export const ethnicityExactValue = "__exact__";
export const ethnicityTokenLabels: Record<string, string> = {
  __unknown__: "Unknown",
  [ethnicityExactValue]: "Exact match",
};

export class EthnicityCriterion extends StringCriterion {
  protected getLabelValue() {
    return this.value
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => ethnicityTokenLabels[value] ?? value)
      .join(", ");
  }
}

export const EthnicityCriterionOption: ModifierCriterionOption =
  new ModifierCriterionOption({
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
    makeCriterion: (o) =>
      new EthnicityCriterion(o as unknown as ModifierCriterionOption),
  });
