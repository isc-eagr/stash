import { IntlShape } from "react-intl";
import { getCountryByISO } from "src/utils/country";
import {
  ModifierCriterionOption, // CUSTOM: added for optional constructor param
  StringCriterion,
  StringCriterionOption,
} from "./criterion";

export const CountryCriterionOption = new StringCriterionOption({
  messageID: "country",
  type: "country",
  makeCriterion: () => new CountryCriterion(),
});

export class CountryCriterion extends StringCriterion {
  constructor(option?: ModifierCriterionOption) { // CUSTOM: added optional param
    super(option ?? CountryCriterionOption);
  }

  // CUSTOM: begin - rewritten to support comma-separated multi-country values
  protected getLabelValue(intl: IntlShape) {
    const values = (this.value || "")
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
    if (values.length === 0) return "";
    return values.map((v) => getCountryByISO(v, intl.locale) ?? v).join(", ");
  }
  // CUSTOM: end
}
