import React, { useEffect, useMemo } from "react";
import { Badge, Button, Form } from "react-bootstrap";
import cx from "classnames";
import Select, { MultiValue, SingleValue } from "react-select";
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import * as GQL from "src/core/generated-graphql";
import { Icon } from "src/components/Shared/Icon";
import { HoverPopover } from "src/components/Shared/HoverPopover";
import TextUtils from "src/utils/text";
import { markerTitle } from "src/core/markers";
import { useConfigurationContext } from "src/hooks/Config";
import {
  compareActivityTypeSceneMarkers,
  getActivityTypeSectionMarkerTag,
  getActivityTypeSectionMarkerTagId,
  getActivityTypeSectionTagIds,
  getActivityTypeTagIds,
  isActivityTypeSectionSceneMarker,
  isActivityTypeSceneMarker,
} from "./sceneMarkerActivityType_custom";
import {
  buildChronologicalSceneMarkerLayout,
  type IChronologicalSceneMarkerLayoutGroup,
} from "./sceneMarkerChronologyLayout_custom";
import {
  getChronologicalSceneMarkerPerformers,
  getChronologicalSceneMarkerTags,
  getCompatibleChronologicalSceneMarkerTags,
  groupChronologicalSceneMarkerHighlights,
  timestampBelongsToSceneMarker,
  type ISceneMarkerChronologyDerivedWindow,
  type ISceneMarkerChronologyHighlightGroup,
  type ISceneMarkerChronologyHighlightSegment,
  type ISceneMarkerChronologySearchFilters,
  type ISceneMarkerChronologySearchPerformer,
  type ISceneMarkerChronologySearchTag,
} from "./sceneMarkerChronologySearch_custom";
import {
  ActivityTypePerformerTile,
  SceneMarkerHighlightPerformersPopover,
  useSceneMarkerRatingCardClassGetter,
  type MarkerRatingCardClassGetter,
} from "./sceneMarkerHoverPopover_custom";

interface ISceneMarkersChronologicalPanel {
  markers: GQL.SceneMarkerDataFragment[];
  allMarkers: GQL.SceneMarkerDataFragment[];
  search: ISceneMarkerChronologySearchFilters;
  onSearchChange: (search: ISceneMarkerChronologySearchFilters) => void;
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
  focusedMarkerId?: string;
  markerWarningMessagesById?: Map<string, string[]>;
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

type ActivityTypeSectionKey =
  | "oral"
  | "sex"
  | "solo"
  | "feet"
  | "orgasm"
  | "facial"
  | "other-highlights";

interface IActivityTypeSection {
  key: ActivityTypeSectionKey;
  label: string;
  groups: Array<
    IChronologicalSceneMarkerLayoutGroup<GQL.SceneMarkerDataFragment>
  >;
  hideActivityPills?: boolean;
  fallbackHighlightGroups?: Array<
    ISceneMarkerChronologyHighlightGroup<GQL.SceneMarkerDataFragment>
  >;
}

const defaultMarkerDurationSeconds = 20;

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

function uniqueMarkerIds(
  markers: Array<Pick<GQL.SceneMarkerDataFragment, "id">>
) {
  return Array.from(new Set(markers.map((marker) => marker.id)));
}

function compareChronologicalMarkers(
  a: Pick<GQL.SceneMarkerDataFragment, "id" | "seconds" | "end_seconds">,
  b: Pick<GQL.SceneMarkerDataFragment, "id" | "seconds" | "end_seconds">
) {
  return (
    a.seconds - b.seconds ||
    markerEndSeconds(a) - markerEndSeconds(b) ||
    a.id.localeCompare(b.id)
  );
}

function compareChronologicalHighlightSegments(
  a: ISceneMarkerChronologyHighlightSegment<GQL.SceneMarkerDataFragment>,
  b: ISceneMarkerChronologyHighlightSegment<GQL.SceneMarkerDataFragment>
) {
  return (
    a.seconds - b.seconds ||
    a.end_seconds - b.end_seconds ||
    a.key.localeCompare(b.key)
  );
}

function highlightGroupMarkerIds(
  highlightGroups: Array<
    ISceneMarkerChronologyHighlightGroup<GQL.SceneMarkerDataFragment>
  >
) {
  return uniqueMarkerIds(highlightGroups.flatMap((group) => group.markers));
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

interface ITimelineMarkerBox {
  marker: GQL.SceneMarkerDataFragment;
  selectedMarkerIds: Set<string>;
  currentTimestamp?: number;
  focusedMarkerId?: string;
  warningMessages?: string[];
  onClickMarker: (marker: GQL.SceneMarkerDataFragment) => void;
  onEdit: (marker: GQL.SceneMarkerDataFragment) => void;
  onSelectMarker: (id: string, selected: boolean) => void;
  getMarkerRatingCardClass: MarkerRatingCardClassGetter;
}

const TimelineMarkerBox: React.FC<ITimelineMarkerBox> = ({
  marker,
  selectedMarkerIds,
  currentTimestamp,
  focusedMarkerId,
  warningMessages = [],
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
        "scene-marker-activity-type-pill",
        getMarkerRatingCardClass(marker),
        {
          "scene-marker-activity-marker-box-current": isCurrentMarker,
          "scene-marker-activity-marker-box-focused":
            focusedMarkerId === marker.id,
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
      {warningMessages.length > 0 && (
        <Icon
          icon={faExclamationTriangle}
          className="scene-marker-warning-icon"
          title={warningMessages.join("\n")}
        />
      )}
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
  group: IChronologicalSceneMarkerLayoutGroup<GQL.SceneMarkerDataFragment>;
  hideActivityPills?: boolean;
  orgasmTagId?: string;
  selectedMarkerIds: Set<string>;
  currentTimestamp?: number;
  focusedMarkerId?: string;
  markerWarningMessagesById: Map<string, string[]>;
  onClickMarker: (marker: GQL.SceneMarkerDataFragment) => void;
  onEdit: (marker: GQL.SceneMarkerDataFragment) => void;
  onSelectMarker: (id: string, selected: boolean) => void;
  onSelectMarkers: (ids: string[], selected: boolean) => void;
  getMarkerRatingCardClass: MarkerRatingCardClassGetter;
}

const ActivityTypeGroupCard: React.FC<IActivityTypeGroupCard> = ({
  group,
  hideActivityPills,
  orgasmTagId,
  selectedMarkerIds,
  currentTimestamp,
  focusedMarkerId,
  markerWarningMessagesById,
  onClickMarker,
  onEdit,
  onSelectMarker,
  onSelectMarkers,
  getMarkerRatingCardClass,
}) => {
  const hasPerformers =
    group.topPerformers.length > 0 || group.bottomPerformers.length > 0;
  const activityMarkers = hideActivityPills
    ? []
    : [...group.markers].sort(compareChronologicalMarkers);
  const groupMarkerIds = activityMarkers.map((marker) => marker.id);
  const allGroupSelected =
    groupMarkerIds.length > 0 &&
    groupMarkerIds.every((id) => selectedMarkerIds.has(id));
  const groupMarkers = [
    ...activityMarkers,
    ...group.highlightGroups.flatMap(
      (highlightGroup) => highlightGroup.markers
    ),
  ];
  const groupDurationSeconds = sumMergedMarkerDurations(groupMarkers);
  const isCurrentGroup = groupMarkers.some((marker) =>
    timestampBelongsToSceneMarker(marker, currentTimestamp)
  );
  const groupRatingCardClass =
    activityMarkers.length === 1
      ? getMarkerRatingCardClass(activityMarkers[0])
      : "";
  const highlightCount = group.highlightGroups.reduce(
    (sum, highlightGroup) => sum + highlightGroup.segments.length,
    0
  );

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
        {groupMarkerIds.length > 1 && (
          <Form.Check
            className="scene-marker-activity-config-checkbox"
            type="checkbox"
            checked={allGroupSelected}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onSelectMarkers(groupMarkerIds, e.currentTarget.checked)
            }
          />
        )}
      </div>
      <div className="scene-marker-activity-config-body">
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
        {activityMarkers.length > 0 && (
          <div className="scene-marker-activity-config-markers">
            {activityMarkers.map((marker) => (
              <TimelineMarkerBox
                key={marker.id}
                marker={marker}
                selectedMarkerIds={selectedMarkerIds}
                currentTimestamp={currentTimestamp}
                focusedMarkerId={focusedMarkerId}
                warningMessages={markerWarningMessagesById.get(marker.id)}
                onClickMarker={onClickMarker}
                onEdit={onEdit}
                onSelectMarker={onSelectMarker}
                getMarkerRatingCardClass={getMarkerRatingCardClass}
              />
            ))}
          </div>
        )}
      </div>
      {highlightCount > 0 && (
        <ActivityGroupHighlights
          highlightGroups={group.highlightGroups}
          orgasmTagId={orgasmTagId}
          selectedMarkerIds={selectedMarkerIds}
          currentTimestamp={currentTimestamp}
          focusedMarkerId={focusedMarkerId}
          markerWarningMessagesById={markerWarningMessagesById}
          onClickMarker={onClickMarker}
          onEdit={onEdit}
          onSelectMarkers={onSelectMarkers}
          getMarkerRatingCardClass={getMarkerRatingCardClass}
        />
      )}
    </div>
  );
};

const HighlightSegmentBox: React.FC<{
  segment: ISceneMarkerChronologyHighlightSegment<GQL.SceneMarkerDataFragment>;
  selectedMarkerIds: Set<string>;
  currentTimestamp?: number;
  focusedMarkerId?: string;
  warningMessages?: string[];
  onClickMarker: (marker: GQL.SceneMarkerDataFragment) => void;
  onEdit: (marker: GQL.SceneMarkerDataFragment) => void;
  onSelectMarkers: (ids: string[], selected: boolean) => void;
  getMarkerRatingCardClass: MarkerRatingCardClassGetter;
}> = ({
  segment,
  selectedMarkerIds,
  currentTimestamp,
  focusedMarkerId,
  warningMessages = [],
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
        "scene-marker-highlight-segment-pill",
        getMarkerRatingCardClass(segment.representativeMarker),
        {
          "scene-marker-activity-marker-box-current": isCurrentSegment,
          "scene-marker-activity-marker-box-focused":
            focusedMarkerId === segment.representativeMarker.id,
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
      {warningMessages.length > 0 && (
        <Icon
          icon={faExclamationTriangle}
          className="scene-marker-warning-icon"
          title={warningMessages.join("\n")}
        />
      )}
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

interface IActivityGroupHighlights {
  highlightGroups: Array<
    ISceneMarkerChronologyHighlightGroup<GQL.SceneMarkerDataFragment>
  >;
  orgasmTagId?: string;
  selectedMarkerIds: Set<string>;
  currentTimestamp?: number;
  focusedMarkerId?: string;
  markerWarningMessagesById: Map<string, string[]>;
  onClickMarker: (marker: GQL.SceneMarkerDataFragment) => void;
  onEdit: (marker: GQL.SceneMarkerDataFragment) => void;
  onSelectMarkers: (ids: string[], selected: boolean) => void;
  getMarkerRatingCardClass: MarkerRatingCardClassGetter;
}

function HighlightPillList({
  highlightGroups,
  orgasmTagId,
  selectedMarkerIds,
  currentTimestamp,
  focusedMarkerId,
  markerWarningMessagesById,
  onClickMarker,
  onEdit,
  onSelectMarkers,
  getMarkerRatingCardClass,
}: IActivityGroupHighlights) {
  const highlightSegments = highlightGroups
    .flatMap((group) =>
      group.segments.map((segment) => ({
        group,
        segment,
      }))
    )
    .sort((a, b) =>
      compareChronologicalHighlightSegments(a.segment, b.segment)
    );

  return (
    <div className="scene-marker-activity-highlight-pill-list">
      {highlightSegments.map(({ group, segment }) => (
        <HoverPopover
          key={`${group.key}-${segment.key}`}
          className="scene-marker-highlight-pill-popover-trigger"
          popoverClassName="scene-marker-highlight-popover"
          placement="bottom"
          content={
            <SceneMarkerHighlightPerformersPopover
              group={group}
              orgasmTagId={orgasmTagId}
              getMarkerRatingCardClass={getMarkerRatingCardClass}
            />
          }
        >
          <HighlightSegmentBox
            segment={segment}
            selectedMarkerIds={selectedMarkerIds}
            currentTimestamp={currentTimestamp}
            focusedMarkerId={focusedMarkerId}
            warningMessages={Array.from(
              new Set(
                segment.markers.flatMap(
                  (marker) => markerWarningMessagesById.get(marker.id) ?? []
                )
              )
            )}
            onClickMarker={onClickMarker}
            onEdit={onEdit}
            onSelectMarkers={onSelectMarkers}
            getMarkerRatingCardClass={getMarkerRatingCardClass}
          />
        </HoverPopover>
      ))}
    </div>
  );
}

function ActivityGroupHighlights({
  highlightGroups,
  orgasmTagId,
  selectedMarkerIds,
  currentTimestamp,
  focusedMarkerId,
  markerWarningMessagesById,
  onClickMarker,
  onEdit,
  onSelectMarkers,
  getMarkerRatingCardClass,
}: IActivityGroupHighlights) {
  const highlightCount = highlightGroups.reduce(
    (sum, group) => sum + group.segments.length,
    0
  );
  const highlightMarkerIds = highlightGroupMarkerIds(highlightGroups);
  const allHighlightsSelected =
    highlightMarkerIds.length > 0 &&
    highlightMarkerIds.every((id) => selectedMarkerIds.has(id));

  if (highlightCount === 0) {
    return null;
  }

  return (
    <div className="scene-marker-activity-highlights">
      {highlightMarkerIds.length > 1 && (
        <Form.Check
          className="scene-marker-activity-highlights-checkbox"
          type="checkbox"
          checked={allHighlightsSelected}
          onClick={(event: React.MouseEvent<HTMLInputElement>) =>
            event.stopPropagation()
          }
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            onSelectMarkers(highlightMarkerIds, event.currentTarget.checked)
          }
          title="Select highlights in this group"
        />
      )}
      <HighlightPillList
        highlightGroups={highlightGroups}
        orgasmTagId={orgasmTagId}
        selectedMarkerIds={selectedMarkerIds}
        currentTimestamp={currentTimestamp}
        focusedMarkerId={focusedMarkerId}
        markerWarningMessagesById={markerWarningMessagesById}
        onClickMarker={onClickMarker}
        onEdit={onEdit}
        onSelectMarkers={onSelectMarkers}
        getMarkerRatingCardClass={getMarkerRatingCardClass}
      />
    </div>
  );
}

export const SceneMarkersChronologicalPanel: React.FC<
  ISceneMarkersChronologicalPanel
> = ({
  markers,
  allMarkers,
  search,
  onSearchChange,
  selectedMarkerIds,
  derivedWindows = [],
  selectedDerivedWindowKeys = new Set<string>(),
  onClickMarker,
  onEdit,
  onSelectMarker,
  onSelectMarkers,
  onSelectDerivedWindow,
  currentTimestamp,
  focusedMarkerId,
  markerWarningMessagesById = new Map(),
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
  const getMarkerRatingCardClass = useSceneMarkerRatingCardClassGetter();
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
  const allActivityTypeMarkers = useMemo(
    () =>
      allMarkers
        .filter((marker) =>
          isActivityTypeSectionSceneMarker(marker, activityTypeSectionTagIds)
        )
        .sort((a, b) =>
          compareActivityTypeSceneMarkers(a, b, configuration?.ui.roleTagIds)
        ),
    [activityTypeSectionTagIds, allMarkers, configuration?.ui.roleTagIds]
  );
  const layout = useMemo(
    () =>
      buildChronologicalSceneMarkerLayout({
        allActivityMarkers: allActivityTypeMarkers,
        visibleActivityMarkers: activityTypeMarkers,
        highlightGroups,
        allMarkers,
        roleTagIds: configuration?.ui.roleTagIds,
      }),
    [
      activityTypeMarkers,
      allActivityTypeMarkers,
      allMarkers,
      configuration?.ui.roleTagIds,
      highlightGroups,
    ]
  );

  const activityTypeSections = useMemo<IActivityTypeSection[]>(() => {
    const roleTagIds = configuration?.ui.roleTagIds;
    const sectionDefinitions: Array<{
      key: ActivityTypeSectionKey;
      tagId?: string;
      fallbackLabel: string;
      hideActivityPills?: boolean;
    }> = [
      { key: "oral", tagId: roleTagIds?.oralTagId, fallbackLabel: "Oral" },
      { key: "sex", tagId: roleTagIds?.sexTagId, fallbackLabel: "Sex" },
      { key: "solo", tagId: roleTagIds?.soloTagId, fallbackLabel: "Solo" },
      {
        key: "feet",
        tagId: roleTagIds?.feetTagId,
        fallbackLabel: "Feet",
        hideActivityPills: true,
      },
      {
        key: "orgasm",
        tagId: roleTagIds?.orgasmTagId,
        fallbackLabel: "Orgasm",
        hideActivityPills: true,
      },
      {
        key: "facial",
        tagId: roleTagIds?.facialTagId,
        fallbackLabel: "Facial",
        hideActivityPills: true,
      },
    ];

    return sectionDefinitions
      .map(({ key, tagId, fallbackLabel, hideActivityPills }) => {
        const sectionGroups = tagId
          ? layout.groups.filter(
              (group) =>
                getActivityTypeSectionMarkerTagId(
                  group.sortMarker,
                  roleTagIds
                ) === tagId
            )
          : [];

        const sectionTag = sectionGroups
          .map((group) =>
            getActivityTypeSectionMarkerTag(group.sortMarker, roleTagIds)
          )
          .find((tag): tag is NonNullable<typeof tag> => !!tag);

        return {
          key,
          label: sectionTag?.name ?? fallbackLabel,
          groups: sectionGroups,
          hideActivityPills,
        };
      })
      .filter((section) => section.groups.length > 0);
  }, [configuration?.ui.roleTagIds, layout.groups]);

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

  const renderFallbackHighlightSection = () => {
    if (layout.fallbackHighlightGroups.length === 0) {
      return null;
    }

    const fallbackGroupKey = "other-highlights";
    const sectionMarkerIds = highlightGroupMarkerIds(
      layout.fallbackHighlightGroups
    );
    const allSectionSelected =
      sectionMarkerIds.length > 0 &&
      sectionMarkerIds.every((id) => selectedMarkerIds.has(id));
    const sectionDurationSeconds = sumMergedMarkerDurations(
      layout.fallbackHighlightGroups.flatMap((group) => group.markers)
    );

    return (
      <React.Fragment key={fallbackGroupKey}>
        <div className="scene-marker-activity-group-header">
          <div className="scene-marker-activity-group-title">
            <span>Other Highlights</span>
          </div>
          <div className="scene-marker-activity-group-meta">
            <span>{formatMarkerDuration(sectionDurationSeconds)}</span>
            {sectionMarkerIds.length > 1 && (
              <Form.Check
                className="scene-marker-activity-group-checkbox"
                type="checkbox"
                checked={allSectionSelected}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onSelectMarkers(sectionMarkerIds, e.currentTarget.checked)
                }
              />
            )}
          </div>
        </div>
        <div className="scene-marker-other-highlights-list">
          <HighlightPillList
            highlightGroups={layout.fallbackHighlightGroups}
            orgasmTagId={configuration?.ui.roleTagIds?.orgasmTagId}
            selectedMarkerIds={selectedMarkerIds}
            currentTimestamp={currentTimestamp}
            focusedMarkerId={focusedMarkerId}
            markerWarningMessagesById={markerWarningMessagesById}
            onClickMarker={onClickMarker}
            onEdit={onEdit}
            onSelectMarkers={onSelectMarkers}
            getMarkerRatingCardClass={getMarkerRatingCardClass}
          />
        </div>
      </React.Fragment>
    );
  };

  const renderActivityTypeList = () => (
    <div className="scene-marker-chronology-list">
      {activityTypeSections.length > 0 ||
      layout.fallbackHighlightGroups.length > 0 ? (
        <>
          {activityTypeSections.map((section) => {
            const sectionMarkerIds = uniqueMarkerIds(
              section.hideActivityPills
                ? []
                : section.groups.flatMap((group) => group.markers)
            );
            const allSectionSelected =
              sectionMarkerIds.length > 0 &&
              sectionMarkerIds.every((id) => selectedMarkerIds.has(id));
            const sectionDurationSeconds = sumMergedMarkerDurations(
              section.groups.flatMap((group) => [
                ...(section.hideActivityPills ? [] : group.markers),
                ...group.highlightGroups.flatMap(
                  (highlightGroup) => highlightGroup.markers
                ),
              ])
            );

            return (
              <React.Fragment key={section.key}>
                <div className="scene-marker-activity-group-header">
                  <div className="scene-marker-activity-group-title">
                    <span>{section.label}</span>
                  </div>
                  <div className="scene-marker-activity-group-meta">
                    <span>{formatMarkerDuration(sectionDurationSeconds)}</span>
                    {sectionMarkerIds.length > 1 && (
                      <Form.Check
                        className="scene-marker-activity-group-checkbox"
                        type="checkbox"
                        checked={allSectionSelected}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          onSelectMarkers(
                            sectionMarkerIds,
                            e.currentTarget.checked
                          )
                        }
                      />
                    )}
                  </div>
                </div>
                {section.groups.map((group) => (
                  <ActivityTypeGroupCard
                    key={group.key}
                    group={group}
                    hideActivityPills={section.hideActivityPills}
                    orgasmTagId={configuration?.ui.roleTagIds?.orgasmTagId}
                    selectedMarkerIds={selectedMarkerIds}
                    currentTimestamp={currentTimestamp}
                    focusedMarkerId={focusedMarkerId}
                    markerWarningMessagesById={markerWarningMessagesById}
                    onClickMarker={onClickMarker}
                    onEdit={onEdit}
                    onSelectMarker={onSelectMarker}
                    onSelectMarkers={onSelectMarkers}
                    getMarkerRatingCardClass={getMarkerRatingCardClass}
                  />
                ))}
              </React.Fragment>
            );
          })}
          {renderFallbackHighlightSection()}
        </>
      ) : (
        <div className="scene-marker-chronology-empty">No markers found.</div>
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
      {renderSearch()}
      {renderDerivedWindows()}
      {renderActivityTypeList()}
    </div>
  );
};
