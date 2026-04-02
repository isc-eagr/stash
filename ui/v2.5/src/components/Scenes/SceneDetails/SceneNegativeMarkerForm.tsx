import React, { useMemo } from "react";
import { Button, Form } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import { useFormik } from "formik";
import * as yup from "yup";
import * as GQL from "src/core/generated-graphql";
import { DurationInput } from "src/components/Shared/DurationInput";
import { getPlayerPosition, getPlayer } from "src/components/ScenePlayer/util";
import { useToast } from "src/hooks/Toast";
import isEqual from "lodash-es/isEqual";
import { formikUtils } from "src/utils/form";
import { yupFormikValidate } from "src/utils/yup";

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

  const isNew = marker === undefined;

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
      start_seconds: marker?.start_seconds ?? Math.round(getPlayerPosition() ?? 0),
      end_seconds: marker?.end_seconds ?? Math.round((getPlayerPosition() ?? 0) + 10),
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

  return (
    <Form noValidate onSubmit={formik.handleSubmit}>
      <div className="form-container px-3">
        {renderTitleField()}
        {renderStartTimeField()}
        {renderEndTimeField()}
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
