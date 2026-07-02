import React, { useEffect, useMemo } from "react";
import { Badge, Button, Form } from "react-bootstrap";
import cx from "classnames";
import Select, { MultiValue, SingleValue } from "react-select";
import { faUser } from "@fortawesome/free-solid-svg-icons";
import * as GQL from "src/core/generated-graphql";
import { Icon } from "src/components/Shared/Icon";
import TextUtils from "src/utils/text";
import { markerTitle } from "src/core/markers";
import { useConfigurationContext } from "src/hooks/Config";
import { getRatingCardClass } from "src/utils/ratingCardStyles_custom";
import {
  compareActivityTypeSceneMarkers,
  getActivityTypeSectionMarkerTag,
  getActivityTypeSectionMarkerTagId,
  getActivityTypeSectionTagIds,
  getActivityTypeTagIds,
  groupActivityTypeSceneMarkers,
  isActivityTypeSectionSceneMarker,
  isActivityTypeSceneMarker,
  type IActivityTypeSceneMarkerGroup,
} from "./sceneMarkerActivityType_custom";
import {
  getChronologicalSceneMarkerPerformers,
  getChronologicalSceneMarkerHighlightPerformerOrgasmRank,
  getChronologicalSceneMarkerTags,
  getCompatibleChronologicalSceneMarkerTags,
  groupChronologicalSceneMarkerHighlights,
  timestampBelongsToSceneMarker,
  type ISceneMarkerChronologyDerivedWindow,
  type ISceneMarkerChronologyHighlightGroup,
  type ISceneMarkerChronologyHighlightPerformer,
  type ISceneMarkerChronologyHighlightSegment,
  type ISceneMarkerChronologySearchFilters,
  type ISceneMarkerChronologySearchPerformer,
  type ISceneMarkerChronologySearchTag,
} from "./sceneMarkerChronologySearch_custom";

interface ISceneMarkersChronologicalPanel {
  markers: GQL.SceneMarkerDataFragment[];
  allMarkers: GQL.SceneMarkerDataFragment[];
  search: ISceneMarkerChronologySearchFilters;
  onSearchChange: (search: ISceneMarkerChronologySearchFilters) => void;
  activeTab: SceneMarkerChronologyTabKey;
  selectedMarkerIds: Set<string>;
  derivedWindows?: Array<
    ISceneMarkerChronologyDerivedWindow<GQL.SceneMarkerDataFragment>
  >;
  selectedDerivedWindowKeys?: Set<string>;
  onClickMarker: (marker: GQL.SceneMarkerDataFragment) => void;
  onEdit: (marker: GQL.SceneMarkerDataFragment) => void;
  onSelectMarker: (id: string, selected: boolean) => void;
  onSelectMarkers: (ids: string[], selected: boolean) => void;
  onSelectDerivedWindow?: (key: string, selected: boolean) => void;
  currentTimestamp?: number;
}

type SearchSelectEntity = {
  id: string;
  name?: string | null;
};

type SearchSelectOption<T extends SearchSelectEntity> = {
  value: string;
  label: string;
  object: T;
};

export type SceneMarkerChronologyTabKey = "activity" | "highlights";
type ActivityTypeSectionKey =
  | "oral"
  | "sex"
  | "solo"
  | "feet"
  | "orgasm"
  | "facial";

interface IActivityTypeSection {
  key: ActivityTypeSectionKey;
  label: string;
  markers: GQL.SceneMarkerDataFragment[];
}

type ActivityTypePerformer =
  GQL.SceneMarkerDataFragment["top_performers"][number];

const defaultMarkerDurationSeconds = 20;
type MarkerRatingCardClassGetter = (
  marker: GQL.SceneMarkerDataFragment
) => string;

function markerEndSeconds(
  marker: Pick<GQL.SceneMarkerDataFragment, "seconds" | "end_seconds">
) {
  return marker.end_seconds ?? marker.seconds + defaultMarkerDurationSeconds;
}

function sumMergedMarkerDurations(
  markers: Array<Pick<GQL.SceneMarkerDataFragment, "seconds" | "end_seconds">>
) {
  const intervals = markers
    .map((marker) => ({
      start: marker.seconds,
      end: markerEndSeconds(marker),
    }))
    .filter((interval) => interval.end > interval.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Array<{ start: number; end: number }> = [];

  intervals.forEach((interval) => {
    const last = merged[merged.length - 1];
    if (!last || interval.start > last.end) {
      merged.push({ ...interval });
      return;
    }

    last.end = Math.max(last.end, interval.end);
  });

  return merged.reduce(
    (sum, interval) => sum + interval.end - interval.start,
    0
  );
}

function formatMarkerDuration(seconds: number) {
  return TextUtils.formatDurationRange(seconds);
}

interface ISearchSingleSelect<T extends SearchSelectEntity> {
  className?: string;
  noOptionsMessage?: string;
  onSelect: (items: T[]) => void;
  options: T[];
  placeholder: string;
  value?: T;
}

interface ISearchMultiSelect<T extends SearchSelectEntity> {
  className?: string;
  noOptionsMessage?: string;
  onSelect: (items: T[]) => void;
  options: T[];
  placeholder: string;
  values: T[];
}

function toSearchSelectOption<T extends SearchSelectEntity>(
  item: T
): SearchSelectOption<T> {
  return {
    label: item.name ?? item.id,
    object: item,
    value: item.id,
  };
}

const SearchSingleSelect = <T extends SearchSelectEntity>({
  className,
  noOptionsMessage = "None",
  onSelect,
  options,
  placeholder,
  value,
}: ISearchSingleSelect<T>) => {
  const selectOptions = useMemo(
    () => options.map(toSearchSelectOption),
    [options]
  );
  const selectedOption = value ? toSearchSelectOption(value) : null;

  return (
    <Select<SearchSelectOption<T>, false>
      className={cx("react-select", className)}
      classNamePrefix="react-select"
      isClearable
      options={selectOptions}
      placeholder={placeholder}
      value={selectedOption}
      noOptionsMessage={() => noOptionsMessage}
      onChange={(selected: SingleValue<SearchSelectOption<T>>) =>
        onSelect(selected ? [selected.object] : [])
      }
    />
  );
};

const SearchMultiSelect = <T extends SearchSelectEntity>({
  className,
  noOptionsMessage = "None",
  onSelect,
  options,
  placeholder,
  values,
}: ISearchMultiSelect<T>) => {
  const selectOptions = useMemo(
    () => options.map(toSearchSelectOption),
    [options]
  );
  const selectedOptions = values.map(toSearchSelectOption);

  return (
    <Select<SearchSelectOption<T>, true>
      className={cx("react-select", className)}
      classNamePrefix="react-select"
      isClearable
      isMulti
      options={selectOptions}
      placeholder={placeholder}
      value={selectedOptions}
      noOptionsMessage={() => noOptionsMessage}
      onChange={(selected: MultiValue<SearchSelectOption<T>>) =>
        onSelect(selected.map((item) => item.object))
      }
    />
  );
};

const ActivityTypePerformerTile: React.FC<{
  performer: ActivityTypePerformer;
  role?: "Top" | "Bottom";
  className?: string;
  title?: string;
  children?: React.ReactNode;
}> = ({ performer, role, className, title, children }) => (
  <div
    key={`${role ?? "performer"}-${performer.id}`}
    className={cx(
      "scene-marker-activity-performer",
      role && `scene-marker-activity-performer-${role.toLowerCase()}`,
      className
    )}
    title={title ?? (role ? `${role}: ${performer.name}` : performer.name)}
  >
    <div className="scene-marker-activity-performer-image">
      {performer.image_path ? (
        <img src={performer.image_path} alt={performer.name} />
      ) : (
        <Icon icon={faUser} />
      )}
    </div>
    <div className="scene-marker-activity-performer-name">{performer.name}</div>
    {children}
  </div>
);

interface ITimelineMarkerBox {
  marker: GQL.SceneMarkerDataFragment;
  selectedMarkerIds: Set<string>;
  currentTimestamp?: number;
  onClickMarker: (marker: GQL.SceneMarkerDataFragment) => void;
  onEdit: (marker: GQL.SceneMarkerDataFragment) => void;
  onSelectMarker: (id: string, selected: boolean) => void;
  getMarkerRatingCardClass: MarkerRatingCardClassGetter;
}

const TimelineMarkerBox: React.FC<ITimelineMarkerBox> = ({
  marker,
  selectedMarkerIds,
  currentTimestamp,
  onClickMarker,
  onEdit,
  onSelectMarker,
  getMarkerRatingCardClass,
}) => {
  const isCurrentMarker = timestampBelongsToSceneMarker(
    marker,
    currentTimestamp
  );

  const renderMarkerTime = () => {
    if (marker.end_seconds !== null && marker.end_seconds !== undefined) {
      return (
        <>
          <Button
            className="scene-marker-activity-marker-time-part p-0"
            variant="link"
            onClick={(event) => {
              event.stopPropagation();
              onClickMarker(marker);
            }}
            title="Seek to start"
          >
            {TextUtils.secondsToTimestamp(marker.seconds)}
          </Button>
          <span className="scene-marker-activity-marker-time-separator">-</span>
          <Button
            className="scene-marker-activity-marker-time-part p-0"
            variant="link"
            onClick={(event) => {
              event.stopPropagation();
              onClickMarker({
                ...marker,
                seconds: marker.end_seconds ?? marker.seconds,
              });
            }}
            title="Seek to end"
          >
            {TextUtils.secondsToTimestamp(marker.end_seconds)}
          </Button>
        </>
      );
    }

    return (
      <Button
        className="scene-marker-activity-marker-time-part p-0"
        variant="link"
        onClick={(event) => {
          event.stopPropagation();
          onClickMarker(marker);
        }}
        title="Seek to start"
      >
        {TextUtils.secondsToTimestamp(marker.seconds)}
      </Button>
    );
  };

  return (
    <div
      key={marker.id}
      data-scene-marker-id={marker.id}
      className={cx(
        "scene-marker-activity-marker-box",
        getMarkerRatingCardClass(marker),
        {
          "scene-marker-activity-marker-box-current": isCurrentMarker,
        }
      )}
      onClick={(event) => {
        event.stopPropagation();
        onClickMarker(marker);
      }}
    >
      <div
        className="scene-marker-activity-marker-time"
        title={`Seek to ${markerTitle(marker)}`}
      >
        {renderMarkerTime()}
      </div>
      <Button
        className="scene-marker-activity-marker-edit p-0"
        variant="link"
        onClick={(event) => {
          event.stopPropagation();
          onEdit(marker);
        }}
      >
        Edit
      </Button>
      <Form.Check
        className="scene-marker-activity-marker-checkbox"
        type="checkbox"
        checked={selectedMarkerIds.has(marker.id)}
        onClick={(event: React.MouseEvent<HTMLInputElement>) =>
          event.stopPropagation()
        }
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onSelectMarker(marker.id, e.currentTarget.checked)
        }
      />
    </div>
  );
};

interface IActivityTypeGroupCard {
  group: IActivityTypeSceneMarkerGroup<GQL.SceneMarkerDataFragment>;
  selectedMarkerIds: Set<string>;
  currentTimestamp?: number;
  onClickMarker: (marker: GQL.SceneMarkerDataFragment) => void;
  onEdit: (marker: GQL.SceneMarkerDataFragment) => void;
  onSelectMarker: (id: string, selected: boolean) => void;
  onSelectMarkers: (ids: string[], selected: boolean) => void;
  getMarkerRatingCardClass: MarkerRatingCardClassGetter;
}

const ActivityTypeGroupCard: React.FC<IActivityTypeGroupCard> = ({
  group,
  selectedMarkerIds,
  currentTimestamp,
  onClickMarker,
  onEdit,
  onSelectMarker,
  onSelectMarkers,
  getMarkerRatingCardClass,
}) => {
  const hasPerformers =
    group.topPerformers.length > 0 || group.bottomPerformers.length > 0;
  const groupMarkerIds = group.markers.map((marker) => marker.id);
  const allGroupSelected =
    groupMarkerIds.length > 0 &&
    groupMarkerIds.every((id) => selectedMarkerIds.has(id));
  const groupDurationSeconds = sumMergedMarkerDurations(group.markers);
  const isCurrentGroup = group.markers.some((marker) =>
    timestampBelongsToSceneMarker(marker, currentTimestamp)
  );
  const groupRatingCardClass =
    group.markers.length === 1
      ? getMarkerRatingCardClass(group.markers[0])
      : "";

  return (
    <div
      className={cx("scene-marker-activity-config-card", groupRatingCardClass, {
        "scene-marker-activity-config-card-current": isCurrentGroup,
      })}
    >
      <div className="scene-marker-activity-config-header">
        <span className="scene-marker-activity-config-summary">
          {formatMarkerDuration(groupDurationSeconds)}
        </span>
        <Form.Check
          className="scene-marker-activity-config-checkbox"
          type="checkbox"
          checked={allGroupSelected}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onSelectMarkers(groupMarkerIds, e.currentTarget.checked)
          }
        />
      </div>
      <div className="scene-marker-activity-config-performers">
        {hasPerformers ? (
          <>
            {group.topPerformers.map((performer) => (
              <ActivityTypePerformerTile
                key={`top-${performer.id}`}
                performer={performer}
                role="Top"
              />
            ))}
            {group.bottomPerformers.map((performer) => (
              <ActivityTypePerformerTile
                key={`bottom-${performer.id}`}
                performer={performer}
                role="Bottom"
              />
            ))}
          </>
        ) : (
          <div className="scene-marker-activity-config-empty">
            No performers
          </div>
        )}
      </div>
      <div className="scene-marker-activity-config-markers">
        {group.markers.map((marker) => (
          <TimelineMarkerBox
            key={marker.id}
            marker={marker}
            selectedMarkerIds={selectedMarkerIds}
            currentTimestamp={currentTimestamp}
            onClickMarker={onClickMarker}
            onEdit={onEdit}
            onSelectMarker={onSelectMarker}
            getMarkerRatingCardClass={getMarkerRatingCardClass}
          />
        ))}
      </div>
    </div>
  );
};

interface IHighlightMarkerCard {
  group: ISceneMarkerChronologyHighlightGroup<GQL.SceneMarkerDataFragment>;
  orgasmTagId?: string;
  selectedMarkerIds: Set<string>;
  currentTimestamp?: number;
  onClickMarker: (marker: GQL.SceneMarkerDataFragment) => void;
  onEdit: (marker: GQL.SceneMarkerDataFragment) => void;
  onSelectMarkers: (ids: string[], selected: boolean) => void;
  getMarkerRatingCardClass: MarkerRatingCardClassGetter;
}

const HighlightPerformerTagPills: React.FC<{
  performer: ISceneMarkerChronologyHighlightPerformer<GQL.SceneMarkerDataFragment>;
}> = ({ performer }) => (
  <div className="scene-marker-highlight-performer-tags">
    {performer.topTags.map((tag) => (
      <Badge
        key={`top-${tag.id}`}
        variant="secondary"
        className="tag-badge scene-marker-highlight-tag-top"
      >
        {tag.name}
      </Badge>
    ))}
    {performer.bottomTags.map((tag) => (
      <Badge
        key={`bottom-${tag.id}`}
        variant="secondary"
        className="tag-badge scene-marker-highlight-tag-bottom"
      >
        {tag.name}
      </Badge>
    ))}
  </div>
);

const HighlightSegmentBox: React.FC<{
  segment: ISceneMarkerChronologyHighlightSegment<GQL.SceneMarkerDataFragment>;
  selectedMarkerIds: Set<string>;
  currentTimestamp?: number;
  onClickMarker: (marker: GQL.SceneMarkerDataFragment) => void;
  onEdit: (marker: GQL.SceneMarkerDataFragment) => void;
  onSelectMarkers: (ids: string[], selected: boolean) => void;
  getMarkerRatingCardClass: MarkerRatingCardClassGetter;
}> = ({
  segment,
  selectedMarkerIds,
  currentTimestamp,
  onClickMarker,
  onEdit,
  onSelectMarkers,
  getMarkerRatingCardClass,
}) => {
  const segmentMarkerIds = segment.markers.map((marker) => marker.id);
  const allSegmentSelected =
    segmentMarkerIds.length > 0 &&
    segmentMarkerIds.every((id) => selectedMarkerIds.has(id));
  const isCurrentSegment =
    currentTimestamp !== undefined &&
    currentTimestamp > 0 &&
    currentTimestamp >= segment.seconds &&
    currentTimestamp < segment.end_seconds;

  const seekToSegment = (seconds: number) => {
    onClickMarker({
      ...segment.representativeMarker,
      seconds,
    });
  };

  return (
    <div
      data-scene-marker-id={segment.representativeMarker.id}
      className={cx(
        "scene-marker-activity-marker-box",
        getMarkerRatingCardClass(segment.representativeMarker),
        {
          "scene-marker-activity-marker-box-current": isCurrentSegment,
        }
      )}
      onClick={(event) => {
        event.stopPropagation();
        seekToSegment(segment.seconds);
      }}
    >
      <div
        className="scene-marker-activity-marker-time"
        title={`Seek to ${TextUtils.secondsToTimestamp(segment.seconds)}`}
      >
        <Button
          className="scene-marker-activity-marker-time-part p-0"
          variant="link"
          onClick={(event) => {
            event.stopPropagation();
            seekToSegment(segment.seconds);
          }}
          title="Seek to segment start"
        >
          {TextUtils.secondsToTimestamp(segment.seconds)}
        </Button>
        <span className="scene-marker-activity-marker-time-separator">-</span>
        <Button
          className="scene-marker-activity-marker-time-part p-0"
          variant="link"
          onClick={(event) => {
            event.stopPropagation();
            seekToSegment(segment.end_seconds);
          }}
          title="Seek to segment end"
        >
          {TextUtils.secondsToTimestamp(segment.end_seconds)}
        </Button>
      </div>
      <Button
        className="scene-marker-activity-marker-edit p-0"
        variant="link"
        onClick={(event) => {
          event.stopPropagation();
          onEdit(segment.representativeMarker);
        }}
      >
        Edit
      </Button>
      <Form.Check
        className="scene-marker-activity-marker-checkbox"
        type="checkbox"
        checked={allSegmentSelected}
        onClick={(event: React.MouseEvent<HTMLInputElement>) =>
          event.stopPropagation()
        }
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          onSelectMarkers(segmentMarkerIds, event.currentTarget.checked)
        }
      />
    </div>
  );
};

const HighlightMarkerCard: React.FC<IHighlightMarkerCard> = ({
  group,
  orgasmTagId,
  selectedMarkerIds,
  currentTimestamp,
  onClickMarker,
  onEdit,
  onSelectMarkers,
  getMarkerRatingCardClass,
}) => {
  const isGroup = group.markers.length > 1;
  const marker = group.markers[0];
  const groupMarkerIds = group.markers.map((groupMarker) => groupMarker.id);
  const allGroupSelected =
    groupMarkerIds.length > 0 &&
    groupMarkerIds.every((id) => selectedMarkerIds.has(id));
  const hasPerformers = group.performers.length > 0;
  const isCurrentMarker = group.markers.some((groupMarker) =>
    timestampBelongsToSceneMarker(groupMarker, currentTimestamp)
  );
  const groupDurationSeconds = sumMergedMarkerDurations(group.markers);
  const title = isGroup
    ? `${group.markers.length} highlights`
    : markerTitle(marker);
  const groupRatingCardClass = isGroup ? "" : getMarkerRatingCardClass(marker);
  const displayPerformers = useMemo(
    () =>
      group.performers
        .map((performer, index) => ({ performer, index }))
        .sort(
          (a, b) =>
            getChronologicalSceneMarkerHighlightPerformerOrgasmRank(
              a.performer,
              orgasmTagId
            ) -
              getChronologicalSceneMarkerHighlightPerformerOrgasmRank(
                b.performer,
                orgasmTagId
              ) || a.index - b.index
        )
        .map(({ performer }) => performer),
    [group.performers, orgasmTagId]
  );

  return (
    <div
      className={cx(
        "scene-marker-activity-config-card",
        "scene-marker-highlight-config-card",
        "scene-marker-highlight-marker-card",
        groupRatingCardClass,
        {
          "scene-marker-highlight-marker-card-current": isCurrentMarker,
        }
      )}
      title={title}
    >
      <div className="scene-marker-highlight-main-row">
        <span className="scene-marker-highlight-title">{title}</span>
        {isGroup && (
          <>
            <span className="scene-marker-highlight-timestamp">
              {formatMarkerDuration(groupDurationSeconds)}
            </span>
            <Form.Check
              className="scene-marker-highlight-checkbox"
              type="checkbox"
              checked={allGroupSelected}
              onClick={(event: React.MouseEvent<HTMLInputElement>) =>
                event.stopPropagation()
              }
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                onSelectMarkers(groupMarkerIds, event.currentTarget.checked)
              }
            />
          </>
        )}
      </div>
      <div className="scene-marker-activity-config-performers">
        {hasPerformers ? (
          displayPerformers.map((performer) => (
            <ActivityTypePerformerTile
              key={performer.performer.id}
              performer={performer.performer}
              className="scene-marker-highlight-performer"
            >
              <HighlightPerformerTagPills performer={performer} />
            </ActivityTypePerformerTile>
          ))
        ) : (
          <div className="scene-marker-activity-config-empty">
            No performers
          </div>
        )}
      </div>
      <div className="scene-marker-activity-config-markers">
        {group.segments.map((segment) => (
          <HighlightSegmentBox
            key={segment.key}
            segment={segment}
            selectedMarkerIds={selectedMarkerIds}
            currentTimestamp={currentTimestamp}
            onClickMarker={onClickMarker}
            onEdit={onEdit}
            onSelectMarkers={onSelectMarkers}
            getMarkerRatingCardClass={getMarkerRatingCardClass}
          />
        ))}
      </div>
    </div>
  );
};

export const SceneMarkersChronologicalPanel: React.FC<
  ISceneMarkersChronologicalPanel
> = ({
  markers,
  allMarkers,
  search,
  onSearchChange,
  activeTab,
  selectedMarkerIds,
  derivedWindows = [],
  selectedDerivedWindowKeys = new Set<string>(),
  onClickMarker,
  onEdit,
  onSelectMarker,
  onSelectMarkers,
  onSelectDerivedWindow,
  currentTimestamp,
}) => {
  const { configuration } = useConfigurationContext();
  const firstTagOptions = useMemo(
    () => getChronologicalSceneMarkerTags(allMarkers),
    [allMarkers]
  );
  const nextTagOptions = useMemo(
    () => getCompatibleChronologicalSceneMarkerTags(allMarkers, search.tags),
    [allMarkers, search.tags]
  );
  const tagSelectCount = Math.max(
    1,
    search.tags.length + (nextTagOptions.length > 0 ? 1 : 0)
  );
  const topPerformerOptions = useMemo(
    () => getChronologicalSceneMarkerPerformers(allMarkers, search.tags, "top"),
    [allMarkers, search.tags]
  );
  const bottomPerformerOptions = useMemo(
    () =>
      getChronologicalSceneMarkerPerformers(allMarkers, search.tags, "bottom"),
    [allMarkers, search.tags]
  );
  const activityTypeSectionTagIds = useMemo(
    () => getActivityTypeSectionTagIds(configuration?.ui.roleTagIds),
    [configuration?.ui.roleTagIds]
  );
  const activityTypeTagIds = useMemo(
    () => getActivityTypeTagIds(configuration?.ui.roleTagIds),
    [configuration?.ui.roleTagIds]
  );
  const getMarkerRatingCardClass = useMemo<MarkerRatingCardClassGetter>(
    () => (marker) => {
      const markerTags = [marker.primary_tag, ...marker.tags].filter(
        (tag) =>
          activeTab !== "activity" ||
          tag.id !== configuration?.ui.roleTagIds?.goatTagId
      );

      return getRatingCardClass({
        tags: markerTags,
        goatTagId:
          activeTab === "activity"
            ? undefined
            : configuration?.ui.roleTagIds?.goatTagId,
        theme: configuration?.ui.ratingCardTheme,
        thresholds: configuration?.ui.ratingCardThresholds,
        overrideTagIds: configuration?.ui.ratingCardOverrideTagIds,
      });
    },
    [
      activeTab,
      configuration?.ui.ratingCardOverrideTagIds,
      configuration?.ui.ratingCardTheme,
      configuration?.ui.ratingCardThresholds,
      configuration?.ui.roleTagIds?.goatTagId,
    ]
  );
  const highlights = useMemo(
    () =>
      markers.filter(
        (marker) => !isActivityTypeSceneMarker(marker, activityTypeTagIds)
      ),
    [activityTypeTagIds, markers]
  );
  const highlightGroups = useMemo(
    () => groupChronologicalSceneMarkerHighlights(highlights, allMarkers),
    [allMarkers, highlights]
  );
  const activityTypeMarkers = useMemo(
    () =>
      markers
        .filter((marker) =>
          isActivityTypeSectionSceneMarker(marker, activityTypeSectionTagIds)
        )
        .sort((a, b) =>
          compareActivityTypeSceneMarkers(a, b, configuration?.ui.roleTagIds)
        ),
    [activityTypeSectionTagIds, configuration?.ui.roleTagIds, markers]
  );
  const activityTypeSections = useMemo<IActivityTypeSection[]>(() => {
    const roleTagIds = configuration?.ui.roleTagIds;
    const sectionDefinitions: Array<{
      key: ActivityTypeSectionKey;
      tagId?: string;
      fallbackLabel: string;
    }> = [
      { key: "oral", tagId: roleTagIds?.oralTagId, fallbackLabel: "Oral" },
      { key: "sex", tagId: roleTagIds?.sexTagId, fallbackLabel: "Sex" },
      { key: "solo", tagId: roleTagIds?.soloTagId, fallbackLabel: "Solo" },
      { key: "feet", tagId: roleTagIds?.feetTagId, fallbackLabel: "Feet" },
      {
        key: "orgasm",
        tagId: roleTagIds?.orgasmTagId,
        fallbackLabel: "Orgasm",
      },
      {
        key: "facial",
        tagId: roleTagIds?.facialTagId,
        fallbackLabel: "Facial",
      },
    ];

    return sectionDefinitions
      .map(({ key, tagId, fallbackLabel }) => {
        const sectionMarkers = tagId
          ? activityTypeMarkers.filter(
              (marker) =>
                getActivityTypeSectionMarkerTagId(marker, roleTagIds) === tagId
            )
          : [];

        const sectionTag = sectionMarkers
          .map((marker) => getActivityTypeSectionMarkerTag(marker, roleTagIds))
          .find((tag): tag is NonNullable<typeof tag> => !!tag);

        return {
          key,
          label: sectionTag?.name ?? fallbackLabel,
          markers: sectionMarkers,
        };
      })
      .filter((section) => section.markers.length > 0);
  }, [activityTypeMarkers, configuration?.ui.roleTagIds]);

  const renderHighlightList = () => (
    <div className="scene-marker-chronology-list">
      {highlightGroups.length > 0 ? (
        highlightGroups.map((group) => (
          <HighlightMarkerCard
            key={group.key}
            group={group}
            orgasmTagId={configuration?.ui.roleTagIds?.orgasmTagId}
            selectedMarkerIds={selectedMarkerIds}
            currentTimestamp={currentTimestamp}
            onClickMarker={onClickMarker}
            onEdit={onEdit}
            onSelectMarkers={onSelectMarkers}
            getMarkerRatingCardClass={getMarkerRatingCardClass}
          />
        ))
      ) : (
        <div className="scene-marker-chronology-empty">
          No highlight markers found.
        </div>
      )}
    </div>
  );

  const renderDerivedWindows = () => {
    if (derivedWindows.length === 0 || !onSelectDerivedWindow) {
      return null;
    }

    return (
      <div className="scene-marker-derived-windows">
        <div className="scene-marker-derived-window-title">
          Derived overlap ranges
          <Badge
            variant="secondary"
            className="scene-marker-derived-window-count"
          >
            {derivedWindows.length}
          </Badge>
        </div>
        <div className="scene-marker-derived-window-list">
          {derivedWindows.map((window) => {
            const selected = selectedDerivedWindowKeys.has(window.key);

            return (
              <div
                className="scene-marker-derived-window-pill"
                key={window.key}
              >
                <span className="scene-marker-derived-window-kind">
                  Derived
                </span>
                <Button
                  className="scene-marker-derived-window-time-part p-0"
                  variant="link"
                  onClick={() =>
                    onClickMarker({
                      ...window.sourceMarker,
                      seconds: window.seconds,
                    })
                  }
                  title="Seek to derived range start"
                >
                  {TextUtils.secondsToTimestamp(window.seconds)}
                </Button>
                <span className="scene-marker-derived-window-separator">-</span>
                <Button
                  className="scene-marker-derived-window-time-part p-0"
                  variant="link"
                  onClick={() =>
                    onClickMarker({
                      ...window.sourceMarker,
                      seconds: window.end_seconds,
                    })
                  }
                  title="Seek to derived range end"
                >
                  {TextUtils.secondsToTimestamp(window.end_seconds)}
                </Button>
                <Form.Check
                  className="scene-marker-derived-window-checkbox"
                  type="checkbox"
                  checked={selected}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onSelectDerivedWindow(window.key, e.currentTarget.checked)
                  }
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderActivityTypeList = () => (
    <div className="scene-marker-chronology-list">
      {activityTypeSections.length > 0 ? (
        activityTypeSections.map((section) => {
          const sectionMarkerIds = section.markers.map((marker) => marker.id);
          const allSectionSelected =
            sectionMarkerIds.length > 0 &&
            sectionMarkerIds.every((id) => selectedMarkerIds.has(id));
          const sectionDurationSeconds = sumMergedMarkerDurations(
            section.markers
          );

          return (
            <React.Fragment key={section.key}>
              <div className="scene-marker-activity-group-header">
                <div className="scene-marker-activity-group-title">
                  <span>{section.label}</span>
                </div>
                <div className="scene-marker-activity-group-meta">
                  <span>{formatMarkerDuration(sectionDurationSeconds)}</span>
                  <Form.Check
                    className="scene-marker-activity-group-checkbox"
                    type="checkbox"
                    checked={allSectionSelected}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      onSelectMarkers(sectionMarkerIds, e.currentTarget.checked)
                    }
                  />
                </div>
              </div>
              {groupActivityTypeSceneMarkers(section.markers).map((group) => (
                <ActivityTypeGroupCard
                  key={group.key}
                  group={group}
                  selectedMarkerIds={selectedMarkerIds}
                  currentTimestamp={currentTimestamp}
                  onClickMarker={onClickMarker}
                  onEdit={onEdit}
                  onSelectMarker={onSelectMarker}
                  onSelectMarkers={onSelectMarkers}
                  getMarkerRatingCardClass={getMarkerRatingCardClass}
                />
              ))}
            </React.Fragment>
          );
        })
      ) : (
        <div className="scene-marker-chronology-empty">
          No activity type markers found.
        </div>
      )}
    </div>
  );

  useEffect(() => {
    const topPerformerIDs = new Set(
      topPerformerOptions.map((performer) => performer.id)
    );
    const bottomPerformerIDs = new Set(
      bottomPerformerOptions.map((performer) => performer.id)
    );
    const topPerformers = search.topPerformers.filter((performer) =>
      topPerformerIDs.has(performer.id)
    );
    const bottomPerformers = search.bottomPerformers.filter((performer) =>
      bottomPerformerIDs.has(performer.id)
    );

    if (
      topPerformers.length !== search.topPerformers.length ||
      bottomPerformers.length !== search.bottomPerformers.length
    ) {
      onSearchChange({ ...search, topPerformers, bottomPerformers });
    }
  }, [bottomPerformerOptions, onSearchChange, search, topPerformerOptions]);

  const getTagOptionsForIndex = (index: number) => {
    if (index === 0) {
      return firstTagOptions;
    }

    return getCompatibleChronologicalSceneMarkerTags(
      allMarkers,
      search.tags.slice(0, index)
    );
  };

  const onSetTagAtIndex = (
    index: number,
    tags: ISceneMarkerChronologySearchTag[]
  ) => {
    const selectedTag = tags[0];
    const nextTags = search.tags.slice(0, index);

    if (selectedTag) {
      nextTags.push(selectedTag);
    }

    onSearchChange({ ...search, tags: nextTags });
  };

  const onSetTopPerformers = (
    performers: ISceneMarkerChronologySearchPerformer[]
  ) => {
    onSearchChange({ ...search, topPerformers: performers });
  };

  const onSetBottomPerformers = (
    performers: ISceneMarkerChronologySearchPerformer[]
  ) => {
    onSearchChange({ ...search, bottomPerformers: performers });
  };

  const renderSearch = () => (
    <div className="scene-marker-chronology-search">
      <div className="scene-marker-chronology-search-tags">
        {Array.from({ length: tagSelectCount }, (_, index) => (
          <SearchSingleSelect
            key={index}
            className="scene-marker-chronology-tag-select"
            options={getTagOptionsForIndex(index)}
            value={search.tags[index]}
            onSelect={(tags) => onSetTagAtIndex(index, tags)}
            placeholder={index === 0 ? "Tags" : "Add tag"}
            noOptionsMessage="No matching tags"
          />
        ))}
      </div>
      <div className="scene-marker-chronology-search-performers">
        <div className="scene-marker-chronology-search-performer">
          <SearchMultiSelect
            options={topPerformerOptions}
            values={search.topPerformers}
            onSelect={onSetTopPerformers}
            placeholder="Top"
            noOptionsMessage="No matching performers"
          />
        </div>
        <div className="scene-marker-chronology-search-performer">
          <SearchMultiSelect
            options={bottomPerformerOptions}
            values={search.bottomPerformers}
            onSelect={onSetBottomPerformers}
            placeholder="Bottom"
            noOptionsMessage="No matching performers"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="scene-marker-chronology">
      {activeTab === "highlights" && renderSearch()}
      {activeTab === "highlights" && renderDerivedWindows()}
      {activeTab === "activity"
        ? renderActivityTypeList()
        : renderHighlightList()}
    </div>
  );
};
