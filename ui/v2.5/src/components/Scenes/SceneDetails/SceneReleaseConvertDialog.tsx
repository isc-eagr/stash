import React, { useEffect, useMemo, useState } from "react";
import { Col, Form, FormControl, Row } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import { uniq } from "lodash-es";
import * as GQL from "src/core/generated-graphql";
import { GallerySelect } from "src/components/Shared/Select";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { StashIDsField } from "src/components/Shared/StashID";
import { ScrapeDialog } from "src/components/Shared/ScrapeDialog/ScrapeDialog";
import {
  ScrapeDialogRow,
  ScrapedCustomFieldRows,
  ScrapedImageRow,
  ScrapedInputGroupRow,
  ScrapedStringListRow,
  ScrapedTextAreaRow,
} from "src/components/Shared/ScrapeDialog/ScrapeDialogRow";
import {
  ScrapedGroupsRow,
  ScrapedPerformersRow,
  ScrapedStudioRow,
  ScrapedTagsRow,
} from "src/components/Shared/ScrapeDialog/ScrapedObjectsRow";
import {
  CustomFieldScrapeResults,
  ObjectListScrapeResult,
  ScrapeResult,
  ZeroableScrapeResult,
  hasScrapedValues,
} from "src/components/Shared/ScrapeDialog/scrapeResult";
import { sortStoredIdObjects, uniqIDStoredIDs } from "src/utils/data";
import ImageUtils from "src/utils/image";
import {
  SceneRatingChoiceRow,
  valueResult,
} from "src/components/Scenes/SceneMergeCustomRows";
import { ratingMergeChoice } from "src/components/Scenes/sceneMergeChoices_custom";
import {
  convertSourceDefaults,
  convertStashDBMatchesCustom,
} from "./sceneReleaseConvertChoices_custom";
import { summarizeSceneConversionCustom } from "./sceneReleaseConversionSummary_custom";

export type SceneReleaseConvertChoices = Pick<
  GQL.ConvertSceneToReleaseInput,
  "target_values" | "copy_rating_to_target" | "copy_markers_to_target"
>;

interface ISceneReleaseConvertDialogProps {
  dest: GQL.SceneDataFragment;
  source: GQL.SceneDataFragment;
  running: boolean;
  onClose: (choices?: SceneReleaseConvertChoices) => void;
}

const toStoredID = (o: { id: string; name: string }) => ({
  stored_id: o.id,
  name: o.name,
});

const groupToStoredID = (o: { group: { id: string; name: string } }) =>
  toStoredID(o.group);

// undefined when empty, like the target's lists, so empty rows stay hidden
const combinedStoredIDs = (items: { id: string; name: string }[]) =>
  sortStoredIdObjects(uniqIDStoredIDs(items.map(toStoredID)));

// Converts the source scene into a release of dest, choosing which source
// values dest also takes, like the Merge dialog.
export const SceneReleaseConvertDialog: React.FC<
  ISceneReleaseConvertDialogProps
> = ({ dest, source, running, onClose }) => {
  const intl = useIntl();
  const defaults = useMemo(
    () => convertSourceDefaults(dest, source),
    [dest, source]
  );
  const ratingChoice = useMemo(
    () => ratingMergeChoice(dest, [source]),
    [dest, source]
  );
  const summary = summarizeSceneConversionCustom(source);

  const [title, setTitle] = useState(
    () => new ScrapeResult(dest.title, source.title, defaults.title)
  );
  const [code, setCode] = useState(
    () => new ScrapeResult(dest.code, source.code, defaults.code)
  );
  const [urls, setURLs] = useState(
    () =>
      new ScrapeResult(
        dest.urls,
        uniq([...dest.urls, ...source.urls]),
        defaults.urls
      )
  );
  const [date, setDate] = useState(
    () => new ScrapeResult(dest.date, source.date, defaults.date)
  );
  const [director, setDirector] = useState(
    () => new ScrapeResult(dest.director, source.director, defaults.director)
  );
  const [rating, setRating] = useState(() => valueResult(dest, ratingChoice));
  const [studio, setStudio] = useState(
    () =>
      new ScrapeResult<GQL.ScrapedStudio>(
        dest.studio ? toStoredID(dest.studio) : undefined,
        source.studio ? toStoredID(source.studio) : undefined,
        defaults.studio
      )
  );
  const [performers, setPerformers] = useState(
    () =>
      new ObjectListScrapeResult<GQL.ScrapedPerformer>(
        sortStoredIdObjects(dest.performers.map(toStoredID)),
        combinedStoredIDs([...dest.performers, ...source.performers]),
        defaults.performers
      )
  );
  const [groups, setGroups] = useState(
    () =>
      new ObjectListScrapeResult<GQL.ScrapedGroup>(
        sortStoredIdObjects(dest.groups.map(groupToStoredID)),
        combinedStoredIDs(
          [...dest.groups, ...source.groups].map((g) => g.group)
        ),
        defaults.groups
      )
  );
  const [tags, setTags] = useState(
    () =>
      new ObjectListScrapeResult<GQL.ScrapedTag>(
        sortStoredIdObjects(dest.tags.map(toStoredID)),
        combinedStoredIDs([...dest.tags, ...source.tags]),
        defaults.tags
      )
  );
  const [details, setDetails] = useState(
    () => new ScrapeResult(dest.details, source.details, defaults.details)
  );
  const [galleries, setGalleries] = useState(
    () =>
      new ScrapeResult(
        dest.galleries.map((g) => g.id),
        uniq([...dest.galleries, ...source.galleries].map((g) => g.id)),
        defaults.galleries
      )
  );
  const [organized, setOrganized] = useState(
    () => new ZeroableScrapeResult(dest.organized, source.organized, false)
  );
  // Source Stash IDs point at the source's StashDB scene; offer, never default.
  const [stashIDs, setStashIDs] = useState(
    () =>
      new ScrapeResult(
        dest.stash_ids,
        [...dest.stash_ids, ...source.stash_ids].filter(
          (s, index, all) =>
            index === all.findIndex((o) => o.endpoint === s.endpoint)
        ),
        false
      )
  );
  const [customFields, setCustomFields] = useState<CustomFieldScrapeResults>(
    () =>
      new Map(
        uniq([
          ...Object.keys(dest.custom_fields ?? {}),
          ...Object.keys(source.custom_fields ?? {}),
        ])
          .sort()
          .map((field) => [
            field,
            new ScrapeResult(
              dest.custom_fields?.[field],
              source.custom_fields?.[field],
              dest.custom_fields?.[field] === undefined
            ),
          ])
      )
  );

  // All or nothing: the release keeps the source's markers either way.
  const markerCount = source.scene_markers.length;
  const [copyMarkers, setCopyMarkers] = useState(false);

  const canCompareCovers = !!dest.paths.screenshot && !!source.paths.screenshot;
  const [image, setImage] = useState(
    () => new ScrapeResult<string>(dest.paths.screenshot)
  );
  const [loadingImage, setLoadingImage] = useState(canCompareCovers);
  useEffect(() => {
    if (!canCompareCovers) return;
    let cancelled = false;
    Promise.all([
      ImageUtils.imageToDataURL(dest.paths.screenshot!),
      ImageUtils.imageToDataURL(source.paths.screenshot!),
    ])
      .then(([destData, sourceData]) => {
        // keep the target's cover by default
        if (!cancelled) setImage(new ScrapeResult(destData, sourceData, false));
      })
      .catch(() => {}) // without the images the cover row stays hidden
      .finally(() => {
        if (!cancelled) setLoadingImage(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canCompareCovers, dest.paths.screenshot, source.paths.screenshot]);

  const hasValues =
    ratingChoice.candidates.length > 0 ||
    markerCount > 0 ||
    hasScrapedValues([
      title,
      code,
      urls,
      date,
      director,
      studio,
      performers,
      groups,
      tags,
      details,
      galleries,
      organized,
      stashIDs,
      image,
      ...Array.from(customFields.values()),
    ]);

  function createChoices(): SceneReleaseConvertChoices {
    const customFieldValues = Object.fromEntries(
      Array.from(customFields.entries()).flatMap(([field, v]) =>
        v.useNewValue ? [[field, v.getNewValue()]] : []
      )
    );
    const values: GQL.SceneUpdateInput = {
      id: dest.id,
      title: title.getNewValue(),
      code: code.getNewValue(),
      urls: urls.getNewValue(),
      date: date.getNewValue(),
      director: director.getNewValue(),
      studio_id: studio.getNewValue()?.stored_id,
      performer_ids: performers.getNewValue()?.map((p) => p.stored_id!),
      groups: groups.getNewValue()?.map((g) => ({
        group_id: g.stored_id!,
        scene_index: [...dest.groups, ...source.groups].find(
          (sg) => sg.group.id === g.stored_id
        )?.scene_index,
      })),
      tag_ids: tags.getNewValue()?.map((t) => t.stored_id!),
      details: details.getNewValue(),
      gallery_ids: galleries.getNewValue(),
      organized: organized.getNewValue(),
      stash_ids: stashIDs.getNewValue()?.map((s) => ({
        endpoint: s.endpoint,
        stash_id: s.stash_id,
        updated_at: s.updated_at,
      })),
      stashdb_matches: convertStashDBMatchesCustom(
        dest,
        source,
        stashIDs.getNewValue()
      ),
      cover_image: image.getNewValue(),
      custom_fields: Object.keys(customFieldValues).length
        ? { partial: customFieldValues }
        : undefined,
    };
    const changed = Object.entries(values).filter(
      ([key, value]) => key !== "id" && value !== undefined
    );

    return {
      target_values: changed.length
        ? (Object.fromEntries([
            ["id", dest.id],
            ...changed,
          ]) as GQL.SceneUpdateInput)
        : undefined,
      copy_rating_to_target:
        ratingChoice.candidates.length > 0 &&
        rating.getNewValue() === source.id,
      copy_markers_to_target: markerCount > 0 && copyMarkers,
    };
  }

  function renderRows() {
    if (loadingImage) return <LoadingIndicator />;
    if (!hasValues) {
      return (
        <div className="px-3">
          <FormattedMessage id="dialogs.merge.empty_results" />
        </div>
      );
    }

    const trueString = intl.formatMessage({ id: "true" });
    const falseString = intl.formatMessage({ id: "false" });

    return (
      <>
        <ScrapedInputGroupRow
          field="title"
          title={intl.formatMessage({ id: "title" })}
          result={title}
          onChange={setTitle}
        />
        <ScrapedInputGroupRow
          field="code"
          title={intl.formatMessage({ id: "scene_code" })}
          result={code}
          onChange={setCode}
        />
        <ScrapedStringListRow
          field="urls"
          title={intl.formatMessage({ id: "urls" })}
          result={urls}
          onChange={setURLs}
        />
        <ScrapedInputGroupRow
          field="date"
          title={intl.formatMessage({ id: "date" })}
          placeholder="YYYY-MM-DD"
          result={date}
          onChange={setDate}
        />
        <ScrapedInputGroupRow
          field="director"
          title={intl.formatMessage({ id: "director" })}
          result={director}
          onChange={setDirector}
        />
        {ratingChoice.candidates.length > 0 && (
          <SceneRatingChoiceRow
            choice={ratingChoice}
            result={rating}
            dest={dest}
            onChange={setRating}
          />
        )}
        <ScrapedStudioRow
          field="studio"
          title={intl.formatMessage({ id: "studios" })}
          result={studio}
          onChange={setStudio}
        />
        <ScrapedPerformersRow
          field="performers"
          title={intl.formatMessage({ id: "performers" })}
          result={performers}
          onChange={setPerformers}
          ageFromDate={date.useNewValue ? date.newValue : date.originalValue}
        />
        <ScrapedGroupsRow
          field="groups"
          title={intl.formatMessage({ id: "groups" })}
          result={groups}
          onChange={setGroups}
        />
        <ScrapedTagsRow
          field="tags"
          title={intl.formatMessage({ id: "tags" })}
          result={tags}
          onChange={setTags}
        />
        <ScrapedTextAreaRow
          field="details"
          title={intl.formatMessage({ id: "details" })}
          result={details}
          onChange={setDetails}
        />
        <ScrapeDialogRow
          field="galleries"
          title={intl.formatMessage({ id: "galleries" })}
          result={galleries}
          originalField={
            <GallerySelect
              className="form-control react-select"
              ids={galleries.originalValue ?? []}
              onSelect={() => {}}
              isMulti
              isDisabled
            />
          }
          newField={
            <GallerySelect
              className="form-control react-select"
              ids={galleries.newValue ?? []}
              onSelect={() => {}}
              isMulti
              isDisabled
            />
          }
          onChange={setGalleries}
        />
        <ScrapeDialogRow
          field="organized"
          title={intl.formatMessage({ id: "organized" })}
          result={organized}
          originalField={
            <FormControl
              value={organized.originalValue ? trueString : falseString}
              readOnly
              className="bg-secondary text-white border-secondary"
            />
          }
          newField={
            <FormControl
              value={organized.newValue ? trueString : falseString}
              readOnly
              className="bg-secondary text-white border-secondary"
            />
          }
          onChange={setOrganized}
        />
        <ScrapeDialogRow
          field="stash_ids"
          title={intl.formatMessage({ id: "stash_id" })}
          result={stashIDs}
          originalField={
            <StashIDsField values={stashIDs.originalValue ?? []} />
          }
          newField={<StashIDsField values={stashIDs.newValue ?? []} />}
          onChange={setStashIDs}
        />
        <ScrapedImageRow
          field="cover_image"
          title={intl.formatMessage({ id: "cover_image" })}
          className="scene-cover"
          result={image}
          onChange={setImage}
        />
        {markerCount > 0 && (
          <Row className="px-3 pt-3">
            <Form.Label column lg="3">
              {intl.formatMessage({ id: "markers" })}
            </Form.Label>
            <Col lg="9" className="d-flex align-items-center">
              <Form.Check
                id="convert-copy-markers"
                checked={copyMarkers}
                onChange={(e) => setCopyMarkers(e.currentTarget.checked)}
                label={`Copy all ${markerCount} markers to this scene`}
              />
            </Col>
          </Row>
        )}
        {customFields.size > 0 && (
          <ScrapedCustomFieldRows
            results={customFields}
            onChange={setCustomFields}
          />
        )}
      </>
    );
  }

  return (
    <ScrapeDialog
      title="Convert Scene to Release"
      existingLabel="This scene"
      scrapedLabel={intl.formatMessage({ id: "dialogs.merge.source" })}
      acceptText="Convert to Release"
      isRunning={running}
      header={
        <div className="px-3 pt-3">
          <dl className="row mb-2">
            <dt className="col-3">Source</dt>
            <dd className="col-9">{source.title || source.id}</dd>
            <dt className="col-3">Moving</dt>
            <dd className="col-9">
              {summary.files} files · {summary.plays} plays · {summary.oEvents}{" "}
              O events
              {source.releases.length > 0 &&
                ` · ${source.releases.length} existing releases`}
            </dd>
          </dl>
          <p className="text-muted mb-0">
            The new release keeps everything but the rating from the source
            scene, which is then removed. Releases share this scene&apos;s
            rating. Pick what this scene also takes.
          </p>
        </div>
      }
      onClose={(apply) => onClose(apply ? createChoices() : undefined)}
    >
      {renderRows()}
    </ScrapeDialog>
  );
};
