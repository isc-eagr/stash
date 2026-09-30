import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useIntl } from "react-intl";
import * as GQL from "src/core/generated-graphql";
import { RatingSystem } from "../Shared/Rating/RatingSystem";
import { IColumn, ListTable } from "../List/ListTable";
import { useTableColumns } from "src/hooks/useTableColumns";
import { sortColumnExtrasCustom } from "../List/listTableSort_custom";
import { SortMetricValueCustom } from "../Shared/SortMetricBadge_custom";
import {
  getStudioSortMetricCustom,
  getStudioSortMetricDefinitionCustom,
  studioSortMetricNeedsBackendCustom,
} from "./studioSortMetric_custom";
import "./StudioListTable.scss";

type MetricValues = Readonly<Record<string, string | null | undefined>>;

interface IStudioListTableProps {
  studios: GQL.StudioListDataFragment[];
  statsByStudioID: ReadonlyMap<string, GQL.StudioListStatsDataFragment>;
  selectedIds: Set<string>;
  onSelectChange: (id: string, selected: boolean, shiftKey: boolean) => void;
  sortBy?: string;
  sortDirection: GQL.SortDirectionEnum;
  onSort?: (sortBy: string) => void;
}

interface IColumnSpec extends IColumn {
  defaultShow?: boolean;
  render: (
    studio: GQL.StudioListDataFragment,
    stats: GQL.StudioListStatsDataFragment | undefined,
    metricValues: MetricValues
  ) => React.ReactNode;
}

const TABLE_NAME = "studios";

// Metric columns in picker order. The rating-criteria averages are left out
// on purpose; they remain available as sorts.
const METRIC_COLUMNS: [string, boolean][] = [
  ["scenes_count", true],
  ["scenes_duration", true],
  ["scenes_size", false],
  ["images_count", false],
  ["galleries_count", false],
  ["child_count", false],
  ["tag_count", false],
  ["unique_performers_count", false],
  ["o_count", false],
  ["sex_activity_percent", true],
  ["oral_activity_percent", true],
  ["solo_activity_percent", true],
  ["outstanding_activity_percent", false],
  ["standard_activity_percent", false],
  ["unclassified_activity_percent", false],
  ["unusable_activity_percent", false],
  ["sex_scenes_count", false],
  ["oral_scenes_count", false],
  ["solo_scenes_count", false],
  ["facial_scenes_count", false],
  ["standard_facial_count", false],
  ["really_hot_facial_count", false],
  ["royal_sapphire_scenes_count", true],
  ["gold_scenes_count", true],
  ["silver_scenes_count", true],
  ["bronze_scenes_count", true],
  ["no_metallic_scenes_count", true],
  ["average_performer_rating", true],
  ["average_overall_scene_rating", true],
  ["average_solo_scene_rating", true],
  ["average_standard_scene_rating", true],
  ["average_threesome_scene_rating", true],
  ["average_group_scene_rating", true],
  ["created_at", false],
  ["updated_at", false],
];

export const StudioListTable: React.FC<IStudioListTableProps> = ({
  studios,
  statsByStudioID,
  selectedIds,
  onSelectChange,
  sortBy,
  sortDirection,
  onSort,
}) => {
  const intl = useIntl();

  const allColumns = useMemo<IColumnSpec[]>(() => {
    const metricColumns = METRIC_COLUMNS.flatMap(
      ([metric, defaultShow]): IColumnSpec[] => {
        const definition = getStudioSortMetricDefinitionCustom(metric);
        if (!definition) return [];
        return [
          {
            value: metric,
            label: intl.formatMessage({ id: definition.messageID }),
            sortBy: metric,
            defaultShow,
            render: (studio, stats, metricValues) => (
              <span className="list-table-metric">
                <SortMetricValueCustom
                  format={definition.format}
                  value={
                    getStudioSortMetricCustom(metric, {
                      studio,
                      stats,
                      metricValues,
                    })?.value
                  }
                />
              </span>
            ),
          },
        ];
      }
    );

    return [
      {
        value: "image",
        label: intl.formatMessage({ id: "image" }),
        defaultShow: true,
        render: (studio) => (
          <Link to={`/studios/${studio.id}`}>
            <img
              loading="lazy"
              className="studio-table-logo"
              alt={studio.name}
              src={studio.image_path ?? ""}
            />
          </Link>
        ),
      },
      {
        value: "name",
        label: intl.formatMessage({ id: "name" }),
        mandatory: true,
        sortBy: "name",
        render: (studio) => (
          <Link to={`/studios/${studio.id}`} title={studio.name}>
            <span className="ellips-data">{studio.name}</span>
          </Link>
        ),
      },
      {
        value: "parent_studio",
        label: intl.formatMessage({ id: "parent_studio" }),
        render: (studio) =>
          studio.parent_studio && (
            <Link
              to={`/studios/${studio.parent_studio.id}`}
              title={studio.parent_studio.name}
            >
              <span className="ellips-data">{studio.parent_studio.name}</span>
            </Link>
          ),
      },
      {
        value: "rating",
        label: intl.formatMessage({ id: "rating" }),
        sortBy: "rating",
        defaultShow: true,
        render: (studio) => <RatingSystem value={studio.rating100} disabled />,
      },
      ...metricColumns,
    ];
  }, [intl]);

  const defaultColumns = useMemo(
    () => allColumns.filter((col) => col.defaultShow).map((col) => col.value),
    [allColumns]
  );

  const { selectedColumns, saveColumns } = useTableColumns(
    TABLE_NAME,
    defaultColumns
  );

  // Show the active sort's column temporarily when it is not saved.
  const extraColumns = useMemo(
    () => sortColumnExtrasCustom(allColumns, selectedColumns, sortBy),
    [allColumns, selectedColumns, sortBy]
  );

  const backendMetrics = useMemo(
    () =>
      [...selectedColumns, ...extraColumns].filter((column) =>
        studioSortMetricNeedsBackendCustom(column)
      ),
    [selectedColumns, extraColumns]
  );

  const studioIDs = useMemo(() => studios.map((s) => s.id), [studios]);

  const { data: metricsData } = GQL.useFindStudioListMetricsQuery({
    variables: { ids: studioIDs, metrics: backendMetrics },
    skip: studioIDs.length === 0 || backendMetrics.length === 0,
    fetchPolicy: "cache-and-network",
  });

  const metricsByStudioID = useMemo(() => {
    const ret = new Map<string, MetricValues>();
    for (const entry of metricsData?.findStudios.studio_list_metrics ?? []) {
      ret.set(
        entry.studio_id,
        Object.fromEntries(entry.values.map((v) => [v.key, v.value]))
      );
    }
    return ret;
  }, [metricsData]);

  const columnsByValue = useMemo(
    () => new Map(allColumns.map((col) => [col.value, col])),
    [allColumns]
  );

  function renderCell(column: IColumn, studio: GQL.StudioListDataFragment) {
    return columnsByValue
      .get(column.value)
      ?.render(
        studio,
        statsByStudioID.get(studio.id),
        metricsByStudioID.get(studio.id) ?? {}
      );
  }

  return (
    <ListTable
      className="studio-table"
      items={studios}
      allColumns={allColumns}
      columns={selectedColumns}
      setColumns={(c) => saveColumns(c)}
      selectedIds={selectedIds}
      onSelectChange={onSelectChange}
      renderCell={renderCell}
      extraColumns={extraColumns}
      sortBy={sortBy}
      sortDirection={sortDirection}
      onSort={onSort}
    />
  );
};
