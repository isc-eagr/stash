// CUSTOM: Performer Partners filter criterion — filter by partner counts across role/category combos.
import { CriterionModifier } from "src/core/generated-graphql";
import { Criterion, CriterionOption } from "./criterion";
import { CriterionType } from "../types";
import { IntlShape } from "react-intl";

export interface IPartnerMetric {
  modifier: CriterionModifier;
  value?: number; // undefined = modifier set but no filter value yet
}

export interface IPerformerPartnersValue {
  sex_topped?: IPartnerMetric;
  oral_topped?: IPartnerMetric;
  facial_topped?: IPartnerMetric;
  topped_operator?: "AND" | "OR"; // default AND
  sex_bottomed?: IPartnerMetric;
  oral_bottomed?: IPartnerMetric;
  facial_bottomed?: IPartnerMetric;
  bottomed_operator?: "AND" | "OR"; // default AND
  sex_unique?: IPartnerMetric;
  oral_unique?: IPartnerMetric;
  facial_unique?: IPartnerMetric;
  unique_operator?: "AND" | "OR"; // default AND
}

export const PerformerPartnersCriterionOption = new CriterionOption({
  messageID: "partners",
  type: "partners" as CriterionType,
  makeCriterion: () => new PerformerPartnersCriterion(),
});

export class PerformerPartnersCriterion extends Criterion {
  public value: IPerformerPartnersValue = {};

  constructor() {
    super(PerformerPartnersCriterionOption);
  }

  protected cloneValues() {
    this.value = { ...this.value };
  }

  public isValid(): boolean {
    // Only valid if at least one metric has a defined value
    return Object.values(this.value).some((m) => m !== undefined && m.value !== undefined);
  }

  public getLabel(intl: IntlShape): string {
    const criterionLabel = intl.formatMessage({ id: "partners" });
    const metricKeys = Object.keys(this.value) as Array<keyof IPerformerPartnersValue>;
    if (metricKeys.length === 0) return criterionLabel;

    const parts = metricKeys
      .filter((k) => this.value[k] !== undefined && this.value[k]!.value !== undefined)
      .map((k) => {
        const metric = this.value[k]!;
        const metricLabel = intl.formatMessage({ id: k });
        const modLabel =
          metric.modifier === CriterionModifier.GreaterThan
            ? ">"
            : metric.modifier === CriterionModifier.LessThan
            ? "<"
            : "=";
        return `${metricLabel} ${modLabel} ${metric.value}`;
      });

    return `${criterionLabel}: ${parts.join(", ")}`;
  }

  public toQueryParams(): Record<string, unknown> {
    return {
      type: "partners",
      value: JSON.stringify(this.value),
    };
  }

  public fromDecodedParams(params: Record<string, unknown>): void {
    const raw = params as { value?: string };
    if (raw.value) {
      try {
        this.value = JSON.parse(raw.value) as IPerformerPartnersValue;
      } catch {
        this.value = {};
      }
    }
  }

  public applyToCriterionInput(input: Record<string, unknown>): void {
    if (!this.isValid()) return;

    const metricKeys = [
      "sex_topped", "oral_topped", "facial_topped",
      "sex_bottomed", "oral_bottomed", "facial_bottomed",
      "sex_unique", "oral_unique", "facial_unique",
    ] as const;
    const operatorKeys = [
      "topped_operator", "bottomed_operator", "unique_operator",
    ] as const;

    const partners: Record<string, unknown> = {};
    for (const k of metricKeys) {
      const metric = this.value[k];
      // Only send to backend if a value is defined
      if (metric !== undefined && metric.value !== undefined) {
        partners[k] = { modifier: metric.modifier, value: metric.value };
      }
    }
    for (const k of operatorKeys) {
      const op = this.value[k];
      if (op === "OR") {
        partners[k] = op;
      }
    }
    input.partners = partners;
  }

  public applyToSavedCriterion(input: Record<string, unknown>): void {
    input["partners"] = { value: JSON.stringify(this.value) };
  }

  public setFromSavedCriterion(criterion: unknown): void {
    const data = criterion as { value?: string };
    if (data?.value) {
      try {
        this.value = JSON.parse(data.value) as IPerformerPartnersValue;
      } catch {
        this.value = {};
      }
    }
  }
}
