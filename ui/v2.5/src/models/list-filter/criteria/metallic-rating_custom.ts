import { CriterionModifier } from "src/core/generated-graphql";
import { ModifierCriterionOption, MultiStringCriterion } from "./criterion";

// CUSTOM: begin - metallic rating filter
export const metallicRatingIncludeNonMetallicValue = "__include_non_metallic__";

const metallicRatingOptions = [
  "bronze",
  "silver",
  "gold",
  "royal_sapphire",
  metallicRatingIncludeNonMetallicValue,
];

const modifierOptions = [
  CriterionModifier.Includes,
  CriterionModifier.Excludes,
];

export class MetallicRatingCriterion extends MultiStringCriterion {
  constructor(type: ModifierCriterionOption) {
    super(type);
  }

  protected getLabelValue() {
    return this.value
      .filter((value) => value !== metallicRatingIncludeNonMetallicValue)
      .map(formatMetallicRatingOptionLabel)
      .join(", ");
  }

  protected toCriterionInput() {
    const selectedTiers = this.value.filter(
      (value) => value !== metallicRatingIncludeNonMetallicValue
    );
    const includeNonMetallic =
      this.modifier === CriterionModifier.Excludes &&
      this.value.includes(metallicRatingIncludeNonMetallicValue);
    const value = includeNonMetallic
      ? [...selectedTiers, metallicRatingIncludeNonMetallicValue]
      : selectedTiers;

    return {
      value,
      modifier: this.modifier,
      excludes: includeNonMetallic
        ? [metallicRatingIncludeNonMetallicValue]
        : [],
    };
  }
}

export function formatMetallicRatingOptionLabel(value: string) {
  if (value === metallicRatingIncludeNonMetallicValue) {
    return "Exclude non-metallic cards";
  }
  if (value === "royal_sapphire") {
    return "Royal Sapphire";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

export const MetallicRatingCriterionOption = new ModifierCriterionOption({
  messageID: "metallic_rating",
  type: "metallic_rating",
  modifierOptions,
  defaultModifier: CriterionModifier.Includes,
  inputType: "text",
  options: metallicRatingOptions,
  makeCriterion: (option) =>
    new MetallicRatingCriterion(option as ModifierCriterionOption),
});
// CUSTOM: end
