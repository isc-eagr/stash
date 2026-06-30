import React, { useEffect, useMemo, useState } from "react";
import { Badge, Button, Form } from "react-bootstrap";
import cx from "classnames";
import Select, { MultiValue, SingleValue } from "react-select";
import {
  faArrowDown,
  faArrowUp,
  faImage,
} from "@fortawesome/free-solid-svg-icons";
import * as GQL from "src/core/generated-graphql";
import { Icon } from "src/components/Shared/Icon";
import TextUtils from "src/utils/text";
import { markerTitle } from "src/core/markers";
import { useConfigurationContext } from "src/hooks/Config";
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
  selectedMarkerIds: Set<string>;
  onClickMarker: (marker: GQL.SceneMarkerDataFragment) => void;
  onEdit: (marker: GQL.SceneMarkerDataFragment) => void;
  onSelectMarker: (id: string, selected: boolean) => void;
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

interface ISceneMarkerChronologyRow {
  marker: GQL.SceneMarkerDataFragment;
  allMarkers: GQL.SceneMarkerDataFragment[];
  selected: boolean;
  currentTimestamp?: number;
  onClickMarker: (marker: GQL.SceneMarkerDataFragment) => void;
  onEdit: (marker: GQL.SceneMarkerDataFragment) => void;
  onSelectMarker: (id: string, selected: boolean) => void;
}

const SceneMarkerChronologyRow: React.FC<ISceneMarkerChronologyRow> = ({
  marker,
  allMarkers,
  selected,
  currentTimestamp,
  onClickMarker,
  onEdit,
  onSelectMarker,
}) => {
  const { configuration } = useConfigurationContext();
  const [imageFailed, setImageFailed] = useState(false);
  const [showParentTags, setShowParentTags] = useState(false);
  const title = markerTitle(marker);
  const screenshot = marker.screenshot && !imageFailed ? marker.screenshot : "";
  const activityTypeTagIds = useMemo(
    () =>
      new Set(
        [
          configuration?.ui.roleTagIds?.sexTagId,
          configuration?.ui.roleTagIds?.oralTagId,
          configuration?.ui.roleTagIds?.soloTagId,
        ].filter((id): id is string => !!id)
      ),
    [
      configuration?.ui.roleTagIds?.oralTagId,
      configuration?.ui.roleTagIds?.sexTagId,
      configuration?.ui.roleTagIds?.soloTagId,
    ]
  );
  const isActivityTypeMarker =
    marker.tags.length === 0 &&
    (activityTypeTagIds.has(marker.primary_tag.id) ||
      (marker.primary_tag.parents ?? []).some((parent) =>
        activityTypeTagIds.has(parent.id)
      ));
  const isCurrentMarker = timestampBelongsToSceneMarker(
    marker,
    currentTimestamp
  );
  const showRoleArrows =
    marker.top_performers.length > 0 && marker.bottom_performers.length > 0;
  const displayTags = useMemo(
    () => getChronologicalSceneMarkerDisplayTags(marker, allMarkers),
    [allMarkers, marker]
  );
  const visibleDisplayTags = useMemo(
    () => displayTags.filter(({ kind }) => kind !== "parent"),
    [displayTags]
  );
  const parentDisplayTags = useMemo(
    () => displayTags.filter(({ kind }) => kind === "parent"),
    [displayTags]
  );

  useEffect(() => {
    setImageFailed(false);
  }, [marker.screenshot]);

  const isInteractiveClickTarget = (target: EventTarget) =>
    target instanceof Element &&
    !!target.closest("a, button, input, label, select, textarea");

  const onClickRow = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isInteractiveClickTarget(event.target)) {
      onClickMarker(marker);
    }
  };

  const onKeyDownRow = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      event.target === event.currentTarget &&
      (event.key === "Enter" || event.key === " ")
    ) {
      event.preventDefault();
      onClickMarker(marker);
    }
  };

  const renderPerformerBadge = (
    performer: (typeof marker.top_performers)[number],
    variant: "success" | "info",
    icon: typeof faArrowUp
  ) => (
    <Badge key={performer.id} variant={variant} className="performer-badge">
      {showRoleArrows && <Icon icon={icon} className="mr-1" />}
      {performer.name}
    </Badge>
  );

  return (
    <div
      className={cx("marker-item scene-marker-chronology-row", {
        "scene-marker-chronology-row-activity": isActivityTypeMarker,
        "scene-marker-chronology-row-current": isCurrentMarker,
      })}
      onClick={onClickRow}
      onKeyDown={onKeyDownRow}
      role="button"
      tabIndex={0}
      title={`Seek to ${title}`}
    >
      <button
        className="scene-marker-chronology-thumb"
        type="button"
        onClick={() => onClickMarker(marker)}
        title={title}
      >
        {screenshot ? (
          <img
            src={screenshot}
            alt={title}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="scene-marker-chronology-thumb-pending">
            <Icon icon={faImage} />
            <span>Pending image</span>
          </span>
        )}
      </button>

      <div className="min-w-0 marker-content">
        <div className="d-flex align-items-center marker-main-row">
          <Button
            variant="link"
            className="p-0 marker-title-btn"
            onClick={() => onClickMarker(marker)}
            title={title}
          >
            {title}
          </Button>
          <span className="marker-timestamp text-muted ml-2">
            <Button
              variant="link"
              className="p-0 text-muted"
              onClick={() => onClickMarker(marker)}
              title="Seek to start"
            >
              {TextUtils.secondsToTimestamp(marker.seconds)}
            </Button>
            {marker.end_seconds !== null && marker.end_seconds !== undefined ? (
              <>
                <span>-</span>
                <Button
                  variant="link"
                  className="p-0 text-muted"
                  onClick={() => {
                    onClickMarker({
                      ...marker,
                      seconds: marker.end_seconds ?? marker.seconds,
                    });
                  }}
                  title="Seek to end"
                >
                  {TextUtils.secondsToTimestamp(marker.end_seconds)}
                </Button>
                <span className="ml-1">
                  (
                  {TextUtils.formatDurationRange(
                    marker.end_seconds - marker.seconds
                  )}
                  )
                </span>
              </>
            ) : (
              <span className="ml-1">(20s)</span>
            )}
          </span>
          <Button
            variant="link"
            className="marker-edit-btn p-0 ml-auto"
            onClick={() => onEdit(marker)}
          >
            Edit
          </Button>
        </div>

        <div className="d-flex align-items-center flex-wrap marker-badges">
          {marker.top_performers.map((performer) =>
            renderPerformerBadge(performer, "success", faArrowUp)
          )}
          {marker.bottom_performers.map((performer) =>
            renderPerformerBadge(performer, "info", faArrowDown)
          )}
        </div>

        <div className="d-flex align-items-center flex-wrap marker-badges">
          {visibleDisplayTags.map(({ kind, tag }) => (
            <Badge
              key={tag.id}
              variant={kind === "primary" ? "primary" : "secondary"}
              className={cx("tag-badge", `tag-badge-${kind}`)}
            >
              {tag.name}
            </Badge>
          ))}
          {parentDisplayTags.length > 0 && (
            <Button
              className="tag-parent-toggle"
              type="button"
              variant="secondary"
              title={showParentTags ? "Hide parent tags" : "Show parent tags"}
              onClick={() => setShowParentTags((current) => !current)}
            >
              {showParentTags ? "-" : `+${parentDisplayTags.length}`}
            </Button>
          )}
          {showParentTags &&
            parentDisplayTags.map(({ kind, tag }) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className={cx("tag-badge", `tag-badge-${kind}`)}
              >
                {tag.name}
              </Badge>
            ))}
        </div>
      </div>

      <Form.Check
        className="marker-checkbox"
        type="checkbox"
        checked={selected}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onSelectMarker(marker.id, e.currentTarget.checked)
        }
      />
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
  selectedMarkerIds,
  onClickMarker,
  onEdit,
  onSelectMarker,
  currentTimestamp,
}) => {
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

  const onWheelMarkerList = (event: React.WheelEvent<HTMLDivElement>) => {
    const list = event.currentTarget;
    const maxScrollTop = list.scrollHeight - list.clientHeight;

    if (maxScrollTop <= 0 || event.deltaY === 0) {
      return;
    }

    const nextScrollTop = Math.max(
      0,
      Math.min(maxScrollTop, list.scrollTop + event.deltaY)
    );

    if (nextScrollTop !== list.scrollTop) {
      event.preventDefault();
      event.stopPropagation();
      list.scrollTop = nextScrollTop;
    }
  };

  return (
    <div className="scene-marker-chronology">
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

      <div className="scene-marker-chronology-list" onWheel={onWheelMarkerList}>
        {markers.length > 0 ? (
          markers.map((marker) => (
            <SceneMarkerChronologyRow
              key={marker.id}
              marker={marker}
              allMarkers={allMarkers}
              selected={selectedMarkerIds.has(marker.id)}
              currentTimestamp={currentTimestamp}
              onClickMarker={onClickMarker}
              onEdit={onEdit}
              onSelectMarker={onSelectMarker}
            />
          ))
        ) : (
          <div className="scene-marker-chronology-empty">No markers found.</div>
        )}
      </div>
    </div>
  );
};
