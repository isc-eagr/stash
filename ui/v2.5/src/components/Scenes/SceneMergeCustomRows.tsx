import React, { useEffect, useMemo, useState } from "react";
import { Form, FormControl } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import * as GQL from "src/core/generated-graphql";
import { RatingSystem } from "src/components/Shared/Rating/RatingSystem";
import { ScrapeDialogRow } from "src/components/Shared/ScrapeDialog/ScrapeDialogRow";
import { ScrapeResult } from "src/components/Shared/ScrapeDialog/scrapeResult";
import {
  IMergeItem,
  IMergeItemChoice,
  ISceneValueChoice,
  loopPresetMergeChoice,
  negativeMarkerMergeChoice,
  ratingMergeChoice,
  releaseMergeChoice,
  stashDBMatchesMergeChoice,
} from "./sceneMergeChoices_custom";

export type SceneMergeCustomInput = Pick<
  GQL.SceneMergeInput,
  | "release_ids"
  | "negative_marker_ids"
  | "loop_preset_ids"
  | "rating_scene_id"
  | "stashdb_matches_scene_id"
>;

const boxClassName =
  "form-control h-auto bg-secondary text-white border-secondary scene-merge-items";

const sceneName = (scene: GQL.SceneDataFragment) =>
  scene.title || `#${scene.id}`;

interface IMergeItemListProps {
  field: string;
  items: IMergeItem[];
  scenes: GQL.SceneDataFragment[];
  destID: string;
  selected?: string[];
  onChange?: (ids: string[]) => void;
}

const MergeItemList: React.FC<IMergeItemListProps> = ({
  field,
  items,
  scenes,
  destID,
  selected,
  onChange,
}) => {
  if (!items.length) {
    return (
      <div className={`${boxClassName} text-muted`}>
        <FormattedMessage id="none" />
      </div>
    );
  }

  function toggle(id: string, checked: boolean) {
    const ids = new Set(selected);
    if (checked) ids.add(id);
    else ids.delete(id);
    onChange?.(items.filter((i) => ids.has(i.id)).map((i) => i.id));
  }

  return (
    <div className={boxClassName}>
      {items.map((item) => {
        const label = (
          <>
            {item.label}
            {item.sceneID !== destID && (
              <small className="text-muted ml-2">
                {sceneName(scenes.find((s) => s.id === item.sceneID)!)}
              </small>
            )}
          </>
        );
        return onChange ? (
          <Form.Check
            key={item.id}
            id={`scene-merge-${field}-${item.id}`}
            checked={selected?.includes(item.id) ?? false}
            onChange={(e) => toggle(item.id, e.currentTarget.checked)}
            label={label}
          />
        ) : (
          <div key={item.id}>{label}</div>
        );
      })}
    </div>
  );
};

interface IMergeItemsRowProps {
  field: string;
  title: string;
  choice: IMergeItemChoice;
  result: ScrapeResult<string[]>;
  scenes: GQL.SceneDataFragment[];
  destID: string;
  onChange: (value: ScrapeResult<string[]>) => void;
}

const MergeItemsRow: React.FC<IMergeItemsRowProps> = (props) => {
  const { choice, result } = props;
  return (
    <ScrapeDialogRow
      field={props.field}
      title={props.title}
      result={result}
      alwaysShow={choice.items.length > choice.destIDs.length}
      originalField={
        <MergeItemList
          field={props.field}
          items={choice.items.filter((i) => i.sceneID === props.destID)}
          scenes={props.scenes}
          destID={props.destID}
        />
      }
      newField={
        <MergeItemList
          field={props.field}
          items={choice.items}
          scenes={props.scenes}
          destID={props.destID}
          selected={result.newValue ?? []}
          onChange={(ids) => props.onChange(result.cloneWithValue(ids))}
        />
      }
      onChange={props.onChange}
    />
  );
};

interface ISceneValueRowProps {
  field: string;
  title: string;
  choice: ISceneValueChoice<GQL.SceneDataFragment>;
  result: ScrapeResult<string>;
  dest: GQL.SceneDataFragment;
  renderValue: (scene: GQL.SceneDataFragment) => React.ReactNode;
  onChange: (value: ScrapeResult<string>) => void;
}

const SceneValueRow: React.FC<ISceneValueRowProps> = (props) => {
  const { choice, result } = props;
  if (!choice.candidates.length) return null;

  const selected =
    choice.candidates.find((s) => s.id === result.newValue) ??
    choice.candidates[0];

  return (
    <ScrapeDialogRow
      field={props.field}
      title={props.title}
      result={result}
      alwaysShow
      originalField={
        <div className={boxClassName}>{props.renderValue(props.dest)}</div>
      }
      newField={
        <div className={boxClassName}>
          {props.renderValue(selected)}
          {choice.candidates.length > 1 && (
            <FormControl
              as="select"
              className="input-control mt-1"
              value={selected.id}
              onChange={(e) =>
                props.onChange(result.cloneWithValue(e.currentTarget.value))
              }
            >
              {choice.candidates.map((s) => (
                <option key={s.id} value={s.id}>
                  {sceneName(s)}
                </option>
              ))}
            </FormControl>
          )}
        </div>
      }
      onChange={props.onChange}
    />
  );
};

const listResult = (choice: IMergeItemChoice) =>
  new ScrapeResult<string[]>(choice.destIDs, choice.keptIDs);

const valueResult = (dest: GQL.SceneDataFragment, choice: ISceneValueChoice) =>
  new ScrapeResult<string>(dest.id, choice.sourceID, choice.useSource);

// CUSTOM: merge dialog rows for releases, skip ranges, loop presets, rating,
// and StashDB Matches.
export function useSceneMergeCustomChoices(
  dest: GQL.SceneDataFragment,
  sources: GQL.SceneDataFragment[]
) {
  const intl = useIntl();
  const scenes = useMemo(() => [dest, ...sources], [dest, sources]);

  const choices = useMemo(
    () => ({
      releases: releaseMergeChoice(dest, sources),
      negativeMarkers: negativeMarkerMergeChoice(dest, sources),
      loopPresets: loopPresetMergeChoice(dest, sources),
      rating: ratingMergeChoice(dest, sources),
      stashDBMatches: stashDBMatchesMergeChoice(dest, sources),
    }),
    [dest, sources]
  );

  const [releases, setReleases] = useState(() => listResult(choices.releases));
  const [negativeMarkers, setNegativeMarkers] = useState(() =>
    listResult(choices.negativeMarkers)
  );
  const [loopPresets, setLoopPresets] = useState(() =>
    listResult(choices.loopPresets)
  );
  const [rating, setRating] = useState(() => valueResult(dest, choices.rating));
  const [stashDBMatches, setStashDBMatches] = useState(() =>
    valueResult(dest, choices.stashDBMatches)
  );

  useEffect(() => {
    setReleases(listResult(choices.releases));
    setNegativeMarkers(listResult(choices.negativeMarkers));
    setLoopPresets(listResult(choices.loopPresets));
    setRating(valueResult(dest, choices.rating));
    setStashDBMatches(valueResult(dest, choices.stashDBMatches));
  }, [dest, choices]);

  const hasSourceItems = (choice: IMergeItemChoice) =>
    choice.items.length > choice.destIDs.length;
  const hasValues =
    hasSourceItems(choices.releases) ||
    hasSourceItems(choices.negativeMarkers) ||
    hasSourceItems(choices.loopPresets) ||
    choices.rating.candidates.length > 0 ||
    choices.stashDBMatches.candidates.length > 0;

  function getInput(): SceneMergeCustomInput {
    const kept = (choice: IMergeItemChoice, result: ScrapeResult<string[]>) =>
      hasSourceItems(choice)
        ? result.getNewValue() ?? result.originalValue ?? []
        : undefined;
    const scene = (choice: ISceneValueChoice, result: ScrapeResult<string>) =>
      choice.candidates.length ? result.getNewValue() ?? dest.id : undefined;

    return {
      release_ids: kept(choices.releases, releases),
      negative_marker_ids: kept(choices.negativeMarkers, negativeMarkers),
      loop_preset_ids: kept(choices.loopPresets, loopPresets),
      rating_scene_id: scene(choices.rating, rating),
      stashdb_matches_scene_id: scene(choices.stashDBMatches, stashDBMatches),
    };
  }

  const listRow = (
    field: string,
    title: string,
    choice: IMergeItemChoice,
    result: ScrapeResult<string[]>,
    onChange: (value: ScrapeResult<string[]>) => void
  ) => (
    <MergeItemsRow
      field={field}
      title={title}
      choice={choice}
      result={result}
      scenes={scenes}
      destID={dest.id}
      onChange={onChange}
    />
  );

  const rows = (
    <>
      <SceneValueRow
        field="rating"
        title={intl.formatMessage({ id: "rating" })}
        choice={choices.rating}
        result={rating}
        dest={dest}
        onChange={setRating}
        renderValue={(scene) => (
          <>
            <RatingSystem value={scene.rating100} disabled />
            {scene.rating_scores.length > 0 && (
              <small className="text-muted">
                <FormattedMessage
                  id="dialogs.merge.advisor_answers"
                  values={{ count: scene.rating_scores.length }}
                />
              </small>
            )}
          </>
        )}
      />
      <SceneValueRow
        field="stashdb_matches"
        title={intl.formatMessage({ id: "stashdb_matches" })}
        choice={choices.stashDBMatches}
        result={stashDBMatches}
        dest={dest}
        onChange={setStashDBMatches}
        renderValue={(scene) =>
          scene.stashdb_matches ?? (
            <span className="text-muted">
              <FormattedMessage id="none" />
            </span>
          )
        }
      />
      {listRow(
        "releases",
        intl.formatMessage({ id: "dialogs.merge.releases" }),
        choices.releases,
        releases,
        setReleases
      )}
      {listRow(
        "negative_markers",
        intl.formatMessage({ id: "dialogs.merge.skip_ranges" }),
        choices.negativeMarkers,
        negativeMarkers,
        setNegativeMarkers
      )}
      {listRow(
        "loop_presets",
        intl.formatMessage({ id: "dialogs.merge.loop_presets" }),
        choices.loopPresets,
        loopPresets,
        setLoopPresets
      )}
    </>
  );

  return { rows, hasValues, getInput };
}
