import React, { useMemo } from "react"; // CUSTOM: added useMemo
import { useIntl } from "react-intl";
import * as GQL from "src/core/generated-graphql";
import { useStudioUpdate } from "src/core/StashService";
import { useTableColumns } from "src/hooks/useTableColumns";
import { useConfigurationContext } from "src/hooks/Config";
import { ListTable, IColumn } from "../List/ListTable";
import { RatingSystem } from "../Shared/Rating/RatingSystem";
import { Link } from "react-router-dom";
import NavUtils from "src/utils/navigation";
// CUSTOM: begin - sortable headers and studio metric columns
import { sortColumnExtrasCustom } from "../List/listTableSort_custom";
import { SortMetricValueCustom } from "../Shared/SortMetricBadge_custom";
import {
  getStudioSortMetricCustom,
  getStudioSortMetricDefinitionCustom,
  studioSortMetricNeedsBackendCustom,
} from "./studioSortMetric_custom";
// CUSTOM: end
import "./StudioListTable.scss";

// CUSTOM: begin - the list uses the lean studio fragment plus batched stats
type StudioRow = GQL.StudioListDataFragment;
type MetricValues = Readonly<Record<string, string | null | undefined>>;
// CUSTOM: end

interface IStudioListTableProps {
  studios: StudioRow[]; // CUSTOM: was StudioDataFragment
  selectedIds: Set<string>;
  onSelectChange: (id: string, selected: boolean, shiftKey: boolean) => void;
  // CUSTOM: begin
  statsByStudioID: ReadonlyMap<string, GQL.StudioListStatsDataFragment>;
  sortBy?: string;
  sortDirection: GQL.SortDirectionEnum;
  onSort?: (sortBy: string) => void;
  // CUSTOM: end
}

const TABLE_NAME = "studios";

// CUSTOM: begin - extra metric columns in picker order. Counts that have an
// upstream column (scenes, images, galleries, O count, sub-studios) are not
// repeated here. The rating-criteria averages are left out on purpose; they
// remain available as sorts.
const METRIC_COLUMNS: [string, boolean][] = [
  ["scenes_duration", true],
  ["scenes_size", false],
  ["tag_count", false],
  ["unique_performers_count", false],
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
  ["facial_count", false],
  ["standard_facial_count", false],
  ["really_hot_facial_count", false],
  ["goat_facial_count", false],
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
  ["average_stashdb_matches", true],
  ["created_at", false],
  ["updated_at", false],
];
// CUSTOM: end

export const StudioListTable: React.FC<IStudioListTableProps> = ({
  studios,
  selectedIds,
  onSelectChange,
  // CUSTOM: begin
  statsByStudioID,
  sortBy,
  sortDirection,
  onSort,
  // CUSTOM: end
}) => {
  const intl = useIntl();
  const [updateStudio] = useStudioUpdate();
  const { configuration } = useConfigurationContext();
  const showChildContent = configuration?.ui?.showChildStudioContent ?? false;

  function setRating(v: number | null, studioId: string) {
    if (studioId) {
      updateStudio({
        variables: {
          input: {
            id: studioId,
            rating100: v,
          },
        },
      });
    }
  }

  // CUSTOM: counts come from the page's batched studio stats
  const statsOf = (studio: StudioRow) => statsByStudioID.get(studio.id);
  // CUSTOM: link helpers only need the id and name
  const navStudio = (studio: StudioRow) => ({
    id: studio.id,
    name: studio.name,
  });

  const ImageCell = (studio: StudioRow) => (
    <Link to={`/studios/${studio.id}`} aria-label={studio.name ?? ""}>
      {studio.image_path ? (
        <img
          loading="lazy"
          className="image-thumbnail"
          alt={studio.name ?? ""}
          src={studio.image_path}
        />
      ) : (
        <span className="image-thumbnail" aria-hidden="true" />
      )}
    </Link>
  );

  const NameCell = (studio: StudioRow) => (
    <Link to={`/studios/${studio.id}`}>
      <div className="ellips-data" title={studio.name ?? ""}>
        {studio.name}
      </div>
    </Link>
  );

  const AliasesCell = (studio: StudioRow) => {
    const aliases = studio.aliases?.join(", ") ?? "";
    return (
      <span className="ellips-data" title={aliases}>
        {aliases}
      </span>
    );
  };

  const RatingCell = (studio: StudioRow) => (
    <RatingSystem
      value={studio.rating100}
      onSetRating={(value) => setRating(value, studio.id)}
      max={100} // CUSTOM
      clickToRate
    />
  );

  const SceneCountCell = (studio: StudioRow) => (
    <Link to={NavUtils.makeStudioScenesUrl(navStudio(studio))}>
      <span>
        {showChildContent
          ? statsOf(studio)?.scene_count_all
          : statsOf(studio)?.scene_count}
      </span>
    </Link>
  );

  const MarkerCountCell = (studio: StudioRow) => (
    <span>{statsOf(studio)?.scene_marker_count}</span>
  );

  const ImageCountCell = (studio: StudioRow) => (
    <Link to={NavUtils.makeStudioImagesUrl(navStudio(studio))}>
      <span>{statsOf(studio)?.image_count}</span>
    </Link>
  );

  const GalleryCountCell = (studio: StudioRow) => (
    <Link to={NavUtils.makeStudioGalleriesUrl(navStudio(studio))}>
      <span>{statsOf(studio)?.gallery_count}</span>
    </Link>
  );

  const PerformerCountCell = (studio: StudioRow) => (
    <Link to={NavUtils.makeStudioPerformersUrl(navStudio(studio))}>
      <span>
        {showChildContent
          ? statsOf(studio)?.performer_count_all
          : statsOf(studio)?.performer_count}
      </span>
    </Link>
  );

  const OCountCell = (studio: StudioRow) => (
    <span>
      {showChildContent
        ? statsOf(studio)?.o_counter_all
        : statsOf(studio)?.o_counter}
    </span>
  );

  const RelatedCell = (studio: StudioRow) => {
    const parentLink = studio.parent_studio ? (
      <Link to={`/studios/${studio.parent_studio.id}`}>
        {studio.parent_studio.name}
      </Link>
    ) : null;
    const childLink =
      studio.child_studios && studio.child_studios.length > 0 ? (
        <Link to={NavUtils.makeChildStudiosUrl(navStudio(studio))}>
          {studio.child_studios.length}
        </Link>
      ) : null;
    return (
      <div className="studio-related">
        {parentLink}
        {parentLink && childLink && " / "}
        {childLink}
      </div>
    );
  };

  interface IColumnSpec {
    value: string;
    label: string;
    defaultShow?: boolean;
    mandatory?: boolean;
    sortBy?: string; // CUSTOM: header click sorts by this key
    render?: (studio: StudioRow, index: number) => React.ReactNode;
  }

  // CUSTOM: begin - custom studio metrics as extra columns
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
          render: (studio) => (
            <span className="list-table-metric">
              <SortMetricValueCustom
                format={definition.format}
                value={
                  getStudioSortMetricCustom(metric, {
                    studio,
                    stats: statsOf(studio),
                    metricValues: metricsByStudioID.get(studio.id) ?? {},
                  })?.value
                }
              />
            </span>
          ),
        },
      ];
    }
  );
  // CUSTOM: end

  const allColumns: IColumnSpec[] = [
    {
      value: "image",
      label: intl.formatMessage({ id: "image" }),
      defaultShow: true,
      render: ImageCell,
    },
    {
      value: "name",
      label: intl.formatMessage({ id: "name" }),
      mandatory: true,
      defaultShow: true,
      sortBy: "name", // CUSTOM
      render: NameCell,
    },
    {
      value: "aliases",
      label: intl.formatMessage({ id: "aliases" }),
      defaultShow: true,
      render: AliasesCell,
    },
    {
      value: "rating",
      label: intl.formatMessage({ id: "rating" }),
      defaultShow: true,
      sortBy: "rating", // CUSTOM
      render: RatingCell,
    },
    {
      value: "scene_count",
      label: intl.formatMessage({ id: "scenes" }),
      defaultShow: true,
      sortBy: "scenes_count", // CUSTOM
      render: SceneCountCell,
    },
    {
      value: "scene_markers_count",
      label: intl.formatMessage({ id: "scene_marker_count" }),
      defaultShow: true,
      sortBy: "scene_markers_count", // CUSTOM
      render: MarkerCountCell,
    },
    {
      value: "image_count",
      label: intl.formatMessage({ id: "images" }),
      defaultShow: true,
      sortBy: "images_count", // CUSTOM
      render: ImageCountCell,
    },
    {
      value: "gallery_count",
      label: intl.formatMessage({ id: "galleries" }),
      defaultShow: true,
      sortBy: "galleries_count", // CUSTOM
      render: GalleryCountCell,
    },
    {
      value: "o_counter",
      label: intl.formatMessage({ id: "o_count" }),
      defaultShow: true,
      sortBy: showChildContent ? "o_counter_all" : "o_counter", // CUSTOM
      render: OCountCell,
    },
    {
      value: "performer_count",
      label: intl.formatMessage({ id: "performers" }),
      defaultShow: true,
      sortBy: showChildContent ? "performer_count_all" : "performer_count", // CUSTOM
      render: PerformerCountCell,
    },
    {
      value: "related",
      label: intl.formatMessage({ id: "related_studios" }),
      defaultShow: true,
      sortBy: "child_count", // CUSTOM
      render: RelatedCell,
    },
    ...metricColumns, // CUSTOM
  ];

  const defaultColumns = allColumns
    .filter((col) => col.defaultShow)
    .map((col) => col.value);

  const { selectedColumns, saveColumns } = useTableColumns(
    TABLE_NAME,
    defaultColumns
  );

  // CUSTOM: begin - show the active sort's column temporarily when it is not
  // saved, and load backend-only metrics for the visible columns.
  const extraColumns = sortColumnExtrasCustom(
    allColumns,
    selectedColumns,
    sortBy
  );

  const backendMetrics = [...selectedColumns, ...extraColumns].filter(
    (column) => studioSortMetricNeedsBackendCustom(column)
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
  // CUSTOM: end

  const columnRenderFuncs: Record<
    string,
    (studio: StudioRow, index: number) => React.ReactNode
  > = {};
  allColumns.forEach((col) => {
    if (col.render) {
      columnRenderFuncs[col.value] = col.render;
    }
  });

  function renderCell(column: IColumn, studio: StudioRow, index: number) {
    const render = columnRenderFuncs[column.value];
    if (render) return render(studio, index);
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
      // CUSTOM: begin
      extraColumns={extraColumns}
      sortBy={sortBy}
      sortDirection={sortDirection}
      onSort={onSort}
      // CUSTOM: end
    />
  );
};
