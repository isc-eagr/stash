import { IntlShape } from "react-intl";
import { CriterionModifier } from "src/core/generated-graphql";
import { Criterion, CriterionOption } from "./criterion";
import { CriterionType } from "../types";

export interface IQualityTypeMetric {
  modifier: CriterionModifier;
  value?: number;
}

export interface IQualityTypeValue {
  outstanding_percent?: IQualityTypeMetric;
  standard_percent?: IQualityTypeMetric;
  unusable_percent?: IQualityTypeMetric;
}

export type QualityTypeMetricKey = keyof IQualityTypeValue;

const metricKeys: QualityTypeMetricKey[] = [
  "outstanding_percent",
  "standard_percent",
  "unusable_percent",
];

export const QualityTypeCriterionOptionInstance = new CriterionOption({
  messageID: "quality_type",
  type: "quality_type" as CriterionType,
  makeCriterion: (option) => new QualityTypeCriterion(option),
});

export class QualityTypeCriterion extends Criterion {
  public value: IQualityTypeValue = {};

  public readonly metricKeys = metricKeys;

  protected cloneValues() {
    this.value = { ...this.value };
  }

  public isValid(): boolean {
    return this.metricKeys.some((key) => this.value[key]?.value !== undefined);
  }

  public getLabel(intl: IntlShape): string {
    const criterionLabel = intl.formatMessage({ id: "quality_type" });
    const configuredMetricKeys = this.metricKeys.filter(
      (key) => this.value[key]?.value !== undefined
    );
    if (configuredMetricKeys.length === 0) return criterionLabel;

    const parts = configuredMetricKeys.map((key) => {
      const metric = this.value[key]!;
      const metricLabel = intl.formatMessage({ id: `quality_type.${key}` });
      const modifierLabel =
        metric.modifier === CriterionModifier.GreaterThan
          ? ">"
          : metric.modifier === CriterionModifier.LessThan
          ? "<"
          : "=";
      return `${metricLabel} ${modifierLabel} ${metric.value}%`;
    });

    return `${criterionLabel}: ${parts.join(", ")}`;
  }

  public toQueryParams(): Record<string, unknown> {
    return {
      type: this.criterionOption.type,
      value: JSON.stringify(this.value),
    };
  }

  public fromDecodedParams(params: Record<string, unknown>): void {
    const raw = params as { value?: string };
    if (raw.value) {
      try {
        this.value = JSON.parse(raw.value) as IQualityTypeValue;
      } catch {
        this.value = {};
      }
    }
  }

  public applyToCriterionInput(input: Record<string, unknown>): void {
    if (!this.isValid()) return;

    const qualityPercentages: Record<string, unknown> = {};
    for (const key of this.metricKeys) {
      const metric = this.value[key];
      if (metric !== undefined && metric.value !== undefined) {
        qualityPercentages[key] = {
          modifier: metric.modifier,
          value: metric.value,
        };
      }
    }

    input.quality_percentages = qualityPercentages;
  }

  public applyToSavedCriterion(input: Record<string, unknown>): void {
    input.quality_type = { value: JSON.stringify(this.value) };
  }

  public setFromSavedCriterion(criterion: unknown): void {
    const data = criterion as { value?: string };
    if (data?.value) {
      try {
        this.value = JSON.parse(data.value) as IQualityTypeValue;
      } catch {
        this.value = {};
      }
    }
  }
}
