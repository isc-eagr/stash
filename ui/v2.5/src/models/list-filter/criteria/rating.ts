import {
  convertFromRatingFormat,
  convertToRatingFormat,
  defaultRatingSystemOptions,
  RatingSystemOptions,
} from "src/utils/rating";
import {
  ConfigDataFragment,
  CriterionModifier,
  IntCriterionInput,
} from "src/core/generated-graphql";
import { INumberValue } from "../types";
import {
  encodeRangeValue,
  ModifierCriterion,
  ModifierCriterionOption,
} from "./criterion";

const modifierOptions = [
  CriterionModifier.Equals,
  CriterionModifier.NotEquals,
  CriterionModifier.GreaterThan,
  CriterionModifier.LessThan,
  CriterionModifier.Between,
  CriterionModifier.NotBetween,
  CriterionModifier.IsNull,
  CriterionModifier.NotNull,
];

function getRatingSystemOptions(config?: ConfigDataFragment) {
  return config?.ui.ratingSystemOptions ?? defaultRatingSystemOptions;
}

export const RatingCriterionOption = new ModifierCriterionOption({
  messageID: "rating",
  type: "rating100",
  modifierOptions,
  defaultModifier: CriterionModifier.Equals,
  makeCriterion: (o, config) =>
    new RatingCriterion(
      getRatingSystemOptions(config),
      o as unknown as ModifierCriterionOption
    ),
  inputType: "number",
});

export class RatingCriterion extends ModifierCriterion<INumberValue> {
  ratingSystem: RatingSystemOptions;
  option: ModifierCriterionOption;

  constructor(
    ratingSystem: RatingSystemOptions,
    optionOverride?: ModifierCriterionOption
  ) {
    const opt = optionOverride ?? RatingCriterionOption;
    super(opt, { value: 0, value2: undefined });
    this.ratingSystem = ratingSystem;
    this.option = opt;
  }

  public cloneValues() {
    this.value = { ...this.value };
  }

  public get value(): INumberValue {
    return this._value;
  }
  public set value(newValue: number | INumberValue) {
    // backwards compatibility - if this.value is a number, use that
    if (typeof newValue !== "object") {
      this._value = {
        value: convertFromRatingFormat(newValue, this.ratingSystem.type),
        value2: undefined,
      };
    } else {
      this._value = newValue;
    }
  }

  public toCriterionInput(): IntCriterionInput {
    return {
      modifier: this.modifier,
      value: this.value.value ?? 0,
      value2: this.value.value2,
    };
  }
  public setFromSavedCriterion(c: {
    modifier: CriterionModifier;
    value: number | INumberValue;
    value2?: number;
  }) {
    super.setFromSavedCriterion(c);
    // this.value = decodeRangeValue(c);
  }

  protected encodeValue(): unknown {
    return encodeRangeValue(this.modifier, this.value);
  }

  protected getLabelValue() {
    const { value, value2 } = this.value;
    if (
      this.modifier === CriterionModifier.Between ||
      this.modifier === CriterionModifier.NotBetween
    ) {
      return `${convertToRatingFormat(value, this.ratingSystem) ?? 0}, ${
        convertToRatingFormat(value2, this.ratingSystem) ?? 0
      }`;
    } else {
      return `${convertToRatingFormat(value, this.ratingSystem) ?? 0}`;
    }
  }
}

// Specialized criterion for performer rating with an extra 'all/any' toggle
export class PerformerRatingCriterion extends RatingCriterion {
  public matchAll = true;

  constructor(
    ratingSystem: RatingSystemOptions,
    optionOverride?: ModifierCriterionOption
  ) {
    super(ratingSystem, optionOverride);
    this.matchAll = true; // default: all performers must match
  }

  public applyToCriterionInput(input: Record<string, unknown>): void {
    // base implementation writes input["performer_rating"]
    input[this.criterionOption.type] = this.toCriterionInput();
    // extra scalar that the backend understands
    input.performer_rating_all = this.matchAll;
  }

  public applyToSavedCriterion(input: Record<string, unknown>): void {
    // store inline with the saved value
    input[this.criterionOption.type] = {
      ...this.toCriterionInput(),
      all: this.matchAll,
    };
  }

  public toQueryParams(): Record<string, unknown> {
    const base = super.toQueryParams() as Record<string, unknown>;
    return { ...base, all: this.matchAll };
  }

  public fromDecodedParams(i: Record<string, unknown>): void {
    super.fromDecodedParams(i);
    const { all } = i as { all?: unknown };
    if (typeof all === "boolean") this.matchAll = all;
  }

  public setFromSavedCriterion(c: {
    modifier: CriterionModifier;
    value: number | INumberValue;
    value2?: number;
    all?: boolean;
  }) {
    super.setFromSavedCriterion(c);
    if (typeof c.all === "boolean") {
      this.matchAll = c.all;
    }
  }
}

// A rating-style criterion option builder for performer_rating field
export const PerformerRatingCriterionOption = new ModifierCriterionOption({
  messageID: "performer_rating",
  type: "performer_rating",
  modifierOptions,
  defaultModifier: CriterionModifier.Equals,
  makeCriterion: (o, config) =>
    new PerformerRatingCriterion(
      getRatingSystemOptions(config),
      o as unknown as ModifierCriterionOption
    ),
  inputType: "number",
});
