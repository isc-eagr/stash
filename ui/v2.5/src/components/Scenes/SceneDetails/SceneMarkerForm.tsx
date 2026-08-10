import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Col, Form, Row } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import { useFormik, type FormikErrors } from "formik"; // CUSTOM
import * as yup from "yup";
import * as GQL from "src/core/generated-graphql";
import {
  useSceneMarkerCreate,
  useSceneMarkerUpdate,
  useSceneMarkerDestroy,
  useFindScene, // CUSTOM
  useSceneNegativeMarkerNames, // CUSTOM
} from "src/core/StashService";
import { DurationInput } from "src/components/Shared/DurationInput";
import { MarkerTitleSuggest } from "src/components/Shared/Select";
import {
  getAbLoopPlugin,
  getPlayerPosition,
  getPlayer, // CUSTOM
} from "src/components/ScenePlayer/util";
import { useToast } from "src/hooks/Toast";
import isEqual from "lodash-es/isEqual";
import { formikUtils } from "src/utils/form";
import { yupFormikValidate } from "src/utils/yup";
import { Tag, TagSelect } from "src/components/Tags/TagSelect";
// CUSTOM: begin – performer selection imports & type
import Select, {
  components as reactSelectComponents,
  type OptionProps,
} from "react-select";
import { Icon } from "src/components/Shared/Icon";
import {
  faArrowDown,
  faArrowUp,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import TextUtils from "src/utils/text";
import { useConfigurationContext } from "src/hooks/Config"; // CUSTOM
// CUSTOM: begin
import {
  findSceneMarkerWarnings,
  type SceneMarkerGapTag,
  type SceneMarkerWarning,
} from "./sceneMarkerGapWarning_custom";
import {
  getSceneMarkerDuplicateValues,
  getSceneMarkerInsertRangeErrors,
  getSceneMarkerInsertRecordKind,
  getSceneMarkerSplitBounds,
  INSERT_MARKER_SOURCE_END_REQUIRED,
  type SceneMarkerInsertMode,
} from "./sceneMarkerFormActions_custom";
// CUSTOM: end

interface IPerformer {
  id: string;
  name: string;
  alias_list: string[];
  disambiguation?: string | null;
  image_path?: string | null;
}

interface IPerformerSelectOption {
  value: string;
  label: string;
  performer: IPerformer;
}

const PerformerSelectFace: React.FC<{ performer: IPerformer }> = ({
  performer,
}) => (
  <span className="scene-marker-form-performer-face">
    {performer.image_path ? (
      <img src={performer.image_path} alt={performer.name} />
    ) : (
      <Icon icon={faUser} />
    )}
  </span>
);

const PerformerSelectOption: React.FC<
  OptionProps<IPerformerSelectOption, true>
> = (props) => {
  // CUSTOM: react-select's mousemove focus churns in this image grid and can
  // leave options looking hovered or flashing between performers.
  const { onMouseMove, onMouseOver, ...stableInnerProps } = props.innerProps;

  void onMouseMove;
  void onMouseOver;

  return (
    <reactSelectComponents.Option
      {...props}
      className={`${
        props.className ?? ""
      } scene-marker-form-performer-select-option`}
      innerProps={stableInnerProps}
    >
      <div className="scene-marker-form-performer-option">
        <PerformerSelectFace performer={props.data.performer} />
        <span className="scene-marker-form-performer-option-label">
          {props.data.label}
        </span>
      </div>
    </reactSelectComponents.Option>
  );
};

// CUSTOM: end

interface ISceneMarkerForm {
  sceneID: string;
  marker?: GQL.SceneMarkerDataFragment;
  onClose: () => void;
}

export const SceneMarkerForm: React.FC<ISceneMarkerForm> = ({
  sceneID,
  marker,
  onClose,
}) => {
  const intl = useIntl();

  const [sceneMarkerCreate] = useSceneMarkerCreate();
  const [sceneMarkerUpdate] = useSceneMarkerUpdate();
  const [sceneMarkerDestroy] = useSceneMarkerDestroy();
  const [sceneNegativeMarkerUpdate] =
    GQL.useSceneNegativeMarkerUpdateMutation(); // CUSTOM
  // CUSTOM: begin - inserted negative marker lifecycle
  const [sceneNegativeMarkerCreate] = GQL.useSceneNegativeMarkerCreateMutation({
    refetchQueries: ["FindScene"],
    awaitRefetchQueries: true,
  });
  const [sceneNegativeMarkerDestroy] =
    GQL.useSceneNegativeMarkerDestroyMutation({
      refetchQueries: ["FindScene"],
      awaitRefetchQueries: true,
    });
  // CUSTOM: end
  const Toast = useToast();
  const { configuration } = useConfigurationContext(); // CUSTOM

  const [primaryTag, setPrimaryTag] = useState<Tag>();
  const [tags, setTags] = useState<Tag[]>([]);
  // CUSTOM: begin - create a duplicate or a bounded marker from the edit form
  const [createAction, setCreateAction] = useState<
    "duplicate" | "insert-between"
  >();
  const isInsertBetween = createAction === "insert-between";
  const isNew = marker === undefined || createAction !== undefined;
  const draftMarker = isInsertBetween ? undefined : marker;
  // CUSTOM: end
  // CUSTOM: begin – performer state & scene data
  const [topPerformers, setTopPerformers] = useState<IPerformer[]>([]);
  const [bottomPerformers, setBottomPerformers] = useState<IPerformer[]>([]);

  // Fetch scene to get available performers
  const { data: sceneData } = useFindScene(sceneID);
  const scenePerformers = useMemo(() => {
    return (
      sceneData?.findScene?.performers?.map((p) => ({
        id: p.id,
        name: p.name,
        alias_list: p.alias_list ?? [],
        disambiguation: p.disambiguation,
        image_path: p.image_path,
      })) ?? []
    );
  }, [sceneData]);
  // CUSTOM: end

  const schema = yup.object({
    insert_mode: yup
      .mixed<SceneMarkerInsertMode>()
      .oneOf(["marker", "negative-marker", "gap"])
      .defined(), // CUSTOM
    title: yup.string().ensure(),
    seconds: yup.number().min(0).required(),
    end_seconds: yup
      .number()
      .min(0)
      .nullable()
      .defined()
      .test(
        "is-greater-than-seconds",
        intl.formatMessage({ id: "validation.end_time_before_start_time" }),
        function (value) {
          return value === null || value >= this.parent.seconds;
        }
      )
      // CUSTOM: negative markers require a positive-duration range.
      .test(
        "negative-marker-has-duration",
        intl.formatMessage({ id: "validation.end_time_before_start_time" }),
        function (value) {
          return (
            this.parent.insert_mode !== "negative-marker" ||
            (value !== null && value > this.parent.seconds)
          );
        }
      ),
    primary_tag_id: yup
      .string()
      .defined()
      .test("required-for-regular-marker", "Required", function (value) {
        return this.parent.insert_mode !== "marker" || !!value;
      }), // CUSTOM
    tag_ids: yup.array(yup.string().required()).defined(),
    top_performer_ids: yup.array(yup.string().required()).defined(), // CUSTOM
    bottom_performer_ids: yup.array(yup.string().required()).defined(), // CUSTOM
  });

  // useMemo to only run getPlayerPosition when the input marker actually changes
  const initialValues = useMemo(() => {
    if (!draftMarker) {
      // CUSTOM: insert-between uses normal new-marker defaults
      const abLoopPlugin = getAbLoopPlugin();
      const opts = abLoopPlugin?.getOptions();
      const start = opts?.start;
      const end = opts?.end;
      const hasAbLoop = Number.isFinite(start);

      if (opts?.enabled && hasAbLoop) {
        const current = Math.round(getPlayerPosition() ?? 0);
        const rawEnd =
          Number.isFinite(end) && (end as number) > 0 ? (end as number) : null;
        const endSeconds =
          rawEnd !== null ? rawEnd : Math.max(start as number, current);

        return {
          insert_mode: "marker" as const, // CUSTOM
          title: "",
          seconds: start as number,
          end_seconds: endSeconds,
          primary_tag_id: "",
          tag_ids: [],
          top_performer_ids: [],
          bottom_performer_ids: [],
        };
      }
    }

    if (draftMarker) {
      return {
        insert_mode: "marker" as const,
        ...getSceneMarkerDuplicateValues(draftMarker),
      }; // CUSTOM
    }

    return {
      insert_mode: "marker" as const, // CUSTOM
      title: "",
      seconds: Math.round(getPlayerPosition() ?? 0),
      end_seconds: null,
      primary_tag_id: "",
      tag_ids: [],
      top_performer_ids: [],
      bottom_performer_ids: [],
    };
  }, [draftMarker]); // CUSTOM

  type InputValues = yup.InferType<typeof schema>;
  const validateSchema = yupFormikValidate<InputValues>(schema); // CUSTOM

  const formik = useFormik<InputValues>({
    initialValues,
    enableReinitialize: true,
    validateOnMount: isInsertBetween, // CUSTOM
    // CUSTOM: begin - enforce strict millisecond bounds for inserted markers
    validate: async (values) => {
      const errors = await validateSchema(values);
      if (!isInsertBetween || !marker) return errors;

      return {
        ...errors,
        ...getSceneMarkerInsertRangeErrors(marker, values),
      } as FormikErrors<InputValues>;
    },
    // CUSTOM: end
    onSubmit: (values) => onSave(schema.cast(values)),
  });
  // CUSTOM: fetch negative titles only while that insert mode is visible.
  const { data: negativeMarkerNameData, loading: negativeMarkerNamesLoading } =
    useSceneNegativeMarkerNames(
      !isInsertBetween || formik.values.insert_mode !== "negative-marker"
    );
  const negativeMarkerTitles =
    negativeMarkerNameData?.sceneNegativeMarkerNames ?? [];

  // CUSTOM: begin - warn about marker quality issues without blocking saves
  const markerWarnings = useMemo(
    () =>
      findSceneMarkerWarnings({
        draft: {
          id: isNew ? undefined : marker?.id, // CUSTOM
          seconds: formik.values.seconds,
          end_seconds: formik.values.end_seconds,
          primary_tag_id: formik.values.primary_tag_id,
          tag_ids: formik.values.tag_ids,
          primary_tag: primaryTag as unknown as SceneMarkerGapTag | undefined,
          tags: tags as unknown as SceneMarkerGapTag[],
          top_performer_ids: formik.values.top_performer_ids,
          bottom_performer_ids: formik.values.bottom_performer_ids,
        },
        sceneMarkers: sceneData?.findScene?.scene_markers ?? [],
        negativeMarkers: sceneData?.findScene?.negative_markers ?? [],
        roleTagIds: configuration?.ui.roleTagIds ?? {},
      }),
    [
      configuration?.ui.roleTagIds,
      formik.values.bottom_performer_ids,
      formik.values.end_seconds,
      formik.values.primary_tag_id,
      formik.values.seconds,
      formik.values.tag_ids,
      formik.values.top_performer_ids,
      isNew, // CUSTOM
      marker?.id,
      primaryTag,
      sceneData?.findScene?.negative_markers,
      sceneData?.findScene?.scene_markers,
      tags,
    ]
  );
  const gapWarnings = useMemo(() => {
    const previous = markerWarnings.find(
      (warning) => warning.boundary === "previous"
    )?.gapWarning;
    const next = markerWarnings.find(
      (warning) => warning.boundary === "next"
    )?.gapWarning;

    return previous || next ? { previous, next } : undefined;
  }, [markerWarnings]);
  const [heldMissingEndWarning, setHeldMissingEndWarning] =
    useState<SceneMarkerWarning>();
  const displayedMarkerWarnings = useMemo(() => {
    if (
      !heldMissingEndWarning ||
      markerWarnings.some((warning) => warning.issueType === "missing-end-time")
    ) {
      return markerWarnings;
    }

    return [heldMissingEndWarning, ...markerWarnings];
  }, [heldMissingEndWarning, markerWarnings]);
  // CUSTOM: end

  function onSetPrimaryTag(item: Tag) {
    setPrimaryTag(item);
    formik.setFieldValue("primary_tag_id", item.id);
  }

  function onSetTags(items: Tag[]) {
    setTags(items);
    formik.setFieldValue(
      "tag_ids",
      items.map((item) => item.id)
    );
  }

  // CUSTOM: begin – performer setter functions
  function onSetTopPerformers(items: IPerformer[]) {
    setTopPerformers(items);
    formik.setFieldValue(
      "top_performer_ids",
      items.map((item) => item.id)
    );
  }

  function onSetBottomPerformers(items: IPerformer[]) {
    setBottomPerformers(items);
    formik.setFieldValue(
      "bottom_performer_ids",
      items.map((item) => item.id)
    );
  }
  // CUSTOM: end

  // CUSTOM: begin - discard edit-form changes before opening the duplicate draft
  function onDuplicateMarker() {
    if (!marker) return;

    formik.resetForm({
      values: {
        insert_mode: "marker",
        ...getSceneMarkerDuplicateValues(marker),
      },
    });
    setPrimaryTag({
      ...marker.primary_tag,
      aliases: [],
      stash_ids: [],
    });
    setTags(
      marker.tags.map((tag) => ({
        ...tag,
        aliases: [],
        stash_ids: [],
      }))
    );
    setTopPerformers(
      marker.top_performers?.map((performer) => ({
        ...performer,
        image_path: performer.image_path,
      })) ?? []
    );
    setBottomPerformers(
      marker.bottom_performers?.map((performer) => ({
        ...performer,
        image_path: performer.image_path,
      })) ?? []
    );
    setCreateAction("duplicate");
  }
  // CUSTOM: end

  useEffect(() => {
    setPrimaryTag(
      draftMarker?.primary_tag
        ? { ...draftMarker.primary_tag, aliases: [], stash_ids: [] }
        : undefined
    );
  }, [draftMarker?.primary_tag]); // CUSTOM

  useEffect(() => {
    setTags(
      draftMarker?.tags.map((t) => ({
        ...t,
        aliases: [],
        stash_ids: [],
      })) ?? []
    );
  }, [draftMarker?.tags]); // CUSTOM

  // CUSTOM: begin – sync performer state from marker
  useEffect(() => {
    setTopPerformers(
      draftMarker?.top_performers?.map((p) => ({
        id: p.id,
        name: p.name,
        alias_list: p.alias_list ?? [],
        disambiguation: p.disambiguation,
        image_path: p.image_path,
      })) ?? []
    );
  }, [draftMarker?.top_performers]); // CUSTOM

  useEffect(() => {
    setBottomPerformers(
      draftMarker?.bottom_performers?.map((p) => ({
        id: p.id,
        name: p.name,
        alias_list: p.alias_list ?? [],
        disambiguation: p.disambiguation,
        image_path: p.image_path,
      })) ?? []
    );
  }, [draftMarker?.bottom_performers]); // CUSTOM
  // CUSTOM: end

  async function onSave(input: InputValues) {
    const createdMarkerIDs: string[] = []; // CUSTOM: rollback split creates on failure
    const createdNegativeMarkerIDs: string[] = []; // CUSTOM

    try {
      // CUSTOM: begin - insert a marker, clone the right side, then shorten the source
      if (isInsertBetween && marker) {
        const rangeErrors = getSceneMarkerInsertRangeErrors(marker, input);
        if (Object.keys(rangeErrors).length > 0 || input.end_seconds === null) {
          await formik.setErrors(rangeErrors as FormikErrors<InputValues>);
          return;
        }

        const insertedRecordKind = getSceneMarkerInsertRecordKind(
          input.insert_mode
        );
        if (insertedRecordKind === "scene-marker") {
          const insertedResult = await sceneMarkerCreate({
            variables: {
              scene_id: sceneID,
              title: input.title,
              seconds: input.seconds,
              end_seconds: input.end_seconds,
              primary_tag_id: input.primary_tag_id,
              tag_ids: input.tag_ids,
              top_performer_ids: input.top_performer_ids,
              bottom_performer_ids: input.bottom_performer_ids,
            },
          });
          const insertedID = insertedResult.data?.sceneMarkerCreate?.id;
          if (!insertedID) {
            throw new Error("The in-between marker could not be created.");
          }
          createdMarkerIDs.push(insertedID);
        } else if (insertedRecordKind === "negative-marker") {
          const insertedResult = await sceneNegativeMarkerCreate({
            variables: {
              input: {
                scene_id: sceneID,
                name: input.title,
                start_seconds: input.seconds,
                end_seconds: input.end_seconds,
              },
            },
          });
          const insertedID = insertedResult.data?.sceneNegativeMarkerCreate?.id;
          if (!insertedID) {
            throw new Error(
              "The in-between negative marker could not be created."
            );
          }
          createdNegativeMarkerIDs.push(insertedID);
        }

        const splitBounds = getSceneMarkerSplitBounds({
          seconds: input.seconds,
          end_seconds: input.end_seconds,
        });
        const rightResult = await sceneMarkerCreate({
          variables: {
            scene_id: sceneID,
            title: marker.title,
            seconds: splitBounds.rightStartSeconds,
            end_seconds: marker.end_seconds,
            primary_tag_id: marker.primary_tag.id,
            tag_ids: marker.tags.map((tag) => tag.id),
            top_performer_ids:
              marker.top_performers?.map((performer) => performer.id) ?? [],
            bottom_performer_ids:
              marker.bottom_performers?.map((performer) => performer.id) ?? [],
          },
        });
        const rightID = rightResult.data?.sceneMarkerCreate?.id;
        if (!rightID) {
          throw new Error("The right side of the split could not be created.");
        }
        createdMarkerIDs.push(rightID);

        await sceneMarkerUpdate({
          variables: {
            id: marker.id,
            scene_id: sceneID,
            title: marker.title,
            seconds: marker.seconds,
            end_seconds: splitBounds.leftEndSeconds,
            primary_tag_id: marker.primary_tag.id,
            tag_ids: marker.tags.map((tag) => tag.id),
            top_performer_ids:
              marker.top_performers?.map((performer) => performer.id) ?? [],
            bottom_performer_ids:
              marker.bottom_performers?.map((performer) => performer.id) ?? [],
          },
        });
      } else if (isNew) {
        await sceneMarkerCreate({
          variables: {
            scene_id: sceneID,
            title: input.title,
            seconds: input.seconds,
            end_seconds: input.end_seconds ?? null,
            primary_tag_id: input.primary_tag_id,
            tag_ids: input.tag_ids,
            top_performer_ids: input.top_performer_ids,
            bottom_performer_ids: input.bottom_performer_ids,
          },
        });
      } else if (marker) {
        await sceneMarkerUpdate({
          variables: {
            id: marker.id,
            scene_id: sceneID,
            title: input.title,
            seconds: input.seconds,
            end_seconds: input.end_seconds ?? null,
            primary_tag_id: input.primary_tag_id,
            tag_ids: input.tag_ids,
            top_performer_ids: input.top_performer_ids,
            bottom_performer_ids: input.bottom_performer_ids,
          },
        });
      }
      // CUSTOM: end
    } catch (e) {
      // CUSTOM: remove the inserted/right markers if the original was not split.
      for (const id of createdMarkerIDs.reverse()) {
        try {
          await sceneMarkerDestroy({ variables: { id } });
        } catch (rollbackError) {
          Toast.error(rollbackError);
        }
      }
      for (const id of createdNegativeMarkerIDs.reverse()) {
        try {
          await sceneNegativeMarkerDestroy({ variables: { id } });
        } catch (rollbackError) {
          Toast.error(rollbackError);
        }
      }
      Toast.error(e);
      return;
    }

    onClose(); // CUSTOM: keep the form open when saving fails
  }

  async function onDelete() {
    if (isNew) return;

    try {
      await sceneMarkerDestroy({ variables: { id: marker.id } });
    } catch (e) {
      Toast.error(e);
    } finally {
      onClose();
    }
  }

  const splitProps = {
    labelProps: {
      column: true,
      sm: 3,
    },
    fieldProps: {
      sm: 9,
    },
  };
  const fullWidthProps = {
    labelProps: {
      column: true,
      sm: 3,
      xl: 12,
    },
    fieldProps: {
      sm: 9,
      xl: 12,
    },
  };
  const { renderField } = formikUtils(intl, formik, splitProps);

  function renderTitleField() {
    const title = intl.formatMessage({ id: "title" });
    const isNegativeMarkerInsert =
      isInsertBetween && formik.values.insert_mode === "negative-marker";
    const control = (
      <MarkerTitleSuggest
        initialMarkerTitle={formik.values.title}
        onChange={(v) => formik.setFieldValue("title", v)}
        additionalTitles={
          isNegativeMarkerInsert ? negativeMarkerTitles : undefined
        } // CUSTOM
        additionalTitlesLoading={
          isNegativeMarkerInsert ? negativeMarkerNamesLoading : undefined
        } // CUSTOM
        includeRegularTitles={!isNegativeMarkerInsert} // CUSTOM
      />
    );

    return renderField("title", title, control);
  }

  function renderPrimaryTagField() {
    const title = intl.formatMessage({ id: "primary_tag" });
    const control = (
      <>
        <TagSelect
          onSelect={(t) => onSetPrimaryTag(t[0])}
          values={primaryTag ? [primaryTag] : []}
          hoverPlacement="right"
        />
        {formik.touched.primary_tag_id && (
          <Form.Control.Feedback type="invalid">
            {formik.errors.primary_tag_id}
          </Form.Control.Feedback>
        )}
      </>
    );

    return renderField("primary_tag_id", title, control);
  }

  function renderTimeField() {
    const { error } = formik.getFieldMeta("seconds");

    const title = intl.formatMessage({ id: "time" });
    const control = (
      <DurationInput
        value={formik.values.seconds}
        setValue={(v) => formik.setFieldValue("seconds", v)}
        onReset={() =>
          formik.setFieldValue("seconds", getPlayerPosition() ?? 0)
        }
        // CUSTOM: begin – seek-to-time
        onSeekTo={() => {
          const player = getPlayer();
          if (player && formik.values.seconds !== null) {
            player.currentTime(formik.values.seconds);
          }
        }}
        // CUSTOM: end
        error={error}
      />
    );

    return renderField("seconds", title, control);
  }

  function renderEndTimeField() {
    const { error } = formik.getFieldMeta("end_seconds");

    const title = intl.formatMessage({ id: "time_end" });
    const control = (
      <div onMouseLeave={() => setHeldMissingEndWarning(undefined)}>
        <DurationInput
          value={formik.values.end_seconds}
          setValue={(v) => formik.setFieldValue("end_seconds", v ?? null)}
          onReset={() => {
            const missingEndWarning = markerWarnings.find(
              (warning) => warning.issueType === "missing-end-time"
            );
            if (missingEndWarning) {
              setHeldMissingEndWarning(missingEndWarning);
            }
            formik.setFieldValue("end_seconds", getPlayerPosition() ?? 0);
          }}
          // CUSTOM: begin – seek-to-time
          onSeekTo={() => {
            const player = getPlayer();
            if (player && formik.values.end_seconds !== null) {
              player.currentTime(formik.values.end_seconds);
            }
          }}
          // CUSTOM: end
          error={error}
        />
        {formik.touched.end_seconds && formik.errors.end_seconds && (
          <Form.Control.Feedback type="invalid">
            {formik.errors.end_seconds}
          </Form.Control.Feedback>
        )}
      </div>
    );

    return renderField("end_seconds", title, control);
  }

  // CUSTOM: begin – duration display field
  function renderDurationField() {
    const { seconds, end_seconds } = formik.values;
    const title = intl.formatMessage({
      id: "duration",
      defaultMessage: "Duration",
    });

    let duration: number;
    if (end_seconds === null || end_seconds === undefined) {
      duration = 20; // Default 20s when no end time
    } else if (end_seconds < seconds) {
      return null; // Invalid range
    } else {
      duration = end_seconds - seconds;
    }

    const control = (
      <Form.Control
        plaintext
        readOnly
        value={TextUtils.formatDurationRange(duration)}
      />
    );

    return (
      <Form.Group as={Row} data-field="duration_display">
        <Form.Label {...splitProps.labelProps}>{title}</Form.Label>
        <Col {...splitProps.fieldProps}>{control}</Col>
      </Form.Group>
    );
  }
  // CUSTOM: end

  // CUSTOM: begin - choose and explain the bounded insert mode
  function renderInsertModeField() {
    if (!isInsertBetween) return null;

    const modes: Array<{ value: SceneMarkerInsertMode; label: string }> = [
      { value: "marker", label: "Insert marker" },
      { value: "negative-marker", label: "Insert negative marker" },
      { value: "gap", label: "Create gap" },
    ];

    return (
      <Form.Group as={Row} data-field="insert_mode">
        <Form.Label {...splitProps.labelProps}>Insert mode</Form.Label>
        <Col {...splitProps.fieldProps}>
          {modes.map((mode) => (
            <Form.Check
              inline
              key={mode.value}
              type="radio"
              name="scene-marker-insert-mode"
              id={`scene-marker-insert-mode-${mode.value}`}
              label={mode.label}
              checked={formik.values.insert_mode === mode.value}
              onChange={() => formik.setFieldValue("insert_mode", mode.value)}
            />
          ))}
        </Col>
      </Form.Group>
    );
  }

  function renderCreateActionNotice() {
    if (createAction === "duplicate") {
      return (
        <Alert variant="info" className="py-2">
          This is a new marker preloaded from the original. The original marker
          will remain unchanged.
        </Alert>
      );
    }

    if (!isInsertBetween || !marker) return null;

    if (marker.end_seconds === null || marker.end_seconds === undefined) {
      return (
        <Alert variant="danger">{INSERT_MARKER_SOURCE_END_REQUIRED}</Alert>
      );
    }

    const modeDescription =
      formik.values.insert_mode === "marker"
        ? "A regular marker will occupy the selected range."
        : formik.values.insert_mode === "negative-marker"
        ? "A negative marker will occupy the selected range."
        : "No middle marker will be created; the selected range will remain as a gap.";

    return (
      <Alert variant="info" className="py-2">
        {modeDescription} Choose a range strictly inside{" "}
        {TextUtils.secondsToTimestamp(marker.seconds, true)} -{" "}
        {TextUtils.secondsToTimestamp(marker.end_seconds, true)}. Saving will
        split the original marker around this new range with one-millisecond
        boundaries.
      </Alert>
    );
  }
  // CUSTOM: end

  // CUSTOM: begin - marker warning display
  function renderGapWarning() {
    if (displayedMarkerWarnings.length === 0) return null;

    const closePreviousGap = async () => {
      if (!gapWarnings?.previous) return;
      await formik.setFieldValue(
        "seconds",
        gapWarnings.previous.closeToSeconds
      );
    };
    const closeNextGap = async () => {
      if (!gapWarnings?.next) return;
      await formik.setFieldValue(
        "end_seconds",
        gapWarnings.next.closeToSeconds
      );
    };
    const closeAllGaps = async () => {
      await closePreviousGap();
      await closeNextGap();
    };
    const closeOtherMarkerGap = async (boundary: "previous" | "next") => {
      const warning = gapWarnings?.[boundary];
      if (!warning?.adjacentMarkerId) return;

      try {
        if (warning.adjacentMarkerKind === "negative-marker") {
          await sceneNegativeMarkerUpdate({
            variables: {
              input: {
                id: warning.adjacentMarkerId,
                ...(boundary === "previous"
                  ? { end_seconds: warning.otherCloseToSeconds }
                  : { start_seconds: warning.otherCloseToSeconds }),
              },
            },
          });
          return;
        }

        const adjacentMarker = sceneData?.findScene?.scene_markers.find(
          (sceneMarker) => sceneMarker.id === warning.adjacentMarkerId
        );
        if (!adjacentMarker) return;

        await sceneMarkerUpdate({
          variables: {
            id: adjacentMarker.id,
            scene_id: sceneID,
            title: adjacentMarker.title,
            seconds:
              boundary === "next"
                ? warning.otherCloseToSeconds
                : adjacentMarker.seconds,
            end_seconds:
              boundary === "previous"
                ? warning.otherCloseToSeconds
                : adjacentMarker.end_seconds ?? null,
            primary_tag_id: adjacentMarker.primary_tag.id,
            tag_ids: adjacentMarker.tags.map((tag) => tag.id),
            top_performer_ids:
              adjacentMarker.top_performers?.map((performer) => performer.id) ??
              [],
            bottom_performer_ids:
              adjacentMarker.bottom_performers?.map(
                (performer) => performer.id
              ) ?? [],
          },
        });
      } catch (e) {
        Toast.error(e);
      }
    };
    const closeAllOtherMarkerGaps = async () => {
      await closeOtherMarkerGap("previous");
      await closeOtherMarkerGap("next");
    };
    const canCloseAllOtherMarkerGaps =
      !!gapWarnings?.previous?.adjacentMarkerId &&
      !!gapWarnings?.next?.adjacentMarkerId;

    return (
      <Alert variant="warning" className="py-2">
        {displayedMarkerWarnings.length === 1 ? (
          <div>{displayedMarkerWarnings[0].message}</div>
        ) : (
          <ul className="mb-0 pl-3">
            {displayedMarkerWarnings.map((warning, index) => (
              <li key={`${warning.issueType}-${warning.boundary ?? index}`}>
                {warning.message}
              </li>
            ))}
          </ul>
        )}
        {gapWarnings && (
          <div className="mt-2 d-flex flex-wrap" style={{ gap: "0.5rem" }}>
            {gapWarnings.previous && (
              <Button size="sm" variant="warning" onClick={closePreviousGap}>
                Fix previous on this marker
              </Button>
            )}
            {gapWarnings.previous?.adjacentMarkerId && (
              <Button
                size="sm"
                variant="warning"
                onClick={() => closeOtherMarkerGap("previous")}
              >
                Fix previous on other marker
              </Button>
            )}
            {gapWarnings.next && (
              <Button size="sm" variant="warning" onClick={closeNextGap}>
                Fix next on this marker
              </Button>
            )}
            {gapWarnings.next?.adjacentMarkerId && (
              <Button
                size="sm"
                variant="warning"
                onClick={() => closeOtherMarkerGap("next")}
              >
                Fix next on other marker
              </Button>
            )}
            {gapWarnings.previous && gapWarnings.next && (
              <Button size="sm" variant="warning" onClick={closeAllGaps}>
                Fix both on this marker
              </Button>
            )}
            {canCloseAllOtherMarkerGaps && (
              <Button
                size="sm"
                variant="warning"
                onClick={closeAllOtherMarkerGaps}
              >
                Fix both on other marker
              </Button>
            )}
          </div>
        )}
      </Alert>
    );
  }
  // CUSTOM: end

  function renderTagsField() {
    const title = intl.formatMessage({ id: "tags" });
    const control = (
      <TagSelect
        isMulti
        onSelect={onSetTags}
        values={tags}
        hoverPlacement="right"
      />
    );

    return renderField("tag_ids", title, control, fullWidthProps);
  }

  // CUSTOM: begin – performer picker (top/bottom)
  function renderPerformersField() {
    if (scenePerformers.length === 0) return null;

    // Create options from scene performers only
    const performerOptions: IPerformerSelectOption[] = scenePerformers.map(
      (p) => ({
        value: p.id,
        label: p.disambiguation ? `${p.name} (${p.disambiguation})` : p.name,
        performer: p,
      })
    );

    // Top performers
    const topTitle = intl.formatMessage({
      id: "top_performers",
      defaultMessage: "Top Vatos",
    });

    const selectedTopValues: IPerformerSelectOption[] = topPerformers.map(
      (p) => ({
        value: p.id,
        label: p.disambiguation ? `${p.name} (${p.disambiguation})` : p.name,
        performer: p,
      })
    );
    const performerSelectStyles = {
      menuPortal: (base: Record<string, unknown>) => ({
        ...base,
        zIndex: 9999,
      }),
      menuList: (base: Record<string, unknown>) => ({
        ...base,
        display: "flex",
        flexWrap: "wrap" as const,
        gap: "0.75rem",
        maxHeight: "28rem",
        padding: "0.75rem",
      }),
      option: (
        base: Record<string, unknown>,
        state: { isFocused: boolean; isSelected: boolean }
      ) => ({
        ...base,
        alignItems: "flex-start",
        backgroundColor: state.isSelected
          ? // CUSTOM: Black Steel uses copper while the fallback preserves upstream styling.
            "var(--black-steel-accent-dark, rgba(72, 175, 240, 0.22))"
          : "transparent",
        borderRadius: "0.25rem",
        display: "flex",
        flex: "0 0 auto",
        justifyContent: "center",
        padding: "0.45rem",
        transition: "none",
        width: "auto",
      }),
    };

    const topControl = (
      <div className="d-flex align-items-center">
        <Icon icon={faArrowUp} className="text-info mr-2" title="Top" />
        <div className="flex-grow-1">
          <Select<IPerformerSelectOption, true>
            className="react-select scene-marker-form-performer-select"
            classNamePrefix="react-select"
            isMulti
            options={performerOptions}
            value={selectedTopValues}
            onChange={(selected) => {
              const selectedPerformers = (selected ?? []).map((opt) => {
                return opt.performer;
              });
              onSetTopPerformers(selectedPerformers);
            }}
            components={{
              Option: PerformerSelectOption,
            }}
            placeholder={intl.formatMessage({
              id: "actions.select_performers",
            })}
            menuPortalTarget={document.body}
            menuPlacement="auto"
            styles={performerSelectStyles}
          />
        </div>
      </div>
    );

    // Bottom performers
    const bottomTitle = intl.formatMessage({
      id: "bottom_performers",
      defaultMessage: "Bottom Vatos",
    });

    const selectedBottomValues: IPerformerSelectOption[] = bottomPerformers.map(
      (p) => ({
        value: p.id,
        label: p.disambiguation ? `${p.name} (${p.disambiguation})` : p.name,
        performer: p,
      })
    );

    const bottomControl = (
      <div className="d-flex align-items-center">
        <Icon icon={faArrowDown} className="text-success mr-2" title="Bottom" />
        <div className="flex-grow-1">
          <Select<IPerformerSelectOption, true>
            className="react-select scene-marker-form-performer-select"
            classNamePrefix="react-select"
            isMulti
            options={performerOptions}
            value={selectedBottomValues}
            onChange={(selected) => {
              const selectedPerformers = (selected ?? []).map((opt) => {
                return opt.performer;
              });
              onSetBottomPerformers(selectedPerformers);
            }}
            components={{
              Option: PerformerSelectOption,
            }}
            placeholder={intl.formatMessage({
              id: "actions.select_performers",
            })}
            menuPortalTarget={document.body}
            menuPlacement="top"
            styles={performerSelectStyles}
          />
        </div>
      </div>
    );

    return (
      <>
        {renderField("top_performer_ids", topTitle, topControl, fullWidthProps)}
        {renderField(
          "bottom_performer_ids",
          bottomTitle,
          bottomControl,
          fullWidthProps
        )}
      </>
    );
  }
  // CUSTOM: end

  return (
    <Form noValidate onSubmit={formik.handleSubmit}>
      <div className="form-container px-3">
        {renderInsertModeField()}
        {renderCreateActionNotice()}
        {(!isInsertBetween || formik.values.insert_mode !== "gap") &&
          renderTitleField()}
        {(!isInsertBetween || formik.values.insert_mode === "marker") &&
          renderPrimaryTagField()}
        {renderTimeField()}
        {renderEndTimeField()}
        {renderDurationField()}
        {(!isInsertBetween || formik.values.insert_mode === "marker") &&
          renderGapWarning()}
        {(!isInsertBetween || formik.values.insert_mode === "marker") &&
          renderTagsField()}
        {(!isInsertBetween || formik.values.insert_mode === "marker") &&
          renderPerformersField()}
        {/* CUSTOM: conditional insert-mode fields */}
        {/* ^^^ CUSTOM: renderDurationField + renderPerformersField */}
      </div>
      <div className="buttons-container px-3">
        <div className="d-flex">
          <Button
            variant="primary"
            type="submit" // CUSTOM: submit once through Formik's form handler
            disabled={
              formik.isSubmitting ||
              (!isNew && !formik.dirty) ||
              !isEqual(formik.errors, {})
            }
            className="scene-marker-form-save" // CUSTOM
          >
            <FormattedMessage id="actions.save" />
          </Button>
          <Button
            variant="secondary"
            type="button"
            onClick={onClose}
            className="ml-2"
          >
            <FormattedMessage id="actions.cancel" />
          </Button>
          {!isNew && (
            <Button
              variant="danger"
              className="ml-auto"
              onClick={() => onDelete()}
            >
              <FormattedMessage id="actions.delete" />
            </Button>
          )}
        </div>
        {/* CUSTOM: begin - marker create actions live on their own row */}
        {!isNew && marker && (
          <div className="d-flex flex-wrap mt-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setCreateAction("insert-between")}
            >
              Insert Marker In-Between
            </Button>
            <Button
              variant="secondary"
              type="button"
              className="ml-2"
              onClick={onDuplicateMarker}
            >
              Duplicate Marker
            </Button>
          </div>
        )}
        {/* CUSTOM: end */}
      </div>
    </Form>
  );
};
