import { CriterionModifier } from "src/core/generated-graphql";
export interface IPercentageMetricCustom {
  modifier: CriterionModifier;
  value?: number;
}
export function parsePercentageMetricCustom(
  raw: string,
  current?: IPercentageMetricCustom
): IPercentageMetricCustom | undefined {
  if (raw === "")
    return current
      ? { modifier: current.modifier, value: undefined }
      : undefined;
  const value = Number.parseInt(raw, 10);
  return {
    modifier: current?.modifier ?? CriterionModifier.GreaterThan,
    value: Number.isFinite(value)
      ? Math.min(100, Math.max(0, value))
      : undefined,
  };
}
export function updatePercentageMetricCustom<K extends string>(
  values: Partial<Record<K, IPercentageMetricCustom>>,
  key: K,
  metric?: IPercentageMetricCustom
) {
  const next = { ...values };
  if (metric === undefined) delete next[key];
  else next[key] = metric;
  return next;
}
