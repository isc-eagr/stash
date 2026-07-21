import { IntlShape } from "react-intl";
import { CriterionModifier } from "src/core/generated-graphql";
import { Criterion, CriterionOption } from "./criterion";
import { CriterionType } from "../types";

export interface IActivityTypeMetric {
  modifier: CriterionModifier;
  value?: number;
}

export interface IActivityTypeValue {
  sex_percent?: IActivityTypeMetric;
  oral_percent?: IActivityTypeMetric;
  solo_percent?: IActivityTypeMetric;
  other_percent?: IActivityTypeMetric;
  unusable_percent?: IActivityTypeMetric;
  sex_top_percent?: IActivityTypeMetric;
  sex_bottom_percent?: IActivityTypeMetric;
  oral_top_percent?: IActivityTypeMetric;
  oral_bottom_percent?: IActivityTypeMetric;
}

export type ActivityTypeMetricKey = keyof IActivityTypeValue;

const baseMetricKeys: ActivityTypeMetricKey[] = [
  "sex_percent",
  "oral_percent",
  "solo_percent",
  "other_percent",
];

const performerMetricKeys: ActivityTypeMetricKey[] = [
  "sex_percent",
  "oral_percent",
  "solo_percent",
  "sex_top_percent",
  "sex_bottom_percent",
  "oral_top_percent",
  "oral_bottom_percent",
];

export class ActivityTypeCriterionOption extends CriterionOption {
  public readonly includePerformerRoles: boolean;

  constructor(includePerformerRoles: boolean) {
    super({
      messageID: "activity_type",
      type: "activity_type" as CriterionType,
      makeCriterion: (o) =>
        new ActivityTypeCriterion(o as ActivityTypeCriterionOption),
    });
    this.includePerformerRoles = includePerformerRoles;
  }
}

export const ActivityTypeCriterionOptionInstance =
  new ActivityTypeCriterionOption(false);

export const StudioActivityTypeCriterionOption =
  new ActivityTypeCriterionOption(false);

export const PerformerActivityTypeCriterionOption =
  new ActivityTypeCriterionOption(true);

export class ActivityTypeCriterion extends Criterion {
  public value: IActivityTypeValue = {};

  public get metricKeys() {
    if (this.activityTypeOption.includePerformerRoles)
      return performerMetricKeys;
    return baseMetricKeys;
  }

  private get activityTypeOption() {
    return this.criterionOption as ActivityTypeCriterionOption;
  }

  protected cloneValues() {
    this.value = { ...this.value };
  }

  public isValid(): boolean {
    return this.metricKeys.some((k) => this.value[k]?.value !== undefined);
  }

  public getLabel(intl: IntlShape): string {
    const criterionLabel = intl.formatMessage({ id: "activity_type" });
    const configuredMetricKeys = this.metricKeys.filter(
      (k) => this.value[k]?.value !== undefined
    );
    if (configuredMetricKeys.length === 0) return criterionLabel;

    const parts = configuredMetricKeys.map((k) => {
      const metric = this.value[k]!;
      const metricLabel = intl.formatMessage({ id: `activity_type.${k}` });
      const modLabel =
        metric.modifier === CriterionModifier.GreaterThan
          ? ">"
          : metric.modifier === CriterionModifier.LessThan
          ? "<"
          : "=";
      return `${metricLabel} ${modLabel} ${metric.value}%`;
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
        this.value = JSON.parse(raw.value) as IActivityTypeValue;
      } catch {
        this.value = {};
      }
    }
  }

  public applyToCriterionInput(input: Record<string, unknown>): void {
    if (!this.isValid()) return;

    const activityPercentages: Record<string, unknown> = {};
    for (const key of this.metricKeys) {
      const metric = this.value[key];
      if (metric !== undefined && metric.value !== undefined) {
        activityPercentages[key] = {
          modifier: metric.modifier,
          value: metric.value,
        };
      }
    }

    input.activity_percentages = activityPercentages;
  }

  public applyToSavedCriterion(input: Record<string, unknown>): void {
    input.activity_type = { value: JSON.stringify(this.value) };
  }

  public setFromSavedCriterion(criterion: unknown): void {
    const data = criterion as { value?: string };
    if (data?.value) {
      try {
        this.value = JSON.parse(data.value) as IActivityTypeValue;
      } catch {
        this.value = {};
      }
    }
  }
}
