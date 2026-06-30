import React, { useMemo } from "react";
import { Alert, Button, Form } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import { useFormik } from "formik";
import * as yup from "yup";
import * as GQL from "src/core/generated-graphql";
import { useFindScene } from "src/core/StashService"; // CUSTOM
import { DurationInput } from "src/components/Shared/DurationInput";
import { getPlayerPosition, getPlayer } from "src/components/ScenePlayer/util";
import { useToast } from "src/hooks/Toast";
import isEqual from "lodash-es/isEqual";
import { formikUtils } from "src/utils/form";
import { yupFormikValidate } from "src/utils/yup";
import { useConfigurationContext } from "src/hooks/Config"; // CUSTOM
import TextUtils from "src/utils/text"; // CUSTOM
// CUSTOM: begin
import { findSceneMarkerGapWarnings } from "./sceneMarkerGapWarning_custom";
// CUSTOM: end

interface ISceneNegativeMarkerForm {
  sceneID: string;
  marker?: GQL.SceneNegativeMarker;
  onClose: () => void;
}

export const SceneNegativeMarkerForm: React.FC<ISceneNegativeMarkerForm> = ({
  sceneID,
  marker,
  onClose,
}) => {
  const intl = useIntl();

  const [createMarker] = GQL.useSceneNegativeMarkerCreateMutation();
  const [updateMarker] = GQL.useSceneNegativeMarkerUpdateMutation();
  const [destroyMarker] = GQL.useSceneNegativeMarkerDestroyMutation();
  const Toast = useToast();
  const { configuration } = useConfigurationContext(); // CUSTOM

  const isNew = marker === undefined;
  const { data: sceneData } = useFindScene(sceneID); // CUSTOM

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

  // Get current player position for new markers
  const initialValues = useMemo(
    () => ({
      name: marker?.name ?? "",
      start_seconds:
        marker?.start_seconds ?? Math.round(getPlayerPosition() ?? 0),
      end_seconds:
        marker?.end_seconds ?? Math.round((getPlayerPosition() ?? 0) + 10),
    }),
    [marker]
  );

  type InputValues = yup.InferType<typeof schema>;

  const formik = useFormik<InputValues>({
    initialValues,
    enableReinitialize: true,
    validate: yupFormikValidate(schema),
    onSubmit: (values) => onSave(schema.cast(values)),
  });

  // CUSTOM: begin - warn about small unmarked gaps or overlaps next to this negative marker
  const gapWarnings = useMemo(
    () =>
      findSceneMarkerGapWarnings({
        draft: {
          id: marker?.id,
          seconds: formik.values.start_seconds,
          end_seconds: formik.values.end_seconds,
        },
        sceneMarkers: sceneData?.findScene?.scene_markers ?? [],
        negativeMarkers: sceneData?.findScene?.negative_markers ?? [],
        roleTagIds: configuration?.ui.roleTagIds ?? {},
      }),
    [
      configuration?.ui.roleTagIds,
      formik.values.end_seconds,
      formik.values.start_seconds,
      marker?.id,
      sceneData?.findScene?.negative_markers,
      sceneData?.findScene?.scene_markers,
    ]
  );
  // CUSTOM: end

  async function onSave(input: InputValues) {
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
    } finally {
      onClose();
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
      <Form.Control
        type="text"
        placeholder={intl.formatMessage({ id: "title" })}
        {...formik.getFieldProps("name")}
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

  // CUSTOM: begin - small adjacent gap/overlap warning
  function formatGapMilliseconds(seconds: number) {
    return `${Math.round(seconds * 1000)}ms`;
  }

  function formatBoundaryIssueRange(
    firstSeconds: number,
    secondSeconds: number
  ) {
    return `${TextUtils.secondsToTimestamp(
      Math.min(firstSeconds, secondSeconds),
      true
    )} - ${TextUtils.secondsToTimestamp(
      Math.max(firstSeconds, secondSeconds),
      true
    )}`;
  }

  function renderGapWarning() {
    if (!gapWarnings) return null;

    const closePreviousGap = () => {
      if (!gapWarnings.previous) return;
      formik.setFieldValue(
        "start_seconds",
        gapWarnings.previous.closeToSeconds
      );
    };
    const closeNextGap = () => {
      if (!gapWarnings.next) return;
      formik.setFieldValue("end_seconds", gapWarnings.next.closeToSeconds);
    };
    const closeAllGaps = () => {
      closePreviousGap();
      closeNextGap();
    };

    const previousLabel =
      gapWarnings.previous &&
      formatBoundaryIssueRange(
        gapWarnings.previous.markerBoundarySeconds,
        formik.values.start_seconds
      );
    const nextLabel =
      gapWarnings.next &&
      formatBoundaryIssueRange(
        formik.values.end_seconds,
        gapWarnings.next.markerBoundarySeconds
      );
    const hasGap = [gapWarnings.previous, gapWarnings.next].some(
      (warning) => warning?.issueType === "gap"
    );
    const hasOverlap = [gapWarnings.previous, gapWarnings.next].some(
      (warning) => warning?.issueType === "overlap"
    );
    const issueSummary =
      hasGap && hasOverlap
        ? "tiny gap or overlap"
        : hasOverlap
        ? "tiny overlap"
        : "tiny unmarked gap";

    return (
      <Alert variant="warning" className="py-2">
        <div className="mb-2">
          Creating this negative marker would leave a {issueSummary}.
        </div>
        {previousLabel && gapWarnings.previous && (
          <div>
            Previous {gapWarnings.previous.issueType} with{" "}
            {gapWarnings.previous.adjacentMarkerType}: {previousLabel} (
            {formatGapMilliseconds(gapWarnings.previous.issueSeconds)})
          </div>
        )}
        {nextLabel && gapWarnings.next && (
          <div>
            Next {gapWarnings.next.issueType} with{" "}
            {gapWarnings.next.adjacentMarkerType}: {nextLabel} (
            {formatGapMilliseconds(gapWarnings.next.issueSeconds)})
          </div>
        )}
        <div className="mt-2 d-flex flex-wrap" style={{ gap: "0.5rem" }}>
          {gapWarnings.previous && (
            <Button size="sm" variant="warning" onClick={closePreviousGap}>
              Close previous {gapWarnings.previous.issueType}
            </Button>
          )}
          {gapWarnings.next && (
            <Button size="sm" variant="warning" onClick={closeNextGap}>
              Close next {gapWarnings.next.issueType}
            </Button>
          )}
          {gapWarnings.previous && gapWarnings.next && (
            <Button size="sm" variant="warning" onClick={closeAllGaps}>
              Close both
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
        {renderGapWarning()}
      </div>
      <div className="buttons-container px-3">
        <div className="d-flex">
          <Button
            variant="primary"
            disabled={(!isNew && !formik.dirty) || !isEqual(formik.errors, {})}
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
      </div>
    </Form>
  );
};
