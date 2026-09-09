import React, { useEffect, useMemo, useState } from "react"; // CUSTOM
import { Alert, Button, Col, Form, Row } from "react-bootstrap"; // CUSTOM
import { FormattedMessage, useIntl } from "react-intl";
import { useFormik } from "formik";
import * as yup from "yup";
import * as GQL from "src/core/generated-graphql";
import {
  useFindScene,
  useSceneMarkerUpdate,
  useSceneNegativeMarkerCreate,
  useSceneNegativeMarkerDestroy,
  useSceneNegativeMarkerNames,
  useSceneNegativeMarkerUpdate,
} from "src/core/StashService"; // CUSTOM
import { DurationInput } from "src/components/Shared/DurationInput";
import { MarkerTitleSuggest } from "src/components/Shared/Select"; // CUSTOM
import {
  getAbLoopPlugin,
  getPlayerPosition,
  getPlayer,
} from "src/components/ScenePlayer/util"; // CUSTOM
import { useToast } from "src/hooks/Toast";
import isEqual from "lodash-es/isEqual";
import { formikUtils } from "src/utils/form";
import { yupFormikValidate } from "src/utils/yup";
import { useConfigurationContext } from "src/hooks/Config"; // CUSTOM
import TextUtils from "src/utils/text"; // CUSTOM
import type {
  ISceneMarkerTimestampCopyRequest,
  ISceneMarkerTimestampCopySelection,
  SceneMarkerTimestampDestination,
  SceneMarkerTimestampField,
} from "src/components/ScenePlayer/sceneMarkerTimestampCopy_custom"; // CUSTOM
// CUSTOM: begin
import { findSceneMarkerGapWarningDetails } from "./sceneMarkerGapWarning_custom";
import {
  getSceneNegativeMarkerDuration,
  getSceneNegativeMarkerInitialRange,
  getSceneNegativeMarkerSequentialRange,
} from "./sceneNegativeMarkerForm_custom";
import {
  getSequentialMarkerStart,
  hasSequentialMarkerEnd,
} from "./sceneMarkerSequentialActions_custom";
// CUSTOM: end

interface ISceneNegativeMarkerForm {
  sceneID: string;
  marker?: GQL.SceneNegativeMarker;
  sceneMarkers?: GQL.SceneMarkerDataFragment[];
  negativeMarkers?: GQL.SceneNegativeMarker[];
  onClose: () => void;
  onAddNextMarker: (seconds: number) => void; // CUSTOM: open the regular marker editor
  markerTimestampCopyRequest?: ISceneMarkerTimestampCopyRequest; // CUSTOM
  markerTimestampCopySelection?: ISceneMarkerTimestampCopySelection; // CUSTOM
  onMarkerTimestampCopyRequest: (
    field: SceneMarkerTimestampField | undefined,
    destination: SceneMarkerTimestampDestination
  ) => void; // CUSTOM
  onMarkerTimestampCopySelectionHandled: (requestId: number) => void; // CUSTOM
}

export const SceneNegativeMarkerForm: React.FC<ISceneNegativeMarkerForm> = ({
  sceneID,
  marker,
  sceneMarkers,
  negativeMarkers,
  onClose,
  onAddNextMarker, // CUSTOM
  markerTimestampCopyRequest, // CUSTOM
  markerTimestampCopySelection, // CUSTOM
  onMarkerTimestampCopyRequest, // CUSTOM
  onMarkerTimestampCopySelectionHandled, // CUSTOM
}) => {
  const intl = useIntl();

  const [createMarker] = useSceneNegativeMarkerCreate(); // CUSTOM
  const [updateMarker] = useSceneNegativeMarkerUpdate(); // CUSTOM
  const [destroyMarker] = useSceneNegativeMarkerDestroy(sceneID); // CUSTOM
  const [updateSceneMarker] = useSceneMarkerUpdate(); // CUSTOM
  const Toast = useToast();
  const { configuration } = useConfigurationContext(); // CUSTOM

  const [sequentialNegativeRange, setSequentialNegativeRange] = useState<{
    start_seconds: number;
    end_seconds: number;
  }>();
  const isSequentialNegative = sequentialNegativeRange !== undefined;
  const isNew = marker === undefined || isSequentialNegative;
  const { data: sceneData } = useFindScene(sceneID); // CUSTOM
  const warningSceneMarkers = useMemo(
    () => sceneMarkers ?? sceneData?.findScene?.scene_markers ?? [],
    [sceneData?.findScene?.scene_markers, sceneMarkers]
  );
  const warningNegativeMarkers = useMemo(
    () => negativeMarkers ?? sceneData?.findScene?.negative_markers ?? [],
    [negativeMarkers, sceneData?.findScene?.negative_markers]
  );
  const { data: negativeMarkerNameData, loading: negativeMarkerNamesLoading } =
    useSceneNegativeMarkerNames(); // CUSTOM
  const negativeMarkerTitles =
    negativeMarkerNameData?.sceneNegativeMarkerNames ?? []; // CUSTOM

  const schema = yup.object({
    name: yup.string().ensure(),
    start_seconds: yup.number().min(0).required(),
    end_seconds: yup
      .number()
      .min(0)
      .required()
      .test(
        "is-greater-than-start",
        intl.formatMessage({ id: "validation.end_time_before_start_time" }),
        function (value) {
          return value > this.parent.start_seconds;
        }
      ),
  });

  // CUSTOM: begin - match regular marker A-B loop range initialization
  const initialValues = useMemo(() => {
    if (sequentialNegativeRange) {
      return {
        name: "",
        ...sequentialNegativeRange,
      };
    }

    const abLoop = getAbLoopPlugin()?.getOptions();
    const range = getSceneNegativeMarkerInitialRange({
      marker,
      playerPosition: getPlayerPosition(),
      abLoop,
    });

    return {
      name: marker?.name ?? "",
      ...range,
    };
  }, [marker, sequentialNegativeRange]);
  // CUSTOM: end

  type InputValues = yup.InferType<typeof schema>;

  const formik = useFormik<InputValues>({
    initialValues,
    enableReinitialize: true,
    validate: yupFormikValidate(schema),
    onSubmit: (values) => onSave(schema.cast(values)),
  });

  // CUSTOM: begin - apply one-shot timeline timestamp selections only to the
  // negative-marker editor that launched them.
  const { setFieldValue } = formik;
  useEffect(() => {
    if (
      !markerTimestampCopySelection ||
      markerTimestampCopySelection.destination !== "negative-marker-form" ||
      markerTimestampCopySelection.field === "seconds"
    ) {
      return;
    }

    void setFieldValue(
      markerTimestampCopySelection.field,
      markerTimestampCopySelection.seconds
    );
    onMarkerTimestampCopySelectionHandled(
      markerTimestampCopySelection.requestId
    );
  }, [
    markerTimestampCopySelection,
    onMarkerTimestampCopySelectionHandled,
    setFieldValue,
  ]);

  useEffect(
    () => () => onMarkerTimestampCopyRequest(undefined, "negative-marker-form"),
    [onMarkerTimestampCopyRequest]
  );
  // CUSTOM: end

  // CUSTOM: begin - warn about small unmarked gaps or overlaps next to this negative marker
  const gapWarnings = useMemo(
    () =>
      findSceneMarkerGapWarningDetails({
        draft: {
          id: isNew ? undefined : marker?.id,
          seconds: formik.values.start_seconds,
          end_seconds: formik.values.end_seconds,
        },
        sceneMarkers: warningSceneMarkers,
        negativeMarkers: warningNegativeMarkers,
        roleTagIds: configuration?.ui.roleTagIds ?? {},
      }),
    [
      configuration?.ui.roleTagIds,
      formik.values.end_seconds,
      formik.values.start_seconds,
      isNew,
      marker?.id,
      warningNegativeMarkers,
      warningSceneMarkers,
    ]
  );
  // CUSTOM: end

  async function persistMarker(input: InputValues): Promise<boolean> {
    try {
      if (isNew) {
        await createMarker({
          variables: {
            input: {
              scene_id: sceneID,
              name: input.name,
              start_seconds: input.start_seconds,
              end_seconds: input.end_seconds,
            },
          },
        });
      } else {
        await updateMarker({
          variables: {
            input: {
              id: marker.id,
              name: input.name,
              start_seconds: input.start_seconds,
              end_seconds: input.end_seconds,
            },
          },
        });
      }
    } catch (e) {
      Toast.error(e);
      return false;
    }

    return true;
  }

  async function onSave(input: InputValues) {
    if (await persistMarker(input)) {
      onClose(); // CUSTOM: preserve the form after a failed mutation
    }
  }

  async function validateAndPersist(): Promise<InputValues | undefined> {
    const errors = await formik.validateForm();
    if (!isEqual(errors, {})) {
      Toast.error(
        "Complete the required negative-marker fields before saving."
      );
      return undefined;
    }

    const input = schema.cast(formik.values);
    return (await persistMarker(input)) ? input : undefined;
  }

  // CUSTOM: save the current negative marker, then continue at its end boundary.
  async function onSaveAndAddNextNegativeMarker() {
    if (
      formik.isSubmitting ||
      !hasSequentialMarkerEnd(formik.values.end_seconds)
    ) {
      return;
    }

    formik.setSubmitting(true);
    try {
      const input = await validateAndPersist();
      if (!input || !hasSequentialMarkerEnd(input.end_seconds)) return;

      const nextRange = getSceneNegativeMarkerSequentialRange(
        input.end_seconds
      );
      setSequentialNegativeRange(nextRange);
      formik.resetForm({
        values: {
          name: "",
          ...nextRange,
        },
      });
    } finally {
      formik.setSubmitting(false);
    }
  }

  async function onSaveAndAddNextMarker() {
    if (
      formik.isSubmitting ||
      !hasSequentialMarkerEnd(formik.values.end_seconds)
    ) {
      return;
    }

    formik.setSubmitting(true);
    try {
      const input = await validateAndPersist();
      if (!input || !hasSequentialMarkerEnd(input.end_seconds)) return;

      onClose();
      onAddNextMarker(getSequentialMarkerStart(input.end_seconds));
    } finally {
      formik.setSubmitting(false);
    }
  }

  async function onDelete() {
    if (isNew) return;

    try {
      await destroyMarker({ variables: { id: marker.id } });
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
  const { renderField } = formikUtils(intl, formik, splitProps);

  function renderTitleField() {
    const title = intl.formatMessage({ id: "title" });
    const control = (
      <MarkerTitleSuggest
        initialMarkerTitle={formik.values.name}
        onChange={(value) => formik.setFieldValue("name", value)}
        additionalTitles={negativeMarkerTitles} // CUSTOM
        additionalTitlesLoading={negativeMarkerNamesLoading} // CUSTOM
        includeRegularTitles={false} // CUSTOM
      />
    );

    return renderField("name", title, control);
  }

  function renderStartTimeField() {
    const { error } = formik.getFieldMeta("start_seconds");

    const title = intl.formatMessage({ id: "time" });
    const control = (
      <DurationInput
        value={formik.values.start_seconds}
        setValue={(v) => formik.setFieldValue("start_seconds", v)}
        onReset={() =>
          formik.setFieldValue("start_seconds", getPlayerPosition() ?? 0)
        }
        onSeekTo={() => {
          const player = getPlayer();
          if (player && formik.values.start_seconds !== null) {
            player.currentTime(formik.values.start_seconds);
          }
        }}
        onCopyFromMarker={() =>
          onMarkerTimestampCopyRequest("start_seconds", "negative-marker-form")
        }
        copyFromMarkerActive={
          markerTimestampCopyRequest?.destination === "negative-marker-form" &&
          markerTimestampCopyRequest.field === "start_seconds"
        }
        error={error}
      />
    );

    return renderField("start_seconds", title, control);
  }

  function renderEndTimeField() {
    const { error } = formik.getFieldMeta("end_seconds");

    const title = intl.formatMessage({ id: "time_end" });
    const control = (
      <>
        <DurationInput
          value={formik.values.end_seconds}
          setValue={(v) => formik.setFieldValue("end_seconds", v ?? null)}
          onReset={() =>
            formik.setFieldValue("end_seconds", getPlayerPosition() ?? 0)
          }
          onSeekTo={() => {
            const player = getPlayer();
            if (player && formik.values.end_seconds !== null) {
              player.currentTime(formik.values.end_seconds);
            }
          }}
          onCopyFromMarker={() =>
            onMarkerTimestampCopyRequest("end_seconds", "negative-marker-form")
          }
          copyFromMarkerActive={
            markerTimestampCopyRequest?.destination ===
              "negative-marker-form" &&
            markerTimestampCopyRequest.field === "end_seconds"
          }
          error={error}
        />
        {formik.touched.end_seconds && formik.errors.end_seconds && (
          <Form.Control.Feedback type="invalid">
            {formik.errors.end_seconds}
          </Form.Control.Feedback>
        )}
      </>
    );

    return renderField("end_seconds", title, control);
  }

  // CUSTOM: begin - mirror regular marker timestamp-copy guidance.
  function renderTimestampCopyNotice() {
    if (
      !markerTimestampCopyRequest ||
      markerTimestampCopyRequest.destination !== "negative-marker-form"
    ) {
      return null;
    }

    const destination =
      markerTimestampCopyRequest.field === "start_seconds"
        ? "Start time"
        : "End time";

    return (
      <Alert variant="info" className="d-flex align-items-center py-2">
        <span>
          Hover a regular or negative marker in the player timeline to preview
          its exact range, then choose <strong>Start</strong> or{" "}
          <strong>End</strong>. The timestamp will be copied into {destination}.
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="ml-auto"
          onClick={() =>
            onMarkerTimestampCopyRequest(undefined, "negative-marker-form")
          }
        >
          Cancel
        </Button>
      </Alert>
    );
  }
  // CUSTOM: end

  // CUSTOM: begin - match the regular marker's live duration display
  function renderDurationField() {
    const duration = getSceneNegativeMarkerDuration(
      formik.values.start_seconds,
      formik.values.end_seconds
    );
    if (duration === undefined) return null;

    const title = intl.formatMessage({
      id: "duration",
      defaultMessage: "Duration",
    });

    return (
      <Form.Group as={Row} data-field="duration_display">
        <Form.Label {...splitProps.labelProps}>{title}</Form.Label>
        <Col {...splitProps.fieldProps}>
          <Form.Control
            plaintext
            readOnly
            value={TextUtils.formatDurationRange(duration)}
          />
        </Col>
      </Form.Group>
    );
  }
  // CUSTOM: end

  // CUSTOM: begin - small adjacent gap/overlap warning
  function formatGapMilliseconds(seconds: number) {
    return `${Math.round(seconds * 1000)}ms`;
  }

  function formatGapWarning(
    boundary: "Previous" | "Next",
    warning: NonNullable<typeof gapWarnings>["previous"]
  ) {
    if (!warning) return "";

    return `${boundary} ${warning.issueType} of ${formatGapMilliseconds(
      warning.issueSeconds
    )} with ${warning.adjacentMarkerType}`;
  }

  function renderGapWarning() {
    if (!gapWarnings) return null;

    const closePreviousGap = async () => {
      if (!gapWarnings.previous) return;
      await formik.setFieldValue(
        "start_seconds",
        gapWarnings.previous.closeToSeconds
      );
    };
    const closeNextGap = async () => {
      if (!gapWarnings.next) return;
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
      const warning = gapWarnings[boundary];
      if (!warning?.adjacentMarkerId) return;

      try {
        if (warning.adjacentMarkerKind === "negative-marker") {
          await updateMarker({
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

        const adjacentMarker = warningSceneMarkers.find(
          (sceneMarker) => sceneMarker.id === warning.adjacentMarkerId
        );
        if (!adjacentMarker) return;

        await updateSceneMarker({
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
      !!gapWarnings.previous?.adjacentMarkerId &&
      !!gapWarnings.next?.adjacentMarkerId;

    return (
      <Alert variant="warning" className="py-2">
        {gapWarnings.previous && (
          <div>{formatGapWarning("Previous", gapWarnings.previous)}</div>
        )}
        {gapWarnings.next && (
          <div>{formatGapWarning("Next", gapWarnings.next)}</div>
        )}
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
      </Alert>
    );
  }
  // CUSTOM: end

  return (
    <Form noValidate onSubmit={formik.handleSubmit}>
      <div className="form-container px-3">
        {renderTitleField()}
        {renderStartTimeField()}
        {renderEndTimeField()}
        {renderDurationField()}
        {renderTimestampCopyNotice()} {/* CUSTOM */}
        {renderGapWarning()}
      </div>
      <div className="buttons-container px-3">
        <div className="d-flex">
          <Button
            variant="primary"
            disabled={(!isNew && !formik.dirty) || !isEqual(formik.errors, {})}
            className="scene-marker-form-save" // CUSTOM
            onClick={() => formik.submitForm()}
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
        {/* CUSTOM: begin - adjacent regular and negative marker actions */}
        <div className="d-flex flex-wrap mt-2 scene-marker-sequential-actions">
          <Button
            variant="secondary"
            type="button"
            disabled={
              formik.isSubmitting ||
              !hasSequentialMarkerEnd(formik.values.end_seconds)
            }
            onClick={() => void onSaveAndAddNextMarker()}
          >
            Save &amp; Add Next Marker
          </Button>
          <Button
            variant="secondary"
            type="button"
            className="ml-2"
            disabled={
              formik.isSubmitting ||
              !hasSequentialMarkerEnd(formik.values.end_seconds)
            }
            onClick={() => void onSaveAndAddNextNegativeMarker()}
          >
            Save &amp; Add Next Negative Marker
          </Button>
        </div>
        {/* CUSTOM: end */}
      </div>
    </Form>
  );
};
