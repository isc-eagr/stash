import { CriterionModifier } from "src/core/generated-graphql";
import {
  readInsightEntityMatch,
  type InsightMatchEntity,
} from "src/utils/insightSceneLinks_custom";
import { ModifierCriterion, ModifierCriterionOption } from "./criterion";

export const InsightChipCriterionOption = new ModifierCriterionOption({
  type: "insight_chip",
  messageID: "insight_chip",
  hidden: true,
  modifierOptions: [CriterionModifier.Equals],
  makeCriterion: () => new InsightChipCriterion("scene"),
});

export const InsightPerformerCriterionOption = new ModifierCriterionOption({
  type: "insight_chip",
  messageID: "insight_chip",
  hidden: true,
  modifierOptions: [CriterionModifier.Equals],
  makeCriterion: () => new InsightChipCriterion("performer"),
});

export class InsightChipCriterion extends ModifierCriterion<string> {
  constructor(private readonly entity: InsightMatchEntity = "scene") {
    super(InsightChipCriterionOption, "");
  }
  getLabel() {
    const match = readInsightEntityMatch(this.value, this.entity);
    return match
      ? `Insight: ${match.label}`
      : "Insight match expired — reopen Insight Stats";
  }
  getLabelValue() {
    return this.getLabel();
  }
  applyToCriterionInput(input: Record<string, unknown>) {
    // Never fall back to an unfiltered library if a browser snapshot is missing.
    const field =
      this.entity === "scene" ? "insight_scene_ids" : "insight_performer_ids";
    input[field] = readInsightEntityMatch(this.value, this.entity)?.ids ?? [];
  }
}
