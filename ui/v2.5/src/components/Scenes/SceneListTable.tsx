import React from "react";
import { Link } from "react-router-dom";
import * as GQL from "src/core/generated-graphql";
import NavUtils from "src/utils/navigation";
import TextUtils from "src/utils/text";
import { FormattedMessage, useIntl } from "react-intl";
import { objectTitle } from "src/core/files";
import { galleryTitle } from "src/core/galleries";
import SceneQueue from "src/models/sceneQueue";
import { RatingSystem } from "../Shared/Rating/RatingSystem";
import { IColumn, ListTable } from "../List/ListTable";
import { useTableColumns } from "src/hooks/useTableColumns";
import { FileSize } from "../Shared/FileSize";
// CUSTOM: begin
import { sortColumnExtrasCustom } from "../List/listTableSort_custom";
import { useSceneMetricColumnCustom } from "./sceneListTableColumns_custom";
// CUSTOM: end

interface ISceneListTableProps {
  scenes: GQL.SlimSceneDataFragment[];
  queue?: SceneQueue;
  selectedIds: Set<string>;
  onSelectChange: (id: string, selected: boolean, shiftKey: boolean) => void;
  // CUSTOM: begin - header sorting
  sortBy?: string;
  sortDirection?: GQL.SortDirectionEnum;
  onSort?: (sortBy: string) => void;
  // CUSTOM: end
}

const TABLE_NAME = "scenes";

export const SceneListTable: React.FC<ISceneListTableProps> = (
  props: ISceneListTableProps
) => {
  const intl = useIntl();
  const metricColumn = useSceneMetricColumnCustom(); // CUSTOM

  const CoverImageCell = (scene: GQL.SlimSceneDataFragment, index: number) => {
    const title = objectTitle(scene);
    const sceneLink = props.queue
      ? props.queue.makeLink(scene.id, { sceneIndex: index })
      : `/scenes/${scene.id}`;

    return (
      <Link to={sceneLink}>
        <img
          loading="lazy"
          className="image-thumbnail"
          alt={title}
          src={scene.paths.screenshot ?? ""}
        />
      </Link>
    );
  };

  const TitleCell = (scene: GQL.SlimSceneDataFragment, index: number) => {
    const title = objectTitle(scene);
    const sceneLink = props.queue
      ? props.queue.makeLink(scene.id, { sceneIndex: index })
      : `/scenes/${scene.id}`;

    return (
      <Link to={sceneLink} title={title}>
        <span className="ellips-data">{title}</span>
      </Link>
    );
  };

  const DateCell = (scene: GQL.SlimSceneDataFragment) => (
    <>{scene.effective_date ?? scene.date}</>
  );
  {
    /* CUSTOM */
  }

  const RatingCell = (scene: GQL.SlimSceneDataFragment) => (
    <RatingSystem value={scene.rating100} disabled />
  );

  const DurationCell = (scene: GQL.SlimSceneDataFragment) => {
    const file = scene.files.length > 0 ? scene.files[0] : undefined;
    return file?.duration && TextUtils.secondsToTimestamp(file.duration);
  };

  const TagCell = (scene: GQL.SlimSceneDataFragment) => (
    <ul className="comma-list overflowable">
      {scene.tags.map((tag) => (
        <li key={tag.id}>
          <Link to={NavUtils.makeTagScenesUrl(tag)}>
            <span>{tag.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );

  const PerformersCell = (scene: GQL.SlimSceneDataFragment) => (
    <ul className="comma-list overflowable">
      {scene.performers.map((performer) => (
        <li key={performer.id}>
          <Link to={NavUtils.makePerformerScenesUrl(performer)}>
            <span>{performer.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );

  const StudioCell = (scene: GQL.SlimSceneDataFragment) => {
    if (scene.studio) {
      return (
        <Link
          to={NavUtils.makeStudioScenesUrl(scene.studio)}
          title={scene.studio.name}
        >
          <span className="ellips-data">{scene.studio.name}</span>
        </Link>
      );
    }
  };

  const GroupCell = (scene: GQL.SlimSceneDataFragment) => (
    <ul className="comma-list overflowable">
      {scene.groups.map((sceneGroup) => (
        <li key={sceneGroup.group.id}>
          <Link to={NavUtils.makeGroupScenesUrl(sceneGroup.group)}>
            <span className="ellips-data">{sceneGroup.group.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );

  const GalleriesCell = (scene: GQL.SlimSceneDataFragment) => (
    <ul className="comma-list overflowable">
      {scene.galleries.map((gallery) => (
        <li key={gallery.id}>
          <Link to={`/galleries/${gallery.id}`}>
            <span>{galleryTitle(gallery)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );

  const PlayCountCell = (scene: GQL.SlimSceneDataFragment) => (
    <FormattedMessage
      id="plays"
      values={{ value: intl.formatNumber(scene.play_count ?? 0) }}
    />
  );

  const PlayDurationCell = (scene: GQL.SlimSceneDataFragment) => (
    <>{TextUtils.secondsToTimestamp(scene.play_duration ?? 0)}</>
  );

  const ResolutionCell = (scene: GQL.SlimSceneDataFragment) => (
    <ul className="comma-list">
      {scene.files.map((file) => (
        <li key={file.id}>
          <span> {TextUtils.resolution(file?.width, file?.height)}</span>
        </li>
      ))}
    </ul>
  );

  const FileSizeCell = (scene: GQL.SlimSceneDataFragment) => (
    <ul className="comma-list">
      {scene.files.map((file) => (
        <li key={file.id}>
          <FileSize size={file.size} />
        </li>
      ))}
    </ul>
  );

  const FrameRateCell = (scene: GQL.SlimSceneDataFragment) => (
    <ul className="comma-list">
      {scene.files.map((file) => (
        <li key={file.id}>
          <span>
            <FormattedMessage
              id="frames_per_second"
              values={{ value: intl.formatNumber(file.frame_rate ?? 0) }}
            />
          </span>
        </li>
      ))}
    </ul>
  );

  const BitRateCell = (scene: GQL.SlimSceneDataFragment) => (
    <ul className="comma-list">
      {scene.files.map((file) => (
        <li key={file.id}>
          <span>
            <FormattedMessage
              id="megabits_per_second"
              values={{
                value: intl.formatNumber((file.bit_rate ?? 0) / 1000000, {
                  maximumFractionDigits: 2,
                }),
              }}
            />
          </span>
        </li>
      ))}
    </ul>
  );

  const AudioCodecCell = (scene: GQL.SlimSceneDataFragment) => (
    <ul className="comma-list over">
      {scene.files.map((file) => (
        <li key={file.id}>
          <span>{file.audio_codec}</span>
        </li>
      ))}
    </ul>
  );

  const VideoCodecCell = (scene: GQL.SlimSceneDataFragment) => (
    <ul className="comma-list">
      {scene.files.map((file) => (
        <li key={file.id}>
          <span>{file.video_codec}</span>
        </li>
      ))}
    </ul>
  );

  const PathCell = (scene: GQL.SlimSceneDataFragment) => (
    <ul className="newline-list overflowable TruncatedText">
      {scene.files.map((file) => (
        <li key={file.id}>
          <span>{file.path}</span>
        </li>
      ))}
    </ul>
  );

  interface IColumnSpec {
    value: string;
    label: string;
    defaultShow?: boolean;
    mandatory?: boolean;
    sortBy?: string; // CUSTOM
    render?: (
      scene: GQL.SlimSceneDataFragment,
      index: number
    ) => React.ReactNode;
  }

  const allColumns: IColumnSpec[] = [
    {
      value: "cover_image",
      label: intl.formatMessage({ id: "cover_image" }),
      defaultShow: true,
      render: CoverImageCell,
    },
    {
      value: "title",
      label: intl.formatMessage({ id: "title" }),
      defaultShow: true,
      mandatory: true,
      sortBy: "title", // CUSTOM
      render: TitleCell,
    },
    {
      value: "date",
      label: intl.formatMessage({ id: "date" }),
      defaultShow: true,
      sortBy: "effective_date", // CUSTOM: the cell shows the effective date
      render: DateCell,
    },
    {
      value: "rating",
      label: intl.formatMessage({ id: "rating" }),
      defaultShow: true,
      sortBy: "rating", // CUSTOM
      render: RatingCell,
    },
    {
      value: "scene_code",
      label: intl.formatMessage({ id: "scene_code" }),
      sortBy: "code", // CUSTOM
      render: (s) => <>{s.code}</>,
    },
    {
      value: "duration",
      label: intl.formatMessage({ id: "duration" }),
      defaultShow: true,
      sortBy: "duration", // CUSTOM
      render: DurationCell,
    },
    {
      value: "studio",
      label: intl.formatMessage({ id: "studio" }),
      sortBy: "studio", // CUSTOM: hidden by default
      render: StudioCell,
    },
    {
      value: "performers",
      label: intl.formatMessage({ id: "performers" }), // CUSTOM: hidden by default
      render: PerformersCell,
    },
    metricColumn("performer_count", true), // CUSTOM
    {
      value: "tags",
      label: intl.formatMessage({ id: "tags" }), // CUSTOM: hidden by default
      render: TagCell,
    },
    {
      value: "groups",
      label: intl.formatMessage({ id: "groups" }), // CUSTOM: hidden by default
      render: GroupCell,
    },
    {
      value: "galleries",
      label: intl.formatMessage({ id: "galleries" }), // CUSTOM: hidden by default
      render: GalleriesCell,
    },
    {
      value: "play_count",
      label: intl.formatMessage({ id: "play_count" }),
      sortBy: "play_count", // CUSTOM
      render: PlayCountCell,
    },
    {
      value: "play_duration",
      label: intl.formatMessage({ id: "play_duration" }),
      sortBy: "play_duration", // CUSTOM
      render: PlayDurationCell,
    },
    // CUSTOM: StashDB Matches
    {
      value: "stashdb_matches",
      label: intl.formatMessage({ id: "stashdb_matches" }),
      sortBy: "stashdb_matches",
      render: (s) => <>{s.stashdb_matches}</>,
    },
    // CUSTOM: begin - O Count shown by default; activity, quality, and marker count columns
    metricColumn("o_counter", true),
    metricColumn("sex_activity_percent"),
    metricColumn("oral_activity_percent"),
    metricColumn("solo_activity_percent"),
    metricColumn("outstanding_activity_percent"),
    metricColumn("standard_activity_percent"),
    metricColumn("unclassified_activity_percent"),
    metricColumn("unusable_activity_percent"),
    metricColumn("orgasm_count"),
    metricColumn("really_hot_orgasm_count"),
    metricColumn("facial_count"),
    metricColumn("really_hot_facial_count"),
    // CUSTOM: end
    {
      value: "resolution",
      label: intl.formatMessage({ id: "resolution" }),
      sortBy: "resolution", // CUSTOM
      render: ResolutionCell,
    },
    {
      value: "path",
      label: intl.formatMessage({ id: "path" }),
      sortBy: "path", // CUSTOM
      render: PathCell,
    },
    {
      value: "filesize",
      label: intl.formatMessage({ id: "filesize" }),
      sortBy: "filesize", // CUSTOM
      render: FileSizeCell,
    },
    {
      value: "framerate",
      label: intl.formatMessage({ id: "framerate" }),
      sortBy: "framerate", // CUSTOM
      render: FrameRateCell,
    },
    {
      value: "bitrate",
      label: intl.formatMessage({ id: "bitrate" }),
      sortBy: "bitrate", // CUSTOM
      render: BitRateCell,
    },
    {
      value: "video_codec",
      label: intl.formatMessage({ id: "video_codec" }),
      render: VideoCodecCell,
    },
    {
      value: "audio_codec",
      label: intl.formatMessage({ id: "audio_codec" }),
      render: AudioCodecCell,
    },
  ];

  const defaultColumns = allColumns
    .filter((col) => col.defaultShow)
    .map((col) => col.value);

  const { selectedColumns, saveColumns } = useTableColumns(
    TABLE_NAME,
    defaultColumns
  );

  // CUSTOM: show the active sort's column even when it is not saved
  const extraColumns = sortColumnExtrasCustom(
    allColumns,
    selectedColumns,
    props.sortBy
  );

  const columnRenderFuncs: Record<
    string,
    (scene: GQL.SlimSceneDataFragment, index: number) => React.ReactNode
  > = {};
  allColumns.forEach((col) => {
    if (col.render) {
      columnRenderFuncs[col.value] = col.render;
    }
  });

  function renderCell(
    column: IColumn,
    scene: GQL.SlimSceneDataFragment,
    index: number
  ) {
    const render = columnRenderFuncs[column.value];

    if (render) return render(scene, index);
  }

  return (
    <ListTable
      className="scene-table"
      items={props.scenes}
      allColumns={allColumns}
      columns={selectedColumns}
      setColumns={(c) => saveColumns(c)}
      selectedIds={props.selectedIds}
      onSelectChange={props.onSelectChange}
      renderCell={renderCell}
      // CUSTOM: header sorting
      extraColumns={extraColumns}
      sortBy={props.sortBy}
      sortDirection={props.sortDirection}
      onSort={props.onSort}
    />
  );
};
