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

function numericSortValue(value: ISortMetricBadgeCustom["value"]) {
  if (typeof value === "number") return value;
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

// Formats one sort metric value. Shared by the card badge and list tables.
export const SortMetricValueCustom: React.FC<{
  format: SortMetricFormatCustom;
  value?: ISortMetricBadgeCustom["value"];
}> = ({ format, value }) => {
  const intl = useIntl();
  const number = numericSortValue(value);
  switch (format) {
    case "none":
      return null;
    case "boolean":
      return (
        <>
          {typeof value === "boolean"
            ? intl.formatMessage({ id: value ? "yes" : "no" })
            : "—"}
        </>
      );
    case "bytes":
      return number === undefined ? <>{"—"}</> : <FileSize size={number} />;
    case "count":
      return <>{number?.toLocaleString() ?? "—"}</>;
    case "percent":
      return <>{number === undefined ? "—" : `${Math.round(number)}%`}</>;
    case "rating":
      return (
        <>
          {number === undefined
            ? "—"
            : `${number.toLocaleString(undefined, {
                maximumFractionDigits: 1,
              })}/100`}
        </>
      );
    case "duration":
      return (
        <>
          {number === undefined
            ? "—"
            : TextUtils.secondsAsTimeString(number, 3)}
        </>
      );
    case "date":
      return (
        <>
          {typeof value === "string" && value !== ""
            ? TextUtils.formatDate(intl, value)
            : "—"}
        </>
      );
    case "datetime":
      return (
        <>
          {typeof value === "string" && value !== ""
            ? TextUtils.formatDateTime(intl, value)
            : "—"}
        </>
      );
    case "text":
      return <>{typeof value === "string" && value !== "" ? value : "—"}</>;
    default:
      return (
        <>
          {number === undefined
            ? "—"
            : number.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </>
      );
  }
};

export const SortMetricBadgeCustom: React.FC<IProps> = ({
  metric,
  sortDirection,
}) => {
  const intl = useIntl();
  if (!metric) return null;

  const value =
    metric.format === "none" ? undefined : (
      <SortMetricValueCustom format={metric.format} value={metric.value} />
    );

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
