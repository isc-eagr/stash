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
import {
  compareActivityTypeSceneMarkers,
  getActivityTypeTagIds,
  groupActivityTypeSceneMarkers,
  isActivityTypeSceneMarker,
  type IActivityTypeSceneMarkerGroup,
} from "./sceneMarkerActivityType_custom";
import {
  getChronologicalSceneMarkerPerformers,
  getChronologicalSceneMarkerTags,
  getChronologicalSceneMarkerDisplayTags,
  getCompatibleChronologicalSceneMarkerTags,
  timestampBelongsToSceneMarker,
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
  onClickMarker: (marker: GQL.SceneMarkerDataFragment) => void;
  onEdit: (marker: GQL.SceneMarkerDataFragment) => void;
  onSelectMarker: (id: string, selected: boolean) => void;
  onSelectMarkers: (ids: string[], selected: boolean) => void;
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
type ActivityTypeSectionKey = "oral" | "sex" | "solo";

interface IActivityTypeSection {
  key: ActivityTypeSectionKey;
  label: string;
  markers: GQL.SceneMarkerDataFragment[];
}

type ActivityTypePerformer =
  GQL.SceneMarkerDataFragment["top_performers"][number];
type SceneMarkerDisplayTag = ReturnType<
  typeof getChronologicalSceneMarkerDisplayTags
>[number];

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

function uniqueDisplayTagsInDisplayOrder(tags: SceneMarkerDisplayTag[]) {
  const tagsById = new Map<string, SceneMarkerDisplayTag>();

  tags.forEach((displayTag) => {
    const existing = tagsById.get(displayTag.tag.id);
    if (!existing) {
      tagsById.set(displayTag.tag.id, displayTag);
    }
  });

  return Array.from(tagsById.values());
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
  role: "Top" | "Bottom";
  className?: string;
}> = ({ performer, role, className }) => (
  <div
    key={`${role}-${performer.id}`}
    className={cx(
      "scene-marker-activity-performer",
      `scene-marker-activity-performer-${role.toLowerCase()}`,
      className
    )}
    title={`${role}: ${performer.name}`}
  >
    <div className="scene-marker-activity-performer-image">
      {performer.image_path ? (
        <img src={performer.image_path} alt={performer.name} />
      ) : (
        <Icon icon={faUser} />
      )}
    </div>
    <div className="scene-marker-activity-performer-name">{performer.name}</div>
  </div>
);

interface ITimelineMarkerBox {
  marker: GQL.SceneMarkerDataFragment;
  selectedMarkerIds: Set<string>;
  currentTimestamp?: number;
  onClickMarker: (marker: GQL.SceneMarkerDataFragment) => void;
  onEdit: (marker: GQL.SceneMarkerDataFragment) => void;
  onSelectMarker: (id: string, selected: boolean) => void;
}

const TimelineMarkerBox: React.FC<ITimelineMarkerBox> = ({
  marker,
  selectedMarkerIds,
  currentTimestamp,
  onClickMarker,
  onEdit,
  onSelectMarker,
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
      className={cx("scene-marker-activity-marker-box", {
        "scene-marker-activity-marker-box-current": isCurrentMarker,
      })}
      onClick={() => onClickMarker(marker)}
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
}

const ActivityTypeGroupCard: React.FC<IActivityTypeGroupCard> = ({
  group,
  selectedMarkerIds,
  currentTimestamp,
  onClickMarker,
  onEdit,
  onSelectMarker,
  onSelectMarkers,
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

  return (
    <div
      className={cx("scene-marker-activity-config-card", {
        "scene-marker-activity-config-card-current": isCurrentGroup,
      })}
    >
      <div className="scene-marker-activity-config-header">
        <Form.Check
          className="scene-marker-activity-config-checkbox"
          type="checkbox"
          checked={allGroupSelected}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onSelectMarkers(groupMarkerIds, e.currentTarget.checked)
          }
        />
        <span className="scene-marker-activity-config-summary">
          {formatMarkerDuration(groupDurationSeconds)}
        </span>
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
          />
        ))}
      </div>
    </div>
  );
};

interface IHighlightMarkerCard {
  marker: GQL.SceneMarkerDataFragment;
  allMarkers: GQL.SceneMarkerDataFragment[];
  selectedMarkerIds: Set<string>;
  currentTimestamp?: number;
  onClickMarker: (marker: GQL.SceneMarkerDataFragment) => void;
  onEdit: (marker: GQL.SceneMarkerDataFragment) => void;
  onSelectMarker: (id: string, selected: boolean) => void;
}

const HighlightMarkerCard: React.FC<IHighlightMarkerCard> = ({
  marker,
  allMarkers,
  selectedMarkerIds,
  currentTimestamp,
  onClickMarker,
  onEdit,
  onSelectMarker,
}) => {
  const tags = uniqueDisplayTagsInDisplayOrder(
    getChronologicalSceneMarkerDisplayTags(marker, allMarkers)
  );
  const hasPerformers =
    marker.top_performers.length > 0 || marker.bottom_performers.length > 0;
  const isCurrentMarker = timestampBelongsToSceneMarker(
    marker,
    currentTimestamp
  );
  const title = markerTitle(marker);

  const onClickCard = () => {
    onClickMarker(marker);
  };

  return (
    <div
      className={cx(
        "scene-marker-activity-config-card",
        "scene-marker-highlight-config-card",
        "scene-marker-highlight-marker-card",
        {
          "scene-marker-highlight-marker-card-current": isCurrentMarker,
        }
      )}
      onClick={onClickCard}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClickCard();
          }
        }
      }}
      role="button"
      tabIndex={0}
      title={`Seek to ${title}`}
    >
      <div className="scene-marker-highlight-main-row">
        <Button
          className="scene-marker-highlight-title p-0"
          variant="link"
          onClick={(event) => {
            event.stopPropagation();
            onClickMarker(marker);
          }}
        >
          {title}
        </Button>
        <span className="scene-marker-highlight-timestamp">
          <Button
            className="scene-marker-highlight-time-part p-0"
            variant="link"
            onClick={(event) => {
              event.stopPropagation();
              onClickMarker(marker);
            }}
            title="Seek to start"
          >
            {TextUtils.secondsToTimestamp(marker.seconds)}
          </Button>
          {marker.end_seconds !== null && marker.end_seconds !== undefined ? (
            <>
              <span className="scene-marker-highlight-time-separator">-</span>
              <Button
                className="scene-marker-highlight-time-part p-0"
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
              <span className="scene-marker-highlight-duration">
                ({formatMarkerDuration(marker.end_seconds - marker.seconds)})
              </span>
            </>
          ) : (
            <span className="scene-marker-highlight-duration">
              ({formatMarkerDuration(defaultMarkerDurationSeconds)})
            </span>
          )}
        </span>
        <Button
          className="scene-marker-highlight-edit p-0"
          variant="link"
          onClick={(event) => {
            event.stopPropagation();
            onEdit(marker);
          }}
        >
          Edit
        </Button>
        <Form.Check
          className="scene-marker-highlight-checkbox"
          type="checkbox"
          checked={selectedMarkerIds.has(marker.id)}
          onClick={(event: React.MouseEvent<HTMLInputElement>) =>
            event.stopPropagation()
          }
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            onSelectMarker(marker.id, event.currentTarget.checked)
          }
        />
      </div>
      <div className="scene-marker-activity-config-performers">
        {hasPerformers ? (
          <>
            {marker.top_performers.map((performer) => (
              <ActivityTypePerformerTile
                key={`top-${performer.id}`}
                performer={performer}
                role="Top"
                className="scene-marker-highlight-performer"
              />
            ))}
            {marker.bottom_performers.map((performer) => (
              <ActivityTypePerformerTile
                key={`bottom-${performer.id}`}
                performer={performer}
                role="Bottom"
                className="scene-marker-highlight-performer"
              />
            ))}
          </>
        ) : (
          <div className="scene-marker-activity-config-empty">
            No performers
          </div>
        )}
      </div>
      <div className="scene-marker-highlight-tags">
        {tags.length > 0 ? (
          tags.map(({ kind, tag }) => (
            <Badge
              key={tag.id}
              variant={kind === "primary" ? "primary" : "secondary"}
              className={cx("tag-badge", `tag-badge-${kind}`)}
            >
              {tag.name}
            </Badge>
          ))
        ) : (
          <Badge variant="secondary" className="tag-badge tag-badge-highlight">
            Untagged
          </Badge>
        )}
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
  onClickMarker,
  onEdit,
  onSelectMarker,
  onSelectMarkers,
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
  const activityTypeTagIds = useMemo(
    () => getActivityTypeTagIds(configuration?.ui.roleTagIds),
    [configuration?.ui.roleTagIds]
  );
  const highlights = useMemo(
    () =>
      markers.filter(
        (marker) => !isActivityTypeSceneMarker(marker, activityTypeTagIds)
      ),
    [activityTypeTagIds, markers]
  );
  const activityTypeMarkers = useMemo(
    () =>
      markers
        .filter((marker) =>
          isActivityTypeSceneMarker(marker, activityTypeTagIds)
        )
        .sort((a, b) =>
          compareActivityTypeSceneMarkers(a, b, configuration?.ui.roleTagIds)
        ),
    [activityTypeTagIds, configuration?.ui.roleTagIds, markers]
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
    ];

    return sectionDefinitions
      .map(({ key, tagId, fallbackLabel }) => {
        const sectionMarkers = tagId
          ? activityTypeMarkers.filter(
              (marker) => marker.primary_tag.id === tagId
            )
          : [];

        return {
          key,
          label: sectionMarkers[0]?.primary_tag.name ?? fallbackLabel,
          markers: sectionMarkers,
        };
      })
      .filter((section) => section.markers.length > 0);
  }, [activityTypeMarkers, configuration?.ui.roleTagIds]);

  const renderHighlightList = () => (
    <div className="scene-marker-chronology-list">
      {highlights.length > 0 ? (
        highlights.map((marker) => (
          <HighlightMarkerCard
            key={marker.id}
            marker={marker}
            allMarkers={allMarkers}
            selectedMarkerIds={selectedMarkerIds}
            currentTimestamp={currentTimestamp}
            onClickMarker={onClickMarker}
            onEdit={onEdit}
            onSelectMarker={onSelectMarker}
          />
        ))
      ) : (
        <div className="scene-marker-chronology-empty">
          No highlight markers found.
        </div>
      )}
    </div>
  );

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
                  <Form.Check
                    className="scene-marker-activity-group-checkbox"
                    type="checkbox"
                    checked={allSectionSelected}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      onSelectMarkers(sectionMarkerIds, e.currentTarget.checked)
                    }
                  />
                  <span>{section.label}</span>
                </div>
                <div className="scene-marker-activity-group-meta">
                  <span>{formatMarkerDuration(sectionDurationSeconds)}</span>
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
      {activeTab === "activity"
        ? renderActivityTypeList()
        : renderHighlightList()}
    </div>
  );
};
