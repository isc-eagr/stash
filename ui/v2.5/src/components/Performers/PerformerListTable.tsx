/* eslint-disable jsx-a11y/control-has-associated-label */

import React from "react";
import { useIntl } from "react-intl";
import { Button, ButtonGroup } from "react-bootstrap"; // CUSTOM: table presets
import { Link } from "react-router-dom";
import { usePerformerUpdate } from "src/core/StashService";
import { Icon } from "../Shared/Icon";
import NavUtils from "src/utils/navigation";
import { faHeart } from "@fortawesome/free-solid-svg-icons";
import { useTableColumns } from "src/hooks/useTableColumns";
import { RatingSystem } from "../Shared/Rating/RatingSystem";
import cx from "classnames";
import {
  FormatCircumcised,
  FormatHeight,
  FormatPenisLength,
  FormatWeight,
  formatYearRange,
} from "./PerformerList";
import TextUtils from "src/utils/text";
import { getCountryByISO } from "src/utils/country";
import { IColumn, ListTable } from "../List/ListTable";
import type { PerformerListData } from "./performerTypes_custom"; // CUSTOM
// CUSTOM: reuse card metrics and the scene table's sorting behavior.
import * as GQL from "src/core/generated-graphql";
import {
  getPerformerSortMetricCustom,
  getPerformerSortMetricDefinitionCustom,
} from "./performerSortMetric_custom";
import { SortMetricValueCustom } from "../Shared/SortMetricBadge_custom";
import { usePerformerCardRoleStats } from "./performerRoleStats_custom";
import { useCatalogSortMetricValuesCustom } from "../Shared/catalogSortMetricValues_custom";
import { sortColumnExtrasCustom } from "../List/listTableSort_custom";
import {
  PERFORMER_BROWSE_COLUMNS_CUSTOM,
  PERFORMER_METRICS_COLUMNS_CUSTOM,
} from "./performerTableColumns_custom";

interface IPerformerListTableProps {
  performers: PerformerListData[];
  selectedIds: Set<string>;
  onSelectChange: (id: string, selected: boolean, shiftKey: boolean) => void;
  // CUSTOM
  sortBy?: string;
  sortDirection?: GQL.SortDirectionEnum;
  onSort?: (sortBy: string) => void;
}

const TABLE_NAME = "performers";

export const PerformerListTable: React.FC<IPerformerListTableProps> = (
  props: IPerformerListTableProps
) => {
  const intl = useIntl();
  const [updatePerformer] = usePerformerUpdate();
  // CUSTOM: role totals are shared across the rendered rows, never per-cell queries.
  const roleStats = usePerformerCardRoleStats(props.performers);
  const sortValues = useCatalogSortMetricValuesCustom(
    "performer",
    props.performers.map((p) => p.id),
    props.sortBy,
    props.sortDirection ?? GQL.SortDirectionEnum.Asc
  );

  function setFavorite(v: boolean, performerId: string) {
    if (performerId) {
      updatePerformer({
        variables: {
          input: {
            id: performerId,
            favorite: v,
          },
        },
      });
    }
  }

  const ImageCell = (performer: PerformerListData) => (
    <Link to={`/performers/${performer.id}`}>
      <img
        loading="lazy"
        className="image-thumbnail"
        alt={performer.name ?? ""}
        src={performer.image_path ?? ""}
      />
    </Link>
  );

  const NameCell = (performer: PerformerListData) => (
    <Link to={`/performers/${performer.id}`}>
      <div className="ellips-data" title={performer.name}>
        {performer.name}
        {performer.disambiguation && (
          <span className="performer-disambiguation">
            {` (${performer.disambiguation})`}
          </span>
        )}
      </div>
    </Link>
  );

  const AliasesCell = (performer: PerformerListData) => {
    let aliases = performer.alias_list ? performer.alias_list.join(", ") : "";
    return (
      <span className="ellips-data" title={aliases}>
        {aliases}
      </span>
    );
  };

  const RatingCell = (performer: PerformerListData) => (
    <RatingSystem value={performer.rating100} disabled />
  );

  const AgeCell = (performer: PerformerListData) => (
    <span
      title={
        performer.birthdate
          ? TextUtils.formatFuzzyDate(intl, performer.birthdate ?? undefined)
          : ""
      }
    >
      {performer.birthdate
        ? TextUtils.age(performer.birthdate, performer.death_date)
        : ""}
    </span>
  );

  const DeathdateCell = (performer: PerformerListData) => (
    <>{performer.death_date}</>
  );

  const FavoriteCell = (performer: PerformerListData) => (
    <Button
      className={cx(
        "minimal",
        performer.favorite ? "favorite" : "not-favorite"
      )}
      onClick={() => setFavorite(!performer.favorite, performer.id)}
    >
      <Icon icon={faHeart} />
    </Button>
  );

  const CountryCell = (performer: PerformerListData) => {
    const { locale } = useIntl();
    return (
      <span className="ellips-data">
        {getCountryByISO(performer.country, locale)}
      </span>
    );
  };

  const EthnicityCell = (performer: PerformerListData) => (
    <>{performer.ethnicity}</>
  );

  const PenisLengthCell = (performer: PerformerListData) => (
    <>{FormatPenisLength(performer.penis_length)}</>
  );

  const CircumcisedCell = (performer: PerformerListData) => (
    <>{FormatCircumcised(performer.circumcised)}</>
  );

  const HairColorCell = (performer: PerformerListData) => (
    <span className="ellips-data">{performer.hair_color}</span>
  );

  const EyeColorCell = (performer: PerformerListData) => (
    <>{performer.eye_color}</>
  );

  const HeightCell = (performer: PerformerListData) => (
    <>{FormatHeight(performer.height_cm)}</>
  );

  const WeightCell = (performer: PerformerListData) => (
    <>{FormatWeight(performer.weight)}</>
  );

  const CareerLengthCell = (performer: PerformerListData) => (
    <>{formatYearRange(performer.career_start, performer.career_end) ?? ""}</>
  );

  const SceneCountCell = (performer: PerformerListData) => (
    <Link to={NavUtils.makePerformerScenesUrl(performer)}>
      <span>{performer.scene_count}</span>
    </Link>
  );

  const GalleryCountCell = (performer: PerformerListData) => (
    <Link to={NavUtils.makePerformerGalleriesUrl(performer)}>
      <span>{performer.gallery_count}</span>
    </Link>
  );

  const ImageCountCell = (performer: PerformerListData) => (
    <Link to={NavUtils.makePerformerImagesUrl(performer)}>
      <span>{performer.image_count}</span>
    </Link>
  );

  const OCounterCell = (performer: PerformerListData) => (
    <>{performer.o_counter}</>
  );

  interface IColumnSpec {
    value: string;
    label: string;
    mandatory?: boolean;
    sortBy?: string; // CUSTOM
    render?: (scene: PerformerListData, index: number) => React.ReactNode;
  }

  // CUSTOM: presets below replace the upstream defaultShow flags.
  const allColumns: IColumnSpec[] = [
    {
      value: "image",
      label: intl.formatMessage({ id: "image" }),
      render: ImageCell,
    },
    {
      value: "name",
      label: intl.formatMessage({ id: "name" }),
      mandatory: true,
      render: NameCell,
    },
    {
      value: "aliases",
      label: intl.formatMessage({ id: "aliases" }),
      render: AliasesCell,
    },
    {
      value: "rating",
      label: intl.formatMessage({ id: "rating" }),
      render: RatingCell,
    },
    {
      value: "age",
      label: intl.formatMessage({ id: "age" }),
      render: AgeCell,
    },
    {
      value: "death_date",
      label: intl.formatMessage({ id: "death_date" }),
      render: DeathdateCell,
    },
    {
      value: "favourite",
      label: intl.formatMessage({ id: "favourite" }),
      render: FavoriteCell,
    },
    {
      value: "country",
      label: intl.formatMessage({ id: "country" }),
      render: CountryCell,
    },
    {
      value: "ethnicity",
      label: intl.formatMessage({ id: "ethnicity" }),
      render: EthnicityCell,
    },
    {
      value: "hair_color",
      label: intl.formatMessage({ id: "hair_color" }),
      render: HairColorCell,
    },
    {
      value: "eye_color",
      label: intl.formatMessage({ id: "eye_color" }),
      render: EyeColorCell,
    },
    {
      value: "height_cm",
      label: intl.formatMessage({ id: "height_cm" }),
      render: HeightCell,
    },
    {
      value: "weight_kg",
      label: intl.formatMessage({ id: "weight_kg" }),
      render: WeightCell,
    },
    {
      value: "penis_length_cm",
      label: intl.formatMessage({ id: "penis_length_cm" }),
      render: PenisLengthCell,
    },
    {
      value: "circumcised",
      label: intl.formatMessage({ id: "circumcised" }),
      render: CircumcisedCell,
    },
    {
      value: "career_length",
      label: intl.formatMessage({ id: "career_length" }),
      render: CareerLengthCell,
    },
    {
      value: "scene_count",
      label: intl.formatMessage({ id: "scenes" }),
      render: SceneCountCell,
    },
    {
      value: "gallery_count",
      label: intl.formatMessage({ id: "galleries" }),
      render: GalleryCountCell,
    },
    {
      value: "image_count",
      label: intl.formatMessage({ id: "images" }),
      render: ImageCountCell,
    },
    {
      value: "o_counter",
      label: intl.formatMessage({ id: "o_count" }),
      render: OCounterCell,
    },
  ];

  // CUSTOM: bind existing columns to their actual server sort keys.
  const columnSorts: Record<string, string> = {
    name: "name",
    rating: "rating",
    height_cm: "height",
    weight_kg: "weight",
    penis_length_cm: "penis_length",
    scene_count: "scenes_count",
    gallery_count: "galleries_count",
    image_count: "images_count",
    o_counter: "o_counter",
  };
  allColumns.forEach((column) => {
    column.sortBy = columnSorts[column.value];
  });
  const metricKeys = [
    "sex_unique_partners",
    "oral_unique_partners",
    "facial_unique_partners",
    "sex_scenes_count",
    "oral_scenes_count",
    "solo_scenes_count",
    "facial_scenes_count",
    "sex_activity_percent",
    "oral_activity_percent",
    "solo_activity_percent",
  ];
  if (
    props.sortBy &&
    !allColumns.some((c) => c.sortBy === props.sortBy) &&
    !metricKeys.includes(props.sortBy)
  )
    metricKeys.push(props.sortBy);
  metricKeys.forEach((key) => {
    const definition = getPerformerSortMetricDefinitionCustom(key);
    if (!definition || definition.format === "none") return;
    allColumns.push({
      value: key,
      sortBy: key,
      label: intl.formatMessage({ id: definition.messageID }),
      render: (performer) => {
        const metric = getPerformerSortMetricCustom(
          key,
          performer,
          roleStats.get(performer.id),
          key === props.sortBy ? sortValues.get(performer.id) : undefined
        );
        return (
          <span className="list-table-metric">
            <SortMetricValueCustom
              format={definition.format}
              value={metric?.value}
            />
          </span>
        );
      },
    });
  });

  const defaultColumns = PERFORMER_BROWSE_COLUMNS_CUSTOM; // CUSTOM: compact browsing preset

  const { selectedColumns, saveColumns } = useTableColumns(
    TABLE_NAME,
    defaultColumns
  );

  const columnRenderFuncs: Record<
    string,
    (scene: PerformerListData, index: number) => React.ReactNode
  > = {};
  allColumns.forEach((col) => {
    if (col.render) {
      columnRenderFuncs[col.value] = col.render;
    }
  });

  function renderCell(
    column: IColumn,
    performer: PerformerListData,
    index: number
  ) {
    const render = columnRenderFuncs[column.value];

    if (render) return render(performer, index);
  }

  return (
    <>
      {/* CUSTOM: presets are explicit, so existing saved preferences survive. */}
      <ButtonGroup size="sm" className="mb-2" aria-label="Table presets">
        <Button
          variant="secondary"
          onClick={() => saveColumns(PERFORMER_BROWSE_COLUMNS_CUSTOM)}
        >
          Browse
        </Button>
        <Button
          variant="secondary"
          onClick={() => saveColumns(PERFORMER_METRICS_COLUMNS_CUSTOM)}
        >
          Metrics
        </Button>
      </ButtonGroup>
      <ListTable
        className="performer-table"
        items={props.performers}
        allColumns={allColumns}
        columns={selectedColumns}
        setColumns={(c) => saveColumns(c)}
        selectedIds={props.selectedIds}
        onSelectChange={props.onSelectChange}
        renderCell={renderCell}
        // CUSTOM
        extraColumns={sortColumnExtrasCustom(
          allColumns,
          selectedColumns,
          props.sortBy
        )}
        sortBy={props.sortBy}
        sortDirection={props.sortDirection}
        onSort={props.onSort}
      />
    </>
  );
};
