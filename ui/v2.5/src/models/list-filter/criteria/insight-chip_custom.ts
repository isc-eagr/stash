import { CriterionModifier } from "src/core/generated-graphql";
import { readInsightSceneMatch } from "src/utils/insightSceneLinks_custom";
import { ModifierCriterion, ModifierCriterionOption } from "./criterion";

export const InsightChipCriterionOption = new ModifierCriterionOption({
  type: "insight_chip",
  messageID: "insight_chip",
  hidden: true,
  modifierOptions: [CriterionModifier.Equals],
  makeCriterion: () => new InsightChipCriterion(),
});

export class InsightChipCriterion extends ModifierCriterion<string> {
  constructor() {
    super(InsightChipCriterionOption, "");
  }
  getLabel() {
    const match = readInsightSceneMatch(this.value);
    return match
      ? `Chip: ${match.label}`
      : "Chip expired — reopen Insight Stats";
  }
  getLabelValue() {
    return this.getLabel();
  }
  applyToCriterionInput(input: Record<string, unknown>) {
    // Never fall back to an unfiltered library if a browser snapshot is missing.
    input.insight_scene_ids = readInsightSceneMatch(this.value)?.ids ?? [];
  }
}
