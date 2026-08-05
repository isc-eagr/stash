import React from "react";
import { useIntl } from "react-intl";
import * as GQL from "src/core/generated-graphql";
import TextUtils from "src/utils/text";
import { FileSize } from "./FileSize";
import "./SortMetricBadge_custom.scss";

export type SortMetricFormatCustom =
  | "boolean"
  | "bytes"
  | "count"
  | "date"
  | "datetime"
  | "decimal"
  | "duration"
  | "none"
  | "percent"
  | "rating"
  | "text";

export interface ISortMetricBadgeCustom {
  messageID: string;
  format: SortMetricFormatCustom;
  value?: boolean | number | string | null;
}

interface IProps {
  metric?: ISortMetricBadgeCustom;
  sortDirection: GQL.SortDirectionEnum;
}

function numericSortValue(metric: ISortMetricBadgeCustom) {
  if (typeof metric.value === "number") return metric.value;
  if (typeof metric.value !== "string" || metric.value.trim() === "") {
    return undefined;
  }
  const parsed = Number(metric.value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export const SortMetricBadgeCustom: React.FC<IProps> = ({
  metric,
  sortDirection,
}) => {
  const intl = useIntl();
  if (!metric) return null;

  const number = numericSortValue(metric);
  let value: React.ReactNode;
  switch (metric.format) {
    case "none":
      value = undefined;
      break;
    case "boolean":
      value =
        typeof metric.value === "boolean"
          ? intl.formatMessage({ id: metric.value ? "yes" : "no" })
          : "\u2014";
      break;
    case "bytes":
      value = number === undefined ? "\u2014" : <FileSize size={number} />;
      break;
    case "count":
      value = number?.toLocaleString() ?? "\u2014";
      break;
    case "percent":
      value = number === undefined ? "\u2014" : `${Math.round(number)}%`;
      break;
    case "rating":
      value =
        number === undefined
          ? "\u2014"
          : `${number.toLocaleString(undefined, {
              maximumFractionDigits: 1,
            })}/100`;
      break;
    case "duration":
      value =
        number === undefined
          ? "\u2014"
          : TextUtils.secondsAsTimeString(number, 3);
      break;
    case "date":
      value =
        typeof metric.value === "string" && metric.value !== ""
          ? TextUtils.formatDate(intl, metric.value)
          : "\u2014";
      break;
    case "datetime":
      value =
        typeof metric.value === "string" && metric.value !== ""
          ? TextUtils.formatDateTime(intl, metric.value)
          : "\u2014";
      break;
    case "text":
      value =
        typeof metric.value === "string" && metric.value !== ""
          ? metric.value
          : "\u2014";
      break;
    default:
      value =
        number === undefined
          ? "\u2014"
          : number.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  const direction =
    sortDirection === GQL.SortDirectionEnum.Desc ? "descending" : "ascending";
  const directionArrow =
    sortDirection === GQL.SortDirectionEnum.Desc ? "\u2193" : "\u2191";
  const label = intl.formatMessage({ id: metric.messageID });

  return (
    <div
      aria-label={`Sorted by ${label} ${direction}`}
      className="catalog-sort-metric"
      title={`${label} (${direction})`}
    >
      <span className="catalog-sort-metric-label">{label}</span>
      {value !== undefined && (
        <>
          <span aria-hidden="true" className="catalog-sort-metric-separator">
            :
          </span>
          <span className="catalog-sort-metric-value">{value}</span>
        </>
      )}
      <span aria-hidden="true" className="catalog-sort-metric-direction">
        {directionArrow}
      </span>
    </div>
  );
};
